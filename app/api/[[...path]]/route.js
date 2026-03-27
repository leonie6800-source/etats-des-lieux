import { NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';
import { v4 as uuidv4 } from 'uuid';
import OpenAI, { toFile } from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const client = new MongoClient(process.env.MONGO_URL);
const dbName = process.env.DB_NAME || 'edl_pro';

let dbInstance = null;

async function getDb() {
  if (!dbInstance) {
    await client.connect();
    dbInstance = client.db(dbName);
  }
  return dbInstance;
}

function getPathSegments(request) {
  const url = new URL(request.url);
  const pathMatch = url.pathname.replace(/^\/api\//, '');
  return pathMatch.split('/').filter(Boolean);
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

const DEFAULT_ROOMS = [
  { nom: 'Entrée', icon: '🚪' },
  { nom: 'Salon', icon: '🛋️' },
  { nom: 'Cuisine', icon: '🍳' },
  { nom: 'Chambre 1', icon: '🛏️' },
  { nom: 'Chambre 2', icon: '🛏️' },
  { nom: 'Chambre 3', icon: '🛏️' },
  { nom: 'Salle de bain', icon: '🚿' },
  { nom: 'WC', icon: '🚽' },
  { nom: 'Couloir', icon: '🏠' },
  { nom: 'Balcon', icon: '🌿' },
  { nom: 'Cave', icon: '📦' },
  { nom: 'Garage', icon: '🚗' },
];

function getRoomsForType(type) {
  const base = ['Entrée', 'Couloir'];
  const common = ['Cuisine', 'Salle de bain', 'WC'];
  switch (type) {
    case 'Studio': return [...base, 'Salon', ...common];
    case 'T1': return [...base, 'Salon', 'Chambre 1', ...common];
    case 'T2': return [...base, 'Salon', 'Chambre 1', 'Chambre 2', ...common];
    case 'T3': return [...base, 'Salon', 'Chambre 1', 'Chambre 2', 'Chambre 3', ...common];
    case 'T4': return [...base, 'Salon', 'Chambre 1', 'Chambre 2', 'Chambre 3', ...common, 'Balcon'];
    case 'Maison': return [...base, 'Salon', 'Chambre 1', 'Chambre 2', 'Chambre 3', ...common, 'Balcon', 'Cave', 'Garage'];
    default: return [...base, 'Salon', 'Chambre 1', ...common];
  }
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders() });
}

export async function GET(request) {
  try {
    const db = await getDb();
    const segments = getPathSegments(request);
    const url = new URL(request.url);

    // GET /api/edl
    if (segments[0] === 'edl' && !segments[1]) {
      const edls = await db.collection('edl').find({}).sort({ created_at: -1 }).toArray();
      for (let edl of edls) {
        const pieces = await db.collection('pieces').find({ edl_id: edl.id }).toArray();
        const photos = await db.collection('photos').find({ edl_id: edl.id }).toArray();
        edl.pieces_total = pieces.length;
        edl.pieces_done = pieces.filter(p => p.statut === 'completed').length;
        edl.photos_count = photos.length;
      }
      return NextResponse.json(edls, { headers: corsHeaders() });
    }

    // GET /api/edl/:id
    if (segments[0] === 'edl' && segments[1]) {
      const edl = await db.collection('edl').findOne({ id: segments[1] });
      if (!edl) return NextResponse.json({ error: 'EDL not found' }, { status: 404, headers: corsHeaders() });
      const pieces = await db.collection('pieces').find({ edl_id: edl.id }).toArray();
      const photos = await db.collection('photos').find({ edl_id: edl.id }).toArray();
      edl.pieces = pieces;
      edl.pieces_total = pieces.length;
      edl.pieces_done = pieces.filter(p => p.statut === 'completed').length;
      edl.photos_count = photos.length;
      return NextResponse.json(edl, { headers: corsHeaders() });
    }

    // GET /api/pieces?edl_id=xxx
    if (segments[0] === 'pieces' && !segments[1]) {
      const edl_id = url.searchParams.get('edl_id');
      if (!edl_id) return NextResponse.json({ error: 'edl_id required' }, { status: 400, headers: corsHeaders() });
      const pieces = await db.collection('pieces').find({ edl_id }).toArray();
      for (let piece of pieces) {
        const photos = await db.collection('photos').find({ piece_id: piece.id }).toArray();
        piece.photos_count = photos.length;
      }
      return NextResponse.json(pieces, { headers: corsHeaders() });
    }

    // GET /api/pieces/:id
    if (segments[0] === 'pieces' && segments[1]) {
      const piece = await db.collection('pieces').findOne({ id: segments[1] });
      if (!piece) return NextResponse.json({ error: 'Piece not found' }, { status: 404, headers: corsHeaders() });
      return NextResponse.json(piece, { headers: corsHeaders() });
    }

    // GET /api/photos?piece_id=xxx or edl_id=xxx
    if (segments[0] === 'photos' && !segments[1]) {
      const piece_id = url.searchParams.get('piece_id');
      const edl_id = url.searchParams.get('edl_id');
      let query = {};
      if (piece_id) query.piece_id = piece_id;
      if (edl_id) query.edl_id = edl_id;
      const photos = await db.collection('photos').find(query).sort({ created_at: 1 }).toArray();
      // Return without base64 data for listing (lighter)
      const photosLight = photos.map(p => ({ ...p, data: p.data ? p.data.substring(0, 50) + '...' : null, has_data: !!p.data }));
      return NextResponse.json(photos, { headers: corsHeaders() });
    }

    // GET /api/photos/:id
    if (segments[0] === 'photos' && segments[1]) {
      const photo = await db.collection('photos').findOne({ id: segments[1] });
      if (!photo) return NextResponse.json({ error: 'Photo not found' }, { status: 404, headers: corsHeaders() });
      return NextResponse.json(photo, { headers: corsHeaders() });
    }

    return NextResponse.json({ error: 'Route not found' }, { status: 404, headers: corsHeaders() });
  } catch (error) {
    console.error('GET Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders() });
  }
}

export async function POST(request) {
  try {
    const db = await getDb();
    const segments = getPathSegments(request);
    const body = await request.json();

    // POST /api/edl
    if (segments[0] === 'edl' && !segments[1]) {
      const edl = {
        id: uuidv4(),
        created_at: new Date().toISOString(),
        adresse: body.adresse || '',
        type_logement: body.type_logement || 'T2',
        type_edl: body.type_edl || 'Entrée',
        nom_locataire: body.nom_locataire || '',
        nom_proprietaire: body.nom_proprietaire || '',
        statut: 'en_cours',
        stripe_payment_id: null,
        paid: false,
      };
      await db.collection('edl').insertOne(edl);

      // Create default rooms
      const roomNames = getRoomsForType(body.type_logement);
      const pieces = roomNames.map(nom => {
        const roomDef = DEFAULT_ROOMS.find(r => r.nom === nom) || { nom, icon: '📋' };
        return {
          id: uuidv4(),
          edl_id: edl.id,
          nom: roomDef.nom,
          icon: roomDef.icon,
          statut: 'pending',
          observations_generales: '',
          donnees_json: {},
          created_at: new Date().toISOString(),
        };
      });
      if (pieces.length > 0) {
        await db.collection('pieces').insertMany(pieces);
      }

      edl.pieces = pieces;
      return NextResponse.json(edl, { status: 201, headers: corsHeaders() });
    }

    // POST /api/pieces
    if (segments[0] === 'pieces') {
      const piece = {
        id: uuidv4(),
        edl_id: body.edl_id,
        nom: body.nom || 'Pièce',
        icon: body.icon || '📋',
        statut: 'pending',
        observations_generales: '',
        donnees_json: {},
        created_at: new Date().toISOString(),
      };
      await db.collection('pieces').insertOne(piece);
      return NextResponse.json(piece, { status: 201, headers: corsHeaders() });
    }

    // POST /api/photos
    if (segments[0] === 'photos') {
      const photo = {
        id: uuidv4(),
        piece_id: body.piece_id,
        edl_id: body.edl_id,
        data: body.data, // base64 string
        legende: body.legende || '',
        horodatage: body.horodatage || new Date().toISOString(),
        gps: body.gps || null,
        ai_analysis: body.ai_analysis || null,
        created_at: new Date().toISOString(),
      };
      await db.collection('photos').insertOne(photo);
      return NextResponse.json({ ...photo, data: undefined }, { status: 201, headers: corsHeaders() });
    }

    // POST /api/payment/mock
    if (segments[0] === 'payment') {
      const edl_id = body.edl_id;
      const paymentId = 'mock_pay_' + uuidv4().substring(0, 8);
      await db.collection('edl').updateOne(
        { id: edl_id },
        { $set: { stripe_payment_id: paymentId, paid: true, statut: 'completed' } }
      );
      return NextResponse.json({ success: true, payment_id: paymentId }, { headers: corsHeaders() });
    }

    // ==================== AI ENDPOINTS ====================

    // POST /api/ai/analyze-photo - GPT-4o-mini Vision analysis
    if (segments[0] === 'ai' && segments[1] === 'analyze-photo') {
      const { image_base64, edl_id, available_pieces } = body;
      if (!image_base64) {
        return NextResponse.json({ error: 'image_base64 required' }, { status: 400, headers: corsHeaders() });
      }

      // Strip data URL prefix if present for the API call
      let base64ForApi = image_base64;
      if (base64ForApi.startsWith('data:')) {
        // Keep the full data URL for OpenAI API
      }

      const pieceNames = (available_pieces || []).join(', ');

      try {
        const response = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: `Tu es un expert en inspection immobilière. Tu analyses des photos de logements pour identifier la pièce et les éventuels défauts. Les pièces disponibles dans ce logement sont : ${pieceNames || 'Entrée, Salon, Cuisine, Chambre 1, Chambre 2, Salle de bain, WC, Couloir, Balcon, Cave, Garage'}. Réponds UNIQUEMENT en JSON valide.`
            },
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: `Identifie la pièce de la maison sur cette photo. Si tu vois des défauts (taches, fissures, moisissures, dégradations), décris-les brièvement. Réponds UNIQUEMENT en format JSON avec les clés : "piece" (nom exact parmi la liste fournie), "objets_detectes" (liste d'objets/éléments visibles), "etat_general" (note de 1 à 5, où 5=parfait), "observations" (description brève des défauts ou de l'état), "defauts_majeurs" (true/false).`
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: base64ForApi,
                    detail: 'low'
                  }
                }
              ]
            }
          ],
          max_tokens: 500,
          temperature: 0.2,
        });

        const content = response.choices[0]?.message?.content || '{}';
        // Parse JSON from response (handle markdown code blocks)
        let parsed;
        try {
          const jsonMatch = content.match(/```json?\s*([\s\S]*?)\s*```/) || content.match(/\{[\s\S]*\}/);
          const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : content;
          parsed = JSON.parse(jsonStr);
        } catch {
          parsed = { piece: 'Inconnu', objets_detectes: [], etat_general: 3, observations: content, defauts_majeurs: false };
        }

        return NextResponse.json({
          success: true,
          analysis: {
            piece: parsed.piece || 'Inconnu',
            objets_detectes: parsed.objets_detectes || [],
            etat_general: parsed.etat_general || 3,
            observations: parsed.observations || '',
            defauts_majeurs: parsed.defauts_majeurs || false,
            verified: !(parsed.defauts_majeurs),
          }
        }, { headers: corsHeaders() });

      } catch (aiError) {
        console.error('AI Analyze Error:', aiError);
        return NextResponse.json({ error: 'Erreur analyse IA: ' + aiError.message }, { status: 500, headers: corsHeaders() });
      }
    }

    // POST /api/ai/batch-analyze - Batch analyze photos and auto-classify
    if (segments[0] === 'ai' && segments[1] === 'batch-analyze') {
      const { photos: photosList, edl_id } = body;
      if (!photosList || !Array.isArray(photosList) || photosList.length === 0) {
        return NextResponse.json({ error: 'photos array required' }, { status: 400, headers: corsHeaders() });
      }

      // Get available pieces for this EDL
      const pieces = await db.collection('pieces').find({ edl_id }).toArray();
      const pieceNames = pieces.map(p => p.nom);

      const results = [];
      for (const photoData of photosList) {
        try {
          const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
              {
                role: 'system',
                content: `Tu es un expert en inspection immobilière. Les pièces de ce logement sont : ${pieceNames.join(', ')}. Réponds UNIQUEMENT en JSON valide.`
              },
              {
                role: 'user',
                content: [
                  {
                    type: 'text',
                    text: `Identifie la pièce sur cette photo parmi : ${pieceNames.join(', ')}. Détecte les défauts. Réponds en JSON : {"piece": "nom_exact", "objets_detectes": [], "etat_general": 1-5, "observations": "...", "defauts_majeurs": true/false}`
                  },
                  {
                    type: 'image_url',
                    image_url: { url: photoData.data, detail: 'low' }
                  }
                ]
              }
            ],
            max_tokens: 400,
            temperature: 0.2,
          });

          const content = response.choices[0]?.message?.content || '{}';
          let parsed;
          try {
            const jsonMatch = content.match(/```json?\s*([\s\S]*?)\s*```/) || content.match(/\{[\s\S]*\}/);
            const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : content;
            parsed = JSON.parse(jsonStr);
          } catch {
            parsed = { piece: pieceNames[0] || 'Inconnu', etat_general: 3, observations: '', defauts_majeurs: false };
          }

          // Find matching piece
          const matchedPiece = pieces.find(p =>
            p.nom.toLowerCase() === (parsed.piece || '').toLowerCase()
          ) || pieces.find(p =>
            (parsed.piece || '').toLowerCase().includes(p.nom.toLowerCase()) ||
            p.nom.toLowerCase().includes((parsed.piece || '').toLowerCase())
          );

          // Save photo with AI data
          const photo = {
            id: uuidv4(),
            piece_id: matchedPiece ? matchedPiece.id : null,
            edl_id,
            data: photoData.data,
            legende: parsed.observations || '',
            horodatage: photoData.horodatage || new Date().toISOString(),
            gps: photoData.gps || null,
            ai_analysis: {
              piece: parsed.piece || 'Inconnu',
              objets_detectes: parsed.objets_detectes || [],
              etat_general: parsed.etat_general || 3,
              observations: parsed.observations || '',
              defauts_majeurs: parsed.defauts_majeurs || false,
              verified: !(parsed.defauts_majeurs),
            },
            created_at: new Date().toISOString(),
          };
          await db.collection('photos').insertOne(photo);

          results.push({
            id: photo.id,
            piece_detected: parsed.piece,
            piece_id: matchedPiece?.id || null,
            piece_nom: matchedPiece?.nom || 'Non classée',
            etat_general: parsed.etat_general,
            observations: parsed.observations,
            defauts_majeurs: parsed.defauts_majeurs,
            verified: !(parsed.defauts_majeurs),
          });
        } catch (aiErr) {
          console.error('Batch AI Error for photo:', aiErr.message);
          results.push({ error: aiErr.message });
        }
      }

      return NextResponse.json({ success: true, results, total: results.length }, { headers: corsHeaders() });
    }

    // POST /api/ai/transcribe - Whisper transcription + GPT cleanup
    if (segments[0] === 'ai' && segments[1] === 'transcribe') {
      const { audio_base64, language } = body;
      if (!audio_base64) {
        return NextResponse.json({ error: 'audio_base64 required' }, { status: 400, headers: corsHeaders() });
      }

      try {
        // Decode base64 audio
        let audioData = audio_base64;
        let mimeType = 'audio/webm';
        if (audioData.startsWith('data:')) {
          const match = audioData.match(/^data:([^;]+);base64,(.+)$/);
          if (match) {
            mimeType = match[1];
            audioData = match[2];
          }
        }
        const buffer = Buffer.from(audioData, 'base64');

        // Determine file extension
        const extMap = { 'audio/webm': 'webm', 'audio/mp4': 'mp4', 'audio/mpeg': 'mp3', 'audio/wav': 'wav', 'audio/ogg': 'ogg' };
        const ext = extMap[mimeType] || 'webm';

        // Transcribe with Whisper
        const file = await toFile(buffer, `audio.${ext}`, { type: mimeType });
        const transcription = await openai.audio.transcriptions.create({
          file,
          model: 'whisper-1',
          language: language || 'fr',
          response_format: 'text',
        });

        const rawText = typeof transcription === 'string' ? transcription : transcription.text || '';

        // Clean up with GPT-4o-mini
        const cleanResponse = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: 'Tu es un assistant spécialisé en rédaction immobilière. Nettoie le texte transcrit : supprime les hésitations (euh, hmm), corrige la grammaire, utilise un vocabulaire immobilier professionnel. Garde le sens original. Réponds uniquement avec le texte nettoyé, sans guillemets ni explications.'
            },
            {
              role: 'user',
              content: `Nettoie cette transcription vocale pour un état des lieux immobilier :\n\n"${rawText}"`
            }
          ],
          max_tokens: 500,
          temperature: 0.3,
        });

        const cleanedText = cleanResponse.choices[0]?.message?.content || rawText;

        return NextResponse.json({
          success: true,
          raw_text: rawText,
          cleaned_text: cleanedText.trim(),
        }, { headers: corsHeaders() });

      } catch (transcribeError) {
        console.error('Transcribe Error:', transcribeError);
        return NextResponse.json({ error: 'Erreur transcription: ' + transcribeError.message }, { status: 500, headers: corsHeaders() });
      }
    }

    return NextResponse.json({ error: 'Route not found' }, { status: 404, headers: corsHeaders() });
  } catch (error) {
    console.error('POST Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders() });
  }
}

export async function PUT(request) {
  try {
    const db = await getDb();
    const segments = getPathSegments(request);
    const body = await request.json();

    // PUT /api/edl/:id
    if (segments[0] === 'edl' && segments[1]) {
      const { id, _id, ...updateData } = body;
      await db.collection('edl').updateOne({ id: segments[1] }, { $set: updateData });
      const updated = await db.collection('edl').findOne({ id: segments[1] });
      return NextResponse.json(updated, { headers: corsHeaders() });
    }

    // PUT /api/pieces/:id
    if (segments[0] === 'pieces' && segments[1]) {
      const { id, _id, ...updateData } = body;
      await db.collection('pieces').updateOne({ id: segments[1] }, { $set: updateData });
      const updated = await db.collection('pieces').findOne({ id: segments[1] });
      return NextResponse.json(updated, { headers: corsHeaders() });
    }

    // PUT /api/photos/:id
    if (segments[0] === 'photos' && segments[1]) {
      const { id, _id, ...updateData } = body;
      await db.collection('photos').updateOne({ id: segments[1] }, { $set: updateData });
      return NextResponse.json({ success: true }, { headers: corsHeaders() });
    }

    return NextResponse.json({ error: 'Route not found' }, { status: 404, headers: corsHeaders() });
  } catch (error) {
    console.error('PUT Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders() });
  }
}

export async function DELETE(request) {
  try {
    const db = await getDb();
    const segments = getPathSegments(request);

    // DELETE /api/photos/:id
    if (segments[0] === 'photos' && segments[1]) {
      await db.collection('photos').deleteOne({ id: segments[1] });
      return NextResponse.json({ success: true }, { headers: corsHeaders() });
    }

    // DELETE /api/edl/:id
    if (segments[0] === 'edl' && segments[1]) {
      await db.collection('photos').deleteMany({ edl_id: segments[1] });
      await db.collection('pieces').deleteMany({ edl_id: segments[1] });
      await db.collection('edl').deleteOne({ id: segments[1] });
      return NextResponse.json({ success: true }, { headers: corsHeaders() });
    }

    return NextResponse.json({ error: 'Route not found' }, { status: 404, headers: corsHeaders() });
  } catch (error) {
    console.error('DELETE Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders() });
  }
}

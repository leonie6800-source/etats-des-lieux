import { NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';
import { v4 as uuidv4 } from 'uuid';
import OpenAI, { toFile } from 'openai';
import Stripe from 'stripe';
import { v2 as cloudinary } from 'cloudinary';
import PDFDocument from 'pdfkit';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

// Upload base64 image to Cloudinary
async function uploadToCloudinary(base64Data, folder = 'edl-pro') {
  try {
    const result = await cloudinary.uploader.upload(base64Data, {
      folder,
      resource_type: 'image',
      quality: 'auto',
      fetch_format: 'auto',
    });
    return { url: result.secure_url, public_id: result.public_id, width: result.width, height: result.height };
  } catch (err) {
    console.error('Cloudinary upload error:', err.message);
    return null;
  }
}

// Delete from Cloudinary
async function deleteFromCloudinary(publicId) {
  try {
    await cloudinary.uploader.destroy(publicId, { invalidate: true });
  } catch (err) {
    console.error('Cloudinary delete error:', err.message);
  }
}

// Fixed pricing (backend only - NEVER from frontend)
const PLANS = {
  one_shot: { name: 'État des Lieux — À l\'acte', price: 9.90, mode: 'payment' },
  pack_pro: { name: 'État des Lieux — Pack Pro', price: 49.00, mode: 'subscription' },
  business: { name: 'État des Lieux — Business', price: 149.00, mode: 'subscription' },
};
const ADDONS = {
  comparaison_ia: { name: 'Comparaison IA', price: 2.00 },
  archive_one_time: { name: 'Archive Sécurisée 10 ans', price: 10.00 },
  archive_monthly: { name: 'Archive Sécurisée 10 ans (mensuel)', price: 1.00, recurring: true },
};

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

    // GET /api/invoices
    if (segments[0] === 'invoices' && !segments[1]) {
      const invoices = await db.collection('invoices').find({}).sort({ created_at: -1 }).toArray();
      return NextResponse.json(invoices, { headers: corsHeaders() });
    }

    // GET /api/invoices/:id
    if (segments[0] === 'invoices' && segments[1]) {
      const invoice = await db.collection('invoices').findOne({ id: segments[1] });
      if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404, headers: corsHeaders() });
      return NextResponse.json(invoice, { headers: corsHeaders() });
    }

    // GET /api/report/:token - Public download link (no auth needed)
    if (segments[0] === 'report' && segments[1]) {
      const edl = await db.collection('edl').findOne({ download_token: segments[1] });
      if (!edl) return NextResponse.json({ error: 'Lien invalide ou expiré' }, { status: 404, headers: corsHeaders() });
      if (!edl.paid) return NextResponse.json({ error: 'Rapport non payé' }, { status: 403, headers: corsHeaders() });
      const pieces = await db.collection('pieces').find({ edl_id: edl.id }).toArray();
      const completedPieces = pieces.filter(p => p.statut === 'completed');
      
      // Fetch photos for each piece and convert Cloudinary URLs to base64
      for (const piece of completedPieces) {
        const photos = await db.collection('photos').find({ piece_id: piece.id }).toArray();
        
        // Convert Cloudinary URLs to base64 for PDF generation
        for (const photo of photos) {
          if (photo.url && photo.url.startsWith('http')) {
            try {
              const response = await fetch(photo.url);
              const arrayBuffer = await response.arrayBuffer();
              const base64 = Buffer.from(arrayBuffer).toString('base64');
              photo.data = `data:image/jpeg;base64,${base64}`;
              // Remove URL to save bandwidth
              delete photo.url;
            } catch (err) {
              console.error('Error converting Cloudinary URL to base64:', err);
            }
          }
        }
        
        piece.photos = photos;
      }
      
      return NextResponse.json({
        edl: { ...edl, download_token: undefined },
        pieces: completedPieces,
        generated_at: new Date().toISOString(),
      }, { headers: corsHeaders() });
    }

    // GET /api/pdf/:token - Generate PDF server-side with Cloudinary images
    if (segments[0] === 'pdf' && segments[1]) {
      const edl = await db.collection('edl').findOne({ download_token: segments[1] });
      if (!edl) return NextResponse.json({ error: 'Lien invalide ou expiré' }, { status: 404, headers: corsHeaders() });
      if (!edl.paid) return NextResponse.json({ error: 'Rapport non payé' }, { status: 403, headers: corsHeaders() });
      
      const pieces = await db.collection('pieces').find({ edl_id: edl.id, statut: 'completed' }).toArray();
      
      // Fetch all photos
      for (const piece of pieces) {
        const photos = await db.collection('photos').find({ piece_id: piece.id }).toArray();
        piece.photos = photos;
      }
      
      // Create PDF with PDFKit
      const doc = new PDFDocument({ size: 'A4', margin: 40 });
      const chunks = [];
      
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => {});
      
      // Cover page
      doc.rect(0, 0, 595, 200).fill('#1e3a5f');
      doc.fillColor('#ffffff').fontSize(32).text('État des Lieux', 50, 80, { align: 'center' });
      doc.fontSize(18).text(edl.type_edl === 'entree' ? "d'Entrée" : 'de Sortie', 50, 120, { align: 'center' });
      doc.fontSize(12).text(new Date(edl.created_at).toLocaleDateString('fr-FR'), 50, 150, { align: 'center' });
      
      // Info section
      doc.fillColor('#000000').fontSize(14).text('Informations', 50, 250);
      doc.fontSize(11);
      doc.text(`Adresse : ${edl.adresse}`, 50, 280);
      doc.text(`Type : ${edl.type_logement}`, 50, 300);
      doc.text(`Locataire : ${edl.nom_locataire}`, 50, 320);
      doc.text(`Propriétaire : ${edl.nom_proprietaire}`, 50, 340);
      
      // Rooms
      for (const piece of pieces) {
        doc.addPage();
        doc.fillColor('#1e3a5f').fontSize(16).text(piece.nom, 50, 50);
        doc.fillColor('#000000').fontSize(10);
        
        let y = 80;
        const d = piece.donnees_json || {};
        
        if (d.etat_general) {
          doc.text(`État général : ${d.etat_general}`, 50, y);
          y += 20;
        }
        
        // Photos with Cloudinary transformation
        const photos = piece.photos || [];
        if (photos.length > 0) {
          doc.fontSize(12).text(`Photos (${photos.length})`, 50, y);
          y += 25;
          
          for (const photo of photos) {
            if (y > 700) {
              doc.addPage();
              y = 50;
            }
            
            try {
              let imageUrl = photo.url;
              
              // Apply Cloudinary transformations for optimization
              if (imageUrl && imageUrl.includes('cloudinary.com')) {
                imageUrl = imageUrl.replace('/upload/', '/upload/q_auto,f_jpg,w_800,c_limit/');
              }
              
              // Fetch image
              const response = await fetch(imageUrl || photo.data);
              const arrayBuffer = await response.arrayBuffer();
              const buffer = Buffer.from(arrayBuffer);
              
              // Add image to PDF
              doc.image(buffer, 50, y, { width: 200, height: 150 });
              
              // Photo metadata
              doc.fontSize(9).fillColor('#666666');
              doc.text(`Date: ${new Date(photo.horodatage).toLocaleString('fr-FR')}`, 270, y + 10);
              if (photo.gps) {
                doc.text(`GPS: ${photo.gps.lat}, ${photo.gps.lng}`, 270, y + 25);
              }
              if (photo.legende) {
                doc.text(photo.legende, 270, y + 40, { width: 250 });
              }
              
              y += 170;
            } catch (err) {
              console.error('Error adding image to PDF:', err);
              doc.fontSize(9).fillColor('#ff0000').text('Erreur chargement photo', 50, y);
              y += 20;
            }
          }
        }
      }
      
      // Signature page
      doc.addPage();
      doc.fontSize(16).fillColor('#1e3a5f').text('Signatures', 50, 50);
      doc.fontSize(11).fillColor('#000000');
      doc.text(`Le locataire : ${edl.nom_locataire}`, 50, 100);
      doc.text(`Le propriétaire : ${edl.nom_proprietaire}`, 50, 150);
      doc.fontSize(9).fillColor('#666666').text(`Document généré le ${new Date().toLocaleDateString('fr-FR')}`, 50, 700);
      
      doc.end();
      
      // Wait for PDF to be fully generated
      await new Promise((resolve) => {
        doc.on('end', resolve);
      });
      
      const pdfBuffer = Buffer.concat(chunks);
      
      return new NextResponse(pdfBuffer, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="EDL_${edl.adresse?.replace(/[^a-zA-Z0-9]/g, '_')}.pdf"`,
          ...corsHeaders(),
        },
      });
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
      const { piece_id, edl_id, data, legende, horodatage, gps, ai_analysis } = body;

      // Upload to Cloudinary
      let cloudinaryData = null;
      if (data) {
        cloudinaryData = await uploadToCloudinary(data, `edl-pro/${edl_id}/${piece_id}`);
      }

      const photo = {
        id: uuidv4(),
        piece_id,
        edl_id,
        url: cloudinaryData?.url || null,
        public_id: cloudinaryData?.public_id || null,
        data: cloudinaryData ? null : data, // fallback to base64 if Cloudinary fails
        legende: legende || '',
        horodatage: horodatage || new Date().toISOString(),
        gps: gps || null,
        ai_analysis: ai_analysis || null,
        created_at: new Date().toISOString(),
      };
      await db.collection('photos').insertOne(photo);
      return NextResponse.json({ ...photo, data: undefined }, { status: 201, headers: corsHeaders() });
    }

    // POST /api/payment/mock
    if (segments[0] === 'payment') {
      const { edl_id, plan, addons } = body;
      const paymentId = 'mock_pay_' + uuidv4().substring(0, 8);
      const downloadToken = uuidv4().replace(/-/g, '').substring(0, 16);

      // Calculate price based on plan and addons
      let basePrice = 0;
      let planName = '';
      switch (plan) {
        case 'one_shot': basePrice = 9.90; planName = 'À l\'acte'; break;
        case 'pack_pro': basePrice = 49.00; planName = 'Pack Pro'; break;
        case 'business': basePrice = 149.00; planName = 'Business'; break;
        default: basePrice = 9.90; planName = 'À l\'acte';
      }

      let addonsTotal = 0;
      const addonsList = [];
      if (addons?.comparaison_ia) { addonsTotal += 2.00; addonsList.push('Comparaison IA (+2,00€)'); }
      if (addons?.archive_securisee) {
        if (addons.archive_type === 'monthly') { addonsTotal += 1.00; addonsList.push('Archive 10 ans (+1,00€/mois)'); }
        else { addonsTotal += 10.00; addonsList.push('Archive 10 ans (+10,00€)'); }
      }

      const totalPrice = basePrice + addonsTotal;

      await db.collection('edl').updateOne(
        { id: edl_id },
        { $set: {
          stripe_payment_id: paymentId, paid: true, statut: 'completed',
          plan, addons: addons || {},
          has_comparaison_ia: addons?.comparaison_ia || false,
          has_archive: addons?.archive_securisee || false,
          download_token: downloadToken,
        } }
      );

      // Create invoice
      const invoice = {
        id: uuidv4(),
        edl_id,
        payment_id: paymentId,
        plan: planName,
        plan_code: plan || 'one_shot',
        base_price: basePrice,
        addons: addonsList,
        addons_total: addonsTotal,
        total: totalPrice,
        status: 'paid',
        created_at: new Date().toISOString(),
      };
      await db.collection('invoices').insertOne(invoice);

      return NextResponse.json({
        success: true, payment_id: paymentId,
        invoice_id: invoice.id, total: totalPrice,
        download_token: downloadToken,
      }, { headers: corsHeaders() });
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

    // ==================== STRIPE CHECKOUT ====================

    // POST /api/stripe/checkout - Create Stripe Checkout Session
    if (segments[0] === 'stripe' && segments[1] === 'checkout') {
      const { plan_code, addons: selectedAddons, edl_id, origin_url } = body;
      
      if (!edl_id || !origin_url) {
        return NextResponse.json({ error: 'edl_id and origin_url required' }, { status: 400, headers: corsHeaders() });
      }

      const planDef = PLANS[plan_code] || PLANS.one_shot;
      const lineItems = [];

      // Main plan
      const priceData = {
        currency: 'eur',
        product_data: { name: planDef.name },
        unit_amount: Math.round(planDef.price * 100), // cents
      };
      if (planDef.mode === 'subscription') {
        priceData.recurring = { interval: 'month' };
      }
      lineItems.push({ price_data: priceData, quantity: 1 });

      // Add-ons (one-time, added as extra line items)
      let hasComparaisonIA = false;
      let hasArchive = false;
      if (selectedAddons?.comparaison_ia) {
        hasComparaisonIA = true;
        lineItems.push({
          price_data: {
            currency: 'eur',
            product_data: { name: ADDONS.comparaison_ia.name },
            unit_amount: Math.round(ADDONS.comparaison_ia.price * 100),
            ...(planDef.mode === 'subscription' ? { recurring: { interval: 'month' } } : {}),
          },
          quantity: 1,
        });
      }
      if (selectedAddons?.archive_securisee) {
        hasArchive = true;
        const archiveAddon = selectedAddons.archive_type === 'monthly' ? ADDONS.archive_monthly : ADDONS.archive_one_time;
        lineItems.push({
          price_data: {
            currency: 'eur',
            product_data: { name: archiveAddon.name },
            unit_amount: Math.round(archiveAddon.price * 100),
            ...(archiveAddon.recurring || planDef.mode === 'subscription' ? { recurring: { interval: 'month' } } : {}),
          },
          quantity: 1,
        });
      }

      const successUrl = `${origin_url}/?payment_success=true&session_id={CHECKOUT_SESSION_ID}&edl_id=${edl_id}`;
      const cancelUrl = `${origin_url}/?payment_cancel=true&edl_id=${edl_id}`;

      try {
        const session = await stripe.checkout.sessions.create({
          payment_method_types: ['card'],
          line_items: lineItems,
          mode: planDef.mode === 'subscription' ? 'subscription' : 'payment',
          success_url: successUrl,
          cancel_url: cancelUrl,
          metadata: {
            edl_id,
            plan_code: plan_code || 'one_shot',
            has_comparaison_ia: String(hasComparaisonIA),
            has_archive: String(hasArchive),
          },
        });

        // Create payment transaction record
        const transaction = {
          id: uuidv4(),
          session_id: session.id,
          edl_id,
          plan_code: plan_code || 'one_shot',
          plan_name: planDef.name,
          addons: selectedAddons || {},
          amount: lineItems.reduce((sum, item) => sum + (item.price_data.unit_amount * item.quantity), 0) / 100,
          currency: 'eur',
          payment_status: 'pending',
          status: 'initiated',
          created_at: new Date().toISOString(),
        };
        await db.collection('payment_transactions').insertOne(transaction);

        return NextResponse.json({
          url: session.url,
          session_id: session.id,
        }, { headers: corsHeaders() });

      } catch (stripeErr) {
        console.error('Stripe Checkout Error:', stripeErr);
        return NextResponse.json({ error: 'Erreur Stripe: ' + stripeErr.message }, { status: 500, headers: corsHeaders() });
      }
    }

    // POST /api/stripe/status - Check payment status & finalize
    if (segments[0] === 'stripe' && segments[1] === 'status') {
      const { session_id } = body;
      if (!session_id) {
        return NextResponse.json({ error: 'session_id required' }, { status: 400, headers: corsHeaders() });
      }

      try {
        const session = await stripe.checkout.sessions.retrieve(session_id);
        const transaction = await db.collection('payment_transactions').findOne({ session_id });

        // Only process if not already processed (idempotent)
        if (session.payment_status === 'paid' && transaction && transaction.payment_status !== 'paid') {
          const downloadToken = uuidv4().replace(/-/g, '').substring(0, 16);
          const metadata = session.metadata || {};

          // Update transaction
          await db.collection('payment_transactions').updateOne(
            { session_id },
            { $set: { payment_status: 'paid', status: 'completed', stripe_payment_id: session.payment_intent || session.subscription, completed_at: new Date().toISOString() } }
          );

          // Update EDL
          await db.collection('edl').updateOne(
            { id: metadata.edl_id },
            { $set: {
              paid: true,
              statut: 'completed',
              stripe_payment_id: session.payment_intent || session.subscription,
              plan: metadata.plan_code,
              has_comparaison_ia: metadata.has_comparaison_ia === 'true',
              has_archive: metadata.has_archive === 'true',
              download_token: downloadToken,
            } }
          );

          // Create invoice
          const invoice = {
            id: uuidv4(),
            edl_id: metadata.edl_id,
            payment_id: session.payment_intent || session.subscription,
            session_id,
            plan: PLANS[metadata.plan_code]?.name || 'À l\'acte',
            plan_code: metadata.plan_code,
            total: (session.amount_total || 0) / 100,
            currency: session.currency,
            status: 'paid',
            created_at: new Date().toISOString(),
          };
          await db.collection('invoices').insertOne(invoice);

          return NextResponse.json({
            status: session.status,
            payment_status: session.payment_status,
            amount_total: (session.amount_total || 0) / 100,
            currency: session.currency,
            download_token: downloadToken,
            edl_id: metadata.edl_id,
          }, { headers: corsHeaders() });
        }

        // Already processed or not paid
        const edl = transaction ? await db.collection('edl').findOne({ id: transaction.edl_id }) : null;

        return NextResponse.json({
          status: session.status,
          payment_status: session.payment_status,
          amount_total: (session.amount_total || 0) / 100,
          currency: session.currency,
          download_token: edl?.download_token || null,
          edl_id: transaction?.edl_id || session.metadata?.edl_id,
          already_processed: transaction?.payment_status === 'paid',
        }, { headers: corsHeaders() });

      } catch (stripeErr) {
        console.error('Stripe Status Error:', stripeErr);
        return NextResponse.json({ error: 'Erreur vérification: ' + stripeErr.message }, { status: 500, headers: corsHeaders() });
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
      const photo = await db.collection('photos').findOne({ id: segments[1] });
      if (photo?.public_id) {
        await deleteFromCloudinary(photo.public_id);
      }
      await db.collection('photos').deleteOne({ id: segments[1] });
      return NextResponse.json({ success: true }, { headers: corsHeaders() });
    }

    // DELETE /api/edl/:id
    if (segments[0] === 'edl' && segments[1]) {
      // Delete all photos from Cloudinary first
      const photos = await db.collection('photos').find({ edl_id: segments[1] }).toArray();
      for (const photo of photos) {
        if (photo.public_id) {
          await deleteFromCloudinary(photo.public_id);
        }
      }
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

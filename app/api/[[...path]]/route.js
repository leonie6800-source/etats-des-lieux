import { NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';
import { v4 as uuidv4 } from 'uuid';

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

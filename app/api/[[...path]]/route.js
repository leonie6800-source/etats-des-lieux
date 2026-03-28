import { NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';
import { v4 as uuidv4 } from 'uuid';
import OpenAI, { toFile } from 'openai';
import Stripe from 'stripe';
import { v2 as cloudinary } from 'cloudinary';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

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

    // GET /api/pdf/:token - Generate Professional PDF with Cloudinary images
    if (segments[0] === 'pdf' && segments[1]) {
      const edl = await db.collection('edl').findOne({ download_token: segments[1] });
      if (!edl) return NextResponse.json({ error: 'Lien invalide ou expiré' }, { status: 404, headers: corsHeaders() });
      if (!edl.paid) return NextResponse.json({ error: 'Rapport non payé' }, { status: 403, headers: corsHeaders() });
      
      const pieces = await db.collection('pieces').find({ edl_id: edl.id, statut: 'completed' }).toArray();
      
      // Fetch all photos with Cloudinary transformation
      for (const piece of pieces) {
        const photos = await db.collection('photos').find({ piece_id: piece.id }).toArray();
        piece.photos = photos;
      }
      
      // Load logo
      const logoPath = '/tmp/logo-edl-pro.png';
      let logoImage = null;
      try {
        const fs = require('fs');
        const logoBytes = fs.readFileSync(logoPath);
        logoImage = await pdfDoc.embedPng(logoBytes);
      } catch (err) {
        console.error('Logo not found, continuing without it');
      }
      
      // Create PDF with pdf-lib
      const pdfDoc = await PDFDocument.create();
      const font = await pdfDoc.embedFont(StandardFonts.TimesRoman);
      const fontBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
      const fontItalic = await pdfDoc.embedFont(StandardFonts.TimesRomanItalic);
      
      const reportId = `EDL-${(edl.id || '').substring(0, 8).toUpperCase()}`;
      const typeEdl = edl.type_edl === 'entree' ? 'ENTRÉE' : 'SORTIE';
      
      // Color palette
      const colorPrimary = rgb(0.17, 0.24, 0.31); // #2C3E50
      const colorBg = rgb(0.97, 0.98, 0.99); // #F8FAFC
      const colorBorder = rgb(0.89, 0.91, 0.94); // #E2E8F0
      
      // PAGE 1: COVER
      let page = pdfDoc.addPage([595, 842]); // A4 size
      let yPos = 750;
      
      // WATERMARK (logo as watermark at 15% opacity in center)
      if (logoImage) {
        const watermarkSize = 250;
        const watermarkX = (595 - watermarkSize) / 2;
        const watermarkY = (842 - watermarkSize) / 2;
        page.drawImage(logoImage, {
          x: watermarkX,
          y: watermarkY,
          width: watermarkSize,
          height: watermarkSize,
          opacity: 0.08
        });
      }
      
      // HEADER with logo and title
      if (logoImage) {
        page.drawImage(logoImage, { x: 40, y: 780, width: 80, height: 80 });
      }
      
      // Title (right side)
      page.drawText(`ÉTAT DES LIEUX ${typeEdl}`, { x: 200, y: 820, size: 24, font: fontBold, color: colorPrimary });
      
      // Header line separator
      page.drawLine({ start: { x: 40, y: 770 }, end: { x: 555, y: 770 }, thickness: 2, color: colorPrimary });
      
      // Report ID and date
      page.drawText(`N° ${reportId}`, { x: 40, y: 745, size: 10, font, color: rgb(0.4, 0.4, 0.4) });
      page.drawText(`Date: ${new Date(edl.created_at).toLocaleDateString('fr-FR')}`, { x: 200, y: 745, size: 10, font, color: rgb(0.4, 0.4, 0.4) });
      page.drawText(`Adresse: ${edl.adresse}`, { x: 40, y: 728, size: 10, font, color: rgb(0.4, 0.4, 0.4) });
      
      yPos = 690;
      
      // SECTION: Propriétaire (styled box)
      page.drawRectangle({ x: 40, y: yPos - 80, width: 245, height: 90, color: colorBg, borderColor: colorBorder, borderWidth: 1 });
      page.drawText('PROPRIÉTAIRE / AGENCE', { x: 50, y: yPos - 15, size: 11, font: fontBold, color: colorPrimary });
      page.drawText(edl.nom_proprietaire || 'N/A', { x: 50, y: yPos - 35, size: 10, font });
      page.drawText(`Type: ${edl.type_logement}`, { x: 50, y: yPos - 50, size: 9, font, color: rgb(0.4, 0.4, 0.4) });
      
      // SECTION: Locataire (styled box)
      page.drawRectangle({ x: 310, y: yPos - 80, width: 245, height: 90, color: colorBg, borderColor: colorBorder, borderWidth: 1 });
      page.drawText('LOCATAIRE', { x: 320, y: yPos - 15, size: 11, font: fontBold, color: colorPrimary });
      page.drawText(edl.nom_locataire || 'N/A', { x: 320, y: yPos - 35, size: 10, font });
      
      yPos -= 110;
      
      // SECTION HEADER: Détail des pièces
      page.drawRectangle({ x: 40, y: yPos - 30, width: 515, height: 35, color: colorBg, borderColor: colorBorder, borderWidth: 1 });
      page.drawText('DÉTAIL DES PIÈCES', { x: 50, y: yPos - 18, size: 14, font: fontBold, color: colorPrimary });
      yPos -= 50;
      
      // PAGE 2+: ROOMS TABLE
      for (let i = 0; i < pieces.length; i++) {
        const piece = pieces[i];
        const d = piece.donnees_json || {};
        const photos = piece.photos || [];
        
        if (yPos < 150) {
          page = pdfDoc.addPage([595, 842]);
          yPos = 800;
        }
        
        // Alternating row colors with border
        const bgColor = i % 2 === 0 ? rgb(1, 1, 1) : colorBg;
        page.drawRectangle({ x: 40, y: yPos - 85, width: 515, height: 95, color: bgColor, borderColor: colorBorder, borderWidth: 0.5 });
        
        // Piece name with underline
        page.drawText(piece.nom || 'N/A', { x: 50, y: yPos - 20, size: 11, font: fontBold, color: colorPrimary });
        page.drawLine({ start: { x: 50, y: yPos - 25 }, end: { x: 200, y: yPos - 25 }, thickness: 1, color: colorBorder });
        
        // État
        const etat = d.etat_general || 'Non renseigné';
        page.drawText(`État: ${etat}`, { x: 50, y: yPos - 30, size: 9, font });
        
        // Observations (IA)
        if (d.observations_generales) {
          const obs = d.observations_generales.substring(0, 80) + (d.observations_generales.length > 80 ? '...' : '');
          page.drawText(`Obs: ${obs}`, { x: 50, y: yPos - 45, size: 8, font, color: rgb(0.3, 0.3, 0.3) });
        }
        
        // Photo thumbnails (improved positioning)
        if (photos.length > 0) {
          page.drawText(`${photos.length} photo${photos.length > 1 ? 's' : ''}`, { x: 430, y: yPos - 25, size: 9, font, color: rgb(0.3, 0.3, 0.3) });
          
          // Embed first photo as thumbnail (larger: 80x60)
          if (photos[0].url) {
            try {
              let imageUrl = photos[0].url;
              // Apply Cloudinary transformations
              if (imageUrl.includes('cloudinary.com')) {
                imageUrl = imageUrl.replace('/upload/', '/upload/q_auto,f_jpg,w_300,c_limit/');
              }
              
              console.log('🖼️  Fetching image:', imageUrl);
              const imgResponse = await fetch(imageUrl);
              console.log('📥 Image fetched, status:', imgResponse.status);
              
              if (!imgResponse.ok) {
                throw new Error(`HTTP ${imgResponse.status}`);
              }
              
              const imgBytes = await imgResponse.arrayBuffer();
              console.log('✅ Image bytes received:', imgBytes.byteLength, 'bytes');
              
              // Try to embed as JPG
              let image;
              try {
                image = await pdfDoc.embedJpg(imgBytes);
                console.log('✅ Image embedded as JPG');
              } catch (jpgErr) {
                console.log('⚠️  JPG embed failed, trying PNG:', jpgErr.message);
                image = await pdfDoc.embedPng(imgBytes);
                console.log('✅ Image embedded as PNG');
              }
              
              // Draw image with better positioning (right-aligned, larger)
              const imgWidth = 80;
              const imgHeight = 60;
              const imgX = 515 - imgWidth - 10; // Right-aligned with margin
              const imgY = yPos - 70;
              
              // Draw image first (behind border)
              page.drawImage(image, {
                x: imgX,
                y: imgY,
                width: imgWidth,
                height: imgHeight
              });
              
              // Draw border over image
              page.drawRectangle({
                x: imgX,
                y: imgY,
                width: imgWidth,
                height: imgHeight,
                borderColor: rgb(0.7, 0.7, 0.7),
                borderWidth: 1
              });
              
              console.log('✅ Image drawn on page at x:', imgX, 'y:', imgY);
            } catch (err) {
              console.error('❌ Error embedding image:', err);
              // Draw red X to show error
              page.drawText('Photo indisponible', { x: 420, y: yPos - 50, size: 8, font: fontItalic, color: rgb(0.7, 0, 0) });
            }
          }
        }
        
        yPos -= 100;
      }
      
      // LAST PAGE: SIGNATURES
      page = pdfDoc.addPage([595, 842]);
      yPos = 750;
      
      page.drawText('SIGNATURES', { x: 250, y: yPos, size: 16, font: fontBold, color: rgb(0.12, 0.23, 0.37) });
      yPos -= 50;
      
      // Locataire signature box
      page.drawRectangle({ x: 40, y: yPos - 100, width: 200, height: 120, color: rgb(0.95, 0.95, 0.95), borderColor: rgb(0.5, 0.5, 0.5), borderWidth: 1 });
      page.drawText('Le Locataire', { x: 50, y: yPos, size: 11, font: fontBold });
      page.drawText(edl.nom_locataire || 'N/A', { x: 50, y: yPos - 20, size: 10, font });
      page.drawText('Signature:', { x: 50, y: yPos - 40, size: 9, font, color: rgb(0.5, 0.5, 0.5) });
      
      // Propriétaire signature box
      page.drawRectangle({ x: 355, y: yPos - 100, width: 200, height: 120, color: rgb(0.95, 0.95, 0.95), borderColor: rgb(0.5, 0.5, 0.5), borderWidth: 1 });
      page.drawText('Le Propriétaire', { x: 365, y: yPos, size: 11, font: fontBold });
      page.drawText(edl.nom_proprietaire || 'N/A', { x: 365, y: yPos - 20, size: 10, font });
      page.drawText('Signature:', { x: 365, y: yPos - 40, size: 9, font, color: rgb(0.5, 0.5, 0.5) });
      
      // Footer
      page.drawText(`Généré certifié par État des Lieux Pro. Horodatage et intégrité des données garantis.`, {
        x: 50,
        y: 50,
        size: 8,
        font,
        color: rgb(0.5, 0.5, 0.5)
      });
      
      // Generate PDF bytes
      const pdfBytes = await pdfDoc.save();
      
      return new NextResponse(pdfBytes, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="EDL_NOUVEAU_${Date.now()}.pdf"`,
          'Cache-Control': 'no-store, no-cache, must-revalidate',
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

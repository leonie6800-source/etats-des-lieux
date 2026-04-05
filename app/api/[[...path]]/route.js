import { NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';
import { v4 as uuidv4 } from 'uuid';
import OpenAI, { toFile } from 'openai';
import Stripe from 'stripe';
import { v2 as cloudinary } from 'cloudinary';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Resend } from 'resend';
import { LOGO_BASE64 } from '../../../lib/logo-base64.js';

let _openai = null;
let _stripe = null;
function getOpenAI() {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _openai;
}
function getStripe() {
  if (!_stripe) _stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  return _stripe;
}

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

// ==================== EMAIL SENDING VIA RESEND ====================
async function sendEmail(toEmail, edl, downloadToken) {
  if (!toEmail || !toEmail.includes('@')) {
    console.warn('sendEmail: Invalid email provided');
    return false;
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  const downloadLink = downloadToken ? `${baseUrl}/api/pdf-fresh/${downloadToken}` : '';

  try {
    // Check if Resend API key is configured
    if (!process.env.RESEND_API_KEY || process.env.RESEND_API_KEY === 'VOTRE_CLE_RESEND_ICI') {
      console.error('❌ RESEND_API_KEY non configuré');
      throw new Error('Service email non configuré');
    }

    const resend = new Resend(process.env.RESEND_API_KEY);

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1e3a5f;">🏠 Votre rapport d'état des lieux est prêt !</h2>
        <p>Bonjour,</p>
        <p>Votre rapport d'état des lieux a été généré avec succès.</p>
        
        <div style="background: #f4f6f9; padding: 20px; border-radius: 10px; margin: 20px 0;">
          <p><strong>Adresse :</strong> ${edl?.adresse || ''}</p>
          <p><strong>Type :</strong> ${edl?.type_logement || ''} — ${edl?.type_edl || ''}</p>
          <p><strong>Locataire :</strong> ${edl?.nom_locataire || ''}</p>
          <p><strong>Propriétaire :</strong> ${edl?.nom_proprietaire || ''}</p>
          <p><strong>Date :</strong> ${new Date().toLocaleDateString('fr-FR')}</p>
        </div>

        ${downloadLink ? `
          <div style="text-align: center; margin: 30px 0;">
            <a href="${downloadLink}" 
               style="background: #2d6ac4; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold;">
              📥 Télécharger le PDF
            </a>
          </div>
          <p style="font-size: 12px; color: #666;">
            Ou copiez ce lien dans votre navigateur :<br>
            <a href="${downloadLink}">${downloadLink}</a>
          </p>
        ` : ''}

        <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
        <p style="color: #666; font-size: 12px;">
          Cordialement,<br>
          <strong>État des Lieux Pro</strong>
        </p>
      </div>
    `;

    const result = await resend.emails.send({
      from: 'État des Lieux Pro <noreply@rapport.etatdeslieuxpro.com>',
      to: toEmail,
      subject: `Rapport d'état des lieux - ${edl?.adresse || 'Rapport'}`,
      html: emailHtml,
    });

    console.log(`✅ Email sent successfully to: ${toEmail} (ID: ${result.data?.id})`);
    return true;
  } catch (error) {
    console.error('sendEmail Error:', error.message);
    throw error;
  }
}

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

// ============ AUTH HELPERS ============
function generateToken(userId, email) {
  return jwt.sign(
    { userId, email },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

// Sanitize text for pdf-lib WinAnsi encoding (replaces unsupported Unicode chars)
function pdfText(str) {
  if (!str) return '';
  return String(str)
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")  // curly single quotes
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')  // curly double quotes
    .replace(/\u2026/g, '...')                     // ellipsis
    .replace(/\u2013/g, '-')                       // en dash
    .replace(/\u2014/g, '--')                      // em dash
    .replace(/\u2192/g, '>')                       // right arrow
    .replace(/\u2190/g, '<')                       // left arrow
    .replace(/[^\x00-\xFF]/g, '?');               // any other non-Latin1 char
}

function verifyToken(token) {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return null;
  }
}

async function hashPassword(password) {
  return await bcrypt.hash(password, 10);
}

async function comparePassword(password, hash) {
  return await bcrypt.compare(password, hash);
}

// Middleware to extract user from JWT
function getUserFromRequest(request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.substring(7);
  return verifyToken(token);
}

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
      // Require auth for GET /api/edl
      const authUser = getUserFromRequest(request);
      if (!authUser) {
        return NextResponse.json({ error: 'Non authentifié' }, { status: 401, headers: corsHeaders() });
      }
      
      // Filter EDL by authenticated user
      const edls = await db.collection('edl').find({ user_id: authUser.userId }).sort({ created_at: -1 }).toArray();
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
      const authUser = getUserFromRequest(request);
      if (!authUser) return NextResponse.json({ error: 'Non authentifié' }, { status: 401, headers: corsHeaders() });
      const edl = await db.collection('edl').findOne({ id: segments[1] });
      if (!edl) return NextResponse.json({ error: 'EDL not found' }, { status: 404, headers: corsHeaders() });
      if (edl.user_id !== authUser.userId) return NextResponse.json({ error: 'Accès refusé' }, { status: 403, headers: corsHeaders() });
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
      const authUser = getUserFromRequest(request);
      if (!authUser) return NextResponse.json({ error: 'Non authentifié' }, { status: 401, headers: corsHeaders() });
      const edl_id = url.searchParams.get('edl_id');
      if (!edl_id) return NextResponse.json({ error: 'edl_id required' }, { status: 400, headers: corsHeaders() });
      const edl = await db.collection('edl').findOne({ id: edl_id });
      if (!edl || edl.user_id !== authUser.userId) return NextResponse.json({ error: 'Accès refusé' }, { status: 403, headers: corsHeaders() });
      const pieces = await db.collection('pieces').find({ edl_id }).toArray();
      for (let piece of pieces) {
        const photos = await db.collection('photos').find({ piece_id: piece.id }).toArray();
        piece.photos_count = photos.length;
      }
      return NextResponse.json(pieces, { headers: corsHeaders() });
    }

    // GET /api/pieces/:id
    if (segments[0] === 'pieces' && segments[1]) {
      const authUser = getUserFromRequest(request);
      if (!authUser) return NextResponse.json({ error: 'Non authentifié' }, { status: 401, headers: corsHeaders() });
      const piece = await db.collection('pieces').findOne({ id: segments[1] });
      if (!piece) return NextResponse.json({ error: 'Piece not found' }, { status: 404, headers: corsHeaders() });
      const edl = await db.collection('edl').findOne({ id: piece.edl_id });
      if (!edl || edl.user_id !== authUser.userId) return NextResponse.json({ error: 'Accès refusé' }, { status: 403, headers: corsHeaders() });
      return NextResponse.json(piece, { headers: corsHeaders() });
    }

    // GET /api/photos?piece_id=xxx or edl_id=xxx
    if (segments[0] === 'photos' && !segments[1]) {
      const authUser = getUserFromRequest(request);
      if (!authUser) return NextResponse.json({ error: 'Non authentifié' }, { status: 401, headers: corsHeaders() });
      const piece_id = url.searchParams.get('piece_id');
      const edl_id = url.searchParams.get('edl_id');
      if (!piece_id && !edl_id) return NextResponse.json({ error: 'piece_id ou edl_id requis' }, { status: 400, headers: corsHeaders() });
      const lookupId = edl_id || (await db.collection('pieces').findOne({ id: piece_id }))?.edl_id;
      const edl = await db.collection('edl').findOne({ id: lookupId });
      if (!edl || edl.user_id !== authUser.userId) return NextResponse.json({ error: 'Accès refusé' }, { status: 403, headers: corsHeaders() });
      let query = {};
      if (piece_id) query.piece_id = piece_id;
      if (edl_id) query.edl_id = edl_id;
      const photos = await db.collection('photos').find(query).sort({ created_at: 1 }).toArray();
      const photosLight = photos.map(p => ({ ...p, data: p.data ? p.data.substring(0, 50) + '...' : null, has_data: !!p.data }));
      return NextResponse.json(photosLight, { headers: corsHeaders() });
    }

    // GET /api/photos/:id
    if (segments[0] === 'photos' && segments[1]) {
      const authUser = getUserFromRequest(request);
      if (!authUser) return NextResponse.json({ error: 'Non authentifié' }, { status: 401, headers: corsHeaders() });
      const photo = await db.collection('photos').findOne({ id: segments[1] });
      if (!photo) return NextResponse.json({ error: 'Photo not found' }, { status: 404, headers: corsHeaders() });
      const edl = await db.collection('edl').findOne({ id: photo.edl_id });
      if (!edl || edl.user_id !== authUser.userId) return NextResponse.json({ error: 'Accès refusé' }, { status: 403, headers: corsHeaders() });
      return NextResponse.json(photo, { headers: corsHeaders() });
    }

    // GET /api/invoices
    if (segments[0] === 'invoices' && !segments[1]) {
      const authUser = getUserFromRequest(request);
      if (!authUser) return NextResponse.json({ error: 'Non authentifié' }, { status: 401, headers: corsHeaders() });
      const invoices = await db.collection('invoices').find({ user_id: authUser.userId }).sort({ created_at: -1 }).toArray();
      return NextResponse.json(invoices, { headers: corsHeaders() });
    }

    // GET /api/invoices/:id
    if (segments[0] === 'invoices' && segments[1]) {
      const authUser = getUserFromRequest(request);
      if (!authUser) return NextResponse.json({ error: 'Non authentifié' }, { status: 401, headers: corsHeaders() });
      const invoice = await db.collection('invoices').findOne({ id: segments[1] });
      if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404, headers: corsHeaders() });
      if (invoice.user_id !== authUser.userId) return NextResponse.json({ error: 'Accès refusé' }, { status: 403, headers: corsHeaders() });
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
      
      // Create PDF with pdf-lib
      const pdfDoc = await PDFDocument.create();

      // Load logo from embedded base64
      let logoImage = null;
      try {
        const logoBytes = Buffer.from(LOGO_BASE64, 'base64');
        logoImage = await pdfDoc.embedPng(logoBytes);
      } catch (err) {
        console.error('Logo embed error:', err.message);
      }
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
      
      // WATERMARK (logo PLEINE PAGE - adapté aux dimensions A4)
      if (logoImage) {
        // Prendre toute la hauteur de la page A4
        const watermarkSize = 842; // Hauteur complète de la page A4
        const watermarkX = (595 - watermarkSize) / 2; // Centré horizontalement (déborde un peu)
        const watermarkY = 0; // Du bas au haut
        page.drawImage(logoImage, {
          x: watermarkX,
          y: watermarkY,
          width: watermarkSize,
          height: watermarkSize,
          opacity: 0.08
        });
        console.log('✅ Watermark added - FULL PAGE');
      }
      
      // BANDEAU BLEU PLUS GROS en haut
      page.drawRectangle({ x: 0, y: 742, width: 595, height: 100, color: colorPrimary });
      
      // LOGO TRÈS GROS dans le bandeau bleu (left)
      if (logoImage) {
        page.drawImage(logoImage, { x: 15, y: 747, width: 100, height: 100 });
        console.log('✅ Logo added to header');
      }
      
      // Title in bandeau (center-right) - PLUS GROS
      page.drawText(`ÉTAT DES LIEUX ${typeEdl}`, { x: 220, y: 800, size: 26, font: fontBold, color: rgb(1, 1, 1) });
      
      yPos = 710;
      
      // SECTION INFOS STRUCTURÉE
      page.drawRectangle({ x: 40, y: yPos - 80, width: 515, height: 90, color: colorBg, borderColor: colorBorder, borderWidth: 1 });
      
      // Colonne 1 : Numéro et Date
      page.drawText('RÉFÉRENCE', { x: 50, y: yPos - 15, size: 10, font: fontBold, color: colorPrimary });
      page.drawText(reportId, { x: 50, y: yPos - 35, size: 13, font: fontBold });
      page.drawText('Date', { x: 50, y: yPos - 55, size: 9, font, color: rgb(0.4, 0.4, 0.4) });
      page.drawText(new Date(edl.created_at).toLocaleDateString('fr-FR'), { x: 50, y: yPos - 70, size: 11, font });
      
      // Colonne 2 : Adresse
      page.drawText('ADRESSE DU BIEN', { x: 250, y: yPos - 15, size: 10, font: fontBold, color: colorPrimary });
      // Build CP+ville: from separate fields, or extract from adresse string
      let cpVille = [edl.code_postal, edl.ville].filter(Boolean).join(' ');
      if (!cpVille && edl.adresse) {
        const cpMatch = edl.adresse.match(/(\d{5})\s+(\S.*)$/);
        if (cpMatch) cpVille = cpMatch[1] + ' ' + cpMatch[2];
      }
      // Show street on line 1 (strip CP/ville if already in adresse)
      let rue = (edl.adresse || '');
      if (cpVille && rue.includes(cpVille)) rue = rue.replace(cpVille, '').replace(/,\s*$/, '').trim();
      page.drawText(rue.substring(0, 55), { x: 250, y: yPos - 35, size: 11, font });
      if (cpVille) {
        page.drawText(cpVille.substring(0, 40), { x: 250, y: yPos - 50, size: 11, font });
      }
      
      yPos -= 100;
      
      // SECTION: Propriétaire (styled box) - POLICE PLUS GROSSE
      page.drawRectangle({ x: 40, y: yPos - 80, width: 245, height: 90, color: colorBg, borderColor: colorBorder, borderWidth: 1 });
      page.drawText('PROPRIÉTAIRE / AGENCE', { x: 50, y: yPos - 15, size: 12, font: fontBold, color: colorPrimary });
      page.drawText(edl.nom_proprietaire || 'N/A', { x: 50, y: yPos - 35, size: 11, font });
      page.drawText(`Type: ${edl.type_logement}`, { x: 50, y: yPos - 50, size: 10, font, color: rgb(0.4, 0.4, 0.4) });
      
      // SECTION: Locataire (styled box) - POLICE PLUS GROSSE
      page.drawRectangle({ x: 310, y: yPos - 80, width: 245, height: 90, color: colorBg, borderColor: colorBorder, borderWidth: 1 });
      page.drawText('LOCATAIRE', { x: 320, y: yPos - 15, size: 12, font: fontBold, color: colorPrimary });
      page.drawText(pdfText(edl.nom_locataire || 'N/A'), { x: 320, y: yPos - 35, size: 11, font });
      
      yPos -= 110;
      
      // SECTION HEADER: Détail des pièces - POLICE PLUS GROSSE
      page.drawRectangle({ x: 40, y: yPos - 30, width: 515, height: 35, color: colorBg, borderColor: colorBorder, borderWidth: 1 });
      page.drawText('DÉTAIL DES PIÈCES', { x: 50, y: yPos - 18, size: 16, font: fontBold, color: colorPrimary });
      yPos -= 50;
      
      // PAGE 2+: ROOMS DETAIL
      for (let i = 0; i < pieces.length; i++) {
        const piece = pieces[i];
        const d = piece.donnees_json || {};
        const photos = piece.photos || [];

        // Pre-calculate equipment list
        const equips = [];
        if (d.etat_fenetres) equips.push(`Fenêtres: ${d.etat_fenetres}`);
        if (d.etat_portes) equips.push(`Portes: ${d.etat_portes}`);
        if (d.etat_volets) equips.push(`Volets: ${d.etat_volets}`);
        if (d.etat_prises) equips.push(`Prises: ${d.etat_prises}`);
        if (d.etat_interrupteurs) equips.push(`Interrupteurs: ${d.etat_interrupteurs}`);
        if (d.etat_radiateurs) equips.push(`Radiateurs: ${d.etat_radiateurs}`);
        // Kitchen specifics
        ['plaques_de_cuisson','four','hotte','réfrigérateur','évier','robinetterie'].forEach(k => {
          if (d[`etat_${k}`]) equips.push(`${k.replace(/_/g,' ')}: ${d[`etat_${k}`]}`);
        });
        // Bathroom specifics
        ['baignoire/douche','lavabo','wc'].forEach(k => {
          const key = `etat_sdb_${k.replace(/[\/ ]/g,'_')}`;
          if (d[key]) equips.push(`${k}: ${d[key]}`);
        });

        // Dynamic block height
        const murStr = [d.nature_murs, d.etat_murs].filter(Boolean).join(' - ');
        const plafondStr = [d.nature_plafond, d.etat_plafond].filter(Boolean).join(' - ');
        const solStr = [d.nature_sol, d.etat_sol].filter(Boolean).join(' - ');
        let blockH = 55; // header: name + état général + separator
        if (murStr || plafondStr) blockH += 14;
        if (d.obs_murs) blockH += 13;
        if (solStr) blockH += 14;
        if (d.obs_sol) blockH += 13;
        if (equips.length > 0) { blockH += 14; if (equips.join(' | ').length > 68) blockH += 13; }
        if (d.obs_equipements) blockH += 13;
        if (d.observations_generales) blockH += 14;
        blockH = Math.max(blockH, 90) + 20; // min 90px + bottom padding

        if (yPos - blockH < 80) {
          page = pdfDoc.addPage([595, 842]);
          if (logoImage) {
            const wSize = 700;
            page.drawImage(logoImage, { x: (595 - wSize) / 2, y: (842 - wSize) / 2, width: wSize, height: wSize, opacity: 0.08 });
          }
          yPos = 800;
        }

        // Background block
        const bgColor = i % 2 === 0 ? rgb(1, 1, 1) : colorBg;
        page.drawRectangle({ x: 40, y: yPos - blockH, width: 515, height: blockH, color: bgColor, borderColor: colorBorder, borderWidth: 0.5 });

        // Room name + état général header
        page.drawText(pdfText(piece.nom || 'N/A'), { x: 50, y: yPos - 16, size: 12, font: fontBold, color: colorPrimary });
        const etat = d.etat_general || 'Non renseigné';
        page.drawText(pdfText(`Etat general: ${etat}`), { x: 50, y: yPos - 32, size: 10, font });
        page.drawLine({ start: { x: 50, y: yPos - 40 }, end: { x: 540, y: yPos - 40 }, thickness: 0.4, color: colorBorder });

        let yLine = yPos - 54;

        const T = 68; // max chars per line (photo at x=415, text area ~370px at size 9)
        // Murs then Plafond on separate lines
        if (murStr) { page.drawText(pdfText(`Murs: ${murStr.substring(0,T)}`), { x: 50, y: yLine, size: 9, font }); yLine -= 13; }
        if (plafondStr) { page.drawText(pdfText(`Plafond: ${plafondStr.substring(0,T)}`), { x: 50, y: yLine, size: 9, font }); yLine -= 13; }
        if (d.obs_murs) {
          const obs = d.obs_murs.length > T ? d.obs_murs.substring(0, T) + '...' : d.obs_murs;
          page.drawText(pdfText(`  > ${obs}`), { x: 50, y: yLine, size: 8, font: fontItalic, color: rgb(0.3, 0.3, 0.3) });
          yLine -= 13;
        }

        // Sol
        if (solStr) {
          page.drawText(pdfText(`Sol: ${solStr.substring(0,T)}`), { x: 50, y: yLine, size: 9, font });
          yLine -= 13;
        }
        if (d.obs_sol) {
          const obs = d.obs_sol.length > T ? d.obs_sol.substring(0, T) + '...' : d.obs_sol;
          page.drawText(pdfText(`  > ${obs}`), { x: 50, y: yLine, size: 8, font: fontItalic, color: rgb(0.3, 0.3, 0.3) });
          yLine -= 13;
        }

        // Equipements - split into lines of T chars
        if (equips.length > 0) {
          const equipStr = equips.join(' | ');
          const line1 = equipStr.substring(0, T);
          const line2 = equipStr.length > T ? equipStr.substring(T, T * 2) : '';
          page.drawText(pdfText(`Equip.: ${line1}`), { x: 50, y: yLine, size: 9, font });
          yLine -= 13;
          if (line2) {
            page.drawText(pdfText(`  ${line2}${equipStr.length > T * 2 ? '...' : ''}`), { x: 50, y: yLine, size: 9, font });
            yLine -= 13;
          }
        }
        if (d.obs_equipements) {
          const obs = d.obs_equipements.length > T ? d.obs_equipements.substring(0, T) + '...' : d.obs_equipements;
          page.drawText(pdfText(`  > ${obs}`), { x: 50, y: yLine, size: 8, font: fontItalic, color: rgb(0.3, 0.3, 0.3) });
          yLine -= 13;
        }

        // Observations generales (IA)
        if (d.observations_generales) {
          const obs = d.observations_generales.length > T ? d.observations_generales.substring(0, T) + '...' : d.observations_generales;
          page.drawText(pdfText(`IA: ${obs}`), { x: 50, y: yLine, size: 8, font: fontItalic, color: rgb(0.2, 0.35, 0.6) });
        }

        // Photo thumbnail (right side, x=415)
        if (photos.length > 0) {
          page.drawText(`${photos.length} photo${photos.length > 1 ? 's' : ''}`, { x: 415, y: yPos - 16, size: 9, font, color: rgb(0.3, 0.3, 0.3) });
          if (photos[0].url) {
            try {
              let imageUrl = photos[0].url;
              if (imageUrl.includes('cloudinary.com')) {
                imageUrl = imageUrl.replace('/upload/', '/upload/q_auto,f_jpg,w_300,c_limit/');
              }
              const imgResponse = await fetch(imageUrl);
              if (!imgResponse.ok) throw new Error(`HTTP ${imgResponse.status}`);
              const imgBytes = await imgResponse.arrayBuffer();
              let image;
              try { image = await pdfDoc.embedJpg(imgBytes); } catch { image = await pdfDoc.embedPng(imgBytes); }
              const imgWidth = 80;
              const imgHeight = 60;
              const imgX = 515 - imgWidth - 10;
              const imgY = yPos - blockH + 15;
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
              
            } catch (err) {
              console.error('❌ Error embedding image:', err);
              page.drawText('Photo indisponible', { x: 420, y: yPos - 50, size: 8, font: fontItalic, color: rgb(0.7, 0, 0) });
            }
          }
        }

        yPos -= blockH + 5;
      }

      // LAST PAGE: SIGNATURES
      page = pdfDoc.addPage([595, 842]);
      if (logoImage) {
        page.drawImage(logoImage, { x: (595 - 700) / 2, y: (842 - 700) / 2, width: 700, height: 700, opacity: 0.06 });
      }
      yPos = 750;

      page.drawText('SIGNATURES', { x: 50, y: yPos, size: 18, font: fontBold, color: colorPrimary });
      page.drawLine({ start: { x: 50, y: yPos - 8 }, end: { x: 540, y: yPos - 8 }, thickness: 1, color: colorBorder });
      yPos -= 40;

      // Locataire signature box
      page.drawRectangle({ x: 40, y: yPos - 130, width: 230, height: 140, color: colorBg, borderColor: colorPrimary, borderWidth: 1.5 });
      page.drawText('LE LOCATAIRE', { x: 50, y: yPos - 15, size: 10, font: fontBold, color: colorPrimary });
      page.drawText(edl.nom_locataire || 'N/A', { x: 50, y: yPos - 32, size: 12, font: fontBold });
      page.drawText('Lu et approuvé', { x: 50, y: yPos - 50, size: 9, font: fontItalic, color: rgb(0.4, 0.4, 0.4) });
      page.drawText('Signature :', { x: 50, y: yPos - 68, size: 9, font, color: rgb(0.4, 0.4, 0.4) });
      if (edl.signature_locataire) {
        page.drawText(edl.signature_locataire, { x: 55, y: yPos - 87, size: 14, font: fontItalic, color: rgb(0.1, 0.1, 0.5) });
      }
      page.drawLine({ start: { x: 50, y: yPos - 100 }, end: { x: 255, y: yPos - 100 }, thickness: 0.5, color: rgb(0.6, 0.6, 0.6) });
      page.drawText(`Date : ${new Date(edl.created_at).toLocaleDateString('fr-FR')}`, { x: 50, y: yPos - 120, size: 9, font: fontBold });

      // Propriétaire signature box
      page.drawRectangle({ x: 320, y: yPos - 130, width: 230, height: 140, color: colorBg, borderColor: colorPrimary, borderWidth: 1.5 });
      page.drawText('LE PROPRIÉTAIRE / AGENCE', { x: 330, y: yPos - 15, size: 10, font: fontBold, color: colorPrimary });
      page.drawText(edl.nom_proprietaire || 'N/A', { x: 330, y: yPos - 32, size: 12, font: fontBold });
      page.drawText('Lu et approuvé', { x: 330, y: yPos - 50, size: 9, font: fontItalic, color: rgb(0.4, 0.4, 0.4) });
      page.drawText('Signature :', { x: 330, y: yPos - 68, size: 9, font, color: rgb(0.4, 0.4, 0.4) });
      if (edl.signature_proprietaire) {
        page.drawText(edl.signature_proprietaire, { x: 335, y: yPos - 87, size: 14, font: fontItalic, color: rgb(0.1, 0.1, 0.5) });
      }
      page.drawLine({ start: { x: 330, y: yPos - 100 }, end: { x: 535, y: yPos - 100 }, thickness: 0.5, color: rgb(0.6, 0.6, 0.6) });
      page.drawText(`Date : ${new Date(edl.created_at).toLocaleDateString('fr-FR')}`, { x: 330, y: yPos - 120, size: 9, font: fontBold });

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
          'Content-Disposition': `attachment; filename="EDL_PRO_${reportId}_${Date.now()}.pdf"`,
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
          ...corsHeaders(),
        },
      });
    }

    // GET /api/pdf-fresh/:token - FRESH PDF (no cache version)
    if (segments[0] === 'pdf-fresh' && segments[1]) {
      // Same code as pdf endpoint but with different route
      const edl = await db.collection('edl').findOne({ download_token: segments[1] });
      if (!edl) return NextResponse.json({ error: 'Lien invalide ou expiré' }, { status: 404, headers: corsHeaders() });
      if (!edl.paid) return NextResponse.json({ error: 'Rapport non payé' }, { status: 403, headers: corsHeaders() });
      
      const pieces = await db.collection('pieces').find({ edl_id: edl.id, statut: 'completed' }).toArray();
      
      // Fetch all photos with Cloudinary transformation
      for (const piece of pieces) {
        const photos = await db.collection('photos').find({ piece_id: piece.id }).toArray();
        piece.photos = photos;
      }
      
      // Create PDF with pdf-lib FIRST
      const pdfDoc = await PDFDocument.create();
      const font = await pdfDoc.embedFont(StandardFonts.TimesRoman);
      const fontBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
      const fontItalic = await pdfDoc.embedFont(StandardFonts.TimesRomanItalic);
      
      // Load logo AFTER creating pdfDoc
      let logoImage = null;
      try {
        const logoBytes = Buffer.from(LOGO_BASE64, 'base64');
        logoImage = await pdfDoc.embedPng(logoBytes);
        console.log('✅ Logo loaded successfully');
      } catch (err) {
        console.error('❌ Logo error:', err);
      }
      
      const reportId = `EDL-${(edl.id || '').substring(0, 8).toUpperCase()}`;
      const typeEdl = edl.type_edl === 'entree' ? 'ENTRÉE' : 'SORTIE';
      
      // Color palette
      const colorPrimary = rgb(0.17, 0.24, 0.31); // #2C3E50
      const colorBg = rgb(0.97, 0.98, 0.99); // #F8FAFC
      const colorBorder = rgb(0.89, 0.91, 0.94); // #E2E8F0
      
      // PAGE 1: COVER
      let page = pdfDoc.addPage([595, 842]); // A4 size
      let yPos = 750;
      
      // WATERMARK (logo PLEINE PAGE - adapté aux dimensions A4)
      if (logoImage) {
        // Prendre toute la hauteur de la page A4
        const watermarkSize = 842; // Hauteur complète de la page A4
        const watermarkX = (595 - watermarkSize) / 2; // Centré horizontalement (déborde un peu)
        const watermarkY = 0; // Du bas au haut
        page.drawImage(logoImage, {
          x: watermarkX,
          y: watermarkY,
          width: watermarkSize,
          height: watermarkSize,
          opacity: 0.08
        });
        console.log('✅ Watermark added - FULL PAGE');
      }
      
      // BANDEAU BLEU PLUS GROS en haut
      page.drawRectangle({ x: 0, y: 742, width: 595, height: 100, color: colorPrimary });
      
      // LOGO TRÈS GROS dans le bandeau bleu (left)
      if (logoImage) {
        page.drawImage(logoImage, { x: 15, y: 747, width: 100, height: 100 });
        console.log('✅ Logo added to header');
      }
      
      // Title in bandeau (center-right) - PLUS GROS
      page.drawText(`ÉTAT DES LIEUX ${typeEdl}`, { x: 220, y: 800, size: 26, font: fontBold, color: rgb(1, 1, 1) });
      
      yPos = 710;
      
      // SECTION INFOS STRUCTURÉE
      page.drawRectangle({ x: 40, y: yPos - 80, width: 515, height: 90, color: colorBg, borderColor: colorBorder, borderWidth: 1 });
      
      // Colonne 1 : Numéro et Date
      page.drawText('RÉFÉRENCE', { x: 50, y: yPos - 15, size: 10, font: fontBold, color: colorPrimary });
      page.drawText(reportId, { x: 50, y: yPos - 35, size: 13, font: fontBold });
      page.drawText('Date', { x: 50, y: yPos - 55, size: 9, font, color: rgb(0.4, 0.4, 0.4) });
      page.drawText(new Date(edl.created_at).toLocaleDateString('fr-FR'), { x: 50, y: yPos - 70, size: 11, font });
      
      // Colonne 2 : Adresse
      page.drawText('ADRESSE DU BIEN', { x: 250, y: yPos - 15, size: 10, font: fontBold, color: colorPrimary });
      // Build CP+ville: from separate fields, or extract from adresse string
      let cpVille = [edl.code_postal, edl.ville].filter(Boolean).join(' ');
      if (!cpVille && edl.adresse) {
        const cpMatch = edl.adresse.match(/(\d{5})\s+(\S.*)$/);
        if (cpMatch) cpVille = cpMatch[1] + ' ' + cpMatch[2];
      }
      // Show street on line 1 (strip CP/ville if already in adresse)
      let rue = (edl.adresse || '');
      if (cpVille && rue.includes(cpVille)) rue = rue.replace(cpVille, '').replace(/,\s*$/, '').trim();
      page.drawText(rue.substring(0, 55), { x: 250, y: yPos - 35, size: 11, font });
      if (cpVille) {
        page.drawText(cpVille.substring(0, 40), { x: 250, y: yPos - 50, size: 11, font });
      }
      
      yPos -= 100;
      
      // SECTION: Propriétaire (styled box) - POLICE PLUS GROSSE
      page.drawRectangle({ x: 40, y: yPos - 80, width: 245, height: 90, color: colorBg, borderColor: colorBorder, borderWidth: 1 });
      page.drawText('PROPRIÉTAIRE / AGENCE', { x: 50, y: yPos - 15, size: 12, font: fontBold, color: colorPrimary });
      page.drawText(edl.nom_proprietaire || 'N/A', { x: 50, y: yPos - 35, size: 11, font });
      page.drawText(`Type: ${edl.type_logement}`, { x: 50, y: yPos - 50, size: 10, font, color: rgb(0.4, 0.4, 0.4) });
      
      // SECTION: Locataire (styled box) - POLICE PLUS GROSSE
      page.drawRectangle({ x: 310, y: yPos - 80, width: 245, height: 90, color: colorBg, borderColor: colorBorder, borderWidth: 1 });
      page.drawText('LOCATAIRE', { x: 320, y: yPos - 15, size: 12, font: fontBold, color: colorPrimary });
      page.drawText(pdfText(edl.nom_locataire || 'N/A'), { x: 320, y: yPos - 35, size: 11, font });
      
      yPos -= 110;
      
      // SECTION HEADER: Détail des pièces - POLICE PLUS GROSSE
      page.drawRectangle({ x: 40, y: yPos - 30, width: 515, height: 35, color: colorBg, borderColor: colorBorder, borderWidth: 1 });
      page.drawText('DÉTAIL DES PIÈCES', { x: 50, y: yPos - 18, size: 16, font: fontBold, color: colorPrimary });
      yPos -= 50;
      
      // PAGE 2+: ROOMS DETAIL
      for (let i = 0; i < pieces.length; i++) {
        const piece = pieces[i];
        const d = piece.donnees_json || {};
        const photos = piece.photos || [];

        // Pre-calculate equipment list
        const equips = [];
        if (d.etat_fenetres) equips.push(`Fenêtres: ${d.etat_fenetres}`);
        if (d.etat_portes) equips.push(`Portes: ${d.etat_portes}`);
        if (d.etat_volets) equips.push(`Volets: ${d.etat_volets}`);
        if (d.etat_prises) equips.push(`Prises: ${d.etat_prises}`);
        if (d.etat_interrupteurs) equips.push(`Interrupteurs: ${d.etat_interrupteurs}`);
        if (d.etat_radiateurs) equips.push(`Radiateurs: ${d.etat_radiateurs}`);
        ['plaques_de_cuisson','four','hotte','réfrigérateur','évier','robinetterie'].forEach(k => {
          if (d[`etat_${k}`]) equips.push(`${k.replace(/_/g,' ')}: ${d[`etat_${k}`]}`);
        });
        ['baignoire/douche','lavabo','wc'].forEach(k => {
          const key = `etat_sdb_${k.replace(/[\/ ]/g,'_')}`;
          if (d[key]) equips.push(`${k}: ${d[key]}`);
        });

        // Dynamic block height
        const murStr = [d.nature_murs, d.etat_murs].filter(Boolean).join(' - ');
        const plafondStr = [d.nature_plafond, d.etat_plafond].filter(Boolean).join(' - ');
        const solStr = [d.nature_sol, d.etat_sol].filter(Boolean).join(' - ');
        let blockH = 55;
        if (murStr) blockH += 14;
        if (plafondStr) blockH += 14; // now on separate line
        if (d.obs_murs) blockH += 13;
        if (solStr) blockH += 14;
        if (d.obs_sol) blockH += 13;
        if (equips.length > 0) { blockH += 14; if (equips.join(' | ').length > 68) blockH += 13; }
        if (d.obs_equipements) blockH += 13;
        if (d.observations_generales) blockH += 14;
        blockH = Math.max(blockH, 90) + 20;

        if (yPos - blockH < 80) {
          page = pdfDoc.addPage([595, 842]);
          if (logoImage) {
            const wSize = 700;
            page.drawImage(logoImage, { x: (595 - wSize) / 2, y: (842 - wSize) / 2, width: wSize, height: wSize, opacity: 0.08 });
          }
          yPos = 800;
        }

        const bgColor = i % 2 === 0 ? rgb(1, 1, 1) : colorBg;
        page.drawRectangle({ x: 40, y: yPos - blockH, width: 515, height: blockH, color: bgColor, borderColor: colorBorder, borderWidth: 0.5 });

        page.drawText(pdfText(piece.nom || 'N/A'), { x: 50, y: yPos - 16, size: 12, font: fontBold, color: colorPrimary });
        const etat = d.etat_general || 'Non renseigné';
        page.drawText(pdfText(`Etat general: ${etat}`), { x: 50, y: yPos - 32, size: 10, font });
        page.drawLine({ start: { x: 50, y: yPos - 40 }, end: { x: 540, y: yPos - 40 }, thickness: 0.4, color: colorBorder });

        let yLine = yPos - 54;

        const T = 60;
        if (murStr) { page.drawText(pdfText(`Murs: ${murStr.substring(0,T)}`), { x: 50, y: yLine, size: 9, font }); yLine -= 13; }
        if (plafondStr) { page.drawText(pdfText(`Plafond: ${plafondStr.substring(0,T)}`), { x: 50, y: yLine, size: 9, font }); yLine -= 13; }
        if (d.obs_murs) {
          const obs = d.obs_murs.length > T ? d.obs_murs.substring(0, T) + '...' : d.obs_murs;
          page.drawText(pdfText(`  > ${obs}`), { x: 50, y: yLine, size: 8, font: fontItalic, color: rgb(0.3, 0.3, 0.3) });
          yLine -= 13;
        }

        if (solStr) {
          page.drawText(pdfText(`Sol: ${solStr.substring(0,T)}`), { x: 50, y: yLine, size: 9, font });
          yLine -= 13;
        }
        if (d.obs_sol) {
          const obs = d.obs_sol.length > T ? d.obs_sol.substring(0, T) + '...' : d.obs_sol;
          page.drawText(pdfText(`  > ${obs}`), { x: 50, y: yLine, size: 8, font: fontItalic, color: rgb(0.3, 0.3, 0.3) });
          yLine -= 13;
        }

        if (equips.length > 0) {
          const equipStr = equips.join(' | ');
          const equipTrunc = equipStr.length > T ? equipStr.substring(0, T) + '...' : equipStr;
          page.drawText(pdfText(`Equip.: ${equipTrunc}`), { x: 50, y: yLine, size: 9, font });
          yLine -= 13;
        }
        if (d.obs_equipements) {
          const obs = d.obs_equipements.length > T ? d.obs_equipements.substring(0, T) + '...' : d.obs_equipements;
          page.drawText(pdfText(`  > ${obs}`), { x: 50, y: yLine, size: 8, font: fontItalic, color: rgb(0.3, 0.3, 0.3) });
          yLine -= 13;
        }

        if (d.observations_generales) {
          const obs = d.observations_generales.length > T ? d.observations_generales.substring(0, T) + '...' : d.observations_generales;
          page.drawText(pdfText(`IA: ${obs}`), { x: 50, y: yLine, size: 8, font: fontItalic, color: rgb(0.2, 0.35, 0.6) });
        }

        // Photo thumbnail (right side x=415)
        if (photos.length > 0) {
          page.drawText(`${photos.length} photo${photos.length > 1 ? 's' : ''}`, { x: 415, y: yPos - 16, size: 9, font, color: rgb(0.3, 0.3, 0.3) });
          const firstPhoto = photos[0];
          if (firstPhoto.url || firstPhoto.data) {
            try {
              let imageBytes;
              if (firstPhoto.url) {
                let imageUrl = firstPhoto.url;
                if (imageUrl.includes('cloudinary.com')) {
                  imageUrl = imageUrl.replace('/upload/', '/upload/q_auto,f_jpg,w_300,c_limit/');
                }
                const imgResponse = await fetch(imageUrl);
                if (!imgResponse.ok) throw new Error(`HTTP ${imgResponse.status}`);
                imageBytes = await imgResponse.arrayBuffer();
              } else if (firstPhoto.data) {
                const base64Data = firstPhoto.data.split(',')[1];
                const binaryString = Buffer.from(base64Data, 'base64');
                imageBytes = binaryString.buffer.slice(binaryString.byteOffset, binaryString.byteOffset + binaryString.byteLength);
              }
              if (!imageBytes) throw new Error('No image data');
              let image;
              try { image = await pdfDoc.embedJpg(imageBytes); } catch { image = await pdfDoc.embedPng(imageBytes); }
              const imgWidth = 80;
              const imgHeight = 60;
              const imgX = 515 - imgWidth - 10;
              const imgY = yPos - blockH + 15;
              page.drawImage(image, { x: imgX, y: imgY, width: imgWidth, height: imgHeight });
              page.drawRectangle({ x: imgX, y: imgY, width: imgWidth, height: imgHeight, borderColor: rgb(0.7, 0.7, 0.7), borderWidth: 1 });
            } catch (err) {
              console.error('❌ Error embedding image:', err);
              page.drawText('Photo indisponible', { x: 420, y: yPos - 50, size: 8, font: fontItalic, color: rgb(0.7, 0, 0) });
            }
          }
        }

        yPos -= blockH + 5;
      }

      // LAST PAGE: SIGNATURES
      page = pdfDoc.addPage([595, 842]);
      if (logoImage) {
        page.drawImage(logoImage, { x: (595 - 700) / 2, y: (842 - 700) / 2, width: 700, height: 700, opacity: 0.06 });
      }
      yPos = 750;

      page.drawText('SIGNATURES', { x: 50, y: yPos, size: 18, font: fontBold, color: colorPrimary });
      page.drawLine({ start: { x: 50, y: yPos - 8 }, end: { x: 540, y: yPos - 8 }, thickness: 1, color: colorBorder });
      yPos -= 40;

      // Locataire signature box
      page.drawRectangle({ x: 40, y: yPos - 130, width: 230, height: 140, color: colorBg, borderColor: colorPrimary, borderWidth: 1.5 });
      page.drawText('LE LOCATAIRE', { x: 50, y: yPos - 15, size: 10, font: fontBold, color: colorPrimary });
      page.drawText(edl.nom_locataire || 'N/A', { x: 50, y: yPos - 32, size: 12, font: fontBold });
      page.drawText('Lu et approuvé', { x: 50, y: yPos - 50, size: 9, font: fontItalic, color: rgb(0.4, 0.4, 0.4) });
      page.drawText('Signature :', { x: 50, y: yPos - 68, size: 9, font, color: rgb(0.4, 0.4, 0.4) });
      if (edl.signature_locataire) {
        page.drawText(edl.signature_locataire, { x: 55, y: yPos - 87, size: 14, font: fontItalic, color: rgb(0.1, 0.1, 0.5) });
      }
      page.drawLine({ start: { x: 50, y: yPos - 100 }, end: { x: 255, y: yPos - 100 }, thickness: 0.5, color: rgb(0.6, 0.6, 0.6) });
      page.drawText(`Date : ${new Date(edl.created_at).toLocaleDateString('fr-FR')}`, { x: 50, y: yPos - 120, size: 9, font: fontBold });

      // Propriétaire signature box
      page.drawRectangle({ x: 320, y: yPos - 130, width: 230, height: 140, color: colorBg, borderColor: colorPrimary, borderWidth: 1.5 });
      page.drawText('LE PROPRIÉTAIRE / AGENCE', { x: 330, y: yPos - 15, size: 10, font: fontBold, color: colorPrimary });
      page.drawText(edl.nom_proprietaire || 'N/A', { x: 330, y: yPos - 32, size: 12, font: fontBold });
      page.drawText('Lu et approuvé', { x: 330, y: yPos - 50, size: 9, font: fontItalic, color: rgb(0.4, 0.4, 0.4) });
      page.drawText('Signature :', { x: 330, y: yPos - 68, size: 9, font, color: rgb(0.4, 0.4, 0.4) });
      if (edl.signature_proprietaire) {
        page.drawText(edl.signature_proprietaire, { x: 335, y: yPos - 87, size: 14, font: fontItalic, color: rgb(0.1, 0.1, 0.5) });
      }
      page.drawLine({ start: { x: 330, y: yPos - 100 }, end: { x: 535, y: yPos - 100 }, thickness: 0.5, color: rgb(0.6, 0.6, 0.6) });
      page.drawText(`Date : ${new Date(edl.created_at).toLocaleDateString('fr-FR')}`, { x: 330, y: yPos - 120, size: 9, font: fontBold });

      // BLOC DESIGN RÉDUIT EN BAS À DROITE : Logo + Nom
      const blockWidth = 180;
      const blockHeight = 110;
      const blockX = 595 - blockWidth - 30; // En bas à droite avec marge
      const blockY = 40; // En bas de page
      
      // Fond du bloc avec bordure
      page.drawRectangle({ 
        x: blockX, 
        y: blockY, 
        width: blockWidth, 
        height: blockHeight, 
        color: colorBg, 
        borderColor: colorPrimary, 
        borderWidth: 2 
      });
      
      // Logo centré dans le bloc
      if (logoImage) {
        page.drawImage(logoImage, { 
          x: blockX + (blockWidth - 60) / 2, 
          y: blockY + 45, 
          width: 60, 
          height: 60 
        });
      }
      
      // Nom de l'application CENTRÉ (largeur texte ≈ 130px, taille 14)
      const nomWidth = 130;
      page.drawText('État des Lieux Pro', { 
        x: blockX + (blockWidth - nomWidth) / 2, 
        y: blockY + 25, 
        size: 14, 
        font: fontBold, 
        color: colorPrimary 
      });
      
      // Tagline CENTRÉE (largeur texte ≈ 100px, taille 9)
      const tagWidth = 100;
      page.drawText('Solution certifiée', { 
        x: blockX + (blockWidth - tagWidth) / 2, 
        y: blockY + 10, 
        size: 9, 
        font: fontItalic, 
        color: rgb(0.5, 0.5, 0.5) 
      });
      
      // Footer (à gauche, pas sous le bloc)
      page.drawText(`Généré certifié par État des Lieux Pro.`, {
        x: 40,
        y: 70,
        size: 8,
        font,
        color: rgb(0.5, 0.5, 0.5)
      });
      page.drawText(`Horodatage et intégrité des données garantis.`, {
        x: 40,
        y: 55,
        size: 8,
        font,
        color: rgb(0.5, 0.5, 0.5)
      });
      
      // Generate PDF bytes
      const pdfBytes = await pdfDoc.save();
      
      return new NextResponse(pdfBytes, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `inline; filename="EDL_FRESH_${Date.now()}.pdf"`,
          'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
          'Pragma': 'no-cache',
          'Expires': '-1',
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
    
    // Special handling for Stripe webhook (needs raw body)
    if (segments[0] === 'stripe' && segments[1] === 'webhook') {
      const sig = request.headers.get('stripe-signature');
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
      
      if (!webhookSecret) {
        console.error('❌ STRIPE_WEBHOOK_SECRET non configuré - webhook rejeté');
        return NextResponse.json({ error: 'Webhook non configuré' }, { status: 500, headers: corsHeaders() });
      }

      try {
        const rawBody = await request.text();
        const event = getStripe().webhooks.constructEvent(rawBody, sig, webhookSecret);

        console.log(`🔔 Stripe Webhook: ${event.type}`);

        // Handle subscription cancellation
        if (event.type === 'customer.subscription.deleted') {
          const subscription = event.data.object;
          
          // Find and update the EDL associated with this subscription
          const result = await db.collection('edl').updateOne(
            { stripe_payment_id: subscription.id },
            { 
              $set: { 
                subscription_status: 'canceled',
                subscription_canceled_at: new Date().toISOString()
              } 
            }
          );
          
          console.log(`✅ Subscription ${subscription.id} marked as canceled`);
        }

        // Handle checkout session completed (for one-time payments)
        if (event.type === 'checkout.session.completed') {
          const session = event.data.object;
          const metadata = session.metadata || {};
          
          if (metadata.edl_id) {
            const downloadToken = uuidv4().replace(/-/g, '').substring(0, 16);
            
            // Update EDL
            await db.collection('edl').updateOne(
              { id: metadata.edl_id },
              { 
                $set: {
                  paid: true,
                  statut: 'completed',
                  stripe_payment_id: session.id,
                  plan: metadata.plan_code || 'one_shot',
                  download_token: downloadToken,
                } 
              }
            );
            
            // Update transaction
            await db.collection('payment_transactions').updateOne(
              { session_id: session.id },
              { $set: { payment_status: 'paid', status: 'completed' } }
            );
            
            // Get EDL and send email
            const edl = await db.collection('edl').findOne({ id: metadata.edl_id });
            if (edl && edl.email_locataire) {
              await sendEmail(edl.email_locataire, edl, downloadToken);
            }
            
            console.log(`✅ Checkout completed for EDL ${metadata.edl_id}, email sent`);
          }
        }

        return NextResponse.json({ received: true }, { headers: corsHeaders() });
      } catch (err) {
        console.error('Stripe Webhook Error:', err.message);
        return NextResponse.json({ error: err.message }, { status: 400, headers: corsHeaders() });
      }
    }

    // For all other routes, parse JSON body
    const body = await request.json();

    // ============ AUTH ROUTES ============
    
    // POST /api/auth/register
    if (segments[0] === 'auth' && segments[1] === 'register') {
      const { email, password, nom } = body;
      
      if (!email || !password || !nom) {
        return NextResponse.json({ error: 'Email, mot de passe et nom requis' }, { status: 400, headers: corsHeaders() });
      }
      
      if (password.length < 6) {
        return NextResponse.json({ error: 'Le mot de passe doit contenir au moins 6 caractères' }, { status: 400, headers: corsHeaders() });
      }
      
      // Check if user exists
      const existingUser = await db.collection('users').findOne({ email });
      if (existingUser) {
        return NextResponse.json({ error: 'Cet email est déjà utilisé' }, { status: 400, headers: corsHeaders() });
      }
      
      // Create user
      const hashedPassword = await hashPassword(password);
      const userId = uuidv4();
      const user = {
        id: userId,
        email,
        nom,
        password: hashedPassword,
        created_at: new Date().toISOString(),
      };
      
      await db.collection('users').insertOne(user);
      
      // Generate token
      const token = generateToken(userId, email);
      
      return NextResponse.json({
        token,
        user: { id: userId, email, nom }
      }, { headers: corsHeaders() });
    }
    
    // POST /api/auth/login
    if (segments[0] === 'auth' && segments[1] === 'login') {
      const { email, password } = body;
      
      if (!email || !password) {
        return NextResponse.json({ error: 'Email et mot de passe requis' }, { status: 400, headers: corsHeaders() });
      }
      
      // Find user
      const user = await db.collection('users').findOne({ email });
      if (!user) {
        return NextResponse.json({ error: 'Email ou mot de passe incorrect' }, { status: 401, headers: corsHeaders() });
      }
      
      // Verify password
      const validPassword = await comparePassword(password, user.password);
      if (!validPassword) {
        return NextResponse.json({ error: 'Email ou mot de passe incorrect' }, { status: 401, headers: corsHeaders() });
      }
      
      // Generate token
      const token = generateToken(user.id, user.email);
      
      return NextResponse.json({
        token,
        user: { id: user.id, email: user.email, nom: user.nom }
      }, { headers: corsHeaders() });
    }

    // ============ PROTECTED ROUTES (require auth) ============
    const authUser = getUserFromRequest(request);
    // Allow stripe webhooks and admin endpoints without auth
    const publicEndpoints = segments[0]?.startsWith('stripe') || segments[0] === 'admin';
    if (!authUser && !publicEndpoints) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401, headers: corsHeaders() });
    }

    // POST /api/edl
    if (segments[0] === 'edl' && !segments[1]) {
      const edl = {
        id: uuidv4(),
        user_id: authUser.userId,
        created_at: new Date().toISOString(),
        adresse: body.adresse || '',
        code_postal: body.code_postal || '',
        ville: body.ville || '',
        type_logement: body.type_logement || 'T2',
        type_edl: body.type_edl || 'Entrée',
        nom_locataire: body.nom_locataire || '',
        nom_proprietaire: body.nom_proprietaire || '',
        email_locataire: body.email_locataire || '',
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
        const response = await getOpenAI().chat.completions.create({
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
          const response = await getOpenAI().chat.completions.create({
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
        const transcription = await getOpenAI().audio.transcriptions.create({
          file,
          model: 'whisper-1',
          language: language || 'fr',
          response_format: 'text',
        });

        const rawText = typeof transcription === 'string' ? transcription : transcription.text || '';

        // Clean up with GPT-4o-mini
        const cleanResponse = await getOpenAI().chat.completions.create({
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

      // Get EDL to retrieve email
      const edl = await db.collection('edl').findOne({ id: edl_id });
      const customerEmail = edl?.email_locataire || null;

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
        const session = await getStripe().checkout.sessions.create({
          payment_method_types: ['card'],
          line_items: lineItems,
          mode: planDef.mode === 'subscription' ? 'subscription' : 'payment',
          success_url: successUrl,
          cancel_url: cancelUrl,
          customer_email: customerEmail || undefined,
          billing_address_collection: customerEmail ? undefined : 'auto',
          metadata: {
            edl_id,
            plan_code: plan_code || 'one_shot',
            has_comparaison_ia: String(hasComparaisonIA),
            has_archive: String(hasArchive),
            customer_email: customerEmail || '',
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
      if (!authUser) {
        return NextResponse.json({ error: 'Non authentifié' }, { status: 401, headers: corsHeaders() });
      }
      const { session_id } = body;
      if (!session_id) {
        return NextResponse.json({ error: 'session_id required' }, { status: 400, headers: corsHeaders() });
      }

      try {
        const session = await getStripe().checkout.sessions.retrieve(session_id);
        const transaction = await db.collection('payment_transactions').findOne({ session_id });

        console.log(`🔍 Stripe Session Check: status=${session.status}, payment_status=${session.payment_status}, amount=${session.amount_total}`);

        // Only process if not already processed (idempotent)
        // Note: For $0 payments with 100% coupon, payment_status might be 'no_payment_required' instead of 'paid'
        const isPaymentComplete = (session.status === 'complete') || (session.payment_status === 'paid') || (session.payment_status === 'no_payment_required');
        
        if (isPaymentComplete && transaction && transaction.payment_status !== 'paid') {
          console.log(`✅ Processing payment for session ${session_id}`);
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
              stripe_customer_id: session.customer || null, // Store customer ID for portal access
              plan: metadata.plan_code,
              has_comparaison_ia: metadata.has_comparaison_ia === 'true',
              has_archive: metadata.has_archive === 'true',
              download_token: downloadToken,
              subscription_status: session.subscription ? 'active' : null,
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

          // ✨ SEND EMAIL AUTOMATICALLY with download link
          const edl = await db.collection('edl').findOne({ id: metadata.edl_id });
          const recipientEmail = session.customer_email || metadata.customer_email || edl?.email_locataire;
          
          if (recipientEmail) {
            console.log(`📧 Attempting to send email to: ${recipientEmail}`);
            const emailSent = await sendEmail(recipientEmail, edl, downloadToken);
            if (emailSent) {
              console.log(`✅ Email successfully sent to ${recipientEmail}`);
            } else {
              console.error(`❌ Failed to send email to ${recipientEmail}`);
            }
          } else {
            console.warn('⚠️ No email address found for automatic sending. User will need to download manually.');
          }

          return NextResponse.json({
            status: session.status,
            payment_status: isPaymentComplete ? 'paid' : session.payment_status, // Normalize to 'paid' for frontend
            amount_total: (session.amount_total || 0) / 100,
            currency: session.currency,
            download_token: downloadToken,
            edl_id: metadata.edl_id,
            email_sent: recipientEmail ? true : false,
          }, { headers: corsHeaders() });
        }

        // Already processed or not paid
        const edl = transaction ? await db.collection('edl').findOne({ id: transaction.edl_id }) : null;

        return NextResponse.json({
          status: session.status,
          payment_status: edl?.download_token ? 'paid' : session.payment_status, // If has download_token, it's paid
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

    // POST /api/email/send - Send report email via Resend
    if (segments[0] === 'email' && segments[1] === 'send') {
      if (!authUser) return NextResponse.json({ error: 'Non authentifié' }, { status: 401, headers: corsHeaders() });
      const { to, edl_id, download_token } = body;
      if (!to || !to.includes('@')) {
        return NextResponse.json({ error: 'Email invalide' }, { status: 400, headers: corsHeaders() });
      }
      const edl = await db.collection('edl').findOne({ id: edl_id });
      if (!edl || edl.user_id !== authUser.userId) {
        return NextResponse.json({ error: 'Accès refusé' }, { status: 403, headers: corsHeaders() });
      }
      await sendEmail(to, edl, download_token);
      return NextResponse.json({ success: true }, { headers: corsHeaders() });
    }

    // POST /api/admin/unlock - Unlock EDL via promo code or admin key
    if (segments[0] === 'admin' && segments[1] === 'unlock') {
      const { edl_id, promo_code, admin_key } = body;

      const validAdminKey = process.env.ADMIN_KEY;
      const validPromoCodes = (process.env.PROMO_CODES || '').split(',').map(c => c.trim().toUpperCase()).filter(Boolean);

      const submittedCode = (promo_code || admin_key || '').toUpperCase();
      console.log('🔑 promo debug - submitted:', JSON.stringify(submittedCode), 'valid codes:', JSON.stringify(validPromoCodes), 'admin key match:', submittedCode === (validAdminKey || '').toUpperCase());
      const isValid = (validAdminKey && submittedCode === validAdminKey.toUpperCase()) ||
                      (validPromoCodes.length > 0 && validPromoCodes.includes(submittedCode));

      if (!isValid) {
        return NextResponse.json({ error: 'Code invalide', debug: { submitted: submittedCode, validCodes: validPromoCodes } }, { status: 403, headers: corsHeaders() });
      }
      
      if (!edl_id) {
        return NextResponse.json({ error: 'edl_id requis' }, { status: 400, headers: corsHeaders() });
      }

      try {
        const downloadToken = uuidv4().replace(/-/g, '').substring(0, 16);
        
        // Update EDL
        await db.collection('edl').updateOne(
          { id: edl_id },
          { $set: {
            paid: true,
            statut: 'completed',
            stripe_payment_id: 'admin_unlock_' + Date.now(),
            plan: 'one_shot',
            download_token: downloadToken,
          } }
        );

        // Get updated EDL with email
        const edl = await db.collection('edl').findOne({ id: edl_id });

        // Send email if email_locataire exists
        if (edl && edl.email_locataire) {
          await sendEmail(edl.email_locataire, edl, downloadToken);
        }

        return NextResponse.json({
          success: true,
          message: 'EDL débloqué (mode admin)',
          download_token: downloadToken,
          download_link: `${process.env.NEXT_PUBLIC_BASE_URL}/api/pdf-fresh/${downloadToken}`,
          edl_id: edl_id,
          email_sent: edl?.email_locataire ? true : false,
        }, { headers: corsHeaders() });

      } catch (err) {
        console.error('Admin unlock error:', err);
        return NextResponse.json({ error: err.message }, { status: 500, headers: corsHeaders() });
      }
    }

    // POST /api/stripe/portal - Create Stripe Customer Portal Session
    if (segments[0] === 'stripe' && segments[1] === 'portal') {
      const { customer_id, return_url } = body;
      
      if (!customer_id || !return_url) {
        return NextResponse.json({ error: 'customer_id and return_url required' }, { status: 400, headers: corsHeaders() });
      }

      try {
        const session = await getStripe().billingPortal.sessions.create({
          customer: customer_id,
          return_url: return_url,
        });

        return NextResponse.json({ url: session.url }, { headers: corsHeaders() });
      } catch (stripeErr) {
        console.error('Stripe Portal Error:', stripeErr);
        return NextResponse.json({ error: 'Erreur portail: ' + stripeErr.message }, { status: 500, headers: corsHeaders() });
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

    const authUser = getUserFromRequest(request);
    if (!authUser) return NextResponse.json({ error: 'Non authentifié' }, { status: 401, headers: corsHeaders() });

    // PUT /api/edl/:id
    if (segments[0] === 'edl' && segments[1]) {
      const existing = await db.collection('edl').findOne({ id: segments[1] });
      if (!existing) return NextResponse.json({ error: 'EDL not found' }, { status: 404, headers: corsHeaders() });
      if (existing.user_id !== authUser.userId) return NextResponse.json({ error: 'Accès refusé' }, { status: 403, headers: corsHeaders() });
      const { id, _id, ...updateData } = body;
      await db.collection('edl').updateOne({ id: segments[1] }, { $set: updateData });
      const updated = await db.collection('edl').findOne({ id: segments[1] });
      return NextResponse.json(updated, { headers: corsHeaders() });
    }

    // PUT /api/pieces/:id
    if (segments[0] === 'pieces' && segments[1]) {
      const piece = await db.collection('pieces').findOne({ id: segments[1] });
      if (!piece) return NextResponse.json({ error: 'Piece not found' }, { status: 404, headers: corsHeaders() });
      const edl = await db.collection('edl').findOne({ id: piece.edl_id });
      if (!edl || edl.user_id !== authUser.userId) return NextResponse.json({ error: 'Accès refusé' }, { status: 403, headers: corsHeaders() });
      const { id, _id, ...updateData } = body;
      await db.collection('pieces').updateOne({ id: segments[1] }, { $set: updateData });
      const updated = await db.collection('pieces').findOne({ id: segments[1] });
      return NextResponse.json(updated, { headers: corsHeaders() });
    }

    // PUT /api/photos/:id
    if (segments[0] === 'photos' && segments[1]) {
      const photo = await db.collection('photos').findOne({ id: segments[1] });
      if (!photo) return NextResponse.json({ error: 'Photo not found' }, { status: 404, headers: corsHeaders() });
      const edl = await db.collection('edl').findOne({ id: photo.edl_id });
      if (!edl || edl.user_id !== authUser.userId) return NextResponse.json({ error: 'Accès refusé' }, { status: 403, headers: corsHeaders() });
      const { id, _id, data, ...updateData } = body;
      // Si data base64 fourni et pas encore d'URL Cloudinary, uploader
      if (data && !photo.url) {
        const cloudinaryData = await uploadToCloudinary(data, `edl-pro/${photo.edl_id}/${photo.piece_id}`);
        if (cloudinaryData) {
          updateData.url = cloudinaryData.url;
          updateData.public_id = cloudinaryData.public_id;
          updateData.data = null;
        } else {
          updateData.data = data;
        }
      }
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

    const authUser = getUserFromRequest(request);
    if (!authUser) return NextResponse.json({ error: 'Non authentifié' }, { status: 401, headers: corsHeaders() });

    // DELETE /api/photos/:id
    if (segments[0] === 'photos' && segments[1]) {
      const photo = await db.collection('photos').findOne({ id: segments[1] });
      if (!photo) return NextResponse.json({ error: 'Photo not found' }, { status: 404, headers: corsHeaders() });
      const edl = await db.collection('edl').findOne({ id: photo.edl_id });
      if (!edl || edl.user_id !== authUser.userId) return NextResponse.json({ error: 'Accès refusé' }, { status: 403, headers: corsHeaders() });
      if (photo.public_id) {
        await deleteFromCloudinary(photo.public_id);
      }
      await db.collection('photos').deleteOne({ id: segments[1] });
      return NextResponse.json({ success: true }, { headers: corsHeaders() });
    }

    // DELETE /api/edl/:id
    if (segments[0] === 'edl' && segments[1]) {
      const edl = await db.collection('edl').findOne({ id: segments[1] });
      if (!edl) return NextResponse.json({ error: 'EDL not found' }, { status: 404, headers: corsHeaders() });
      if (edl.user_id !== authUser.userId) return NextResponse.json({ error: 'Accès refusé' }, { status: 403, headers: corsHeaders() });
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

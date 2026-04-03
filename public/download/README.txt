# État des Lieux Pro - PWA Next.js

## 📱 Application complète d'inspection immobilière

### Stack Technique
- **Frontend**: Next.js 15 + React + Tailwind CSS + PWA
- **Backend**: Next.js API Routes (App Router)
- **Base de données**: MongoDB
- **Paiements**: Stripe (LIVE mode)
- **Email**: Resend
- **IA**: OpenAI (GPT-4o-mini + Whisper + Vision)
- **Images**: Cloudinary
- **Auth**: JWT + bcrypt

### URLs
- Production: https://property-inspect-16.emergent.host
- Preview: https://property-inspect-16.preview.emergentagent.com

### Architecture Monolithique (à refactorer)
```
/app/
├── app/
│   ├── page.js (2103 lignes - TOUT le frontend React)
│   ├── layout.js (Config Next.js + PWA)
│   └── api/[[...path]]/route.js (1883 lignes - TOUTE l'API backend)
├── .env (Clés API: Stripe, Resend, OpenAI, Cloudinary)
└── package.json (Dépendances)
```

### Fonctionnalités
✅ Authentification JWT (multi-utilisateurs isolés)
✅ Création EDL avec choix T1-T4
✅ Inspection pièce par pièce (5 étapes)
✅ Upload photos + tri IA automatique (Vision API)
✅ Notes vocales → texte (Whisper API)
✅ Paiements Stripe (9.90€ one-shot, 49€/mois Pro, 149€/mois Business)
✅ Génération PDF serveur (pdf-lib)
✅ Envoi email automatique (Resend)
✅ Code promo TEST100 (déblocage gratuit)
✅ PWA installable (offline capable)

### Problèmes actuels
⚠️ Code monolithique (page.js = 2100 lignes, route.js = 1900 lignes)
⚠️ Photos stockées en Base64 au lieu de Cloudinary URLs
⚠️ Possible cache frontend après paiement (corrigé récemment)

### Identifiants de test
- Email: leonie6800@gmail.com
- Password: Mobile123
- Code promo: TEST100
- Admin key: edl_admin_2026_test

### Schéma DB MongoDB
**Collections:**
- users: {id, email, password (bcrypt), nom, created_at}
- edl: {id, user_id, adresse, type_logement, paid, download_token, stripe_payment_id}
- pieces: {id, edl_id, nom, statut, donnees_json}
- photos: {id, piece_id, edl_id, url (Cloudinary), data (Base64 fallback)}


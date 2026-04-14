# AUDIT REPORT — État des Lieux Pro
**Date :** 14 avril 2026  
**Projet :** etats-des-lieux-pro  
**URL production :** https://etats-des-lieux-pro.vercel.app

---

## État du projet

### Stack technique validée
| Composant | Technologie | Version | État |
|-----------|-------------|---------|------|
| Framework | Next.js App Router | 14.2.3 | ✅ |
| Base de données | MongoDB Atlas | ^6.6.0 | ✅ |
| Storage photos | Cloudinary | configuré | ✅ |
| Email | Resend (domaine edlpro.app vérifié) | configuré | ✅ |
| Paiement | Stripe (live keys) | configuré | ✅ |
| Hosting | Vercel (leonie6800-org) | déployé | ✅ |
| Auth | JWT (bcryptjs) | custom | ✅ |
| PDF | pdf-lib | configuré | ✅ |
| IA photos | OpenAI GPT-4o | configuré | ✅ |
| PWA | manifest.json + sw.js + icônes | complet | ✅ |

### % de complétion estimé : **85%**

---

## Fonctionnalités

| Fonctionnalité | État | Priorité | Notes |
|----------------|------|----------|-------|
| Authentification login/signup | ✅ Fonctionne | — | JWT custom, bcrypt |
| Création EDL (formulaire) | ✅ Fonctionne | — | heure_debut/fin inclus |
| Workflow inspection (6 étapes) | ✅ Fonctionne | — | étape 6 = compteurs/clés |
| Upload photos | ✅ Fonctionne | — | Cloudinary |
| Analyse IA photos | ✅ Fonctionne | — | OpenAI GPT-4o |
| Transcription vocale | ✅ Fonctionne | — | OpenAI Whisper |
| Signature locataire | ✅ Fonctionne | — | Canvas, sauvegardé en DB |
| Signature propriétaire | ✅ Fonctionne | — | Canvas, sauvegardé en DB |
| Génération PDF | ✅ Fonctionne | — | pdf-lib, WinAnsi sanitisé |
| Envoi email PDF | ✅ Fonctionne | — | Resend, noreply@edlpro.app |
| Dashboard utilisateur | ✅ Fonctionne | — | liste EDLs, statuts |
| Paiement one-shot Stripe | ✅ Fonctionne | — | checkout + webhook |
| Abonnement Stripe | ✅ Fonctionne | — | portal client |
| Code promo / admin unlock | ✅ Fonctionne | — | TEST100 corrigé |
| Modal Modifier EDL | ✅ Fonctionne | — | adresse, heure, locataire |
| Section compteurs (PDF) | ✅ Fonctionne | — | ALUR 2014 |
| Section clés (PDF) | ✅ Fonctionne | — | ALUR 2014 |
| Footer ALUR | ✅ Fonctionne | — | toutes les pages |
| Pages légales (5) | ✅ Fonctionne | — | CGV, mentions, RGPD, contact, à propos |
| Formulaire contact /legal/contact | ✅ Fonctionne | — | POST /api/contact |
| PWA installable | ✅ Fonctionne | — | icônes 192/512, manifest, sw.js |
| Annotations photos | ❌ Non implémenté | Basse | html2canvas présent mais non utilisé |
| Comparaison EDL entrant/sortant | ⚠️ Partiel | Moyenne | UI présente, logique incomplète |

---

## Bugs / Problèmes identifiés

### 🔴 Critique

1. **Endpoint `/api/admin/reset-all` en production** (sévérité : CRITIQUE)  
   Supprime TOUTES les données de tous les utilisateurs avec juste la clé admin.  
   → À supprimer immédiatement du code.

2. **`NEXT_PUBLIC_BASE_URL` mal configuré dans .env.local** (sévérité : CRITIQUE)  
   Valeur locale : `https://ton-domaine.vercel.app` (placeholder non remplacé).  
   → Sur Vercel : vérifier que la valeur est bien `https://etats-des-lieux-pro.vercel.app`.  
   → Impacte les liens de téléchargement dans les emails.

### 🟡 Moyen

3. **Console.log de debug en production** (sévérité : MOYENNE)  
   route.js contient ~15 `console.log` ajoutés lors du débogage (email, watermark, PDF, promo).  
   → À nettoyer pour éviter l'exposition de données en logs Vercel.

4. **`DB_NAME` manquant sur Vercel** (sévérité : MOYENNE)  
   L'app utilise `process.env.DB_NAME || 'edl_pro'` — fonctionne par défaut mais non déclaré sur Vercel.  
   → Ajouter `DB_NAME=edl_pro` sur Vercel pour être explicite.

5. **Variables NEXT_PUBLIC_* manquantes sur Vercel** (sévérité : MOYENNE)  
   `NEXT_PUBLIC_APP_NAME`, `NEXT_PUBLIC_COMPANY_NAME`, `NEXT_PUBLIC_COMPANY_SIRET`, `NEXT_PUBLIC_CONTACT_EMAIL`, `NEXT_PUBLIC_COMPANY_ADDRESS` sont dans .env.local mais pas sur Vercel.  
   → Les pages légales utilisent des valeurs codées en dur, donc pas bloquant maintenant.

### 🟢 Faible

6. **Script `scripts/delete-all-edl.mjs` laissé dans le repo** (sévérité : FAIBLE)  
   Contient les credentials MongoDB en clair.  
   → À supprimer du repo.

7. **`jspdf` installé mais non utilisé** (sévérité : FAIBLE)  
   pdf-lib est utilisé pour la génération. jspdf est une dépendance morte.  
   → À supprimer de package.json.

8. **`ADMIN_KEY` vide dans .env.local** (sévérité : FAIBLE)  
   Valeur correcte sur Vercel production mais `.env.local` a `boui123aur` — ok.

---

## Plan d'action recommandé

### Priorité 1 — Sécurité (faire maintenant)
1. Supprimer l'endpoint `/api/admin/reset-all` de route.js
2. Supprimer `scripts/delete-all-edl.mjs` du repo
3. Vérifier `NEXT_PUBLIC_BASE_URL` sur Vercel = `https://etats-des-lieux-pro.vercel.app`

### Priorité 2 — Propreté production
4. Supprimer les `console.log` de debug dans route.js
5. Ajouter `DB_NAME=edl_pro` sur Vercel
6. Supprimer `jspdf` de package.json

### Priorité 3 — Fonctionnalités manquantes
7. Finaliser la comparaison EDL entrant/sortant (si fonctionnalité voulue)
8. Implémenter annotations photos (si voulue)

---

## Variables d'environnement — état complet

| Variable | .env.local | Vercel Production | Statut |
|----------|-----------|------------------|--------|
| MONGO_URL | ✅ | ✅ | OK |
| DB_NAME | ✅ | ❌ | Manquant Vercel (fallback ok) |
| JWT_SECRET | ✅ | ✅ | OK |
| STRIPE_SECRET_KEY | ✅ | ✅ | OK |
| STRIPE_WEBHOOK_SECRET | ✅ | ✅ | OK |
| NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY | ✅ | ✅ | OK |
| OPENAI_API_KEY | ✅ | ✅ | OK |
| CLOUDINARY_CLOUD_NAME | ✅ | ✅ | OK |
| CLOUDINARY_API_KEY | ✅ | ✅ | OK |
| CLOUDINARY_API_SECRET | ✅ | ✅ | OK |
| RESEND_API_KEY | ✅ | ✅ | OK |
| NEXT_PUBLIC_EMAILJS_PUBLIC_KEY | ✅ | ✅ | OK |
| NEXT_PUBLIC_EMAILJS_SERVICE_ID | ✅ | ✅ | OK |
| NEXT_PUBLIC_EMAILJS_TEMPLATE_ID | ✅ | ✅ | OK |
| NEXT_PUBLIC_BASE_URL | ⚠️ placeholder | ✅ | Vérifier valeur Vercel |
| ADMIN_KEY | ✅ | ✅ | OK |
| PROMO_CODES | ✅ | ✅ | OK (corrigé sans \n) |
| NEXT_PUBLIC_APP_NAME | ✅ | ❌ | Manquant Vercel |
| NEXT_PUBLIC_COMPANY_NAME | ✅ | ❌ | Manquant Vercel |
| NEXT_PUBLIC_COMPANY_SIRET | ✅ | ❌ | Manquant Vercel |
| NEXT_PUBLIC_CONTACT_EMAIL | ✅ | ❌ | Manquant Vercel |
| NEXT_PUBLIC_COMPANY_ADDRESS | ✅ | ❌ | Manquant Vercel |

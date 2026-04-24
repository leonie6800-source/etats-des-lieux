# ÉTAT DES LIEUX PRO — Dossier Projet Complet
**Dernière mise à jour : 24 avril 2026**

---

## 🌐 LIENS IMPORTANTS

| Ressource | URL |
|-----------|-----|
| **App production** | https://etats-des-lieux-pro.vercel.app |
| **GitHub** | https://github.com/leonie6800-source/etats-des-lieux |
| **Vercel dashboard** | https://vercel.com/leonie6800-org/etats-des-lieux-pro |
| **MongoDB Atlas** | https://cloud.mongodb.com (DB: `edl_pro`) |
| **Cloudinary** | https://cloudinary.com (cloud: `dylbswptn`) |
| **Resend** | https://resend.com (domaine: `edlpro.app`) |
| **Stripe** | https://dashboard.stripe.com (clés LIVE) |
| **Namecheap** | https://namecheap.com (domaine: `edlpro.app`) |

---

## 👤 INFORMATIONS SOCIÉTÉ

| Champ | Valeur |
|-------|--------|
| **Nom** | Bouillet Aurélie |
| **Nom commercial** | LilyFBA |
| **SIRET** | 493 875 223 00072 |
| **Adresse** | Fellerings, 68470, Alsace |
| **Email** | contact@edlpro.app |
| **Domaine** | edlpro.app (acheté sur Namecheap) |

---

## 🛠️ STACK TECHNIQUE

| Composant | Technologie | Détail |
|-----------|-------------|--------|
| Framework | Next.js 14.2.3 | App Router, JS (pas TS) |
| Base de données | MongoDB Atlas | DB: `edl_pro` |
| Auth | JWT custom | bcryptjs, tokens locaux |
| Storage photos | Cloudinary | cloud: `dylbswptn` |
| Email | Resend | `noreply@edlpro.app` (domaine en cours de vérification) |
| Paiement | Stripe | Clés LIVE (pas test) |
| PDF | pdf-lib | WinAnsi encoding, sanitiseur pdfText() |
| IA photos | OpenAI GPT-4o | Analyse automatique des photos |
| Transcription | OpenAI Whisper | Transcription vocale |
| Hosting | Vercel | leonie6800-org |
| PWA | manifest.json + sw.js | Icônes 192x512 |

---

## 📁 STRUCTURE DES FICHIERS

```
app/
├── page.js                          # Frontend principal (~2300 lignes)
├── layout.js                        # Layout avec Footer
├── globals.css
├── api/[[...path]]/route.js         # Backend API (~2150 lignes)
├── components/
│   └── Footer.js                    # Footer avec liens légaux
├── download/[token]/page.js         # Page téléchargement PDF
├── guide/
│   └── page.js                      # Guide d'utilisation (6 étapes)
└── legal/
    ├── alur/page.js                 # Loi ALUR 2014
    ├── cgv/page.js                  # CGV
    ├── mentions-legales/page.js     # Mentions légales
    ├── politique-confidentialite/   # RGPD
    ├── contact/page.js              # Formulaire contact
    └── a-propos/page.js             # À propos

public/
├── manifest.json                    # PWA manifest
├── sw.js                            # Service Worker
├── icon-192.png                     # Icône PWA
├── icon-512.png                     # Icône PWA
└── logo-edl-pro.png

lib/
└── logo-base64.js                   # Logo encodé base64 pour PDF
```

---

## 🔑 VARIABLES D'ENVIRONNEMENT

### Sur Vercel (Production) — toutes configurées
| Variable | Usage |
|----------|-------|
| `MONGO_URL` | Connexion MongoDB Atlas |
| `DB_NAME` | ⚠️ MANQUANT sur Vercel (fallback: `edl_pro`) |
| `JWT_SECRET` | Signature tokens JWT |
| `STRIPE_SECRET_KEY` | Stripe côté serveur (LIVE) |
| `STRIPE_WEBHOOK_SECRET` | Vérification webhooks Stripe |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe côté client (LIVE) |
| `OPENAI_API_KEY` | Analyse photos IA + transcription vocale |
| `CLOUDINARY_CLOUD_NAME` | `dylbswptn` |
| `CLOUDINARY_API_KEY` | Cloudinary upload |
| `CLOUDINARY_API_SECRET` | Cloudinary secret |
| `RESEND_API_KEY` | Envoi emails (re_dEePiajY_...) |
| `NEXT_PUBLIC_BASE_URL` | `https://etats-des-lieux-pro.vercel.app` |
| `ADMIN_KEY` | `boui123aur` — clé admin unlock EDL |
| `PROMO_CODES` | `TEST100` — code promo gratuit |

### ⚠️ Problème récurrent
Toutes les variables ajoutées via `npx vercel env add` avec un terminal Windows ont un `\n` parasite à la fin.
**Solution :** toujours utiliser `printf "valeur"` (sans echo) pour les ajouter.

---

## 📋 FONCTIONNALITÉS IMPLÉMENTÉES

### ✅ Authentification
- Signup / Login avec email + mot de passe
- JWT stocké en localStorage
- Modal d'onboarding (6 étapes) à la première inscription

### ✅ Création EDL
- Formulaire : adresse, code postal, ville
- Heure début / heure fin (obligatoires ALUR)
- Type logement (Studio, T1, T2, T3, T4, Maison)
- Type EDL (Entrée / Sortie)
- Nom locataire + email locataire
- Nom propriétaire
- Code promo (TEST100)

### ✅ Inspection (6 étapes par pièce)
- Étape 1 : sélection pièce
- Étape 2 : photos (Cloudinary)
- Étape 3 : analyse IA (GPT-4o)
- Étape 4 : observations murs/sol/plafond/équipements
- Étape 5 : résumé pièce
- Étape 6 : compteurs (élec/gaz/eau) + clés (logement/BAL/télécommandes/badges)

### ✅ Signatures électroniques
- Canvas de signature locataire
- Canvas de signature propriétaire
- Sauvegardées en base64 en DB

### ✅ Génération PDF (pdf-lib)
- En-tête avec logo + bandeau bleu
- Date + heure (format: "Le JJ/MM/AAAA de HH:MM a HH:MM")
- Identités locataire + propriétaire
- Adresse + code postal + ville
- Pièces avec : murs, plafond, sol, équipements, observations IA
- Photos (thumbnail Cloudinary)
- Word-wrap automatique (fonction wrapLines())
- Section compteurs (si renseignés)
- Section clés (si renseignées)
- Signatures avec zones dédiées
- Footer : "Conforme aux exigences de la loi ALUR 2014 | edlpro.app | contact@edlpro.app"

### ✅ Email
- Envoi via Resend
- **Actuellement** : `onboarding@resend.dev` (edlpro.app en cours de vérification DNS)
- **Cible** : `noreply@edlpro.app`
- Lien de téléchargement sécurisé dans l'email

### ✅ Paiement Stripe
- One-shot (à l'acte)
- Abonnement Pack Pro / Business
- Webhook Stripe configuré
- Portal client Stripe
- Code promo admin (TEST100)

### ✅ Modifier EDL
- Modal avec : adresse, code postal, ville, heure début/fin, locataire, propriétaire, email

### ✅ Pages légales
- `/legal/cgv` — CGV
- `/legal/mentions-legales` — Mentions légales
- `/legal/politique-confidentialite` — RGPD
- `/legal/contact` — Formulaire contact
- `/legal/a-propos` — À propos (SIRET + LilyFBA)
- `/legal/alur` — Explication loi ALUR 2014

### ✅ Guide & Formation
- `/guide` — Guide d'utilisation complet (6 étapes illustrées + FAQ)
- Modal onboarding première connexion

### ✅ PWA
- manifest.json configuré
- Service Worker (sw.js)
- Icônes 192x192 et 512x512 (logo EDL PRO)
- Installable sur iPhone (Safari → Partager → Sur l'écran d'accueil)
- Installable sur Android (Chrome → Menu → Ajouter à l'écran d'accueil)

---

## 🔧 DNS — edlpro.app sur Namecheap

### État actuel des enregistrements
| Type | Hôte | Valeur | Statut |
|------|------|--------|--------|
| TXT | `resend._domainkey` | `p=MIGfMA0GCSqGSIb3DQEBA...` | ✅ En place |
| TXT | `send` | `v=spf1 include:amazonses.com ~all` | ✅ En place |
| MX | `send` | `feedback-smtp.eu-west-1.amazonses.com` (priorité 10) | ⚠️ À vérifier |

### Problème connu
Namecheap traduit parfois les valeurs DNS en français (include → inclure, all → tous, none → aucun).
Toujours vérifier que les valeurs sont en **anglais** après saisie.

---

## 🚨 PROBLÈMES CONNUS / EN COURS

| Problème | Statut | Solution |
|----------|--------|----------|
| Email depuis `noreply@edlpro.app` | ⏳ DNS en vérification | Attendre vérification Resend. Actuellement `onboarding@resend.dev` |
| `DB_NAME` manquant sur Vercel | ⚠️ Mineur | Fallback `edl_pro` fonctionne |

---

## 🗺️ ENDPOINTS API PRINCIPAUX

| Méthode | Endpoint | Usage |
|---------|----------|-------|
| POST | `/api/auth/register` | Inscription |
| POST | `/api/auth/login` | Connexion |
| GET | `/api/edl` | Liste EDLs de l'utilisateur |
| POST | `/api/edl` | Créer un EDL |
| PUT | `/api/edl/:id` | Modifier un EDL |
| DELETE | `/api/edl/:id` | Supprimer un EDL |
| GET | `/api/pieces` | Pièces d'un EDL |
| POST | `/api/pieces` | Ajouter une pièce |
| GET | `/api/photos` | Photos d'une pièce |
| POST | `/api/photos` | Uploader une photo |
| GET | `/api/pdf/:id` | Générer le PDF |
| GET | `/api/pdf-fresh/:token` | PDF via token de téléchargement |
| POST | `/api/email/send` | Envoyer PDF par email |
| POST | `/api/admin/unlock` | Débloquer avec code promo/admin |
| POST | `/api/stripe/checkout` | Créer session paiement |
| POST | `/api/stripe/webhook` | Webhook Stripe |
| POST | `/api/stripe/portal` | Portal client Stripe |
| POST | `/api/contact` | Formulaire de contact |
| POST | `/api/ai/analyze` | Analyse IA d'une photo |
| POST | `/api/transcribe` | Transcription vocale |

---

## 🚀 COMMANDES UTILES

```bash
# Développement local
npm run dev

# Déployer en production
npx vercel --prod

# Voir les variables d'environnement Vercel
npx vercel env ls

# Ajouter une variable (SANS \n parasite)
printf "valeur" | npx vercel env add NOM_VARIABLE production

# Supprimer une variable
npx vercel env rm NOM_VARIABLE production --yes

# Voir les logs en direct
npx vercel logs etats-des-lieux-pro.vercel.app --follow
```

---

## 📜 HISTORIQUE GIT (20 derniers commits)

| Hash | Description |
|------|-------------|
| 7cbc0f6 | Add onboarding, guide page, ALUR page, footer links |
| 7b8105f | Fix email: use onboarding@resend.dev (edlpro.app not verified) |
| 89e0227 | Fix PDF text wrapping and email error handling |
| 709aece | Security & cleanup: remove reset-all endpoint, debug logs |
| 6eb6bfa | Add PWA icons 192x192 and 512x512 |
| d8182f0 | Update company info: SIRET 493 875 223 00072, LilyFBA |
| 9dfc165 | ALUR compliance: heure, compteurs, cles, modifier modal, PDF |
| 00250cc | Add legal pages, footer, contact route (ALUR compliance) |
| 34c0331 | Update email from address to noreply@edlpro.app |
| 89a0b76 | Fix pdf-fresh endpoint: T=68 and multi-line equipment |
| 76a25ad | Fix PDF text truncation + multi-line equipment |
| 615cf38 | Fix: ReportView edit modal + PDF block height |
| fc19d98 | Add EDL edit modal + fix PDF photo/text overlap |
| 92d4d05 | Fix PDF: replace unsupported Unicode chars, add pdfText() |
| 159eaf1 | Fix: save code_postal and ville fields |
| d3300e3 | Add propriétaire signature to app UI and PDF |

---

## ✅ CHECKLIST CONFORMITÉ ALUR 2014

- [x] Date ET heure début/fin dans formulaire et PDF
- [x] Identité complète locataire + propriétaire
- [x] Adresse complète avec code postal et ville
- [x] Description pièce par pièce
- [x] État murs / sol / plafond / équipements
- [x] Relevés compteurs (élec, gaz, eau)
- [x] Clés et accès remis
- [x] Signatures des deux parties
- [x] Footer PDF "Conforme aux exigences de la loi ALUR 2014"
- [x] Pages légales (CGV, mentions, RGPD, contact, à propos)
- [x] Page explicative loi ALUR (/legal/alur)
- [x] Guide d'utilisation (/guide)
- [x] Onboarding première connexion

---

## 📞 SUPPORT

Pour toute question sur ce projet, ouvrir une nouvelle conversation Claude en partageant ce fichier PROJET-COMPLET.md — Claude aura immédiatement tout le contexte nécessaire.

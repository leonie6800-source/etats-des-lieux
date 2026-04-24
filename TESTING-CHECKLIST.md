# TESTING CHECKLIST — État des Lieux Pro
**URL prod :** https://etats-des-lieux-pro.vercel.app  
**Date :** 14 avril 2026

---

## Test 1 : Authentification
- [ ] Signup nouveau compte (email + mot de passe)
- [ ] Login avec le compte créé
- [ ] Dashboard visible après login
- [ ] Logout fonctionne
- [ ] Login avec mauvais mot de passe → message erreur

## Test 2 : Création EDL
- [ ] Bouton "Nouvel EDL" visible
- [ ] Formulaire : adresse, code postal, ville
- [ ] Formulaire : heure début / heure fin
- [ ] Formulaire : type logement + type EDL
- [ ] Formulaire : nom locataire + email locataire
- [ ] Formulaire : nom propriétaire
- [ ] Code promo TEST100 accepté
- [ ] EDL apparaît dans la liste dashboard

## Test 3 : Inspection (6 étapes)
- [ ] Étape 1 : ajouter une pièce (ex. Salon)
- [ ] Étape 2 : prendre/uploader une photo
- [ ] Étape 3 : analyse IA de la photo
- [ ] Étape 4 : observations murs/sol/plafond/équipements
- [ ] Étape 5 : résumé pièce
- [ ] Étape 6 : compteurs (électricité, gaz, eau) + clés
- [ ] Terminer l'inspection → retour dashboard

## Test 4 : Signature
- [ ] Bouton signature locataire visible
- [ ] Canvas dessin fonctionne
- [ ] "Je confirme" sauvegarde la signature
- [ ] Signature propriétaire idem
- [ ] Les deux signatures visibles sur le récapitulatif

## Test 5 : Génération PDF
- [ ] Bouton "Télécharger PDF" visible
- [ ] PDF généré sans erreur (pas de page noire)
- [ ] PDF contient : adresse + date + heure
- [ ] PDF contient : détails chaque pièce
- [ ] PDF contient : photos
- [ ] PDF contient : compteurs (si renseignés)
- [ ] PDF contient : clés (si renseignées)
- [ ] PDF contient : signatures
- [ ] PDF contient : footer ALUR 2014
- [ ] Code postal + ville dans le PDF

## Test 6 : Envoi email
- [ ] Bouton "Envoyer par email" visible
- [ ] Email envoyé via Resend (noreply@edlpro.app)
- [ ] Email reçu par le locataire
- [ ] Email contient lien téléchargement PDF
- [ ] PDF accessible via le lien

## Test 7 : Paiement Stripe
- [ ] Page paiement s'affiche
- [ ] Carte test : 4242 4242 4242 4242
- [ ] Paiement validé → EDL débloqué
- [ ] Code promo TEST100 → EDL débloqué sans paiement
- [ ] Facture visible dans l'app

## Test 8 : Pages légales + Footer
- [ ] Footer visible sur toutes les pages
- [ ] /legal/mentions-legales accessible
- [ ] /legal/cgv accessible
- [ ] /legal/politique-confidentialite accessible
- [ ] /legal/contact accessible + formulaire fonctionne
- [ ] /legal/a-propos accessible (SIRET + LilyFBA affiché)

## Test 9 : PWA Mobile
- [ ] Ouvrir sur mobile (Safari iPhone ou Chrome Android)
- [ ] Bouton "Ajouter à l'écran d'accueil" proposé
- [ ] App installée avec logo EDL PRO
- [ ] App s'ouvre en plein écran (sans barre navigateur)
- [ ] Navigation fluide sur mobile
- [ ] Formulaires utilisables au doigt
- [ ] Upload photo depuis appareil photo mobile
- [ ] Signature fonctionne au doigt

## Test 10 : Modifier EDL
- [ ] Bouton "Modifier" visible sur récapitulatif
- [ ] Modifier adresse → sauvegardé
- [ ] Modifier heure début/fin → sauvegardé
- [ ] Modifier nom locataire → sauvegardé
- [ ] Modifications visibles sur le PDF régénéré

---

## Résultats
| Test | Statut | Erreurs |
|------|--------|---------|
| 1 - Auth | ⏳ | |
| 2 - Création EDL | ⏳ | |
| 3 - Inspection | ⏳ | |
| 4 - Signature | ⏳ | |
| 5 - PDF | ⏳ | |
| 6 - Email | ⏳ | |
| 7 - Stripe | ⏳ | |
| 8 - Pages légales | ⏳ | |
| 9 - PWA Mobile | ⏳ | |
| 10 - Modifier EDL | ⏳ | |

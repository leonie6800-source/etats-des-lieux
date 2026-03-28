# 🧪 GUIDE DE TEST - PC et Mobile

## 📱 CE QUE VOUS DEVEZ TESTER

### ✅ TEST SUR MOBILE (Le plus important)

**Lien à ouvrir** : https://property-inspect-16.preview.emergentagent.com

---

### 📱 MOBILE - Test Complet (15 minutes)

**ÉTAPE 1 : Inscription**
1. Ouvrez le lien sur votre smartphone
2. Page de connexion s'affiche
3. Cliquez **"Pas encore de compte ? S'inscrire"**
4. Remplissez :
   - Nom : Test Mobile
   - Email : mobile@test.com
   - Mot de passe : test123456
5. Cliquez **"Créer mon compte"**
6. ✅ **VÉRIFIER** : Dashboard s'affiche, liste vide

**ÉTAPE 2 : Créer un EDL**
1. Cliquez **"+ Nouveau"** (en haut à droite)
2. Remplissez le formulaire :
   - Adresse : 10 rue de Test
   - Type logement : T2
   - Type EDL : Entrée
   - Locataire : Jean Test
   - Propriétaire : Marie Proprio
   - Email : votre@email.com (VOTRE VRAI EMAIL)
3. Cliquez **"Créer l'EDL"**
4. ✅ **VÉRIFIER** : Liste de pièces s'affiche (Entrée, Salon, etc.)

**ÉTAPE 3 : Inspecter une pièce**
1. Cliquez sur **"Entrée"**
2. Formulaire d'inspection s'affiche
3. Étape 1 - État général : Cliquez **"Bon"**
4. Cliquez **"Suivant"**
5. Étape 2 - Murs/plafonds : Cliquez **"Bon"**
6. Cliquez **"Suivant"**
7. Étape 3 - Sol : Cliquez **"Bon"**
8. Cliquez **"Suivant"**
9. Étape 4 - Équipements : Passez (Suivant)
10. Étape 5 - Photos :
    - Cliquez **"Prendre photo"**
    - Autorisez caméra si demandé
    - Prenez 1 photo
    - ✅ **VÉRIFIER** : Photo apparaît dans la liste
11. Cliquez **"Terminer"**
12. ✅ **VÉRIFIER** : Retour à la liste, "Entrée" marquée "✓ Terminé"

**ÉTAPE 4 : Vérifier la progression**
1. ✅ **VÉRIFIER** : Barre de progression mise à jour (11% ou similaire)
2. ✅ **VÉRIFIER** : Badge "1 pièce terminée"
3. ✅ **VÉRIFIER** : PAS besoin de F5 (refresh automatique)

**ÉTAPE 5 : Générer le rapport**
1. Cliquez **"Générer le rapport"** (bouton vert)
2. Page de paiement s'affiche
3. Plan "À l'acte 9.90€" sélectionné
4. ✅ **VÉRIFIER** : Total affiché correctement

**ÉTAPE 6 : Paiement (UTILISEZ ENDPOINT ADMIN)**
1. Appuyez sur **F12** (ou menu → Outils développeur)
2. Allez dans **"Console"**
3. Copiez ce code (remplacez EDL_ID) :

```javascript
// D'abord, trouvez votre EDL_ID
fetch('/api/edl', {
  headers: { 'Authorization': 'Bearer ' + localStorage.getItem('auth_token') }
})
.then(r => r.json())
.then(edls => {
  console.table(edls);
  alert('Copiez l\'ID de votre EDL depuis la console');
});

// Puis déverrouillez (remplacez L'ID)
fetch('/api/admin/unlock', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    edl_id: 'COPIEZ_ID_ICI',
    admin_key: 'edl_admin_2026_test'
  })
})
.then(r => r.json())
.then(data => {
  alert('✅ Débloqué ! Rechargez (F5)');
  console.log('Résultat:', data);
  location.reload();
});
```

4. Appuyez sur **Entrée**
5. Rechargez la page (F5)
6. ✅ **VÉRIFIER** : Bouton "📥 Télécharger le PDF" apparaît

**ÉTAPE 7 : Télécharger le PDF**
1. Cliquez **"📥 Télécharger le PDF"**
2. ✅ **VÉRIFIER** : PDF se télécharge
3. Ouvrez le PDF
4. ✅ **VÉRIFIER** :
   - Adresse présente
   - Logo visible
   - Détails de l'EDL
   - Photo de la pièce visible
   - Watermark présent

**ÉTAPE 8 : Vérifier l'email**
1. Ouvrez votre boîte email (celle entrée à l'étape 2)
2. ✅ **VÉRIFIER** : Email reçu avec sujet "Rapport d'état des lieux"
3. Ouvrez l'email
4. ✅ **VÉRIFIER** : Lien PDF présent
5. Cliquez sur le lien
6. ✅ **VÉRIFIER** : PDF se télécharge

**ÉTAPE 9 : Déconnexion/Reconnexion**
1. Cliquez sur 🚪 (en haut à droite)
2. ✅ **VÉRIFIER** : Retour à la page de connexion
3. Reconnectez-vous avec mobile@test.com / test123456
4. ✅ **VÉRIFIER** : Retrouvez votre EDL avec "Payé"

---

### 💻 PC - Test Complet (10 minutes)

**Lien à ouvrir** : https://property-inspect-16.preview.emergentagent.com

**IMPORTANT** : Utilisez **navigation privée** (Ctrl+Shift+N)

**ÉTAPE 1 : Inscription**
1. Ouvrez le lien dans Chrome/Edge (navigation privée)
2. Cliquez **"Pas encore de compte ? S'inscrire"**
3. Créez compte : pc@test.com / test123456 / Test PC
4. ✅ **VÉRIFIER** : Dashboard vide s'affiche

**ÉTAPE 2 : Créer EDL + Inspecter**
1. Créez un EDL (similaire mobile)
2. Complétez 1 pièce
3. ✅ **VÉRIFIER** : Progression se met à jour SANS F5

**ÉTAPE 3 : Upload photo depuis PC**
1. Dans formulaire d'inspection, étape Photos
2. Cliquez **"Prendre photo"**
3. Sélectionnez une image depuis votre PC
4. ✅ **VÉRIFIER** : Image uploadée et visible

**ÉTAPE 4 : Débloquer et télécharger**
1. Utilisez endpoint admin (console F12)
2. Téléchargez le PDF
3. ✅ **VÉRIFIER** : PDF avec photo PC visible

**ÉTAPE 5 : PWA Installation (optionnel)**
1. Regardez la barre d'adresse
2. ✅ **VÉRIFIER** : Icône "Installer" ou "+" visible
3. Cliquez dessus (si vous voulez tester l'installation)
4. Popup : "Installer État des Lieux Pro ?"
5. Si installé → App s'ouvre dans fenêtre séparée

---

### ✅ CHECKLIST DE TESTS

**Mobile** :
- [ ] Inscription fonctionne
- [ ] Création EDL fonctionne
- [ ] Inspection avec photos (caméra)
- [ ] Progression se met à jour automatiquement
- [ ] Déverrouillage avec endpoint admin
- [ ] Bouton PDF apparaît
- [ ] PDF téléchargé avec photos
- [ ] Email reçu avec lien PDF
- [ ] Déconnexion/reconnexion

**PC** :
- [ ] Inscription fonctionne (navigation privée)
- [ ] Création EDL + inspection
- [ ] Upload photo depuis fichier PC
- [ ] Progression automatique (pas de F5)
- [ ] PDF avec photo PC
- [ ] Icône PWA visible dans barre d'adresse

---

### 🚨 Problèmes possibles et solutions

**"Je ne vois pas la page de connexion"**
→ Videz cache (Ctrl+Shift+Delete) ou navigation privée

**"L'endpoint admin ne marche pas"**
→ Vérifiez que vous avez bien copié l'EDL_ID depuis la console

**"Le PDF n'a pas de photos"**
→ Vérifiez que la photo a bien été uploadée (étape 5 photos)

**"Email pas reçu"**
→ Vérifiez spam, et vérifiez l'email entré lors création EDL

**"Progression ne se met pas à jour"**
→ Attendez 2-3 secondes, ou rechargez (F5) - si besoin de F5, c'est un bug

---

### 📊 Résultats attendus

**MOBILE** :
- ✅ Tout fonctionne en plein écran
- ✅ Photos avec caméra
- ✅ Interface tactile fluide
- ✅ Progression automatique
- ✅ Email reçu

**PC** :
- ✅ Interface responsive
- ✅ Upload fichiers
- ✅ Icône PWA visible
- ✅ Tout fonctionne comme sur mobile

---

### 📝 RAPPORT À ME DONNER

**Après vos tests, dites-moi** :

**Mobile** :
- ✅ Tout fonctionne ?
- ❌ Quels problèmes ?

**PC** :
- ✅ Tout fonctionne ?
- ❌ Quels problèmes ?

**Exemple de rapport** :
```
Mobile ✅ : Tout fonctionne sauf progression (besoin F5)
PC ✅ : Tout OK
Email ✅ : Reçu
PDF ✅ : Photos visibles
```

---

## 🚀 IMPORTANT

**Pendant que vous testez, je teste aussi avec mon agent automatique !**

**On se synchronise après** :
- Mes tests automatiques ✅
- Vos tests manuels ✅
- = Application validée à 100% !

---

**COMMENCEZ VOS TESTS MAINTENANT pendant que je lance les miens !** ⏱️

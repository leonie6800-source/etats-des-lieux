# 🔧 DEBUG : Déblocage Manuel du Rapport

## ⚠️ Problème Stripe détecté

Les clés Stripe LIVE semblent invalides (erreur 401). En attendant la résolution, utilisez cette méthode pour débloquer manuellement vos rapports.

---

## 🚀 Solution temporaire : Endpoint de test

### Méthode 1 : Depuis la console navigateur (F12)

1. Ouvrez votre app : https://property-inspect-16.preview.emergentagent.com
2. Appuyez sur **F12** pour ouvrir la console
3. Copiez-collez ce code en remplaçant `EDL_ID` et `EMAIL` :

```javascript
fetch('/api/test/unlock-report', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    edl_id: 'VOTRE_EDL_ID_ICI',  // Remplacez par l'ID de votre EDL
    email: 'votre@email.com'      // Votre email pour recevoir le PDF
  })
})
.then(r => r.json())
.then(data => {
  console.log('✅ Rapport débloqué:', data);
  alert('Rapport débloqué ! Rechargez la page (F5)');
  location.reload();
})
.catch(e => console.error('Erreur:', e));
```

### Comment trouver votre EDL_ID ?

**Option A** : Depuis l'URL quand vous êtes sur la page de l'EDL
```
https://property-inspect-16.preview.emergentagent.com/?edl=XXXXX
                                                           ↑ Copier cet ID
```

**Option B** : Depuis la console API
```javascript
fetch('/api/edl')
  .then(r => r.json())
  .then(edls => {
    console.table(edls.map(e => ({ 
      id: e.id, 
      adresse: e.adresse, 
      paid: e.paid 
    })));
  });
```

Copiez l'`id` de l'EDL que vous voulez débloquer.

---

### Méthode 2 : Avec curl (depuis terminal)

```bash
curl -X POST https://property-inspect-16.preview.emergentagent.com/api/test/unlock-report \
  -H "Content-Type: application/json" \
  -d '{
    "edl_id": "VOTRE_EDL_ID",
    "email": "votre@email.com"
  }'
```

---

## ✅ Après déblocage

1. **Rechargez la page** (F5)
2. Le bouton **"📥 Télécharger le PDF"** devrait apparaître
3. Vous devriez recevoir un **email** avec le lien de téléchargement

---

## 🔍 Vérification

Pour vérifier si un EDL est débloqué :

```javascript
fetch('/api/edl/VOTRE_EDL_ID')
  .then(r => r.json())
  .then(edl => {
    console.log('Paid:', edl.paid);                    // Doit être true
    console.log('Download Token:', edl.download_token); // Doit avoir un token
  });
```

---

## 🐛 Problème Stripe à résoudre

**Erreur détectée** : `statusCode: 401` lors de l'appel Stripe

**Cause probable** :
- Clés Stripe expirées ou révoquées
- Compte Stripe restreint
- Mauvaise configuration des clés

**Solution** :
1. Connectez-vous à votre Dashboard Stripe : https://dashboard.stripe.com
2. Allez dans **Développeurs → Clés API**
3. Vérifiez que les clés sont actives
4. Si besoin, régénérez de nouvelles clés
5. Mettez à jour le fichier `.env` avec les nouvelles clés :
   ```
   STRIPE_SECRET_KEY=sk_live_NOUVELLE_CLE
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_NOUVELLE_CLE
   ```
6. Redémarrez l'app : `sudo supervisorctl restart nextjs`

---

## 📧 Email n'arrive pas ?

Si l'email ne part pas automatiquement avec la méthode de déblocage ci-dessus :

### Méthode manuelle pour envoyer l'email

```javascript
// 1. Récupérer le download_token
fetch('/api/edl/VOTRE_EDL_ID')
  .then(r => r.json())
  .then(edl => {
    console.log('Token:', edl.download_token);
    console.log('Lien PDF:', 
      `https://property-inspect-16.preview.emergentagent.com/api/pdf-fresh/${edl.download_token}`
    );
  });
```

Vous pouvez ensuite :
- Copier le lien et l'envoyer manuellement par email
- Ou utiliser le bouton WhatsApp de l'app

---

## ⚠️ IMPORTANT

Cet endpoint `/api/test/unlock-report` est temporaire et **ne doit PAS rester en production**. 

À supprimer une fois le problème Stripe résolu !

---

**Date** : 28 Mars 2026  
**Status** : Solution temporaire en attendant fix Stripe

# 📧 Configuration Domaine Email Personnalisé - Resend

## ✅ Email fonctionne déjà !

**Actuellement** :
- De : `État des Lieux Pro <onboarding@resend.dev>`
- ✅ Fonctionne parfaitement
- ⚠️ Domaine Resend (pas le vôtre)

**Avec domaine personnalisé** :
- De : `État des Lieux Pro <rapport@votredomaine.com>`
- ✅ Plus professionnel
- ✅ Votre marque

---

## 📋 Prérequis

**Vous avez besoin d'un nom de domaine** :
- Exemples : `etatdeslieuxpro.com`, `monsite.fr`, etc.
- Acheté chez : OVH, Gandi, Namecheap, Google Domains, etc.

**Si vous n'avez PAS de domaine** :
- ✅ L'email actuel (`onboarding@resend.dev`) fonctionne très bien
- Vous pouvez acheter un domaine plus tard
- Pas obligatoire pour le moment

---

## 🌐 Étape 1 : Ajouter le domaine dans Resend

1. **Connectez-vous à Resend** : https://resend.com/login

2. **Allez dans "Domains"** :
   - Menu de gauche → Cliquez sur **"Domains"**

3. **Ajoutez votre domaine** :
   - Cliquez sur **"+ Add Domain"**
   - Entrez votre domaine (ex: `etatdeslieuxpro.com`)
   - Cliquez **"Add"**

4. **Resend affiche les enregistrements DNS** :
   - Plusieurs enregistrements à copier :
     - **MX** (Mail Exchange)
     - **TXT** pour SPF
     - **TXT** pour DKIM
     - **CNAME** pour le tracking (optionnel)

---

## 🔧 Étape 2 : Configurer le DNS chez votre hébergeur

**Où configurer le DNS ?**
- Allez chez l'hébergeur où vous avez acheté votre domaine
- Exemples : OVH, Gandi, Google Domains, Namecheap, etc.

### Exemple avec OVH :

1. **Connexion** : https://www.ovh.com/manager/
2. **Sélectionnez votre domaine**
3. **Zone DNS** → Cliquez sur l'onglet "Zone DNS"
4. **Ajouter une entrée** → Cliquez "Ajouter une entrée"

### Exemple avec Google Domains :

1. **Connexion** : https://domains.google.com
2. **Sélectionnez votre domaine**
3. **DNS** → Menu "DNS"
4. **Enregistrements personnalisés** → "Gérer les enregistrements personnalisés"

### Exemple avec Namecheap :

1. **Connexion** : https://www.namecheap.com
2. **Domain List** → Cliquez sur votre domaine
3. **Advanced DNS** → Onglet "Advanced DNS"
4. **Add New Record**

---

## 📝 Enregistrements DNS à ajouter

**Copiez EXACTEMENT ce que Resend vous donne** :

### 1. MX (Mail Exchange)
```
Type : MX
Hôte : @  (ou votre domaine)
Valeur : feedback-smtp.us-east-1.amazonses.com
Priorité : 10
```

### 2. SPF (TXT)
```
Type : TXT
Hôte : @
Valeur : v=spf1 include:amazonses.com ~all
```

### 3. DKIM (TXT) - Clé 1
```
Type : TXT
Hôte : resend._domainkey
Valeur : (longue chaîne fournie par Resend)
```

### 4. DKIM (TXT) - Clé 2
```
Type : TXT
Hôte : resend2._domainkey
Valeur : (longue chaîne fournie par Resend)
```

### 5. DMARC (optionnel mais recommandé)
```
Type : TXT
Hôte : _dmarc
Valeur : v=DMARC1; p=none; rua=mailto:dmarc@votredomaine.com
```

---

## ⏱️ Étape 3 : Attendre la propagation DNS

**Durée** : 10 minutes à 48 heures (généralement 1-2 heures)

**Vérification dans Resend** :
1. Retournez dans Resend → Domains
2. Cliquez sur **"Verify"** à côté de votre domaine
3. Si vert ✅ → DNS configuré correctement
4. Si rouge ❌ → Attendez encore ou vérifiez vos DNS

---

## 💻 Étape 4 : Mettre à jour le code (je le fais pour vous)

**Une fois le domaine vérifié dans Resend**, donnez-moi :
- ✅ Votre nom de domaine (ex: `etatdeslieuxpro.com`)
- ✅ L'adresse email que vous voulez utiliser (ex: `rapport@etatdeslieuxpro.com`)

**Je modifierai le code pour utiliser** :
```javascript
from: 'État des Lieux Pro <rapport@votredomaine.com>'
```

Au lieu de :
```javascript
from: 'État des Lieux Pro <onboarding@resend.dev>'
```

---

## 🎯 Exemple complet : Si votre domaine est "monsite.com"

**Email souhaité** : `rapport@monsite.com`

### Resend Dashboard :
1. Add Domain → `monsite.com`
2. Copiez les DNS fournis

### Chez votre hébergeur DNS :
Ajoutez les enregistrements copiés depuis Resend

### Attendez 1-2 heures

### Vérifiez dans Resend :
- Status : Verified ✅

### Donnez-moi l'info :
"Mon domaine est `monsite.com`, je veux `rapport@monsite.com`"

### Je mets à jour le code !

---

## ❓ Questions fréquentes

**Q : Je n'ai pas de domaine, puis-je continuer ?**
✅ Oui ! L'email actuel fonctionne parfaitement. Vous pouvez attendre.

**Q : Ça coûte combien un domaine ?**
💰 Environ 10-15€/an chez OVH, Gandi, Namecheap, etc.

**Q : Combien de temps pour configurer ?**
⏱️ 15 minutes de configuration + 1-2h de propagation DNS

**Q : L'email actuel est-il professionnel ?**
⚠️ Il fonctionne, mais `onboarding@resend.dev` montre que c'est un service tiers.
Avec votre domaine : plus professionnel et reconnaissable.

**Q : Puis-je utiliser un sous-domaine ?**
✅ Oui ! Exemples :
- `app.etatdeslieuxpro.com`
- `edl.monsite.fr`

**Q : Les emails déjà envoyés vont changer ?**
❌ Non, seuls les futurs emails utiliseront le nouveau domaine.

---

## 🚀 Résumé rapide

**Si vous AVEZ un domaine** :
1. Resend Dashboard → Add Domain
2. Copiez les DNS
3. Ajoutez-les chez votre hébergeur
4. Attendez 1-2h
5. Vérifiez dans Resend
6. Donnez-moi le domaine, je mets à jour le code

**Si vous N'AVEZ PAS de domaine** :
- ✅ Rien à faire ! L'email fonctionne déjà
- Achetez un domaine plus tard si vous voulez
- Pas urgent

---

## 📞 Besoin d'aide ?

**Dites-moi** :
1. Avez-vous un domaine ? Lequel ?
2. Voulez-vous que je vous aide à configurer les DNS ?
3. Quelle adresse email voulez-vous utiliser ?

**Ou si vous préférez** :
- ✅ Gardez l'email actuel qui fonctionne parfaitement
- ✅ Configurez le domaine plus tard quand vous êtes prêt

---

**L'email fonctionne déjà ! Le domaine personnalisé est juste un bonus pour être plus professionnel.** ✅

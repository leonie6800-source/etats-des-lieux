# 📘 Guide : Portail Client Stripe & Webhooks

## 🎯 Qu'est-ce que le Portail Client Stripe ?

Le **Portail Client Stripe** est une interface web **créée automatiquement par Stripe** pour vos clients.  
**Vous n'avez RIEN à coder** - Stripe s'occupe de tout !

### ✅ Ce que vos clients peuvent faire dans le portail :
- ❌ **Annuler leur abonnement**
- 💳 **Modifier leur carte bancaire**
- 📄 **Télécharger toutes leurs factures**
- 📧 **Changer leur email de facturation**
- 🔄 **Voir l'historique de tous leurs paiements**

---

## 🛠️ Comment l'activer ? (5 minutes)

### Étape 1 : Se connecter à Stripe
1. Allez sur **https://dashboard.stripe.com**
2. Connectez-vous avec votre compte Stripe

### Étape 2 : Activer le Portail Client
1. Dans le menu de gauche, cliquez sur **"Paramètres"** ⚙️
2. Cherchez **"Portail client"** ou allez directement sur :  
   👉 **https://dashboard.stripe.com/settings/billing/portal**

3. Cliquez sur **"Activer le portail client"**

### Étape 3 : Configurer les options (IMPORTANT !)
Dans la configuration du portail, **cochez les options** :

✅ **Annulation d'abonnement** :
   - Autoriser les clients à annuler leur abonnement
   - **Recommandé** : "Annulation immédiate" ou "À la fin de la période"

✅ **Mise à jour du moyen de paiement** :
   - Autoriser les clients à mettre à jour leur carte

✅ **Historique de facturation** :
   - Autoriser les clients à télécharger leurs factures

4. Cliquez sur **"Enregistrer"**

### ✅ C'est TERMINÉ !
Le portail est maintenant actif. Le bouton **"⚙️ Gérer"** dans votre application fonctionne automatiquement !

---

## 🔔 Qu'est-ce qu'un Webhook ?

Un **webhook** est une **notification automatique** envoyée par Stripe à votre serveur quand quelque chose se passe.

### 📬 Exemple concret :
1. Un client clique sur **"Annuler mon abonnement"** dans le portail Stripe
2. Stripe annule l'abonnement
3. **Stripe envoie un webhook** à votre serveur : *"Hé, le client X a annulé son abonnement !"*
4. Votre serveur met à jour la base de données automatiquement

**Sans webhook** → Vous ne savez pas que le client a annulé  
**Avec webhook** → Votre base de données est toujours à jour automatiquement

---

## 🛠️ Comment configurer les Webhooks ? (Optionnel mais recommandé)

### Étape 1 : Créer un webhook
1. Allez sur **https://dashboard.stripe.com/webhooks**
2. Cliquez sur **"+ Ajouter un endpoint"**

### Étape 2 : Configurer l'URL
**URL du endpoint** :
```
https://property-inspect-16.preview.emergentagent.com/api/stripe/webhook
```

### Étape 3 : Sélectionner les événements à écouter
Cochez ces 2 événements :
- ✅ `customer.subscription.deleted` (Quand un client annule)
- ✅ `customer.subscription.updated` (Quand un abonnement change)

### Étape 4 : Récupérer le secret
1. Après avoir créé le webhook, Stripe vous donne un **"Secret de signature"**
2. Il ressemble à : `whsec_xxxxxxxxxxxxxxxxxxxx`
3. **Copiez-le**

### Étape 5 : Ajouter le secret dans votre application
1. Ouvrez le fichier `/app/.env`
2. Ajoutez cette ligne :
```
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxx
```
3. Redémarrez le serveur

### ✅ Terminé !
Maintenant, quand un client annule son abonnement, votre base de données sera automatiquement mise à jour.

---

## ⚠️ Est-ce OBLIGATOIRE ?

### Portail Client : **OUI, OBLIGATOIRE** ✅
- **Requis par la loi européenne** (RGPD)
- Les clients DOIVENT pouvoir annuler facilement
- **Temps d'activation : 5 minutes**

### Webhooks : **RECOMMANDÉ, mais pas obligatoire** ⚡
- Sans webhook : Fonctionne, mais vous devrez vérifier manuellement les annulations
- Avec webhook : Tout est automatique et à jour en temps réel
- **Temps d'activation : 10 minutes**

---

## 🧪 Comment tester ?

### Test du Portail :
1. Créez un abonnement test (Pack Pro ou Business)
2. Payez avec la carte test : `4242 4242 4242 4242`
3. Cliquez sur **"⚙️ Gérer"** dans votre application
4. Vous êtes redirigé vers le portail Stripe
5. Testez l'annulation d'abonnement

### Test des Webhooks :
1. Dans le dashboard Stripe, allez dans **"Webhooks"**
2. Cliquez sur votre webhook
3. Cliquez sur **"Envoyer un événement test"**
4. Sélectionnez `customer.subscription.deleted`
5. Vérifiez les logs de votre serveur

---

## 📊 Résumé

| Fonctionnalité | Obligatoire ? | Temps d'activation | Avantage |
|----------------|---------------|-------------------|----------|
| **Portail Client** | ✅ OUI (légal) | 5 min | Clients peuvent gérer leur abonnement |
| **Webhooks** | ⚡ Recommandé | 10 min | Base de données toujours à jour |

---

## 🆘 Besoin d'aide ?

- 📖 Documentation Stripe Portail : https://stripe.com/docs/billing/subscriptions/customer-portal
- 📖 Documentation Webhooks : https://stripe.com/docs/webhooks
- 💬 Support Stripe : https://support.stripe.com

---

✅ **Votre application est maintenant conforme aux normes légales !**

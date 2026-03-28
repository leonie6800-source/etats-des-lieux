# 🔐 Guide d'Authentification - État des Lieux Pro

## ✅ Test rapide du système d'authentification

### Étape 1 : Accéder à l'application

**URL** : https://property-inspect-16.preview.emergentagent.com

1. Ouvrez le lien dans votre navigateur
2. L'écran de connexion/inscription s'affiche automatiquement
3. Par défaut, vous êtes sur "Se connecter"

---

### Étape 2 : Créer votre premier compte

1. Cliquez sur **"Pas encore de compte ? S'inscrire"** (en bas)
2. Remplissez le formulaire :
   - **Nom complet** : Votre nom (ex: Jean Dupont)
   - **Email** : Votre email (ex: jean@exemple.com)
   - **Mot de passe** : Minimum 6 caractères (ex: motdepasse123)
3. Cliquez sur **"✅ Créer mon compte"**
4. ✅ Connexion automatique → Dashboard s'affiche !

---

### Étape 3 : Créer un état des lieux

1. Cliquez sur **"+ Nouveau"**
2. Remplissez :
   - Adresse
   - Type de logement
   - Nom locataire
   - Nom propriétaire
   - Email locataire
3. Cliquez **"Créer l'EDL"**
4. ✅ L'EDL est créé et lié à VOTRE compte

---

### Étape 4 : Tester l'isolation des utilisateurs

#### Test A : Votre compte
1. Créez 2-3 EDL avec votre compte
2. Notez qu'ils apparaissent dans la liste

#### Test B : Deuxième compte (isolation)
1. Cliquez sur 🚪 (Déconnexion) en haut à droite
2. Cliquez **"Pas encore de compte ? S'inscrire"**
3. Créez un nouveau compte avec un autre email (ex: marie@exemple.com)
4. Créez 1 EDL avec ce compte
5. ✅ **Vérification** : Vous ne voyez QUE l'EDL de Marie (pas ceux de Jean)

#### Test C : Retour au premier compte
1. Cliquez 🚪 (Déconnexion)
2. Cliquez **"Déjà un compte ? Se connecter"**
3. Connectez-vous avec jean@exemple.com
4. ✅ **Vérification** : Vous retrouvez vos 2-3 EDL (pas celui de Marie)

---

### Étape 5 : Test de sécurité

#### Test mot de passe faible
1. Essayez de créer un compte avec mot de passe "12345" (5 caractères)
2. ✅ **Erreur attendue** : "Le mot de passe doit contenir au moins 6 caractères"

#### Test email déjà utilisé
1. Essayez de créer un compte avec un email déjà enregistré
2. ✅ **Erreur attendue** : "Cet email est déjà utilisé"

#### Test mauvais mot de passe
1. Essayez de vous connecter avec le bon email mais mauvais mot de passe
2. ✅ **Erreur attendue** : "Email ou mot de passe incorrect"

---

## 🔧 Problèmes courants et solutions

### Problème : "La page de login n'est pas fixe"

**Solution** : Cela peut être dû au cache du navigateur.

1. **Videz le cache** :
   - Chrome/Edge : Ctrl + Shift + Delete → Cochez "Images et fichiers en cache" → Effacer
   - Firefox : Ctrl + Shift + Delete → Cochez "Cache" → Effacer
   - Safari : Cmd + Option + E

2. **Ou utilisez la navigation privée** :
   - Chrome : Ctrl + Shift + N
   - Firefox : Ctrl + Shift + P
   - Safari : Cmd + Shift + N

3. **Ou forcez le rechargement** :
   - Ctrl + F5 (Windows)
   - Cmd + Shift + R (Mac)

### Problème : "Impossible de créer un compte"

**Vérifications** :
1. Le mot de passe fait-il au moins 6 caractères ?
2. L'email est-il valide (contient un @) ?
3. Avez-vous rempli TOUS les champs (nom, email, mot de passe) ?
4. Y a-t-il une notification d'erreur qui s'affiche en haut de la page ?

**Si toujours bloqué** :
1. Ouvrez la console développeur (F12)
2. Allez dans l'onglet "Console"
3. Notez les erreurs affichées en rouge
4. Partagez ces informations

### Problème : "Session expirée après 7 jours"

**C'est normal** ! Les tokens JWT expirent après 7 jours pour la sécurité.

**Solution** : Reconnectez-vous avec votre email et mot de passe.

---

## 📧 Test du flow complet avec paiement

### Prérequis
- Compte créé
- Carte bancaire réelle (paiements LIVE)

### Étapes
1. Créez un EDL complet
2. Complétez au moins 1 pièce avec photos
3. Cliquez "Générer le rapport"
4. Choisissez votre plan (9.90€ recommandé pour test)
5. Payez avec votre vraie carte
6. ✅ Email envoyé automatiquement
7. ✅ PDF téléchargeable
8. ✅ Transaction visible dans Stripe

---

## 🔐 Informations de sécurité

### Ce qui est sécurisé
- ✅ Mots de passe **hashés** avec bcrypt (impossible de les récupérer en clair)
- ✅ Tokens JWT avec **expiration** (7 jours)
- ✅ Toutes les API **protégées** par authentification
- ✅ Chaque utilisateur voit **SEULEMENT ses données**
- ✅ Protection contre les **injections SQL** (MongoDB avec requêtes paramétrées)

### Ce qui est stocké
- **Base de données** : id, email, nom, password (hashé), created_at
- **localStorage** : auth_token (JWT), user_data (id, email, nom)

### Déconnexion
- Cliquez sur 🚪 en haut à droite
- Le token est supprimé du localStorage
- Vous êtes redirigé vers l'écran de connexion

---

## 🚀 Lien de test

**URL** : https://property-inspect-16.preview.emergentagent.com

**Testez maintenant !** Créez votre compte et explorez l'application sécurisée ! 🔐

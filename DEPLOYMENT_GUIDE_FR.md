# 🚀 Guide de Déploiement — Deutsch Institut (DIA)

Ce guide explique comment déployer l'application sur un nouveau serveur ou un service d'hébergement.

## 1. Prérequis
- **Node.js** (v18 ou plus récent)
- Un compte **Firebase** (Google Cloud)
- Un terminal avec **Git** et **npm**

---

## 2. Configuration Firebase (Le Cœur du Système)

L'application repose lourdement sur Firebase pour la base de données (Firestore) et l'authentification.

### A. Créer le Projet
1. Allez sur la [Console Firebase](https://console.firebase.google.com/).
2. Créez un nouveau projet (ex: `dia-production`).
3. Activez **Authentication** (Activez "Email/Password").
4. Activez **Firestore Database** (Choisissez un serveur proche de votre audience, ex: `europe-west3`).

### B. Obtenir les clés Client (Frontend)
1. Dans les paramètres du projet > Général > Vos applications.
2. Ajoutez une application Web.
3. Copiez l'objet `firebaseConfig`. Vous devrez reporter ces valeurs dans votre fichier `.env` (voir section suivante).

### C. Obtenir la clé Admin (Backend - Nécessaire pour le serveur)
C'est cette clé qui permet au serveur de gérer les utilisateurs et les accès sécurisés.
1. Paramètres du projet > Comptes de service.
2. Cliquez sur **Générer une nouvelle clé privée**.
3. Téléchargez le fichier JSON.
4. **Important :** Pour le déploiement, convertissez tout le contenu de ce fichier JSON en une seule ligne de texte (string) pour la mettre dans la variable `FIREBASE_SERVICE_ACCOUNT`.

---

## 3. Configuration de l'Environnement (`.env`)

Créez un fichier `.env` à la racine du projet sur le nouveau serveur. Utilisez `.env.example` comme modèle.

```env
# --- Configuration Serveur ---
PORT=3000
JWT_SECRET=une_cle_tres_secrete_ici
APP_NAME=DIA DEUTSCH INSTITUT

# --- Firebase ADMIN (Serveur) ---
# Le contenu JSON du compte de service en une seule ligne
FIREBASE_SERVICE_ACCOUNT={"type": "service_account", ...}

# --- Firebase CLIENT (Frontend) ---
# Ces variables sont injectées au moment du build (Vite)
VITE_FIREBASE_API_KEY=votre_api_key
VITE_FIREBASE_AUTH_DOMAIN=votre_projet.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=votre_projet_id
VITE_FIREBASE_STORAGE_BUCKET=votre_projet.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:12345:web:abcd
```

---

## 4. Installation et Build

Une fois les fichiers sur le serveur :

```bash
# 1. Installer les dépendances
npm install

# 2. Compiler le projet (Frontend + Serveur)
# Cela génère un dossier /dist prêt pour la production
npm run build

# 3. Lancer le serveur
npm run start
```

---

## 5. Options d'Hébergement Recommandées

### Option A : Render.com (Recommandé 🔥)
Render est idéal car il gère automatiquement le build et le HTTPS.

1.  **Créez un "Web Service"** sur Render.
2.  **Connectez votre dépôt GitHub**.
3.  **Paramètres de Build & Start** :
    *   **Runtime** : `Node`
    *   **Build Command** : `npm install && npm run build`
    *   **Start Command** : `npm start`
4.  **Environment Variables** :
    *   Ajoutez toutes les variables listées dans la section 3 (PORT, JWT_SECRET, FIREBASE_SERVICE_ACCOUNT, etc.).
    *   Render injecte automatiquement un `PORT` (généralement 10000), le serveur est configuré pour l'écouter.

### Option B : VPS (Ubuntu, Debian + PM2)
C'est la méthode la plus flexible pour un contrôle total.
- Installez Node.js et PM2 : `npm install -g pm2`
- Compilez l'app : `npm run build`
- Lancez l'app : `pm2 start dist/server.cjs --name "dia-app"`
- Utilisez **Nginx** comme reverse proxy pour gérer le SSL (HTTPS) sur le port 80/443 vers le port 3000.

### Option C : Docker (Cloud Run, Railway)
L'application est prête pour Docker grâce au script de build qui génère un bundle unique.

**Dockerfile exemple** :
```dockerfile
FROM node:18-slim
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

---

## 6. Pourquoi utiliser le build "dist/server.cjs" ?
Nous utilisons `esbuild` pour transformer le serveur TypeScript en un seul fichier JavaScript robuste (`dist/server.cjs`). Cela résout les problèmes de chemins de fichiers et de modules ESM/CJS que l'on rencontre souvent lors du déploiement sur des serveurs Linux.

## 7. Maintenance et Mise à jour
Pour mettre à jour le code :
1. `git pull`
2. `npm install`
3. `npm run build`
4. Redémarrer le processus (Render le fait automatiquement à chaque "Deploy").

---

## 8. Sécurité Critique
- **Ne jamais** commiter votre fichier `.env` sur GitHub.
- Assurez-vous que les **Firestore Rules** (contenues dans `firestore.rules`) sont déployées via la console Firebase pour protéger vos données.

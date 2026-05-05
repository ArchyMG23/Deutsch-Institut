import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { createServer as createViteServer } from 'vite';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'dia-secret-key-2026';
const UPLOADS_DIR = path.join(process.cwd(), 'uploads');
const APP_NAME = process.env.APP_NAME || 'DIA DEUTSCH INSTITUT';

// Initialize Firebase Admin
let firebaseConfig: any = {};
try {
  const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  }
} catch (err) {
  console.warn("Could not read firebase-applet-config.json");
}

// Global Server Logs for diagnostics
const serverLogs: any[] = [];
function addLog(type: 'INFO' | 'ERROR' | 'AUTH', message: string, details?: any) {
  const log = {
    timestamp: new Date().toISOString(),
    type,
    message,
    details: details ? JSON.stringify(details) : undefined
  };
  serverLogs.push(log);
  if (serverLogs.length > 50) serverLogs.shift();
  console.log(`[${type}] ${message}`);
}

let isFirebaseAdminInitialized = false;
let authAdmin: admin.auth.Auth;
let dbAdmin: admin.firestore.Firestore;
let serviceAccountProjectId: string | null = null;

if (!admin.apps.length) {
  const serviceAccountVar = process.env.FIREBASE_SERVICE_ACCOUNT;
  let credential;

  if (serviceAccountVar) {
    try {
      const cleanedJson = serviceAccountVar.trim();
      const serviceAccount = JSON.parse(cleanedJson);
      serviceAccountProjectId = serviceAccount.project_id;
      
      // Fix for private key newline characters often mangled in env vars
      if (serviceAccount.private_key) {
        serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
      }
      
      credential = admin.credential.cert(serviceAccount);
      const app = admin.initializeApp({
        credential
      });
      isFirebaseAdminInitialized = true;
      authAdmin = admin.auth();
      
      // Use the specific database ID if provided, otherwise default
      const dbId = firebaseConfig.firestoreDatabaseId || process.env.FIREBASE_DATABASE_ID;
      dbAdmin = dbId ? getFirestore(app, dbId) : getFirestore(app);
      dbAdmin.settings({ ignoreUndefinedProperties: true });
      
      console.log(`✅ Firebase Admin: Initialisé avec succès (Database: ${dbId || '(default)'}).`);
      addLog('INFO', `Firebase Admin initialisé pour le projet: ${serviceAccountProjectId}`);
    } catch (err: any) {
      console.error("❌ Firebase Admin: Erreur lors du parsing de FIREBASE_SERVICE_ACCOUNT:", err);
      addLog('ERROR', "Erreur initialisation Firebase Admin", err.message);
    }
  } else {
    console.warn("⚠️ Firebase Admin: FIREBASE_SERVICE_ACCOUNT manquant. Les fonctions d'administration seront désactivées.");
  }
} else {
  isFirebaseAdminInitialized = true;
  authAdmin = admin.auth();
  const dbId = firebaseConfig.firestoreDatabaseId || process.env.FIREBASE_DATABASE_ID;
  dbAdmin = dbId ? getFirestore(admin.app(), dbId) : getFirestore(admin.app());
  dbAdmin.settings({ ignoreUndefinedProperties: true });
}

// Push Notifications
async function sendPushNotification(tokens: string[], title: string, body: string, data: any = {}) {
  if (!isFirebaseAdminInitialized || tokens.length === 0) return;
  
  try {
    const messaging = admin.messaging();
    const response = await messaging.sendEachForMulticast({
      tokens,
      notification: {
        title,
        body,
      },
      data: {
        ...data,
      },
    });
    addLog('INFO', `Push notifications envoyées (${response.successCount} succès, ${response.failureCount} échecs)`);
  } catch (err: any) {
    addLog('ERROR', `Échec de l'envoi des notifications push`, err.message);
  }
}

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR);
}

// Multer Config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync(UPLOADS_DIR)) {
      fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    }
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 1024 * 1024 * 1024 } // 1GB
});

const memoryUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 } // 2MB for profile photos
});

// ... (initialData removed as we use Firestore)

async function startServer() {
  const app = express();

  // Bootstrap Levels if empty
  if (isFirebaseAdminInitialized) {
    try {
      const levelsSnapshot = await dbAdmin.collection('levels').get();
      if (levelsSnapshot.empty) {
        console.log("Bootstrapping levels...");
        const initialLevels = [
          { id: 'a1_de', name: 'A1 (Allemand)', stream: 'Allemand', tuition: 110000, hours: 120 },
          { id: 'a2_de', name: 'A2 (Allemand)', stream: 'Allemand', tuition: 110000, hours: 120 },
          { id: 'b1_de', name: 'B1 (Allemand)', stream: 'Allemand', tuition: 120000, hours: 160 },
          { id: 'b2_de', name: 'B2 (Allemand)', stream: 'Allemand', tuition: 120000, hours: 180 },
          { id: 'c1_de', name: 'C1 (Allemand)', stream: 'Allemand', tuition: 130000, hours: 200 },
          { id: 'a1_en', name: 'A1 (Anglais)', stream: 'Anglais', tuition: 110000, hours: 120 },
          { id: 'a2_en', name: 'A2 (Anglais)', stream: 'Anglais', tuition: 110000, hours: 120 },
          { id: 'b1_en', name: 'B1 (Anglais)', stream: 'Anglais', tuition: 120000, hours: 160 },
          { id: 'vorbereitung', name: 'Vorbereitung', stream: 'Allemand', tuition: 50000, hours: 60 }
        ];
        // Enforce definitively
        for (const level of initialLevels) {
          await dbAdmin.collection('levels').doc(level.id).set(level, { merge: true });
        }
        console.log("Levels updated definitively.");
      } else {
        // Even if not empty, ensure the specified ones are correct
        const forcedLevels = [
          { id: 'a1_de', name: 'A1 (Allemand)', stream: 'Allemand', tuition: 110000 },
          { id: 'a2_de', name: 'A2 (Allemand)', stream: 'Allemand', tuition: 110000 },
          { id: 'b1_de', name: 'B1 (Allemand)', stream: 'Allemand', tuition: 120000 },
          { id: 'b2_de', name: 'B2 (Allemand)', stream: 'Allemand', tuition: 120000 },
          { id: 'c1_de', name: 'C1 (Allemand)', stream: 'Allemand', tuition: 130000 },
          { id: 'a1_en', name: 'A1 (Anglais)', stream: 'Anglais', tuition: 110000 },
          { id: 'a2_en', name: 'A2 (Anglais)', stream: 'Anglais', tuition: 110000 },
          { id: 'b1_en', name: 'B1 (Anglais)', stream: 'Anglais', tuition: 120000 },
          { id: 'vorbereitung', name: 'Vorbereitung', stream: 'Allemand', tuition: 50000 }
        ];
        for (const level of forcedLevels) {
          await dbAdmin.collection('levels').doc(level.id).set(level, { merge: true });
        }
      }

      // Bootstrap Admins
      const admins = [
        { email: 'yombivictor@gmail.com', firstName: 'Victor', lastName: 'Yombi', matricule: 'SUPERADMIN', isSuperAdmin: true },
        { email: 'gabrielyombi311@gmail.com', firstName: 'Gabriel', lastName: 'Yombi', matricule: 'ADMIN_GABRIEL', isSuperAdmin: true }
      ];

      for (const adminData of admins) {
        try {
          let userRecord;
          try {
            userRecord = await authAdmin.getUserByEmail(adminData.email);
            console.log(`Admin ${adminData.email} already exists in Auth.`);
          } catch (e) {
            userRecord = await authAdmin.createUser({
              email: adminData.email,
              password: 'Admin.1234',
              displayName: `${adminData.firstName} ${adminData.lastName}`
            });
            console.log(`Admin ${adminData.email} created in Auth.`);
          }

          const userDoc = await dbAdmin.collection('users').doc(userRecord.uid).get();
          if (!userDoc.exists || userDoc.data()?.role !== 'admin') {
            await dbAdmin.collection('users').doc(userRecord.uid).set({
              uid: userRecord.uid,
              matricule: adminData.matricule,
              email: adminData.email,
              role: 'admin',
              isSuperAdmin: adminData.isSuperAdmin,
              firstName: adminData.firstName,
              lastName: adminData.lastName,
              status: 'offline',
              createdAt: new Date().toISOString()
            }, { merge: true });
            console.log(`Admin profile for ${adminData.email} updated in Firestore.`);
          }
        } catch (err) {
          console.error(`Error bootstrapping admin ${adminData.email}:`, err);
        }
      }
    } catch (err) {
      console.error("Error during server bootstrap:", err);
    }
  } else {
    console.warn("Skipping bootstrap: Firebase Admin not initialized.");
  }

  app.use(cors());
  app.use(express.json({ limit: '50mb' }));
  app.use(cookieParser());
  
  // Optimized static serving with caching for mobile networks (MTN/Orange)
  app.use('/uploads', express.static(UPLOADS_DIR, {
    maxAge: '1d',
    immutable: true
  }));

  // Auth Middleware
  const authenticate = async (req: any, res: any, next: any) => {
    const token = req.headers.authorization?.split(' ')[1] || req.cookies.token;
    
    if (!token) {
      return res.status(401).json({ message: 'Non authentifié' });
    }

    try {
      if (isFirebaseAdminInitialized) {
        // Verify Firebase ID Token
        const decodedToken = await authAdmin.verifyIdToken(token);
        req.user = {
          id: decodedToken.uid,
          email: decodedToken.email,
          role: decodedToken.role || 'user'
        };
        
        // Fetch missing info from Firestore if needed
        if (!req.user.email || !decodedToken.role) {
          const userDoc = await dbAdmin.collection('users').doc(decodedToken.uid).get();
          if (userDoc.exists) {
            const userData = userDoc.data();
            if (!req.user.email) req.user.email = userData?.email;
            if (req.user.role === 'user') req.user.role = userData?.role || 'user';
          }
        }
        
        return next();
      } else {
        console.warn("[AUTH] Firebase Admin not initialized. Falling back to JWT verification.");
        // Fallback to JWT if Firebase Admin is not available (for local dev without service account)
        const decoded = jwt.verify(token, JWT_SECRET) as any;
        req.user = decoded;
        return next();
      }
    } catch (err: any) {
      console.error(`[AUTH] Invalid token or error:`, err.message);
      if (err.code === 'auth/id-token-expired') {
        return res.status(401).json({ message: 'Session expirée. Veuillez vous reconnecter.' });
      }
      res.status(401).json({ message: 'Authentification échouée: ' + err.message });
    }
  };

  // Health Check
  app.get('/health', (req, res) => {
    res.json({ 
      status: 'ok', 
      env: process.env.NODE_ENV,
      firebase: admin.apps.length > 0 ? 'initialized' : 'not initialized',
      timestamp: new Date().toISOString()
    });
  });

  app.get('/api/health/config', authenticate, (req: any, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Interdit' });
    
    res.json({
      firebaseAdmin: isFirebaseAdminInitialized,
      serviceAccountProjectId,
      configProjectId: firebaseConfig.projectId
    });
  });

  app.get('/api/admin/logs', authenticate, (req: any, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Interdit' });
    res.json({ logs: serverLogs });
  });

  // Password Validation Utility
  const validatePassword = (password: string) => {
    const minLength = 6;
    const hasUppercase = /[A-Z]/.test(password);
    const hasDot = /\./.test(password);
    const hasDigit = /\d/.test(password);

    if (password.length < minLength) return { isValid: false, message: "Le mot de passe doit contenir au moins 6 caractères." };
    if (!hasUppercase) return { isValid: false, message: "Le mot de passe doit contenir au moins une majuscule." };
    if (!hasDot) return { isValid: false, message: "Le mot de passe doit contenir au moins un point (.)." };
    if (!hasDigit) return { isValid: false, message: "Le mot de passe doit contenir au moins un chiffre." };

    return { isValid: true, message: "" };
  };

  // Auth Routes
  app.post('/api/auth/login', async (req, res) => {
    const { matricule, password } = req.body;
    addLog('AUTH', `Tentative de connexion pour: ${matricule}`);
    
    if (!isFirebaseAdminInitialized) {
      addLog('ERROR', "Login: Firebase Admin non initialisé");
      return res.status(503).json({ message: 'Service temporairement indisponible (Firebase non initialisé)' });
    }

    try {
      // Look up user by matricule in Firestore
      const userQuery = await dbAdmin.collection('users').where('matricule', '==', matricule.toUpperCase()).get();
      let userDoc = userQuery.docs[0];
      
      if (!userDoc) {
        const emailQuery = await dbAdmin.collection('users').where('email', '==', matricule.toLowerCase()).get();
        userDoc = emailQuery.docs[0];
      }

      if (!userDoc) {
        addLog('AUTH', `Aucun profil trouvé pour: ${matricule}`);
        return res.status(401).json({ message: 'Identifiants incorrects' });
      }

      const userData = userDoc.data();
      addLog('AUTH', `Profil trouvé pour ${matricule}`);
      res.json({ 
        email: userData.email, 
        role: userData.role,
        uid: userDoc.id 
      });
    } catch (err: any) {
      addLog('ERROR', `Erreur lors du login/lookup pour ${matricule}`, err.message);
      res.status(500).json({ message: err.message });
    }
  });

  app.post('/api/notifications/send-push', authenticate, async (req: any, res) => {
    const { to, pushTitle, pushBody } = req.body;
    if (!to || !pushTitle || !pushBody) return res.status(400).json({ message: 'Missing data' });

    try {
      if (isFirebaseAdminInitialized) {
        const usersRef = dbAdmin.collection('users');
        const snapshot = await usersRef.where('email', '==', to).get();
        if (!snapshot.empty) {
          const userDoc = snapshot.docs[0].data();
          if (userDoc.fcmToken) {
            await sendPushNotification([userDoc.fcmToken], pushTitle, pushBody);
          }
        }
      }
      res.json({ message: 'Push sent' });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post('/api/communiques', authenticate, async (req: any, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Seul l\'administrateur peut envoyer un communiqué' });
    
    const { title, content, targetRoles } = req.body;
    if (!title || !content || !targetRoles || !Array.isArray(targetRoles)) {
      return res.status(400).json({ message: 'Données de communiqué invalides' });
    }

    try {
      const createdAt = new Date().toISOString();
      const communique = {
        title,
        content,
        targetRoles,
        authorId: req.user.uid,
        authorName: req.user.name || 'Admin',
        createdAt,
        isArchived: false
      };

      const docRef = await dbAdmin.collection('communiques').add(communique);
      
      // Distribute notification asynchronously
      // 1. Fetch target users
      const usersRef = dbAdmin.collection('users');
      let query = usersRef.where('role', 'in', targetRoles);
      const snapshot = await query.get();
      
      const tokens: string[] = [];
      
      snapshot.forEach(doc => {
        const data = doc.data();
        if (data.fcmToken) tokens.push(data.fcmToken);
      });

      // 2. Send Push
      if (tokens.length > 0) {
        sendPushNotification(tokens, `Communiqué: ${title}`, content, { type: 'communique', id: docRef.id });
      }

      res.json({ id: docRef.id, message: 'Communiqué créé et distribué via Push' });
    } catch (err: any) {
      console.error("Communique creation error:", err);
      res.status(500).json({ message: err.message });
    }
  });

  app.post('/api/admin/check-user', authenticate, async (req: any, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Interdit' });
    const { matricule } = req.body;
    
    try {
      const userQuery = await dbAdmin.collection('users').where('matricule', '==', matricule.toUpperCase()).get();
      if (userQuery.empty) {
        // Try email
        const emailQuery = await dbAdmin.collection('users').where('email', '==', matricule.toLowerCase()).get();
        if (emailQuery.empty) {
          return res.json({ exists: false, message: "Utilisateur introuvable." });
        }
        return res.json({ exists: true, user: emailQuery.docs[0].data() });
      }
      return res.json({ exists: true, user: userQuery.docs[0].data() });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Admins Management API (Super Admin only for management, admins can see)
  app.get('/api/admins', authenticate, async (req: any, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Interdit' });
    try {
      const snapshot = await dbAdmin.collection('users').where('role', '==', 'admin').get();
      const admins = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      res.json(admins);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post('/api/admins', authenticate, async (req: any, res) => {
    // Only admins can create other admins
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Droits insuffisants' });
    }

    const { email, password, firstName, lastName, matricule, phone } = req.body;
    
    try {
      const userRecord = await authAdmin.createUser({
        email,
        password: password || 'Admin.1234',
        displayName: `${firstName} ${lastName}`,
        phoneNumber: phone || undefined,
      });

      const newAdmin = {
        uid: userRecord.uid,
        email,
        firstName,
        lastName,
        matricule: matricule.toUpperCase(),
        phone: phone || '',
        role: 'admin',
        isSuperAdmin: false,
        status: 'offline',
        createdAt: new Date().toISOString()
      };

      await dbAdmin.collection('users').doc(userRecord.uid).set(newAdmin);
      res.json(newAdmin);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.put('/api/admins/:id', authenticate, async (req: any, res) => {
    try {
      const currentUserDoc = await dbAdmin.collection('users').doc(req.user.id).get();
      const userData = currentUserDoc.data();
      const isSuperAdmin = userData?.isSuperAdmin || 
                         req.user.email === 'yombivictor@gmail.com' || 
                         req.user.email === 'gabrielyombi311@gmail.com';

      if (!isSuperAdmin) {
        return res.status(403).json({ message: 'Seul le Super Administrateur peut modifier d\'autres administrateurs' });
      }

      const { firstName, lastName, matricule, phone, isSuperAdmin: promoteToSuper } = req.body;
      
      const updateData: any = {};
      if (firstName) updateData.firstName = firstName;
      if (lastName) updateData.lastName = lastName;
      if (matricule) updateData.matricule = matricule.toUpperCase();
      if (phone !== undefined) updateData.phone = phone;
      if (promoteToSuper !== undefined) updateData.isSuperAdmin = promoteToSuper;

      await dbAdmin.collection('users').doc(req.params.id).update(updateData);
      
      // Update auth as well
      const authUpdate: any = {};
      if (firstName && lastName) authUpdate.displayName = `${firstName} ${lastName}`;
      if (phone) authUpdate.phoneNumber = phone;
      
      if (Object.keys(authUpdate).length > 0) {
        await authAdmin.updateUser(req.params.id, authUpdate);
      }

      res.json({ message: 'Administrateur mis à jour' });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete('/api/admins/:id', authenticate, async (req: any, res) => {
    try {
      const currentUserDoc = await dbAdmin.collection('users').doc(req.user.id).get();
      const userData = currentUserDoc.data();
      const isSuperAdmin = userData?.isSuperAdmin || 
                         req.user.email === 'yombivictor@gmail.com' || 
                         req.user.email === 'gabrielyombi311@gmail.com';

      if (!isSuperAdmin) {
        return res.status(403).json({ message: 'Seul le Super Administrateur peut supprimer d\'autres administrateurs' });
      }

      const targetUserDoc = await dbAdmin.collection('users').doc(req.params.id).get();
      if (targetUserDoc.exists && targetUserDoc.data()?.isSuperAdmin) {
        return res.status(403).json({ message: 'Impossible de supprimer un Super Administrateur' });
      }

      await authAdmin.deleteUser(req.params.id);
      await dbAdmin.collection('users').doc(req.params.id).delete();
      res.json({ message: 'Administrateur supprimé' });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // --- SYSTEM RESET (DANGER ZONE) ---
  app.post('/api/system/reset', authenticate, async (req: any, res) => {
    try {
      const currentUserDoc = await dbAdmin.collection('users').doc(req.user.id).get();
      const userData = currentUserDoc.data();
      
      const isSuperAdmin = userData?.isSuperAdmin || 
                         req.user.email === 'yombivictor@gmail.com' || 
                         req.user.email === 'gabrielyombi311@gmail.com';

      if (!isSuperAdmin) {
        return res.status(403).json({ message: 'Seul le Super Administrateur peut réinitialiser le système' });
      }

      const { confirmation } = req.body;
      if (confirmation !== 'RESET_FACTORY') {
        return res.status(400).json({ message: 'Code de confirmation incorrect (Attendu: RESET_FACTORY)' });
      }

      const collectionsToClear = [
        'finances', 'charges', 'scolarites', 'classes', 'niveaux', 
        'rapports_journaliers', 'communiques', 'evaluations', 
        'chat_eleves', 'logs', 'notifications', 'library', 'teachers', 'rooms',
        'students', 'levels', 'exams', 'messages', 'attendances', 'system',
        'inscriptions', 'receptions'
      ];

      addLog('INFO', `Démarrage de la réinitialisation système par ${userData?.email}`);

      // 1. Delete all documents in collections
      for (const collName of collectionsToClear) {
        try {
          const snapshot = await dbAdmin.collection(collName).get();
          if (snapshot.empty) continue;

          const docs = snapshot.docs;
          for (let i = 0; i < docs.length; i += 500) {
            const batch = dbAdmin.batch();
            const chunk = docs.slice(i, i + 500);
            chunk.forEach(doc => batch.delete(doc.ref));
            await batch.commit();
          }
          addLog('INFO', `Collection ${collName} vidée`);
        } catch (e: any) {
          console.error(`Erreur vidage collection ${collName}:`, e.message);
        }
      }

      // 2. Delete ALL Auth Users except super-admins
      const defaultEmails = ['yombivictor@gmail.com', 'gabrielyombi311@gmail.com'];
      
      const listAndDeleteUsers = async (nextPageToken?: string) => {
        const listUsersResult = await authAdmin.listUsers(1000, nextPageToken);
        for (const userRecord of listUsersResult.users) {
          const email = (userRecord.email || '').toLowerCase();
          const isSuper = defaultEmails.some(de => de.toLowerCase() === email);
          
          if (!isSuper) {
            try {
              await authAdmin.deleteUser(userRecord.uid);
            } catch (e: any) {
              console.error(`Erreur suppression Auth pour ${userRecord.email}:`, e.message);
            }
          }
        }
        if (listUsersResult.pageToken) {
          await listAndDeleteUsers(listUsersResult.pageToken);
        }
      };

      await listAndDeleteUsers();
      addLog('INFO', `Utilisateurs Auth (sauf super-admins) supprimés`);

      // 3. Clear Users collection in Firestore
      const usersSnap = await dbAdmin.collection('users').get();
      let userBatch = dbAdmin.batch();
      let userCount = 0;
      for (const userDoc of usersSnap.docs) {
        const u = userDoc.data();
        const email = (u.email || '').toLowerCase();
        const isSuper = defaultEmails.some(de => de.toLowerCase() === email) || u.isSuperAdmin === true;
        
        if (!isSuper) {
          userBatch.delete(userDoc.ref);
          userCount++;
          if (userCount >= 400) {
            await userBatch.commit();
            userBatch = dbAdmin.batch();
            userCount = 0;
          }
        }
      }
      await userBatch.commit();
      addLog('INFO', `Profils Firestore (sauf super-admins) supprimés`);

      // 4. Ensure Super Admins Firestore Profiles
      const defaultAdmins = [
        { email: 'yombivictor@gmail.com', firstName: 'Victor', lastName: 'Yombi', matricule: 'SUPERADMIN', isSuperAdmin: true },
        { email: 'gabrielyombi311@gmail.com', firstName: 'Gabriel', lastName: 'Yombi', matricule: 'ADMIN_GABRIEL', isSuperAdmin: true }
      ];

      for (const adminData of defaultAdmins) {
        try {
          const userRec = await authAdmin.getUserByEmail(adminData.email).catch(() => null);
          if (userRec) {
            await dbAdmin.collection('users').doc(userRec.uid).set({
              uid: userRec.uid,
              ...adminData,
              role: 'admin',
              status: 'offline',
              createdAt: new Date().toISOString()
            }, { merge: true });
          }
        } catch (err: any) {
          console.error(`Error bootstrapping admin ${adminData.email}:`, err.message);
        }
      }

      res.json({ message: 'Système réinitialisé avec succès. Les collections Firestore et les comptes Firebase Auth ont été nettoyés.' });
    } catch (err: any) {
      addLog('ERROR', 'System Reset Error', err.message);
      res.status(500).json({ message: err.message });
    }
  });

  // Targeted cleanup: Delete data before a specific date
  app.post('/api/system/cleanup', authenticate, async (req: any, res) => {
    try {
      const currentUserDoc = await dbAdmin.collection('users').doc(req.user.id).get();
      const userData = currentUserDoc.data();
      
      const isSuperAdmin = userData?.role === 'admin' || 
                         userData?.isSuperAdmin === true ||
                         req.user.role === 'admin' ||
                         req.user.email === 'yombivictor@gmail.com' || 
                         req.user.email === 'gabrielyombi311@gmail.com';

      if (!isSuperAdmin) {
        addLog('AUTH', `Blocked cleanup attempt from ${req.user.email}`);
        return res.status(403).json({ message: 'Interdit: Droits super-administrateur requis' });
      }

      const { beforeDate, forceAll } = req.body;
      const targetDate = beforeDate ? new Date(beforeDate) : new Date();
      targetDate.setHours(0, 0, 0, 0); // Start of today

      const collectionsToCleanup = [
        'finances', 'rapports_journaliers', 'evaluations', 
        'chat_eleves', 'logs', 'notifications', 'messages', 'attendances',
        'rapports_journaliers', 'logs'
      ];

      addLog('INFO', `Cleanup started: deleting records ${forceAll ? 'ALL' : 'before ' + targetDate.toISOString()}`);

      // Delete records
      for (const collName of collectionsToCleanup) {
        let snapshot;
        try {
          snapshot = await dbAdmin.collection(collName).get();
        } catch (e) { continue; }
        
        if (snapshot.empty) continue;

        let batch = dbAdmin.batch();
        let count = 0;
        let batchCount = 0;
        
        for (const doc of snapshot.docs) {
          const data = doc.data();
          const recordDate = data.createdAt || data.date || data.addedAt || data.timestamp || data.addedBy;
          let shouldDelete = forceAll === true;
          
          if (!shouldDelete && recordDate) {
            const d = new Date(recordDate);
            if (d < targetDate) {
              shouldDelete = true;
            }
          }

          if (shouldDelete) {
            batch.delete(doc.ref);
            count++;
            batchCount++;
            
            if (batchCount >= 450) {
              await batch.commit();
              batch = dbAdmin.batch();
              batchCount = 0;
            }
          }
        }

        if (batchCount > 0) {
          await batch.commit();
          addLog('INFO', `Cleaned up ${count} records from ${collName}`);
        }
      }

      // Special handling for scolarites
      const scolaritesSnap = await dbAdmin.collection('scolarites').get();
      for (const studentScolaDoc of scolaritesSnap.docs) {
        const versementsSnap = await studentScolaDoc.ref.collection('versements').get();
        let vBatch = dbAdmin.batch();
        let vCount = 0;
        let vBatchCount = 0;
        
        for (const vDoc of versementsSnap.docs) {
          const vData = vDoc.data();
          const vDate = vData.date || vData.createdAt;
          let shouldDeleteV = forceAll === true;
          
          if (!shouldDeleteV && vDate) {
            const d = new Date(vDate);
            if (d < targetDate) {
              shouldDeleteV = true;
            }
          }

          if (shouldDeleteV) {
            vBatch.delete(vDoc.ref);
            vCount++;
            vBatchCount++;
            
            if (vBatchCount >= 450) {
              await vBatch.commit();
              vBatch = dbAdmin.batch();
              vBatchCount = 0;
            }
          }
        }
        
        if (vBatchCount > 0) {
          await vBatch.commit();
        }
        
        // Recalculate student scolarite totals
        const remainingVersements = await studentScolaDoc.ref.collection('versements').get();
        const newTotal = remainingVersements.docs.reduce((acc, d) => acc + (Number(d.data().montant) || 0), 0);
        const scolaData = studentScolaDoc.data();
        const tuition = Number(scolaData.montant_total_du) || 0;
        
        await studentScolaDoc.ref.update({
          total_verse: newTotal,
          reste: Math.max(0, tuition - newTotal),
          surplus: Math.max(0, newTotal - tuition),
          statut_paiement: newTotal >= tuition ? 'SOLDÉ' : (newTotal > 0 ? 'EN COURS' : 'NON PAYÉ')
        });
      }

      // Clean up user/student payments
      const usersSnap = await dbAdmin.collection('users').where('role', '==', 'student').get();
      for (const userDoc of usersSnap.docs) {
        const uData = userDoc.data();
        if (uData.payments && Array.isArray(uData.payments)) {
          let updatedPayments = uData.payments;
          if (forceAll) {
            updatedPayments = [
              { tranche: 1, amount: 0, date: null },
              { tranche: 2, amount: 0, date: null },
              { tranche: 3, amount: 0, date: null }
            ];
          } else {
            updatedPayments = uData.payments.map((p: any) => {
               const pDate = p.date ? new Date(p.date) : new Date();
               if (pDate < targetDate) return { ...p, amount: 0, date: null };
               return p;
            });
          }
          await userDoc.ref.update({ payments: updatedPayments });
          
          const sDoc = await dbAdmin.collection('students').doc(userDoc.id).get();
          if (sDoc.exists) {
            await sDoc.ref.update({ payments: updatedPayments });
          }
        }
      }

      res.json({ 
        message: forceAll 
          ? 'Base de données remise à zéro avec succès (Finances et Versements).' 
          : 'Nettoyage terminé. Les données anciennes ont été supprimées.' 
      });
    } catch (err: any) {
      addLog('ERROR', 'Cleanup failure', err.message);
      res.status(500).json({ message: err.message });
    }
  });

  app.get('/api/auth/me', authenticate, async (req: any, res) => {
    try {
      const userDoc = await dbAdmin.collection('users').doc(req.user.id).get();
      if (!userDoc.exists) return res.status(404).json({ message: 'Utilisateur non trouvé' });
      
      const userData = userDoc.data();
      let fullProfile = { ...userData };
      
      if (userData?.role === 'student') {
        const studentDoc = await dbAdmin.collection('students').doc(req.user.id).get();
        if (studentDoc.exists) fullProfile = { ...studentDoc.data(), ...fullProfile };
      } else if (userData?.role === 'teacher') {
        const teacherDoc = await dbAdmin.collection('teachers').doc(req.user.id).get();
        if (teacherDoc.exists) fullProfile = { ...teacherDoc.data(), ...fullProfile };
      }

      res.json({ ...fullProfile, uid: req.user.id });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post('/api/auth/logout', (req, res) => {
    res.clearCookie('token');
    res.json({ message: 'Déconnecté' });
  });

  // Students API
  app.get('/api/students', authenticate, async (req, res) => {
    try {
      const snapshot = await dbAdmin.collection('students').get();
      const students = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      res.json(students);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post('/api/students', authenticate, async (req, res) => {
    const { password, ...studentData } = req.body;
    
    const passValidation = validatePassword(password || 'DIA2026.');
    if (!passValidation.isValid) {
      return res.status(400).json({ message: passValidation.message });
    }

    try {
      // Check if matricule already exists in users collection
      const existingUser = await dbAdmin.collection('users').where('matricule', '==', studentData.matricule).get();
      if (!existingUser.empty) {
        return res.status(400).json({ message: "Ce matricule est déjà utilisé par un autre utilisateur." });
      }

      // Create User in Firebase Auth
      const userRecord = await authAdmin.createUser({
        email: studentData.email,
        password: password || 'DIA2026.',
        displayName: `${studentData.firstName} ${studentData.lastName}`,
      });

      const newStudent = { 
        ...studentData, 
        id: userRecord.uid,
        payments: studentData.payments || [
          { tranche: 1, amount: 0, date: null },
          { tranche: 2, amount: 0, date: null },
          { tranche: 3, amount: 0, date: null }
        ]
      };

      // Create User Profile in Firestore
      const newUser = {
        uid: userRecord.uid,
        matricule: newStudent.matricule,
        email: newStudent.email,
        role: 'student',
        firstName: newStudent.firstName,
        lastName: newStudent.lastName,
        status: 'offline',
        createdAt: new Date().toISOString()
      };

      await dbAdmin.collection('users').doc(userRecord.uid).set(newUser);
      await dbAdmin.collection('students').doc(userRecord.uid).set(newStudent);

      // --- ATOMIC FINANCIAL SYNC ---
      const initialAmount = (newStudent.payments || []).reduce((acc: number, p: any) => acc + (Number(p.amount) || 0), 0);
      const inscriptionAmount = Number(req.body.inscriptionAmount) || 0;
      const vorbereitungAmount = Number(req.body.vorbereitungAmount) || 0;
      const totalInitial = initialAmount + inscriptionAmount + vorbereitungAmount;
      
      try {
        let tuitionTotal = 0;
        if (req.body.totalTuition !== undefined && req.body.totalTuition !== '') {
          tuitionTotal = Number(req.body.totalTuition);
          const includeInscription = Number(req.body.inscriptionAmount) > 0;
          tuitionTotal = Number(req.body.totalTuition) + (includeInscription ? 10000 : 0);
        } else {
          // Fetch tuition info from levels
          const levelDoc = await dbAdmin.collection('levels').doc(studentData.levelId || 'a1').get();
          let baseTuition = levelDoc.exists ? (levelDoc.data()?.tuition || 150000) : 150000;
          
          // Add Standard Registration fee (10,000) to total due
          tuitionTotal = baseTuition + 10000;
        }

        // Create main Tuition record
        await dbAdmin.collection('scolarites').doc(userRecord.uid).set({
          id: userRecord.uid,
          eleve_id: userRecord.uid,
          matricule: newStudent.matricule,
          nom_eleve: `${newStudent.firstName} ${newStudent.lastName}`,
          classe_id: newStudent.classId || 'N/A',
          montant_total_du: tuitionTotal,
          total_verse: totalInitial,
          reste: Math.max(0, tuitionTotal - totalInitial),
          surplus: Math.max(0, totalInitial - tuitionTotal),
          statut_paiement: totalInitial >= tuitionTotal ? 'SOLDÉ' : (totalInitial > 0 ? 'EN COURS' : 'NON PAYÉ')
        });

        // Record Inscription if any
        if (inscriptionAmount > 0) {
          const financeId = 'INS-' + Date.now().toString();
          await dbAdmin.collection('finances').doc(financeId).set({
            id: financeId,
            type: 'income',
            amount: inscriptionAmount,
            description: `Inscription - ${newStudent.matricule} - ${newStudent.firstName}`,
            category: 'registration',
            date: new Date().toISOString()
          });
          await dbAdmin.collection('scolarites').doc(userRecord.uid).collection('versements').add({
            montant: inscriptionAmount,
            date: new Date().toISOString(),
            mode_paiement: 'Espèces',
            categorie: 'inscription',
            recu_numero: `INS-${Date.now().toString().slice(-6)}`,
            caissier_id: (req as any).user?.id || 'System',
            notes: 'Frais d\'inscription initial'
          });
        }

        // Record Vorbereitung if any
        if (vorbereitungAmount > 0) {
          const financeId = 'VOR-' + Date.now().toString();
          await dbAdmin.collection('finances').doc(financeId).set({
            id: financeId,
            type: 'income',
            amount: vorbereitungAmount,
            description: `Vorbereitung - ${newStudent.matricule} - ${newStudent.firstName}`,
            category: 'tuition',
            date: new Date().toISOString()
          });
          await dbAdmin.collection('scolarites').doc(userRecord.uid).collection('versements').add({
            montant: vorbereitungAmount,
            date: new Date().toISOString(),
            mode_paiement: 'Espèces',
            categorie: 'vorbereitung',
            recu_numero: `VOR-${Date.now().toString().slice(-6)}`,
            caissier_id: (req as any).user?.id || 'System',
            notes: 'Frais Vorbereitung initial'
          });
        }

        // Record initial payments in finances & subcollection
        if (newStudent.payments) {
          for (const p of newStudent.payments) {
            if (p.amount > 0) {
              const financeId = Date.now().toString() + Math.random().toString(36).substr(2, 5);
              const txDate = p.date || new Date().toISOString();
              
      // 1. General Finance Record
              const financeRecord = {
                id: financeId,
                type: 'income',
                amount: p.amount,
                description: `Paiement Scolarité - ${newStudent.matricule} - ${newStudent.firstName} (Tranche ${p.tranche})`,
                category: 'tuition',
                date: txDate
              };
              await dbAdmin.collection('finances').doc(financeId).set(financeRecord);

              // 2. Detailed Versement subcollection
              await dbAdmin.collection('scolarites').doc(userRecord.uid).collection('versements').add({
                montant: p.amount,
                date: txDate,
                mode_paiement: 'Espèces',
                categorie: 'scolarite',
                recu_numero: `SCO-${Date.now().toString().slice(-6)}`,
                caissier_id: (req as any).user?.id || 'System',
                notes: 'Enregistré via inscription rapide'
              });
            }
          }
        }
      } catch (finErr) {
        console.error("Non-blocking error during initial financial sync:", finErr);
      }
      
      console.log(`[BOOTSTRAP] Student created: ${studentData.matricule} with total paid: ${initialAmount}`);
      
      res.json(newStudent);
    } catch (err: any) {
      console.error("Error creating student in Firebase:", err);
      if (err.code === 'auth/operation-not-allowed') {
        return res.status(500).json({ 
          message: "L'authentification n'est pas activée dans votre console Firebase. Veuillez l'activer dans 'Authentication' > 'Sign-in method'." 
        });
      }
      if (err.code === 'auth/email-already-in-use') {
        return res.status(400).json({ message: "Cette adresse email est déjà utilisée par un autre compte." });
      }
      res.status(500).json({ message: err.message || "Erreur lors de la création de l'étudiant." });
    }
  });

  app.put('/api/students/:id', authenticate, async (req, res) => {
    const { password, ...studentData } = req.body;
    
    try {
      const studentRef = dbAdmin.collection('students').doc(req.params.id);
      const userRef = dbAdmin.collection('users').doc(req.params.id);
      
      const oldStudentDoc = await studentRef.get();
      if (!oldStudentDoc.exists) return res.status(404).send('Student not found');
      const oldStudent = oldStudentDoc.data() as any;

      await studentRef.set(studentData, { merge: true });
      await userRef.set({
        email: studentData.email,
        firstName: studentData.firstName,
        lastName: studentData.lastName,
      }, { merge: true });

      if (password || studentData.email || (studentData.firstName && studentData.lastName)) {
        const updateData: any = {};
        if (password) updateData.password = password;
        if (studentData.email) updateData.email = studentData.email;
        if (studentData.firstName && studentData.lastName) {
          updateData.displayName = `${studentData.firstName} ${studentData.lastName}`;
        }
        await authAdmin.updateUser(req.params.id, updateData);
      }

      // Handle finances if payments updated
      if (studentData.payments) {
        for (let i = 0; i < studentData.payments.length; i++) {
          const p = studentData.payments[i];
          const oldP = oldStudent.payments?.[i];
          const diff = p.amount - (oldP?.amount || 0);
          
          if (diff > 0 && p.date) {
            const financeId = Date.now().toString() + Math.random().toString(36).substr(2, 5);
            await dbAdmin.collection('finances').doc(financeId).set({
              id: financeId,
              type: 'income',
              amount: diff,
              description: `Scolarité - ${studentData.matricule} - Tranche ${p.tranche}`,
              category: 'Tuition',
              date: p.date
            });
          }
        }
      }

      res.json({ id: req.params.id, ...studentData });
    } catch (err: any) {
      console.error("Error updating student:", err);
      if (err.code === 'auth/email-already-in-use') {
        return res.status(400).json({ message: "Cette adresse email est déjà utilisée par un autre compte." });
      }
      res.status(500).json({ message: err.message || "Erreur lors de la mise à jour de l'étudiant." });
    }
  });

  app.delete('/api/students/:id', authenticate, async (req, res) => {
    try {
      await dbAdmin.collection('students').doc(req.params.id).delete();
      await dbAdmin.collection('users').doc(req.params.id).delete();
      await authAdmin.deleteUser(req.params.id);
      res.json({ message: 'L\'Étudiant et son compte utilisateur ont été définitivement supprimés.' });
    } catch (err: any) {
      console.error("Hard delete error:", err);
      res.status(500).json({ message: err.message });
    }
  });

  // Teachers API
  app.get('/api/teachers', authenticate, async (req, res) => {
    try {
      const snapshot = await dbAdmin.collection('teachers').get();
      const teachers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      res.json(teachers);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get('/api/teachers/me/classes', authenticate, async (req: any, res) => {
    try {
      const snapshot = await dbAdmin.collection('classes').where('teacherId', '==', req.user.id).get();
      const classes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      res.json(classes);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post('/api/teachers', authenticate, async (req, res) => {
    const { password, ...teacherData } = req.body;
    
    const passValidation = validatePassword(password || 'DIA2026.');
    if (!passValidation.isValid) {
      return res.status(400).json({ message: passValidation.message });
    }

    try {
      // Check if matricule already exists in users collection
      const existingUser = await dbAdmin.collection('users').where('matricule', '==', teacherData.matricule).get();
      if (!existingUser.empty) {
        return res.status(400).json({ message: "Ce matricule est déjà utilisé par un autre utilisateur." });
      }

      // Create User in Firebase Auth
      const userRecord = await authAdmin.createUser({
        email: teacherData.email,
        password: password || 'DIA2026.',
        displayName: `${teacherData.firstName} ${teacherData.lastName}`,
      });

      const newTeacher = { ...teacherData, id: userRecord.uid };

      // Create User Profile in Firestore
      const newUser = {
        uid: userRecord.uid,
        matricule: newTeacher.matricule,
        email: newTeacher.email,
        role: 'teacher',
        firstName: newTeacher.firstName,
        lastName: newTeacher.lastName,
        status: 'offline',
        createdAt: new Date().toISOString()
      };

      await dbAdmin.collection('users').doc(userRecord.uid).set(newUser);
      await dbAdmin.collection('teachers').doc(userRecord.uid).set(newTeacher);

      console.log(`[BOOTSTRAP] Teacher created: ${teacherData.matricule}. Credentials would be handle by client.`);

      res.json(newTeacher);
    } catch (err: any) {
      console.error("Error creating teacher in Firebase:", err);
      if (err.code === 'auth/operation-not-allowed') {
        return res.status(500).json({ 
          message: "L'authentification par identifiants n'est pas activée dans votre console Firebase. Veuillez l'activer dans 'Authentication' > 'Sign-in method'." 
        });
      }
      if (err.code === 'auth/email-already-in-use') {
        return res.status(400).json({ message: "Cette adresse email est déjà utilisée par un autre compte." });
      }
      res.status(500).json({ message: err.message || "Erreur lors de la création de l'enseignant." });
    }
  });

  app.put('/api/teachers/:id', authenticate, async (req, res) => {
    const { password, ...teacherData } = req.body;
    
    try {
      await dbAdmin.collection('teachers').doc(req.params.id).set(teacherData, { merge: true });
      await dbAdmin.collection('users').doc(req.params.id).set({
        email: teacherData.email,
        firstName: teacherData.firstName,
        lastName: teacherData.lastName,
      }, { merge: true });

      if (password || teacherData.email || (teacherData.firstName && teacherData.lastName)) {
        const updateData: any = {};
        if (password) updateData.password = password;
        if (teacherData.email) updateData.email = teacherData.email;
        if (teacherData.firstName && teacherData.lastName) {
          updateData.displayName = `${teacherData.firstName} ${teacherData.lastName}`;
        }
        await authAdmin.updateUser(req.params.id, updateData);
      }

      res.json({ id: req.params.id, ...teacherData });
    } catch (err: any) {
      console.error("Error updating teacher:", err);
      if (err.code === 'auth/email-already-in-use') {
        return res.status(400).json({ message: "Cette adresse email est déjà utilisée par un autre compte." });
      }
      res.status(500).json({ message: err.message || "Erreur lors de la mise à jour de l'enseignant." });
    }
  });

  app.put('/api/users/:id', authenticate, async (req: any, res) => {
    // Only admin can update other users, or user can update themselves
    if (req.user.role !== 'admin' && req.user.id !== req.params.id) {
      return res.status(403).json({ message: 'Interdit' });
    }

    try {
      await dbAdmin.collection('users').doc(req.params.id).set(req.body, { merge: true });
      
      // If updating email or name, update Auth as well
      if (req.body.email || (req.body.firstName && req.body.lastName)) {
        const updateData: any = {};
        if (req.body.email) updateData.email = req.body.email;
        if (req.body.firstName && req.body.lastName) {
          updateData.displayName = `${req.body.firstName} ${req.body.lastName}`;
        }
        await authAdmin.updateUser(req.params.id, updateData);
      }
      
      res.json({ message: 'Profil mis à jour' });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete('/api/teachers/:id', authenticate, async (req, res) => {
    try {
      await dbAdmin.collection('teachers').doc(req.params.id).delete();
      await dbAdmin.collection('users').doc(req.params.id).delete();
      await authAdmin.deleteUser(req.params.id);
      res.json({ message: 'Teacher and user account deleted' });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Classes API
  app.get('/api/classes', authenticate, async (req, res) => {
    try {
      const snapshot = await dbAdmin.collection('classes').get();
      const classes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      res.json(classes);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post('/api/classes', authenticate, async (req, res) => {
    try {
      const id = Date.now().toString();
      const newClass = { 
        ...req.body, 
        id,
        schedule: req.body.schedule || [],
        exams: req.body.exams || []
      };
      await dbAdmin.collection('classes').doc(id).set(newClass);
      res.json(newClass);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.put('/api/classes/:id', authenticate, async (req, res) => {
    try {
      await dbAdmin.collection('classes').doc(req.params.id).set(req.body, { merge: true });
      res.json({ id: req.params.id, ...req.body });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete('/api/classes/:id', authenticate, async (req, res) => {
    try {
      await dbAdmin.collection('classes').doc(req.params.id).delete();
      res.json({ message: 'Class deleted' });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Finances API
  app.get('/api/finances', authenticate, async (req: any, res: any) => {
    try {
      const { year, month } = req.query;
      let query: any = dbAdmin.collection('finances');
      
      // If we have filters, we could try to optimize on server side
      // For now, let's just make it faster by limiting if no filter
      // Or just fetch all but be aware of performance
      const snapshot = await query.get();
      
      let records = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
      
      // Filter out archived ones
      records = records.filter((f: any) => !f.deletedAt);
      
      // If year/month requested, filter on server to reduce payload size
      if (year) {
        records = records.filter((f: any) => {
          if (!f.date) return false;
          const d = new Date(f.date);
          return d.getFullYear().toString() === year;
        });
      }
      
      if (month && month !== 'all') {
        records = records.filter((f: any) => {
          if (!f.date) return false;
          const d = new Date(f.date);
          return d.getMonth().toString() === month;
        });
      }

      // Sort by date descending by default
      records.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());

      // Limit to 2000 records to prevent browser crash, most recent first
      if (records.length > 2000) {
        records = records.slice(0, 2000);
      }

      res.json(records);
    } catch (err: any) {
      console.error("Finance fetch error:", err);
      res.status(500).json({ message: err.message });
    }
  });

  app.get('/api/finances/trash', authenticate, async (req: any, res: any) => {
    try {
      const snapshot = await dbAdmin.collection('finances').get();
      const trash = snapshot.docs
        .map((doc: any) => ({ id: doc.id, ...doc.data() }))
        .filter((f: any) => !!f.deletedAt)
        .sort((a: any, b: any) => new Date(b.deletedAt || b.date).getTime() - new Date(a.deletedAt || a.date).getTime())
        .slice(0, 1000); // Limit trash too

      res.json(trash);
    } catch (err: any) {
      console.error("Trash fetch error:", err);
      res.status(500).json({ message: err.message });
    }
  });

  app.post('/api/finances', authenticate, async (req, res) => {
    try {
      const id = Date.now().toString();
      const newRecord = { ...req.body, id, date: req.body.date || new Date().toISOString() };
      await dbAdmin.collection('finances').doc(id).set(newRecord);
      res.json(newRecord);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post('/api/finances/:id/archive', authenticate, async (req: any, res) => {
    try {
      const { reason } = req.body;
      if (!reason) return res.status(400).json({ message: 'Raison requise' });
      
      const userDoc = await dbAdmin.collection('users').doc(req.user.id).get();
      const userData = userDoc.data();
      const deletedBy = `${userData?.firstName} ${userData?.lastName}`;

      await dbAdmin.collection('finances').doc(req.params.id).update({
        deletedAt: new Date().toISOString(),
        deletedBy: deletedBy,
        deletionReason: reason
      });
      res.json({ message: 'Transaction archivée' });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch('/api/finances/:id', authenticate, async (req: any, res: any) => {
    try {
      const { amount, description } = req.body;
      if (amount === undefined && !description) {
        return res.status(400).json({ message: 'Aucune donnée fournie' });
      }
      if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Interdit' });
      }
      const updateData: any = {};
      if (amount !== undefined) updateData.amount = Number(amount);
      if (description) updateData.description = description;
      await dbAdmin.collection('finances').doc(req.params.id).update(updateData);
      res.json({ message: 'Transaction mise à jour' });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete('/api/finances/:id', authenticate, async (req: any, res) => {
    try {
      // Permanent delete only if explicitly requested or just keep it archived
      // For now, let's just make the standard delete also move to trash if no reason provided
      const userDoc = await dbAdmin.collection('users').doc(req.user.id).get();
      const userData = userDoc.data();
      const deletedBy = `${userData?.firstName} ${userData?.lastName}`;

      await dbAdmin.collection('finances').doc(req.params.id).update({
        deletedAt: new Date().toISOString(),
        deletedBy: deletedBy,
        deletionReason: 'Suppression standard (sans raison précisée)'
      });
      res.json({ message: 'Finance record moved to trash' });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Library API
  app.get('/api/library', authenticate, async (req, res) => {
    try {
      const snapshot = await dbAdmin.collection('library').get();
      const library = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      res.json(library);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post('/api/library', authenticate, async (req, res) => {
    try {
      const id = Date.now().toString() + '-' + Math.random().toString(36).substring(2, 9);
      const newItem = { ...req.body, id, addedAt: new Date().toISOString() };
      await dbAdmin.collection('library').doc(id).set(newItem);
      res.json(newItem);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post('/api/library/upload', authenticate, upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ message: 'Aucun fichier téléchargé' });
    
    try {
      const id = Date.now().toString() + '-' + Math.random().toString(36).substring(2, 9);
      const newItem = {
        id,
        title: req.body.title || req.file.originalname,
        category: req.body.category || 'Autre',
        type: req.body.type || 'document',
        url: `/uploads/${req.file.filename}`,
        addedAt: new Date().toISOString(),
        fileName: req.file.originalname,
        fileSize: req.file.size
      };
      
      await dbAdmin.collection('library').doc(id).set(newItem);
      res.json(newItem);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete('/api/library/:id', authenticate, async (req, res) => {
    try {
      await dbAdmin.collection('library').doc(req.params.id).delete();
      res.json({ message: 'Library item deleted' });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Levels API
  app.get('/api/levels', authenticate, async (req, res) => {
    try {
      const snapshot = await dbAdmin.collection('levels').get();
      const levels = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      res.json(levels);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post('/api/levels', authenticate, async (req, res) => {
    try {
      const id = Date.now().toString();
      const newLevel = { ...req.body, id };
      await dbAdmin.collection('levels').doc(id).set(newLevel);
      res.json(newLevel);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.put('/api/levels/:id', authenticate, async (req, res) => {
    try {
      await dbAdmin.collection('levels').doc(req.params.id).set(req.body, { merge: true });
      res.json({ id: req.params.id, ...req.body });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete('/api/levels/:id', authenticate, async (req, res) => {
    try {
      await dbAdmin.collection('levels').doc(req.params.id).delete();
      res.json({ message: 'Level deleted' });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // System Logs API
  app.get('/api/system/logs', authenticate, async (req: any, res) => {
    if ((req.user as any)?.role !== 'admin') {
      return res.status(403).json({ message: 'Accès réservé aux administrateurs' });
    }
    res.json(serverLogs);
  });

  // Serve static uploads
  app.use('/uploads', express.static(UPLOADS_DIR));

  // Profile Upload API
  app.post('/api/profile/upload-photo', authenticate, memoryUpload.single('photo'), async (req: any, res) => {
    if (!req.file) {
      addLog('ERROR', 'Tentative d\'upload sans fichier');
      return res.status(400).json({ message: 'Aucun fichier téléchargé' });
    }
    
    try {
      // Small photos are converted to base64 for persistence in Firestore
      const photoURL = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
      const targetUserId = req.body.userId || req.user.id; // Allow admin to specify a user ID
      
      // Security check: Only admins can update other people's photos
      if (targetUserId !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Permission refusée' });
      }

      if (!isFirebaseAdminInitialized) {
        addLog('ERROR', 'Tentative d\'upload photo sans Firebase Admin');
        return res.status(503).json({ message: 'Le service Firebase n\'est pas initialisé.' });
      }

      // Update Firestore Profile
      await dbAdmin.collection('users').doc(targetUserId).update({ photoURL });
      
      // Update Role-specific profile
      const userDoc = await dbAdmin.collection('users').doc(targetUserId).get();
      const userData = userDoc.data();
      
      if (userData?.role === 'student') {
        await dbAdmin.collection('students').doc(targetUserId).update({ photoURL });
      } else if (userData?.role === 'teacher') {
        await dbAdmin.collection('teachers').doc(targetUserId).update({ photoURL });
      }
      
      // Also update Auth User photo if it's the current user
      if (targetUserId === req.user.id) {
        try {
          await authAdmin.updateUser(targetUserId, { photoURL });
        } catch (authErr) {
          addLog('ERROR', 'Erreur mise à jour photo Auth', authErr);
        }
      }

      addLog('INFO', `Photo mise à jour pour ${targetUserId}: ${photoURL}`);
      res.json({ photoURL, message: 'Photo de profil mise à jour' });
    } catch (err: any) {
      addLog('ERROR', 'Profile photo upload error', err.message);
      res.status(500).json({ message: err.message });
    }
  });

  // --- Evaluation Routes ---
  app.get('/api/evaluations', authenticate, async (req: any, res) => {
    try {
      let queryRef: any = dbAdmin.collection('evaluations');
      if (req.user.role === 'teacher') {
        queryRef = queryRef.where('teacherId', '==', req.user.id);
      } else if (req.user.role === 'student') {
        queryRef = queryRef.where('studentId', '==', req.user.id).where('status', '==', 'published');
      }
      
      const snapshot = await queryRef.get();
      const evaluations = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
      res.json(evaluations);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post('/api/evaluations', authenticate, async (req: any, res) => {
    if (req.user.role === 'student') return res.status(403).json({ message: 'Permission refusée' });
    try {
      const evaluation = {
        ...req.body,
        teacherId: req.user.id,
        createdAt: new Date().toISOString()
      };
      const docRef = await dbAdmin.collection('evaluations').add(evaluation);
      res.json({ id: docRef.id, ...evaluation });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.put('/api/evaluations/:id', authenticate, async (req: any, res) => {
    if (req.user.role === 'student') return res.status(403).json({ message: 'Permission refusée' });
    try {
      await dbAdmin.collection('evaluations').doc(req.params.id).update(req.body);
      res.json({ message: 'Évaluation mise à jour' });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete('/api/evaluations/:id', authenticate, async (req: any, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Permission refusée' });
    try {
      await dbAdmin.collection('evaluations').doc(req.params.id).delete();
      res.json({ message: 'Évaluation supprimée' });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Serve uploaded files
  app.use('/uploads', express.static(UPLOADS_DIR));

  // Vite Middleware or Static Fallback
  const distPath = path.join(process.cwd(), 'dist');
  
  if (process.env.NODE_ENV === 'production') {
    console.log("Serving static production build from", distPath);
    if (!fs.existsSync(distPath)) {
      console.warn("Production build directory 'dist' not found! Server might fail to serve frontend.");
    }
    app.use(express.static(distPath));
    app.get('*all', (req, res, next) => {
      // If it's an API request that didn't match, don't serve index.html
      if (req.path.startsWith('/api/') || req.path.startsWith('/health')) {
        return next();
      }
      const indexPath = path.join(distPath, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).send("Index file not found in production build.");
      }
    });
  } else {
    console.log("Starting Vite in middleware mode...");
    try {
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
    } catch (err) {
      console.error("Failed to start Vite middleware:", err);
    }
  }

  // Global Error Handler
  app.use((err: any, req: any, res: any, next: any) => {
    console.error("Unhandled Server Error:", err);
    if (res.headersSent) {
      return next(err);
    }
    res.status(500).json({ 
      error: "Internal Server Error", 
      message: err.message,
      path: req.path
    });
  });

  const server = app.listen(Number(PORT), "0.0.0.0", () => {
    console.log(`✅ Server running on http://0.0.0.0:${PORT} (env: ${process.env.NODE_ENV || 'development'})`);
  });

  server.on('error', (err: any) => {
    console.error("Server listen error:", err);
  });
}

startServer();

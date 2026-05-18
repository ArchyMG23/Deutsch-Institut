import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

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
import { z } from 'zod';

// --- FINANCIAL HELPERS ---
async function ajusterSolde(compte: 'caisse' | 'banque', delta: number, transactionOrBatch: any = null) {
  if (!isFirebaseAdminInitialized) return;
  const ref = dbAdmin.collection('comptes').doc(compte);
  
  const updateData = {
    solde_actuel: admin.firestore.FieldValue.increment(delta),
    derniere_maj: admin.firestore.FieldValue.serverTimestamp()
  };

  if (transactionOrBatch) {
    // Check if it's a batch or transaction
    if (typeof transactionOrBatch.update === 'function') {
      transactionOrBatch.update(ref, updateData);
    } else {
      // Transaction object in runTransaction usually has different methods but here we assume it supports .update
      transactionOrBatch.update(ref, updateData);
    }
  } else {
    await dbAdmin.runTransaction(async (t) => {
      const doc = await t.get(ref);
      const actuel = doc.data()?.solde_actuel || 0;
      if (delta < 0 && (actuel + delta) < 0) throw new Error('Solde insuffisant en ' + compte);
      t.update(ref, updateData);
    });
  }
}

async function generateMatricule(firstName: string, lastName: string, cycle: 'A' | 'E' = 'A'): Promise<string> {
  if (!isFirebaseAdminInitialized) return `DI-${cycle}${new Date().getFullYear()}000`;
  
  const year = new Date().getFullYear();
  const prefix = `DI-${cycle}${year}`;
  
  return await dbAdmin.runTransaction(async (t) => {
    const seqRef = dbAdmin.collection('recu_sequence').doc('matricule_seq');
    const seqDoc = await t.get(seqRef);
    let lastSeq = 0;
    
    if (seqDoc.exists) {
      const data = seqDoc.data();
      if (data?.year === year) {
        lastSeq = data?.count || 0;
      }
    }
    
    const nextSeq = lastSeq + 1;
    t.set(seqRef, { year, count: nextSeq }, { merge: true });
    
    const seqStr = nextSeq.toString().padStart(3, '0');
    return `${prefix}${seqStr}`;
  });
}

async function generateReceiptNumber(): Promise<string> {
  if (!isFirebaseAdminInitialized) return `REC-${new Date().getFullYear()}-0000`;
  const year = new Date().getFullYear();
  return await dbAdmin.runTransaction(async (t) => {
    const seqRef = dbAdmin.collection('recu_sequence').doc('receipt_seq');
    const seqDoc = await t.get(seqRef);
    let lastSeq = 0;
    if (seqDoc.exists) {
      const data = seqDoc.data();
      if (data?.year === year) lastSeq = data?.count || 0;
    }
    const nextSeq = lastSeq + 1;
    t.set(seqRef, { year, count: nextSeq }, { merge: true });
    return `REC-${year}-${nextSeq.toString().padStart(4, '0')}`;
  });
}

// Helper to handle __dirname and __filename in both ESM and CJS
let _filename: string;
let _dirname: string;

try {
  _filename = fileURLToPath(import.meta.url);
  _dirname = path.dirname(_filename);
} catch (e) {
  // Fallback for CommonJS (bundled) environment
  _filename = __filename;
  _dirname = __dirname;
}

const PORT = Number(process.env.PORT) || 3000;
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

  // Bootstrap Admins
  if (isFirebaseAdminInitialized) {
    try {
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
        if (!token || token === 'undefined' || token === 'null') {
          addLog('AUTH', `Token invalide reçu: ${token}`);
          return res.status(401).json({ message: 'Token invalide' });
        }

        const decodedToken = await authAdmin.verifyIdToken(token);
        
        // Comprehensive user identification
        const userEmail = decodedToken.email || '';
        const isSuperAdminEmail = ['yombivictor@gmail.com', 'gabrielyombi311@gmail.com'].includes(userEmail);

        req.user = {
          id: decodedToken.uid,
          email: userEmail,
          role: decodedToken.role || 'user',
          isSuperAdmin: isSuperAdminEmail
        };
        
        // Fetch missing info from Firestore if needed
        if (!req.user.email || !decodedToken.role || req.user.role === 'user') {
          const userDoc = await dbAdmin.collection('users').doc(decodedToken.uid).get();
          if (userDoc.exists) {
            const userData = userDoc.data();
            if (!req.user.email) req.user.email = userData?.email;
            if (req.user.role === 'user') req.user.role = userData?.role || 'user';
            if (userData?.isSuperAdmin) req.user.isSuperAdmin = true;
          }
        }
        
        return next();
      } else {
        console.warn("[AUTH] Firebase Admin not initialized. Falling back to JWT verification.");
        // Fallback to JWT if Firebase Admin is not available (for local dev without service account)
        if (!token || token === 'undefined' || token === 'null') {
          return res.status(401).json({ message: 'Token JWT invalide' });
        }
        const decoded = jwt.verify(token, JWT_SECRET) as any;
        req.user = decoded;
        return next();
      }
    } catch (err: any) {
      addLog('AUTH', `Erreur vérification token: ${err.message}`, { tokenSnippet: token?.substring(0, 10) + '...' });
      console.error(`[AUTH] Invalid token or error:`, err.message);
      if (err.code === 'auth/id-token-expired') {
        return res.status(401).json({ message: 'Session expirée. Veuillez vous reconnecter.' });
      }
      res.status(401).json({ message: 'Authentification échouée: ' + err.message });
    }
  };

  const checkSuperAdmin = async (req: any, res: any, next: any) => {
    try {
      const userRef = dbAdmin.collection('users').doc(req.user.id);
      const userDoc = await userRef.get();
      const userData = userDoc.data();
      const isSuper = userData?.isSuperAdmin || 
                      req.user.email === 'yombivictor@gmail.com' || 
                      req.user.email === 'gabrielyombi311@gmail.com';
      if (!isSuper) return res.status(403).json({ message: 'Réservé au Super Administrateur' });
      next();
    } catch (err) {
      res.status(500).json({ message: 'Erreur vérification Super Admin' });
    }
  };

  // --- MAINTENANCE & HEAVY RESET ---
  app.post('/api/maintenance/heavy-reset', authenticate, checkSuperAdmin, async (req: any, res: any) => {
    const { confirmation, password } = req.body;
    if (confirmation !== 'CONFIRMER') return res.status(400).json({ message: 'Confirmation invalide' });
    
    // We assume password was verified on client or we can check it here if needed
    // Usually SuperAdmin check middleware is enough if the session is valid.

    try {
      addLog('INFO', `DÉMARRAGE RESET COMPLET BASE FINANCIÈRE par ${req.user.email}`);
      
      const collectionsToWipe = ['transactions', 'scolarites', 'vorbereitung', 'sorties', 'audit_log'];
      
      for (const coll of collectionsToWipe) {
        const snapshot = await dbAdmin.collection(coll).get();
        if (snapshot.empty) continue;

        let batch = dbAdmin.batch();
        let count = 0;
        
        for (const doc of snapshot.docs) {
          // Recursive sub-collections deletion for scolarites and vorbereitung (versements)
          if (coll === 'scolarites' || coll === 'vorbereitung') {
            const versements = await doc.ref.collection('versements').get();
            for (const vDoc of versements.docs) {
              batch.delete(vDoc.ref);
              count++;
              if (count === 400) { await batch.commit(); batch = dbAdmin.batch(); count = 0; }
            }
          }
          
          batch.delete(doc.ref);
          count++;
          if (count === 400) {
            await batch.commit();
            batch = dbAdmin.batch();
            count = 0;
          }
        }
        if (count > 0) await batch.commit();
      }

      // Reset balances
      const accountsBatch = dbAdmin.batch();
      accountsBatch.set(dbAdmin.collection('comptes').doc('caisse'), { solde_actuel: 0, derniere_maj: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
      accountsBatch.set(dbAdmin.collection('comptes').doc('banque'), { solde_actuel: 0, derniere_maj: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
      
      // Reset sequences
      accountsBatch.set(dbAdmin.collection('recu_sequence').doc('receipt_seq'), { year: new Date().getFullYear(), count: 0 }, { merge: true });
      accountsBatch.set(dbAdmin.collection('recu_sequence').doc('matricule_seq'), { year: new Date().getFullYear(), count: 0 }, { merge: true });
      
      await accountsBatch.commit();
      
      addLog('INFO', "✅ Base financière réinitialisée avec succès");
      res.json({ message: "✅ Base financière réinitialisée avec succès" });
    } catch (err: any) {
      addLog('ERROR', "Échec du reset financier", err.message);
      res.status(500).json({ message: err.message });
    }
  });

  // Health Check
  app.get('/health', (req, res) => {
    res.json({ 
      status: 'ok', 
      env: process.env.NODE_ENV,
      firebase: admin.apps.length > 0 ? 'initialized' : 'not initialized',
      timestamp: new Date().toISOString()
    });
  });

  // Self-repair: Ensure Super Admins exist in DB and remove deprecated ones
  const ensureSuperAdmins = async () => {
    if (!isFirebaseAdminInitialized) return;
    const admins = ['gabrielyombi311@gmail.com', 'yombivictor@gmail.com'];
    const deprecated = ['victoryombi@gmail.com', 'gabrielyombi@gmail.com'];

    // 1. Ensure current ones are correct
    for (const email of admins) {
      try {
        const snap = await dbAdmin.collection('users').where('email', '==', email).get();
        if (!snap.empty) {
          for (const doc of snap.docs) {
             const data = doc.data();
             if (!data.isSuperAdmin || data.role !== 'admin') {
               await doc.ref.update({ isSuperAdmin: true, role: 'admin' });
               console.log(`Updated ${email} to be Super Admin in DB`);
             }
          }
        }
      } catch (err) {
        console.error(`Failed to ensure super admin for ${email}:`, err);
      }
    }

    // 2. Remove deprecated duplicates from the users collection
    for (const email of deprecated) {
      try {
        const snap = await dbAdmin.collection('users').where('email', '==', email).get();
        if (!snap.empty) {
          for (const doc of snap.docs) {
            await doc.ref.delete();
            console.log(`🗑️ Deleted deprecated duplicate admin: ${email}`);
          }
        }
      } catch (err) {
        console.error(`Failed to remove deprecated admin ${email}:`, err);
      }
    }
  };
  // Run once after a short delay to ensure DB is ready
  setTimeout(ensureSuperAdmins, 5000);

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
    const hasDigit = /\d/.test(password);

    if (password.length < minLength) return { isValid: false, message: "Le mot de passe doit contenir au moins 6 caractères." };
    if (!hasUppercase) return { isValid: false, message: "Le mot de passe doit contenir au moins une majuscule." };
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

      const confirmation = req.body?.confirmation;
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
      // 1. Fetch from students collection
      const snapshot = await dbAdmin.collection('students').get();
      
      // 2. Fetch corresponding base user profiles to get status/lastActive
      const usersSnap = await dbAdmin.collection('users').where('role', '==', 'student').get();
      const usersMap: Record<string, any> = {};
      usersSnap.forEach(doc => {
        usersMap[doc.id] = doc.data();
      });

      // 3. Batch fetch financial summaries to avoid n+1 queries
      const scolaritesSnap = await dbAdmin.collection('scolarites').get();
      const vorbereitungSnap = await dbAdmin.collection('vorbereitung').get();
      // SOURCE OF TRUTH FOR PAYMENTS: The 'finances' collection (ledger)
      const financesSnap = await dbAdmin.collection('finances').where('status', '==', 'active').where('type', '==', 'income').get();

      const financialMap: Record<string, { paid: number, due: number }> = {};
      
      // Calculate due from scolarites and vorbereitung
      scolaritesSnap.forEach(doc => {
        const d = doc.data();
        if (!financialMap[doc.id]) financialMap[doc.id] = { paid: 0, due: 0 };
        financialMap[doc.id].due = (financialMap[doc.id].due || 0) + (d.montant_total_du || 0);
        // Fallback for paid if finances collection is empty
        financialMap[doc.id].paid = (financialMap[doc.id].paid || 0) + (d.total_verse || 0);
      });

      vorbereitungSnap.forEach(doc => {
        const d = doc.data();
        if (!financialMap[doc.id]) financialMap[doc.id] = { paid: 0, due: 0 };
        financialMap[doc.id].due = (financialMap[doc.id].due || 0) + (d.montant_total_du || 0);
        financialMap[doc.id].paid = (financialMap[doc.id].paid || 0) + (d.total_verse || 0);
      });

      // Override paid amount using the ledger (transactions) - this is more robust
      const paidMap: Record<string, number> = {};
      financesSnap.forEach(doc => {
        const d = doc.data();
        const sid = d.studentId || d.eleve_id;
        if (sid) {
          const cat = (d.category || '').toLowerCase();
          // Sum up relevant schooling/vacation/prep fees
          if (cat.includes('scolarit') || cat.includes('vorbereitung') || cat.includes('vacances')) {
            paidMap[sid] = (paidMap[sid] || 0) + (Number(d.amount) || 0);
          }
        }
      });

      // Merge paidMap into financialMap
      Object.keys(paidMap).forEach(sid => {
        if (!financialMap[sid]) financialMap[sid] = { paid: 0, due: 0 };
        financialMap[sid].paid = paidMap[sid];
      });

      const students = snapshot.docs.map(doc => {
        const studentData = doc.data();
        const userData = usersMap[doc.id] || {};
        const finances = financialMap[doc.id] || { paid: 0, due: 0 };

        return { 
          id: doc.id,
          uid: doc.id, 
          ...studentData,
          totalPaid: finances.paid || studentData.totalPaid || 0,
          totalTuition: finances.due || studentData.totalTuition || 0,
          // Merge critical profile fields
          status: userData.status || 'offline',
          lastActiveDevice: userData.lastActiveDevice || '',
          lastLoginAt: userData.lastLoginAt || '',
          fcmToken: userData.fcmToken || ''
        };
      });
      res.json(students);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post('/api/students', authenticate, async (req: any, res: any) => {
    const { password, ...studentData } = req.body;
    const cycle = studentData.cycle === 'Anglais' ? 'E' : 'A';
    const fraisType = req.body.fraisType || 'Normale'; // Normale, Réduction 50%, Réduction totale
    const modePaiement = req.body.modePaiement || 'Espèces';
    const compteDestination = req.body.compteDestination || 'caisse';

    let montantInscription = (req.body.inscriptionAmount !== undefined) ? Number(req.body.inscriptionAmount) : 10000;
    if (req.body.inscriptionAmount === undefined) {
      if (fraisType === 'Réduction 50%') montantInscription = 5000;
      if (fraisType === 'Réduction totale') montantInscription = 0;
    }
    
    try {
      const passValidation = validatePassword(password || 'DIA2026.');
      if (!passValidation.isValid) return res.status(400).json({ message: passValidation.message });

      // Generate Matricule first
      const matricule = await generateMatricule(studentData.firstName, studentData.lastName, cycle);
      
      // Handle optional email
      const finalEmail = studentData.email || `${matricule.toLowerCase()}@dia-deutschinstitut.com`;

      const userRecord = await authAdmin.createUser({
        email: finalEmail,
        password: password || 'DIA2026.',
        displayName: `${studentData.firstName} ${studentData.lastName}`,
        phoneNumber: studentData.phone || undefined
      });

      const studentId = userRecord.uid;
      const createdAt = req.body.dateVerse ? new Date(req.body.dateVerse).toISOString() : new Date().toISOString();

      const batch = dbAdmin.batch();

      // 1. User Record
      batch.set(dbAdmin.collection('users').doc(studentId), {
        uid: studentId, 
        matricule, 
        email: finalEmail, 
        phone: studentData.phone || '',
        role: 'student',
        firstName: studentData.firstName, 
        lastName: studentData.lastName,
        status: 'offline', 
        createdAt
      });

      // 3. Scolarité Record - Calculate first to avoid ReferenceError
      const levelIdForTuition = studentData.levelId || (cycle === 'A' ? 'a1_de' : 'a1_en');
      const levelDoc = await dbAdmin.collection('levels').doc(levelIdForTuition).get();
      const levelData = levelDoc.exists ? levelDoc.data() : null;
      const tuitionTotal = (req.body.totalTuition !== undefined && req.body.totalTuition !== null) 
        ? Number(req.body.totalTuition) 
        : (Number(levelData?.tuition || levelData?.frais_scolarite || 0));

      // 2. Student Record
      const newStudent = { 
        ...studentData, 
        email: finalEmail,
        phone: studentData.phone || '',
        id: studentId, 
        uid: studentId,
        matricule, 
        createdAt, 
        totalTuition: tuitionTotal,
        totalPaid: 0,
        reste: tuitionTotal,
        cycle: studentData.cycle || 'Allemand',
        payments: [], // Initialize empty payments array
        role: 'student'
      };
      batch.set(dbAdmin.collection('students').doc(studentId), newStudent);

      batch.set(dbAdmin.collection('scolarites').doc(studentId), {
        eleve_id: studentId, 
        matricule, 
        levelId: levelIdForTuition, 
        montant_total_du: tuitionTotal,
        total_verse: 0, 
        reste: tuitionTotal, 
        surplus: false, 
        statut_paiement: tuitionTotal === 0 ? 'SOLDÉ' : 'NON PAYÉ', 
        nom_eleve: `${studentData.firstName} ${studentData.lastName}`, 
        createdAt
      });

      // 4. Inscription Transaction (Record even if 0 to track registration date)
      const transId = dbAdmin.collection('transactions').doc().id;
      const recu_numero = await generateReceiptNumber();
      const transactionData = {
        id: transId,
        type: 'inscription',
        eleve_id: studentId,
        libelle: `Frais d'inscription - ${studentData.firstName} ${studentData.lastName}${montantInscription === 0 ? ' (Bourse totale / Sans frais)' : ''}`,
        montant: montantInscription,
        date_versement: createdAt,
        mode_paiement: montantInscription > 0 ? modePaiement : 'N/A',
        compte_destination: montantInscription > 0 ? compteDestination : 'caisse',
        saisi_par: req.user.email,
        timestamp_creation: admin.firestore.FieldValue.serverTimestamp(),
        recu_numero
      };
      batch.set(dbAdmin.collection('transactions').doc(transId), transactionData);
      
      if (montantInscription > 0) {
        // Adjust balance
        await ajusterSolde(compteDestination as 'caisse' | 'banque', montantInscription, batch);

        // Update finances collection too
        batch.set(dbAdmin.collection('finances').doc(transId), {
          id: transId, studentId, studentMatricule: matricule,
          studentName: `${studentData.firstName} ${studentData.lastName}`,
          amount: montantInscription, date: createdAt, type: 'income', category: 'Inscription',
          method: modePaiement, accountType: compteDestination, status: 'active',
          createdAt, updatedAt: createdAt
        });
      }

      // 5. Handle initial payments (Scolarité)
      let initialScolaritePaid = 0;
      const initialPayments = studentData.payments || [];
      for (const p of initialPayments) {
        const amount = Number(p.amount) || 0;
        if (amount <= 0) continue;

        initialScolaritePaid += amount;
        const pTransId = dbAdmin.collection('transactions').doc().id;
        const pRecu = await generateReceiptNumber();
        
        const pData = {
          id: pTransId,
          type: 'scolarite',
          eleve_id: studentId,
          libelle: `Scolarité - Tranche ${p.tranche} - ${studentData.firstName} ${studentData.lastName}`,
          montant: amount,
          date_versement: p.date || createdAt,
          mode_paiement: modePaiement,
          compte_destination: compteDestination,
          saisi_par: req.user.email,
          timestamp_creation: admin.firestore.FieldValue.serverTimestamp(),
          recu_numero: pRecu
        };
        batch.set(dbAdmin.collection('transactions').doc(pTransId), pData);
        batch.set(dbAdmin.collection('finances').doc(pTransId), {
          id: pTransId, studentId, studentMatricule: matricule,
          studentName: `${studentData.firstName} ${studentData.lastName}`,
          amount, date: p.date || createdAt, type: 'income', category: 'Scolarité',
          method: modePaiement, accountType: compteDestination, status: 'active',
          createdAt, updatedAt: createdAt
        });

        // Add to sub-collection for full traceability
        batch.set(dbAdmin.collection('scolarites').doc(studentId).collection('versements').doc(pTransId), {
          ...pData,
          date: p.date || createdAt,
          compte: compteDestination
        });

        await ajusterSolde(compteDestination as 'caisse' | 'banque', amount, batch);
      }

      // Update student and scolarite totals if any payments were made
      if (initialScolaritePaid > 0) {
        const newReste = Math.max(0, tuitionTotal - initialScolaritePaid);
        batch.update(dbAdmin.collection('students').doc(studentId), {
          totalPaid: initialScolaritePaid,
          reste: newReste
        });
        batch.update(dbAdmin.collection('scolarites').doc(studentId), {
          total_verse: initialScolaritePaid,
          reste: newReste,
          statut_paiement: initialScolaritePaid >= tuitionTotal ? 'SOLDÉ' : (initialScolaritePaid > 0 ? 'EN COURS' : 'NON PAYÉ')
        });
      }

      await batch.commit();
      res.json({ ...newStudent, tempPassword: password || 'DIA2026.' });
    } catch (err: any) {
      console.error("Student registration error:", err);
      if (err.code === 'auth/email-already-exists' || err.code === 'auth/uid-already-exists') {
        return res.status(409).json({ message: "Cet étudiant est déjà inscrit dans le système (Email/Matricule déjà utilisé)." });
      }
      res.status(500).json({ message: err.message });
    }
  });

  // --- VIREMENT CAISSE -> BANQUE ---
  app.post('/api/finances/transfer', authenticate, checkSuperAdmin, async (req: any, res) => {
    const { amount, notes } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ message: 'Montant invalide' });

    try {
      const batch = dbAdmin.batch();
      
      // Update balances
      await ajusterSolde('caisse', -amount, batch);
      await ajusterSolde('banque', amount, batch);
      
      // Record transaction
      const transId = dbAdmin.collection('transactions').doc().id;
      batch.set(dbAdmin.collection('transactions').doc(transId), {
        id: transId,
        type: 'virement_cb',
        libelle: 'Virement Caisse vers Banque',
        montant: amount,
        date_versement: new Date().toISOString(),
        mode_paiement: 'Virement',
        compte_source: 'caisse',
        compte_destination: 'banque',
        saisi_par: req.user.email,
        notes: notes || '',
        timestamp_creation: admin.firestore.FieldValue.serverTimestamp()
      });
      
      await batch.commit();
      res.json({ message: 'Virement effectué avec succès' });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get('/api/students/:id', authenticate, async (req, res) => {
    try {
      const doc = await dbAdmin.collection('students').doc(req.params.id).get();
      if (!doc.exists) return res.status(404).json({ message: 'Student not found' });
      
      const studentData = doc.data() || {};
      const userDoc = await dbAdmin.collection('users').doc(req.params.id).get();
      const userData = userDoc.exists ? userDoc.data() : {};
      
      res.json({
        id: doc.id,
        uid: doc.id,
        ...studentData,
        status: (userData as any)?.status || 'offline',
        lastActiveDevice: (userData as any)?.lastActiveDevice || '',
        lastLoginAt: (userData as any)?.lastLoginAt || '',
        fcmToken: (userData as any)?.fcmToken || ''
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
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

      // Sync Scolarite if levelId changed
      if (studentData.levelId && studentData.levelId !== oldStudent.levelId) {
        try {
          const newLevelId = studentData.levelId;
          const levelDoc = await dbAdmin.collection('levels').doc(newLevelId).get();
          const levelData = levelDoc.exists ? levelDoc.data() : null;
          
          // Use 'tuition' or 'frais_scolarite' field, fallback to 120000
          const tuition = Number(levelData?.tuition || levelData?.frais_scolarite || 120000);
          
          const scolaRef = dbAdmin.collection('scolarites').doc(req.params.id);
          const scolaSnap = await scolaRef.get();
          
          const studentPaid = Number(oldStudent.totalPaid) || 0;
          const newReste = Math.max(0, tuition - studentPaid);

          if (!scolaSnap.exists) {
            await scolaRef.set({
              id: req.params.id,
              eleve_id: req.params.id,
              matricule: studentData.matricule || oldStudent.matricule,
              nom_eleve: `${studentData.firstName || oldStudent.firstName} ${studentData.lastName || oldStudent.lastName}`,
              classe_id: studentData.classId || oldStudent.classId || 'N/A',
              filiere: levelData?.stream || levelData?.cycle || 'N/A',
              niveau: levelData?.name || levelData?.nom || 'Inconnu',
              levelId: newLevelId,
              montant_total_du: tuition,
              total_verse: studentPaid,
              reste: newReste,
              statut_paiement: studentPaid >= tuition ? 'SOLDÉ' : (studentPaid > 0 ? 'EN COURS' : 'NON PAYÉ'),
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            });
          } else {
            await scolaRef.update({
              filiere: levelData?.stream || levelData?.cycle || 'N/A',
              niveau: levelData?.name || levelData?.nom || 'Inconnu',
              levelId: newLevelId,
              montant_total_du: tuition,
              reste: newReste,
              statut_paiement: studentPaid >= tuition ? 'SOLDÉ' : (studentPaid > 0 ? 'EN COURS' : 'NON PAYÉ'),
              updatedAt: new Date().toISOString()
            });
          }

          // CRITICAL: Update the student record directly too for UI progress bars
          await studentRef.update({
            totalTuition: tuition,
            reste: newReste,
            updatedAt: new Date().toISOString()
          });
          
          console.log(`[SYNC] Updated tuition for student ${req.params.id} to ${tuition} (Level: ${newLevelId})`);
        } catch (err) {
          console.error("Error syncing student finance on level change:", err);
        }
      }
      
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

      // Handle finances if payments updated (legacy sync)
      if (studentData.payments && Array.isArray(studentData.payments)) {
        let totalDiff = 0;
        for (let i = 0; i < studentData.payments.length; i++) {
          const p = studentData.payments[i];
          const oldP = oldStudent.payments?.[i];
          const diff = Number(p.amount) - (Number(oldP?.amount) || 0);
          
          if (diff !== 0 && p.date) {
            totalDiff += diff;
            const financeId = `F_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
            const createdAt = new Date().toISOString();
            
            // 1. Finance record
            await dbAdmin.collection('finances').doc(financeId).set({
              id: financeId, studentId: req.params.id, studentMatricule: studentData.matricule || oldStudent.matricule,
              studentName: `${studentData.firstName || oldStudent.firstName} ${studentData.lastName || oldStudent.lastName}`,
              amount: diff, date: p.date, type: diff > 0 ? 'income' : 'expense', category: 'Scolarité',
              method: p.method || 'Espèces', accountType: 'caisse', notes: `Sync - ${p.category || 'Paiement'}`,
              receiptId: p.receiptId || `REC-S-${Date.now()}`, createdAt, updatedAt: createdAt, status: 'active'
            });

            // 2. Transaction record for ledger
            await dbAdmin.collection('transactions').doc(financeId).set({
              id: financeId, type: diff > 0 ? 'income' : 'expense', category: 'Scolarité',
              eleve_id: req.params.id, matricule: studentData.matricule || oldStudent.matricule,
              libelle: `Sync - ${studentData.firstName || oldStudent.firstName} - ${p.category || 'Paiement'}`,
              montant: Math.abs(diff), date_versement: p.date, mode_paiement: p.method || 'Espèces',
              compte_destination: 'caisse', recu_numero: p.receiptId || `REC-S-${Date.now()}`,
              timestamp: admin.firestore.FieldValue.serverTimestamp()
            });
          }
        }

        if (totalDiff !== 0) {
          // 3. Update Caisse Balance
          await dbAdmin.collection('comptes').doc('caisse').update({
            solde_actuel: admin.firestore.FieldValue.increment(totalDiff),
            derniere_maj: admin.firestore.FieldValue.serverTimestamp()
          });

          // 4. Update formal scolarite record
          const scolaRef = dbAdmin.collection('scolarites').doc(req.params.id);
          const scolaSnap = await scolaRef.get();
          if (scolaSnap.exists) {
            const scolaData = scolaSnap.data() as any;
            const newTotalVerse = (Number(scolaData.total_verse) || 0) + totalDiff;
            const due = Number(scolaData.montant_total_du) || studentData.totalTuition || oldStudent.totalTuition || 120000;
            const newReste = Math.max(0, due - newTotalVerse);
            const newStatut = newTotalVerse >= due ? 'SOLDÉ' : (newTotalVerse > 0 ? 'EN COURS' : 'NON PAYÉ');
            
            await scolaRef.update({
              total_verse: newTotalVerse,
              reste: newReste,
              statut_paiement: newStatut,
              updatedAt: new Date().toISOString()
            });
          }

          // 5. Update student doc totals for direct UI sync
          const currentPaid = (Number(oldStudent.totalPaid) || 0) + totalDiff;
          const currentTuition = Number(studentData.totalTuition) || Number(oldStudent.totalTuition) || 120000;
          studentData.totalPaid = currentPaid;
          studentData.reste = Math.max(0, currentTuition - currentPaid);
          // We already called await studentRef.set(studentData, { merge: true }); above, 
          // so we should update again if we want to persist these calculated fields.
          await studentRef.update({
            totalPaid: studentData.totalPaid,
            reste: studentData.reste,
            updatedAt: new Date().toISOString()
          });
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

  app.delete('/api/students/:id', authenticate, async (req: any, res) => {
    try {
      const studentId = req.params.id;
      const currentUserDoc = await dbAdmin.collection('users').doc(req.user.id).get();
      const userData = currentUserDoc.data();
      const userEmail = (req.user.email || '').toLowerCase();
      const isSuperAdmin = userData?.isSuperAdmin === true || 
                         userEmail === 'yombivictor@gmail.com' || 
                         userEmail === 'gabrielyombi311@gmail.com';

      if (!isSuperAdmin) {
        return res.status(403).json({ message: 'Seul le Super Administrateur peut supprimer un élève et ses transactions' });
      }

      if (!studentId || studentId === 'undefined') {
         return res.status(400).json({ message: 'ID d\'élève invalide' });
      }

      const studentDoc = await dbAdmin.collection('students').doc(studentId).get();
      const studentData = studentDoc.exists ? studentDoc.data() as any : {};
      const matricule = studentData.matricule || '';
      
      console.log(`[HARD-DELETE] Executing atomic wipe for ${studentId} (${matricule})`);

      // 1. All finance records related to this student
      const financeSnap1 = await dbAdmin.collection('finances')
        .where('studentId', '==', studentId)
        .where('status', '==', 'active')
        .get();
      const financeSnap2 = await dbAdmin.collection('finances')
        .where('eleve_id', '==', studentId)
        .where('status', '==', 'active')
        .get();
      
      const transactionsSnap1 = await dbAdmin.collection('transactions')
        .where('studentId', '==', studentId)
        .get();
      const transactionsSnap2 = await dbAdmin.collection('transactions')
        .where('eleve_id', '==', studentId)
        .get();
      
      // Calculate amount to deduct from balances
      const balanceAdjustments: Record<string, number> = {};
      const allDeductions = [...financeSnap1.docs, ...financeSnap2.docs, ...transactionsSnap1.docs, ...transactionsSnap2.docs];
      const seenIds = new Set();

      allDeductions.forEach(d => {
        if (seenIds.has(d.id)) return;
        seenIds.add(d.id);
        
        const data = d.data();
        if (data.supprime === true || data.status === 'deleted') return;
        
        const account = data.accountType || data.compte_destination || 'caisse';
        const amount = Number(data.amount || data.montant || 0);
        
        // Only adjust for income-type transactions (payments)
        // Expenses (sortie) linked to a student are rare but if they exist they should be handled differently
        // Usually students are linked to INCOMES.
        if (amount !== 0) {
          balanceAdjustments[account] = (balanceAdjustments[account] || 0) + amount;
        }
      });

      // 2. Begin multi-step deletion
      // Update balances first
      for (const [account, total] of Object.entries(balanceAdjustments)) {
        if (total === 0) continue;
        const balanceRef = dbAdmin.collection('comptes').doc(account === 'banque' ? 'banque' : 'caisse');
        const bSnap = await balanceRef.get();
        if (bSnap.exists) {
          await balanceRef.update({
            solde_actuel: admin.firestore.FieldValue.increment(-total),
            derniere_maj: new Date().toISOString()
          });
        }
      }

      // 3. Delete related collections in batches
      const collectionsToClean = ['finances', 'scolarites', 'vorbereitung', 'transactions', 'recus'];
      for (const coll of collectionsToClean) {
        // Query both common field names
        const snap1 = await dbAdmin.collection(coll).where('studentId', '==', studentId).get();
        const snap2 = await dbAdmin.collection(coll).where('eleve_id', '==', studentId).get();
        
        const allDocs = [...snap1.docs, ...snap2.docs];
        const uniqueDocs = allDocs.filter((v, i, a) => a.findIndex(t => t.id === v.id) === i);
        
        let batch = dbAdmin.batch();
        let count = 0;
        for (const doc of uniqueDocs) {
          if (coll === 'scolarites' || coll === 'vorbereitung') {
             // Subcollection versements
             const vSnap = await doc.ref.collection('versements').get();
             vSnap.forEach(vd => {
               batch.delete(vd.ref);
               count++;
               if (count >= 450) { 
                 batch.commit(); 
                 batch = dbAdmin.batch(); 
                 count = 0; 
               }
             });
          }
          batch.delete(doc.ref);
          count++;
          if (count >= 450) { 
            batch.commit(); 
            batch = dbAdmin.batch(); 
            count = 0; 
          }
        }
        if (count > 0) await batch.commit();
      }

      // 4. Handle Vacances Inscriptions (collectionGroup or nested)
      const insSnap = await dbAdmin.collectionGroup('inscriptions').where('eleve_id', '==', studentId).get();
      let insBatch = dbAdmin.batch();
      insSnap.forEach(d => insBatch.delete(d.ref));
      await insBatch.commit();

      // 5. Delete Student and User
      await dbAdmin.collection('students').doc(studentId).delete();
      await dbAdmin.collection('users').doc(studentId).delete();

      try {
        await authAdmin.deleteUser(studentId);
      } catch (err: any) {
        if (err.code !== 'auth/user-not-found') console.error("Auth delete error:", err);
      }

      console.log(`[HARD-DELETE] Wipe complete for ${studentId}`);
      res.json({ message: "L'élève et TOUT son historique financier ont été atomiquement effacés du système, et les soldes de caisse mis à jour." });
    } catch (err: any) {
      console.error("Hard delete error:", err);
      res.status(500).json({ message: err.message });
    }
  });

  // Teachers API
  app.get('/api/teachers', authenticate, async (req, res) => {
    try {
      // 1. Fetch from teachers collection
      const snapshot = await dbAdmin.collection('teachers').get();
      
      // 2. Fetch corresponding base user profiles to get status/lastActive
      const usersSnap = await dbAdmin.collection('users').where('role', '==', 'teacher').get();
      const usersMap: Record<string, any> = {};
      usersSnap.forEach(doc => {
        usersMap[doc.id] = doc.data();
      });

      const teachers = snapshot.docs.map(doc => {
        const teacherData = doc.data();
        const userData = usersMap[doc.id] || {};
        return { 
          id: doc.id,
          uid: doc.id, 
          ...teacherData,
          // Merge critical profile fields
          status: userData.status || 'offline',
          lastActiveDevice: userData.lastActiveDevice || '',
          lastLoginAt: userData.lastLoginAt || '',
          fcmToken: userData.fcmToken || ''
        };
      });
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

  // --- NEW FINANCIAL SYSTEM ---
  
  // 1. Maintenance Sync (Tool: Sync Modules)
  app.post('/api/maintenance/sync-modules', authenticate, async (req: any, res: any) => {
    try {
      if (req.user.role !== 'admin') return res.status(403).json({ message: "Interdit" });
      
      const results = { scolarites: 0, vorbereitung: 0, vacances: 0, cleaned: 0 };
      
      // 1. Fetch EVERYTHING in bulk
      const [studentsSnap, financesSnap, sessionsSnap, scolaritesSnap, vorbereitungSnap, inscriptionsSnap] = await Promise.all([
        dbAdmin.collection('students').get(),
        dbAdmin.collection('finances').where('status', '==', 'active').get(),
        dbAdmin.collection('cours_vacances').get(),
        dbAdmin.collection('scolarites').get(),
        dbAdmin.collection('vorbereitung').get(),
        dbAdmin.collectionGroup('inscriptions').get()
      ]);

      const studentIds = new Set(studentsSnap.docs.map(d => d.id));
      const studentsMap = new Map(studentsSnap.docs.map(d => [d.id, d.data()]));
      const sessions = sessionsSnap.docs;
      
      // Map finances by studentId or eleve_id
      const financesByStudent: Record<string, any[]> = {};
      financesSnap.docs.forEach(d => {
        const data = d.data();
        const sid = data.studentId || data.eleve_id;
        if (sid) {
          if (!financesByStudent[sid]) financesByStudent[sid] = [];
          financesByStudent[sid].push(data);
        }
      });

      // Map inscriptions by studentId
      const insByStudent: Record<string, any[]> = {};
      inscriptionsSnap.docs.forEach(d => {
        const data = d.data();
        const sid = data.eleve_id || d.id;
        const pathParts = d.ref.path.split('/');
        const sessIdFromPath = pathParts[1];
        if (!insByStudent[sid]) insByStudent[sid] = [];
        insByStudent[sid].push({ id: d.id, ref: d.ref, data, sessId: sessIdFromPath });
      });

      const scolarites = scolaritesSnap.docs;
      const vorbereitung = vorbereitungSnap.docs;

      let batch = dbAdmin.batch();
      let opCount = 0;

      const commitIfFull = async () => {
        if (opCount >= 450) {
          await batch.commit();
          batch = dbAdmin.batch();
          opCount = 0;
        }
      };

      // --- CLEANUP ORPHANS FIRST ---
      // a) Clean orphaned Scolarites
      for (const doc of scolarites) {
        if (!studentIds.has(doc.id)) {
          // No such student, delete scolarite module doc
          batch.delete(doc.ref);
          results.cleaned++;
          opCount++; await commitIfFull();
        }
      }
      // b) Clean orphaned Vorbereitung
      for (const doc of vorbereitung) {
        if (!studentIds.has(doc.id)) {
          batch.delete(doc.ref);
          results.cleaned++;
          opCount++; await commitIfFull();
        }
      }
      // c) Clean orphaned Inscriptions
      for (const doc of inscriptionsSnap.docs) {
        const sid = doc.data().eleve_id;
        if (!sid || !studentIds.has(sid)) {
          batch.delete(doc.ref);
          results.cleaned++;
          opCount++; await commitIfFull();
        }
      }

      // --- SYNC ACTIVE STUDENTS ---
      for (const studentDoc of studentsSnap.docs) {
        const sid = studentDoc.id;
        const sData = studentDoc.data();
        const studentFinances = financesByStudent[sid] || [];

        // Scolarité
        const scols = studentFinances.filter(f => f.category === 'Scolarité');
        const totalScol = scols.reduce((sum, f) => sum + (Number(f.amount) || 0), 0);
        const scolDoc = scolaritesSnap.docs.find(d => d.id === sid);
        if (scolDoc || totalScol > 0) {
          const scolRef = dbAdmin.collection('scolarites').doc(sid);
          const due = Number(scolDoc?.data()?.montant_total_du) || (sData.levelId ? 110000 : 0);
          
          const obj = {
            eleve_id: sid,
            matricule: sData.matricule || '',
            nom_eleve: `${sData.firstName || ''} ${sData.lastName || ''}`,
            total_verse: totalScol,
            reste: Math.max(0, due - totalScol),
            statut_paiement: totalScol >= due ? 'SOLDÉ' : (totalScol > 0 ? 'EN COURS' : 'NON PAYÉ'),
            updatedAt: new Date().toISOString()
          };

          if (!scolDoc) {
             batch.set(scolRef, { ...obj, montant_total_du: due, createdAt: new Date().toISOString() });
          } else {
             batch.update(scolRef, obj);
          }

          // Update student document for direct access in student list
          batch.update(studentDoc.ref, {
            totalPaid: totalScol,
            reste: Math.max(0, due - totalScol),
            updatedAt: new Date().toISOString()
          });

          opCount++; await commitIfFull();
          results.scolarites++;
        }

        // Vorbereitung
        const vorbs = studentFinances.filter(f => ['vorbereitung', 'Vorbereitung', 'Vorbereitung Allemand', 'Vorbereitung Anglais'].includes(f.category));
        const totalVorb = vorbs.reduce((sum, f) => sum + (Number(f.amount || f.montant || 0)), 0);
        const vorbDoc = vorbereitungSnap.docs.find(d => d.id === sid);
        if (vorbDoc || totalVorb > 0) {
          const vorbRef = dbAdmin.collection('vorbereitung').doc(sid);
          const due = Number(vorbDoc?.data()?.montant_total_du) || 0;
          
          const obj = {
            eleve_id: sid,
            matricule: sData.matricule || '',
            nom_eleve: `${sData.firstName || ''} ${sData.lastName || ''}`,
            total_verse: totalVorb,
            reste: Math.max(0, due - totalVorb),
            statut_paiement: totalVorb >= due ? 'SOLDÉ' : (totalVorb > 0 ? 'EN COURS' : 'NON PAYÉ'),
            updatedAt: new Date().toISOString()
          };

          if (!vorbDoc) {
             batch.set(vorbRef, { ...obj, montant_total_du: due, createdAt: new Date().toISOString() });
          } else {
             batch.update(vorbRef, obj);
          }
          opCount++; await commitIfFull();
          results.vorbereitung++;
        }

        // Vacances
        const vacs = studentFinances.filter(f => ['vacances', 'vacance', 'Cours de Vacances', 'Vacances'].includes(f.category));
        const paymentsBySession: Record<string, number> = {};

        vacs.forEach(v => {
          let sessId = v.sessionId;
          if (!sessId && v.notes) {
            const match = sessions.find(s => {
              const title = (s.data().titre || '').toLowerCase().trim();
              return title && v.notes.toLowerCase().includes(title);
            });
            if (match) sessId = match.id;
          }
          if (!sessId && sessions.length > 0) sessId = sessions[0].id;
          if (sessId) {
            paymentsBySession[sessId] = (paymentsBySession[sessId] || 0) + (Number(v.amount) || 0);
          }
        });

        for (const sessionDoc of sessions) {
          const sessId = sessionDoc.id;
          const sessData = sessionDoc.data();
          const paidForSess = paymentsBySession[sessId] || 0;
          const existingIns = insByStudent[sid]?.find(i => i.sessId === sessId);
          
          if (existingIns || paidForSess > 0) {
            const insRef = existingIns?.ref || sessionDoc.ref.collection('inscriptions').doc(sid);
            const insData = existingIns?.data;
            const due = Number(insData?.montant_total_du) || Number(sessData.prix) || 25000;
            
            const obj = {
              eleve_id: sid,
              nom: sData.lastName || insData?.nom || '',
              prenom: sData.firstName || insData?.prenom || '',
              matricule: sData.matricule || insData?.matricule || '',
              total_verse: paidForSess,
              reste: Math.max(0, due - paidForSess),
              statut: paidForSess >= due ? 'SOLDÉ' : (paidForSess > 0 ? 'EN COURS' : 'EN ATTENTE'),
              updatedAt: new Date().toISOString()
            };

            if (!existingIns) {
              batch.set(insRef, { ...obj, montant_total_du: due, enrolledAt: new Date().toISOString() });
            } else {
              batch.update(insRef, obj);
            }
            opCount++; await commitIfFull();
            results.vacances++;
          }
        }
      }

      if (opCount > 0) await batch.commit();
      res.json({ message: 'Synchronisation et nettoyage terminés', results });
    } catch (err: any) {
      console.error("Sync error:", err);
      res.status(500).json({ message: err.message });
    }
  });

  // Unified Financial Event Endpoint (used by TuitionManagement and others)
  app.post('/api/financial-event', authenticate, async (req: any, res) => {
    const { type, payload } = req.body;
    
    try {
      if (type === 'payment') {
        // Dispatch to payment logic (we can just redirect or internally call the logic)
        // Redirection might be tricky with req.body, so let's use an internal function or just re-route the request
        req.url = '/api/finances/payment';
        req.body = payload;
        return app._router.handle(req, res, () => {});
      } else if (type === 'expense') {
        req.url = '/api/finances/sortie';
        // Map payload fields to what /api/finances/sortie expects
        req.body = {
          categorie: payload.category,
          libelle: payload.description,
          amount: payload.amount,
          date: payload.date,
          accountType: payload.accountType,
          paymentMethod: payload.paymentMethod,
          notes: payload.notes,
          teacherId: payload.teacherId
        };
        return app._router.handle(req, res, () => {});
      } else if (type === 'reversal') {
        const { originalFinanceId, reason } = payload;
        req.url = `/api/finances/${originalFinanceId}`;
        req.method = 'DELETE';
        req.body = { reason };
        return app._router.handle(req, res, () => {});
      } else {
        res.status(400).json({ message: "Type d'événement inconnu" });
      }
    } catch (err: any) {
      console.error("Financial event dispatch error:", err);
      res.status(500).json({ message: err.message });
    }
  });
  
  app.post('/api/finances/payment', authenticate, async (req: any, res) => {
    const { studentId, amount, date, paymentMethod, accountType, type, levelId, notes, sessionId, sessionTitle } = req.body;
    if (!studentId || !amount || amount <= 0) return res.status(400).json({ message: 'Données invalides' });

    try {
      const recu_numero = await generateReceiptNumber();
      const transId = dbAdmin.collection('transactions').doc().id;
      const createdAt = new Date().toISOString();

      await dbAdmin.runTransaction(async (transaction) => {
        // 1. PHASE DE LECTURE (TOUS LES GETS ICI)
        const studentRef = dbAdmin.collection('students').doc(studentId);
        const balanceRef = dbAdmin.collection('comptes').doc(accountType === 'banque' ? 'banque' : 'caisse');
        const scolariteRefBase = dbAdmin.collection('scolarites').doc(studentId); // Always read scolarites for summary
        const vorbereitungRefBase = dbAdmin.collection('vorbereitung').doc(studentId);

        // Fetching basics
        const [studentDoc, balanceDoc, scolariteSnap, vorbereitungSnap] = await Promise.all([
          transaction.get(studentRef),
          transaction.get(balanceRef),
          transaction.get(scolariteRefBase),
          transaction.get(vorbereitungRefBase)
        ]);

        if (!studentDoc.exists) throw new Error('Étudiant introuvable');
        const student = studentDoc.data() as any;

        // Fetch Level if needed for scolarite logic
        let levelSnap = null;
        if (student.levelId && typeof student.levelId === 'string') {
          levelSnap = await transaction.get(dbAdmin.collection('levels').doc(student.levelId));
        }

        // Fetch Inscription for Vacances if needed
        let insSnap = null;
        let insRef = null;
        if (type === 'vacances' && sessionId && typeof sessionId === 'string') {
          insRef = dbAdmin.collection('cours_vacances').doc(sessionId).collection('inscriptions').doc(studentId);
          insSnap = await transaction.get(insRef);
          if (!insSnap.exists) throw new Error("Inscription aux cours de vacances introuvable");
        }

        // 2. PHASE DE LOGIQUE ET D'ÉCRITURE (PAS DE GET APRÈS CETTE LIGNE)
        
        // Handle Vacances
        if (type === 'vacances' && insSnap && insRef) {
          const insData = insSnap.data() as any;
          const newTotalVerse = (Number(insData.total_verse) || 0) + amount;
          const totalDu = Number(insData.montant_total_du) || 0;
          
          transaction.update(insRef, {
            total_verse: newTotalVerse,
            reste: Math.max(0, totalDu - newTotalVerse),
            statut: newTotalVerse >= totalDu ? 'SOLDÉ' : 'EN COURS',
            updatedAt: createdAt
          });
          
          const vRef = insRef.collection('versements').doc(transId);
          transaction.set(vRef, {
            id: transId, montant: amount, date: date || createdAt,
            mode_paiement: paymentMethod || 'Espèces', recu_numero,
            notes: notes || `Paiement Cours Vacances: ${sessionTitle || ''}`,
            saisi_par: req.user.email
          });
        } 
        // Handle Scolarite or Vorbereitung
        else {
          const isVorbereitung = type === 'vorbereitung' || req.body.category === 'vorbereitung';
          const targetRef = isVorbereitung ? vorbereitungRefBase : scolariteRefBase;
          const targetSnap = isVorbereitung ? vorbereitungSnap : scolariteSnap;

          let dueAmt: number;
          let newTotal: number;

          if (!targetSnap.exists) {
            const lId = student.levelId;
            let due = (req.body.totalDue !== undefined) ? Number(req.body.totalDue) : 110000;
            if (req.body.totalDue === undefined) {
              if (student.totalTuition) due = Number(student.totalTuition);
              else if (lId && levelSnap && levelSnap.exists) due = levelSnap.data()?.tuition || 110000;
            }
            dueAmt = due;
            newTotal = amount;

            transaction.set(targetRef, {
              eleve_id: studentId, 
              matricule: student.matricule || '', 
              nom_eleve: `${student.firstName || ''} ${student.lastName || ''}`,
              montant_total_du: dueAmt, 
              total_verse: newTotal, 
              reste: Math.max(0, dueAmt - newTotal),
              surplus: newTotal > dueAmt,
              statut_paiement: newTotal >= dueAmt ? 'SOLDÉ' : (newTotal > 0 ? 'EN COURS' : 'NON PAYÉ'),
              createdAt,
              updatedAt: createdAt
            });
          } else {
            const sData = targetSnap.data() as any;
            dueAmt = Number(sData.montant_total_du) || 0;
            newTotal = (Number(sData.total_verse) || 0) + amount;

            transaction.update(targetRef, {
              total_verse: newTotal,
              reste: Math.max(0, dueAmt - newTotal),
              surplus: newTotal > dueAmt,
              statut_paiement: newTotal >= dueAmt ? 'SOLDÉ' : (newTotal > 0 ? 'EN COURS' : 'NON PAYÉ'),
              updatedAt: createdAt
            });
          }

          const vRefSub = targetRef.collection('versements').doc(transId);
          transaction.set(vRefSub, {
            id: transId, montant: amount, date: date || createdAt,
            mode_paiement: paymentMethod || 'Espèces', recu_numero,
            compte: accountType,
            notes: notes || '', saisi_par: req.user.email
          });
        }

        // ALSO Update the formal scolarite record for reporting/dashboard consistency (Sync logic)
        // If it wasn't already updated (e.g. it was a vacances or vorbereitung payment)
        if (type !== 'scolarite' && scolariteSnap.exists) {
          const scolaData = scolariteSnap.data() as any;
          const newTotalVerse = (Number(scolaData.total_verse) || 0) + amount;
          const due = Number(scolaData.montant_total_du) || student.totalTuition || 120000;
          const newReste = Math.max(0, due - newTotalVerse);
          const newStatut = newTotalVerse >= due ? 'SOLDÉ' : (newTotalVerse > 0 ? 'EN COURS' : 'NON PAYÉ');
          
          transaction.update(scolariteRefBase, {
            total_verse: newTotalVerse,
            reste: newReste,
            statut_paiement: newStatut,
            updatedAt: createdAt
          });
        }

        // Global Ledger & Balance
        const transRef = dbAdmin.collection('transactions').doc(transId);
        transaction.set(transRef, {
          id: transId,
          type: 'income',
          category: type || 'Scolarité',
          category_original: type,
          eleve_id: studentId,
          matricule: student.matricule || '',
          libelle: notes || `${type === 'vacances' ? 'Cours Vacances' : (type === 'vorbereitung' ? 'Vorbereitung' : 'Scolarité')} - ${student.firstName} ${student.lastName}`,
          montant: amount,
          date_versement: date || createdAt,
          mode_paiement: paymentMethod || 'Espèces',
          compte_destination: accountType,
          recu_numero,
          saisi_par: req.user.email,
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          modifié: false, supprimé: false
        });

        // Update Account Balance
        if (balanceDoc.exists) {
          transaction.update(balanceRef, {
            solde_actuel: admin.firestore.FieldValue.increment(amount),
            derniere_maj: admin.firestore.FieldValue.serverTimestamp()
          });
        } else {
          transaction.set(balanceRef, {
            solde_actuel: amount,
            derniere_maj: admin.firestore.FieldValue.serverTimestamp(),
            nom: accountType === 'banque' ? 'Compte Bancaire' : 'Caisse Principale'
          });
        }

        transaction.update(studentRef, {
          payments: admin.firestore.FieldValue.arrayUnion({
            amount, date: date || createdAt, receiptId: recu_numero,
            category: type || 'Scolarité', method: paymentMethod || 'Espèces', notes: notes || ''
          }),
          totalPaid: admin.firestore.FieldValue.increment(amount),
          reste: admin.firestore.FieldValue.increment(-amount),
          updatedAt: createdAt
        });

        let finalCategory = 'Scolarité';
        if (type === 'vorbereitung') finalCategory = 'Vorbereitung';
        if (type === 'vacances') finalCategory = 'vacances';

        transaction.set(dbAdmin.collection('finances').doc(transId), {
          id: transId, studentId, studentMatricule: student.matricule,
          studentName: `${student.firstName} ${student.lastName}`,
          amount, date: date || createdAt, type: 'income', category: finalCategory,
          method: paymentMethod || 'Espèces', accountType, notes: notes || '',
          receiptId: recu_numero, createdBy: req.user.id, createdAt, updatedAt: createdAt, status: 'active',
          sessionId: sessionId || null, sessionTitle: sessionTitle || null
        });
      });

      res.json({ message: 'Paiement enregistré', recu_numero });
    } catch (err: any) {
      console.error("Payment error detail:", err);
      res.status(500).json({ message: err.message });
    }
  });


  // 2. Diverse Income
  app.post('/api/finances/diverse', authenticate, async (req: any, res) => {
    const { libelle, amount, date, accountType, paymentMethod, notes } = req.body;
    if (!libelle || !amount || amount <= 0) return res.status(400).json({ message: 'Données invalides' });

    try {
      const transId = dbAdmin.collection('transactions').doc().id;
      const batch = dbAdmin.batch();

      batch.set(dbAdmin.collection('transactions').doc(transId), {
        id: transId, type: 'diverse', libelle, montant: amount, date_versement: date || new Date().toISOString(),
        mode_paiement: paymentMethod, compte_destination: accountType, saisi_par: req.user.email,
        timestamp_creation: admin.firestore.FieldValue.serverTimestamp(), notes: notes || '', modifié: false, supprimé: false
      });

      // ALSO UPDATE FINANCES
      batch.set(dbAdmin.collection('finances').doc(transId), {
        id: transId,
        type: 'income',
        category: 'Autre Revenu',
        description: libelle,
        amount: amount,
        date: date || new Date().toISOString(),
        method: paymentMethod,
        accountType: accountType,
        notes: notes || '',
        status: 'active',
        createdAt: new Date().toISOString(),
        createdBy: req.user.id
      });

      await ajusterSolde(accountType, amount, batch);
      await batch.commit();

      res.json({ message: 'Entrée diverse enregistrée' });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // 3. Sortie (Expense)
  app.post('/api/finances/sortie', authenticate, async (req: any, res) => {
    const { categorie, libelle, amount, date, accountType, paymentMethod, notes, teacherId } = req.body;
    if (!categorie || !amount || amount <= 0) return res.status(400).json({ message: 'Données invalides' });

    try {
      const sortieId = dbAdmin.collection('sorties').doc().id;
      const transId = dbAdmin.collection('transactions').doc().id;
      const batch = dbAdmin.batch();

      batch.set(dbAdmin.collection('sorties').doc(sortieId), {
        id: sortieId, categorie, libelle, montant: amount, date: date || new Date().toISOString(),
        source_compte: accountType, saisi_par: req.user.email, timestamp: admin.firestore.FieldValue.serverTimestamp(),
        notes: notes || '', teacherId: teacherId || null
      });

      batch.set(dbAdmin.collection('transactions').doc(transId), {
        id: transId, type: 'sortie', libelle: `SORTIE: ${categorie} - ${libelle}`, montant: -amount,
        date_versement: date || new Date().toISOString(), mode_paiement: paymentMethod, compte_destination: accountType,
        saisi_par: req.user.email, timestamp_creation: admin.firestore.FieldValue.serverTimestamp(),
        modifié: false, supprimé: false
      });

      // ALSO UPDATE FINANCES
      batch.set(dbAdmin.collection('finances').doc(transId), {
        id: transId,
        type: 'expense',
        category: categorie,
        description: libelle,
        amount: -Math.abs(amount),
        date: date || new Date().toISOString(),
        method: paymentMethod,
        accountType: accountType,
        notes: notes || '',
        status: 'active',
        createdAt: new Date().toISOString(),
        createdBy: req.user.id,
        teacherId: teacherId || null
      });

      await ajusterSolde(accountType, -amount, batch);

      // If salary, mark sessions as paid
      if (categorie === 'Salaires enseignants' && teacherId) {
        const sessions = await dbAdmin.collection('seances')
          .where('teacherId', '==', teacherId)
          .where('paymentStatus', '==', 'pending')
          .get();
        sessions.forEach(doc => batch.update(doc.ref, { paymentStatus: 'paid', paidAt: new Date().toISOString() }));
      }

      await batch.commit();
      res.json({ message: 'Sortie enregistrée' });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get('/api/finances', authenticate, async (req: any, res: any) => {
    try {
      const { studentId, month } = req.query;
      
      const [finSnap, transSnap] = await Promise.all([
        dbAdmin.collection('finances').where('status', '==', 'active').get(),
        dbAdmin.collection('transactions').get()
      ]);

      const finRecords = finSnap.docs.map(d => {
        const data = d.data();
        return { 
          id: d.id, 
          ...data,
          montant: Number(data.amount || data.montant || 0),
          date_versement: data.date || data.createdAt,
          libelle: data.notes || data.libelle || data.category || 'Paiement',
          compte_destination: data.accountType || data.compte_destination || 'caisse',
          source: 'finances'
        };
      });

      const transRecords = transSnap.docs
        .filter(d => !d.data().supprimé && d.data().status !== 'deleted')
        .map(d => {
          const data = d.data();
          return { 
            id: d.id, 
            ...data,
            montant: Number(data.montant || data.amount || 0),
            date_versement: data.date_versement || data.date || data.createdAt,
            libelle: data.libelle || data.notes || data.category || 'Transaction',
            compte_destination: data.compte_destination || data.accountType || 'caisse',
            source: 'transactions'
          };
        });

      let records = [...finRecords, ...transRecords];

      // Déduplication par ID (Donne la priorité aux enregistrements de 'finances' car ils sont souvent enrichis)
      const seenIds = new Set();
      const finalRecords = [];
      for (const r of records) {
        if (!seenIds.has(r.id)) {
          seenIds.add(r.id);
          finalRecords.push(r);
        }
      }

      let filtered = finalRecords;

      if (studentId) {
        filtered = filtered.filter((f: any) => (f.studentId === studentId || f.eleve_id === studentId));
      }

      if (month) {
        filtered = filtered.filter((f: any) => {
          const d = new Date(f.date_versement || f.date || f.createdAt);
          return d.getMonth().toString() === month;
        });
      }

      filtered.sort((a: any, b: any) => {
        const da = new Date(a.date_versement || a.date || a.createdAt).getTime();
        const dbValue = new Date(b.date_versement || b.date || b.createdAt).getTime();
        return dbValue - da;
      });

      res.json(filtered.slice(0, 1000));
    } catch (err: any) {
      console.error("Finance fetch error:", err);
      res.status(500).json({ message: err.message });
    }
  });

  // 4. Recalculate balances (Tool 1)
  app.post('/api/finances/recalculate', authenticate, checkSuperAdmin, async (req, res) => {
    try {
      const [txSnap, finSnap, sortiesSnap, studentsSnap] = await Promise.all([
        dbAdmin.collection('transactions').get(),
        dbAdmin.collection('finances').get(),
        dbAdmin.collection('sorties').get(),
        dbAdmin.collection('students').get()
      ]);
      
      const studentsMap = new Map(studentsSnap.docs.map(d => [d.id, d.data()]));
      
      let batch = dbAdmin.batch();
      let opCount = 0;
      let caisse = 0;
      let banque = 0;
      const seenIds = new Set();

      // Priorité 1: Transactions (Livre journal principal)
      txSnap.forEach(doc => {
        const tx = doc.data();
        if (tx.supprimé || tx.status === 'deleted') return;
        seenIds.add(doc.id);
        
        const montant = Number(tx.montant || tx.amount || 0);
        
        // --- SYNC TO FINANCES ---
        // Ensure this transaction exists in finances collection for the frontend
        if (!finSnap.docs.find(d => d.id === doc.id)) {
          const sid = tx.eleve_id || tx.studentId;
          const sName = tx.studentName || (studentsMap.get(sid)?.firstName + ' ' + studentsMap.get(sid)?.lastName);
          const sMatricule = tx.studentMatricule || studentsMap.get(sid)?.matricule;
          
          batch.set(dbAdmin.collection('finances').doc(doc.id), {
            id: doc.id,
            studentId: sid || null,
            studentMatricule: sMatricule || null,
            studentName: sName || tx.libelle || 'Inconnu',
            amount: montant,
            date: tx.date_versement || tx.date || tx.createdAt || new Date().toISOString(),
            type: tx.type === 'sortie' ? 'expense' : 'income',
            category: tx.type === 'scolarite' ? 'Scolarité' : 
                      tx.type === 'vorbereitung' ? 'Vorbereitung' : 
                      tx.type === 'inscription' ? 'Inscription' : 
                      tx.type === 'sortie' ? 'Dépense' : 'Autre',
            method: tx.mode_paiement || tx.method || 'Espèces',
            accountType: tx.compte_destination || tx.accountType || 'caisse',
            status: 'active',
            libelle: tx.libelle || tx.description,
            createdAt: tx.createdAt || tx.timestamp_creation || new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
          opCount++;
        }
        // -------------------------

        if (tx.type === 'virement_caisse_banque' || tx.type === 'virement_cb') {
          caisse -= montant; 
          banque += montant; 
          return;
        }
        
        // On saute les sorties car elles sont traitées via sortiesSnap pour plus de précision (legacy support)
        if (tx.type === 'sortie' || (tx.libelle && tx.libelle.startsWith('SORTIE:'))) return;
        
        const account = tx.compte_destination || tx.accountType || 'caisse';
        if (account === 'caisse') caisse += montant;
        else if (account === 'banque') banque += montant;
      });

      // Priority 2: Student creation inscriptions potentially missing in transactions but mentioned in students
      // We'll skip this for now as Fixed students now have it.

      // Priority 3: Finances (Already synced above or legacy)
      finSnap.forEach(doc => {
        if (seenIds.has(doc.id)) return;
        const f = doc.data();
        if (f.status === 'deleted' || f.supprimé) return;
        seenIds.add(doc.id);
        
        const amount = Number(f.amount || f.montant || 0);
        const account = f.accountType || f.compte_destination || 'caisse';
        if (account === 'caisse') caisse += amount;
        else if (account === 'banque') banque += amount;
      });

      // Priorité 3: Sorties (Spécifiques dépenses)
      sortiesSnap.forEach(doc => {
        const s = doc.data();
        if (s.supprimé || s.status === 'deleted') return;
        
        const montant = Number(s.montant || s.amount || 0);
        const account = s.source_compte || s.accountType || 'caisse';
        
        // On ne dédupe pas forcément par ID ici car les sorties peuvent avoir des IDs différents des transactions
        // Mais puisqu'on a sauté tx.type === 'sortie' plus haut, on évite le double comptage
        if (account === 'caisse') caisse -= montant;
        else if (account === 'banque') banque -= montant;
      });

      await dbAdmin.collection('comptes').doc('caisse').set({ 
        solde_actuel: caisse, 
        derniere_maj: admin.firestore.FieldValue.serverTimestamp(), 
        nom: 'Caisse Principale' 
      }, { merge: true });
      
      await dbAdmin.collection('comptes').doc('banque').set({ 
        solde_actuel: banque, 
        derniere_maj: admin.firestore.FieldValue.serverTimestamp(), 
        nom: 'Compte Bancaire' 
      }, { merge: true });

      if (opCount > 0) {
        await batch.commit();
      }

      res.json({ message: `Balances recalculées et ${opCount} transactions synchronisées.`, caisse, banque });
    } catch (err: any) {
      console.error("Recalculate error:", err);
      res.status(500).json({ message: err.message });
    }
  });

  // Tool 2: Cleanup Orphans
  app.post('/api/finances/cleanup-orphans', authenticate, checkSuperAdmin, async (req, res) => {
    try {
      const financesSnap = await dbAdmin.collection('finances').get();
      const legacyTransSnap = await dbAdmin.collection('transactions').get();
      const studentsSnap = await dbAdmin.collection('students').get();
      const studentIds = new Set(studentsSnap.docs.map(d => d.id));
      
      const orphansFinance = financesSnap.docs.filter(d => {
        const sid = d.data().studentId || d.data().eleve_id;
        return sid && !studentIds.has(sid);
      });

      const orphansLegacy = legacyTransSnap.docs.filter(d => {
        const sid = d.data().eleve_id || d.data().studentId;
        return sid && !studentIds.has(sid);
      });
      
      if (req.body.action === 'delete') {
        let batch = dbAdmin.batch();
        let count = 0;
        
        // Clean Finances
        for (const doc of orphansFinance) {
          batch.delete(doc.ref);
          count++;
          if (count >= 450) { await batch.commit(); batch = dbAdmin.batch(); count = 0; }
        }
        
        // Clean Legacy
        for (const doc of orphansLegacy) {
          batch.delete(doc.ref);
          count++;
          if (count >= 450) { await batch.commit(); batch = dbAdmin.batch(); count = 0; }
        }

        if (count > 0) await batch.commit();
        res.json({ message: `${orphansFinance.length + orphansLegacy.length} transactions orphelines supprimées` });
      } else {
        res.json({ 
          financeOrphans: orphansFinance.length, 
          legacyOrphans: orphansLegacy.length,
          total: orphansFinance.length + orphansLegacy.length 
        });
      }
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Tool 4: Integrity Check
  app.post('/api/finances/integrity', authenticate, checkSuperAdmin, async (req, res) => {
    try {
      const scolarites = await dbAdmin.collection('scolarites').get();
      const errors: any[] = [];
      const batch = dbAdmin.batch();
      let fixCount = 0;

      for (const doc of scolarites.docs) {
        const data = doc.data();
        const versements = await doc.ref.collection('versements').get();
        let sum = 0;
        versements.forEach(v => sum += (v.data().montant || 0));
        
        if (sum !== data.total_verse) {
          errors.push({ id: doc.id, expected: sum, found: data.total_verse });
          if (req.body.fix) {
            batch.update(doc.ref, { total_verse: sum, reste: Math.max(0, data.montant_total_du - sum) });
            fixCount++;
          }
        }
      }

      if (fixCount > 0) await batch.commit();
      res.json({ errors, fixed: fixCount });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // 11. SÉCURITÉ & VALIDATION (SaaS Level)
  // ... (leaving space for other logic)

  // Maintenance Endpoints
  app.post('/api/finances/recalculate-balances', authenticate, async (req: any, res) => {
    if (!req.user.isSuperAdmin && req.user.role !== 'admin') return res.status(403).json({ message: 'Interdit' });
    try {
      // 1. Fetch the absolute truth
      const [transSnap, sortiesSnap, existingFinSnap] = await Promise.all([
        dbAdmin.collection('transactions').get(),
        dbAdmin.collection('sorties').get(),
        dbAdmin.collection('finances').get()
      ]);

      const existingFinIds = new Set(existingFinSnap.docs.map(d => d.id));
      let caisse = 0;
      let banque = 0;
      let synched = 0;
      
      let batch = dbAdmin.batch();
      let multiCount = 0;

      const commitIfFull = async () => {
        if (multiCount >= 450) {
          await batch.commit();
          batch = dbAdmin.batch();
          multiCount = 0;
        }
      };

      // Process Transactions
      for (const doc of transSnap.docs) {
        const d = doc.data();
        if (d.supprimé || d.status === 'deleted') continue;
        
        const amt = Number(d.montant || d.amount || 0);
        const acc = d.compte_destination || d.accountType || 'caisse';
        
        // Skip sorties as they are in sorties collection in this DB structure
        if (d.type === 'sortie' || (d.libelle && d.libelle.startsWith('SORTIE:'))) continue;

        if (d.type === 'income' || d.type === 'diverse' || d.type === 'inscription' || d.type === 'scolarite' || d.type === 'vorbereitung') {
          if (acc === 'banque') banque += amt; else caisse += amt;
        } else if (d.type === 'expense') {
          if (acc === 'banque') banque -= amt; else caisse -= amt;
        } else if (d.type === 'virement_cb') {
          caisse -= amt; banque += amt;
        }

        // Sync to finances if missing
        if (!existingFinIds.has(doc.id)) {
          batch.set(dbAdmin.collection('finances').doc(doc.id), {
            id: doc.id,
            type: d.type === 'sortie' || d.type === 'expense' ? 'expense' : 'income',
            category: d.category || d.type || 'Autre',
            description: d.libelle || d.notes || 'Ancienne transaction',
            amount: amt,
            date: d.date_versement || d.date || d.createdAt || new Date().toISOString(),
            method: d.mode_paiement || 'Inconnu',
            accountType: acc,
            status: 'active',
            createdAt: d.createdAt || new Date().toISOString(),
            studentId: d.eleve_id || d.studentId || null,
            studentMatricule: d.matricule || null
          });
          synched++; multiCount++; await commitIfFull();
        }
      }

      // Process Sorties
      for (const doc of sortiesSnap.docs) {
        const d = doc.data();
        if (d.supprimé || d.status === 'deleted') continue;
        const amt = Number(d.montant || 0);
        const acc = d.source_compte || d.accountType || 'caisse';
        
        if (acc === 'banque') banque -= amt; else caisse -= amt;

        if (!existingFinIds.has(doc.id)) {
          batch.set(dbAdmin.collection('finances').doc(doc.id), {
            id: doc.id,
            type: 'expense',
            category: d.categorie || 'Dépense',
            description: d.libelle || d.notes || 'Ancienne dépense',
            amount: -Math.abs(amt),
            date: d.date || d.createdAt || new Date().toISOString(),
            method: d.mode_paiement || 'Espèces',
            accountType: acc,
            status: 'active',
            createdAt: d.createdAt || new Date().toISOString(),
            teacherId: d.teacherId || null
          });
          synched++; multiCount++; await commitIfFull();
        }
      }

      if (multiCount > 0) await batch.commit();

      // Final Balance Sync
      await dbAdmin.collection('comptes').doc('caisse').set({ 
        solde_actuel: caisse, 
        derniere_maj: new Date().toISOString(),
        nom: 'Caisse Principale'
      }, { merge: true });
      await dbAdmin.collection('comptes').doc('banque').set({ 
        solde_actuel: banque, 
        derniere_maj: new Date().toISOString(),
        nom: 'Compte Bancaire'
      }, { merge: true });
      
      res.json({ caisse, banque, synchedToArchive: synched });
    } catch (err: any) {
      console.error("Critical recalculate logic error:", err);
      res.status(500).json({ message: err.message });
    }
  });

  // Nuclear Option: Format application
  app.post('/api/admin/format', authenticate, async (req: any, res: any) => {
    try {
      const userDoc = await dbAdmin.collection('users').doc(req.user.id).get();
      const userData = userDoc.data();
      if (!userData?.isSuperAdmin) {
        return res.status(403).json({ message: "Seul un Super Administrateur peut formater l'application." });
      }

      const confirmation = req.body?.confirmation;
      if (confirmation !== 'FORMAT_NUCLEAR') {
        return res.status(400).json({ message: "Code de confirmation incorrect." });
      }

      const batchLimit = 500;
      const collectionsToWipe = [
        'finances', 'scolarites', 'evaluations', 'presences', 'bulletins', 
        'bulletins_archives', 'classes', 'cours', 'examens', 'notifications', 
        'audit_logs', 'library', 'messages'
      ];

      for (const collName of collectionsToWipe) {
        const snapshot = await dbAdmin.collection(collName).limit(batchLimit).get();
        if (snapshot.size > 0) {
          const batch = dbAdmin.batch();
          snapshot.docs.forEach(doc => batch.delete(doc.ref));
          await batch.commit();
        }
      }

      // Special handling for users: keep Super Admins
      const usersSnap = await dbAdmin.collection('users').get();
      const userBatch = dbAdmin.batch();
      let deletedCount = 0;
      usersSnap.docs.forEach(doc => {
        const u = doc.data();
        if (!u.isSuperAdmin) {
          userBatch.delete(doc.ref);
          deletedCount++;
        }
      });
      if (deletedCount > 0) await userBatch.commit();

      res.json({ message: "Application formatée avec succès. Données supprimées, Super-Admins conservés." });
    } catch (err: any) {
      console.error("Format error:", err);
      res.status(500).json({ message: err.message });
    }
  });

  app.delete('/api/finances/:id', authenticate, async (req: any, res: any) => {
    try {
      const userSnap = await dbAdmin.collection('users').doc(req.user.id).get();
      const userData = userSnap.data();
      const isPowerUser = userData?.role === 'admin' || userData?.isSuperAdmin;
      
      if (!isPowerUser) return res.status(403).json({ message: "Interdit: Droits d'administrateur requis pour annuler une transaction." });
      
      const { id } = req.params;
      const reason = (req.body && req.body.reason) ? req.body.reason : 'Suppression manuelle';

      await dbAdmin.runTransaction(async (transaction) => {
        // 1. Fetch the transaction
        const financeRef = dbAdmin.collection('finances').doc(id);
        const fSnap = await transaction.get(financeRef);
        
        if (!fSnap.exists) throw new Error('Transaction introuvable');
        
        const fData = fSnap.data() as any;
        if (fData.status === 'deleted') throw new Error('Transaction déjà supprimée');

        const amount = Number(fData.amount || fData.montant || 0);
        const studentId = fData.studentId || fData.eleve_id;
        const account = fData.accountType || fData.compte_destination || 'caisse';
        const category = fData.category || fData.type_versement;

        // READ ALL NECESSARY DOCS
        const balanceRef = dbAdmin.collection('comptes').doc(account === 'banque' ? 'banque' : 'caisse');
        const sRef = studentId ? dbAdmin.collection('students').doc(studentId) : null;
        
        const [bSnap, sSnap] = await Promise.all([
          transaction.get(balanceRef),
          sRef ? transaction.get(sRef) : Promise.resolve(null)
        ]);

        let scodaRef = null;
        let scodaSnap = null;
        if (studentId && ['Scolarité', 'vorbereitung', 'Vorbereitung'].includes(category)) {
          const coll = ['vorbereitung', 'Vorbereitung'].includes(category) ? 'vorbereitung' : 'scolarites';
          scodaRef = dbAdmin.collection(coll).doc(studentId);
          scodaSnap = await transaction.get(scodaRef);
        }

        // Handle Vacances Inscriptions
        let insRef = null;
        let insSnap = null;
        if (studentId && ['vacances', 'vacance', 'Cours de Vacances', 'Vacances'].includes(category)) {
           // We need to find the session. If sessionId is missing, we might have trouble but let's try
           if (fData.sessionId) {
              insRef = dbAdmin.collection('cours_vacances').doc(fData.sessionId).collection('inscriptions').doc(studentId);
              insSnap = await transaction.get(insRef);
           }
        }

        // 2. PHASE D'ÉCRITURE (PAS DE GET APRÈS CETTE LIGNE)
        
        // Reverse balance
        if (bSnap.exists) {
          transaction.update(balanceRef, {
            solde_actuel: admin.firestore.FieldValue.increment(-amount),
            derniere_maj: new Date().toISOString()
          });
        }

        // 3. Update Scolarité/Vorbereitung module
        if (scodaSnap && scodaSnap.exists && scodaRef) {
          const s = scodaSnap.data() as any;
          const newTotal = Math.max(0, (Number(s.total_verse) || 0) - amount);
          const due = Number(s.montant_total_du) || 0;
          transaction.update(scodaRef, {
            total_verse: newTotal,
            reste: Math.max(0, due - newTotal),
            statut_paiement: newTotal >= due ? 'SOLDÉ' : (newTotal > 0 ? 'EN COURS' : 'NON PAYÉ'),
            updatedAt: new Date().toISOString()
          });
          // Also delete from subcollection versements if exists
          transaction.delete(scodaRef.collection('versements').doc(id));
        }

        // 4. Update Vacances module
        if (insSnap && insSnap.exists && insRef) {
          const i = insSnap.data() as any;
          const newTotal = Math.max(0, (Number(i.total_verse) || 0) - amount);
          const due = Number(i.montant_total_du) || 0;
          transaction.update(insRef, {
            total_verse: newTotal,
            reste: Math.max(0, due - newTotal),
            statut: newTotal >= due ? 'SOLDÉ' : (newTotal > 0 ? 'EN COURS' : 'EN ATTENTE'),
            updatedAt: new Date().toISOString()
          });
          transaction.delete(insRef.collection('versements').doc(id));
        }

        // 5. Update main student record payments array
        if (sSnap && sSnap.exists && sRef) {
          const sData = sSnap.data() as any;
          const updatedPayments = (sData.payments || []).filter((p: any) => p.id !== id);
          transaction.update(sRef, { payments: updatedPayments });
        }

        // 6. Soft delete main transaction and ledger entry
        transaction.update(financeRef, {
          status: 'deleted',
          deletedAt: new Date().toISOString(),
          deletedBy: req.user.email,
          deletionReason: reason
        });

        const transLedgerRef = dbAdmin.collection('transactions').doc(id);
        transaction.update(transLedgerRef, {
          supprimé: true,
          deletedAt: new Date().toISOString(),
          deletedBy: req.user.email,
          deletionReason: reason
        });
      });

      addLog('INFO', `Transaction annulée: ${id}`, { reason, by: req.user.email });
      res.json({ message: 'Transaction annulée avec succès et soldes mis à jour.' });
    } catch (err: any) {
      console.error("Finance delete error:", err);
      res.status(500).json({ message: err.message });
    }
  });

  app.put('/api/finances/:id', authenticate, async (req: any, res: any) => {
    try {
      if (req.user.role !== 'admin') return res.status(403).json({ message: "Interdit" });
      const { id } = req.params;
      
      await dbAdmin.collection('finances').doc(id).update({
        ...req.body,
        updatedAt: new Date().toISOString(),
        updatedBy: req.user.id
      });
      
      res.json({ message: 'Transaction mise à jour' });
    } catch (err: any) {
      console.error("Finance update error:", err);
      res.status(500).json({ message: err.message });
    }
  });

  app.put('/api/finances/update-due/:id', authenticate, async (req: any, res: any) => {
    const { montant_total_du, type } = req.body;
    const studentId = req.params.id;
    const coll = (type === 'vorbereitung') ? 'vorbereitung' : 'scolarites';

    try {
      await dbAdmin.runTransaction(async (transaction) => {
        const ref = dbAdmin.collection(coll).doc(studentId);
        const snap = await transaction.get(ref);
        
        const newDue = Number(montant_total_du);
        
        if (!snap.exists) {
           // Fetch student name and matricule for better scolarite/vorbereitung record
           const studentRef = dbAdmin.collection('students').doc(studentId);
           const sSnap = await transaction.get(studentRef);
           const sData = sSnap.data() || {};
           
           transaction.set(ref, {
             eleve_id: studentId,
             matricule: sData.matricule || '',
             nom_eleve: `${sData.firstName || ''} ${sData.lastName || ''}`,
             montant_total_du: newDue,
             total_verse: 0,
             reste: newDue,
             surplus: false,
             statut_paiement: newDue === 0 ? 'SOLDÉ' : 'NON PAYÉ',
             createdAt: new Date().toISOString(),
             updatedAt: new Date().toISOString()
           });
        } else {
          const data = snap.data() as any;
          const totalVerse = data.total_verse || 0;

          transaction.update(ref, {
            montant_total_du: newDue,
            reste: Math.max(0, newDue - totalVerse),
            surplus: totalVerse > newDue,
            statut_paiement: totalVerse >= newDue ? 'SOLDÉ' : (totalVerse > 0 ? 'EN COURS' : 'NON PAYÉ'),
            updatedAt: new Date().toISOString()
          });
        }
      });
      res.json({ message: 'Objectif mis à jour' });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post('/api/finances', authenticate, async (req: any, res: any) => {
    try {
      if (req.user.role !== 'admin') return res.status(403).json({ message: "Interdit" });
      
      const id = dbAdmin.collection('finances').doc().id;
      const record = {
        ...req.body,
        id,
        createdBy: req.user.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: req.body.status || 'active'
      };
      
      await dbAdmin.collection('finances').doc(id).set(record);
      
      // SYNC: Update student totals if it's a tuition-related payment
      const category = (record.category || '').toLowerCase();
      const studentId = record.studentId || record.eleve_id;
      const amount = Number(record.amount || record.montant || 0);
      
      if (studentId && record.status !== 'deleted' && record.type === 'income' && 
          (category.includes('scolarit') || category.includes('scola') || category.includes('vorbereitung') || category.includes('vacances') || category.includes('inscription') || category.includes('tranche') || category.includes('versement') || category.includes('paiement'))) {
        try {
          const studentRef = dbAdmin.collection('students').doc(studentId);
          const studentSnap = await studentRef.get();
          if (studentSnap.exists) {
            const studentData = studentSnap.data() as any;
            const newTotalPaid = (Number(studentData.totalPaid) || 0) + amount;
            const tuition = Number(studentData.totalTuition) || 0;
            
            await studentRef.update({
              totalPaid: newTotalPaid,
              reste: Math.max(0, tuition - newTotalPaid),
              updatedAt: new Date().toISOString()
            });
            
            // Also update scolarites collection
            const scolaRef = dbAdmin.collection('scolarites').doc(studentId);
            const scolaSnap = await scolaRef.get();
            if (scolaSnap.exists) {
              const scolaData = scolaSnap.data() as any;
              const scolaTotal = (Number(scolaData.total_verse) || 0) + amount;
              const scolaDue = Number(scolaData.montant_total_du) || tuition || 0;
              await scolaRef.update({
                total_verse: scolaTotal,
                reste: Math.max(0, scolaDue - scolaTotal),
                statut_paiement: scolaTotal >= scolaDue ? 'SOLDÉ' : (scolaTotal > 0 ? 'EN COURS' : 'NON PAYÉ'),
                updatedAt: new Date().toISOString()
              });
            }
          }
        } catch (syncErr) {
          console.error("[SYNC] Error syncing student on manual finance creation:", syncErr);
        }
      }
      
      // Audit Log
      const auditId = dbAdmin.collection('audit_logs').doc().id;
      await dbAdmin.collection('audit_logs').doc(auditId).set({
        id: auditId,
        userId: req.user.id,
        userName: req.user.email,
        action: 'CREATE_FINANCE_MANUAL',
        resourceType: 'FINANCE',
        resourceId: id,
        newValue: record,
        timestamp: new Date().toISOString()
      });

      res.json(record);
    } catch (err: any) {
      console.error("Finance create error:", err);
      res.status(500).json({ message: err.message });
    }
  });

  app.get('/api/audit-logs', authenticate, async (req: any, res: any) => {
    try {
      if (req.user.role !== 'admin') return res.status(403).json({ message: "Interdit" });
      const snapshot = await dbAdmin.collection('audit_logs').orderBy('timestamp', 'desc').limit(200).get();
      res.json(snapshot.docs.map(doc => doc.data()));
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

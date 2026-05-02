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
import nodemailer from 'nodemailer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'dia-secret-key-2026';
const UPLOADS_DIR = path.join(process.cwd(), 'uploads');
const APP_NAME = process.env.APP_NAME || 'DIA DEUTSCH INSTITUT';
const WHATSAPP_SENDER_NUMBER = process.env.WHATSAPP_SENDER_NUMBER || '654491319';

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
function addLog(type: 'INFO' | 'ERROR' | 'EMAIL' | 'AUTH', message: string, details?: any) {
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

// Email Transporter Config
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || (process.env.SMTP_HOST?.includes('gmail') ? '465' : '587')),
  secure: process.env.SMTP_PORT === '465', 
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  tls: {
    rejectUnauthorized: false,
    minVersion: 'TLSv1.2'
  },
  family: 4, // Strict IPv4 to avoid timeouts on IPv6 failover
  connectionTimeout: 10000, 
  greetingTimeout: 10000,
  socketTimeout: 15000,
} as any);

// Verify SMTP connection at startup (non-blocking)
let isSmtpOperational = false;
let lastSmtpError = "";
if (process.env.SMTP_USER && process.env.SMTP_PASS) {
  console.log("📨 SMTP: Initialisation en arrière-plan...");
  transporter.verify().then(() => {
    console.log("✅ SMTP Server is ready");
    isSmtpOperational = true;
    lastSmtpError = "";
    if (dbAdmin) addLog('INFO', "Connexion SMTP établie avec succès");
  }).catch((error) => {
    const isNetworkError = error.code === 'ENETUNREACH' || error.message.includes('ENETUNREACH') || error.message.includes('timeout');
    let errorMsg = isNetworkError 
      ? `SMTP: Port bloqué par l'environnement Cloud. Port: ${process.env.SMTP_PORT || '465/587'}.` 
      : `SMTP: Erreur de configuration: ${error.message}`;
    
    console.warn("⚠️  " + errorMsg);
    isSmtpOperational = false;
    lastSmtpError = errorMsg;
    if (dbAdmin) addLog('ERROR', "SMTP non disponible (Réseau restreint)", errorMsg);
  });
} else {
  console.log("ℹ️ SMTP credentials not provided, email features will be disabled.");
}

async function sendEmail(to: string, subject: string, text: string, html?: string, cc?: string) {
  const from = process.env.SMTP_FROM || `"DIA_SAAS" <gabrielyombi311@gmail.com>`;

  // 1. Try Resend API (HTTPS - Recommended for Cloud)
  if (process.env.RESEND_API_KEY) {
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: from.includes('<') ? from : `"System" <${from}>`,
          to: cc ? [to, cc] : to,
          subject: subject,
          text: text,
          html: html || text
        })
      });
      if (response.ok) {
        addLog('EMAIL', `Email (API Resend) envoyé à ${to}`, { subject });
        return;
      }
      const err = await response.json();
      console.error("❌ Resend API Error:", err);
    } catch (e: any) {
      console.error("❌ Resend Fetch Error:", e.message);
    }
  }

  // 2. Try Brevo API (HTTPS)
  if (process.env.BREVO_API_KEY) {
    try {
      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': process.env.BREVO_API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sender: { email: from.match(/<(.+)>/)?.[1] || from, name: "DIA SAAS" },
          to: [{ email: to }],
          bcc: cc ? [{ email: cc }] : undefined,
          subject: subject,
          textContent: text,
          htmlContent: html || text
        })
      });
      if (response.ok) {
        addLog('EMAIL', `Email (API Brevo) envoyé à ${to}`, { subject });
        return;
      }
    } catch (e: any) {
      console.error("❌ Brevo Fetch Error:", e.message);
    }
  }

  // 3. Fallback to SMTP
  if (process.env.SMTP_USER && process.env.SMTP_PASS && isSmtpOperational) {
    console.log(`[EMAIL START] Attempting SMTP send to ${to}...`);
    try {
      const info = await transporter.sendMail({
        from,
        to,
        cc,
        subject,
        text,
        html,
      });
      addLog('EMAIL', `Email (SMTP) envoyé avec succès à ${to}`, { messageId: info.messageId, cc });
      return;
    } catch (err: any) {
      addLog('ERROR', `Échec de l'envoi d'email SMTP à ${to}`, err.message);
    }
  }

  // 4. Fallback to simulation
  console.log(`[EMAIL SIMULATION] to ${to}${cc ? ' cc ' + cc : ''}: ${subject}\n${text}`);
}

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
          { id: 'a1', name: 'A1', tuition: 150000, hours: 120 },
          { id: 'a2', name: 'A2', tuition: 175000, hours: 120 },
          { id: 'b1', name: 'B1', tuition: 200000, hours: 160 },
          { id: 'b2', name: 'B2', tuition: 250000, hours: 180 },
          { id: 'c1', name: 'C1', tuition: 350000, hours: 200 }
        ];
        for (const level of initialLevels) {
          await dbAdmin.collection('levels').doc(level.id).set(level);
        }
        console.log("Levels bootstrapped.");
      }

      // Bootstrap Admins
      const admins = [
        { email: 'yombivictor@gmail.com', firstName: 'Victor', lastName: 'Yombi', matricule: 'SUPERADMIN', isSuperAdmin: true },
        { email: 'gabrielyombi311@gmail.com', firstName: 'Gabriel', lastName: 'Yombi', matricule: 'ADMIN_GABRIEL', isSuperAdmin: false }
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
        
        // Fetch role from Firestore if not in token
        if (!decodedToken.role) {
          const userDoc = await dbAdmin.collection('users').doc(decodedToken.uid).get();
          if (userDoc.exists) {
            req.user.role = userDoc.data()?.role || 'user';
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
      configProjectId: firebaseConfig.projectId,
      smtp: isSmtpOperational,
      smtpError: lastSmtpError,
      smtpConfigured: !!(process.env.SMTP_USER && process.env.SMTP_PASS),
      emailApiActive: !!(process.env.RESEND_API_KEY || process.env.BREVO_API_KEY),
      firebaseServiceAccountMissing: !process.env.FIREBASE_SERVICE_ACCOUNT,
      smtpPassMissing: !process.env.SMTP_PASS
    });
  });

  app.get('/api/admin/logs', authenticate, (req: any, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Interdit' });
    res.json({ logs: serverLogs });
  });

  app.post('/api/health/test-email', authenticate, async (req: any, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Interdit' });
    
    try {
      await sendEmail(
        req.user.email,
        "Test de configuration DIA_SAAS",
        "Ceci est un email de test pour vérifier la configuration de votre centre. Si vous recevez ce message, vos emails fonctionnent (via API ou SMTP) !"
      );
      res.json({ message: 'Email de test envoyé avec succès.' });
    } catch (err: any) {
      res.status(500).json({ message: `Erreur d'envoi : ${err.message}` });
    }
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
    addLog('AUTH', `Tentative de recherche d'email pour: ${matricule}`);
    
    if (!isFirebaseAdminInitialized) {
      addLog('ERROR', "Login: Firebase Admin non initialisé");
      return res.status(503).json({ message: 'Service temporairement indisponible (Firebase non initialisé)' });
    }

    try {
      // Look up user by matricule in Firestore
      const userQuery = await dbAdmin.collection('users').where('matricule', '==', matricule.toUpperCase()).get();
      let userDoc = userQuery.docs[0];
      
      if (!userDoc) {
        addLog('INFO', `Matricule ${matricule} non trouvé, essai par email...`);
        const emailQuery = await dbAdmin.collection('users').where('email', '==', matricule.toLowerCase()).get();
        userDoc = emailQuery.docs[0];
      }

      if (!userDoc) {
        addLog('AUTH', `Aucun profil trouvé pour: ${matricule}`);
        return res.status(401).json({ message: 'Identifiants incorrects' });
      }

      const userData = userDoc.data();
      addLog('AUTH', `Email trouvé pour ${matricule}: ${userData.email}`);
      res.json({ user: userData });
    } catch (err: any) {
      addLog('ERROR', `Erreur lors du login/lookup pour ${matricule}`, err.message);
      res.status(500).json({ message: err.message });
    }
  });

  app.post('/api/notifications/send-whatsapp', authenticate, async (req: any, res) => {
    // Only allow admins and teachers to send notifications
    if (req.user.role !== 'admin' && req.user.role !== 'teacher') {
      return res.status(403).json({ message: 'Droits insuffisants' });
    }

    const { phone, message } = req.body;
    
    if (!phone || !message) {
      return res.status(400).json({ message: 'Numéro ou message manquant' });
    }

    try {
      // In a real implementation, you would use a WhatsApp Gateway here (e.g., Twilio, Z-API, etc.)
      // For now, we log the attempt with the configured sender number
      console.log(`[WhatsApp Notification] DE: ${WHATSAPP_SENDER_NUMBER} -> A: ${phone}`);
      console.log(`[WhatsApp Message] ${message}`);
      
      addLog('INFO', `Notification WhatsApp envoyée à ${phone} via ${WHATSAPP_SENDER_NUMBER}`);
      
      res.json({ 
        success: true, 
        sender: WHATSAPP_SENDER_NUMBER,
        message: 'Notification envoyée (Simulation)' 
      });
    } catch (err: any) {
      console.error("WhatsApp notification error:", err);
      res.status(500).json({ message: 'Erreur lors de l\'envoi WhatsApp' });
    }
  });

  app.post('/api/notifications/send-email', authenticate, async (req: any, res) => {
    // Only allow admins and teachers to send notifications
    if (req.user.role !== 'admin' && req.user.role !== 'teacher') {
      return res.status(403).json({ message: 'Droits insuffisants' });
    }

    const { to, cc, subject, text, html, pushTitle, pushBody } = req.body;
    
    if (!to || !subject || (!text && !html)) {
      return res.status(400).json({ message: 'Données manquantes pour l\'envoi de l\'email' });
    }

    try {
      // Async send to avoid blocking the client
      sendEmail(to, subject, text, html, cc).catch(e => console.error("Notification API email error:", e));
      
      // If push info is provided, try to find user's token and send push
      if (pushTitle && pushBody) {
        const usersRef = dbAdmin.collection('users');
        const snapshot = await usersRef.where('email', '==', to).get();
        if (!snapshot.empty) {
          const userDoc = snapshot.docs[0].data();
          if (userDoc.fcmToken) {
            sendPushNotification([userDoc.fcmToken], pushTitle, pushBody).catch(e => console.error("Push error:", e));
          }
        }
      }

      res.json({ message: 'Notification envoyée' });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // API to send a communique to multiple users
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
      const emails: string[] = [];
      
      snapshot.forEach(doc => {
        const data = doc.data();
        if (data.fcmToken) tokens.push(data.fcmToken);
        if (data.email) emails.push(data.email);
      });

      // 2. Send Push
      if (tokens.length > 0) {
        sendPushNotification(tokens, `Communiqué: ${title}`, content, { type: 'communique', id: docRef.id });
      }

      // 3. Send Emails (batched slightly)
      emails.forEach(email => {
        const html = `
          <div style="font-family: sans-serif; max-width: 600px; padding: 20px; border: 1px solid #eee; border-radius: 12px;">
            <h2 style="color: #E31E24;">Communiqué Officiel - DIA_SAAS</h2>
            <h3 style="margin-top: 20px;">${title}</h3>
            <div style="padding: 15px; background: #f9f9f9; border-left: 4px solid #E31E24; margin: 20px 0; white-space: pre-wrap;">
              ${content}
            </div>
            <p style="font-size: 12px; color: #888;">Envoyé par l'administration le ${new Date(createdAt).toLocaleString('fr-FR')}</p>
            <p><a href="${process.env.APP_URL || 'https://' + req.get('host')}/login" style="color: #E31E24; font-weight: bold;">Consulter les archives</a></p>
          </div>
        `;
        sendEmail(email, `[COMMUNIQUÉ] ${title}`, content, html).catch(e => console.error(`Communique email failed for ${email}:`, e));
      });

      res.json({ id: docRef.id, message: 'Communiqué créé et distribué' });
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

    const { email, password, firstName, lastName, matricule } = req.body;
    
    try {
      const userRecord = await authAdmin.createUser({
        email,
        password: password || 'Admin.1234',
        displayName: `${firstName} ${lastName}`,
      });

      const newAdmin = {
        uid: userRecord.uid,
        email,
        firstName,
        lastName,
        matricule: matricule.toUpperCase(),
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

  app.delete('/api/admins/:id', authenticate, async (req: any, res) => {
    try {
      const currentUserDoc = await dbAdmin.collection('users').doc(req.user.id).get();
      const isSuperAdmin = currentUserDoc.data()?.isSuperAdmin;

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

  app.post('/api/students/resend-credentials/:id', authenticate, async (req: any, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Interdit' });
    try {
      const studentDoc = await dbAdmin.collection('users').doc(req.params.id).get();
      if (!studentDoc.exists) return res.status(404).json({ message: 'Étudiant non trouvé' });
      const student = studentDoc.data();
      
      const newPassword = 'DIA' + Math.floor(1000 + Math.random() * 9000) + '.';
      await authAdmin.updateUser(req.params.id, { password: newPassword });
      
      // The frontend NotificationService will be called or we can trigger it here.
      // Actually the frontend calls this, so we just return the password and let the frontend send the email.
      // Or we can send it from here. The frontend expects a success message.
      // Re-reading logic: the frontend calls this and expects success.
      
      res.json({ message: 'Mot de passe réinitialisé', password: newPassword });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post('/api/students/send-receipt-email', authenticate, async (req: any, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Interdit' });
    const { studentId, html } = req.body;
    try {
      const studentDoc = await dbAdmin.collection('users').doc(studentId).get();
      if (!studentDoc.exists) return res.status(404).json({ message: 'Étudiant non trouvé' });
      const student = studentDoc.data();
      
      const subject = `Reçu de Scolarité - ${student.firstName} ${student.lastName}`;
      await sendEmail(student.email, subject, "Veuillez trouver ci-joint votre reçu de scolarité.", html, student.parentEmail);
      
      res.json({ message: 'Reçu envoyé' });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post('/api/system/reset', authenticate, async (req: any, res) => {
    try {
      const currentUserDoc = await dbAdmin.collection('users').doc(req.user.id).get();
      const userData = currentUserDoc.data();
      
      if (!userData || !userData.isSuperAdmin) {
        return res.status(403).json({ message: 'Seul le Super Administrateur peut réinitialiser le système' });
      }

      const { confirmation } = req.body;
      if (confirmation !== 'RESET_FACTORY') {
        return res.status(400).json({ message: 'Code de confirmation incorrect' });
      }

      addLog('INFO', `Démarrage de la réinitialisation système par ${userData.email}`);

      const collectionsToReset = [
        'students', 'teachers', 'classes', 'levels', 'finances', 
        'library', 'communiques', 'notifications', 'attendances', 
        'exams', 'messages'
      ];

      // Delete all docs in specified collections
      for (const collName of collectionsToReset) {
        const snapshot = await dbAdmin.collection(collName).get();
        if (snapshot.empty) continue;
        
        const chunks = [];
        for (let i = 0; i < snapshot.docs.length; i += 500) {
          chunks.push(snapshot.docs.slice(i, i + 500));
        }

        for (const chunk of chunks) {
          const batch = dbAdmin.batch();
          chunk.forEach((doc) => batch.delete(doc.ref));
          await batch.commit();
        }
        addLog('INFO', `Collection ${collName} vidée`);
      }

      // Handle users collection: delete all except super admins
      const usersSnapshot = await dbAdmin.collection('users').get();
      const usersBatch = dbAdmin.batch();
      let deletedUsersCount = 0;
      usersSnapshot.docs.forEach((doc) => {
        const data = doc.data();
        if (!data.isSuperAdmin) {
          usersBatch.delete(doc.ref);
          deletedUsersCount++;
        }
      });
      if (deletedUsersCount > 0) {
        await usersBatch.commit();
      }
      addLog('INFO', `Utilisateurs non-admins supprimés (${deletedUsersCount})`);

      // Re-bootstrap indispensable data (Levels)
      const initialLevels = [
        { id: 'a1', name: 'A1', tuition: 150000, hours: 120 },
        { id: 'a2', name: 'A2', tuition: 175000, hours: 120 },
        { id: 'b1', name: 'B1', tuition: 200000, hours: 160 },
        { id: 'b2', name: 'B2', tuition: 250000, hours: 180 },
        { id: 'c1', name: 'C1', tuition: 350000, hours: 200 }
      ];
      for (const level of initialLevels) {
        await dbAdmin.collection('levels').doc(level.id).set(level);
      }
      addLog('INFO', `Niveaux réinitialisés aux valeurs d'origine`);

      res.json({ message: 'Système réinitialisé avec succès. Les données ont été formatées mais les comptes Super Admin ont été conservés.' });
    } catch (err: any) {
      addLog('ERROR', `Échec de la réinitialisation système`, err.message);
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

      // Record initial payments in finances
      if (newStudent.payments) {
        for (const p of newStudent.payments) {
          if (p.amount > 0) {
            const financeId = Date.now().toString() + Math.random().toString(36).substr(2, 5);
            const financeRecord = {
              id: financeId,
              type: 'income',
              amount: p.amount,
              description: `Scolarité (Initial) - ${newStudent.matricule} - Tranche ${p.tranche}`,
              category: 'Tuition',
              date: p.date || new Date().toISOString()
            };
            await dbAdmin.collection('finances').doc(financeId).set(financeRecord);
          }
        }
      }
      
      // Envoi d'email réel (Non-bloquant pour éviter le chargement infini)
      const emailSubject = "Bienvenue chez DIA_SAAS - Vos identifiants";
      const emailText = `Bonjour ${studentData.firstName},\n\nBienvenue chez DIA_SAAS !\n\nVoici vos identifiants de connexion :\nMatricule : ${studentData.matricule}\nMot de passe : ${password || 'DIA2026.'}\n\nLien de connexion : ${req.headers.origin}/login`;
      const emailHtml = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <h2 style="color: #E31E24;">Bienvenue chez DIA_SAAS !</h2>
          <p>Bonjour <strong>${studentData.firstName}</strong>,</p>
          <p>Votre compte a été créé avec succès. Voici vos identifiants de connexion :</p>
          <div style="background: #f9f9f9; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>Matricule :</strong> ${studentData.matricule}</p>
            <p style="margin: 5px 0;"><strong>Mot de passe :</strong> ${password || 'DIA2026.'}</p>
          </div>
          <p>Vous pouvez vous connecter ici : <a href="${req.headers.origin}/login" style="color: #E31E24; font-weight: bold;">Accéder au portail</a></p>
          <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="font-size: 12px; color: #999;">Ceci est un message automatique, merci de ne pas y répondre.</p>
        </div>
      `;
      
      // On lance l'envoi sans attendre le résultat pour la réponse API
      sendEmail(studentData.email, emailSubject, emailText, emailHtml).catch(e => console.error("Async email error:", e));
      
      res.json(newStudent);
    } catch (err: any) {
      console.error("Error creating student in Firebase:", err);
      if (err.code === 'auth/operation-not-allowed') {
        return res.status(500).json({ 
          message: "L'authentification par Email/Mot de passe n'est pas activée dans votre console Firebase. Veuillez l'activer dans 'Authentication' > 'Sign-in method'." 
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

  app.post('/api/students/resend-credentials/:id', authenticate, async (req: any, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Interdit' });
    
    try {
      const studentDoc = await dbAdmin.collection('students').doc(req.params.id).get();
      if (!studentDoc.exists) return res.status(404).json({ message: 'Étudiant non trouvé' });
      const studentData = studentDoc.data() as any;
      
      const newPassword = 'DIA' + Math.floor(1000 + Math.random() * 9000) + '.';
      
      await authAdmin.updateUser(req.params.id, {
        password: newPassword
      });

      const emailSubject = "Réinitialisation de vos identifiants - DIA_SAAS";
      const emailHtml = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <h2 style="color: #E31E24;">Vos nouveaux identifiants DIA_SAAS</h2>
          <p>Bonjour <strong>${studentData.firstName}</strong>,</p>
          <p>Suite à votre demande, vos identifiants de connexion ont été réinitialisés :</p>
          <div style="background: #f9f9f9; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>Matricule :</strong> ${studentData.matricule}</p>
            <p style="margin: 5px 0;"><strong>Nouveau Mot de passe :</strong> ${newPassword}</p>
          </div>
          <p>Veuillez vous connecter et changer votre mot de passe dès que possible.</p>
          <p>Lien : <a href="${req.headers.origin}/login" style="color: #E31E24; font-weight: bold;">Accéder au portail</a></p>
        </div>
      `;
      
      await sendEmail(studentData.email, emailSubject, `Matricule: ${studentData.matricule}, Nouveau Mot de passe: ${newPassword}`, emailHtml);
      
      res.json({ message: 'Nouveaux identifiants générés et envoyés par email.' });
    } catch (err: any) {
      console.error("Resend credentials error:", err);
      res.status(500).json({ message: err.message });
    }
  });

  app.post('/api/students/send-receipt-email', authenticate, async (req: any, res) => {
    const { studentId, html } = req.body;
    try {
      const studentDoc = await dbAdmin.collection('students').doc(studentId).get();
      if (!studentDoc.exists) return res.status(404).json({ message: 'Étudiant non trouvé' });
      const studentData = studentDoc.data() as any;
      
      await sendEmail(
        studentData.email, 
        `[REÇU] Votre reçu de scolarité - DIA_SAAS`, 
        "Veuillez trouver ci-joint votre reçu de scolarité.", 
        html
      );
      
      res.json({ message: 'Reçu envoyé par email.' });
    } catch (err: any) {
      console.error("Send receipt email error:", err);
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

      // Envoi d'email réel (Non-bloquant)
      const emailSubject = "Bienvenue chez DIA_SAAS - Compte Enseignant";
      const emailText = `Bonjour ${teacherData.firstName},\n\nVotre compte enseignant a été créé chez DIA_SAAS.\n\nVoici vos identifiants :\nMatricule : ${teacherData.matricule}\nMot de passe : ${password || 'DIA2026.'}\n\nLien : ${req.headers.origin}/login`;
      const emailHtml = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <h2 style="color: #E31E24;">Bienvenue chez DIA_SAAS !</h2>
          <p>Bonjour <strong>${teacherData.firstName}</strong>,</p>
          <p>Votre compte enseignant a été configuré. Voici vos accès :</p>
          <div style="background: #f9f9f9; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>Matricule :</strong> ${teacherData.matricule}</p>
            <p style="margin: 5px 0;"><strong>Mot de passe :</strong> ${password || 'DIA2026.'}</p>
          </div>
          <p>Accédez à votre tableau de bord : <a href="${req.headers.origin}/login" style="color: #E31E24; font-weight: bold;">Se connecter</a></p>
        </div>
      `;
      
      sendEmail(teacherData.email, emailSubject, emailText, emailHtml).catch(e => console.error("Async email error:", e));

      res.json(newTeacher);
    } catch (err: any) {
      console.error("Error creating teacher in Firebase:", err);
      if (err.code === 'auth/operation-not-allowed') {
        return res.status(500).json({ 
          message: "L'authentification par Email/Mot de passe n'est pas activée dans votre console Firebase. Veuillez l'activer dans 'Authentication' > 'Sign-in method'." 
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
      const newRecord = { ...req.body, id, date: new Date().toISOString() };
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
      const id = Date.now().toString();
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
      const id = Date.now().toString();
      const newItem = {
        id,
        title: req.body.title || req.file.originalname,
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

  app.post('/api/evaluations/send-email', authenticate, async (req: any, res) => {
    if (req.user.role === 'student') return res.status(403).json({ message: 'Permission refusée' });
    const { evaluation, recipientEmail, studentName } = req.body;
    
    try {
      const mailOptions = {
        from: `"${APP_NAME}" <${process.env.SMTP_USER}>`,
        to: recipientEmail,
        subject: `Résultats d'Évaluation Goethe - ${studentName}`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 12px; overflow: hidden;">
            <div style="background-color: #e31e24; color: white; padding: 20px; text-align: center;">
              <h2>Résultats d'Évaluation</h2>
            </div>
            <div style="padding: 20px;">
              <p>Bonjour,</p>
              <p>Voici les résultats de l'évaluation Goethe pour <strong>${studentName}</strong>.</p>
              
              <div style="background-color: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <table style="width: 100%; border-collapse: collapse;">
                  <tr><td style="padding: 5px 0;"><strong>Module Lesen :</strong></td><td style="text-align: right;">${evaluation.modules.lesen}/25</td></tr>
                  <tr><td style="padding: 5px 0;"><strong>Module Hören :</strong></td><td style="text-align: right;">${evaluation.modules.horen}/25</td></tr>
                  <tr><td style="padding: 5px 0;"><strong>Module Schreiben :</strong></td><td style="text-align: right;">${evaluation.modules.schreiben}/25</td></tr>
                  <tr><td style="padding: 5px 0;"><strong>Module Sprechen :</strong></td><td style="text-align: right;">${evaluation.modules.sprechen}/25</td></tr>
                  <tr style="border-top: 1px solid #ddd;"><td style="padding: 10px 0;"><strong>Total :</strong></td><td style="text-align: right; color: #e31e24; font-weight: bold;">${evaluation.total}/100</td></tr>
                </table>
              </div>
              
              <p>Moyenne de l'examen : <strong>${evaluation.average}%</strong></p>
              <p>Statut : <strong>${evaluation.total >= 60 ? 'Réussi' : 'Échec'}</strong></p>
              
              ${evaluation.comments ? `<p><strong>Commentaires :</strong><br/>${evaluation.comments}</p>` : ''}
              
              <p style="margin-top: 30px; font-size: 12px; color: #888;">Ceci est un message automatique, merci de ne pas y répondre directement.</p>
            </div>
          </div>
        `
      };

      await transporter.sendMail(mailOptions);
      addLog('EMAIL', `Bulletin envoyé à ${recipientEmail} pour ${studentName}`);
      res.json({ message: 'Email envoyé avec succès' });
    } catch (err: any) {
      addLog('ERROR', 'Erreur envoi email évaluation', err.message);
      res.status(500).json({ message: `Erreur d'envoi: ${err.message}` });
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

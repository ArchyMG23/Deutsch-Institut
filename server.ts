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
import nodemailer from 'nodemailer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'dia-secret-key-2026';
const UPLOADS_DIR = path.join(process.cwd(), 'uploads');

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

let isFirebaseAdminInitialized = false;
let authAdmin: admin.auth.Auth;
let dbAdmin: admin.firestore.Firestore;

if (!admin.apps.length) {
  const serviceAccountVar = process.env.FIREBASE_SERVICE_ACCOUNT;
  let credential;

  if (serviceAccountVar) {
    try {
      const cleanedJson = serviceAccountVar.trim();
      const serviceAccount = JSON.parse(cleanedJson);
      credential = admin.credential.cert(serviceAccount);
      admin.initializeApp({
        credential,
        projectId: firebaseConfig.projectId || process.env.FIREBASE_PROJECT_ID || 'dia-app-52477',
      });
      isFirebaseAdminInitialized = true;
      authAdmin = admin.auth();
      dbAdmin = admin.firestore();
      console.log("✅ Firebase Admin: Initialisé avec succès.");
    } catch (err) {
      console.error("❌ Firebase Admin: Erreur lors du parsing de FIREBASE_SERVICE_ACCOUNT:", err);
    }
  } else {
    console.warn("⚠️ Firebase Admin: FIREBASE_SERVICE_ACCOUNT manquant. Les fonctions d'administration seront désactivées.");
  }
} else {
  isFirebaseAdminInitialized = true;
  authAdmin = admin.auth();
  dbAdmin = admin.firestore();
}
if (firebaseConfig.firestoreDatabaseId) {
  // If a specific database ID is provided in config
  // Note: firebase-admin might not support databaseId in initializeApp directly for all versions
  // but we can access it via firestore() if needed.
}

// Email Transporter Config
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_PORT === '465',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

async function sendEmail(to: string, subject: string, text: string, html?: string) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.log(`[EMAIL SIMULATION] to ${to}: ${subject}\n${text}`);
    return;
  }

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || '"Deutsch Institut" <noreply@dia.com>',
      to,
      subject,
      text,
      html,
    });
    console.log(`[EMAIL SUCCESS] to ${to}: ${subject}`);
  } catch (err) {
    console.error(`[EMAIL ERROR] to ${to}:`, err);
  }
}

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR);
}

// Multer Config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
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

// ... (initialData removed as we use Firestore)

async function startServer() {
  const app = express();

  // Bootstrap Levels if empty
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
      { email: 'yombivictor@gmail.com', firstName: 'Victor', lastName: 'Yombi', matricule: 'SUPERADMIN' },
      { email: 'gabrielyombi311@gmail.com', firstName: 'Gabriel', lastName: 'Yombi', matricule: 'ADMIN_GABRIEL' }
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

  app.use(cors());
  app.use(express.json());
  app.use(cookieParser());
  app.use('/uploads', express.static(UPLOADS_DIR));

  // Health Check
  app.get('/health', (req, res) => {
    res.json({ 
      status: 'ok', 
      env: process.env.NODE_ENV,
      firebase: admin.apps.length > 0 ? 'initialized' : 'not initialized',
      timestamp: new Date().toISOString()
    });
  });

  // Auth Middleware
  const authenticate = (req: any, res: any, next: any) => {
    console.log(`[AUTH] Authenticating request for: ${req.path}`);
    const token = req.cookies.token || req.headers.authorization?.split(' ')[1];
    if (!token) {
      console.warn(`[AUTH] No token found for: ${req.path}`);
      return res.status(401).json({ message: 'Non authentifié' });
    }
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      req.user = decoded;
      next();
    } catch (err) {
      console.error(`[AUTH] Invalid token for: ${req.path}`, err);
      res.status(401).json({ message: 'Token invalide' });
    }
  };

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
    
    try {
      // Look up user by matricule in Firestore
      const userQuery = await dbAdmin.collection('users').where('matricule', '==', matricule.toUpperCase()).get();
      let userDoc = userQuery.docs[0];
      
      if (!userDoc) {
        // Try by email
        const emailQuery = await dbAdmin.collection('users').where('email', '==', matricule.toLowerCase()).get();
        userDoc = emailQuery.docs[0];
      }

      if (!userDoc) {
        return res.status(401).json({ message: 'Identifiants incorrects' });
      }

      const userData = userDoc.data();
      // Note: We don't store passwords in Firestore for Firebase Auth users.
      // This route is mostly legacy now that frontend uses Firebase Auth directly.
      // But for compatibility, we return the user if they exist.
      // REAL authentication should happen on the frontend.
      
      res.json({ user: userData });
    } catch (err: any) {
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
      
      // Envoi d'email réel
      const emailSubject = "Bienvenue chez Deutsch Institut - Vos identifiants";
      const emailText = `Bonjour ${studentData.firstName},\n\nBienvenue chez Deutsch Institut !\n\nVoici vos identifiants de connexion :\nMatricule : ${studentData.matricule}\nMot de passe : ${password || 'DIA2026.'}\n\nLien de connexion : ${req.headers.origin}/login`;
      const emailHtml = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <h2 style="color: #E31E24;">Bienvenue chez Deutsch Institut !</h2>
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
      
      await sendEmail(studentData.email, emailSubject, emailText, emailHtml);
      
      res.json(newStudent);
    } catch (err: any) {
      console.error("Error creating student in Firebase:", err);
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

      if (password) {
        await authAdmin.updateUser(req.params.id, { password });
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
      res.status(500).json({ message: err.message });
    }
  });

  app.delete('/api/students/:id', authenticate, async (req, res) => {
    try {
      await dbAdmin.collection('students').doc(req.params.id).delete();
      await dbAdmin.collection('users').doc(req.params.id).delete();
      await authAdmin.deleteUser(req.params.id);
      res.json({ message: 'Student and user account deleted' });
    } catch (err: any) {
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

      // Envoi d'email réel
      const emailSubject = "Bienvenue chez Deutsch Institut - Compte Enseignant";
      const emailText = `Bonjour ${teacherData.firstName},\n\nVotre compte enseignant a été créé chez Deutsch Institut.\n\nVoici vos identifiants :\nMatricule : ${teacherData.matricule}\nMot de passe : ${password || 'DIA2026.'}\n\nLien : ${req.headers.origin}/login`;
      const emailHtml = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <h2 style="color: #E31E24;">Bienvenue chez Deutsch Institut !</h2>
          <p>Bonjour <strong>${teacherData.firstName}</strong>,</p>
          <p>Votre compte enseignant a été configuré. Voici vos accès :</p>
          <div style="background: #f9f9f9; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>Matricule :</strong> ${teacherData.matricule}</p>
            <p style="margin: 5px 0;"><strong>Mot de passe :</strong> ${password || 'DIA2026.'}</p>
          </div>
          <p>Accédez à votre tableau de bord : <a href="${req.headers.origin}/login" style="color: #E31E24; font-weight: bold;">Se connecter</a></p>
        </div>
      `;
      
      await sendEmail(teacherData.email, emailSubject, emailText, emailHtml);

      res.json(newTeacher);
    } catch (err: any) {
      console.error("Error creating teacher in Firebase:", err);
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

      if (password) {
        await authAdmin.updateUser(req.params.id, { password });
      }

      res.json({ id: req.params.id, ...teacherData });
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
  app.get('/api/finances', authenticate, async (req, res) => {
    try {
      const snapshot = await dbAdmin.collection('finances').get();
      const finances = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      res.json(finances);
    } catch (err: any) {
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

  app.delete('/api/finances/:id', authenticate, async (req, res) => {
    try {
      await dbAdmin.collection('finances').doc(req.params.id).delete();
      res.json({ message: 'Finance record deleted' });
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

  // Vite Middleware
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT} (env: ${process.env.NODE_ENV || 'development'})`);
  });
}

startServer();

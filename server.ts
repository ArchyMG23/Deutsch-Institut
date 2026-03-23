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

const PORT = 3000;
const JWT_SECRET = 'dia-secret-key-2026';
const DB_FILE = path.join(process.cwd(), 'database.json');
const UPLOADS_DIR = path.join(process.cwd(), 'uploads');

// Initialize Firebase Admin
const firebaseConfig = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'firebase-applet-config.json'), 'utf8'));

admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  projectId: firebaseConfig.projectId,
});

const authAdmin = admin.auth();
const dbAdmin = admin.firestore();

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

// Initial Database Structure
const initialData = {
  users: [
    {
      id: 'admin-1',
      matricule: 'ADMIN',
      email: 'admin@dia.com',
      password: bcrypt.hashSync('DIA2026', 10),
      role: 'admin',
      firstName: 'Super',
      lastName: 'Admin',
      status: 'online',
      createdAt: new Date().toISOString()
    },
    {
      id: 'test-student-id',
      matricule: 'TESTSTUDENT',
      email: 'student@test.com',
      password: bcrypt.hashSync('DIA2026', 10),
      role: 'student',
      firstName: 'Etudiant',
      lastName: 'Test',
      status: 'offline',
      createdAt: new Date().toISOString()
    },
    {
      id: 'test-teacher-id',
      matricule: 'TESTTEACHER',
      email: 'teacher@test.com',
      password: bcrypt.hashSync('DIA2026', 10),
      role: 'teacher',
      firstName: 'Enseignant',
      lastName: 'Test',
      status: 'offline',
      createdAt: new Date().toISOString()
    }
  ],
  students: [
    {
      id: 'test-student-id',
      matricule: 'TESTSTUDENT',
      firstName: 'Etudiant',
      lastName: 'Test',
      email: 'student@test.com',
      phone: '000000000',
      whatsapp: '000000000',
      levelId: 'a1',
      classId: '',
      role: 'student',
      status: 'offline',
      createdAt: new Date().toISOString(),
      payments: [
        { tranche: 1, amount: 0, date: null },
        { tranche: 2, amount: 0, date: null },
        { tranche: 3, amount: 0, date: null }
      ]
    }
  ],
  teachers: [
    {
      id: 'test-teacher-id',
      matricule: 'TESTTEACHER',
      firstName: 'Enseignant',
      lastName: 'Test',
      email: 'teacher@test.com',
      phone: '000000000',
      whatsapp: '000000000',
      cni: 'TEST-CNI',
      hourlyRate: 5000,
      role: 'teacher',
      status: 'offline',
      totalHoursWorked: 0,
      createdAt: new Date().toISOString()
    }
  ],
  finances: [],
  classes: [],
  library: [],
  levels: [
    { id: 'a1', name: 'A1', tuition: 150000, hours: 120 },
    { id: 'a2', name: 'A2', tuition: 175000, hours: 120 },
    { id: 'b1', name: 'B1', tuition: 200000, hours: 160 },
    { id: 'b2', name: 'B2', tuition: 250000, hours: 180 },
    { id: 'c1', name: 'C1', tuition: 350000, hours: 200 }
  ]
};

// ... (initialData)

function getDb() {
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2));
  }
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}

function saveDb(data: any) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

async function startServer() {
  const app = express();

  app.use(cors());
  app.use(express.json());
  app.use(cookieParser());
  app.use('/uploads', express.static(UPLOADS_DIR));

  // Auth Middleware
  const authenticate = (req: any, res: any, next: any) => {
    const token = req.cookies.token || req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Non authentifié' });
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      req.user = decoded;
      next();
    } catch (err) {
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
    const db = getDb();
    
    const user = db.users.find((u: any) => 
      u.matricule.toUpperCase() === matricule.toUpperCase() || 
      u.email.toLowerCase() === matricule.toLowerCase()
    );

    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ message: 'Identifiants incorrects' });
    }

    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
    const { password: _, ...userWithoutPassword } = user;
    res.cookie('token', token, { httpOnly: true, secure: true, sameSite: 'none' });
    res.json({ user: userWithoutPassword, token });
  });

  app.get('/api/auth/me', authenticate, (req: any, res) => {
    const db = getDb();
    const user = db.users.find((u: any) => u.id === req.user.id);
    if (!user) return res.status(404).json({ message: 'Utilisateur non trouvé' });
    
    let fullProfile = { ...user };
    if (user.role === 'student') {
      const studentData = db.students.find((s: any) => s.id === user.id);
      if (studentData) fullProfile = { ...studentData, ...fullProfile };
    } else if (user.role === 'teacher') {
      const teacherData = db.teachers.find((t: any) => t.id === user.id);
      if (teacherData) fullProfile = { ...teacherData, ...fullProfile };
    }

    const { password: _, ...userWithoutPassword } = fullProfile;
    res.json({ ...userWithoutPassword, uid: user.id });
  });

  app.post('/api/auth/logout', (req, res) => {
    res.clearCookie('token');
    res.json({ message: 'Déconnecté' });
  });

  // Students API
  app.get('/api/students', authenticate, (req, res) => {
    res.json(getDb().students);
  });

  app.post('/api/students', authenticate, async (req, res) => {
    const db = getDb();
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

      // Local DB Sync (optional, but keeping for compatibility for now)
      db.students.push(newStudent);
      db.users.push({ ...newUser, id: userRecord.uid, password: bcrypt.hashSync(password || 'DIA2026.', 10) });

      // Record initial payments in finances
      if (newStudent.payments) {
        for (const p of newStudent.payments) {
          if (p.amount > 0) {
            const financeRecord = {
              id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
              type: 'income',
              amount: p.amount,
              description: `Scolarité (Initial) - ${newStudent.matricule} - Tranche ${p.tranche}`,
              category: 'Tuition',
              date: p.date || new Date().toISOString()
            };
            db.finances.push(financeRecord);
            await dbAdmin.collection('finances').doc(financeRecord.id).set(financeRecord);
          }
        }
      }

      saveDb(db);
      
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

  app.put('/api/students/:id', authenticate, (req, res) => {
    const db = getDb();
    const index = db.students.findIndex((s: any) => s.id === req.params.id);
    if (index === -1) return res.status(404).send('Student not found');
    
    const { password, ...studentData } = req.body;
    const oldStudent = db.students[index];
    db.students[index] = { ...db.students[index], ...studentData };

    // Synchronize with finances if payments were updated
    if (studentData.payments) {
      studentData.payments.forEach((payment: any, idx: number) => {
        const oldPayment = oldStudent.payments?.[idx];
        // If payment was added or increased
        if (payment.amount > 0 && payment.date && (!oldPayment || payment.amount > (oldPayment.amount || 0))) {
          const diff = payment.amount - (oldPayment?.amount || 0);
          if (diff > 0) {
            db.finances.push({
              id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
              type: 'income',
              amount: diff,
              description: `Scolarité - ${db.students[index].matricule} - Tranche ${payment.tranche}`,
              category: 'Tuition',
              date: payment.date
            });
          }
        }
      });
    }

    // Update User Account if exists
    const userIndex = db.users.findIndex((u: any) => u.id === req.params.id);
    if (userIndex !== -1) {
      db.users[userIndex] = {
        ...db.users[userIndex],
        email: studentData.email || db.users[userIndex].email,
        firstName: studentData.firstName || db.users[userIndex].firstName,
        lastName: studentData.lastName || db.users[userIndex].lastName,
      };
      if (password) {
        db.users[userIndex].password = bcrypt.hashSync(password, 10);
      }
    }

    saveDb(db);
    res.json(db.students[index]);
  });

  app.delete('/api/students/:id', authenticate, (req, res) => {
    const db = getDb();
    db.students = db.students.filter((s: any) => s.id !== req.params.id);
    db.users = db.users.filter((u: any) => u.id !== req.params.id);
    saveDb(db);
    res.json({ message: 'Student and user account deleted' });
  });

  // Teachers API
  app.get('/api/teachers', authenticate, (req, res) => {
    res.json(getDb().teachers);
  });

  app.get('/api/teachers/me/classes', authenticate, (req: any, res) => {
    const db = getDb();
    const teacherClasses = db.classes.filter((c: any) => c.teacherId === req.user.id);
    res.json(teacherClasses);
  });

  app.post('/api/teachers', authenticate, async (req, res) => {
    const db = getDb();
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

      // Local DB Sync
      db.teachers.push(newTeacher);
      db.users.push({ ...newUser, id: userRecord.uid, password: bcrypt.hashSync(password || 'DIA2026.', 10) });
      
      saveDb(db);

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

  app.put('/api/teachers/:id', authenticate, (req, res) => {
    const db = getDb();
    const index = db.teachers.findIndex((t: any) => t.id === req.params.id);
    if (index === -1) return res.status(404).send('Teacher not found');
    
    const { password, ...teacherData } = req.body;
    db.teachers[index] = { ...db.teachers[index], ...teacherData };

    // Update User Account if exists
    const userIndex = db.users.findIndex((u: any) => u.id === req.params.id);
    if (userIndex !== -1) {
      db.users[userIndex] = {
        ...db.users[userIndex],
        email: teacherData.email || db.users[userIndex].email,
        firstName: teacherData.firstName || db.users[userIndex].firstName,
        lastName: teacherData.lastName || db.users[userIndex].lastName,
      };
      if (password) {
        db.users[userIndex].password = bcrypt.hashSync(password, 10);
      }
    }

    saveDb(db);
    res.json(db.teachers[index]);
  });

  app.delete('/api/teachers/:id', authenticate, (req, res) => {
    const db = getDb();
    db.teachers = db.teachers.filter((t: any) => t.id !== req.params.id);
    db.users = db.users.filter((u: any) => u.id !== req.params.id);
    saveDb(db);
    res.json({ message: 'Teacher and user account deleted' });
  });

  // Classes API
  app.get('/api/classes', authenticate, (req, res) => {
    res.json(getDb().classes);
  });

  app.post('/api/classes', authenticate, (req, res) => {
    const db = getDb();
    const newClass = { 
      ...req.body, 
      id: Date.now().toString(),
      schedule: req.body.schedule || [],
      exams: req.body.exams || []
    };
    db.classes.push(newClass);
    saveDb(db);
    res.json(newClass);
  });

  app.put('/api/classes/:id', authenticate, (req, res) => {
    const db = getDb();
    const index = db.classes.findIndex((c: any) => c.id === req.params.id);
    if (index === -1) return res.status(404).send('Class not found');
    db.classes[index] = { ...db.classes[index], ...req.body };
    saveDb(db);
    res.json(db.classes[index]);
  });

  app.delete('/api/classes/:id', authenticate, (req, res) => {
    const db = getDb();
    db.classes = db.classes.filter((c: any) => c.id !== req.params.id);
    saveDb(db);
    res.json({ message: 'Class deleted' });
  });

  // Finances API
  app.get('/api/finances', authenticate, (req, res) => {
    res.json(getDb().finances);
  });

  app.post('/api/finances', authenticate, (req, res) => {
    const db = getDb();
    const newRecord = { ...req.body, id: Date.now().toString(), date: new Date().toISOString() };
    db.finances.push(newRecord);
    saveDb(db);
    res.json(newRecord);
  });

  app.delete('/api/finances/:id', authenticate, (req, res) => {
    const db = getDb();
    db.finances = db.finances.filter((f: any) => f.id !== req.params.id);
    saveDb(db);
    res.json({ message: 'Finance record deleted' });
  });

  // Library API
  app.get('/api/library', authenticate, (req, res) => {
    res.json(getDb().library);
  });

  app.post('/api/library', authenticate, (req, res) => {
    const db = getDb();
    const newItem = { ...req.body, id: Date.now().toString(), addedAt: new Date().toISOString() };
    db.library.push(newItem);
    saveDb(db);
    res.json(newItem);
  });

  app.post('/api/library/upload', authenticate, upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ message: 'Aucun fichier téléchargé' });
    
    const db = getDb();
    const newItem = {
      id: Date.now().toString(),
      title: req.body.title || req.file.originalname,
      type: req.body.type || 'document',
      url: `/uploads/${req.file.filename}`,
      addedAt: new Date().toISOString(),
      fileName: req.file.originalname,
      fileSize: req.file.size
    };
    
    db.library.push(newItem);
    saveDb(db);
    res.json(newItem);
  });

  app.delete('/api/library/:id', authenticate, (req, res) => {
    const db = getDb();
    db.library = db.library.filter((l: any) => l.id !== req.params.id);
    saveDb(db);
    res.json({ message: 'Library item deleted' });
  });

  // Levels API
  app.get('/api/levels', authenticate, (req, res) => {
    res.json(getDb().levels);
  });

  app.post('/api/levels', authenticate, (req, res) => {
    const db = getDb();
    const newLevel = { ...req.body, id: Date.now().toString() };
    db.levels.push(newLevel);
    saveDb(db);
    res.json(newLevel);
  });

  app.put('/api/levels/:id', authenticate, (req, res) => {
    const db = getDb();
    const index = db.levels.findIndex((l: any) => l.id === req.params.id);
    if (index === -1) return res.status(404).send('Level not found');
    db.levels[index] = { ...db.levels[index], ...req.body };
    saveDb(db);
    res.json(db.levels[index]);
  });

  app.delete('/api/levels/:id', authenticate, (req, res) => {
    const db = getDb();
    db.levels = db.levels.filter((l: any) => l.id !== req.params.id);
    saveDb(db);
    res.json({ message: 'Level deleted' });
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

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

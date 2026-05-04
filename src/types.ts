export type UserRole = 'admin' | 'teacher' | 'student';

export interface UserProfile {
  uid: string;
  matricule: string;
  email: string;
  role: UserRole;
  firstName: string;
  lastName: string;
  phone?: string;
  photoURL?: string;
  mustChangePassword?: boolean;
  status: 'online' | 'offline';
  fcmToken?: string;
  lastActiveDevice?: string;
  lastLoginAt?: string;
  createdAt: string;
  isSuperAdmin?: boolean;
}

export interface Student extends UserProfile {
  role: 'student';
  birthDate: string;
  birthPlace: string;
  gender: 'M' | 'F';
  cni?: string;
  phone: string;
  parentName: string;
  parentPhone: string;
  parentEmail?: string;
  classId?: string;
  levelId?: string;
  payments: TuitionPayment[];
  isFormer?: boolean;
}

export interface TuitionPayment {
  tranche?: number;
  amount: number;
  date: string | null;
  receiptId?: string;
  category?: 'scolarite_allemand' | 'scolarite_anglais' | 'inscription' | 'vorbereitung' | 'connexion' | 'autre';
  comment?: string;
  method?: string;
}

export interface Level {
  id: string;
  name: string;
  tuition: number;
  hours: number; // Total hours for the level
  type?: 'allemand' | 'anglais';
}

export interface ClassRoom {
  id: string;
  name: string;
  levelId: string;
  teacherId: string;
  studentIds: string[];
  schedule: ScheduleItem[];
  exams: ExamItem[];
  currentSubLevel: 1 | 2; // Quota divided into two sub-levels
}

export interface ExamItem {
  id: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
}

export interface Teacher extends UserProfile {
  role: 'teacher';
  hourlyRate: number;
  phone: string;
  cni: string;
  totalHoursWorked: number;
  minStudentsCondition?: number;
  specialConditions?: string;
}

export interface ScheduleItem {
  day: string;
  startTime: string;
  endTime: string;
  subject: string;
}

export interface FinanceRecord {
  id: string;
  type: 'income' | 'expense';
  amount: number;
  description: string;
  category: string;
  date: string;
  deletedAt?: string;
  deletedBy?: string;
  deletionReason?: string;
}

export interface LibraryItem {
  id: string;
  title: string;
  url: string;
  category: string;
  type: 'document' | 'video' | 'archive';
  addedAt: string;
  addedBy: string;
  fileName?: string;
  fileSize?: number;
}

export interface Communique {
  id: string;
  title: string;
  content: string;
  authorId: string;
  authorName: string;
  targetRoles: UserRole[];
  createdAt: string;
  isArchived: boolean;
  readCount?: number; // Optional metadata for display
}

export interface CommuniqueRead {
  userId: string;
  userName: string;
  readAt: string;
}

export interface SchoolConfig {
  id: string;
  nom: string;
  logo_url: string;
  annee_scolaire: string;
  format_recu: 'A5' | 'thermique_58' | 'thermique_80';
}

export interface DailyReport {
  id: string;
  enseignant_id: string;
  enseignant_nom: string;
  classe_id: string;
  matiere: string;
  date: string;
  contenu: string;
  presents: number;
  absents: number;
  heure_debut?: string; // HH:mm
  heure_fin?: string;   // HH:mm
  duree_heures: number; // For salary calculation
  observations?: string;
  devoirs?: string;
  statut: 'brouillon' | 'soumis';
  justifie?: boolean; // For excess hours justification
  valide_par_admin?: boolean; // If admin validates excess hours
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  uid_auteur: string;
  nom_auteur: string; // Visible only to admin
  alias: string; // Anonymized for students
  message: string;
  timestamp: string;
  supprime?: boolean;
  reponse_admin?: string;
}

export interface StudentScolarite {
  id: string;
  eleve_id: string;
  matricule: string;
  nom_eleve: string;
  classe_id: string;
  montant_total_du: number;
  total_verse: number;
  reste: number;
  surplus: number;
  statut_paiement: 'EN COURS' | 'SOLDÉ' | 'SURPLUS';
}

export interface Versement {
  id: string;
  montant: number;
  date: string;
  mode_paiement: 'Espèces' | 'Mobile Money' | 'Virement' | 'Autre';
  recu_numero: string;
  caissier_id: string;
  categorie?: 'scolarite' | 'inscription' | 'autre';
  notes?: string;
  recu_genere_at?: string;
  recu_genere_par?: string;
}

export interface AuditLog {
  id: string;
  action: string;
  user_id: string;
  cible_id?: string;
  timestamp: string;
  details: any;
}

export interface Charge {
  id: string;
  libelle: string;
  montant: number;
  categorie: 'loyer' | 'internet' | 'electricite' | 'divers';
  date: string;
  notes?: string;
}

export interface Session {
  id: string;
  enseignant_id: string;
  enseignant_nom: string;
  classe_id: string;
  date: string;
  duree_heures: number;
  taux_horaire_applique: number;
  salaire_calcule: number;
  status: 'prevue' | 'terminee';
}

export type GradeValue = number; // 0-100 (standard) or 0-25 per module

export interface Evaluation {
  id: string;
  studentId: string;
  studentName: string;
  classId: string;
  levelId: string;
  teacherId: string;
  type: 'sub-level' | 'end-of-level';
  date: string;
  modules: {
    lesen: GradeValue;
    horen: GradeValue;
    schreiben: GradeValue;
    sprechen: GradeValue;
  };
  total: number;
  average: number;
  comments?: string;
  status: 'draft' | 'published';
  createdAt: string;
}

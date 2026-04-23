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
  tranche: number;
  amount: number;
  date: string | null;
  receiptId?: string;
}

export interface Level {
  id: string;
  name: string;
  tuition: number;
  hours: number; // Total hours for the level
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

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
  createdAt: string;
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

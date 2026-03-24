import React, { useState, useEffect } from 'react';
import { 
  Book, 
  Calendar, 
  Clock, 
  DollarSign, 
  FileText, 
  GraduationCap, 
  LayoutDashboard, 
  MessageSquare, 
  User,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Download,
  X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { cn, formatCurrency } from '../utils';
import { Student, ClassRoom, Level, LibraryItem } from '../types';
import { useNavigate } from 'react-router-dom';

export default function StudentDashboard() {
  const { profile, updateProfile, fetchWithAuth } = useAuth();
  const student = profile as Student;
  const navigate = useNavigate();
  
  const [studentClass, setStudentClass] = useState<ClassRoom | null>(null);
  const [studentLevel, setStudentLevel] = useState<Level | null>(null);
  const [recentLibrary, setRecentLibrary] = useState<LibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPaymentHistoryOpen, setIsPaymentHistoryOpen] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [classesRes, levelsRes, libraryRes, meRes] = await Promise.all([
          fetchWithAuth('/api/classes'),
          fetchWithAuth('/api/levels'),
          fetchWithAuth('/api/library'),
          fetchWithAuth('/api/auth/me')
        ]);

        if (classesRes.ok && levelsRes.ok && libraryRes.ok && meRes.ok) {
          const classes: ClassRoom[] = await classesRes.json();
          const levels: Level[] = await levelsRes.json();
          const library: LibraryItem[] = await libraryRes.json();
          const currentProfile = await meRes.json();
          
          updateProfile(currentProfile);

          if (currentProfile.classId) {
            setStudentClass(classes.find(c => c.id === currentProfile.classId) || null);
          }
          if (currentProfile.levelId) {
            setStudentLevel(levels.find(l => l.id === currentProfile.levelId) || null);
          }
          setRecentLibrary(library.slice(0, 4));
        }
      } catch (err) {
        console.error("Error fetching student dashboard data:", err);
      } finally {
        setLoading(false);
      }
    };

    if (student) {
      fetchData();
    }
  }, [student]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-dia-red"></div>
      </div>
    );
  }

  const totalPaid = student.payments?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;
  const tuition = studentLevel?.tuition || 0;
  const balance = tuition - totalPaid;
  const paymentProgress = tuition > 0 ? (totalPaid / tuition) * 100 : 0;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Welcome Section */}
      <div className="relative overflow-hidden rounded-[32px] bg-dia-red p-8 text-white shadow-2xl shadow-dia-red/20">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <h2 className="text-3xl font-bold tracking-tight">Ravi de vous revoir, {student.firstName} !</h2>
            <p className="text-white/80 font-medium">
              {studentClass ? `Classe : ${studentClass.name}` : "Aucune classe assignée pour le moment."}
              {studentLevel && ` • Niveau : ${studentLevel.name}`}
            </p>
          </div>
          <div className="flex gap-4">
            <div className="px-6 py-3 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20">
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/60 mb-1">Matricule</p>
              <p className="text-lg font-mono font-bold">{student.matricule}</p>
            </div>
          </div>
        </div>
        {/* Decorative elements */}
        <div className="absolute -right-20 -top-20 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
        <div className="absolute -left-20 -bottom-20 w-64 h-64 bg-black/10 rounded-full blur-3xl"></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Stats & Payments */}
        <div className="lg:col-span-2 space-y-8">
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Payment Card */}
            <div 
              onClick={() => setIsPaymentHistoryOpen(true)}
              className="card p-6 space-y-6 cursor-pointer hover:shadow-xl transition-all"
            >
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                  <DollarSign size={24} />
                </div>
                <span className={cn(
                  "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                  balance <= 0 ? "bg-emerald-500/10 text-emerald-500" : "bg-dia-yellow/10 text-dia-yellow"
                )}>
                  {balance <= 0 ? "Scolarité Payée" : "Paiement en cours"}
                </span>
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between items-end">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">Progression Paiement</p>
                  <p className="text-lg font-bold">{Math.round(paymentProgress)}%</p>
                </div>
                <div className="h-2 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-emerald-500 transition-all duration-1000" 
                    style={{ width: `${paymentProgress}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-neutral-100 dark:border-neutral-800">
                <div>
                  <p className="text-[10px] font-bold uppercase text-neutral-400 mb-1">Payé</p>
                  <p className="text-lg font-bold text-emerald-500">{formatCurrency(totalPaid)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase text-neutral-400 mb-1">Reste</p>
                  <p className="text-lg font-bold text-dia-red">{formatCurrency(balance)}</p>
                </div>
              </div>
            </div>

            {/* Attendance/Hours Card (Placeholder for now) */}
            <div className="card p-6 space-y-6">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
                  <Clock size={24} />
                </div>
                <span className="px-3 py-1 rounded-full bg-blue-500/10 text-blue-500 text-[10px] font-bold uppercase tracking-wider">
                  Assiduité
                </span>
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between items-end">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">Heures de cours</p>
                  <p className="text-lg font-bold">85%</p>
                </div>
                <div className="h-2 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 w-[85%]" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-neutral-100 dark:border-neutral-800">
                <div>
                  <p className="text-[10px] font-bold uppercase text-neutral-400 mb-1">Total Heures</p>
                  <p className="text-lg font-bold">{studentLevel?.hours || 0}h</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase text-neutral-400 mb-1">Effectuées</p>
                  <p className="text-lg font-bold text-blue-500">102h</p>
                </div>
              </div>
            </div>
          </div>

          {/* Schedule Section */}
          <div className="card p-8">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-dia-red/10 text-dia-red flex items-center justify-center">
                  <Calendar size={20} />
                </div>
                <h3 className="text-xl font-bold">Emploi du Temps</h3>
              </div>
              <button 
                onClick={() => navigate('/student/calendar')}
                className="text-sm font-bold text-dia-red hover:underline flex items-center gap-1"
              >
                Voir tout <ChevronRight size={16} />
              </button>
            </div>

            {studentClass?.schedule && studentClass.schedule.length > 0 ? (
              <div className="space-y-4">
                {studentClass.schedule.slice(0, 3).map((item, idx) => (
                  <div key={idx} className="flex items-center gap-6 p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800/50 hover:bg-neutral-100 transition-colors">
                    <div className="w-24 text-center">
                      <p className="text-xs font-bold uppercase text-dia-red">{item.day}</p>
                      <p className="text-sm font-bold text-neutral-400">{item.startTime}</p>
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-neutral-900 dark:text-white">{item.subject}</h4>
                      <p className="text-xs text-neutral-500">Durée : {item.startTime} - {item.endTime}</p>
                    </div>
                    <div className="px-4 py-2 bg-white dark:bg-neutral-900 rounded-xl shadow-sm border border-neutral-100 dark:border-neutral-800">
                      <p className="text-[10px] font-bold uppercase text-neutral-400">Salle</p>
                      <p className="text-xs font-bold">S-102</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 bg-neutral-50 dark:bg-neutral-800/50 rounded-[32px] border-2 border-dashed border-neutral-200 dark:border-neutral-700">
                <Calendar className="mx-auto text-neutral-300 mb-4" size={48} />
                <p className="text-neutral-500 font-medium">Aucun cours programmé pour le moment.</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Library & Exams */}
        <div className="space-y-8">
          {/* Library Quick Access */}
          <div className="card p-8">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-dia-yellow/10 text-dia-yellow flex items-center justify-center">
                  <Book size={20} />
                </div>
                <h3 className="text-xl font-bold">Bibliothèque</h3>
              </div>
            </div>

            <div className="space-y-4">
              {recentLibrary.map((item) => (
                <div key={item.id} className="group p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800/50 hover:bg-neutral-100 transition-all">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-white dark:bg-neutral-900 flex items-center justify-center text-dia-red shadow-sm">
                        <FileText size={16} />
                      </div>
                      <p className="text-xs font-bold uppercase tracking-wider text-neutral-400">{item.category}</p>
                    </div>
                    <a 
                      href={item.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="p-2 bg-white dark:bg-neutral-900 rounded-lg text-neutral-400 hover:text-dia-red shadow-sm transition-colors"
                    >
                      <Download size={14} />
                    </a>
                  </div>
                  <h4 className="font-bold text-sm text-neutral-900 dark:text-white line-clamp-1">{item.title}</h4>
                </div>
              ))}
              <button 
                onClick={() => navigate('/student/library')}
                className="w-full py-4 bg-neutral-100 dark:bg-neutral-800 rounded-2xl text-sm font-bold hover:bg-neutral-200 transition-all"
              >
                Accéder à la bibliothèque
              </button>
            </div>
          </div>

          {/* Upcoming Exams */}
          <div className="card p-8">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                  <GraduationCap size={20} />
                </div>
                <h3 className="text-xl font-bold">Examens à venir</h3>
              </div>
            </div>

            {studentClass?.exams && studentClass.exams.length > 0 ? (
              <div className="space-y-4">
                {studentClass.exams.map((exam) => (
                  <div key={exam.id} className="p-4 rounded-2xl border border-neutral-100 dark:border-neutral-800 hover:border-emerald-500/30 transition-all">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-bold text-neutral-900 dark:text-white">{exam.title}</h4>
                      <span className="px-2 py-1 bg-emerald-500/10 text-emerald-500 text-[10px] font-bold rounded-lg uppercase">Prévu</span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-neutral-500">
                      <div className="flex items-center gap-1">
                        <Calendar size={12} />
                        {new Date(exam.date).toLocaleDateString('fr-FR')}
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock size={12} />
                        {exam.startTime}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-neutral-400">
                <AlertCircle className="mx-auto mb-2 opacity-20" size={32} />
                <p className="text-xs font-medium">Aucun examen programmé.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Payment History Modal */}
      {isPaymentHistoryOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-neutral-900 w-full max-w-2xl rounded-[32px] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-8 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
                  <DollarSign size={20} />
                </div>
                <h3 className="text-2xl font-bold tracking-tight">Historique des Versements</h3>
              </div>
              <button onClick={() => setIsPaymentHistoryOpen(false)} className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition-colors">
                <X size={24} />
              </button>
            </div>
            <div className="p-8">
              <div className="space-y-4">
                {student.payments && student.payments.length > 0 ? (
                  student.payments.map((payment, idx) => (
                    <div key={idx} className="flex items-center justify-between p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800/50">
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center",
                          payment.amount > 0 ? "bg-emerald-500/10 text-emerald-500" : "bg-neutral-200 text-neutral-400"
                        )}>
                          {payment.amount > 0 ? <CheckCircle2 size={20} /> : <Clock size={20} />}
                        </div>
                        <div>
                          <h5 className="font-bold text-sm">Tranche {payment.tranche}</h5>
                          <p className="text-[10px] font-bold uppercase text-neutral-400 tracking-wider">
                            {payment.date ? new Date(payment.date).toLocaleDateString('fr-FR') : 'En attente'}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-sm">{formatCurrency(payment.amount || 0)}</p>
                        <p className="text-[10px] font-bold uppercase text-neutral-400">
                          {payment.amount > 0 ? 'Réglé' : 'Non réglé'}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-12 text-neutral-400">
                    <AlertCircle className="mx-auto mb-2 opacity-20" size={48} />
                    <p>Aucun historique de paiement trouvé.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


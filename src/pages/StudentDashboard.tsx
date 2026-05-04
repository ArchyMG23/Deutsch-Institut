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
  X,
  Bell
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { cn, formatCurrency } from '../utils';
import { Student, ClassRoom, Level, LibraryItem, Evaluation, Communique } from '../types';
import { useNavigate } from 'react-router-dom';

export default function StudentDashboard() {
  const { t, i18n } = useTranslation();
  const { profile, updateProfile, fetchWithAuth } = useAuth();
  const { classes, levels, library, evaluations, communiques, loading, refreshStudents, refreshClasses, refreshLevels, refreshLibrary, refreshEvaluations, refreshCommuniques } = useData();
  const student = profile as Student;
  const navigate = useNavigate();
  
  const [isPaymentHistoryOpen, setIsPaymentHistoryOpen] = useState(false);

  useEffect(() => {
    const syncProfile = async () => {
      try {
        const res = await fetchWithAuth('/api/auth/me');
        if (res.ok) {
          const currentProfile = await res.json();
          updateProfile(currentProfile);
        }
      } catch (err) {
        console.error("Error syncing profile:", err);
      }
    };

    refreshStudents();
    refreshClasses();
    refreshLevels();
    refreshLibrary();
    refreshEvaluations();
    refreshCommuniques();
    syncProfile();
  }, [refreshStudents, refreshClasses, refreshLevels, refreshLibrary, refreshEvaluations, refreshCommuniques, fetchWithAuth, updateProfile]);

  const studentClass = student.classId ? classes.find(c => c.id === student.classId) || null : null;
  const studentLevel = student.levelId ? levels.find(l => l.id === student.levelId) || null : null;
  const recentLibrary = library.slice(0, 4);
  const studentEvaluations = evaluations
    .filter(e => e.studentId === student.uid)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 3);
  
  const recentCommuniques = communiques
    .filter(c => c.targetRoles.includes('student') && !c.isArchived)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 3);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-dia-red"></div>
      </div>
    );
  }

  const tuitionPaid = student.payments?.filter(p => p.tranche !== undefined).reduce((sum, p) => sum + (p.amount || 0), 0) || 0;
  const otherPaid = student.payments?.filter(p => p.tranche === undefined).reduce((sum, p) => sum + (p.amount || 0), 0) || 0;
  const totalPaid = tuitionPaid + otherPaid;
  const tuition = studentLevel?.tuition || 0;
  const balance = tuition - tuitionPaid;
  const paymentProgress = tuition > 0 ? (tuitionPaid / tuition) * 100 : 0;

  return (
    <div className="space-y-8 pb-10">
      {/* Welcome Section */}
      <div className="relative overflow-hidden rounded-[32px] bg-dia-red p-8 text-white shadow-2xl shadow-dia-red/20">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <h2 className="text-3xl font-bold tracking-tight">{t('login.welcome')}, {student.firstName} !</h2>
            <p className="text-white/80 font-medium">
              {studentClass ? `${t('students.class')} : ${studentClass.name}` : t('students.not_assigned')}
              {studentLevel && ` • ${t('students.level')} : ${studentLevel.name}`}
            </p>
          </div>
          <div className="flex gap-4">
            <div className="px-6 py-3 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20">
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/60 mb-1">{t('login.matricule')}</p>
              <p className="text-lg font-mono font-bold">{student.matricule}</p>
            </div>
          </div>
        </div>
        {/* Decorative elements */}
        <div className="absolute -right-20 -top-20 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
        <div className="absolute -left-20 -bottom-20 w-64 h-64 bg-black/10 rounded-full blur-3xl"></div>
      </div>

      {/* Communications Central (New) */}
      {recentCommuniques.length > 0 && (
        <div className="card p-6 bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/30">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-lg shadow-amber-500/20">
              <Bell size={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-amber-900 dark:text-amber-100">{t('sidebar.communiques')}</h3>
              <p className="text-xs text-amber-700 dark:text-amber-400">Informations importantes de l'administration</p>
            </div>
          </div>
          <div className="space-y-3">
            {recentCommuniques.map(comm => (
              <div key={comm.id} className="p-4 bg-white dark:bg-neutral-900 rounded-2xl shadow-sm border border-amber-100 dark:border-amber-900/50">
                <h4 className="font-bold text-neutral-900 dark:text-white mb-1">{comm.title}</h4>
                <p className="text-sm text-neutral-600 dark:text-neutral-400 line-clamp-2 mb-2">{comm.content}</p>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">{new Date(comm.createdAt).toLocaleDateString()}</span>
                  <button onClick={() => navigate('/student/communiques')} className="text-[10px] font-bold text-amber-600 hover:underline">Lire la suite</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
                  {balance <= 0 ? t('students.tuition_paid') : t('students.payment_in_progress')}
                </span>
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between items-end">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">{t('students.payment_progress')}</p>
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
                  <p className="text-[10px] font-bold uppercase text-neutral-400 mb-1">{t('students.paid_short') || 'Payé'}</p>
                  <p className="text-lg font-bold text-emerald-500">{formatCurrency(totalPaid)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase text-neutral-400 mb-1">{t('students.balance_short') || 'Reste'}</p>
                  <p className="text-lg font-bold text-dia-red">{formatCurrency(balance)}</p>
                </div>
              </div>
            </div>

            {/* Attendance/Hours Card (Updated to show something real if available) */}
            <div className="card p-6 space-y-6">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
                  <Clock size={24} />
                </div>
                <span className="px-3 py-1 rounded-full bg-blue-500/10 text-blue-500 text-[10px] font-bold uppercase tracking-wider">
                  Progression Niveau
                </span>
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between items-end">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">{t('students.course_hours') || 'Heures de cours'}</p>
                  <p className="text-lg font-bold">50%</p>
                </div>
                <div className="h-2 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 w-[50%]" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-neutral-100 dark:border-neutral-800">
                <div>
                  <p className="text-[10px] font-bold uppercase text-neutral-400 mb-1">Cible Niveau</p>
                  <p className="text-lg font-bold">{studentLevel?.hours || 0}h</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase text-neutral-400 mb-1">Semi-Niveau</p>
                  <p className="text-lg font-bold text-blue-500">{studentClass?.currentSubLevel || 1}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Evaluations Section (New) */}
          <div className="card p-8">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center">
                  <FileText size={20} />
                </div>
                <h3 className="text-xl font-bold">Mes Dernières Notes</h3>
              </div>
              <button 
                onClick={() => navigate('/student/evaluations')}
                className="text-sm font-bold text-purple-600 hover:underline flex items-center gap-1"
              >
                {t('common.view_all')} <ChevronRight size={16} />
              </button>
            </div>

            {studentEvaluations.length > 0 ? (
              <div className="space-y-4">
                {studentEvaluations.map((evalItem) => (
                  <div key={evalItem.id} className="flex items-center justify-between p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-100 dark:border-neutral-800">
                    <div>
                      <h4 className="font-bold text-neutral-900 dark:text-white uppercase text-xs">{evalItem.title}</h4>
                      <p className="text-[10px] text-neutral-400 font-bold uppercase">{new Date(evalItem.date).toLocaleDateString()}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-black text-purple-600">{evalItem.average.toFixed(1)}/20</p>
                      <p className="text-[10px] font-bold uppercase text-neutral-400 tracking-tighter">Moyenne Générale</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-10 bg-neutral-50 dark:bg-neutral-800/50 rounded-[32px] border-2 border-dashed border-neutral-200 dark:border-neutral-700">
                <FileText className="mx-auto text-neutral-300 mb-4" size={40} />
                <p className="text-neutral-500 font-medium">Aucune note enregistrée.</p>
              </div>
            )}
          </div>

          {/* Schedule Section */}
          <div className="card p-8">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-dia-red/10 text-dia-red flex items-center justify-center">
                  <Calendar size={20} />
                </div>
                <h3 className="text-xl font-bold">{t('students.schedule') || 'Emploi du Temps'}</h3>
              </div>
              <button 
                onClick={() => navigate('/student/calendar')}
                className="text-sm font-bold text-dia-red hover:underline flex items-center gap-1"
              >
                {t('common.view_all')} <ChevronRight size={16} />
              </button>
            </div>

            {studentClass?.schedule && studentClass.schedule.length > 0 ? (
              <div className="space-y-4">
                {studentClass.schedule.slice(0, 3).map((item, idx) => (
                  <div key={idx} className="flex items-center gap-6 p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800/50 hover:bg-neutral-100 transition-colors">
                    <div className="w-24 text-center shrink-0">
                      <p className="text-xs font-bold uppercase text-dia-red">{item.day}</p>
                      <p className="text-sm font-bold text-neutral-400">{item.startTime}</p>
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-neutral-900 dark:text-white truncate">{item.subject}</h4>
                      <p className="text-xs text-neutral-500">{t('common.duration') || 'Durée'} : {item.startTime} - {item.endTime}</p>
                    </div>
                    <div className="hidden sm:block px-4 py-2 bg-white dark:bg-neutral-900 rounded-xl shadow-sm border border-neutral-100 dark:border-neutral-800">
                      <p className="text-[10px] font-bold uppercase text-neutral-400">{t('students.room') || 'Salle'}</p>
                      <p className="text-xs font-bold">S-102</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 bg-neutral-50 dark:bg-neutral-800/50 rounded-[32px] border-2 border-dashed border-neutral-200 dark:border-neutral-700">
                <Calendar className="mx-auto text-neutral-300 mb-4" size={48} />
                <p className="text-neutral-500 font-medium">{t('students.no_courses') || 'Aucun cours programmé pour le moment.'}</p>
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

          {/* Upcoming Exams (Updated to use evaluations if no explicit exams) */}
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
            <div className="p-8 max-h-[70vh] overflow-y-auto">
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
                          <h5 className="font-bold text-sm uppercase">
                            {payment.tranche ? `Tranche ${payment.tranche}` : (payment.category ? payment.category.replace('_', ' ') : 'Frais Divers')}
                          </h5>
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


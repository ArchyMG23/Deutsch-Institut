import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Plus, 
  MoreVertical, 
  Phone, 
  X, 
  Edit, 
  UserPlus,
  GraduationCap,
  DollarSign,
  Clock,
  ChevronUp,
  ChevronDown,
  SortAsc,
  Laptop,
  Smartphone,
  Camera,
  AlertCircle,
  User
} from 'lucide-react';
import { cn, formatCurrency, generateMatricule } from '../utils';
import { Teacher, ClassRoom } from '../types';
import { NotificationService } from '../services/NotificationService';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { toast } from 'sonner';

import { useTranslation } from 'react-i18next';
import { generateWhatsAppLink, APP_NAME_FOR_LINKS } from '../utils/contactLinks';

export default function TeacherManagement() {
  const { t } = useTranslation();
  const { fetchWithAuth } = useAuth();
  const { teachers, classes, loading, refreshAll, refreshTeachers, refreshClasses } = useData();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>({ key: 'lastName', direction: 'asc' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    refreshTeachers();
    refreshClasses();
  }, [refreshTeachers, refreshClasses]);

  const handleAddTeacher = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    
    const formData = new FormData(e.currentTarget);
    const matricule = generateMatricule('teacher');
    const password = formData.get('password') as string || 'DIA2026.';
    
    const newTeacher = {
      matricule,
      password,
      firstName: formData.get('firstName'),
      lastName: formData.get('lastName'),
      phone: formData.get('phone'),
      cni: formData.get('cni'),
      hourlyRate: parseInt(formData.get('hourlyRate') as string),
      minStudentsCondition: parseInt(formData.get('minStudentsCondition') as string) || 0,
      specialConditions: formData.get('specialConditions') as string || '',
      role: 'teacher',
      status: 'offline',
      totalHoursWorked: 0,
      createdAt: new Date().toISOString(),
    };

    const classId = formData.get('classId') as string;

    try {
      const res = await fetchWithAuth('/api/teachers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTeacher)
      });
      if (res.ok) {
        const teacher = await res.json();
        
        if (classId) {
          await fetchWithAuth(`/api/classes/${classId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ teacherId: teacher.id })
          });
        }

        await NotificationService.sendCredentials(fetchWithAuth, teacher, password);
        setIsAddModalOpen(false);
        refreshTeachers();
        refreshClasses();
        toast.success(t('teachers.teacher_added'));
      } else {
        const errorData = await res.json();
        toast.error(errorData.message || t('common.error'));
      }
    } catch (err) {
      console.error("Error adding teacher:", err);
      toast.error(t('common.error'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditTeacher = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedTeacher) return;
    
    const formData = new FormData(e.currentTarget);
    const updatedTeacher = {
      ...selectedTeacher,
      firstName: formData.get('firstName'),
      lastName: formData.get('lastName'),
      phone: formData.get('phone'),
      cni: formData.get('cni'),
      hourlyRate: parseInt(formData.get('hourlyRate') as string),
      minStudentsCondition: parseInt(formData.get('minStudentsCondition') as string) || 0,
      specialConditions: formData.get('specialConditions') as string || '',
    };

    const classId = formData.get('classId') as string;

    setSubmitting(true);
    try {
      const res = await fetchWithAuth(`/api/teachers/${selectedTeacher.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedTeacher)
      });
      if (res.ok) {
        if (classId) {
          await fetchWithAuth(`/api/classes/${classId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ teacherId: selectedTeacher.id })
          });
        }
        setIsEditModalOpen(false);
        refreshTeachers();
        refreshClasses();
        toast.success(t('teachers.teacher_updated'));
      } else {
        const errorData = await res.json();
        toast.error(errorData.message || t('common.error'));
      }
    } catch (err) {
      console.error("Error updating teacher:", err);
      toast.error(t('common.error'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteTeacher = async (id: string) => {
    if (!window.confirm(t('teachers.confirm_delete'))) return;
    
    try {
      const res = await fetchWithAuth(`/api/teachers/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        refreshTeachers();
      }
    } catch (err) {
      console.error("Error deleting teacher:", err);
    }
  };

  const filteredTeachers = teachers.filter(t => 
    `${t.firstName} ${t.lastName} ${t.matricule}`.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const sortedTeachers = [...filteredTeachers].sort((a, b) => {
    if (!sortConfig) return 0;
    const { key, direction } = sortConfig;
    
    let aValue: any = (a as any)[key];
    let bValue: any = (b as any)[key];

    if (key === 'name') {
      aValue = `${a.lastName} ${a.firstName}`.toLowerCase();
      bValue = `${b.lastName} ${b.firstName}`.toLowerCase();
    } else if (typeof aValue === 'string') {
      aValue = aValue.toLowerCase();
      bValue = bValue.toLowerCase();
    }

    if (aValue < bValue) return direction === 'asc' ? -1 : 1;
    if (aValue > bValue) return direction === 'asc' ? 1 : -1;
    return 0;
  });

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h3 className="text-xl font-bold">{t('teachers.title')}</h3>
        <button 
          onClick={() => setIsAddModalOpen(true)}
          className="btn-primary flex items-center gap-2"
        >
          <UserPlus size={18} />
          <span>{t('teachers.add_teacher')}</span>
        </button>
      </div>

      {/* Search and Filter */}
      <div className="card p-4 flex flex-col sm:flex-row gap-4 items-center">
        <div className="relative group flex-1 w-full">
          <input 
            type="text" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('teachers.search_placeholder')}
            className="w-full pl-10 pr-4 py-2 bg-neutral-100 dark:bg-neutral-800 border-none rounded-lg focus:ring-2 focus:ring-dia-red transition-all"
          />
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 group-focus-within:text-dia-red transition-colors pointer-events-none z-10" size={18} />
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-xs font-bold text-neutral-400 uppercase whitespace-nowrap">{t('common.sort_by')}:</span>
          <select 
            value={sortConfig?.key || ''} 
            onChange={(e) => handleSort(e.target.value)}
            className="flex-1 sm:flex-none bg-neutral-100 dark:bg-neutral-800 border-none rounded-lg px-3 py-2 text-sm font-bold focus:ring-2 focus:ring-dia-red outline-none"
          >
            <option value="lastName">{t('common.name')}</option>
            <option value="hourlyRate">{t('teachers.hourly_rate')}</option>
            <option value="totalHoursWorked">{t('teachers.total_hours')}</option>
          </select>
          <button 
            onClick={() => handleSort(sortConfig?.key || 'lastName')}
            className="p-2 bg-neutral-100 dark:bg-neutral-800 rounded-lg hover:bg-neutral-200 transition-colors"
          >
            {sortConfig?.direction === 'asc' ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
        </div>
      </div>

      {/* Teachers Desktop View */}
      <div className="hidden md:block overflow-x-auto card">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-neutral-100 dark:border-neutral-800">
              <th className="p-4 text-[10px] font-bold uppercase tracking-wider text-neutral-400">{t('common.name')}</th>
              <th className="p-4 text-[10px] font-bold uppercase tracking-wider text-neutral-400">{t('common.phone')}</th>
              <th className="p-4 text-[10px] font-bold uppercase tracking-wider text-neutral-400">{t('teachers.hourly_rate')}</th>
              <th className="p-4 text-[10px] font-bold uppercase tracking-wider text-neutral-400">{t('teachers.total_hours')}</th>
              <th className="p-4 text-[10px] font-bold uppercase tracking-wider text-neutral-400">{t('classes.title')}</th>
              <th className="p-4 text-[10px] font-bold uppercase tracking-wider text-neutral-400 text-right">{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {sortedTeachers.map((teacher) => (
              <tr key={teacher.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors group">
                <td className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-dia-red/10 text-dia-red flex items-center justify-center font-bold relative shrink-0">
                      {teacher.firstName[0]}{teacher.lastName[0]}
                      {teacher.status === 'online' && (
                        <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 border-2 border-white dark:border-neutral-900 rounded-full"></span>
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-sm tracking-tight">{teacher.firstName} {teacher.lastName}</p>
                        {teacher.minStudentsCondition > 0 && (
                          <span className="p-1 bg-orange-100 text-orange-600 rounded-md" title={`${t('teachers.min_students_condition')}: ${teacher.minStudentsCondition}`}>
                            <User size={10} />
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] font-mono text-neutral-400 uppercase tracking-widest">{teacher.matricule}</p>
                    </div>
                  </div>
                </td>
                <td className="p-4">
                  <p className="text-sm font-medium text-neutral-600 dark:text-neutral-400">{teacher.phone}</p>
                </td>
                <td className="p-4">
                  <p className="text-sm font-bold flex items-center gap-1 text-dia-red">
                    <DollarSign size={14} />
                    {formatCurrency(teacher.hourlyRate)}/h
                  </p>
                </td>
                <td className="p-4">
                  <p className="text-sm font-bold flex items-center gap-1">
                    <Clock size={14} className="text-neutral-400" />
                    {teacher.totalHoursWorked}h
                  </p>
                </td>
                <td className="p-4">
                   <div className="flex flex-wrap gap-1 max-w-[200px]">
                    {classes.filter(c => c.teacherId === teacher.id).map(c => (
                      <span key={c.id} className="px-2 py-0.5 bg-neutral-100 dark:bg-neutral-800 rounded-lg text-[9px] font-bold text-neutral-500 uppercase tracking-tighter">
                        {c.name}
                      </span>
                    ))}
                    {classes.filter(c => c.teacherId === teacher.id).length === 0 && (
                      <span className="text-[10px] text-neutral-400 italic">{t('teachers.no_class')}</span>
                    )}
                  </div>
                </td>
                <td className="p-4">
                  <div className="flex justify-end gap-2 text-neutral-400">
                    <button 
                      onClick={() => {
                        const msg = `━━━━━━━━━━━━━━━━━━━━━━━\n🚀 *ACCÈS ENSEIGNANT*\n*${APP_NAME_FOR_LINKS}*\n━━━━━━━━━━━━━━━━━━━━━━━\n\nBonjour M/Mme ${teacher.lastName},\n\nBienvenue dans notre équipe pédagogique. Voici vos identifiants pour gérer vos classes et vos évaluations :\n\n🔑 *Matricule* : ${teacher.matricule}\n🔒 *Mot de passe* : ${teacher.password || 'Inconnu'}\n\n🌐 *Accès* : ${window.location.origin}\n\nNous vous souhaitons une excellente collaboration ! 🙏`;
                        const a = document.createElement('a');
                        a.href = generateWhatsAppLink(teacher.phone || '', msg);
                        a.target = '_blank';
                        a.click();
                      }}
                      className="p-2 hover:bg-green-50 hover:text-green-600 rounded-lg transition-all"
                      title="WhatsApp"
                    >
                      <Smartphone size={16} />
                    </button>
                    <button 
                      onClick={() => {
                        setSelectedTeacher(teacher);
                        setIsEditModalOpen(true);
                      }}
                      className="p-2 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-all"
                      title={t('common.edit')}
                    >
                      <Edit size={16} />
                    </button>
                    <button 
                      onClick={() => handleDeleteTeacher(teacher.id)}
                      className="p-2 hover:bg-red-50 hover:text-red-600 rounded-lg transition-all"
                      title={t('common.delete')}
                    >
                      <X size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Teachers Mobile View (Cards) */}
      <div className="grid grid-cols-1 gap-4 md:hidden">
        {sortedTeachers.map((teacher) => (
          <div key={teacher.id} className="card p-5 space-y-4 hover:shadow-lg transition-shadow">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-dia-red/10 text-dia-red flex items-center justify-center text-xl font-bold relative shrink-0">
                  {teacher.firstName[0]}{teacher.lastName[0]}
                  {teacher.status === 'online' && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 border-4 border-white dark:border-neutral-900 rounded-full"></span>
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-base leading-tight">{teacher.firstName} {teacher.lastName}</h4>
                    {teacher.minStudentsCondition > 0 && (
                      <span className="p-1 bg-orange-100 text-orange-600 rounded-md">
                        <User size={10} />
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] font-mono text-neutral-400 uppercase tracking-widest">{teacher.matricule}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => {
                    const msg = `━━━━━━━━━━━━━━━━━━━━━━━\n🚀 *ACCÈS ENSEIGNANT*\n*${APP_NAME_FOR_LINKS}*\n━━━━━━━━━━━━━━━━━━━━━━━\n\nBonjour M/Mme ${teacher.lastName},\n\nBienvenue dans notre équipe pédagogique. Voici vos identifiants pour gérer vos classes et vos évaluations :\n\n🔑 *Matricule* : ${teacher.matricule}\n🔒 *Mot de passe* : ${teacher.password || 'Inconnu'}\n\n🌐 *Accès* : ${window.location.origin}\n\nNous vous souhaitons une excellente collaboration ! 🙏`;
                    const a = document.createElement('a');
                    a.href = generateWhatsAppLink(teacher.phone || '', msg);
                    a.target = '_blank';
                    a.click();
                  }}
                  className="p-2.5 bg-green-50 text-green-600 rounded-xl active:scale-95 transition-transform"
                >
                  <Smartphone size={18} />
                </button>
                <button 
                  onClick={() => {
                    setSelectedTeacher(teacher);
                    setIsEditModalOpen(true);
                  }}
                  className="p-2.5 bg-blue-50 text-blue-600 rounded-xl active:scale-95 transition-transform"
                >
                  <Edit size={18} />
                </button>
                <button 
                  onClick={() => handleDeleteTeacher(teacher.id)}
                  className="p-2.5 bg-red-50 text-red-600 rounded-xl active:scale-95 transition-transform"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pb-4 border-b border-neutral-100 dark:border-neutral-800">
              <div className="bg-neutral-50 dark:bg-neutral-800/50 p-3 rounded-2xl">
                <p className="text-[10px] font-bold uppercase text-neutral-400 mb-1">{t('teachers.hourly_rate')}</p>
                <p className="text-sm font-bold flex items-center gap-1 text-dia-red">
                  {formatCurrency(teacher.hourlyRate)}/h
                </p>
              </div>
              <div className="bg-neutral-50 dark:bg-neutral-800/50 p-3 rounded-2xl">
                <p className="text-[10px] font-bold uppercase text-neutral-400 mb-1">{t('teachers.total_hours')}</p>
                <p className="text-sm font-bold flex items-center gap-1">
                  {teacher.totalHoursWorked}h
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap gap-1">
                {classes.filter(c => c.teacherId === teacher.id).map(c => (
                  <span key={c.id} className="px-2 py-1 bg-neutral-100 dark:bg-neutral-800 rounded-lg text-[9px] font-bold text-neutral-500 uppercase">
                    {c.name}
                  </span>
                ))}
              </div>
              <p className="text-xs flex items-center gap-2 text-neutral-600 dark:text-neutral-400 font-medium">
                <Phone size={14} className="text-dia-red" /> {teacher.phone}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Add Teacher Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-neutral-900 w-full max-w-2xl rounded-[32px] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <form onSubmit={handleAddTeacher} className="flex flex-col max-h-[90vh]">
              <div className="p-8 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between shrink-0">
                <h3 className="text-2xl font-bold tracking-tight">{t('teachers.add_teacher')}</h3>
                <button type="button" onClick={() => setIsAddModalOpen(false)} className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition-colors">
                  <X size={24} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-8 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">{t('common.first_name')}</label>
                  <input name="firstName" required type="text" className="w-full px-5 py-3 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-2xl focus:ring-2 focus:ring-dia-red/20 focus:border-dia-red outline-none transition-all" />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">{t('common.last_name')}</label>
                  <input name="lastName" required type="text" className="w-full px-5 py-3 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-2xl focus:ring-2 focus:ring-dia-red/20 focus:border-dia-red outline-none transition-all" />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">{t('common.phone')}</label>
                  <input name="phone" required type="tel" className="w-full px-5 py-3 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-2xl focus:ring-2 focus:ring-dia-red/20 focus:border-dia-red outline-none transition-all" />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">{t('students.cni')}</label>
                  <input name="cni" required type="text" className="w-full px-5 py-3 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-2xl focus:ring-2 focus:ring-dia-red/20 focus:border-dia-red outline-none transition-all" />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">{t('teachers.hourly_rate')} (FCFA)</label>
                  <input name="hourlyRate" required type="number" className="w-full px-5 py-3 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-2xl focus:ring-2 focus:ring-dia-red/20 focus:border-dia-red outline-none transition-all" />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">{t('teachers.min_students_condition')}</label>
                  <input name="minStudentsCondition" type="number" placeholder="Ex: 5" className="w-full px-5 py-3 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-2xl focus:ring-2 focus:ring-dia-red/20 focus:border-dia-red outline-none transition-all" />
                  <p className="text-[10px] text-neutral-500 mt-1">{t('teachers.min_students_hint')}</p>
                </div>
                <div className="col-span-1 md:col-span-2 space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">{t('teachers.special_conditions')}</label>
                  <textarea name="specialConditions" rows={3} placeholder={t('teachers.special_conditions_placeholder')} className="w-full px-5 py-3 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-2xl focus:ring-2 focus:ring-dia-red/20 focus:border-dia-red outline-none transition-all resize-none"></textarea>
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">{t('teachers.assign_to_class')}</label>
                  <select name="classId" className="w-full px-5 py-3 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-2xl focus:ring-2 focus:ring-dia-red/20 focus:border-dia-red outline-none transition-all">
                    <option value="">{t('teachers.no_class')}</option>
                    {classes.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">{t('teachers.temporary_password')}</label>
                  <input name="password" type="text" defaultValue="DIA2026." className="w-full px-5 py-3 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-2xl focus:ring-2 focus:ring-dia-red/20 focus:border-dia-red outline-none transition-all" />
                  <p className="text-[10px] text-neutral-500 mt-1">{t('teachers.password_hint')}</p>
                </div>
              </div>
            </div>
            <div className="p-8 border-t border-neutral-100 dark:border-neutral-800 flex gap-4">
              <button type="button" onClick={() => setIsAddModalOpen(false)} className="flex-1 px-6 py-4 bg-neutral-100 dark:bg-neutral-800 rounded-2xl font-bold transition-all hover:bg-neutral-200">{t('common.cancel')}</button>
              <button 
                type="submit" 
                disabled={submitting}
                className="flex-1 btn-primary py-4 flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white/30 border-t-white"></div>
                    {t('common.saving')}
                  </>
                ) : (
                  t('teachers.add_teacher')
                )}
              </button>
            </div>
          </form>
          </div>
        </div>
      )}

      {/* Edit Teacher Modal */}
      {isEditModalOpen && selectedTeacher && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-neutral-900 w-full max-w-2xl rounded-[32px] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <form onSubmit={handleEditTeacher} className="flex flex-col max-h-[90vh]">
              <div className="p-8 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-4">
                  <div className="relative group">
                    <div className="w-16 h-16 rounded-2xl bg-dia-red/10 text-dia-red flex items-center justify-center text-xl font-bold overflow-hidden">
                      {selectedTeacher.photoURL ? (
                        <img src={selectedTeacher.photoURL} alt="Teacher" className="w-full h-full object-cover" />
                      ) : (
                        <>{selectedTeacher.firstName[0]}{selectedTeacher.lastName[0]}</>
                      )}
                    </div>
                    <button 
                      type="button"
                      onClick={() => {
                        const input = document.createElement('input');
                        input.type = 'file';
                        input.accept = 'image/*';
                        input.onchange = async (e: any) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const formData = new FormData();
                          formData.append('photo', file);
                          formData.append('userId', selectedTeacher.uid);
                          try {
                            toast.loading(t('common.loading'));
                            const res = await fetchWithAuth('/api/profile/upload-photo', {
                              method: 'POST',
                              body: formData
                            });
                            if (res.ok) {
                              const data = await res.json();
                              setSelectedTeacher({ ...selectedTeacher, photoURL: data.photoURL });
                              refreshTeachers();
                              toast.dismiss();
                              toast.success(t('profile.photo_success'));
                            }
                          } catch (err) {
                            toast.dismiss();
                            toast.error(t('profile.upload_error'));
                          }
                        };
                        input.click();
                      }}
                      className="absolute -bottom-1 -right-1 p-1.5 bg-dia-red text-white rounded-lg shadow-lg hover:scale-110 transition-transform"
                    >
                      <Camera size={12} />
                    </button>
                  </div>
                  <h3 className="text-2xl font-bold tracking-tight">{t('teachers.edit_teacher')}</h3>
                </div>
                <button type="button" onClick={() => setIsEditModalOpen(false)} className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition-colors">
                  <X size={24} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-8 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">{t('common.first_name')}</label>
                  <input name="firstName" defaultValue={selectedTeacher.firstName} required type="text" className="w-full px-5 py-3 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-2xl focus:ring-2 focus:ring-dia-red/20 focus:border-dia-red outline-none transition-all" />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">{t('common.last_name')}</label>
                  <input name="lastName" defaultValue={selectedTeacher.lastName} required type="text" className="w-full px-5 py-3 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-2xl focus:ring-2 focus:ring-dia-red/20 focus:border-dia-red outline-none transition-all" />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">{t('common.phone')}</label>
                  <input name="phone" defaultValue={selectedTeacher.phone} required type="tel" className="w-full px-5 py-3 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-2xl focus:ring-2 focus:ring-dia-red/20 focus:border-dia-red outline-none transition-all" />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">{t('students.cni')}</label>
                  <input name="cni" defaultValue={selectedTeacher.cni} required type="text" className="w-full px-5 py-3 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-2xl focus:ring-2 focus:ring-dia-red/20 focus:border-dia-red outline-none transition-all" />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">{t('teachers.hourly_rate')} (FCFA)</label>
                  <input name="hourlyRate" defaultValue={selectedTeacher.hourlyRate} required type="number" className="w-full px-5 py-3 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-2xl focus:ring-2 focus:ring-dia-red/20 focus:border-dia-red outline-none transition-all" />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">{t('teachers.min_students_condition')}</label>
                  <input name="minStudentsCondition" defaultValue={selectedTeacher.minStudentsCondition} type="number" className="w-full px-5 py-3 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-2xl focus:ring-2 focus:ring-dia-red/20 focus:border-dia-red outline-none transition-all" />
                </div>
                <div className="col-span-1 md:col-span-2 space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">{t('teachers.special_conditions')}</label>
                  <textarea name="specialConditions" defaultValue={selectedTeacher.specialConditions} rows={3} className="w-full px-5 py-3 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-2xl focus:ring-2 focus:ring-dia-red/20 focus:border-dia-red outline-none transition-all resize-none"></textarea>
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">{t('teachers.assign_to_class')}</label>
                  <select name="classId" defaultValue={classes.find(c => c.teacherId === selectedTeacher.id)?.id || ""} className="w-full px-5 py-3 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-2xl focus:ring-2 focus:ring-dia-red/20 focus:border-dia-red outline-none transition-all">
                    <option value="">{t('teachers.no_class')}</option>
                    {classes.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <div className="p-8 border-t border-neutral-100 dark:border-neutral-800 flex gap-4">
              <button type="button" onClick={() => setIsEditModalOpen(false)} className="flex-1 px-6 py-4 bg-neutral-100 dark:bg-neutral-800 rounded-2xl font-bold transition-all hover:bg-neutral-200">{t('common.cancel')}</button>
              <button 
                type="submit" 
                disabled={submitting}
                className="flex-1 btn-primary py-4 flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white/30 border-t-white"></div>
                    {t('common.updating')}
                  </>
                ) : (
                  t('common.save_changes')
                )}
              </button>
            </div>
          </form>
          </div>
        </div>
      )}
    </div>
  );
}

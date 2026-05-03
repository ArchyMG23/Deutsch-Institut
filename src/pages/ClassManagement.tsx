import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Search, 
  Plus, 
  X, 
  Edit, 
  Users, 
  Calendar, 
  Clock, 
  GraduationCap,
  ChevronRight,
  BookOpen,
  Layout,
  ChevronUp,
  ChevronDown
} from 'lucide-react';
import { cn, formatCurrency } from '../utils';
import { ClassRoom, Level, Teacher, Student } from '../types';
import { NotificationService } from '../services/NotificationService';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { toast } from 'sonner';

export default function ClassManagement() {
  const { t } = useTranslation();
  const { fetchWithAuth } = useAuth();
  const { classes, levels, teachers, students, loading, refreshClasses, refreshTeachers, refreshLevels, refreshStudents } = useData();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedClass, setSelectedClass] = useState<ClassRoom | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>({ key: 'name', direction: 'asc' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    refreshClasses();
    refreshTeachers();
    refreshLevels();
    refreshStudents();
  }, [refreshClasses, refreshTeachers, refreshLevels, refreshStudents]);

  const handleAddClass = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    
    const formData = new FormData(e.currentTarget);
    
    const newClass = {
      name: formData.get('name'),
      levelId: formData.get('levelId'),
      teacherId: formData.get('teacherId'),
      studentIds: [],
      currentSubLevel: 1,
      schedule: [],
      exams: []
    };

    try {
      const res = await fetchWithAuth('/api/classes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newClass)
      });
      if (res.ok) {
        setIsAddModalOpen(false);
        refreshClasses();
        toast.success(t('classes.class_created'));
      } else {
        const errorData = await res.json();
        toast.error(errorData.message || t('common.error'));
      }
    } catch (err) {
      console.error("Error adding class:", err);
      toast.error(t('common.error'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateSubLevel = async (classId: string) => {
    if (submitting) return;
    const cls = classes.find(c => c.id === classId);
    if (!cls) return;

    if (cls.currentSubLevel === 1) {
      if (!window.confirm(t('classes.promote_sublevel_confirm', { name: cls.name }))) return;
      
      try {
        setSubmitting(true);
        const res = await fetchWithAuth(`/api/classes/${classId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ currentSubLevel: 2 })
        });

        if (res.ok) {
          // Record Salary for Teacher for the sub-level completion
          const level = levels.find(l => l.id === cls.levelId);
          const teacher = teachers.find(t => t.id === cls.teacherId);
          if (level && teacher) {
            const hoursPerSubLevel = level.hours / 2;
            const salaryAmount = hoursPerSubLevel * teacher.hourlyRate;

            await fetchWithAuth(`/api/teachers/${teacher.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ totalHoursWorked: (teacher.totalHoursWorked || 0) + hoursPerSubLevel })
            });

            await fetchWithAuth('/api/finances', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                type: 'expense',
                amount: salaryAmount,
                description: t('teachers.salary_expense', { teacher: `${teacher.firstName} ${teacher.lastName}`, className: cls.name, sub: 1 }),
                category: 'Salary',
                date: new Date().toISOString()
              })
            });
          }

          toast.success(t('classes.sublevel_updated'));
          
          // Notify teacher and students
          const classStudents = students.filter(s => cls.studentIds.includes(s.id) && !s.isFormer);
          const message = t('classes.sublevel_notification', { name: cls.name });
          
          if (teacher) {
             await NotificationService.sendNotification(fetchWithAuth, teacher, t('classes.level_change_subject', { name: cls.name }), message, t('classes.level_change_subject', { name: cls.name }), message);
          }
          for (const student of classStudents) {
             await NotificationService.sendNotification(fetchWithAuth, student, t('classes.level_progression_subject', { name: cls.name }), message, t('classes.level_progression'), message);
          }
          
          refreshClasses();
        }
      } catch (err) {
        console.error("Error promoting to sub-level 2:", err);
        toast.error(t('common.error'));
      } finally {
        setSubmitting(false);
      }
    } else {
      // Promotion to next level - logical selection
      // Sort levels logically by name (typical A1, A2, B1...)
      const sortedAllLevels = [...levels].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
      const currentLevelIndex = sortedAllLevels.findIndex(l => l.id === cls.levelId);
      const nextLevel = sortedAllLevels[currentLevelIndex + 1];
      
      if (!nextLevel) {
        toast.error(t('classes.promote_level_limit'));
        return;
      }

      const confirmPromote = window.confirm(t('classes.promote_level_confirm', { name: cls.name, nextLevel: nextLevel.name }));
      if (!confirmPromote) return;

      try {
        setSubmitting(true);
        // 1. Update Class
        const res = await fetchWithAuth(`/api/classes/${classId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ levelId: nextLevel.id, currentSubLevel: 1 })
        });

        if (res.ok) {
          // Record Salary for Teacher for the sub-level 2 completion
          const level = levels.find(l => l.id === cls.levelId);
          const teacher = teachers.find(t => t.id === cls.teacherId);
          if (level && teacher) {
            const hoursPerSubLevel = level.hours / 2;
            const salaryAmount = hoursPerSubLevel * teacher.hourlyRate;

            await fetchWithAuth(`/api/teachers/${teacher.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ totalHoursWorked: (teacher.totalHoursWorked || 0) + hoursPerSubLevel })
            });

            await fetchWithAuth('/api/finances', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                type: 'expense',
                amount: salaryAmount,
                description: t('teachers.salary_expense', { teacher: `${teacher.firstName} ${teacher.lastName}`, className: cls.name, sub: 2 }),
                category: 'Salary',
                date: new Date().toISOString()
              })
            });
          }

          // 2. Update all students in this class
          const classStudents = students.filter(s => cls.studentIds.includes(s.id) && !s.isFormer);
          for (const student of classStudents) {
            await fetchWithAuth(`/api/students/${student.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ levelId: nextLevel.id })
            });
            
            // Notify student & parent
            const message = t('classes.promotion_notification', { level: level?.name, name: cls.name, nextLevel: nextLevel.name });
            await NotificationService.sendNotification(fetchWithAuth, student, t('classes.promotion_subject', { nextLevel: nextLevel.name, name: cls.name }), message, t('classes.level_promotion'), t('classes.level_reached', { nextLevel: nextLevel.name }));
          }

          // 3. Notify teacher
          if (teacher) {
            const message = t('classes.teacher_promotion_notification', { name: cls.name, nextLevel: nextLevel.name });
            await NotificationService.sendNotification(fetchWithAuth, teacher, t('classes.class_promotion_subject', { name: cls.name }), message, t('classes.class_promotion_title'), message);
          }

          toast.success(t('classes.level_promoted', { name: nextLevel.name }));
          refreshClasses();
        }
      } catch (err) {
        console.error("Error promoting to next level:", err);
        toast.error(t('common.error'));
      } finally {
        setSubmitting(false);
      }
    }
  };

  const filteredClasses = classes.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const sortedClasses = [...filteredClasses].sort((a, b) => {
    if (!sortConfig) return 0;
    const { key, direction } = sortConfig;
    
    let aValue: any;
    let bValue: any;

    if (key === 'name') {
      aValue = a.name.toLowerCase();
      bValue = b.name.toLowerCase();
    } else if (key === 'level') {
      aValue = levels.find(l => l.id === a.levelId)?.name?.toLowerCase() || '';
      bValue = levels.find(l => l.id === b.levelId)?.name?.toLowerCase() || '';
    } else if (key === 'students') {
      aValue = students.filter(s => s.classId === a.id && !s.isFormer).length;
      bValue = students.filter(s => s.classId === b.id && !s.isFormer).length;
    } else {
      aValue = (a as any)[key];
      bValue = (b as any)[key];
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
        <h3 className="text-xl font-bold">{t('classes.title')}</h3>
        <button 
          onClick={() => setIsAddModalOpen(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus size={18} />
          <span>{t('classes.add_class')}</span>
        </button>
      </div>

      <div className="card p-4 flex flex-col sm:flex-row gap-4 items-center">
        <div className="relative group flex-1">
          <input 
            type="text" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('classes.search_placeholder')}
            className="w-full pl-10 pr-4 py-2 bg-neutral-100 dark:bg-neutral-800 border-none rounded-lg focus:ring-2 focus:ring-dia-red transition-all"
          />
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 group-focus-within:text-dia-red transition-colors pointer-events-none z-10" size={18} />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-neutral-400 uppercase">{t('common.sort_by')}:</span>
          <select 
            value={sortConfig?.key || ''} 
            onChange={(e) => handleSort(e.target.value)}
            className="bg-neutral-100 dark:bg-neutral-800 border-none rounded-lg px-3 py-2 text-sm font-bold focus:ring-2 focus:ring-dia-red outline-none"
          >
            <option value="name">{t('common.name')}</option>
            <option value="level">{t('classes.level')}</option>
            <option value="students">{t('classes.students_count')}</option>
          </select>
          <button 
            onClick={() => handleSort(sortConfig?.key || 'name')}
            className="p-2 bg-neutral-100 dark:bg-neutral-800 rounded-lg hover:bg-neutral-200 transition-colors"
          >
            {sortConfig?.direction === 'asc' ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
        </div>
      </div>

      {/* Classes Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {sortedClasses.map((cls) => {
          const level = levels.find(l => l.id === cls.levelId);
          const teacher = teachers.find(t => t.id === cls.teacherId);
          const classStudents = students.filter(s => s.classId === cls.id && !s.isFormer);

          return (
            <div key={cls.id} className="card p-6 hover:shadow-lg transition-shadow">
              <div className="flex justify-between items-start mb-4">
                <div className="w-12 h-12 rounded-2xl bg-dia-red/10 text-dia-red flex items-center justify-center">
                  <Layout size={24} />
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "text-[10px] font-bold px-2 py-1 rounded-full uppercase",
                    cls.currentSubLevel === 1 ? "bg-blue-100 text-blue-600" : "bg-purple-100 text-purple-600"
                  )}>
                    {t('classes.sub_level')} {cls.currentSubLevel}
                  </span>
                </div>
              </div>

              <div className="space-y-1 mb-6">
                <h4 className="font-bold text-lg">{cls.name}</h4>
                <div className="flex items-center gap-2 text-sm text-neutral-500">
                  <GraduationCap size={14} />
                  <span>{t('classes.level')} {level?.name}</span>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-neutral-50 dark:bg-neutral-800/50 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-neutral-200 dark:bg-neutral-700 flex items-center justify-center text-xs font-bold">
                      {teacher ? `${teacher.firstName[0]}${teacher.lastName[0]}` : '?'}
                    </div>
                    <div>
                      <p className="text-xs font-bold">{teacher ? `${teacher.firstName} ${teacher.lastName}` : t('teachers.not_assigned')}</p>
                      <p className="text-[10px] text-neutral-500">{t('teachers.teacher_label')}</p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 text-neutral-500">
                    <Users size={16} />
                    <span>{classStudents.length} {t('sidebar.students')}</span>
                  </div>
                  <button 
                    onClick={() => {
                      setSelectedClass(cls);
                      setIsDetailModalOpen(true);
                    }}
                    className="text-dia-red font-bold flex items-center gap-1 hover:underline"
                  >
                    {t('common.details')} <ChevronRight size={16} />
                  </button>
                </div>

                <div className="pt-4 border-t border-neutral-100 dark:border-neutral-800 flex gap-2">
                  <button 
                    onClick={() => handleUpdateSubLevel(cls.id)}
                    disabled={submitting}
                    className={cn(
                      "flex-1 py-2 rounded-lg text-xs font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
                      cls.currentSubLevel === 1 
                        ? "bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200" 
                        : "bg-dia-red text-white hover:bg-red-700"
                    )}
                  >
                    {submitting && (
                      <div className="inline-block w-2 h-2 mr-2 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    )}
                    {cls.currentSubLevel === 1 ? t('classes.next_sub_level') : t('classes.next_level')}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Class Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-neutral-900 w-full max-w-md rounded-[32px] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-8 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
              <h3 className="text-2xl font-bold tracking-tight">{t('classes.add_class')}</h3>
              <button onClick={() => setIsAddModalOpen(false)} className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition-colors">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleAddClass} className="p-8 space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">{t('classes.class_name')}</label>
                  <input name="name" required type="text" placeholder={t('classes.name_placeholder')} className="w-full px-5 py-3 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-2xl focus:ring-2 focus:ring-dia-red/20 focus:border-dia-red outline-none transition-all" />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">{t('classes.level')}</label>
                  <select name="levelId" required className="w-full px-5 py-3 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-2xl focus:ring-2 focus:ring-dia-red/20 focus:border-dia-red outline-none transition-all">
                    {levels.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">{t('teachers.teacher_label')}</label>
                  <select name="teacherId" required className="w-full px-5 py-3 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-2xl focus:ring-2 focus:ring-dia-red/20 focus:border-dia-red outline-none transition-all">
                    <option value="">{t('teachers.search_placeholder')}</option>
                    {teachers.map(t => <option key={t.id} value={t.id}>{t.firstName} {t.lastName}</option>)}
                  </select>
                </div>
              </div>
              <div className="pt-4 flex gap-4">
                <button type="button" onClick={() => setIsAddModalOpen(false)} className="flex-1 px-6 py-4 bg-neutral-100 dark:bg-neutral-800 rounded-2xl font-bold transition-all hover:bg-neutral-200">{t('common.cancel')}</button>
                <button 
                  type="submit" 
                  disabled={submitting}
                  className="flex-1 btn-primary py-4 flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-white/30 border-t-white"></div>
                      {t('classes.creating')}
                    </>
                  ) : (
                    t('classes.add_class')
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Class Detail Modal */}
      {isDetailModalOpen && selectedClass && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-neutral-900 w-full max-w-4xl rounded-[32px] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-8 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-bold tracking-tight">{selectedClass.name}</h3>
                <p className="text-neutral-500 text-sm">{t('classes.detail_subtitle')}</p>
              </div>
              <button onClick={() => setIsDetailModalOpen(false)} className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition-colors">
                <X size={24} />
              </button>
            </div>
            <div className="p-8 grid grid-cols-1 lg:grid-cols-2 gap-8 max-h-[70vh] overflow-y-auto">
              {/* Schedule Section */}
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold flex items-center gap-2"><Calendar size={18} /> {t('classes.schedule')}</h4>
                </div>
                <form 
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const formData = new FormData(e.currentTarget);
                    const newItem = {
                      day: formData.get('day') as string,
                      startTime: formData.get('startTime') as string,
                      endTime: formData.get('endTime') as string,
                      subject: formData.get('subject') as string
                    };
                    const updatedSchedule = [...selectedClass.schedule, newItem];
                    const res = await fetchWithAuth(`/api/classes/${selectedClass.id}`, {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ schedule: updatedSchedule })
                    });
                    if (res.ok) {
                      const updated = await res.json();
                      
                      // Notify teacher and students
                      const teacher = teachers.find(t => t.id === updated.teacherId);
                      const classStudents = students.filter(s => updated.studentIds.includes(s.id));
                      
                      const eventDetails = { 
                        className: updated.name, 
                        subject: newItem.subject, 
                        date: newItem.day, 
                        time: `${newItem.startTime}-${newItem.endTime}` 
                      };

                      if (teacher) {
                        await NotificationService.sendEventUpdate(fetchWithAuth, teacher, 'course', 'added', eventDetails);
                      }
                      for (const student of classStudents) {
                        await NotificationService.sendEventUpdate(fetchWithAuth, student, 'course', 'added', eventDetails);
                      }

                      setSelectedClass(updated);
                      refreshClasses();
                      (e.target as HTMLFormElement).reset();
                    }
                  }}
                  className="grid grid-cols-2 gap-2 p-4 bg-neutral-100 dark:bg-neutral-800 rounded-xl"
                >
                  <input name="subject" required placeholder={t('common.subject')} className="col-span-2 text-xs p-2 rounded border-none" />
                  <select name="day" required className="text-xs p-2 rounded border-none">
                    <option value="Lundi">{t('classes.days.monday')}</option>
                    <option value="Mardi">{t('classes.days.tuesday')}</option>
                    <option value="Mercredi">{t('classes.days.wednesday')}</option>
                    <option value="Jeudi">{t('classes.days.thursday')}</option>
                    <option value="Vendredi">{t('classes.days.friday')}</option>
                    <option value="Samedi">{t('classes.days.saturday')}</option>
                  </select>
                  <div className="flex gap-1">
                    <input name="startTime" required type="time" className="text-xs p-2 rounded border-none flex-1" />
                    <input name="endTime" required type="time" className="text-xs p-2 rounded border-none flex-1" />
                  </div>
                  <button type="submit" className="col-span-2 btn-primary py-1 text-xs">{t('classes.add_to_schedule')}</button>
                </form>
                <div className="space-y-3">
                  {selectedClass.schedule.length === 0 ? (
                    <p className="text-sm text-neutral-500 italic">{t('classes.no_course')}</p>
                  ) : (
                    selectedClass.schedule.map((item, idx) => (
                      <div key={idx} className="p-4 bg-neutral-50 dark:bg-neutral-800/50 rounded-xl border border-neutral-100 dark:border-neutral-800 flex justify-between items-center">
                        <div>
                          <p className="font-bold text-sm">{item.subject}</p>
                          <p className="text-xs text-neutral-500">{item.day} • {item.startTime} - {item.endTime}</p>
                        </div>
                        <button 
                          onClick={async () => {
                            const updatedSchedule = selectedClass.schedule.filter((_, i) => i !== idx);
                            const res = await fetchWithAuth(`/api/classes/${selectedClass.id}`, {
                              method: 'PUT',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ schedule: updatedSchedule })
                            });
                            if (res.ok) {
                              const updated = await res.json();
                              const removedItem = selectedClass.schedule[idx];
                              
                              // Notify teacher and students
                              const teacher = teachers.find(t => t.id === updated.teacherId);
                              const classStudents = students.filter(s => updated.studentIds.includes(s.id));
                              const eventDetails = { 
                                className: updated.name, 
                                subject: removedItem.subject, 
                                date: removedItem.day, 
                                time: `${removedItem.startTime}-${removedItem.endTime}` 
                              };

                              if (teacher) {
                                await NotificationService.sendEventUpdate(fetchWithAuth, teacher, 'course', 'cancelled', eventDetails);
                              }
                              for (const student of classStudents) {
                                await NotificationService.sendEventUpdate(fetchWithAuth, student, 'course', 'cancelled', eventDetails);
                              }

                              setSelectedClass(updated);
                              refreshClasses();
                            }
                          }}
                          className="text-red-600 p-1 hover:bg-red-50 rounded"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Exams Section */}
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold flex items-center gap-2"><BookOpen size={18} /> {t('classes.exams')}</h4>
                </div>
                <form 
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const formData = new FormData(e.currentTarget);
                    const newItem = {
                      id: Date.now().toString(),
                      title: formData.get('title') as string,
                      date: formData.get('date') as string,
                      startTime: formData.get('startTime') as string,
                      endTime: formData.get('endTime') as string
                    };
                    const updatedExams = [...selectedClass.exams, newItem];
                    const res = await fetchWithAuth(`/api/classes/${selectedClass.id}`, {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ exams: updatedExams })
                    });
                     if (res.ok) {
                        const updated = await res.json();
                        
                        // Notify teacher and students
                        const teacher = teachers.find(t => t.id === updated.teacherId);
                        const classStudents = students.filter(s => updated.studentIds.includes(s.id));
                        const eventDetails = { 
                          className: updated.name, 
                          subject: newItem.title, 
                          date: newItem.date as string, 
                          time: `${newItem.startTime}-${newItem.endTime}` 
                        };

                        if (teacher) {
                          await NotificationService.sendEventUpdate(fetchWithAuth, teacher, 'exam', 'added', eventDetails);
                        }
                        for (const student of classStudents) {
                          await NotificationService.sendEventUpdate(fetchWithAuth, student, 'exam', 'added', eventDetails);
                        }

                        setSelectedClass(updated);
                        refreshClasses();
                        (e.target as HTMLFormElement).reset();
                      }
                  }}
                  className="grid grid-cols-2 gap-2 p-4 bg-neutral-100 dark:bg-neutral-800 rounded-xl"
                >
                  <input name="title" required placeholder={t('classes.add_exam')} className="col-span-2 text-xs p-2 rounded border-none" />
                  <input name="date" required type="date" className="text-xs p-2 rounded border-none" />
                  <div className="flex gap-1">
                    <input name="startTime" required type="time" className="text-xs p-2 rounded border-none flex-1" />
                    <input name="endTime" required type="time" className="text-xs p-2 rounded border-none flex-1" />
                  </div>
                  <button type="submit" className="col-span-2 btn-primary py-1 text-xs">{t('classes.add_exam')}</button>
                </form>
                <div className="space-y-3">
                  {selectedClass.exams.length === 0 ? (
                    <p className="text-sm text-neutral-500 italic">{t('classes.no_exam')}</p>
                  ) : (
                    selectedClass.exams.map((exam) => (
                      <div key={exam.id} className="p-4 bg-neutral-50 dark:bg-neutral-800/50 rounded-xl border border-neutral-100 dark:border-neutral-800 flex justify-between items-center">
                        <div>
                          <p className="font-bold text-sm">{exam.title}</p>
                          <p className="text-xs text-neutral-500">{new Date(exam.date).toLocaleDateString()} • {exam.startTime}</p>
                        </div>
                        <button 
                          onClick={async () => {
                            const updatedExams = selectedClass.exams.filter(e => e.id !== exam.id);
                            const res = await fetchWithAuth(`/api/classes/${selectedClass.id}`, {
                              method: 'PUT',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ exams: updatedExams })
                            });
                            if (res.ok) {
                              const updated = await res.json();
                              
                              // Notify teacher and students
                              const teacher = teachers.find(t => t.id === updated.teacherId);
                              const classStudents = students.filter(s => updated.studentIds.includes(s.id));
                              const eventDetails = { 
                                className: updated.name, 
                                subject: exam.title, 
                                date: exam.date, 
                                time: `${exam.startTime}-${exam.endTime}` 
                              };

                              if (teacher) {
                                await NotificationService.sendEventUpdate(fetchWithAuth, teacher, 'exam', 'cancelled', eventDetails);
                              }
                              for (const student of classStudents) {
                                await NotificationService.sendEventUpdate(fetchWithAuth, student, 'exam', 'cancelled', eventDetails);
                              }

                              setSelectedClass(updated);
                              refreshClasses();
                            }
                          }}
                          className="text-red-600 p-1 hover:bg-red-50 rounded"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Students List */}
              <div className="lg:col-span-2 pt-6 border-t border-neutral-100 dark:border-neutral-800">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-bold flex items-center gap-2"><Users size={18} /> {t('classes.class_students')}</h4>
                  <div className="flex gap-2">
                    <select 
                      className="text-xs bg-neutral-100 dark:bg-neutral-800 border-none rounded-lg px-2 py-1"
                      onChange={async (e) => {
                        const studentId = e.target.value;
                        if (!studentId) return;
                        const updatedStudentIds = [...selectedClass.studentIds, studentId];
                        const res = await fetchWithAuth(`/api/classes/${selectedClass.id}`, {
                          method: 'PUT',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ studentIds: updatedStudentIds })
                        });
                        if (res.ok) {
                          const updated = await res.json();
                          
                          // Notify student
                          const student = students.find(s => s.id === studentId);
                          if (student) {
                            const scheduleStr = updated.schedule?.map((s: any) => `${s.day} (${s.startTime}-${s.endTime})`).join(', ');
                            await NotificationService.sendCredentials(fetchWithAuth, student, '********', updated.name, scheduleStr);
                          }

                          setSelectedClass(updated);
                          refreshClasses();
                        }
                      }}
                    >
                      <option value="">+ {t('classes.add_student')}</option>
                      {students.filter(s => !selectedClass.studentIds.includes(s.id)).map(s => (
                        <option key={s.id} value={s.id}>{s.firstName} {s.lastName}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {students.filter(s => selectedClass.studentIds.includes(s.id)).map(student => (
                    <div key={student.id} className="flex items-center justify-between p-3 bg-neutral-50 dark:bg-neutral-800/50 rounded-xl">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-dia-red/10 text-dia-red flex items-center justify-center text-xs font-bold">
                          {student.firstName[0]}{student.lastName[0]}
                        </div>
                        <div>
                          <p className="text-xs font-bold">{student.firstName} {student.lastName}</p>
                          <p className="text-[10px] text-neutral-500">{student.matricule}</p>
                        </div>
                      </div>
                      <button 
                        onClick={async () => {
                          const updatedStudentIds = selectedClass.studentIds.filter(id => id !== student.id);
                          const res = await fetchWithAuth(`/api/classes/${selectedClass.id}`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ studentIds: updatedStudentIds })
                          });
                          if (res.ok) {
                            const updated = await res.json();
                            setSelectedClass(updated);
                            refreshClasses();
                          }
                        }}
                        className="p-1 hover:bg-red-100 text-red-600 rounded-lg transition-colors"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useState, useEffect } from 'react';
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
  Layout
} from 'lucide-react';
import { cn, formatCurrency } from '../utils';
import { ClassRoom, Level, Teacher, Student } from '../types';
import { NotificationService } from '../services/NotificationService';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';

export default function ClassManagement() {
  const { fetchWithAuth } = useAuth();
  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [levels, setLevels] = useState<Level[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedClass, setSelectedClass] = useState<ClassRoom | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [classesRes, levelsRes, teachersRes, studentsRes] = await Promise.all([
        fetchWithAuth('/api/classes'),
        fetchWithAuth('/api/levels'),
        fetchWithAuth('/api/teachers'),
        fetchWithAuth('/api/students')
      ]);
      
      if (classesRes.ok) setClasses(await classesRes.json());
      if (levelsRes.ok) setLevels(await levelsRes.json());
      if (teachersRes.ok) setTeachers(await teachersRes.json());
      if (studentsRes.ok) setStudents(await studentsRes.json());
    } catch (err) {
      console.error("Error fetching class data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddClass = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
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
        fetchData();
        toast.success('Classe créée avec succès');
      }
    } catch (err) {
      console.error("Error adding class:", err);
      toast.error('Erreur lors de la création de la classe');
    }
  };

  const handleUpdateSubLevel = async (classId: string, subLevel: 1 | 2) => {
    const cls = classes.find(c => c.id === classId);
    if (!cls) return;

    const level = levels.find(l => l.id === cls.levelId);
    const teacher = teachers.find(t => t.id === cls.teacherId);

    try {
      // Update class sub-level
      const res = await fetchWithAuth(`/api/classes/${classId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentSubLevel: subLevel })
      });

      if (res.ok && teacher && level) {
        const hoursPerSubLevel = level.hours / 2;
        const salaryAmount = hoursPerSubLevel * teacher.hourlyRate;

        // Update teacher total hours
        await fetchWithAuth(`/api/teachers/${teacher.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ totalHoursWorked: (teacher.totalHoursWorked || 0) + hoursPerSubLevel })
        });

        // Record expense in finances
        await fetchWithAuth('/api/finances', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'expense',
            amount: salaryAmount,
            description: `Salaire Enseignant - ${teacher.firstName} ${teacher.lastName} - ${cls.name} (Sous-Niveau ${cls.currentSubLevel})`,
            category: 'Salary'
          })
        });

        fetchData();
      }
    } catch (err) {
      console.error("Error updating sub-level:", err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h3 className="text-xl font-bold">Gestion des Classes</h3>
        <button 
          onClick={() => setIsAddModalOpen(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus size={18} />
          <span>Nouvelle Classe</span>
        </button>
      </div>

      {/* Classes Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {classes.map((cls) => {
          const level = levels.find(l => l.id === cls.levelId);
          const teacher = teachers.find(t => t.id === cls.teacherId);
          const classStudents = students.filter(s => cls.studentIds.includes(s.id));

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
                    Sous-Niveau {cls.currentSubLevel}
                  </span>
                </div>
              </div>

              <div className="space-y-1 mb-6">
                <h4 className="font-bold text-lg">{cls.name}</h4>
                <div className="flex items-center gap-2 text-sm text-neutral-500">
                  <GraduationCap size={14} />
                  <span>Niveau {level?.name}</span>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-neutral-50 dark:bg-neutral-800/50 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-neutral-200 dark:bg-neutral-700 flex items-center justify-center text-xs font-bold">
                      {teacher ? `${teacher.firstName[0]}${teacher.lastName[0]}` : '?'}
                    </div>
                    <div>
                      <p className="text-xs font-bold">{teacher ? `${teacher.firstName} ${teacher.lastName}` : 'Non assigné'}</p>
                      <p className="text-[10px] text-neutral-500">Enseignant</p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 text-neutral-500">
                    <Users size={16} />
                    <span>{cls.studentIds.length} Étudiants</span>
                  </div>
                  <button 
                    onClick={() => {
                      setSelectedClass(cls);
                      setIsDetailModalOpen(true);
                    }}
                    className="text-dia-red font-bold flex items-center gap-1 hover:underline"
                  >
                    Détails <ChevronRight size={16} />
                  </button>
                </div>

                <div className="pt-4 border-t border-neutral-100 dark:border-neutral-800 flex gap-2">
                  <button 
                    onClick={() => handleUpdateSubLevel(cls.id, cls.currentSubLevel === 1 ? 2 : 1)}
                    className="flex-1 py-2 bg-neutral-100 dark:bg-neutral-800 rounded-lg text-xs font-bold hover:bg-neutral-200 transition-colors"
                  >
                    Passer au Sous-Niveau {cls.currentSubLevel === 1 ? 2 : 1}
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
              <h3 className="text-2xl font-bold tracking-tight">Nouvelle Classe</h3>
              <button onClick={() => setIsAddModalOpen(false)} className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition-colors">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleAddClass} className="p-8 space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">Nom de la Classe</label>
                  <input name="name" required type="text" placeholder="Ex: Allemand Intensif A1-1" className="w-full px-5 py-3 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-2xl focus:ring-2 focus:ring-dia-red/20 focus:border-dia-red outline-none transition-all" />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">Niveau</label>
                  <select name="levelId" required className="w-full px-5 py-3 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-2xl focus:ring-2 focus:ring-dia-red/20 focus:border-dia-red outline-none transition-all">
                    {levels.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">Enseignant</label>
                  <select name="teacherId" required className="w-full px-5 py-3 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-2xl focus:ring-2 focus:ring-dia-red/20 focus:border-dia-red outline-none transition-all">
                    <option value="">Sélectionner un enseignant</option>
                    {teachers.map(t => <option key={t.id} value={t.id}>{t.firstName} {t.lastName}</option>)}
                  </select>
                </div>
              </div>
              <div className="pt-4 flex gap-4">
                <button type="button" onClick={() => setIsAddModalOpen(false)} className="flex-1 px-6 py-4 bg-neutral-100 dark:bg-neutral-800 rounded-2xl font-bold transition-all hover:bg-neutral-200">Annuler</button>
                <button type="submit" className="flex-1 btn-primary py-4">Créer la Classe</button>
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
                <p className="text-neutral-500 text-sm">Gestion du planning et des évaluations</p>
              </div>
              <button onClick={() => setIsDetailModalOpen(false)} className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition-colors">
                <X size={24} />
              </button>
            </div>
            <div className="p-8 grid grid-cols-1 lg:grid-cols-2 gap-8 max-h-[70vh] overflow-y-auto">
              {/* Schedule Section */}
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold flex items-center gap-2"><Calendar size={18} /> Emploi du Temps</h4>
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
                      
                      if (teacher) {
                        await NotificationService.sendCourseSchedule(teacher, updated.name, newItem.subject, newItem.day, `${newItem.startTime}-${newItem.endTime}`);
                      }
                      for (const student of classStudents) {
                        await NotificationService.sendCourseSchedule(student, updated.name, newItem.subject, newItem.day, `${newItem.startTime}-${newItem.endTime}`);
                      }

                      setSelectedClass(updated);
                      fetchData();
                      (e.target as HTMLFormElement).reset();
                    }
                  }}
                  className="grid grid-cols-2 gap-2 p-4 bg-neutral-100 dark:bg-neutral-800 rounded-xl"
                >
                  <input name="subject" required placeholder="Sujet" className="col-span-2 text-xs p-2 rounded border-none" />
                  <select name="day" required className="text-xs p-2 rounded border-none">
                    <option value="Lundi">Lundi</option>
                    <option value="Mardi">Mardi</option>
                    <option value="Mercredi">Mercredi</option>
                    <option value="Jeudi">Jeudi</option>
                    <option value="Vendredi">Vendredi</option>
                    <option value="Samedi">Samedi</option>
                  </select>
                  <div className="flex gap-1">
                    <input name="startTime" required type="time" className="text-xs p-2 rounded border-none flex-1" />
                    <input name="endTime" required type="time" className="text-xs p-2 rounded border-none flex-1" />
                  </div>
                  <button type="submit" className="col-span-2 btn-primary py-1 text-xs">Ajouter au planning</button>
                </form>
                <div className="space-y-3">
                  {selectedClass.schedule.length === 0 ? (
                    <p className="text-sm text-neutral-500 italic">Aucun cours programmé.</p>
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
                              setSelectedClass(updated);
                              fetchData();
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
                  <h4 className="font-bold flex items-center gap-2"><BookOpen size={18} /> Évaluations</h4>
                </div>
                <form 
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const formData = new FormData(e.currentTarget);
                    const newItem = {
                      id: Date.now().toString(),
                      title: formData.get('title'),
                      date: formData.get('date'),
                      startTime: formData.get('startTime'),
                      endTime: formData.get('endTime')
                    };
                    const updatedExams = [...selectedClass.exams, newItem];
                    const res = await fetchWithAuth(`/api/classes/${selectedClass.id}`, {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ exams: updatedExams })
                    });
                    if (res.ok) {
                      const updated = await res.json();
                      setSelectedClass(updated);
                      fetchData();
                      (e.target as HTMLFormElement).reset();
                    }
                  }}
                  className="grid grid-cols-2 gap-2 p-4 bg-neutral-100 dark:bg-neutral-800 rounded-xl"
                >
                  <input name="title" required placeholder="Titre de l'examen" className="col-span-2 text-xs p-2 rounded border-none" />
                  <input name="date" required type="date" className="text-xs p-2 rounded border-none" />
                  <div className="flex gap-1">
                    <input name="startTime" required type="time" className="text-xs p-2 rounded border-none flex-1" />
                    <input name="endTime" required type="time" className="text-xs p-2 rounded border-none flex-1" />
                  </div>
                  <button type="submit" className="col-span-2 btn-primary py-1 text-xs">Programmer l'examen</button>
                </form>
                <div className="space-y-3">
                  {selectedClass.exams.length === 0 ? (
                    <p className="text-sm text-neutral-500 italic">Aucune évaluation prévue.</p>
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
                              setSelectedClass(updated);
                              fetchData();
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
                  <h4 className="font-bold flex items-center gap-2"><Users size={18} /> Étudiants de la classe</h4>
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
                            await NotificationService.sendCredentials(student, '********', updated.name, scheduleStr);
                          }

                          setSelectedClass(updated);
                          fetchData();
                        }
                      }}
                    >
                      <option value="">+ Ajouter un étudiant</option>
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
                            fetchData();
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

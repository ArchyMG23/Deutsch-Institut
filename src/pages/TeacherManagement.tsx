import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Plus, 
  MoreVertical, 
  Mail, 
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
  Camera
} from 'lucide-react';
import { cn, formatCurrency, generateMatricule } from '../utils';
import { Teacher, ClassRoom } from '../types';
import { NotificationService } from '../services/NotificationService';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { toast } from 'sonner';

export default function TeacherManagement() {
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
      email: formData.get('email'),
      phone: formData.get('phone'),
      cni: formData.get('cni'),
      hourlyRate: parseInt(formData.get('hourlyRate') as string),
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
        toast.success('Enseignant ajouté avec succès');
      } else {
        const errorData = await res.json();
        toast.error(errorData.message || 'Erreur lors de l\'ajout de l\'enseignant');
      }
    } catch (err) {
      console.error("Error adding teacher:", err);
      toast.error('Erreur lors de l\'ajout de l\'enseignant');
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
      email: formData.get('email'),
      phone: formData.get('phone'),
      cni: formData.get('cni'),
      hourlyRate: parseInt(formData.get('hourlyRate') as string),
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
        toast.success('Enseignant mis à jour avec succès');
      } else {
        const errorData = await res.json();
        toast.error(errorData.message || 'Erreur lors de la mise à jour');
      }
    } catch (err) {
      console.error("Error updating teacher:", err);
      toast.error('Erreur lors de la mise à jour');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteTeacher = async (id: string) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer cet enseignant ?')) return;
    
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
        <h3 className="text-xl font-bold">Gestion des Enseignants</h3>
        <button 
          onClick={() => setIsAddModalOpen(true)}
          className="btn-primary flex items-center gap-2"
        >
          <UserPlus size={18} />
          <span>Nouvel Enseignant</span>
        </button>
      </div>

      <div className="card p-4 flex flex-col sm:flex-row gap-4 items-center">
        <div className="relative group flex-1">
          <input 
            type="text" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher un enseignant..."
            className="w-full pl-10 pr-4 py-2 bg-neutral-100 dark:bg-neutral-800 border-none rounded-lg focus:ring-2 focus:ring-dia-red transition-all"
          />
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 group-focus-within:text-dia-red transition-colors pointer-events-none z-10" size={18} />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-neutral-400 uppercase">Trier par:</span>
          <select 
            value={sortConfig?.key || ''} 
            onChange={(e) => handleSort(e.target.value)}
            className="bg-neutral-100 dark:bg-neutral-800 border-none rounded-lg px-3 py-2 text-sm font-bold focus:ring-2 focus:ring-dia-red outline-none"
          >
            <option value="lastName">Nom</option>
            <option value="hourlyRate">Taux Horaire</option>
            <option value="totalHoursWorked">Heures Travaillées</option>
          </select>
          <button 
            onClick={() => handleSort(sortConfig?.key || 'lastName')}
            className="p-2 bg-neutral-100 dark:bg-neutral-800 rounded-lg hover:bg-neutral-200 transition-colors"
          >
            {sortConfig?.direction === 'asc' ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
        </div>
      </div>

      {/* Teachers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {sortedTeachers.map((teacher) => (
          <div key={teacher.id} className="card p-6 hover:shadow-lg transition-shadow">
            <div className="flex justify-between items-start mb-4">
              <div className="w-12 h-12 rounded-2xl bg-dia-red/10 text-dia-red flex items-center justify-center text-xl font-bold relative">
                {teacher.firstName[0]}{teacher.lastName[0]}
                {teacher.status === 'online' && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 border-4 border-white dark:border-neutral-900 rounded-full"></span>
                )}
              </div>
              <div className="flex gap-1">
                <button 
                  onClick={() => {
                    setSelectedTeacher(teacher);
                    setIsEditModalOpen(true);
                  }}
                  className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors text-blue-600"
                >
                  <Edit size={16} />
                </button>
                <button 
                  onClick={() => handleDeleteTeacher(teacher.id)}
                  className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors text-red-600"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
            
            <div className="space-y-1 mb-4">
              <h4 className="font-bold text-lg">{teacher.firstName} {teacher.lastName}</h4>
              <p className="text-xs font-mono text-neutral-500">{teacher.matricule}</p>
              {teacher.status === 'online' && (
                <p className="text-[10px] font-bold text-green-600 flex items-center gap-1 mt-2">
                  {teacher.lastActiveDevice?.toLowerCase().includes('android') || teacher.lastActiveDevice?.toLowerCase().includes('ios') ? <Smartphone size={10} /> : <Laptop size={10} />}
                  En ligne sur {teacher.lastActiveDevice}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-neutral-100 dark:border-neutral-800">
              <div className="space-y-1">
                <p className="text-[10px] font-bold uppercase text-neutral-400">Taux Horaire</p>
                <p className="text-sm font-bold flex items-center gap-1">
                  <DollarSign size={14} className="text-dia-red" />
                  {formatCurrency(teacher.hourlyRate)}/h
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-bold uppercase text-neutral-400">Heures Totales</p>
                <p className="text-sm font-bold flex items-center gap-1">
                  <Clock size={14} className="text-dia-red" />
                  {teacher.totalHoursWorked}h
                </p>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-neutral-100 dark:border-neutral-800 space-y-2">
              <div className="flex flex-wrap gap-1">
                {classes.filter(c => c.teacherId === teacher.id).map(c => (
                  <span key={c.id} className="px-2 py-0.5 bg-neutral-100 dark:bg-neutral-800 rounded-full text-[10px] font-bold text-neutral-500 uppercase">
                    {c.name}
                  </span>
                ))}
              </div>
              <p className="text-sm flex items-center gap-2 text-neutral-600 dark:text-neutral-400">
                <Mail size={14} /> {teacher.email}
              </p>
              <p className="text-sm flex items-center gap-2 text-neutral-600 dark:text-neutral-400">
                <Phone size={14} /> {teacher.phone}
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
                <h3 className="text-2xl font-bold tracking-tight">Nouvel Enseignant</h3>
                <button type="button" onClick={() => setIsAddModalOpen(false)} className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition-colors">
                  <X size={24} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-8 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">Prénom</label>
                  <input name="firstName" required type="text" className="w-full px-5 py-3 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-2xl focus:ring-2 focus:ring-dia-red/20 focus:border-dia-red outline-none transition-all" />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">Nom</label>
                  <input name="lastName" required type="text" className="w-full px-5 py-3 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-2xl focus:ring-2 focus:ring-dia-red/20 focus:border-dia-red outline-none transition-all" />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">Email</label>
                  <input name="email" required type="email" className="w-full px-5 py-3 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-2xl focus:ring-2 focus:ring-dia-red/20 focus:border-dia-red outline-none transition-all" />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">Téléphone</label>
                  <input name="phone" required type="tel" className="w-full px-5 py-3 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-2xl focus:ring-2 focus:ring-dia-red/20 focus:border-dia-red outline-none transition-all" />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">CNI</label>
                  <input name="cni" required type="text" className="w-full px-5 py-3 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-2xl focus:ring-2 focus:ring-dia-red/20 focus:border-dia-red outline-none transition-all" />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">Taux Horaire (FCFA)</label>
                  <input name="hourlyRate" required type="number" className="w-full px-5 py-3 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-2xl focus:ring-2 focus:ring-dia-red/20 focus:border-dia-red outline-none transition-all" />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">Assigner à une Classe</label>
                  <select name="classId" className="w-full px-5 py-3 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-2xl focus:ring-2 focus:ring-dia-red/20 focus:border-dia-red outline-none transition-all">
                    <option value="">Aucune classe</option>
                    {classes.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">Mot de passe temporaire</label>
                  <input name="password" type="text" defaultValue="DIA2026." className="w-full px-5 py-3 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-2xl focus:ring-2 focus:ring-dia-red/20 focus:border-dia-red outline-none transition-all" />
                  <p className="text-[10px] text-neutral-500 mt-1">L'enseignant pourra le modifier par la suite.</p>
                </div>
              </div>
            </div>
            <div className="p-8 border-t border-neutral-100 dark:border-neutral-800 flex gap-4">
              <button type="button" onClick={() => setIsAddModalOpen(false)} className="flex-1 px-6 py-4 bg-neutral-100 dark:bg-neutral-800 rounded-2xl font-bold transition-all hover:bg-neutral-200">Annuler</button>
              <button 
                type="submit" 
                disabled={submitting}
                className="flex-1 btn-primary py-4 flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white/30 border-t-white"></div>
                    Enregistrement...
                  </>
                ) : (
                  "Enregistrer l'Enseignant"
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
                            toast.loading("Chargement...");
                            const res = await fetchWithAuth('/api/profile/upload-photo', {
                              method: 'POST',
                              body: formData
                            });
                            if (res.ok) {
                              const data = await res.json();
                              setSelectedTeacher({ ...selectedTeacher, photoURL: data.photoURL });
                              refreshTeachers();
                              toast.dismiss();
                              toast.success("Photo mise à jour");
                            }
                          } catch (err) {
                            toast.dismiss();
                            toast.error("Échec de l'upload");
                          }
                        };
                        input.click();
                      }}
                      className="absolute -bottom-1 -right-1 p-1.5 bg-dia-red text-white rounded-lg shadow-lg hover:scale-110 transition-transform"
                    >
                      <Camera size={12} />
                    </button>
                  </div>
                  <h3 className="text-2xl font-bold tracking-tight">Modifier Enseignant</h3>
                </div>
                <button type="button" onClick={() => setIsEditModalOpen(false)} className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition-colors">
                  <X size={24} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-8 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">Prénom</label>
                  <input name="firstName" defaultValue={selectedTeacher.firstName} required type="text" className="w-full px-5 py-3 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-2xl focus:ring-2 focus:ring-dia-red/20 focus:border-dia-red outline-none transition-all" />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">Nom</label>
                  <input name="lastName" defaultValue={selectedTeacher.lastName} required type="text" className="w-full px-5 py-3 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-2xl focus:ring-2 focus:ring-dia-red/20 focus:border-dia-red outline-none transition-all" />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">Email</label>
                  <input name="email" defaultValue={selectedTeacher.email} required type="email" className="w-full px-5 py-3 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-2xl focus:ring-2 focus:ring-dia-red/20 focus:border-dia-red outline-none transition-all" />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">Téléphone</label>
                  <input name="phone" defaultValue={selectedTeacher.phone} required type="tel" className="w-full px-5 py-3 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-2xl focus:ring-2 focus:ring-dia-red/20 focus:border-dia-red outline-none transition-all" />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">CNI</label>
                  <input name="cni" defaultValue={selectedTeacher.cni} required type="text" className="w-full px-5 py-3 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-2xl focus:ring-2 focus:ring-dia-red/20 focus:border-dia-red outline-none transition-all" />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">Taux Horaire (FCFA)</label>
                  <input name="hourlyRate" defaultValue={selectedTeacher.hourlyRate} required type="number" className="w-full px-5 py-3 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-2xl focus:ring-2 focus:ring-dia-red/20 focus:border-dia-red outline-none transition-all" />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">Assigner à une Classe</label>
                  <select name="classId" defaultValue={classes.find(c => c.teacherId === selectedTeacher.id)?.id || ""} className="w-full px-5 py-3 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-2xl focus:ring-2 focus:ring-dia-red/20 focus:border-dia-red outline-none transition-all">
                    <option value="">Aucune classe</option>
                    {classes.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <div className="p-8 border-t border-neutral-100 dark:border-neutral-800 flex gap-4">
              <button type="button" onClick={() => setIsEditModalOpen(false)} className="flex-1 px-6 py-4 bg-neutral-100 dark:bg-neutral-800 rounded-2xl font-bold transition-all hover:bg-neutral-200">Annuler</button>
              <button 
                type="submit" 
                disabled={submitting}
                className="flex-1 btn-primary py-4 flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white/30 border-t-white"></div>
                    Mise à jour...
                  </>
                ) : (
                  "Enregistrer les modifications"
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

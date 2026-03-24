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
  Clock
} from 'lucide-react';
import { cn, formatCurrency, generateMatricule } from '../utils';
import { Teacher, ClassRoom } from '../types';
import { NotificationService } from '../services/NotificationService';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';

export default function TeacherManagement() {
  const { fetchWithAuth } = useAuth();
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchTeachers();
    fetchClasses();
  }, []);

  const fetchTeachers = async () => {
    try {
      const res = await fetchWithAuth('/api/teachers');
      if (res.ok) setTeachers(await res.json());
    } catch (err) {
      console.error("Error fetching teachers:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchClasses = async () => {
    try {
      const res = await fetchWithAuth('/api/classes');
      if (res.ok) setClasses(await res.json());
    } catch (err) {
      console.error("Error fetching classes:", err);
    }
  };

  const handleAddTeacher = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    
    const formData = new FormData(e.currentTarget);
    const matricule = generateMatricule('teacher');
    const password = `Dia.${Math.random().toString(36).slice(-4)}.${Math.floor(Math.random() * 100)}`; 
    
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

    try {
      const res = await fetchWithAuth('/api/teachers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTeacher)
      });
      if (res.ok) {
        const teacher = await res.json();
        await NotificationService.sendCredentials(teacher, password);
        setIsAddModalOpen(false);
        fetchTeachers();
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

    setSubmitting(true);
    try {
      const res = await fetchWithAuth(`/api/teachers/${selectedTeacher.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedTeacher)
      });
      if (res.ok) {
        setIsEditModalOpen(false);
        fetchTeachers();
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
        fetchTeachers();
      }
    } catch (err) {
      console.error("Error deleting teacher:", err);
    }
  };

  const filteredTeachers = teachers.filter(t => 
    `${t.firstName} ${t.lastName} ${t.matricule}`.toLowerCase().includes(searchQuery.toLowerCase())
  );

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

      {/* Search */}
      <div className="card p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={18} />
          <input 
            type="text" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher un enseignant..."
            className="w-full pl-10 pr-4 py-2 bg-neutral-100 dark:bg-neutral-800 border-none rounded-lg focus:ring-2 focus:ring-dia-red transition-all"
          />
        </div>
      </div>

      {/* Teachers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredTeachers.map((teacher) => (
          <div key={teacher.id} className="card p-6 hover:shadow-lg transition-shadow">
            <div className="flex justify-between items-start mb-4">
              <div className="w-12 h-12 rounded-2xl bg-dia-red/10 text-dia-red flex items-center justify-center text-xl font-bold">
                {teacher.firstName[0]}{teacher.lastName[0]}
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
            <div className="p-8 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
              <h3 className="text-2xl font-bold tracking-tight">Nouvel Enseignant</h3>
              <button onClick={() => setIsAddModalOpen(false)} className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition-colors">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleAddTeacher} className="p-8 space-y-6">
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
              </div>
              <div className="pt-4 flex gap-4">
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
            <div className="p-8 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
              <h3 className="text-2xl font-bold tracking-tight">Modifier Enseignant</h3>
              <button onClick={() => setIsEditModalOpen(false)} className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition-colors">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleEditTeacher} className="p-8 space-y-6">
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
              </div>
              <div className="pt-4 flex gap-4">
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

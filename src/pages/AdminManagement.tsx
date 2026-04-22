import React, { useState, useEffect } from 'react';
import { 
  Users, 
  UserPlus, 
  Search, 
  Trash2, 
  Shield, 
  ShieldAlert,
  X,
  Plus,
  Mail,
  User,
  Hash,
  AlertTriangle,
  RotateCcw
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { UserProfile } from '../types';
import { cn } from '../utils';
import { toast } from 'sonner';

export default function AdminManagement() {
  const { fetchWithAuth, user: currentUser } = useAuth();
  const [admins, setAdmins] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchAdmins = async () => {
    try {
      const res = await fetchWithAuth('/api/admins');
      if (res.ok) {
        const data = await res.json();
        setAdmins(data);
      }
    } catch (err) {
      console.error("Error fetching admins:", err);
      toast.error("Échec de la récupération des administrateurs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdmins();
  }, []);

  const handleAddAdmin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);

    const formData = new FormData(e.currentTarget);
    const newAdmin = {
      email: formData.get('email'),
      password: formData.get('password'),
      firstName: formData.get('firstName'),
      lastName: formData.get('lastName'),
      matricule: formData.get('matricule'),
    };

    try {
      const res = await fetchWithAuth('/api/admins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newAdmin)
      });

      if (res.ok) {
        toast.success("Administrateur ajouté avec succès");
        setIsAddModalOpen(false);
        fetchAdmins();
      } else {
        const error = await res.json();
        toast.error(error.message || "Erreur lors de l'ajout");
      }
    } catch (err) {
      console.error("Error adding admin:", err);
      toast.error("Erreur réseau");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteAdmin = async (adminId: string) => {
    const adminToDelete = admins.find(a => a.uid === adminId);
    if (!adminToDelete) return;

    if (adminToDelete.isSuperAdmin) {
      toast.error("Impossible de supprimer le Super Administrateur");
      return;
    }

    if (!window.confirm(`Voulez-vous vraiment supprimer l'administrateur ${adminToDelete.firstName} ${adminToDelete.lastName} ?`)) {
      return;
    }

    try {
      const res = await fetchWithAuth(`/api/admins/${adminId}`, {
        method: 'DELETE'
      });

      if (res.ok) {
        toast.success("Administrateur supprimé");
        fetchAdmins();
      } else {
        const error = await res.json();
        toast.error(error.message || "Erreur lors de la suppression");
      }
    } catch (err) {
      console.error("Error deleting admin:", err);
      toast.error("Erreur réseau");
    }
  };

  const filteredAdmins = admins.filter(a => 
    `${a.firstName} ${a.lastName} ${a.matricule} ${a.email}`.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleResetSystem = async () => {
    const confirmation = window.prompt("ATTENTION : Cette action va effacer TOUTES les données (élèves, enseignants, finances, classes). Pour confirmer, tapez 'RESET_FACTORY' :");
    
    if (confirmation !== 'RESET_FACTORY') {
      if (confirmation) toast.error("Code de confirmation incorrect");
      return;
    }

    setLoading(true);
    try {
      const res = await fetchWithAuth('/api/system/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmation })
      });

      if (res.ok) {
        toast.success("Système réinitialisé avec succès !");
        window.location.reload(); // Reload to clear all data in context
      } else {
        const error = await res.json();
        toast.error(error.message || "Échec de la réinitialisation");
      }
    } catch (err) {
      console.error("Error resetting system:", err);
      toast.error("Erreur réseau");
    } finally {
      setLoading(false);
    }
  };

  const isSuperAdmin = (currentUser as any)?.isSuperAdmin;

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-dia-red"></div></div>;

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold">Gestion des Administrateurs</h3>
          <p className="text-sm text-neutral-500">Gérez les accès administratifs de la plateforme.</p>
        </div>
        <button 
          onClick={() => setIsAddModalOpen(true)}
          className="btn-primary flex items-center gap-2"
        >
          <UserPlus size={18} />
          <span>Nouveau Administrateur</span>
        </button>
      </div>

      <div className="card p-4">
        <div className="relative group">
          <input 
            type="text" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher par nom, matricule ou email..."
            className="w-full pl-10 pr-4 py-2 bg-neutral-100 dark:bg-neutral-800 border-none rounded-lg focus:ring-2 focus:ring-dia-red transition-all"
          />
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 group-focus-within:text-dia-red transition-colors pointer-events-none" size={18} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredAdmins.map((admin) => (
          <div key={admin.uid} className="card p-6 relative overflow-hidden group">
            {admin.isSuperAdmin && (
              <div className="absolute top-0 right-0 bg-dia-red text-white text-[10px] font-black px-4 py-1 rotate-45 translate-x-3 translate-y-2 uppercase tracking-tighter shadow-lg">
                Super Admin
              </div>
            )}
            
            <div className="flex items-start gap-4">
              <div className={cn(
                "w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-lg",
                admin.isSuperAdmin ? "bg-dia-red/10 text-dia-red" : "bg-neutral-100 dark:bg-neutral-800 text-neutral-500"
              )}>
                {admin.firstName[0]}{admin.lastName[0]}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-bold text-sm truncate">{admin.firstName} {admin.lastName}</h4>
                <p className="text-xs text-neutral-500 truncate">{admin.email}</p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-[10px] font-mono bg-neutral-100 dark:bg-neutral-800 px-1.5 py-0.5 rounded">
                    {admin.matricule}
                  </span>
                  {admin.isSuperAdmin ? (
                    <Shield size={14} className="text-dia-red" />
                  ) : (
                    <Shield size={14} className="text-neutral-400" />
                  )}
                </div>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-neutral-100 dark:border-neutral-800 flex justify-end gap-2">
              {isSuperAdmin && !admin.isSuperAdmin && (
                <button 
                  onClick={() => handleDeleteAdmin(admin.uid)}
                  className="p-2 hover:bg-red-50 dark:hover:bg-red-950/20 text-red-500 rounded-lg transition-colors"
                  title="Supprimer l'administrateur"
                >
                  <Trash2 size={18} />
                </button>
              )}
              {admin.isSuperAdmin && (
                <div className="p-2 text-dia-red flex items-center gap-2 text-xs font-bold bg-dia-red/5 rounded-lg border border-dia-red/10">
                  <ShieldAlert size={14} />
                  Protégé
                </div>
              )}
            </div>
          </div>
        ))}

        {filteredAdmins.length === 0 && (
          <div className="col-span-full py-20 text-center card bg-neutral-50/50 dark:bg-neutral-900/30 border-dashed border-2">
            <Users size={48} className="mx-auto text-neutral-300 mb-4" />
            <p className="text-neutral-500">Aucun administrateur trouvé.</p>
          </div>
        )}
      </div>

      {isSuperAdmin && (
        <div className="mt-12 p-8 border-2 border-red-500/20 bg-red-50 dark:bg-red-950/10 rounded-[32px] space-y-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-red-500 text-white flex items-center justify-center">
              <AlertTriangle size={24} />
            </div>
            <div>
              <h4 className="text-xl font-black text-red-600 uppercase tracking-tight">Zone de Danger Système</h4>
              <p className="text-sm text-red-500 font-medium">Action irréversible. Toutes les données de l'application seront supprimées.</p>
            </div>
          </div>
          
          <div className="p-6 bg-white dark:bg-neutral-900/50 rounded-2xl border border-red-200 dark:border-red-900/30">
            <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-6 leading-relaxed">
              La réinitialisation d'usine supprimera définitivement tous les élèves, enseignants, classes, registres financiers, communiqués et documents de la bibliothèque. 
              <strong> Vos comptes Super Administrateur seront conservés</strong> pour vous permettre de recommencer une nouvelle configuration.
            </p>
            
            <button 
              onClick={handleResetSystem}
              className="flex items-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-red-600/20 active:scale-95"
            >
              <RotateCcw size={18} />
              <span>Réinitialiser toute l'école</span>
            </button>
          </div>
        </div>
      )}

      {/* Add Admin Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-neutral-900 w-full max-w-lg rounded-[32px] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-8 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
              <h3 className="text-2xl font-bold tracking-tight">Nouvel Administrateur</h3>
              <button onClick={() => setIsAddModalOpen(false)} className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition-colors">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleAddAdmin} className="p-8 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">Prénom</label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" size={16} />
                    <input name="firstName" required type="text" className="w-full pl-12 pr-4 py-3 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-2xl outline-none focus:ring-2 focus:ring-dia-red/20 focus:border-dia-red transition-all" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">Nom</label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" size={16} />
                    <input name="lastName" required type="text" className="w-full pl-12 pr-4 py-3 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-2xl outline-none focus:ring-2 focus:ring-dia-red/20 focus:border-dia-red transition-all" />
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">Matricule</label>
                <div className="relative">
                  <Hash className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" size={16} />
                  <input name="matricule" required type="text" placeholder="ADMIN_EXAM" className="w-full pl-12 pr-4 py-3 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-2xl outline-none focus:ring-2 focus:ring-dia-red/20 focus:border-dia-red transition-all" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">Email</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" size={16} />
                  <input name="email" required type="email" className="w-full pl-12 pr-4 py-3 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-2xl outline-none focus:ring-2 focus:ring-dia-red/20 focus:border-dia-red transition-all" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">Mot de passe provisoire</label>
                <input name="password" required type="text" defaultValue="Admin.1234" className="w-full px-5 py-3 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-2xl outline-none focus:ring-2 focus:ring-dia-red/20 focus:border-dia-red transition-all" />
              </div>

              <div className="pt-4 flex gap-4">
                <button type="button" onClick={() => setIsAddModalOpen(false)} className="flex-1 px-6 py-4 bg-neutral-100 dark:bg-neutral-800 rounded-2xl font-bold transition-all hover:bg-neutral-200">Annuler</button>
                <button 
                  type="submit" 
                  disabled={submitting}
                  className="flex-1 btn-primary py-4 flex items-center justify-center gap-2"
                >
                  {submitting ? "Traitement..." : "Créer le compte"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

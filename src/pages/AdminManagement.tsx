import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Users, 
  UserPlus, 
  Search, 
  Trash2, 
  Shield, 
  ShieldAlert,
  X,
  Plus,
  User,
  Hash,
  AlertTriangle,
  RotateCcw,
  Smartphone,
  Pencil
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { UserProfile } from '../types';
import { cn } from '../utils';
import { toast } from 'sonner';
import { NotificationService } from '../services/NotificationService';

export default function AdminManagement() {
  const { t } = useTranslation();
  const { fetchWithAuth, user: currentUser } = useAuth();
  const [admins, setAdmins] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingAdmin, setEditingAdmin] = useState<UserProfile | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const fetchAdmins = async () => {
    try {
      const res = await fetchWithAuth('/api/admins');
      if (res.ok) {
        const data = await res.json();
        setAdmins(data);
      }
    } catch (err) {
      console.error("Error fetching admins:", err);
      toast.error(t('admins.fetch_error'));
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
      phone: formData.get('phone'),
    };

    try {
      const res = await fetchWithAuth('/api/admins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newAdmin)
      });

      if (res.ok) {
        toast.success(t('admins.add_success'));
        setIsAddModalOpen(false);
        fetchAdmins();
      } else {
        // fetchWithAuth already displays error toast
      }
    } catch (err) {
      console.error("Error adding admin:", err);
      toast.error(t('common.error'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditAdmin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitting || !editingAdmin) return;
    setSubmitting(true);

    const formData = new FormData(e.currentTarget);
    const updatedData = {
      email: formData.get('email'),
      firstName: formData.get('firstName'),
      lastName: formData.get('lastName'),
      matricule: formData.get('matricule'),
      phone: formData.get('phone'),
    };

    try {
      const res = await fetchWithAuth(`/api/admins/${editingAdmin.uid}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedData)
      });

      if (res.ok) {
        toast.success(t('common.updated'));
        setIsEditModalOpen(false);
        setEditingAdmin(null);
        fetchAdmins();
      } else {
        // Error toast already shown by fetchWithAuth
      }
    } catch (err) {
      console.error("Error updating admin:", err);
      toast.error(t('common.error'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleSuperAdmin = async (admin: UserProfile) => {
    if (!isSuperAdmin) return;
    
    // Safety check: Don't let someone demote themselves if they are the only super admin
    // (though system keeps original super admins in reset logic, it's good UX)
    if (admin.uid === currentUser?.uid) {
      toast.error("Vous ne pouvez pas modifier votre propre statut de Super Admin.");
      return;
    }

    const action = admin.isSuperAdmin ? "rétrograder" : "promouvoir";
    if (!window.confirm(`Êtes-vous sûr de vouloir ${action} ${admin.firstName} au rang de Super Administrateur ?`)) {
      return;
    }

    try {
      const res = await fetchWithAuth(`/api/admins/${admin.uid}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isSuperAdmin: !admin.isSuperAdmin })
      });

      if (res.ok) {
        toast.success(t('common.updated'));
        fetchAdmins();
      } else {
        // fetchWithAuth already handles error toast
      }
    } catch (err) {
      toast.error(t('common.error'));
    }
  };

  const handleNotifyAdmin = (admin: UserProfile) => {
    if (!admin.phone) {
      toast.error("Aucun numéro de téléphone enregistré pour cet admin.");
      return;
    }

    const message = `Bonjour ${admin.firstName},\nVoici vos accès pour le système DIA_SAAS :\n\n- Rôle: Administrateur\n- Matricule: ${admin.matricule}\n- Mot de passe: Admin.1234 (temporaire)\n- Lien d'accès: ${window.location.origin}\n\nVeuillez changer votre mot de passe dès votre première connexion.`;
    NotificationService._triggerWhatsApp(fetchWithAuth, admin.phone, message);
  };

  const handleDeleteAdmin = async (adminId: string) => {
    const adminToDelete = admins.find(a => a.uid === adminId);
    if (!adminToDelete) return;

    if (adminToDelete.isSuperAdmin) {
      toast.error(t('admins.cannot_delete_superadmin'));
      return;
    }

    if (!window.confirm(`${t('admins.confirm_delete_prefix')} ${adminToDelete.firstName} ${adminToDelete.lastName} ${t('admins.confirm_delete_suffix')}`)) {
      return;
    }

    try {
      const res = await fetchWithAuth(`/api/admins/${adminId}`, {
        method: 'DELETE'
      });

      if (res.ok) {
        toast.success(t('common.deleted'));
        fetchAdmins();
      } else {
        // Redundant toast removed
      }
    } catch (err) {
      console.error("Error deleting admin:", err);
      toast.error(t('common.error'));
    }
  };

  const filteredAdmins = admins.filter(a => 
    `${a.firstName} ${a.lastName} ${a.matricule}`.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleResetSystem = async () => {
    const confirmation = window.prompt(t('admins.reset_prompt'));
    
    if (confirmation !== 'RESET_FACTORY') {
      if (confirmation) toast.error(t('admins.reset_code_error'));
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
        toast.success(t('admins.reset_success'));
        window.location.reload(); // Reload to clear all data in context
      } else {
        // Redundant toast removed
      }
    } catch (err) {
      console.error("Error resetting system:", err);
      toast.error(t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  const isSuperAdmin = (currentUser as any)?.isSuperAdmin || 
                      currentUser?.email === 'yombivictor@gmail.com' || 
                      currentUser?.email === 'gabrielyombi311@gmail.com';

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-dia-red"></div></div>;

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold">{t('admins.title')}</h3>
          <p className="text-sm text-neutral-500">{t('admins.subtitle')}</p>
        </div>
        <button 
          onClick={() => setIsAddModalOpen(true)}
          className="btn-primary flex items-center gap-2"
        >
          <UserPlus size={18} />
          <span>{t('admins.new_admin')}</span>
        </button>
      </div>

      <div className="card p-4">
        <div className="relative group">
          <input 
            type="text" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('admins.search_placeholder')}
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

            <div className="mt-6 pt-6 border-t border-neutral-100 dark:border-neutral-800 flex justify-between items-center">
              <div className="text-[10px] text-neutral-400 font-medium">
                {admin.phone && (
                  <span className="flex items-center gap-1">
                    <Smartphone size={10} />
                    {admin.phone}
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => handleNotifyAdmin(admin)}
                  className="p-2 hover:bg-green-50 dark:hover:bg-green-950/20 text-green-500 rounded-lg transition-colors"
                  title="Notifier par WhatsApp"
                >
                  <Smartphone size={18} />
                </button>
                {isSuperAdmin && (
                  <>
                    <button 
                      onClick={() => {
                        setEditingAdmin(admin);
                        setIsEditModalOpen(true);
                      }}
                      className="p-2 hover:bg-blue-50 dark:hover:bg-blue-950/20 text-blue-500 rounded-lg transition-colors"
                      title={t('common.edit')}
                    >
                      <Pencil size={18} />
                    </button>
                    <button 
                      onClick={() => handleToggleSuperAdmin(admin)}
                      className={cn(
                        "p-2 rounded-lg transition-colors",
                        admin.isSuperAdmin ? "text-dia-red hover:bg-dia-red/10" : "text-neutral-400 hover:bg-neutral-100"
                      )}
                      title={admin.isSuperAdmin ? "Rétrograder l'admin" : "Promouvoir en Super Admin"}
                    >
                      <Shield size={18} />
                    </button>
                  </>
                )}
                {isSuperAdmin && !admin.isSuperAdmin && (
                  <button 
                    onClick={() => handleDeleteAdmin(admin.uid)}
                    className="p-2 hover:bg-red-50 dark:hover:bg-red-950/20 text-red-500 rounded-lg transition-colors"
                    title={t('admins.delete_admin')}
                  >
                    <Trash2 size={18} />
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}

        {filteredAdmins.length === 0 && (
          <div className="col-span-full py-20 text-center card bg-neutral-50/50 dark:bg-neutral-900/30 border-dashed border-2">
            <Users size={48} className="mx-auto text-neutral-300 mb-4" />
            <p className="text-neutral-500">{t('common.no_results')}</p>
          </div>
        )}
      </div>

      {isSuperAdmin && (
        <div className="mt-12 p-8 border-2 border-orange-500/20 bg-orange-50 dark:bg-orange-950/10 rounded-[32px] space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-orange-500 text-white flex items-center justify-center">
              <ShieldAlert size={20} />
            </div>
            <div>
              <h4 className="text-lg font-bold text-orange-700">{t('admins.admin_info')}</h4>
              <p className="text-xs text-orange-600">{t('admins.super_admin_notice') || 'Vous avez des privilèges de Super Admin.'}</p>
            </div>
          </div>
        </div>
      )}

      {/* Add Admin Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-neutral-900 w-full max-w-lg rounded-[32px] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-8 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
              <h3 className="text-2xl font-bold tracking-tight">{t('admins.new_admin')}</h3>
              <button onClick={() => setIsAddModalOpen(false)} className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition-colors">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleAddAdmin} className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">Email *</label>
                  <input name="email" required type="email" placeholder="admin@example.com" className="w-full px-5 py-3 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-2xl outline-none focus:ring-2 focus:ring-dia-red/20 focus:border-dia-red transition-all" />
                </div>
                <div className="space-y-2 flex gap-4">
                  <div className="flex-1 space-y-2">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">{t('common.firstName')}</label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" size={16} />
                      <input name="firstName" required type="text" className="w-full pl-12 pr-4 py-3 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-2xl outline-none focus:ring-2 focus:ring-dia-red/20 focus:border-dia-red transition-all" />
                    </div>
                  </div>
                  <div className="flex-1 space-y-2">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">{t('common.lastName')}</label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" size={16} />
                      <input name="lastName" required type="text" className="w-full pl-12 pr-4 py-3 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-2xl outline-none focus:ring-2 focus:ring-dia-red/20 focus:border-dia-red transition-all" />
                    </div>
                  </div>
                </div>
              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">{t('common.matricule')}</label>
                <div className="relative">
                  <Hash className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" size={16} />
                  <input name="matricule" required type="text" placeholder="ADMIN_EXAM" className="w-full pl-12 pr-4 py-3 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-2xl outline-none focus:ring-2 focus:ring-dia-red/20 focus:border-dia-red transition-all" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">{t('admins.phone')}</label>
                <div className="relative">
                  <Smartphone className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" size={16} />
                  <input name="phone" type="tel" placeholder="2376..." className="w-full pl-12 pr-4 py-3 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-2xl outline-none focus:ring-2 focus:ring-dia-red/20 focus:border-dia-red transition-all" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">{t('admins.temp_password')}</label>
                <input name="password" required type="text" defaultValue="Admin.1234" className="w-full px-5 py-3 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-2xl outline-none focus:ring-2 focus:ring-dia-red/20 focus:border-dia-red transition-all" />
              </div>

              <div className="pt-4 flex gap-4">
                <button type="button" onClick={() => setIsAddModalOpen(false)} className="flex-1 px-6 py-4 bg-neutral-100 dark:bg-neutral-800 rounded-2xl font-bold transition-all hover:bg-neutral-200">{t('common.cancel')}</button>
                <button 
                  type="submit" 
                  disabled={submitting}
                  className="flex-1 btn-primary py-4 flex items-center justify-center gap-2"
                >
                  {submitting ? t('common.processing') : t('admins.create_account')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Admin Modal */}
      {isEditModalOpen && editingAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-neutral-900 w-full max-w-lg rounded-[32px] shadow-2xl overflow-hidden">
            <div className="p-8 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
              <h3 className="text-2xl font-bold tracking-tight">{t('common.edit')}</h3>
              <button onClick={() => setIsEditModalOpen(false)} className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition-colors">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleEditAdmin} className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">Email *</label>
                  <input name="email" required type="email" defaultValue={editingAdmin.email} className="w-full px-5 py-3 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-2xl outline-none focus:ring-2 focus:ring-dia-red/20 focus:border-dia-red transition-all" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">{t('common.firstName')}</label>
                    <input name="firstName" required type="text" defaultValue={editingAdmin.firstName} className="w-full px-5 py-3 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-2xl outline-none focus:ring-2 focus:ring-dia-red/20 focus:border-dia-red transition-all" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">{t('common.lastName')}</label>
                    <input name="lastName" required type="text" defaultValue={editingAdmin.lastName} className="w-full px-5 py-3 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-2xl outline-none focus:ring-2 focus:ring-dia-red/20 focus:border-dia-red transition-all" />
                  </div>
                </div>
              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">{t('common.matricule')}</label>
                <input name="matricule" required type="text" defaultValue={editingAdmin.matricule} className="w-full px-5 py-3 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-2xl outline-none focus:ring-2 focus:ring-dia-red/20 focus:border-dia-red transition-all" />
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">{t('admins.phone')}</label>
                <input name="phone" type="tel" defaultValue={editingAdmin.phone} placeholder="2376..." className="w-full px-5 py-3 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-2xl outline-none focus:ring-2 focus:ring-dia-red/20 focus:border-dia-red transition-all" />
              </div>

              <div className="pt-4 flex gap-4">
                <button type="button" onClick={() => setIsEditModalOpen(false)} className="flex-1 px-6 py-4 bg-neutral-100 dark:bg-neutral-800 rounded-2xl font-bold">{t('common.cancel')}</button>
                <button 
                  type="submit" 
                  disabled={submitting}
                  className="flex-1 btn-primary py-4"
                >
                  {submitting ? t('common.processing') : t('common.save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

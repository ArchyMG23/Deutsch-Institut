import React, { useState } from 'react';
import { 
  User, 
  Mail, 
  Lock, 
  Shield, 
  Check, 
  AlertCircle,
  Eye,
  EyeOff,
  Save,
  Trash2,
  Camera
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { cn } from '../utils';
import { toast } from 'sonner';

export default function AdminProfile() {
  const { user, profile, updateProfile, fetchWithAuth, logout } = useAuth();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  
  // Profile state
  const [firstName, setFirstName] = useState(profile?.firstName || user?.firstName || '');
  const [lastName, setLastName] = useState(profile?.lastName || user?.lastName || '');
  const [email, setEmail] = useState(profile?.email || user?.email || '');

  React.useEffect(() => {
    if (profile) {
      setFirstName(profile.firstName || '');
      setLastName(profile.lastName || '');
      setEmail(profile.email || '');
    }
  }, [profile]);
  
  // Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);

    try {
      const res = await fetchWithAuth(`/api/users/${user.uid}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstName, lastName, email })
      });

      if (res.ok) {
        toast.success("Profil mis à jour avec succès");
      } else {
        const err = await res.json();
        toast.error(err.message || "Erreur lors de la mise à jour");
      }
    } catch (err) {
      toast.error("Échec de la mise à jour");
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('photo', file);

    try {
      const res = await fetchWithAuth('/api/profile/upload-photo', {
        method: 'POST',
        body: formData
      });

      if (res.ok) {
        const data = await res.json();
        if (profile) {
          updateProfile({ ...profile, photoURL: data.photoURL });
        }
        toast.success("Photo de profil mise à jour");
      }
    } catch (err) {
      toast.error("Échec du téléchargement");
    } finally {
      setUploading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error("Les nouveaux mots de passe ne correspondent pas");
      return;
    }
    setLoading(true);

    try {
      const res = await fetchWithAuth('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword })
      });

      if (res.ok) {
        toast.success("Mot de passe modifié avec succès");
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        const err = await res.json();
        toast.error(err.message || "Erreur lors du changement");
      }
    } catch (err) {
      toast.error("Échec du changement de mot de passe");
    } finally {
      setLoading(false);
    }
  };

  const isSuperAdmin = (user as any)?.isSuperAdmin;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-2xl font-bold">Mon Profil Administrateur</h3>
          <p className="text-neutral-500">Gérez vos informations personnelles et votre sécurité.</p>
        </div>
        {isSuperAdmin && (
          <div className="flex items-center gap-2 px-4 py-2 bg-dia-red/10 text-dia-red rounded-2xl border border-dia-red/20 font-bold text-sm">
            <Shield size={16} />
            Super Administrateur
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Left Column: Avatar & Basic Info */}
        <div className="space-y-6">
          <div className="card p-8 text-center flex flex-col items-center">
            <div className="relative group mb-4">
              <div className="w-24 h-24 rounded-[32px] bg-dia-red/10 text-dia-red flex items-center justify-center text-3xl font-bold overflow-hidden border-4 border-white dark:border-neutral-900 shadow-lg">
                {profile?.photoURL ? (
                  <img src={profile.photoURL} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <>{firstName[0]}{lastName[0]}</>
                )}
              </div>
              <button 
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="absolute -bottom-1 -right-1 p-2 bg-dia-red text-white rounded-xl shadow-lg hover:scale-110 transition-all border-2 border-white dark:border-neutral-900"
              >
                {uploading ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Camera size={14} />
                )}
              </button>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handlePhotoUpload} 
                accept="image/*" 
                className="hidden" 
              />
            </div>
            <h4 className="font-bold text-lg">{firstName} {lastName}</h4>
            <p className="text-sm text-neutral-500 font-mono mb-6">{user?.matricule}</p>
            <div className="w-full pt-6 border-t border-neutral-100 dark:border-neutral-800">
              <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-neutral-400 mb-2">
                <span>Rôle</span>
                <span className="text-dia-red">{user?.role}</span>
              </div>
              <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-neutral-400">
                <span>Depuis le</span>
                <span className="text-neutral-600 dark:text-neutral-300">
                  {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
                </span>
              </div>
            </div>
          </div>

          <div className="card p-6 bg-amber-50/50 dark:bg-amber-950/10 border-amber-100 dark:border-amber-900/30">
            <div className="flex gap-3">
              <AlertCircle className="text-amber-500 shrink-0" size={20} />
              <div>
                <h5 className="font-bold text-sm text-amber-800 dark:text-amber-400">Astuce Sécurité</h5>
                <p className="text-xs text-amber-700 dark:text-amber-500 mt-1 leading-relaxed">
                  Ne partagez jamais vos identifiants. Changez votre mot de passe tous les 90 jours pour une sécurité optimale.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Forms */}
        <div className="md:col-span-2 space-y-6">
          {/* Profile Form */}
          <div className="card">
            <div className="p-6 border-b border-neutral-100 dark:border-neutral-800">
              <h4 className="font-bold flex items-center gap-2">
                <User size={18} className="text-dia-red" />
                Informations Personnelles
              </h4>
            </div>
            <form onSubmit={handleUpdateProfile} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">Prénom</label>
                  <input 
                    value={firstName} 
                    onChange={e => setFirstName(e.target.value)} 
                    required 
                    type="text" 
                    className="w-full px-4 py-2.5 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl outline-none focus:ring-2 focus:ring-dia-red/20 focus:border-dia-red transition-all" 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">Nom</label>
                  <input 
                    value={lastName} 
                    onChange={e => setLastName(e.target.value)} 
                    required 
                    type="text" 
                    className="w-full px-4 py-2.5 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl outline-none focus:ring-2 focus:ring-dia-red/20 focus:border-dia-red transition-all" 
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">Email</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" size={16} />
                  <input 
                    value={email} 
                    onChange={e => setEmail(e.target.value)} 
                    required 
                    type="email" 
                    className="w-full pl-12 pr-4 py-2.5 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl outline-none focus:ring-2 focus:ring-dia-red/20 focus:border-dia-red transition-all" 
                  />
                </div>
              </div>
              <div className="pt-4">
                <button 
                  type="submit" 
                  disabled={loading}
                  className="btn-primary w-full py-3 flex items-center justify-center gap-2"
                >
                  <Save size={18} />
                  {loading ? "Enregistrement..." : "Enregistrer les modifications"}
                </button>
              </div>
            </form>
          </div>

          {/* Security Form */}
          <div className="card">
            <div className="p-6 border-b border-neutral-100 dark:border-neutral-800">
              <h4 className="font-bold flex items-center gap-2">
                <Lock size={18} className="text-dia-red" />
                Sécurité & Mot de passe
              </h4>
            </div>
            <form onSubmit={handleChangePassword} className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">Mot de passe actuel</label>
                <div className="relative">
                  <input 
                    value={currentPassword}
                    onChange={e => setCurrentPassword(e.target.value)}
                    required
                    type={showCurrentPass ? 'text' : 'password'}
                    className="w-full px-4 py-2.5 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl outline-none focus:ring-2 focus:ring-dia-red/20 focus:border-dia-red transition-all" 
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowCurrentPass(!showCurrentPass)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-dia-red"
                  >
                    {showCurrentPass ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">Nouveau mot de passe</label>
                  <div className="relative">
                    <input 
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      required
                      type={showNewPass ? 'text' : 'password'}
                      className="w-full px-4 py-2.5 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl outline-none focus:ring-2 focus:ring-dia-red/20 focus:border-dia-red transition-all" 
                    />
                    <button 
                      type="button" 
                      onClick={() => setShowNewPass(!showNewPass)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-dia-red"
                    >
                      {showNewPass ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">Confirmer</label>
                  <input 
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    required
                    type="password"
                    className="w-full px-4 py-2.5 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl outline-none focus:ring-2 focus:ring-dia-red/20 focus:border-dia-red transition-all" 
                  />
                </div>
              </div>
              <div className="pt-4">
                <button 
                  type="submit" 
                  disabled={loading}
                  className="w-full py-3 bg-neutral-800 dark:bg-neutral-700 text-white rounded-xl font-bold hover:bg-neutral-900 transition-all flex items-center justify-center gap-2"
                >
                  <Check size={18} />
                  {loading ? "Mise à jour..." : "Changer le mot de passe"}
                </button>
              </div>
            </form>
          </div>

          {/* Danger Zone */}
          <div className="card border-red-100 dark:border-red-900/30 overflow-hidden">
            <div className="p-6 bg-red-50/50 dark:bg-red-950/10 border-b border-red-100 dark:border-red-900/20">
              <h4 className="font-bold flex items-center gap-2 text-red-600 dark:text-red-400">
                <Trash2 size={18} />
                Zone de Danger
              </h4>
              <p className="text-xs text-red-500/80 mt-1">Actions irréversibles pour votre compte et vos données.</p>
            </div>
            <div className="p-6 space-y-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h5 className="font-bold text-sm">Déconnexion de tous les appareils</h5>
                  <p className="text-xs text-neutral-500 mt-0.5">Récupérez le contrôle en déconnectant les sessions actives.</p>
                </div>
                <button 
                  onClick={logout}
                  className="px-4 py-2 text-sm font-bold border border-neutral-200 dark:border-neutral-700 rounded-xl hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-all"
                >
                  Déconnexion
                </button>
              </div>

              <div className="pt-6 border-t border-red-50 dark:border-red-900/20 flex items-center justify-between gap-4">
                <div>
                  <h5 className="font-bold text-sm text-red-600">Supprimer mon compte</h5>
                  <p className="text-xs text-neutral-500 mt-0.5">Cette action entrainera la perte de toutes vos données administratives.</p>
                </div>
                <button 
                  onClick={() => toast.error("Veuillez contacter le super-administrateur pour la suppression de compte.")}
                  className="px-4 py-2 text-sm font-bold bg-red-600 text-white rounded-xl hover:bg-red-700 transition-all shadow-lg shadow-red-600/20"
                >
                  Supprimer
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

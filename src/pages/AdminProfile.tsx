import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  User, 
  Lock, 
  Shield, 
  Check, 
  AlertCircle,
  Eye,
  EyeOff,
  Save,
  Trash2,
  Camera,
  School,
  FileText,
  CalendarDays,
  Smartphone
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { cn } from '../utils';
import { toast } from 'sonner';
import { db } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { SchoolConfig } from '../types';
import { compressImage } from '../utils/image-compression';

export default function AdminProfile() {
  const { user, profile, updateProfile, fetchWithAuth, logout } = useAuth();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  
  // Profile state
  const [firstName, setFirstName] = useState(profile?.firstName || user?.firstName || '');
  const [lastName, setLastName] = useState(profile?.lastName || user?.lastName || '');
  const [phone, setPhone] = useState(profile?.phone || user?.phone || '');

  // School Config state
  const [schoolConfig, setSchoolConfig] = useState<SchoolConfig>({
    id: 'current',
    nom: 'DIA DEUTSCH INSTITUT',
    logo_url: '',
    annee_scolaire: '2025-2026',
    format_recu: 'A5'
  });

  React.useEffect(() => {
    if (profile) {
      setFirstName(profile.firstName || '');
      setLastName(profile.lastName || '');
      setPhone(profile.phone || '');
    }

    const fetchSchoolConfig = async () => {
      const snap = await getDoc(doc(db, 'ecole', 'current'));
      if (snap.exists()) {
        setSchoolConfig(snap.data() as SchoolConfig);
      }
    };
    if (user?.role === 'admin') fetchSchoolConfig();
  }, [profile, user]);

  const handleUpdateSchoolConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await setDoc(doc(db, 'ecole', 'current'), schoolConfig);
      toast.success("Configuration de l'école mise à jour");
    } catch (err) {
      toast.error("Erreur de configuration");
    } finally {
      setLoading(false);
    }
  };
  
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
        body: JSON.stringify({ firstName, lastName, phone })
      });

      if (res.ok) {
        toast.success(t('profile.save_success'));
      } else {
        const err = await res.json();
        toast.error(err.message || t('profile.save_error'));
      }
    } catch (err) {
      toast.error(t('profile.save_error'));
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      // Compresser l'image avant l'envoi
      const compressedFile = await compressImage(file);
      
      const formData = new FormData();
      formData.append('photo', compressedFile);

      const res = await fetchWithAuth('/api/profile/upload-photo', {
        method: 'POST',
        body: formData
      });

      if (res.ok) {
        const data = await res.json();
        if (profile) {
          updateProfile({ ...profile, photoURL: data.photoURL });
        }
        toast.success(t('profile.photo_success'));
      }
    } catch (err) {
      toast.error(t('profile.upload_error'));
    } finally {
      setUploading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error(t('profile.password_mismatch'));
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
        toast.success(t('profile.password_success'));
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        const err = await res.json();
        toast.error(err.message || t('profile.save_error'));
      }
    } catch (err) {
      toast.error(t('profile.save_error'));
    } finally {
      setLoading(false);
    }
  };

  const isSuperAdmin = (user as any)?.isSuperAdmin;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-2xl font-bold">{t('sidebar.profile')}</h3>
          <p className="text-neutral-500">{t('profile.personal_info')}</p>
        </div>
        {isSuperAdmin && (
          <div className="flex items-center gap-2 px-4 py-2 bg-dia-red/10 text-dia-red rounded-2xl border border-dia-red/20 font-bold text-sm">
            <Shield size={16} />
            {t('common.super_admin')}
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
                <span>{t('common.role')}</span>
                <span className="text-dia-red">{user?.role}</span>
              </div>
              <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-neutral-400">
                <span>{t('common.since')}</span>
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
                <h5 className="font-bold text-sm text-amber-800 dark:text-amber-400">{t('profile.security_tip_title')}</h5>
                <p className="text-xs text-amber-700 dark:text-amber-500 mt-1 leading-relaxed">
                  {t('profile.security_tip_desc')}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Forms */}
        <div className="md:col-span-2 space-y-6">
          {/* Profile Form */}
          {user?.role === 'admin' && (
            <div className="card">
              <div className="p-6 border-b border-neutral-100 dark:border-neutral-800">
                <h4 className="font-bold flex items-center gap-2">
                  <School size={18} className="text-dia-red" />
                  Configuration de l'École
                </h4>
              </div>
              <form onSubmit={handleUpdateSchoolConfig} className="p-6 space-y-4">
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">Nom de l'Établissement</label>
                  <input 
                    value={schoolConfig.nom} 
                    onChange={e => setSchoolConfig({...schoolConfig, nom: e.target.value})} 
                    required 
                    type="text" 
                    className="w-full px-4 py-2.5 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl outline-none focus:ring-2 focus:ring-dia-red/20 focus:border-dia-red transition-all" 
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">Année Scolaire</label>
                    <div className="relative">
                      <CalendarDays className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" size={16} />
                      <input 
                        value={schoolConfig.annee_scolaire} 
                        onChange={e => setSchoolConfig({...schoolConfig, annee_scolaire: e.target.value})} 
                        required 
                        type="text" 
                        placeholder="2025-2026"
                        className="w-full pl-12 pr-4 py-2.5 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl outline-none focus:ring-2 focus:ring-dia-red/20 focus:border-dia-red transition-all" 
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">Format Reçu</label>
                    <div className="relative">
                      <FileText className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" size={16} />
                      <select 
                        value={schoolConfig.format_recu} 
                        onChange={e => setSchoolConfig({...schoolConfig, format_recu: e.target.value as any})} 
                        className="w-full pl-12 pr-4 py-2.5 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl outline-none focus:ring-2 focus:ring-dia-red/20 focus:border-dia-red transition-all appearance-none"
                      >
                        <option value="A5">Format A5 (Standard)</option>
                        <option value="thermique_80">Thermique 80mm</option>
                        <option value="thermique_58">Thermique 58mm</option>
                      </select>
                    </div>
                  </div>
                </div>
                <div className="pt-4">
                  <button 
                    type="submit" 
                    disabled={loading}
                    className="btn-secondary w-full py-3 flex items-center justify-center gap-2"
                  >
                    <Save size={18} />
                    Sauvegarder la configuration
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="card">
            <div className="p-6 border-b border-neutral-100 dark:border-neutral-800">
              <h4 className="font-bold flex items-center gap-2">
                <User size={18} className="text-dia-red" />
                {t('profile.personal_info')}
              </h4>
            </div>
            <form onSubmit={handleUpdateProfile} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">{t('profile.first_name')}</label>
                  <input 
                    value={firstName} 
                    onChange={e => setFirstName(e.target.value)} 
                    required 
                    type="text" 
                    className="w-full px-4 py-2.5 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl outline-none focus:ring-2 focus:ring-dia-red/20 focus:border-dia-red transition-all" 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">{t('profile.last_name')}</label>
                  <input 
                    value={lastName} 
                    onChange={e => setLastName(e.target.value)} 
                    required 
                    type="text" 
                    className="w-full px-4 py-2.5 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl outline-none focus:ring-2 focus:ring-dia-red/20 focus:border-dia-red transition-all" 
                  />
                </div>
                <div className="space-y-2 col-span-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">{t('common.phone')}</label>
                  <div className="relative">
                    <Smartphone className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" size={16} />
                    <input 
                      value={phone} 
                      onChange={e => setPhone(e.target.value)} 
                      type="tel" 
                      className="w-full pl-12 pr-4 py-2.5 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl outline-none focus:ring-2 focus:ring-dia-red/20 focus:border-dia-red transition-all" 
                    />
                  </div>
                </div>
              </div>
              <div className="pt-4">
                <button 
                  type="submit" 
                  disabled={loading}
                  className="btn-primary w-full py-3 flex items-center justify-center gap-2"
                >
                  <Save size={18} />
                  {loading ? t('profile.updating') : t('profile.save_changes')}
                </button>
              </div>
            </form>
          </div>

          {/* Security Form */}
          <div className="card">
            <div className="p-6 border-b border-neutral-100 dark:border-neutral-800">
              <h4 className="font-bold flex items-center gap-2">
                <Lock size={18} className="text-dia-red" />
                {t('profile.security')}
              </h4>
            </div>
            <form onSubmit={handleChangePassword} className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">{t('profile.current_password')}</label>
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
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">{t('profile.new_password')}</label>
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
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">{t('profile.confirm_password')}</label>
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
                  {loading ? t('profile.updating') : t('profile.save_changes')}
                </button>
              </div>
            </form>
          </div>

          {/* Danger Zone */}
          <div className="card border-red-100 dark:border-red-900/30 overflow-hidden">
            <div className="p-6 bg-red-50/50 dark:bg-red-950/10 border-b border-red-100 dark:border-red-900/20">
              <h4 className="font-bold flex items-center gap-2 text-red-600 dark:text-red-400">
                <Trash2 size={18} />
                {t('profile.danger_zone')}
              </h4>
              <p className="text-xs text-red-500/80 mt-1">{t('profile.danger_zone_desc')}</p>
            </div>
            <div className="p-6 space-y-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h5 className="font-bold text-sm">{t('profile.logout_all')}</h5>
                  <p className="text-xs text-neutral-500 mt-0.5">{t('profile.logout_all_desc')}</p>
                </div>
                <button 
                  onClick={logout}
                  className="px-4 py-2 text-sm font-bold border border-neutral-200 dark:border-neutral-700 rounded-xl hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-all"
                >
                  {t('common.logout')}
                </button>
              </div>

              <div className="pt-6 border-t border-red-50 dark:border-red-900/20 flex items-center justify-between gap-4">
                <div>
                  <h5 className="font-bold text-sm text-red-600">{t('profile.delete_account')}</h5>
                  <p className="text-xs text-neutral-500 mt-0.5">{t('profile.delete_account_desc')}</p>
                </div>
                <button 
                  onClick={() => toast.error(t('profile.delete_account_contact'))}
                  className="px-4 py-2 text-sm font-bold bg-red-600 text-white rounded-xl hover:bg-red-700 transition-all shadow-lg shadow-red-600/20"
                >
                  {t('common.delete')}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

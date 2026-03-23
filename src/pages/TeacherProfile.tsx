import React, { useState, useEffect } from 'react';
import { 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  Camera, 
  Save, 
  Lock,
  MessageSquare,
  DollarSign,
  Clock,
  GraduationCap,
  TrendingUp,
  X,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Teacher } from '../types';
import { cn, formatCurrency } from '../utils';

export default function TeacherProfile() {
  const { profile, updateProfile, changePassword, validatePassword } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<Partial<Teacher>>({});
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  useEffect(() => {
    if (profile) {
      setFormData(profile as Teacher);
    }
    fetchLatestProfile();
  }, []);

  const fetchLatestProfile = async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        setFormData(data);
        updateProfile(data);
      }
    } catch (err) {
      console.error("Error fetching latest profile:", err);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const teacher = profile as Teacher;
      const res = await fetch(`/api/teachers/${teacher.uid}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (res.ok) {
        const updated = await res.json();
        updateProfile(updated);
        alert('Profil mis à jour avec succès !');
      } else {
        alert('Erreur lors de la mise à jour du profil');
      }
    } catch (err) {
      console.error("Error updating profile:", err);
      alert('Erreur lors de la mise à jour du profil');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess(false);

    if (newPassword !== confirmPassword) {
      setPasswordError("Les mots de passe ne correspondent pas.");
      return;
    }

    const validation = validatePassword(newPassword);
    if (!validation.isValid) {
      setPasswordError(validation.message);
      return;
    }

    setLoading(true);
    try {
      await changePassword(newPassword);
      setPasswordSuccess(true);
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setIsPasswordModalOpen(false), 2000);
    } catch (err: any) {
      setPasswordError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!profile) return null;

  const teacher = profile as Teacher;

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="flex items-center gap-6">
          <div className="relative group">
            <div className="w-32 h-32 rounded-[40px] bg-dia-red/10 border-4 border-white dark:border-neutral-900 shadow-xl flex items-center justify-center text-4xl font-bold text-dia-red overflow-hidden">
              {profile.photoURL ? (
                <img src={profile.photoURL} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                `${profile.firstName[0]}${profile.lastName[0]}`
              )}
            </div>
            <button className="absolute bottom-0 right-0 p-3 bg-dia-red text-white rounded-2xl shadow-lg hover:scale-110 transition-transform">
              <Camera size={20} />
            </button>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h2 className="text-3xl font-bold tracking-tight">{profile.firstName} {profile.lastName}</h2>
              <span className="px-3 py-1 rounded-full bg-dia-red/10 text-dia-red text-[10px] font-bold uppercase tracking-wider">
                {profile.role}
              </span>
            </div>
            <p className="text-neutral-500 font-mono">{profile.matricule}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Stats Column */}
        <div className="space-y-6">
          <div className="card p-6 space-y-6">
            <h3 className="font-bold flex items-center gap-2">
              <TrendingUp size={18} className="text-dia-red" />
              <span>Récapitulatif</span>
            </h3>
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800/50 space-y-1">
                <p className="text-[10px] font-bold uppercase text-neutral-400">Taux Horaire</p>
                <p className="text-xl font-bold flex items-center gap-2">
                  <DollarSign size={18} className="text-dia-red" />
                  {formatCurrency(teacher.hourlyRate || 0)}/h
                </p>
              </div>
              <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800/50 space-y-1">
                <p className="text-[10px] font-bold uppercase text-neutral-400">Heures Travaillées</p>
                <p className="text-xl font-bold flex items-center gap-2">
                  <Clock size={18} className="text-dia-red" />
                  {teacher.totalHoursWorked || 0}h
                </p>
              </div>
            </div>
          </div>

          <div className="card p-6 space-y-4">
            <h3 className="font-bold flex items-center gap-2">
              <Lock size={18} className="text-dia-red" />
              <span>Sécurité & Mot de passe</span>
            </h3>
            <p className="text-sm text-neutral-500">Maintenez votre compte en sécurité en changeant régulièrement votre mot de passe.</p>
            <button 
              onClick={() => setIsPasswordModalOpen(true)}
              className="w-full py-3 bg-neutral-100 dark:bg-neutral-800 rounded-xl font-bold text-sm hover:bg-neutral-200 transition-all"
            >
              Changer le mot de passe
            </button>
          </div>
        </div>

        {/* Form Column */}
        <div className="lg:col-span-2 space-y-6">
          <form onSubmit={handleSave} className="card p-8 space-y-8">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold tracking-tight">Informations Personnelles</h3>
              <button 
                type="submit" 
                disabled={loading}
                className="btn-primary flex items-center gap-2 px-6 py-2"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Save size={18} />
                    <span>Enregistrer</span>
                  </>
                )}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">Prénom</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" size={18} />
                  <input 
                    name="firstName"
                    value={formData.firstName || ''}
                    onChange={handleChange}
                    className="w-full pl-12 pr-5 py-3 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-2xl focus:ring-2 focus:ring-dia-red/20 focus:border-dia-red outline-none transition-all" 
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">Nom</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" size={18} />
                  <input 
                    name="lastName"
                    value={formData.lastName || ''}
                    onChange={handleChange}
                    className="w-full pl-12 pr-5 py-3 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-2xl focus:ring-2 focus:ring-dia-red/20 focus:border-dia-red outline-none transition-all" 
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">Email Professionnel</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" size={18} />
                  <input 
                    name="email"
                    type="email"
                    value={formData.email || ''}
                    onChange={handleChange}
                    className="w-full pl-12 pr-5 py-3 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-2xl focus:ring-2 focus:ring-dia-red/20 focus:border-dia-red outline-none transition-all" 
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">WhatsApp / Téléphone</label>
                <div className="relative">
                  <MessageSquare className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" size={18} />
                  <input 
                    name="whatsapp"
                    value={formData.whatsapp || ''}
                    onChange={handleChange}
                    className="w-full pl-12 pr-5 py-3 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-2xl focus:ring-2 focus:ring-dia-red/20 focus:border-dia-red outline-none transition-all" 
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">CNI</label>
                <div className="relative">
                  <GraduationCap className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" size={18} />
                  <input 
                    name="cni"
                    value={formData.cni || ''}
                    onChange={handleChange}
                    className="w-full pl-12 pr-5 py-3 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-2xl focus:ring-2 focus:ring-dia-red/20 focus:border-dia-red outline-none transition-all" 
                  />
                </div>
              </div>
            </div>
          </form>
        </div>
      </div>
      {/* Password Change Modal */}
      {isPasswordModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-neutral-900 w-full max-w-md rounded-[32px] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-8 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
              <h3 className="text-xl font-bold tracking-tight">Changer le mot de passe</h3>
              <button onClick={() => setIsPasswordModalOpen(false)} className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition-colors">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handlePasswordChange} className="p-8 space-y-6">
              {passwordError && (
                <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600 text-sm">
                  <AlertCircle size={18} />
                  <p>{passwordError}</p>
                </div>
              )}
              {passwordSuccess && (
                <div className="p-4 bg-green-50 border border-green-100 rounded-2xl flex items-center gap-3 text-green-600 text-sm">
                  <CheckCircle2 size={18} />
                  <p>Mot de passe mis à jour avec succès !</p>
                </div>
              )}
              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">Nouveau mot de passe</label>
                <input 
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-5 py-3 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-2xl focus:ring-2 focus:ring-dia-red/20 focus:border-dia-red outline-none transition-all" 
                />
                <p className="text-[10px] text-neutral-400 mt-1">Min. 6 caractères, 1 majuscule, 1 chiffre, 1 point.</p>
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">Confirmer le mot de passe</label>
                <input 
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-5 py-3 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-2xl focus:ring-2 focus:ring-dia-red/20 focus:border-dia-red outline-none transition-all" 
                />
              </div>
              <div className="pt-4 flex gap-4">
                <button 
                  type="button" 
                  onClick={() => setIsPasswordModalOpen(false)} 
                  className="flex-1 px-6 py-4 bg-neutral-100 dark:bg-neutral-800 rounded-2xl font-bold transition-all hover:bg-neutral-200"
                >
                  Annuler
                </button>
                <button 
                  type="submit" 
                  disabled={loading}
                  className="flex-1 btn-primary py-4 flex items-center justify-center"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    "Mettre à jour"
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

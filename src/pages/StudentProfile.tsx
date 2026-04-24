import React, { useState } from 'react';
import { 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  Calendar, 
  Shield, 
  Camera,
  Save,
  AlertCircle,
  CreditCard,
  Briefcase,
  Users,
  X,
  CheckCircle2,
  Clock
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { cn, formatCurrency } from '../utils';
import { Student } from '../types';
import { toast } from 'sonner';

export default function StudentProfile() {
  const { t, i18n } = useTranslation();
  const { profile, updateProfile, changePassword, validatePassword, fetchWithAuth, logout } = useAuth();
  const student = profile as Student;
  
  const [isEditing, setIsEditing] = useState(false);
  const [isPaymentHistoryOpen, setIsPaymentHistoryOpen] = useState(false);
  const [isSecurityOpen, setIsSecurityOpen] = useState(false);
  const [formData, setFormData] = useState({
    firstName: student?.firstName || '',
    lastName: student?.lastName || '',
    email: student?.email || '',
    phone: student?.phone || '',
    parentName: student?.parentName || '',
    parentPhone: student?.parentPhone || '',
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  React.useEffect(() => {
    if (profile) {
      setFormData({
        firstName: profile.firstName || '',
        lastName: profile.lastName || '',
        email: profile.email || '',
        phone: (profile as Student).phone || '',
        parentName: (profile as Student).parentName || '',
        parentPhone: (profile as Student).parentPhone || '',
      });
    }
  }, [profile]);

  React.useEffect(() => {
    const fetchMe = async () => {
      const res = await fetchWithAuth('/api/auth/me');
      if (res.ok) {
        const currentProfile = await res.json();
        updateProfile(currentProfile);
      }
    };
    fetchMe();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetchWithAuth(`/api/students/${student.uid}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      
      if (res.ok) {
        const updatedStudent = await res.json();
        updateProfile(updatedStudent);
        setIsEditing(false);
        toast.success(t('profile.save_success'));
      }
    } catch (err) {
      console.error("Error updating profile:", err);
      toast.error(t('profile.save_error'));
    } finally {
      setSaving(false);
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
        updateProfile({ ...student, photoURL: data.photoURL });
        toast.success(t('profile.photo_success'));
      }
    } catch (err) {
      console.error("Upload error:", err);
      toast.error(t('profile.upload_error'));
    } finally {
      setUploading(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess(false);

    if (newPassword !== confirmPassword) {
      setPasswordError(t('profile.password_mismatch'));
      return;
    }

    const validation = validatePassword(newPassword);
    if (!validation.isValid) {
      setPasswordError(validation.message);
      return;
    }

    setSaving(true);
    try {
      await changePassword(newPassword);
      setPasswordSuccess(true);
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setIsSecurityOpen(false), 2000);
    } catch (err: any) {
      setPasswordError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-2xl font-bold tracking-tight">{t('profile.title')}</h3>
          <p className="text-neutral-500">{t('profile.subtitle')}</p>
        </div>
        <button 
          onClick={() => isEditing ? handleSave() : setIsEditing(true)}
          disabled={saving}
          className={cn(
            "btn-primary flex items-center gap-2",
            isEditing && "bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/20"
          )}
        >
          {saving ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : isEditing ? (
            <><Save size={18} /> {t('common.save')}</>
          ) : (
            <><User size={18} /> {t('profile.edit_profile')}</>
          )}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Left: Photo & Basic Info */}
        <div className="space-y-6">
          <div className="card p-8 text-center space-y-4">
            <div className="relative inline-block">
              <div className="w-32 h-32 rounded-[40px] bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-neutral-400 overflow-hidden border-4 border-white dark:border-neutral-900 shadow-xl">
                {student.photoURL ? (
                  <img src={student.photoURL} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <User size={64} />
                )}
              </div>
              <button 
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="absolute bottom-0 right-0 p-2 bg-dia-red text-white rounded-2xl shadow-lg hover:scale-110 transition-transform disabled:opacity-50"
              >
                {uploading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Camera size={16} />
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
            
            <div>
              <h4 className="text-xl font-bold">{student.firstName} {student.lastName}</h4>
              <p className="text-sm font-bold text-dia-red uppercase tracking-wider">{student.matricule}</p>
            </div>

            <div className="pt-4 border-t border-neutral-100 dark:border-neutral-800 flex justify-center gap-4">
              <div className="text-center">
                <p className="text-[10px] font-bold uppercase text-neutral-400">{t('profile.role')}</p>
                <p className="text-xs font-bold">{t('profile.student')}</p>
              </div>
              <div className="w-px h-8 bg-neutral-100 dark:border-neutral-800" />
              <div className="text-center">
                <p className="text-[10px] font-bold uppercase text-neutral-400">{t('profile.status')}</p>
                <div className="flex items-center gap-1 justify-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <p className="text-xs font-bold text-emerald-500">{t('profile.active')}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="card p-6 space-y-4">
            <h5 className="font-bold text-sm uppercase tracking-wider text-neutral-400">{t('profile.quick_access')}</h5>
            <div className="space-y-2">
              <button 
                onClick={() => setIsSecurityOpen(true)}
                className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors text-sm font-medium"
              >
                <Shield size={18} className="text-dia-red" /> {t('profile.security_password')}
              </button>
              <button 
                onClick={() => setIsPaymentHistoryOpen(true)}
                className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors text-sm font-medium"
              >
                <CreditCard size={18} className="text-blue-500" /> {t('students.history')}
              </button>
            </div>
          </div>
        </div>

        {/* Right: Detailed Info */}
        <div className="md:col-span-2 space-y-8">
          {/* Personal Information */}
          <div className="card p-8 space-y-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-dia-red/10 text-dia-red flex items-center justify-center">
                <User size={20} />
              </div>
              <h4 className="text-xl font-bold">{t('profile.personal_info')}</h4>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 px-1">{t('students.firstName')}</label>
                <input 
                  type="text" 
                  value={formData.firstName}
                  disabled={!isEditing}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  className="w-full px-4 py-3 rounded-2xl bg-neutral-50 dark:bg-neutral-900 border-none focus:ring-2 focus:ring-dia-red transition-all disabled:opacity-70"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 px-1">{t('students.lastName')}</label>
                <input 
                  type="text" 
                  value={formData.lastName}
                  disabled={!isEditing}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  className="w-full px-4 py-3 rounded-2xl bg-neutral-50 dark:bg-neutral-900 border-none focus:ring-2 focus:ring-dia-red transition-all disabled:opacity-70"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 px-1">{t('students.email')}</label>
                <input 
                  type="email" 
                  value={formData.email}
                  disabled={!isEditing}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-3 rounded-2xl bg-neutral-50 dark:bg-neutral-900 border-none focus:ring-2 focus:ring-dia-red transition-all disabled:opacity-70"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 px-1">{t('students.phone')}</label>
                <input 
                  type="tel" 
                  value={formData.phone}
                  disabled={!isEditing}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-4 py-3 rounded-2xl bg-neutral-50 dark:bg-neutral-900 border-none focus:ring-2 focus:ring-dia-red transition-all disabled:opacity-70"
                />
              </div>
            </div>
          </div>

          {/* Parent/Guardian Information */}
          <div className="card p-8 space-y-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
                <Users size={20} />
              </div>
              <h4 className="text-xl font-bold">{t('students.guardian')}</h4>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 px-1">{t('students.guardianName')}</label>
                <input 
                  type="text" 
                  value={formData.parentName}
                  disabled={!isEditing}
                  onChange={(e) => setFormData({ ...formData, parentName: e.target.value })}
                  className="w-full px-4 py-3 rounded-2xl bg-neutral-50 dark:bg-neutral-900 border-none focus:ring-2 focus:ring-dia-red transition-all disabled:opacity-70"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 px-1">{t('students.guardianPhone')}</label>
                <input 
                  type="tel" 
                  value={formData.parentPhone}
                  disabled={!isEditing}
                  onChange={(e) => setFormData({ ...formData, parentPhone: e.target.value })}
                  className="w-full px-4 py-3 rounded-2xl bg-neutral-50 dark:bg-neutral-900 border-none focus:ring-2 focus:ring-dia-red transition-all disabled:opacity-70"
                />
              </div>
            </div>
          </div>

          {/* Academic Information (Read-only) */}
          <div className="card p-8 space-y-6 bg-neutral-50/50 dark:bg-neutral-800/30">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-dia-yellow/10 text-dia-yellow flex items-center justify-center">
                <Briefcase size={20} />
              </div>
              <h4 className="text-xl font-bold">{t('profile.academic_info')}</h4>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <p className="text-[10px] font-bold uppercase text-neutral-400 mb-1">{t('profile.reg_date')}</p>
                <p className="font-bold">{new Date(student.createdAt).toLocaleDateString(i18n.language === 'de' ? 'de-DE' : 'fr-FR')}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase text-neutral-400 mb-1">{t('students.pob')}</p>
                <p className="font-bold">{student.birthPlace}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase text-neutral-400 mb-1">{t('students.dob')}</p>
                <p className="font-bold">{new Date(student.birthDate).toLocaleDateString(i18n.language === 'de' ? 'de-DE' : 'fr-FR')}</p>
              </div>
            </div>
          </div>

          {/* Danger Zone */}
          <div className="card border-red-100 dark:border-red-900/30 overflow-hidden mt-8">
            <div className="p-6 bg-red-50/50 dark:bg-red-950/10 border-b border-red-100 dark:border-red-900/20">
              <h4 className="font-bold flex items-center gap-2 text-red-600 dark:text-red-400 text-sm">
                {t('profile.danger_zone')}
              </h4>
            </div>
            <div className="p-6">
              <button 
                onClick={logout}
                className="w-full py-3 border border-red-200 dark:border-red-900/30 text-red-600 rounded-2xl font-bold text-sm hover:bg-red-50 transition-all"
              >
                {t('profile.logout_devices')}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Payment History Modal */}
      {isPaymentHistoryOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-neutral-900 w-full max-w-2xl rounded-[32px] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-8 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
                  <CreditCard size={20} />
                </div>
                <h3 className="text-2xl font-bold tracking-tight">{t('students.history')}</h3>
              </div>
              <button onClick={() => setIsPaymentHistoryOpen(false)} className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition-colors">
                <X size={24} />
              </button>
            </div>
            <div className="p-8">
              <div className="space-y-4">
                {student.payments && student.payments.length > 0 ? (
                  student.payments.map((payment, idx) => (
                    <div key={idx} className="flex items-center justify-between p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800/50">
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center",
                          payment.amount > 0 ? "bg-emerald-500/10 text-emerald-500" : "bg-neutral-200 text-neutral-400"
                        )}>
                          {payment.amount > 0 ? <CheckCircle2 size={20} /> : <Clock size={20} />}
                        </div>
                        <div>
                          <h5 className="font-bold text-sm">{t('students.tranche')} {payment.tranche}</h5>
                          <p className="text-[10px] font-bold uppercase text-neutral-400 tracking-wider">
                            {payment.date ? new Date(payment.date).toLocaleDateString(i18n.language === 'de' ? 'de-DE' : 'fr-FR') : t('students.pending')}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-sm">{formatCurrency(payment.amount || 0)}</p>
                        <p className="text-[10px] font-bold uppercase text-neutral-400">
                          {payment.amount > 0 ? t('students.paid') : t('students.not_paid')}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-12 text-neutral-400">
                    <AlertCircle className="mx-auto mb-2 opacity-20" size={48} />
                    <p>{t('students.no_history')}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Security Modal */}
      {isSecurityOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-neutral-900 w-full max-w-md rounded-[32px] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-8 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-dia-red/10 text-dia-red flex items-center justify-center">
                  <Shield size={20} />
                </div>
                <h3 className="text-2xl font-bold tracking-tight">{t('profile.security')}</h3>
              </div>
              <button onClick={() => setIsSecurityOpen(false)} className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition-colors">
                <X size={24} />
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
                  <p>{t('profile.password_success')}</p>
                </div>
              )}
              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">{t('profile.new_password')}</label>
                <input 
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-5 py-3 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-2xl focus:ring-2 focus:ring-dia-red/20 focus:border-dia-red outline-none transition-all" 
                />
                <p className="text-[10px] text-neutral-400 mt-1">{t('profile.password_rules')}</p>
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">{t('profile.confirm_password')}</label>
                <input 
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-5 py-3 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-2xl focus:ring-2 focus:ring-dia-red/20 focus:border-dia-red outline-none transition-all" 
                />
              </div>
              <div className="pt-4 flex gap-4">
                <button 
                  type="button" 
                  onClick={() => setIsSecurityOpen(false)} 
                  className="flex-1 px-6 py-4 bg-neutral-100 dark:bg-neutral-800 rounded-2xl font-bold transition-all hover:bg-neutral-200"
                >
                  {t('common.cancel')}
                </button>
                <button 
                  type="submit" 
                  disabled={saving}
                  className="flex-1 btn-primary py-4 flex items-center justify-center"
                >
                  {saving ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    t('common.update')
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


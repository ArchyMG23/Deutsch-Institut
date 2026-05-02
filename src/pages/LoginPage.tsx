import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LogIn, ShieldAlert, Loader2, Eye, EyeOff, Wrench } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { downloadProtectedArchive } from '../utils/documentation';
import { cn } from '../utils';
import LanguageSwitcher from '../components/LanguageSwitcher';

export default function LoginPage() {
  const [matricule, setMatricule] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [logoError, setLogoError] = useState(false);
  const [downloadingDoc, setDownloadingDoc] = useState(false);
  
  const { login, profile } = useAuth();
  const { theme } = useTheme();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();

  const handleSupportDownload = async (e: React.MouseEvent) => {
    e.preventDefault();
    const code = window.prompt(t('login.support_code_prompt'));
    
    // In a real app, this should be validated against a server
    // For this implementation, we use the known super admin code or initials
    if (code === 'vyombi_dia_2026' || code === 'RESET_FACTORY') {
      try {
        setDownloadingDoc(true);
        console.log("Starting documentation download archive...");
        await downloadProtectedArchive(code);
        toast.success(t('login.support_success'));
      } catch (err: any) {
        console.error("Documentation generation failed:", err);
        alert(`${t('login.support_error')}: ${err.message || "Erreur inconnue"}`);
      } finally {
        setDownloadingDoc(false);
      }
    } else if (code) {
      alert(t('login.support_code_error'));
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(matricule.trim(), password);
    } catch (err: any) {
      console.error("Login error details:", err);
      let msg = err.message || t('login.connection_error');
      
      if (err.code === 'auth/operation-not-allowed') {
        msg = t('auth.firebase_not_enabled');
      } else if (err.name === 'TypeError' && err.message.includes('fetch')) {
        msg = t('login.server_unreachable');
      }
      
      setError(msg);
      setLoading(false);
    }
  };

  // Use useEffect to navigate when profile state changes after login
  React.useEffect(() => {
    if (profile) {
      const from = location.state?.from?.pathname;
      if (from && from !== '/login' && from !== '/unauthorized') {
        navigate(from, { replace: true });
      } else {
        // Default redirects based on role
        switch (profile.role) {
          case 'admin':
            navigate('/admin', { replace: true });
            break;
          case 'teacher':
            navigate('/teacher', { replace: true });
            break;
          case 'student':
            navigate('/student', { replace: true });
            break;
          default:
            navigate('/', { replace: true });
        }
      }
    }
  }, [profile, navigate, location.state]);

  const bgImages = {
    light: "https://images.unsplash.com/photo-1467269204594-9661b134dd2b?auto=format&fit=crop&q=80&w=2070", // Rothenburg ob der Tauber
    dark: "https://images.unsplash.com/photo-1560930950-5cc20e80e392?auto=format&fit=crop&q=80&w=2070" // Berlin at night
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-neutral-950 font-sans transition-colors duration-500">
      {/* Language Switcher Overlay */}
      <div className="absolute top-6 right-6 z-50">
        <LanguageSwitcher />
      </div>

      {/* Background Image with Blur and Overlay */}
      <div className="absolute inset-0 z-0">
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat scale-105 transition-all duration-500"
          style={{ 
            backgroundImage: `url("${theme === 'dark' ? bgImages.dark : bgImages.light}")`,
            filter: theme === 'dark' ? 'blur(8px) brightness(0.3)' : 'blur(4px) brightness(0.7)'
          }}
        />
        <div className={cn(
          "absolute inset-0 transition-opacity duration-500",
          theme === 'dark' 
            ? "bg-gradient-to-br from-black/80 via-black/40 to-dia-red/30 opacity-100" 
            : "bg-gradient-to-br from-white/40 via-transparent to-dia-red/10 opacity-100"
        )} />
      </div>

      <div className="w-full max-w-[440px] relative z-10 animate-in fade-in zoom-in duration-300">
        <div className="text-center mb-10">
            <div className="relative w-20 h-20 mx-auto mb-4">
              <img 
                src="/logo.png" 
                alt="DIA Logo" 
                className={cn(
                  "w-20 h-20 rounded-2xl shadow-xl shadow-dia-red/20 object-contain bg-white transition-opacity duration-300",
                  logoError ? "opacity-0 invisible absolute" : "opacity-100"
                )}
                onError={() => setLogoError(true)}
              />
              {logoError && (
                <div className="w-20 h-20 rounded-2xl bg-dia-red flex items-center justify-center text-white font-bold text-4xl shadow-xl">
                  D
                </div>
              )}
            </div>
          <h1 className={cn(
            "text-2xl font-bold tracking-tight transition-colors duration-500",
            theme === 'dark' ? "text-white" : "text-neutral-900"
          )}>{t('login.title')}</h1>
          <p className={cn(
            "text-sm mt-1 font-medium transition-colors duration-500",
            theme === 'dark' ? "text-neutral-400" : "text-neutral-600"
          )}>{t('login.subtitle')}</p>
        </div>

        <div className="bg-white dark:bg-neutral-900/90 dark:backdrop-blur-xl rounded-[32px] p-10 shadow-2xl border border-white/20 dark:border-neutral-800 transition-all duration-500">
          <div className="mb-8">
            <h2 className="text-xl font-bold text-neutral-900 dark:text-white">{t('login.welcome')}</h2>
            <p className="text-neutral-500 dark:text-neutral-400 text-sm">{t('login.subtitle')} DIA</p>
          </div>
          
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600 text-sm animate-in fade-in slide-in-from-top-2">
              <ShieldAlert size={18} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">{t('login.matricule')}</label>
              <input 
                type="text" 
                required
                value={matricule}
                onChange={(e) => setMatricule(e.target.value)}
                placeholder={t('login.placeholder_matricule')}
                className="w-full px-5 py-3.5 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-2xl focus:ring-2 focus:ring-dia-red/20 focus:border-dia-red outline-none transition-all placeholder:text-neutral-300 dark:text-white"
              />
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between items-center ml-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">{t('login.password')}</label>
              </div>
              <div className="relative">
                <input 
                  type={showPassword ? "text" : "password"} 
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t('login.placeholder_password')}
                  className="w-full px-5 py-3.5 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-2xl focus:ring-2 focus:ring-dia-red/20 focus:border-dia-red outline-none transition-all placeholder:text-neutral-300 dark:text-white"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 p-1"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-dia-red hover:bg-red-700 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-dia-red/20 disabled:opacity-50 active:scale-[0.98]"
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : <LogIn size={20} />}
              <span>{t('login.login_btn')}</span>
            </button>
          </form>

          <div className="mt-10 text-center space-y-4">
            <p className="text-xs text-neutral-400">
              {t('login.help')}{' '}
              <button 
                onClick={handleSupportDownload}
                disabled={downloadingDoc}
                className="text-dia-red font-bold hover:underline disabled:opacity-50"
              >
                {downloadingDoc ? t('login.preparing') : t('login.support')}
              </button>
            </p>
            
            <div className="pt-4 border-t border-neutral-100 dark:border-neutral-800">
              <p className="text-[10px] text-neutral-400 uppercase tracking-widest font-bold mb-2">{t('login.install_title')}</p>
              <div className="flex flex-col gap-2">
                <p className="text-[10px] text-neutral-500 leading-relaxed max-w-[280px] mx-auto">
                  {t('login.install_instructions')} <br/>
                  <strong>{t('login.install_ios').split(':')[0]}:</strong> {t('login.install_ios').split(':')[1]} <br/>
                  <strong>{t('login.install_android_pc').split(':')[0]}:</strong> {t('login.install_android_pc').split(':')[1]}
                </p>
              </div>
            </div>
          </div>
        </div>
        
        <div className="mt-8 flex flex-col items-center gap-4">
          <div className="px-3 py-1 bg-white/10 backdrop-blur-md rounded-full border border-white/20 flex items-center gap-2">
             <div className="w-3 h-2 flex flex-col">
               <div className="flex-1 bg-black"></div>
               <div className="flex-1 bg-red-600"></div>
               <div className="flex-1 bg-yellow-400"></div>
             </div>
             <span className="text-[9px] text-white/80 font-bold uppercase tracking-wider">{t('login.german_std')}</span>
          </div>
          <p className="text-neutral-300 text-[10px] uppercase tracking-[0.2em] font-medium">
            &copy; 2026 DIA_SAAS
          </p>
        </div>
      </div>
    </div>
  );
}

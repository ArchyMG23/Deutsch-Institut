import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LogIn, ShieldAlert, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const [matricule, setMatricule] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [logoError, setLogoError] = useState(false);
  
  const { login, profile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(matricule.trim(), password);
    } catch (err: any) {
      console.error("Login error details:", err);
      let msg = err.message || 'Une erreur est survenue lors de la connexion.';
      
      if (err.code === 'auth/operation-not-allowed') {
        msg = "L'authentification par email/mot de passe n'est pas activée dans votre console Firebase. Veuillez l'activer dans la section Authentication > Sign-in method.";
      } else if (err.name === 'TypeError' && err.message.includes('fetch')) {
        msg = 'Impossible de contacter le serveur. Veuillez vérifier votre connexion internet ou si le serveur est en ligne.';
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

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center p-4 font-sans">
      <div className="w-full max-w-[440px]">
        <div className="text-center mb-10">
          <div className="relative w-20 h-20 mx-auto mb-4">
            {!logoError ? (
              <img 
                src="/logo.png" 
                alt="DIA Logo" 
                className="w-20 h-20 rounded-2xl shadow-xl shadow-dia-red/10 object-contain bg-white" 
                referrerPolicy="no-referrer"
                onError={() => setLogoError(true)}
                onLoad={(e) => {
                  if ((e.target as HTMLImageElement).naturalWidth === 0) {
                    setLogoError(true);
                  }
                }}
              />
            ) : (
              <div className="w-20 h-20 rounded-2xl bg-dia-red flex items-center justify-center text-white font-bold text-4xl shadow-xl">
                D
              </div>
            )}
          </div>
          <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">DIA_SAAS</h1>
          <p className="text-neutral-500 text-sm mt-1">Système de Gestion Académique</p>
        </div>

        <div className="bg-white rounded-[32px] p-10 shadow-[0_20px_50px_rgba(0,0,0,0.04)] border border-neutral-100">
          <div className="mb-8">
            <h2 className="text-xl font-bold text-neutral-900">Connexion</h2>
            <p className="text-neutral-500 text-sm">Entrez vos codes d'accès pour continuer.</p>
          </div>
          
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600 text-sm animate-in fade-in slide-in-from-top-2">
              <ShieldAlert size={18} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">Matricule / Code Admin</label>
              <input 
                type="text" 
                required
                value={matricule}
                onChange={(e) => setMatricule(e.target.value)}
                placeholder="Ex: ADMIN ou S261234"
                className="w-full px-5 py-3.5 bg-neutral-50 border border-neutral-200 rounded-2xl focus:ring-2 focus:ring-dia-red/20 focus:border-dia-red outline-none transition-all placeholder:text-neutral-300"
              />
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between items-center ml-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">Mot de passe</label>
              </div>
              <input 
                type="password" 
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-5 py-3.5 bg-neutral-50 border border-neutral-200 rounded-2xl focus:ring-2 focus:ring-dia-red/20 focus:border-dia-red outline-none transition-all placeholder:text-neutral-300"
              />
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-dia-red hover:bg-red-700 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-dia-red/20 disabled:opacity-50 active:scale-[0.98]"
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : <LogIn size={20} />}
              <span>Se connecter</span>
            </button>
          </form>

          <div className="mt-10 text-center">
            <p className="text-xs text-neutral-400">
              Besoin d'aide ? <a href="#" className="text-dia-red font-bold hover:underline">Support Technique</a>
            </p>
          </div>
        </div>
        
        <div className="mt-8 flex flex-col items-center gap-4">
          <p className="text-neutral-300 text-[10px] uppercase tracking-[0.2em] font-medium">
            &copy; 2026 DIA_SAAS
          </p>
        </div>
      </div>
    </div>
  );
}

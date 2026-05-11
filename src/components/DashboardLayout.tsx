import React, { useState, useEffect } from 'react';
import { Sidebar } from './Sidebar';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useTranslation } from 'react-i18next';
import { Sun, Moon, Users } from 'lucide-react';
import { cn } from '../utils';
import LanguageSwitcher from './LanguageSwitcher';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile } from '../types';

function OnlineAdmins() {
  const { profile } = useAuth();
  const [onlineAdmins, setOnlineAdmins] = useState<UserProfile[]>([]);

  useEffect(() => {
    if (!profile) return;

    // Fetch online admins who are not the current user
    const q = query(
      collection(db, 'users'),
      where('role', '==', 'admin'),
      where('status', '==', 'online')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const admins = snapshot.docs
        .map(d => d.data() as UserProfile)
        .filter(admin => admin.uid !== profile.uid);
      setOnlineAdmins(admins);
    });

    return () => unsubscribe();
  }, [profile]);

  if (onlineAdmins.length === 0) return null;

  return (
    <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800 animate-in fade-in zoom-in duration-300">
      <div className="flex -space-x-1">
        {onlineAdmins.slice(0, 3).map((admin) => (
          <div 
            key={admin.uid}
            className="w-4 h-4 rounded-full bg-blue-500 border-2 border-white dark:border-neutral-950 flex items-center justify-center text-[6px] text-white font-bold"
            title={`${admin.firstName} ${admin.lastName} (Connecté)`}
          >
            {admin.firstName[0]}{admin.lastName[0]}
          </div>
        ))}
      </div>
      {onlineAdmins.length > 3 && (
        <span className="text-[8px] font-bold text-blue-600">+{onlineAdmins.length - 3}</span>
      )}
      <Users size={8} className="ml-1 text-blue-600" />
    </div>
  );
}

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { t, i18n } = useTranslation();
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 transition-colors duration-200">
      <Sidebar />
      <main className="lg:ml-64 min-h-screen p-4 sm:p-6 lg:p-8 pt-[max(5rem,calc(4rem+env(safe-area-inset-top)))] lg:pt-8 pb-[max(1rem,env(safe-area-inset-bottom))] pr-[max(1rem,env(safe-area-inset-right))] pl-[max(1rem,calc(env(safe-area-inset-left)+0px))] lg:pl-8">
        <header className="mb-6 lg:mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-col">
            <h2 className="text-xl lg:text-2xl font-bold text-neutral-900 dark:text-white truncate">
              {t('login.welcome')}, {profile?.firstName}
            </h2>
            <p className="text-xs lg:text-sm text-neutral-500 dark:text-neutral-400 uppercase tracking-wider font-semibold">
              {new Date().toLocaleDateString(i18n.language === 'de' ? 'de-DE' : i18n.language === 'en' ? 'en-US' : 'fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
          
          <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-4 overflow-x-auto pb-1 sm:pb-0 scrollbar-hide">
            <LanguageSwitcher />
            
            <button 
              onClick={toggleTheme}
              className="p-2 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-500 hover:text-dia-red transition-all shadow-sm active:scale-95"
              title={theme === 'light' ? 'Passer en mode sombre' : 'Passer en mode clair'}
            >
              {theme === 'light' ? <Moon size={20} /> : <Sun size={20} className="text-dia-yellow" />}
            </button>

            <div className="shrink-0 px-3 py-1.5 rounded-full bg-dia-yellow/10 text-dia-yellow text-[10px] sm:text-xs font-bold uppercase tracking-wider border border-dia-yellow/20">
              {profile?.role}
            </div>
            
            <div className="shrink-0 flex items-center gap-3 px-4 py-2 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-500 shadow-sm relative group">
              <div className={cn(
                "w-3 h-3 rounded-full transition-all duration-500 relative",
                profile?.status === 'online' ? "bg-green-500 animate-pulse" : "bg-neutral-400"
              )}>
                {profile?.status === 'online' && (
                  <span className="absolute inset-0 rounded-full bg-green-500 animate-ping opacity-25"></span>
                )}
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] sm:text-xs font-black uppercase leading-tight text-neutral-900 dark:text-neutral-100">
                    {profile?.status === 'online' ? t('common.online') : profile?.status}
                  </span>
                  <OnlineAdmins />
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2 leading-tight">
                  <span className="text-[9px] font-bold text-neutral-400 uppercase">
                    {new Date().toLocaleDateString(i18n.language === 'de' ? 'de-DE' : i18n.language === 'en' ? 'en-US' : 'fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                  </span>
                  <span className="hidden sm:inline text-[9px] text-neutral-300">•</span>
                  <span className="text-[9px] font-black text-dia-red">
                    {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </header>
        
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          {children}
        </div>
      </main>
    </div>
  );
}

import React from 'react';
import { Sidebar } from './Sidebar';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useTranslation } from 'react-i18next';
import { Sun, Moon } from 'lucide-react';
import { cn } from '../utils';
import LanguageSwitcher from './LanguageSwitcher';

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { t, i18n } = useTranslation();

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
            
            <div className="shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-full bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-500">
              <div className={cn(
                "w-2 h-2 rounded-full",
                profile?.status === 'online' ? "bg-green-500 animate-pulse" : "bg-neutral-400"
              )} />
              <span className="text-[10px] sm:text-xs font-bold uppercase">
                {profile?.status}
              </span>
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

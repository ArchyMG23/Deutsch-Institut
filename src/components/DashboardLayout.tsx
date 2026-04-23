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
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 transition-colors duration-300">
      <Sidebar />
      <main className="lg:ml-64 min-h-screen p-4 lg:p-8 pt-20 lg:pt-8">
        <header className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-col">
            <h2 className="text-xl lg:text-2xl font-bold text-neutral-900 dark:text-white truncate">
              {t('login.welcome')}, {profile?.firstName}
            </h2>
            <p className="text-xs lg:text-sm text-neutral-500 dark:text-neutral-400 uppercase">
              {new Date().toLocaleDateString(i18n.language === 'de' ? 'de-DE' : i18n.language === 'en' ? 'en-US' : 'fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
          
          <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4">
            <LanguageSwitcher />
            
            <button 
              onClick={toggleTheme}
              className="p-2 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-500 hover:text-dia-red transition-all shadow-sm"
              title={theme === 'light' ? 'Passer en mode sombre' : 'Passer en mode clair'}
            >
              {theme === 'light' ? <Moon size={20} /> : <Sun size={20} className="text-dia-yellow" />}
            </button>

            <div className="px-3 py-1.5 rounded-full bg-dia-yellow/10 text-dia-yellow text-[10px] sm:text-xs font-bold uppercase tracking-wider border border-dia-yellow/20">
              {profile?.role}
            </div>
            
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-500">
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
        
        {children}
      </main>
    </div>
  );
}

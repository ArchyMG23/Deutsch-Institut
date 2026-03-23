import React from 'react';
import { Sidebar } from './Sidebar';
import { useAuth } from '../context/AuthContext';

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      <Sidebar />
      <main className="lg:ml-64 min-h-screen p-4 lg:p-8">
        <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-neutral-900 dark:text-white">
              Bienvenue, {profile?.firstName}
            </h2>
            <p className="text-neutral-500 dark:text-neutral-400">
              {new Date().toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="px-3 py-1 rounded-full bg-dia-yellow/10 text-dia-yellow text-xs font-bold uppercase tracking-wider border border-dia-yellow/20">
              {profile?.role}
            </div>
            <div className="flex items-center gap-2">
              <div className={({
                "w-2 h-2 rounded-full": true,
                "bg-green-500": profile?.status === 'online',
                "bg-neutral-400": profile?.status === 'offline'
              })} />
              <span className="text-xs font-medium text-neutral-500 uppercase">
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

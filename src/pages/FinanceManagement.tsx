import React, { useState } from 'react';
import { 
  LayoutDashboard, UserPlus, Landmark, Target, History, Settings, PlusCircle, ArrowUpRight, 
  Wallet, ShieldCheck, Database, ArrowLeft, ArrowRightLeft, Sun
} from 'lucide-react';
import { cn } from '../utils';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';

// Section Imports
import FinanceOverview from './FinanceSections/FinanceOverview';
import FinanceInscription from './FinanceSections/FinanceInscription';
import FinanceScolarite from './FinanceSections/FinanceScolarite';
import FinanceVorbereitung from './FinanceSections/FinanceVorbereitung';
import FinanceVacances from './FinanceSections/FinanceVacances';
import FinanceDiverse from './FinanceSections/FinanceDiverse';
import FinanceSortie from './FinanceSections/FinanceSortie';
import FinanceArchives from './FinanceSections/FinanceArchives';
import FinanceMaintenance from './FinanceSections/FinanceMaintenance';
import FinanceHistoriqueNiveau from './FinanceSections/FinanceHistoriqueNiveau';

const SECTIONS = [
  { id: 'overview', label: 'Analyse', icon: LayoutDashboard, color: 'text-dia-red', role: 'admin' },
  { id: 'inscription', label: 'Inscriptions', icon: UserPlus, color: 'text-purple-600', role: 'admin' },
  { id: 'scolarite', label: 'Scolarités', icon: Landmark, color: 'text-emerald-600', role: 'admin' },
  { id: 'vorbereitung', label: 'Vorbereitung', icon: Target, color: 'text-amber-600', role: 'admin' },
  { id: 'vacances', label: 'Cours de Vacances', icon: Sun, color: 'text-amber-400', role: 'admin' },
  { id: 'historique', label: 'Historique / Niveau', icon: History, color: 'text-neutral-500', role: 'admin' },
  { id: 'sortie', label: 'Charges Centre', icon: ArrowUpRight, color: 'text-orange-600', role: 'admin' },
  { id: 'archives', label: 'Archive Transactions', icon: Wallet, color: 'text-neutral-500', role: 'admin' },
  { id: 'maintenance', label: 'Maintenance', icon: Database, color: 'text-dia-red', role: 'superadmin' },
];

export default function FinanceManagement() {
  const { user } = useAuth();
  const { caisseSolde, banqueSolde } = useData();
  const [activeTab, setActiveTab] = useState('overview');

  const isSuperAdmin = user?.email === 'yombivictor@gmail.com' || user?.email === 'gabrielyombi311@gmail.com';

  const visibleSections = SECTIONS.filter(s => s.role === 'admin' || (s.role === 'superadmin' && isSuperAdmin));

  const renderContent = () => {
    switch (activeTab) {
      case 'overview': return <FinanceOverview />;
      case 'inscription': return <FinanceInscription />;
      case 'scolarite': return <FinanceScolarite />;
      case 'vorbereitung': return <FinanceVorbereitung />;
      case 'vacances': return <FinanceVacances />;
      case 'historique': return <FinanceHistoriqueNiveau />;
      case 'sortie': return <FinanceSortie />;
      case 'archives': return <FinanceArchives />;
      case 'maintenance': return <FinanceMaintenance />;
      default: return <FinanceOverview />;
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 p-4 md:p-8 space-y-8 pb-32">
      {/* Header with Balances */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-12 bg-white dark:bg-neutral-900 p-8 rounded-[3rem] border border-neutral-100 dark:border-neutral-800 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-dia-red/5 blur-[100px] -mr-32 -mt-32" />
        <div className="flex items-center gap-6 relative z-10">
           <div className="p-4 bg-dia-red text-white flex items-center justify-center rounded-[1.5rem] shadow-xl shadow-dia-red/20 transform -rotate-3">
              <Landmark size={32} />
           </div>
           <div>
              <h1 className="text-3xl font-black text-neutral-900 dark:text-white uppercase tracking-tighter">Module Finances</h1>
              <p className="text-neutral-500 font-bold uppercase text-[10px] tracking-[0.2em]">Deutsch Institut Management System</p>
           </div>
        </div>

        <div className="flex gap-4 relative z-10">
           <div className="bg-neutral-50 dark:bg-neutral-800/50 p-4 px-6 rounded-2xl flex flex-col items-end border border-neutral-100 dark:border-neutral-800">
              <span className="text-[10px] font-black uppercase text-neutral-400 mb-1 flex items-center gap-1.5"><Wallet size={12} className="text-dia-red" /> Solde Caisse</span>
              <span className="text-xl font-black text-neutral-900 dark:text-white tabular-nums tracking-tight">{new Intl.NumberFormat('fr-FR').format(caisseSolde)} FCFA</span>
           </div>
           <div className="bg-neutral-50 dark:bg-neutral-800/50 p-4 px-6 rounded-2xl flex flex-col items-end border border-neutral-100 dark:border-neutral-800">
              <span className="text-[10px] font-black uppercase text-neutral-400 mb-1 flex items-center gap-1.5"><Landmark size={12} className="text-blue-600" /> Solde Banque</span>
              <span className="text-xl font-black text-neutral-900 dark:text-white tabular-nums tracking-tight">{new Intl.NumberFormat('fr-FR').format(banqueSolde)} FCFA</span>
           </div>
           <div className="bg-dia-red p-4 px-6 rounded-2xl flex flex-col items-end shadow-lg shadow-dia-red/20">
              <span className="text-[10px] font-black uppercase text-white/60 mb-1 flex items-center gap-1.5"><ArrowRightLeft size={12} className="text-white" /> Trésorerie Totale</span>
              <span className="text-xl font-black text-white tabular-nums tracking-tight">{new Intl.NumberFormat('fr-FR').format(caisseSolde + banqueSolde)} FCFA</span>
           </div>
        </div>
      </div>

      {/* Main Grid: Sidebar + Content */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
        {/* Sidebar Navigation */}
        <aside className="xl:col-span-3 space-y-4 sticky top-8">
          <div className="bg-white dark:bg-neutral-900 p-6 rounded-[2.5rem] border border-neutral-100 dark:border-neutral-800 shadow-sm space-y-2">
            <p className="text-[10px] font-black uppercase text-neutral-400 tracking-widest ml-4 mb-4">Menu Principal</p>
            {visibleSections.map((section) => (
              <button
                key={section.id}
                onClick={() => setActiveTab(section.id)}
                className={cn(
                  "w-full p-4 rounded-2xl flex items-center gap-4 group transition-all duration-300 relative overflow-hidden",
                  activeTab === section.id 
                    ? "bg-neutral-900 text-white shadow-xl dark:bg-white dark:text-neutral-900" 
                    : "hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-500"
                )}
              >
                <div className={cn(
                  "p-2 rounded-xl transition-all",
                  activeTab === section.id ? "bg-white/10 dark:bg-neutral-100" : "bg-neutral-50 dark:bg-neutral-800 group-hover:bg-white dark:group-hover:bg-neutral-700"
                )}>
                  <section.icon size={20} className={activeTab === section.id ? "text-white dark:text-neutral-900" : section.color} />
                </div>
                <span className="font-black uppercase text-[10px] tracking-wider">{section.label}</span>
                {activeTab === section.id && (
                  <motion.div layoutId="tab-active" className="absolute left-0 w-1 h-8 bg-dia-red rounded-full" />
                )}
              </button>
            ))}
          </div>

          <div className="bg-gradient-to-br from-neutral-900 to-neutral-950 p-8 rounded-[2.5rem] text-white space-y-6 shadow-2xl relative overflow-hidden group">
             <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:rotate-12 transition-transform duration-700">
                <ShieldCheck size={120} />
             </div>
             <div className="relative z-10">
                <p className="text-[10px] font-black uppercase text-white/40 mb-2">Audit de Sécurité</p>
                <h4 className="text-lg font-black uppercase leading-tight">Système de Vérification Active</h4>
                <p className="text-[10px] font-bold text-white/60 mt-4 leading-relaxed uppercase">
                  Toute opération financière est tracée (Matricule, IP, Horodatage). Les erreurs de caisse sont signalées en temps réel.
                </p>
             </div>
          </div>
        </aside>

        {/* Dynamic Content Area */}
        <main className="xl:col-span-9">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
            >
              {renderContent()}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}

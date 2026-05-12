import React, { useState, useMemo } from 'react';
import { History, Search, Download, Filter, Printer, Calendar, ArrowUpDown, Trash2, Edit2, AlertCircle } from 'lucide-react';
import { useData } from '../../context/DataContext';
import { formatCurrency, cn } from '../../utils';
import { motion, AnimatePresence } from 'motion/react';

export default function FinanceArchives() {
  const { finances, loading } = useData();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterAccount, setFilterAccount] = useState('all');

  const filteredFinances = useMemo(() => {
    return (finances || []).filter(f => {
      const matchSearch = String(f.libelle || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                          String(f.matricule || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                          String(f.recu_numero || '').toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchType = filterType === 'all' || f.type === filterType;
      const matchAccount = filterAccount === 'all' || 
                           f.compte_destination === filterAccount || 
                           f.accountType === filterAccount;

      return matchSearch && matchType && matchAccount;
    });
  }, [finances, searchTerm, filterType, filterAccount]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-4">
          <div className="p-4 bg-purple-600 text-white rounded-[1.5rem] shadow-xl shadow-purple-600/20">
            <History size={32} />
          </div>
          <div>
            <h2 className="text-3xl font-black text-neutral-900 dark:text-white uppercase tracking-tight">Archives Financières</h2>
            <p className="text-neutral-500 font-bold uppercase text-sm">Consultation de toutes les transactions</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
           <button className="btn-secondary py-2 px-4 rounded-xl flex items-center gap-2 text-[10px] font-black uppercase tracking-widest">
              <Download size={16} /> Exporter
           </button>
           <button className="btn-secondary py-2 px-4 rounded-xl flex items-center gap-2 text-[10px] font-black uppercase tracking-widest">
              <Printer size={16} /> Imprimer
           </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white dark:bg-neutral-900 p-6 rounded-[2rem] border border-neutral-100 dark:border-neutral-800 shadow-sm flex flex-wrap items-center gap-4">
        <div className="flex-1 min-w-[200px] relative">
           <input 
             type="text" 
             value={searchTerm}
             onChange={e => setSearchTerm(e.target.value)}
             placeholder="Rechercher par libellé, reçu, matricule..."
             className="w-full pl-12 pr-4 py-3 bg-neutral-50 dark:bg-neutral-800 rounded-xl border-none focus:ring-2 focus:ring-purple-500 transition-all font-bold text-sm"
           />
           <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" />
        </div>
        
        <div className="flex items-center gap-2">
           <Filter size={16} className="text-neutral-400" />
           <select 
             value={filterType}
             onChange={e => setFilterType(e.target.value)}
             className="bg-neutral-50 dark:bg-neutral-800 border-none rounded-xl p-3 font-black text-[10px] uppercase focus:ring-2 focus:ring-purple-500"
           >
             <option value="all">Tous les types</option>
             <option value="scolarite">Scolarité</option>
             <option value="vorbereitung">Vorbereitung</option>
             <option value="inscription">Inscription</option>
             <option value="sortie">Sorties</option>
             <option value="diverse">Divers</option>
             <option value="virement_cb">Virements</option>
           </select>

           <select 
             value={filterAccount}
             onChange={e => setFilterAccount(e.target.value)}
             className="bg-neutral-50 dark:bg-neutral-800 border-none rounded-xl p-3 font-black text-[10px] uppercase focus:ring-2 focus:ring-purple-500"
           >
             <option value="all">Tous les comptes</option>
             <option value="caisse">Caisse</option>
             <option value="banque">Banque</option>
           </select>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white dark:bg-neutral-900 rounded-[2.5rem] border border-neutral-100 dark:border-neutral-800 shadow-sm overflow-hidden">
         <div className="overflow-x-auto">
            <table className="w-full">
               <thead>
                  <tr className="bg-neutral-50 dark:bg-neutral-800/50">
                     <th className="px-8 py-4 text-left text-[10px] font-black text-neutral-400 uppercase tracking-widest">Date</th>
                     <th className="px-8 py-4 text-left text-[10px] font-black text-neutral-400 uppercase tracking-widest">Type</th>
                     <th className="px-8 py-4 text-left text-[10px] font-black text-neutral-400 uppercase tracking-widest">Détails</th>
                     <th className="px-8 py-4 text-left text-[10px] font-black text-neutral-400 uppercase tracking-widest">Montant</th>
                     <th className="px-8 py-4 text-left text-[10px] font-black text-neutral-400 uppercase tracking-widest">Compte</th>
                     <th className="px-8 py-4 text-left text-[10px] font-black text-neutral-400 uppercase tracking-widest">Action</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-neutral-50 dark:divide-neutral-800">
                  {loading ? (
                    <tr><td colSpan={6} className="p-12 text-center animate-pulse font-black text-neutral-400 uppercase">Chargement des données...</td></tr>
                  ) : filteredFinances.length === 0 ? (
                    <tr><td colSpan={6} className="p-12 text-center font-black text-neutral-400 uppercase">Aucune transaction trouvée</td></tr>
                  ) : (
                    filteredFinances.map((f) => (
                      <tr key={f.id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-800/30 transition-colors group">
                        <td className="px-8 py-5 whitespace-nowrap text-xs font-black text-neutral-900 dark:text-white tabular-nums uppercase">
                           {new Date(f.date_versement || f.date || f.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </td>
                        <td className="px-8 py-5 whitespace-nowrap">
                           <span className={cn(
                             "px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-tighter",
                             f.type === 'sortie' ? "bg-orange-100 text-orange-600" : 
                             f.type === 'virement_cb' ? "bg-blue-100 text-blue-600" : 
                             f.type === 'inscription' ? "bg-dia-red/10 text-dia-red" : "bg-emerald-100 text-emerald-600"
                           )}>
                              {f.type}
                           </span>
                        </td>
                        <td className="px-8 py-5">
                           <div className="max-w-[300px]">
                              <p className="text-xs font-black text-neutral-900 dark:text-white uppercase truncate">{f.libelle}</p>
                              <p className="text-[10px] font-bold text-neutral-400 uppercase truncate">
                                 {f.recu_numero ? `Reçu ${f.recu_numero}` : `Saisi par ${f.saisi_par?.split('@')[0]}`}
                                 {f.matricule && ` • ${f.matricule}`}
                              </p>
                           </div>
                        </td>
                        <td className={cn(
                          "px-8 py-5 whitespace-nowrap text-sm font-black tabular-nums",
                          (Number(f.montant) || 0) < 0 ? "text-dia-red" : "text-emerald-600"
                        )}>
                           {formatCurrency(Math.abs(f.montant || 0))}
                        </td>
                        <td className="px-8 py-5 whitespace-nowrap">
                           <div className="flex items-center gap-2">
                              <div className={cn("w-1.5 h-1.5 rounded-full", (f.compte_destination || f.accountType) === 'caisse' ? "bg-dia-red" : "bg-blue-600")} />
                              <span className="text-[10px] font-black uppercase text-neutral-400">{f.compte_destination || f.accountType}</span>
                           </div>
                        </td>
                        <td className="px-8 py-5 whitespace-nowrap">
                           <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg text-neutral-400 hover:text-dia-red transition-all">
                                 <AlertCircle size={16} />
                              </button>
                           </div>
                        </td>
                      </tr>
                    ))
                  )}
               </tbody>
            </table>
         </div>
      </div>
    </div>
  );
}

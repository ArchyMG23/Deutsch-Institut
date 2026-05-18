import React, { useState, useMemo } from 'react';
import { History, Search, Download, Filter, Printer, Calendar, ArrowUpDown, Trash2, Edit2, AlertCircle, RefreshCw, ArrowLeft } from 'lucide-react';
import { collection, query, getDocs, orderBy, where, doc, getDoc, limit } from 'firebase/firestore';
import { db } from '../../firebase';
import { useData } from '../../context/DataContext';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency, cn } from '../../utils';
import { formatMontant } from '../../lib/school-engine';
import { showToast, handleError } from '../../lib/errorHandler';
import { EventBus, EVENTS } from '../../lib/eventBus';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';

export default function FinanceArchives({ onBack }: { onBack?: () => void }) {
  const { finances, loading, refreshFinances, refreshStudents, students } = useData();
  const { user, fetchWithAuth } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [filterAccount, setFilterAccount] = useState('all');
  const [sortBy, setSortBy] = useState<'date' | 'name' | 'matricule' | 'amount'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingTransaction, setEditingTransaction] = useState<any>(null);
  const [editFormData, setEditFormData] = useState({ amount: '', date: '', description: '', notes: '', category: '' });

  const isAuthorized = user?.role === 'admin' || user?.isSuperAdmin;

  // --- COMPREHENSIVE LOADING LOGIC (User Request) ---
  const [allTransactions, setAllTransactions] = useState<any[]>([]);
  const [isDeepLoading, setIsDeepLoading] = useState(false);

  const fetchFullHistory = async () => {
    setIsDeepLoading(true);
    const toutes: any[] = [];
    const seenIds = new Set();
    const seenReceipts = new Set();

    try {
      // 0. Source: /finances (Primary ledger) - Removing strict 'active' filter as some records lack it
      const finSnap = await getDocs(query(collection(db, 'finances'), limit(500)));
      finSnap.forEach(doc => {
        const d = doc.data();
        if (d.status === 'deleted' || d.supprimé === true) return;
        seenIds.add(doc.id);
        if (d.receiptId || d.recu_numero) seenReceipts.add(d.receiptId || d.recu_numero);
        toutes.push(normaliseTransaction(doc.id, d, 'income'));
      });

      // 1. Source: /transactions
      const txSnap = await getDocs(query(collection(db, 'transactions'), orderBy('date_versement', 'desc'), limit(300)));
      txSnap.forEach(doc => {
        const d = doc.data();
        if (d.supprimé === true || d.status === 'deleted') return;
        if (seenIds.has(doc.id)) return;
        seenIds.add(doc.id);
        if (d.recu_numero) seenReceipts.add(d.recu_numero);
        toutes.push(normaliseTransaction(doc.id, d, 'transactions'));
      });

      // 2. Source: /sorties
      const sortiesSnap = await getDocs(collection(db, 'sorties'));
      sortiesSnap.forEach(doc => {
        const d = doc.data();
        if (d.supprimé === true || d.status === 'deleted') return;
        if (seenIds.has(doc.id)) return;
        seenIds.add(doc.id);
        toutes.push(normaliseTransaction(doc.id, {
          ...d,
          type: 'sortie',
          libelle: d.libelle || d.categorie || 'Dépense',
          compte_destination: d.source_compte || d.compte || '—'
        }, 'sortie'));
      });

      // 3. Versements Orphelins
      const studentsSnap = await getDocs(collection(db, 'students'));
      for (const sDoc of studentsSnap.docs) {
        const sid = sDoc.id;
        const sData = sDoc.data();
        const sName = `${sData.firstName} ${sData.lastName}`.trim();

        // Scolarite
        const scolaSnap = await getDocs(collection(db, 'scolarites', sid, 'versements'));
        scolaSnap.forEach(vd => {
          const d = vd.data();
          if (seenIds.has(vd.id)) return;
          if (d.recu_numero && seenReceipts.has(d.recu_numero)) return;
          
          seenIds.add(vd.id);
          if (d.recu_numero) seenReceipts.add(d.recu_numero);
          
          toutes.push(normaliseTransaction(vd.id, {
            ...d,
            type: 'scolarite',
            libelle: `Scolarité — ${sName}`,
            eleve_id: sid
          }, 'scolarite'));
        });

        // Vorbereitung
        const vorbSnap = await getDocs(collection(db, 'vorbereitung', sid, 'versements'));
        vorbSnap.forEach(vd => {
          const d = vd.data();
          if (seenIds.has(vd.id)) return;
          if (d.recu_numero && seenReceipts.has(d.recu_numero)) return;
          
          seenIds.add(vd.id);
          if (d.recu_numero) seenReceipts.add(d.recu_numero);
          
          toutes.push(normaliseTransaction(vd.id, {
            ...d,
            type: 'vorbereitung',
            libelle: `Vorbereitung — ${sName}`,
            eleve_id: sid
          }, 'vorbereitung'));
        });
      }

    } catch (err) {
      console.error("Deep fetch error:", err);
    }

    toutes.sort((a, b) => {
      const da = new Date(a.date_versement).getTime() || 0;
      const db_ = new Date(b.date_versement).getTime() || 0;
      return db_ - da;
    });

    setAllTransactions(toutes);
    setIsDeepLoading(false);
  };

  const normaliseTransaction = (id: string, data: any, typeDefaut: string) => {
    const rawDate = data.date_versement || data.date || data.timestamp_creation || data.timestamp || data.createdAt;
    let dateObj = new Date();
    if (rawDate) {
      if (rawDate.toDate) dateObj = rawDate.toDate();
      else dateObj = new Date(rawDate);
    }

    const sid = data.eleve_id || data.studentId;
    let sName = '';
    if (sid) {
      const s = students.find(st => st.id === sid);
      if (s) sName = `${s.lastName} ${s.firstName}`.trim();
    }

    // Determine type label and libelle
    const type = data.type || typeDefaut || 'diverse';
    let label = data.libelle || data.description || data.notes || (data.type ? labelType(data.type) : 'Transaction');
    
    // If it's a student payment and name is missing from label, add it
    if (sid && sName && !label.includes(sName)) {
      label = `${label} — ${sName}`;
    }

    return {
      id,
      type: type,
      libelle: label,
      montant: Number(data.montant || data.amount) || 0,
      amount: Number(data.amount || data.montant) || 0,
      date_versement: dateObj.toISOString(),
      date: dateObj.toISOString(),
      mode_paiement: data.mode_paiement || data.method || '—',
      compte_destination: data.compte_destination || data.accountType || data.compte || data.source_compte || '—',
      eleve_id: sid,
      studentId: sid,
      matricule: data.matricule || data.studentMatricule,
      recu_numero: data.recu_numero || data.receiptId,
      saisi_par: data.saisi_par || data.createdBy || '—',
      notes: data.notes || data.description || '',
      category: data.category || type
    };
  };

  const labelType = (type: string) => {
    const types: any = {
      inscription:            'Inscription',
      scolarite:              'Scolarité',
      vorbereitung:           'Vorbereitung',
      cours_vacances:         'Cours Vacances',
      vacances:               'Cours Vacances',
      diverse:                'Divers',
      virement_caisse_banque: 'Virement',
      virement_cb:            'Virement',
      sortie:                 'Sortie',
      expense:                'Sortie'
    };
    return types[type] || type || '?';
  };

  React.useEffect(() => {
    fetchFullHistory();
  }, []);

  const filteredFinances = useMemo(() => {
    const dataSource = allTransactions.length > 0 ? allTransactions : finances.map(f => normaliseTransaction(f.id, f, f.type));
    
    return dataSource.filter(f => {
      let matchesFilter = true;
      if (filterType !== 'all') {
        if (filterType === 'virement_cb') {
          matchesFilter = f.type === 'virement_cb' || f.type === 'virement_caisse_banque';
        } else {
          matchesFilter = f.type === filterType;
        }
      }
      
      if (selectedStudentId) {
        matchesFilter = matchesFilter && (f.studentId === selectedStudentId || f.eleve_id === selectedStudentId);
      }

      if (filterAccount !== 'all') {
        matchesFilter = matchesFilter && (f.compte_destination === filterAccount);
      }

      const matchSearch = String(f.libelle || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                          String(f.matricule || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                          String(f.recu_numero || '').toLowerCase().includes(searchTerm.toLowerCase());
      
      return matchesFilter && matchSearch;
    }).sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'date') {
        const da = new Date(a.date_versement || a.date).getTime() || 0;
        const db_ = new Date(b.date_versement || b.date).getTime() || 0;
        comparison = da - db_;
      } else if (sortBy === 'name') {
        comparison = String(a.libelle || '').localeCompare(String(b.libelle || ''));
      } else if (sortBy === 'matricule') {
        comparison = String(a.matricule || '').localeCompare(String(b.matricule || ''));
      } else if (sortBy === 'amount') {
        comparison = (Number(a.montant) || 0) - (Number(b.montant) || 0);
      }
      return sortOrder === 'desc' ? -comparison : comparison;
    });
  }, [allTransactions, finances, searchTerm, filterType, filterAccount, sortBy, sortOrder, selectedStudentId, students]);

  const { totalEntrees, totalSorties } = useMemo(() => {
    let entrees = 0;
    let sorties = 0;
    filteredFinances.forEach(f => {
      if (f.type === 'sortie' || f.type === 'expense') {
        sorties += (Number(f.montant) || 0);
      } else if (f.type !== 'virement_cb' && f.type !== 'virement_caisse_banque') {
        entrees += (Number(f.montant) || 0);
      }
    });
    return { totalEntrees: entrees, totalSorties: sorties };
  }, [filteredFinances]);

  const handleUpdate = async () => {
    if (!editingTransaction) return;
    
    toast.promise(
      fetchWithAuth(`/api/finances/${editingTransaction.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          amount: Number(editFormData.amount), 
          date: editFormData.date,
          description: editFormData.libelle,
          category: editFormData.category,
          notes: editFormData.notes
        })
      }).then(async r => {
        if (!r.ok) throw new Error((await r.json()).message);
        setEditingTransaction(null);
        refreshFinances();
        fetchFullHistory();
      }),
      {
        loading: 'Mise à jour...',
        success: 'Transaction mise à jour',
        error: (err) => err.message
      }
    );
  };
  const handleDelete = async (id: string, libelle: string) => {
    if (!window.confirm(`Êtes-vous sûr de vouloir ANNULER la transaction : "${libelle}" ?\n\nCela recalculera les soldes de l'élève et du compte concernés.`)) return;
    
    setDeletingId(id);
    try {
      const res = await fetchWithAuth(`/api/finances/${id}`, { 
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Annulation par l\'administrateur' })
      });
      if (res.ok) {
        showToast("Transaction annulée avec succès", 'success');
        refreshFinances();
        refreshStudents();
        fetchFullHistory();
        
        // Emission des événements
        EventBus.emit(EVENTS.TRANSACTION_SUPPRIMEE, { id });
      } else {
        const err = await res.json();
        showToast(err.message || "Erreur de suppression", 'error');
      }
    } catch (err) {
      handleError("DeleteTransaction", err);
    } finally {
      setDeletingId(null);
    }
  };


  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-4">
          {onBack && (
            <button 
              onClick={onBack}
              className="p-3 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 rounded-2xl transition-all"
            >
              <ArrowLeft size={20} />
            </button>
          )}
          <div className="p-4 bg-purple-600 text-white rounded-[1.5rem] shadow-xl shadow-purple-600/20">
            <History size={32} />
          </div>
          <div>
            <h2 className="text-3xl font-black text-neutral-900 dark:text-white uppercase tracking-tight">Archives Financières</h2>
            <p className="text-neutral-500 font-bold uppercase text-sm">Consultation de toutes les transactions</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
           <button 
             onClick={fetchFullHistory}
             disabled={isDeepLoading}
             className="btn-secondary py-2 px-4 rounded-xl flex items-center gap-2 text-[10px] font-black uppercase tracking-widest"
           >
              <RefreshCw size={16} className={isDeepLoading ? "animate-spin" : ""} /> Actualiser
           </button>
           <button className="btn-secondary py-2 px-4 rounded-xl flex items-center gap-2 text-[10px] font-black uppercase tracking-widest">
              <Download size={16} /> Exporter
           </button>
        </div>
      </div>

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
        
        <div className="flex flex-wrap items-center gap-2">
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
             <option value="vacances">Vacances</option>
             <option value="sortie">Sorties</option>
             <option value="diverse">Divers</option>
             <option value="virement_cb">Virements</option>
           </select>

           <select 
             value={selectedStudentId}
             onChange={(e) => setSelectedStudentId(e.target.value)}
             className="bg-neutral-50 dark:bg-neutral-800 border-none rounded-xl p-3 font-black text-[10px] uppercase focus:ring-2 focus:ring-purple-500"
           >
             <option value="">Tous les étudiants</option>
             {students.sort((a,b) => `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`)).map(s => (
               <option key={s.id} value={s.id}>{s.lastName} {s.firstName} ({s.matricule})</option>
             ))}
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

           <div className="h-4 w-[1px] bg-neutral-200 dark:bg-neutral-800 mx-2" />

           <div className="flex items-center gap-1">
             <ArrowUpDown size={14} className="text-neutral-400" />
             <select 
               value={sortBy}
               onChange={e => setSortBy(e.target.value as any)}
               className="bg-neutral-50 dark:bg-neutral-800 border-none rounded-xl p-3 font-black text-[10px] uppercase focus:ring-2 focus:ring-purple-500"
             >
               <option value="date">Date</option>
               <option value="name">Désignation</option>
               <option value="matricule">Matricule</option>
               <option value="amount">Montant</option>
             </select>
             <button 
               onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
               className="p-3 bg-neutral-50 dark:bg-neutral-800 rounded-xl hover:bg-neutral-100 transition-all"
             >
               {sortOrder === 'asc' ? '↑' : '↓'}
             </button>
           </div>
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
                  {loading || isDeepLoading ? (
                    <tr><td colSpan={6} className="p-12 text-center animate-pulse font-black text-neutral-400 uppercase">Chargement des données...</td></tr>
                  ) : filteredFinances.length === 0 ? (
                    <tr><td colSpan={6} className="p-12 text-center font-black text-neutral-400 uppercase">Aucune transaction trouvée</td></tr>
                  ) : (
                    filteredFinances.map((f) => (
                      <tr key={f.id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-800/30 transition-colors group">
                        <td className="px-8 py-5 whitespace-nowrap text-xs font-black text-neutral-900 dark:text-white tabular-nums uppercase">
                           {new Date(f.date_versement || f.date || f.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                           <div className="text-[9px] text-neutral-400 font-bold">
                             {new Date(f.date_versement || f.date || f.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                           </div>
                        </td>
                        <td className="px-8 py-5 whitespace-nowrap">
                           <span className={cn(
                             "px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-tighter",
                             f.type === 'sortie' || f.type === 'expense' ? "bg-orange-100 text-orange-600" : 
                             f.type === 'virement_cb' ? "bg-blue-100 text-blue-600" : 
                             f.type === 'inscription' ? "bg-dia-red/10 text-dia-red" : "bg-emerald-100 text-emerald-600"
                           )}>
                              {f.type}
                           </span>
                        </td>
                        <td className="px-8 py-5">
                           <div className="max-w-[300px]">
                              <p className="text-xs font-black text-neutral-900 dark:text-white uppercase truncate">{f.libelle || 'Transaction'}</p>
                              <p className="text-[10px] font-bold text-neutral-400 uppercase truncate">
                                 {f.recu_numero ? `Reçu ${f.recu_numero}` : `Source: ${f.mode_paiement || 'Inconnu'}`}
                                 {f.matricule && ` • ${f.matricule}`}
                              </p>
                           </div>
                        </td>
                        <td className="px-8 py-5 whitespace-nowrap">
                              <p className={cn("text-xs font-black tabular-nums", (Number(f.montant) || 0) === 0 ? "text-neutral-400" : (Number(f.montant) || 0) < 0 ? "text-dia-red" : "text-emerald-600")}>
                                 {formatMontant(Math.abs(f.montant || 0))}
                              </p>
                        </td>
                        <td className="px-8 py-5 whitespace-nowrap">
                           <div className="flex items-center gap-2">
                              <div className={cn("w-1.5 h-1.5 rounded-full", f.compte_destination === 'caisse' ? "bg-dia-red" : "bg-blue-600")} />
                              <span className="text-[10px] font-black uppercase text-neutral-400">{f.compte_destination}</span>
                           </div>
                        </td>
                        <td className="px-8 py-5 whitespace-nowrap">
                           <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                {isAuthorized && (
                                <button 
                                  onClick={() => {
                                    setEditingTransaction(f);
                                    const d = new Date(f.date_versement || f.date);
                                    // Local ISO format for datetime-local: YYYY-MM-DDTHH:mm
                                    const year = d.getFullYear();
                                    const month = String(d.getMonth() + 1).padStart(2, '0');
                                    const day = String(d.getDate()).padStart(2, '0');
                                    const hours = String(d.getHours()).padStart(2, '0');
                                    const minutes = String(d.getMinutes()).padStart(2, '0');
                                    
                                    setEditFormData({
                                      amount: String(f.montant),
                                      date: `${year}-${month}-${day}T${hours}:${minutes}`,
                                      libelle: f.libelle || '',
                                      category: f.type || '',
                                      notes: f.notes || ''
                                    });
                                  }}
                                  className="p-2 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg text-neutral-400 hover:text-blue-600 transition-all"
                                  title="Modifier cette transaction"
                                >
                                   <Edit2 size={16} />
                                </button>
                              )}
                              {isAuthorized && (
                                <button 
                                  onClick={() => handleDelete(f.id, f.libelle)}
                                  disabled={deletingId === f.id}
                                  className="p-2 hover:bg-dia-red/10 rounded-lg text-neutral-400 hover:text-dia-red transition-all"
                                  title="Annuler cette transaction"
                                >
                                   {deletingId === f.id ? <div className="w-4 h-4 border-2 border-dia-red border-t-transparent rounded-full animate-spin" /> : <Trash2 size={16} />}
                                </button>
                              )}
                              <button className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg text-neutral-400 hover:text-neutral-900 transition-all">
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
         
         <div className="p-8 bg-neutral-50 dark:bg-neutral-800/50 border-t border-neutral-100 dark:border-neutral-800 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex flex-wrap items-center gap-4">
              <div className="px-6 py-3 bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-100 dark:border-neutral-800 shadow-sm">
                <p className="text-[9px] font-black text-neutral-400 uppercase tracking-[0.2em] mb-1">Affichage</p>
                <p className="text-2xl font-black text-neutral-900 dark:text-white tabular-nums leading-none">{filteredFinances.length} <span className="text-[10px] text-neutral-400">Transactions</span></p>
              </div>
              <div className="px-6 py-3 bg-emerald-50 dark:bg-emerald-900/10 rounded-2xl border border-emerald-100 dark:border-emerald-800 shadow-sm border-l-4 border-l-emerald-500">
                <p className="text-[9px] font-black text-emerald-600 uppercase tracking-[0.2em] mb-1">Total Entrées</p>
                <p className="text-2xl font-black text-emerald-600 tabular-nums leading-none whitespace-nowrap">+{formatMontant(totalEntrees)}</p>
              </div>
              <div className="px-6 py-3 bg-red-50 dark:bg-red-900/10 rounded-2xl border border-red-100 dark:border-red-800 shadow-sm border-l-4 border-l-red-500">
                <p className="text-[9px] font-black text-red-600 uppercase tracking-[0.2em] mb-1">Total Sorties</p>
                <p className="text-2xl font-black text-red-600 tabular-nums leading-none whitespace-nowrap">-{formatMontant(totalSorties)}</p>
              </div>
            </div>
            
            {isDeepLoading && (
              <div className="flex items-center gap-4 p-4 bg-purple-50 dark:bg-purple-900/10 rounded-2xl border border-purple-100 dark:border-purple-800 animate-pulse">
                <RefreshCw size={24} className="text-purple-600 animate-spin" />
                <div>
                  <p className="text-[10px] font-black text-purple-600 uppercase tracking-widest">Chargement profond</p>
                  <p className="text-[8px] font-bold text-purple-400 uppercase">Synchronisation des sources...</p>
                </div>
              </div>
            )}
         </div>
      </div>
      {/* Edit Modal */}
      <AnimatePresence>
        {editingTransaction && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white dark:bg-neutral-900 w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-neutral-100 dark:border-neutral-800">
                <h3 className="text-xl font-black text-neutral-900 dark:text-white uppercase tracking-tight">Modifier la Transaction</h3>
                <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mt-1">ID: {editingTransaction.id}</p>
              </div>

              <div className="p-8 space-y-6">
                <div>
                  <label className="text-[10px] font-black uppercase text-neutral-400 ml-1">Libellé</label>
                  <input 
                    type="text"
                    value={editFormData.libelle}
                    onChange={e => setEditFormData({...editFormData, libelle: e.target.value})}
                    className="w-full mt-1 p-4 bg-neutral-50 dark:bg-neutral-800 border-none rounded-2xl font-bold focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-black uppercase text-neutral-400 ml-1">Catégorie</label>
                      <input 
                        type="text"
                        value={editFormData.category}
                        onChange={e => setEditFormData({...editFormData, category: e.target.value})}
                        className="w-full mt-1 p-4 bg-neutral-50 dark:bg-neutral-800 border-none rounded-2xl font-bold focus:ring-2 focus:ring-purple-500"
                        placeholder="Ex: scolarite, inscription..."
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase text-neutral-400 ml-1">Notes</label>
                      <input 
                        type="text"
                        value={editFormData.notes}
                        onChange={e => setEditFormData({...editFormData, notes: e.target.value})}
                        className="w-full mt-1 p-4 bg-neutral-50 dark:bg-neutral-800 border-none rounded-2xl font-bold focus:ring-2 focus:ring-purple-500"
                        placeholder="..."
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black uppercase text-neutral-400 ml-1">Montant (FCFA)</label>
                    <input 
                      type="number"
                      value={editFormData.amount}
                      onChange={e => setEditFormData({...editFormData, amount: e.target.value})}
                      className="w-full mt-1 p-4 bg-neutral-50 dark:bg-neutral-800 border-none rounded-2xl font-bold focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase text-neutral-400 ml-1">Date & Heure</label>
                    <input 
                      type="datetime-local"
                      value={editFormData.date}
                      onChange={e => setEditFormData({...editFormData, date: e.target.value})}
                      className="w-full mt-1 p-4 bg-neutral-50 dark:bg-neutral-800 border-none rounded-2xl font-bold focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                </div>
              </div>

              <div className="p-8 bg-neutral-50 dark:bg-neutral-800/50 flex gap-4">
                <button 
                  onClick={() => setEditingTransaction(null)}
                  className="flex-1 py-4 bg-white dark:bg-neutral-900 text-neutral-500 font-black uppercase text-xs rounded-2xl hover:bg-neutral-100 transition-all"
                >
                  Annuler
                </button>
                <button 
                  onClick={handleUpdate}
                  className="flex-1 py-4 bg-purple-600 text-white font-black uppercase text-xs rounded-2xl hover:bg-purple-700 shadow-xl shadow-purple-600/20 transition-all"
                >
                  Enregistrer
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

import React, { useState } from 'react';
import { History, Search, Printer, Banknote, Calendar, CreditCard, ChevronRight, AlertCircle, RefreshCw, User, UserPlus, Target, Landmark } from 'lucide-react';
import { db } from '../../firebase';
import { collection, query, where, getDocs, orderBy, doc, getDoc } from 'firebase/firestore';
import { toDateSafe, formatCurrency, cn } from '../../utils';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';

/**
 * SOURCE 1 : Trouver l'élève par son matricule et retourner son ID Firestore
 */
async function trouverEleveParMatricule(matricule: string) {
  if (!matricule?.trim()) return null;
  try {
    const matSuffix = matricule.trim().toUpperCase();
    const q1 = query(collection(db, 'students'), where('matricule', '==', matSuffix));
    const snap = await getDocs(q1);
    if (!snap.empty) return { id: snap.docs[0].id, ...snap.docs[0].data() };

    // Fallback case-sensitive
    const q2 = query(collection(db, 'students'), where('matricule', '==', matricule.trim()));
    const snap2 = await getDocs(q2);
    if (!snap2.empty) return { id: snap2.docs[0].id, ...snap2.docs[0].data() };

    return null;
  } catch (e) {
    console.error('[trouverEleveParMatricule]', e);
    return null;
  }
}

/**
 * SOURCE 2 : Consolider tout l'historique financier depuis toutes les collections possible
 */
async function chargerHistoriqueCompletEleve(eleve_id: string): Promise<any[]> {
  const transactions: any[] = [];
  const ids_vus = new Set<string>();

  const addUnique = (tx: any) => {
    // Si on a un numéro de reçu, on s'en sert pour éviter les doublons entre /transactions et les sous-collections
    const key = tx.recu || tx.id;
    if (ids_vus.has(key)) return;
    ids_vus.add(key);
    transactions.push(tx);
  };

  // 1. Collection globale /transactions
  try {
    const q = query(
      collection(db, 'transactions'),
      where('eleve_id', '==', eleve_id),
      orderBy('timestamp_creation', 'desc')
    );
    const snap = await getDocs(q);
    snap.docs.forEach(d => {
      const data = d.data();
      addUnique({
        id: d.id,
        source: 'transactions',
        type: data.type || 'income',
        categorie: data.categorie || data.category || 'Inscription',
        niveau: data.niveau_id || data.cycle || '—',
        montant: Number(data.montant || data.amount || 0),
        date: toDateSafe(data.date_versement || data.timestamp_creation),
        mode: data.mode_paiement || '—',
        compte: data.compte_destination || '—',
        recu: data.recu_numero || null,
        notes: data.notes || ''
      });
    });
  } catch (e) { console.warn("Err /transactions", e); }

  // 2. Sous-collection Scolarité
  try {
    const snapS = await getDocs(query(collection(db, 'scolarites', eleve_id, 'versements'), orderBy('date', 'desc')));
    snapS.docs.forEach(d => {
      const data = d.data();
      addUnique({
        id: d.id,
        source: 'scolarite',
        type: 'income',
        categorie: 'Scolarité',
        niveau: data.niveau_id || '—',
        montant: Number(data.montant || 0),
        date: toDateSafe(data.date),
        mode: data.mode_paiement || '—',
        compte: data.compte || '—',
        recu: data.recu_numero || null,
        notes: data.notes || ''
      });
    });
  } catch (e) { console.warn("Err /scolarites", e); }

  // 3. Sous-collection Vorbereitung
  try {
    const snapV = await getDocs(collection(db, 'vorbereitung', eleve_id, 'versements'));
    snapV.docs.forEach(d => {
      const data = d.data();
      addUnique({
        id: d.id,
        source: 'vorbereitung',
        type: 'income',
        categorie: 'Vorbereitung',
        niveau: data.examen_type || 'Vorbereitung',
        montant: Number(data.montant || 0),
        date: toDateSafe(data.date),
        mode: data.mode_paiement || '—',
        compte: data.compte || '—',
        recu: data.recu_numero || null,
        notes: data.notes || ''
      });
    });
  } catch (e) { console.warn("Err /vorbereitung", e); }

  // 4. Cours de vacances (parcours des sessions)
  try {
    const sessions = await getDocs(collection(db, 'cours_vacances'));
    for (const session of sessions.docs) {
      const vSnap = await getDocs(collection(db, 'cours_vacances', session.id, 'inscriptions', eleve_id, 'versements'));
      vSnap.forEach(d => {
        const data = d.data();
        addUnique({
          id: d.id,
          source: 'vacances',
          type: 'income',
          categorie: 'Cours de Vacances',
          niveau: session.data().nom_session || 'Session Vacances',
          montant: Number(data.montant || 0),
          date: toDateSafe(data.date),
          mode: data.mode_paiement || '—',
          compte: data.compte_destination || '—',
          recu: data.recu_numero || null,
          notes: data.notes || ''
        });
      });
    }
  } catch (e) { console.warn("Err /vacances", e); }

  // Trier par date décroissante
  return transactions.sort((a, b) => {
    const da = a.date?.getTime() || 0;
    const db_ = b.date?.getTime() || 0;
    return db_ - da;
  });
}

function grouperParNiveau(txs: any[]) {
  const groups: Record<string, any[]> = {};
  txs.forEach(t => {
    const key = t.niveau || 'Divers';
    if (!groups[key]) groups[key] = [];
    groups[key].push(t);
  });
  return groups;
}

export default function FinanceHistoriqueNiveau() {
  const [matricule, setMatricule] = useState('');
  const [student, setStudent] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleSearch = async () => {
    if (!matricule.trim()) return;
    setLoading(true);
    setDone(false);
    try {
      const eleve = await trouverEleveParMatricule(matricule);
      if (!eleve) {
        toast.error("Aucun étudiant trouvé avec ce matricule");
        setStudent(null);
        setTransactions([]);
      } else {
        setStudent(eleve);
        const list = await chargerHistoriqueCompletEleve(eleve.id);
        setTransactions(list);
        setDone(true);
      }
    } catch (e) {
      toast.error("Erreur lors de la recherche");
    } finally {
      setLoading(false);
    }
  };

  const grouped = grouperParNiveau(transactions);
  const totalGlobal = transactions.reduce((s, t) => s + t.montant, 0);

  const getIcon = (cat: string) => {
    const c = cat.toLowerCase();
    if (c.includes('scola')) return <Landmark size={16} className="text-emerald-600" />;
    if (c.includes('vorberei')) return <Target size={16} className="text-amber-600" />;
    if (c.includes('inscrip')) return <UserPlus size={16} className="text-purple-600" />;
    return <CreditCard size={16} className="text-blue-600" />;
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center gap-4 mb-8">
        <div className="p-4 bg-neutral-900 text-white rounded-[1.5rem] shadow-xl">
          <History size={32} />
        </div>
        <div>
          <h2 className="text-3xl font-black text-neutral-900 dark:text-white uppercase tracking-tight">Historique / Niveau</h2>
          <p className="text-neutral-500 font-bold uppercase text-sm">Consolidation de tous les versements par cycle</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Sidebar Search */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white dark:bg-neutral-900 p-8 rounded-[2.5rem] border border-neutral-100 dark:border-neutral-800 shadow-sm space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-neutral-400 ml-1">Rechercher par Matricule</label>
              <div className="relative">
                <input 
                  type="text" 
                  value={matricule}
                  onChange={e => setMatricule(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSearch()}
                  placeholder="DI-A2026..."
                  className="w-full p-4 bg-neutral-50 dark:bg-neutral-800 rounded-2xl border-none focus:ring-2 focus:ring-dia-red transition-all font-bold pr-12 text-sm uppercase"
                />
                <button 
                  onClick={handleSearch}
                  disabled={loading}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-dia-red text-white rounded-xl hover:scale-105 transition-all disabled:opacity-50"
                >
                  {loading ? <RefreshCw size={18} className="animate-spin" /> : <Search size={18} />}
                </button>
              </div>
            </div>

            {student && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="pt-6 border-t border-neutral-100 dark:border-neutral-800 space-y-4"
              >
                <div className="p-5 bg-neutral-900 rounded-[1.5rem] text-white flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center font-black text-white/50">
                    {(student.firstName?.[0] || 'S')}{(student.lastName?.[0] || 'T')}
                  </div>
                  <div>
                    <p className="text-[10px] font-black opacity-40 uppercase">Étudiant trouvé</p>
                    <p className="text-sm font-black uppercase tracking-tight">{student.firstName} {student.lastName}</p>
                    <p className="text-[10px] font-bold text-dia-red uppercase">{student.matricule}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-4 bg-emerald-50 dark:bg-emerald-500/5 rounded-2xl border border-emerald-100 dark:border-emerald-500/10 text-center">
                    <p className="text-[9px] font-black text-emerald-600 uppercase mb-1">Total Versé</p>
                    <p className="text-lg font-black text-emerald-600 tabular-nums">{formatCurrency(totalGlobal)}</p>
                  </div>
                  <div className="p-4 bg-neutral-50 dark:bg-neutral-800 rounded-2xl border border-neutral-100 dark:border-neutral-800 text-center">
                    <p className="text-[9px] font-black text-neutral-400 uppercase mb-1">Transactions</p>
                    <p className="text-lg font-black text-neutral-900 dark:text-white">{transactions.length}</p>
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        </div>

        {/* Results Area */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          {!student ? (
            <div className="bg-white dark:bg-neutral-900 p-12 rounded-[2.5rem] border-2 border-dashed border-neutral-200 dark:border-neutral-800 flex flex-col items-center justify-center text-center space-y-4 min-h-[400px]">
              <div className="w-24 h-24 bg-neutral-50 dark:bg-neutral-800 rounded-full flex items-center justify-center text-neutral-300">
                <User size={48} />
              </div>
              <div className="max-w-xs">
                <h4 className="text-lg font-black uppercase text-neutral-900 dark:text-white">Aucun étudiant sélectionné</h4>
                <p className="text-xs text-neutral-500 font-bold uppercase mt-2">Saisissez un matricule à gauche pour consolider les paiements.</p>
              </div>
            </div>
          ) : transactions.length === 0 && done ? (
             <div className="p-12 text-center bg-white dark:bg-neutral-900 rounded-[2.5rem] border-2 border-dashed border-dia-red/20 shadow-sm flex flex-col items-center gap-4">
                <AlertCircle size={48} className="text-dia-red/30" />
                <div>
                  <p className="text-sm font-black text-neutral-900 dark:text-white uppercase">Aucune transaction trouvée</p>
                  <p className="text-[10px] text-neutral-500 font-bold uppercase mt-2">
                    ID Firestore vérifié : {student.id}
                  </p>
                </div>
             </div>
          ) : (
            <div className="space-y-8 pb-12">
              <AnimatePresence mode='popLayout'>
                {Object.entries(grouped).map(([niveau, txs], groupIdx) => {
                  const subtotal = txs.reduce((s, t) => s + t.montant, 0);
                  return (
                    <motion.div 
                      key={niveau}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: groupIdx * 0.1 }}
                      className="bg-white dark:bg-neutral-900 rounded-[3rem] border border-neutral-100 dark:border-neutral-800 shadow-xl overflow-hidden"
                    >
                      <div className="p-6 px-10 bg-neutral-50/50 dark:bg-neutral-800/20 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="p-3 bg-white dark:bg-neutral-900 rounded-2xl shadow-sm ring-1 ring-neutral-100 dark:ring-neutral-800">
                            <Banknote className="text-dia-red" size={20} />
                          </div>
                          <div>
                            <h4 className="text-xl font-black text-neutral-900 dark:text-white uppercase tracking-tighter">{niveau}</h4>
                            <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">{txs.length} versement(s)</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-[9px] font-black text-neutral-400 uppercase">Sous-total niveau</p>
                          <p className="text-xl font-black text-emerald-600">{formatCurrency(subtotal)}</p>
                        </div>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-neutral-50/30 dark:bg-transparent">
                            <tr className="border-b border-neutral-50 dark:border-neutral-800">
                              <th className="px-10 py-4 text-left text-[9px] font-black text-neutral-400 uppercase tracking-widest">Date</th>
                              <th className="px-10 py-4 text-left text-[9px] font-black text-neutral-400 uppercase tracking-widest">Type</th>
                              <th className="px-10 py-4 text-left text-[9px] font-black text-neutral-400 uppercase tracking-widest">Mode / Compte</th>
                              <th className="px-10 py-4 text-right text-[9px] font-black text-neutral-400 uppercase tracking-widest">Montant</th>
                              <th className="px-10 py-4 text-center text-[9px] font-black text-neutral-400 uppercase tracking-widest w-20">Recu</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-neutral-50 dark:divide-neutral-800">
                            {txs.map((tx) => (
                              <tr key={tx.id} className="group hover:bg-neutral-50/50 dark:hover:bg-neutral-800/30 transition-all">
                                <td className="px-10 py-5">
                                  <div className="flex items-center gap-2">
                                    <Calendar size={14} className="text-neutral-300" />
                                    <span className="text-[11px] font-black text-neutral-900 dark:text-white tabular-nums uppercase">
                                      {tx.date?.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) || '—'}
                                    </span>
                                  </div>
                                </td>
                                <td className="px-10 py-5">
                                  <div className="flex items-center gap-3">
                                    {getIcon(tx.categorie)}
                                    <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-tight">{tx.categorie}</span>
                                  </div>
                                </td>
                                <td className="px-10 py-5">
                                  <div className="flex flex-col gap-0.5">
                                    <span className="text-[10px] font-black text-neutral-900 dark:text-white uppercase">{tx.mode}</span>
                                    <span className="text-[9px] font-bold text-neutral-400 uppercase">{tx.compte}</span>
                                  </div>
                                </td>
                                <td className="px-10 py-5 text-right">
                                  <span className="px-4 py-1.5 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 rounded-lg text-xs font-black tabular-nums">
                                    {formatCurrency(tx.montant)}
                                  </span>
                                </td>
                                <td className="px-10 py-5 text-center">
                                  {tx.recu ? (
                                    <button 
                                      onClick={() => toast.info(`Réimpression du reçu ${tx.recu}`)}
                                      className="p-3 bg-neutral-100 dark:bg-neutral-800 text-neutral-400 rounded-xl hover:bg-dia-red hover:text-white transition-all shadow-sm"
                                      title={`Reçu N°${tx.recu}`}
                                    >
                                      <Printer size={16} />
                                    </button>
                                  ) : <span className="text-neutral-200">—</span>}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


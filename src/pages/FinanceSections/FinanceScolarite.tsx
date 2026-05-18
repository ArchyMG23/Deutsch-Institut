import React, { useState, useMemo } from 'react';
import { Landmark, Search, Wallet, User, Calendar, Receipt, CreditCard, ChevronRight, CheckCircle2, AlertCircle, Trash2, Printer, ArrowLeft, ArrowUpDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { toast } from 'sonner';
import { cn } from '../../utils';
import { formatMontant, TYPES_TX, STATUTS } from '../../lib/school-engine';
import { showToast, handleError } from '../../lib/errorHandler';
import { EventBus, EVENTS } from '../../lib/eventBus';
import { collection, query, where, getDocs, orderBy, doc, getDoc, onSnapshot, Unsubscribe } from 'firebase/firestore';
import { db } from '../../firebase';
import { useEffect } from 'react';

export default function FinanceScolarite({ onBack }: { onBack?: () => void }) {
  const { fetchWithAuth } = useAuth();
  const { students, refreshAll, levels } = useData();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [scolarite, setScolarite] = useState<any>(null);
  const [versements, setVersements] = useState<any[]>([]);
  const [sortBy, setSortBy] = useState<'name' | 'matricule'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Configuration du niveau
  const levelConfig = useMemo(() => {
    if (!selectedStudent?.levelId || !levels) return null;
    return levels.find(n => n.id === selectedStudent.levelId);
  }, [selectedStudent, levels]);

  const sortedStudents = useMemo(() => {
    // Filter out students who are not in a standard level (ex: exclude Vorbereitung and pure Vacances)
    const filtered = students.filter(s => {
      if (!s.levelId) return false;
      const level = levels.find(l => l.id === s.levelId);
      return level?.type === 'standard';
    });

    return [...filtered].sort((a, b) => {
      let comp = 0;
      if (sortBy === 'name') {
        comp = `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
      } else if (sortBy === 'matricule') {
        comp = (a.matricule || '').localeCompare(b.matricule || '');
      }
      return sortOrder === 'desc' ? -comp : comp;
    });
  }, [students, sortBy, sortOrder, levels]);

  const filteredStudents = useMemo(() => {
    if (!searchTerm) return [];
    return sortedStudents.filter(s => 
      s.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.matricule?.toLowerCase().includes(searchTerm.toLowerCase())
    ).slice(0, 5);
  }, [searchTerm, sortedStudents]);

  useEffect(() => {
    if (!selectedStudent) {
      setScolarite(null);
      setVersements([]);
      return;
    }

    const scolaRef = doc(db, 'scolarites', selectedStudent.id);
    const versRef = collection(db, 'scolarites', selectedStudent.id, 'versements');

    const unsubScola = onSnapshot(scolaRef, (snap) => {
      if (snap.exists()) {
        setScolarite({ id: snap.id, ...snap.data() });
      } else {
        // Use suggesting fee from level or fallback
        const suggestedFee = levelConfig?.frais_scolarite || 110000;
        setScolarite({ montant_total_du: suggestedFee, total_verse: 0, reste: suggestedFee });
      }
    });

    const unsubVers = onSnapshot(query(versRef, orderBy('date', 'desc')), (snap) => {
      setVersements(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => {
      unsubScola();
      unsubVers();
    };
  }, [selectedStudent, levelConfig]);

  const handleSelectStudent = (student: any) => {
    setSelectedStudent(student);
    setSearchTerm('');
  };

  const [paymentData, setPaymentData] = useState({
    amount: '',
    paymentMethod: 'Espèces',
    accountType: 'caisse',
    date: new Date().toISOString().split('T')[0],
    notes: ''
  });

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent || !paymentData.amount) return;

    const amount = parseFloat(paymentData.amount);
    
    // VALIDATION PAR NIVEAU (Warning only, following user intent that partial payment is for all levels)
    if (levelConfig) {
      if (levelConfig.paiement_fractionnable === false && amount < (scolarite.reste || 0)) {
        toast.warning(`Note: Le paiement fractionné n'est pas activé pour le niveau ${levelConfig.nom || levelConfig.name || 'Sélectionné'}, mais vous pouvez continuer.`);
      }
      
      if (levelConfig.nb_fractions_max !== null) {
        const currentFractions = versements.length;
        if (currentFractions >= levelConfig.nb_fractions_max && amount < (scolarite.reste || 0)) {
          toast.warning(`Attention: Nombre maximum de fractions recommandé atteint (${levelConfig.nb_fractions_max}).`);
        }
      }
    }

    setLoading(true);
    try {
      const res = await fetchWithAuth('/api/finances/payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: selectedStudent.id,
          amount: parseFloat(paymentData.amount),
          paymentMethod: paymentData.paymentMethod,
          accountType: paymentData.accountType,
          date: paymentData.date,
          type: 'scolarite',
          notes: paymentData.notes
        })
      });
      if (res.ok) {
        showToast("Paiement enregistré avec succès !", 'success');
        // No need to fetchScolarite manually, onSnapshot handles it
        refreshAll(true);
        setPaymentData({ ...paymentData, amount: '', notes: '' });
        
        // Emission des événements
        EventBus.emit(EVENTS.TRANSACTION_AJOUTEE, { type: TYPES_TX.SCOLARITE, amount: parseFloat(paymentData.amount) });
        EventBus.emit(EVENTS.SCOLARITE_UPDATED, { eleve_id: selectedStudent.id });
      } else {
        const data = await res.json();
        showToast(data.message || "Erreur lors du paiement", 'error');
      }
    } catch (err) {
      handleError("PaymentScolarite", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-4">
          {onBack && (
            <button 
              onClick={onBack}
              className="p-3 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 rounded-2xl transition-all"
            >
              <ArrowLeft size={20} />
            </button>
          )}
          <div className="p-4 bg-dia-red text-white rounded-[1.5rem] shadow-xl shadow-dia-red/20">
            <Landmark size={32} />
          </div>
          <div>
            <h2 className="text-3xl font-black text-neutral-900 dark:text-white uppercase tracking-tight">Scolarité (Deutsch Institut)</h2>
            <p className="text-neutral-500 font-bold uppercase text-sm">Gestion des versements et suivi des soldes</p>
          </div>
        </div>
        
        {onBack && (
          <button 
            onClick={onBack}
            className="hidden md:block px-6 py-3 bg-neutral-100 dark:bg-neutral-800 text-neutral-400 font-black uppercase text-[10px] tracking-widest rounded-xl hover:bg-neutral-200 transition-all border border-neutral-200 dark:border-neutral-700"
          >
            Retour
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: Search & Student Info */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white dark:bg-neutral-900 p-8 rounded-[2.5rem] border border-neutral-100 dark:border-neutral-800 shadow-sm space-y-6 relative">
            <h3 className="text-sm font-black text-neutral-400 uppercase tracking-widest mb-2 flex items-center gap-2">
              <Search size={16} /> Rechercher Étudiant
            </h3>
            <div className="relative">
              <input 
                type="text" 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Nom ou Matricule..."
                className="w-full p-4 bg-neutral-50 dark:bg-neutral-800 rounded-2xl border-none focus:ring-2 focus:ring-dia-red transition-all font-bold pr-12"
              />
              <div className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400">
                <User size={20} />
              </div>
            </div>

            <AnimatePresence>
              {searchTerm && filteredStudents.length > 0 && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute left-0 right-0 top-full mt-2 bg-white dark:bg-neutral-900 rounded-[2rem] border border-neutral-100 dark:border-neutral-800 shadow-2xl z-50 overflow-hidden"
                >
                  {filteredStudents.map(s => (
                    <button
                      key={s.id}
                      onClick={() => handleSelectStudent(s)}
                      className="w-full p-4 text-left hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors flex items-center justify-between group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center font-black text-neutral-400 text-xs">
                          {s.firstName[0]}{s.lastName[0]}
                        </div>
                        <div>
                          <p className="font-black text-neutral-900 dark:text-white uppercase text-xs">{s.firstName} {s.lastName}</p>
                          <p className="text-[10px] font-bold text-neutral-400 uppercase">{s.matricule}</p>
                        </div>
                      </div>
                      <ChevronRight size={16} className="text-neutral-300 group-hover:text-dia-red transition-colors" />
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            {selectedStudent ? (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="pt-6 border-t border-neutral-100 dark:border-neutral-800 space-y-4"
              >
                <div className="p-4 bg-neutral-50 dark:bg-neutral-800 rounded-2xl relative group">
                  <button 
                    onClick={() => setSelectedStudent(null)}
                    className="absolute top-2 right-2 p-1 text-neutral-300 hover:text-dia-red opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <Trash2 size={14} />
                  </button>
                  <p className="text-[10px] font-black text-neutral-400 uppercase mb-1">Étudiant Sélectionné</p>
                  <p className="text-sm font-black text-neutral-900 dark:text-white uppercase">{selectedStudent.firstName} {selectedStudent.lastName}</p>
                  <p className="text-[10px] font-bold text-dia-red uppercase">{selectedStudent.matricule}</p>
                </div>
                {scolarite && (
                  <div className="space-y-3">
                    <div className="flex justify-between items-center text-[10px] font-black uppercase text-neutral-400">
                      <span>Total Scolarité</span>
                      <span className="text-neutral-900 dark:text-white tabular-nums">{formatMontant(scolarite.montant_total_du)}</span>
                    </div>
                    <div className="flex justify-between items-center text-[10px] font-black uppercase text-neutral-400">
                      <span>Déjà Versé</span>
                      <span className="text-emerald-600 tabular-nums">{formatMontant(scolarite.total_verse)}</span>
                    </div>
                    <div className="pt-3 border-t border-dashed border-neutral-200 dark:border-neutral-700 mt-3 flex justify-between items-center">
                      <span className="text-xs font-black uppercase text-neutral-900 dark:text-white">Reste à payer</span>
                      <span className={cn(
                        "text-xl font-black tabular-nums",
                        (scolarite.reste || 0) <= 0 ? "text-emerald-600" : "text-dia-red"
                      )}>
                        {formatMontant(scolarite.reste)}
                      </span>
                    </div>
                    <div className={cn(
                      "mt-4 p-2 rounded-xl text-center text-[10px] font-black uppercase tracking-tighter",
                      scolarite.statut_paiement === STATUTS.SOLDE ? "bg-emerald-50 text-emerald-600" : 
                      scolarite.statut_paiement === STATUTS.EN_COURS ? "bg-amber-50 text-amber-600" : 
                      scolarite.statut_paiement === STATUTS.SURPLUS ? "bg-purple-50 text-purple-600" : "bg-neutral-100 text-neutral-400"
                    )}>
                      {scolarite.statut_paiement}
                    </div>
                  </div>
                )}
              </motion.div>
            ) : (
              <div className="pt-4 border-t border-neutral-100 dark:border-neutral-800">
                <div className="flex items-center justify-between mb-4 px-1">
                  <p className="text-[10px] font-black text-neutral-400 uppercase">Trie</p>
                  <div className="flex items-center gap-2">
                    <select 
                      value={sortBy}
                      onChange={e => setSortBy(e.target.value as any)}
                      className="text-[9px] font-black uppercase bg-neutral-50 dark:bg-neutral-800 border-none rounded-lg p-1 px-2 focus:ring-1 focus:ring-dia-red"
                    >
                      <option value="name">Nom</option>
                      <option value="matricule">Matricule</option>
                    </select>
                    <button 
                      onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                      className="text-[9px] font-black"
                    >
                      {sortOrder === 'asc' ? '↑' : '↓'}
                    </button>
                  </div>
                </div>
                <p className="text-[10px] font-black text-neutral-400 uppercase mb-4 text-center">Cliquez sur un étudiant dans la liste pour gérer sa scolarité</p>
                <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                  {sortedStudents.slice(0, 10).map(s => (
                    <button
                      key={s.id}
                      onClick={() => handleSelectStudent(s)}
                      className="w-full p-3 rounded-xl hover:bg-neutral-50 dark:hover:bg-neutral-800 border border-transparent hover:border-neutral-100 dark:hover:border-neutral-700 transition-all flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center font-black text-neutral-400 text-[10px]">
                          {s.firstName[0]}{s.lastName[0]}
                        </div>
                        <div className="text-left">
                          <p className="text-[10px] font-black text-neutral-900 dark:text-white uppercase truncate w-32">{s.firstName} {s.lastName}</p>
                          <p className="text-[8px] font-bold text-neutral-400 uppercase">{s.matricule}</p>
                        </div>
                      </div>
                      <ChevronRight size={14} className="text-neutral-300" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Middle: Payment Form */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-neutral-900 p-8 rounded-[2.5rem] border border-neutral-100 dark:border-neutral-800 shadow-sm h-full flex flex-col justify-between">
            <div className="space-y-8">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-black text-neutral-900 dark:text-white uppercase tracking-tight">Nouveau Versement</h3>
                <div className="p-3 bg-neutral-50 dark:bg-neutral-800 rounded-2xl">
                  <CreditCard size={20} className="text-neutral-400" />
                </div>
              </div>

              <form onSubmit={handlePayment} className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-neutral-400 ml-1">Montant du versement (FCFA)</label>
                    <input 
                      required
                      type="number" 
                      value={paymentData.amount}
                      onChange={e => setPaymentData({...paymentData, amount: e.target.value})}
                      className="w-full p-6 bg-neutral-50 dark:bg-neutral-800 rounded-[1.5rem] border-none focus:ring-2 focus:ring-dia-red transition-all font-black text-2xl tabular-nums text-dia-red"
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-neutral-400 ml-1">Notes / Référence</label>
                    <textarea 
                      value={paymentData.notes}
                      onChange={e => setPaymentData({...paymentData, notes: e.target.value})}
                      className="w-full p-4 bg-neutral-50 dark:bg-neutral-800 rounded-[1.5rem] border-none focus:ring-2 focus:ring-dia-red transition-all font-bold text-sm min-h-[100px]"
                      placeholder="Ex: Deuxième tranche..."
                    />
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-neutral-400 ml-1">Date du Versement</label>
                    <input 
                      type="date" 
                      value={paymentData.date}
                      onChange={e => setPaymentData({...paymentData, date: e.target.value})}
                      className="w-full p-4 bg-neutral-50 dark:bg-neutral-800 rounded-[1.5rem] border-none focus:ring-2 focus:ring-dia-red transition-all font-bold"
                    />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase text-neutral-400 ml-1">Mode de Paiement</label>
                    <div className="flex gap-2">
                      {['Espèces', 'Virement', 'Orange Money', 'Momo'].map(m => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setPaymentData({...paymentData, paymentMethod: m})}
                          className={cn(
                            "flex-1 p-3 rounded-xl border-2 font-black uppercase text-[10px] transition-all",
                            paymentData.paymentMethod === m ? "bg-dia-red border-dia-red text-white shadow-lg shadow-dia-red/20" : "bg-neutral-50 dark:bg-neutral-800 border-transparent text-neutral-500"
                          )}
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase text-neutral-400 ml-1">Faire encaisser par</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setPaymentData({...paymentData, accountType: 'caisse'})}
                        className={cn(
                          "flex items-center justify-center gap-2 p-4 rounded-xl border-2 font-black uppercase text-xs transition-all",
                          paymentData.accountType === 'caisse' ? "bg-dia-red border-dia-red text-white" : "bg-neutral-50 dark:bg-neutral-800 border-transparent text-neutral-500"
                        )}
                      >
                        <Wallet size={16} /> Caisse
                      </button>
                      <button
                        type="button"
                        onClick={() => setPaymentData({...paymentData, accountType: 'banque'})}
                        className={cn(
                          "flex items-center justify-center gap-2 p-4 rounded-xl border-2 font-black uppercase text-xs transition-all",
                          paymentData.accountType === 'banque' ? "bg-blue-600 border-blue-600 text-white" : "bg-neutral-50 dark:bg-neutral-800 border-transparent text-neutral-500"
                        )}
                      >
                        <Landmark size={16} /> Banque
                      </button>
                    </div>
                  </div>

                  <button 
                    type="submit"
                    disabled={loading || !selectedStudent || !paymentData.amount}
                    className="w-full mt-auto p-6 bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase tracking-widest rounded-[1.5rem] transition-all flex items-center justify-center gap-3 shadow-xl shadow-emerald-600/20 group disabled:opacity-30 disabled:grayscale"
                  >
                    {loading ? <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <>Confirmer le Paiement <Receipt size={20} /></>}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>

      {/* Versements History */}
      {selectedStudent && (
        <div className="bg-white dark:bg-neutral-900 rounded-[2.5rem] border border-neutral-100 dark:border-neutral-800 shadow-sm overflow-hidden animate-in slide-in-from-top-4 duration-500">
          <div className="p-8 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
            <h3 className="text-xl font-black text-neutral-900 dark:text-white uppercase tracking-tight">Historique des Versements</h3>
            <button className="p-2 hover:bg-neutral-50 dark:hover:bg-neutral-800 rounded-xl text-neutral-400 transition-colors">
               <Printer size={20} />
            </button>
          </div>
          <div className="overflow-x-auto">
             <table className="w-full">
                <thead>
                   <tr className="border-b border-neutral-50 dark:border-neutral-800">
                      <th className="px-8 py-4 text-left text-[10px] font-black text-neutral-400 uppercase tracking-widest">Date</th>
                      <th className="px-8 py-4 text-left text-[10px] font-black text-neutral-400 uppercase tracking-widest">N° Reçu</th>
                      <th className="px-8 py-4 text-left text-[10px] font-black text-neutral-400 uppercase tracking-widest">Montant</th>
                      <th className="px-8 py-4 text-left text-[10px] font-black text-neutral-400 uppercase tracking-widest">Mode</th>
                      <th className="px-8 py-4 text-left text-[10px] font-black text-neutral-400 uppercase tracking-widest">Compte</th>
                      <th className="px-8 py-4 text-left text-[10px] font-black text-neutral-400 uppercase tracking-widest">Saisi par</th>
                   </tr>
                </thead>
                <tbody className="divide-y divide-neutral-50 dark:divide-neutral-800">
                   {versements.length === 0 ? (
                      <tr>
                         <td colSpan={6} className="px-8 py-12 text-center text-neutral-400 font-bold uppercase text-xs">Aucun versement enregistré</td>
                      </tr>
                   ) : (
                      versements.map((v) => (
                         <tr key={v.id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-800/30 transition-colors">
                            <td className="px-8 py-4 whitespace-nowrap text-xs font-black text-neutral-900 dark:text-white uppercase tabular-nums">
                               {new Date(v.date || v.timestamp?.toDate()).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </td>
                            <td className="px-8 py-4 whitespace-nowrap text-xs font-black text-dia-red tabular-nums">{v.recu_numero}</td>
                            <td className="px-8 py-4 whitespace-nowrap text-xs font-black text-neutral-900 dark:text-white tabular-nums">{formatMontant(v.montant)}</td>
                            <td className="px-8 py-4 whitespace-nowrap">
                               <span className="px-3 py-1 bg-neutral-100 dark:bg-neutral-800 rounded-full text-[10px] font-bold text-neutral-500 uppercase">{v.mode_paiement}</span>
                            </td>
                            <td className="px-8 py-4 whitespace-nowrap">
                               <span className={cn(
                                 "px-3 py-1 rounded-full text-[10px] font-bold uppercase",
                                 v.compte === 'caisse' ? "bg-dia-red/10 text-dia-red" : "bg-blue-100 text-blue-600"
                               )}>{v.compte}</span>
                            </td>
                            <td className="px-8 py-4 whitespace-nowrap text-xs font-bold text-neutral-400 uppercase">{v.saisi_par?.split('@')[0]}</td>
                         </tr>
                      ))
                   )}
                </tbody>
             </table>
          </div>
        </div>
      )}
    </div>
  );
}

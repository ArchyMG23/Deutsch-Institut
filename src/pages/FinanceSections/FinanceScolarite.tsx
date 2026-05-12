import React, { useState, useMemo } from 'react';
import { Landmark, Search, Wallet, User, Calendar, Receipt, CreditCard, ChevronRight, CheckCircle2, AlertCircle, Trash2, Printer } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { toast } from 'sonner';
import { cn, formatCurrency } from '../../utils';
import { collection, query, where, getDocs, orderBy, doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';

export default function FinanceScolarite() {
  const { fetchWithAuth } = useAuth();
  const { students, refreshAll } = useData();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [scolarite, setScolarite] = useState<any>(null);
  const [versements, setVersements] = useState<any[]>([]);

  const filteredStudents = useMemo(() => {
    if (!searchTerm) return [];
    return students.filter(s => 
      s.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.matricule?.toLowerCase().includes(searchTerm.toLowerCase())
    ).slice(0, 5);
  }, [searchTerm, students]);

  const fetchScolarite = async (studentId: string) => {
    try {
      const sRef = doc(db, 'scolarites', studentId);
      const sSnap = await getDoc(sRef);
      if (sSnap.exists()) {
        setScolarite({ id: sSnap.id, ...sSnap.data() });
        const vSnap = await getDocs(query(collection(db, 'scolarites', studentId, 'versements'), orderBy('date', 'desc')));
        setVersements(vSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      } else {
        setScolarite({ montant_total_du: 110000, total_verse: 0, reste: 110000 });
        setVersements([]);
      }
    } catch (err) {
      toast.error("Erreur lors de la récupération de la scolarité");
    }
  };

  const handleSelectStudent = (student: any) => {
    setSelectedStudent(student);
    setSearchTerm('');
    fetchScolarite(student.id);
  };

  const [paymentData, setPaymentData] = useState({
    amount: '',
    paymentMethod: 'Espèces',
    accountType: 'caisse',
    notes: ''
  });

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent || !paymentData.amount) return;

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
          type: 'scolarite',
          notes: paymentData.notes
        })
      });
      if (res.ok) {
        toast.success("Paiement enregistré avec succès !");
        fetchScolarite(selectedStudent.id);
        refreshAll(true);
        setPaymentData({ ...paymentData, amount: '', notes: '' });
      } else {
        const data = await res.json();
        toast.error(data.message || "Erreur lors du paiement");
      }
    } catch (err) {
      toast.error("Erreur réseau");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center gap-4 mb-8">
        <div className="p-4 bg-dia-red text-white rounded-[1.5rem] shadow-xl shadow-dia-red/20">
          <Landmark size={32} />
        </div>
        <div>
          <h2 className="text-3xl font-black text-neutral-900 dark:text-white uppercase tracking-tight">Scolarité (Deutsch Institut)</h2>
          <p className="text-neutral-500 font-bold uppercase text-sm">Gestion des versements et suivi des soldes</p>
        </div>
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
              {filteredStudents.length > 0 && (
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

            {selectedStudent && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="pt-6 border-t border-neutral-100 dark:border-neutral-800 space-y-4"
              >
                <div className="p-4 bg-neutral-50 dark:bg-neutral-800 rounded-2xl">
                  <p className="text-[10px] font-black text-neutral-400 uppercase mb-1">Étudiant Sélectionné</p>
                  <p className="text-sm font-black text-neutral-900 dark:text-white uppercase">{selectedStudent.firstName} {selectedStudent.lastName}</p>
                  <p className="text-[10px] font-bold text-dia-red uppercase">{selectedStudent.matricule}</p>
                </div>
                {scolarite && (
                  <div className="space-y-3">
                    <div className="flex justify-between items-center text-[10px] font-black uppercase text-neutral-400">
                      <span>Total Scolarité</span>
                      <span className="text-neutral-900 dark:text-white tabular-nums">{formatCurrency(scolarite.montant_total_du)}</span>
                    </div>
                    <div className="flex justify-between items-center text-[10px] font-black uppercase text-neutral-400">
                      <span>Déjà Versé</span>
                      <span className="text-emerald-600 tabular-nums">{formatCurrency(scolarite.total_verse)}</span>
                    </div>
                    <div className="pt-3 border-t border-dashed border-neutral-200 dark:border-neutral-700 mt-3 flex justify-between items-center">
                      <span className="text-xs font-black uppercase text-neutral-900 dark:text-white">Reste à payer</span>
                      <span className={cn(
                        "text-xl font-black tabular-nums",
                        (scolarite.reste || 0) <= 0 ? "text-emerald-600" : "text-dia-red"
                      )}>
                        {formatCurrency(scolarite.reste)}
                      </span>
                    </div>
                    <div className={cn(
                      "mt-4 p-2 rounded-xl text-center text-[10px] font-black uppercase tracking-tighter",
                      scolarite.statut_paiement === 'SOLDÉ' ? "bg-emerald-50 text-emerald-600" : 
                      scolarite.statut_paiement === 'EN COURS' ? "bg-amber-50 text-amber-600" : "bg-neutral-100 text-neutral-400"
                    )}>
                      {scolarite.statut_paiement}
                    </div>
                  </div>
                )}
              </motion.div>
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
                            <td className="px-8 py-4 whitespace-nowrap text-xs font-black text-neutral-900 dark:text-white tabular-nums">{formatCurrency(v.montant)}</td>
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

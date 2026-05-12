import React, { useState, useMemo } from 'react';
import { Target, Search, Wallet, User, Calendar, Receipt, CreditCard, ChevronRight, CheckCircle2, Landmark, Printer } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { toast } from 'sonner';
import { cn, formatCurrency } from '../../utils';
import { collection, query, where, getDocs, orderBy, doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';

export default function FinanceVorbereitung() {
  const { fetchWithAuth } = useAuth();
  const { students, refreshAll } = useData();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [vorbereitung, setVorbereitung] = useState<any>(null);
  const [versements, setVersements] = useState<any[]>([]);

  const filteredStudents = useMemo(() => {
    if (!searchTerm) return [];
    return students.filter(s => 
      s.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.matricule?.toLowerCase().includes(searchTerm.toLowerCase())
    ).slice(0, 5);
  }, [searchTerm, students]);

  const fetchVorbereitung = async (studentId: string) => {
    try {
      const vRef = doc(db, 'vorbereitung', studentId);
      const vSnap = await getDoc(vRef);
      if (vSnap.exists()) {
        setVorbereitung({ id: vSnap.id, ...vSnap.data() });
        const verSnap = await getDocs(query(collection(db, 'vorbereitung', studentId, 'versements'), orderBy('date', 'desc')));
        setVersements(verSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      } else {
        setVorbereitung({ montant_total_du: 50000, total_verse: 0, reste: 50000 });
        setVersements([]);
      }
    } catch (err) {
      toast.error("Erreur lors de la récupération");
    }
  };

  const handleSelectStudent = (student: any) => {
    setSelectedStudent(student);
    setSearchTerm('');
    fetchVorbereitung(student.id);
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
          type: 'vorbereitung',
          notes: paymentData.notes
        })
      });
      if (res.ok) {
        toast.success("Paiement Vorbereitung enregistré !");
        fetchVorbereitung(selectedStudent.id);
        refreshAll(true);
        setPaymentData({ ...paymentData, amount: '', notes: '' });
      } else {
        toast.error("Erreur lors du paiement");
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
        <div className="p-4 bg-amber-500 text-white rounded-[1.5rem] shadow-xl shadow-amber-500/20">
          <Target size={32} />
        </div>
        <div>
          <h2 className="text-3xl font-black text-neutral-900 dark:text-white uppercase tracking-tight">Vorbereitung</h2>
          <p className="text-neutral-500 font-bold uppercase text-sm">Gestion des frais d'examen et préparation</p>
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
                className="w-full p-4 bg-neutral-50 dark:bg-neutral-800 rounded-2xl border-none focus:ring-2 focus:ring-amber-500 transition-all font-bold pr-12"
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
                        <div className="w-10 h-10 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center font-black text-neutral-400 text-xs lowercase">
                          {s.firstName[0]}{s.lastName[0]}
                        </div>
                        <div className="flex-1">
                          <p className="font-black text-neutral-900 dark:text-white uppercase text-xs truncate">{s.firstName} {s.lastName}</p>
                          <p className="text-[10px] font-bold text-neutral-400 uppercase">{s.matricule}</p>
                        </div>
                        <ChevronRight size={16} className="text-neutral-300 group-hover:text-amber-500 transition-colors" />
                      </div>
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
                    className="absolute top-2 right-2 p-1 text-neutral-300 hover:text-dia-red opacity-0 group-hover:opacity-100 transition-all font-black text-[10px] uppercase"
                  >
                    Effacer
                  </button>
                  <p className="text-[10px] font-black text-neutral-400 uppercase mb-1">Étudiant Sélectionné</p>
                  <p className="text-sm font-black text-neutral-900 dark:text-white uppercase truncate">{selectedStudent.firstName} {selectedStudent.lastName}</p>
                  <p className="text-[10px] font-bold text-amber-600 uppercase">{selectedStudent.matricule}</p>
                </div>
                {vorbereitung && (
                  <div className="space-y-3">
                    <div className="flex justify-between items-center text-[10px] font-black uppercase text-neutral-400">
                      <span>Total Vorbereitung</span>
                      <span className="text-neutral-900 dark:text-white tabular-nums">{formatCurrency(vorbereitung.montant_total_du)}</span>
                    </div>
                    <div className="flex justify-between items-center text-[10px] font-black uppercase text-neutral-400">
                      <span>Déjà Versé</span>
                      <span className="text-emerald-600 tabular-nums">{formatCurrency(vorbereitung.total_verse)}</span>
                    </div>
                    <div className="pt-3 border-t border-dashed border-neutral-200 dark:border-neutral-700 mt-3 flex justify-between items-center">
                      <span className="text-xs font-black uppercase text-neutral-900 dark:text-white">Reste à payer</span>
                      <span className={cn(
                        "text-xl font-black tabular-nums",
                        (vorbereitung.reste || 0) <= 0 ? "text-emerald-600" : "text-amber-600"
                      )}>
                        {formatCurrency(vorbereitung.reste)}
                      </span>
                    </div>
                  </div>
                )}
              </motion.div>
            ) : (
              <div className="pt-4 border-t border-neutral-100 dark:border-neutral-800">
                 <p className="text-[10px] font-black text-neutral-400 uppercase mb-4 text-center">Derniers Étudiants dans le Système</p>
                 <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                  {students.slice(0, 10).map(s => (
                    <button
                      key={s.id}
                      onClick={() => handleSelectStudent(s)}
                      className="w-full p-3 rounded-xl hover:bg-neutral-50 dark:hover:bg-neutral-800 border border-transparent hover:border-neutral-100 dark:hover:border-neutral-700 transition-all flex items-center justify-between group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center font-black text-neutral-400 text-[10px] group-hover:text-amber-500 transition-colors">
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
                <h3 className="text-xl font-black text-neutral-900 dark:text-white uppercase tracking-tight">Versment Vorbereitung</h3>
                <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl">
                  <CreditCard size={20} />
                </div>
              </div>

              <form onSubmit={handlePayment} className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-neutral-400 ml-1">Montant (FCFA)</label>
                    <input 
                      required
                      type="number" 
                      value={paymentData.amount}
                      onChange={e => setPaymentData({...paymentData, amount: e.target.value})}
                      className="w-full p-6 bg-neutral-50 dark:bg-neutral-800 rounded-[1.5rem] border-none focus:ring-2 focus:ring-amber-500 transition-all font-black text-2xl tabular-nums text-amber-600"
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-neutral-400 ml-1">Notes</label>
                    <textarea 
                      value={paymentData.notes}
                      onChange={e => setPaymentData({...paymentData, notes: e.target.value})}
                      className="w-full p-4 bg-neutral-50 dark:bg-neutral-800 rounded-[1.5rem] border-none focus:ring-2 focus:ring-amber-500 transition-all font-bold text-sm min-h-[100px]"
                      placeholder="..."
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
                      className="w-full p-4 bg-neutral-50 dark:bg-neutral-800 rounded-[1.5rem] border-none focus:ring-2 focus:ring-amber-500 transition-all font-bold"
                    />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase text-neutral-400 ml-1">Mode & Compte</label>
                    <div className="flex gap-2">
                      {['Espèces', 'Virement'].map(m => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setPaymentData({...paymentData, paymentMethod: m})}
                          className={cn(
                            "flex-1 p-3 rounded-xl border-2 font-black uppercase text-[10px] transition-all",
                            paymentData.paymentMethod === m ? "bg-amber-500 border-amber-500 text-white shadow-lg" : "bg-neutral-50 dark:bg-neutral-800 border-transparent text-neutral-500"
                          )}
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-2">
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
                    className="w-full mt-auto p-6 bg-amber-500 hover:bg-amber-600 text-white font-black uppercase tracking-widest rounded-[1.5rem] transition-all flex items-center justify-center gap-3 shadow-xl shadow-amber-500/20 group disabled:opacity-30"
                  >
                    {loading ? <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <>Enregistrer Vorbereitung <Receipt size={20} /></>}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>

      {selectedStudent && (
        <div className="bg-white dark:bg-neutral-900 rounded-[2.5rem] border border-neutral-100 dark:border-neutral-800 shadow-sm overflow-hidden auto-animate">
          <div className="p-8 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
            <h3 className="text-xl font-black text-neutral-900 dark:text-white uppercase tracking-tight">Historique Vorbereitung</h3>
          </div>
          <div className="overflow-x-auto">
             <table className="w-full">
                <thead>
                   <tr className="border-b border-neutral-50 dark:border-neutral-800">
                      <th className="px-8 py-4 text-left text-[10px] font-black text-neutral-400 uppercase tracking-widest">Date</th>
                      <th className="px-8 py-4 text-left text-[10px] font-black text-neutral-400 uppercase tracking-widest">Reçu</th>
                      <th className="px-8 py-4 text-left text-[10px] font-black text-neutral-400 uppercase tracking-widest">Montant</th>
                      <th className="px-8 py-4 text-left text-[10px] font-black text-neutral-400 uppercase tracking-widest">Compte</th>
                   </tr>
                </thead>
                <tbody className="divide-y divide-neutral-50 dark:divide-neutral-800">
                   {versements.map((v) => (
                      <tr key={v.id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-800/30 transition-colors">
                         <td className="px-8 py-4 text-xs font-black text-neutral-900 dark:text-white tabular-nums uppercase">
                            {new Date(v.date || v.timestamp?.toDate()).toLocaleDateString('fr-FR')}
                         </td>
                         <td className="px-8 py-4 text-xs font-black text-dia-red tabular-nums">{v.recu_numero}</td>
                         <td className="px-8 py-4 text-xs font-black text-neutral-900 dark:text-white tabular-nums">{formatCurrency(v.montant)}</td>
                         <td className="px-8 py-4 text-xs font-bold text-neutral-400 uppercase">{v.compte}</td>
                      </tr>
                   ))}
                </tbody>
             </table>
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useState, useMemo } from 'react';
import { Target, Search, Wallet, User, Calendar, Receipt, CreditCard, ChevronRight, CheckCircle2, Landmark, Printer, RefreshCw, AlertCircle, ArrowLeft, ArrowUpDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { toast } from 'sonner';
import { cn, formatCurrency } from '../../utils';
import { formatMontant } from '../../lib/school-engine';
import { showToast, handleError } from '../../lib/errorHandler';
import { EventBus, EVENTS } from '../../lib/eventBus';
import { collection, query, where, getDocs, orderBy, doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import { useEffect } from 'react';

export default function FinanceVorbereitung({ onBack }: { onBack?: () => void }) {
  const { fetchWithAuth } = useAuth();
  const { students, refreshAll, levels } = useData();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [isGuestMode, setIsGuestMode] = useState(false);
  const [guestData, setGuestData] = useState({ firstName: '', lastName: '', phone: '' });
  const [loading, setLoading] = useState(false);
  const [vorbereitung, setVorbereitung] = useState<any>(null);
  const [versements, setVersements] = useState<any[]>([]);
  const [targetAmount, setTargetAmount] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'matricule'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Configuration du niveau
  const levelConfig = useMemo(() => {
    if (!selectedStudent?.levelId || !levels) return null;
    return levels.find(n => n.id === selectedStudent.levelId);
  }, [selectedStudent, levels]);

  const sortedStudents = useMemo(() => {
    return [...students].sort((a, b) => {
      let comp = 0;
      if (sortBy === 'name') {
        comp = `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
      } else if (sortBy === 'matricule') {
        comp = (a.matricule || '').localeCompare(b.matricule || '');
      }
      return sortOrder === 'desc' ? -comp : comp;
    });
  }, [students, sortBy, sortOrder]);

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
      setVorbereitung(null);
      setTargetAmount('');
      setVersements([]);
      return;
    }

    const vorbRef = doc(db, 'vorbereitung', selectedStudent.id);
    const versRef = collection(db, 'vorbereitung', selectedStudent.id, 'versements');

    const unsubVorb = onSnapshot(vorbRef, (snap) => {
      if (snap.exists()) {
        const data = { id: snap.id, ...snap.data() } as any;
        setVorbereitung(data);
        setTargetAmount(String(data.montant_total_du || ''));
      } else {
        setVorbereitung(null);
        // Utilisation du montant configuré au niveau ou rien
        const defaultDue = levelConfig?.frais_vorbereitung_defaut || '';
        setTargetAmount(String(defaultDue));
      }
    });

    const unsubVers = onSnapshot(query(versRef, orderBy('date', 'desc')), (snap) => {
      setVersements(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => {
      unsubVorb();
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
    if (!isGuestMode && !selectedStudent) return;
    if (isGuestMode && (!guestData.firstName || !guestData.lastName)) {
      toast.error("Veuillez entrer le nom et prénom de l'apprenant");
      return;
    }
    if (!paymentData.amount) return;

    setLoading(true);
    try {
      let finalStudentId = selectedStudent?.id;

      let finalTarget = parseFloat(targetAmount);
      if (isNaN(finalTarget)) finalTarget = 0;

      // Handle Guest Registration first if in guest mode
      if (isGuestMode) {
        const studentPayload = {
          firstName: guestData.firstName,
          lastName: guestData.lastName,
          phone: guestData.phone,
          levelId: 'none', 
          cycle: 'Allemand',
          totalTuition: 0,
          fraisType: 'Réduction totale' 
        };
        
        const regRes = await fetchWithAuth('/api/students', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(studentPayload)
        });

        if (regRes.status === 409) {
           toast.error("Cet apprenant semble déjà exister. Veuillez utiliser la recherche.");
           setIsGuestMode(false);
           setSearchTerm(`${guestData.firstName} ${guestData.lastName}`);
           setLoading(false);
           return;
        }

        if (!regRes.ok) {
          const errData = await regRes.json();
          throw new Error(errData.message || "Erreur lors de l'enregistrement de l'apprenant");
        }
        const newStudent = await regRes.json();
        finalStudentId = newStudent.id;
        toast.info(`Apprenant créé : ${newStudent.matricule}`);
      }

      const res = await fetchWithAuth('/api/finances/payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: finalStudentId,
          amount: parseFloat(paymentData.amount),
          totalDue: finalTarget, 
          paymentMethod: paymentData.paymentMethod,
          accountType: paymentData.accountType,
          date: paymentData.date,
          type: 'vorbereitung',
          notes: paymentData.notes
        })
      });
      if (res.ok) {
        showToast("Paiement Vorbereitung enregistré !", 'success');
        
        if (isGuestMode) {
           setIsGuestMode(false);
           setGuestData({ firstName: '', lastName: '', phone: '' });
           refreshAll(true);
        } else {
           refreshAll(true);
        }
        
        // Emission des événements
        EventBus.emit(EVENTS.TRANSACTION_AJOUTEE, { 
          amount: parseFloat(paymentData.amount), 
          type: 'vorbereitung',
          studentId: finalStudentId 
        });
        
        setPaymentData({ ...paymentData, amount: '', notes: '' });
      } else {
        const errorData = await res.json();
        showToast(errorData.message || "Erreur lors du paiement", 'error');
      }
    } catch (err: any) {
      handleError("PaymentVorbereitung", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center gap-4 mb-8">
        {onBack && (
          <button 
            onClick={onBack}
            className="p-3 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 rounded-2xl transition-all"
          >
            <ArrowLeft size={20} />
          </button>
        )}
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
            <div className="flex items-center justify-between gap-4 mb-4">
              <h3 className="text-sm font-black text-neutral-400 uppercase tracking-widest flex items-center gap-2">
                <Search size={16} /> Apprenant
              </h3>
              <button 
                type="button"
                onClick={() => {
                  setIsGuestMode(!isGuestMode);
                  setSelectedStudent(null);
                }}
                className={cn(
                  "text-[9px] font-black uppercase px-3 py-1 rounded-full transition-all",
                  isGuestMode ? "bg-amber-100 text-amber-600" : "bg-neutral-100 text-neutral-500 hover:bg-neutral-200"
                )}
              >
                {isGuestMode ? "Annuler le mode passager" : "+ Apprenant Non Inscrit"}
              </button>
            </div>

            {!isGuestMode ? (
              <div className="relative">
                <input 
                  type="text" 
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  placeholder="Rechercher par Nom ou Matricule..."
                  className="w-full p-4 bg-neutral-50 dark:bg-neutral-800 rounded-2xl border-none focus:ring-2 focus:ring-amber-500 transition-all font-bold pr-12"
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400">
                  <User size={20} />
                </div>
              </div>
            ) : (
              <div className="space-y-4 animate-in slide-in-from-top-2 duration-300">
                <div className="grid grid-cols-2 gap-2">
                  <input 
                    type="text" 
                    placeholder="Prénom"
                    value={guestData.firstName}
                    onChange={e => setGuestData({...guestData, firstName: e.target.value})}
                    className="w-full p-3 bg-neutral-50 dark:bg-neutral-800 rounded-xl border border-neutral-100 dark:border-neutral-700 font-bold text-xs"
                  />
                  <input 
                    type="text" 
                    placeholder="Nom"
                    value={guestData.lastName}
                    onChange={e => setGuestData({...guestData, lastName: e.target.value})}
                    className="w-full p-3 bg-neutral-50 dark:bg-neutral-800 rounded-xl border border-neutral-100 dark:border-neutral-700 font-bold text-xs"
                  />
                </div>
                <input 
                  type="tel" 
                  placeholder="Téléphone"
                  value={guestData.phone}
                  onChange={e => setGuestData({...guestData, phone: e.target.value})}
                  className="w-full p-3 bg-neutral-50 dark:bg-neutral-800 rounded-xl border border-neutral-100 dark:border-neutral-700 font-bold text-xs"
                />
                <div className="p-3 bg-amber-50 dark:bg-amber-900/20 text-amber-600 rounded-xl">
                   <p className="text-[10px] font-bold leading-tight">
                     Note: Cet apprenant sera automatiquement ajouté au système avec un compte "Vorbereitung Seul" (0 frais de scolarité).
                   </p>
                </div>
              </div>
            )}

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
                      <span className="text-neutral-900 dark:text-white tabular-nums">{formatMontant(vorbereitung.montant_total_du)}</span>
                    </div>
                    <div className="flex justify-between items-center text-[10px] font-black uppercase text-neutral-400">
                      <span>Déjà Versé</span>
                      <span className="text-emerald-600 tabular-nums">{formatMontant(vorbereitung.total_verse)}</span>
                    </div>
                    <div className="pt-3 border-t border-dashed border-neutral-200 dark:border-neutral-700 mt-3 flex justify-between items-center">
                      <span className="text-xs font-black uppercase text-neutral-900 dark:text-white">Reste à payer</span>
                      <span className={cn(
                        "text-xl font-black tabular-nums",
                        (vorbereitung.reste || 0) <= 0 ? "text-emerald-600" : "text-amber-600"
                      )}>
                        {formatMontant(vorbereitung.reste)}
                      </span>
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
                       className="text-[9px] font-black uppercase bg-neutral-50 dark:bg-neutral-800 border-none rounded-lg p-1 px-2 focus:ring-1 focus:ring-amber-500"
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
                 <p className="text-[10px] font-black text-neutral-400 uppercase mb-4 text-center">Derniers Étudiants dans le Système</p>
                 <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                  {sortedStudents.slice(0, 10).map(s => (
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

              {selectedStudent && levelConfig && !levelConfig.vorbereitung_disponible ? (
                <div className="p-8 bg-neutral-50 dark:bg-neutral-800 rounded-[2rem] flex flex-col items-center justify-center text-center space-y-4">
                  <AlertCircle size={48} className="text-amber-500" />
                  <div>
                    <h4 className="text-lg font-black uppercase">Vorbereitung Non Disponible</h4>
                    <p className="text-sm text-neutral-500 font-medium max-w-xs mx-auto">
                      Le cycle Vorbereitung n'est pas configuré pour le niveau <span className="text-dia-red font-black">{levelConfig.nom || levelConfig.name || 'Sélectionné'}</span>.
                    </p>
                  </div>
                  <div className="pt-2">
                    <p className="text-[10px] font-bold text-neutral-400 uppercase">Contactez un administrateur pour modifier les options du niveau.</p>
                  </div>
                </div>
              ) : (
                <form onSubmit={handlePayment} className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <div className="space-y-2 p-4 bg-amber-50 dark:bg-amber-900/10 rounded-2xl border border-amber-100 dark:border-amber-800 animate-in slide-in-from-left duration-300">
                    <label className="text-[10px] font-black uppercase text-amber-600 ml-1">Objectif Total Vorbereitung</label>
                    <div className="flex gap-2">
                      <input 
                        type="number" 
                        value={targetAmount}
                        onChange={e => setTargetAmount(e.target.value)}
                        className="flex-1 p-3 bg-white dark:bg-neutral-800 rounded-xl border border-amber-200 dark:border-amber-700 font-black text-amber-600"
                        placeholder="Montant total..."
                      />
                      <button 
                        type="button"
                        onClick={async () => {
                          if (!selectedStudent && !isGuestMode) return;
                          setLoading(true);
                          try {
                            let studentId = selectedStudent?.id;
                            
                            if (isGuestMode) {
                              const regRes = await fetchWithAuth('/api/students', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  firstName: guestData.firstName,
                                  lastName: guestData.lastName,
                                  phone: guestData.phone,
                                  levelId: 'none',
                                  cycle: 'Allemand',
                                  totalTuition: 0,
                                  fraisType: 'Réduction totale'
                                })
                              });
                              if (!regRes.ok) {
                                const err = await regRes.json();
                                throw new Error(err.message || "Erreur création étudiant");
                              }
                              const s = await regRes.json();
                              studentId = s.id;
                              toast.info(`Matricule attribué: ${s.matricule}`);
                              setIsGuestMode(false);
                            }

                            const res = await fetchWithAuth(`/api/finances/update-due/${studentId}`, {
                              method: 'PUT',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ montant_total_du: parseFloat(targetAmount), type: 'vorbereitung' })
                            });
                            if (res.ok) {
                              toast.success(!vorbereitung ? "Apprenant inscrit en Vorbereitung !" : "Objectif mis à jour !");
                              refreshAll(true);
                            } else {
                              const err = await res.json();
                              toast.error(err.message || "Erreur de mise à jour");
                            }
                          } catch (e: any) {
                            toast.error(e.message || "Erreur");
                          } finally {
                            setLoading(false);
                          }
                        }}
                        disabled={loading || (!targetAmount)}
                        className={cn(
                          "p-3 rounded-xl transition-all font-black uppercase text-[10px]",
                          !vorbereitung ? "bg-amber-500 text-white px-6" : "bg-amber-100 text-amber-600 hover:bg-amber-200"
                        )}
                        title={!vorbereitung ? "Inscrire maintenant" : "Mise à jour"}
                      >
                         {!vorbereitung ? (loading ? '...' : 'Inscrire') : (loading ? '...' : <RefreshCw size={20} />)}
                      </button>
                    </div>
                  </div>
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
                    disabled={loading || (!isGuestMode && !selectedStudent) || !paymentData.amount}
                    className="w-full mt-auto p-6 bg-amber-500 hover:bg-amber-600 text-white font-black uppercase tracking-widest rounded-[1.5rem] transition-all flex items-center justify-center gap-3 shadow-xl shadow-amber-500/20 group disabled:opacity-30"
                  >
                    {loading ? <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <>{isGuestMode ? 'Inscrire & Payer Vorbereitung' : 'Enregistrer Vorbereitung'} <Receipt size={20} /></>}
                  </button>
                </div>
              </form>
              )}
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
                         <td className="px-8 py-4 text-xs font-black text-neutral-900 dark:text-white tabular-nums">{formatMontant(v.montant)}</td>
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

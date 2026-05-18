import React, { useState, useMemo, useEffect } from 'react';
import { Sun, Search, Wallet, User, Calendar, Receipt, CreditCard, ChevronRight, CheckCircle2, Landmark, Printer, Plus, Trash2, Edit3, Users, RefreshCw, ArrowLeft, ArrowUpDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { toast } from 'sonner';
import { cn, formatCurrency } from '../../utils';
import { formatMontant } from '../../lib/school-engine';
import { showToast, handleError } from '../../lib/errorHandler';
import { EventBus, EVENTS } from '../../lib/eventBus';
import { collection, query, where, getDocs, orderBy, doc, getDoc, setDoc, addDoc, onSnapshot, deleteDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';

export default function FinanceVacances({ onBack }: { onBack?: () => void }) {
  const { fetchWithAuth, user } = useAuth();
  const { students, refreshAll } = useData();
  const [loading, setLoading] = useState(false);
  const [sessions, setSessions] = useState<any[]>([]);
  const [selectedSession, setSelectedSession] = useState<any>(null);
  const [activeCycle, setActiveCycle] = useState<'Allemand' | 'Anglais'>('Allemand');
  const [searchTerm, setSearchTerm] = useState('');
  const [isSessionModalOpen, setIsSessionModalOpen] = useState(false);
  const [isGuestMode, setIsGuestMode] = useState(false);
  const [guestData, setGuestData] = useState({ firstName: '', lastName: '', phone: '' });
  const [sortBy, setSortBy] = useState<'name' | 'matricule'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Configuration du niveau d'un étudiant recherché
  const getLevelOfStudent = (_studentId: string) => {
    return null;
  };
  
  const isSuperAdmin = user?.email === 'yombivictor@gmail.com' || user?.email === 'gabrielyombi311@gmail.com';

  const [newSession, setNewSession] = useState({
    titre: '',
    dateDescription: '',
    prix: 25000,
    cycle: 'Allemand' as 'Allemand' | 'Anglais'
  });

  // Listen to sessions
  useEffect(() => {
    const q = query(collection(db, 'cours_vacances'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setSessions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, []);

  const filteredSessions = sessions.filter(s => s.cycle === activeCycle);

  const [inscriptions, setInscriptions] = useState<any[]>([]);
  const [selectedInscription, setSelectedInscription] = useState<any>(null);
  const [versements, setVersements] = useState<any[]>([]);

  // Listen to inscriptions when session changes
  useEffect(() => {
    if (!selectedSession) {
      setInscriptions([]);
      return;
    }
    const q = query(collection(db, 'cours_vacances', selectedSession.id, 'inscriptions'));
    const unsub = onSnapshot(q, (snap) => {
      setInscriptions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, [selectedSession?.id]);

  // Listen to versements when inscription changes
  useEffect(() => {
    if (!selectedSession || !selectedInscription) {
      setVersements([]);
      return;
    }
    const q = query(
      collection(db, 'cours_vacances', selectedSession.id, 'inscriptions', selectedInscription.id, 'versements'),
      orderBy('date', 'desc')
    );
    const unsub = onSnapshot(q, (snap) => {
      setVersements(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, [selectedSession?.id, selectedInscription?.id]);

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSuperAdmin) return toast.error("Réservé au Super Admin");
    setLoading(true);
    try {
      await addDoc(collection(db, 'cours_vacances'), {
        ...newSession,
        createdAt: serverTimestamp(),
        createdBy: user?.email
      });
      toast.success("Session de cours de vacances créée !");
      setIsSessionModalOpen(false);
      setNewSession({ titre: '', dateDescription: '', prix: 25000, cycle: activeCycle });
    } catch (err) {
      toast.error("Erreur creation session");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSession = async (id: string) => {
    if (!isSuperAdmin) return toast.error("Réservé au Super Admin");
    if (!confirm("Supprimer cette session ?")) return;
    try {
      await deleteDoc(doc(db, 'cours_vacances', id));
      toast.success("Session supprimée");
      if (selectedSession?.id === id) setSelectedSession(null);
    } catch (err) {
      toast.error("Erreur suppression");
    }
  };

  const handleEnrollStudent = async (student: any) => {
    if (!selectedSession || loading) return;
    setLoading(true);
    try {
      let finalStudentId = student?.id;
      let finalStudent = student;

      if (isGuestMode) {
        const regRes = await fetchWithAuth('/api/students', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...guestData,
            levelId: 'none',
            cycle: activeCycle === 'Allemand' ? 'Allemand' : 'Anglais',
            totalTuition: 0,
            fraisType: 'Réduction totale'
          })
        });

        if (regRes.status === 409) {
           toast.error("Cet apprenant semble déjà exister. Utilisez la recherche.");
           setIsGuestMode(false);
           setSearchTerm(`${guestData.firstName} ${guestData.lastName}`);
           setLoading(false);
           return;
        }

        if (!regRes.ok) throw new Error("Erreur creation apprenant");
        finalStudent = await regRes.json();
        finalStudentId = finalStudent.id;
        toast.info(`Nouveau matricule : ${finalStudent.matricule}`);
      }

      if (!finalStudentId) throw new Error("ID étudiant manquant");

      const insRef = doc(db, 'cours_vacances', selectedSession.id, 'inscriptions', finalStudentId);
      await setDoc(insRef, {
        eleve_id: finalStudentId,
        nom: finalStudent.lastName || '',
        prenom: finalStudent.firstName || '',
        matricule: finalStudent.matricule || '',
        montant_total_du: selectedSession.prix,
        total_verse: 0,
        reste: selectedSession.prix,
        statut: 'EN ATTENTE',
        enrolledAt: serverTimestamp()
      }, { merge: true });

      toast.success(`${finalStudent.firstName || 'Apprenant'} inscrit à la session`);
      setSearchTerm('');
      setIsGuestMode(false);
      setGuestData({ firstName: '', lastName: '', phone: '' });
    } catch (err) {
      console.error(err);
      toast.error("Erreur inscription");
    } finally {
      setLoading(false);
    }
  };

  const [paymentData, setPaymentData] = useState({
    amount: '',
    date: new Date().toISOString().split('T')[0],
    account: 'caisse' as 'caisse' | 'banque'
  });

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSession || !selectedInscription || !paymentData.amount) return;

    setLoading(true);
    try {
      const amount = parseFloat(paymentData.amount);
      const res = await fetchWithAuth('/api/finances/payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: selectedInscription.eleve_id,
          amount: amount,
          paymentMethod: 'Espèces',
          accountType: paymentData.account,
          date: paymentData.date,
          type: 'vacances',
          sessionId: selectedSession.id,
          sessionTitle: selectedSession.titre
        })
      });

      if (res.ok) {
        showToast("Paiement enregistré !", 'success');
        setPaymentData({ ...paymentData, amount: '' });
        
        // Emission des événements
        EventBus.emit(EVENTS.TRANSACTION_AJOUTEE, { 
          amount: amount, 
          type: 'vacances',
          studentId: selectedInscription.eleve_id 
        });
      } else {
        const errorData = await res.json();
        showToast(errorData.message || "Erreur lors du paiement", 'error');
      }
    } catch (err) {
      handleError("PaymentVacances", err);
    } finally {
      setLoading(false);
    }
  };

  const searchStudents = useMemo(() => {
    if (!searchTerm || searchTerm.length < 2) return [];
    return students.filter(s => 
      s.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.matricule?.toLowerCase().includes(searchTerm.toLowerCase())
    ).slice(0, 5);
  }, [searchTerm, students]);

  const sortedInscriptions = useMemo(() => {
    return [...inscriptions].sort((a, b) => {
      let comp = 0;
      if (sortBy === 'name') {
        comp = `${a.prenom} ${a.nom}`.localeCompare(`${b.prenom} ${b.nom}`);
      } else if (sortBy === 'matricule') {
        comp = (a.matricule || '').localeCompare(b.matricule || '');
      }
      return sortOrder === 'desc' ? -comp : comp;
    });
  }, [inscriptions, sortBy, sortOrder]);

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
          <div className="p-4 bg-amber-400 text-white rounded-[1.5rem] shadow-xl shadow-amber-400/20">
            <Sun size={32} />
          </div>
          <div>
            <h2 className="text-3xl font-black text-neutral-900 dark:text-white uppercase tracking-tight">Cours de Vacances</h2>
            <p className="text-neutral-500 font-bold uppercase text-sm">Gestion des sessions spéciales d'été</p>
          </div>
        </div>
        
        {isSuperAdmin && (
          <div className="flex gap-4">
            <button 
              onClick={async () => {
                setLoading(true);
                try {
                  const res = await fetchWithAuth('/api/maintenance/sync-modules', { method: 'POST' });
                  if (res.ok) toast.success("Synchronisation effectuée");
                  else toast.error("Erreur sync");
                } catch (e) {
                  toast.error("Erreur réseau");
                } finally {
                  setLoading(false);
                }
              }}
              className="px-6 py-4 rounded-2xl bg-indigo-500 text-white font-black uppercase text-xs hover:bg-indigo-600 transition-all flex items-center gap-2"
            >
              <RefreshCw size={18} className={loading ? "animate-spin" : ""} /> Sync
            </button>
            <button 
              onClick={() => setIsSessionModalOpen(true)}
              className="flex items-center gap-2 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 px-6 py-4 rounded-2xl font-black uppercase text-xs hover:scale-105 transition-all shadow-xl"
            >
              <Plus size={18} /> Nouvelle Session
            </button>
          </div>
        )}
      </div>

      <div className="flex gap-4 p-1 bg-neutral-100 dark:bg-neutral-800 rounded-2xl w-fit">
        {['Allemand', 'Anglais'].map((c) => (
          <button
            key={c}
            onClick={() => { setActiveCycle(c as any); setSelectedSession(null); }}
            className={cn(
              "px-8 py-3 rounded-xl font-black uppercase text-xs transition-all",
              activeCycle === c ? "bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white shadow-sm" : "text-neutral-400 hover:text-neutral-600"
            )}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Sessions Filter */}
        <div className="lg:col-span-1 space-y-4">
          <h3 className="text-[10px] font-black text-neutral-400 uppercase tracking-widest px-2">Sessions Actives</h3>
          <div className="space-y-3">
            {filteredSessions.length === 0 && (
              <p className="text-xs font-bold text-neutral-400 text-center py-8">Aucune session active</p>
            )}
            {filteredSessions.map(s => (
              <div
                key={s.id}
                onClick={() => { setSelectedSession(s); setSelectedInscription(null); }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedSession(s); setSelectedInscription(null); } }}
                className={cn(
                  "w-full p-5 rounded-[2rem] border-2 text-left transition-all relative group cursor-pointer outline-none",
                  selectedSession?.id === s.id 
                    ? "bg-white dark:bg-neutral-900 border-amber-400 shadow-xl" 
                    : "bg-neutral-50 dark:bg-neutral-800 border-transparent hover:border-neutral-100 dark:hover:border-neutral-700"
                )}
              >
                <div className="flex justify-between items-start mb-2">
                  <p className={cn("font-black text-sm uppercase", selectedSession?.id === s.id ? "text-neutral-900 dark:text-white" : "text-neutral-500")}>{s.titre}</p>
                  {isSuperAdmin && (
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleDeleteSession(s.id); }}
                      className="p-1 text-neutral-300 hover:text-dia-red opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
                <p className="text-[10px] font-bold text-neutral-400 uppercase">{s.dateDescription}</p>
                <div className="mt-4 flex justify-between items-center">
                  <span className="text-[10px] font-black text-amber-500">{formatMontant(s.prix)}</span>
                  <ChevronRight size={16} className={cn("transition-transform", selectedSession?.id === s.id ? "rotate-90 text-amber-400" : "text-neutral-300")} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Dynamic content */}
        <div className="lg:col-span-3 space-y-8">
          {selectedSession ? (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
              {/* Left: Students Subscribed */}
              <div className="bg-white dark:bg-neutral-900 rounded-[3rem] border border-neutral-100 dark:border-neutral-800 p-8 shadow-sm space-y-6">
                  <div className="flex flex-col gap-4 border-b border-neutral-100 dark:border-neutral-800 pb-6">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xl font-black uppercase text-neutral-900 dark:text-white flex items-center gap-3">
                        <Users className="text-amber-400" /> Étudiants
                      </h3>
                      <div className="flex items-center gap-2">
                        <label className="text-[10px] font-black uppercase text-neutral-400 cursor-pointer flex items-center gap-2">
                          <input 
                            type="checkbox" 
                            checked={isGuestMode} 
                            onChange={e => setIsGuestMode(e.target.checked)}
                            className="w-4 h-4 rounded-lg border-neutral-300 text-amber-500 focus:ring-amber-500"
                          />
                          Passant
                        </label>
                      </div>
                    </div>

                    {!isGuestMode ? (
                      <div className="relative w-full">
                        <input 
                          type="text" 
                          value={searchTerm}
                          onChange={e => setSearchTerm(e.target.value)}
                          placeholder="Chercher étudiant..."
                          className="w-full text-xs p-3 bg-neutral-50 dark:bg-neutral-800 rounded-xl border-none pl-4 pr-10 focus:ring-2 focus:ring-amber-400"
                        />
                        <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                        
                        <AnimatePresence>
                          {searchStudents.length > 0 && (
                            <motion.div 
                              initial={{ opacity: 0, scale: 0.95 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.95 }}
                              className="absolute right-0 left-0 top-full mt-2 bg-white dark:bg-neutral-900 rounded-[1.5rem] border border-neutral-100 dark:border-neutral-800 shadow-2xl z-50 overflow-hidden"
                            >
                              {searchStudents.map(s => (
                                <button
                                  key={s.id}
                                  onClick={() => {
                                    handleEnrollStudent(s);
                                  }}
                                  className="w-full p-3 text-left hover:bg-amber-50 dark:hover:bg-amber-900/10 transition-colors border-b border-neutral-50 dark:border-neutral-800 last:border-none"
                                >
                                  <p className="text-[10px] font-black uppercase">{s.firstName} {s.lastName}</p>
                                  <p className="text-[8px] font-bold text-neutral-400">{s.matricule}</p>
                                </button>
                              ))}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4 bg-amber-50 dark:bg-amber-900/10 rounded-2xl border border-amber-100 dark:border-amber-800 animate-in slide-in-from-top duration-300">
                        <input 
                          className="p-3 bg-white dark:bg-neutral-800 rounded-xl border border-amber-200 dark:border-amber-700 text-xs font-bold"
                          placeholder="Nom"
                          value={guestData.lastName}
                          onChange={e => setGuestData({...guestData, lastName: e.target.value})}
                        />
                        <input 
                          className="p-3 bg-white dark:bg-neutral-800 rounded-xl border border-amber-200 dark:border-amber-700 text-xs font-bold"
                          placeholder="Prénom"
                          value={guestData.firstName}
                          onChange={e => setGuestData({...guestData, firstName: e.target.value})}
                        />
                        <input 
                          className="p-3 bg-white dark:bg-neutral-800 rounded-xl border border-amber-200 dark:border-amber-700 text-xs font-bold"
                          placeholder="Téléphone"
                          value={guestData.phone}
                          onChange={e => setGuestData({...guestData, phone: e.target.value})}
                        />
                        <button 
                          onClick={() => handleEnrollStudent(null)}
                          disabled={!guestData.firstName || !guestData.lastName || loading}
                          className="bg-amber-500 text-white rounded-xl font-black uppercase text-[10px] hover:bg-amber-600 disabled:opacity-50"
                        >
                          {loading ? "..." : "Inscrire"}
                        </button>
                      </div>
                    )}
                  </div>

                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <p className="text-[10px] font-black text-neutral-400 uppercase">Trie</p>
                    <select 
                      value={sortBy}
                      onChange={e => setSortBy(e.target.value as any)}
                      className="text-[9px] font-black uppercase bg-neutral-50 dark:bg-neutral-800 border-none rounded-lg p-1 px-2 focus:ring-1 focus:ring-amber-400"
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

                <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                  {inscriptions.length === 0 && (
                    <div className="text-center py-20">
                      <p className="text-xs font-bold text-neutral-400 uppercase">Aucun inscrit pour cette session</p>
                    </div>
                  )}
                  {sortedInscriptions.map(ins => (
                    <button
                      key={ins.id}
                      onClick={() => setSelectedInscription(ins)}
                      className={cn(
                        "w-full p-4 rounded-2xl border transition-all flex items-center justify-between group",
                        selectedInscription?.id === ins.id 
                          ? "bg-amber-50 dark:bg-amber-900/10 border-amber-400 shadow-sm" 
                          : "bg-neutral-50 dark:bg-neutral-800/50 border-transparent hover:border-neutral-100 dark:hover:border-neutral-700"
                      )}
                    >
                      <div className="flex items-center gap-3">
                         <div className="w-10 h-10 rounded-full bg-white dark:bg-neutral-800 flex items-center justify-center font-black text-neutral-400 text-xs">
                           {ins.prenom[0]}{ins.nom[0]}
                         </div>
                         <div className="text-left">
                           <p className="text-xs font-black uppercase text-neutral-900 dark:text-white">{ins.prenom} {ins.nom}</p>
                           <p className="text-[10px] font-bold text-neutral-400">{ins.matricule}</p>
                         </div>
                      </div>
                      <div className="text-right">
                        <p className={cn("text-xs font-black tabular-nums", (ins.reste || 0) > 0 ? "text-dia-red" : "text-emerald-600")}>
                          {formatMontant(ins.reste)}
                        </p>
                        <p className="text-[8px] font-black uppercase text-neutral-400">Reste</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Right: Payment Form & History */}
              <div className="space-y-8">
                {selectedInscription ? (
                  <motion.div 
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="p-8 bg-neutral-900 dark:bg-neutral-950 rounded-[3rem] text-white shadow-2xl space-y-8"
                  >
                    <div className="flex items-center justify-between">
                       <h3 className="text-lg font-black uppercase">Paiement Vacances</h3>
                       <button onClick={() => setSelectedInscription(null)} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
                         <Trash2 size={16} />
                       </button>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                       <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                          <p className="text-[10px] font-black text-white/40 uppercase mb-1">Total Versé</p>
                          <p className="text-xl font-black text-emerald-400">{formatMontant(selectedInscription.total_verse || 0)}</p>
                       </div>
                       <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                          <p className="text-[10px] font-black text-white/40 uppercase mb-1">Reste à Payer</p>
                          <p className="text-xl font-black text-dia-red">{formatMontant(selectedInscription.reste || 0)}</p>
                       </div>
                    </div>

                    <form onSubmit={handlePayment} className="space-y-4">
                       <div className="space-y-2">
                          <label className="text-[10px] font-black text-white/40 uppercase ml-1">Montant à encaisser</label>
                          <input 
                            required
                            type="number"
                            value={paymentData.amount}
                            onChange={e => setPaymentData({...paymentData, amount: e.target.value})}
                            className="w-full p-4 bg-white/5 border border-white/10 rounded-2xl font-black text-2xl text-amber-400 outline-none focus:ring-2 focus:ring-amber-400"
                            placeholder="0"
                          />
                       </div>
                       <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-white/40 uppercase ml-1">Date</label>
                            <input 
                              type="date"
                              value={paymentData.date}
                              onChange={e => setPaymentData({...paymentData, date: e.target.value})}
                              className="w-full p-3 bg-white/5 border border-white/10 rounded-xl font-bold text-xs outline-none"
                            />
                          </div>
                          <div className="space-y-2">
                             <label className="text-[10px] font-black text-white/40 uppercase ml-1">Compte</label>
                             <div className="flex gap-2">
                               {['caisse', 'banque'].map(c => (
                                 <button
                                   key={c}
                                   type="button"
                                   onClick={() => setPaymentData({...paymentData, account: c as any})}
                                   className={cn(
                                     "flex-1 p-3 rounded-xl font-black uppercase text-[10px] transition-all border",
                                     paymentData.account === c ? "bg-white text-neutral-900 border-white" : "bg-transparent border-white/20 text-white/60"
                                   )}
                                 >
                                   {c}
                                 </button>
                               ))}
                             </div>
                          </div>
                       </div>
                       <button 
                         type="submit"
                         disabled={loading || !paymentData.amount}
                         className="w-full p-5 bg-amber-400 hover:bg-amber-500 text-white font-black uppercase tracking-widest rounded-2xl transition-all shadow-xl shadow-amber-400/20 disabled:opacity-50"
                       >
                         Enregistrer Versement
                       </button>
                    </form>

                    {versements.length > 0 && (
                      <div className="pt-8 border-t border-white/10 space-y-4">
                         <h4 className="text-[10px] font-black uppercase text-white/40 tabular-nums tracking-widest">Historique de la session</h4>
                         <div className="space-y-2">
                            {versements.map(v => (
                              <div key={v.id} className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5 text-[10px] font-black uppercase">
                                 <span className="text-white/40">{new Date(v.date).toLocaleDateString()}</span>
                                 <span className="text-amber-400">{formatMontant(v.montant)}</span>
                              </div>
                            ))}
                         </div>
                      </div>
                    )}
                  </motion.div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center p-12 bg-neutral-50 dark:bg-neutral-800/50 rounded-[3rem] border-2 border-dashed border-neutral-100 dark:border-neutral-800">
                    <div className="p-6 bg-white dark:bg-neutral-900 rounded-[2rem] shadow-xl mb-6 text-neutral-300">
                       <CreditCard size={48} />
                    </div>
                    <h3 className="text-sm font-black uppercase text-neutral-900 dark:text-white mb-2">Prêt pour encaissement</h3>
                    <p className="text-[10px] font-bold text-neutral-400 uppercase max-w-xs">
                      Sélectionnez un étudiant dans la liste de gauche pour enregistrer un versement.
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="h-96 flex flex-col items-center justify-center text-center">
               <div className="p-12 bg-amber-400/10 text-amber-400 rounded-full mb-8">
                 <Sun size={64} />
               </div>
               <h2 className="text-2xl font-black uppercase text-neutral-900 dark:text-white mb-4">Module Spécial Vacances</h2>
               <p className="text-neutral-500 font-bold uppercase text-sm max-w-lg">
                 Veuillez choisir une session dans la liste de gauche pour commencer les inscriptions et les encaissements.
               </p>
            </div>
          )}
        </div>
      </div>

      {/* Session Creation Modal */}
      <AnimatePresence>
        {isSessionModalOpen && (
          <div className="fixed inset-0 bg-neutral-950/60 backdrop-blur-md z-[100] flex items-center justify-center p-4">
             <motion.div 
               initial={{ opacity: 0, scale: 0.9 }}
               animate={{ opacity: 1, scale: 1 }}
               exit={{ opacity: 0, scale: 0.9 }}
               className="bg-white dark:bg-neutral-900 w-full max-w-md rounded-[3rem] p-8 shadow-2xl space-y-8"
             >
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-black uppercase text-neutral-900 dark:text-white">Nouvelle Session</h3>
                  <button onClick={() => setIsSessionModalOpen(false)} className="p-2 hover:bg-neutral-50 dark:hover:bg-neutral-800 rounded-xl transition-colors">
                    <Trash2 size={20} className="text-neutral-400" />
                  </button>
                </div>

                <form onSubmit={handleCreateSession} className="space-y-6">
                   <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-neutral-400 ml-1">Titre de la session</label>
                      <input 
                        required
                        type="text" 
                        value={newSession.titre}
                        onChange={e => setNewSession({...newSession, titre: e.target.value})}
                        className="w-full p-4 bg-neutral-50 dark:bg-neutral-800 rounded-2xl border-none font-bold outline-none focus:ring-2 focus:ring-amber-400"
                        placeholder="Ex: Session Juin-Juillet 2024"
                      />
                   </div>
                   <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-neutral-400 ml-1">Période / Dates</label>
                      <input 
                        required
                        type="text" 
                        value={newSession.dateDescription}
                        onChange={e => setNewSession({...newSession, dateDescription: e.target.value})}
                        className="w-full p-4 bg-neutral-50 dark:bg-neutral-800 rounded-2xl border-none font-bold outline-none focus:ring-2 focus:ring-amber-400"
                        placeholder="Ex: Du 15 Juin au 30 Juillet"
                      />
                   </div>
                   <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-neutral-400 ml-1">Frais d'inscription (FCFA)</label>
                      <input 
                        required
                        type="number" 
                        value={newSession.prix}
                        onChange={e => setNewSession({...newSession, prix: parseInt(e.target.value)})}
                        className="w-full p-4 bg-neutral-50 dark:bg-neutral-800 rounded-2xl border-none font-black text-xl text-amber-500 outline-none focus:ring-2 focus:ring-amber-400"
                        placeholder="25000"
                      />
                   </div>
                   <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-neutral-400 ml-1">Cycle Concerné</label>
                      <div className="flex gap-2">
                         {['Allemand', 'Anglais'].map(c => (
                           <button
                             key={c}
                             type="button"
                             onClick={() => setNewSession({...newSession, cycle: c as any})}
                             className={cn(
                               "flex-1 p-4 rounded-2xl border-2 font-black uppercase text-xs transition-all",
                               newSession.cycle === c ? "bg-amber-400 border-amber-400 text-white" : "bg-white dark:bg-neutral-800 border-neutral-100 dark:border-neutral-700 text-neutral-400"
                             )}
                           >
                             {c}
                           </button>
                         ))}
                      </div>
                   </div>
                   <button 
                     type="submit"
                     disabled={loading}
                     className="w-full p-6 bg-amber-400 hover:bg-amber-500 text-white font-black uppercase tracking-widest rounded-[2rem] transition-all shadow-xl shadow-amber-400/30"
                   >
                     {loading ? "Création..." : "Lancer la session"}
                   </button>
                </form>
             </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

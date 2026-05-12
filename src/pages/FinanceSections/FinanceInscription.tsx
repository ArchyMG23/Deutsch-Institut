import React, { useState, useMemo } from 'react';
import { UserPlus, Wallet, ArrowRight, CheckCircle2, User, Search, Fingerprint, Calendar, CreditCard, Landmark, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { toast } from 'sonner';
import { cn, formatCurrency } from '../../utils';

const INVOICE_TYPES = [
  { id: 'Normale', label: 'Inscription Normale', price: 10000, desc: 'Frais standard (10 000 FCFA)' },
  { id: 'Réduction 50%', label: 'Réduction 50%', price: 5000, desc: 'Bourse partielle (5 000 FCFA)' },
  { id: 'Réduction totale', label: 'Réduction totale', price: 0, desc: 'Bourse complète (0 FCFA)' },
];

const BillingPanel = ({ formData, setFormData, loading, handleSubmit }: any) => (
  <div className="bg-neutral-900 dark:bg-neutral-950 p-6 md:p-8 rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden">
    <div className="absolute top-0 right-0 w-32 h-32 bg-dia-red/20 blur-3xl -mr-16 -mt-16" />
    <h3 className="text-lg font-black uppercase flex items-center gap-2 mb-6">
      <CreditCard size={20} className="text-dia-red" />
      Facturation
    </h3>
    
    <div className="space-y-4">
      {INVOICE_TYPES.map((type) => (
        <button
          key={type.id}
          type="button"
          onClick={() => setFormData({...formData, fraisType: type.id})}
          className={cn(
            "w-full p-4 rounded-2xl text-left border-2 transition-all relative overflow-hidden group",
            formData.fraisType === type.id 
              ? "bg-dia-red border-dia-red shadow-lg" 
              : "bg-white/5 border-white/5 hover:border-white/20"
          )}
        >
          <div className="flex justify-between items-center z-10 relative">
            <div className="space-y-1">
              <p className="font-black uppercase text-xs">{type.label}</p>
              <p className={cn("text-[10px] font-bold uppercase", formData.fraisType === type.id ? "text-white/60" : "text-white/40")}>{type.desc}</p>
            </div>
            <p className="font-black text-sm tabular-nums">{type.price === 0 ? "GRATUIT" : formatCurrency(type.price)}</p>
          </div>
        </button>
      ))}
    </div>

    <div className="mt-8 pt-8 border-t border-white/10 space-y-4">
       <div className="flex justify-between items-center text-[10px] font-black uppercase text-white/40">
          <span>Sous-total Inscription</span>
          <span className="tabular-nums">{formatCurrency(INVOICE_TYPES.find(t => t.id === formData.fraisType)?.price || 0)}</span>
       </div>
       {formData.levelId === 'vacations' && formData.customTuition && (
         <div className="flex justify-between items-center text-[10px] font-black uppercase text-emerald-400/60">
            <span>Scolarité Vacances (Dû)</span>
            <span className="tabular-nums">+{formatCurrency(Number(formData.customTuition))}</span>
         </div>
       )}
       <div className="flex justify-between items-center text-2xl font-black uppercase">
          <span>Total Inscription</span>
          <span className="text-dia-red tabular-nums">{formatCurrency(INVOICE_TYPES.find(t => t.id === formData.fraisType)?.price || 0)}</span>
       </div>
    </div>

    {formData.fraisType !== 'Réduction totale' && (
      <div className="mt-8 space-y-6">
         <div className="space-y-3">
            <label className="text-[10px] font-black uppercase text-white/40 ml-1">Date du Versement</label>
            <input 
              type="date" 
              value={formData.dateVerse}
              onChange={e => setFormData({...formData, dateVerse: e.target.value})}
              className="w-full p-3 bg-white/5 border-2 border-white/10 rounded-xl font-black uppercase text-xs text-white focus:ring-2 focus:ring-dia-red outline-none"
            />
         </div>
         <div className="space-y-3">
            <label className="text-[10px] font-black uppercase text-white/40 ml-1">Mode de Paiement</label>
            <div className="flex gap-2">
               {['Espèces', 'Virement'].map(m => (
                 <button
                   key={m}
                   type="button"
                   onClick={() => setFormData({...formData, modePaiement: m})}
                   className={cn(
                     "flex-1 p-3 rounded-xl border-2 font-black uppercase text-[9px] sm:text-[10px] transition-all min-h-[44px]",
                     formData.modePaiement === m ? "bg-white text-neutral-900 border-white" : "bg-transparent border-white/10 text-white/60"
                   )}
                 >
                   {m}
                 </button>
               ))}
            </div>
         </div>
         <div className="space-y-3">
            <label className="text-[10px] font-black uppercase text-white/40 ml-1">Compte de Destination</label>
            <div className="grid grid-cols-2 gap-2">
               <button
                 type="button"
                 onClick={() => setFormData({...formData, compteDestination: 'caisse'})}
                 className={cn(
                   "flex items-center justify-center gap-2 p-3 rounded-xl border-2 font-black uppercase text-[9px] sm:text-[10px] transition-all min-h-[44px]",
                   formData.compteDestination === 'caisse' ? "bg-dia-red border-dia-red text-white" : "bg-transparent border-white/10 text-white/60"
                 )}
               >
                 <Wallet size={12} /> Caisse
               </button>
               <button
                 type="button"
                 onClick={() => setFormData({...formData, compteDestination: 'banque'})}
                 className={cn(
                   "flex items-center justify-center gap-2 p-3 rounded-xl border-2 font-black uppercase text-[9px] sm:text-[10px] transition-all min-h-[44px]",
                   formData.compteDestination === 'banque' ? "bg-blue-600 border-blue-600 text-white" : "bg-transparent border-white/10 text-white/60"
                 )}
               >
                 <Landmark size={12} /> Banque
               </button>
            </div>
         </div>
      </div>
    )}

    <button 
      type="button"
      onClick={handleSubmit}
      disabled={loading}
      className="w-full mt-8 p-6 bg-dia-red hover:bg-dia-red/90 text-white font-black uppercase tracking-widest rounded-2xl transition-all flex items-center justify-center gap-3 shadow-2xl shadow-dia-red/50 group disabled:opacity-50"
    >
      {loading ? (
        <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      ) : (
        <>Valider l'Inscription <ArrowRight className="group-hover:translate-x-1 transition-transform" /></>
      )}
    </button>
  </div>
);

export default function FinanceInscription() {
  const { fetchWithAuth } = useAuth();
  const { levels, refreshAll, students } = useData();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredStudents = useMemo(() => {
    if (!searchTerm) return students.slice(0, 10);
    return students.filter(s => 
      s.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.matricule?.toLowerCase().includes(searchTerm.toLowerCase())
    ).slice(0, 10);
  }, [searchTerm, students]);

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    cycle: 'Allemand',
    levelId: '',
    customTuition: '', // New field for manual tuition
    fraisType: 'Normale',
    modePaiement: 'Espèces',
    compteDestination: 'caisse',
    dateVerse: new Date().toISOString().split('T')[0],
    password: 'DIA.' + Math.floor(Math.random() * 9000 + 1000)
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.levelId) return toast.error("Veuillez choisir un niveau");
    if (formData.levelId === 'vacations' && !formData.customTuition) {
      return toast.error("Veuillez saisir le montant des cours de vacances");
    }
    
    setLoading(true);
    try {
      const res = await fetchWithAuth('/api/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          // Support for custom tuition if selected
          totalTuition: formData.levelId === 'vacations' ? Number(formData.customTuition) : undefined,
          dateVerse: formData.dateVerse
        })
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Étudiant inscrit avec succès !");
        setSuccess(data);
        refreshAll(true);
      } else {
        toast.error(data.message || "Erreur lors de l'inscription");
      }
    } catch (err) {
      toast.error("Erreur réseau");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-2xl mx-auto bg-white dark:bg-neutral-900 rounded-[3rem] p-12 border-2 border-emerald-100 dark:border-emerald-900/30 text-center"
      >
        <div className="w-24 h-24 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-8 animate-bounce">
          <CheckCircle2 size={48} />
        </div>
        <h2 className="text-3xl font-black text-neutral-900 dark:text-white uppercase mb-4 tracking-tight">Inscription Réussie !</h2>
        <div className="bg-neutral-50 dark:bg-neutral-800/50 p-8 rounded-[2rem] text-left space-y-4 mb-8">
          <div className="flex justify-between items-center border-b border-neutral-200 dark:border-neutral-700 pb-4">
            <span className="text-neutral-500 font-bold uppercase text-xs">Matricule</span>
            <span className="text-neutral-900 dark:text-white font-black text-xl tabular-nums">{success.matricule}</span>
          </div>
          <div className="flex justify-between items-center border-b border-neutral-200 dark:border-neutral-700 pb-4">
            <span className="text-neutral-500 font-bold uppercase text-xs">Étudiant</span>
            <span className="text-neutral-900 dark:text-white font-black uppercase text-sm">{success.firstName} {success.lastName}</span>
          </div>
          <div className="flex justify-between items-center border-b border-neutral-200 dark:border-neutral-700 pb-4">
            <span className="text-neutral-500 font-bold uppercase text-xs">Paiement Inscription</span>
            <span className="text-emerald-600 font-black uppercase text-sm">{formData.fraisType === 'Réduction totale' ? 'GRATUIT' : formatCurrency(INVOICE_TYPES.find(t => t.id === formData.fraisType)?.price || 0)}</span>
          </div>
          {formData.levelId === 'vacations' && (
            <div className="flex justify-between items-center border-b border-neutral-200 dark:border-neutral-700 pb-4">
              <span className="text-neutral-500 font-bold uppercase text-xs">Scolarité Vacances</span>
              <span className="text-amber-600 font-black uppercase text-sm">{formatCurrency(Number(formData.customTuition))}</span>
            </div>
          )}
          <div className="flex justify-between items-center">
            <span className="text-neutral-500 font-bold uppercase text-xs">Accès Temporaire</span>
            <span className="text-dia-red font-black text-sm select-all">{success.email} / {success.tempPassword}</span>
          </div>
        </div>
        <button 
          onClick={() => { setSuccess(null); setFormData(p => ({ ...p, firstName: '', lastName: '', email: '', phone: '' })); }}
          className="btn-primary py-4 px-12 rounded-2xl font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-xl shadow-dia-red/20"
        >
          Nouvelle Inscription
        </button>
      </motion.div>
    );
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto px-4">
      <div className="flex items-center gap-4 mb-8">
        <div className="p-4 bg-dia-red text-white rounded-[1.5rem] shadow-xl shadow-dia-red/20">
          <UserPlus size={32} />
        </div>
        <div>
          <h2 className="text-3xl font-black text-neutral-900 dark:text-white uppercase tracking-tight">Inscription Étudiant</h2>
          <p className="text-neutral-500 font-bold uppercase text-sm">Prise d'information et paiement des frais</p>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-8 items-start">
        <form onSubmit={handleSubmit} className="flex-1 space-y-8 w-full">
          {/* Section: Personal Info */}
          <div className="bg-white dark:bg-neutral-900 p-6 md:p-8 rounded-[2.5rem] border border-neutral-100 dark:border-neutral-800 shadow-sm space-y-6">
            <h3 className="text-lg font-black text-neutral-900 dark:text-white uppercase flex items-center gap-2 mb-2">
              <User size={20} className="text-dia-red" />
              État Civil
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-neutral-400 ml-1">Prénom</label>
                <input 
                  required
                  type="text" 
                  value={formData.firstName}
                  onChange={e => setFormData({...formData, firstName: e.target.value})}
                  className="w-full p-4 bg-neutral-50 dark:bg-neutral-800 rounded-2xl border-none focus:ring-2 focus:ring-dia-red transition-all font-bold text-sm"
                  placeholder="Jean"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-neutral-400 ml-1">Nom</label>
                <input 
                  required
                  type="text" 
                  value={formData.lastName}
                  onChange={e => setFormData({...formData, lastName: e.target.value})}
                  className="w-full p-4 bg-neutral-50 dark:bg-neutral-800 rounded-2xl border-none focus:ring-2 focus:ring-dia-red transition-all font-bold text-sm"
                  placeholder="DUPONT"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-neutral-400 ml-1">Email <span className="text-neutral-300 font-normal italic">(Facultatif)</span></label>
                <input 
                  type="email" 
                  value={formData.email}
                  onChange={e => setFormData({...formData, email: e.target.value})}
                  className="w-full p-4 bg-neutral-50 dark:bg-neutral-800 rounded-2xl border-none focus:ring-2 focus:ring-dia-red transition-all font-bold text-sm"
                  placeholder="jean.dupont@email.com"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-neutral-400 ml-1">Téléphone <span className="text-neutral-300 font-normal italic">(Facultatif)</span></label>
                <input 
                  type="tel" 
                  value={formData.phone}
                  onChange={e => setFormData({...formData, phone: e.target.value})}
                  className="w-full p-4 bg-neutral-50 dark:bg-neutral-800 rounded-2xl border-none focus:ring-2 focus:ring-dia-red transition-all font-bold text-sm"
                  placeholder="+237 6XX XXX XXX"
                />
              </div>
            </div>
          </div>

          {/* Section: Programme */}
          <div className="bg-white dark:bg-neutral-900 p-6 md:p-8 rounded-[2.5rem] border border-neutral-100 dark:border-neutral-800 shadow-sm space-y-6">
            <h3 className="text-lg font-black text-neutral-900 dark:text-white uppercase flex items-center gap-2 mb-2">
              <Calendar size={20} className="text-dia-red" />
              Programme & Inscription
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-neutral-400 ml-1">Cycle d'étude</label>
                <div className="flex gap-2 sm:gap-3">
                  {['Allemand', 'Anglais'].map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setFormData({...formData, cycle: c, levelId: ''})}
                      className={cn(
                        "flex-1 p-3 sm:p-4 rounded-xl sm:rounded-2xl font-black uppercase text-[9px] sm:text-[10px] border-2 transition-all min-h-[48px] sm:min-h-[52px]",
                        formData.cycle === c 
                          ? "bg-dia-red text-white border-dia-red shadow-lg shadow-dia-red/20" 
                          : "bg-white dark:bg-neutral-800 border-neutral-100 dark:border-neutral-700 text-neutral-400"
                      )}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-neutral-400 ml-1">Niveau</label>
                  <select 
                    required
                    value={formData.levelId}
                    onChange={e => setFormData({...formData, levelId: e.target.value})}
                    className="w-full p-4 bg-neutral-50 dark:bg-neutral-800 rounded-2xl border-none focus:ring-2 focus:ring-dia-red transition-all font-extrabold uppercase text-sm h-[48px] sm:h-[52px]"
                  >
                    <option value="">Choisir un niveau</option>
                    <option value="vacations">🏖️ Cours de Vacances (Prix variable)</option>
                    {levels
                      .filter(l => {
                        const levelCycle = (l.cycle || l.stream || '').toLowerCase();
                        const targetCycle = formData.cycle.toLowerCase();
                        return levelCycle === targetCycle;
                      })
                      .map((level) => (
                        <option key={level.id} value={level.id}>{level.name} - {formatCurrency(level.tuition)}</option>
                      ))
                    }
                  </select>
                </div>

                {formData.levelId === 'vacations' && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="space-y-2"
                  >
                    <label className="text-[10px] font-black uppercase text-neutral-400 ml-1">Frais de Scolarité Vacances (FCFA)</label>
                    <input 
                      required
                      type="number"
                      value={formData.customTuition}
                      onChange={e => setFormData({...formData, customTuition: e.target.value})}
                      className="w-full p-4 bg-neutral-50 dark:bg-neutral-800 rounded-2xl border-none focus:ring-2 focus:ring-dia-red transition-all font-black text-xl text-dia-red h-[52px]"
                      placeholder="Ex: 25000"
                    />
                  </motion.div>
                )}
              </div>
            </div>
          </div>

          {/* Section: Facturation Panel for Mobile/Medium only (will be hidden on LG) */}
          <div className="lg:hidden">
             <BillingPanel formData={formData} setFormData={setFormData} loading={loading} handleSubmit={handleSubmit} />
          </div>
        </form>

        {/* Right Columns on LG: Facturation + Doublons */}
        <div className="w-full lg:w-[400px] space-y-8 shrink-0">
          <div className="hidden lg:block">
            <BillingPanel formData={formData} setFormData={setFormData} loading={loading} handleSubmit={handleSubmit} />
          </div>

          <div className="bg-white dark:bg-neutral-900 p-6 md:p-8 rounded-[2.5rem] border border-neutral-100 dark:border-neutral-800 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Search size={14} className="text-dia-red" />
              <h3 className="text-[10px] font-black uppercase text-neutral-400 tracking-widest">Vérifier Doublons</h3>
            </div>
            <input 
              type="text" 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Rechercher..."
              className="w-full p-3 bg-neutral-50 dark:bg-neutral-800 rounded-xl border-none focus:ring-2 focus:ring-dia-red transition-all font-bold text-xs mb-4"
            />
            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
              {filteredStudents.length === 0 ? (
                <p className="text-[10px] text-center py-4 text-neutral-400 font-bold uppercase">Aucun résultat</p>
              ) : (
                filteredStudents.map(s => (
                  <div key={s.id} className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-transparent hover:border-neutral-100 dark:hover:border-neutral-700 transition-all group">
                     <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center font-black text-neutral-400 text-[10px]">
                          {s.firstName[0]}{s.lastName[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] font-black text-neutral-900 dark:text-white uppercase truncate">{s.firstName} {s.lastName}</p>
                          <p className="text-[8px] font-bold text-neutral-400 uppercase">{s.matricule}</p>
                        </div>
                     </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

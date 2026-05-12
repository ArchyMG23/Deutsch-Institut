import React, { useState } from 'react';
import { UserPlus, Wallet, ArrowRight, CheckCircle2, User, Search, Fingerprint, Calendar, CreditCard, Landmark } from 'lucide-react';
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

export default function FinanceInscription() {
  const { fetchWithAuth } = useAuth();
  const { levels, refreshAll } = useData();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<any>(null);

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    cycle: 'Allemand',
    levelId: '',
    fraisType: 'Normale',
    modePaiement: 'Espèces',
    compteDestination: 'caisse',
    password: 'DIA' + Math.floor(Math.random() * 9000 + 1000)
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.levelId) return toast.error("Veuillez choisir un niveau");
    
    setLoading(true);
    try {
      const res = await fetchWithAuth('/api/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
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
            <span className="text-neutral-500 font-bold uppercase text-xs">Paiement</span>
            <span className="text-emerald-600 font-black uppercase text-sm">{formData.fraisType === 'Réduction totale' ? 'GRATUIT' : formatCurrency(INVOICE_TYPES.find(t => t.id === formData.fraisType)?.price || 0)}</span>
          </div>
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
    <div className="space-y-8 max-w-5xl mx-auto">
      <div className="flex items-center gap-4 mb-8">
        <div className="p-4 bg-dia-red text-white rounded-[1.5rem] shadow-xl shadow-dia-red/20">
          <UserPlus size={32} />
        </div>
        <div>
          <h2 className="text-3xl font-black text-neutral-900 dark:text-white uppercase tracking-tight">Inscription Étudiant</h2>
          <p className="text-neutral-500 font-bold uppercase text-sm">Prise d'information et paiement des frais</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Personal Info */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-neutral-900 p-8 rounded-[2.5rem] border border-neutral-100 dark:border-neutral-800 shadow-sm space-y-6">
            <h3 className="text-lg font-black text-neutral-900 dark:text-white uppercase flex items-center gap-2 mb-2">
              <User size={20} className="text-dia-red" />
              État Civil
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-neutral-400 ml-1">Prénom</label>
                <input 
                  required
                  type="text" 
                  value={formData.firstName}
                  onChange={e => setFormData({...formData, firstName: e.target.value})}
                  className="w-full p-4 bg-neutral-50 dark:bg-neutral-800 rounded-2xl border-none focus:ring-2 focus:ring-dia-red transition-all font-bold"
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
                  className="w-full p-4 bg-neutral-50 dark:bg-neutral-800 rounded-2xl border-none focus:ring-2 focus:ring-dia-red transition-all font-bold"
                  placeholder="DUPONT"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-neutral-400 ml-1">Email <span className="text-neutral-300 font-normal">(Optionnel)</span></label>
                <input 
                  type="email" 
                  value={formData.email}
                  onChange={e => setFormData({...formData, email: e.target.value})}
                  className="w-full p-4 bg-neutral-50 dark:bg-neutral-800 rounded-2xl border-none focus:ring-2 focus:ring-dia-red transition-all font-bold"
                  placeholder="jean.dupont@email.com"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-neutral-400 ml-1">Téléphone <span className="text-neutral-300 font-normal">(Optionnel)</span></label>
                <input 
                  type="tel" 
                  value={formData.phone}
                  onChange={e => setFormData({...formData, phone: e.target.value})}
                  className="w-full p-4 bg-neutral-50 dark:bg-neutral-800 rounded-2xl border-none focus:ring-2 focus:ring-dia-red transition-all font-bold"
                  placeholder="+237 6XX XXX XXX"
                />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-neutral-900 p-8 rounded-[2.5rem] border border-neutral-100 dark:border-neutral-800 shadow-sm space-y-6">
            <h3 className="text-lg font-black text-neutral-900 dark:text-white uppercase flex items-center gap-2 mb-2">
              <Calendar size={20} className="text-dia-red" />
              Programme & Inscription
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-neutral-400 ml-1">Cycle d'étude</label>
                <div className="flex gap-2">
                  {['Allemand', 'Anglais'].map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setFormData({...formData, cycle: c, levelId: ''})}
                      className={cn(
                        "flex-1 p-4 rounded-2xl font-black uppercase text-xs border-2 transition-all",
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
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-neutral-400 ml-1">Niveau</label>
                <select 
                  required
                  value={formData.levelId}
                  onChange={e => setFormData({...formData, levelId: e.target.value})}
                  className="w-full p-4 bg-neutral-50 dark:bg-neutral-800 rounded-2xl border-none focus:ring-2 focus:ring-dia-red transition-all font-extrabold uppercase text-sm"
                >
                  <option value="">Choisir un niveau</option>
                  {levels.filter(l => l.cycle === formData.cycle || (formData.cycle === 'Allemand' && !l.cycle)).map((level) => (
                    <option key={level.id} value={level.id}>{level.name} - {formatCurrency(level.tuition)}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Billing */}
        <div className="space-y-6">
          <div className="bg-neutral-900 dark:bg-neutral-950 p-8 rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden">
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
                  <span>Sous-total</span>
                  <span className="tabular-nums">{formatCurrency(INVOICE_TYPES.find(t => t.id === formData.fraisType)?.price || 0)}</span>
               </div>
               <div className="flex justify-between items-center text-2xl font-black uppercase">
                  <span>Total à Payer</span>
                  <span className="text-dia-red tabular-nums">{formatCurrency(INVOICE_TYPES.find(t => t.id === formData.fraisType)?.price || 0)}</span>
               </div>
            </div>

            {formData.fraisType !== 'Réduction totale' && (
              <div className="mt-8 space-y-6">
                 <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase text-white/40 ml-1">Mode de Paiement</label>
                    <div className="flex gap-2">
                       {['Espèces', 'Virement'].map(m => (
                         <button
                           key={m}
                           type="button"
                           onClick={() => setFormData({...formData, modePaiement: m})}
                           className={cn(
                             "flex-1 p-3 rounded-xl border-2 font-black uppercase text-[10px] transition-all",
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
                           "flex items-center justify-center gap-2 p-3 rounded-xl border-2 font-black uppercase text-[10px] transition-all",
                           formData.compteDestination === 'caisse' ? "bg-dia-red border-dia-red text-white" : "bg-transparent border-white/10 text-white/60"
                         )}
                       >
                         <Wallet size={12} /> Caisse
                       </button>
                       <button
                         type="button"
                         onClick={() => setFormData({...formData, compteDestination: 'banque'})}
                         className={cn(
                           "flex items-center justify-center gap-2 p-3 rounded-xl border-2 font-black uppercase text-[10px] transition-all",
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
              type="submit"
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
          
          <div className="bg-dia-red/10 border-2 border-dia-red/20 rounded-[2.5rem] p-6 text-center">
            <p className="text-[10px] font-black text-dia-red uppercase leading-relaxed">
              L'inscription génère automatiquement un matricule unique et une fiche de scolarité à 0 FCFA d'avance.
            </p>
          </div>
        </div>
      </form>
    </div>
  );
}

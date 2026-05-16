import React, { useState } from 'react';
import { LogOut, Wallet, Landmark, ArrowUpRight, CheckCircle2, User, Search, Calendar, Tag, CreditCard, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { toast } from 'sonner';
import { cn, formatCurrency } from '../../utils';
import { showToast, handleError } from '../../lib/errorHandler';
import { EventBus, EVENTS } from '../../lib/eventBus';

const CATEGORIES = [
  'Salaires enseignants',
  'Loyer & Charges',
  'Marketing & Publicité',
  'Matériel & Fournitures',
  'Transport & Déplacements',
  'Maintenance & Travaux',
  'Taxes & Impôts',
  'Divers'
];

export default function FinanceSortie() {
  const { fetchWithAuth } = useAuth();
  const { teachers, refreshAll } = useData();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    categorie: 'Divers',
    libelle: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    accountType: 'caisse',
    paymentMethod: 'Espèces',
    notes: '',
    teacherId: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.amount || parseFloat(formData.amount) <= 0) return toast.error("Montant invalide");
    
    setLoading(true);
    try {
      const res = await fetchWithAuth('/api/finances/sortie', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          amount: parseFloat(formData.amount)
        })
      });
      if (res.ok) {
        showToast("Dépense enregistrée !", 'success');
        
        // Emission des événements
        EventBus.emit(EVENTS.TRANSACTION_AJOUTEE, { 
          amount: -parseFloat(formData.amount), 
          category: formData.categorie 
        });
        
        setFormData({
          categorie: 'Divers', libelle: '', amount: '',
          date: new Date().toISOString().split('T')[0],
          accountType: 'caisse', paymentMethod: 'Espèces', notes: '', teacherId: ''
        });
        refreshAll(true);
      } else {
        const errorData = await res.json();
        showToast(errorData.message || "Erreur lors de l'enregistrement", 'error');
      }
    } catch (err) {
      handleError("PaymentSortie", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center gap-4 mb-8">
        <div className="p-4 bg-orange-600 text-white rounded-[1.5rem] shadow-xl shadow-orange-600/20">
          <ArrowUpRight size={32} />
        </div>
        <div>
          <h2 className="text-3xl font-black text-neutral-900 dark:text-white uppercase tracking-tight">Sorties de Caisse</h2>
          <p className="text-neutral-500 font-bold uppercase text-sm">Gestion des dépenses et charges</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <form onSubmit={handleSubmit} className="bg-white dark:bg-neutral-900 p-8 rounded-[2.5rem] border border-neutral-100 dark:border-neutral-800 shadow-sm space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-neutral-400 ml-1">Catégorie</label>
                <select 
                  value={formData.categorie}
                  onChange={e => setFormData({...formData, categorie: e.target.value})}
                  className="w-full p-4 bg-neutral-50 dark:bg-neutral-800 rounded-2xl border-none focus:ring-2 focus:ring-orange-500 transition-all font-black text-sm uppercase"
                >
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-neutral-400 ml-1">Date</label>
                <input 
                  type="date" 
                  value={formData.date}
                  onChange={e => setFormData({...formData, date: e.target.value})}
                  className="w-full p-4 bg-neutral-50 dark:bg-neutral-800 rounded-2xl border-none focus:ring-2 focus:ring-orange-500 transition-all font-bold"
                />
              </div>
            </div>

            {formData.categorie === 'Salaires enseignants' && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="space-y-2"
              >
                <label className="text-[10px] font-black uppercase text-neutral-400 ml-1">Choisir l'enseignant</label>
                <select 
                  required
                  value={formData.teacherId}
                  onChange={e => setFormData({...formData, teacherId: e.target.value})}
                  className="w-full p-4 bg-orange-50 dark:bg-orange-950/20 rounded-2xl border-2 border-orange-100 dark:border-orange-900/30 focus:ring-2 focus:ring-orange-500 transition-all font-black text-sm uppercase text-orange-700 dark:text-orange-400"
                >
                  <option value="">Sélectionner...</option>
                  {teachers.map(t => <option key={t.id} value={t.id}>{t.firstName} {t.lastName} ({t.matricule})</option>)}
                </select>
              </motion.div>
            )}

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-neutral-400 ml-1">Libellé / Détail de la dépense</label>
              <input 
                required
                type="text" 
                value={formData.libelle}
                onChange={e => setFormData({...formData, libelle: e.target.value})}
                placeholder="Ex: Paiement facture électricité Mars 2024"
                className="w-full p-4 bg-neutral-50 dark:bg-neutral-800 rounded-2xl border-none focus:ring-2 focus:ring-orange-500 transition-all font-bold"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               <div className="space-y-2">
                 <label className="text-[10px] font-black uppercase text-neutral-400 ml-1">Montant (FCFA)</label>
                 <input 
                   required
                   type="number" 
                   value={formData.amount}
                   onChange={e => setFormData({...formData, amount: e.target.value})}
                   className="w-full p-6 bg-neutral-900 text-white dark:bg-neutral-950 rounded-3xl border-none focus:ring-2 focus:ring-orange-500 transition-all font-black text-3xl tabular-nums"
                   placeholder="0"
                 />
               </div>
               <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-neutral-400 ml-1">Sortir de</label>
                    <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setFormData({...formData, accountType: 'caisse'})}
                          className={cn(
                            "flex-1 p-3 rounded-xl border-2 font-black uppercase text-xs transition-all",
                            formData.accountType === 'caisse' ? "bg-dia-red border-dia-red text-white" : "bg-neutral-50 dark:bg-neutral-800 border-transparent text-neutral-500"
                          )}
                        >
                          Caisse
                        </button>
                        <button
                          type="button"
                          onClick={() => setFormData({...formData, accountType: 'banque'})}
                          className={cn(
                            "flex-1 p-3 rounded-xl border-2 font-black uppercase text-xs transition-all",
                            formData.accountType === 'banque' ? "bg-blue-600 border-blue-600 text-white" : "bg-neutral-50 dark:bg-neutral-800 border-transparent text-neutral-500"
                          )}
                        >
                          Banque
                        </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-neutral-400 ml-1">Mode</label>
                    <div className="flex gap-2 text-[10px]">
                      {['Espèces', 'Virement', 'Mobile'].map(m => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setFormData({...formData, paymentMethod: m})}
                          className={cn(
                            "flex-1 p-2 rounded-lg border font-black uppercase transition-all",
                            formData.paymentMethod === m ? "bg-neutral-900 text-white border-neutral-900" : "bg-neutral-50 dark:bg-neutral-800 border-transparent text-neutral-500"
                          )}
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                  </div>
               </div>
            </div>

            <div className="pt-4">
              <button 
                type="submit"
                disabled={loading}
                className="w-full p-6 bg-orange-600 hover:bg-orange-700 text-white font-black uppercase tracking-widest rounded-3xl transition-all shadow-xl shadow-orange-600/20 flex items-center justify-center gap-3 disabled:opacity-50"
              >
                {loading ? <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <>Confirmer la Sortie <ArrowUpRight size={20} /></>}
              </button>
            </div>
          </form>
        </div>

        <div className="space-y-6">
           <div className="bg-neutral-900 p-8 rounded-[2.5rem] text-white space-y-6">
              <h3 className="text-sm font-black uppercase text-white/40 tracking-widest">Rappel des Directives</h3>
              <ul className="space-y-4">
                 <li className="flex gap-3 text-xs font-bold leading-relaxed shadow-sm">
                    <div className="w-1.5 h-1.5 bg-dia-red rounded-full mt-1 shrink-0" />
                    L'utilisation de la Caisse et de la Banque doit être justifiée par un libellé précis.
                 </li>
                 <li className="flex gap-3 text-xs font-bold leading-relaxed shadow-sm">
                    <div className="w-1.5 h-1.5 bg-dia-red rounded-full mt-1 shrink-0" />
                    Veuillez enregistrer chaque dépense au moment de sa réalisation.
                 </li>
              </ul>
           </div>
        </div>
      </div>
    </div>
  );
}

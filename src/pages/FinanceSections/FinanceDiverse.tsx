import React, { useState } from 'react';
import { PlusCircle, Wallet, Landmark, ArrowDownRight, CheckCircle2, User, Search, Calendar, Tag, CreditCard, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { toast } from 'sonner';
import { cn, formatCurrency } from '../../utils';

export default function FinanceDiverse() {
  const { fetchWithAuth } = useAuth();
  const { refreshAll } = useData();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    libelle: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    accountType: 'caisse',
    paymentMethod: 'Espèces',
    notes: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.libelle || !formData.amount) return toast.error("Données incomplètes");
    
    setLoading(true);
    try {
      const res = await fetchWithAuth('/api/finances/diverse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          amount: parseFloat(formData.amount)
        })
      });
      if (res.ok) {
        toast.success("Transaction diverse enregistrée !");
        setFormData({
          libelle: '', amount: '', date: new Date().toISOString().split('T')[0],
          accountType: 'caisse', paymentMethod: 'Espèces', notes: ''
        });
        refreshAll(true);
      } else {
        toast.error("Erreur lors de l'enregistrement");
      }
    } catch (err) {
      toast.error("Erreur réseau");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-5xl mx-auto">
      <div className="flex items-center gap-4 mb-8">
        <div className="p-4 bg-emerald-500 text-white rounded-[1.5rem] shadow-xl shadow-emerald-500/20">
          <PlusCircle size={32} />
        </div>
        <div>
          <h2 className="text-3xl font-black text-neutral-900 dark:text-white uppercase tracking-tight">Entrées Diverses</h2>
          <p className="text-neutral-500 font-bold uppercase text-sm">Autres sources de revenus (Ventes de livres, attestations, etc.)</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <form onSubmit={handleSubmit} className="bg-white dark:bg-neutral-900 p-8 rounded-[2.5rem] border border-neutral-100 dark:border-neutral-800 shadow-sm space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-neutral-400 ml-1">Libellé de la transaction</label>
              <input 
                required
                type="text" 
                value={formData.libelle}
                onChange={e => setFormData({...formData, libelle: e.target.value})}
                placeholder="Ex: Vente Manuel Niveau A1"
                className="w-full p-4 bg-neutral-50 dark:bg-neutral-800 rounded-2xl border-none focus:ring-2 focus:ring-emerald-500 transition-all font-bold"
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
                  className="w-full p-6 bg-neutral-50 dark:bg-neutral-800 rounded-[1.5rem] border-none focus:ring-2 focus:ring-emerald-500 transition-all font-black text-3xl tabular-nums text-emerald-600"
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-neutral-400 ml-1">Date</label>
                <input 
                  type="date" 
                  value={formData.date}
                  onChange={e => setFormData({...formData, date: e.target.value})}
                  className="w-full p-6 bg-neutral-50 dark:bg-neutral-800 rounded-[1.5rem] border-none focus:ring-2 focus:ring-emerald-500 transition-all font-bold"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <label className="text-[10px] font-black uppercase text-neutral-400 ml-1">Compte Destination</label>
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
              <div className="space-y-4">
                <label className="text-[10px] font-black uppercase text-neutral-400 ml-1">Mode de Paiement</label>
                <div className="flex gap-2 text-[10px]">
                  {['Espèces', 'Virement', 'Mobile'].map(m => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setFormData({...formData, paymentMethod: m})}
                      className={cn(
                        "flex-1 p-3 rounded-xl border font-black uppercase transition-all",
                        formData.paymentMethod === m ? "bg-neutral-900 text-white border-neutral-900 shadow-md" : "bg-neutral-50 dark:bg-neutral-800 border-transparent text-neutral-500"
                      )}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button 
              type="submit"
              disabled={loading}
              className="w-full mt-6 p-6 bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase tracking-widest rounded-[1.5rem] transition-all shadow-xl shadow-emerald-600/20 flex items-center justify-center gap-3 disabled:opacity-50"
            >
              {loading ? <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <>Enregistrer l'Entrée <ArrowDownRight size={20} /></>}
            </button>
          </form>
        </div>

        <div className="space-y-6">
           <div className="bg-emerald-50 dark:bg-emerald-950/20 p-8 rounded-[2.5rem] border border-emerald-100 dark:border-emerald-900/30 text-emerald-800 dark:text-emerald-400">
              <h3 className="text-sm font-black uppercase mb-4 tracking-widest">Exemples d'entrées</h3>
              <ul className="space-y-3 text-xs font-bold uppercase italic opacity-80">
                 <li>• Vente de livres d'allemand</li>
                 <li>• Frais de duplicata de carte</li>
                 <li>• Frais d'attestations</li>
                 <li>• Revenus boutique / cafétéria</li>
                 <li>• Dons et partenariats</li>
              </ul>
           </div>
        </div>
      </div>
    </div>
  );
}

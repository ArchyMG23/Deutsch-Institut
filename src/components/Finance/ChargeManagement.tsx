import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Trash2, 
  CreditCard, 
  Home, 
  Wifi, 
  Zap, 
  ShoppingBag,
  Search,
  Calendar
} from 'lucide-react';
import { 
  collection, 
  getDocs, 
  addDoc, 
  deleteDoc, 
  doc, 
  query, 
  orderBy,
  where
} from 'firebase/firestore';
import { db } from '../../firebase';
import { Charge } from '../../types';
import { formatCurrency } from '../../utils';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';

export default function ChargeManagement() {
  const [charges, setCharges] = useState<Charge[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchCharges = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'charges'), orderBy('date', 'desc'));
      const snap = await getDocs(q);
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as Charge));
      setCharges(list);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCharges();
  }, []);

  const handleAddCharge = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const newCharge = {
      libelle: formData.get('libelle') as string,
      montant: Number(formData.get('amount')),
      categorie: formData.get('category') as any,
      date: formData.get('date') as string || new Date().toISOString().split('T')[0],
      notes: formData.get('notes') as string
    };

    try {
      await addDoc(collection(db, 'charges'), newCharge);
      toast.success("Charge enregistrée");
      setIsModalOpen(false);
      fetchCharges();
    } catch (err) {
      toast.error("Erreur lors de l'enregistrement");
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Supprimer cette charge ?")) return;
    try {
      await deleteDoc(doc(db, 'charges', id));
      toast.success("Charge supprimée");
      fetchCharges();
    } catch (err) {
      toast.error("Erreur");
    }
  };

  const filteredCharges = charges.filter(c => 
    c.libelle.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.categorie.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getCategoryIcon = (cat: string) => {
    switch (cat) {
      case 'loyer': return <Home size={18} />;
      case 'internet': return <Wifi size={18} />;
      case 'electricite': return <Zap size={18} />;
      default: return <ShoppingBag size={18} />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={18} />
          <input 
            type="text" 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Rechercher une charge..."
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl outline-none focus:ring-2 focus:ring-dia-red/20"
          />
        </div>
        <button onClick={() => setIsModalOpen(true)} className="btn-primary flex items-center justify-center gap-2 px-6">
          <Plus size={18} />
          Nouvelle Charge
        </button>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-neutral-50 dark:bg-neutral-800/50 border-b border-neutral-100 dark:border-neutral-800">
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-neutral-500">Date</th>
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-neutral-500">Libellé</th>
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-neutral-500">Catégorie</th>
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-neutral-500 text-right">Montant</th>
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-neutral-500 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {filteredCharges.map((charge) => (
              <tr key={charge.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors">
                <td className="px-6 py-4 text-sm font-medium">{new Date(charge.date).toLocaleDateString()}</td>
                <td className="px-6 py-4">
                  <p className="text-sm font-bold text-neutral-700 dark:text-neutral-300">{charge.libelle}</p>
                  {charge.notes && <p className="text-[10px] text-neutral-400">{charge.notes}</p>}
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase text-neutral-500">
                    <span className="p-1.5 bg-neutral-100 dark:bg-neutral-800 rounded-lg">
                      {getCategoryIcon(charge.categorie)}
                    </span>
                    {charge.categorie}
                  </div>
                </td>
                <td className="px-6 py-4 text-right font-black text-red-600">
                  {formatCurrency(charge.montant)}
                </td>
                <td className="px-6 py-4 text-right">
                  <button onClick={() => handleDelete(charge.id)} className="p-2 text-neutral-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all">
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
            {filteredCharges.length === 0 && !loading && (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-neutral-400 font-medium italic">
                  Aucune charge enregistrée
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative bg-white dark:bg-neutral-900 rounded-3xl w-full max-w-md p-8 shadow-2xl overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1.5 bg-dia-red" />
              <h4 className="text-xl font-black uppercase mb-6 flex items-center gap-2">
                <Plus size={20} className="text-dia-red" />
                Dépense du Centre
              </h4>
              <form onSubmit={handleAddCharge} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 px-1">Libellé de la dépense</label>
                  <input name="libelle" type="text" required placeholder="Ex: Loyer Mars 2025" className="w-full px-4 py-3 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl outline-none focus:ring-2 focus:ring-dia-red/20" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 px-1">Montant (FCFA)</label>
                    <input name="amount" type="number" required placeholder="0" className="w-full px-4 py-3 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl outline-none focus:ring-2 focus:ring-dia-red/20 font-black" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 px-1">Date</label>
                    <input name="date" type="date" className="w-full px-4 py-3 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl outline-none focus:ring-2 focus:ring-dia-red/20" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 px-1">Catégorie</label>
                  <select name="category" className="w-full px-4 py-3 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl outline-none focus:ring-2 focus:ring-dia-red/20 font-bold appearance-none">
                    <option value="divers">Divers</option>
                    <option value="loyer">Loyer</option>
                    <option value="internet">Connexion Internet</option>
                    <option value="electricite">Électricité / Eau</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 px-1">Notes (Optionnel)</label>
                  <textarea name="notes" className="w-full px-4 py-3 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl outline-none focus:ring-2 focus:ring-dia-red/20 h-24 resize-none" />
                </div>
                <div className="pt-4 flex gap-3">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-3 text-xs font-black uppercase tracking-widest text-neutral-400 hover:text-neutral-600">Annuler</button>
                  <button type="submit" className="flex-[2] btn-primary py-3">Enregistrer</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

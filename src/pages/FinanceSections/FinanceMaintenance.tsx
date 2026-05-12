import React, { useState } from 'react';
import { ShieldAlert, RefreshCw, Trash2, Database, CheckCircle2, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { toast } from 'sonner';
import { motion } from 'motion/react';
import { cn } from '../../utils';

export default function FinanceMaintenance() {
  const { fetchWithAuth, user } = useAuth();
  const { refreshAll } = useData();
  const [running, setRunning] = useState<string | null>(null);
  const [resetConfirm, setResetConfirm] = useState('');
  const [showResetModal, setShowResetModal] = useState(false);

  const isSuperAdmin = user?.email === 'yombivictor@gmail.com' || user?.email === 'gabrielyombi311@gmail.com';

  const runTool = async (endpoint: string, toolName: string, body: any = {}) => {
    setRunning(toolName);
    try {
      const res = await fetchWithAuth(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || `${toolName} terminé avec succès`);
        refreshAll(true);
      } else {
        toast.error(data.message || `Erreur lors de l'exécution de ${toolName}`);
      }
    } catch (err) {
      toast.error("Erreur réseau");
    } finally {
      setRunning(null);
    }
  };

  const handleHeavyReset = async () => {
    if (resetConfirm !== 'CONFIRMER') {
      toast.error("Veuillez saisir 'CONFIRMER' pour valider");
      return;
    }
    await runTool('/api/maintenance/heavy-reset', 'Reset Complet', { confirmation: 'CONFIRMER' });
    setShowResetModal(false);
    setResetConfirm('');
  };

  if (!isSuperAdmin) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <ShieldAlert size={64} className="text-neutral-300 mb-4" />
        <h2 className="text-2xl font-black text-neutral-900 dark:text-white uppercase">Accès Restreint</h2>
        <p className="text-neutral-500 font-bold uppercase text-sm mt-2">Cette zone est réservée aux Super Administrateurs</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-4 mb-8">
        <div className="p-4 bg-dia-red text-white rounded-[1.5rem] shadow-xl shadow-dia-red/20">
          <Database size={32} />
        </div>
        <div>
          <h2 className="text-3xl font-black text-neutral-900 dark:text-white uppercase tracking-tight">Outils de Maintenance</h2>
          <p className="text-neutral-500 font-bold uppercase text-sm">Gestion de l'intégrité et reset de la base</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Tool 1: Recalculate */}
        <motion.div whileHover={{ y: -5 }} className="bg-white dark:bg-neutral-900 p-8 rounded-[2.5rem] border-2 border-neutral-100 dark:border-neutral-800 shadow-sm">
          <div className="flex items-start justify-between mb-6">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
              <RefreshCw size={24} className={running === 'Recalcul' ? 'animate-spin' : ''} />
            </div>
            <button 
              onClick={() => runTool('/api/finances/recalculate', 'Recalcul')}
              disabled={!!running}
              className="btn-primary py-2 px-6 rounded-xl hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
            >
              Exécuter
            </button>
          </div>
          <h3 className="text-xl font-black text-neutral-900 dark:text-white uppercase mb-2">Recalculer les Soldes</h3>
          <p className="text-sm font-bold text-neutral-500 uppercase leading-relaxed">
            Synchronise les comptes Caisse et Banque avec l'historique complet des transactions (transactions collection).
          </p>
        </motion.div>

        {/* Tool 4: Integrity Check */}
        <motion.div whileHover={{ y: -5 }} className="bg-white dark:bg-neutral-900 p-8 rounded-[2.5rem] border-2 border-neutral-100 dark:border-neutral-800 shadow-sm">
          <div className="flex items-start justify-between mb-6">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
              <CheckCircle2 size={24} />
            </div>
            <button 
              onClick={() => runTool('/api/finances/integrity', 'Intégrité', { fix: true })}
              disabled={!!running}
              className="btn-primary py-2 px-6 rounded-xl hover:scale-105 active:scale-95 transition-all bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50"
            >
              Réparer
            </button>
          </div>
          <h3 className="text-xl font-black text-neutral-900 dark:text-white uppercase mb-2">Intégrité des Scolarités</h3>
          <p className="text-sm font-bold text-neutral-500 uppercase leading-relaxed">
            Vérifie la cohérence entre les versements et le total affiché sur les fiches de scolarité/vorbereitung.
          </p>
        </motion.div>

        {/* Tool 2: Cleanup Orphans */}
        <motion.div whileHover={{ y: -5 }} className="bg-white dark:bg-neutral-900 p-8 rounded-[2.5rem] border-2 border-neutral-100 dark:border-neutral-800 shadow-sm">
          <div className="flex items-start justify-between mb-6">
            <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl">
              <Trash2 size={24} />
            </div>
            <button 
              onClick={() => runTool('/api/finances/cleanup-orphans', 'Cleanup', { action: 'delete' })}
              disabled={!!running}
              className="btn-primary py-2 px-6 rounded-xl hover:scale-105 active:scale-95 transition-all bg-amber-600 hover:bg-amber-700 disabled:opacity-50"
            >
              Nettoyer
            </button>
          </div>
          <h3 className="text-xl font-black text-neutral-900 dark:text-white uppercase mb-2">Nettoyer les Orphelins</h3>
          <p className="text-sm font-bold text-neutral-500 uppercase leading-relaxed">
            Supprime les transactions liées à des étudiants qui n'existent plus dans la base de données.
          </p>
        </motion.div>

        {/* Tool: Reset Nuclear */}
        <motion.div whileHover={{ y: -5 }} className="bg-dia-red/5 p-8 rounded-[2.5rem] border-2 border-dia-red/20 border-dashed shadow-sm">
          <div className="flex items-start justify-between mb-6">
            <div className="p-3 bg-dia-red text-white rounded-2xl">
              <ShieldAlert size={24} />
            </div>
            <button 
              onClick={() => setShowResetModal(true)}
              disabled={!!running}
              className="btn-primary py-2 px-6 rounded-xl hover:scale-105 active:scale-95 transition-all bg-dia-red hover:bg-dia-red/90 disabled:opacity-50"
            >
              RESET NUCLEAR
            </button>
          </div>
          <h3 className="text-xl font-black text-dia-red uppercase mb-1">Reset Complet Phase 0</h3>
          <p className="text-sm font-bold text-dia-red/60 uppercase leading-relaxed">
            ATTENTION: Efface TOUTES les données financières. Action irréversible.
          </p>
        </motion.div>
      </div>

      {/* Reset Modal */}
      {showResetModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white dark:bg-neutral-900 w-full max-w-md p-8 rounded-[2.5rem] shadow-2xl space-y-6"
          >
            <div className="flex items-center gap-3 text-dia-red mb-2">
              <AlertCircle size={32} />
              <h4 className="text-2xl font-black uppercase">Confirmation</h4>
            </div>
            <p className="text-neutral-500 font-bold uppercase text-sm leading-relaxed">
              Vous êtes sur le point de réinitialiser intégralement la base financière. 
              Tapez <span className="text-dia-red font-black">CONFIRMER</span> ci-dessous pour procéder.
            </p>
            <input 
              type="text" 
              value={resetConfirm}
              onChange={(e) => setResetConfirm(e.target.value)}
              className="w-full p-4 bg-neutral-100 dark:bg-neutral-800 rounded-2xl font-black text-center focus:ring-2 focus:ring-dia-red outline-none border-none"
              placeholder="Taper CONFIRMER"
            />
            <div className="flex gap-3">
              <button onClick={() => setShowResetModal(false)} className="flex-1 p-4 bg-neutral-100 dark:bg-neutral-800 text-neutral-400 font-black rounded-2xl hover:bg-neutral-200 transition-colors uppercase">Annuler</button>
              <button 
                onClick={handleHeavyReset}
                disabled={resetConfirm !== 'CONFIRMER' || !!running}
                className="flex-1 p-4 bg-dia-red text-white font-black rounded-2xl hover:bg-dia-red/90 disabled:opacity-30 transition-all uppercase"
              >
                Reset Final
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

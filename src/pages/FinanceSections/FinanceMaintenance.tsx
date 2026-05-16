import React, { useState } from 'react';
import { ShieldAlert, RefreshCw, Trash2, Database, CheckCircle2, AlertCircle, BookOpen } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { toast } from 'sonner';
import { motion } from 'motion/react';
import { cn } from '../../utils';
import { db } from '../../firebase';
import { collection, query, where, getDocs, getDoc, doc, setDoc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { corrigerMontantsDu } from '../../utils/finance';

export default function FinanceMaintenance() {
  const { fetchWithAuth, user, profile } = useAuth();
  const { refreshAll, levels } = useData();
  const [running, setRunning] = useState<string | null>(null);

  const cleanupVorbereitung = async () => {
    if (!window.confirm("Voulez-vous réinitialiser les tarifs fixes Vorbereitung dans la liste des niveaux ?")) return;
    setRunning('VorbCleanup');
    try {
      // Trouver tous les documents Vorbereitung dans /niveaux
      const q1 = query(collection(db, 'niveaux'), where('nom', '==', 'Vorbereitung'));
      const q2 = query(collection(db, 'niveaux'), where('name', '==', 'Vorbereitung'));
      const q3 = query(collection(db, 'niveaux'), where('type', '==', 'vorbereitung'));
      
      const [s1, s2, s3] = await Promise.all([getDocs(q1), getDocs(q2), getDocs(q3)]);
      
      const batch = writeBatch(db);
      const traites = new Set();

      const addUpdate = (d: any) => {
        if (traites.has(d.id)) return;
        traites.add(d.id);
        batch.update(d.ref, {
          frais_scolarite: null,
          tuition: null,
          nb_heures_total: null,
          hours: null,
          type: 'vorbereitung',
          tarif_variable: true,
          quota_variable: true,
          description: 'Préparation intensive aux examens — montant et durée variables selon la session',
          updated_at: serverTimestamp()
        });
      };

      s1.docs.forEach(addUpdate);
      s2.docs.forEach(addUpdate);
      s3.docs.forEach(addUpdate);

      if (traites.size > 0) {
        await batch.commit();
        toast.success(`${traites.size} document(s) Vorbereitung réinitialisés !`);
        refreshAll(true);
      } else {
        toast.error("Aucun document Vorbereitung trouvé.");
      }
    } catch (e) {
      console.error(e);
      toast.error("Erreur nettoyage");
    } finally {
      setRunning(null);
    }
  };

  const migrerVorbereitung = async () => {
    if (!window.confirm("Voulez-vous corriger tous les frais Vorbereitung bloqués à 50.000 FCFA ?")) return;
    setRunning('VorbMigration');
    try {
      const q = query(collection(db, 'vorbereitung'), where('montant_total_du', '==', 50000));
      const snap = await getDocs(q);
      let count = 0;
      for (const d of snap.docs) {
        const studentDoc = await getDoc(doc(db, 'students', d.id));
        if (studentDoc.exists()) {
          const lId = studentDoc.data().levelId;
          const level = (levels || []).find(l => l.id === lId);
          const realDue = level?.frais_vorbereitung_defaut || 0;
          await setDoc(doc(db, 'vorbereitung', d.id), { montant_total_du: realDue }, { merge: true });
          count++;
        }
      }
      toast.success(`${count} fiches Vorbereitung corrigées !`);
      refreshAll(true);
    } catch (e) {
      console.error(e);
      toast.error("Erreur lors de la migration");
    } finally {
      setRunning(null);
    }
  };
  const [resetConfirm, setResetConfirm] = useState('');
  const [showResetModal, setShowResetModal] = useState(false);

  const isSuperAdmin = (profile as any)?.isSuperAdmin || 
                       (user as any)?.isSuperAdmin || 
                       user?.email === 'yombivictor@gmail.com' || 
                       user?.email === 'gabrielyombi311@gmail.com';

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

  const handleCorrigerMontants = async () => {
    if (!window.confirm("🔧 Voulez-vous recalculer et corriger les montants dus de TOUS les étudiants d'après les tarifs de leurs niveaux ?")) return;
    setRunning('CorrigerMontants');
    try {
      await corrigerMontantsDu();
      toast.success("Correction des montants effectuée !");
      refreshAll(true);
    } catch (e) {
      toast.error("Erreur lors de la correction");
    } finally {
      setRunning(null);
    }
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
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
              <RefreshCw size={24} className={running === 'SyncModules' ? 'animate-spin' : ''} />
            </div>
            <button 
              onClick={() => runTool('/api/maintenance/sync-modules', 'SyncModules')}
              disabled={!!running}
              className="btn-primary py-2 px-6 rounded-xl hover:scale-105 active:scale-95 transition-all bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
            >
              Sync
            </button>
          </div>
          <h3 className="text-xl font-black text-neutral-900 dark:text-white uppercase mb-2">Sync Modules</h3>
          <p className="text-sm font-bold text-neutral-500 uppercase leading-relaxed">
            Recalcule les paiements d'après le grand livre pour Scolarité, Vorbereitung et Cours de Vacances.
          </p>
        </motion.div>

        {/* Tool 4: Integrity Check (Existing) */}
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

        {/* Tool: Correction Montants Dus Globale */}
        <motion.div whileHover={{ y: -5 }} className="bg-indigo-500/5 p-8 rounded-[2.5rem] border-2 border-indigo-500/20 border-dashed shadow-sm">
          <div className="flex items-start justify-between mb-6">
            <div className="p-3 bg-indigo-600 text-white rounded-2xl">
              <RefreshCw size={24} className={running === 'CorrigerMontants' ? 'animate-spin' : ''} />
            </div>
            <button 
              onClick={handleCorrigerMontants}
              disabled={!!running}
              className="btn-primary py-2 px-6 rounded-xl hover:scale-105 active:scale-95 transition-all bg-indigo-700 hover:bg-indigo-800 disabled:opacity-50"
            >
              CORRIGER DUS
            </button>
          </div>
          <h3 className="text-xl font-black text-indigo-700 uppercase mb-1">Recalculer Dûs</h3>
          <p className="text-sm font-bold text-indigo-700/60 uppercase leading-relaxed">
            Force le recalcul de tous les restes à payer d'après la scolarité réelle paramétrée par niveau.
          </p>
        </motion.div>

        {/* Tool: Nettoyage Vorbereitung (Cycles) */}
        <motion.div whileHover={{ y: -5 }} className="bg-orange-500/5 p-8 rounded-[2.5rem] border-2 border-orange-500/20 shadow-sm">
          <div className="flex items-start justify-between mb-6">
            <div className="p-3 bg-orange-600 text-white rounded-2xl">
              <BookOpen size={24} className={running === 'VorbCleanup' ? 'animate-spin' : ''} />
            </div>
            <button 
              onClick={cleanupVorbereitung}
              disabled={!!running}
              className="btn-primary py-2 px-6 rounded-xl hover:scale-105 active:scale-95 transition-all bg-orange-700 hover:bg-orange-800 disabled:opacity-50"
            >
              NETTOYER VORB
            </button>
          </div>
          <h3 className="text-xl font-black text-orange-700 uppercase mb-1">Nettoyage Cycles</h3>
          <p className="text-sm font-bold text-orange-700/60 uppercase leading-relaxed">
            Supprime les tarifs fixes du niveau Vorbereitung pour le passer en mode montant variable.
          </p>
        </motion.div>

        {/* Tool: Correction 50k Vorbereitung */}
        <motion.div whileHover={{ y: -5 }} className="bg-amber-500/5 p-8 rounded-[2.5rem] border-2 border-amber-500/20 border-dashed shadow-sm">
          <div className="flex items-start justify-between mb-6">
            <div className="p-3 bg-amber-500 text-white rounded-2xl">
              <RefreshCw size={24} className={running === 'VorbMigration' ? 'animate-spin' : ''} />
            </div>
            <button 
              onClick={migrerVorbereitung}
              disabled={!!running}
              className="btn-primary py-2 px-6 rounded-xl hover:scale-105 active:scale-95 transition-all bg-amber-600 hover:bg-amber-700 disabled:opacity-50"
            >
              MIGRER VORB
            </button>
          </div>
          <h3 className="text-xl font-black text-amber-600 uppercase mb-1">Correction Bug 50k</h3>
          <p className="text-sm font-bold text-amber-600/60 uppercase leading-relaxed">
            Corrige les objectifs Vorbereitung bloqués sur l'ancienne valeur fixe par défaut.
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

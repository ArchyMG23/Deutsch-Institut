import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  Activity, 
  Clock, 
  Banknote,
  BookOpen,
  ArrowRight,
  ChevronRight,
  Filter
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { Level } from '../types';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { cn } from '../utils';

export default function LevelManagement() {
  const { fetchWithAuth } = useAuth();
  const { levels, refreshLevels } = useData();
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLevel, setEditingLevel] = useState<Level | null>(null);
  const [formData, setFormData] = useState<Partial<Level>>({
    name: '',
    tuition: 0,
    hours: 60,
    stream: 'Allemand'
  });

  useEffect(() => {
    loadLevels();
  }, []);

  const loadLevels = async () => {
    setLoading(true);
    await refreshLevels();
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingLevel ? `/api/levels/${editingLevel.id}` : '/api/levels';
      const method = editingLevel ? 'PUT' : 'POST';
      
      const isVorb = isVorbereitung(editingLevel || ({} as Level) || { name: formData.name });

      const finalData = {
        ...formData,
        nom: formData.name,
        frais_scolarite: isVorb ? null : formData.tuition,
        tuition: isVorb ? null : formData.tuition,
        nb_heures_total: isVorb ? null : formData.hours,
        hours: isVorb ? null : formData.hours,
        type: isVorb ? 'vorbereitung' : 'standard',
        tarif_variable: isVorb,
        quota_variable: isVorb,
        cycle: (formData.stream || 'Allemand').toLowerCase(),
        actif: true,
        ordre: levels.length + 1,
        frais_examen: 0,
        paiement_fractionnable: true,
        nb_fractions_max: null,
        taux_horaire_salle: 0,
        duree_seance_standard: 0,
        nb_seances_par_semaine: 0,
        capacite_max: 30,
        seuil_ouverture: 1,
        vorbereitung_disponible: false,
        vacances_disponible: false
      };
      
      await fetchWithAuth(url, {
        method,
        body: JSON.stringify(finalData)
      });

      toast.success(editingLevel ? 'Niveau mis à jour' : 'Niveau créé');
      setIsModalOpen(false);
      setEditingLevel(null);
      setFormData({ name: '', tuition: 0, hours: 60, stream: 'Allemand' });
      loadLevels();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Voulez-vous vraiment supprimer ce niveau ?')) return;
    try {
      await fetchWithAuth(`/api/levels/${id}`, { method: 'DELETE' });
      toast.success('Niveau supprimé');
      loadLevels();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const filteredLevels = levels.filter(l => 
    l.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    l.stream?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const isVorbereitung = (level: Level) => {
    return (
      level.type === 'vorbereitung' ||
      (level.name || level.nom || '').toLowerCase().includes('vorbereitung') ||
      (level as any).tarif_variable === true
    );
  };

  return (
    <div className="p-4 md:p-8 space-y-8 max-w-7xl mx-auto">
      {/* ... (Header Section remains same) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black tracking-tight flex items-center gap-3">
            <span className="p-3 bg-dia-red rounded-2xl text-white shadow-lg shadow-dia-red/20">
              <BookOpen className="w-8 h-8" />
            </span>
            Gestion des Niveaux
          </h1>
          <p className="mt-2 text-neutral-500 font-medium">Configurez les cursus, tarifs et quotas horaires.</p>
        </div>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => {
            setEditingLevel(null);
            setFormData({ name: '', tuition: 0, hours: 60, stream: 'Allemand' });
            setIsModalOpen(true);
          }}
          className="flex items-center justify-center gap-2 px-6 py-4 bg-dia-red text-white rounded-2xl font-black shadow-xl shadow-dia-red/30 hover:bg-dia-red-dark transition-all"
        >
          <Plus className="w-5 h-5" />
          Ajouter un Cursus
        </motion.button>
      </div>

      {/* Search & Stats Bar */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-3 h-14 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl flex items-center px-4 gap-3 focus-within:ring-2 focus-within:ring-dia-red/20 transition-all">
          <Search className="w-5 h-5 text-neutral-400" />
          <input
            type="text"
            placeholder="Rechercher un niveau, cycle..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 bg-transparent border-none outline-none text-sm font-bold"
          />
          <Filter className="w-5 h-5 text-neutral-400 cursor-pointer hover:text-dia-red transition-colors" />
        </div>
        <div className="bg-amber-100 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/40 rounded-2xl flex items-center justify-center gap-3 px-4">
          <Activity className="w-5 h-5 text-amber-600" />
          <span className="text-sm font-black text-amber-900 dark:text-amber-400">
            {levels.length} Cursus Actifs
          </span>
        </div>
      </div>

      {/* Levels Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <AnimatePresence mode='popLayout'>
          {filteredLevels.map((level, idx) => {
            const isVorb = isVorbereitung(level);
            return (
              <motion.div
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: idx * 0.05 }}
                key={level.id}
                className={cn(
                  "group bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 hover:shadow-2xl hover:shadow-dia-red/10 transition-all duration-300 relative overflow-hidden",
                  isVorb ? "border-orange-500/20 bg-orange-50/10 dark:bg-orange-950/5 border-dashed" : "hover:border-dia-red/30"
                )}
              >
                {/* Card Badge */}
                <div className={`absolute top-4 right-4 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                  level.stream === 'Allemand' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                }`}>
                  {level.stream}
                </div>

                <div className="space-y-6">
                  <div className="space-y-1">
                    <h3 className="text-2xl font-black text-neutral-900 dark:text-white group-hover:text-dia-red transition-colors">
                      {level.name || level.nom}
                    </h3>
                    <div className="flex items-center gap-3 text-neutral-400">
                      <span className="text-[10px] font-bold uppercase tracking-widest">{level.id}</span>
                    </div>
                  </div>

                  {isVorb ? (
                    /* SPECIAL VORBEREITUNG VIEW */
                    <div className="space-y-3">
                      <div className="flex items-start gap-3 p-4 bg-orange-100/30 dark:bg-orange-500/5 rounded-2xl border border-orange-500/10 border-dashed">
                        <div className="p-2 bg-orange-500 text-white rounded-xl">
                          <Banknote className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-[10px] font-black uppercase text-orange-600/60 leading-none mb-1">Tarif</p>
                          <p className="text-xl font-black text-orange-600">Variable</p>
                          <p className="text-[10px] font-bold text-neutral-400">Saisi à chaque versement</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3 p-4 bg-orange-100/30 dark:bg-orange-500/5 rounded-2xl border border-orange-500/10 border-dashed">
                        <div className="p-2 bg-orange-500 text-white rounded-xl">
                          <Clock className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-[10px] font-black uppercase text-orange-600/60 leading-none mb-1">Durée</p>
                          <p className="text-xl font-black text-orange-600">Variable</p>
                          <p className="text-[10px] font-bold text-neutral-400">Selon la session d'examen</p>
                        </div>
                      </div>
                      <div className="p-3 bg-orange-500/10 rounded-xl text-center">
                        <p className="text-[11px] font-black text-orange-700 uppercase">🎯 Préparation intensive B1/B2/C1</p>
                      </div>
                    </div>
                  ) : (
                    /* STANDARD LEVEL VIEW */
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-neutral-50 dark:bg-neutral-800/50 p-4 rounded-2xl border border-neutral-100 dark:border-neutral-800">
                        <div className="flex items-center gap-2 text-neutral-500 mb-1">
                          <Banknote className="w-3.5 h-3.5" />
                          <span className="text-[9px] font-black uppercase">Tarif</span>
                        </div>
                        <div className="text-lg font-black text-neutral-900 dark:text-white">
                          {(level.tuition || level.frais_scolarite || 0).toLocaleString()} <span className="text-xs">FCFA</span>
                        </div>
                      </div>
                      <div className="bg-neutral-50 dark:bg-neutral-800/50 p-4 rounded-2xl border border-neutral-100 dark:border-neutral-800">
                        <div className="flex items-center gap-2 text-neutral-500 mb-1">
                          <Clock className="w-3.5 h-3.5" />
                          <span className="text-[9px] font-black uppercase">Quota</span>
                        </div>
                        <div className="text-lg font-black text-neutral-900 dark:text-white">
                          {level.hours || level.nb_heures_total || 0} <span className="text-xs">Hrs</span>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-4 border-t border-neutral-100 dark:border-neutral-800">
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setEditingLevel(level);
                          setFormData({
                            name: level.name || level.nom,
                            tuition: level.tuition || level.frais_scolarite || 0,
                            hours: level.hours || level.nb_heures_total || 0,
                            stream: (level.stream || level.cycle || 'Allemand') as any
                          });
                          setIsModalOpen(true);
                        }}
                        className="p-3 bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 rounded-xl hover:bg-dia-red hover:text-white transition-all font-bold"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(level.id)}
                        className="p-3 bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 rounded-xl hover:bg-red-600 hover:text-white transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <motion.div
                      whileHover={{ x: 5 }}
                      className="flex items-center gap-2 text-dia-red font-black text-xs cursor-pointer"
                    >
                      Details <ChevronRight className="w-4 h-4" />
                    </motion.div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Level Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-neutral-900/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-lg bg-white dark:bg-neutral-900 rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <div className="p-8 space-y-6">
                <div className="space-y-1">
                  <h2 className="text-3xl font-black tracking-tighter">
                    {editingLevel ? 'Modifier le Cursus' : 'Nouveau Cursus'}
                  </h2>
                  <p className="text-neutral-500 font-medium">Définissez les paramètres de cet enseignement.</p>
                </div>

                    <form onSubmit={handleSubmit} className="space-y-5">
                      {isVorbereitung(editingLevel || ({} as Level)) && (
                        <div className="p-4 bg-orange-100/50 dark:bg-orange-500/10 border-2 border-orange-500/20 border-dashed rounded-2xl flex gap-3 text-orange-800 dark:text-orange-400">
                          <Banknote className="shrink-0" />
                          <p className="text-xs font-bold leading-tight uppercase tracking-tight">
                            Mode Variable Activé : Le Vorbereitung n'a pas de tarif ni de durée fixes. 
                            Le montant est saisi librement à chaque versement.
                          </p>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2 space-y-2">
                          <label className="text-[10px] font-black uppercase text-neutral-400 ml-4">Nom du Niveau</label>
                          <input
                            type="text"
                            required
                            placeholder="Ex: A1, B2 Intense..."
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="w-full px-6 py-4 bg-neutral-50 dark:bg-neutral-800 border-none rounded-2xl font-bold focus:ring-2 focus:ring-dia-red/20 transition-all outline-none"
                          />
                        </div>

                        {!isVorbereitung(editingLevel || ({} as Level)) && (
                          <>
                            <div className="space-y-2">
                              <label className="text-[10px] font-black uppercase text-neutral-400 ml-4">Tarif Scolarité</label>
                              <input
                                type="number"
                                required
                                value={formData.tuition}
                                onChange={(e) => setFormData({ ...formData, tuition: Number(e.target.value) })}
                                className="w-full px-6 py-4 bg-neutral-50 dark:bg-neutral-800 border-none rounded-2xl font-bold focus:ring-2 focus:ring-dia-red/20 transition-all outline-none"
                              />
                            </div>

                            <div className="space-y-2">
                              <label className="text-[10px] font-black uppercase text-neutral-400 ml-4">Volume Horaire</label>
                              <input
                                type="number"
                                required
                                value={formData.hours}
                                onChange={(e) => setFormData({ ...formData, hours: Number(e.target.value) })}
                                className="w-full px-6 py-4 bg-neutral-50 dark:bg-neutral-800 border-none rounded-2xl font-bold focus:ring-2 focus:ring-dia-red/20 transition-all outline-none"
                              />
                            </div>
                          </>
                        )}

                        <div className="col-span-2 space-y-2">
                          <label className="text-[10px] font-black uppercase text-neutral-400 ml-4">Cycle / Filière</label>
                          <select
                            value={formData.stream}
                            onChange={(e) => setFormData({ ...formData, stream: e.target.value as any })}
                            className="w-full px-6 py-4 bg-neutral-50 dark:bg-neutral-800 border-none rounded-2xl font-bold focus:ring-2 focus:ring-dia-red/20 transition-all outline-none appearance-none cursor-pointer"
                          >
                            <option value="Allemand">Allemand</option>
                            <option value="Anglais">Anglais</option>
                          </select>
                        </div>
                      </div>

                      <div className="flex gap-3 pt-4">
                        <button
                          type="button"
                          onClick={() => setIsModalOpen(false)}
                          className="flex-1 py-4 bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 rounded-2xl font-black hover:bg-neutral-200 transition-all"
                        >
                          Annuler
                        </button>
                        <button
                          type="submit"
                          className="flex-1 py-4 bg-dia-red text-white rounded-2xl font-black shadow-lg shadow-dia-red/20 hover:bg-dia-red-dark transition-all flex items-center justify-center gap-2"
                        >
                          {editingLevel ? 'Sauvegarder' : 'Créer le Niveau'}
                          <ArrowRight className="w-5 h-5" />
                        </button>
                      </div>
                    </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

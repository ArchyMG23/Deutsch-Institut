import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Plus, 
  X, 
  Edit2, 
  Trash2, 
  Layers,
  Clock,
  Wallet,
  ChevronUp,
  ChevronDown,
  Search
} from 'lucide-react';
import { Level } from '../types';
import { formatCurrency } from '../utils';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { toast } from 'sonner';

export default function LevelManagement() {
  const { t } = useTranslation();
  const { fetchWithAuth } = useAuth();
  const { levels, loading, refreshLevels } = useData();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingLevel, setEditingLevel] = useState<Level | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>({ key: 'name', direction: 'asc' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    refreshLevels();
  }, [refreshLevels]);

  const handleAddLevel = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    
    const formData = new FormData(e.currentTarget);
    
    const newLevel = {
      name: formData.get('name'),
      tuition: Number(formData.get('tuition')),
      hours: Number(formData.get('hours')),
    };

    try {
      const res = await fetchWithAuth('/api/levels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newLevel)
      });
      if (res.ok) {
        setIsAddModalOpen(false);
        refreshLevels();
        toast.success(t('levels.level_added'));
      } else {
        const errorData = await res.json();
        toast.error(errorData.message || t('common.error'));
      }
    } catch (err) {
      console.error("Error adding level:", err);
      toast.error(t('common.error'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditLevel = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingLevel) return;
    const formData = new FormData(e.currentTarget);
    
    const updatedLevel = {
      name: formData.get('name'),
      tuition: Number(formData.get('tuition')),
      hours: Number(formData.get('hours')),
    };

    setSubmitting(true);
    try {
      const res = await fetchWithAuth(`/api/levels/${editingLevel.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedLevel)
      });
      if (res.ok) {
        setEditingLevel(null);
        refreshLevels();
        toast.success(t('levels.level_updated'));
      } else {
        const errorData = await res.json();
        toast.error(errorData.message || t('common.error'));
      }
    } catch (err) {
      console.error("Error editing level:", err);
      toast.error(t('common.error'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteLevel = async (id: string) => {
    if (!window.confirm(t('levels.confirm_delete'))) return;
    try {
      const res = await fetchWithAuth(`/api/levels/${id}`, { method: 'DELETE' });
      if (res.ok) {
        refreshLevels();
        toast.success(t('levels.level_deleted'));
      }
    } catch (err) {
      console.error("Error deleting level:", err);
    }
  };

  const filteredLevels = levels.filter(l => 
    l.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const sortedLevels = [...filteredLevels].sort((a, b) => {
    if (!sortConfig) return 0;
    const { key, direction } = sortConfig;
    
    let aValue: any = (a as any)[key];
    let bValue: any = (b as any)[key];

    if (typeof aValue === 'string') {
      aValue = aValue.toLowerCase();
      bValue = bValue.toLowerCase();
    }

    if (aValue < bValue) return direction === 'asc' ? -1 : 1;
    if (aValue > bValue) return direction === 'asc' ? 1 : -1;
    return 0;
  });

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h3 className="text-xl font-bold">{t('levels.title')}</h3>
        <button 
          onClick={() => setIsAddModalOpen(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus size={18} />
          <span>{t('levels.add_level')}</span>
        </button>
      </div>

      <div className="card p-4 flex flex-col sm:flex-row gap-4 items-center">
        <div className="relative group flex-1">
          <input 
            type="text" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('classes.search_placeholder')}
            className="w-full pl-10 pr-4 py-2 bg-neutral-100 dark:bg-neutral-800 border-none rounded-lg focus:ring-2 focus:ring-dia-red transition-all"
          />
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 group-focus-within:text-dia-red transition-colors pointer-events-none z-10" size={18} />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-neutral-400 uppercase">{t('common.sort_by')}:</span>
          <select 
            value={sortConfig?.key || ''} 
            onChange={(e) => handleSort(e.target.value)}
            className="bg-neutral-100 dark:bg-neutral-800 border-none rounded-lg px-3 py-2 text-sm font-bold focus:ring-2 focus:ring-dia-red outline-none"
          >
            <option value="name">{t('common.name')}</option>
            <option value="tuition">{t('sidebar.finances')}</option>
            <option value="hours">{t('levels.hours')}</option>
          </select>
          <button 
            onClick={() => handleSort(sortConfig?.key || 'name')}
            className="p-2 bg-neutral-100 dark:bg-neutral-800 rounded-lg hover:bg-neutral-200 transition-colors"
          >
            {sortConfig?.direction === 'asc' ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {sortedLevels.map((level) => (
          <div key={level.id} className="card p-6 group hover:shadow-xl transition-all border-dia-red/0 hover:border-dia-red/20 border">
            <div className="flex justify-between items-start mb-4">
              <div className="w-12 h-12 rounded-2xl bg-dia-red/10 text-dia-red flex items-center justify-center">
                <Layers size={24} />
              </div>
              <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button 
                  onClick={() => setEditingLevel(level)}
                  className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-all"
                >
                  <Edit2 size={16} className="text-neutral-500" />
                </button>
                <button 
                  onClick={() => handleDeleteLevel(level.id)}
                  className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
                >
                  <Trash2 size={16} className="text-red-600" />
                </button>
              </div>
            </div>
            
            <h4 className="text-2xl font-bold mb-4">{level.name}</h4>
            
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <Wallet size={16} className="text-neutral-400" />
                <span className="font-medium">{formatCurrency(level.tuition)}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Clock size={16} className="text-neutral-400" />
                <span className="font-medium">{level.hours} {t('levels.hours')}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add Level Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-neutral-900 w-full max-w-md rounded-[32px] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-8 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
              <h3 className="text-2xl font-bold tracking-tight">{t('levels.add_level')}</h3>
              <button onClick={() => setIsAddModalOpen(false)} className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition-colors">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleAddLevel} className="p-8 space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">{t('levels.name')}</label>
                  <input name="name" required type="text" className="w-full px-5 py-3 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-2xl focus:ring-2 focus:ring-dia-red/20 focus:border-dia-red outline-none transition-all" />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">{t('levels.price')}</label>
                  <input name="tuition" required type="number" className="w-full px-5 py-3 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-2xl focus:ring-2 focus:ring-dia-red/20 focus:border-dia-red outline-none transition-all" />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">{t('levels.hours')}</label>
                  <input name="hours" required type="number" className="w-full px-5 py-3 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-2xl focus:ring-2 focus:ring-dia-red/20 focus:border-dia-red outline-none transition-all" />
                </div>
              </div>
              <div className="pt-4 flex gap-4">
                <button type="button" onClick={() => setIsAddModalOpen(false)} className="flex-1 px-6 py-4 bg-neutral-100 dark:bg-neutral-800 rounded-2xl font-bold transition-all hover:bg-neutral-200">{t('common.cancel')}</button>
                <button 
                  type="submit" 
                  disabled={submitting}
                  className="flex-1 btn-primary py-4 flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-white/30 border-t-white"></div>
                      {t('classes.creating')}
                    </>
                  ) : (
                    t('common.submit')
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Level Modal */}
      {editingLevel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-neutral-900 w-full max-w-md rounded-[32px] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-8 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
              <h3 className="text-2xl font-bold tracking-tight">{t('common.edit')}</h3>
              <button onClick={() => setEditingLevel(null)} className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition-colors">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleEditLevel} className="p-8 space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">{t('levels.name')}</label>
                  <input name="name" defaultValue={editingLevel.name} required type="text" className="w-full px-5 py-3 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-2xl focus:ring-2 focus:ring-dia-red/20 focus:border-dia-red outline-none transition-all" />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">{t('levels.price')}</label>
                  <input name="tuition" defaultValue={editingLevel.tuition} required type="number" className="w-full px-5 py-3 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-2xl focus:ring-2 focus:ring-dia-red/20 focus:border-dia-red outline-none transition-all" />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">{t('levels.hours')}</label>
                  <input name="hours" defaultValue={editingLevel.hours} required type="number" className="w-full px-5 py-3 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-2xl focus:ring-2 focus:ring-dia-red/20 focus:border-dia-red outline-none transition-all" />
                </div>
              </div>
              <div className="pt-4 flex gap-4">
                <button type="button" onClick={() => setEditingLevel(null)} className="flex-1 px-6 py-4 bg-neutral-100 dark:bg-neutral-800 rounded-2xl font-bold transition-all hover:bg-neutral-200">{t('common.cancel')}</button>
                <button 
                  type="submit" 
                  disabled={submitting}
                  className="flex-1 btn-primary py-4 flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-white/30 border-t-white"></div>
                      {t('common.updating')}
                    </>
                  ) : (
                    t('common.save')
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Plus, 
  X, 
  Book, 
  Download, 
  Trash2, 
  FileText,
  Upload,
  Filter,
  Youtube,
  FileArchive,
  Link as LinkIcon,
  ChevronUp,
  ChevronDown
} from 'lucide-react';
import { cn } from '../utils';
import { LibraryItem } from '../types';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { toast } from 'sonner';

export default function LibraryManagement() {
  const { profile, fetchWithAuth } = useAuth();
  const { library: items, loading, refreshLibrary } = useData();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [addMethod, setAddMethod] = useState<'link' | 'file'>('file');
  const [submitting, setSubmitting] = useState(false);

  const isAdmin = profile?.role === 'admin';
  const canManage = isAdmin; // We can expand this later if needed

  useEffect(() => {
    refreshLibrary();
  }, [refreshLibrary]);

  const handleAddItem = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!canManage || submitting) return;
    setSubmitting(true);
    const formData = new FormData(e.currentTarget);
    
    try {
      if (addMethod === 'file') {
        const file = formData.get('file') as File;
        if (!file || file.size === 0) {
          toast.error('Veuillez sélectionner un fichier');
          setSubmitting(false);
          return;
        }
        
        const uploadData = new FormData();
        uploadData.append('file', file);
        uploadData.append('title', formData.get('title') as string);
        uploadData.append('category', formData.get('category') as string);
        uploadData.append('type', formData.get('type') as string);

        const res = await fetchWithAuth('/api/library/upload', {
          method: 'POST',
          body: uploadData
        });
        
        if (res.ok) {
          setIsAddModalOpen(false);
          refreshLibrary();
          toast.success('Document ajouté avec succès');
        } else {
          const err = await res.json();
          toast.error(err.message || 'Erreur lors du téléchargement');
        }
      } else {
        const newItem = {
          title: formData.get('title'),
          category: formData.get('category'),
          url: formData.get('url'),
          type: formData.get('type'),
          addedBy: profile?.firstName || 'Admin',
        };

        const res = await fetchWithAuth('/api/library', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newItem)
        });
        
        if (res.ok) {
          setIsAddModalOpen(false);
          refreshLibrary();
          toast.success('Lien ajouté avec succès');
        }
      }
    } catch (err) {
      console.error("Error adding library item:", err);
      toast.error('Une erreur est survenue lors de l\'ajout');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteItem = async (id: string) => {
    if (!canManage) return;
    if (!window.confirm('Supprimer ce document ?')) return;
    try {
      const res = await fetchWithAuth(`/api/library/${id}`, { method: 'DELETE' });
      if (res.ok) {
        refreshLibrary();
        toast.success('Document supprimé');
      }
    } catch (err) {
      console.error("Error deleting item:", err);
    }
  };

  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' }>({ key: 'title', direction: 'asc' });

  const filteredItems = items.filter(item => {
    const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = filterCategory === 'all' || item.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  const sortedItems = [...filteredItems].sort((a, b) => {
    const direction = sortConfig.direction === 'asc' ? 1 : -1;
    if (sortConfig.key === 'title') {
      return direction * a.title.localeCompare(b.title);
    }
    if (sortConfig.key === 'category') {
      return direction * a.category.localeCompare(b.category);
    }
    if (sortConfig.key === 'date') {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return direction * (dateA - dateB);
    }
    return 0;
  });

  const handleSort = (key: string) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const categories = ['all', ...new Set(items.map(i => i.category))];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h3 className="text-xl font-bold">Bibliothèque Numérique</h3>
        {canManage && (
          <button 
            onClick={() => setIsAddModalOpen(true)}
            className="btn-primary flex items-center gap-2"
          >
            <Upload size={18} />
            <span>Ajouter un Document</span>
          </button>
        )}
      </div>

      <div className="card p-4 flex flex-col md:flex-row gap-4">
        <div className="relative flex-1 group">
          <input 
            type="text" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher un document..."
            className="w-full pl-10 pr-4 py-2 bg-neutral-100 dark:bg-neutral-800 border-none rounded-lg focus:ring-2 focus:ring-dia-red transition-all"
          />
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 group-focus-within:text-dia-red transition-colors pointer-events-none z-10" size={18} />
        </div>
        <div className="flex gap-2 items-center">
          <div className="flex items-center gap-1 bg-neutral-100 dark:bg-neutral-800 p-1 rounded-xl">
            <button 
              onClick={() => handleSort('title')}
              className={cn(
                "px-3 py-1.5 text-[10px] font-bold rounded-lg transition-all flex items-center gap-1",
                sortConfig.key === 'title' ? "bg-white dark:bg-neutral-700 text-dia-red shadow-sm" : "text-neutral-500"
              )}
            >
              Nom {sortConfig.key === 'title' && (sortConfig.direction === 'asc' ? <ChevronUp size={12}/> : <ChevronDown size={12}/>)}
            </button>
            <button 
              onClick={() => handleSort('date')}
              className={cn(
                "px-3 py-1.5 text-[10px] font-bold rounded-lg transition-all flex items-center gap-1",
                sortConfig.key === 'date' ? "bg-white dark:bg-neutral-700 text-dia-red shadow-sm" : "text-neutral-500"
              )}
            >
              Date {sortConfig.key === 'date' && (sortConfig.direction === 'asc' ? <ChevronUp size={12}/> : <ChevronDown size={12}/>)}
            </button>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0 scrollbar-hide">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setFilterCategory(cat)}
                className={cn(
                  "px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap",
                  filterCategory === cat ? "bg-dia-red text-white" : "bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200"
                )}
              >
                {cat === 'all' ? 'Tout' : cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Library Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {sortedItems.map((item) => (
          <div key={item.id} className="card p-6 group hover:shadow-xl transition-all border-dia-red/0 hover:border-dia-red/20 border">
            <div className="w-12 h-12 rounded-2xl bg-dia-red/10 text-dia-red flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              {item.type === 'video' ? <Youtube size={24} /> : 
               item.type === 'archive' ? <FileArchive size={24} /> : 
               <FileText size={24} />}
            </div>
            <div className="space-y-1 mb-6">
              <h4 className="font-bold text-sm line-clamp-2 h-10">{item.title}</h4>
              <div className="flex items-center gap-2">
                <p className="text-[10px] font-bold uppercase text-neutral-400 tracking-widest">{item.category}</p>
                {item.fileSize && (
                  <span className="text-[10px] text-neutral-400">
                    • {(item.fileSize / (1024 * 1024)).toFixed(2)} MB
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between pt-4 border-t border-neutral-100 dark:border-neutral-800">
              <a 
                href={item.url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="p-2 bg-neutral-100 dark:bg-neutral-800 rounded-lg hover:bg-dia-red hover:text-white transition-all"
                title={item.type === 'video' ? "Regarder" : "Télécharger"}
              >
                {item.type === 'video' ? <LinkIcon size={16} /> : <Download size={16} />}
              </a>
              {canManage && (
                <button 
                  onClick={() => handleDeleteItem(item.id)}
                  className="p-2 hover:bg-red-100 hover:text-red-600 rounded-lg transition-all text-neutral-400"
                  title="Supprimer"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Add Item Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-neutral-900 w-full max-w-md rounded-[32px] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-8 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
              <h3 className="text-2xl font-bold tracking-tight">Ajouter au Document</h3>
              <button onClick={() => setIsAddModalOpen(false)} className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition-colors">
                <X size={24} />
              </button>
            </div>
            <div className="px-8 pt-6">
              <div className="flex p-1 bg-neutral-100 dark:bg-neutral-800 rounded-xl">
                <button 
                  onClick={() => setAddMethod('file')}
                  className={cn(
                    "flex-1 py-2 text-xs font-bold rounded-lg transition-all",
                    addMethod === 'file' ? "bg-white dark:bg-neutral-700 shadow-sm" : "text-neutral-500"
                  )}
                >
                  Fichier Local
                </button>
                <button 
                  onClick={() => setAddMethod('link')}
                  className={cn(
                    "flex-1 py-2 text-xs font-bold rounded-lg transition-all",
                    addMethod === 'link' ? "bg-white dark:bg-neutral-700 shadow-sm" : "text-neutral-500"
                  )}
                >
                  Lien / Vidéo
                </button>
              </div>
            </div>
            <form onSubmit={handleAddItem} className="p-8 space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">Titre du document</label>
                  <input name="title" required type="text" className="w-full px-5 py-3 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-2xl focus:ring-2 focus:ring-dia-red/20 focus:border-dia-red outline-none transition-all" />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">Catégorie</label>
                  <select name="category" required className="w-full px-5 py-3 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-2xl focus:ring-2 focus:ring-dia-red/20 focus:border-dia-red outline-none transition-all">
                    <option value="Cours">Cours</option>
                    <option value="Exercices">Exercices</option>
                    <option value="Examens">Examens</option>
                    <option value="Livres">Livres</option>
                    <option value="Vidéos">Vidéos</option>
                    <option value="Archives">Archives</option>
                    <option value="Autre">Autre</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">Type de contenu</label>
                  <select name="type" required className="w-full px-5 py-3 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-2xl focus:ring-2 focus:ring-dia-red/20 focus:border-dia-red outline-none transition-all">
                    <option value="document">Document (PDF, Word...)</option>
                    <option value="video">Vidéo (YouTube...)</option>
                    <option value="archive">Archive (ZIP, RAR...)</option>
                  </select>
                </div>
                
                {addMethod === 'file' ? (
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">Fichier (Max 1Go)</label>
                    <input name="file" type="file" className="w-full px-5 py-3 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-2xl focus:ring-2 focus:ring-dia-red/20 focus:border-dia-red outline-none transition-all" />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">URL / Lien</label>
                    <input name="url" required type="url" placeholder="https://..." className="w-full px-5 py-3 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-2xl focus:ring-2 focus:ring-dia-red/20 focus:border-dia-red outline-none transition-all" />
                  </div>
                )}
              </div>
              <div className="pt-4 flex gap-4">
                <button type="button" onClick={() => setIsAddModalOpen(false)} className="flex-1 px-6 py-4 bg-neutral-100 dark:bg-neutral-800 rounded-2xl font-bold transition-all hover:bg-neutral-200">Annuler</button>
                <button 
                  type="submit" 
                  disabled={submitting}
                  className="flex-1 btn-primary py-4 flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Ajout...</span>
                    </>
                  ) : (
                    <span>Ajouter</span>
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

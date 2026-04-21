import React, { useState, useEffect } from 'react';
import { 
  Bell, 
  Plus, 
  Search, 
  Filter, 
  Calendar, 
  User, 
  Archive, 
  Send, 
  X,
  ChevronRight,
  Clock,
  CheckCircle2
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Communique, UserRole } from '../types';
import { cn } from '../utils';
import { toast } from 'sonner';
import { collection, query, orderBy, getDocs, addDoc, serverTimestamp, where, updateDoc, doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { CommuniqueRead } from '../types';

export default function CommuniqueManagement() {
  const { profile, user, fetchWithAuth } = useAuth();
  const isAdmin = profile?.role === 'admin';
  
  const [communiques, setCommuniques] = useState<Communique[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState<string>('all');
  const [selectedCommunique, setSelectedCommunique] = useState<Communique | null>(null);
  const [readStatuses, setReadStatuses] = useState<Record<string, boolean>>({});
  const [communiqueReaders, setCommuniqueReaders] = useState<Record<string, CommuniqueRead[]>>({});
  const [isReadersModalOpen, setIsReadersModalOpen] = useState(false);
  const [currentReadersList, setCurrentReadersList] = useState<{title: string, readers: CommuniqueRead[]}>({title: '', readers: []});

  const fetchCommuniques = async () => {
    setLoading(true);
    try {
      // Fetch the main list
      const commRef = collection(db, 'communiques');
      // We try with orderBy but fall back if it fails (e.g. missing index)
      let snapshot;
      try {
        const q = query(commRef, orderBy('createdAt', 'desc'));
        snapshot = await getDocs(q);
      } catch (e) {
        console.warn("Communique orderBy failed, fetching without sort:", e);
        snapshot = await getDocs(commRef);
      }

      let docs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Communique[];

      // Manual sort if index was missing or as a safety measure
      docs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      // Filter based on user role if not admin
      const visibleDocs = isAdmin 
        ? docs 
        : docs.filter(c => c.targetRoles.includes(profile?.role as UserRole) && !c.isArchived);

      setCommuniques(visibleDocs);
      
      // Fetch metadata (read status and counts) asynchronously without blocking the list
      fetchReadMetadata(visibleDocs);

    } catch (err: any) {
      console.error("Critical error fetching communiques:", err);
      // More detailed error for the user to help debug
      const errorMsg = err.code === 'permission-denied' 
        ? "Accès refusé (Vérifiez votre connexion)" 
        : "Erreur de connexion à la base de données";
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const fetchReadMetadata = async (targetDocs: Communique[]) => {
    if (!user) return;
    
    try {
      const statuses: Record<string, boolean> = {};
      const readers: Record<string, CommuniqueRead[]> = {};
      const counts: Record<string, number> = {};

      await Promise.all(targetDocs.map(async (c) => {
        try {
          // Check if current user has read it
          const readRef = doc(db, 'communiques', c.id, 'reads', user.uid);
          const readSnap = await getDoc(readRef);
          statuses[c.id] = readSnap.exists();

          // For admins, get the readers count and list
          if (isAdmin) {
            const readersRef = collection(db, 'communiques', c.id, 'reads');
            const readersSnap = await getDocs(readersRef);
            const readersList = readersSnap.docs.map(rd => rd.data() as CommuniqueRead);
            readers[c.id] = readersList;
            counts[c.id] = readersList.length;
          }
        } catch (e) {
          console.warn(`Could not fetch metadata for communique ${c.id}:`, e);
        }
      }));

      setReadStatuses(prev => ({ ...prev, ...statuses }));
      if (isAdmin) {
        setCommuniqueReaders(prev => ({ ...prev, ...readers }));
        setCommuniques(prev => prev.map(c => ({
          ...c,
          readCount: counts[c.id] ?? c.readCount
        })));
      }
    } catch (err) {
      console.error("Error fetching read metadata:", err);
    }
  };

  useEffect(() => {
    if (user && profile) {
      fetchCommuniques();
    }
  }, [user, profile?.role]);

  const handleAddCommunique = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    
    const formData = new FormData(e.currentTarget);
    const targetRoles: UserRole[] = [];
    if (formData.get('target_student')) targetRoles.push('student');
    if (formData.get('target_teacher')) targetRoles.push('teacher');
    if (formData.get('target_admin')) targetRoles.push('admin');

    if (targetRoles.length === 0) {
      toast.error("Veuillez sélectionner au moins un destinataire");
      setSubmitting(false);
      return;
    }

    const newCommunique = {
      title: formData.get('title') as string,
      content: formData.get('content') as string,
      targetRoles,
    };

    try {
      // Use the backend API to handle distribution (emails + push)
      const res = await fetchWithAuth('/api/communiques', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCommunique)
      });

      if (res.ok) {
        setIsAddModalOpen(false);
        fetchCommuniques();
        toast.success("Communiqué envoyé et archivé");
      } else {
        const error = await res.json();
        toast.error(error.message || "Erreur lors de l'envoi");
      }
    } catch (err) {
      console.error("Error adding communique:", err);
      toast.error("Erreur lors de l'envoi du communiqué");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleArchive = async (communique: Communique) => {
    if (!isAdmin) return;
    try {
      await updateDoc(doc(db, 'communiques', communique.id), {
        isArchived: !communique.isArchived
      });
      toast.success(communique.isArchived ? "Désarchivé" : "Archivé");
      fetchCommuniques();
    } catch (err) {
      toast.error("Erreur lors de l'archivage");
    }
  };

  const markAsRead = async (communique: Communique) => {
    if (!user || !profile || readStatuses[communique.id]) return;
    
    try {
      const readData: CommuniqueRead = {
        userId: user.uid,
        userName: `${profile.firstName} ${profile.lastName}`,
        readAt: new Date().toISOString(),
      };
      
      await setDoc(doc(db, 'communiques', communique.id, 'reads', user.uid), readData);
      setReadStatuses(prev => ({ ...prev, [communique.id]: true }));
      
      if (isAdmin) {
        setCommuniqueReaders(prev => ({
          ...prev,
          [communique.id]: [...(prev[communique.id] || []), readData]
        }));
      }
    } catch (err) {
      console.warn("Error marking as read:", err);
    }
  };

  const openCommunique = (communique: Communique) => {
    setSelectedCommunique(communique);
    markAsRead(communique);
  };

  const showReaders = (communique: Communique) => {
    const readers = communiqueReaders[communique.id] || [];
    setCurrentReadersList({ title: communique.title, readers });
    setIsReadersModalOpen(true);
  };

  const filteredCommuniques = communiques.filter(c => {
    const matchesSearch = c.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         c.content.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = filterRole === 'all' || c.targetRoles.includes(filterRole as UserRole);
    return matchesSearch && matchesRole;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-2xl font-bold tracking-tight">Communiqués</h3>
          <p className="text-neutral-500">
            {isAdmin 
              ? "Gérez et diffusez les annonces officielles." 
              : "Consultez les dernières annonces de l'administration."}
          </p>
        </div>
        
        {isAdmin && (
          <button 
            onClick={() => setIsAddModalOpen(true)}
            className="btn-primary flex items-center justify-center gap-2 py-3 px-6 rounded-2xl shadow-lg shadow-dia-red/20 active:scale-95 transition-all"
          >
            <Plus size={20} />
            Nouveau Communiqué
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-1 group">
          <input 
            type="text" 
            placeholder="Rechercher une annonce..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-white border border-neutral-100 rounded-2xl focus:ring-2 focus:ring-dia-red/10 focus:border-dia-red outline-none shadow-sm transition-all text-sm"
          />
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 group-focus-within:text-dia-red transition-colors pointer-events-none z-10" size={20} />
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2 bg-white p-1 rounded-2xl border border-neutral-100 shadow-sm">
            <button 
              onClick={() => setFilterRole('all')}
              className={cn(
                "px-4 py-2 text-xs font-bold rounded-xl transition-all",
                filterRole === 'all' ? "bg-dia-red text-white shadow-md" : "text-neutral-500 hover:bg-neutral-50"
              )}
            >
              Tous
            </button>
            <button 
              onClick={() => setFilterRole('student')}
              className={cn(
                "px-4 py-2 text-xs font-bold rounded-xl transition-all",
                filterRole === 'student' ? "bg-dia-red text-white shadow-md" : "text-neutral-500 hover:bg-neutral-50"
              )}
            >
              Élèves
            </button>
            <button 
              onClick={() => setFilterRole('teacher')}
              className={cn(
                "px-4 py-2 text-xs font-bold rounded-xl transition-all",
                filterRole === 'teacher' ? "bg-dia-red text-white shadow-md" : "text-neutral-500 hover:bg-neutral-50"
              )}
            >
              Enseignants
            </button>
          </div>
        )}
      </div>

      {/* Communiques List */}
      <div className="space-y-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-dia-red/20 border-t-dia-red"></div>
            <p className="text-neutral-500 animate-pulse font-medium">Chargement des annonces...</p>
          </div>
        ) : filteredCommuniques.length === 0 ? (
          <div className="card py-20 flex flex-col items-center justify-center text-center opacity-60">
            <div className="w-20 h-20 rounded-full bg-neutral-100 flex items-center justify-center mb-6">
              <Bell size={40} className="text-neutral-400" />
            </div>
            <h4 className="text-xl font-bold mb-2">Aucun communiqué</h4>
            <p className="text-neutral-500 max-w-xs">Aucune annonce n'a été publiée pour le moment.</p>
          </div>
        ) : (
          filteredCommuniques.map((c) => (
            <div 
              key={c.id} 
              className={cn(
                "card group relative overflow-hidden transition-all hover:shadow-xl hover:translate-y-[-2px] border-l-4",
                c.isArchived ? "border-neutral-300 opacity-75" : "border-dia-red"
              )}
            >
              <div className="p-6">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      {c.targetRoles.map(role => (
                        <span key={role} className="px-2 py-0.5 rounded-full bg-neutral-100 text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                          {role === 'student' ? 'Élèves' : role === 'teacher' ? 'Enseignants' : 'Admin'}
                        </span>
                      ))}
                      {c.isArchived && (
                        <span className="px-2 py-0.5 rounded-full bg-amber-50 text-[10px] font-bold uppercase tracking-wider text-amber-600 flex items-center gap-1">
                          <Archive size={10} /> Archivé
                        </span>
                      )}
                      {!readStatuses[c.id] && !isAdmin && (
                        <span className="px-2 py-0.5 rounded-full bg-dia-red text-[10px] font-bold uppercase tracking-wider text-white"> Nouveau </span>
                      )}
                      {isAdmin && (
                        <button 
                          onClick={(e) => { e.stopPropagation(); showReaders(c); }}
                          className="px-2 py-0.5 rounded-full bg-blue-50 text-[10px] font-bold uppercase tracking-wider text-blue-600 hover:bg-blue-100 transition-colors"
                        >
                          Lu par {c.readCount || 0}
                        </button>
                      )}
                    </div>
                    <h4 className="text-lg font-bold text-neutral-900 group-hover:text-dia-red transition-colors">{c.title}</h4>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="flex items-center gap-1.5 text-neutral-400 text-xs font-medium">
                      <Calendar size={12} />
                      {new Date(c.createdAt).toLocaleDateString('fr-FR')}
                    </div>
                    <div className="flex items-center gap-1.5 text-neutral-400 text-[10px] font-medium justify-end mt-1">
                      <Clock size={10} />
                      {new Date(c.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
                
                <p className="text-neutral-600 text-sm line-clamp-3 mb-6 leading-relaxed">
                  {c.content}
                </p>

                <div className="flex items-center justify-between pt-4 border-t border-neutral-50">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center text-xs font-bold text-neutral-500">
                      {c.authorName?.[0] || 'A'}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-neutral-700">{c.authorName}</p>
                      <p className="text-[10px] text-neutral-400">Administration</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {isAdmin && (
                      <button 
                        onClick={() => toggleArchive(c)}
                        className="p-2 hover:bg-neutral-50 rounded-xl text-neutral-400 hover:text-amber-600 transition-colors tooltip"
                        title={c.isArchived ? "Désarchiver" : "Archiver"}
                      >
                        <Archive size={18} />
                      </button>
                    )}
                    <button 
                      onClick={() => openCommunique(c)}
                      className="flex items-center gap-1.5 px-4 py-2 bg-neutral-50 hover:bg-neutral-100 text-neutral-900 text-xs font-bold rounded-xl transition-all active:scale-95"
                    >
                      Lire la suite <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add Communique Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-2xl rounded-[32px] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-8 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/50">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-dia-red/10 flex items-center justify-center text-dia-red">
                  <Bell size={24} />
                </div>
                <div>
                  <h3 className="text-2xl font-bold tracking-tight">Nouveau Communiqué</h3>
                  <p className="text-neutral-500 text-sm">Diffusez une annonce officielle à l'institut.</p>
                </div>
              </div>
              <button onClick={() => setIsAddModalOpen(false)} className="p-2 hover:bg-neutral-100 rounded-xl transition-colors">
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={handleAddCommunique} className="p-8 space-y-6 max-h-[70vh] overflow-y-auto">
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">Titre de l'annonce</label>
                  <input 
                    name="title" 
                    required 
                    type="text" 
                    placeholder="Ex: Fermeture exceptionnelle, Nouvelles dates d'examen..." 
                    className="w-full px-5 py-4 bg-neutral-50 border border-neutral-200 rounded-2xl focus:ring-2 focus:ring-dia-red/20 focus:border-dia-red outline-none transition-all font-medium" 
                  />
                </div>

                <div className="space-y-4">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">Cibles de la diffusion</label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <label className={cn(
                      "flex items-center gap-3 p-4 border rounded-2xl cursor-pointer transition-all hover:bg-neutral-50",
                      "border-neutral-200 has-[:checked]:border-dia-red has-[:checked]:bg-dia-red/5"
                    )}>
                      <input type="checkbox" name="target_student" className="accent-dia-red w-4 h-4" defaultChecked />
                      <div className="flex flex-col">
                        <span className="text-sm font-bold">Élèves</span>
                        <span className="text-[10px] text-neutral-400 uppercase">Students</span>
                      </div>
                    </label>
                    <label className={cn(
                      "flex items-center gap-3 p-4 border rounded-2xl cursor-pointer transition-all hover:bg-neutral-50",
                      "border-neutral-200 has-[:checked]:border-dia-red has-[:checked]:bg-dia-red/5"
                    )}>
                      <input type="checkbox" name="target_teacher" className="accent-dia-red w-4 h-4" defaultChecked />
                      <div className="flex flex-col">
                        <span className="text-sm font-bold">Enseignants</span>
                        <span className="text-[10px] text-neutral-400 uppercase">Teachers</span>
                      </div>
                    </label>
                    <label className={cn(
                      "flex items-center gap-3 p-4 border rounded-2xl cursor-pointer transition-all hover:bg-neutral-50",
                      "border-neutral-200 has-[:checked]:border-dia-red has-[:checked]:bg-dia-red/5"
                    )}>
                      <input type="checkbox" name="target_admin" className="accent-dia-red w-4 h-4" />
                      <div className="flex flex-col">
                        <span className="text-sm font-bold">Admins</span>
                        <span className="text-[10px] text-neutral-400 uppercase">Administrative</span>
                      </div>
                    </label>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">Contenu du message</label>
                  <textarea 
                    name="content" 
                    required 
                    rows={8} 
                    placeholder="Rédigez ici votre communiqué..." 
                    className="w-full px-5 py-4 bg-neutral-50 border border-neutral-200 rounded-2xl focus:ring-2 focus:ring-dia-red/20 focus:border-dia-red outline-none transition-all resize-none leading-relaxed" 
                  />
                </div>
                
                <div className="flex items-center gap-3 p-4 bg-amber-50 rounded-2xl border border-amber-100">
                  <div className="shrink-0 w-8 h-8 rounded-full bg-amber-200 flex items-center justify-center text-amber-700">
                    <Send size={16} />
                  </div>
                  <p className="text-[11px] text-amber-800 leading-tight">
                    En cliquant sur "Diffuser", ce communiqué sera archivé et envoyé par <strong>Email</strong> ainsi que via <strong>Notification Push</strong> à tous les utilisateurs sélectionnés.
                  </p>
                </div>
              </div>

              <div className="pt-6 flex gap-4">
                <button type="button" onClick={() => setIsAddModalOpen(false)} className="flex-1 px-6 py-4 bg-neutral-100 rounded-2xl font-bold transition-all hover:bg-neutral-200 active:scale-95">
                  Annuler
                </button>
                <button 
                  type="submit" 
                  disabled={submitting}
                  className="flex-[2] btn-primary py-4 flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50 disabled:active:scale-100"
                >
                  {submitting ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-white/30 border-t-white"></div>
                      Diffusion en cours...
                    </>
                  ) : (
                    <>
                      <Send size={20} />
                      Diffuser le Communiqué
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail View Modal */}
      {selectedCommunique && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
          <div className="bg-white w-full max-w-2xl rounded-[32px] shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-8 duration-300">
            <div className="p-8 border-b border-neutral-100">
              <div className="flex items-center justify-between mb-4">
                <span className="px-3 py-1 rounded-full bg-dia-red/5 text-dia-red text-[10px] font-bold uppercase tracking-widest">
                  Annonce Officielle
                </span>
                <button onClick={() => setSelectedCommunique(null)} className="p-2 hover:bg-neutral-100 rounded-xl transition-colors">
                  <X size={24} />
                </button>
              </div>
              <h3 className="text-3xl font-bold tracking-tight text-neutral-900">{selectedCommunique.title}</h3>
              <div className="flex items-center gap-4 mt-4 text-xs text-neutral-500 font-medium">
                <div className="flex items-center gap-1.5"><User size={14} /> {selectedCommunique.authorName}</div>
                <div className="flex items-center gap-1.5"><Calendar size={14} /> {new Date(selectedCommunique.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
                <div className="flex items-center gap-1.5"><Clock size={14} /> {new Date(selectedCommunique.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</div>
              </div>
            </div>
            
            <div className="p-8 max-h-[60vh] overflow-y-auto">
              <div className="prose prose-neutral max-w-none text-neutral-700 leading-relaxed whitespace-pre-wrap font-medium">
                {selectedCommunique.content}
              </div>
            </div>
            
            <div className="p-8 bg-neutral-50 border-t border-neutral-100 flex justify-end">
              <button 
                onClick={() => setSelectedCommunique(null)}
                className="px-8 py-3 bg-white border border-neutral-200 rounded-xl font-bold text-sm hover:bg-neutral-100 transition-all active:scale-95"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Readers List Modal */}
      {isReadersModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-lg rounded-[32px] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-neutral-100 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold tracking-tight">Lectures</h3>
                <p className="text-xs text-neutral-500 line-clamp-1">{currentReadersList.title}</p>
              </div>
              <button onClick={() => setIsReadersModalOpen(false)} className="p-2 hover:bg-neutral-100 rounded-xl transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 max-h-[50vh] overflow-y-auto">
              {currentReadersList.readers.length === 0 ? (
                <div className="text-center py-10 text-neutral-400">
                  <Clock size={32} className="mx-auto mb-2 opacity-20" />
                  <p className="text-sm">Aucune lecture enregistrée</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {currentReadersList.readers.map((r, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 rounded-2xl bg-neutral-50 border border-neutral-100">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-xs font-bold">
                          {r.userName?.[0] || '?'}
                        </div>
                        <span className="text-sm font-bold text-neutral-700">{r.userName}</span>
                      </div>
                      <div className="text-[10px] text-neutral-400 text-right">
                        <div>{new Date(r.readAt).toLocaleDateString()}</div>
                        <div>{new Date(r.readAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div className="p-6 bg-neutral-50 border-t border-neutral-100 flex justify-end">
              <button 
                onClick={() => setIsReadersModalOpen(false)}
                className="px-6 py-2 bg-white border border-neutral-200 rounded-xl font-bold text-xs hover:bg-neutral-100 transition-all"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase';
import { collection, query, orderBy, limit, onSnapshot, addDoc, serverTimestamp, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { ChatMessage } from '../types';
import { Send, Trash2, Shield, User, MessageSquare, Reply, Smile } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { OperationType, handleFirestoreError } from '../services/firestoreUtils';
import { addAuditLog } from '../utils/auditLogger';

const StudentChatPage: React.FC = () => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [showEmojis, setShowEmojis] = useState(false);
  const emojiRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const emojis = ['😊', '😂', '🔥', '👏', '🙌', '👍', '🙏', '❤️', '🎓', '📚', '💪', '💯', '✨', '🤩', '🤔', '😎'];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (emojiRef.current && !emojiRef.current.contains(event.target as Node)) {
        setShowEmojis(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    const q = query(
      collection(db, 'chat_eleves'),
      orderBy('timestamp', 'asc'),
      limit(100)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedMessages = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      } as ChatMessage));
      setMessages(fetchedMessages);
      setLoading(false);
      
      // Auto scroll to bottom
      setTimeout(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
      }, 100);
    }, (error) => {
      setLoading(false);
      handleFirestoreError(error, OperationType.LIST, 'chat_eleves');
    });

    return () => unsubscribe();
  }, []);

  const generateAlias = (uid: string) => {
    if (!uid) return 'Anonyme';
    const hash = uid.slice(-4).toUpperCase();
    return `Élève #${hash}`;
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user) return;

    try {
      const messageData = {
        uid_auteur: user.uid,
        nom_auteur: `${user.firstName} ${user.lastName}`, // Admins will see this
        alias: generateAlias(user.uid),
        message: newMessage.trim(),
        timestamp: new Date().toISOString(), // Using ISO for types, can use serverTimestamp in firestore
        supprime: false
      };

      await addDoc(collection(db, 'chat_eleves'), messageData);
      setNewMessage('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'chat_eleves');
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!isAdmin) return;
    try {
      await updateDoc(doc(db, 'chat_eleves', messageId), {
        supprime: true,
        message: "[Message supprimé par l'administration]"
      });
      toast.success("Message modéré");
      addAuditLog("CHAT_MODERATION", messageId, { action: 'delete' });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'chat_eleves');
    }
  };

  const handleAdminReply = async (messageId: string) => {
    const reply = window.prompt("Réponse de l'administration :");
    if (!reply) return;

    try {
      await updateDoc(doc(db, 'chat_eleves', messageId), {
        reponse_admin: reply
      });
      toast.success("Réponse envoyée");
      addAuditLog("CHAT_REPLY", messageId);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'chat_eleves');
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] lg:h-[calc(100vh-100px)]">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-black text-dia-red uppercase tracking-tight flex items-center gap-2">
            <MessageSquare size={20} /> Espace d'Échanges
          </h2>
          <p className="text-[10px] text-neutral-500 uppercase font-bold tracking-wider">Échangez librement et anonymement</p>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2 px-3 py-1 bg-dia-red/10 text-dia-red rounded-full text-[10px] font-black uppercase">
            <Shield size={12} /> MODÉRATION ACTIVE
          </div>
        )}
      </div>

      <div 
        ref={scrollRef}
        className="flex-1 bg-neutral-50/50 dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 rounded-3xl overflow-y-auto p-4 space-y-3 shadow-inner custom-scrollbar"
      >
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-dia-red"></div>
          </div>
        ) : (
          messages.map((msg, index) => {
            const isMine = msg.uid_auteur === user?.uid;
            const prevMsg = index > 0 ? messages[index - 1] : null;
            const isSameUserAsPrev = prevMsg?.uid_auteur === msg.uid_auteur;
            
            return (
              <motion.div 
                initial={{ opacity: 0, x: isMine ? 20 : -20 }}
                animate={{ opacity: 1, x: 0 }}
                key={msg.id} 
                className={`flex flex-col ${isMine ? 'items-end' : 'items-start'} ${isSameUserAsPrev ? 'mt-1' : 'mt-4'}`}
              >
                {!isSameUserAsPrev && (
                  <span className={`text-[9px] font-black uppercase tracking-widest mb-1 ${isMine ? 'text-dia-red mr-2' : 'text-neutral-500 ml-2'}`}>
                    {isAdmin ? (
                      <span className="flex items-center gap-1">
                        {msg.nom_auteur} ({msg.alias})
                      </span>
                    ) : (
                      isMine ? 'VOUS' : msg.alias
                    )}
                  </span>
                )}
                
                <div className={`max-w-[85%] sm:max-w-[70%] rounded-2xl px-4 py-2 shadow-sm relative group transition-all hover:shadow-md ${
                  isMine 
                    ? 'bg-dia-red text-white rounded-tr-none' 
                    : 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 rounded-tl-none border border-neutral-100 dark:border-neutral-700'
                }`}>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.message}</p>
                  
                  <div className={`mt-1 flex justify-end ${isMine ? 'text-white/40' : 'text-neutral-400'}`}>
                    <span className="text-[8px] font-bold">
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  {msg.reponse_admin && (
                    <div className={`mt-2 pt-2 border-t ${isMine ? 'border-white/20' : 'border-neutral-200 dark:border-neutral-700'}`}>
                      <div className="flex items-center gap-1.5 text-[9px] font-black text-dia-red mb-1 uppercase">
                        <Shield size={10} /> Réponse Administration
                      </div>
                      <p className="text-[11px] italic leading-snug opacity-90">
                        {msg.reponse_admin}
                      </p>
                    </div>
                  )}

                  {isAdmin && (
                    <div className={`absolute top-0 ${isMine ? 'left-[-45px]' : 'right-[-45px]'} hidden group-hover:flex flex-col gap-1 z-10 animate-in fade-in slide-in-from-right-2`}>
                      <button 
                        onClick={() => handleDeleteMessage(msg.id)}
                        className="p-1.5 bg-white dark:bg-neutral-800 shadow-xl border border-neutral-100 dark:border-neutral-700 rounded-full text-dia-red hover:scale-110 transition-transform"
                        title="Détruire"
                      >
                        <Trash2 size={12} />
                      </button>
                      <button 
                        onClick={() => handleAdminReply(msg.id)}
                        className="p-1.5 bg-white dark:bg-neutral-800 shadow-xl border border-neutral-100 dark:border-neutral-700 rounded-full text-blue-500 hover:scale-110 transition-transform"
                        title="Répondre"
                      >
                        <Reply size={12} />
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })
        )}
        {messages.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center h-full text-neutral-400 space-y-2 opacity-30">
            <MessageSquare size={48} />
            <p className="font-bold text-xs uppercase tracking-widest">Aucun message ici</p>
          </div>
        )}
      </div>

      <form onSubmit={handleSendMessage} className="mt-4 relative group">
        <div className="relative flex items-center">
          <input 
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Envoyer un message..."
            className="w-full pl-5 pr-24 py-4 bg-white dark:bg-neutral-900 border-2 border-neutral-100 dark:border-neutral-800 rounded-2xl outline-none focus:border-dia-red/50 focus:ring-4 focus:ring-dia-red/5 transition-all shadow-lg"
          />
          
          <div className="absolute right-14 top-1/2 -translate-y-1/2 flex items-center gap-1">
            <button
              type="button"
              onClick={() => setShowEmojis(!showEmojis)}
              className={`p-2 rounded-xl transition-colors ${showEmojis ? 'text-dia-red bg-dia-red/10' : 'text-neutral-400 hover:text-dia-red hover:bg-neutral-50 dark:hover:bg-neutral-800'}`}
            >
              <Smile size={20} />
            </button>
          </div>

          <button 
            type="submit"
            disabled={!newMessage.trim()}
            className="absolute right-2 top-2 p-3 bg-dia-red text-white rounded-xl shadow-lg hover:bg-red-700 transition-all active:scale-95 disabled:opacity-50 disabled:grayscale"
          >
            <Send size={20} />
          </button>
        </div>

        <AnimatePresence>
          {showEmojis && (
            <motion.div 
              ref={emojiRef}
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="absolute bottom-full right-0 mb-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-2xl p-3 grid grid-cols-4 gap-2 z-50 overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-dia-red"></div>
              {emojis.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => {
                    setNewMessage(prev => prev + emoji);
                    // Keep open for multiple emojis
                  }}
                  className="text-2xl p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition-transform active:scale-125"
                >
                  {emoji}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </form>
    </div>
  );
};

export default StudentChatPage;

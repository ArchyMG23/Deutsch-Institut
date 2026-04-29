import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase';
import { collection, query, orderBy, limit, onSnapshot, addDoc, serverTimestamp, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { ChatMessage } from '../types';
import { Send, Trash2, Shield, User, MessageSquare, Reply } from 'lucide-react';
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
  const scrollRef = useRef<HTMLDivElement>(null);
  
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
    <div className="flex flex-col h-[calc(100vh-160px)]">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-black text-dia-red uppercase tracking-tight flex items-center gap-2">
            <MessageSquare size={24} /> Espace d'Échanges
          </h2>
          <p className="text-sm text-neutral-500">Posez vos questions anonymement ou échangez avec vos camarades.</p>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2 px-3 py-1 bg-dia-red/10 text-dia-red rounded-full text-xs font-bold">
            <Shield size={14} /> MODE MODÉRATEUR ACTIF
          </div>
        )}
      </div>

      <div 
        ref={scrollRef}
        className="flex-1 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl overflow-y-auto p-4 space-y-4 shadow-inner"
      >
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-dia-red"></div>
          </div>
        ) : (
          messages.map((msg) => {
            const isMine = msg.uid_auteur === user?.uid;
            
            return (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                key={msg.id} 
                className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}
              >
                <div className={`max-w-[80%] rounded-2xl p-4 shadow-sm relative group ${
                  isMine 
                    ? 'bg-dia-red text-white' 
                    : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100'
                }`}>
                  <div className="flex items-center justify-between gap-4 mb-1">
                    <span className={`text-[10px] font-bold uppercase tracking-wider ${isMine ? 'text-white/70' : 'text-neutral-500'}`}>
                      {isAdmin ? (
                        <span className="flex items-center gap-1">
                          <User size={10} /> {msg.nom_auteur} ({msg.alias})
                        </span>
                      ) : (
                        isMine ? 'VOUS' : msg.alias
                      )}
                    </span>
                    <span className={`text-[10px] ${isMine ? 'text-white/50' : 'text-neutral-400'}`}>
                      {formatDistanceToNow(new Date(msg.timestamp), { addSuffix: true, locale: fr })}
                    </span>
                  </div>
                  
                  <p className="text-sm leading-relaxed">{msg.message}</p>
                  
                  {msg.reponse_admin && (
                    <div className={`mt-3 pt-3 border-t ${isMine ? 'border-white/20' : 'border-neutral-200 dark:border-neutral-700'}`}>
                      <div className="flex items-center gap-1.5 text-[10px] font-black text-dia-red mb-1 uppercase">
                        <Shield size={10} /> Administration
                      </div>
                      <p className="text-xs italic bg-white/10 dark:bg-black/20 p-2 rounded-lg">
                        {msg.reponse_admin}
                      </p>
                    </div>
                  )}

                  {isAdmin && (
                    <div className="absolute top-1 right-[-40px] hidden group-hover:flex flex-col gap-1">
                      <button 
                        onClick={() => handleDeleteMessage(msg.id)}
                        className="p-1.5 bg-white dark:bg-neutral-800 shadow-lg rounded-full text-dia-red hover:scale-110 transition-transform"
                      >
                        <Trash2 size={14} />
                      </button>
                      <button 
                        onClick={() => handleAdminReply(msg.id)}
                        className="p-1.5 bg-white dark:bg-neutral-800 shadow-lg rounded-full text-blue-500 hover:scale-110 transition-transform"
                      >
                        <Reply size={14} />
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })
        )}
        {messages.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center h-full text-neutral-400 space-y-2">
            <MessageSquare size={48} className="opacity-20" />
            <p>Commencez la conversation...</p>
          </div>
        )}
      </div>

      <form onSubmit={handleSendMessage} className="mt-4 flex gap-2">
        <input 
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Écrivez un message anonyme..."
          className="flex-1 px-4 py-3 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl outline-none focus:ring-2 focus:ring-dia-red"
        />
        <button 
          type="submit"
          className="p-3 bg-dia-red text-white rounded-xl shadow-lg hover:bg-red-700 transition-colors"
        >
          <Send size={24} />
        </button>
      </form>
    </div>
  );
};

export default StudentChatPage;

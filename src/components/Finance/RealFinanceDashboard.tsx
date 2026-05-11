import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, TrendingDown, DollarSign, Calendar, 
  PieChart as PieChartIcon, ArrowUpRight, ArrowDownRight,
  Activity, Filter, Clock, Landmark, CreditCard,
  ArrowRightLeft, Search, Plus, ChevronLeft, ChevronRight,
  ShieldCheck, ShieldAlert, Users, GraduationCap,
  X, RefreshCw, AlertCircle, UserCheck, Share2,
  ChevronUp, ChevronDown, Smartphone
} from 'lucide-react';
import { toast } from 'sonner';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  collectionGroup,
  addDoc,
  deleteDoc,
  updateDoc,
  doc
} from 'firebase/firestore';
import { db, auth } from '../../firebase';
import { formatCurrency } from '../../utils';
import { Charge, Session, Versement, DailyReport } from '../../types';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { generateWhatsAppLink, APP_NAME_FOR_LINKS } from '../../utils/contactLinks';
import { useAuth } from '../../context/AuthContext';
import { Trash2 } from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell,
  LineChart,
  Line
} from 'recharts';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
  }
}

// Robust class names join helper
const cn = (...classes: any[]) => classes.filter(Boolean).join(' ');

export default function RealFinanceDashboard() {
  const { t } = useTranslation();
  const { user, profile } = useAuth();
  
  const isSuperAdmin = 
    profile?.role === 'admin' || 
    profile?.isSuperAdmin || 
    user?.role === 'admin' || 
    user?.isSuperAdmin || 
    user?.email?.toLowerCase() === 'gabrielyombi311@gmail.com' ||
    user?.email?.toLowerCase() === 'yombivictor@gmail.com';

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    revenus: 0,
    chargesFixes: 0,
    chargesSalariales: 0,
    revenusDetails: { scolarite: 0, inscription: 0, autre: 0 } as Record<string, number>,
    history: [] as any[],
    classQuotas: [] as any[],
    sessionDetails: [] as any[],
    scolarites: [] as any[],
    caisseBalance: 0,
    banqueBalance: 0,
    allFinances: [] as any[],
    levelsMap: {} as Record<string, { identifier?: string; name: string; hours?: number; tuition?: number; stream?: string; [key: string]: any }>
  });
  const [activeTab, setActiveTab] = useState<'all' | 'caisse' | 'banque'>('all');
  const [selectedLevel, setSelectedLevel] = useState<string>('all');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferAmount, setTransferAmount] = useState(0);
  const [transferNotes, setTransferNotes] = useState('');

  const [sessionSort, setSessionSort] = useState<{ key: string, direction: 'asc' | 'desc' }>({ key: 'date', direction: 'desc' });
  const [scolaSort, setScolaSort] = useState<{ key: string, direction: 'asc' | 'desc' }>({ key: 'nom_eleve', direction: 'asc' });
  const [financeSort, setFinanceSort] = useState<{ key: string, direction: 'asc' | 'desc' }>({ key: 'date', direction: 'desc' });
  const [showMaintenanceModal, setShowMaintenanceModal] = useState(false);
  const [maintenanceStatus, setMaintenanceStatus] = useState<'idle' | 'scanning' | 'ready'>('idle');
  const [maintenanceLoading, setMaintenanceLoading] = useState(false);
  const [duplicates, setDuplicates] = useState<any[]>([]);
  const [auditLog, setAuditLog] = useState<{msg: string, type: 'info'|'err'}[]>([]);

  const addAuditMsg = (msg: string, type: 'info'|'err' = 'info') => {
    setAuditLog(prev => [{ msg, type }, ...prev].slice(0, 50));
  };

  const scanForDuplicates = () => {
    setMaintenanceStatus('scanning');
    const nameMap: Record<string, any[]> = {};
    
    // Use the latest data we have
    data.scolarites.forEach(s => {
      // Robust name normalization: remove accents, multiple spaces, etc.
      const name = s.nom_eleve?.toLowerCase()
        ?.normalize("NFD")?.replace(/[\u0300-\u036f]/g, "") // Remove accents
        ?.replace(/\s+/g, ' ') // Normalize spaces
        ?.trim();
        
      if (!name || name.length < 3) return;
      if (!nameMap[name]) nameMap[name] = [];
      nameMap[name].push(s);
    });

    const foundDuplicates = Object.values(nameMap).filter(list => list.length > 1);
    
    // Further filter: only groups where we have different student IDs 
    // (sometimes one student can have multiple scolarite records for different levels, which is OK)
    // Here we hunt for REAL duplicates (likely multiple users created for same person)
    setDuplicates(foundDuplicates);
    setMaintenanceStatus('ready');
  };

  const handleRepairLevels = async () => {
    if (!window.confirm("Cette action va tenter de synchroniser les noms et matricules des dossiers de scolarité avec les profils élèves. Continuer ?")) return;
    
    setMaintenanceLoading(true);
    let repaired = 0;
    try {
      const usersSnap = await getDocs(query(collection(db, 'users'), where('role', '==', 'student')));
      const usersMap: Record<string, any> = {};
      usersSnap.forEach(d => { usersMap[d.id] = d.data(); });

      const scolaSnap = await getDocs(collection(db, 'scolarites'));
      for (const sDoc of scolaSnap.docs) {
        const s = sDoc.data();
        const studentId = s.eleve_id || sDoc.id.split('_')[0];
        const user = usersMap[studentId];
        
        if (user) {
          const updates: any = {};
          if (!s.nom_eleve) updates.nom_eleve = `${user.lastName} ${user.firstName}`;
          if (!s.matricule) updates.matricule = user.matricule;
          if (!s.eleve_id) updates.eleve_id = studentId;
          
          if (Object.keys(updates).length > 0) {
            await updateDoc(sDoc.ref, updates);
            repaired++;
          }
        }
      }
      toast.success(`${repaired} dossiers synchronisés avec les profils utilisateurs.`);
      fetchFinanceStats();
    } catch (e) {
      toast.error("Erreur lors de la réparation");
    } finally {
      setMaintenanceLoading(false);
    }
  };

  const handleAuditRepair = async () => {
    if (!window.confirm("L'audit global va recalculer tous les soldes basés sur les transactions confirmées dans le Grand Livre. Continuer ?")) return;
    
    setMaintenanceLoading(true);
    addAuditMsg("Démarrage de l'audit global...");
    try {
      // 1. Fetch all confirmed income transactions related to tuition/registration
      const fSnap = await getDocs(query(
        collection(db, 'finances'), 
        where('type', '==', 'income'),
        where('category', 'in', ['tuition', 'registration', 'scolarite', 'inscription'])
      ));
      
      const paymentsByStudent: Record<string, any[]> = {};
      fSnap.forEach(doc => {
        const f = doc.data();
        if (!f.studentId && !f.studentMatricule) return;
        const sId = f.studentId || f.studentMatricule;
        if (!paymentsByStudent[sId]) paymentsByStudent[sId] = [];
        paymentsByStudent[sId].push({ id: doc.id, ...f });
      });

      // 2. Fetch all scolarites and their versements
      const scolaSnap = await getDocs(collection(db, 'scolarites'));
      let fixedToScola = 0;
      let docCount = 0;
      let pushedToLedger = 0;

      for (const sDoc of scolaSnap.docs) {
        const s = sDoc.data();
        const scolaId = sDoc.id;
        const studentId = s.eleve_id || scolaId.split('_')[0];
        
        // Audit subcollection versements
        const vSnap = await getDocs(collection(db, 'scolarites', scolaId, 'versements'));
        const vFinanceIds = new Set();
        let subtotalPaid = 0;
        
        const orphans: any[] = [];

        vSnap.forEach(vd => { 
          const vData = vd.data();
          const vId = vd.id;
          subtotalPaid += Number(vData.montant) || 0;
          if (vData.financeId) {
            vFinanceIds.add(vData.financeId); 
          } else {
            orphans.push({ id: vId, ref: vd.ref, ...vData });
          }
        });

        // 3. PUSH ORPHANS TO LEDGER (Reverse Sync)
        // If a student versement exists but isn't in Grand Livre, create it there
        for (const orphan of orphans) {
           // Double check if similar entry exists in finances to avoid duplicate (same day, same amount, same student)
           const studentPayments = paymentsByStudent[studentId] || [];
           const alreadyExists = studentPayments.find(p => 
             Math.abs(p.amount - orphan.montant) < 1 && 
             new Date(p.date).toISOString().split('T')[0] === new Date(orphan.date).toISOString().split('T')[0]
           );

           if (!alreadyExists) {
             const newFinance = {
               amount: Number(orphan.montant),
               type: 'income',
               category: orphan.categorie === 'inscription' ? 'registration' : 'tuition',
               description: `Réconciliation Audit: ${orphan.categorie} - ${s.nom_eleve}`,
               date: orphan.date,
               studentId: studentId,
               studentName: s.nom_eleve,
               studentMatricule: s.matricule,
               levelId: scolaId.includes('_') ? scolaId.split('_')[1] : '',
               paymentMethod: orphan.mode_paiement || 'Espèces',
               receiptNumber: orphan.recu_numero,
               createdAt: new Date().toISOString(),
               reconciledFromVId: orphan.id
             };
             const fRef = await addDoc(collection(db, 'finances'), newFinance);
             // Link the versement record to this new finance entry
             await updateDoc(orphan.ref, { financeId: fRef.id });
             vFinanceIds.add(fRef.id);
             pushedToLedger++;
           } else if (!orphan.financeId) {
             // If it exists in ledger but wasn't linked, link it now
             await updateDoc(orphan.ref, { financeId: alreadyExists.id });
             vFinanceIds.add(alreadyExists.id);
           }
        }

        // 4. PULL FROM LEDGER TO SCOLA (Forward Sync)
        const currentStudentPayments = paymentsByStudent[studentId] || [];
        let newlyAdded = 0;
        for (const p of currentStudentPayments) {
           const pLevelId = p.levelId || '';
           const currentLevelId = scolaId.includes('_') ? scolaId.split('_')[1] : '';
           const matchesLevel = !pLevelId || !currentLevelId || pLevelId === currentLevelId;

           if (!vFinanceIds.has(p.id) && matchesLevel) {
             const vData = {
               montant: p.amount,
               date: p.date,
               financeId: p.id,
               mode_paiement: p.paymentMethod || 'Espèces',
               categorie: (p.category === 'registration' || p.category === 'inscription') ? 'inscription' : 'scolarite',
               recu_numero: p.receiptNumber || `AUDIT-${p.id.slice(-6)}`,
               caissier_id: 'System-Audit',
               notes: "Recouvert par audit global",
               auditDate: new Date().toISOString()
             };
             await addDoc(collection(db, 'scolarites', scolaId, 'versements'), vData);
             subtotalPaid += p.amount;
             newlyAdded++;
             fixedToScola++;
           }
        }

        // 5. Update the student scolarite document totals
        if (newlyAdded > 0 || subtotalPaid !== (Number(s.total_verse) || 0)) {
           const totalDue = Number(s.montant_total_du) || 0;
           const newReste = Math.max(0, totalDue - subtotalPaid);
           let status = 'EN COURS';
           if (subtotalPaid === 0) status = 'NON PAYÉ';
           else if (subtotalPaid >= totalDue && totalDue > 0) status = 'SOLDÉ';
           
           await updateDoc(sDoc.ref, {
             total_verse: subtotalPaid,
             reste: newReste,
             statut_paiement: status,
             lastAudit: new Date().toISOString()
           });
           docCount++;
        }
      }

      addAuditMsg(`Audit terminé. ${pushedToLedger} entrées poussées au Grand Livre. ${fixedToScola} dossiers synchronisés.`);
      toast.success("Audit terminé avec succès.");
      fetchFinanceStats();
    } catch (error: any) {
      console.error("Audit error:", error);
      addAuditMsg("Erreur pendant l'audit: " + error.message, 'err');
      toast.error("Erreur lors de l'audit");
    } finally {
      setMaintenanceLoading(false);
    }
  };

  const handleMerge = async (survivor: any, victim: any) => {
    if (!isSuperAdmin) {
      toast.error("Permissions insuffisantes");
      return;
    }
    if (!window.confirm(`Êtes-vous sûr ? Tous les paiements de ${victim.nom_eleve} seront transférés vers ${survivor.nom_eleve}, et le compte doublon ${victim.eleve_id} sera supprimé.`)) {
      return;
    }

    try {
      setMaintenanceLoading(true);
      
      // 1. Get ALL scolarite records for the victim
      let victimScolas: any[] = [];
      const qScolaVictim = query(collection(db, 'scolarites'), where('eleve_id', '==', victim.eleve_id));
      try {
        const snap = await getDocs(qScolaVictim);
        victimScolas = snap.docs;
      } catch (e) {
        console.warn("Index query failed, falling back to ID-only victim fetch");
        // Fallback: at least try the victim record we already have
        const directDoc = await getDocs(query(collection(db, 'scolarites'), where('__name__', '==', victim.id)));
        victimScolas = directDoc.docs;
      }
      
      for (const scolaDoc of victimScolas) {
        // Move versements to the matching survivor scolarite record
        // We look for a survivor scola record for the same level if possible
        const levelId = scolaDoc.id.includes('_') ? scolaDoc.id.split('_')[1] : '';
        const survivorScolaId = levelId ? `${survivor.eleve_id}_${levelId}` : survivor.id;
        
        const versementsSnap = await getDocs(collection(db, 'scolarites', scolaDoc.id, 'versements'));
        for (const vDoc of versementsSnap.docs) {
          const vData = vDoc.data();
          await addDoc(collection(db, 'scolarites', survivorScolaId, 'versements'), {
            ...vData,
            mergeNote: `Fusionné depuis ${victim.matricule || victim.eleve_id}`
          });
          await deleteDoc(vDoc.ref);
        }
        await deleteDoc(scolaDoc.ref);
      }

      // 2. Update Finance records in global ledger
      const qFin = query(collection(db, 'finances'), where('studentId', '==', victim.eleve_id));
      try {
        const finSnap = await getDocs(qFin);
        for (const fDoc of finSnap.docs) {
          const fData = fDoc.data();
          let newDesc = fData.description || '';
          if (victim.matricule && survivor.matricule) {
            newDesc = newDesc.replace(new RegExp(victim.matricule, 'g'), survivor.matricule);
          }
          await updateDoc(fDoc.ref, { 
            studentId: survivor.eleve_id,
            studentMatricule: survivor.matricule,
            description: newDesc + " (Fusion de compte)"
          });
        }
      } catch (e) {
        console.warn("Finances merge failed, might need indexing.");
      }

      // 3. Delete victim user document if it exists and is different from survivor
      if (victim.eleve_id !== survivor.eleve_id) {
        try {
          await deleteDoc(doc(db, 'users', victim.eleve_id));
        } catch (e) {
          console.warn("Could not delete victim user doc (might not exist)");
        }
      }

      toast.success("Fusion réussie ! Les données ont été transférées vers " + survivor.nom_eleve);
      const updatedScolas = await fetchFinanceStats();
      if (updatedScolas) {
        // Automatically re-scan to clear the fixed duplicate from the list without reloading the whole page
        const nameMap: Record<string, any[]> = {};
        updatedScolas.forEach((s: any) => {
          const name = (s.nom_eleve || '').trim().toLowerCase();
          if (!name) return;
          if (!nameMap[name]) nameMap[name] = [];
          nameMap[name].push(s);
        });
        const dups = Object.values(nameMap).filter(group => group.length > 1);
        setDuplicates(dups);
      }
    } catch (err) {
      console.error(err);
      toast.error("Erreur lors de la fusion: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setMaintenanceLoading(false);
    }
  };

  const handleDeleteFinance = async (id: string, description: string) => {
    if (!isSuperAdmin) {
      toast.error("Désolé, seul un administrateur peut supprimer une transaction.");
      return;
    }

    if (!window.confirm(`Voulez-vous supprimer cette transaction : "${description}" ?\n\nNote: Cela annulera l'entrée dans le grand livre.`)) {
      return;
    }

    setMaintenanceLoading(true);
    try {
      const response = await fetch(`/api/finances/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${await auth.currentUser?.getIdToken()}`
        }
      });

      if (!response.ok) {
        throw new Error("Erreur serveur lors de la suppression");
      }

      toast.success("Transaction supprimée !");
      fetchFinanceStats();
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de la suppression");
    } finally {
      setMaintenanceLoading(false);
    }
  };

  const handleTransfer = async () => {
    if (transferAmount <= 0) return;
    if (transferAmount > data.caisseBalance) {
      alert("Fonds insuffisants en caisse");
      return;
    }

    try {
      setLoading(true);
      const now = new Date().toISOString();
      
      // 1. Expense from Cash
      await fetch('/api/finances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'expense',
          amount: transferAmount,
          description: `Transfert vers Banque: ${transferNotes || 'Dépôt hebdomadaire'}`,
          category: 'transfer',
          date: now,
          accountType: 'caisse',
          initiatedBy: 'secretary',
          status: 'active'
        })
      });

      // 2. Income to Bank
      await fetch('/api/finances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'income',
          amount: transferAmount,
          description: `Réception de Caisse: ${transferNotes || 'Dépôt hebdomadaire'}`,
          category: 'transfer',
          date: now,
          accountType: 'banque',
          initiatedBy: 'secretary',
          status: 'active'
        })
      });

      setShowTransferModal(false);
      setTransferAmount(0);
      setTransferNotes('');
      fetchFinanceStats();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleFirestoreError = (error: unknown, operationType: OperationType, path: string | null) => {
    const errInfo: FirestoreErrorInfo = {
      error: error instanceof Error ? error.message : String(error),
      authInfo: {
        userId: auth.currentUser?.uid,
        email: auth.currentUser?.email,
      },
      operationType,
      path
    };
    console.error('Firestore Error Detailed: ', JSON.stringify(errInfo));
    // Don't crash the whole app on a background data fetch failure, just log it
  };

  const fetchFinanceStats = async () => {
    setLoading(true);
    try {
      // Parallel fetch with catch for robustness
      const [financesSnap, teachersSnap, reportsSnap, levelsSnap, classesSnap, scolariteFinalSnap, allVersementsSnap] = await Promise.all([
        getDocs(collection(db, 'finances')),
        getDocs(query(collection(db, 'users'), where('role', '==', 'teacher'))),
        getDocs(collection(db, 'rapports_journaliers')),
        getDocs(collection(db, 'levels')),
        getDocs(collection(db, 'classes')),
        getDocs(collection(db, 'scolarites')),
        getDocs(collectionGroup(db, 'versements'))
      ].map(p => p.catch(e => { console.warn("Partial fetch failed:", e); return null; })));

      const levelsMap: Record<string, any> = {};
      if (levelsSnap) levelsSnap.forEach((doc: any) => { levelsMap[doc.id] = doc.data(); });
      
      const classesMap: Record<string, any> = {};
      if (classesSnap) classesSnap.forEach((doc: any) => { classesMap[doc.id] = doc.data(); });

      let totalRevenu = 0;
      const revenusDetails: Record<string, number> = { scolarite: 0, inscription: 0, autre: 0 };
      const monthlyRevenu: Record<number, number> = {};

      if (financesSnap) {
        financesSnap.forEach(doc => {
          const f = doc.data();
          const type = String(f?.type || '').toLowerCase();
          if (!f || type !== 'income' || f.deletedAt) return;
          
          const amount = Number(f.amount) || 0;
          if (amount <= 0) return;

          const dateVal = f.date || f.createdAt;
          const date = (dateVal && dateVal.toDate && typeof dateVal.toDate === 'function') 
            ? dateVal.toDate() 
            : (dateVal ? new Date(dateVal) : new Date());
          
          if (!isNaN(date.getTime()) && date.getFullYear() === selectedYear) {
            const cat = String(f.category || 'other').toLowerCase();
            const desc = String(f.description || '').toLowerCase();
            totalRevenu += amount;
            
            if (cat.includes('inscrip') || cat === 'registration' || desc.includes('inscription')) {
              revenusDetails.inscription += amount;
            } else if (cat.includes('scolarit') || cat === 'tuition' || desc.includes('scolarit')) {
              revenusDetails.scolarite += amount;
            } else {
              revenusDetails.autre += amount;
            }

            const mKey = date.getMonth();
            monthlyRevenu[mKey] = (monthlyRevenu[mKey] || 0) + amount;
          }
        });
      }

      const teacherSettings: Record<string, { hourlyRate: number, minStudents?: number }> = {};
      if (teachersSnap) {
        teachersSnap.forEach((doc: any) => {
          const t = doc.data();
          teacherSettings[doc.id] = {
            hourlyRate: t.hourlyRate || 3000,
            minStudents: t.minStudentsCondition
          };
        });
      }

      let totalSalaires = 0;
      const monthlySalaries: Record<number, number> = {};
      const classHours: Record<string, number> = {};
      const sessionDetails: any[] = [];

      if (reportsSnap) {
        const sortedReports = reportsSnap.docs
          .map(doc => ({ id: doc.id, ...doc.data() } as DailyReport))
          .filter(r => r.date)
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
   
        sortedReports.forEach(r => {
          const date = new Date(r.date);
          if (isNaN(date.getTime())) return;

          const cls = classesMap[r.classe_id];
          const level = cls ? levelsMap[cls.levelId] : null;
          const quota = level?.hours || 0;
          
          classHours[r.classe_id] = (classHours[r.classe_id] || 0) + (Number(r.duree_heures) || 0);
          const currentTotal = classHours[r.classe_id];
   
          if (date.getFullYear() === selectedYear) {
            const settings = teacherSettings[r.enseignant_id];
            const rate = settings?.hourlyRate || 3000;
            const minRequired = settings?.minStudents || 0;
            const isConditionMet = (Number(r.presents) || 0) >= minRequired;
            
            let status: 'ok' | 'insufficient' | 'excess' = 'ok';
            let remunerated = isConditionMet;
   
            if (quota > 0 && currentTotal > quota + 10) {
              status = 'excess';
              if (!r.valide_par_admin) remunerated = false;
            }
   
            const salaire = remunerated ? (Number(r.duree_heures) || 0) * rate : 0;
            
            if (date.getMonth() === selectedMonth) {
              sessionDetails.push({
                ...r,
                teacherName: r.enseignant_nom || 'Inconnu',
                isConditionMet,
                minRequired,
                rate,
                salaire,
                remunerated,
                currentTotal,
                quota,
                status
              });
            }
   
            totalSalaires += salaire;
            const mKey = date.getMonth();
            monthlySalaries[mKey] = (monthlySalaries[mKey] || 0) + salaire;
          }
        });
      }

      const classQuotas = Object.entries(classHours).map(([classId, total]) => {
        const cls = classesMap[classId];
        const level = cls ? (cls.levelId ? levelsMap[cls.levelId] : null) : null;
        const quota = level?.hours || 0;
        const diff = total - quota;
        
        let quotaStatus: 'insuffisant' | 'ok' | 'depassement' = 'ok';
        if (total < quota - 10) quotaStatus = 'insuffisant';
        else if (total > quota + 10) quotaStatus = 'depassement';

        return {
          className: cls?.name || 'Inconnue',
          total,
          quota,
          diff,
          status: quotaStatus
        };
      });

      let chargesSnap: any;
      try {
        chargesSnap = await getDocs(collection(db, 'charges'));
      } catch (error) {
        console.error("Error fetching charges:", error);
      }

      let totalChargesFixes = 0;
      let totalAllTimeCharges = 0;
      const monthlyCharges: Record<number, number> = {};

      if (chargesSnap) {
        chargesSnap.forEach(doc => {
          const c = doc.data() as Charge;
          if (!c || !c.date) return;
          const date = new Date(c.date);
          const montant = Number(c.montant) || 0;
          totalAllTimeCharges += montant;

          if (!isNaN(date.getTime()) && date.getFullYear() === selectedYear) {
            totalChargesFixes += montant;
            const mKey = date.getMonth();
            monthlyCharges[mKey] = (monthlyCharges[mKey] || 0) + montant;
          }
        });
      }

      let caisseBalance = 0;
      let banqueBalance = 0;
      const allFinances: any[] = [];

      // Set for orphan detection
      const linkedFinanceIds = new Set();
      const financesByDossier: Record<string, number> = {};

      if (financesSnap) {
        financesSnap.forEach(doc => {
          const f = { id: doc.id, ...doc.data() } as any;
          const dateVal = f.date || f.createdAt;
          if (!f || !dateVal || f.deletedAt) return;
          
          allFinances.push(f);
          const date = (dateVal.toDate && typeof dateVal.toDate === 'function') ? dateVal.toDate() : new Date(dateVal);
          const amount = Number(f.amount || 0);
          const type = String(f.type || '').toLowerCase();
          const isIncome = type === 'income';
          const accType = String(f.accountType || 'caisse').toLowerCase();

          if (accType === 'banque') {
            banqueBalance += isIncome ? amount : -amount;
          } else {
            caisseBalance += isIncome ? amount : -amount;
          }

          if (isIncome && (f.studentId || f.studentMatricule)) {
            const studentId = f.studentId || f.studentMatricule;
            // Map payment to potential dossiers
            const scolaKey = f.levelId ? `${studentId}_${f.levelId}` : studentId;
            financesByDossier[scolaKey] = (financesByDossier[scolaKey] || 0) + amount;
          }

          if (!isNaN(date.getTime()) && date.getFullYear() === selectedYear) {
            const mKey = date.getMonth();
            if (isIncome) {
              totalRevenu += amount;
              monthlyRevenu[mKey] = (monthlyRevenu[mKey] || 0) + amount;
              
              const cat = String(f.category || 'other').toLowerCase();
              const desc = String(f.description || '').toLowerCase();
              if (cat.includes('inscrip') || cat === 'registration' || desc.includes('inscription')) {
                revenusDetails.inscription += amount;
              } else if (cat.includes('scolarit') || cat === 'tuition' || desc.includes('scolarit')) {
                revenusDetails.scolarite += amount;
              } else {
                revenusDetails.autre += amount;
              }
            } else {
              totalChargesFixes += amount;
              monthlyCharges[mKey] = (monthlyCharges[mKey] || 0) + amount;
            }
          }
        });
      }

      // --- VERSEMENTS ANALYSIS (FOR STUDENT BALANCES ONLY) ---
      const versementsByStudent: Record<string, number> = {};
      if (allVersementsSnap) {
        const vDocs = (allVersementsSnap as any).docs || allVersementsSnap;
        vDocs.forEach((vDoc: any) => {
          const v = vDoc.data();
          const scolaId = vDoc.ref.parent.parent?.id;
          if (scolaId) {
            versementsByStudent[scolaId] = (versementsByStudent[scolaId] || 0) + (Number(v.montant) || 0);
          }
          
          if (v.financeId) {
            linkedFinanceIds.add(v.financeId);
          }
        });
      }
      // Note: We no longer add "orphan" versements to the GLOBAL balance automatically.
      // They must be explicitly fixed via the Audit tool to appear in the Grand Livre.
      // -------------------------------------------------------

      const scolarites = scolariteFinalSnap?.docs.map((d: any) => {
        const s = d.data();
        const scolaId = d.id;
        const studentId = s.eleve_id || (scolaId.includes('_') ? scolaId.split('_')[0] : scolaId);
        const subCollectionPaid = versementsByStudent[scolaId] || 0;
        const financeReportedPaid = financesByDossier[scolaId] || financesByDossier[studentId] || 0;
        
        // We take the max to be safe if sync was partial, as the user complained about mismatched balances
        const totalPaid = Math.max(subCollectionPaid, financeReportedPaid);
        const totalDue = Number(s.montant_total_du) || 0;
        const reste = Math.max(0, totalDue - totalPaid);
        
        let statut = 'NON PAYÉ';
        if (totalPaid >= totalDue && totalDue > 0) statut = 'SOLDÉ';
        else if (totalPaid > 0) statut = 'EN COURS';
 
        return {
          id: scolaId,
          eleve_id: studentId,
          ...s,
          nom_eleve: s.nom_eleve || '',
          total_verse: totalPaid,
          reste: reste,
          statut_paiement: statut
        };
      }) || [];

      // Formatter l'historique pour le graphique
      const history = Array.from({ length: 12 }, (_, i) => ({
        month: new Date(2000, i).toLocaleDateString('fr-FR', { month: 'short' }),
        revenus: monthlyRevenu[i] || 0,
        charges: (monthlySalaries[i] || 0) + (monthlyCharges[i] || 0),
        resultat: (monthlyRevenu[i] || 0) - ((monthlySalaries[i] || 0) + (monthlyCharges[i] || 0))
      }));

      setData({
        revenus: totalRevenu || 0,
        chargesFixes: totalChargesFixes || 0,
        chargesSalariales: totalSalaires || 0,
        revenusDetails: revenusDetails || { scolarite: 0, inscription: 0, autre: 0 },
        history: history || [],
        classQuotas: classQuotas || [],
        sessionDetails: sessionDetails || [],
        scolarites: scolarites || [],
        caisseBalance,
        banqueBalance,
        allFinances: allFinances.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
        levelsMap
      });
      return scolarites || [];
    } catch (err) {
      console.error("Erreur Dashboard Financier (Détails):", err);
      return [];
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFinanceStats();
  }, [selectedYear]);

  const totalCharges = data.chargesFixes + data.chargesSalariales;
  const resultatNet = data.revenus - totalCharges;

  const SortIcon = ({ currentSort, column }: { currentSort: { key: string, direction: 'asc' | 'desc' }, column: string }) => {
    if (currentSort.key !== column) return <ArrowRightLeft size={10} className="rotate-90 opacity-20" />;
    return currentSort.direction === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />;
  };

  const filteredFinances = data.allFinances.filter(f => {
    const matchesAccount = activeTab === 'all' || (f.accountType || 'caisse') === activeTab;
    const matchesLevel = selectedLevel === 'all' || f.levelId === selectedLevel;
    return matchesAccount && matchesLevel;
  });

  const sortedSessions = React.useMemo(() => {
    return [...(data.sessionDetails || [])].sort((a, b) => {
      const { key, direction } = sessionSort;
      let aVal = a[key];
      let bVal = b[key];
      if (key === 'date') {
        aVal = new Date(aVal || 0).getTime();
        bVal = new Date(bVal || 0).getTime();
      }
      if (aVal < bVal) return direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [data.sessionDetails, sessionSort]);

  const sortedScolarites = React.useMemo(() => {
    return [...(data.scolarites || [])].sort((a, b) => {
      const { key, direction } = scolaSort;
      let aVal = a[key];
      let bVal = b[key];
      if (key === 'reste' || key === 'total_verse' || key === 'montant_total_du') {
        aVal = Number(aVal || 0);
        bVal = Number(bVal || 0);
        if (aVal < bVal) return direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return direction === 'asc' ? 1 : -1;
      } else {
        const sA = String(aVal || '').trim();
        const sB = String(bVal || '').trim();
        const comp = sA.localeCompare(sB, 'fr', { sensitivity: 'base' });
        return direction === 'asc' ? comp : -comp;
      }
      return 0;
    });
  }, [data.scolarites, scolaSort]);

  const sortedFilteredFinances = React.useMemo(() => {
    return [...filteredFinances].sort((a, b) => {
      const { key, direction } = financeSort;
      let aVal = a[key];
      let bVal = b[key];
      if (key === 'date') {
        aVal = new Date(aVal || 0).getTime();
        bVal = new Date(bVal || 0).getTime();
      } else if (key === 'amount') {
        aVal = Number(aVal || 0);
        bVal = Number(bVal || 0);
      } else if (key === 'levelId') {
        aVal = aVal ? (data.levelsMap[aVal]?.name || '').toLowerCase() : '';
        bVal = bVal ? (data.levelsMap[bVal]?.name || '').toLowerCase() : '';
      } else {
        aVal = String(aVal || '').toLowerCase();
        bVal = String(bVal || '').toLowerCase();
      }
      if (aVal < bVal) return direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredFinances, financeSort]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-dia-red"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Date Filter */}
      <div className="flex items-center gap-4 bg-white dark:bg-neutral-900 p-4 rounded-2xl border border-neutral-100 dark:border-neutral-800">
        <Filter size={18} className="text-dia-red" />
        <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">Analyse de l'année</span>
        <select 
          value={selectedYear} 
          onChange={(e) => setSelectedYear(Number(e.target.value))}
          className="bg-neutral-100 dark:bg-neutral-800 px-4 py-2 rounded-xl text-sm font-bold outline-none"
        >
          {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <button 
          onClick={() => {
            setShowMaintenanceModal(true);
            scanForDuplicates();
          }}
          className="px-4 py-2 bg-neutral-100 dark:bg-neutral-800 text-neutral-500 rounded-xl text-[10px] font-black uppercase hover:bg-neutral-200 transition-all flex items-center gap-2 border border-neutral-200 dark:border-neutral-700 ml-4"
        >
          <Search size={14} /> Maintenance & Doublons
        </button>
        <button onClick={fetchFinanceStats} className="ml-auto p-2 bg-dia-red/5 text-dia-red rounded-lg hover:bg-dia-red/10">
          <Activity size={18} />
        </button>
        <button 
          onClick={() => {
            const msg = `━━━━━━━━━━━━━━━━━━━━━━━\n💰 *BILAN FINANCIER*\n*${APP_NAME_FOR_LINKS}*\n━━━━━━━━━━━━━━━━━━━━━━━\n\n📅 *Période* : Année ${selectedYear}\n\n🟢 *Revenus* : ${formatCurrency(data.revenus)}\n🔴 *Charges* : ${formatCurrency(totalCharges)}\n\n💎 *RÉSULTAT NET* : *${formatCurrency(resultatNet)}*\n\nDocument généré le ${new Date().toLocaleDateString()}\n━━━━━━━━━━━━━━━━━━━━━━━`;
            const a = document.createElement('a');
            a.href = generateWhatsAppLink('', msg);
            a.target = '_blank';
            a.click();
          }}
          className="p-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition-colors"
          title="Partager via WhatsApp"
        >
          <Smartphone size={18} />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card p-6 border-l-4 border-l-dia-red bg-dia-red/5">
          <div className="flex justify-between items-center mb-2">
            <div className="p-2 bg-dia-red text-white rounded-lg">
              <Landmark size={24} />
            </div>
            <button 
              onClick={() => setShowTransferModal(true)}
              className="flex items-center gap-1 px-3 py-1 bg-white text-dia-red rounded-lg text-[10px] font-black uppercase shadow-sm border border-dia-red/20"
            >
              <ArrowRightLeft size={14} /> Vider la Caisse
            </button>
          </div>
          <h4 className="text-3xl font-black">{formatCurrency(data.caisseBalance)}</h4>
          <p className="text-xs font-bold text-neutral-400 uppercase tracking-widest mt-1">Solde Actuel - Caisse</p>
        </div>

        <div className="card p-6 border-l-4 border-l-blue-500 bg-blue-50/10">
          <div className="flex justify-between items-center mb-2">
            <div className="p-2 bg-blue-500 text-white rounded-lg">
              <CreditCard size={24} />
            </div>
          </div>
          <h4 className="text-3xl font-black text-blue-600">{formatCurrency(data.banqueBalance)}</h4>
          <p className="text-xs font-bold text-neutral-400 uppercase tracking-widest mt-1">Solde Actuel - Banque</p>
        </div>
      </div>

      {/* Account Tabs */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex p-1 bg-neutral-100 dark:bg-neutral-800 rounded-xl w-fit">
          <button 
            onClick={() => setActiveTab('all')}
            className={cn(
              "px-6 py-2 rounded-lg text-xs font-black uppercase transition-all",
              activeTab === 'all' ? "bg-white dark:bg-neutral-900 text-dia-red shadow-sm" : "text-neutral-400"
            )}
          >
            Vue d'ensemble
          </button>
          <button 
            onClick={() => setActiveTab('caisse')}
            className={cn(
              "px-6 py-2 rounded-lg text-xs font-black uppercase transition-all",
              activeTab === 'caisse' ? "bg-white dark:bg-neutral-900 text-dia-red shadow-sm" : "text-neutral-400"
            )}
          >
            Comptabilité Caisse
          </button>
          <button 
            onClick={() => setActiveTab('banque')}
            className={cn(
              "px-6 py-2 rounded-lg text-xs font-black uppercase transition-all",
              activeTab === 'banque' ? "bg-white dark:bg-neutral-900 text-blue-600 shadow-sm" : "text-neutral-400"
            )}
          >
            Comptabilité Banque
          </button>
        </div>

        {activeTab !== 'all' && (
          <div className="flex items-center gap-2 bg-neutral-100 dark:bg-neutral-800 px-4 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700">
            <span className="text-[10px] font-black uppercase text-neutral-400">Filtrer par Niveau:</span>
            <select 
              value={selectedLevel}
              onChange={(e) => setSelectedLevel(e.target.value)}
              className="bg-transparent border-none outline-none text-[10px] font-bold"
            >
              <option value="all">Tous les niveaux</option>
              {Object.entries(data.levelsMap).map(([id, level]: [string, any]) => (
                <option key={id} value={id}>{level.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {activeTab === 'all' ? (
        <>
          {/* Main Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="card p-6 border-l-4 border-l-green-500">
          <div className="flex justify-between items-start mb-2">
            <div className="p-2 bg-green-50 rounded-lg text-green-600">
              <TrendingUp size={20} />
            </div>
          </div>
          <h4 className="text-2xl font-black">{formatCurrency(data.revenus)}</h4>
          <p className="text-xs font-bold text-neutral-400 uppercase tracking-widest mt-1">Revenus Totaux</p>
        </div>

        <div className="card p-6 border-l-4 border-l-dia-red">
          <div className="flex justify-between items-start mb-2">
            <div className="p-2 bg-dia-red/5 rounded-lg text-dia-red">
              <TrendingDown size={20} />
            </div>
          </div>
          <h4 className="text-2xl font-black">{formatCurrency(totalCharges)}</h4>
          <p className="text-xs font-bold text-neutral-400 uppercase tracking-widest mt-1">Charges Totales</p>
        </div>

        <div className="card p-6 border-l-4 border-l-neutral-400 bg-neutral-50 dark:bg-neutral-800/50">
          <div className="space-y-4">
            <div>
              <p className="text-[10px] font-bold text-neutral-400 uppercase">Salaire Enseignants</p>
              <p className="text-sm font-bold">{formatCurrency(data.chargesSalariales)}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-neutral-400 uppercase">Charges de Fonctionnement</p>
              <p className="text-sm font-bold">{formatCurrency(data.chargesFixes)}</p>
            </div>
          </div>
        </div>

        <div className={cn(
          "card p-6 border-l-4 shadow-lg flex flex-col justify-center",
          resultatNet >= 0 ? "border-l-blue-500 bg-blue-50/10" : "border-l-red-500 bg-red-50/10"
        )}>
          <h4 className={cn("text-3xl font-black", resultatNet >= 0 ? "text-blue-600" : "text-red-600")}>
            {formatCurrency(resultatNet)}
          </h4>
          <p className="text-xs font-medium text-neutral-500 uppercase tracking-widest mt-1">Résultat Net {selectedYear}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Breakdown */}
        <div className="card p-6">
          <h5 className="font-bold mb-4 flex items-center gap-2 text-dia-red">
            <DollarSign size={18} />
            Répartition des Recettes
          </h5>
          <div className="space-y-4">
            {Object.entries((data as any).revenusDetails || {}).filter(([_, val]) => (val as number) > 0).map(([cat, val]) => (
              <div key={cat} className="flex flex-col gap-1">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold uppercase text-neutral-500">{cat.replace('_', ' ')}</span>
                  <span className="font-mono font-bold">{formatCurrency(val as number)}</span>
                </div>
                <div className="h-1.5 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-dia-red" 
                    style={{ width: `${Math.min(100, ((val as number) / (data.revenus || 1)) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Class Quotas Monitoring */}
        <div className="card p-6 lg:col-span-1">
          <h5 className="font-bold mb-4 flex items-center gap-2 text-dia-red">
            <Activity size={18} />
            Suivi des Quotas par Classe
          </h5>
          <div className="space-y-3">
            {data.classQuotas.length === 0 ? (
              <p className="text-xs text-neutral-500 italic">Aucune donnée de quota.</p>
            ) : (
              data.classQuotas.map((cq: any, idx: number) => (
                <div key={idx} className="p-3 bg-neutral-50 dark:bg-neutral-800/50 rounded-xl border border-neutral-100 dark:border-neutral-800">
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-sm font-bold">{cq.className}</span>
                    <span className={cn(
                      "text-[10px] font-bold uppercase px-2 py-0.5 rounded-full",
                      cq.status === 'ok' ? "bg-green-100 text-green-700" :
                      cq.status === 'depassement' ? "bg-red-100 text-red-700" : "bg-red-100 text-red-700"
                    )}>
                      {cq.status === 'depassement' ? "Quota Dépassé" : cq.status === 'insuffisant' ? "Insuffisant" : "Quota OK"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="flex-1 h-1.5 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
                      <div 
                        className={cn("h-full", (cq.status === 'depassement' || cq.status === 'insuffisant') ? "bg-red-500" : "bg-dia-red")}
                        style={{ width: `${Math.min(100, (cq.total / (cq.quota || 1)) * 100)}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-mono font-bold text-neutral-500">{cq.total.toFixed(1)}/{cq.quota}h</span>
                  </div>
                  {cq.status !== 'ok' && (
                    <p className={cn("text-[10px] font-bold", "text-red-500")}>
                      {cq.status === 'depassement' ? `⚠️ Dépassement de ${cq.diff.toFixed(1)}h` : `❌ Insuffisant (Reste ${Math.abs(cq.diff).toFixed(1)}h)`}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
          <p className="text-[10px] text-neutral-400 mt-4 italic">
            Note: Une marge de ±10h est tolérée avant signalement.
          </p>
        </div>

        {/* Charts Section */}
        <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="card p-6">
            <h5 className="font-bold mb-6 flex items-center gap-2">
              <PieChartIcon size={18} className="text-dia-red" />
              Évolution Mensuelle
            </h5>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.history}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 700}} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 700}} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  formatter={(value) => formatCurrency(Number(value))}
                />
                <Bar dataKey="revenus" fill="#22c55e" radius={[4, 4, 0, 0]} name="Revenus" />
                <Bar dataKey="charges" fill="#ef4444" radius={[4, 4, 0, 0]} name="Charges" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card p-6">
          <h5 className="font-bold mb-6 flex items-center gap-2">
            <Activity size={18} className="text-dia-red" />
            Performance des Résultats
          </h5>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.history}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 700}} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 700}} />
                <Tooltip 
                   contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                   formatter={(value) => formatCurrency(Number(value))}
                />
                <Line type="monotone" dataKey="resultat" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4, fill: '#3b82f6' }} name="Résultat Net" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>

      {/* Salary Details Table */}
      <div className="card overflow-hidden">
        <div className="p-6 border-b border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 flex items-center justify-between">
          <h5 className="font-bold flex items-center gap-2">
            <Clock size={18} className="text-dia-red" />
            Détails des Sessions (Salaires Enseignants)
          </h5>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-neutral-50 dark:bg-neutral-800/50 border-b border-neutral-200 dark:border-neutral-800">
                <th className="px-6 py-4 font-bold uppercase tracking-wider text-[10px] text-neutral-500 cursor-pointer hover:text-dia-red transition-all" onClick={() => setSessionSort(p => ({ key: 'date', direction: p.key === 'date' && p.direction === 'desc' ? 'asc' : 'desc' }))}>
                  <div className="flex items-center gap-1">Date / Enseignant <SortIcon currentSort={sessionSort} column="date" /></div>
                </th>
                <th className="px-6 py-4 font-bold uppercase tracking-wider text-[10px] text-neutral-500">Séance / Présents</th>
                <th className="px-6 py-4 font-bold uppercase tracking-wider text-[10px] text-neutral-500 text-center">Durée</th>
                <th className="px-6 py-4 font-bold uppercase tracking-wider text-[10px] text-neutral-500 text-center">Taux / Min.</th>
                <th className="px-6 py-4 font-bold uppercase tracking-wider text-[10px] text-neutral-500 text-right cursor-pointer hover:text-dia-red transition-all" onClick={() => setSessionSort(p => ({ key: 'salaire', direction: p.key === 'salaire' && p.direction === 'desc' ? 'asc' : 'desc' }))}>
                   <div className="flex items-center justify-end gap-1">Salaire <SortIcon currentSort={sessionSort} column="salaire" /></div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {sortedSessions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-neutral-500 italic">Aucune séance soumise ce mois.</td>
                </tr>
              ) : (
                sortedSessions.map((s: any, idx: number) => (
                  <tr key={idx} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/30 transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-bold">{s.date ? new Date(s.date).toLocaleDateString() : 'N/A'}</p>
                      <p className="text-xs text-neutral-400">{s.teacherName || 'Enseignant'}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-medium text-xs">{s.matiere}</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        <p className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-full", s.isConditionMet ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700")}>
                          {s.presents} présents {!s.isConditionMet && `(Min ${s.minRequired})`}
                        </p>
                        {s.status === 'excess' && (
                          <p className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-full", s.valide_par_admin ? "bg-blue-100 text-blue-700" : "bg-red-500 text-white animate-pulse")}>
                            {s.valide_par_admin ? "Dépassement Validé" : "⚠️ Dépassement Non Payé"}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <p className="font-mono font-bold text-neutral-600">{s.duree_heures}h</p>
                      <p className="text-[9px] text-neutral-400">Total: {s.currentTotal.toFixed(1)}/{s.quota}h</p>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <p className="text-xs font-bold text-neutral-500">{formatCurrency(s.rate)}/h</p>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <p className={cn("font-black", s.isConditionMet ? "text-neutral-900" : "line-through text-neutral-300")}>
                        {formatCurrency(s.salaire)}
                      </p>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Global Tuition Summary Table */}
      <div className="card overflow-hidden">
        <div className="p-6 border-b border-neutral-100 dark:border-neutral-800 bg-orange-50/50 flex items-center justify-between">
          <h5 className="font-bold flex items-center gap-2 text-orange-600">
            <PieChartIcon size={18} />
            État Global des Scolarités (Tous les élèves)
          </h5>
          <div className="flex gap-2">
             <span className="text-[10px] font-black bg-white px-2 py-1 rounded-lg border border-orange-200">
              Total Dû: {formatCurrency((data.scolarites || []).reduce((acc, s) => acc + (s.montant_total_du || 0), 0))}
             </span>
             <span className="text-[10px] font-black bg-white px-2 py-1 rounded-lg border border-orange-200 text-green-600">
              Total Encaissé: {formatCurrency((data.scolarites || []).reduce((acc, s) => acc + (s.total_verse || 0), 0))}
             </span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-neutral-50 dark:bg-neutral-800/50 border-b border-neutral-200 dark:border-neutral-800">
                <th className="px-6 py-4 font-bold uppercase tracking-wider text-[10px] text-neutral-500 cursor-pointer hover:text-dia-red transition-all" onClick={() => setScolaSort(p => ({ key: 'nom_eleve', direction: p.key === 'nom_eleve' && p.direction === 'asc' ? 'desc' : 'asc' }))}>
                  <div className="flex items-center gap-1">Élève <SortIcon currentSort={scolaSort} column="nom_eleve" /></div>
                </th>
                <th className="px-6 py-4 font-bold uppercase tracking-wider text-[10px] text-neutral-500 cursor-pointer hover:text-dia-red transition-all" onClick={() => setScolaSort(p => ({ key: 'statut_paiement', direction: p.key === 'statut_paiement' && p.direction === 'asc' ? 'desc' : 'asc' }))}>
                  <div className="flex items-center gap-1">Statut <SortIcon currentSort={scolaSort} column="statut_paiement" /></div>
                </th>
                <th className="px-6 py-4 font-bold uppercase tracking-wider text-[10px] text-neutral-500 text-right cursor-pointer hover:text-dia-red transition-all" onClick={() => setScolaSort(p => ({ key: 'montant_total_du', direction: p.key === 'montant_total_du' && p.direction === 'asc' ? 'desc' : 'asc' }))}>
                  <div className="flex items-center justify-end gap-1">Total Dû <SortIcon currentSort={scolaSort} column="montant_total_du" /></div>
                </th>
                <th className="px-6 py-4 font-bold uppercase tracking-wider text-[10px] text-neutral-500 text-right cursor-pointer hover:text-dia-red transition-all" onClick={() => setScolaSort(p => ({ key: 'total_verse', direction: p.key === 'total_verse' && p.direction === 'asc' ? 'desc' : 'asc' }))}>
                  <div className="flex items-center justify-end gap-1">Versé <SortIcon currentSort={scolaSort} column="total_verse" /></div>
                </th>
                <th className="px-6 py-4 font-bold uppercase tracking-wider text-[10px] text-neutral-500 text-right text-dia-red cursor-pointer hover:text-dia-red transition-all" onClick={() => setScolaSort(p => ({ key: 'reste', direction: p.key === 'reste' && p.direction === 'asc' ? 'desc' : 'asc' }))}>
                  <div className="flex items-center justify-end gap-1">Reste <SortIcon currentSort={scolaSort} column="reste" /></div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {sortedScolarites.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-neutral-500 italic">Aucune donnée de scolarité trouvée.</td>
                </tr>
              ) : (
                sortedScolarites.map((s: any, idx: number) => (
                  <tr key={idx} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/30 transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-bold uppercase text-xs">{s.nom_eleve}</p>
                      <p className="text-[10px] text-neutral-400">{s.matricule}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "text-[9px] font-black uppercase px-2 py-0.5 rounded-md",
                        s.statut_paiement === 'SOLDÉ' ? "bg-green-100 text-green-700" :
                        s.statut_paiement === 'SURPLUS' ? "bg-purple-100 text-purple-700" :
                        s.statut_paiement === 'NON PAYÉ' ? "bg-red-100 text-red-700" : "bg-orange-100 text-orange-700"
                      )}>
                        {s.statut_paiement}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right font-medium">{formatCurrency(s.montant_total_du || 0)}</td>
                    <td className="px-6 py-4 text-right font-black text-green-600">{formatCurrency(s.total_verse || 0)}</td>
                    <td className="px-6 py-4 text-right font-black text-dia-red">{formatCurrency(s.reste || 0)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
        </>
      ) : (
        <div className="card overflow-hidden animate-in fade-in slide-in-from-bottom-5 duration-700">
          <div className={cn(
            "p-6 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between",
            activeTab === 'caisse' ? "bg-dia-red/5" : "bg-blue-50/20"
          )}>
            <h5 className={cn("font-black uppercase text-sm flex items-center gap-2", activeTab === 'caisse' ? "text-dia-red" : "text-blue-600")}>
              {activeTab === 'caisse' ? <Landmark size={18} /> : <CreditCard size={18} />}
              Comptabilité : {activeTab === 'caisse' ? 'Caisse (Espèces)' : 'Banque (Virements)'}
            </h5>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black p-2 bg-white dark:bg-neutral-900 rounded-lg shadow-sm border border-neutral-200 dark:border-neutral-700">
                Solde : {formatCurrency(activeTab === 'caisse' ? data.caisseBalance : data.banqueBalance)}
              </span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-neutral-50 dark:bg-neutral-800/50 border-b border-neutral-200 dark:border-neutral-800">
                  <th className="px-6 py-4 font-bold uppercase tracking-wider text-[10px] text-neutral-500 cursor-pointer hover:text-dia-red transition-all" onClick={() => setFinanceSort(p => ({ key: 'date', direction: p.key === 'date' && p.direction === 'desc' ? 'asc' : 'desc' }))}>
                    <div className="flex items-center gap-1">Date <SortIcon currentSort={financeSort} column="date" /></div>
                  </th>
                  <th className="px-6 py-4 font-bold uppercase tracking-wider text-[10px] text-neutral-500 cursor-pointer hover:text-dia-red transition-all" onClick={() => setFinanceSort(p => ({ key: 'initiatedBy', direction: p.key === 'initiatedBy' && p.direction === 'desc' ? 'asc' : 'desc' }))}>
                    <div className="flex items-center gap-1">Initiateur <SortIcon currentSort={financeSort} column="initiatedBy" /></div>
                  </th>
                  <th className="px-6 py-4 font-bold uppercase tracking-wider text-[10px] text-neutral-500 cursor-pointer hover:text-dia-red transition-all" onClick={() => setFinanceSort(p => ({ key: 'description', direction: p.key === 'description' && p.direction === 'desc' ? 'asc' : 'desc' }))}>
                    <div className="flex items-center gap-1">Description <SortIcon currentSort={financeSort} column="description" /></div>
                  </th>
                  <th className="px-6 py-4 font-bold uppercase tracking-wider text-[10px] text-neutral-500 cursor-pointer hover:text-dia-red transition-all" onClick={() => setFinanceSort(p => ({ key: 'levelId', direction: p.key === 'levelId' && p.direction === 'desc' ? 'asc' : 'desc' }))}>
                    <div className="flex items-center gap-1">Niveau <SortIcon currentSort={financeSort} column="levelId" /></div>
                  </th>
                  <th className="px-6 py-4 font-bold uppercase tracking-wider text-[10px] text-neutral-500 text-center cursor-pointer hover:text-dia-red transition-all" onClick={() => setFinanceSort(p => ({ key: 'category', direction: p.key === 'category' && p.direction === 'desc' ? 'asc' : 'desc' }))}>
                    <div className="flex items-center justify-center gap-1">Catégorie <SortIcon currentSort={financeSort} column="category" /></div>
                  </th>
                  <th className="px-6 py-4 font-bold uppercase tracking-wider text-[10px] text-neutral-500 text-right cursor-pointer hover:text-dia-red transition-all" onClick={() => setFinanceSort(p => ({ key: 'amount', direction: p.key === 'amount' && p.direction === 'desc' ? 'asc' : 'desc' }))}>
                    <div className="flex items-center justify-end gap-1">Montant <SortIcon currentSort={financeSort} column="amount" /></div>
                  </th>
                  {isSuperAdmin && <th className="px-6 py-4 font-bold uppercase tracking-wider text-[10px] text-neutral-500 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                {sortedFilteredFinances.length === 0 ? (
                  <tr>
                    <td colSpan={isSuperAdmin ? 7 : 6} className="px-6 py-10 text-center text-neutral-500 italic">Aucune opération trouvée pour ce compte.</td>
                  </tr>
                ) : (
                  sortedFilteredFinances.map((f: any) => (
                    <tr key={f.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/30 transition-colors">
                      <td className="px-6 py-4 font-mono text-xs">{new Date(f.date).toLocaleDateString()}</td>
                      <td className="px-6 py-4">
                        <span className={cn(
                          "text-[9px] font-black uppercase px-2 py-0.5 rounded-full",
                          f.initiatedBy === 'secretary' ? "bg-purple-100 text-purple-700" :
                          f.initiatedBy === 'student' ? "bg-dia-red/10 text-dia-red" : "bg-neutral-100 text-neutral-500"
                        )}>
                          {f.initiatedBy === 'secretary' ? 'Secrétariat' : f.initiatedBy === 'student' ? 'Élève' : (f.initiatedBy || 'Système')}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-bold text-xs">{f.description}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-[10px] font-black uppercase text-neutral-400">
                          {f.levelId ? (data.levelsMap[f.levelId]?.name || 'N/A') : 'N/A'}
                        </p>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="text-[10px] bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 rounded-md font-bold text-neutral-500 uppercase">{f.category}</span>
                      </td>
                      <td className={cn(
                        "px-6 py-4 text-right font-black",
                        f.type === 'income' ? "text-green-600" : "text-dia-red"
                      )}>
                        {f.type === 'income' ? '+' : '-'}{formatCurrency(f.amount)}
                      </td>
                      {isSuperAdmin && (
                        <td className="px-6 py-4 text-right">
                          <button 
                            onClick={() => handleDeleteFinance(f.id, f.description)}
                            className="p-2 text-neutral-300 hover:text-dia-red hover:bg-dia-red/10 rounded-lg transition-all"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Transfer Modal */}
      {showTransferModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white dark:bg-neutral-900 w-full max-w-md rounded-3xl overflow-hidden shadow-2xl"
          >
            <div className="p-6 border-b border-neutral-100 dark:border-neutral-800 bg-dia-red text-white">
              <h3 className="text-xl font-black uppercase flex items-center gap-2">
                <ArrowRightLeft size={24} /> Vider la Caisse
              </h3>
              <p className="text-white/70 text-xs mt-1 font-bold">Transfert des espèces vers le compte bancaire</p>
            </div>
            
            <div className="p-8 space-y-6">
              <div className="bg-dia-red/5 p-4 rounded-2xl border border-dia-red/10">
                <p className="text-[10px] font-black text-dia-red uppercase mb-1">Disponible en Caisse</p>
                <p className="text-2xl font-black">{formatCurrency(data.caisseBalance)}</p>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-neutral-400 uppercase">Montant à transférer (Dépôt)</label>
                <div className="relative">
                   <input 
                    type="number"
                    value={transferAmount}
                    onChange={(e) => setTransferAmount(Number(e.target.value))}
                    placeholder="0"
                    className="w-full p-4 bg-neutral-50 dark:bg-neutral-800 border-2 border-neutral-100 dark:border-neutral-800 rounded-2xl text-2xl font-black focus:border-dia-red outline-none transition-all"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 font-black text-neutral-400">FCFA</span>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-neutral-400 uppercase">Notes / Référence du dépôt</label>
                <textarea 
                  value={transferNotes}
                  onChange={(e) => setTransferNotes(e.target.value)}
                  placeholder="Ex: Versement hebdomadaire ECOBANK..."
                  className="w-full p-4 bg-neutral-50 dark:bg-neutral-800 border-2 border-neutral-100 dark:border-neutral-800 rounded-2xl text-sm font-bold min-h-[100px] outline-none"
                />
              </div>

              <div className="flex gap-4 pt-4">
                <button 
                  onClick={() => setShowTransferModal(false)}
                  className="flex-1 py-4 bg-neutral-100 dark:bg-neutral-800 text-neutral-500 rounded-2xl text-xs font-black uppercase hover:bg-neutral-200 transition-colors"
                >
                  Annuler
                </button>
                <button 
                  onClick={handleTransfer}
                  disabled={loading || transferAmount <= 0}
                  className="flex-1 py-4 bg-dia-red text-white rounded-2xl text-xs font-black uppercase shadow-lg shadow-dia-red/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
                >
                  Confirmé le Dépôt
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Maintenance Modal */}
      <AnimatePresence>
        {showMaintenanceModal && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setShowMaintenanceModal(false)} />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative bg-white dark:bg-neutral-900 rounded-[2rem] w-full max-w-4xl max-h-[85vh] overflow-hidden shadow-2xl flex flex-col">
              <div className="flex items-center justify-between p-8 border-b border-neutral-100 dark:border-neutral-800 bg-neutral-900">
                <div>
                  <h3 className="text-2xl font-black uppercase tracking-tighter text-white flex items-center gap-3">
                    <ShieldCheck size={28} className="text-dia-red" /> Maintenance & Réconciliation
                  </h3>
                  <p className="text-xs font-bold text-neutral-400">Outils de diagnostic et d'intégrité de la base de données</p>
                </div>
                <button onClick={() => setShowMaintenanceModal(false)} className="p-3 bg-white/10 rounded-2xl hover:bg-white/20 transition-all text-white">
                  <X />
                </button>
              </div>

              <div className="p-8 overflow-y-auto space-y-8 flex-1">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <button onClick={handleRepairLevels} disabled={maintenanceLoading} className="p-6 text-left border border-neutral-200 dark:border-neutral-800 rounded-3xl hover:bg-neutral-50 dark:hover:bg-neutral-800/40 transition-all group disabled:opacity-50">
                    <UserCheck className="mb-4 text-dia-red group-hover:scale-110 transition-transform" />
                    <h4 className="font-bold mb-1">Dossiers Élèves</h4>
                    <p className="text-[10px] text-neutral-500">Synchronise les profils (identités, matricules) avec les dossiers scolarité.</p>
                  </button>

                  <button onClick={handleAuditRepair} disabled={maintenanceLoading} className="p-6 text-left border border-neutral-200 dark:border-neutral-800 rounded-3xl hover:bg-neutral-50 dark:hover:bg-neutral-800/40 transition-all group disabled:opacity-50">
                    <ShieldCheck className="mb-4 text-emerald-500 group-hover:scale-110 transition-transform" />
                    <h4 className="font-bold mb-1">Audit Global</h4>
                    <p className="text-[10px] text-neutral-500">Recalcule tous les soldes élèves. Récancrage des transactions orphelines.</p>
                  </button>

                  <button 
                    onClick={scanForDuplicates} 
                    disabled={maintenanceLoading}
                    className={cn(
                      "p-6 text-left border rounded-3xl transition-all group disabled:opacity-50",
                      maintenanceStatus === 'scanning' ? "bg-amber-50 border-amber-200 dark:bg-amber-900/10 border-amber-800" : "border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/40"
                    )}
                  >
                    <Users className="mb-4 text-amber-500 group-hover:scale-110 transition-transform" />
                    <h4 className="font-bold mb-1">Scanner Doublons</h4>
                    <p className="text-[10px] text-neutral-500">Identifie les comptes multiples pour un même élève pour fusion.</p>
                  </button>
                </div>

                {maintenanceStatus === 'ready' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h5 className="text-xs font-black uppercase text-neutral-400 tracking-widest">Doublons Identifiés ({duplicates.length})</h5>
                      {duplicates.length === 0 && <span className="text-xs text-emerald-500 font-bold">Base de données propre !</span>}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {duplicates.map((group, idx) => {
                        const sortedGroup = [...group].sort((a,b) => (b.total_verse || 0) - (a.total_verse || 0));
                        const survivor = sortedGroup[0];
                        const victims = sortedGroup.slice(1);

                        return (
                          <div key={idx} className="p-5 bg-neutral-50 dark:bg-neutral-800/30 rounded-2xl border border-neutral-100 dark:border-neutral-800">
                            <div className="flex items-center justify-between mb-4">
                              <span className="text-sm font-black uppercase">{survivor.nom_eleve}</span>
                              <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-600 text-[8px] font-black rounded uppercase">Doublon</span>
                            </div>
                            <div className="space-y-2">
                              {victims.map((v: any) => (
                                <div key={v.id} className="flex items-center justify-between p-3 bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-700">
                                  <div className="text-[9px] space-y-0.5">
                                    <p className="font-bold">Victime: <span className="text-dia-red">{v.matricule || v.id.slice(0,8)}</span></p>
                                    <p>Payé: {formatCurrency(v.total_verse)}</p>
                                  </div>
                                  <button 
                                    onClick={() => handleMerge(survivor, v)}
                                    disabled={maintenanceLoading}
                                    className="px-3 py-1.5 bg-dia-red text-white text-[9px] font-black uppercase rounded-lg hover:bg-neutral-900 disabled:opacity-50 transition-all"
                                  >
                                    Fusionner
                                  </button>
                                </div>
                              ))}
                            </div>
                            <div className="mt-3 p-2 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-800 rounded-lg text-[9px] text-emerald-600 font-bold">
                              Compte cible: {survivor.matricule || survivor.id.slice(0,8)} ({formatCurrency(survivor.total_verse)})
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                
                {auditLog.length > 0 && (
                  <div className="p-6 bg-neutral-900 rounded-3xl space-y-2 max-h-48 overflow-y-auto border border-white/5">
                    <p className="text-[10px] font-black text-dia-red uppercase mb-2">Logs d'opération</p>
                    {auditLog.map((log, i) => (
                      <div key={i} className={cn("text-[9px] font-mono leading-relaxed", log.type === 'err' ? 'text-red-400' : 'text-neutral-400')}>
                        <span className="text-white/20">[{new Date().toLocaleTimeString()}]</span> {log.msg}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="pt-6 mt-8 border-t border-neutral-100 dark:border-neutral-800">
        <div className="bg-neutral-900 text-white p-8 rounded-[2rem] space-y-6">
           <div className="flex items-center justify-between">
             <h5 className="text-xs font-black uppercase tracking-widest text-dia-red">Statut du Système & Cache</h5>
             <button 
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-2"
              >
                <RefreshCw size={14} /> Rafraîchir
              </button>
           </div>
           
           <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
                <p className="text-[10px] text-white/40 uppercase font-bold mb-1">Dossiers</p>
                <p className="text-lg font-black">{data.scolarites.length}</p>
              </div>
              <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
                <p className="text-[10px] text-white/40 uppercase font-bold mb-1">Dépenses</p>
                <p className="text-lg font-black">{data.allFinances.filter(f => f.type === 'expense').length}</p>
              </div>
              <div className="bg-white/5 p-4 rounded-2xl border border-white/10 opacity-50">
                <p className="text-[10px] text-white/40 uppercase font-bold mb-1">Année</p>
                <p className="text-lg font-black">{selectedYear}</p>
              </div>
              <div className="bg-white/5 p-4 rounded-2xl border border-white/10 opacity-50">
                <p className="text-[10px] text-white/40 uppercase font-bold mb-1">Réseau</p>
                <p className="text-lg font-black text-emerald-500">OK</p>
              </div>
           </div>
           <p className="text-[10px] text-white/30 italic text-center">Les soldes sont synchronisés en temps réel avec le Grand Livre de l'institut.</p>
        </div>
      </div>
    </div>
  );
}

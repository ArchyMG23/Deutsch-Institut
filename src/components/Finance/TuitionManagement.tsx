import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { collection, query, where, getDocs, doc, setDoc, updateDoc, getDoc, addDoc, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { Student, StudentScolarite, Versement, SchoolConfig, Level } from '../../types';
import { Search, CreditCard, Printer, History as HistoryIcon, AlertCircle, CheckCircle2, User, Landmark, Share2, Send, MessageCircle, Edit2, X, Check, Trash2, RefreshCw, Plus } from 'lucide-react';
import { formatCurrency, cn } from '../../utils';
import { toast } from 'sonner';
import { jsPDF } from 'jspdf';
import { addAuditLog } from '../../utils/auditLogger';
import { useAuth, OperationType, FirestoreErrorInfo } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { auth } from '../../firebase';
import { generateWhatsAppLink, APP_NAME_FOR_LINKS } from '../../utils/contactLinks';
import { FinanceService } from '../../services/financeService';

interface TuitionManagementProps {
  students: Student[];
  levels: Level[];
  onUpdate?: () => void;
}

const TuitionManagement: React.FC<TuitionManagementProps> = ({ students: propStudents, levels: propLevels, onUpdate }) => {
  const { user, profile, fetchWithAuth } = useAuth();
  const { refreshFinances } = useData();
  const isSuperAdmin = 
    profile?.role === 'admin' || 
    profile?.isSuperAdmin || 
    user?.role === 'admin' || 
    user?.isSuperAdmin || 
    user?.email?.toLowerCase() === 'gabrielyombi311@gmail.com' ||
    user?.email?.toLowerCase() === 'yombivictor@gmail.com';
  
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
    console.error('Firestore Error Detailed (Tuition): ', JSON.stringify(errInfo));
    throw new Error(JSON.stringify(errInfo));
  };
  const [matricule, setMatricule] = useState('');
  const [targetStudent, setTargetStudent] = useState<Student | null>(null);
  const [scolarite, setScolarite] = useState<StudentScolarite | null>(null);
  const [scolariteHistory, setScolariteHistory] = useState<StudentScolarite[]>([]);
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);
  const [versements, setVersements] = useState<Versement[]>([]);
  const [loading, setLoading] = useState(false);
  const [studentsList, setStudentsList] = useState<Student[]>(propStudents || []);
  const [levels, setLevels] = useState<Level[]>(propLevels || []);
  const [schoolConfig, setSchoolConfig] = useState<SchoolConfig>({
    id: 'current',
    nom: 'DIA DEUTSCH INSTITUT',
    logo_url: '',
    annee_scolaire: '2025-2026',
    format_recu: 'A5'
  });

  const currentStudentLevel = levels.find(l => l.id === targetStudent?.levelId);
  const studentStream = currentStudentLevel?.stream || 'N/A';
  const studentLevelName = currentStudentLevel?.name || 'N/A';

  // Sync with props
  useEffect(() => {
    if (propStudents) setStudentsList(propStudents);
  }, [propStudents]);

  useEffect(() => {
    if (propLevels) setLevels(propLevels);
  }, [propLevels]);

  // Form state
  const [amount, setAmount] = useState<number>(0);
  const [paymentMode, setPaymentMode] = useState<Versement['mode_paiement']>('Espèces');
  const [paymentCategory, setPaymentCategory] = useState<Versement['categorie']>('scolarite');
  const [paymentDate, setPaymentDate] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [accountType, setAccountType] = useState<'caisse' | 'banque'>('caisse');
  const [initiatedBy, setInitiatedBy] = useState<'student' | 'secretary'>('student');
  const [editingVersementId, setEditingVersementId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState<number>(0);
  const [editNotes, setEditNotes] = useState('');
  const [editDate, setEditDate] = useState<string>('');

  const hasPaidInscription = versements.some(v => v.categorie === 'inscription');

  useEffect(() => {
    if (paymentCategory === 'inscription') {
      const isA1 = (scolarite?.niveau || '').toLowerCase().includes('a1');
      if (isA1) {
        setAmount(10000);
      } else {
        setAmount(0);
        toast.info("Le système suggère 0 frais d'inscription pour ce niveau (Non-A1).");
      }
    }
  }, [paymentCategory, scolarite?.niveau]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const configSnap = await getDoc(doc(db, 'ecole', 'current'));
        if (configSnap.exists()) setSchoolConfig(configSnap.data() as SchoolConfig);
      } catch (e) {
        handleFirestoreError(e, OperationType.GET, 'ecole/current');
      }

      if (!propLevels || propLevels.length === 0) {
        try {
          const levelsSnap = await getDocs(collection(db, 'levels'));
          setLevels(levelsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Level)));
        } catch (e) {
          handleFirestoreError(e, OperationType.LIST, 'levels');
        }
      }

      if (!propStudents || propStudents.length === 0) {
        try {
          const studentsSnap = await getDocs(query(collection(db, 'users'), where('role', '==', 'student')));
          setStudentsList(studentsSnap.docs.map(d => ({ uid: d.id, ...d.data() } as Student)));
        } catch (e) {
          handleFirestoreError(e, OperationType.LIST, 'users (students query)');
        }
      }
    };
    fetchData();
  }, [propLevels, propStudents]);

  // Handle studentId from URL params (important for navigation from StudentManagement)
  useEffect(() => {
    const hashParts = window.location.hash.split('?');
    if (hashParts.length > 1) {
      const params = new URLSearchParams(hashParts[1]);
      const studentId = params.get('studentId');
      if (studentId && studentsList.length > 0) {
        const student = studentsList.find(s => s.uid === studentId);
        if (student && (!targetStudent || targetStudent.uid !== studentId)) {
          selectStudent(student);
        }
      }
    }
  }, [studentsList, targetStudent]);

  const cumulativeTotals = React.useMemo(() => {
    if (!scolarite) return null;
    const totalPaid = versements.reduce((acc, v) => acc + (Number(v.montant) || 0), 0);
    const totalDue = scolarite.montant_total_du || 0;
    const remains = Math.max(0, totalDue - totalPaid);
    const surplus = Math.max(0, totalPaid - totalDue);
    let status: StudentScolarite['statut_paiement'] = 'NON PAYÉ';
    if (surplus > 0 || (totalPaid >= totalDue && totalDue > 0)) status = 'SOLDÉ';
    else if (totalPaid > 0) status = 'EN COURS';

    return { totalPaid, remains, surplus, status };
  }, [versements, scolarite]);

  const handleAddNewDossier = async (levelName: string, tuition: number) => {
    if (!targetStudent) return;
    setLoading(true);
    try {
      const newId = `${targetStudent.uid}_${levelName.replace(/\s+/g, '_')}_${Date.now()}`;
      const newDossier: StudentScolarite = {
        id: newId,
        eleve_id: targetStudent.uid,
        matricule: targetStudent.matricule,
        nom_eleve: `${targetStudent.lastName} ${targetStudent.firstName}`,
        classe_id: targetStudent.classId || 'N/A',
        filiere: 'Spécial',
        niveau: levelName,
        montant_total_du: tuition,
        total_verse: 0,
        reste: tuition,
        surplus: 0,
        statut_paiement: 'NON PAYÉ',
        createdAt: new Date().toISOString()
      };
      
      await setDoc(doc(db, 'scolarites', newId), newDossier);
      toast.success(`Dossier pour ${levelName} créé.`);
      
      // Update history and select it
      setScolariteHistory(prev => [newDossier, ...prev]);
      setScolarite(newDossier);
      setSelectedHistoryId(newId);
    } catch (err) {
      toast.error("Erreur creation dossier");
    } finally {
      setLoading(false);
    }
  };

  const selectStudent = async (student: Student, forceLevelId?: string) => {
    setLoading(true);
    setTargetStudent(student);
    setMatricule(student.matricule);
    
    try {
      // 1. Fetch ALL scolarite records for this student to build history
      const qScolaE = query(collection(db, 'scolarites'), where('eleve_id', '==', student.uid));
      const snapE = await getDocs(qScolaE);
      
      const qScolaM = query(collection(db, 'scolarites'), where('matricule', '==', student.matricule));
      const snapM = await getDocs(qScolaM);

      const scolaDocs = new Map();
      snapE.forEach(d => scolaDocs.set(d.id, { id: d.id, ...d.data() }));
      snapM.forEach(d => {
        if (!scolaDocs.has(d.id)) scolaDocs.set(d.id, { id: d.id, ...d.data() });
      });

      let history = Array.from(scolaDocs.values()) as StudentScolarite[];

      // Robustness: ensure the default record (ID = student.uid) is included even if fields were missing
      if (!scolaDocs.has(student.uid)) {
        const directDoc = await getDoc(doc(db, 'scolarites', student.uid));
        if (directDoc.exists()) {
          const directData = { id: directDoc.id, ...directDoc.data() } as StudentScolarite;
          // Fix missing eleve_id field if needed
          if (!directData.eleve_id) {
            await updateDoc(doc(db, 'scolarites', student.uid), { eleve_id: student.uid });
            directData.eleve_id = student.uid;
          }
          history.push(directData);
        }
      }

      // Sort history by date (newest first)
      history.sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      });

      setScolariteHistory(history);

      // 2. Identify the active record
      let activeScola: StudentScolarite | null = null;
      const currentLevel = levels.find(l => l.id === student.levelId);
      
      if (forceLevelId) {
        activeScola = history.find(h => h.id === forceLevelId) || null;
      } else if (currentLevel) {
        // Find scolarite that matches current student level name EXACTLY
        activeScola = history.find(h => h.niveau === currentLevel.name);
        
        if (!activeScola) {
          // Fallback: if there's only one record and it's the student.uid one, use it 
          // (it might just need a level name update if the student was just created)
          const defaultScola = history.find(h => h.id === student.uid);
          if (defaultScola && (history.length === 1 || !defaultScola.niveau || defaultScola.niveau === 'Niveau non défini')) {
            activeScola = defaultScola;
          }
        }
      }

      const studentLevel = levels.find(l => l.id === student.levelId);
      const levelTuition = studentLevel?.tuition || 110000;
      
      const recordLevelName = activeScola?.niveau || studentLevel?.name || 'N/A';
      const isA1 = (recordLevelName || '').toLowerCase().includes('a1');
      const registrationFee = isA1 ? 10000 : 0;
      const defaultTuition = levelTuition + registrationFee;
      
      const stream = studentLevel?.stream || 'N/A';
      const levelName = studentLevel?.name || 'N/A';

      if (activeScola) {
        // SYNCHRONIZATION LOGIC: 
        // If the record corresponds to the student's current level name,
        // ensure the filiere and level metadata are correctly synced with the level document.
        const shouldSync = (activeScola.niveau === levelName && activeScola.filiere !== stream) || 
                          (!activeScola.niveau || activeScola.niveau === 'Niveau non défini') ||
                          (activeScola.id === student.uid && !activeScola.niveau);

        if (shouldSync) {
           await updateDoc(doc(db, 'scolarites', activeScola.id), { 
             niveau: levelName,
             filiere: stream,
             montant_total_du: activeScola.montant_total_du || defaultTuition
           });
           activeScola.niveau = levelName;
           activeScola.filiere = stream;
        }
        setScolarite(activeScola);
        setSelectedHistoryId(activeScola.id);
      } else {
        // Create new record for this level for the student (ID: uid_levelId)
        const newId = `${student.uid}_${student.levelId}`;
        const initialScolarite: StudentScolarite = {
          id: newId,
          eleve_id: student.uid,
          matricule: student.matricule,
          nom_eleve: `${student.lastName} ${student.firstName}`,
          classe_id: student.classId || 'N/A',
          filiere: stream,
          niveau: levelName,
          montant_total_du: defaultTuition,
          total_verse: 0,
          reste: defaultTuition,
          surplus: 0,
          statut_paiement: 'NON PAYÉ',
          createdAt: new Date().toISOString()
        };
        try {
          await setDoc(doc(db, 'scolarites', newId), initialScolarite);
        } catch (e) {
          handleFirestoreError(e, OperationType.WRITE, `scolarites/${newId}`);
        }
        setScolarite(initialScolarite);
        setSelectedHistoryId(initialScolarite.id);
        const newHistory = [...history, initialScolarite].sort((a, b) => {
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return dateB - dateA;
        });
        setScolariteHistory(newHistory);
        activeScola = initialScolarite;
      }

      // 3. Fetch versements for the selected record
      let versemntsSnap;
      try {
        versemntsSnap = await getDocs(collection(db, 'scolarites', activeScola.id, 'versements'));
      } catch (e) {
        handleFirestoreError(e, OperationType.LIST, `scolarites/${activeScola.id}/versements`);
      }
      
      const vListRaw = versemntsSnap!.docs.map(d => ({ id: d.id, ...d.data() } as Versement));
      
      // Deduplicate vList against itself
      const vList: Versement[] = [];
      vListRaw.forEach(current => {
        const isDup = vList.some(kept => 
          (kept.financeId && current.financeId && kept.financeId === current.financeId) ||
          (Math.abs(new Date(kept.date).getTime() - new Date(current.date).getTime()) < 5 * 60 * 1000 && Math.abs((kept.montant || 0) - (current.montant || 0)) < 1)
        );
        if (!isDup) vList.push(current);
      });
      
      // --- CROSS-SYNC WITH GENERAL FINANCES ---
      let financeList: any[] = [];
      try {
        const qFin = query(
          collection(db, 'finances'), 
          where('studentId', '==', student.uid), 
          where('type', '==', 'income'),
          where('levelId', '==', student.levelId) // Try to filter by level if available
        );
        const finSnap = await getDocs(qFin);
        financeList = finSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        const qMat = query(collection(db, 'finances'), where('studentMatricule', '==', student.matricule), where('type', '==', 'income'));
        const matSnap = await getDocs(qMat);
        matSnap.forEach(d => {
           const data = d.data();
           // Only add if not already in list AND (no levelId on finance OR matches current selected level record's level)
           if (!financeList.find(f => f.id === d.id)) {
             if (!data.levelId || (activeScola && data.description?.includes(activeScola.niveau || ''))) {
               financeList.push({ id: d.id, ...data });
             }
           }
        });
      } catch (finErr) {
        console.error("Failed to fetch general finances:", finErr);
      }

      const mergedHistory = [...vList];
      financeList.forEach(fin => {
        const isAlreadyInHistory = mergedHistory.some(v => 
          v.financeId === fin.id || v.id === fin.id ||
          (Math.abs(new Date(v.date).getTime() - new Date(fin.date).getTime()) < 10 * 60 * 1000 && Math.abs((v.montant || 0) - (fin.amount || 0)) < 1)
        );
        
        if (!isAlreadyInHistory) {
          mergedHistory.push({
            id: fin.id,
            montant: fin.amount,
            date: fin.date,
            mode_paiement: 'Autre' as any,
            categorie: (fin.category === 'registration' || fin.category === 'inscription') ? 'inscription' : 'scolarite',
            recu_numero: 'AUTO-FIN',
            caissier_id: fin.initiatedBy || 'Système',
            notes: `[Finance] ${fin.description || ''}`,
            financeId: fin.id
          } as Versement);
        }
      });
      
      mergedHistory.sort((a,b) => {
        const dateA = a.date ? new Date(a.date).getTime() : 0;
        const dateB = b.date ? new Date(b.date).getTime() : 0;
        return dateB - dateA;
      });

      setVersements(mergedHistory);

      // --- DYNAMIC RE-CALCULATION ---
      const totalPaid = mergedHistory.reduce((acc, v) => acc + (Number(v.montant) || 0), 0);
      const finalTuition = activeScola.montant_total_du || defaultTuition;

      const updatedScolarite = {
        ...activeScola,
        total_verse: totalPaid,
        reste: Math.max(0, finalTuition - totalPaid),
        surplus: Math.max(0, totalPaid - finalTuition),
        statut_paiement: totalPaid >= finalTuition ? 'SOLDÉ' : (totalPaid > 0 ? 'EN COURS' : 'NON PAYÉ')
      } as StudentScolarite;

      setScolarite(updatedScolarite);
      await setDoc(doc(db, 'scolarites', activeScola.id), updatedScolarite);
    } catch (err) {
      console.error(err);
      toast.error("Erreur de chargement");
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!matricule.trim()) return;
    const student = studentsList.find(s => s.matricule.toLowerCase() === matricule.trim().toLowerCase());
    if (student) {
      selectStudent(student);
    } else {
      toast.error("Aucun élève trouvé avec ce matricule");
    }
  };

  const generateReceiptNumber = () => {
    const year = new Date().getFullYear();
    const seq = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `REC-${year}-${seq}`;
  };

  const handleAddPayment = async () => {
    if (!targetStudent || !scolarite || amount <= 0) return;
    
    if (!paymentDate) {
      toast.error("Veuillez sélectionner une date de versement.");
      return;
    }

    setLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const finalDate = paymentDate === today 
        ? new Date().toISOString() 
        : new Date(paymentDate + 'T12:00:00Z').toISOString();

      // Ensure we target the SPECIFIC level selected in current dossier
      const actualLevelId = scolarite.levelId || (scolarite.id.includes('_') ? scolarite.id.split('_')[1] : targetStudent.levelId);

      await FinanceService.recordPayment({
        amount: amount,
        description: `${paymentCategory.charAt(0).toUpperCase() + paymentCategory.slice(1)} [${scolarite.niveau}] - ${targetStudent.lastName} ${targetStudent.firstName}`,
        category: paymentCategory === 'inscription' ? 'registration' : 'tuition',
        date: finalDate,
        studentId: targetStudent.uid,
        studentName: `${targetStudent.lastName} ${targetStudent.firstName}`,
        studentMatricule: targetStudent.matricule,
        levelId: actualLevelId,
        paymentMethod: paymentMode,
        accountType: accountType,
        receiptNumber: generateReceiptNumber()
      });

      toast.success(`Versement pour ${scolarite.niveau} enregistré atomiquement.`);
      
      // Force global finance refresh to ensure dashboards match
      await refreshFinances();
      
      // Refresh strictly the current student/level combo
      await selectStudent(targetStudent, scolarite.id);
      
      if (onUpdate) onUpdate();
      setAmount(0);
      setNotes('');
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Erreur lors de l'enregistrement");
    } finally {
      setLoading(false);
    }
  };

  const handleGeneratePDF = (versement: Versement) => {
    if (!targetStudent || !scolarite) return;
    
    const doc = new jsPDF({
      orientation: schoolConfig?.format_recu === 'A5' ? 'landscape' : 'portrait',
      unit: 'mm',
      format: schoolConfig?.format_recu === 'A5' ? 'a5' : [80, 200]
    });

    const isThermic = schoolConfig?.format_recu?.startsWith('thermique');
    const margin = isThermic ? 5 : 15;
    let y = 15;

    // Header
    doc.setFontSize(isThermic ? 12 : 18);
    doc.text(schoolConfig?.nom || "DIA DEUTSCH INSTITUT", isThermic ? 40 : 105, y, { align: 'center' });
    y += isThermic ? 6 : 10;
    
    doc.setFontSize(isThermic ? 10 : 14);
    doc.text(`REÇU DE PAIEMENT ${versement.recu_numero}`, isThermic ? 40 : 105, y, { align: 'center' });
    y += isThermic ? 8 : 12;

    doc.setFontSize(isThermic ? 8 : 11);
    doc.text(`Date: ${new Date(versement.date).toLocaleString()}`, margin, y);
    y += 6;

    doc.line(margin, y, isThermic ? 75 : 195, y);
    y += 10;

    // Student Info
    doc.setFontSize(isThermic ? 9 : 12);
    doc.text(`Élève: ${targetStudent.lastName} ${targetStudent.firstName}`, margin, y);
    y += 6;
    doc.text(`Matricule: ${targetStudent.matricule}`, margin, y);
    y += 6;
    doc.text(`Classe: ${scolarite.classe_id}`, margin, y);
    y += 10;

    // Payment Info
    doc.setFontSize(isThermic ? 10 : 13);
    doc.text(`MONTANT DU VERSEMENT: ${formatCurrency(versement.montant)}`, margin, y);
    y += 8;
    doc.setFontSize(isThermic ? 8 : 10);
    doc.text(`Mode: ${versement.mode_paiement}`, margin, y);
    y += 6;

    doc.line(margin, y, isThermic ? 75 : 195, y);
    y += 10;

    // Summary
    doc.text(`Total Scolarité: ${formatCurrency(scolarite.montant_total_du)}`, margin, y);
    y += 6;
    doc.text(`Déjà Versé (incl. ceci): ${formatCurrency(scolarite.total_verse)}`, margin, y);
    y += 6;
    
    if (scolarite.statut_paiement === 'SURPLUS') {
      doc.setTextColor(255, 0, 0);
      doc.text(`SURPLUS: ${formatCurrency(scolarite.surplus)}`, margin, y);
    } else {
      doc.text(`Reste à payer: ${formatCurrency(scolarite.reste)}`, margin, y);
    }
    doc.setTextColor(0, 0, 0);
    y += 10;

    if (scolarite.statut_paiement === 'SOLDÉ') {
      doc.setFontSize(isThermic ? 12 : 16);
      doc.text("--- COMPTE SOLDÉ ---", isThermic ? 40 : 105, y, { align: 'center' });
      y += 10;
    }

    // Footer
    doc.setFontSize(8);
    doc.text("Ce reçu tient lieu de preuve de paiement officielle.", isThermic ? 40 : 105, y + 10, { align: 'center' });

    doc.save(`Recu_${versement.recu_numero}.pdf`);
  };

  const handleDeletePayment = async (versementId: string) => {
    if (!targetStudent || !scolarite || !isSuperAdmin) {
      if (!isSuperAdmin) toast.error("Droit super-administrateur requis.");
      return;
    }
    
    const reason = window.prompt("Raison de l'annulation :");
    if (!reason) return;

    setLoading(true);
    try {
      const versement = versements.find(v => v.id === versementId);
      const idToReverse = versement?.financeId || versementId;

      await FinanceService.reverseTransaction(idToReverse, reason);

      toast.success("Transaction annulée et solde corrigé (Atomique).");
      await selectStudent(targetStudent, scolarite.id);
      
      if (onUpdate) onUpdate();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Erreur lors de l'annulation");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePayment = async (versementId: string) => {
    if (!targetStudent || !scolarite || !isSuperAdmin) return;

    setLoading(true);
    try {
      const versementToUpdate = versements.find(v => v.id === versementId);
      if (!versementToUpdate) return;

      // 1. Update the versement in subcollection
      const newDateStr = editDate ? new Date(editDate + 'T12:00:00Z').toISOString() : undefined;
      const updateData: any = {
        montant: editAmount,
        notes: editNotes,
        updated_at: serverTimestamp(),
        updated_by: user.uid
      };
      if (newDateStr) {
          updateData.date = newDateStr;
      }
      
      await updateDoc(doc(db, 'scolarites', scolarite.id, 'versements', versementId), updateData);

      // 2. Sync with global finances if financeId exists
      if (versementToUpdate.financeId) {
        try {
          await fetchWithAuth(`/api/finances/${versementToUpdate.financeId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              amount: editAmount,
              date: newDateStr || versementToUpdate.date
            })
          });
        } catch (finErr) {
          console.error("Finance update failed:", finErr);
        }
      } else {
        // Fallback: try to find the finance record by studentId and older amount
        try {
            const financesRes = await fetchWithAuth('/api/finances');
            if (financesRes.ok) {
                const allFinances = await financesRes.json();
                const relatedFinance = allFinances.find((f: any) => 
                    (f.studentId === targetStudent.uid || (f.description && f.description.includes(targetStudent.matricule))) && 
                    f.amount === versementToUpdate.montant &&
                    new Date(f.date).toDateString() === new Date(versementToUpdate.date).toDateString()
                );
                if (relatedFinance) {
                    await fetchWithAuth(`/api/finances/${relatedFinance.id}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            amount: editAmount,
                            date: newDateStr || versementToUpdate.date
                        })
                    });
                    // Store the found ID back to the versement for future use
                    await updateDoc(doc(db, 'scolarites', scolarite.id, 'versements', versementId), {
                        financeId: relatedFinance.id
                    });
                }
            }
        } catch (fallbackErr) {
            console.error("Finance fallback update failed:", fallbackErr);
        }
      }

      // 3. Recalculate totals
      let updatedVersements = versements.map(v => 
        v.id === versementId ? { ...v, montant: editAmount, notes: editNotes, date: newDateStr || v.date } : v
      );

      // 4. Re-sort local list so it "moves" to correct position
      updatedVersements.sort((a,b) => {
        const dateA = a.date ? new Date(a.date).getTime() : 0;
        const dateB = b.date ? new Date(b.date).getTime() : 0;
        return dateB - dateA;
      });
      
      const newTotalPaid = updatedVersements.reduce((acc, v) => acc + (Number(v.montant) || 0), 0);
      const newReste = Math.max(0, scolarite.montant_total_du - newTotalPaid);
      const newSurplus = Math.max(0, newTotalPaid - scolarite.montant_total_du);
      
      let newStatut: StudentScolarite['statut_paiement'] = 'EN COURS';
      if (newSurplus > 0) newStatut = 'SURPLUS';
      else if (newReste === 0) newStatut = 'SOLDÉ';

      const updatedScolarite = {
        ...scolarite,
        total_verse: newTotalPaid,
        reste: newReste,
        surplus: newSurplus,
        statut_paiement: newStatut
      };

      await updateDoc(doc(db, 'scolarites', scolarite.id), updatedScolarite);
      
      setScolarite(updatedScolarite);
      setVersements(updatedVersements);
      setEditingVersementId(null);
      
      addAuditLog("VERSEMENT_MODIFIÉ", targetStudent.uid, { 
        versementId, 
        ancien_montant: versements.find(v => v.id === versementId)?.montant,
        nouveau_montant: editAmount 
      });

      toast.success("Versement mis à jour et totaux recalculés !");
    } catch (error) {
      console.error(error);
      toast.error("Erreur lors de la mise à jour");
    } finally {
      setLoading(false);
    }
  };

  const [searchTerm, setSearchTerm] = useState('');
  const [sidebarSort, setSidebarSort] = useState<'name' | 'matricule' | 'date'>('name');

  const filteredStudentsList = React.useMemo(() => {
    const filtered = studentsList.filter(s => 
      s.firstName.toLowerCase().includes(searchTerm.toLowerCase()) || 
      s.lastName.toLowerCase().includes(searchTerm.toLowerCase()) || 
      s.matricule.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return [...filtered].sort((a, b) => {
      if (sidebarSort === 'name') {
        return `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`);
      } else if (sidebarSort === 'matricule') {
        return a.matricule.localeCompare(b.matricule);
      } else if (sidebarSort === 'date') {
        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      }
      return 0;
    });
  }, [studentsList, searchTerm, sidebarSort]);

  return (
    <div className="flex flex-col xl:flex-row gap-6 h-[calc(100vh-200px)] overflow-hidden">
      {/* LEFT SIDEBAR: Navigable Student List */}
      <div className="xl:w-80 flex flex-col bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-neutral-100 dark:border-neutral-800 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-black uppercase text-[10px] flex items-center gap-2">
              <User size={14} className="text-dia-red" /> Liste des Élèves
            </h3>
            <select 
              value={sidebarSort}
              onChange={(e) => setSidebarSort(e.target.value as any)}
              className="text-[10px] font-bold bg-neutral-100 dark:bg-neutral-800 rounded px-2 py-1 outline-none border-none"
            >
              <option value="name">A-Z</option>
              <option value="matricule">N° Matricule</option>
              <option value="date">Date d'ajout</option>
            </select>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={16} />
            <input 
              type="text"
              placeholder="Rechercher un élève..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl outline-none focus:ring-2 focus:ring-dia-red/20"
            />
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {loading && studentsList.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2 opacity-50">
               <div className="w-8 h-8 border-2 border-dia-red border-t-transparent rounded-full animate-spin" />
               <p className="text-xs font-bold">Chargement...</p>
            </div>
          ) : filteredStudentsList.length === 0 ? (
            <div className="text-center py-10 opacity-50">
               <p className="text-xs italic">Aucun élève trouvé</p>
            </div>
          ) : (
            filteredStudentsList.map(s => (
              <button 
                key={s.uid}
                onClick={() => selectStudent(s)}
                className={cn(
                  "w-full flex items-center gap-3 p-3 rounded-xl transition-all text-left",
                  targetStudent?.uid === s.uid 
                    ? "bg-dia-red text-white shadow-lg shadow-dia-red/20" 
                    : "hover:bg-neutral-50 dark:hover:bg-neutral-800 group"
                )}
              >
                <div className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center shrink-0",
                  targetStudent?.uid === s.uid ? "bg-white/20" : "bg-neutral-100 dark:bg-neutral-800 group-hover:bg-white dark:group-hover:bg-neutral-700"
                )}>
                  <User size={18} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-black truncate">{s.lastName} {s.firstName}</p>
                  <p className={cn("text-[10px] font-bold", targetStudent?.uid === s.uid ? "text-white/70" : "text-dia-red")}>{s.matricule}</p>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* RIGHT CONTENT AREA */}
      <div className="flex-1 overflow-y-auto pr-2 space-y-6">
        {!targetStudent ? (
          <div className="flex flex-col items-center justify-center h-full bg-white dark:bg-neutral-900 border-2 border-dashed border-neutral-200 dark:border-neutral-800 rounded-3xl p-10 text-center">
            <div className="w-20 h-20 bg-neutral-100 dark:bg-neutral-800 rounded-full flex items-center justify-center mb-4 text-neutral-400">
               <Landmark size={40} />
            </div>
            <h3 className="text-xl font-black mb-2">Sélectionnez un élève</h3>
            <p className="text-neutral-500 max-w-sm text-sm">Choisissez un élève dans la liste de gauche pour gérer ses versements, voir son historique ou générer un reçu.</p>
          </div>
        ) : (loading || !scolarite) ? (
          <div className="flex flex-col items-center justify-center h-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-10 text-center">
            <div className="w-16 h-16 border-4 border-dia-red border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-neutral-500 font-bold">Chargement des données de {targetStudent.firstName}...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="lg:col-span-2 space-y-6">
                <div className="space-y-6">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-100 dark:border-neutral-800 pb-3">
              <div className="flex items-center gap-2">
                <HistoryIcon size={16} className="text-dia-red" />
                <h3 className="text-[11px] font-black uppercase text-neutral-900 dark:text-neutral-100">Historique des Niveaux (Cycles)</h3>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-2 min-h-[60px] max-w-full sm:max-w-[75%] no-scrollbar bg-neutral-50/50 dark:bg-neutral-800/30 p-2 rounded-xl border border-neutral-100 dark:border-neutral-800">
                {scolariteHistory.map(h => (
                  <button
                    key={h.id}
                    onClick={() => selectStudent(targetStudent!, h.id)}
                    className={cn(
                      "px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all whitespace-nowrap flex flex-col items-center gap-1 border-2",
                      selectedHistoryId === h.id 
                        ? "bg-dia-red border-dia-red text-white shadow-md shadow-dia-red/20 scale-105" 
                        : "bg-white dark:bg-neutral-800 border-neutral-100 dark:border-neutral-700 text-neutral-500 hover:bg-neutral-50"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      {h.niveau || 'Ancien'}
                      {h.statut_paiement === 'SOLDÉ' && <CheckCircle2 size={12} className={selectedHistoryId === h.id ? "text-white" : "text-green-500"} />}
                    </div>
                    <span className={cn("text-[8px] opacity-70", selectedHistoryId === h.id ? "text-white" : "text-neutral-400")}>
                      {h.filiere || 'Général'}
                    </span>
                  </button>
                ))}

                <button
                  onClick={() => {
                    const levelName = window.prompt("Entrez le titre du nouveau dossier (ex: Vorbereitung, Re-inscription B1, etc.) :");
                    if (levelName) {
                      const matchingLevel = propLevels.find(l => l.name.toLowerCase() === levelName.toLowerCase());
                      const baseTuition = matchingLevel?.tuition || 110000;
                      handleAddNewDossier(levelName, baseTuition);
                    }
                  }}
                  className="px-4 py-2 rounded-xl border-2 border-dashed border-neutral-200 dark:border-neutral-700 text-neutral-400 hover:border-dia-red hover:text-dia-red transition-all flex flex-col items-center justify-center gap-1 min-w-[100px]"
                >
                  <Plus size={16} />
                  <span className="text-[8px] font-black uppercase">Nouveau Dossier</span>
                </button>
              </div>
            </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-neutral-50 dark:bg-neutral-800/50 rounded-xl p-3 border border-neutral-100 dark:border-neutral-700">
                        <p className="text-[9px] font-black uppercase text-neutral-400 mb-1">Dossier de Scolarité Sélectionné</p>
                        <div className="flex items-center justify-between gap-4">
                          {isSuperAdmin ? (
                            <div className="flex-1 flex flex-col gap-1">
                              <input 
                                type="text"
                                value={scolarite.niveau || ''}
                                onChange={(e) => setScolarite({...scolarite!, niveau: e.target.value})}
                                onBlur={async (e) => {
                                  try {
                                    await updateDoc(doc(db, 'scolarites', scolarite.id), { niveau: e.target.value });
                                    setScolariteHistory(prev => prev.map(h => h.id === scolarite.id ? { ...h, niveau: e.target.value } : h));
                                    toast.success("Niveau du dossier mis à jour");
                                  } catch (err) { toast.error("Erreur mise à jour"); }
                                }}
                                className="bg-white dark:bg-neutral-800 border border-neutral-100 dark:border-neutral-700 rounded-lg px-2 py-1 text-sm font-black text-dia-red w-full focus:ring-1 focus:ring-dia-red outline-none"
                                placeholder="Niveau (ex: A1)"
                              />
                            </div>
                          ) : (
                            <span className="text-sm font-black text-dia-red">{scolarite.niveau || 'Niveau Inconnu'}</span>
                          )}
                          <div className="flex items-center gap-2">
                             {isSuperAdmin && (
                               <div className="flex items-center gap-1">
                                 <button 
                                   onClick={async () => {
                                     if (!window.confirm("Voulez-vous forcer la correction du niveau et de la filière de ce dossier basé sur le niveau actuel du profil élève ?")) return;
                                     
                                     const level = levels.find(l => l.id === targetStudent!.levelId);
                                     if (!level) {
                                       toast.error("Le profil élève n'a pas de niveau défini.");
                                       return;
                                     }
                                     setLoading(true);
                                     try {
                                       await updateDoc(doc(db, 'scolarites', scolarite.id), {
                                         niveau: level.name,
                                         filiere: level.stream
                                       });
                                       setScolarite({...scolarite, niveau: level.name, filiere: level.stream});
                                       // Update history too
                                       setScolariteHistory(prev => prev.map(h => h.id === scolarite.id ? {...h, niveau: level.name, filiere: level.stream} : h));
                                       toast.success("Métadonnées synchronisées !");
                                     } catch (e) { toast.error("Échec synchro"); }
                                     finally { setLoading(false); }
                                   }}
                                   className="p-1.5 bg-neutral-200 dark:bg-neutral-700 rounded-lg hover:bg-dia-red hover:text-white transition-colors"
                                   title="Forcer la synchronisation avec le cursus actuel"
                                 >
                                   <RefreshCw size={12} />
                                 </button>
                                 <button 
                                   onClick={async () => {
                                     if (!window.confirm("ÊTES-VOUS SÛR DE VOULOIR SUPPRIMER CE DOSSIER DE SCOLARITÉ ? Cette action est irréversible et supprimera le dossier sélectionné de l'historique de l'élève.")) return;
                                     
                                     setLoading(true);
                                     try {
                                       await deleteDoc(doc(db, 'scolarites', scolarite.id));
                                       toast.success("Dossier supprimé !");
                                       // Refresh history
                                       const q = query(collection(db, 'scolarites'), where('eleve_id', '==', targetStudent!.uid || targetStudent!.id));
                                       const snap = await getDocs(q);
                                       const history = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as StudentScolarite));
                                       setScolariteHistory(history);
                                       if (history.length > 0) {
                                         selectStudent(targetStudent!, history[0].id);
                                       } else {
                                         setScolarite(null);
                                         setSelectedHistoryId(null);
                                       }
                                     } catch (e) { toast.error("Erreur suppression"); }
                                     finally { setLoading(false); }
                                   }}
                                   className="p-1.5 bg-red-100 dark:bg-red-900/20 text-red-600 rounded-lg hover:bg-red-600 hover:text-white transition-colors"
                                   title="Supprimer ce dossier"
                                 >
                                   <Trash2 size={12} />
                                 </button>
                               </div>
                             )}
                             <span className={cn(
                               "px-2 py-0.5 rounded-full text-[9px] font-black uppercase",
                               scolarite.statut_paiement === 'SOLDÉ' ? "bg-green-100 text-green-600" : "bg-orange-100 text-orange-600"
                             )}>
                               {scolarite.statut_paiement}
                             </span>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-neutral-100 dark:border-neutral-700">
                          <div className="flex flex-col">
                            <p className="text-[9px] font-black uppercase text-neutral-400 mb-0.5">Filière / Dossier</p>
                            {isSuperAdmin ? (
                              <input 
                                type="text"
                                value={scolarite.filiere || ''}
                                onChange={(e) => setScolarite({...scolarite!, filiere: e.target.value})}
                                onBlur={async (e) => {
                                   try {
                                     await updateDoc(doc(db, 'scolarites', scolarite.id), { filiere: e.target.value });
                                     setScolariteHistory(prev => prev.map(h => h.id === scolarite.id ? {...h, filiere: e.target.value} : h));
                                     toast.success("Filière mise à jour");
                                   } catch(err) { toast.error("Erreur mise à jour"); }
                                }}
                                className="bg-white dark:bg-neutral-800 border border-neutral-100 dark:border-neutral-700 rounded-lg px-2 py-1 text-[10px] font-bold text-neutral-600 dark:text-neutral-300 w-full focus:ring-1 focus:ring-dia-red outline-none"
                              />
                            ) : (
                              <p className="text-[10px] font-bold text-neutral-500">{scolarite.filiere || 'Général'}</p>
                            )}
                          </div>
                          <div className="flex flex-col">
                            <p className="text-[9px] font-black uppercase text-neutral-400 mb-0.5">Classe du Dossier</p>
                            {isSuperAdmin ? (
                              <input 
                                type="text"
                                value={scolarite.classe_id || ''}
                                onChange={(e) => setScolarite({...scolarite!, classe_id: e.target.value})}
                                onBlur={async (e) => {
                                   try {
                                     await updateDoc(doc(db, 'scolarites', scolarite.id), { classe_id: e.target.value });
                                     toast.success("Classe mise à jour");
                                   } catch(err) { toast.error("Erreur mise à jour"); }
                                }}
                                className="bg-white dark:bg-neutral-800 border border-neutral-100 dark:border-neutral-700 rounded-lg px-2 py-1 text-[10px] font-bold text-neutral-600 dark:text-neutral-300 w-full focus:ring-1 focus:ring-dia-red outline-none"
                                placeholder="ex: B1-A"
                              />
                            ) : (
                              <p className="text-[10px] font-bold text-neutral-500">{scolarite.classe_id || 'Non assignée'}</p>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="bg-neutral-50 dark:bg-neutral-800/50 rounded-xl p-3 border border-neutral-100 dark:border-neutral-700">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-[9px] font-black uppercase text-neutral-400">Cursus Actuel (Niveau de l'élève)</p>
                          <Edit2 size={10} className="text-neutral-400" />
                        </div>
                        <div className="flex items-center gap-3">
                          <select 
                            value={targetStudent.levelId || ''}
                            onChange={async (e) => {
                              const newLevelId = e.target.value;
                              const level = levels.find(l => l.id === newLevelId);
                              if (level && window.confirm(`CHANGEMENT DE CURSUS : Voulez-vous inscrire l'élève au niveau ${level.name} ?\n\nSi un dossier pour ce niveau n'existe pas encore, il sera créé.`)) {
                                setLoading(true);
                                try {
                                  await updateDoc(doc(db, 'users', targetStudent.uid), { levelId: newLevelId });
                                  const updated = {...targetStudent, levelId: newLevelId};
                                  setTargetStudent(updated);
                                  // This will auto-create or find the record
                                  await selectStudent(updated);
                                  toast.success(`Cursus mis à jour vers ${level.name} !`);
                                } catch (err) {
                                  toast.error("Erreur durant la mise à jour");
                                } finally { setLoading(false); }
                              }
                            }}
                            className="flex-1 bg-transparent text-xs font-black text-neutral-900 dark:text-neutral-100 outline-none cursor-pointer"
                          >
                            {levels.map(l => (
                              <option key={l.id} value={l.id}>{l.name} ({l.stream || 'N/A'})</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-dia-red/10 rounded-full flex items-center justify-center text-dia-red">
                        <Landmark size={20} />
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase text-neutral-400">Objectif du dossier (Scolarité + Inscription)</p>
                        <span className="text-xl font-black text-dia-red">{formatCurrency(scolarite.montant_total_du)}</span>
                      </div>
                    </div>
                    <div className="w-40">
                      <p className="text-[9px] font-black uppercase text-neutral-400 mb-1">Ajuster (Super Admin)</p>
                      <input 
                        type="number"
                        value={scolarite.montant_total_du}
                        disabled={!isSuperAdmin}
                        onChange={(e) => setScolarite(prev => prev ? { ...prev, montant_total_du: Number(e.target.value) } : null)}
                        onBlur={async (e) => {
                          if (isSuperAdmin) {
                            const val = Number(e.target.value);
                            await updateDoc(doc(db, 'scolarites', scolarite.id), { montant_total_du: val });
                            toast.success("Objectif financier mis à jour.");
                          }
                        }}
                        className="w-full bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg p-2 text-xs font-black text-dia-red text-right"
                      />
                    </div>
                  </div>
                </div>

            {/* Payment Form */}
            <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
                <h3 className="text-lg font-black uppercase flex items-center gap-2">
                  <CreditCard size={20} className="text-dia-red" /> Nouveau Versement
                </h3>
                <div className="px-4 py-2 bg-dia-red text-white rounded-xl text-[10px] font-black uppercase flex items-center gap-2 animate-pulse">
                  <Landmark size={14} /> Destination: {scolarite.niveau} ({scolarite.filiere})
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-neutral-400 uppercase">Montant (FCFA) *</label>
                  <input 
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(Number(e.target.value))}
                    className="w-full p-4 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl font-black text-2xl"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-neutral-400 uppercase">Type de Paiement *</label>
                  <select 
                    value={paymentCategory}
                    onChange={(e) => setPaymentCategory(e.target.value as any)}
                    className={cn(
                      "w-full p-4 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl font-bold",
                      paymentCategory === 'inscription' && "bg-orange-50 border-orange-200 text-orange-600"
                    )}
                  >
                    <option value="scolarite">Scolarité</option>
                    <option value="inscription" className="font-bold text-orange-600">Inscription (Dû seulement en A1)</option>
                    <option value="vorbereitung">Vorbereitung</option>
                    <option value="examen">Examen</option>
                    <option value="autre">Autre</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-neutral-400 uppercase">Date du versement *</label>
                  <input 
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className="w-full p-4 bg-neutral-50 dark:bg-neutral-800 border-dia-red/50 border-2 dark:border-neutral-700 rounded-xl font-bold"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-neutral-400 uppercase">Mode de paiement *</label>
                  <select 
                    value={paymentMode}
                    onChange={(e) => {
                      const mode = e.target.value as Versement['mode_paiement'];
                      setPaymentMode(mode);
                      // Default account based on mode
                      if (mode === 'Espèces') setAccountType('caisse');
                      else if (mode === 'Virement') setAccountType('banque');
                    }}
                    className="w-full p-4 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl font-bold"
                  >
                    <option value="Espèces">Espèces</option>
                    <option value="Mobile Money">Mobile Money</option>
                    <option value="Virement">Virement</option>
                    <option value="Autre">Autre</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-neutral-400 uppercase">Compte de destination *</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setAccountType('caisse')}
                      className={cn(
                        "py-3 px-2 rounded-xl text-[10px] font-black uppercase transition-all border-2 flex items-center justify-center gap-1",
                        accountType === 'caisse' 
                          ? "bg-dia-red/10 border-dia-red text-dia-red" 
                          : "bg-neutral-50 dark:bg-neutral-800 border-neutral-100 dark:border-neutral-700 text-neutral-400"
                      )}
                    >
                      <Landmark size={12} /> Caisse
                    </button>
                    <button
                      type="button"
                      onClick={() => setAccountType('banque')}
                      className={cn(
                        "py-3 px-2 rounded-xl text-[10px] font-black uppercase transition-all border-2 flex items-center justify-center gap-1",
                        accountType === 'banque' 
                          ? "bg-blue-50 border-blue-500 text-blue-600" 
                          : "bg-neutral-50 dark:bg-neutral-800 border-neutral-100 dark:border-neutral-700 text-neutral-400"
                      )}
                    >
                      <CreditCard size={12} /> Banque
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-neutral-400 uppercase">Effectué par *</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setInitiatedBy('student')}
                      className={cn(
                        "py-3 px-1 rounded-xl text-[10px] font-black uppercase transition-all border-2",
                        initiatedBy === 'student' 
                          ? "bg-dia-red/10 border-dia-red text-dia-red" 
                          : "bg-neutral-50 dark:bg-neutral-800 border-neutral-100 dark:border-neutral-700 text-neutral-400"
                      )}
                    >
                      L'Élève
                    </button>
                    <button
                      type="button"
                      onClick={() => setInitiatedBy('secretary')}
                      className={cn(
                        "py-3 px-1 rounded-xl text-[10px] font-black uppercase transition-all border-2",
                        initiatedBy === 'secretary' 
                          ? "bg-purple-50 border-purple-500 text-purple-600" 
                          : "bg-neutral-50 dark:bg-neutral-800 border-neutral-100 dark:border-neutral-700 text-neutral-400"
                      )}
                    >
                      Secrétariat
                    </button>
                  </div>
                </div>
              </div>
              <div className="mt-4 space-y-2">
                <label className="text-xs font-bold text-neutral-400 uppercase">Notes / Observations</label>
                <textarea 
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full p-4 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl h-20 resize-none"
                  placeholder="Justification, n° de transaction mobile, etc."
                />
              </div>
              <button 
                onClick={handleAddPayment}
                disabled={loading || amount <= 0}
                className="w-full mt-6 py-4 bg-green-600 text-white rounded-xl font-black uppercase tracking-widest hover:bg-green-700 transition-colors shadow-lg shadow-green-600/20 disabled:opacity-50"
              >
                Valider le versement
              </button>
            </div>

          {/* History */}
            <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 shadow-sm">
              <h3 className="text-lg font-black uppercase mb-6 flex items-center gap-2">
                <HistoryIcon size={20} className="text-dia-red" /> Historique des versements
              </h3>
              <div className="space-y-4">
                {versements.map((v) => (
                  <div key={v.id} className="flex flex-col p-4 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-100 dark:border-neutral-700 rounded-xl group hover:border-dia-red/30 transition-colors">
                    <div className="flex items-center justify-between">
                      {editingVersementId === v.id ? (
                         <div className="flex-1 pr-4 space-y-3">
                           <div className="flex items-center gap-2">
                             <input 
                               type="number"
                               value={editAmount}
                               onChange={(e) => setEditAmount(Number(e.target.value))}
                               className="flex-1 px-3 py-1.5 bg-white dark:bg-neutral-900 border-2 border-dia-red rounded-lg font-black text-lg outline-none"
                             />
                             <span className="text-xs font-bold text-neutral-400">FCFA</span>
                           </div>
                           <div className="flex items-center gap-2">
                             <input 
                               type="date"
                               value={editDate}
                               onChange={(e) => setEditDate(e.target.value)}
                               className="flex-1 px-3 py-1.5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg text-xs outline-none font-bold text-neutral-500"
                             />
                           </div>
                           <input 
                             type="text"
                             value={editNotes}
                             onChange={(e) => setEditNotes(e.target.value)}
                             placeholder="Raison de la modification..."
                             className="w-full px-3 py-1.5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg text-xs outline-none"
                           />
                         </div>
                      ) : (
                         <div>
                           <div className="flex items-center gap-2 mb-1">
                             <span className="font-black text-lg">{formatCurrency(v.montant)}</span>
                             <span className="text-[10px] font-bold px-2 py-0.5 bg-neutral-200 dark:bg-neutral-700 rounded text-neutral-500 uppercase">{v.mode_paiement}</span>
                             {v.categorie !== 'scolarite' && (
                               <span className="text-[8px] font-black px-1.5 py-0.5 bg-orange-100 text-orange-600 rounded uppercase">{v.categorie}</span>
                             )}
                           </div>
                           <div className="text-xs text-neutral-500 flex items-center gap-3">
                             <span>{new Date(v.date).toLocaleDateString()}</span>
                             <span>{v.recu_numero}</span>
                           </div>
                         </div>
                      )}

                      <div className="flex items-center justify-end gap-2">
                        {editingVersementId === v.id ? (
                          <>
                            <button onClick={() => handleUpdatePayment(v.id)} className="p-3 bg-green-600 text-white rounded-full shadow-lg"><Check size={18} /></button>
                            <button onClick={() => setEditingVersementId(null)} className="p-3 bg-neutral-200 dark:bg-neutral-700 text-neutral-600 rounded-full shadow-sm"><X size={18} /></button>
                          </>
                        ) : (
                          <>
                            {isSuperAdmin && (
                              <>
                                <button onClick={() => { setEditingVersementId(v.id); setEditAmount(v.montant); setEditNotes(v.notes || ''); setEditDate(v.date?.split('T')[0] || ''); }} className="p-3 bg-white dark:bg-neutral-700 rounded-full shadow-sm text-blue-600"><Edit2 size={18} /></button>
                                <button onClick={() => handleDeletePayment(v.id)} className="p-3 bg-white dark:bg-neutral-700 rounded-full shadow-sm text-red-600"><Trash2 size={18} /></button>
                              </>
                            )}
                            <button onClick={() => handleGeneratePDF(v)} className="p-3 bg-white dark:bg-neutral-700 rounded-full shadow-sm text-dia-red"><Printer size={18} /></button>
                            <button 
                              onClick={() => {
                                const msg = `🧾 *REÇU* : ${formatCurrency(v.montant)} pour ${targetStudent.firstName} ${targetStudent.lastName}. Reste: ${formatCurrency(scolarite.reste)}.`;
                                window.open(generateWhatsAppLink(targetStudent.parentPhone || '', msg), '_blank');
                              }}
                              className="p-3 bg-white dark:bg-neutral-700 rounded-full shadow-sm text-green-600"
                            ><MessageCircle size={18} /></button>
                          </>
                        )}
                      </div>
                    </div>
                    {v.notes && !editingVersementId && <p className="mt-2 text-[10px] text-neutral-400 italic">Note: {v.notes}</p>}
                  </div>
                ))}
                {versements.length === 0 && (
                    <p className="text-center py-8 text-neutral-400 italic">Aucun versement enregistré.</p>
                  )}
              </div>
            </div>
            </div>

            <div className="space-y-6">
              <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 shadow-sm">
              <div className="flex flex-col items-center text-center mb-6">
                <div className="w-20 h-20 bg-neutral-100 dark:bg-neutral-800 rounded-full flex items-center justify-center mb-3">
                  <User size={40} className="text-neutral-400" />
                </div>
                <h4 className="font-black text-xl">{targetStudent.firstName} {targetStudent.lastName}</h4>
                <p className="text-sm text-dia-red font-bold uppercase mb-3">{targetStudent.matricule}</p>

                <div className="mt-2 flex flex-col gap-2 items-center">
                  <div className="flex gap-1">
                    <span className="px-3 py-1 bg-neutral-100 dark:bg-neutral-800 rounded-full text-[10px] font-black uppercase text-neutral-500">
                      {levels.find(l => l.id === targetStudent.levelId)?.name || 'Niveau non défini'}
                    </span>
                    <span className={cn(
                      "px-3 py-1 rounded-full text-[10px] font-black uppercase shadow-sm",
                      levels.find(l => l.id === targetStudent.levelId)?.stream === 'Allemand' 
                        ? "bg-orange-600 text-white" 
                        : "bg-blue-600 text-white"
                    )}>
                      {levels.find(l => l.id === targetStudent.levelId)?.stream || 'N/A'}
                    </span>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${
                    cumulativeTotals?.status === 'SOLDÉ' ? 'bg-green-100 text-green-700' : 
                    cumulativeTotals?.status === 'SURPLUS' ? 'bg-blue-100 text-blue-700' :
                    'bg-orange-100 text-orange-700'
                  }`}>
                    {cumulativeTotals?.status}
                  </span>
                </div>
              </div>
              </div>

                <div className="space-y-4 border-t pt-6 border-neutral-100 dark:border-neutral-800">
                  <div className="bg-neutral-50 dark:bg-neutral-800/50 rounded-xl p-4 border border-neutral-200 dark:border-neutral-700">
                    <p className="text-[10px] font-black uppercase text-dia-red mb-2">Ajouter un Cursus (Dossier) à l'historique</p>
                    <div className="flex gap-2">
                       <select 
                         id="add-new-dossier-select"
                         className="flex-1 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg px-3 py-2 text-xs font-bold"
                       >
                         <option value="">Choisir un niveau...</option>
                         {levels.map(l => (
                           <option key={l.id} value={l.id}>{l.name} - {l.stream}</option>
                         ))}
                       </select>
                       <button 
                         onClick={async () => {
                           const select = document.getElementById('add-new-dossier-select') as HTMLSelectElement;
                           const levelId = select.value;
                           if (!levelId) return;
                           
                           const level = levels.find(l => l.id === levelId);
                           if (!level) return;

                           if (scolariteHistory.some(h => h.id === `${targetStudent.uid}_${levelId}`)) {
                             toast.error("Un dossier pour ce niveau existe déjà.");
                             return;
                           }

                           if (!window.confirm(`Voulez-vous créer un nouveau dossier de scolarité pour le niveau ${level.name} ?`)) return;

                           setLoading(true);
                           try {
                             const newId = `${targetStudent.uid}_${levelId}`;
                             const isA1 = level.name.toLowerCase().includes('a1');
                             const tuition = level.tuition + (isA1 ? 10000 : 0);
                             
                             const newDossier: StudentScolarite = {
                               id: newId,
                               eleve_id: targetStudent.uid,
                               matricule: targetStudent.matricule,
                               nom_eleve: `${targetStudent.lastName} ${targetStudent.firstName}`,
                               classe_id: 'N/A',
                               filiere: level.stream || 'Général',
                               niveau: level.name,
                               montant_total_du: tuition,
                               total_verse: 0,
                               reste: tuition,
                               surplus: 0,
                               statut_paiement: 'NON PAYÉ',
                               createdAt: new Date().toISOString()
                             };
                             
                             await setDoc(doc(db, 'scolarites', newId), newDossier);
                             toast.success("Nouveau dossier créé !");
                             await selectStudent(targetStudent, newId);
                           } catch (err) {
                             toast.error("Erreur creation dossier");
                           } finally { setLoading(false); }
                         }}
                         className="bg-dia-red text-white px-4 py-2 rounded-lg text-xs font-black uppercase"
                       >
                         Ajouter
                       </button>
                    </div>
                  </div>

                <div className="flex justify-between items-center text-[10px] font-black text-neutral-400 uppercase tracking-tighter mb-[-8px]">
                   <span>Bilan de Scolarité</span>
                   <button 
                    onClick={async () => {
                      try {
                        setLoading(true);
                        const versementsSnap = await getDocs(collection(db, 'scolarites', scolarite.id, 'versements'));
                        const allVersements = versementsSnap.docs.map(d => ({ id: d.id, ...d.data() as Versement }));
                        
                        // --- DEDUPLICATION LOGIC ---
                        const keptVersements: Versement[] = [];
                        const duplicatesToDelete: string[] = [];
                        
                        allVersements.sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
                        
                        allVersements.forEach(current => {
                          const isDup = keptVersements.some(kept => {
                            const timeDiff = Math.abs(new Date(kept.date).getTime() - new Date(current.date).getTime());
                            const sameAmount = Number(kept.montant) === Number(current.montant);
                            const sameCat = kept.categorie === current.categorie;
                            return sameAmount && sameCat && timeDiff < (10 * 60 * 1000); // 10 minutes threshold matches merge logic
                          });
                          
                          if (isDup) {
                            duplicatesToDelete.push(current.id);
                          } else {
                            keptVersements.push(current);
                          }
                        });
 
                        if (duplicatesToDelete.length > 0) {
                          for (const id of duplicatesToDelete) {
                            await deleteDoc(doc(db, 'scolarites', scolarite.id, 'versements', id));
                            // Also try to find and delete in finances
                            const v = allVersements.find(v => v.id === id);
                            if (v?.financeId) {
                               await fetchWithAuth(`/api/finances/${v.financeId}`, { method: 'DELETE' }).catch(() => {});
                            }
                          }
                          toast.warning(`${duplicatesToDelete.length} versement(s) doublon(s) supprimé(s) automatiquement.`);
                        }

                        // Use results of deduplication for final totals
                        const realTotal = keptVersements.reduce((acc, v) => acc + (v.montant || 0), 0);
                        // ---------------------------

                        const newReste = Math.max(0, scolarite.montant_total_du - realTotal);
                        const newSurplus = Math.max(0, realTotal - scolarite.montant_total_du);
                        let newStatut: StudentScolarite['statut_paiement'] = 'EN COURS';
                        if (realTotal === 0) newStatut = 'NON PAYÉ';
                        else if (newSurplus > 0) newStatut = 'SURPLUS';
                        else if (newReste === 0) newStatut = 'SOLDÉ';

                        const updatedObj = {
                          ...scolarite,
                          total_verse: realTotal,
                          reste: newReste,
                          surplus: newSurplus,
                          statut_paiement: newStatut
                        };

                        await setDoc(doc(db, 'scolarites', targetStudent.uid), updatedObj, { merge: true });
                        setScolarite(updatedObj);
                        setVersements(keptVersements.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
                        toast.success("Situation financière recalculée et synchronisée !");
                      } catch (e) {
                        toast.error("Échec de la réconciliation");
                      } finally {
                        setLoading(false);
                      }
                    }}
                    className="flex items-center gap-1 text-dia-red hover:underline"
                   >
                     <RefreshCw size={10} />
                     Réconcilier
                   </button>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-neutral-500">Exigible total</span>
                  <span className="font-bold">{formatCurrency(scolarite.montant_total_du)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-neutral-500">Total versé (Cumulé)</span>
                  <span className="font-bold text-green-600">{formatCurrency(cumulativeTotals?.totalPaid || 0)}</span>
                </div>
                <div className="h-px bg-neutral-100 dark:bg-neutral-800 my-2" />
                <div className="flex justify-between items-center pb-2">
                  <span className="text-sm font-black uppercase">Solde Restal</span>
                  <span className={cn(
                    "text-2xl font-black",
                    (cumulativeTotals?.remains || 0) > 0 ? "text-dia-red" : "text-green-600"
                  )}>
                    {formatCurrency(cumulativeTotals?.remains || 0)}
                  </span>
                </div>

                {(cumulativeTotals?.remains || 0) > 0 && (
                  <div className="pt-2 flex flex-col gap-2">
                    <p className="text-[10px] font-bold text-neutral-400 uppercase text-center mb-1">Rappels rapides</p>
                    <button 
                      onClick={() => {
                        const msg = `📢 *RAPPEL DE PAIEMENT - ${APP_NAME_FOR_LINKS}*\n\nBonjour,\nSauf erreur de notre part, il reste un solde de *${formatCurrency(cumulativeTotals?.remains || 0)}* à régler pour la scolarité de ${targetStudent.firstName} ${targetStudent.lastName}.\n\nMerci de passer en caisse ou d'effectuer un virement mobile.\nCordialement.`;
                        const a = document.createElement('a');
                        a.href = generateWhatsAppLink(targetStudent.parentPhone || targetStudent.phone || '', msg);
                        a.target = '_blank';
                        a.click();
                      }}
                      className="w-full py-2 bg-green-50 text-green-700 border border-green-200 rounded-xl text-xs font-bold hover:bg-green-100 transition-colors flex items-center justify-center gap-2"
                    >
                      <MessageCircle size={14} /> Rappeler par WhatsApp
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TuitionManagement;

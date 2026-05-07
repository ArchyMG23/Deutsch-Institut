import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { collection, query, where, getDocs, doc, setDoc, updateDoc, getDoc, addDoc, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { Student, StudentScolarite, Versement, SchoolConfig, Level } from '../../types';
import { Search, CreditCard, Printer, History, AlertCircle, CheckCircle2, User, Landmark, Share2, Send, MessageCircle, Edit2, X, Check, Trash2 } from 'lucide-react';
import { formatCurrency, cn } from '../../utils';
import { toast } from 'sonner';
import { jsPDF } from 'jspdf';
import { addAuditLog } from '../../utils/auditLogger';
import { useAuth, OperationType, FirestoreErrorInfo } from '../../context/AuthContext';
import { auth } from '../../firebase';
import { generateWhatsAppLink, APP_NAME_FOR_LINKS } from '../../utils/contactLinks';

const TuitionManagement: React.FC = () => {
  const { user, profile, fetchWithAuth } = useAuth();
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
  const [versements, setVersements] = useState<Versement[]>([]);
  const [loading, setLoading] = useState(false);
  const [studentsList, setStudentsList] = useState<Student[]>([]);
  const [levels, setLevels] = useState<Level[]>([]);
  const [schoolConfig, setSchoolConfig] = useState<SchoolConfig>({
    id: 'current',
    nom: 'DIA DEUTSCH INSTITUT',
    logo_url: '',
    annee_scolaire: '2025-2026',
    format_recu: 'A5'
  });

  // Form state
  const [amount, setAmount] = useState<number>(0);
  const [paymentMode, setPaymentMode] = useState<Versement['mode_paiement']>('Espèces');
  const [paymentCategory, setPaymentCategory] = useState<Versement['categorie']>('scolarite');
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().split('T')[0]);
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
      setAmount(10000);
    }
  }, [paymentCategory]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const configSnap = await getDoc(doc(db, 'ecole', 'current'));
        if (configSnap.exists()) setSchoolConfig(configSnap.data() as SchoolConfig);
      } catch (e) {
        handleFirestoreError(e, OperationType.GET, 'ecole/current');
      }

      try {
        const levelsSnap = await getDocs(collection(db, 'levels'));
        setLevels(levelsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Level)));
      } catch (e) {
        handleFirestoreError(e, OperationType.LIST, 'levels');
      }

      try {
        const studentsSnap = await getDocs(query(collection(db, 'users'), where('role', '==', 'student')));
        setStudentsList(studentsSnap.docs.map(d => ({ uid: d.id, ...d.data() } as Student)));
      } catch (e) {
        handleFirestoreError(e, OperationType.LIST, 'users (students query)');
      }
    };
    fetchData();
  }, []);

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

  const selectStudent = async (student: Student) => {
    setLoading(true);
    setTargetStudent(student);
    setMatricule(student.matricule);
    
    // DUPLICATE DETECTOR & AUTO-MERGE: Check if there are other student accounts with same name
    const duplicates = studentsList.filter(s => 
      s.uid !== student.uid && 
      s.firstName.toLowerCase() === student.firstName.toLowerCase() && 
      s.lastName.toLowerCase() === student.lastName.toLowerCase()
    );

    if (duplicates.length > 0) {
      toast.warning(`${duplicates.length} autre(s) compte(s) trouvé(s) pour "${student.lastName} ${student.firstName}". Les versements pourraient être dispersés.`);
    }

    try {
      // Fetch targetStudent Level info for tuition totals
      const studentLevel = levels.find(l => l.id === student.levelId);
      const levelTuition = studentLevel?.tuition || 110000;
      // Add standard registration fee (10,000) to total pool
      const defaultTuition = levelTuition + 10000;
      
      const stream = studentLevel?.stream || 'N/A';
      const levelName = studentLevel?.name || 'N/A';

      // Fetch scolarite master record
      let scolariteSnap;
      try {
        scolariteSnap = await getDoc(doc(db, 'scolarites', student.uid));
      } catch (e) {
        handleFirestoreError(e, OperationType.GET, `scolarites/${student.uid}`);
      }
      
      if (scolariteSnap!.exists()) {
        const data = scolariteSnap!.data() as StudentScolarite;
        // ONLY update stream/level names, but keep the EXISTING tuition amount unless it is 0
        if (data.filiere !== stream || data.niveau !== levelName) {
          const updated = { 
            ...data, 
            filiere: stream, 
            niveau: levelName,
            // Keep existing montant_total_du if it's already set (> 0)
            montant_total_du: data.montant_total_du || defaultTuition,
            reste: Math.max(0, (data.montant_total_du || defaultTuition) - data.total_verse),
            surplus: Math.max(0, data.total_verse - (data.montant_total_du || defaultTuition))
          };
          await updateDoc(doc(db, 'scolarites', student.uid), updated);
          setScolarite(updated);
        } else {
          setScolarite(data);
        }
      } else {
        // Initialize if not exists
        const initialScolarite: StudentScolarite = {
          id: student.uid,
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
          statut_paiement: 'EN COURS'
        };
        try {
          await setDoc(doc(db, 'scolarites', student.uid), initialScolarite);
        } catch (e) {
          handleFirestoreError(e, OperationType.WRITE, `scolarites/${student.uid}`);
        }
        setScolarite(initialScolarite);
      }

      // Fetch versements subcollection
      let versemntsSnap;
      try {
        versemntsSnap = await getDocs(collection(db, 'scolarites', student.uid, 'versements'));
      } catch (e) {
        handleFirestoreError(e, OperationType.LIST, `scolarites/${student.uid}/versements`);
      }
      
      const vList = versemntsSnap!.docs.map(d => ({ id: d.id, ...d.data() } as Versement));
      
      // --- CROSS-SYNC WITH GENERAL FINANCES ---
      // Fetch any finance records linked to this student that might not be in the subcollection
      let financeList: any[] = [];
      try {
        // 1. Precise match by studentId
        const qFin = query(collection(db, 'finances'), where('studentId', '==', student.uid), where('type', '==', 'income'));
        const finSnap = await getDocs(qFin);
        financeList = finSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        // 2. Fuzzy match by matricule in description (for records missing studentId)
        const allFinSnap = await getDocs(query(collection(db, 'finances'), where('type', '==', 'income')));
        allFinSnap.forEach(d => {
           const f = d.data();
           if (!f.studentId && f.description && f.description.includes(student.matricule)) {
              if (!financeList.find(existing => existing.id === d.id)) {
                 financeList.push({ id: d.id, ...f });
              }
           }
        });
      } catch (finErr) {
        console.error("Failed to fetch general finances for sync:", finErr);
      }

      // Identify finance records NOT yet in vList
      const linkedFinanceIds = new Set(vList.filter(v => v.financeId).map(v => v.financeId));
      const missingFromScolarite = financeList.filter(f => !linkedFinanceIds.has(f.id));

      if (missingFromScolarite.length > 0) {
        for (const f of missingFromScolarite) {
          const healingVersement = {
            montant: Number(f.amount),
            date: f.date || new Date().toISOString(),
            mode_paiement: (f.paymentMode || 'Autre') as any,
            categorie: (f.category === 'registration' ? 'inscription' : 'scolarite') as any,
            recu_numero: f.receiptNumber || `SYNC-FIN-${f.id.slice(-4)}`,
            caissier_id: f.initiatedBy || 'System',
            notes: f.description || 'Importé depuis Finances Générales',
            financeId: f.id
          };
          try {
            const vRef = await addDoc(collection(db, 'scolarites', student.uid, 'versements'), healingVersement);
            vList.push({ id: vRef.id, ...healingVersement } as Versement);
          } catch (healErr) {
            console.error("Inner healing failed:", healErr);
          }
        }
        if (missingFromScolarite.length > 0) {
          toast.info(`${missingFromScolarite.length} paiement(s) "confirmés" en Finance ont été ajoutés ici.`);
        }
      }

      vList.sort((a,b) => {
        const dateA = a.date ? new Date(a.date).getTime() : 0;
        const dateB = b.date ? new Date(b.date).getTime() : 0;
        return dateB - dateA;
      });
      
      // --- ROBUST AUTO-HEALING: Sync payments from user profile if missing in finance module ---
      const totalInFinance = vList.reduce((acc, v) => acc + (Number(v.montant) || 0), 0);
      const studentPayments = student.payments || [];
      const totalInProfile = studentPayments.reduce((acc: number, p: any) => acc + (Number(p.amount) || 0), 0);

      if (totalInProfile > totalInFinance) {
        const diff = totalInProfile - totalInFinance;
        // Create a record for the missing amount
        const healingVersement = {
          montant: diff,
          date: new Date().toISOString(),
          mode_paiement: 'Autre' as const,
          categorie: 'scolarite' as const,
          recu_numero: `SYNC-${student.matricule}-${Date.now().toString().slice(-4)}`,
          caissier_id: 'System',
          notes: 'Synchronisation automatique depuis le profil inscription'
        };
        try {
          const vRef = await addDoc(collection(db, 'scolarites', student.uid, 'versements'), healingVersement);
          vList.push({ id: vRef.id, ...healingVersement } as Versement);
          toast.info("Paiements synchronisés avec le profil d'inscription (" + formatCurrency(diff) + ")");
        } catch (healErr) {
          console.error("Healing failed:", healErr);
        }
      }
      // -----------------------------------------------------------------------------------------

      setVersements(vList);

      // --- DYNAMIC RE-CALCULATION ---
      const totalPaid = vList.reduce((acc, v) => acc + (Number(v.montant) || 0), 0);
      const existingData = scolariteSnap!.exists() ? scolariteSnap!.data() as StudentScolarite : null;
      const finalTuition = existingData?.montant_total_du || defaultTuition;

      const updatedScolarite = {
        ...(existingData || {
          id: student.uid,
          eleve_id: student.uid,
          matricule: student.matricule,
          nom_eleve: `${student.lastName} ${student.firstName}`,
          classe_id: student.classId || 'N/A',
          filiere: stream,
          niveau: levelName,
        }),
        montant_total_du: finalTuition,
        total_verse: totalPaid,
        reste: Math.max(0, finalTuition - totalPaid),
        surplus: Math.max(0, totalPaid - finalTuition),
        statut_paiement: totalPaid >= finalTuition ? 'SOLDÉ' : (totalPaid > 0 ? 'EN COURS' : 'NON PAYÉ')
      } as StudentScolarite;

      setScolarite(updatedScolarite);
      
      // Update Firestore with fresh totals
      await setDoc(doc(db, 'scolarites', student.uid), updatedScolarite);
      // -------------------------------
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

    setLoading(true);
    try {
      const recNumber = generateReceiptNumber();
      // Ensure the time is also included to avoid sorting issues, default to noon for manual dates
      const finalDate = paymentDate === new Date().toISOString().split('T')[0] 
        ? new Date().toISOString() 
        : new Date(paymentDate + 'T12:00:00Z').toISOString();

      // 1. Add Versement to subcollection placeholder (we update it after finance sync)
      let financeId: string | undefined;

      // 3. Sync with global finances
      try {
        const finRes = await fetchWithAuth('/api/finances', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            type: 'income',
            amount: amount,
            description: `${paymentCategory.charAt(0).toUpperCase() + paymentCategory.slice(1)} - ${targetStudent.lastName} ${targetStudent.firstName} (${targetStudent.matricule})`,
            category: paymentCategory === 'scolarite' ? 'tuition' : (paymentCategory === 'inscription' ? 'registration' : 'tuition'),
            date: finalDate,
            accountType: accountType,
            initiatedBy: initiatedBy,
            status: 'active',
            studentId: targetStudent.uid,
            studentMatricule: targetStudent.matricule,
            levelId: targetStudent.levelId,
            classId: targetStudent.classId
          })
        });
        if (finRes.ok) {
          const finData = await finRes.json();
          financeId = finData.id;
        }
      } catch (financeErr) {
        console.error("Finance sync failed:", financeErr);
      }

      const versementData: Omit<Versement, 'id'> = {
        montant: amount,
        date: finalDate,
        mode_paiement: paymentMode,
        accountType: accountType,
        initiatedBy: initiatedBy,
        categorie: paymentCategory,
        recu_numero: recNumber,
        caissier_id: user?.uid || 'Unknown',
        notes: notes,
        recu_genere_at: new Date().toISOString(),
        recu_genere_par: user?.uid,
        financeId: financeId
      };

      const vRef = await addDoc(collection(db, 'scolarites', targetStudent.uid, 'versements'), versementData);

      // 2. Update Master Scolarite
      const newTotalVerse = (scolarite.total_verse || 0) + amount;
      const newReste = Math.max(0, scolarite.montant_total_du - newTotalVerse);
      const newSurplus = Math.max(0, newTotalVerse - scolarite.montant_total_du);
      
      let newStatut: StudentScolarite['statut_paiement'] = 'EN COURS';
      if (newSurplus > 0) newStatut = 'SURPLUS';
      else if (newReste === 0) newStatut = 'SOLDÉ';

      const updatedScolarite = {
        ...scolarite,
        total_verse: newTotalVerse,
        reste: newReste,
        surplus: newSurplus,
        statut_paiement: newStatut
      };

      await setDoc(doc(db, 'scolarites', targetStudent.uid), updatedScolarite);
      
      setScolarite(updatedScolarite);
      
      const newVersementsList = [{ id: vRef.id, ...versementData }, ...versements];
      newVersementsList.sort((a,b) => {
        const dateA = a.date ? new Date(a.date).getTime() : 0;
        const dateB = b.date ? new Date(b.date).getTime() : 0;
        return dateB - dateA;
      });
      setVersements(newVersementsList);

      // 4. Add to Audit Log
      addAuditLog("VERSEMENT_AJOUTÉ", targetStudent.uid, { montant: amount, recu: recNumber, categorie: paymentCategory });

      toast.success("Versement enregistré !");
      handleGeneratePDF({ id: vRef.id, ...versementData });
      
      // Reset form
      setAmount(0);
      setNotes('');
    } catch (error) {
      console.error(error);
      toast.error("Erreur lors de l'enregistrement");
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
    if (!targetStudent || !scolarite || !isSuperAdmin) return;
    
    if (!window.confirm("Êtes-vous sûr de vouloir supprimer définitivement ce versement ?")) return;

    setLoading(true);
    try {
      const versementToDelete = versements.find(v => v.id === versementId);
      if (!versementToDelete) return;

      // 1. Delete from subcollection
      await deleteDoc(doc(db, 'scolarites', targetStudent.uid, 'versements', versementId));

      // 2. Sync with global finances if financeId exists
      if (versementToDelete.financeId) {
        try {
          await fetchWithAuth(`/api/finances/${versementToDelete.financeId}`, {
            method: 'DELETE'
          });
        } catch (finErr) {
          console.error("Finance deletion failed:", finErr);
        }
      }

      // 3. Recalculate totals
      const newTotalVerse = (scolarite.total_verse || 0) - versementToDelete.montant;
      const newReste = Math.max(0, scolarite.montant_total_du - newTotalVerse);
      const newSurplus = Math.max(0, newTotalVerse - scolarite.montant_total_du);
      
      let newStatut: StudentScolarite['statut_paiement'] = 'EN COURS';
      if (newSurplus > 0) newStatut = 'SURPLUS';
      else if (newReste === 0) newStatut = 'SOLDÉ';
      else if (newTotalVerse === 0) newStatut = 'IMPAYÉ';

      const updatedScolarite = {
        ...scolarite,
        total_verse: newTotalVerse,
        reste: newReste,
        surplus: newSurplus,
        statut_paiement: newStatut
      };

      await updateDoc(doc(db, 'scolarites', targetStudent.uid), updatedScolarite);
      
      setScolarite(updatedScolarite);
      setVersements(versements.filter(v => v.id !== versementId));
      
      addAuditLog("VERSEMENT_SUPPRIMÉ", targetStudent.uid, { 
        versementId, 
        montant: versementToDelete.montant,
        recu_numero: versementToDelete.recu_numero 
      });

      toast.success("Versement supprimé avec succès !");
    } catch (err) {
      console.error(err);
      toast.error("Erreur lors de la suppression du versement");
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
      
      await updateDoc(doc(db, 'scolarites', targetStudent.uid, 'versements', versementId), updateData);

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
                    await updateDoc(doc(db, 'scolarites', targetStudent.uid, 'versements', versementId), {
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

      await updateDoc(doc(db, 'scolarites', targetStudent.uid), updatedScolarite);
      
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
              {/* Level & Target Tuition Setup */}
              <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4 flex flex-wrap items-center gap-4">
              <div className="flex-1 min-w-[200px]">
                <p className="text-[10px] font-black uppercase text-neutral-400 mb-1">Filière / Niveau Actuel</p>
                <div className="flex gap-2">
                  <select 
                    value={targetStudent.levelId || ''}
                    onChange={async (e) => {
                      const newLevelId = e.target.value;
                      const level = levels.find(l => l.id === newLevelId);
                      if (level) {
                        try {
                          await updateDoc(doc(db, 'users', targetStudent.uid), { levelId: newLevelId });
                          const newScolarite = { 
                            ...scolarite!, 
                            filiere: level.stream || 'N/A',
                            niveau: level.name,
                            // Keep the same tuition, only update labels
                          };
                          await updateDoc(doc(db, 'scolarites', targetStudent.uid), newScolarite);
                          setScolarite(newScolarite);
                          setTargetStudent({...targetStudent, levelId: newLevelId});
                          toast.success(`Niveau mis à jour vers ${level.name}`);
                        } catch (err) {
                          toast.error("Erreur mise à jour niveau");
                        }
                      }
                    }}
                    className="flex-1 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg p-2 text-xs font-bold"
                  >
                    <option value="">Sélectionner un niveau</option>
                    {levels.map(l => (
                      <option key={l.id} value={l.id}>{l.name} ({l.stream})</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="w-40">
                <p className="text-[10px] font-black uppercase text-neutral-400 mb-1">Total Scolarité (FCFA)</p>
                <input 
                  type="number"
                  value={scolarite.montant_total_du}
                  onChange={async (e) => {
                    const newTotal = Number(e.target.value);
                    const newScolarite = { 
                      ...scolarite, 
                      montant_total_du: newTotal,
                      reste: Math.max(0, newTotal - scolarite.total_verse),
                      surplus: Math.max(0, scolarite.total_verse - newTotal)
                    };
                    setScolarite(newScolarite);
                  }}
                  onBlur={async (e) => {
                    const newTotal = Number(e.target.value);
                    await updateDoc(doc(db, 'scolarites', targetStudent.uid), { 
                      montant_total_du: newTotal,
                      reste: Math.max(0, newTotal - scolarite.total_verse),
                      surplus: Math.max(0, scolarite.total_verse - newTotal)
                    });
                    toast.success("Montant total mis à jour");
                  }}
                  className="w-full bg-neutral-50 dark:bg-neutral-800 border-2 border-dia-red/20 rounded-lg p-2 text-xs font-black text-dia-red"
                />
              </div>
            </div>

            {/* Payment Form */}
            <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 shadow-sm">
              <h3 className="text-lg font-black uppercase mb-6 flex items-center gap-2">
                <CreditCard size={20} className="text-dia-red" /> Nouveau Versement
              </h3>
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
                    <option value="inscription" className="font-bold text-orange-600">Inscription (10 000 FCFA)</option>
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
                <History size={20} className="text-dia-red" /> Historique des versements
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
                            <button 
                              onClick={() => handleUpdatePayment(v.id)}
                              className="p-3 bg-green-600 text-white rounded-full shadow-lg hover:bg-green-700 active:scale-95 transition-all"
                              title="Valider la modification"
                            >
                              <Check size={18} />
                            </button>
                            <button 
                              onClick={() => setEditingVersementId(null)}
                              className="p-3 bg-neutral-200 dark:bg-neutral-700 text-neutral-600 rounded-full shadow-sm hover:bg-neutral-300 transition-all"
                              title="Annuler"
                            >
                              <X size={18} />
                            </button>
                          </>
                        ) : (
                          <>
                            {isSuperAdmin && (
                              <>
                                <button 
                                  onClick={() => {
                                    setEditingVersementId(v.id);
                                    setEditAmount(v.montant);
                                    setEditNotes(v.notes || '');
                                    setEditDate(v.date ? (v.date.includes('T') ? v.date.split('T')[0] : v.date) : new Date().toISOString().split('T')[0]);
                                  }}
                                  className="p-3 bg-white dark:bg-neutral-700 rounded-full shadow-sm text-blue-600 hover:scale-110 transition-transform"
                                  title="Modifier ce versement (Super Admin)"
                                >
                                  <Edit2 size={18} />
                                </button>
                                <button 
                                  onClick={() => handleDeletePayment(v.id)}
                                  className="p-3 bg-white dark:bg-neutral-700 rounded-full shadow-sm text-red-600 hover:scale-110 hover:bg-red-50 transition-transform"
                                  title="Supprimer ce versement (Super Admin)"
                                >
                                  <Trash2 size={18} />
                                </button>
                              </>
                            )}
                            <button 
                              onClick={() => handleGeneratePDF(v)}
                              className="p-3 bg-white dark:bg-neutral-700 rounded-full shadow-sm text-dia-red hover:scale-110 transition-transform"
                              title="Réimprimer le reçu"
                            >
                              <Printer size={18} />
                            </button>
                            <button 
                              onClick={() => {
                                const msg = `━━━━━━━━━━━━━━━━━━━━━━━\n🧾 *REÇU DE PAIEMENT*\n*${APP_NAME_FOR_LINKS}*\n━━━━━━━━━━━━━━━━━━━━━━━\n\nBonjour,\nNous confirmons la réception du versement suivant pour l'élève *${targetStudent.firstName} ${targetStudent.lastName}* :\n\n🔹 *Montant* : ${formatCurrency(v.montant)}\n🔹 *Reçu N°* : ${v.recu_numero}\n🔹 *Date* : ${new Date(v.date).toLocaleDateString()}\n🔹 *Mode* : ${v.mode_paiement}\n\n📊 *SITUATION FINANCIÈRE* :\n- Déjà versé : ${formatCurrency(scolarite.total_verse)}\n- *RESTE À PAYER* : ${formatCurrency(scolarite.reste)}\n\nMerci de votre confiance. 🙏\n━━━━━━━━━━━━━━━━━━━━━━━`;
                                const a = document.createElement('a');
                                a.href = generateWhatsAppLink(targetStudent.parentPhone || targetStudent.phone || '', msg);
                                a.target = '_blank';
                                a.click();
                              }}
                              className="p-3 bg-white dark:bg-neutral-700 rounded-full shadow-sm text-green-600 hover:scale-110 transition-transform"
                              title="Envoyer par WhatsApp"
                            >
                              <MessageCircle size={18} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                    {v.notes && !editingVersementId && (
                      <p className="mt-2 text-[10px] text-neutral-400 italic">Note: {v.notes}</p>
                    )}
                  </div>
                ))}
                {versements.length === 0 && (
                  <p className="text-center py-8 text-neutral-400 italic">Aucun versement enregistré.</p>
                )}
              </div>
            </div>
          </div>

          {/* Student Status Summary */}
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

              <div className="space-y-4 border-t pt-6 border-neutral-100 dark:border-neutral-800">
                <div className="flex justify-between items-center text-[10px] font-black text-neutral-400 uppercase tracking-tighter mb-[-8px]">
                   <span>Bilan de Scolarité</span>
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
                {scolarite.surplus > 0 && (
                  <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center gap-3 text-blue-700 dark:text-blue-400">
                    <AlertCircle size={20} />
                    <div className="text-xs">
                      <p className="font-bold">Trop-perçu (Surplus)</p>
                      <p className="font-black text-lg">{formatCurrency(scolarite.surplus)}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-dia-red/5 border border-dia-red/20 rounded-2xl p-6">
              <h5 className="text-xs font-black uppercase text-dia-red mb-3 flex items-center gap-2">
                <Landmark size={14} /> Mémo Administration
              </h5>
              <p className="text-xs leading-relaxed text-dia-red/70 font-medium">
                Vérifiez toujours l'identité de l'élève avant de valider un versement.
                Une fois validé, un versement ne peut plus être modifié, seulement archivé par un administrateur système.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  </div>
);
};

export default TuitionManagement;

import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { collection, query, where, getDocs, doc, setDoc, updateDoc, getDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { Student, StudentScolarite, Versement, SchoolConfig, Level } from '../../types';
import { Search, CreditCard, Printer, History, AlertCircle, CheckCircle2, User, Landmark, Share2, Send, MessageCircle } from 'lucide-react';
import { formatCurrency, cn } from '../../utils';
import { toast } from 'sonner';
import { jsPDF } from 'jspdf';
import { addAuditLog } from '../../utils/auditLogger';
import { useAuth, OperationType, FirestoreErrorInfo } from '../../context/AuthContext';
import { auth } from '../../firebase';
import { generateWhatsAppLink, APP_NAME_FOR_LINKS } from '../../utils/contactLinks';

const TuitionManagement: React.FC = () => {
  const { user } = useAuth();
  
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

  const hasPaidInscription = versements.some(v => v.categorie === 'inscription');

  useEffect(() => {
    if (targetStudent && hasPaidInscription && paymentCategory === 'inscription') {
      setPaymentCategory('scolarite');
    }
  }, [hasPaidInscription, targetStudent]);

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

  const selectStudent = async (student: Student) => {
    setLoading(true);
    setTargetStudent(student);
    setMatricule(student.matricule);
    
    try {
      // Fetch level info
      const studentLevel = levels.find(l => l.id === student.levelId);
      const defaultTuition = studentLevel?.tuition || 110000;

      // Fetch scolarite master record
      let scolariteSnap;
      try {
        scolariteSnap = await getDoc(doc(db, 'scolarites', student.uid));
      } catch (e) {
        handleFirestoreError(e, OperationType.GET, `scolarites/${student.uid}`);
      }
      
      if (scolariteSnap!.exists()) {
        const data = scolariteSnap!.data() as StudentScolarite;
        // Verify if total due matches level tuition, update if necessary
        if (data.montant_total_du !== defaultTuition && data.total_verse === 0) {
          const updated = { ...data, montant_total_du: defaultTuition, reste: defaultTuition };
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
          nom_eleve: `${student.firstName} ${student.lastName}`,
          classe_id: student.classId || 'N/A',
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
      
      const vList = versemntsSnap!.docs.map(d => ({ id: d.id, ...d.data() } as Versement)).sort((a,b) => {
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
      const updatedScolarite = {
        ...(scolariteSnap!.exists() ? scolariteSnap!.data() as StudentScolarite : {
          id: student.uid,
          eleve_id: student.uid,
          matricule: student.matricule,
          nom_eleve: `${student.firstName} ${student.lastName}`,
          classe_id: student.classId || 'N/A',
        }),
        montant_total_du: defaultTuition,
        total_verse: totalPaid,
        reste: Math.max(0, defaultTuition - totalPaid),
        surplus: Math.max(0, totalPaid - defaultTuition),
        statut_paiement: totalPaid >= defaultTuition ? 'SOLDÉ' : (totalPaid > 0 ? 'EN COURS' : 'NON PAYÉ')
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

      const versementData: Omit<Versement, 'id'> = {
        montant: amount,
        date: finalDate,
        mode_paiement: paymentMode,
        categorie: paymentCategory,
        recu_numero: recNumber,
        caissier_id: user?.uid || 'Unknown',
        notes: notes,
        recu_genere_at: new Date().toISOString(),
        recu_genere_par: user?.uid
      };

      // 1. Add Versement to subcollection
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
      setVersements([{ id: vRef.id, ...versementData }, ...versements]);
      
      // 3. Add to Audit Log
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
    doc.text(`Élève: ${targetStudent.firstName} ${targetStudent.lastName}`, margin, y);
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

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col md:flex-row gap-4 items-end">
          <div className="flex-1 space-y-2">
            <label className="text-sm font-bold text-neutral-500 uppercase tracking-wider flex items-center gap-2">
              <Search size={16} /> Matricule de l'élève
            </label>
            <input 
              type="text"
              value={matricule}
              onChange={(e) => setMatricule(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Ex: S26001"
              className="w-full px-6 py-4 bg-neutral-50 dark:bg-neutral-800 border-2 border-neutral-100 dark:border-neutral-700 rounded-xl focus:ring-4 focus:ring-dia-red/10 focus:border-dia-red outline-none transition-all font-black text-xl"
            />
          </div>
          <button 
            onClick={handleSearch}
            disabled={loading}
            className="px-8 py-4 bg-dia-red text-white rounded-xl font-bold hover:bg-red-700 transition-colors shadow-lg shadow-dia-red/20 disabled:opacity-50"
          >
            Rechercher
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4 overflow-x-auto">
        <div className="flex gap-4 min-w-max pb-2">
          {studentsList.length === 0 ? (
            <p className="text-xs text-neutral-400 italic">Chargement des élèves...</p>
          ) : (
            studentsList.slice(0, 15).map(s => (
              <button 
                key={s.uid}
                onClick={() => selectStudent(s)}
                className={cn(
                  "flex flex-col items-center gap-2 p-3 rounded-2xl border transition-all min-w-[100px]",
                  targetStudent?.uid === s.uid 
                    ? "bg-dia-red/5 border-dia-red text-dia-red" 
                    : "bg-neutral-50 dark:bg-neutral-800 border-neutral-100 dark:border-neutral-700 hover:border-dia-red/30"
                )}
              >
                <div className="w-10 h-10 bg-neutral-200 dark:bg-neutral-700 rounded-full flex items-center justify-center">
                  <User size={18} />
                </div>
                <div className="text-center">
                  <p className="text-[10px] font-bold truncate max-w-[80px]">{s.firstName}</p>
                  <p className="text-[8px] opacity-60">{s.matricule}</p>
                </div>
              </button>
            ))
          )}
          {studentsList.length > 15 && (
            <div className="flex items-center px-4 text-xs font-bold text-neutral-400">
              +{studentsList.length - 15} autres...
            </div>
          )}
        </div>
      </div>

      {targetStudent && scolarite && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
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
                    {!hasPaidInscription && (
                      <option value="inscription" className="font-bold text-orange-600">Inscription (10 000 FCFA)</option>
                    )}
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
                    onChange={(e) => setPaymentMode(e.target.value as any)}
                    className="w-full p-4 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl font-bold"
                  >
                    <option value="Espèces">Espèces</option>
                    <option value="Mobile Money">Mobile Money</option>
                    <option value="Virement">Virement</option>
                    <option value="Autre">Autre</option>
                  </select>
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
                  <div key={v.id} className="flex items-center justify-between p-4 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-100 dark:border-neutral-700 rounded-xl group hover:border-dia-red/30 transition-colors">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-black text-lg">{formatCurrency(v.montant)}</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-neutral-200 dark:bg-neutral-700 rounded text-neutral-500 uppercase">{v.mode_paiement}</span>
                      </div>
                      <div className="text-xs text-neutral-500 flex items-center gap-3">
                        <span>{new Date(v.date).toLocaleDateString()}</span>
                        <span>{v.recu_numero}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-end gap-2">
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
                    </div>
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
                <p className="text-sm text-dia-red font-bold uppercase">{targetStudent.matricule}</p>
                <div className="mt-2 flex items-center gap-2">
                  <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${
                    scolarite.statut_paiement === 'SOLDÉ' ? 'bg-green-100 text-green-700' : 
                    scolarite.statut_paiement === 'SURPLUS' ? 'bg-blue-100 text-blue-700' :
                    'bg-orange-100 text-orange-700'
                  }`}>
                    {scolarite.statut_paiement}
                  </span>
                </div>
              </div>

              <div className="space-y-4 border-t pt-6 border-neutral-100 dark:border-neutral-800">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-neutral-500">Total à payer</span>
                  <span className="font-bold">{formatCurrency(scolarite.montant_total_du)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-neutral-500">Total versé</span>
                  <span className="font-bold text-green-600">{formatCurrency(scolarite.total_verse)}</span>
                </div>
                <div className="h-px bg-neutral-100 dark:bg-neutral-800 my-2" />
                <div className="flex justify-between items-center pb-2">
                  <span className="text-sm font-black uppercase">Reste</span>
                  <span className={cn(
                    "text-2xl font-black",
                    scolarite.reste > 0 ? "text-dia-red" : "text-green-600"
                  )}>
                    {formatCurrency(scolarite.reste)}
                  </span>
                </div>

                {scolarite.reste > 0 && (
                  <div className="pt-2 flex flex-col gap-2">
                    <p className="text-[10px] font-bold text-neutral-400 uppercase text-center mb-1">Rappels rapides</p>
                    <button 
                      onClick={() => {
                        const msg = `📢 *RAPPEL DE PAIEMENT - ${APP_NAME_FOR_LINKS}*\n\nBonjour,\nSauf erreur de notre part, il reste un solde de *${formatCurrency(scolarite.reste)}* à régler pour la scolarité de ${targetStudent.firstName} ${targetStudent.lastName}.\n\nMerci de passer en caisse ou d'effectuer un virement mobile.\nCordialement.`;
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
  );
};

export default TuitionManagement;

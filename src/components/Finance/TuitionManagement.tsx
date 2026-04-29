import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { collection, query, where, getDocs, doc, setDoc, updateDoc, getDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { Student, StudentScolarite, Versement, SchoolConfig } from '../../types';
import { Search, CreditCard, Printer, History, AlertCircle, CheckCircle2, User, Landmark } from 'lucide-react';
import { formatCurrency, cn } from '../../utils';
import { toast } from 'sonner';
import { jsPDF } from 'jspdf';
import { addAuditLog } from '../../utils/auditLogger';
import { useAuth } from '../../context/AuthContext';

const TuitionManagement: React.FC = () => {
  const { user } = useAuth();
  const [matricule, setMatricule] = useState('');
  const [targetStudent, setTargetStudent] = useState<Student | null>(null);
  const [scolarite, setScolarite] = useState<StudentScolarite | null>(null);
  const [versements, setVersements] = useState<Versement[]>([]);
  const [loading, setLoading] = useState(false);
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
  const [notes, setNotes] = useState('');

  useEffect(() => {
    const fetchConfig = async () => {
      const snap = await getDoc(doc(db, 'ecole', 'current'));
      if (snap.exists()) setSchoolConfig(snap.data() as SchoolConfig);
    };
    fetchConfig();
  }, []);

  const handleSearch = async () => {
    if (!matricule.trim()) return;
    setLoading(true);
    setTargetStudent(null);
    setScolarite(null);
    setVersements([]);

    try {
      const q = query(collection(db, 'users'), where('matricule', '==', matricule.trim()), where('role', '==', 'student'));
      const snap = await getDocs(q);
      
      if (snap.empty) {
        toast.error("Aucun élève trouvé avec ce matricule");
      } else {
        const docSnap = snap.docs[0];
        const studentData = { uid: docSnap.id, ...docSnap.data() } as Student;
        setTargetStudent(studentData);

        // Fetch scolarite master record
        const scolariteSnap = await getDoc(doc(db, 'scolarites', studentData.uid));
        if (scolariteSnap.exists()) {
          setScolarite(scolariteSnap.data() as StudentScolarite);
        } else {
          // Initialize if not exists
          const initialScolarite: StudentScolarite = {
            id: studentData.uid,
            eleve_id: studentData.uid,
            matricule: studentData.matricule,
            nom_eleve: `${studentData.firstName} ${studentData.lastName}`,
            classe_id: studentData.classId || 'N/A',
            montant_total_du: 150000, // Default or fetch from class
            total_verse: 0,
            reste: 150000,
            surplus: 0,
            statut_paiement: 'EN COURS'
          };
          setScolarite(initialScolarite);
        }

        // Fetch deployments
        const versemntsSnap = await getDocs(collection(db, 'scolarites', studentData.uid, 'versements'));
        const vList = versemntsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Versement)).sort((a,b) => b.date.localeCompare(a.date));
        setVersements(vList);
      }
    } catch (error) {
      console.error(error);
      toast.error("Erreur lors de la recherche");
    } finally {
      setLoading(false);
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
      const versementData: Omit<Versement, 'id'> = {
        montant: amount,
        date: new Date().toISOString(),
        mode_paiement: paymentMode,
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
      addAuditLog("VERSEMENT_AJOUTÉ", targetStudent.uid, { montant: amount, recu: recNumber });

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

      {targetStudent && scolarite && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Payment Form */}
            <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 shadow-sm">
              <h3 className="text-lg font-black uppercase mb-6 flex items-center gap-2">
                <CreditCard size={20} className="text-dia-red" /> Nouveau Versement
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                    <button 
                      onClick={() => handleGeneratePDF(v)}
                      className="p-3 bg-white dark:bg-neutral-700 rounded-full shadow-sm text-dia-red hover:scale-110 transition-transform"
                      title="Réimprimer le reçu"
                    >
                      <Printer size={18} />
                    </button>
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

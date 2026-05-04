import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase';
import { collection, query, where, getDocs, addDoc, updateDoc, doc, serverTimestamp, orderBy, onSnapshot } from 'firebase/firestore';
import { DailyReport, ClassRoom } from '../types';
import { useTranslation } from 'react-i18next';
import { Calendar, FileText, Plus, Search, Filter, Printer, CheckCircle, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { OperationType, handleFirestoreError } from '../services/firestoreUtils';
import { addAuditLog } from '../utils/auditLogger';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

const ReportManagement: React.FC = () => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState<DailyReport | null>(null);
  
  // Filters
  const [filterClass, setFilterClass] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [showQuotaStatus, setShowQuotaStatus] = useState(false);
  const [quotaStats, setQuotaStats] = useState<{ total: number, quota: number, diff: number, status: 'ok' | 'low' | 'high' } | null>(null);

  useEffect(() => {
    if (filterClass && classes.length > 0) {
      const cls = classes.find(c => c.id === filterClass);
      const level = cls ? (cls as any).levelId : null; // In case levelId is not on ClassRoom type directly
      
      // We need to fetch the level hours. Assuming classes have level info or we fetch levels.
      // For now, let's look at the class's level quota if available.
      const classReports = reports.filter(r => r.classe_id === filterClass && r.statut === 'soumis');
      const totalHours = classReports.reduce((acc, r) => acc + (r.duree_heures || 0), 0);
      
      // Find level quota (hardcoded fallback if not found)
      // Ideally levels context should be used but let's assume a standard quota per level for now or fetch it
      const quota = 100; // Placeholder, should be from level
      const diff = totalHours - quota;
      
      let status: 'ok' | 'low' | 'high' = 'ok';
      if (diff < -10) status = 'low';
      else if (diff > 10) status = 'high';
      
      setQuotaStats({ total: totalHours, quota, diff, status });
      setShowQuotaStatus(true);
    } else {
      setShowQuotaStatus(false);
    }
  }, [filterClass, reports, classes]);

  useEffect(() => {
    const fetchClasses = async () => {
      try {
        const q = query(collection(db, 'classes'));
        const querySnapshot = await getDocs(q);
        const fetchedClasses = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ClassRoom));
        setClasses(fetchedClasses);
      } catch (error) {
        console.error("Error fetching classes:", error);
      }
    };

    fetchClasses();
  }, []);

  useEffect(() => {
    let q = query(collection(db, 'rapports_journaliers'), orderBy('date', 'desc'));

    if (!isAdmin && user) {
      q = query(collection(db, 'rapports_journaliers'), where('enseignant_id', '==', user.uid), orderBy('date', 'desc'));
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedReports = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DailyReport));
      setReports(fetchedReports);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'rapports_journaliers');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, isAdmin]);

  const handlePrintPDF = (report: DailyReport) => {
    const doc = new jsPDF();
    const logoImg = "/logo.png"; // Assuming logo exists

    // Header
    doc.setFontSize(22);
    doc.setTextColor(220, 38, 38); // dia-red
    doc.text("DIA DEUTSCH INSTITUT", 105, 20, { align: 'center' });
    
    doc.setFontSize(16);
    doc.setTextColor(0, 0, 0);
    doc.text("RAPPORT JOURNALIER DE COURS", 105, 30, { align: 'center' });
    
    doc.setDrawColor(200, 200, 200);
    doc.line(20, 35, 190, 35);

    // Info Section
    doc.setFontSize(12);
    doc.text(`Enseignant: ${report.enseignant_nom}`, 20, 45);
    doc.text(`Date: ${new Date(report.date).toLocaleDateString()}`, 140, 45);
    
    const className = classes.find(c => c.id === report.classe_id)?.name || report.classe_id;
    doc.text(`Classe: ${className}`, 20, 55);
    doc.text(`Matière: ${report.matiere}`, 140, 55);

    doc.line(20, 60, 190, 60);

    // Content
    doc.setFontSize(14);
    doc.text("Contenu du cours:", 20, 70);
    doc.setFontSize(11);
    const splitContent = doc.splitTextToSize(report.contenu, 170);
    doc.text(splitContent, 20, 80);

    let currentY = 80 + (splitContent.length * 7);

    // Attendance
    doc.setFontSize(14);
    doc.text("Présences:", 20, currentY + 10);
    doc.setFontSize(11);
    doc.text(`Présents: ${report.presents}`, 20, currentY + 20);
    doc.text(`Absents: ${report.absents}`, 70, currentY + 20);

    // Observations
    if (report.observations) {
      doc.setFontSize(14);
      doc.text("Observations / Incidents:", 20, currentY + 35);
      doc.setFontSize(11);
      const splitObs = doc.splitTextToSize(report.observations, 170);
      doc.text(splitObs, 20, currentY + 45);
      currentY += splitObs.length * 7 + 10;
    }

    // Homework
    if (report.devoirs) {
      doc.setFontSize(14);
      doc.text("Devoirs / Travaux:", 20, currentY + 35);
      doc.setFontSize(11);
      const splitDevoirs = doc.splitTextToSize(report.devoirs, 170);
      doc.text(splitDevoirs, 20, currentY + 45);
    }

    // Footer
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(10);
      doc.text(`Généré le ${new Date().toLocaleString()} - Page ${i} sur ${pageCount}`, 105, 285, { align: 'center' });
    }

    doc.save(`Rapport_${report.date}_${report.enseignant_nom.replace(/\s+/g, '_')}.pdf`);
    toast.success("PDF généré avec succès");
    addAuditLog("RAPPORT_PDF_EXPORT", report.id, { date: report.date });
  };

  const filteredReports = reports.filter(r => {
    return (!filterClass || r.classe_id === filterClass) &&
           (!filterDate || r.date === filterDate) &&
           (!filterStatut || r.statut === filterStatut);
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-dia-red uppercase tracking-tight">
            {isAdmin ? "Gestion des Rapports" : "Mes Rapports Journaliers"}
          </h2>
          <p className="text-sm text-neutral-500">Suivi des activités pédagogiques quotidiennes</p>
        </div>
        {!isAdmin && (
          <button 
            onClick={() => { setSelectedReport(null); setIsModalOpen(true); }}
            className="btn-primary flex items-center gap-2"
          >
            <Plus size={18} /> Nouveau Rapport
          </button>
        )}
      </div>

      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-4 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={18} />
            <select 
              value={filterClass}
              onChange={(e) => setFilterClass(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-neutral-200 dark:border-neutral-800 rounded-lg bg-transparent outline-none focus:ring-2 focus:ring-dia-red/20"
            >
              <option value="">Toutes les classes</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={18} />
            <input 
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-neutral-200 dark:border-neutral-800 rounded-lg bg-transparent outline-none focus:ring-2 focus:ring-dia-red/20"
            />
          </div>
          <div className="relative">
            <CheckCircle className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={18} />
            <select 
              value={filterStatut}
              onChange={(e) => setFilterStatut(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-neutral-200 dark:border-neutral-800 rounded-lg bg-transparent outline-none focus:ring-2 focus:ring-dia-red/20"
            >
              <option value="">Tous les statuts</option>
              <option value="brouillon">Brouillon</option>
              <option value="soumis">Soumis</option>
            </select>
          </div>
          <div className="flex items-center text-sm text-neutral-400 px-2">
            {filteredReports.length} rapport(s) trouvé(s)
          </div>
        </div>

        {showQuotaStatus && quotaStats && (
          <div className={cn(
            "mt-4 p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all duration-500",
            quotaStats.status === 'ok' ? "bg-green-50 border-green-200 text-green-800" : 
            quotaStats.status === 'low' ? "bg-red-50 border-red-200 text-red-800" : 
            "bg-orange-50 border-orange-200 text-orange-800"
          )}>
            <div className="flex items-center gap-3">
              <div className={cn(
                "p-2 rounded-lg",
                quotaStats.status === 'ok' ? "bg-green-500 text-white" : "bg-red-500 text-white"
              )}>
                <Clock size={20} />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest opacity-70">Quota Horaire du Niveau</p>
                <div className="flex items-center gap-2">
                  <span className="text-xl font-black">{quotaStats.total}h / {quotaStats.quota}h</span>
                  <span className={cn(
                    "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase",
                    quotaStats.status === 'ok' ? "bg-green-200 text-green-800" : "bg-red-200 text-white bg-red-600"
                  )}>
                    {quotaStats.status === 'ok' ? "Quota Atteint" : 
                     quotaStats.status === 'low' ? "Insuffisant" : "Dépassement"}
                  </span>
                </div>
              </div>
            </div>
            
            <div className="flex flex-col sm:items-end">
              <p className="text-xs font-bold">Différence: {quotaStats.diff > 0 ? '+' : ''}{quotaStats.diff}h</p>
              {quotaStats.status === 'high' && (
                <p className="text-[10px] italic">Attention: les heures en dépassement (+10h) ne sont rémunérées que sur validation.</p>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/50">
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-neutral-500">Date</th>
                {isAdmin && <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-neutral-500">Enseignant</th>}
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-neutral-500">Classe</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-neutral-500">Matière</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-neutral-500">Statut</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-neutral-500 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {filteredReports.map((report) => (
                <tr key={report.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/30 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <Calendar size={14} className="text-neutral-400" />
                        <span className="font-medium">{new Date(report.date).toLocaleDateString()}</span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-neutral-400 font-mono mt-1">
                        <Clock size={10} />
                        <span>{report.heure_debut} - {report.heure_fin} ({report.duree_heures}h)</span>
                      </div>
                    </div>
                  </td>
                  {isAdmin && <td className="px-6 py-4 font-bold">{report.enseignant_nom}</td>}
                  <td className="px-6 py-4 text-neutral-600 dark:text-neutral-400">
                    {classes.find(c => c.id === report.classe_id)?.name || "N/A"}
                  </td>
                  <td className="px-6 py-4 font-medium">{report.matiere}</td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1">
                      <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase w-fit ${
                        report.statut === 'soumis' 
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                          : 'bg-dia-yellow/20 text-dia-yellow dark:text-yellow-400'
                      }`}>
                        {report.statut}
                      </span>
                      {report.justifie && (
                        <span className={cn(
                          "px-2 py-0.5 rounded-full text-[9px] font-bold uppercase w-fit",
                          report.valide_par_admin ? "bg-green-500 text-white" : "bg-red-500 text-white"
                        )}>
                          {report.valide_par_admin ? "Validé par Admin" : "Dépassement non validé"}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button 
                        onClick={() => handlePrintPDF(report)}
                        className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors text-neutral-500"
                        title="Imprimer PDF"
                      >
                        <Printer size={16} />
                      </button>
                      {(isAdmin || report.statut === 'brouillon') && (
                        <button 
                          onClick={() => { setSelectedReport(report); setIsModalOpen(true); }}
                          className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors text-dia-red"
                          title="Modifier"
                        >
                          <FileText size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredReports.length === 0 && (
                <tr>
                  <td colSpan={isAdmin ? 6 : 5} className="px-6 py-12 text-center text-neutral-500">
                    Aucun rapport disponible.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <ReportModal 
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            report={selectedReport}
            user={user}
            classes={classes}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

const ReportModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  report: DailyReport | null;
  user: any;
  classes: ClassRoom[];
}> = ({ onClose, report, user, classes }) => {
  const [formData, setFormData] = useState({
    classe_id: report?.classe_id || '',
    matiere: report?.matiere || '',
    date: report?.date || new Date().toISOString().split('T')[0],
    contenu: report?.contenu || '',
    presents: report?.presents || 0,
    absents: report?.absents || 0,
    duree_heures: report?.duree_heures || 0,
    heure_debut: report?.heure_debut || '08:00',
    heure_fin: report?.heure_fin || '12:00',
    observations: report?.observations || '',
    devoirs: report?.devoirs || '',
    statut: report?.statut || 'brouillon',
    justifie: report?.justifie || false,
    valide_par_admin: report?.valide_par_admin || false
  });

  const selectedClass = classes.find(c => c.id === formData.classe_id);
  const totalStudentsInClass = selectedClass?.studentIds.length || 0;

  useEffect(() => {
    // If presents is changed, auto-calculate absents
    const abs = Math.max(0, totalStudentsInClass - formData.presents);
    if (abs !== formData.absents) {
      setFormData(prev => ({ ...prev, absents: abs }));
    }
  }, [formData.presents, totalStudentsInClass]);

  useEffect(() => {
    if (formData.heure_debut && formData.heure_fin) {
      const [h1, m1] = formData.heure_debut.split(':').map(Number);
      const [h2, m2] = formData.heure_fin.split(':').map(Number);
      const min1 = h1 * 60 + m1;
      const min2 = h2 * 60 + m2;
      const diff = min2 - min1;
      if (diff > 0) {
        setFormData(prev => ({ ...prev, duree_heures: parseFloat((diff / 60).toFixed(2)) }));
      }
    }
  }, [formData.heure_debut, formData.heure_fin]);

  const handleSubmit = async (statut: 'brouillon' | 'soumis') => {
    if (!formData.classe_id || !formData.date || !formData.contenu || !formData.duree_heures) {
      toast.error("Veuillez remplir les champs obligatoires (incluant la durée)");
      return;
    }

    try {
      const reportData = {
        ...formData,
        statut,
        enseignant_id: user.uid,
        enseignant_nom: `${user.firstName} ${user.lastName}`,
        updatedAt: new Date().toISOString()
      };

      if (report) {
        await updateDoc(doc(db, 'rapports_journaliers', report.id), reportData);
        toast.success("Rapport mis à jour");
        addAuditLog("RAPPORT_MODIFIE", report.id);
      } else {
        await addDoc(collection(db, 'rapports_journaliers'), {
          ...reportData,
          createdAt: new Date().toISOString()
        });
        toast.success(statut === 'soumis' ? "Rapport soumis avec succès" : "Brouillon enregistré");
        addAuditLog("RAPPORT_CREE", undefined, { date: formData.date });
      }
      onClose();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'rapports_journaliers');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-2xl bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl overflow-hidden"
      >
        <div className="p-6 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
          <h3 className="text-xl font-bold">{report ? "Modifier le rapport" : "Nouveau Rapport Journalier"}</h3>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600">×</button>
        </div>
        
        <div className="p-6 max-h-[70vh] overflow-y-auto space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Classe *</label>
              <select 
                value={formData.classe_id}
                onChange={(e) => setFormData({...formData, classe_id: e.target.value})}
                className="w-full p-2 border border-neutral-200 dark:border-neutral-800 rounded-lg bg-transparent"
              >
                <option value="">Sélectionner une classe</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Date *</label>
              <input 
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({...formData, date: e.target.value})}
                className="w-full p-2 border border-neutral-200 dark:border-neutral-800 rounded-lg bg-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Matière *</label>
            <input 
              type="text"
              value={formData.matiere}
              onChange={(e) => setFormData({...formData, matiere: e.target.value})}
              placeholder="ex: Grammaire, Vocabulaire..."
              className="w-full p-2 border border-neutral-200 dark:border-neutral-800 rounded-lg bg-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Contenu du cours *</label>
            <textarea 
              value={formData.contenu}
              onChange={(e) => setFormData({...formData, contenu: e.target.value})}
              rows={4}
              placeholder="Détaillez les notions abordées..."
              className="w-full p-2 border border-neutral-200 dark:border-neutral-800 rounded-lg bg-transparent"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Heure de début *</label>
              <input 
                type="time"
                value={formData.heure_debut}
                onChange={(e) => setFormData({...formData, heure_debut: e.target.value})}
                className="w-full p-2 border border-neutral-200 dark:border-neutral-800 rounded-lg bg-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Heure de fin *</label>
              <input 
                type="time"
                value={formData.heure_fin}
                onChange={(e) => setFormData({...formData, heure_fin: e.target.value})}
                className="w-full p-2 border border-neutral-200 dark:border-neutral-800 rounded-lg bg-transparent"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Présents {formData.classe_id && `(sur ${totalStudentsInClass})`}
              </label>
              <input 
                type="number"
                max={totalStudentsInClass}
                value={formData.presents}
                onChange={(e) => setFormData({...formData, presents: Math.min(totalStudentsInClass, parseInt(e.target.value) || 0)})}
                className="w-full p-2 border border-neutral-200 dark:border-neutral-800 rounded-lg bg-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Absents</label>
              <input 
                type="number"
                readOnly
                value={formData.absents}
                className="w-full p-2 border border-neutral-200 dark:border-neutral-800 rounded-lg bg-neutral-50 dark:bg-neutral-800/50 cursor-not-allowed"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 inline-flex items-center gap-1">
                Durée (H) *
              </label>
              <input 
                type="number"
                step="0.01"
                readOnly
                value={formData.duree_heures}
                className="w-full p-2 border border-neutral-100 dark:border-neutral-800 rounded-lg bg-neutral-50 dark:bg-neutral-800/50 font-bold cursor-not-allowed"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Observations / Incidents</label>
            <textarea 
              value={formData.observations}
              onChange={(e) => setFormData({...formData, observations: e.target.value})}
              rows={2}
              className="w-full p-2 border border-neutral-200 dark:border-neutral-800 rounded-lg bg-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Devoirs ou travaux donnés</label>
            <textarea 
              value={formData.devoirs}
              onChange={(e) => setFormData({...formData, devoirs: e.target.value})}
              rows={2}
              className="w-full p-2 border border-neutral-200 dark:border-neutral-800 rounded-lg bg-transparent"
            />
          </div>

          <div className="p-4 bg-orange-50 dark:bg-orange-950/20 border border-orange-100 dark:border-orange-900/30 rounded-xl space-y-3">
            <div className="flex items-center gap-2">
              <input 
                type="checkbox"
                id="justifie"
                checked={formData.justifie}
                onChange={(e) => setFormData({...formData, justifie: e.target.checked})}
                className="w-4 h-4 text-dia-red rounded focus:ring-dia-red"
              />
              <label htmlFor="justifie" className="text-sm font-bold text-orange-800 dark:text-orange-300">
                Cette séance est un dépassement de quota (doit être justifiée)
              </label>
            </div>
            
            {(user.role === 'admin' || user.isSuperAdmin) && (
              <div className="flex items-center gap-2 pt-2 border-t border-orange-200 dark:border-orange-900/50">
                <input 
                  type="checkbox"
                  id="valide_par_admin"
                  checked={formData.valide_par_admin}
                  onChange={(e) => setFormData({...formData, valide_par_admin: e.target.checked})}
                  className="w-4 h-4 text-green-600 rounded focus:ring-green-500"
                />
                <label htmlFor="valide_par_admin" className="text-sm font-bold text-green-700 dark:text-green-400">
                  Valider le paiement pour ce dépassement (Admin uniquement)
                </label>
              </div>
            )}
          </div>
        </div>

        <div className="p-6 bg-neutral-50 dark:bg-neutral-800/50 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-neutral-500 hover:text-neutral-700">Annuler</button>
          <button onClick={() => handleSubmit('brouillon')} className="btn-secondary">Sauvegarder Brouillon</button>
          <button onClick={() => handleSubmit('soumis')} className="btn-primary">Soumettre le Rapport</button>
        </div>
      </motion.div>
    </div>
  );
};

export default ReportManagement;

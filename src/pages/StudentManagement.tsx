import React, { useState, useRef, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, doc, setDoc, addDoc } from 'firebase/firestore';
import { 
  Search, 
  Plus, 
  Filter, 
  MoreVertical, 
  Printer, 
  Download,
  UserPlus,
  Phone,
  Calendar,
  X,
  Edit,
  Eye,
  CreditCard,
  FileText,
  Bell,
  RefreshCw,
  Trash2,
  Send,
  ChevronUp,
  ChevronDown,
  Laptop,
  Smartphone,
  Camera,
  DollarSign
} from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import { useTranslation } from 'react-i18next';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { cn, formatCurrency, generateMatricule } from '../utils';
import { Student, ClassRoom, Level, TuitionPayment } from '../types';
import { NotificationService } from '../services/NotificationService';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { toast } from 'sonner';
import { generateWhatsAppLink, generateSMSLink, APP_NAME_FOR_LINKS } from '../utils/contactLinks';

export default function StudentManagement() {
  const { t } = useTranslation();
  const { fetchWithAuth, user, profile } = useAuth();
  const { 
    students, classes, levels, loading, 
    refreshStudents, refreshClasses, refreshLevels, refreshFinances, refreshAll 
  } = useData();

  const userEmail = (user?.email || profile?.email || '').toLowerCase();
  const isSuperAdmin = (profile as any)?.isSuperAdmin || 
                       (user as any)?.isSuperAdmin || 
                       userEmail === 'yombivictor@gmail.com' || 
                       userEmail === 'gabrielyombi311@gmail.com';
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'active' | 'former'>('active');
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' }>({ key: 'name', direction: 'asc' });
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedTuition, setSelectedTuition] = useState<number | ''>('');
  const [selectedStream, setSelectedStream] = useState<string>('');
  const itemsPerPage = 20;
  
  const printRef = useRef<HTMLDivElement>(null);
  const receiptRef = useRef<HTMLDivElement>(null);

  const handlePrint = useReactToPrint({
    contentRef: printRef,
  });

  const handlePrintReceipt = useReactToPrint({
    contentRef: receiptRef,
  });

  const handleDownloadPDFReceipt = async () => {
    if (!selectedStudent) return;
    
    try {
      setSubmitting(true);
      const doc = new jsPDF();
      
      // Header
      doc.setFillColor(227, 30, 36);
      doc.rect(0, 0, 210, 40, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(22);
      doc.text(`${t('login.title')} - ${t('students.receipt_header')}`, 20, 25);
      
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(10);
      const dateStr = new Date().toLocaleDateString();
      doc.text(`${t('students.date')} : ${dateStr}`, 160, 50);
      doc.text(`N° : ${Date.now()}`, 160, 55);

      // Student Info
      doc.setFont('helvetica', 'bold');
      doc.text(t('students.student_info'), 20, 60);
      doc.setFont('helvetica', 'normal');
      doc.text(`${t('students.lastName')} : ${selectedStudent.lastName} ${selectedStudent.firstName}`, 20, 70);
      doc.text(`${t('students.matricule')} : ${selectedStudent.matricule}`, 20, 75);
      doc.text(`${t('students.level')} : ${levels.find(l => l.id === selectedStudent.levelId)?.name || 'N/A'}`, 20, 85);

      // Payments Table
      const paidPayments = selectedStudent.payments.filter(p => p.amount > 0);
      autoTable(doc, {
        startY: 100,
        head: [[t('students.designation'), t('students.date'), t('students.amount')]],
        body: paidPayments.map(p => [
          `Scolarité - Tranche ${p.tranche}`, 
          p.date ? new Date(p.date).toLocaleDateString() : 'N/A', 
          formatCurrency(p.amount)
        ]),
        theme: 'striped',
        headStyles: { fillColor: [227, 30, 36] }
      });

      const finalY = (doc as any).lastAutoTable.finalY + 15;
      const totalPaid = (selectedStudent.payments || []).reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
      
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text(`${t('students.total_paid').toUpperCase()} : ${formatCurrency(totalPaid)}`, 140, finalY);

      // Signatures
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('Signature Étudiant', 40, finalY + 30);
      doc.text('Signature Institut', 140, finalY + 30);
      doc.line(20, finalY + 60, 80, finalY + 60);
      doc.line(130, finalY + 60, 190, finalY + 60);

      doc.save(`Recu_${selectedStudent.matricule}.pdf`);
      toast.success(t('students.receipt_downloaded'));
    } catch (err) {
      console.error("Error generating receipt PDF:", err);
      toast.error(t('common.error'));
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    refreshStudents();
    refreshClasses();
    refreshLevels();
  }, [refreshStudents, refreshClasses, refreshLevels]);

  const handleAddStudent = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitting) return;

    const formData = new FormData(e.currentTarget);
    const firstName = (formData.get('firstName') as string).trim();
    const lastName = (formData.get('lastName') as string).trim();

    // STRICT DUPLICATE CHECK: Check if student already exists
    const duplicate = students.find(s => 
      s.firstName.toLowerCase() === firstName.toLowerCase() && 
      s.lastName.toLowerCase() === lastName.toLowerCase() &&
      !s.isFormer
    );

    if (duplicate) {
      if (!window.confirm(`Un étudiant nommé "${lastName} ${firstName}" existe déjà dans le système.\n\nSouhaitez-vous plutôt mettre à jour ses informations et être redirigé vers sa gestion ?`)) {
        return;
      }
      // If user confirms, we "merge" or rather treat this as an edit/view
      setSelectedStudent(duplicate);
      setIsAddModalOpen(false);
      setIsDetailModalOpen(true);
      return;
    }

    setSubmitting(true);
    
    const matricule = generateMatricule('student');
    const password = formData.get('password') as string || 'DIA2026.';
    
    const levelId = formData.get('levelId') as string;
    const level = levels.find(l => l.id === levelId);
    const classId = formData.get('classId') as string;
    const cls = classes.find(c => c.id === classId);

    const payInscription = formData.get('payInscription') === 'on';
    const inscriptionAmount = payInscription ? 10000 : 0;
    
    const payVorbereitung = formData.get('payVorbereitung') === 'on';
    const vorbereitungAmount = payVorbereitung ? (Number(formData.get('vorbereitungAmount')) || 0) : 0;

    const newStudent = {
      matricule,
      email: formData.get('email'),
      password, // On stocke le mot de passe pour l'envoyer
      firstName: formData.get('firstName'),
      lastName: formData.get('lastName'),
      phone: formData.get('phone'),
      birthDate: formData.get('birthDate'),
      birthPlace: formData.get('birthPlace'),
      gender: formData.get('gender'),
      cni: formData.get('cni'),
      parentName: formData.get('parentName'),
      parentPhone: formData.get('parentPhone'),
      levelId,
      classId,
      role: 'student',
      status: 'offline',
      createdAt: new Date().toISOString(),
      payments: [
        { tranche: 1, amount: Number(formData.get('tranche1')) || 0, date: formData.get('tranche1') ? new Date().toISOString() : null },
        { tranche: 2, amount: Number(formData.get('tranche2')) || 0, date: formData.get('tranche2') ? new Date().toISOString() : null },
        { tranche: 3, amount: Number(formData.get('tranche3')) || 0, date: formData.get('tranche3') ? new Date().toISOString() : null }
      ]
    };

    try {
      const res = await fetchWithAuth('/api/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newStudent,
          inscriptionAmount,
          vorbereitungAmount,
          totalTuition: formData.get('totalTuition') ? Number(formData.get('totalTuition')) : ''
        })
      });

      if (res.ok) {
        const student = await res.json();
        
        // Credentials notification
        const cls = classes.find(c => c.id === classId);
        const scheduleStr = cls?.schedule?.map(s => `${s.day} (${s.startTime}-${s.endTime})`).join(', ');
        try {
          await NotificationService.sendCredentials(fetchWithAuth, student, password, cls?.name, scheduleStr);
        } catch (notifErr) {
          console.warn("Could not send credentials notification:", notifErr);
        }

        setIsAddModalOpen(false);
        await Promise.all([
          refreshStudents(),
          refreshFinances()
        ]);
        toast.success(t('students.student_added') || "Étudiant enregistré avec succès");
      } else {
        const errorData = await res.json();
        toast.error(errorData.message || t('common.error'));
      }
    } catch (err) {
      console.error("Error adding student:", err);
      toast.error(t('common.error'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditStudent = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedStudent) return;
    
    const formData = new FormData(e.currentTarget);
    const updatedStudent = {
      ...selectedStudent,
      firstName: formData.get('firstName'),
      lastName: formData.get('lastName'),
      email: formData.get('email'),
      phone: formData.get('phone'),
      birthDate: formData.get('birthDate'),
      birthPlace: formData.get('birthPlace'),
      gender: formData.get('gender'),
      cni: formData.get('cni'),
      parentName: formData.get('parentName'),
      parentPhone: formData.get('parentPhone'),
      levelId: formData.get('levelId'),
      classId: formData.get('classId'),
    };

    try {
      const res = await fetchWithAuth(`/api/students/${selectedStudent.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedStudent)
      });
      if (res.ok) {
        setIsEditModalOpen(false);
        refreshStudents();
      }
    } catch (err) {
      console.error("Error updating student:", err);
    }
  };

  const handleArchiveStudent = async (id: string) => {
    if (!window.confirm(t('students.confirm_archive'))) return;
    
    try {
      const res = await fetchWithAuth(`/api/students/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isFormer: true, classId: null })
      });
      if (res.ok) {
        toast.success(t('students.student_updated'));
        refreshStudents();
      }
    } catch (err) {
      console.error("Error archiving student:", err);
      toast.error(t('common.error'));
    }
  };

  const handleHardDeleteStudent = async (student: any) => {
    if (!student?.id) return;
    
    const confirmMsg = `VOUS ALLEZ SUPPRIMER DÉFINITIVEMENT :\n- L'élève : ${student.lastName} ${student.firstName}\n- Son compte utilisateur\n- Ses scolarités\n- Toutes ses transactions financières\n\nCette action est IRRÉVERSIBLE. Continuer ?`;
    
    if (!window.confirm(confirmMsg)) return;
    
    setSubmitting(true);
    toast.loading("Suppression en cours...", { id: 'delete-student' });
    try {
      console.log("Delete call for:", student.id);
      const res = await fetchWithAuth(`/api/students/${student.id}`, {
        method: 'DELETE'
      });
      
      if (res.ok) {
        toast.success("Suppression réussie", { id: 'delete-student' });
        await refreshAll(true);
        setTimeout(() => refreshAll(true), 2000);
      } else {
        const errorData = await res.json();
        toast.error(errorData.message || "Erreur lors de la suppression", { id: 'delete-student' });
      }
    } catch (err) {
      console.error("Delete error:", err);
      toast.error("Erreur réseau lors de la suppression", { id: 'delete-student' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetCredentials = async (id: string) => {
    const student = students.find(s => s.id === id);
    if (!student) return;
    if (!window.confirm(`${t('students.reset_credentials_confirm')} ${student.firstName}?`)) return;
    
    try {
      setSubmitting(true);
      const res = await fetchWithAuth(`/api/students/resend-credentials/${id}`, {
        method: 'POST'
      });
      if (res.ok) {
        const { password } = await res.json();
        
        // Send WhatsApp with new credentials
        const cls = classes.find(c => c.id === student.classId);
        const scheduleStr = cls?.schedule?.map(s => `${s.day} (${s.startTime}-${s.endTime})`).join(', ');
        await NotificationService.sendCredentials(fetchWithAuth, student, password, cls?.name, scheduleStr);

        toast.success(t('students.credentials_sent'));
      }
    } catch (err) {
      console.error("Error resetting credentials:", err);
      toast.error(t('common.error'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendReceiptWhatsApp = () => {
    if (!selectedStudent) return;
    
    const totalPaid = (selectedStudent.payments || []).reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
    const level = levels.find(l => l.id === selectedStudent.levelId);
    const tuition = level?.tuition || 0;
    const balance = tuition - totalPaid;
    
    const paidTranches = selectedStudent.payments
      .filter(p => p.amount > 0)
      .map(p => `✅ Tranche ${p.tranche}: ${formatCurrency(p.amount)}`)
      .join('\n');
      
    const message = `*REÇU DE PAIEMENT - ${APP_NAME_FOR_LINKS}*\n\n` +
      `Bonjour ${selectedStudent.firstName},\n\n` +
      `Voici le point sur vos paiements :\n` +
      `${paidTranches}\n\n` +
      `💰 *Total payé : ${formatCurrency(totalPaid)}*\n` +
      `📉 *Reste à payer : ${formatCurrency(balance)}*\n\n` +
      `Merci de votre confiance.\n_L'administration_`;
      
    const a = document.createElement('a');
    a.href = generateWhatsAppLink(selectedStudent.parentPhone || selectedStudent.phone || '', message);
    a.target = '_blank';
    a.click();
    toast.success("Lien WhatsApp généré");
  };

  const handleRestoreStudent = async (id: string) => {
    try {
      const res = await fetchWithAuth(`/api/students/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isFormer: false })
      });
      if (res.ok) {
        toast.success(t('students.student_restored'));
        refreshStudents();
      }
    } catch (err) {
      console.error("Error restoring student:", err);
      toast.error(t('common.error'));
    }
  };

  const handleUpdatePayment = async (tranche: number | undefined, amount: number, category?: string, dateStr?: string) => {
    if (!selectedStudent) return;
    
    let updatedPayments: TuitionPayment[];
    const dt = dateStr ? new Date(dateStr).toISOString() : new Date().toISOString();
    
    if (tranche !== undefined) {
      // It's a tuition tranche
      updatedPayments = selectedStudent.payments.map(p => 
        p.tranche === tranche ? { 
          ...p, 
          amount, 
          date: dateStr ? dt : (p.amount === 0 && amount > 0 ? dt : p.date), 
          receiptId: p.receiptId || `REC-${Date.now()}` 
        } : p
      );
    } else {
      // It's a generic payment
      const newPayment: TuitionPayment = {
        amount,
        date: dt,
        receiptId: `REC-${Date.now()}`,
        category: category as any || 'autre',
        method: 'Espèces'
      };
      updatedPayments = [...(selectedStudent.payments || []), newPayment];
    }

    try {
      setSubmitting(true);
      const res = await fetchWithAuth(`/api/students/${selectedStudent.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payments: updatedPayments })
      });
      if (res.ok) {
        const updated = await res.json();
        setSelectedStudent(updated);
        refreshStudents();
        toast.success(t('students.payment_registered') || 'Paiement enregistré');
      }
    } catch (err) {
      console.error("Error updating payment:", err);
      toast.error(t('common.error'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendReminder = async (targetStudent?: Student) => {
    const studentToRemind = targetStudent || selectedStudent;
    if (!studentToRemind) return;
    
    // Robust matching: Try ID first, then try name as fallback
    const level = levels.find(l => l.id === studentToRemind.levelId) || 
                  levels.find(l => l.name.toLowerCase() === studentToRemind.levelId?.toLowerCase());

    if (!level) {
      toast.error(t('students.level_not_found') + " (ID: " + studentToRemind.levelId + ")");
      return;
    }

    try {
      setSubmitting(true);
      await NotificationService.sendPaymentReminder(fetchWithAuth, studentToRemind, level.tuition);
      toast.success(t('students.reminder_sent'));
    } catch (err) {
      console.error("Error sending reminder:", err);
      toast.error(t('common.error'));
    } finally {
      setSubmitting(false);
    }
  };

  const exportToCSV = () => {
    const headers = ['Matricule', 'Nom', 'Prénom', 'Téléphone', 'Niveau', 'Classe', 'Statut'];
    const rows = students.map(s => [
      s.matricule,
      s.lastName,
      s.firstName,
      s.phone,
      levels.find(l => l.id === s.levelId)?.name || 'N/A',
      classes.find(c => c.id === s.classId)?.name || 'N/A',
      s.status
    ]);

    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `liste_etudiants_dia_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const sortedStudents = React.useMemo(() => {
    const filtered = students.filter(s => {
      const matchesSearch = `${s.lastName} ${s.firstName} ${s.matricule}`.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesTab = activeTab === 'active' ? !s.isFormer : s.isFormer;
      return matchesSearch && matchesTab;
    });

    return [...filtered].sort((a, b) => {
      if (!sortConfig || !a || !b) return 0;
      const { key, direction } = sortConfig;
      
      let aValue: any;
      let bValue: any;

      if (key === 'name') {
        const lastNameA = a.lastName || '';
        const firstNameA = a.firstName || '';
        const lastNameB = b.lastName || '';
        const firstNameB = b.firstName || '';
        const fullA = `${lastNameA} ${firstNameA}`.trim();
        const fullB = `${lastNameB} ${firstNameB}`.trim();
        const comp = fullA.localeCompare(fullB, 'fr', { sensitivity: 'base' });
        return direction === 'asc' ? comp : -comp;
      } else if (key === 'matricule') {
        aValue = (a.matricule || '').toLowerCase();
        bValue = (b.matricule || '').toLowerCase();
      } else if (key === 'level') {
        aValue = levels.find(l => l.id === a.levelId)?.name?.toLowerCase() || '';
        bValue = levels.find(l => l.id === b.levelId)?.name?.toLowerCase() || '';
      } else if (key === 'class') {
        aValue = classes.find(c => c.id === a.classId)?.name?.toLowerCase() || '';
        bValue = classes.find(c => c.id === b.classId)?.name?.toLowerCase() || '';
      } else if (key === 'tuition') {
        const pA = a.payments || [];
        const pB = b.payments || [];
        aValue = pA.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
        bValue = pB.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
      } else {
        aValue = (a as any)[key];
        bValue = (b as any)[key];
      }

      if (aValue < bValue) return direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [students, searchQuery, activeTab, sortConfig, levels, classes]);

  const paginatedStudents = React.useMemo(() => {
    return sortedStudents.slice(0, currentPage * itemsPerPage);
  }, [sortedStudents, currentPage, itemsPerPage]);

  const hasMore = sortedStudents.length > paginatedStudents.length;

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, activeTab]);

  const handleSort = (key: string) => {
    setSortConfig(p => ({
      key,
      direction: p.key === key && p.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const SortIcon = ({ column }: { column: string }) => {
    if (!sortConfig || sortConfig.key !== column) return null;
    return sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h3 className="text-xl font-bold">{t('students.title')}</h3>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setIsAddModalOpen(true)}
            className="btn-primary flex items-center gap-2"
          >
            <UserPlus size={18} />
            <span>{t('students.add_student')}</span>
          </button>
          <button 
            onClick={handlePrint}
            className="p-2 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg hover:bg-neutral-50 transition-colors"
          >
            <Printer size={18} />
          </button>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="card p-4 space-y-4">
        <div className="flex border-b border-neutral-100 dark:border-neutral-800">
          <button 
            onClick={() => setActiveTab('active')}
            className={cn(
              "px-6 py-3 text-sm font-bold transition-all border-b-2",
              activeTab === 'active' ? "border-dia-red text-dia-red" : "border-transparent text-neutral-400 hover:text-neutral-600"
            )}
          >
            {t('students.active_students')}
          </button>
          <button 
            onClick={() => setActiveTab('former')}
            className={cn(
              "px-6 py-3 text-sm font-bold transition-all border-b-2",
              activeTab === 'former' ? "border-dia-red text-dia-red" : "border-transparent text-neutral-400 hover:text-neutral-600"
            )}
          >
            {t('students.former_students')}
          </button>
        </div>
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1 group">
            <input 
              type="text" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('common.search')}
              className="w-full pl-10 pr-4 py-2 bg-neutral-100 dark:bg-neutral-800 border-none rounded-lg focus:ring-2 focus:ring-dia-red transition-all"
            />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 group-focus-within:text-dia-red transition-colors pointer-events-none z-10" size={18} />
          </div>
          <div className="flex gap-2">
            <select 
              className="px-4 py-2 bg-neutral-100 dark:bg-neutral-800 rounded-lg text-sm font-bold outline-none border-none focus:ring-2 focus:ring-dia-red appearance-none cursor-pointer"
              value={sortConfig?.key ? `${sortConfig.key}-${sortConfig.direction}` : ''}
              onChange={(e) => {
                const [key, direction] = e.target.value.split('-');
                setSortConfig({ key, direction: direction as 'asc' | 'desc' });
              }}
            >
              <option value="">{t('common.sort_by') || 'Trier par'}</option>
              <option value="name-asc">A-Z</option>
              <option value="name-desc">Z-A</option>
              <option value="createdAt-desc">{t('common.newest') || 'Plus récent'}</option>
              <option value="createdAt-asc">{t('common.oldest') || 'Plus ancien'}</option>
              <option value="tuition-desc">{t('students.most_paid') || 'Plus payé'}</option>
              <option value="tuition-asc">{t('students.least_paid') || 'Moins payé'}</option>
            </select>
            <button 
              onClick={exportToCSV}
              className="flex items-center gap-2 px-4 py-2 bg-neutral-100 dark:bg-neutral-800 rounded-lg text-sm font-medium hover:bg-neutral-200 transition-colors"
            >
              <Download size={16} />
              <span>{t('common.export') || 'Exporter'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Students List */}
      <div className="space-y-4">
        {/* Table View (Desktop) */}
        <div className="hidden md:block card overflow-hidden" ref={printRef}>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-neutral-50 dark:bg-neutral-800/50 border-bottom border-neutral-200 dark:border-neutral-800">
                  <th 
                    className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-neutral-500 cursor-pointer hover:text-dia-red transition-colors"
                    onClick={() => handleSort('name')}
                  >
                    <div className="flex items-center gap-1">
                      {t('students.student_label') || 'Étudiant'} <SortIcon column="name" />
                    </div>
                  </th>
                  <th 
                    className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-neutral-500 cursor-pointer hover:text-dia-red transition-colors"
                    onClick={() => handleSort('matricule')}
                  >
                    <div className="flex items-center gap-1">
                      {t('students.matricule')} <SortIcon column="matricule" />
                    </div>
                  </th>
                  <th 
                    className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-neutral-500 cursor-pointer hover:text-dia-red transition-colors"
                    onClick={() => handleSort('level')}
                  >
                    <div className="flex items-center gap-1">
                      {t('students.level')} <SortIcon column="level" />
                    </div>
                  </th>
                  <th 
                    className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-neutral-500 cursor-pointer hover:text-dia-red transition-colors"
                    onClick={() => handleSort('class')}
                  >
                    <div className="flex items-center gap-1">
                      {t('students.class')} <SortIcon column="class" />
                    </div>
                  </th>
                  <th 
                    className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-neutral-500 cursor-pointer hover:text-dia-red transition-colors"
                    onClick={() => handleSort('tuition')}
                  >
                    <div className="flex items-center gap-1">
                      {t('sidebar.finances')} <SortIcon column="tuition" />
                    </div>
                  </th>
                  <th 
                    className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-neutral-500 cursor-pointer hover:text-dia-red transition-colors"
                    onClick={() => handleSort('createdAt')}
                  >
                    <div className="flex items-center gap-1">
                      {t('common.date') || 'Date'} <SortIcon column="createdAt" />
                    </div>
                  </th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-neutral-500 text-right">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                {paginatedStudents.map((student) => {
                  const totalPaid = (student.payments || []).reduce((acc, p) => acc + (p.amount || 0), 0);
                  const level = levels.find(l => l.id === student.levelId);
                  const tuition = level?.tuition || 0;
                  const isFullyPaid = totalPaid >= tuition;
  
                  return (
                    <tr key={student.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors cursor-pointer" onClick={() => {
                      setSelectedStudent(student);
                      setIsDetailModalOpen(true);
                    }}>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-dia-red/10 text-dia-red flex items-center justify-center font-bold">
                            {student.lastName[0]}{student.firstName[0]}
                          </div>
                          <div>
                            <p className="font-bold text-sm">{student.lastName} {student.firstName}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-mono text-xs font-bold bg-neutral-100 dark:bg-neutral-800 px-2 py-1 rounded">
                          {student.matricule}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <p className="font-medium">{level?.name || 'N/A'}</p>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <p className="font-medium text-neutral-500">{classes.find(c => c.id === student.classId)?.name || t('students.not_assigned') }</p>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          <div className="flex justify-between text-[10px] font-bold uppercase">
                            <span>{formatCurrency(totalPaid)}</span>
                            <span className="text-neutral-400">/ {formatCurrency(tuition)}</span>
                          </div>
                          <div className="w-full bg-neutral-100 rounded-full h-1.5 overflow-hidden">
                            <div 
                              className={cn("h-full transition-all", isFullyPaid ? "bg-green-500" : "bg-dia-red")}
                              style={{ width: `${Math.min(100, (totalPaid / tuition) * 100)}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-xs font-medium text-neutral-500">
                        {student.createdAt ? new Date(student.createdAt).toLocaleDateString() : 'N/A'}
                      </td>
                      <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end gap-2">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              const msg = `Bonjour ${student.firstName}, c'est l'Institut ${APP_NAME_FOR_LINKS}. Comment pouvons-nous vous aider ?`;
                              const a = document.createElement('a');
                              a.href = generateWhatsAppLink(student.phone || student.parentPhone || '', msg);
                              a.target = '_blank';
                              a.click();
                            }}
                            className="p-2 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg transition-colors text-green-600"
                            title="WhatsApp"
                          >
                            <Smartphone size={18} />
                          </button>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedStudent(student);
                              setIsReceiptModalOpen(true);
                            }}
                            className="p-2 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg transition-colors text-blue-600"
                            title={t('students.manage_payments')}
                          >
                            <CreditCard size={18} />
                          </button>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedStudent(student);
                              setIsEditModalOpen(true);
                            }}
                            className="p-2 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg transition-colors text-blue-600"
                            title={t('common.edit')}
                          >
                            <Edit size={18} />
                          </button>
                          {isSuperAdmin && (
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleHardDeleteStudent(student);
                              }}
                              disabled={submitting}
                              className={cn(
                                "p-2 rounded-lg transition-colors text-red-600 font-bold hover:bg-red-50",
                                submitting && "opacity-50"
                              )}
                              title={t('common.delete_forever')}
                            >
                              <Trash2 size={18} className={submitting ? "animate-pulse" : ""} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Card View (Mobile) */}
        <div className="grid grid-cols-1 gap-4 md:hidden">
          {paginatedStudents.map((student) => {
            const totalPaid = (student.payments || []).reduce((acc, p) => acc + (p.amount || 0), 0);
            const level = levels.find(l => l.id === student.levelId);
            const tuition = level?.tuition || 0;
            const isFullyPaid = totalPaid >= tuition;
            const cls = classes.find(c => c.id === student.classId);

            return (
              <div 
                key={student.id} 
                className="card p-4 space-y-4 active:scale-95 transition-transform"
                onClick={() => {
                  setSelectedStudent(student);
                  setIsDetailModalOpen(true);
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-dia-red/10 text-dia-red flex items-center justify-center font-bold">
                      {student.lastName[0]}{student.firstName[0]}
                    </div>
                    <div>
                      <p className="font-bold text-sm tracking-tight">{student.lastName} {student.firstName}</p>
                      <p className="text-[10px] font-mono text-neutral-400">{student.matricule}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-neutral-900 bg-neutral-100 dark:bg-neutral-800 px-2 py-1 rounded inline-block">
                      {level?.name || 'N/A'}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[10px] font-bold uppercase">
                  <div className="p-2 bg-neutral-50 dark:bg-neutral-800/50 rounded-lg">
                    <p className="text-neutral-400 mb-0.5">Classe</p>
                    <p className="text-neutral-900 truncate">{cls?.name || 'Non assigné'}</p>
                  </div>
                  <div className="p-2 bg-neutral-50 dark:bg-neutral-800/50 rounded-lg">
                    <p className="text-neutral-400 mb-0.5">Scolarité</p>
                    <p className={cn("truncate", isFullyPaid ? "text-green-500" : "text-dia-red")}>
                      {totalPaid} / {tuition}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-neutral-100 dark:border-neutral-800" onClick={(e) => e.stopPropagation()}>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => {
                        const msg = `Bonjour ${student.firstName}, c'est l'Institut ${APP_NAME_FOR_LINKS}. Comment pouvons-nous vous aider ?`;
                        window.open(generateWhatsAppLink(student.phone || student.parentPhone || '', msg), '_blank');
                      }}
                      className="p-2 bg-green-50 text-green-600 rounded-lg active:bg-green-100 shadow-sm"
                    >
                      <Smartphone size={18} />
                    </button>
                    <button 
                      onClick={() => {
                        setSelectedStudent(student);
                        setIsReceiptModalOpen(true);
                      }}
                      className="p-2 bg-blue-50 text-blue-600 rounded-lg active:bg-blue-100 shadow-sm"
                    >
                      <CreditCard size={18} />
                    </button>
                  </div>
                  <div className="flex gap-2">
                     <button 
                      onClick={() => {
                        setSelectedStudent(student);
                        setIsEditModalOpen(true);
                      }}
                      className="p-2 bg-neutral-100 text-neutral-600 rounded-lg active:bg-neutral-200"
                    >
                      <Edit size={18} />
                    </button>
                    {isSuperAdmin && (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleHardDeleteStudent(student);
                        }}
                        disabled={submitting}
                        className={cn(
                          "p-2 rounded-lg active:bg-red-100",
                          submitting ? "opacity-50 cursor-not-allowed bg-neutral-100" : "bg-red-50 text-red-600"
                        )}
                        title="Supprimer"
                      >
                        <Trash2 size={18} className={submitting ? "animate-pulse" : ""} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {hasMore && (
          <div className="p-6 text-center">
            <button 
              onClick={() => setCurrentPage(p => p + 1)}
              className="px-6 py-2 bg-neutral-100 dark:bg-neutral-800 rounded-xl text-sm font-bold uppercase hover:bg-neutral-200 transition-all text-neutral-600 dark:text-neutral-300"
            >
              {t('common.show_more') || 'Voir plus'} ({sortedStudents.length - paginatedStudents.length} restants)
            </button>
          </div>
        )}
      </div>

      {/* Add Student Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-neutral-900 w-full max-w-2xl rounded-[32px] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <form onSubmit={handleAddStudent} className="flex flex-col max-h-[90vh]">
              <div className="p-8 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between shrink-0">
                <h3 className="text-2xl font-bold tracking-tight">{t('students.add_student')}</h3>
                <button type="button" onClick={() => setIsAddModalOpen(false)} className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition-colors">
                  <X size={24} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-8 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">Email *</label>
                  <input name="email" required type="email" placeholder="example@gmail.com" className="w-full px-5 py-3 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-2xl focus:ring-2 focus:ring-dia-red/20 focus:border-dia-red outline-none transition-all" />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">{t('students.firstName')}</label>
                  <input name="firstName" required type="text" className="w-full px-5 py-3 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-2xl focus:ring-2 focus:ring-dia-red/20 focus:border-dia-red outline-none transition-all" />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">{t('students.lastName')}</label>
                  <input name="lastName" required type="text" className="w-full px-5 py-3 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-2xl focus:ring-2 focus:ring-dia-red/20 focus:border-dia-red outline-none transition-all" />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">{t('students.phone')}</label>
                  <input name="phone" required type="tel" className="w-full px-5 py-3 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-2xl focus:ring-2 focus:ring-dia-red/20 focus:border-dia-red outline-none transition-all" />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">Filière (Allemand/Anglais/Autre)</label>
                  <select 
                    value={selectedStream}
                    onChange={(e) => {
                      const stream = e.target.value;
                      setSelectedStream(stream);
                      setSelectedTuition('');
                    }}
                    className="w-full px-5 py-3 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-2xl focus:ring-2 focus:ring-dia-red/20 outline-none"
                  >
                    <option value="">Toutes les filières</option>
                    <option value="Allemand">Allemand</option>
                    <option value="Anglais">Anglais</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">{t('students.level')}</label>
                  <select 
                    name="levelId" 
                    required 
                    onChange={(e) => {
                      const level = levels.find(l => l.id === e.target.value);
                      if (level) setSelectedTuition(level.tuition);
                    }}
                    className="w-full px-5 py-3 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-2xl focus:ring-2 focus:ring-dia-red/20 focus:border-dia-red outline-none transition-all"
                  >
                    <option value="">Sélectionner un niveau</option>
                    {levels.filter(l => 
                      !selectedStream || 
                      l.stream === selectedStream || 
                      l.type?.toLowerCase() === selectedStream.toLowerCase()
                    ).map(l => (
                      <option key={l.id} value={l.id}>{l.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">Montant Total Scolarité</label>
                  <input 
                    name="totalTuition" 
                    type="number" 
                    value={selectedTuition}
                    onChange={(e) => setSelectedTuition(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full px-5 py-3 bg-white dark:bg-neutral-800/50 border-2 border-dia-red/50 rounded-2xl focus:ring-2 focus:ring-dia-red/20 outline-none transition-all font-bold text-dia-red" 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">{t('students.class')}</label>
                  <select name="classId" className="w-full px-5 py-3 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-2xl focus:ring-2 focus:ring-dia-red/20 focus:border-dia-red outline-none transition-all">
                    <option value="">{t('students.not_assigned')}</option>
                    {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="space-y-4 md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-orange-50 dark:bg-orange-900/10 border-2 border-orange-100 dark:border-orange-900/30 rounded-2xl flex items-center gap-3">
                    <input name="payInscription" type="checkbox" className="w-6 h-6 accent-orange-600 rounded cursor-pointer" />
                    <div>
                      <p className="text-xs font-black uppercase text-orange-600 tracking-wider">Frais d'Inscription</p>
                      <p className="text-[10px] font-bold text-orange-500">10 000 FCFA (Optionnel)</p>
                    </div>
                  </div>
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/10 border-2 border-blue-100 dark:border-blue-900/30 rounded-2xl flex flex-col justify-center">
                    <div className="flex items-center gap-3 mb-1">
                      <input name="payVorbereitung" type="checkbox" className="w-6 h-6 accent-blue-600 rounded cursor-pointer" />
                      <p className="text-xs font-black uppercase text-blue-600 tracking-wider">Vorbereitung</p>
                    </div>
                    <input name="vorbereitungAmount" type="number" className="w-full text-xs bg-transparent border-b border-blue-200 outline-none font-bold text-blue-700" placeholder="Montant variable (ex: 50000)" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">{t('students.initial_payment')} (Tranche 1) (Optionnel)</label>
                  <input name="tranche1" type="number" placeholder="0" className="w-full px-5 py-3 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-2xl focus:ring-2 focus:ring-dia-red/20 focus:border-dia-red outline-none transition-all" />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">{t('students.initial_payment')} (Tranche 2) (Optionnel)</label>
                  <input name="tranche2" type="number" placeholder="0" className="w-full px-5 py-3 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-2xl focus:ring-2 focus:ring-dia-red/20 focus:border-dia-red outline-none transition-all" />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">{t('students.initial_payment')} (Tranche 3) (Optionnel)</label>
                  <input name="tranche3" type="number" placeholder="0" className="w-full px-5 py-3 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-2xl focus:ring-2 focus:ring-dia-red/20 focus:border-dia-red outline-none transition-all" />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">{t('students.gender') || 'Genre'}</label>
                  <select name="gender" required className="w-full px-5 py-3 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-2xl focus:ring-2 focus:ring-dia-red/20 focus:border-dia-red outline-none transition-all">
                    <option value="M">{t('students.male') || 'Masculin'}</option>
                    <option value="F">{t('students.female') || 'Féminin'}</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">{t('students.dob')}</label>
                  <input name="birthDate" required type="date" className="w-full px-5 py-3 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-2xl focus:ring-2 focus:ring-dia-red/20 focus:border-dia-red outline-none transition-all" />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">{t('students.pob')}</label>
                  <input name="birthPlace" required type="text" className="w-full px-5 py-3 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-2xl focus:ring-2 focus:ring-dia-red/20 focus:border-dia-red outline-none transition-all" />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">{t('students.cni')} ({t('common.optional') || 'Optionnel'})</label>
                  <input name="cni" type="text" className="w-full px-5 py-3 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-2xl focus:ring-2 focus:ring-dia-red/20 focus:border-dia-red outline-none transition-all" />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">{t('students.guardianName')}</label>
                  <input name="parentName" required type="text" placeholder={t('students.fullName') || 'Nom complet'} className="w-full px-5 py-3 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-2xl focus:ring-2 focus:ring-dia-red/20 focus:border-dia-red outline-none transition-all" />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">{t('students.guardianPhone')}</label>
                  <input name="parentPhone" required type="tel" className="w-full px-5 py-3 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-2xl focus:ring-2 focus:ring-dia-red/20 focus:border-dia-red outline-none transition-all" />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">{t('login.password')}</label>
                  <input name="password" type="text" defaultValue="DIA2026." className="w-full px-5 py-3 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-2xl focus:ring-2 focus:ring-dia-red/20 focus:border-dia-red outline-none transition-all" />
                  <p className="text-[10px] text-neutral-500 mt-1">{t('students.password_hint') || "L'étudiant pourra le modifier après sa première connexion."}</p>
                </div>
              </div>
            </div>
            <div className="p-8 border-t border-neutral-100 dark:border-neutral-800 flex gap-4">
              <button type="button" onClick={() => setIsAddModalOpen(false)} className="flex-1 px-6 py-4 bg-neutral-100 dark:bg-neutral-800 rounded-2xl font-bold transition-all hover:bg-neutral-200">{t('common.cancel')}</button>
              <button 
                type="submit" 
                disabled={submitting}
                className="flex-1 btn-primary py-4 flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white/30 border-t-white"></div>
                    {t('common.saving')}
                  </>
                ) : (
                  t('students.add_student')
                )}
              </button>
            </div>
          </form>
          </div>
        </div>
      )}

      {/* Edit Student Modal */}
      {isEditModalOpen && selectedStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-neutral-900 w-full max-w-2xl rounded-[32px] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <form onSubmit={handleEditStudent} className="flex flex-col max-h-[90vh]">
              <div className="p-8 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between shrink-0">
                <h3 className="text-2xl font-bold tracking-tight">{t('students.edit_student')}</h3>
                <button type="button" onClick={() => setIsEditModalOpen(false)} className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition-colors">
                  <X size={24} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-8 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">Email *</label>
                  <input name="email" defaultValue={selectedStudent.email} required type="email" className="w-full px-5 py-3 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-2xl focus:ring-2 focus:ring-dia-red/20 focus:border-dia-red outline-none transition-all" />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">{t('students.firstName')}</label>
                  <input name="firstName" defaultValue={selectedStudent.firstName} required type="text" className="w-full px-5 py-3 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-2xl focus:ring-2 focus:ring-dia-red/20 focus:border-dia-red outline-none transition-all" />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">{t('students.lastName')}</label>
                  <input name="lastName" defaultValue={selectedStudent.lastName} required type="text" className="w-full px-5 py-3 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-2xl focus:ring-2 focus:ring-dia-red/20 focus:border-dia-red outline-none transition-all" />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">{t('students.phone')}</label>
                  <input name="phone" defaultValue={selectedStudent.phone} required type="tel" className="w-full px-5 py-3 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-2xl focus:ring-2 focus:ring-dia-red/20 focus:border-dia-red outline-none transition-all" />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">{t('students.level')}</label>
                  <select name="levelId" defaultValue={selectedStudent.levelId} required className="w-full px-5 py-3 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-2xl focus:ring-2 focus:ring-dia-red/20 focus:border-dia-red outline-none transition-all">
                    {levels.map(l => <option key={l.id} value={l.id}>{l.name} ({formatCurrency(l.tuition)})</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">{t('students.class')}</label>
                  <select name="classId" defaultValue={selectedStudent.classId} className="w-full px-5 py-3 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-2xl focus:ring-2 focus:ring-dia-red/20 focus:border-dia-red outline-none transition-all">
                    <option value="">{t('students.not_assigned')}</option>
                    {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">{t('students.gender')}</label>
                  <select name="gender" defaultValue={selectedStudent.gender} required className="w-full px-5 py-3 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-2xl focus:ring-2 focus:ring-dia-red/20 focus:border-dia-red outline-none transition-all">
                    <option value="M">{t('students.male')}</option>
                    <option value="F">{t('students.female')}</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">{t('students.dob')}</label>
                  <input name="birthDate" defaultValue={selectedStudent.birthDate} required type="date" className="w-full px-5 py-3 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-2xl focus:ring-2 focus:ring-dia-red/20 focus:border-dia-red outline-none transition-all" />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">{t('students.pob')}</label>
                  <input name="birthPlace" defaultValue={selectedStudent.birthPlace} required type="text" className="w-full px-5 py-3 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-2xl focus:ring-2 focus:ring-dia-red/20 focus:border-dia-red outline-none transition-all" />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">{t('students.cni')} ({t('common.optional')})</label>
                  <input name="cni" defaultValue={selectedStudent.cni} type="text" className="w-full px-5 py-3 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-2xl focus:ring-2 focus:ring-dia-red/20 focus:border-dia-red outline-none transition-all" />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">{t('students.guardianName')}</label>
                  <input name="parentName" defaultValue={selectedStudent.parentName} required type="text" className="w-full px-5 py-3 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-2xl focus:ring-2 focus:ring-dia-red/20 focus:border-dia-red outline-none transition-all" />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">{t('students.guardianPhone')}</label>
                  <input name="parentPhone" defaultValue={selectedStudent.parentPhone} required type="tel" className="w-full px-5 py-3 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-2xl focus:ring-2 focus:ring-dia-red/20 focus:border-dia-red outline-none transition-all" />
                </div>
              </div>
            </div>
            <div className="p-8 border-t border-neutral-100 dark:border-neutral-800 flex gap-4">
              <button type="button" onClick={() => setIsEditModalOpen(false)} className="flex-1 px-6 py-4 bg-neutral-100 dark:bg-neutral-800 rounded-2xl font-bold transition-all hover:bg-neutral-200">{t('common.cancel')}</button>
              <button 
                type="submit" 
                disabled={submitting}
                className="flex-1 btn-primary py-4 flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white/30 border-t-white"></div>
                    {t('common.updating')}
                  </>
                ) : (
                  t('common.save_changes')
                )}
              </button>
            </div>
          </form>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {isDetailModalOpen && selectedStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-neutral-900 w-full max-w-2xl rounded-[32px] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-8 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
              <h3 className="text-2xl font-bold tracking-tight">{t('students.student_details')}</h3>
              <button onClick={() => setIsDetailModalOpen(false)} className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition-colors">
                <X size={24} />
              </button>
            </div>
            <div className="p-8 space-y-6">
              <div className="flex items-center gap-6">
                <div className="relative group">
                  <div className="w-24 h-24 rounded-3xl bg-dia-red/10 text-dia-red flex items-center justify-center text-3xl font-bold overflow-hidden">
                    {selectedStudent.photoURL ? (
                      <img src={selectedStudent.photoURL} alt="Student" className="w-full h-full object-cover" />
                    ) : (
                      <>{selectedStudent.lastName[0]}{selectedStudent.firstName[0]}</>
                    )}
                  </div>
                  <button 
                    onClick={() => {
                      const input = document.createElement('input');
                      input.type = 'file';
                      input.accept = 'image/*';
                      input.onchange = async (e: any) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        
                        const formData = new FormData();
                        formData.append('photo', file);
                        formData.append('userId', selectedStudent.uid);
                        
                        try {
                          toast.loading(t('profile.uploading'));
                          const res = await fetchWithAuth('/api/profile/upload-photo', {
                            method: 'POST',
                            body: formData
                          });
                          
                          if (res.ok) {
                            const data = await res.json();
                            setSelectedStudent({ ...selectedStudent, photoURL: data.photoURL });
                            refreshStudents();
                            toast.dismiss();
                            toast.success(t('profile.photo_success'));
                          }
                        } catch (err) {
                          toast.dismiss();
                          toast.error(t('profile.upload_error'));
                        }
                      };
                      input.click();
                    }}
                    className="absolute -bottom-2 -right-2 p-2 bg-dia-red text-white rounded-xl shadow-lg hover:scale-110 transition-transform"
                  >
                    <Camera size={14} />
                  </button>
                </div>
                <div>
                  <h4 className="text-2xl font-bold">{selectedStudent.lastName} {selectedStudent.firstName}</h4>
                  <p className="text-neutral-500 font-mono">{selectedStudent.matricule}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-8">
                <div>
                  <p className="text-[11px] font-bold uppercase text-neutral-400 mb-1">{t('profile.personal_info')}</p>
                  <p className="text-sm"><strong>{t('students.gender') || 'Sexe'} :</strong> {selectedStudent.gender === 'M' ? (t('students.male') || 'Masculin') : (t('students.female') || 'Féminin')}</p>
                  <p className="text-sm"><strong>{t('students.dob')} :</strong> {selectedStudent.birthDate ? new Date(selectedStudent.birthDate).toLocaleDateString() : 'N/A'} {t('common.at') || 'à'} {selectedStudent.birthPlace || 'N/A'}</p>
                  {selectedStudent.cni && <p className="text-sm"><strong>{t('students.cni')} :</strong> {selectedStudent.cni}</p>}
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase text-neutral-400 mb-1">{t('students.last_login') || 'Dernière Connexion'}</p>
                  <div className="flex items-center gap-2 text-dia-red">
                    {selectedStudent.lastActiveDevice?.toLowerCase().includes('android') || selectedStudent.lastActiveDevice?.toLowerCase().includes('ios') ? <Smartphone size={16} /> : <Laptop size={16} />}
                    <p className="text-sm font-bold">{selectedStudent.lastActiveDevice || t('students.never_connected') || 'Jamais connecté'}</p>
                  </div>
                  {selectedStudent.lastLoginAt && <p className="text-[10px] text-neutral-500 mt-1 italic">{t('students.last_activity')} {new Date(selectedStudent.lastLoginAt).toLocaleString()}</p>}
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase text-neutral-400 mb-1">{t('students.contact') || 'Contact'}</p>
                  <p className="text-sm flex items-center gap-2 font-medium"><Phone size={14} className="text-dia-red" /> {selectedStudent.phone}</p>
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase text-neutral-400 mb-1">{t('students.academic') || 'Académique'}</p>
                  <p className="text-sm font-bold">{levels.find(l => l.id === selectedStudent.levelId)?.name}</p>
                  <p className="text-sm text-neutral-500">{classes.find(c => c.id === selectedStudent.classId)?.name || t('students.not_assigned')}</p>
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase text-neutral-400 mb-1">{t('students.parent_info')}</p>
                  <p className="text-sm font-bold">{selectedStudent.parentName}</p>
                  <p className="text-sm">{selectedStudent.parentPhone}</p>
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase text-neutral-400 mb-1">{t('students.tuition_status') || 'Statut Scolarité'}</p>
                  <p className="text-sm font-bold">
                    {formatCurrency((selectedStudent.payments || []).reduce((acc, p) => acc + (Number(p.amount) || 0), 0))} / {formatCurrency(levels.find(l => l.id === selectedStudent.levelId)?.tuition || 0)}
                  </p>
                </div>
              </div>
              <div className="pt-6 border-t border-neutral-100 dark:border-neutral-800 flex gap-3 flex-wrap">
                <button 
                  onClick={() => {
                    setIsDetailModalOpen(false);
                    setIsEditModalOpen(true);
                  }}
                  className="flex-1 min-w-[120px] btn-primary py-3 flex items-center justify-center gap-2 text-sm"
                >
                  <Edit size={16} />
                  {t('common.edit')}
                </button>
                <button 
                  onClick={() => {
                    setIsDetailModalOpen(false);
                    setIsReceiptModalOpen(true);
                  }}
                  className="flex-1 min-w-[120px] bg-neutral-100 dark:bg-neutral-800 py-3 rounded-2xl font-bold hover:bg-neutral-200 transition-all flex items-center justify-center gap-2 text-sm"
                >
                  <CreditCard size={16} />
                  {t('sidebar.finances')}
                </button>
                <button 
                  onClick={() => {
                    const level = levels.find(l => l.id === selectedStudent.levelId) || 
                                  levels.find(l => l.name.toLowerCase() === selectedStudent.levelId?.toLowerCase());
                    const tuition = level?.tuition || 0;
                    const totalPaid = (selectedStudent.payments || []).reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
                    const balance = tuition - totalPaid;

                    const msg = `🔔 *RAPPEL DE PAIEMENT - ${APP_NAME_FOR_LINKS}*\n\n` +
                      `Bonjour ${selectedStudent.firstName},\n\n` +
                      `Nous vous rappelons qu'il reste un solde de *${formatCurrency(balance)}* à régler pour votre formation.\n\n` +
                      `Merci de votre diligence.\n_L'Administration._`;

                    const a = document.createElement('a');
                    a.href = generateWhatsAppLink(selectedStudent.parentPhone || selectedStudent.phone || '', msg);
                    a.target = '_blank';
                    a.click();
                  }}
                  disabled={((selectedStudent.payments || []).reduce((acc, p) => acc + (Number(p.amount) || 0), 0) >= (levels.find(l => l.id === selectedStudent.levelId)?.tuition || 0))}
                  className="flex-1 min-w-[120px] bg-green-100 text-green-600 py-3 rounded-2xl font-bold hover:bg-green-200 transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-50"
                >
                  <Smartphone size={16} />
                  WhatsApp
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Receipt / Payment Modal */}
      {isReceiptModalOpen && selectedStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-neutral-900 w-full max-w-4xl rounded-[32px] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-8 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-bold tracking-tight">{t('students.receipt')}</h3>
                <p className="text-neutral-500 text-sm">{selectedStudent.lastName} {selectedStudent.firstName} ({selectedStudent.matricule})</p>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={handleSendReceiptWhatsApp}
                  className="p-3 bg-green-100 dark:bg-green-900/30 text-green-600 rounded-xl hover:bg-green-200 transition-colors"
                  title="Envoyer par WhatsApp"
                >
                  <Smartphone size={20} />
                </button>
                <button 
                  onClick={handleDownloadPDFReceipt}
                  disabled={submitting}
                  className="p-3 bg-red-100 dark:bg-red-900/30 text-red-600 rounded-xl hover:bg-red-200 transition-colors"
                  title={t('students.download_pdf')}
                >
                  {submitting ? <div className="animate-spin rounded-full h-5 w-5 border-2 border-current border-t-transparent" /> : <FileText size={20} />}
                </button>
                <button onClick={handlePrintReceipt} className="p-3 bg-neutral-100 dark:bg-neutral-800 rounded-xl hover:bg-neutral-200 transition-colors">
                  <Printer size={20} />
                </button>
                <button onClick={() => setIsReceiptModalOpen(false)} className="p-3 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition-colors">
                  <X size={24} />
                </button>
              </div>
            </div>
            
            <div className="p-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Payment Forms */}
              <div className="space-y-6 overflow-y-auto max-h-[60vh] pr-4">
                <h4 className="font-bold text-lg flex items-center gap-2">
                  <CreditCard className="text-dia-red" size={20} />
                  {t('students.register_payment') || 'Enregistrer un paiement'}
                </h4>
                
                <div className="space-y-4">
                  <div className="p-1 bg-neutral-100 dark:bg-neutral-800 rounded-xl flex gap-1">
                    <button 
                      onClick={() => (window as any).paymentMode = 'tuition'}
                      className="flex-1 py-2 text-xs font-bold rounded-lg bg-white dark:bg-neutral-900 shadow-sm"
                    >
                      Scolarité
                    </button>
                    <button 
                      onClick={() => (window as any).paymentMode = 'other'}
                      className="flex-1 py-2 text-xs font-bold rounded-lg text-neutral-500 hover:bg-white/50"
                    >
                      Autres Frais
                    </button>
                  </div>

                  {/* Redirect to Finance Module */}
                  <div className="flex flex-col items-center justify-center p-8 bg-neutral-50 dark:bg-neutral-800/50 rounded-2xl border border-neutral-100 dark:border-neutral-800 text-center space-y-4">
                    <div className="p-4 rounded-full mb-2 bg-dia-red/10 text-dia-red border border-dia-red/20 shadow-inner">
                      <DollarSign size={32} />
                    </div>
                    <div>
                      <h4 className="font-black text-lg text-neutral-800 dark:text-neutral-200">Point de Caisse Centralisé</h4>
                      <p className="text-sm font-medium text-neutral-500 max-w-sm mt-2 leading-relaxed">
                        Pour des raisons de sécurité et de cohérence des données financières, l'encaissement et l'édition des reçus ont été migrés vers le module de caisse officiel.
                      </p>
                    </div>
                    <div className="pt-2">
                       <p className="bg-dia-red text-white py-2 px-6 rounded-xl text-xs font-bold uppercase tracking-widest shadow-lg shadow-dia-red/20 inline-block">
                         Menu principal ➡️ Finances
                       </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Receipt Preview */}
              <div className="bg-neutral-50 dark:bg-neutral-800/30 rounded-3xl p-6 border border-dashed border-neutral-200 dark:border-neutral-700">
                <div ref={receiptRef} className="bg-white p-8 shadow-sm rounded-xl text-neutral-900 font-sans">
                  <div className="flex justify-between items-start mb-8 border-b pb-6">
                    <div className="flex items-center gap-2">
                      <div className="relative h-10 w-10">
                        <img 
                          src="/logo.png" 
                          alt="DIA Logo" 
                          className="h-10 w-10 object-contain mb-1 bg-white opacity-100" 
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.visibility = 'hidden';
                            (e.target as HTMLImageElement).style.position = 'absolute';
                            (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                          }}
                        />
                        <div className="hidden h-10 w-10 rounded bg-dia-red flex items-center justify-center text-white font-bold text-lg">
                          D
                        </div>
                      </div>
                      <p className="text-[10px] uppercase font-bold tracking-widest text-neutral-400">DIA_SAAS</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold">{t('students.receipt_header')}</p>
                      <p className="text-[10px] text-neutral-500">#{Date.now()}</p>
                    </div>
                  </div>

                  <div className="space-y-4 mb-8">
                    <div className="flex justify-between text-sm">
                      <span className="text-neutral-500">{t('students.student_label')}:</span>
                      <span className="font-bold">{selectedStudent.lastName} {selectedStudent.firstName}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-neutral-500">{t('students.matricule')}:</span>
                      <span className="font-mono font-bold">{selectedStudent.matricule}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-neutral-500">{t('students.level') || 'Niveau'}:</span>
                      <span className="font-bold">{levels.find(l => l.id === selectedStudent.levelId)?.name}</span>
                    </div>
                  </div>

                  <table className="w-full text-sm mb-8">
                    <thead>
                      <tr className="border-b text-neutral-400 text-[10px] uppercase font-bold">
                        <th className="text-left py-2">{t('students.designation') || 'Désignation'}</th>
                        <th className="text-right py-2">{t('students.amount')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {selectedStudent.payments.filter(p => p.amount > 0).map((p, idx) => (
                        <tr key={p.tranche || `other-${idx}`}>
                          <td className="py-3">
                            {p.tranche ? `Scolarité - ${t('students.tranche')} ${p.tranche}` : (p.category ? p.category.replace('_', ' ') : 'Autre')}
                          </td>
                          <td className="py-3 text-right font-bold">{formatCurrency(p.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-neutral-900">
                        <td className="py-4 font-bold uppercase">{t('students.total_paid')}</td>
                        <td className="py-4 text-right font-black text-lg">{formatCurrency((selectedStudent.payments || []).reduce((acc, p) => acc + (Number(p.amount) || 0), 0))}</td>
                      </tr>
                    </tfoot>
                  </table>

                  <div className="text-[10px] text-neutral-400 text-center italic mb-8">
                    {t('students.receipt_footer')}
                  </div>

                  <div className="grid grid-cols-2 gap-12 pt-8 border-t border-neutral-100">
                    <div className="text-center">
                      <p className="text-[10px] font-bold uppercase text-neutral-400 mb-12">{t('students.signature_student')}</p>
                      <div className="border-b border-neutral-300 w-full"></div>
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] font-bold uppercase text-neutral-400 mb-12">{t('students.signature_institute')}</p>
                      <div className="border-b border-neutral-300 w-full"></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

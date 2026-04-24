import React, { useState, useRef, useEffect } from 'react';
import { 
  Search, 
  Plus, 
  Filter, 
  MoreVertical, 
  Printer, 
  Download,
  UserPlus,
  Mail,
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
  Camera
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

export default function StudentManagement() {
  const { t } = useTranslation();
  const { fetchWithAuth } = useAuth();
  const { students, classes, levels, loading, refreshStudents, refreshClasses, refreshLevels } = useData();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'active' | 'former'>('active');
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);
  
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
      doc.text(`${t('students.lastName')} : ${selectedStudent.firstName} ${selectedStudent.lastName}`, 20, 70);
      doc.text(`${t('students.matricule')} : ${selectedStudent.matricule}`, 20, 75);
      doc.text(`${t('students.email')} : ${selectedStudent.email}`, 20, 80);
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
    setSubmitting(true);
    
    const formData = new FormData(e.currentTarget);
    const matricule = generateMatricule('student');
    const password = formData.get('password') as string || 'DIA2026.';
    
    const levelId = formData.get('levelId') as string;
    const level = levels.find(l => l.id === levelId);
    const classId = formData.get('classId') as string;
    const cls = classes.find(c => c.id === classId);

    const newStudent = {
      matricule,
      password, // On stocke le mot de passe pour l'envoyer
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
      parentEmail: formData.get('parentEmail'),
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
        body: JSON.stringify(newStudent)
      });
      if (res.ok) {
        const student = await res.json();
        
        const scheduleStr = cls?.schedule?.map(s => `${s.day} (${s.startTime}-${s.endTime})`).join(', ');
        await NotificationService.sendCredentials(fetchWithAuth, student, password, cls?.name, scheduleStr);

        setIsAddModalOpen(false);
        refreshStudents();
        toast.success(t('students.student_added'));
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
      parentEmail: formData.get('parentEmail'),
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

  const handleHardDeleteStudent = async (id: string) => {
    if (!window.confirm(t('students.confirm_delete'))) return;
    
    try {
      setSubmitting(true);
      const res = await fetchWithAuth(`/api/students/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        toast.success(t('students.student_deleted'));
        refreshStudents();
      }
    } catch (err) {
      console.error("Error deleting student:", err);
      toast.error(t('common.error'));
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
        
        // Send email with new credentials
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

  const handleSendReceiptEmail = async () => {
    if (!selectedStudent || !receiptRef.current) return;
    
    try {
      setSubmitting(true);
      const html = receiptRef.current.innerHTML;
      const res = await fetchWithAuth('/api/students/send-receipt-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: selectedStudent.id, html })
      });
      if (res.ok) {
        toast.success(t('students.receipt_sent'));
      }
    } catch (err) {
      console.error("Error sending receipt email:", err);
      toast.error(t('common.error'));
    } finally {
      setSubmitting(false);
    }
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

  const handleUpdatePayment = async (tranche: number, amount: number) => {
    if (!selectedStudent) return;
    
    const updatedPayments = selectedStudent.payments.map(p => 
      p.tranche === tranche ? { ...p, amount, date: new Date().toISOString(), receiptId: `REC-${Date.now()}` } : p
    );

    try {
      const res = await fetchWithAuth(`/api/students/${selectedStudent.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payments: updatedPayments })
      });
      if (res.ok) {
        const updated = await res.json();
        setSelectedStudent(updated);
        refreshStudents();
      }
    } catch (err) {
      console.error("Error updating payment:", err);
    }
  };

  const handleSendReminder = async (targetStudent?: Student) => {
    const studentToRemind = targetStudent || selectedStudent;
    if (!studentToRemind) return;
    
    const level = levels.find(l => l.id === studentToRemind.levelId);
    if (!level) {
      toast.error(t('students.level_not_found'));
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
    const headers = ['Matricule', 'Nom', 'Prénom', 'Email', 'Téléphone', 'Niveau', 'Classe', 'Statut'];
    const rows = students.map(s => [
      s.matricule,
      s.lastName,
      s.firstName,
      s.email,
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
      const matchesSearch = `${s.firstName} ${s.lastName} ${s.matricule}`.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesTab = activeTab === 'active' ? !s.isFormer : s.isFormer;
      return matchesSearch && matchesTab;
    });

    return [...filtered].sort((a, b) => {
      if (!sortConfig) return 0;
      const { key, direction } = sortConfig;
      
      let aValue: any;
      let bValue: any;

      if (key === 'name') {
        aValue = `${a.lastName} ${a.firstName}`.toLowerCase();
        bValue = `${b.lastName} ${b.firstName}`.toLowerCase();
      } else if (key === 'matricule') {
        aValue = a.matricule.toLowerCase();
        bValue = b.matricule.toLowerCase();
      } else if (key === 'level') {
        aValue = levels.find(l => l.id === a.levelId)?.name?.toLowerCase() || '';
        bValue = levels.find(l => l.id === b.levelId)?.name?.toLowerCase() || '';
      } else if (key === 'class') {
        aValue = classes.find(c => c.id === a.classId)?.name?.toLowerCase() || '';
        bValue = classes.find(c => c.id === b.classId)?.name?.toLowerCase() || '';
      } else if (key === 'tuition') {
        aValue = (a.payments || []).reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
        bValue = (b.payments || []).reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
      } else {
        aValue = (a as any)[key];
        bValue = (b as any)[key];
      }

      if (aValue < bValue) return direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [students, searchQuery, activeTab, sortConfig, levels, classes]);

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
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

      {/* Students Table */}
      <div className="card overflow-hidden" ref={printRef}>
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
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-neutral-500 text-right">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {sortedStudents.map((student) => {
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
                          {student.firstName[0]}{student.lastName[0]}
                        </div>
                        <div>
                          <p className="font-bold text-sm">{student.firstName} {student.lastName}</p>
                          <p className="text-xs text-neutral-500">{student.email}</p>
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
                    <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-2">
                        {activeTab === 'active' ? (
                          <>
                            <button 
                              onClick={() => handleResetCredentials(student.id)}
                              className="p-2 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg transition-colors text-dia-yellow"
                              title={t('students.resend_credentials')}
                            >
                              <RefreshCw size={18} />
                            </button>
                            <button 
                              onClick={async (e) => {
                                e.stopPropagation();
                                handleSendReminder(student);
                              }}
                              disabled={submitting || isFullyPaid}
                              className="p-2 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg transition-colors text-dia-red disabled:opacity-30 disabled:grayscale"
                              title={isFullyPaid ? t('students.tuition_paid') : t('students.send_reminder')}
                            >
                              <Bell size={18} />
                            </button>
                            <button 
                              onClick={() => {
                                setSelectedStudent(student);
                                setIsReceiptModalOpen(true);
                              }}
                              className="p-2 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg transition-colors text-dia-red"
                              title={t('students.manage_payments')}
                            >
                              <CreditCard size={18} />
                            </button>
                            <button 
                              onClick={() => {
                                setSelectedStudent(student);
                                setIsEditModalOpen(true);
                              }}
                              className="p-2 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg transition-colors text-blue-600"
                              title={t('common.edit')}
                            >
                              <Edit size={18} />
                            </button>
                            <button 
                              onClick={() => handleArchiveStudent(student.id)}
                              className="p-2 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg transition-colors text-orange-600"
                              title={t('common.archive')}
                            >
                              <X size={18} />
                            </button>
                            <button 
                              onClick={() => handleHardDeleteStudent(student.id)}
                              className="p-2 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg transition-colors text-red-600 font-bold"
                              title={t('common.delete_forever')}
                            >
                              <Trash2 size={18} />
                            </button>
                          </>
                        ) : (
                          <div className="flex gap-2">
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
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRestoreStudent(student.id);
                              }}
                              className="flex items-center gap-2 px-3 py-1.5 bg-green-100 dark:bg-green-900/30 text-green-600 rounded-lg text-xs font-bold hover:bg-green-200 transition-colors"
                            >
                              <Plus size={14} />
                              {t('common.restore')}
                            </button>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleHardDeleteStudent(student.id);
                              }}
                              className="p-2 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg transition-colors text-red-600"
                              title={t('common.delete_forever')}
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
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
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">{t('students.firstName')}</label>
                  <input name="firstName" required type="text" className="w-full px-5 py-3 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-2xl focus:ring-2 focus:ring-dia-red/20 focus:border-dia-red outline-none transition-all" />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">{t('students.lastName')}</label>
                  <input name="lastName" required type="text" className="w-full px-5 py-3 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-2xl focus:ring-2 focus:ring-dia-red/20 focus:border-dia-red outline-none transition-all" />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">{t('students.email')}</label>
                  <input name="email" required type="email" className="w-full px-5 py-3 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-2xl focus:ring-2 focus:ring-dia-red/20 focus:border-dia-red outline-none transition-all" />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">{t('students.phone')}</label>
                  <input name="phone" required type="tel" className="w-full px-5 py-3 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-2xl focus:ring-2 focus:ring-dia-red/20 focus:border-dia-red outline-none transition-all" />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">{t('students.level')}</label>
                  <select name="levelId" required className="w-full px-5 py-3 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-2xl focus:ring-2 focus:ring-dia-red/20 focus:border-dia-red outline-none transition-all">
                    {levels.map(l => <option key={l.id} value={l.id}>{l.name} ({formatCurrency(l.tuition)})</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">{t('students.class')}</label>
                  <select name="classId" className="w-full px-5 py-3 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-2xl focus:ring-2 focus:ring-dia-red/20 focus:border-dia-red outline-none transition-all">
                    <option value="">{t('students.not_assigned')}</option>
                    {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">{t('students.initial_payment')} (Tranche 1)</label>
                  <input name="tranche1" type="number" placeholder="0" className="w-full px-5 py-3 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-2xl focus:ring-2 focus:ring-dia-red/20 focus:border-dia-red outline-none transition-all" />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">{t('students.initial_payment')} (Tranche 2)</label>
                  <input name="tranche2" type="number" placeholder="0" className="w-full px-5 py-3 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-2xl focus:ring-2 focus:ring-dia-red/20 focus:border-dia-red outline-none transition-all" />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">{t('students.initial_payment')} (Tranche 3)</label>
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
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">{t('students.parent_email')}</label>
                  <input name="parentEmail" type="email" className="w-full px-5 py-3 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-2xl focus:ring-2 focus:ring-dia-red/20 focus:border-dia-red outline-none transition-all" />
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
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">{t('students.firstName')}</label>
                  <input name="firstName" defaultValue={selectedStudent.firstName} required type="text" className="w-full px-5 py-3 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-2xl focus:ring-2 focus:ring-dia-red/20 focus:border-dia-red outline-none transition-all" />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">{t('students.lastName')}</label>
                  <input name="lastName" defaultValue={selectedStudent.lastName} required type="text" className="w-full px-5 py-3 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-2xl focus:ring-2 focus:ring-dia-red/20 focus:border-dia-red outline-none transition-all" />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">{t('students.email')}</label>
                  <input name="email" defaultValue={selectedStudent.email} required type="email" className="w-full px-5 py-3 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-2xl focus:ring-2 focus:ring-dia-red/20 focus:border-dia-red outline-none transition-all" />
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
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">{t('students.parent_email')}</label>
                  <input name="parentEmail" defaultValue={selectedStudent.parentEmail} type="email" className="w-full px-5 py-3 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-2xl focus:ring-2 focus:ring-dia-red/20 focus:border-dia-red outline-none transition-all" />
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
                      <>{selectedStudent.firstName[0]}{selectedStudent.lastName[0]}</>
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
                  <h4 className="text-2xl font-bold">{selectedStudent.firstName} {selectedStudent.lastName}</h4>
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
                  <p className="text-sm flex items-center gap-2 font-medium"><Mail size={14} className="text-dia-red" /> {selectedStudent.email}</p>
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
                  {selectedStudent.parentEmail && <p className="text-sm">{selectedStudent.parentEmail}</p>}
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
                  onClick={handleSendReminder}
                  disabled={submitting || ((selectedStudent.payments || []).reduce((acc, p) => acc + (Number(p.amount) || 0), 0) >= (levels.find(l => l.id === selectedStudent.levelId)?.tuition || 0))}
                  className="flex-1 min-w-[120px] bg-dia-red/10 text-dia-red py-3 rounded-2xl font-bold hover:bg-dia-red/20 transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:grayscale"
                >
                  {submitting ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-dia-red/30 border-t-dia-red"></div>
                  ) : (
                    <Bell size={16} />
                  )}
                  {t('students.reminder') || 'Rappel'}
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
                <p className="text-neutral-500 text-sm">{selectedStudent.firstName} {selectedStudent.lastName} ({selectedStudent.matricule})</p>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={handleSendReceiptEmail}
                  disabled={submitting}
                  className="p-3 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-xl hover:bg-blue-200 transition-colors"
                  title={t('students.send_by_email')}
                >
                  {submitting ? <div className="animate-spin rounded-full h-5 w-5 border-2 border-current border-t-transparent" /> : <Send size={20} />}
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
              <div className="space-y-6">
                <h4 className="font-bold text-lg">{t('students.register_payment') || 'Enregistrer un paiement'}</h4>
                {selectedStudent.payments.map((p) => (
                  <div key={p.tranche} className="p-5 bg-neutral-50 dark:bg-neutral-800/50 rounded-2xl border border-neutral-100 dark:border-neutral-800">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-sm font-bold uppercase tracking-wider text-neutral-400">{t('students.tranche')} {p.tranche}</span>
                      {p.amount > 0 && <span className="text-xs font-bold text-green-600 bg-green-100 px-2 py-1 rounded-full">{t('students.paid_on')} {new Date(p.date!).toLocaleDateString()}</span>}
                    </div>
                    <div className="flex gap-3">
                      <input 
                        type="number" 
                        defaultValue={p.amount}
                        placeholder={t('students.amount')}
                        className="flex-1 px-4 py-2 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-xl outline-none focus:ring-2 focus:ring-dia-red/20"
                        onBlur={(e) => {
                          const val = parseInt(e.target.value);
                          if (val !== p.amount) handleUpdatePayment(p.tranche, val);
                        }}
                      />
                    </div>
                  </div>
                ))}
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
                          className="h-10 w-10 object-contain mb-1 bg-white" 
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
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
                      <span className="font-bold">{selectedStudent.firstName} {selectedStudent.lastName}</span>
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
                      {selectedStudent.payments.filter(p => p.amount > 0).map(p => (
                        <tr key={p.tranche}>
                          <td className="py-3">Scolarité - {t('students.tranche')} {p.tranche}</td>
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

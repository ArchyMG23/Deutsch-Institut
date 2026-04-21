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
  Bell
} from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import { cn, formatCurrency, generateMatricule } from '../utils';
import { Student, ClassRoom, Level, TuitionPayment } from '../types';
import { NotificationService } from '../services/NotificationService';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { toast } from 'sonner';

export default function StudentManagement() {
  const { fetchWithAuth } = useAuth();
  const { students, classes, levels, loading, refreshAll, refreshStudents } = useData();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'active' | 'former'>('active');
  
  const printRef = useRef<HTMLDivElement>(null);
  const receiptRef = useRef<HTMLDivElement>(null);

  const handlePrint = useReactToPrint({
    contentRef: printRef,
  });

  const handlePrintReceipt = useReactToPrint({
    contentRef: receiptRef,
  });

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

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
        body: JSON.stringify(newStudent)
      });
      if (res.ok) {
        const student = await res.json();
        
        const scheduleStr = cls?.schedule?.map(s => `${s.day} (${s.startTime}-${s.endTime})`).join(', ');
        await NotificationService.sendCredentials(fetchWithAuth, student, password, cls?.name, scheduleStr);

        setIsAddModalOpen(false);
        refreshStudents();
        toast.success('Étudiant ajouté avec succès');
      } else {
        const errorData = await res.json();
        toast.error(errorData.message || 'Erreur lors de l\'ajout de l\'étudiant');
      }
    } catch (err) {
      console.error("Error adding student:", err);
      toast.error('Erreur lors de l\'ajout de l\'étudiant');
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

  const handleDeleteStudent = async (id: string) => {
    if (!window.confirm('Voulez-vous vraiment déplacer cet étudiant vers les archives (Anciens Élèves) ?')) return;
    
    try {
      const res = await fetchWithAuth(`/api/students/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isFormer: true, classId: null })
      });
      if (res.ok) {
        toast.success('Étudiant archivé avec succès');
        refreshStudents();
      }
    } catch (err) {
      console.error("Error archiving student:", err);
      toast.error('Erreur lors de l\'archivage');
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
        toast.success('Étudiant restauré avec succès');
        refreshStudents();
      }
    } catch (err) {
      console.error("Error restoring student:", err);
      toast.error('Erreur lors de la restauration');
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

  const handleSendReminder = async () => {
    if (!selectedStudent) return;
    
    const level = levels.find(l => l.id === selectedStudent.levelId);
    if (!level) {
      toast.error("Niveau non trouvé pour cet étudiant");
      return;
    }

    try {
      setSubmitting(true);
      await NotificationService.sendPaymentReminder(fetchWithAuth, selectedStudent, level.tuition);
      toast.success("Rappel de paiement envoyé");
    } catch (err) {
      console.error("Error sending reminder:", err);
      toast.error("Erreur lors de l'envoi du rappel");
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
    link.setAttribute("download", "liste_etudiants_dia.csv");
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredStudents = students.filter(s => {
    const matchesSearch = `${s.firstName} ${s.lastName} ${s.matricule}`.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTab = activeTab === 'active' ? !s.isFormer : s.isFormer;
    return matchesSearch && matchesTab;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h3 className="text-xl font-bold">Gestion des Étudiants</h3>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setIsAddModalOpen(true)}
            className="btn-primary flex items-center gap-2"
          >
            <UserPlus size={18} />
            <span>Nouvel Étudiant</span>
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
            Étudiants Actifs
          </button>
          <button 
            onClick={() => setActiveTab('former')}
            className={cn(
              "px-6 py-3 text-sm font-bold transition-all border-b-2",
              activeTab === 'former' ? "border-dia-red text-dia-red" : "border-transparent text-neutral-400 hover:text-neutral-600"
            )}
          >
            Anciens Élèves
          </button>
        </div>
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={18} />
            <input 
              type="text" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher un étudiant (Nom, Matricule...)"
              className="w-full pl-10 pr-4 py-2 bg-neutral-100 dark:bg-neutral-800 border-none rounded-lg focus:ring-2 focus:ring-dia-red transition-all"
            />
          </div>
          <div className="flex gap-2">
            <button 
              onClick={exportToCSV}
              className="flex items-center gap-2 px-4 py-2 bg-neutral-100 dark:bg-neutral-800 rounded-lg text-sm font-medium hover:bg-neutral-200 transition-colors"
            >
              <Download size={16} />
              <span>Exporter</span>
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
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-neutral-500">Étudiant</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-neutral-500">Matricule</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-neutral-500">Niveau / Classe</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-neutral-500">Scolarité</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-neutral-500 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {filteredStudents.map((student) => {
                const totalPaid = student.payments.reduce((acc, p) => acc + p.amount, 0);
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
                      <p className="text-xs text-neutral-500">{classes.find(c => c.id === student.classId)?.name || 'Non affecté'}</p>
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
                              onClick={() => {
                                setSelectedStudent(student);
                                setIsReceiptModalOpen(true);
                              }}
                              className="p-2 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg transition-colors text-dia-red"
                              title="Gérer les paiements"
                            >
                              <CreditCard size={18} />
                            </button>
                            <button 
                              onClick={() => {
                                setSelectedStudent(student);
                                setIsEditModalOpen(true);
                              }}
                              className="p-2 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg transition-colors text-blue-600"
                              title="Modifier"
                            >
                              <Edit size={18} />
                            </button>
                            <button 
                              onClick={() => handleDeleteStudent(student.id)}
                              className="p-2 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg transition-colors text-red-600"
                              title="Archiver"
                            >
                              <X size={18} />
                            </button>
                          </>
                        ) : (
                          <button 
                            onClick={() => handleRestoreStudent(student.id)}
                            className="flex items-center gap-2 px-3 py-1.5 bg-green-100 text-green-600 rounded-lg text-xs font-bold hover:bg-green-200 transition-colors"
                          >
                            <Plus size={14} />
                            Restaurer
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

      {/* Add Student Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-neutral-900 w-full max-w-2xl rounded-[32px] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-8 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
              <h3 className="text-2xl font-bold tracking-tight">Nouvel Étudiant</h3>
              <button onClick={() => setIsAddModalOpen(false)} className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition-colors">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleAddStudent} className="p-8 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">Prénom</label>
                  <input name="firstName" required type="text" className="w-full px-5 py-3 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-2xl focus:ring-2 focus:ring-dia-red/20 focus:border-dia-red outline-none transition-all" />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">Nom</label>
                  <input name="lastName" required type="text" className="w-full px-5 py-3 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-2xl focus:ring-2 focus:ring-dia-red/20 focus:border-dia-red outline-none transition-all" />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">Email</label>
                  <input name="email" required type="email" className="w-full px-5 py-3 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-2xl focus:ring-2 focus:ring-dia-red/20 focus:border-dia-red outline-none transition-all" />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">Téléphone</label>
                  <input name="phone" required type="tel" className="w-full px-5 py-3 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-2xl focus:ring-2 focus:ring-dia-red/20 focus:border-dia-red outline-none transition-all" />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">Niveau</label>
                  <select name="levelId" required className="w-full px-5 py-3 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-2xl focus:ring-2 focus:ring-dia-red/20 focus:border-dia-red outline-none transition-all">
                    {levels.map(l => <option key={l.id} value={l.id}>{l.name} ({formatCurrency(l.tuition)})</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">Classe</label>
                  <select name="classId" className="w-full px-5 py-3 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-2xl focus:ring-2 focus:ring-dia-red/20 focus:border-dia-red outline-none transition-all">
                    <option value="">Non affecté</option>
                    {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">Paiement Initial (Tranche 1)</label>
                  <input name="tranche1" type="number" placeholder="0" className="w-full px-5 py-3 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-2xl focus:ring-2 focus:ring-dia-red/20 focus:border-dia-red outline-none transition-all" />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">Paiement Initial (Tranche 2)</label>
                  <input name="tranche2" type="number" placeholder="0" className="w-full px-5 py-3 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-2xl focus:ring-2 focus:ring-dia-red/20 focus:border-dia-red outline-none transition-all" />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">Paiement Initial (Tranche 3)</label>
                  <input name="tranche3" type="number" placeholder="0" className="w-full px-5 py-3 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-2xl focus:ring-2 focus:ring-dia-red/20 focus:border-dia-red outline-none transition-all" />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">Mot de passe par défaut</label>
                  <input name="password" type="text" defaultValue="DIA2026." className="w-full px-5 py-3 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-2xl focus:ring-2 focus:ring-dia-red/20 focus:border-dia-red outline-none transition-all" />
                  <p className="text-[10px] text-neutral-500 mt-1">L'étudiant pourra le modifier après sa première connexion.</p>
                </div>
              </div>
              <div className="pt-4 flex gap-4">
                <button type="button" onClick={() => setIsAddModalOpen(false)} className="flex-1 px-6 py-4 bg-neutral-100 dark:bg-neutral-800 rounded-2xl font-bold transition-all hover:bg-neutral-200">Annuler</button>
                <button 
                  type="submit" 
                  disabled={submitting}
                  className="flex-1 btn-primary py-4 flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-white/30 border-t-white"></div>
                      Enregistrement...
                    </>
                  ) : (
                    "Enregistrer l'Étudiant"
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
            <div className="p-8 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
              <h3 className="text-2xl font-bold tracking-tight">Modifier Étudiant</h3>
              <button onClick={() => setIsEditModalOpen(false)} className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition-colors">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleEditStudent} className="p-8 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">Prénom</label>
                  <input name="firstName" defaultValue={selectedStudent.firstName} required type="text" className="w-full px-5 py-3 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-2xl focus:ring-2 focus:ring-dia-red/20 focus:border-dia-red outline-none transition-all" />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">Nom</label>
                  <input name="lastName" defaultValue={selectedStudent.lastName} required type="text" className="w-full px-5 py-3 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-2xl focus:ring-2 focus:ring-dia-red/20 focus:border-dia-red outline-none transition-all" />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">Email</label>
                  <input name="email" defaultValue={selectedStudent.email} required type="email" className="w-full px-5 py-3 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-2xl focus:ring-2 focus:ring-dia-red/20 focus:border-dia-red outline-none transition-all" />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">Téléphone</label>
                  <input name="phone" defaultValue={selectedStudent.phone} required type="tel" className="w-full px-5 py-3 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-2xl focus:ring-2 focus:ring-dia-red/20 focus:border-dia-red outline-none transition-all" />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">Niveau</label>
                  <select name="levelId" defaultValue={selectedStudent.levelId} required className="w-full px-5 py-3 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-2xl focus:ring-2 focus:ring-dia-red/20 focus:border-dia-red outline-none transition-all">
                    {levels.map(l => <option key={l.id} value={l.id}>{l.name} ({formatCurrency(l.tuition)})</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">Classe</label>
                  <select name="classId" defaultValue={selectedStudent.classId} className="w-full px-5 py-3 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-2xl focus:ring-2 focus:ring-dia-red/20 focus:border-dia-red outline-none transition-all">
                    <option value="">Non affecté</option>
                    {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="pt-4 flex gap-4">
                <button type="button" onClick={() => setIsEditModalOpen(false)} className="flex-1 px-6 py-4 bg-neutral-100 dark:bg-neutral-800 rounded-2xl font-bold transition-all hover:bg-neutral-200">Annuler</button>
                <button 
                  type="submit" 
                  disabled={submitting}
                  className="flex-1 btn-primary py-4 flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-white/30 border-t-white"></div>
                      Mise à jour...
                    </>
                  ) : (
                    "Enregistrer les modifications"
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
              <h3 className="text-2xl font-bold tracking-tight">Détails de l'Étudiant</h3>
              <button onClick={() => setIsDetailModalOpen(false)} className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition-colors">
                <X size={24} />
              </button>
            </div>
            <div className="p-8 space-y-6">
              <div className="flex items-center gap-6">
                <div className="w-24 h-24 rounded-3xl bg-dia-red/10 text-dia-red flex items-center justify-center text-3xl font-bold">
                  {selectedStudent.firstName[0]}{selectedStudent.lastName[0]}
                </div>
                <div>
                  <h4 className="text-2xl font-bold">{selectedStudent.firstName} {selectedStudent.lastName}</h4>
                  <p className="text-neutral-500 font-mono">{selectedStudent.matricule}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-8">
                <div>
                  <p className="text-[11px] font-bold uppercase text-neutral-400 mb-1">Contact</p>
                  <p className="text-sm flex items-center gap-2"><Mail size={14} /> {selectedStudent.email}</p>
                  <p className="text-sm flex items-center gap-2"><Phone size={14} /> {selectedStudent.phone}</p>
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase text-neutral-400 mb-1">Académique</p>
                  <p className="text-sm font-bold">{levels.find(l => l.id === selectedStudent.levelId)?.name}</p>
                  <p className="text-sm text-neutral-500">{classes.find(c => c.id === selectedStudent.classId)?.name || 'Non affecté'}</p>
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase text-neutral-400 mb-1">Parent / Tuteur</p>
                  <p className="text-sm font-bold">{selectedStudent.parentName}</p>
                  <p className="text-sm">{selectedStudent.parentPhone}</p>
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase text-neutral-400 mb-1">Statut Scolarité</p>
                  <p className="text-sm font-bold">
                    {formatCurrency(selectedStudent.payments.reduce((acc, p) => acc + p.amount, 0))} / {formatCurrency(levels.find(l => l.id === selectedStudent.levelId)?.tuition || 0)}
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
                  Modifier
                </button>
                <button 
                  onClick={() => {
                    setIsDetailModalOpen(false);
                    setIsReceiptModalOpen(true);
                  }}
                  className="flex-1 min-w-[120px] bg-neutral-100 dark:bg-neutral-800 py-3 rounded-2xl font-bold hover:bg-neutral-200 transition-all flex items-center justify-center gap-2 text-sm"
                >
                  <CreditCard size={16} />
                  Paiements
                </button>
                <button 
                  onClick={handleSendReminder}
                  disabled={submitting}
                  className="flex-1 min-w-[120px] bg-dia-red/10 text-dia-red py-3 rounded-2xl font-bold hover:bg-dia-red/20 transition-all flex items-center justify-center gap-2 text-sm"
                >
                  {submitting ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-dia-red/30 border-t-dia-red"></div>
                  ) : (
                    <Bell size={16} />
                  )}
                  Rappel
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
                <h3 className="text-2xl font-bold tracking-tight">Paiements & Reçus</h3>
                <p className="text-neutral-500 text-sm">{selectedStudent.firstName} {selectedStudent.lastName} ({selectedStudent.matricule})</p>
              </div>
              <div className="flex gap-2">
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
                <h4 className="font-bold text-lg">Enregistrer un paiement</h4>
                {selectedStudent.payments.map((p) => (
                  <div key={p.tranche} className="p-5 bg-neutral-50 dark:bg-neutral-800/50 rounded-2xl border border-neutral-100 dark:border-neutral-800">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-sm font-bold uppercase tracking-wider text-neutral-400">Tranche {p.tranche}</span>
                      {p.amount > 0 && <span className="text-xs font-bold text-green-600 bg-green-100 px-2 py-1 rounded-full">Payé le {new Date(p.date!).toLocaleDateString()}</span>}
                    </div>
                    <div className="flex gap-3">
                      <input 
                        type="number" 
                        defaultValue={p.amount}
                        placeholder="Montant"
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
                      <p className="text-sm font-bold">REÇU DE PAIEMENT</p>
                      <p className="text-[10px] text-neutral-500">#{Date.now()}</p>
                    </div>
                  </div>

                  <div className="space-y-4 mb-8">
                    <div className="flex justify-between text-sm">
                      <span className="text-neutral-500">Étudiant:</span>
                      <span className="font-bold">{selectedStudent.firstName} {selectedStudent.lastName}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-neutral-500">Matricule:</span>
                      <span className="font-mono font-bold">{selectedStudent.matricule}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-neutral-500">Niveau:</span>
                      <span className="font-bold">{levels.find(l => l.id === selectedStudent.levelId)?.name}</span>
                    </div>
                  </div>

                  <table className="w-full text-sm mb-8">
                    <thead>
                      <tr className="border-b text-neutral-400 text-[10px] uppercase font-bold">
                        <th className="text-left py-2">Désignation</th>
                        <th className="text-right py-2">Montant</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {selectedStudent.payments.filter(p => p.amount > 0).map(p => (
                        <tr key={p.tranche}>
                          <td className="py-3">Scolarité - Tranche {p.tranche}</td>
                          <td className="py-3 text-right font-bold">{formatCurrency(p.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-neutral-900">
                        <td className="py-4 font-bold uppercase">Total Payé</td>
                        <td className="py-4 text-right font-black text-lg">{formatCurrency(selectedStudent.payments.reduce((acc, p) => acc + p.amount, 0))}</td>
                      </tr>
                    </tfoot>
                  </table>

                  <div className="text-[10px] text-neutral-400 text-center italic mb-8">
                    Merci pour votre confiance. Ce document est un reçu officiel de l'institut DIA.
                  </div>

                  <div className="grid grid-cols-2 gap-12 pt-8 border-t border-neutral-100">
                    <div className="text-center">
                      <p className="text-[10px] font-bold uppercase text-neutral-400 mb-12">Signature Étudiant</p>
                      <div className="border-b border-neutral-300 w-full"></div>
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] font-bold uppercase text-neutral-400 mb-12">Signature Institut</p>
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

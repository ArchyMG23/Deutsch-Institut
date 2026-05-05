import React, { useState, useEffect, useRef } from 'react';
import { TrendingUp, 
  TrendingDown, 
  Wallet, 
  ArrowUpRight, 
  ArrowDownRight,
  Plus,
  X,
  Printer,
  ChevronUp,
  ChevronDown,
  Calendar,
  Layers,
  Trash2,
  Search,
  ArrowUpDown,
  Smartphone,
  CreditCard,
  History,
  UserCheck,
  Download
} from 'lucide-react';
import { cn, formatCurrency, generateMatricule } from '../utils';
import { FinanceRecord, Student, StudentScolarite, Versement } from '../types';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { toast } from 'sonner';
import { NotificationService } from '../services/NotificationService';
import { motion, AnimatePresence } from 'motion/react';
import TuitionManagement from '../components/Finance/TuitionManagement';
import RealFinanceDashboard from '../components/Finance/RealFinanceDashboard';
import ChargeManagement from '../components/Finance/ChargeManagement';
import { db } from '../firebase';
import { collection, query, where, getDocs, doc, getDoc, setDoc, addDoc } from 'firebase/firestore';
import { addAuditLog } from '../utils/auditLogger';

import { useTranslation } from 'react-i18next';

const TransactionTable = React.memo(({ 
  records, 
  onSort, 
  sortConfig,
  onDelete,
  onUpdate,
  isSuperAdmin,
  isTrash = false,
  limit = 20
}: { 
  records: FinanceRecord[], 
  onSort?: (key: string) => void, 
  sortConfig?: { key: string, direction: 'asc' | 'desc' } | null,
  onDelete?: (id: string) => void,
  onUpdate?: (id: string, amount: number, desc: string) => void,
  isSuperAdmin?: boolean,
  isTrash?: boolean,
  limit?: number
}) => {
  const { t, i18n } = useTranslation();
  const { fetchWithAuth } = useAuth();
  const [displayLimit, setDisplayLimit] = useState(limit);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState<number>(0);
  const [editDesc, setEditDesc] = useState<string>('');
  
  const visibleRecords = React.useMemo(() => records.slice(0, displayLimit), [records, displayLimit]);
  const hasMore = records.length > displayLimit;

  useEffect(() => {
    setDisplayLimit(limit);
  }, [limit]);

  const SortIcon = ({ column }: { column: string }) => {
    if (!sortConfig || sortConfig.key !== column) return null;
    return sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />;
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-neutral-50 dark:bg-neutral-800/50 border-b border-neutral-200 dark:border-neutral-800">
            <th className={cn("px-6 py-4 text-xs font-bold uppercase tracking-wider text-neutral-500 transition-colors", onSort && "cursor-pointer hover:text-dia-red")} onClick={() => onSort?.('date')}>
              <div className="flex items-center gap-1">{isTrash ? t('finances.deletion_date') : t('common.date')} <SortIcon column="date" /></div>
            </th>
            <th className={cn("px-6 py-4 text-xs font-bold uppercase tracking-wider text-neutral-500 transition-colors", onSort && "cursor-pointer hover:text-dia-red")} onClick={() => onSort?.('description')}>
              <div className="flex items-center gap-1">{t('common.description')} <SortIcon column="description" /></div>
            </th>
            <th className={cn("px-6 py-4 text-xs font-bold uppercase tracking-wider text-neutral-500 transition-colors", onSort && "cursor-pointer hover:text-dia-red")} onClick={() => onSort?.('category')}>
              <div className="flex items-center gap-1">{t('common.category')} <SortIcon column="category" /></div>
            </th>
            {isTrash && <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-neutral-500">{t('finances.reason_by')}</th>}
            <th className={cn("px-6 py-4 text-xs font-bold uppercase tracking-wider text-neutral-500 text-right transition-colors", onSort && "cursor-pointer hover:text-dia-red")} onClick={() => onSort?.('amount')}>
              <div className="flex items-center justify-end gap-1">{t('common.amount')} <SortIcon column="amount" /></div>
            </th>
            {!isTrash && <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-neutral-500 text-right print:hidden">{t('teachers.actions') || 'Actions'}</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
          {visibleRecords.map((record) => (
            <tr key={record.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors group">
              <td className="px-6 py-4 text-sm font-medium">{record.date ? new Date(record.date).toLocaleDateString() : '--'}</td>
              <td className="px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className={cn("w-8 h-8 rounded-full flex items-center justify-center", record.type === 'income' ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600")}>
                    {record.type === 'income' ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      {editingId === record.id ? (
                        <input 
                          type="text" 
                          value={editDesc} 
                          onChange={(e) => setEditDesc(e.target.value)}
                          className="px-2 py-1 bg-white border-2 border-blue-400 rounded-md text-sm outline-none w-full"
                        />
                      ) : (
                        <p className="text-sm font-bold text-neutral-700 dark:text-neutral-300 group-hover:text-dia-red transition-colors">{record.description || t('common.no_description')}</p>
                      )}
                      {record.status === 'archived' && (
                        <span className="text-[9px] font-black uppercase px-2 py-0.5 bg-neutral-200 dark:bg-neutral-800 text-neutral-500 rounded-md">Archive</span>
                      )}
                    </div>
                  </div>
                </div>
              </td>
              <td className="px-6 py-4">
                <span className="text-[10px] font-bold uppercase px-2 py-1 bg-neutral-100 dark:bg-neutral-800 rounded-full text-neutral-500 border border-neutral-200 dark:border-neutral-700">
                  {t(`finances.categories.${String(record.category || 'other').toLowerCase()}`) || record.category || 'Other'}
                </span>
              </td>
              {isTrash && <td className="px-6 py-4 text-xs font-bold text-red-500">{record.deletionReason}</td>}
              <td className={cn("px-6 py-4 text-right font-black", record.type === 'income' ? "text-green-600" : "text-red-600")}>
                {editingId === record.id ? (
                  <div className="flex items-center justify-end gap-1">
                    <span className="text-xs text-neutral-400">{record.type === 'income' ? '+' : '-'}</span>
                    <input 
                      type="number" 
                      value={editAmount} 
                      onChange={(e) => setEditAmount(Number(e.target.value))}
                      className="w-24 px-2 py-1 bg-white border-2 border-blue-400 rounded-md text-right text-sm outline-none"
                    />
                  </div>
                ) : (
                  <>{record.type === 'income' ? '+' : '-'}{formatCurrency(record.amount)}</>
                )}
              </td>
              {!isTrash && (
                <td className="px-6 py-4 text-right print:hidden">
                  <div className="flex items-center justify-end gap-2">
                    {editingId === record.id ? (
                      <>
                        <button 
                          onClick={() => {
                            onUpdate?.(record.id, editAmount, editDesc);
                            setEditingId(null);
                          }}
                          className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-all"
                        >
                          <CheckCircle2 size={16} />
                        </button>
                        <button onClick={() => setEditingId(null)} className="p-2 text-neutral-400 hover:bg-neutral-50 rounded-lg transition-all">
                          <X size={16} />
                        </button>
                      </>
                    ) : (
                      <>
                        <button onClick={async (e) => {
                          e.stopPropagation();
                          const msg = `DIA_SAAS: Transaction de ${formatCurrency(record.amount)} enregistrée.\nDescription: ${record.description}\nDate: ${record.date ? new Date(record.date).toLocaleDateString() : ''}`;
                          toast.info("Ouverture de WhatsApp...");
                          await NotificationService._triggerWhatsApp(fetchWithAuth, "", msg); 
                        }} className="p-2 text-green-500 hover:bg-green-50 rounded-lg transition-all" title="Partager sur WhatsApp">
                          <Smartphone size={16} />
                        </button>
                        {isSuperAdmin && (
                          <button 
                            onClick={() => {
                              setEditingId(record.id);
                              setEditAmount(record.amount);
                              setEditDesc(record.description || '');
                            }}
                            className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-all"
                            title="Modifier (Admin)"
                          >
                            <Edit2 size={16} />
                          </button>
                        )}
                        <button onClick={() => onDelete?.(record.id)} className="p-2 text-neutral-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all" title={t('finances.delete_tooltip')}>
                          <Trash2 size={16} />
                        </button>
                      </>
                    )}
                  </div>
                </td>
              )}
            </tr>
          ))}
          {visibleRecords.length === 0 && (
            <tr><td colSpan={isTrash ? 5 : 4} className="px-6 py-20 text-center text-neutral-400 font-medium">{t('finances.no_transactions')}</td></tr>
          )}
        </tbody>
      </table>
      {hasMore && (
        <div className="p-6 text-center border-t border-neutral-100 dark:border-neutral-800">
          <button onClick={() => setDisplayLimit(p => p + limit)} className="text-xs font-bold uppercase tracking-widest text-dia-red hover:bg-dia-red/5 px-6 py-2 rounded-xl transition-all">
            {t('common.show_more') || 'Voir plus'}
          </button>
        </div>
      )}
    </div>
  );
});

export default function FinanceManagement() {
  const { t, i18n } = useTranslation();
  const { finances: allRecords, trashFinances, refreshFinances, refreshTrash, levels, classes, refreshAll } = useData();
  const { user, profile, fetchWithAuth } = useAuth();
  
  const isSuperAdmin = 
    profile?.role === 'admin' || 
    profile?.isSuperAdmin || 
    user?.role === 'admin' || 
    user?.isSuperAdmin || 
    user?.email?.toLowerCase() === 'gabrielyombi311@gmail.com' ||
    user?.email?.toLowerCase() === 'yombivictor@gmail.com';
  
  const handleUpdateFinance = async (id: string, newAmount: number, newDesc: string) => {
    if (!isSuperAdmin) return;
    try {
      const res = await fetchWithAuth(`/api/finances/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: newAmount, description: newDesc })
      });
      if (res.ok) {
        toast.success("Transaction mise à jour");
        refreshFinances();
      } else {
        const data = await res.json();
        toast.error(data.message || "Erreur lors de la mise à jour");
      }
    } catch (err) {
      console.error(err);
      toast.error("Erreur réseau");
    }
  };

  const [viewMode, setViewMode] = useState<'active' | 'trash' | 'tuition' | 'dashboard' | 'charges'>('dashboard');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isQuickAddModalOpen, setIsQuickAddModalOpen] = useState(false);
  const [quickAddTuition, setQuickAddTuition] = useState(110000);
  const [quickAddStream, setQuickAddStream] = useState('');
  
  // Modal Form State
  const [formType, setFormType] = useState<'income' | 'expense'>('income');
  const [formCategory, setFormCategory] = useState('tuition');
  const [formMatricule, setFormMatricule] = useState('');
  const [verifiedStudent, setVerifiedStudent] = useState<Student | null>(null);
  const [checkingMatricule, setCheckingMatricule] = useState(false);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState<string | null>(null);
  const [deletionReason, setDeletionReason] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [selectedMonth, setSelectedMonth] = useState('all');
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>({ key: 'date', direction: 'desc' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    refreshFinances();
    refreshTrash();
  }, []);

  const handleVerifyMatricule = async () => {
    if (!formMatricule.trim()) return;
    setCheckingMatricule(true);
    setVerifiedStudent(null);
    try {
      const q = query(
        collection(db, 'users'), 
        where('matricule', '==', formMatricule.trim().toUpperCase()),
        where('role', '==', 'student')
      );
      const snap = await getDocs(q);
      if (snap.empty) {
        toast.error("Aucun élève trouvé avec ce matricule");
      } else {
        const student = { uid: snap.docs[0].id, ...snap.docs[0].data() } as Student;
        setVerifiedStudent(student);
        toast.success(`Élève identifié : ${student.firstName} ${student.lastName}`);
      }
    } catch (err) {
      console.error(err);
      toast.error("Erreur lors de la vérification");
    } finally {
      setCheckingMatricule(false);
    }
  };

  const handleAddRecord = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitting) return;

    if (formType === 'income' && formCategory === 'tuition' && !verifiedStudent) {
      toast.error("Veuillez d'abord vérifier le matricule de l'élève");
      return;
    }

    setSubmitting(true);
    const formData = new FormData(e.currentTarget);
    const amountAttr = parseInt(formData.get('amount') as string);
    const descAttr = formData.get('description') as string;
    const selectedDateStr = formData.get('date') as string;
    const selectedDate = selectedDateStr ? new Date(selectedDateStr) : new Date();
    
    // Auto-archival logic: if year is less than current year
    const currentYear = new Date().getFullYear();
    const isArchived = selectedDate.getFullYear() < currentYear;

    const isStudentRelated = formType === 'income' && (formCategory === 'tuition' || formCategory === 'registration' || formCategory === 'other');

    const newRecord = {
      type: formType,
      amount: amountAttr,
      description: isStudentRelated && verifiedStudent 
        ? `${formCategory.charAt(0).toUpperCase() + formCategory.slice(1)} - ${verifiedStudent.firstName} ${verifiedStudent.lastName} (${verifiedStudent.matricule})`
        : descAttr,
      category: formCategory,
      date: selectedDate.toISOString(),
      status: isArchived ? 'archived' : 'active'
    };

    try {
      // 1. Save general finance record via API
      const res = await fetchWithAuth('/api/finances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newRecord)
      });

      if (res.ok) {
        // 2. If Student Related, also update Student Tuition record in Firestore
        if (isStudentRelated && verifiedStudent) {
          const scolariteRef = doc(db, 'scolarites', verifiedStudent.uid);
          const scolariteSnap = await getDoc(scolariteRef);
          
          let currentScola: StudentScolarite;
          if (scolariteSnap.exists()) {
            currentScola = scolariteSnap.data() as StudentScolarite;
          } else {
            const studentLevel = levels.find(l => l.id === verifiedStudent.levelId);
            const tuitionAmount = studentLevel?.tuition || 110000;
            currentScola = {
              id: verifiedStudent.uid,
              eleve_id: verifiedStudent.uid,
              matricule: verifiedStudent.matricule,
              nom_eleve: `${verifiedStudent.firstName} ${verifiedStudent.lastName}`,
              classe_id: verifiedStudent.classId || 'N/A',
              filiere: studentLevel?.stream || 'N/A',
              niveau: studentLevel?.name || 'N/A',
              montant_total_du: tuitionAmount,
              total_verse: 0,
              reste: tuitionAmount,
              surplus: 0,
              statut_paiement: 'EN COURS'
            };
          }

          const newTotal = (currentScola.total_verse || 0) + amountAttr;
          const newReste = Math.max(0, currentScola.montant_total_du - newTotal);
          const newSurplus = Math.max(0, newTotal - currentScola.montant_total_du);
          
          let newStatut: StudentScolarite['statut_paiement'] = 'EN COURS';
          if (newSurplus > 0) newStatut = 'SURPLUS';
          else if (newReste === 0) newStatut = 'SOLDÉ';

          const updatedScola = {
            ...currentScola,
            total_verse: newTotal,
            reste: newReste,
            surplus: newSurplus,
            statut_paiement: newStatut
          };

          await setDoc(scolariteRef, updatedScola);
          
          // Add detailed versement
          await addDoc(collection(db, 'scolarites', verifiedStudent.uid, 'versements'), {
            montant: amountAttr,
            date: selectedDate.toISOString(),
            mode_paiement: 'Espèces',
            categorie: formCategory === 'registration' ? 'inscription' : 'scolarite',
            recu_numero: `FIN-${Date.now().toString().slice(-6)}`,
            caissier_id: user?.uid || 'System',
            notes: descAttr || 'Enregistré via interface Finance Générale'
          });

          addAuditLog("VERSEMENT_AUTO_SYNC", verifiedStudent.uid, { amount: amountAttr, category: formCategory });
        }

        setIsAddModalOpen(false);
        setFormMatricule('');
        setVerifiedStudent(null);
        refreshFinances();
        toast.success(t('finances.transaction_added'));
      }
    } catch (err) {
      console.error(err);
      toast.error(t('common.error'));
    } finally {
      setSubmitting(false);
    }
  };

  const filteredByDate = React.useMemo(() => {
    return allRecords.filter(r => {
      if (!r.date) return false;
      const d = new Date(r.date);
      const yearMatch = d.getFullYear().toString() === selectedYear;
      const monthMatch = selectedMonth === 'all' || d.getMonth().toString() === selectedMonth;
      if (!yearMatch || !monthMatch) return false;
      const query = searchQuery.toLowerCase();
      return (r.description || '').toLowerCase().includes(query) || (r.category || '').toLowerCase().includes(query);
    });
  }, [allRecords, selectedYear, selectedMonth, searchQuery]);

  const { totalIncome, totalExpense, balance } = React.useMemo(() => {
    const inc = filteredByDate.filter(r => r.type === 'income').reduce((acc, r) => acc + (Number(r.amount) || 0), 0);
    const exp = filteredByDate.filter(r => r.type === 'expense').reduce((acc, r) => acc + (Number(r.amount) || 0), 0);
    return {
      totalIncome: inc,
      totalExpense: exp,
      balance: inc - exp
    };
  }, [filteredByDate]);

  const handleSort = (key: string) => {
    setSortConfig(current => {
      if (!current || current.key !== key) {
        return { key, direction: 'desc' };
      }
      return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' };
    });
  };

  const sortedRecords = React.useMemo(() => {
    const records = viewMode === 'trash' ? trashFinances : filteredByDate;
    if (!sortConfig) return records;

    return [...records].sort((a, b) => {
      const aVal = a[sortConfig.key as keyof FinanceRecord];
      const bVal = b[sortConfig.key as keyof FinanceRecord];

      if (sortConfig.key === 'amount') {
        return sortConfig.direction === 'asc' ? Number(aVal) - Number(bVal) : Number(bVal) - Number(aVal);
      }

      const aStr = String(aVal || '').toLowerCase();
      const bStr = String(bVal || '').toLowerCase();

      if (aStr < bStr) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aStr > bStr) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [viewMode, trashFinances, filteredByDate, sortConfig]);

  const handleDeleteClick = (id: string) => {
    setRecordToDelete(id);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!recordToDelete || !deletionReason.trim()) return;
    try {
      const res = await fetchWithAuth(`/api/finances/${recordToDelete}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: deletionReason })
      });
      if (res.ok) {
        setIsDeleteModalOpen(false);
        setRecordToDelete(null);
        setDeletionReason('');
        refreshFinances();
        refreshTrash();
        toast.success(t('finances.deleted_success'));
      }
    } catch (err) {
      toast.error(t('common.error'));
    }
  };

  const exportToCSV = () => {
    try {
      const records = sortedRecords;
      if (records.length === 0) {
        toast.error("Aucune donnée à exporter");
        return;
      }

      const headers = ["Date", "Description", "Catégorie", "Type", "Montant"];
      const csvContent = [
        headers.join(","),
        ...records.map(r => [
          new Date(r.date).toLocaleDateString(),
          `"${(r.description || '').replace(/"/g, '""')}"`,
          r.category,
          r.type === 'income' ? 'Revenu' : 'Dépense',
          r.amount
        ].join(","))
      ].join("\n");

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", `finances_${selectedYear}_${selectedMonth}_${new Date().getTime()}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("Export CSV réussi !");
    } catch (err) {
      console.error(err);
      toast.error("Erreur lors de l'export");
    }
  };

  const handleQuickInscription = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    
    const formData = new FormData(e.currentTarget);
    const matricule = generateMatricule('student');
    const role = 'student';
    let email = formData.get('email') as string;
    const paymentDateStr = formData.get('paymentDate') as string || new Date().toISOString().split('T')[0];
    
    // Fallback if email is not provided
    if (!email || !email.trim()) {
      email = `${matricule.toLowerCase()}@dia-saas.com`;
    }

    const password = 'DIA2026.'; // Default password
    
    const newStudent = {
      matricule,
      email,
      password,
      firstName: formData.get('firstName'),
      lastName: formData.get('lastName'),
      phone: formData.get('phone') || '',
      levelId: formData.get('levelId'),
      classId: '', // Unassigned by default in quick add
      role,
      status: 'offline',
      createdAt: new Date().toISOString(),
      payments: [
        { tranche: 1, amount: Number(formData.get('amount')) || 0, date: paymentDateStr },
        { tranche: 2, amount: 0, date: null },
        { tranche: 3, amount: 0, date: null }
      ]
    };

    try {
      const res = await fetchWithAuth('/api/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newStudent,
          inscriptionAmount: formData.get('payInscription') === 'on' ? 10000 : 0,
          vorbereitungAmount: formData.get('payVorbereitung') === 'on' ? (Number(formData.get('vorbereitungAmount')) || 0) : 0,
          totalTuition: Number(formData.get('totalTuition')) || 110000
        })
      });
      
      if (res.ok) {
        const student = await res.json();
        
        // Send credentials notification
        try {
          await NotificationService.sendCredentials(fetchWithAuth, student, password);
        } catch (notifErr) {
           console.warn("Could not send credentials notification:", notifErr);
        }
        
        setIsQuickAddModalOpen(false);
        await Promise.all([
          refreshFinances(),
          refreshStudents()
        ]);
        toast.success(`Élève ${newStudent.firstName} inscrit avec succès ! Matricule: ${student.matricule}`);
        
        // Refresh contexts completely after a short delay
        setTimeout(() => refreshAll(true), 2000);
      } else {
        const err = await res.json();
        toast.error(err.message || "Erreur d'inscription");
      }
    } catch (err) {
      console.error(err);
      toast.error("Échec de l'inscription rapide");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-2xl font-black text-dia-red uppercase tracking-tight">{t('finances.title')}</h3>
          <p className="text-sm text-neutral-500 font-medium">{t('finances.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center p-1 bg-neutral-100 dark:bg-neutral-800 rounded-2xl overflow-x-auto max-w-full">
            <button onClick={() => setViewMode('dashboard')} className={cn("px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap", viewMode === 'dashboard' ? "bg-white dark:bg-neutral-700 text-dia-red shadow-sm" : "text-neutral-500")}>Analyse</button>
            <button onClick={() => setViewMode('tuition')} className={cn("px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap", viewMode === 'tuition' ? "bg-white dark:bg-neutral-700 text-dia-red shadow-sm" : "text-neutral-500")}>Scolarités</button>
            <button onClick={() => setViewMode('charges')} className={cn("px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap", viewMode === 'charges' ? "bg-white dark:bg-neutral-700 text-dia-red shadow-sm" : "text-neutral-500")}>Charges Centre</button>
            <button onClick={() => setViewMode('active')} className={cn("px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap", viewMode === 'active' ? "bg-white dark:bg-neutral-700 text-dia-red shadow-sm" : "text-neutral-500")}>Archives Transaction</button>
            <button onClick={() => setViewMode('trash')} className={cn("px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap", viewMode === 'trash' ? "bg-white dark:bg-neutral-700 text-dia-red shadow-sm" : "text-neutral-500")}><Trash2 size={14} /> Corbeille</button>
          </div>
          {['active', 'trash', 'tuition'].includes(viewMode) && (
            <div className="flex gap-2">
              <button 
                onClick={() => setIsQuickAddModalOpen(true)} 
                className="px-4 py-2 bg-orange-100 text-orange-600 rounded-xl text-xs font-bold hover:bg-orange-200 transition-all flex items-center gap-2"
              >
                <UserCheck size={16} /> Inscription Rapide
              </button>
              <button onClick={() => setIsAddModalOpen(true)} className="btn-primary flex items-center gap-2 px-6">
                <Plus size={18} /> {t('finances.transaction')}
              </button>
            </div>
          )}
        </div>
      </div>

      {viewMode !== 'tuition' && (
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4 flex flex-wrap items-center gap-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={18} />
            <input 
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('common.search')}
              className="w-full pl-10 pr-4 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl outline-none focus:ring-2 focus:ring-dia-red/20"
            />
          </div>
          <div className="flex items-center gap-2">
            <Calendar size={18} className="text-neutral-400" />
            <select value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)} className="bg-transparent font-bold outline-none">
              {Array.from({ length: 5 }).map((_, i) => {
                const year = new Date().getFullYear() - 2 + i;
                return <option key={year} value={year}>{year}</option>;
              })}
            </select>
            <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="bg-transparent font-bold outline-none">
              <option value="all">Tous les mois</option>
              {Array.from({ length: 12 }).map((_, i) => (
                <option key={i} value={i}>{new Date(2000, i).toLocaleDateString(i18n.language, { month: 'long' })}</option>
              ))}
            </select>
          </div>
          <button 
            onClick={exportToCSV}
            className="p-2 bg-neutral-100 dark:bg-neutral-800 text-neutral-600 rounded-xl hover:bg-neutral-200 transition-all flex items-center gap-2 text-xs font-bold"
          >
            <Download size={16} /> Export CSV
          </button>
        </div>
      )}

      <AnimatePresence mode="wait">
        {viewMode === 'dashboard' ? (
          <motion.div key="dashboard" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <RealFinanceDashboard />
          </motion.div>
        ) : viewMode === 'tuition' ? (
          <motion.div key="tuition" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <TuitionManagement />
          </motion.div>
        ) : viewMode === 'charges' ? (
          <motion.div key="charges" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <ChargeManagement />
          </motion.div>
        ) : (
          <motion.div key="other" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="card p-6 border-l-4 border-l-green-500">
                <h4 className="text-3xl font-black">{formatCurrency(totalIncome)}</h4>
                <p className="text-xs font-bold text-green-600 uppercase">Revenus</p>
              </div>
              <div className="card p-6 border-l-4 border-l-red-500">
                <h4 className="text-3xl font-black">{formatCurrency(totalExpense)}</h4>
                <p className="text-xs font-bold text-red-600 uppercase">Dépenses</p>
              </div>
              <div className="card p-6 border-l-4 border-l-dia-red">
                <h4 className="text-3xl font-black">{formatCurrency(balance)}</h4>
                <p className="text-xs font-bold text-dia-red uppercase">Balance</p>
              </div>
            </div>
            
            <div className="card overflow-hidden">
               <TransactionTable 
                records={sortedRecords} 
                onSort={handleSort}
                sortConfig={sortConfig}
                onDelete={handleDeleteClick}
                onUpdate={handleUpdateFinance}
                isSuperAdmin={isSuperAdmin}
                isTrash={viewMode === 'trash'}
               />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsAddModalOpen(false)} />
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="relative bg-white dark:bg-neutral-900 rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <h4 className="text-xl font-black uppercase mb-6">{t('finances.new_transaction')}</h4>
            <form onSubmit={handleAddRecord} className="space-y-4">
              <div className="grid grid-cols-2 gap-4 p-1 bg-neutral-100 dark:bg-neutral-800 rounded-xl">
                <label className="flex">
                  <input 
                    type="radio" 
                    name="type" 
                    value="income" 
                    checked={formType === 'income'}
                    onChange={() => setFormType('income')}
                    className="peer hidden" 
                  />
                  <span className="flex-1 text-center py-2 rounded-lg cursor-pointer peer-checked:bg-white dark:peer-checked:bg-neutral-700 peer-checked:text-green-600 font-bold transition-all">Revenu</span>
                </label>
                <label className="flex">
                  <input 
                    type="radio" 
                    name="type" 
                    value="expense" 
                    checked={formType === 'expense'}
                    onChange={() => setFormType('expense')}
                    className="peer hidden" 
                  />
                  <span className="flex-1 text-center py-2 rounded-lg cursor-pointer peer-checked:bg-white dark:peer-checked:bg-neutral-700 peer-checked:text-red-600 font-bold transition-all">Dépense</span>
                </label>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-neutral-400">Catégorie</label>
                <select 
                  name="category" 
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                  className="w-full p-3 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl"
                >
                  <option value="tuition">Scolarité</option>
                  <option value="registration">Inscription</option>
                  <option value="salary">Salaire</option>
                  <option value="rent">Loyer</option>
                  <option value="utilities">Charges</option>
                  <option value="other">Autre</option>
                </select>
              </div>

              {formType === 'income' && formCategory === 'tuition' && (
                <div className="space-y-2 p-4 bg-orange-50 dark:bg-orange-900/10 border border-orange-200 dark:border-orange-800 rounded-xl">
                  <label className="text-xs font-black uppercase text-orange-600 dark:text-orange-400 block mb-2">Identification de l'Élève *</label>
                  <div className="flex gap-2">
                    <input 
                      type="text"
                      value={formMatricule}
                      onChange={(e) => setFormMatricule(e.target.value)}
                      placeholder="Matricule (ex: S26001)"
                      className="flex-1 p-2 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg text-sm"
                    />
                    <button 
                      type="button" 
                      onClick={handleVerifyMatricule}
                      disabled={checkingMatricule || !formMatricule.trim()}
                      className="px-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50"
                    >
                      {checkingMatricule ? '...' : <UserCheck size={18} />}
                    </button>
                  </div>
                  {verifiedStudent && (
                    <div className="mt-2 p-2 bg-white dark:bg-neutral-800 rounded-lg flex flex-col gap-1">
                      <div className="text-[10px] font-black text-green-600 uppercase flex items-center gap-1">
                        <Plus size={10} /> {verifiedStudent.firstName} {verifiedStudent.lastName}
                      </div>
                      <div className="text-[9px] font-bold text-neutral-400 uppercase">
                        Niveau: {levels.find(l => l.id === verifiedStudent.levelId)?.name || 'Non défini'}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-neutral-400">Date de la transaction</label>
                <input name="date" type="date" defaultValue={new Date().toISOString().split('T')[0]} className="w-full p-3 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl" />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-neutral-400">Montant (FCFA)</label>
                <input name="amount" type="number" required className="w-full p-3 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl font-black" />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-neutral-400">Description</label>
                <input 
                  name="description" 
                  type="text" 
                  required={formCategory !== 'tuition'} 
                  disabled={formCategory === 'tuition' && verifiedStudent !== null}
                  placeholder={formCategory === 'tuition' ? "Généré automatiquement" : "Libellé de la transaction"}
                  className="w-full p-3 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl" 
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setIsAddModalOpen(false)} className="flex-1 py-3 font-bold text-neutral-500">{t('common.cancel')}</button>
                <button type="submit" disabled={submitting} className="flex-1 btn-primary py-3">{submitting ? t('common.loading') : t('common.save')}</button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Delete Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsDeleteModalOpen(false)} />
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="relative bg-white dark:bg-neutral-900 rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <h4 className="text-xl font-black uppercase mb-4 text-red-600">{t('finances.confirm_deletion')}</h4>
            <p className="text-sm text-neutral-500 mb-6 font-medium">{t('finances.deletion_warning')}</p>
            <div className="space-y-4">
              <textarea 
                value={deletionReason}
                onChange={(e) => setDeletionReason(e.target.value)}
                placeholder="Raison de la suppression..."
                className="w-full p-4 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl h-24 resize-none"
              />
              <div className="flex gap-3">
                <button onClick={() => setIsDeleteModalOpen(false)} className="flex-1 py-3 font-bold text-neutral-500 uppercase text-xs tracking-widest">{t('common.cancel')}</button>
                <button 
                  onClick={handleConfirmDelete} 
                  disabled={!deletionReason.trim()}
                  className="flex-1 bg-red-600 text-white rounded-xl font-bold uppercase text-xs tracking-widest hover:bg-red-700 disabled:opacity-50"
                >
                  Supprimer
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Quick Add Student Modal */}
      {isQuickAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsQuickAddModalOpen(false)} />
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="relative bg-white dark:bg-neutral-900 rounded-[32px] w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-8 bg-orange-600 text-white">
              <h4 className="text-2xl font-black uppercase tracking-tight">Inscription Rapide</h4>
              <p className="text-white/80 text-sm font-medium">Créez un compte élève et encaissez en une étape.</p>
            </div>
            <form onSubmit={handleQuickInscription} className="p-8 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">Nom *</label>
                  <input name="lastName" required className="w-full px-4 py-2.5 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl outline-none focus:ring-2 focus:ring-orange-500/20" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">Prénom *</label>
                  <input name="firstName" required className="w-full px-4 py-2.5 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl outline-none focus:ring-2 focus:ring-orange-500/20" />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">Email (Facultatif)</label>
                <input name="email" type="email" placeholder="eleve@example.com" className="w-full px-4 py-2.5 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl outline-none focus:ring-2 focus:ring-orange-500/20" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">Téléphone</label>
                  <input name="phone" placeholder="6..." className="w-full px-4 py-2.5 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl outline-none focus:ring-2 focus:ring-orange-500/20" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">Date de versement *</label>
                  <input name="paymentDate" type="date" required defaultValue={new Date().toISOString().split('T')[0]} className="w-full px-4 py-2.5 bg-neutral-50 dark:bg-neutral-800 border-2 border-orange-200 dark:border-orange-900 rounded-xl outline-none focus:ring-2 focus:ring-orange-500/20" />
                </div>
              </div>
              <div className="space-y-1.5 px-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">Filière</label>
                <div className="flex gap-2">
                  {['Allemand', 'Anglais'].map(stream => (
                    <button
                      key={stream}
                      type="button"
                      onClick={() => {
                        setQuickAddStream(stream);
                        const filtered = levels.filter(l => l.stream === stream);
                        if (filtered.length > 0) setQuickAddTuition(filtered[0].tuition);
                      }}
                      className={cn(
                        "flex-1 py-2 px-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                        quickAddStream === stream 
                          ? "bg-orange-600 text-white shadow-lg shadow-orange-500/30" 
                          : "bg-neutral-100 text-neutral-400 hover:bg-neutral-200"
                      )}
                    >
                      {stream}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setQuickAddStream('')}
                    className={cn(
                      "flex-1 py-2 px-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                      quickAddStream === '' 
                        ? "bg-neutral-600 text-white shadow-lg" 
                        : "bg-neutral-100 text-neutral-400 hover:bg-neutral-200"
                    )}
                  >
                    Tout
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">Niveau d'Étude *</label>
                  <select 
                    name="levelId" 
                    required 
                    onChange={(e) => {
                      const level = levels.find(l => l.id === e.target.value);
                      if (level) setQuickAddTuition(level.tuition);
                    }}
                    className="w-full px-4 py-2.5 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl outline-none focus:ring-2 focus:ring-orange-500/20"
                  >
                    {levels.filter(l => !quickAddStream || l.stream === quickAddStream).map(l => (
                      <option key={l.id} value={l.id}>{l.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">Total Scolarité *</label>
                  <input 
                    name="totalTuition" 
                    type="number" 
                    value={quickAddTuition}
                    onChange={(e) => setQuickAddTuition(Number(e.target.value))}
                    className="w-full px-4 py-2.5 bg-white dark:bg-neutral-800 border-2 border-orange-200 dark:border-orange-900 rounded-xl font-bold text-orange-600 outline-none focus:ring-2 focus:ring-orange-500/20" 
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5 p-4 bg-orange-50 dark:bg-orange-900/10 border-2 border-orange-100 dark:border-orange-900/30 rounded-2xl flex items-center gap-3">
                  <input name="payInscription" type="checkbox" defaultChecked className="w-5 h-5 accent-orange-600 rounded cursor-pointer" />
                  <div>
                    <p className="text-[11px] font-black uppercase text-orange-600 tracking-wider">Inscription</p>
                    <p className="text-xs font-bold text-orange-500">10 000 FCFA</p>
                  </div>
                </div>
                <div className="space-y-1.5 p-4 bg-blue-50 dark:bg-blue-900/10 border-2 border-blue-100 dark:border-blue-900/30 rounded-2xl flex flex-col justify-center">
                  <div className="flex items-center gap-3 mb-1">
                    <input name="payVorbereitung" type="checkbox" className="w-5 h-5 accent-blue-600 rounded cursor-pointer" />
                    <p className="text-[11px] font-black uppercase text-blue-600 tracking-wider">Vorbereitung</p>
                  </div>
                  <input name="vorbereitungAmount" type="number" defaultValue={50000} className="w-full text-xs bg-transparent border-b border-blue-200 outline-none font-bold text-blue-700" placeholder="Montant" />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1 font-black">Versement Scolarité (Avance)</label>
                <input name="amount" type="number" defaultValue={50000} placeholder="Ex: 50000" className="w-full px-4 py-2.5 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl font-bold text-neutral-900 outline-none focus:ring-2 focus:ring-orange-500/20" />
              </div>
              <div className="pt-4 flex gap-4">
                <button type="button" onClick={() => setIsQuickAddModalOpen(false)} className="flex-1 py-3 text-sm font-bold text-neutral-500">Annuler</button>
                <button type="submit" disabled={submitting} className="flex-1 py-3 bg-orange-600 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-orange-600/30 hover:scale-105 transition-all disabled:opacity-50">
                  {submitting ? 'Création...' : 'Créer & Encaisser'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}

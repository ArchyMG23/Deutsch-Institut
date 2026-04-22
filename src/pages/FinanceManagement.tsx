import React, { useState, useEffect, useRef } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  ArrowUpRight, 
  ArrowDownRight,
  Plus,
  X,
  Printer,
  Mail,
  ChevronUp,
  ChevronDown,
  Calendar,
  Layers,
  Trash2
} from 'lucide-react';
import { cn, formatCurrency } from '../utils';
import { FinanceRecord } from '../types';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { toast } from 'sonner';
import { NotificationService } from '../services/NotificationService';
import { motion } from 'motion/react';

const TransactionTable = ({ 
  records, 
  onSort, 
  sortConfig,
  onDelete,
  isTrash = false
}: { 
  records: FinanceRecord[], 
  onSort?: (key: string) => void, 
  sortConfig?: { key: string, direction: 'asc' | 'desc' } | null,
  onDelete?: (id: string) => void,
  isTrash?: boolean
}) => {
  const SortIcon = ({ column }: { column: string }) => {
    if (!sortConfig || sortConfig.key !== column) return null;
    return sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />;
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-neutral-50 dark:bg-neutral-800/50 border-b border-neutral-200 dark:border-neutral-800">
            <th 
              className={cn(
                "px-6 py-4 text-xs font-bold uppercase tracking-wider text-neutral-500 transition-colors print:px-2",
                onSort && "cursor-pointer hover:text-dia-red"
              )}
              onClick={() => onSort?.('date')}
            >
              <div className="flex items-center gap-1">
                {isTrash ? 'Date Suppression' : 'Date'} <SortIcon column="date" />
              </div>
            </th>
            <th 
              className={cn(
                "px-6 py-4 text-xs font-bold uppercase tracking-wider text-neutral-500 transition-colors print:px-2",
                onSort && "cursor-pointer hover:text-dia-red"
              )}
              onClick={() => onSort?.('description')}
            >
              <div className="flex items-center gap-1">
                Description <SortIcon column="description" />
              </div>
            </th>
            <th 
              className={cn(
                "px-6 py-4 text-xs font-bold uppercase tracking-wider text-neutral-500 transition-colors print:px-2",
                onSort && "cursor-pointer hover:text-dia-red"
              )}
              onClick={() => onSort?.('category')}
            >
              <div className="flex items-center gap-1">
                Catégorie <SortIcon column="category" />
              </div>
            </th>
            {isTrash && (
              <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-neutral-500">
                Raison / Par
              </th>
            )}
            <th 
              className={cn(
                "px-6 py-4 text-xs font-bold uppercase tracking-wider text-neutral-500 text-right transition-colors print:px-2",
                onSort && "cursor-pointer hover:text-dia-red"
              )}
              onClick={() => onSort?.('amount')}
            >
              <div className="flex items-center justify-end gap-1">
                Montant <SortIcon column="amount" />
              </div>
            </th>
            {!isTrash && (
              <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-neutral-500 text-right print:hidden">
                Actions
              </th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
          {records.length > 0 ? (
            records.map((record) => (
              <tr key={record.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors group">
                <td className="px-6 py-4 text-sm font-medium print:px-2">
                  {new Date(isTrash && record.deletedAt ? record.deletedAt : record.date).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 print:px-2">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center print:hidden",
                      record.type === 'income' ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600"
                    )}>
                      {record.type === 'income' ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-neutral-700 dark:text-neutral-300 group-hover:text-dia-red transition-colors">{record.description}</p>
                      {isTrash && <p className="text-[10px] text-neutral-400">Date trans: {new Date(record.date).toLocaleDateString()}</p>}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 print:px-2">
                  <span className="text-[10px] font-bold uppercase px-2 py-1 bg-neutral-100 dark:bg-neutral-800 rounded-full text-neutral-500 border border-neutral-200 dark:border-neutral-700">
                    {record.category}
                  </span>
                </td>
                {isTrash && (
                  <td className="px-6 py-4">
                    <p className="text-xs font-bold text-red-500">{record.deletionReason}</p>
                    <p className="text-[9px] text-neutral-400 uppercase tracking-tighter">Supprimé par: {record.deletedBy}</p>
                  </td>
                )}
                <td className={cn(
                  "px-6 py-4 text-right font-black print:px-2",
                  record.type === 'income' ? "text-green-600" : "text-red-600"
                )}>
                  {record.type === 'income' ? '+' : '-'}{formatCurrency(record.amount)}
                </td>
                {!isTrash && (
                  <td className="px-6 py-4 text-right print:hidden">
                    <button 
                      onClick={() => onDelete?.(record.id)}
                      className="p-2 text-neutral-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg transition-all"
                      title="Supprimer cette transaction"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                )}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={isTrash ? 5 : 4} className="px-6 py-20 text-center text-neutral-400 font-medium">
                Aucune transaction trouvée.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default function FinanceManagement() {
  const { 
    finances: allRecords, 
    trashFinances, 
    loading, 
    refreshFinances, 
    refreshTrash, 
    refreshAll 
  } = useData();
  const { user, fetchWithAuth } = useAuth();
  
  const [viewMode, setViewMode] = useState<'active' | 'trash'>('active');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState<string | null>(null);
  const [deletionReason, setDeletionReason] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [selectedMonth, setSelectedMonth] = useState('all'); // 'all' or '0'-'11'
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>({ key: 'date', direction: 'desc' });
  const [submitting, setSubmitting] = useState(false);
  
  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  // Available Years from data
  const availableYears = Array.from(new Set(allRecords.map(r => new Date(r.date).getFullYear().toString()))) as string[];
  availableYears.sort((a, b) => b.localeCompare(a));
  if (!availableYears.includes(new Date().getFullYear().toString())) {
    availableYears.push(new Date().getFullYear().toString());
    availableYears.sort((a, b) => b.localeCompare(a));
  }

  const months = [
    { value: 'all', label: 'Toute l\'année' },
    { value: '0', label: 'Janvier' },
    { value: '1', label: 'Février' },
    { value: '2', label: 'Mars' },
    { value: '3', label: 'Avril' },
    { value: '4', label: 'Mai' },
    { value: '5', label: 'Juin' },
    { value: '6', label: 'Juillet' },
    { value: '7', label: 'Août' },
    { value: '8', label: 'Septembre' },
    { value: '9', label: 'Octobre' },
    { value: '10', label: 'Novembre' },
    { value: '11', label: 'Décembre' },
  ];

  const handleAddRecord = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    const formData = new FormData(e.currentTarget);
    
    const newRecord = {
      type: formData.get('type'),
      amount: parseInt(formData.get('amount') as string),
      description: formData.get('description'),
      category: formData.get('category'),
      date: new Date().toISOString()
    };

    try {
      const res = await fetchWithAuth('/api/finances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newRecord)
      });
      if (res.ok) {
        setIsAddModalOpen(false);
        refreshFinances();
        toast.success('Transaction enregistrée avec succès');
      }
    } catch (err) {
      console.error("Error adding finance record:", err);
      toast.error('Erreur lors de l\'enregistrement de la transaction');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteRecord = async (id: string) => {
    setRecordToDelete(id);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recordToDelete || !deletionReason) return;

    try {
      setSubmitting(true);
      const res = await fetchWithAuth(`/api/finances/${recordToDelete}/archive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: deletionReason })
      });
      if (res.ok) {
        toast.success("Transaction déplacée vers la corbeille");
        setIsDeleteModalOpen(false);
        setDeletionReason('');
        setRecordToDelete(null);
        refreshFinances();
        refreshTrash();
      } else {
        toast.error("Erreur lors de l'archivage");
      }
    } catch (err) {
      console.error("Error archiving record:", err);
      toast.error("Erreur réseau");
    } finally {
      setSubmitting(false);
    }
  };

  const filteredByDate = allRecords.filter(r => {
    const d = new Date(r.date);
    const yearMatch = d.getFullYear().toString() === selectedYear;
    const monthMatch = selectedMonth === 'all' || d.getMonth().toString() === selectedMonth;
    return yearMatch && monthMatch;
  });

  const filteredByType = filteredByDate.filter(r => filterType === 'all' || r.type === filterType);

  const totalIncome = filteredByDate.filter(r => r.type === 'income').reduce((acc, r) => acc + r.amount, 0);
  const totalExpense = filteredByDate.filter(r => r.type === 'expense').reduce((acc, r) => acc + r.amount, 0);
  const balance = totalIncome - totalExpense;

  const sortedRecords = [...filteredByType].sort((a, b) => {
    if (!sortConfig) return 0;
    const { key, direction } = sortConfig;
    
    let aValue: any = (a as any)[key];
    let bValue: any = (b as any)[key];

    if (key === 'date') {
      aValue = new Date(aValue).getTime();
      bValue = new Date(bValue).getTime();
    } else if (typeof aValue === 'string') {
      aValue = aValue.toLowerCase();
      bValue = bValue.toLowerCase();
    }

    if (aValue < bValue) return direction === 'asc' ? -1 : 1;
    if (aValue > bValue) return direction === 'asc' ? 1 : -1;
    return 0;
  });

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

  const handlePrint = () => {
    window.print();
  };

  const handleEmailReport = async () => {
    if (!user?.email) {
      toast.error("Votre adresse email est manquante.");
      return;
    }

    try {
      setSubmitting(true);
      const periodLabel = selectedMonth === 'all' ? `Année ${selectedYear}` : `${months.find(m => m.value === selectedMonth)?.label} ${selectedYear}`;
      
      const recordsHtml = sortedRecords.map(r => `
        <tr style="border-bottom: 1px solid #eee;">
          <td style="padding: 8px;">${new Date(r.date).toLocaleDateString()}</td>
          <td style="padding: 8px;">${r.description}</td>
          <td style="padding: 8px;">${r.category}</td>
          <td style="padding: 8px; text-align: right; font-weight: bold; color: ${r.type === 'income' ? '#2f855a' : '#c53030'};">
            ${r.type === 'income' ? '+' : '-'}${formatCurrency(r.amount)}
          </td>
        </tr>
      `).join('');

      const stats = { income: totalIncome, expense: totalExpense, balance };
      const success = await NotificationService.sendFinanceReport(fetchWithAuth, user.email, periodLabel, stats, recordsHtml);
      
      if (success) {
        toast.success(`Rapport envoyé à ${user.email}`);
      } else {
        toast.error("Échec de l'envoi du rapport.");
      }
    } catch (err) {
      console.error("Error mailing report:", err);
      toast.error("Erreur lors de l'envoi du rapport.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 print:p-0 print:m-0">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <div>
          <h3 className="text-2xl font-black text-dia-red uppercase tracking-tight">Gestion Financière</h3>
          <p className="text-sm text-neutral-500 font-medium">Suivi précis des revenus et dépenses</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center p-1 bg-neutral-100 dark:bg-neutral-800 rounded-2xl mr-2">
            <button 
              onClick={() => setViewMode('active')}
              className={cn(
                "px-4 py-2 rounded-xl text-xs font-bold transition-all",
                viewMode === 'active' ? "bg-white dark:bg-neutral-700 text-dia-red shadow-sm" : "text-neutral-500"
              )}
            >
              Actives
            </button>
            <button 
              onClick={() => setViewMode('trash')}
              className={cn(
                "px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2",
                viewMode === 'trash' ? "bg-white dark:bg-neutral-700 text-dia-red shadow-sm" : "text-neutral-500"
              )}
            >
              <Trash2 size={14} />
              Corbeille
            </button>
          </div>
          <button 
            onClick={() => setIsAddModalOpen(true)}
            className="btn-primary flex items-center gap-2 px-6 shadow-lg shadow-dia-red/20"
          >
            <Plus size={18} />
            <span>Nouvelle Transaction</span>
          </button>
        </div>
      </div>

      {/* Trash Warning */}
      {viewMode === 'trash' && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 rounded-2xl flex items-center gap-3 text-red-600 dark:text-red-400"
        >
          <Trash2 size={20} />
          <p className="text-sm font-medium">Vous consultez la corbeille. Ces transactions ont été archivées pour des raisons d'audit et de lutte contre la fraude.</p>
        </motion.div>
      )}

      {/* Date Filters Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 print:hidden">
        <div className="card p-3 flex items-center gap-3">
          <Calendar className="text-dia-red" size={20} />
          <div className="flex-1">
            <p className="text-[10px] font-bold text-neutral-400 uppercase">Année</p>
            <select 
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="w-full bg-transparent font-bold outline-none cursor-pointer"
            >
              {availableYears.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="card p-3 flex items-center gap-3">
          <Layers className="text-dia-red" size={20} />
          <div className="flex-1">
            <p className="text-[10px] font-bold text-neutral-400 uppercase">Période</p>
            <select 
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full bg-transparent font-bold outline-none cursor-pointer"
            >
              {months.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="md:col-span-2 flex items-center gap-2">
          <button 
            onClick={handlePrint}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl font-bold hover:bg-neutral-50 transition-all shadow-sm"
          >
            <Printer size={18} />
            <span>Imprimer</span>
          </button>
          <button 
            onClick={handleEmailReport}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl font-bold hover:bg-neutral-50 transition-all shadow-sm"
          >
            <Mail size={18} />
            <span>Envoyer par Mail</span>
          </button>
        </div>
      </div>

      <div id="report-section" ref={reportRef} className="space-y-6">
        {/* Printable Header */}
        <div className="hidden print:flex flex-col items-center mb-10 text-center">
          <h1 className="text-3xl font-black text-dia-red mb-2">RAPPORT FINANCIER DIA_SAAS</h1>
          <p className="text-xl font-bold bg-neutral-100 px-6 py-2 rounded-full uppercase">
            {selectedMonth === 'all' ? `Année ${selectedYear}` : `${months.find(m => m.value === selectedMonth)?.label} ${selectedYear}`}
          </p>
          <p className="text-sm text-neutral-400 mt-4">Généré le {new Date().toLocaleString('fr-FR')}</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className={cn(
            "card p-6 border-l-4 border-l-green-500 bg-white dark:bg-neutral-900 transition-all",
            "print:border-l-green-500"
          )}>
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-xl bg-green-50 dark:bg-green-400/10 text-green-600 flex items-center justify-center">
                <TrendingUp size={20} />
              </div>
              <span className="text-[10px] font-bold text-green-600 uppercase tracking-wider">Revenus</span>
            </div>
            <h4 className="text-3xl font-black text-neutral-900 dark:text-white">{formatCurrency(totalIncome)}</h4>
          </div>

          <div className={cn(
            "card p-6 border-l-4 border-l-red-500 bg-white dark:bg-neutral-900 transition-all",
            "print:border-l-red-500"
          )}>
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-400/10 text-red-600 flex items-center justify-center">
                <TrendingDown size={20} />
              </div>
              <span className="text-[10px] font-bold text-red-600 uppercase tracking-wider">Dépenses</span>
            </div>
            <h4 className="text-3xl font-black text-neutral-900 dark:text-white">{formatCurrency(totalExpense)}</h4>
          </div>

          <div className={cn(
            "card p-6 border-l-4 border-l-dia-red bg-white dark:bg-neutral-900 transition-all",
            "print:border-l-dia-red"
          )}>
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-xl bg-dia-red/5 text-dia-red flex items-center justify-center">
                <Wallet size={20} />
              </div>
              <span className="text-[10px] font-bold text-dia-red uppercase tracking-wider">Solde</span>
            </div>
            <h4 className="text-3xl font-black text-neutral-900 dark:text-white">{formatCurrency(balance)}</h4>
          </div>
        </div>

        {/* Transactions Section */}
        {viewMode === 'trash' ? (
          <div className="card overflow-hidden">
            <div className="p-6 border-b border-neutral-100 dark:border-neutral-800">
              <h5 className="font-bold flex items-center gap-2 text-red-600">
                <Trash2 size={20} />
                Archives de Suppression (Audit)
              </h5>
            </div>
            <TransactionTable records={trashFinances} isTrash={true} />
          </div>
        ) : selectedMonth === 'all' ? (
          <div className="space-y-8">
            {months.filter(m => m.value !== 'all').map(month => {
              const monthRecords = filteredByType.filter(r => new Date(r.date).getMonth().toString() === month.value);
              if (monthRecords.length === 0) return null;

              const monthIncome = monthRecords.filter(r => r.type === 'income').reduce((acc, r) => acc + r.amount, 0);
              const monthExpense = monthRecords.filter(r => r.type === 'expense').reduce((acc, r) => acc + r.amount, 0);

              return (
                <div key={month.value} className="card overflow-hidden">
                  <div className="flex items-center justify-between p-6 bg-neutral-50 dark:bg-neutral-800/50 border-b border-neutral-100 dark:border-neutral-800">
                    <h5 className="text-lg font-black uppercase tracking-tight">{month.label} {selectedYear}</h5>
                    <div className="flex gap-4 text-xs font-bold">
                      <span className="text-green-600">Revenus: {formatCurrency(monthIncome)}</span>
                      <span className="text-red-600">Dépenses: {formatCurrency(monthExpense)}</span>
                      <span className="text-dia-red">Solde: {formatCurrency(monthIncome - monthExpense)}</span>
                    </div>
                  </div>
                  <TransactionTable records={monthRecords} onDelete={handleDeleteRecord} />
                </div>
              );
            })}
          </div>
        ) : (
          <div className="card overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between p-6 border-b border-neutral-100 dark:border-neutral-800 gap-4 print:hidden">
              <h5 className="font-bold flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-dia-red animate-pulse" />
                Historique des Transactions
              </h5>
              <div className="flex items-center gap-1 p-1 bg-neutral-100 dark:bg-neutral-800 rounded-xl">
                {(['all', 'income', 'expense'] as const).map((type) => (
                  <button 
                    key={type}
                    onClick={() => setFilterType(type)}
                    className={cn(
                      "px-4 py-1.5 rounded-lg text-xs font-bold transition-all",
                      filterType === type 
                        ? "bg-white dark:bg-neutral-700 text-dia-red shadow-sm" 
                        : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
                    )}
                  >
                    {type === 'all' ? 'Tout' : type === 'income' ? 'Revenus' : 'Dépenses'}
                  </button>
                ))}
              </div>
            </div>
            <TransactionTable records={sortedRecords} onSort={handleSort} sortConfig={sortConfig} onDelete={handleDeleteRecord} />
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-neutral-950 w-full max-w-md rounded-[40px] shadow-2xl overflow-hidden animate-in zoom-in slide-in-from-bottom-4 duration-300 border border-neutral-100 dark:border-neutral-800">
            <div className="p-8 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between bg-red-50/50 dark:bg-red-900/10">
              <h3 className="text-2xl font-black tracking-tight text-red-600 flex items-center gap-2">
                <Trash2 size={24} />
                Justification
              </h3>
              <button onClick={() => setIsDeleteModalOpen(false)} className="p-2 hover:bg-neutral-200 dark:hover:bg-neutral-800 rounded-2xl transition-colors">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={confirmDelete} className="p-8 space-y-6">
              <div className="space-y-4">
                <p className="text-sm font-medium text-neutral-500">
                  Pour éviter toute fraude, vous devez obligatoirement préciser la raison de la suppression de cette transaction.
                </p>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">Raison de la suppression</label>
                  <textarea 
                    name="reason" 
                    required 
                    value={deletionReason}
                    onChange={(e) => setDeletionReason(e.target.value)}
                    placeholder="Ex: Erreur de saisie en doublon lors de la promotion de classe" 
                    className="w-full px-6 py-4 bg-neutral-50 dark:bg-neutral-900 border-2 border-neutral-100 dark:border-neutral-800 rounded-3xl focus:ring-4 focus:ring-red-500/10 focus:border-red-500 outline-none transition-all font-medium h-32 resize-none"
                  />
                </div>
              </div>

              <div className="pt-4 space-y-3">
                <button 
                  type="submit" 
                  disabled={submitting}
                  className="w-full py-5 rounded-[24px] text-lg font-bold bg-red-600 text-white flex items-center justify-center gap-3 shadow-xl shadow-red-600/20 active:scale-95 transition-transform"
                >
                  {submitting ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    "Confirmer l'Archivage"
                  )}
                </button>
                <button type="button" onClick={() => setIsDeleteModalOpen(false)} className="w-full py-4 text-sm font-bold text-neutral-400 hover:text-neutral-600 transition-colors uppercase tracking-widest">Annuler</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Add Record Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-neutral-950 w-full max-w-md rounded-[40px] shadow-2xl overflow-hidden animate-in zoom-in slide-in-from-bottom-4 duration-300 border border-neutral-100 dark:border-neutral-800">
            <div className="p-8 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between bg-neutral-50/50 dark:bg-neutral-900/50">
              <h3 className="text-3xl font-black tracking-tight text-dia-red">Transaction</h3>
              <button onClick={() => setIsAddModalOpen(false)} className="p-2 hover:bg-neutral-200 dark:hover:bg-neutral-800 rounded-2xl transition-colors">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleAddRecord} className="p-8 space-y-6">
              <div className="space-y-4">
                <div className="space-y-2 text-center flex gap-4">
                  <label className={cn(
                    "flex-1 p-4 rounded-3xl border-2 cursor-pointer transition-all flex flex-col items-center gap-2",
                    "hover:scale-[1.02] active:scale-[0.98]",
                    "has-[:checked]:border-green-500 has-[:checked]:bg-green-50 dark:has-[:checked]:bg-green-900/20 border-neutral-100 dark:border-neutral-800"
                  )}>
                    <input type="radio" name="type" value="income" defaultChecked className="hidden" />
                    <div className="w-10 h-10 rounded-full bg-green-100 text-green-600 flex items-center justify-center">
                      <TrendingUp size={20} />
                    </div>
                    <span className="text-xs font-bold uppercase">Revenu</span>
                  </label>
                  <label className={cn(
                    "flex-1 p-4 rounded-3xl border-2 cursor-pointer transition-all flex flex-col items-center gap-2",
                    "hover:scale-[1.02] active:scale-[0.98]",
                    "has-[:checked]:border-red-500 has-[:checked]:bg-red-50 dark:has-[:checked]:bg-red-900/20 border-neutral-100 dark:border-neutral-800"
                  )}>
                    <input type="radio" name="type" value="expense" className="hidden" />
                    <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center">
                      <TrendingDown size={20} />
                    </div>
                    <span className="text-xs font-bold uppercase">Dépense</span>
                  </label>
                </div>

                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">Montant (FCFA)</label>
                  <input name="amount" required type="number" placeholder="0" className="w-full px-6 py-4 bg-neutral-50 dark:bg-neutral-900 border-2 border-neutral-100 dark:border-neutral-800 rounded-3xl focus:ring-4 focus:ring-dia-red/10 focus:border-dia-red outline-none transition-all text-xl font-black" />
                </div>

                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">Description</label>
                  <input name="description" required type="text" placeholder="Ex: Paiement Scolarité Tranche 1" className="w-full px-6 py-4 bg-neutral-50 dark:bg-neutral-900 border-2 border-neutral-100 dark:border-neutral-800 rounded-3xl focus:ring-4 focus:ring-dia-red/10 focus:border-dia-red outline-none transition-all font-bold" />
                </div>

                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">Catégorie</label>
                  <select name="category" required className="w-full px-6 py-4 bg-neutral-50 dark:bg-neutral-900 border-2 border-neutral-100 dark:border-neutral-800 rounded-3xl focus:ring-4 focus:ring-dia-red/10 focus:border-dia-red outline-none transition-all font-bold appearance-none">
                    <option value="Tuition">Scolarité</option>
                    <option value="Salary">Salaire</option>
                    <option value="Rent">Loyer</option>
                    <option value="Equipment">Équipement</option>
                    <option value="Taxes">Taxes / Frais</option>
                    <option value="Other">Autre</option>
                  </select>
                </div>
              </div>

              <div className="pt-4 space-y-3">
                <button 
                  type="submit" 
                  disabled={submitting}
                  className="w-full btn-primary py-5 rounded-[24px] text-lg flex items-center justify-center gap-3 shadow-xl shadow-dia-red/20 active:scale-95 transition-transform"
                >
                  {submitting ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Traitement...</span>
                    </>
                  ) : (
                    <>
                      <Plus size={22} />
                      <span>Valider la Transaction</span>
                    </>
                  )}
                </button>
                <button type="button" onClick={() => setIsAddModalOpen(false)} className="w-full py-4 text-sm font-bold text-neutral-400 hover:text-neutral-600 transition-colors uppercase tracking-widest">Annuler</button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #report-section, #report-section * {
            visibility: visible;
          }
          #report-section {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          .print\\:hidden {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}

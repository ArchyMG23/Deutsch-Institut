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
  Trash2,
  Search,
  ArrowUpDown
} from 'lucide-react';
import { cn, formatCurrency } from '../utils';
import { FinanceRecord } from '../types';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { toast } from 'sonner';
import { NotificationService } from '../services/NotificationService';
import { motion } from 'motion/react';

import { useTranslation } from 'react-i18next';

const TransactionTable = React.memo(({ 
  records, 
  onSort, 
  sortConfig,
  onDelete,
  isTrash = false,
  limit = 20
}: { 
  records: FinanceRecord[], 
  onSort?: (key: string) => void, 
  sortConfig?: { key: string, direction: 'asc' | 'desc' } | null,
  onDelete?: (id: string) => void,
  isTrash?: boolean,
  limit?: number
}) => {
  const { t, i18n } = useTranslation();
  const [displayLimit, setDisplayLimit] = useState(limit);
  
  const visibleRecords = React.useMemo(() => records.slice(0, displayLimit), [records, displayLimit]);
  const hasMore = records.length > displayLimit;

  // Reset limit when records change (e.g. filter change)
  useEffect(() => {
    setDisplayLimit(limit);
  }, [records, limit]);

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
                {isTrash ? t('finances.deletion_date') : t('common.date')} <SortIcon column="date" />
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
                {t('common.description')} <SortIcon column="description" />
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
                {t('common.category')} <SortIcon column="category" />
              </div>
            </th>
            {isTrash && (
              <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-neutral-500">
                {t('finances.reason_by')}
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
                {t('common.amount')} <SortIcon column="amount" />
              </div>
            </th>
            {!isTrash && (
              <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-neutral-500 text-right print:hidden">
                {t('teachers.actions') || 'Actions'}
              </th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
          {visibleRecords.length > 0 ? (
            visibleRecords.map((record) => (
              <tr key={record.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors group">
                <td className="px-6 py-4 text-sm font-medium print:px-2">
                  {(() => {
                    try {
                      const dateSrc = isTrash && record.deletedAt ? record.deletedAt : record.date;
                      if (!dateSrc) return '--';
                      const d = new Date(dateSrc);
                      return isNaN(d.getTime()) ? '--' : d.toLocaleDateString();
                    } catch (e) {
                      return '--';
                    }
                  })()}
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
                      <p className="text-sm font-bold text-neutral-700 dark:text-neutral-300 group-hover:text-dia-red transition-colors">{record.description || t('common.no_description')}</p>
                      {isTrash && (
                        <p className="text-[10px] text-neutral-400">
                          {t('finances.trans_date')}: {(() => {
                            try {
                              const d = new Date(record.date);
                              return isNaN(d.getTime()) ? '--' : d.toLocaleDateString();
                            } catch (e) { return '--'; }
                          })()}
                        </p>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 print:px-2">
                  <span className="text-[10px] font-bold uppercase px-2 py-1 bg-neutral-100 dark:bg-neutral-800 rounded-full text-neutral-500 border border-neutral-200 dark:border-neutral-700">
                    {(() => {
                      const cat = String(record.category || 'other').toLowerCase();
                      return t(`finances.categories.${cat}`) || record.category || 'Other';
                    })()}
                  </span>
                </td>
                {isTrash && (
                  <td className="px-6 py-4">
                    <p className="text-xs font-bold text-red-500">{record.deletionReason}</p>
                    <p className="text-[9px] text-neutral-400 uppercase tracking-tighter">{t('finances.deleted_by')}: {record.deletedBy}</p>
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
                      title={t('finances.delete_tooltip')}
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
                {t('finances.no_transactions')}
              </td>
            </tr>
          )}
        </tbody>
      </table>
      {hasMore && (
        <div className="p-6 text-center border-t border-neutral-100 dark:border-neutral-800 print:hidden">
          <button 
            onClick={() => setDisplayLimit(p => p + limit)}
            className="text-xs font-bold uppercase tracking-widest text-dia-red hover:bg-dia-red/5 px-6 py-2 rounded-xl transition-all"
          >
            {t('common.show_more') || 'Voir plus'} ({records.length - displayLimit} restantes)
          </button>
        </div>
      )}
    </div>
  );
});

export default function FinanceManagement() {
  const { t, i18n } = useTranslation();
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
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [selectedMonth, setSelectedMonth] = useState('all'); // 'all' or '0'-'11'
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>({ key: 'date', direction: 'desc' });
  const [submitting, setSubmitting] = useState(false);
  
  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    refreshFinances();
    refreshTrash();
  }, [refreshFinances, refreshTrash]);

  // Available Years from data
  const availableYears = React.useMemo(() => {
    const years = new Set<string>();
    try {
      allRecords.forEach(r => {
        if (r && r.date) {
          const d = new Date(r.date);
          if (!isNaN(d.getTime())) {
            years.add(d.getFullYear().toString());
          }
        }
      });
    } catch (e) {
      console.error("Error calculating available years:", e);
    }
    
    // Ensure current year is always available
    const currentYear = new Date().getFullYear().toString();
    years.add(currentYear);
    
    return Array.from(years).sort((a, b) => b.localeCompare(a));
  }, [allRecords]);

  const months = React.useMemo(() => [
    { value: 'all', label: t('finances.all_year') },
    { value: '0', label: t('months.january') },
    { value: '1', label: t('months.february') },
    { value: '2', label: t('months.march') },
    { value: '3', label: t('months.april') },
    { value: '4', label: t('months.may') },
    { value: '5', label: t('months.june') },
    { value: '6', label: t('months.july') },
    { value: '7', label: t('months.august') },
    { value: '8', label: t('months.september') },
    { value: '9', label: t('months.october') },
    { value: '10', label: t('months.november') },
    { value: '11', label: t('months.december') },
  ], [t]);

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
        toast.success(t('finances.transaction_added'));
      }
    } catch (err) {
      console.error("Error adding finance record:", err);
      toast.error(t('common.error'));
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
        toast.success(t('finances.transaction_archived'));
        setIsDeleteModalOpen(false);
        setDeletionReason('');
        setRecordToDelete(null);
        refreshFinances();
        refreshTrash();
      } else {
        toast.error(t('common.error'));
      }
    } catch (err) {
      console.error("Error archiving record:", err);
      toast.error(t('common.error'));
    } finally {
      setSubmitting(false);
    }
  };

  const filteredByDate = React.useMemo(() => {
    try {
      const query = searchQuery.toLowerCase();
      return allRecords.filter(r => {
        if (!r || !r.date) return false;
        const d = new Date(r.date);
        if (isNaN(d.getTime())) return false;
        const yearMatch = d.getFullYear().toString() === selectedYear;
        const monthMatch = selectedMonth === 'all' || d.getMonth().toString() === selectedMonth;
        
        if (!yearMatch || !monthMatch) return false;

        const desc = (r.description || '').toLowerCase();
        const cat = (r.category || '').toLowerCase();
        
        const searchMatch = searchQuery === '' || 
          desc.includes(query) ||
          cat.includes(query) ||
          (r.amount && r.amount.toString().includes(searchQuery));
          
        return searchMatch;
      });
    } catch (e) {
      console.error("Crash in filteredByDate memo:", e);
      return [];
    }
  }, [allRecords, selectedYear, selectedMonth, searchQuery]);

  const filteredByType = React.useMemo(() => {
    try {
      if (filterType === 'all') return filteredByDate;
      return filteredByDate.filter(r => r.type === filterType);
    } catch (e) {
      console.error("Crash in filteredByType memo:", e);
      return [];
    }
  }, [filteredByDate, filterType]);

  const { totalIncome, totalExpense, balance } = React.useMemo(() => {
    try {
      let income = 0;
      let expense = 0;
      filteredByDate.forEach(r => {
        if (r && r.type === 'income') income += (Number(r.amount) || 0);
        else if (r && r.type === 'expense') expense += (Number(r.amount) || 0);
      });
      return { 
        totalIncome: income, 
        totalExpense: expense, 
        balance: income - expense 
      };
    } catch (e) {
      console.error("Crash in balance stats memo:", e);
      return { totalIncome: 0, totalExpense: 0, balance: 0 };
    }
  }, [filteredByDate]);

  const sortedRecords = React.useMemo(() => {
    try {
      const records = [...filteredByType];
      if (!sortConfig) return records;
      
      const { key, direction } = sortConfig;
      
      return records.sort((a, b) => {
        if (!a || !b) return 0;
        let aValue: any = (a as any)[key];
        let bValue: any = (b as any)[key];

        if (key === 'date') {
          aValue = new Date(aValue).getTime();
          bValue = new Date(bValue).getTime();
          if (isNaN(aValue)) aValue = 0;
          if (isNaN(bValue)) bValue = 0;
        } else if (typeof aValue === 'string') {
          aValue = (aValue || '').toLowerCase();
          bValue = (bValue || '').toLowerCase();
        } else if (typeof aValue === 'number') {
          aValue = aValue || 0;
          bValue = bValue || 0;
        }

        if (aValue < bValue) return direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return direction === 'asc' ? 1 : -1;
        return 0;
      });
    } catch (e) {
      console.error("Crash in sortedRecords memo:", e);
      return filteredByType;
    }
  }, [filteredByType, sortConfig]);

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
      toast.error(t('profile.email_missing'));
      return;
    }

    try {
      setSubmitting(true);
      const periodLabel = selectedMonth === 'all' ? `${t('common.year')} ${selectedYear}` : `${months.find(m => m.value === selectedMonth)?.label} ${selectedYear}`;
      
      const recordsHtml = sortedRecords.map(r => `
        <tr style="border-bottom: 1px solid #eee;">
          <td style="padding: 8px;">${r && r.date ? new Date(r.date).toLocaleDateString() : '--'}</td>
          <td style="padding: 8px;">${r?.description || '--'}</td>
          <td style="padding: 8px;">${(() => {
            try {
              const cat = String(r?.category || 'other').toLowerCase();
              return t(`finances.categories.${cat}`) || r?.category || 'Other';
            } catch (e) { return '--'; }
          })()}</td>
          <td style="padding: 8px; text-align: right; font-weight: bold; color: ${r?.type === 'income' ? '#2f855a' : '#c53030'};">
            ${r?.type === 'income' ? '+' : '-'}${formatCurrency(r?.amount || 0)}
          </td>
        </tr>
      `).join('');

      const stats = { income: totalIncome, expense: totalExpense, balance };
      const success = await NotificationService.sendFinanceReport(fetchWithAuth, user.email, periodLabel, stats, recordsHtml);
      
      if (success) {
        toast.success(`${t('profile.report_sent')} ${user.email}`);
      } else {
        toast.error(t('common.error'));
      }
    } catch (err) {
      console.error("Error mailing report:", err);
      toast.error(t('common.error'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 print:p-0 print:m-0">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <div>
          <h3 className="text-2xl font-black text-dia-red uppercase tracking-tight">{t('finances.title')}</h3>
          <p className="text-sm text-neutral-500 font-medium">{t('finances.subtitle')}</p>
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
              {t('finances.active')}
            </button>
            <button 
              onClick={() => setViewMode('trash')}
              className={cn(
                "px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2",
                viewMode === 'trash' ? "bg-white dark:bg-neutral-700 text-dia-red shadow-sm" : "text-neutral-500"
              )}
            >
              <Trash2 size={14} />
              {t('finances.trash')}
            </button>
          </div>
          <button 
            onClick={() => setIsAddModalOpen(true)}
            className="btn-primary flex items-center gap-2 px-6 shadow-lg shadow-dia-red/20"
          >
            <Plus size={18} />
            <span>{t('finances.new_transaction') || t('finances.transaction')}</span>
          </button>
        </div>
      </div>

      {/* Trash Warning */}
      {viewMode === 'trash' && (
        <div 
          className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 rounded-2xl flex items-center gap-3 text-red-600 dark:text-red-400"
        >
          <Trash2 size={20} />
          <p className="text-sm font-medium">{t('finances.trash_warning')}</p>
        </div>
      )}

      {/* Date Filters Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 print:hidden">
        <div className="card p-3 flex items-center gap-3">
          <Calendar className="text-dia-red" size={20} />
          <div className="flex-1">
            <p className="text-[10px] font-bold text-neutral-400 uppercase">{t('common.year')}</p>
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
            <p className="text-[10px] font-bold text-neutral-400 uppercase">{t('common.period')}</p>
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

        <div className="card p-3 flex items-center gap-3">
          <ArrowUpDown className="text-dia-red" size={20} />
          <div className="flex-1">
            <p className="text-[10px] font-bold text-neutral-400 uppercase">{t('common.sort_by')}</p>
            <div className="flex items-center gap-2">
              <select 
                value={sortConfig?.key || ''} 
                onChange={(e) => handleSort(e.target.value)}
                className="bg-transparent font-bold outline-none cursor-pointer text-sm"
              >
                <option value="date">{t('common.date')}</option>
                <option value="amount">{t('common.amount')}</option>
                <option value="description">{t('common.description')}</option>
                <option value="category">{t('common.category')}</option>
              </select>
              <button 
                onClick={() => handleSort(sortConfig?.key || 'date')}
                className="p-1 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded transition-colors"
                title={sortConfig?.direction === 'asc' ? t('common.ascending') : t('common.descending')}
              >
                {sortConfig?.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative group flex-1">
            <input 
              type="text" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('finances.search_placeholder')}
              className="w-full pl-10 pr-4 py-3 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl font-bold focus:ring-2 focus:ring-dia-red outline-none transition-all"
            />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 group-focus-within:text-dia-red transition-colors" size={18} />
          </div>
          <button 
            onClick={handlePrint}
            className="flex items-center justify-center p-3 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl font-bold hover:bg-neutral-50 transition-all shadow-sm"
            title={t('common.print')}
          >
            <Printer size={18} />
          </button>
          <button 
            onClick={handleEmailReport}
            className="flex items-center justify-center p-3 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl font-bold hover:bg-neutral-50 transition-all shadow-sm"
            title={t('common.send_by_mail')}
          >
            <Mail size={18} />
          </button>
        </div>
      </div>

      <div id="report-section" ref={reportRef} className="space-y-6">
        {/* Printable Header */}
        <div className="hidden print:flex flex-col items-center mb-10 text-center">
          <h1 className="text-3xl font-black text-dia-red mb-2">{t('finances.report_title')}</h1>
          <p className="text-xl font-bold bg-neutral-100 px-6 py-2 rounded-full uppercase">
            {selectedMonth === 'all' ? `${t('common.year')} ${selectedYear}` : `${months.find(m => m.value === selectedMonth)?.label} ${selectedYear}`}
          </p>
          <p className="text-sm text-neutral-400 mt-4">{t('common.generated_on')} {new Date().toLocaleString(i18n.language === 'de' ? 'de-DE' : i18n.language === 'en' ? 'en-US' : 'fr-FR')}</p>
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
              <span className="text-[10px] font-bold text-green-600 uppercase tracking-wider">{t('finances.income')}</span>
            </div>
            <h4 className="text-3xl font-black text-neutral-900 dark:text-white line-clamp-1">{formatCurrency(totalIncome)}</h4>
          </div>

          <div className={cn(
            "card p-6 border-l-4 border-l-red-500 bg-white dark:bg-neutral-900 transition-all",
            "print:border-l-red-500"
          )}>
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-400/10 text-red-600 flex items-center justify-center">
                <TrendingDown size={20} />
              </div>
              <span className="text-[10px] font-bold text-red-600 uppercase tracking-wider">{t('finances.expense')}</span>
            </div>
            <h4 className="text-3xl font-black text-neutral-900 dark:text-white line-clamp-1">{formatCurrency(totalExpense)}</h4>
          </div>

          <div className={cn(
            "card p-6 border-l-4 border-l-dia-red bg-white dark:bg-neutral-900 transition-all",
            "print:border-l-dia-red"
          )}>
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-xl bg-dia-red/5 text-dia-red flex items-center justify-center">
                <Wallet size={20} />
              </div>
              <span className="text-[10px] font-bold text-dia-red uppercase tracking-wider">{t('finances.balance')}</span>
            </div>
            <h4 className="text-3xl font-black text-neutral-900 dark:text-white line-clamp-1">{formatCurrency(balance)}</h4>
          </div>
        </div>

        {/* Transactions Section */}
        <div className="card overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-6 border-b border-neutral-100 dark:border-neutral-800 gap-4 print:hidden">
            <h5 className="font-bold flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-dia-red animate-pulse" />
              {viewMode === 'trash' ? t('finances.audit_archives') : t('finances.transaction_history')}
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
                  {type === 'all' ? t('common.all') : type === 'income' ? t('finances.income') : t('finances.expense')}
                </button>
              ))}
            </div>
          </div>
          <TransactionTable 
            records={viewMode === 'trash' ? (trashFinances || []) : (sortedRecords || [])} 
            onSort={viewMode === 'trash' ? undefined : handleSort} 
            sortConfig={viewMode === 'trash' ? null : sortConfig} 
            onDelete={viewMode === 'trash' ? undefined : handleDeleteRecord}
            isTrash={viewMode === 'trash'}
          />
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-neutral-950 w-full max-w-md rounded-[40px] shadow-2xl overflow-hidden animate-in zoom-in slide-in-from-bottom-4 duration-300 border border-neutral-100 dark:border-neutral-800">
            <div className="p-8 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between bg-red-50/50 dark:bg-red-900/10">
              <h3 className="text-2xl font-black tracking-tight text-red-600 flex items-center gap-2">
                <Trash2 size={24} />
                {t('finances.justification')}
              </h3>
              <button onClick={() => setIsDeleteModalOpen(false)} className="p-2 hover:bg-neutral-200 dark:hover:bg-neutral-800 rounded-2xl transition-colors">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={confirmDelete} className="p-8 space-y-6">
              <div className="space-y-4">
                <p className="text-sm font-medium text-neutral-500">
                  {t('finances.justification_desc')}
                </p>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">{t('finances.justification_label')}</label>
                  <textarea 
                    name="reason" 
                    required 
                    value={deletionReason}
                    onChange={(e) => setDeletionReason(e.target.value)}
                    placeholder={t('finances.justification_placeholder')} 
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
                    t('finances.confirm_archive')
                  )}
                </button>
                <button type="button" onClick={() => setIsDeleteModalOpen(false)} className="w-full py-4 text-sm font-bold text-neutral-400 hover:text-neutral-600 transition-colors uppercase tracking-widest">{t('common.cancel')}</button>
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
              <h3 className="text-3xl font-black tracking-tight text-dia-red">{t('finances.transaction')}</h3>
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
                    <span className="text-xs font-bold uppercase">{t('finances.income')}</span>
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
                    <span className="text-xs font-bold uppercase">{t('finances.expense')}</span>
                  </label>
                </div>

                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">{t('common.amount')} (FCFA)</label>
                  <input name="amount" required type="number" placeholder="0" className="w-full px-6 py-4 bg-neutral-50 dark:bg-neutral-900 border-2 border-neutral-100 dark:border-neutral-800 rounded-3xl focus:ring-4 focus:ring-dia-red/10 focus:border-dia-red outline-none transition-all text-xl font-black" />
                </div>

                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">{t('common.description')}</label>
                  <input name="description" required type="text" placeholder={t('finances.description_placeholder')} className="w-full px-6 py-4 bg-neutral-50 dark:bg-neutral-900 border-2 border-neutral-100 dark:border-neutral-800 rounded-3xl focus:ring-4 focus:ring-dia-red/10 focus:border-dia-red outline-none transition-all font-bold" />
                </div>

                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">{t('common.category')}</label>
                  <select name="category" required className="w-full px-6 py-4 bg-neutral-50 dark:bg-neutral-900 border-2 border-neutral-100 dark:border-neutral-800 rounded-3xl focus:ring-4 focus:ring-dia-red/10 focus:border-dia-red outline-none transition-all font-bold appearance-none">
                    <option value="Tuition">{t('finances.categories.tuition')}</option>
                    <option value="Salary">{t('finances.categories.salary')}</option>
                    <option value="Rent">{t('finances.categories.rent')}</option>
                    <option value="Equipment">{t('finances.categories.equipment')}</option>
                    <option value="Taxes">{t('finances.categories.taxes')}</option>
                    <option value="Other">{t('finances.categories.other')}</option>
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
                      <span>{t('common.processing')}</span>
                    </>
                  ) : (
                    <>
                      <Plus size={22} />
                      <span>{t('finances.new_transaction') || t('finances.transaction')}</span>
                    </>
                  )}
                </button>
                <button type="button" onClick={() => setIsAddModalOpen(false)} className="w-full py-4 text-sm font-bold text-neutral-400 hover:text-neutral-600 transition-colors uppercase tracking-widest">{t('common.cancel')}</button>
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

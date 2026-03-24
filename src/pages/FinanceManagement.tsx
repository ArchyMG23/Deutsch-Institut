import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  ArrowUpRight, 
  ArrowDownRight,
  Plus,
  X,
  Download,
  Filter,
  Calendar
} from 'lucide-react';
import { cn, formatCurrency } from '../utils';
import { FinanceRecord, Teacher, Student, Level, ClassRoom } from '../types';
import { useAuth } from '../context/AuthContext';

export default function FinanceManagement() {
  const { fetchWithAuth } = useAuth();
  const [records, setRecords] = useState<FinanceRecord[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [levels, setLevels] = useState<Level[]>([]);
  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [recordsRes, teachersRes, studentsRes, levelsRes, classesRes] = await Promise.all([
        fetchWithAuth('/api/finances'),
        fetchWithAuth('/api/teachers'),
        fetchWithAuth('/api/students'),
        fetchWithAuth('/api/levels'),
        fetchWithAuth('/api/classes')
      ]);
      
      if (recordsRes.ok) setRecords(await recordsRes.json());
      if (teachersRes.ok) setTeachers(await teachersRes.json());
      if (studentsRes.ok) setStudents(await studentsRes.json());
      if (levelsRes.ok) setLevels(await levelsRes.json());
      if (classesRes.ok) setClasses(await classesRes.json());
    } catch (err) {
      console.error("Error fetching finance data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddRecord = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const newRecord = {
      type: formData.get('type'),
      amount: parseInt(formData.get('amount') as string),
      description: formData.get('description'),
      category: formData.get('category'),
    };

    try {
      const res = await fetchWithAuth('/api/finances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newRecord)
      });
      if (res.ok) {
        setIsAddModalOpen(false);
        fetchData();
      }
    } catch (err) {
      console.error("Error adding finance record:", err);
    }
  };

  const totalIncome = records.filter(r => r.type === 'income').reduce((acc, r) => acc + r.amount, 0);
  const totalExpense = records.filter(r => r.type === 'expense').reduce((acc, r) => acc + r.amount, 0);
  const balance = totalIncome - totalExpense;

  const filteredRecords = records.filter(r => filterType === 'all' || r.type === filterType);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h3 className="text-xl font-bold">Gestion Financière</h3>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setIsAddModalOpen(true)}
            className="btn-primary flex items-center gap-2"
          >
            <Plus size={18} />
            <span>Nouvelle Transaction</span>
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card p-6 bg-green-50 dark:bg-green-900/10 border-green-100 dark:border-green-900/20">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-xl bg-green-100 dark:bg-green-900/20 text-green-600 flex items-center justify-center">
              <TrendingUp size={20} />
            </div>
            <span className="text-[10px] font-bold text-green-600 uppercase tracking-wider">Revenus Totaux</span>
          </div>
          <h4 className="text-2xl font-black text-green-700 dark:text-green-400">{formatCurrency(totalIncome)}</h4>
        </div>

        <div className="card p-6 bg-red-50 dark:bg-red-900/10 border-red-100 dark:border-red-900/20">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/20 text-red-600 flex items-center justify-center">
              <TrendingDown size={20} />
            </div>
            <span className="text-[10px] font-bold text-red-600 uppercase tracking-wider">Dépenses Totales</span>
          </div>
          <h4 className="text-2xl font-black text-red-700 dark:text-red-400">{formatCurrency(totalExpense)}</h4>
        </div>

        <div className="card p-6 bg-dia-red/5 dark:bg-dia-red/10 border-dia-red/10">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-xl bg-dia-red/10 text-dia-red flex items-center justify-center">
              <Wallet size={20} />
            </div>
            <span className="text-[10px] font-bold text-dia-red uppercase tracking-wider">Solde Actuel</span>
          </div>
          <h4 className="text-2xl font-black text-dia-red">{formatCurrency(balance)}</h4>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setFilterType('all')}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-bold transition-all",
              filterType === 'all' ? "bg-dia-red text-white" : "bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200"
            )}
          >
            Tout
          </button>
          <button 
            onClick={() => setFilterType('income')}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-bold transition-all",
              filterType === 'income' ? "bg-green-600 text-white" : "bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200"
            )}
          >
            Revenus
          </button>
          <button 
            onClick={() => setFilterType('expense')}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-bold transition-all",
              filterType === 'expense' ? "bg-red-600 text-white" : "bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200"
            )}
          >
            Dépenses
          </button>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-neutral-100 dark:bg-neutral-800 rounded-lg text-sm font-bold hover:bg-neutral-200 transition-colors">
          <Download size={16} />
          <span>Exporter Rapport</span>
        </button>
      </div>

      {/* Transactions Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-neutral-50 dark:bg-neutral-800/50 border-b border-neutral-200 dark:border-neutral-800">
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-neutral-500">Date</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-neutral-500">Description</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-neutral-500">Catégorie</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-neutral-500 text-right">Montant</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {filteredRecords.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((record) => (
                <tr key={record.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors">
                  <td className="px-6 py-4 text-sm font-medium">
                    {new Date(record.date).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center",
                        record.type === 'income' ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600"
                      )}>
                        {record.type === 'income' ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
                      </div>
                      <span className="text-sm font-bold">{record.description}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-[10px] font-bold uppercase px-2 py-1 bg-neutral-100 dark:bg-neutral-800 rounded-full text-neutral-500">
                      {record.category}
                    </span>
                  </td>
                  <td className={cn(
                    "px-6 py-4 text-right font-black",
                    record.type === 'income' ? "text-green-600" : "text-red-600"
                  )}>
                    {record.type === 'income' ? '+' : '-'}{formatCurrency(record.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Record Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-neutral-900 w-full max-w-md rounded-[32px] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-8 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
              <h3 className="text-2xl font-bold tracking-tight">Nouvelle Transaction</h3>
              <button onClick={() => setIsAddModalOpen(false)} className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition-colors">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleAddRecord} className="p-8 space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">Type</label>
                  <select name="type" required className="w-full px-5 py-3 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-2xl focus:ring-2 focus:ring-dia-red/20 focus:border-dia-red outline-none transition-all">
                    <option value="income">Revenu (Entrée)</option>
                    <option value="expense">Dépense (Sortie)</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">Montant (FCFA)</label>
                  <input name="amount" required type="number" className="w-full px-5 py-3 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-2xl focus:ring-2 focus:ring-dia-red/20 focus:border-dia-red outline-none transition-all" />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">Description</label>
                  <input name="description" required type="text" className="w-full px-5 py-3 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-2xl focus:ring-2 focus:ring-dia-red/20 focus:border-dia-red outline-none transition-all" />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">Catégorie</label>
                  <select name="category" required className="w-full px-5 py-3 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-2xl focus:ring-2 focus:ring-dia-red/20 focus:border-dia-red outline-none transition-all">
                    <option value="Tuition">Scolarité</option>
                    <option value="Salary">Salaire</option>
                    <option value="Rent">Loyer</option>
                    <option value="Equipment">Équipement</option>
                    <option value="Other">Autre</option>
                  </select>
                </div>
              </div>
              <div className="pt-4 flex gap-4">
                <button type="button" onClick={() => setIsAddModalOpen(false)} className="flex-1 px-6 py-4 bg-neutral-100 dark:bg-neutral-800 rounded-2xl font-bold transition-all hover:bg-neutral-200">Annuler</button>
                <button type="submit" className="flex-1 btn-primary py-4">Enregistrer</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

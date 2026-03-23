import React, { useState, useEffect } from 'react';
import { 
  Users, 
  GraduationCap, 
  TrendingUp, 
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import { 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { cn, formatCurrency } from '../utils';
import { Student, Teacher, FinanceRecord } from '../types';

export default function AdminDashboard() {
  const [students, setStudents] = useState<Student[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [finances, setFinances] = useState<FinanceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [sRes, tRes, fRes] = await Promise.all([
          fetch('/api/students'),
          fetch('/api/teachers'),
          fetch('/api/finances')
        ]);
        if (sRes.ok) setStudents(await sRes.json());
        if (tRes.ok) setTeachers(await tRes.json());
        if (fRes.ok) setFinances(await fRes.json());
      } catch (err) {
        console.error("Error fetching dashboard data:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const totalIncome = finances
    .filter(f => f.type === 'income')
    .reduce((acc, curr) => acc + curr.amount, 0);
  
  const totalExpense = finances
    .filter(f => f.type === 'expense')
    .reduce((acc, curr) => acc + curr.amount, 0);

  // Simple monthly data for chart (mocking for now based on real total)
  const chartData = [
    { name: 'Jan', income: 0, expense: 0 },
    { name: 'Fév', income: 0, expense: 0 },
    { name: 'Mar', income: totalIncome, expense: totalExpense },
  ];

  const recentTransactions = [...finances]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-dia-red"></div></div>;

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Total Étudiants" 
          value={students.length.toString()} 
          icon={Users} 
          trend="+100%" 
          trendType="up"
        />
        <StatCard 
          title="Enseignants" 
          value={teachers.length.toString()} 
          icon={GraduationCap} 
          trend="+100%" 
          trendType="up"
        />
        <StatCard 
          title="Revenus Totaux" 
          value={formatCurrency(totalIncome)} 
          icon={TrendingUp} 
          trend="+100%" 
          trendType="up"
        />
        <StatCard 
          title="Dépenses Totales" 
          value={formatCurrency(totalExpense)} 
          icon={TrendingDown} 
          trend="+100%" 
          trendType="down"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Financial Chart */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-lg">Flux Financier</h3>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#FF0000" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#FF0000" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e5e5" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} tickFormatter={(value) => `${value/1000}k`} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Area type="monotone" dataKey="income" stroke="#FF0000" fillOpacity={1} fill="url(#colorIncome)" strokeWidth={2} />
                <Area type="monotone" dataKey="expense" stroke="#FFCE00" fillOpacity={0} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-lg">Transactions Récentes</h3>
          </div>
          <div className="space-y-4">
            {recentTransactions.length === 0 ? (
              <p className="text-center text-neutral-500 py-10">Aucune transaction.</p>
            ) : (
              recentTransactions.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center",
                      item.type === 'income' ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600"
                    )}>
                      {item.type === 'income' ? <ArrowUpRight size={20} /> : <ArrowDownRight size={20} />}
                    </div>
                    <div>
                      <p className="font-medium text-sm">{item.description}</p>
                      <p className="text-xs text-neutral-500">{new Date(item.date).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <p className={cn(
                    "font-bold",
                    item.type === 'income' ? "text-green-600" : "text-red-600"
                  )}>
                    {item.type === 'income' ? '+' : '-'}{formatCurrency(item.amount)}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, trend, trendType }: any) {
  return (
    <div className="card p-6">
      <div className="flex items-start justify-between">
        <div className="w-12 h-12 bg-neutral-100 dark:bg-neutral-800 rounded-xl flex items-center justify-center text-dia-red">
          <Icon size={24} />
        </div>
        <div className={cn(
          "flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full",
          trendType === 'up' ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600"
        )}>
          {trend}
        </div>
      </div>
      <div className="mt-4">
        <p className="text-sm text-neutral-500 dark:text-neutral-400 font-medium">{title}</p>
        <h4 className="text-2xl font-bold mt-1">{value}</h4>
      </div>
    </div>
  );
}

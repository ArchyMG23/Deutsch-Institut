import React from 'react';
import { 
  TrendingUp, TrendingDown, Wallet, Landmark, LayoutDashboard, 
  ArrowUpRight, ArrowDownRight, Package, Users, Receipt, Calendar,
  BarChart3, PieChart
} from 'lucide-react';
import { motion } from 'motion/react';
import { useData } from '../../context/DataContext';
import { cn, formatCurrency } from '../../utils';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, BarChart, Bar, Cell, PieChart as RePieChart, Pie 
} from 'recharts';

const StatCard = ({ title, value, icon: Icon, color, subtitle, trend }: any) => (
  <motion.div 
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="bg-white dark:bg-neutral-900 p-8 rounded-[2.5rem] border border-neutral-100 dark:border-neutral-800 shadow-sm relative overflow-hidden group"
  >
    <div className={cn("absolute top-0 right-0 w-32 h-32 -mr-16 -mt-16 rounded-full opacity-[0.03] transition-transform duration-700 group-hover:scale-150", color)} />
    <div className="flex items-start justify-between mb-6">
      <div className={cn("p-4 rounded-2xl shadow-lg shadow-current/10", color.replace('bg-', 'text-').replace('-600', '-500').replace('text-', 'bg-').replace('500', '100').replace('600', '100'))}>
        <Icon size={28} className={color.replace('bg-', 'text-')} />
      </div>
      {trend && (
        <div className={cn("flex items-center gap-1 text-[10px] font-black uppercase px-3 py-1 rounded-full", trend > 0 ? "bg-emerald-50 text-emerald-600" : "bg-dia-red/10 text-dia-red")}>
           {trend > 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
           {Math.abs(trend)}%
        </div>
      )}
    </div>
    <div className="relative z-10">
      <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-1">{title}</p>
      <h3 className="text-3xl font-black text-neutral-900 dark:text-white tabular-nums tracking-tight">
        {typeof value === 'number' ? formatCurrency(value) : value}
      </h3>
      {subtitle && <p className="text-[10px] font-bold text-neutral-500 mt-2 uppercase flex items-center gap-1.5 opacity-60">
        <div className={cn("w-1.5 h-1.5 rounded-full", color)} />
        {subtitle}
      </p>}
    </div>
  </motion.div>
);

export default function FinanceOverview() {
  const { financeStats, caisseSolde, banqueSolde, finances } = useData();

  const chartData = useMemo(() => {
    return financeStats.monthlyHistory || [];
  }, [financeStats]);

  const COLORS = ['#e11d48', '#2563eb', '#10b981', '#f59e0b'];

  const distribution = [
    { name: 'Caisse', value: caisseSolde },
    { name: 'Banque', value: banqueSolde }
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
        <div className="flex items-center gap-5">
           <div className="p-5 bg-neutral-900 text-white rounded-[1.8rem] shadow-2xl shadow-neutral-950/20">
              <LayoutDashboard size={36} />
           </div>
           <div>
              <h1 className="text-4xl font-black text-neutral-900 dark:text-white uppercase tracking-tighter">Analyse Financière</h1>
              <p className="text-neutral-500 font-bold uppercase text-xs tracking-widest">Tableau de bord Deutsch Institut</p>
           </div>
        </div>
        <div className="bg-white dark:bg-neutral-900 px-6 py-4 rounded-2xl border border-neutral-100 dark:border-neutral-800 shadow-sm flex items-center gap-3">
           <Calendar size={18} className="text-dia-red" />
           <span className="font-black uppercase text-xs">Année Académique {new Date().getFullYear()}</span>
        </div>
      </div>

      {/* Main Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Solde Caisse" 
          value={caisseSolde} 
          icon={Wallet} 
          color="bg-dia-red" 
          subtitle="Argent disponible sur place"
          trend={+12}
        />
        <StatCard 
          title="Solde Banque" 
          value={banqueSolde} 
          icon={Landmark} 
          color="bg-blue-600" 
          subtitle="Fonds sécurisés"
          trend={+5}
        />
        <StatCard 
          title="Entrées de l'Année" 
          value={financeStats.yearIncome} 
          icon={TrendingUp} 
          color="bg-emerald-600" 
          subtitle="Revenu brut cumulé"
        />
        <StatCard 
          title="Sorties de l'Année" 
          value={financeStats.yearExpense} 
          icon={TrendingDown} 
          color="bg-amber-600" 
          subtitle="Charges et salaires"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
         {/* Evolutionary Chart */}
         <div className="lg:col-span-2 bg-white dark:bg-neutral-900 p-10 rounded-[3rem] border border-neutral-100 dark:border-neutral-800 shadow-sm space-y-8">
            <div className="flex items-center justify-between">
               <h3 className="text-2xl font-black text-neutral-900 dark:text-white uppercase tracking-tight flex items-center gap-3">
                  <BarChart3 size={24} className="text-dia-red" />
                  Performance Mensuelle
               </h3>
               <div className="flex items-center gap-4 text-[10px] font-black uppercase">
                  <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-emerald-500" /> Entrées</div>
                  <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-dia-red" /> Sorties</div>
               </div>
            </div>
            <div className="h-[400px]">
               <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                     <defs>
                        <linearGradient id="colorInc" x1="0" y1="0" x2="0" y2="1">
                           <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                           <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorExp" x1="0" y1="0" x2="0" y2="1">
                           <stop offset="5%" stopColor="#e11d48" stopOpacity={0.1}/>
                           <stop offset="95%" stopColor="#e11d48" stopOpacity={0}/>
                        </linearGradient>
                     </defs>
                     <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                     <XAxis 
                       dataKey="month" 
                       axisLine={false} 
                       tickLine={false} 
                       tick={{ fontSize: 10, fontWeight: 900, textTransform: 'uppercase', fill: '#a3a3a3' }}
                       dy={10}
                     />
                     <YAxis hide />
                     <Tooltip 
                        contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 40px rgba(0,0,0,0.1)', fontWeight: 800, fontSize: '12px' }}
                        cursor={{ stroke: '#f0f0f0', strokeWidth: 2 }}
                     />
                     <Area type="monotone" dataKey="income" stroke="#10b981" strokeWidth={4} fillOpacity={1} fill="url(#colorInc)" />
                     <Area type="monotone" dataKey="expense" stroke="#e11d48" strokeWidth={4} fillOpacity={1} fill="url(#colorExp)" />
                  </AreaChart>
               </ResponsiveContainer>
            </div>
         </div>

         {/* Distribution & Recent */}
         <div className="space-y-8">
            <div className="bg-neutral-900 p-10 rounded-[3rem] text-white space-y-8 relative overflow-hidden">
               <div className="absolute bottom-0 right-0 w-64 h-64 bg-dia-red/10 blur-[100px] -mb-32 -mr-32" />
               <h3 className="text-xl font-black uppercase tracking-tight flex items-center gap-3 relative z-10">
                  <PieChart size={24} className="text-dia-red" />
                  Répartition
               </h3>
               <div className="h-[200px] relative z-10">
                  <ResponsiveContainer width="100%" height="100%">
                     <RePieChart>
                        <Pie
                           data={distribution}
                           cx="50%"
                           cy="50%"
                           innerRadius={60}
                           outerRadius={80}
                           paddingAngle={8}
                           dataKey="value"
                        >
                           {distribution.map((_, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="rgba(0,0,0,0)" />
                           ))}
                        </Pie>
                     </RePieChart>
                  </ResponsiveContainer>
               </div>
               <div className="space-y-4 relative z-10">
                  {distribution.map((item, index) => (
                     <div key={item.name} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                           <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[index] }} />
                           <span className="text-xs font-black uppercase text-white/60">{item.name}</span>
                        </div>
                        <span className="text-sm font-black tabular-nums">{formatCurrency(item.value)}</span>
                     </div>
                  ))}
               </div>
            </div>

            <div className="bg-white dark:bg-neutral-900 p-8 rounded-[3rem] border border-neutral-100 dark:border-neutral-800 shadow-sm space-y-6">
               <h3 className="text-sm font-black uppercase text-neutral-400 tracking-widest flex items-center justify-between">
                  Dernières Activités
                  <Receipt size={16} />
               </h3>
               <div className="space-y-4">
                  {(finances || []).slice(0, 4).map((f) => (
                     <div key={f.id} className="flex items-center justify-between p-4 bg-neutral-50 dark:bg-neutral-800/50 rounded-2xl border border-neutral-100 dark:border-neutral-800">
                        <div className="space-y-1">
                           <p className="text-[10px] font-black uppercase text-neutral-900 dark:text-white truncate max-w-[150px]">{f.libelle}</p>
                           <p className="text-[8px] font-bold text-neutral-400 uppercase tabular-nums">{new Date(f.date_versement || f.createdAt).toLocaleDateString()}</p>
                        </div>
                        <p className={cn("text-xs font-black tabular-nums", (f.montant || 0) < 0 ? "text-dia-red" : "text-emerald-600")}>
                           {formatCurrency(Math.abs(f.montant || 0))}
                        </p>
                     </div>
                  ))}
               </div>
            </div>
         </div>
      </div>
    </div>
  );
}

import { useMemo } from 'react';

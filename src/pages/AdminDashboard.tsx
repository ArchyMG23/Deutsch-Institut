import React, { useState, useEffect } from 'react';
import { 
  Users, 
  GraduationCap, 
  TrendingUp, 
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  AlertTriangle,
  CheckCircle2,
  Settings,
  ShieldAlert,
  ExternalLink
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
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';

export default function AdminDashboard() {
  const { students, teachers, finances, loading, refreshAll } = useData();
  const { fetchWithAuth } = useAuth();
  const [configStatus, setConfigStatus] = useState<any>(null);
  const [testingEmail, setTestingEmail] = useState(false);

  useEffect(() => {
    refreshAll();
    checkConfig();
  }, [refreshAll]);

  const checkConfig = async () => {
    try {
      const res = await fetchWithAuth('/api/health/config');
      if (res.ok) {
        const data = await res.json();
        setConfigStatus(data);
      }
    } catch (err) {
      console.error("Error checking config:", err);
    }
  };

  const handleTestEmail = async () => {
    setTestingEmail(true);
    try {
      const res = await fetchWithAuth('/api/health/test-email', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message);
      } else {
        toast.error(data.message);
      }
    } catch (err) {
      toast.error("Erreur lors du test de l'email.");
    } finally {
      setTestingEmail(false);
    }
  };

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

      {/* Configuration Assistant */}
      {configStatus && (
        <div className={cn(
          "card p-6 border-l-4",
          (configStatus.firebaseServiceAccountMissing || configStatus.smtpPassMissing) 
            ? "border-l-amber-500 bg-amber-50/30 dark:bg-amber-950/10" 
            : "border-l-green-500 bg-green-50/30 dark:bg-green-950/10"
        )}>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4">
              <div className={cn(
                "w-12 h-12 rounded-2xl flex items-center justify-center",
                (configStatus.firebaseServiceAccountMissing || configStatus.smtpPassMissing) ? "bg-amber-100 text-amber-600" : "bg-green-100 text-green-600"
              )}>
                { (configStatus.firebaseServiceAccountMissing || configStatus.smtpPassMissing) ? <ShieldAlert size={24} /> : <CheckCircle2 size={24} /> }
              </div>
              <div>
                <h3 className="font-bold text-lg">Assistant de Configuration</h3>
                <p className="text-sm text-neutral-500">Vérifiez l'état de vos services backend.</p>
              </div>
            </div>
            <a 
              href="https://console.firebase.google.com/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm font-bold text-dia-red hover:underline"
            >
              Console Firebase <ExternalLink size={14} />
            </a>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
            <div className="p-4 rounded-2xl bg-white dark:bg-neutral-800 border border-neutral-100 dark:border-neutral-700">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">Automatisation (Firebase Admin)</span>
                {configStatus.firebaseAdmin ? <CheckCircle2 size={16} className="text-green-500" /> : <AlertTriangle size={16} className="text-amber-500" />}
              </div>
              <p className="text-sm">
                {configStatus.firebaseAdmin 
                  ? "Opérationnel. Les comptes sont créés automatiquement." 
                  : "Désactivé. Ajoutez le secret FIREBASE_SERVICE_ACCOUNT pour automatiser la création des comptes."}
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-white dark:bg-neutral-800 border border-neutral-100 dark:border-neutral-700">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">Emails (SMTP)</span>
                {configStatus.smtp ? <CheckCircle2 size={16} className="text-green-500" /> : <AlertTriangle size={16} className="text-amber-500" />}
              </div>
              <p className="text-sm">
                {configStatus.smtp 
                  ? "Opérationnel. Les emails sont envoyés aux utilisateurs." 
                  : (configStatus.smtpConfigured 
                      ? "Erreur de connexion SMTP. Le mot de passe d'application est probablement invalide ou bloqué." 
                      : "Simulation. Ajoutez SMTP_PASS (Mot de passe d'application Google) pour envoyer de vrais emails.")
                }
              </p>
              {configStatus.smtpConfigured && (
                <button 
                  onClick={handleTestEmail}
                  disabled={testingEmail}
                  className="mt-3 text-xs font-bold text-dia-red hover:underline flex items-center gap-1 disabled:opacity-50"
                >
                  {testingEmail ? "Envoi du test..." : "Tester l'envoi d'email ❯"}
                </button>
              )}
            </div>
          </div>
          
          {!configStatus.firebaseAdmin && (
            <div className="mt-4 p-4 bg-dia-red/5 rounded-xl border border-dia-red/10">
              <p className="text-xs text-dia-red leading-relaxed">
                <strong>Important :</strong> Pour que les élèves se connectent directement, assurez-vous également que la méthode <strong>"Email / Mot de passe"</strong> est bien <strong>activée</strong> dans l'onglet Authentication de votre console Firebase.
              </p>
            </div>
          )}
        </div>
      )}

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

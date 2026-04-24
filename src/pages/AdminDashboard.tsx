import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
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
  ExternalLink,
  Laptop,
  Smartphone,
  Globe,
  FileText
} from 'lucide-react';
import { Link } from 'react-router-dom';
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
  const { students, teachers, finances, evaluations, loading, refreshStudents, refreshTeachers, refreshFinances, refreshEvaluations } = useData();
  const { fetchWithAuth } = useAuth();
  const { t } = useTranslation();
  const [configStatus, setConfigStatus] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [testingEmail, setTestingEmail] = useState(false);
  const [diagMatricule, setDiagMatricule] = useState('');
  const [diagResult, setDiagResult] = useState<any>(null);
  const [checkingDiag, setCheckingDiag] = useState(false);
  
  useEffect(() => {
    refreshStudents();
    refreshTeachers();
    refreshFinances();
    refreshEvaluations();
    checkConfig();
    fetchLogs();
  }, [refreshStudents, refreshTeachers, refreshFinances, refreshEvaluations]);

  const fetchLogs = async () => {
    try {
      const res = await fetchWithAuth('/api/admin/logs');
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs);
      }
    } catch (err) {
      console.error("Error fetching logs:", err);
    }
  };

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
      toast.error(t('dashboard.email_test_error'));
    } finally {
      setTestingEmail(false);
    }
  };

  const handleCheckUser = async () => {
    if (!diagMatricule) return;
    setCheckingDiag(true);
    setDiagResult(null);
    try {
      const res = await fetchWithAuth('/api/admin/check-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matricule: diagMatricule })
      });
      const data = await res.json();
      setDiagResult(data);
    } catch (err) {
      toast.error(t('dashboard.diag_error'));
    } finally {
      setCheckingDiag(false);
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

  const onlineMembers = [
    ...students.filter(s => s.status === 'online'),
    ...teachers.filter(t => t.status === 'online')
  ];

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-dia-red"></div></div>;

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
        <StatCard 
          title={t('dashboard.total_students')}
          value={students.length.toString()} 
          icon={Users} 
          trend="+100%" 
          trendType="up"
        />
        <StatCard 
          title={t('sidebar.teachers')} 
          value={teachers.length.toString()} 
          icon={GraduationCap} 
          trend="+100%" 
          trendType="up"
        />
        <StatCard 
          title={t('sidebar.evaluations')} 
          value={evaluations.length.toString()} 
          icon={FileText} 
          trend="Goethe" 
          trendType="up"
        />
        <StatCard 
          title={t('dashboard.revenue')} 
          value={formatCurrency(totalIncome)} 
          icon={TrendingUp} 
          trend="+100%" 
          trendType="up"
        />
        <StatCard 
          title={t('dashboard.expenses')} 
          value={formatCurrency(totalExpense)} 
          icon={TrendingDown} 
          trend="+100%" 
          trendType="down"
        />
      </div>

      {/* Online Members & Devices */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-lg">{t('dashboard.online_members')}</h3>
            <span className="flex h-2 w-2 rounded-full bg-green-500 animate-pulse"></span>
            <span className="text-xs font-bold text-green-600">{onlineMembers.length} {t('common.online')}</span>
          </div>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 overflow-y-auto">
          {onlineMembers.length === 0 ? (
            <div className="col-span-full py-10 text-center bg-neutral-50 dark:bg-neutral-800/20 rounded-3xl border border-dashed border-neutral-200 dark:border-neutral-700">
              <p className="text-neutral-500 text-sm font-medium">{t('dashboard.no_members_online')}</p>
            </div>
          ) : (
            onlineMembers.map((member) => (
              <div key={member.uid} className="p-4 rounded-2xl bg-white dark:bg-neutral-800 border border-neutral-100 dark:border-neutral-700 flex items-center justify-between group">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-dia-red/10 text-dia-red flex items-center justify-center font-bold text-xs">
                    {member.firstName[0]}{member.lastName[0]}
                  </div>
                  <div>
                    <p className="text-sm font-bold truncate max-w-[100px]">{member.firstName} {member.lastName}</p>
                    <p className="text-[10px] text-neutral-400 capitalize">{member.role}</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-1 justify-end text-dia-red">
                    {member.lastActiveDevice?.toLowerCase().includes('android') || member.lastActiveDevice?.toLowerCase().includes('ios') ? <Smartphone size={12} /> : <Laptop size={12} />}
                    <span className="text-[10px] font-bold truncate max-w-[60px]">{member.lastActiveDevice || t('common.unknown')}</span>
                  </div>
                  <p className="text-[9px] text-neutral-400">{member.lastLoginAt ? new Date(member.lastLoginAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : t('common.recently')}</p>
                </div>
              </div>
            ))
          )}
        </div>
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
                <h3 className="font-bold text-lg">{t('dashboard.config_assistant')}</h3>
                <p className="text-sm text-neutral-500">{t('dashboard.check_backend_status')}</p>
              </div>
            </div>
            <a 
              href="https://console.firebase.google.com/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm font-bold text-dia-red hover:underline"
            >
              {t('dashboard.firebase_console')} <ExternalLink size={14} />
            </a>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
            <div className="p-4 rounded-2xl bg-white dark:bg-neutral-800 border border-neutral-100 dark:border-neutral-700">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">{t('dashboard.automation')} (Firebase Admin)</span>
                {configStatus.firebaseAdmin ? <CheckCircle2 size={16} className="text-green-500" /> : <AlertTriangle size={16} className="text-amber-500" />}
              </div>
              <p className="text-sm">
                {configStatus.firebaseAdmin 
                  ? t('dashboard.firebase_admin_ok') 
                  : t('dashboard.firebase_admin_missing')}
              </p>
              {configStatus.firebaseAdmin && (
                <div className="mt-3 pt-3 border-t border-neutral-100 dark:border-neutral-700 space-y-1">
                  <p className="text-[10px] text-neutral-500 uppercase font-bold">{t('dashboard.project_verification')}</p>
                  <p className="text-xs flex items-center justify-between">
                    <span>{t('dashboard.client_config')} :</span>
                    <span className="font-mono font-bold text-dia-red">{configStatus.configProjectId}</span>
                  </p>
                  <p className="text-xs flex items-center justify-between">
                    <span>{t('dashboard.admin_secret')} :</span>
                    <span className={cn(
                      "font-mono font-bold",
                      configStatus.configProjectId === configStatus.serviceAccountProjectId ? "text-green-500" : "text-dia-red"
                    )}>
                      {configStatus.serviceAccountProjectId}
                    </span>
                  </p>
                  {configStatus.configProjectId !== configStatus.serviceAccountProjectId && (
                    <p className="text-[10px] text-dia-red font-bold animate-pulse mt-1">
                      ⚠️ {t('dashboard.mismatch_error')}
                    </p>
                  )}
                </div>
              )}
            </div>
            <div className="p-4 rounded-2xl bg-white dark:bg-neutral-800 border border-neutral-100 dark:border-neutral-700">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">{t('dashboard.emails')} (SMTP)</span>
                {configStatus.smtp ? <CheckCircle2 size={16} className="text-green-500" /> : <AlertTriangle size={16} className="text-amber-500" />}
              </div>
              <p className="text-sm">
                {configStatus.smtp 
                  ? t('dashboard.smtp_ok') 
                  : (configStatus.smtpConfigured 
                      ? t('dashboard.smtp_error') 
                      : t('dashboard.smtp_missing'))
                }
              </p>
              {configStatus.smtpError && !configStatus.smtp && (
                <div className="mt-2 p-2 bg-red-50 dark:bg-red-950/20 rounded border border-red-100 dark:border-red-900/30">
                  <p className="text-[10px] uppercase font-bold text-red-500 mb-1">{t('dashboard.raw_error')} :</p>
                  <p className="text-xs font-mono break-all text-red-600 dark:text-red-400 mb-2">{configStatus.smtpError}</p>
                  {configStatus.smtpError.includes('ENETUNREACH') && (
                    <p className="text-[10px] text-amber-600 font-bold leading-tight">
                      ℹ️ {t('dashboard.ipv6_note')}
                    </p>
                  )}
                </div>
              )}
              {configStatus.smtpConfigured && (
                <button 
                  onClick={handleTestEmail}
                  disabled={testingEmail}
                  className="mt-3 text-xs font-bold text-dia-red hover:underline flex items-center gap-1 disabled:opacity-50"
                >
                  {testingEmail ? t('dashboard.sending_test') : `${t('dashboard.test_email_btn')} ❯`}
                </button>
              )}
            </div>
          </div>
          
          {!configStatus.firebaseAdmin && (
            <div className="mt-4 p-4 bg-dia-red/5 rounded-xl border border-dia-red/10">
              <p className="text-xs text-dia-red leading-relaxed">
                <strong>{t('common.important')} :</strong> {t('dashboard.auth_note')}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Diagnostics & Logs Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 card p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-lg">{t('dashboard.server_logs')}</h3>
            <button 
              onClick={fetchLogs}
              className="text-xs font-bold text-dia-red flex items-center gap-1 hover:underline"
            >
              {t('common.refresh')} ❯
            </button>
          </div>
          <div className="space-y-3 max-h-80 overflow-y-auto pr-2">
            {logs.length === 0 ? (
              <p className="text-center text-neutral-500 py-10">{t('common.no_results')}</p>
            ) : (
              [...logs].reverse().slice(0, 10).map((log, idx) => (
                <div key={idx} className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-100 dark:border-neutral-800">
                  <div className="flex items-center justify-between mb-1">
                    <span className={cn(
                      "text-[10px] font-bold px-2 py-0.5 rounded-full uppercase",
                      log.type === 'ERROR' ? "bg-red-100 text-red-600" : 
                      log.type === 'EMAIL' ? "bg-blue-100 text-blue-600" :
                      log.type === 'AUTH' ? "bg-purple-100 text-purple-600" :
                      "bg-green-100 text-green-600"
                    )}>
                      {log.type}
                    </span>
                    <span className="text-[10px] text-neutral-400 font-mono">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="text-sm font-medium">{log.message}</p>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="card p-6">
          <h4 className="font-bold text-sm mb-4">{t('dashboard.credentials_checker')}</h4>
          <div className="space-y-4">
            <div>
              <label className="text-[10px] font-bold uppercase text-neutral-400 ml-1">{t('dashboard.matricule_test')}</label>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={diagMatricule}
                  onChange={(e) => setDiagMatricule(e.target.value)}
                  placeholder="Ex: S261234"
                  className="flex-1 px-3 py-2 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-dia-red/20"
                />
                <button 
                  onClick={handleCheckUser}
                  disabled={checkingDiag}
                  className="px-4 py-2 bg-dia-red text-white text-xs font-bold rounded-xl disabled:opacity-50"
                >
                  {t('dashboard.verify')}
                </button>
              </div>
            </div>

            {diagResult && (
              <div className="p-3 bg-neutral-50 dark:bg-neutral-800 rounded-2xl border border-neutral-100 dark:border-neutral-700 animate-in fade-in zoom-in-95">
                {diagResult.exists ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-green-500 text-xs font-bold mb-1">
                      <CheckCircle2 size={14} /> {t('common.found')}
                    </div>
                    <p className="text-xs"><strong>{t('common.name')} :</strong> {diagResult.user.firstName} {diagResult.user.lastName}</p>
                    <p className="text-[10px]"><strong>Email :</strong> {diagResult.user.email}</p>
                    <p className="text-[10px]"><strong>Role :</strong> <span className="capitalize">{diagResult.user.role}</span></p>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-dia-red text-xs font-bold">
                    <AlertTriangle size={14} /> {diagResult.message}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Financial Chart */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-lg">{t('dashboard.financial_flow')}</h3>
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
            <h3 className="font-bold text-lg">{t('dashboard.recent_transactions')}</h3>
          </div>
          <div className="space-y-4">
            {recentTransactions.length === 0 ? (
              <p className="text-center text-neutral-500 py-10">{t('common.no_results')}</p>
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

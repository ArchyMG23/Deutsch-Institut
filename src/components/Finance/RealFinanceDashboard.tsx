import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Calendar, 
  PieChart, 
  ArrowUpRight, 
  ArrowDownRight,
  Activity,
  Filter,
  Clock
} from 'lucide-react';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  collectionGroup 
} from 'firebase/firestore';
import { db, auth } from '../../firebase';
import { formatCurrency } from '../../utils';
import { Charge, Session, Versement, DailyReport } from '../../types';
import { motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { generateWhatsAppLink, APP_NAME_FOR_LINKS } from '../../utils/contactLinks';
import { Smartphone, Share2 } from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell,
  LineChart,
  Line
} from 'recharts';

export default function RealFinanceDashboard() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    revenus: 0,
    chargesFixes: 0,
    chargesSalariales: 0,
    history: [] as any[],
    classQuotas: [] as any[],
    sessionDetails: [] as any[]
  });
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const fetchFinanceStats = async () => {
    setLoading(true);
    try {
      // 1. Aggreger les REVENUS (Versements scolarités)
      const versementsSnap = await getDocs(collectionGroup(db, 'versements'));
      const levelsSnap = await getDocs(collection(db, 'levels'));
      const classesSnap = await getDocs(collection(db, 'classes'));
      
      const levelsMap: Record<string, any> = {};
      levelsSnap.forEach(doc => levelsMap[doc.id] = doc.data());
      
      const classesMap: Record<string, any> = {};
      classesSnap.forEach(doc => classesMap[doc.id] = doc.data());

      let totalRevenu = 0;
      const monthlyRevenu: Record<string, number> = {};

      versementsSnap.forEach(doc => {
        const v = doc.data() as Versement;
        const date = new Date(v.date);
        if (date.getFullYear() === selectedYear) {
          totalRevenu += v.montant;
          const mKey = date.getMonth();
          monthlyRevenu[mKey] = (monthlyRevenu[mKey] || 0) + v.montant;
        }
      });

      // 2. Aggreger les CHARGES SALARIALES (Rapports soumis)
      const pathReports = 'rapports_journaliers';
      let reportsSnap;
      try {
        reportsSnap = await getDocs(query(collection(db, 'rapports_journaliers'), where('statut', '==', 'soumis')));
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, pathReports);
      }

      const pathTeachers = 'teachers';
      let teachersSnap;
      try {
        teachersSnap = await getDocs(collection(db, 'teachers'));
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, pathTeachers);
      }
      
      const teacherSettings: Record<string, { hourlyRate: number, minStudents?: number }> = {};
      teachersSnap.forEach(doc => {
        const t = doc.data();
        teacherSettings[doc.id] = {
          hourlyRate: t.hourlyRate || 3000,
          minStudents: t.minStudentsCondition
        };
      });

      let totalSalaires = 0;
      const monthlySalaries: Record<string, number> = {};
      const classHours: Record<string, number> = {};
      const sessionDetails: any[] = [];

      // Sort reports by date to calculate cumulative hours
      const sortedReports = reportsSnap.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as DailyReport))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      sortedReports.forEach(r => {
        const date = new Date(r.date);
        const cls = classesMap[r.classe_id];
        const level = cls ? levelsMap[cls.levelId] : null;
        const quota = level?.hours || 0;
        
        // Track hours per class
        classHours[r.classe_id] = (classHours[r.classe_id] || 0) + (r.duree_heures || 0);
        const currentTotal = classHours[r.classe_id];

        if (date.getFullYear() === selectedYear) {
          const settings = teacherSettings[r.enseignant_id];
          const rate = settings?.hourlyRate || 3000;
          const minRequired = settings?.minStudents || 0;
          const isConditionMet = r.presents >= minRequired;
          
          let status: 'ok' | 'insufficient' | 'excess' = 'ok';
          let remunerated = isConditionMet;

          // Quota Logic
          if (currentTotal > quota + 10) {
            status = 'excess';
            if (!r.valide_par_admin) remunerated = false;
          } else if (currentTotal < quota - 10) {
            // This is relative to the "end of level" status usually, 
            // but for a specific session we might just check if it's far from target
          }

          const salaire = remunerated ? (r.duree_heures || 0) * rate : 0;
          
          if (date.getMonth() === selectedMonth) {
            sessionDetails.push({
              ...r,
              teacherName: r.enseignant_nom,
              isConditionMet,
              minRequired,
              rate,
              salaire,
              remunerated,
              currentTotal,
              quota,
              status
            });
          }

          totalSalaires += salaire;
          const mKey = date.getMonth();
          monthlySalaries[mKey] = (monthlySalaries[mKey] || 0) + salaire;
        }
      });

      // Calculate Class Quota status for display
      const classQuotas = Object.entries(classHours).map(([classId, total]) => {
        const cls = classesMap[classId];
        const level = cls ? levelsMap[cls.levelId] : null;
        const quota = level?.hours || 0;
        const diff = total - quota;
        
        let quotaStatus: 'insuffisant' | 'ok' | 'depassement' = 'ok';
        if (total < quota - 10) quotaStatus = 'insuffisant';
        else if (total > quota + 10) quotaStatus = 'depassement';

        return {
          className: cls?.name || 'Inconnue',
          total,
          quota,
          diff,
          status: quotaStatus
        };
      });

      // 3. Aggregger les CHARGES FIXES (Manual charges)
      const pathCharges = 'charges';
      let chargesSnap;
      try {
        chargesSnap = await getDocs(collection(db, 'charges'));
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, pathCharges);
      }

      let totalChargesFixes = 0;
      const monthlyCharges: Record<string, number> = {};

      chargesSnap.forEach(doc => {
        const c = doc.data() as Charge;
        const date = new Date(c.date);
        if (date.getFullYear() === selectedYear) {
          totalChargesFixes += c.montant;
          const mKey = date.getMonth();
          monthlyCharges[mKey] = (monthlyCharges[mKey] || 0) + c.montant;
        }
      });

      // 4. Aggregger les TRANSACTIONS DU GRAND LIVRE (finances)
      const pathFinances = 'finances';
      let financesSnap;
      try {
        financesSnap = await getDocs(collection(db, 'finances'));
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, pathFinances);
      }

      financesSnap.forEach(doc => {
        const f = doc.data();
        if (!f.date) return;
        
        const date = new Date(f.date);
        if (date.getFullYear() === selectedYear) {
          const mKey = date.getMonth();
          const amount = Number(f.amount || 0);

          if (f.type === 'income') {
            if (f.category !== 'Tuition') {
              totalRevenu += amount;
              monthlyRevenu[mKey] = (monthlyRevenu[mKey] || 0) + amount;
            }
          } else {
            totalChargesFixes += amount;
            monthlyCharges[mKey] = (monthlyCharges[mKey] || 0) + amount;
          }
        }
      });

      // Formatter l'historique pour le graphique
      const history = Array.from({ length: 12 }, (_, i) => ({
        month: new Date(2000, i).toLocaleDateString('fr-FR', { month: 'short' }),
        revenus: monthlyRevenu[i] || 0,
        charges: (monthlySalaries[i] || 0) + (monthlyCharges[i] || 0),
        resultat: (monthlyRevenu[i] || 0) - ((monthlySalaries[i] || 0) + (monthlyCharges[i] || 0))
      }));

      setData({
        revenus: totalRevenu,
        chargesFixes: totalChargesFixes,
        chargesSalariales: totalSalaires,
        history,
        classQuotas,
        sessionDetails
      });
    } catch (err) {
      console.error("Erreur Dashboard Financier (Détails):", err);
    } finally {
      setLoading(false);
    }
  };

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email
    },
    operationType,
    path
  };
  console.error('Firestore Error Detailed: ', JSON.stringify(errInfo));
  // We throw a standardized error so the system can catch it if needed, or simple logging
  throw new Error(JSON.stringify(errInfo));
}

  useEffect(() => {
    fetchFinanceStats();
  }, [selectedYear]);

  const totalCharges = data.chargesFixes + data.chargesSalariales;
  const resultatNet = data.revenus - totalCharges;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-dia-red"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Date Filter */}
      <div className="flex items-center gap-4 bg-white dark:bg-neutral-900 p-4 rounded-2xl border border-neutral-100 dark:border-neutral-800">
        <Filter size={18} className="text-dia-red" />
        <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">Analyse de l'année</span>
        <select 
          value={selectedYear} 
          onChange={(e) => setSelectedYear(Number(e.target.value))}
          className="bg-neutral-100 dark:bg-neutral-800 px-4 py-2 rounded-xl text-sm font-bold outline-none"
        >
          {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <button onClick={fetchFinanceStats} className="ml-auto p-2 bg-dia-red/5 text-dia-red rounded-lg hover:bg-dia-red/10">
          <Activity size={18} />
        </button>
        <button 
          onClick={() => {
            const msg = `━━━━━━━━━━━━━━━━━━━━━━━\n💰 *BILAN FINANCIER*\n*${APP_NAME_FOR_LINKS}*\n━━━━━━━━━━━━━━━━━━━━━━━\n\n📅 *Période* : Année ${selectedYear}\n\n🟢 *Revenus* : ${formatCurrency(data.revenus)}\n🔴 *Charges* : ${formatCurrency(totalCharges)}\n\n💎 *RÉSULTAT NET* : *${formatCurrency(resultatNet)}*\n\nDocument généré le ${new Date().toLocaleDateString()}\n━━━━━━━━━━━━━━━━━━━━━━━`;
            const a = document.createElement('a');
            a.href = generateWhatsAppLink('', msg);
            a.target = '_blank';
            a.click();
          }}
          className="p-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition-colors"
          title="Partager via WhatsApp"
        >
          <Smartphone size={18} />
        </button>
      </div>

      {/* Main Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="card p-6 border-l-4 border-l-green-500">
          <div className="flex justify-between items-start mb-2">
            <div className="p-2 bg-green-50 rounded-lg text-green-600">
              <TrendingUp size={20} />
            </div>
          </div>
          <h4 className="text-2xl font-black">{formatCurrency(data.revenus)}</h4>
          <p className="text-xs font-bold text-neutral-400 uppercase tracking-widest mt-1">Revenus Totaux</p>
        </div>

        <div className="card p-6 border-l-4 border-l-dia-red">
          <div className="flex justify-between items-start mb-2">
            <div className="p-2 bg-dia-red/5 rounded-lg text-dia-red">
              <TrendingDown size={20} />
            </div>
          </div>
          <h4 className="text-2xl font-black">{formatCurrency(totalCharges)}</h4>
          <p className="text-xs font-bold text-neutral-400 uppercase tracking-widest mt-1">Charges Totales</p>
        </div>

        <div className="card p-6 border-l-4 border-l-neutral-400 bg-neutral-50 dark:bg-neutral-800/50">
          <div className="space-y-4">
            <div>
              <p className="text-[10px] font-bold text-neutral-400 uppercase">Salaire Enseignants</p>
              <p className="text-sm font-bold">{formatCurrency(data.chargesSalariales)}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-neutral-400 uppercase">Charges de Fonctionnement</p>
              <p className="text-sm font-bold">{formatCurrency(data.chargesFixes)}</p>
            </div>
          </div>
        </div>

        <div className={cn(
          "card p-6 border-l-4 shadow-lg flex flex-col justify-center",
          resultatNet >= 0 ? "border-l-blue-500 bg-blue-50/10" : "border-l-red-500 bg-red-50/10"
        )}>
          <h4 className={cn("text-3xl font-black", resultatNet >= 0 ? "text-blue-600" : "text-red-600")}>
            {formatCurrency(resultatNet)}
          </h4>
          <p className="text-xs font-medium text-neutral-500 uppercase tracking-widest mt-1">Résultat Net {selectedYear}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Class Quotas Monitoring */}
        <div className="card p-6 lg:col-span-1">
          <h5 className="font-bold mb-4 flex items-center gap-2 text-dia-red">
            <Activity size={18} />
            Suivi des Quotas par Classe
          </h5>
          <div className="space-y-3">
            {data.classQuotas.length === 0 ? (
              <p className="text-xs text-neutral-500 italic">Aucune donnée de quota.</p>
            ) : (
              data.classQuotas.map((cq: any, idx: number) => (
                <div key={idx} className="p-3 bg-neutral-50 dark:bg-neutral-800/50 rounded-xl border border-neutral-100 dark:border-neutral-800">
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-sm font-bold">{cq.className}</span>
                    <span className={cn(
                      "text-[10px] font-bold uppercase px-2 py-0.5 rounded-full",
                      cq.status === 'ok' ? "bg-green-100 text-green-700" :
                      cq.status === 'depassement' ? "bg-red-100 text-red-700" : "bg-red-100 text-red-700"
                    )}>
                      {cq.status === 'depassement' ? "Quota Dépassé" : cq.status === 'insuffisant' ? "Insuffisant" : "Quota OK"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="flex-1 h-1.5 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
                      <div 
                        className={cn("h-full", (cq.status === 'depassement' || cq.status === 'insuffisant') ? "bg-red-500" : "bg-dia-red")}
                        style={{ width: `${Math.min(100, (cq.total / (cq.quota || 1)) * 100)}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-mono font-bold text-neutral-500">{cq.total.toFixed(1)}/{cq.quota}h</span>
                  </div>
                  {cq.status !== 'ok' && (
                    <p className={cn("text-[10px] font-bold", "text-red-500")}>
                      {cq.status === 'depassement' ? `⚠️ Dépassement de ${cq.diff.toFixed(1)}h` : `❌ Insuffisant (Reste ${Math.abs(cq.diff).toFixed(1)}h)`}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
          <p className="text-[10px] text-neutral-400 mt-4 italic">
            Note: Une marge de ±10h est tolérée avant signalement.
          </p>
        </div>

        {/* Charts Section */}
        <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="card p-6">
            <h5 className="font-bold mb-6 flex items-center gap-2">
              <PieChart size={18} className="text-dia-red" />
              Évolution Mensuelle
            </h5>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.history}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 700}} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 700}} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  formatter={(value) => formatCurrency(Number(value))}
                />
                <Bar dataKey="revenus" fill="#22c55e" radius={[4, 4, 0, 0]} name="Revenus" />
                <Bar dataKey="charges" fill="#ef4444" radius={[4, 4, 0, 0]} name="Charges" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card p-6">
          <h5 className="font-bold mb-6 flex items-center gap-2">
            <Activity size={18} className="text-dia-red" />
            Performance des Résultats
          </h5>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.history}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 700}} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 700}} />
                <Tooltip 
                   contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                   formatter={(value) => formatCurrency(Number(value))}
                />
                <Line type="monotone" dataKey="resultat" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4, fill: '#3b82f6' }} name="Résultat Net" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>

      {/* Salary Details Table */}
      <div className="card overflow-hidden">
        <div className="p-6 border-b border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 flex items-center justify-between">
          <h5 className="font-bold flex items-center gap-2">
            <Clock size={18} className="text-dia-red" />
            Détails des Sessions (Salaires Enseignants)
          </h5>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-neutral-50 dark:bg-neutral-800/50 border-b border-neutral-200 dark:border-neutral-800">
                <th className="px-6 py-4 font-bold uppercase tracking-wider text-[10px] text-neutral-500">Date / Enseignant</th>
                <th className="px-6 py-4 font-bold uppercase tracking-wider text-[10px] text-neutral-500">Séance / Présents</th>
                <th className="px-6 py-4 font-bold uppercase tracking-wider text-[10px] text-neutral-500 text-center">Durée</th>
                <th className="px-6 py-4 font-bold uppercase tracking-wider text-[10px] text-neutral-500 text-center">Taux / Min.</th>
                <th className="px-6 py-4 font-bold uppercase tracking-wider text-[10px] text-neutral-500 text-right">Salaire</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {data.sessionDetails?.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-neutral-500 italic">Aucune séance soumise ce mois.</td>
                </tr>
              ) : (
                data.sessionDetails?.map((s: any, idx: number) => (
                  <tr key={idx} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/30 transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-bold">{new Date(s.date).toLocaleDateString()}</p>
                      <p className="text-xs text-neutral-400">{s.teacherName}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-medium text-xs">{s.matiere}</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        <p className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-full", s.isConditionMet ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700")}>
                          {s.presents} présents {!s.isConditionMet && `(Min ${s.minRequired})`}
                        </p>
                        {s.status === 'excess' && (
                          <p className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-full", s.valide_par_admin ? "bg-blue-100 text-blue-700" : "bg-red-500 text-white animate-pulse")}>
                            {s.valide_par_admin ? "Dépassement Validé" : "⚠️ Dépassement Non Payé"}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <p className="font-mono font-bold text-neutral-600">{s.duree_heures}h</p>
                      <p className="text-[9px] text-neutral-400">Total: {s.currentTotal.toFixed(1)}/{s.quota}h</p>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <p className="text-xs font-bold text-neutral-500">{formatCurrency(s.rate)}/h</p>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <p className={cn("font-black", s.isConditionMet ? "text-neutral-900" : "line-through text-neutral-300")}>
                        {formatCurrency(s.salaire)}
                      </p>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function cn(...classes: any[]) {
  return classes.filter(Boolean).join(' ');
}

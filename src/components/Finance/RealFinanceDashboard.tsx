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
  Filter
} from 'lucide-react';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  collectionGroup 
} from 'firebase/firestore';
import { db } from '../../firebase';
import { formatCurrency } from '../../utils';
import { Charge, Session, Versement, DailyReport } from '../../types';
import { motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { generateWhatsAppLink, generateMailtoLink, APP_NAME_FOR_LINKS } from '../../utils/contactLinks';
import { Smartphone, Mail, Share2 } from 'lucide-react';
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
    history: [] as any[]
  });
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const fetchFinanceStats = async () => {
    setLoading(true);
    try {
      // 1. Aggreger les REVENUS (Versements scolarités)
      // On utilise collectionGroup car les versements sont dans des sous-collections
      const versementsSnap = await getDocs(collectionGroup(db, 'versements'));
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
      const reportsSnap = await getDocs(query(collection(db, 'rapports_journaliers'), where('statut', '==', 'soumis')));
      const teachersSnap = await getDocs(query(collection(db, 'users'), where('role', '==', 'teacher')));
      
      const teacherRates: Record<string, number> = {};
      teachersSnap.forEach(doc => {
        const t = doc.data();
        teacherRates[doc.id] = t.hourlyRate || 3000; // Default rate if none set
      });

      let totalSalaires = 0;
      const monthlySalaries: Record<string, number> = {};

      reportsSnap.forEach(doc => {
        const r = doc.data() as DailyReport;
        const date = new Date(r.date);
        if (date.getFullYear() === selectedYear) {
          const rate = teacherRates[r.enseignant_id] || 3000;
          const salaire = (r.duree_heures || 0) * rate;
          totalSalaires += salaire;
          const mKey = date.getMonth();
          monthlySalaries[mKey] = (monthlySalaries[mKey] || 0) + salaire;
        }
      });

      // 3. Aggreger les CHARGES FIXES
      const chargesSnap = await getDocs(collection(db, 'charges'));
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
        history
      });
    } catch (err) {
      console.error("Erreur Dashboard Financier:", err);
    } finally {
      setLoading(false);
    }
  };

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
        <button 
          onClick={() => {
            const subject = `📊 Rapport Financier Annuel ${selectedYear} - ${APP_NAME_FOR_LINKS}`;
            const body = `-----------------------------------------------------------\nBILAN FINANCIER - ${APP_NAME_FOR_LINKS}\n-----------------------------------------------------------\n\nVoici le résumé financier pour l'année ${selectedYear} :\n\n- Revenus globaux : ${formatCurrency(data.revenus)}\n- Charges totales : ${formatCurrency(totalCharges)}\n\n=> RÉSULTAT NET : ${formatCurrency(resultatNet)}\n\nRapport généré le ${new Date().toLocaleString()}.\n\nCordialement,\nService Comptabilité.`;
            const mailto = generateMailtoLink('', subject, body);
            const a = document.createElement('a');
            a.href = mailto;
            a.click();
          }}
          className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
          title="Partager par Email"
        >
          <Mail size={18} />
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

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
  );
}

function cn(...classes: any[]) {
  return classes.filter(Boolean).join(' ');
}

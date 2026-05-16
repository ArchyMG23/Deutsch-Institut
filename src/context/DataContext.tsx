import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { Student, Teacher, ClassRoom, Level, FinanceRecord, LibraryItem, Evaluation } from '../types';
import { useAuth } from './AuthContext';

import { initListenerSoldesGlobal } from '../lib/school-engine';
import { listenSoldes } from '../lib/sync-listeners';
import { verifierCoherenceSoldes } from '../lib/sync-integrity';

interface DataContextType {
  students: Student[];
  teachers: Teacher[];
  classes: ClassRoom[];
  levels: Level[];
  finances: FinanceRecord[];
  library: LibraryItem[];
  evaluations: Evaluation[];
  loading: boolean;
  refreshAll: (force?: boolean) => Promise<void>;
  refreshStudents: () => Promise<void>;
  refreshTeachers: () => Promise<void>;
  refreshClasses: () => Promise<void>;
  refreshLevels: () => Promise<void>;
  refreshFinances: () => Promise<void>;
  refreshLibrary: () => Promise<void>;
  refreshEvaluations: () => Promise<void>;
  onlineUsers: any[];
  caisseSolde: number;
  banqueSolde: number;
  financeStats: {
    totalIncome: number;
    totalExpense: number;
    caisseBalance: number;
    banqueBalance: number;
    yearIncome: number;
    yearExpense: number;
    monthlyHistory: {
      month: string;
      income: number;
      expense: number;
      caisse: number;
      banque: number;
      result: number;
    }[];
  };
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const { fetchWithAuth, user } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [levels, setLevels] = useState<Level[]>([]);
  const [finances, setFinances] = useState<FinanceRecord[]>([]);
  const [library, setLibrary] = useState<LibraryItem[]>([]);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<any[]>([]);
  const [caisseSolde, setCaisseSolde] = useState(0);
  const [banqueSolde, setBanqueSolde] = useState(0);
  const [loading, setLoading] = useState(false);

    // Financial Sychronization - Phase 1
    useEffect(() => {
      if (!user) return;
      
      const isAdminUser = user.role === 'admin' || (user as any).isSuperAdmin;
      let unsubscribeComptes = () => {};
      let unsubStudents = () => {};
      let unsubTeachers = () => {};
      let unsubFinances = () => {};

      if (isAdminUser) {
        // Initialize the new global listeners 
        listenSoldes();
        
        // Integrity check for admins
        verifierCoherenceSoldes().then(({ anomalies, healed }: any) => {
          if (healed) console.log(`[SYNC] Healed ${anomalies} balance anomalies to match ledger.`);
        });

        unsubscribeComptes = onSnapshot(collection(db, 'comptes'), (snapshot) => {
          snapshot.docs.forEach(doc => {
            if (doc.id === 'caisse') {
              const val = doc.data().solde_actuel || 0;
              setCaisseSolde(val);
              if ((window as any).APP_SOLDES) (window as any).APP_SOLDES.caisse = val;
            }
            if (doc.id === 'banque') {
              const val = doc.data().solde_actuel || 0;
              setBanqueSolde(val);
              if ((window as any).APP_SOLDES) (window as any).APP_SOLDES.banque = val;
            }
          });
          // Propagate update via custom event for specialized components
          window.dispatchEvent(new CustomEvent('finance-update'));
          window.dispatchEvent(new CustomEvent('soldes:updated', { 
            detail: { caisse: (window as any).APP_SOLDES?.caisse || 0, banque: (window as any).APP_SOLDES?.banque || 0 } 
          }));
        }, (error) => {
          console.error("Firestore balance listener error:", error);
        });

        unsubStudents = onSnapshot(collection(db, 'students'), (snap) => {
          const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as any as Student));
          const unique = list.filter((v, i, a) => a.findIndex(t => (t as any).id === (v as any).id) === i);
          setStudents(unique);
        }, (err) => console.error("Students sync error:", err));

        unsubTeachers = onSnapshot(collection(db, 'teachers'), (snap) => {
          const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as any as Teacher));
          setTeachers(list);
        }, (err) => console.error("Teachers sync error:", err));

        // For finances, use 'finances' collection which holds flattened searchable records
        const financesQuery = query(collection(db, 'finances'), orderBy('date', 'desc'), limit(500));
        unsubFinances = onSnapshot(financesQuery, (snap) => {
          const list = snap.docs.map(d => {
            const data = d.data();
            const rawAmount = Number(data.amount || data.montant || 0);
            const isExpense = data.type === 'expense' || data.type === 'sortie' || (data.libelle && data.libelle.startsWith('SORTIE:'));
            
            return { 
              id: d.id, 
              ...data,
              amount: isExpense ? -Math.abs(rawAmount) : Math.abs(rawAmount),
              montant: rawAmount,
              date: data.date || data.date_versement || data.createdAt || data.timestamp_creation,
              description: data.description || data.libelle || data.notes || data.category || 'Transaction'
            } as any as FinanceRecord;
          });
          setFinances(list);
        }, (err) => console.error("Finances sync error:", err));
      }

      const unsubClasses = onSnapshot(collection(db, 'classes'), (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as ClassRoom));
      setClasses(list);
    }, (err) => console.error("Classes sync error:", err));

    const unsubLevels = onSnapshot(collection(db, 'levels'), (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as Level));
      setLevels(list);
    }, (err) => console.error("Levels sync error:", err));

      return () => {
        unsubscribeComptes();
        unsubStudents();
        unsubTeachers();
        unsubClasses();
        unsubLevels();
        unsubFinances();
      };
    }, [user]);

  // Unified financial stats
  const financeStats = React.useMemo(() => {
    const activeFinances = (finances || []);
    let caisse = 0;
    let banque = 0;
    let totalInc = 0;
    let totalExp = 0;
    let yearInc = 0;
    let yearExp = 0;
    
    const currentYear = new Date().getFullYear();
    const months = Array.from({ length: 12 }, (_, i) => ({
      month: new Date(2000, i).toLocaleDateString('fr-FR', { month: 'short' }),
      income: 0,
      expense: 0,
      caisse: 0,
      banque: 0,
      result: 0
    }));

    // Sort finances by date for balance tracking if needed, 
    // but for simple monthly variation we can just sum.
    activeFinances.forEach(f => {
      const montant = Number(f.montant || f.amount || 0);
      const date = new Date(f.date_versement || f.date || f.createdAt);
      const isIncome = f.type === 'income' || (f.type !== 'sortie' && montant > 0);
      const year = date.getFullYear();
      const monthIdx = date.getMonth();
      
      // We use absolute value for income/expense counters but signed value for balance
      const absAmount = Math.abs(montant);

      if (isIncome) {
        totalInc += absAmount;
        if (year === currentYear) {
          yearInc += absAmount;
          months[monthIdx].income += absAmount;
        }
      } else {
        totalExp += absAmount;
        if (year === currentYear) {
          yearExp += absAmount;
          months[monthIdx].expense += absAmount;
        }
      }

      const effect = montant; // Use the signed value directly for balance calculation
      const acc = f.compte_destination || f.accountType || 'caisse';
      if (acc === 'banque') {
        banque += effect;
        if (year === currentYear) months[monthIdx].banque += effect;
      } else {
        caisse += effect;
        if (year === currentYear) months[monthIdx].caisse += effect;
      }
    });

    // Calculate monthly result
    months.forEach(m => {
      m.result = m.income - m.expense;
    });

    return {
      totalIncome: totalInc,
      totalExpense: totalExp,
      caisseBalance: caisseSolde, // Use real-time value
      banqueBalance: banqueSolde, // Use real-time value
      yearIncome: yearInc,
      yearExpense: yearExp,
      monthlyHistory: months
    };
  }, [finances, caisseSolde, banqueSolde]);
  const lastFetchRef = useRef<number>(0);
  const lastFetchTimesRef = useRef<Record<string, number>>({});

  // Presence listener
  useEffect(() => {
    if (!user) {
      setOnlineUsers([]);
      return;
    }
    
    // Presence listener - Admin only
    let unsubscribe = () => {};
    if (user.role === 'admin' || (user as any).isSuperAdmin) {
      const q = query(collection(db, 'users'), where('status', '==', 'online'));
      unsubscribe = onSnapshot(q, (snapshot: any) => {
        const list = snapshot.docs.map((doc: any) => ({ uid: doc.id, ...doc.data() }));
        setOnlineUsers(list);
      }, (err) => console.error("Presence sync error:", err));
    }

    return () => unsubscribe();
  }, [user]);

  const shouldFetch = useCallback((key: string) => {
    const now = Date.now();
    const last = lastFetchTimesRef.current[key] || 0;
    return now - last > 5000; // 5 second throttle
  }, []);

  const refreshStudents = useCallback(async (_force: boolean = false) => {
    // onSnapshot handles this now
  }, []);

  const refreshTeachers = useCallback(async (_force: boolean = false) => {
    // onSnapshot handles this now
  }, []);

  const refreshClasses = useCallback(async (_force: boolean = false) => {
    // onSnapshot handles this now
  }, []);

  const refreshLevels = useCallback(async (_force: boolean = false) => {
    // onSnapshot handles this now
  }, []);

  const refreshFinances = useCallback(async (_force: boolean = false) => {
    // onSnapshot handles this now
  }, []);

  const refreshLibrary = useCallback(async () => {
    if (!shouldFetch('library')) return;
    try {
      const res = await fetchWithAuth('/api/library');
      if (res.ok) {
        setLibrary(await res.json());
        lastFetchTimesRef.current['library'] = Date.now();
      }
    } catch (err) {
      console.error("Error fetching library:", err);
    }
  }, [fetchWithAuth, shouldFetch]);

  const refreshEvaluations = useCallback(async () => {
    if (!shouldFetch('evaluations')) return;
    try {
      const res = await fetchWithAuth('/api/evaluations');
      if (res.ok) {
        setEvaluations(await res.json());
        lastFetchTimesRef.current['evaluations'] = Date.now();
      }
    } catch (err) {
      console.error("Error fetching evaluations:", err);
    }
  }, [fetchWithAuth, shouldFetch]);

  const refreshAll = useCallback(async (force = false) => {
    if (!user) return;
    
    // Throttling: prevent double fetching within 1 minute unless forced
    const now = Date.now();
    const lastFetch = lastFetchRef.current;
    if (!force && lastFetch && now - lastFetch < 60000) {
      return;
    }
    
    setLoading(true);
    try {
      lastFetchTimesRef.current = {}; 
      
      // Multi-phase loading to prioritize UI interactivity
      // 1. Critical core data
      await Promise.all([
        refreshStudents(),
        refreshClasses(),
        refreshLevels()
      ]);

      // 2. Secondary business data
      await Promise.all([
        refreshTeachers(),
        refreshFinances(), 
        refreshLibrary(),
        refreshEvaluations()
      ]);

      lastFetchRef.current = now;
    } catch (err) {
      console.error("RefreshAll error:", err);
    } finally {
      setLoading(false);
    }
  }, [user, refreshStudents, refreshTeachers, refreshClasses, refreshLevels, refreshFinances, refreshLibrary, refreshEvaluations]);

  useEffect(() => {
    if (user) {
      refreshAll();
    }
  }, [user, refreshAll]);

  return (
    <DataContext.Provider value={{
      students,
      teachers,
      classes,
      levels,
      finances,
      library,
      evaluations,
      loading,
      refreshAll,
      refreshStudents,
      refreshTeachers,
      refreshClasses,
      refreshLevels,
      refreshFinances,
      refreshLibrary,
      refreshEvaluations,
      onlineUsers,
      caisseSolde,
      banqueSolde,
      financeStats
    }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
}

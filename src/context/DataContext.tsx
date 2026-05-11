import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { Student, Teacher, ClassRoom, Level, FinanceRecord, LibraryItem, Evaluation } from '../types';
import { useAuth } from './AuthContext';

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
  const [loading, setLoading] = useState(false);

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
      const amount = Number(f.amount) || 0;
      const date = new Date(f.date || f.createdAt);
      const isIncome = f.type === 'income';
      const year = date.getFullYear();
      const monthIdx = date.getMonth();
      
      if (isIncome) {
        totalInc += amount;
        if (year === currentYear) {
          yearInc += amount;
          months[monthIdx].income += amount;
        }
      } else {
        totalExp += amount;
        if (year === currentYear) {
          yearExp += amount;
          months[monthIdx].expense += amount;
        }
      }

      const effect = isIncome ? amount : -amount;
      if (f.accountType === 'banque') {
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
      caisseBalance: caisse,
      banqueBalance: banque,
      yearIncome: yearInc,
      yearExpense: yearExp,
      monthlyHistory: months
    };
  }, [finances]);
  const lastFetchRef = useRef<number>(0);
  const lastFetchTimesRef = useRef<Record<string, number>>({});

  // Presence listener
  useEffect(() => {
    if (!user) {
      setOnlineUsers([]);
      return;
    }
    
    // Presence listener handled by top-level imports
    const q = query(collection(db, 'users'), where('status', '==', 'online'));
    const unsubscribe = onSnapshot(q, (snapshot: any) => {
      const list = snapshot.docs.map((doc: any) => ({ uid: doc.id, ...doc.data() }));
      setOnlineUsers(list);
    });

    return () => unsubscribe();
  }, [user]);

  const shouldFetch = useCallback((key: string) => {
    const now = Date.now();
    const last = lastFetchTimesRef.current[key] || 0;
    return now - last > 5000; // 5 second throttle
  }, []);

  const refreshStudents = useCallback(async (force: boolean = false) => {
    if (!force && !shouldFetch('students')) return;
    try {
      const res = await fetchWithAuth('/api/students');
      if (res.ok) {
        setStudents(await res.json());
        lastFetchTimesRef.current['students'] = Date.now();
      }
    } catch (err) {
      console.error("Error fetching students:", err);
    }
  }, [fetchWithAuth, shouldFetch]);

  const refreshTeachers = useCallback(async (force: boolean = false) => {
    if (!force && !shouldFetch('teachers')) return;
    try {
      const res = await fetchWithAuth('/api/teachers');
      if (res.ok) {
        setTeachers(await res.json());
        lastFetchTimesRef.current['teachers'] = Date.now();
      }
    } catch (err) {
      console.error("Error fetching teachers:", err);
    }
  }, [fetchWithAuth, shouldFetch]);

  const refreshClasses = useCallback(async (force: boolean = false) => {
    if (!force && !shouldFetch('classes')) return;
    try {
      const res = await fetchWithAuth('/api/classes');
      if (res.ok) {
        setClasses(await res.json());
        lastFetchTimesRef.current['classes'] = Date.now();
      }
    } catch (err) {
      console.error("Error fetching classes:", err);
    }
  }, [fetchWithAuth, shouldFetch]);

  const refreshLevels = useCallback(async (force: boolean = false) => {
    if (!force && !shouldFetch('levels')) return;
    try {
      const res = await fetchWithAuth('/api/levels');
      if (res.ok) {
        setLevels(await res.json());
        lastFetchTimesRef.current['levels'] = Date.now();
      }
    } catch (err) {
      console.error("Error fetching levels:", err);
    }
  }, [fetchWithAuth, shouldFetch]);

  const refreshFinances = useCallback(async (force: boolean = false) => {
    if (!force && !shouldFetch('finances')) return;
    try {
      const res = await fetchWithAuth('/api/finances');
      if (res.ok) {
        setFinances(await res.json());
        lastFetchTimesRef.current['finances'] = Date.now();
      }
    } catch (err) {
      console.error("Error fetching finances:", err);
    }
  }, [fetchWithAuth, shouldFetch]);

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

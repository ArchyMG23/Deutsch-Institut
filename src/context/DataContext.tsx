import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { Student, Teacher, ClassRoom, Level, FinanceRecord, LibraryItem, Evaluation } from '../types';
import { useAuth } from './AuthContext';

interface DataContextType {
  students: Student[];
  teachers: Teacher[];
  classes: ClassRoom[];
  levels: Level[];
  finances: FinanceRecord[];
  trashFinances: FinanceRecord[];
  library: LibraryItem[];
  evaluations: Evaluation[];
  loading: boolean;
  refreshAll: (force?: boolean) => Promise<void>;
  refreshStudents: () => Promise<void>;
  refreshTeachers: () => Promise<void>;
  refreshClasses: () => Promise<void>;
  refreshLevels: () => Promise<void>;
  refreshFinances: () => Promise<void>;
  refreshTrash: () => Promise<void>;
  refreshLibrary: () => Promise<void>;
  refreshEvaluations: () => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const { fetchWithAuth, user } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [levels, setLevels] = useState<Level[]>([]);
  const [finances, setFinances] = useState<FinanceRecord[]>([]);
  const [trashFinances, setTrashFinances] = useState<FinanceRecord[]>([]);
  const [library, setLibrary] = useState<LibraryItem[]>([]);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [loading, setLoading] = useState(false);
  const lastFetchRef = useRef<number>(0);
  const lastFetchTimesRef = useRef<Record<string, number>>({});

  const shouldFetch = useCallback((key: string) => {
    const now = Date.now();
    const last = lastFetchTimesRef.current[key] || 0;
    return now - last > 5000; // 5 second throttle
  }, []);

  const refreshStudents = useCallback(async () => {
    if (!shouldFetch('students')) return;
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

  const refreshTeachers = useCallback(async () => {
    if (!shouldFetch('teachers')) return;
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

  const refreshClasses = useCallback(async () => {
    if (!shouldFetch('classes')) return;
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

  const refreshLevels = useCallback(async () => {
    if (!shouldFetch('levels')) return;
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

  const refreshFinances = useCallback(async () => {
    if (!shouldFetch('finances')) return;
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

  const refreshTrash = useCallback(async () => {
    if (!shouldFetch('trash')) return;
    try {
      const res = await fetchWithAuth('/api/finances/trash');
      if (res.ok) {
        setTrashFinances(await res.json());
        lastFetchTimesRef.current['trash'] = Date.now();
      }
    } catch (err) {
      console.error("Error fetching trash:", err);
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
    
    // Prevent double fetching within 30 seconds unless forced
    const now = Date.now();
    const lastFetch = lastFetchRef.current;
    if (!force && lastFetch && now - lastFetch < 30000) {
      return;
    }
    
    setLoading(true);
    try {
      lastFetchTimesRef.current = {}; 
      
      await Promise.all([
        refreshStudents(),
        refreshTeachers(),
        refreshClasses(),
        refreshLevels(),
        refreshFinances(),
        refreshTrash(),
        refreshLibrary(),
        refreshEvaluations()
      ]);
      lastFetchRef.current = now;
    } finally {
      setLoading(false);
    }
  }, [user, refreshStudents, refreshTeachers, refreshClasses, refreshLevels, refreshFinances, refreshTrash, refreshLibrary, refreshEvaluations]);

  return (
    <DataContext.Provider value={{
      students,
      teachers,
      classes,
      levels,
      finances,
      trashFinances,
      library,
      evaluations,
      loading,
      refreshAll,
      refreshStudents,
      refreshTeachers,
      refreshClasses,
      refreshLevels,
      refreshFinances,
      refreshTrash,
      refreshLibrary,
      refreshEvaluations
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

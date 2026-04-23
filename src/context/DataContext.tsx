import React, { createContext, useContext, useState, useCallback } from 'react';
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
  const [lastFetch, setLastFetch] = useState<number>(0);

  const refreshStudents = useCallback(async () => {
    try {
      const res = await fetchWithAuth('/api/students');
      if (res.ok) setStudents(await res.json());
    } catch (err) {
      console.error("Error fetching students:", err);
    }
  }, [fetchWithAuth]);

  const refreshTeachers = useCallback(async () => {
    try {
      const res = await fetchWithAuth('/api/teachers');
      if (res.ok) setTeachers(await res.json());
    } catch (err) {
      console.error("Error fetching teachers:", err);
    }
  }, [fetchWithAuth]);

  const refreshClasses = useCallback(async () => {
    try {
      const res = await fetchWithAuth('/api/classes');
      if (res.ok) setClasses(await res.json());
    } catch (err) {
      console.error("Error fetching classes:", err);
    }
  }, [fetchWithAuth]);

  const refreshLevels = useCallback(async () => {
    try {
      const res = await fetchWithAuth('/api/levels');
      if (res.ok) setLevels(await res.json());
    } catch (err) {
      console.error("Error fetching levels:", err);
    }
  }, [fetchWithAuth]);

  const refreshFinances = useCallback(async () => {
    try {
      const res = await fetchWithAuth('/api/finances');
      if (res.ok) setFinances(await res.json());
    } catch (err) {
      console.error("Error fetching finances:", err);
    }
  }, [fetchWithAuth]);

  const refreshTrash = useCallback(async () => {
    try {
      const res = await fetchWithAuth('/api/finances/trash');
      if (res.ok) setTrashFinances(await res.json());
    } catch (err) {
      console.error("Error fetching trash:", err);
    }
  }, [fetchWithAuth]);

  const refreshLibrary = useCallback(async () => {
    try {
      const res = await fetchWithAuth('/api/library');
      if (res.ok) setLibrary(await res.json());
    } catch (err) {
      console.error("Error fetching library:", err);
    }
  }, [fetchWithAuth]);

  const refreshEvaluations = useCallback(async () => {
    try {
      const res = await fetchWithAuth('/api/evaluations');
      if (res.ok) setEvaluations(await res.json());
    } catch (err) {
      console.error("Error fetching evaluations:", err);
    }
  }, [fetchWithAuth]);

  const refreshAll = useCallback(async (force = false) => {
    if (!user) return;
    
    // Prevent double fetching within 30 seconds unless forced
    const now = Date.now();
    if (!force && lastFetch && now - lastFetch < 30000) {
      console.log("Skipping refreshAll (last fetch was too recent)");
      return;
    }
    
    setLoading(true);
    try {
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
      setLastFetch(now);
    } finally {
      setLoading(false);
    }
  }, [user, lastFetch, refreshStudents, refreshTeachers, refreshClasses, refreshLevels, refreshFinances, refreshLibrary, refreshEvaluations]);

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

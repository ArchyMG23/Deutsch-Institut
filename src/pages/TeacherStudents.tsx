import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Search, 
  Mail, 
  ChevronRight,
  GraduationCap,
  Filter
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ClassRoom, Student } from '../types';
import { cn } from '../utils';
import { NotificationService } from '../services/NotificationService';

export default function TeacherStudents() {
  const { profile } = useAuth();
  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClassId, setSelectedClassId] = useState<string>('all');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [classesRes, studentsRes] = await Promise.all([
        fetch('/api/teachers/me/classes'),
        fetch('/api/students')
      ]);

      if (classesRes.ok && studentsRes.ok) {
        const classesData = await classesRes.ok ? await classesRes.json() : [];
        const studentsData = await studentsRes.ok ? await studentsRes.json() : [];
        
        setClasses(classesData);
        
        // Filter students that are in the teacher's classes
        const teacherStudentIds = new Set(classesData.flatMap((c: ClassRoom) => c.studentIds));
        const filteredStudents = studentsData.filter((s: Student) => teacherStudentIds.has(s.uid));
        
        setStudents(filteredStudents);
      }
    } catch (err) {
      console.error("Error fetching teacher students:", err);
    } finally {
      setLoading(false);
    }
  };

  const filteredStudents = students.filter(student => {
    const matchesSearch = 
      student.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.matricule.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesClass = selectedClassId === 'all' || student.classId === selectedClassId;
    
    return matchesSearch && matchesClass;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-dia-red"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-2xl font-bold tracking-tight">Mes Étudiants</h3>
          <p className="text-neutral-500">Liste des étudiants inscrits dans vos classes.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" size={18} />
            <input 
              type="text"
              placeholder="Rechercher un étudiant..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-12 pr-5 py-2.5 bg-white border border-neutral-200 rounded-2xl focus:ring-2 focus:ring-dia-red/20 focus:border-dia-red outline-none transition-all w-full md:w-64"
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" size={18} />
            <select 
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="pl-12 pr-5 py-2.5 bg-white border border-neutral-200 rounded-2xl focus:ring-2 focus:ring-dia-red/20 focus:border-dia-red outline-none transition-all appearance-none cursor-pointer"
            >
              <option value="all">Toutes les classes</option>
              {classes.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredStudents.length > 0 ? (
          filteredStudents.map((student) => {
            const studentClass = classes.find(c => c.id === student.classId);
            return (
              <div key={student.uid} className="card p-6 group hover:border-dia-red/30 transition-all">
                <div className="flex items-start justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-dia-red/5 flex items-center justify-center text-xl font-bold text-dia-red">
                      {student.firstName[0]}{student.lastName[0]}
                    </div>
                    <div>
                      <h4 className="font-bold text-neutral-900 group-hover:text-dia-red transition-colors">
                        {student.firstName} {student.lastName}
                      </h4>
                      <p className="text-xs text-neutral-500 font-mono">{student.matricule}</p>
                    </div>
                  </div>
                  <span className={cn(
                    "px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider",
                    student.status === 'online' ? "bg-green-50 text-green-600" : "bg-neutral-50 text-neutral-400"
                  )}>
                    {student.status === 'online' ? 'En ligne' : 'Hors ligne'}
                  </span>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-3 text-sm text-neutral-600">
                    <GraduationCap size={16} className="text-neutral-400" />
                    <span>Classe: <span className="font-bold text-neutral-900">{studentClass?.name || 'Non affecté'}</span></span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-neutral-600">
                    <Mail size={16} className="text-neutral-400" />
                    <span className="truncate">{student.email}</span>
                  </div>
                </div>

                <div className="mt-6 pt-6 border-t border-neutral-50 flex items-center gap-2">
                  <button className="flex-1 p-2.5 bg-dia-red/5 text-dia-red hover:bg-dia-red hover:text-white rounded-xl transition-all flex items-center justify-center gap-2">
                    <ChevronRight size={18} />
                    <span className="text-xs font-bold">Voir le profil</span>
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <div className="col-span-full card p-12 text-center space-y-4">
            <div className="w-16 h-16 bg-neutral-50 rounded-full flex items-center justify-center mx-auto text-neutral-300">
              <Users size={32} />
            </div>
            <div>
              <p className="font-bold text-neutral-900">Aucun étudiant trouvé</p>
              <p className="text-sm text-neutral-500">Essayez de modifier vos critères de recherche ou de filtrage.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

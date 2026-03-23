import React, { useState, useEffect } from 'react';
import { 
  Calendar as CalendarIcon, 
  Clock, 
  MapPin, 
  User,
  ChevronLeft,
  ChevronRight,
  Filter,
  GraduationCap
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { cn } from '../utils';
import { Student, ClassRoom, ScheduleItem, ExamItem } from '../types';

export default function StudentCalendar() {
  const { profile } = useAuth();
  const student = profile as Student;
  const [studentClass, setStudentClass] = useState<ClassRoom | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());

  useEffect(() => {
    const fetchClass = async () => {
      try {
        const res = await fetch('/api/classes');
        if (res.ok) {
          const classes: ClassRoom[] = await res.json();
          setStudentClass(classes.find(c => c.id === student.classId) || null);
        }
      } catch (err) {
        console.error("Error fetching class for calendar:", err);
      } finally {
        setLoading(false);
      }
    };

    if (student?.classId) {
      fetchClass();
    } else {
      setLoading(false);
    }
  }, [student]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-dia-red"></div>
      </div>
    );
  }

  const days = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-2xl font-bold tracking-tight">Mon Calendrier</h3>
          <p className="text-neutral-500">Consultez votre emploi du temps et vos examens.</p>
        </div>
        
        <div className="flex items-center gap-2 p-1 bg-white dark:bg-neutral-900 rounded-2xl shadow-sm border border-neutral-100 dark:border-neutral-800">
          <button className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition-colors text-neutral-400">
            <ChevronLeft size={20} />
          </button>
          <div className="px-4 font-bold text-sm">
            {currentDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
          </div>
          <button className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition-colors text-neutral-400">
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
        {/* Main Calendar View */}
        <div className="xl:col-span-3 space-y-6">
          <div className="card overflow-hidden">
            <div className="grid grid-cols-7 border-b border-neutral-100 dark:border-neutral-800">
              {days.map(day => (
                <div key={day} className="py-4 text-center text-[10px] font-bold uppercase tracking-widest text-neutral-400 border-r last:border-r-0 border-neutral-100 dark:border-neutral-800">
                  {day}
                </div>
              ))}
            </div>
            
            <div className="grid grid-cols-7 min-h-[600px]">
              {days.map(day => {
                const daySchedule = studentClass?.schedule?.filter(s => s.day.toLowerCase() === day.toLowerCase()) || [];
                const dayExams = studentClass?.exams?.filter(e => {
                  const examDate = new Date(e.date);
                  // This is a simplified check for the current week/month
                  return examDate.getDay() === (days.indexOf(day) + 1) % 7;
                }) || [];

                return (
                  <div key={day} className="p-2 border-r last:border-r-0 border-neutral-100 dark:border-neutral-800 bg-neutral-50/30 dark:bg-neutral-900/30 space-y-2">
                    {daySchedule.map((item, idx) => (
                      <div key={idx} className="p-3 rounded-xl bg-white dark:bg-neutral-800 shadow-sm border-l-4 border-dia-red space-y-1">
                        <p className="text-[10px] font-bold text-dia-red uppercase">{item.startTime}</p>
                        <h5 className="text-xs font-bold text-neutral-900 dark:text-white line-clamp-2">{item.subject}</h5>
                        <div className="flex items-center gap-1 text-[9px] text-neutral-400">
                          <Clock size={10} /> {item.endTime}
                        </div>
                      </div>
                    ))}
                    
                    {dayExams.map((exam) => (
                      <div key={exam.id} className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 shadow-sm border-l-4 border-emerald-500 space-y-1">
                        <p className="text-[10px] font-bold text-emerald-500 uppercase">Examen</p>
                        <h5 className="text-xs font-bold text-neutral-900 dark:text-white line-clamp-2">{exam.title}</h5>
                        <div className="flex items-center gap-1 text-[9px] text-neutral-400">
                          <Clock size={10} /> {exam.startTime}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Sidebar: Details & Legend */}
        <div className="space-y-8">
          <div className="card p-6 space-y-6">
            <h4 className="font-bold text-lg">Détails de la Classe</h4>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-dia-red/10 text-dia-red flex items-center justify-center">
                  <GraduationCap size={20} />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase text-neutral-400">Classe</p>
                  <p className="text-sm font-bold">{studentClass?.name || "Non assignée"}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
                  <User size={20} />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase text-neutral-400">Enseignant</p>
                  <p className="text-sm font-bold">M. Koffi</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-dia-yellow/10 text-dia-yellow flex items-center justify-center">
                  <MapPin size={20} />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase text-neutral-400">Salle Principale</p>
                  <p className="text-sm font-bold">Salle A-102</p>
                </div>
              </div>
            </div>
          </div>

          <div className="card p-6 space-y-4">
            <h4 className="font-bold text-lg">Légende</h4>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 rounded-full bg-dia-red" />
                <span className="text-sm font-medium text-neutral-600">Cours Régulier</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 rounded-full bg-emerald-500" />
                <span className="text-sm font-medium text-neutral-600">Examen / Test</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 rounded-full bg-dia-yellow" />
                <span className="text-sm font-medium text-neutral-600">Événement Spécial</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

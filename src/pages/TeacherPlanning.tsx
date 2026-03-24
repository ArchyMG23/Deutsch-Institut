import React, { useState, useEffect } from 'react';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Clock, 
  MapPin, 
  Users,
  BookOpen,
  Plus
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ClassRoom, ScheduleItem } from '../types';
import { cn } from '../utils';

export default function TeacherPlanning() {
  const { profile, fetchWithAuth } = useAuth();
  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());

  useEffect(() => {
    fetchTeacherClasses();
  }, []);

  const fetchTeacherClasses = async () => {
    try {
      const res = await fetchWithAuth('/api/teachers/me/classes');
      if (res.ok) {
        const data = await res.json();
        setClasses(data);
      }
    } catch (err) {
      console.error("Error fetching teacher classes:", err);
    } finally {
      setLoading(false);
    }
  };

  const days = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
  const hours = Array.from({ length: 14 }, (_, i) => i + 7); // 7:00 to 20:00

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-dia-red"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-2xl font-bold tracking-tight">Mon Planning</h3>
          <p className="text-neutral-500">Gérez votre emploi du temps et vos cours.</p>
        </div>
        <div className="flex items-center gap-2 bg-white p-1 rounded-2xl shadow-sm border border-neutral-100">
          <button 
            onClick={() => setCurrentDate(new Date(currentDate.setDate(currentDate.getDate() - 7)))}
            className="p-2 hover:bg-neutral-50 rounded-xl transition-colors"
          >
            <ChevronLeft size={20} />
          </button>
          <div className="px-4 font-bold text-sm">
            {currentDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
          </div>
          <button 
            onClick={() => setCurrentDate(new Date(currentDate.setDate(currentDate.getDate() + 7)))}
            className="p-2 hover:bg-neutral-50 rounded-xl transition-colors"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <div className="min-w-[800px]">
            {/* Calendar Header */}
            <div className="grid grid-cols-7 border-b border-neutral-100 bg-neutral-50/50">
              <div className="p-4 border-r border-neutral-100 w-20"></div>
              {days.map((day) => (
                <div key={day} className="p-4 text-center border-r border-neutral-100 last:border-r-0">
                  <span className="text-xs font-bold uppercase tracking-widest text-neutral-400">{day}</span>
                </div>
              ))}
            </div>

            {/* Calendar Grid */}
            <div className="relative">
              {hours.map((hour) => (
                <div key={hour} className="grid grid-cols-7 border-b border-neutral-50 last:border-b-0 h-20">
                  <div className="p-2 border-r border-neutral-100 w-20 text-right pr-4">
                    <span className="text-[10px] font-bold text-neutral-400">{hour}:00</span>
                  </div>
                  {days.map((day) => {
                    // Find classes for this day and hour
                    const scheduledClasses = classes.filter(cls => 
                      cls.schedule?.some(s => 
                        s.day === day && 
                        parseInt(s.startTime.split(':')[0]) <= hour && 
                        parseInt(s.endTime.split(':')[0]) > hour
                      )
                    );

                    return (
                      <div key={`${day}-${hour}`} className="border-r border-neutral-50 last:border-r-0 relative p-1">
                        {scheduledClasses.map((cls, idx) => {
                          const schedule = cls.schedule.find(s => s.day === day);
                          if (!schedule || parseInt(schedule.startTime.split(':')[0]) !== hour) return null;
                          
                          const duration = parseInt(schedule.endTime.split(':')[0]) - parseInt(schedule.startTime.split(':')[0]);
                          
                          return (
                            <div 
                              key={cls.id}
                              className={cn(
                                "absolute inset-x-1 z-10 p-2 rounded-xl border shadow-sm transition-all hover:scale-[1.02] cursor-pointer",
                                "bg-dia-red/5 border-dia-red/20 text-dia-red"
                              )}
                              style={{ 
                                height: `${duration * 80 - 8}px`,
                                top: '4px'
                              }}
                            >
                              <div className="flex flex-col h-full justify-between">
                                <div>
                                  <p className="text-[10px] font-bold uppercase leading-none mb-1 opacity-70">{cls.name}</p>
                                  <p className="text-xs font-bold truncate">{schedule.subject || 'Cours d\'Allemand'}</p>
                                </div>
                                <div className="flex items-center gap-2 opacity-70">
                                  <Clock size={10} />
                                  <span className="text-[10px] font-bold">{schedule.startTime} - {schedule.endTime}</span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Legend & Info */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card p-6 space-y-4">
          <h4 className="font-bold flex items-center gap-2">
            <BookOpen size={18} className="text-dia-red" />
            <span>Résumé de la Semaine</span>
          </h4>
          <div className="space-y-3">
            <div className="flex justify-between items-center text-sm">
              <span className="text-neutral-500">Total Heures Prévues</span>
              <span className="font-bold">24h</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-neutral-500">Nombre de Classes</span>
              <span className="font-bold">{classes.length}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-neutral-500">Moyenne Étudiants/Classe</span>
              <span className="font-bold">12</span>
            </div>
          </div>
        </div>

        <div className="md:col-span-2 card p-6">
          <h4 className="font-bold mb-4 flex items-center gap-2">
            <Plus size={18} className="text-dia-red" />
            <span>Notes & Rappels</span>
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl bg-dia-yellow/5 border border-dia-yellow/20">
              <p className="text-xs font-bold text-dia-yellow uppercase tracking-wider mb-1">Examen Prochain</p>
              <p className="text-sm font-medium">Examen de mi-parcours pour la classe A1-A le Vendredi 20 Mars.</p>
            </div>
            <div className="p-4 rounded-2xl bg-blue-50 border border-blue-100">
              <p className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-1">Réunion Pédagogique</p>
              <p className="text-sm font-medium">Samedi à 10:00 avec la direction académique.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

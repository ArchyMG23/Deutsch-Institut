import React, { useState, useEffect } from 'react';
import { 
  Users, 
  GraduationCap, 
  Clock, 
  Calendar,
  BookOpen,
  ChevronRight,
  TrendingUp,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { ClassRoom, Teacher } from '../types';
import { formatCurrency } from '../utils';

export default function TeacherDashboard() {
  const { profile } = useAuth();
  const { classes, loading, refreshAll } = useData();

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  const teacher = profile as Teacher;
  const teacherClasses = classes.filter(c => c.teacherId === profile?.id);
  const totalStudents = teacherClasses.reduce((acc, curr) => acc + curr.studentIds.length, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-dia-red"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div className="relative overflow-hidden rounded-[32px] bg-dia-red p-8 text-white shadow-2xl shadow-dia-red/20">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <h2 className="text-3xl font-bold tracking-tight">Bonjour, {profile?.firstName}! 👋</h2>
            <p className="text-white/80 max-w-md">
              Prêt pour vos cours d'aujourd'hui ? Vous avez {teacherClasses.length} classes actives avec un total de {totalStudents} étudiants.
            </p>
          </div>
          <div className="flex gap-4">
            <div className="px-6 py-3 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20">
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/60 mb-1">Total Heures</p>
              <p className="text-2xl font-bold">{teacher.totalHoursWorked || 0}h</p>
            </div>
            <div className="px-6 py-3 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20">
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/60 mb-1">Taux Horaire</p>
              <p className="text-2xl font-bold">{formatCurrency(teacher.hourlyRate || 0)}</p>
            </div>
          </div>
        </div>
        {/* Decorative elements */}
        <div className="absolute -right-10 -top-10 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
        <div className="absolute -left-10 -bottom-10 w-64 h-64 bg-black/10 rounded-full blur-3xl"></div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card p-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Users size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-neutral-500">Mes Étudiants</p>
            <p className="text-2xl font-bold">{totalStudents}</p>
          </div>
        </div>
        <div className="card p-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-dia-yellow/10 text-dia-yellow flex items-center justify-center">
            <GraduationCap size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-neutral-500">Mes Classes</p>
            <p className="text-2xl font-bold">{teacherClasses.length}</p>
          </div>
        </div>
        <div className="card p-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-green-50 text-green-600 flex items-center justify-center">
            <Clock size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-neutral-500">Prochain Cours</p>
            <p className="text-lg font-bold">Aujourd'hui, 14:00</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* My Classes */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold tracking-tight">Mes Classes</h3>
            <button className="text-sm font-bold text-dia-red hover:underline">Voir tout</button>
          </div>
          <div className="space-y-4">
            {teacherClasses.length > 0 ? (
              teacherClasses.map((cls) => (
                <div key={cls.id} className="card p-5 group cursor-pointer hover:border-dia-red/30 transition-all">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-neutral-100 flex items-center justify-center font-bold text-neutral-600 group-hover:bg-dia-red group-hover:text-white transition-colors">
                        {cls.name}
                      </div>
                      <div>
                        <h4 className="font-bold text-neutral-900">{cls.name}</h4>
                        <p className="text-xs text-neutral-500">{cls.studentIds.length} étudiants • Niveau {cls.levelId}</p>
                      </div>
                    </div>
                    <ChevronRight size={20} className="text-neutral-300 group-hover:text-dia-red transition-colors" />
                  </div>
                </div>
              ))
            ) : (
              <div className="card p-8 text-center space-y-2">
                <AlertCircle className="mx-auto text-neutral-300" size={40} />
                <p className="text-neutral-500">Aucune classe assignée pour le moment.</p>
              </div>
            )}
          </div>
        </div>

        {/* Upcoming Schedule */}
        <div className="space-y-4">
          <h3 className="text-xl font-bold tracking-tight">Emploi du Temps</h3>
          <div className="card overflow-hidden">
            <div className="p-6 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/50">
              <div className="flex items-center gap-2">
                <Calendar size={18} className="text-dia-red" />
                <span className="font-bold text-sm uppercase tracking-wider">Cette Semaine</span>
              </div>
            </div>
            <div className="divide-y divide-neutral-100">
              {['Lundi', 'Mercredi', 'Vendredi'].map((day, i) => (
                <div key={day} className="p-5 flex items-center justify-between hover:bg-neutral-50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-white border border-neutral-100 flex flex-col items-center justify-center shadow-sm">
                      <span className="text-[10px] font-bold text-neutral-400 uppercase leading-none">{day.slice(0, 3)}</span>
                      <span className="text-sm font-bold text-neutral-900">{18 + i}</span>
                    </div>
                    <div>
                      <p className="font-bold text-sm">Cours d'Allemand A1</p>
                      <p className="text-xs text-neutral-500">08:00 - 10:00 • Salle 102</p>
                    </div>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-green-50 text-green-600 text-[10px] font-bold uppercase tracking-wider">
                    Confirmé
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

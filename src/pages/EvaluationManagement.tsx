import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Search, 
  Plus, 
  FileText, 
  Send, 
  Printer, 
  Trash2, 
  X, 
  CheckCircle2, 
  AlertTriangle,
  GraduationCap,
  Calendar,
  Layers,
  Users
} from 'lucide-react';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import { cn, formatCurrency } from '../utils';
import { Evaluation, Student, ClassRoom } from '../types';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { generateWhatsAppLink, generateMailtoLink, APP_NAME_FOR_LINKS } from '../utils/contactLinks';
import { Smartphone, Mail } from 'lucide-react';

export default function EvaluationManagement() {
  const { t } = useTranslation();
  const { students, classes, levels, evaluations, refreshEvaluations, refreshStudents, refreshClasses, refreshLevels, refreshAll } = useData();
  const { fetchWithAuth, profile } = useAuth();
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [selectedClass, setSelectedClass] = useState<ClassRoom | null>(null);
  const [submitting, setSubmitting] = useState(false);
  
  const [formData, setFormData] = useState({
    studentId: '',
    classId: '',
    type: 'sub-level' as 'sub-level' | 'end-of-level',
    date: new Date().toISOString().split('T')[0],
    modules: {
      lesen: 0,
      horen: 0,
      schreiben: 0,
      sprechen: 0
    },
    comments: '',
    status: 'draft' as 'draft' | 'published'
  });

  useEffect(() => {
    refreshEvaluations();
    refreshStudents();
    refreshClasses();
    refreshLevels();
  }, [refreshEvaluations, refreshStudents, refreshClasses, refreshLevels]);

  const filteredEvaluations = evaluations.filter(ev => 
    ev.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    ev.studentId.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleLevelChange = (classId: string) => {
    const cls = classes.find(c => c.id === classId);
    if (cls) {
      setSelectedClass(cls);
      setFormData(prev => ({ ...prev, classId }));
    }
  };

  const handleStudentSelect = (studentId: string) => {
    const student = students.find(s => s.uid === studentId);
    if (student) {
      setSelectedStudent(student);
      setFormData(prev => ({ ...prev, studentId }));
    }
  };

  const calculateResults = (modules: any) => {
    const total = Object.values(modules).reduce((a: any, b: any) => Number(a) + Number(b), 0) as number;
    const average = (total / 100) * 100; // Since total is out of 100
    return { total, average };
  };

  const handleAddEvaluation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.studentId || !formData.classId) {
      toast.error(t('evaluations.select_student_class'));
      return;
    }

    setSubmitting(true);
    const { total, average } = calculateResults(formData.modules);
    const student = students.find(s => s.uid === formData.studentId);
    
    const evaluationData = {
      ...formData,
      studentName: student ? `${student.firstName} ${student.lastName}` : t('common.unknown'),
      total,
      average,
      levelId: selectedClass?.levelId || 'A1'
    };

    try {
      const res = await fetchWithAuth('/api/evaluations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(evaluationData)
      });

      if (res.ok) {
        toast.success(t('evaluations.saved'));
        setIsAddModalOpen(false);
        refreshEvaluations();
      }
    } catch (err) {
      toast.error(t('common.error'));
    } finally {
      setSubmitting(false);
    }
  };

  const getGoetheGrade = (score: number) => {
    if (score >= 90) return { label: 'Sehr Gut', color: 'text-green-600' };
    if (score >= 80) return { label: 'Gut', color: 'text-blue-600' };
    if (score >= 70) return { label: 'Befriedigend', color: 'text-amber-600' };
    if (score >= 60) return { label: 'Ausreichend', color: 'text-orange-600' };
    return { label: 'Mangelhaft', color: 'text-red-600' };
  };

  const deleteEvaluation = async (id: string) => {
    if (!window.confirm(t('evaluations.confirm_delete'))) return;
    try {
      const res = await fetchWithAuth(`/api/evaluations/${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success(t('common.deleted'));
        refreshEvaluations();
      }
    } catch (err) {
      toast.error(t('common.error'));
    }
  };

  const sendEmailDirect = (evaluation: Evaluation) => {
    const student = students.find(s => s.uid === evaluation.studentId);
    if (!student || (!student.email && !student.parentEmail)) {
      toast.error(t('evaluations.no_email_found'));
      return;
    }

    const email = student.parentEmail || student.email || '';
    const grade = getGoetheGrade(evaluation.total);
    
    const subject = `[RÉSULTATS] Évaluation Goethe - ${evaluation.studentName}`;
    const body = `-----------------------------------------------\nRELEVÉ DE NOTES - ${APP_NAME_FOR_LINKS}\n-----------------------------------------------\n\n` +
      `Bonjour,\n\n` +
      `Voici les résultats de l'évaluation Goethe pour ${evaluation.studentName} :\n\n` +
      `- Module LESEN : ${evaluation.modules.lesen}/25\n` +
      `- Module HÖREN : ${evaluation.modules.horen}/25\n` +
      `- Module SCHREIBEN : ${evaluation.modules.schreiben}/25\n` +
      `- Module SPRECHEN : ${evaluation.modules.sprechen}/25\n\n` +
      `SCORE TOTAL : ${evaluation.total}/100\n` +
      `MENTION : ${grade.label}\n` +
      `RÉSULTAT : ${evaluation.total >= 60 ? 'RÉUSSI' : 'ÉCHEC'}\n\n` +
      `${evaluation.comments ? `Commentaires: ${evaluation.comments}\n\n` : ''}` +
      `Félicitations pour vos efforts !\n\nCordialement,\nL'administration de ${APP_NAME_FOR_LINKS}`;

    const a = document.createElement('a');
    a.href = generateMailtoLink(email, subject, body);
    a.click();
    toast.success(`${t('evaluations.report_sent')} ${email}`);
  };

  const generatePDF = (evaluation: Evaluation) => {
    const doc = new jsPDF();
    const student = students.find(s => s.uid === evaluation.studentId);
    const level = levels.find(l => l.id === evaluation.levelId);
    const grade = getGoetheGrade(evaluation.total);
    const cls = classes.find(c => c.id === evaluation.classId);

    // Header
    doc.setFillColor(227, 30, 36);
    doc.rect(0, 0, 210, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.text('DEUTSCH INSTITUT', 20, 20);
    doc.setFontSize(10);
    doc.text('Rapport d\'Évaluation Goethe-Zertifikat', 20, 30);
    
    // Student Info
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(`Candidat: ${evaluation.studentName}`, 20, 55);
    doc.setFont('helvetica', 'normal');
    doc.text(`Matricule: ${student?.matricule || 'N/A'}`, 20, 62);
    doc.text(`Niveau: ${level?.name || 'N/A'}`, 20, 69);
    doc.text(`Classe: ${cls?.name || 'N/A'}`, 20, 76);
    doc.text(`Date: ${new Date(evaluation.date).toLocaleDateString()}`, 140, 55);
    doc.text(`Type: ${evaluation.type === 'end-of-level' ? 'Examen Final' : 'Sous-Niveau'}`, 140, 62);

    // Table
    autoTable(doc, {
      startY: 85,
      head: [['Module', 'Points Max', 'Points Obtenus']],
      body: [
        ['Lesen (Lecture)', '25', evaluation.modules.lesen.toString()],
        ['Hören (Écoute)', '25', evaluation.modules.horen.toString()],
        ['Schreiben (Écriture)', '25', evaluation.modules.schreiben.toString()],
        ['Sprechen (Oral)', '25', evaluation.modules.sprechen.toString()],
      ],
      theme: 'grid',
      headStyles: { fillColor: [227, 30, 36] }
    });

    // Total
    const finalY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFont('helvetica', 'bold');
    doc.text(`Score Total: ${evaluation.total} / 100`, 20, finalY);
    doc.text(`Résultat: ${grade.label}`, 20, finalY + 7);
    doc.text(`Décision: ${evaluation.total >= 60 ? 'RÉUSSI (Bestanden)' : 'ÉCHEC (Nicht Bestanden)'}`, 20, finalY + 14);

    if (evaluation.comments) {
      doc.setFont('helvetica', 'normal');
      doc.text('Commentaires:', 20, finalY + 25);
      doc.setFontSize(10);
      const splitComments = doc.splitTextToSize(evaluation.comments, 170);
      doc.text(splitComments, 20, finalY + 32);
    }

    // Footer
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text('Document généré par DIA_SAAS - Système de Gestion Académique', 20, 280);
    
    doc.save(`Evaluation_${evaluation.studentName.replace(' ', '_')}.pdf`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{t('evaluations.title')}</h2>
          <p className="text-neutral-500">{t('evaluations.subtitle')}</p>
        </div>
        <button 
          onClick={() => setIsAddModalOpen(true)}
          className="btn-primary flex items-center justify-center gap-2"
        >
          <Plus size={20} />
          <span>{t('evaluations.new_evaluation')}</span>
        </button>
      </div>

      <div className="card p-6 bg-dia-red/5 border-dia-red/10 border">
        <h4 className="text-sm font-bold uppercase tracking-widest text-dia-red mb-4">{t('evaluations.group_actions')}</h4>
        <div className="flex flex-wrap gap-4 items-end">
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase text-neutral-400 ml-1">{t('evaluations.select_class')}</label>
            <select 
              className="px-4 py-2 bg-white dark:bg-neutral-800 border-none rounded-xl text-sm font-bold shadow-sm focus:ring-2 focus:ring-dia-red outline-none"
              onChange={(e) => setSelectedClass(classes.find(c => c.id === e.target.value) || null)}
            >
              <option value="">{t('evaluations.all_classes')}</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <button 
            onClick={async () => {
              if (!selectedClass) return toast.error(t('evaluations.error_select_class'));
              const classEvals = evaluations.filter(e => e.classId === selectedClass.id);
              if (classEvals.length === 0) return toast.error(t('evaluations.no_evaluations'));
              
              toast.info(`${t('evaluations.preparing_reports')} ${classEvals.length}...`);
              for (const ev of classEvals) {
                sendEmailDirect(ev);
              }
              toast.success(t('evaluations.group_sent_finished'));
            }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-all shadow-md"
          >
            <Send size={14} />
            <span>{t('evaluations.send_reports_class')}</span>
          </button>
          <button 
            onClick={() => {
              if (!selectedClass) return toast.error(t('evaluations.error_select_class'));
              const classEvals = evaluations.filter(e => e.classId === selectedClass.id);
              if (classEvals.length === 0) return toast.error(t('evaluations.no_evaluations'));
              
              classEvals.forEach(ev => generatePDF(ev));
              toast.success(`${t('evaluations.printing_reports_started')} ${classEvals.length}`);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-dia-red text-white rounded-xl text-xs font-bold hover:bg-dia-red/90 transition-all shadow-md"
          >
            <Printer size={14} />
            <span>{t('evaluations.print_reports_class')}</span>
          </button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1 group">
          <input 
            type="text" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('evaluations.search_placeholder')}
            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-neutral-800 border-none rounded-lg focus:ring-2 focus:ring-dia-red transition-all"
          />
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 group-focus-within:text-dia-red transition-colors pointer-events-none" size={18} />
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-neutral-50 dark:bg-neutral-800/50 border-b border-neutral-200 dark:border-neutral-800">
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-neutral-500">{t('common.student')}</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-neutral-500">Type / Date</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-neutral-500">Modules (L/H/Sch/Spr)</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-neutral-500">{t('evaluations.total_score')}</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-neutral-500">{t('evaluations.result')}</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-neutral-500 text-right">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {filteredEvaluations.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-neutral-500">{t('common.no_results')}</td>
                </tr>
              ) : (
                filteredEvaluations.map((ev) => {
                  const grade = getGoetheGrade(ev.total);
                  return (
                    <tr key={ev.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-dia-red/10 text-dia-red flex items-center justify-center font-bold text-xs">
                            {ev.studentName[0]}
                          </div>
                          <div>
                            <p className="font-bold text-sm">{ev.studentName}</p>
                            <p className="text-[10px] text-neutral-400 uppercase font-bold">{ev.studentId}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-xs font-bold">{ev.type === 'end-of-level' ? t('evaluations.end_level') : t('evaluations.sub_level')}</p>
                        <p className="text-[10px] text-neutral-400">{new Date(ev.date).toLocaleDateString()}</p>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          <span className="px-1.5 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 text-[10px] rounded font-bold">{ev.modules.lesen}</span>
                          <span className="px-1.5 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 text-[10px] rounded font-bold">{ev.modules.horen}</span>
                          <span className="px-1.5 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 text-[10px] rounded font-bold">{ev.modules.schreiben}</span>
                          <span className="px-1.5 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 text-[10px] rounded font-bold">{ev.modules.sprechen}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm font-bold text-dia-red">{ev.total}/100</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={cn("text-xs font-bold", grade.color)}>{grade.label}</span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button 
                            onClick={() => {
                              const grade = getGoetheGrade(ev.total);
                              const msg = `━━━━━━━━━━━━━━━━━━━━━━━\n📊 *RELEVÉ DE NOTES*\n*${APP_NAME_FOR_LINKS}*\n━━━━━━━━━━━━━━━━━━━━━━━\n\nFélicitations ! Les résultats de l'évaluation sont disponibles.\n\n👤 *Étudiant* : ${ev.studentName}\n📝 *Module* : ${ev.moduleName || 'Examen'}\n\n⭐ *SCORE FINAL* : *${ev.total}/100*\n🏆 *Mention* : ${grade.label}\n\nContinuez vos efforts ! 💪\n━━━━━━━━━━━━━━━━━━━━━━━`;
                              const student = students.find(s => s.uid === ev.studentId);
                              const a = document.createElement('a');
                              a.href = generateWhatsAppLink(student?.parentPhone || student?.phone || '', msg);
                              a.target = '_blank';
                              a.click();
                            }}
                            className="p-2 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg text-green-600 transition-colors"
                            title="Share via WhatsApp"
                          >
                            <Smartphone size={16} />
                          </button>
                          <button onClick={() => sendEmailDirect(ev)} className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg text-neutral-500 hover:text-blue-600 transition-colors" title={t('common.send_email')}>
                            <Mail size={16} />
                          </button>
                          <button onClick={() => generatePDF(ev)} className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg text-neutral-500 hover:text-dia-red transition-colors" title={t('evaluations.print_report')}>
                            <Printer size={16} />
                          </button>
                          {profile?.role === 'admin' && (
                            <button onClick={() => deleteEvaluation(ev.id)} className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg text-neutral-400 hover:text-red-500 transition-colors" title={t('common.delete')}>
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-neutral-900 w-full max-w-2xl rounded-[32px] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-8 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
              <h3 className="text-2xl font-bold tracking-tight">{t('evaluations.new_evaluation')}</h3>
              <button onClick={() => setIsAddModalOpen(false)} className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition-colors">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleAddEvaluation} className="p-8 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">{t('common.class')} / {t('common.level')}</label>
                  <select 
                    required
                    onChange={(e) => handleLevelChange(e.target.value)}
                    className="w-full px-5 py-3 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-2xl focus:ring-2 focus:ring-dia-red/20 outline-none"
                  >
                    <option value="">{t('evaluations.select_class_opt')}</option>
                    {classes.map(c => <option key={c.id} value={c.id}>{c.name} ({levels.find(l => l.id === c.levelId)?.name})</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">{t('common.student')}</label>
                  <select 
                    required
                    onChange={(e) => handleStudentSelect(e.target.value)}
                    className="w-full px-5 py-3 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-2xl focus:ring-2 focus:ring-dia-red/20 outline-none"
                  >
                    <option value="">{t('evaluations.select_student_opt')}</option>
                    {selectedClass ? (
                      students
                        .filter(s => s.classId === selectedClass.id)
                        .map(s => <option key={s.uid} value={s.uid}>{s.firstName} {s.lastName}</option>)
                    ) : (
                      <option disabled>{t('evaluations.select_class_first')}</option>
                    )}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">{t('evaluations.eval_type')}</label>
                  <select 
                    value={formData.type}
                    onChange={(e) => setFormData({...formData, type: e.target.value as any})}
                    className="w-full px-5 py-3 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-2xl focus:ring-2 focus:ring-dia-red/20 outline-none"
                  >
                    <option value="sub-level">{t('evaluations.sub_level_opt')}</option>
                    <option value="end-of-level">{t('evaluations.end_level_opt')}</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">Date</label>
                  <input 
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({...formData, date: e.target.value})}
                    className="w-full px-5 py-3 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-2xl focus:ring-2 focus:ring-dia-red/20 outline-none"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400 border-b pb-2">{t('evaluations.modules_header')}</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold ml-1">LESEN</label>
                    <input 
                      type="number" min="0" max="25" 
                      value={formData.modules.lesen}
                      onChange={(e) => setFormData({...formData, modules: {...formData.modules, lesen: Number(e.target.value)}})}
                      className="w-full px-4 py-2 bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800 rounded-xl outline-none" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold ml-1">HÖREN</label>
                    <input 
                      type="number" min="0" max="25" 
                      value={formData.modules.horen}
                      onChange={(e) => setFormData({...formData, modules: {...formData.modules, horen: Number(e.target.value)}})}
                      className="w-full px-4 py-2 bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800 rounded-xl outline-none" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold ml-1">SCHREIBEN</label>
                    <input 
                      type="number" min="0" max="25" 
                      value={formData.modules.schreiben}
                      onChange={(e) => setFormData({...formData, modules: {...formData.modules, schreiben: Number(e.target.value)}})}
                      className="w-full px-4 py-2 bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800 rounded-xl outline-none" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold ml-1">SPRECHEN</label>
                    <input 
                      type="number" min="0" max="25" 
                      value={formData.modules.sprechen}
                      onChange={(e) => setFormData({...formData, modules: {...formData.modules, sprechen: Number(e.target.value)}})}
                      className="w-full px-4 py-2 bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800 rounded-xl outline-none" />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 ml-1">{t('evaluations.comments_label')}</label>
                <textarea 
                  rows={2}
                  value={formData.comments}
                  onChange={(e) => setFormData({...formData, comments: e.target.value})}
                  className="w-full px-5 py-3 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-2xl focus:ring-2 focus:ring-dia-red/20 outline-none resize-none"
                  placeholder={t('evaluations.comments_placeholder')}
                />
              </div>

              <div className="flex gap-4">
                <button type="button" onClick={() => setIsAddModalOpen(false)} className="flex-1 px-6 py-4 bg-neutral-100 dark:bg-neutral-800 rounded-2xl font-bold transition-all hover:bg-neutral-200">{t('common.cancel')}</button>
                <button 
                  type="submit" 
                  disabled={submitting}
                  className="flex-1 btn-primary py-4 flex items-center justify-center gap-2"
                >
                  {submitting ? t('common.processing') : t('evaluations.validate_eval')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

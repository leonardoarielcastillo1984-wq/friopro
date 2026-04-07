'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import type { Training } from '@/lib/types';
import {
  ArrowLeft, Edit3, Trash2, AlertCircle, GraduationCap,
  Calendar, Clock, Users, MapPin, User, Shield,
  CheckCircle2, PlayCircle, XCircle, UserPlus, X, Star,
} from 'lucide-react';

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  SCHEDULED: { label: 'Programada', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
  IN_PROGRESS: { label: 'En curso', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
  COMPLETED: { label: 'Completada', color: 'text-green-700', bg: 'bg-green-50 border-green-200' },
  CANCELLED: { label: 'Cancelada', color: 'text-neutral-500', bg: 'bg-neutral-100 border-neutral-200' },
};

const MODALITY_MAP: Record<string, string> = {
  PRESENCIAL: 'Presencial', VIRTUAL: 'Virtual', MIXTA: 'Mixta', E_LEARNING: 'E-Learning',
};

type Attendee = {
  id: string;
  employeeId?: string;
  userId?: string;
  user?: { id: string; email: string; firstName?: string; lastName?: string } | null;
  employee?: { id: string; email: string; firstName?: string; lastName?: string } | null;
  attended: boolean;
  signatureData?: string | null;
  attendanceMarkedAt?: string | null;
  quizScore?: number | null;
  quizPassed?: boolean;
  quizCompletedAt?: string | null;
  createdAt: string;
};

type TrainingDetail = Training & {
  attendees?: Attendee[];
  completedDate?: string | null;
  instructor?: string | null;
  location?: string | null;
};

export default function TrainingDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [training, setTraining] = useState<TrainingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [editing, setEditing] = useState(false);
  const [showAddAttendees, setShowAddAttendees] = useState(false);
  const [availableEmployees, setAvailableEmployees] = useState<{id: string, firstName: string, lastName: string, email: string, userId?: string}[]>([]);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
  const [markingAttendance, setMarkingAttendance] = useState<string | null>(null);
  const [showQuiz, setShowQuiz] = useState<string | null>(null);
  const [showSatisfaction, setShowSatisfaction] = useState(false);
  const [showReschedule, setShowReschedule] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [showComplete, setShowComplete] = useState(false);
  const [showAttendanceSheet, setShowAttendanceSheet] = useState(false);
  const [quizQuestions, setQuizQuestions] = useState<any[]>([]);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, number>>({});
  const [rescheduleForm, setRescheduleForm] = useState({ newDate: '', reason: '' });
  const [cancelReason, setCancelReason] = useState('');
  const [completionDate, setCompletionDate] = useState('');
  const [satisfactionForm, setSatisfactionForm] = useState({
    contentRelevance: 0,
    instructorQuality: 0,
    materialsQuality: 0,
    methodologyQuality: 0,
    overallSatisfaction: 0,
    comments: '',
  });
  const [submittingQuiz, setSubmittingQuiz] = useState(false);
  const [editForm, setEditForm] = useState({
    status: '',
    instructor: '',
    location: '',
    durationHours: 0,
  });

  useEffect(() => { loadTraining(); }, [id]);

  async function loadTraining() {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<{ training: TrainingDetail }>(`/trainings/${id}`);
      setTraining(res.training);
      setEditForm({
        status: res.training.status,
        instructor: res.training.instructor || '',
        location: res.training.location || '',
        durationHours: res.training.durationHours,
      });
    } catch (err: any) {
      setError(err?.message ?? 'Error al cargar capacitación');
      if (err?.message === 'Unauthorized') router.push('/login');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await apiFetch<{ training: TrainingDetail }>(`/trainings/${id}`, {
        method: 'PATCH',
        json: editForm,
      });
      setTraining(res.training);
      setEditing(false);
    } catch (err: any) {
      setError(err?.message ?? 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm('¿Estás seguro de eliminar esta capacitación?')) return;
    try {
      await apiFetch(`/trainings/${id}`, { method: 'DELETE' });
      router.push('/capacitaciones');
    } catch (err: any) {
      setError(err?.message ?? 'Error al eliminar');
    }
  }

  async function loadAvailableEmployees() {
    try {
      const res = await apiFetch<{ employees: {id: string, firstName: string, lastName: string, email: string}[] }>('/hr/employees');
      // Filter out already registered attendees by employeeId
      const attendeeIds = new Set(training?.attendees?.map(a => a.employeeId).filter(Boolean) || []);
      setAvailableEmployees(res.employees?.filter(e => !attendeeIds.has(e.id)) || []);
    } catch (err: any) {
      console.error('Error loading employees:', err);
    }
  }

  async function handleAddAttendees() {
    if (selectedEmployeeIds.length === 0) return;
    try {
      await apiFetch(`/trainings/${id}/attendees`, {
        method: 'POST',
        json: { employeeIds: selectedEmployeeIds },
      });
      await loadTraining();
      setShowAddAttendees(false);
      setSelectedEmployeeIds([]);
    } catch (err: any) {
      setError(err?.message ?? 'Error al agregar asistentes');
    }
  }

  async function markAttendance(attendeeId: string, attended: boolean) {
    try {
      await apiFetch(`/trainings/${id}/attendees/${attendeeId}/attendance`, {
        method: 'PATCH',
        json: { attended },
      });
      await loadTraining();
    } catch (err: any) {
      setError(err?.message ?? 'Error al marcar asistencia');
    }
  }

  async function handleRemoveAttendee(attendeeId: string) {
    if (!confirm('¿Quitar este asistente de la capacitación?')) return;
    try {
      await apiFetch(`/trainings/${id}/attendees/${attendeeId}`, {
        method: 'DELETE',
      });
      await loadTraining();
    } catch (err: any) {
      setError(err?.message ?? 'Error al quitar asistente');
    }
  }

  async function loadQuiz(attendeeId: string) {
    try {
      const res = await apiFetch<{ questions: any[] }>(`/trainings/${id}/quiz-questions`);
      setQuizQuestions(res.questions);
      setShowQuiz(attendeeId);
      setQuizAnswers({});
    } catch (err: any) {
      setError(err?.message ?? 'Error al cargar quiz');
    }
  }

  async function submitQuiz() {
    if (!showQuiz) return;
    const answeredCount = Object.keys(quizAnswers).length;
    if (answeredCount < quizQuestions.length) {
      setError(`Responde todas las preguntas (${answeredCount}/${quizQuestions.length})`);
      return;
    }
    
    setSubmittingQuiz(true);
    try {
      let correct = 0;
      quizQuestions.forEach((q, idx) => {
        if (quizAnswers[`q${idx}`] === q.correctAnswer) correct++;
      });
      const score = Math.round((correct / quizQuestions.length) * 100);
      
      await apiFetch(`/trainings/${id}/quiz`, {
        method: 'POST',
        json: { attendeeId: showQuiz, score },
      });
      
      setShowQuiz(null);
      setQuizAnswers({});
      await loadTraining();
    } catch (err: any) {
      setError(err?.message ?? 'Error al enviar quiz');
    } finally {
      setSubmittingQuiz(false);
    }
  }

  async function handleReschedule() {
    if (!rescheduleForm.newDate || !rescheduleForm.reason) return;
    try {
      await apiFetch(`/trainings/${id}/reschedule`, {
        method: 'POST',
        json: rescheduleForm,
      });
      setShowReschedule(false);
      setRescheduleForm({ newDate: '', reason: '' });
      await loadTraining();
    } catch (err: any) {
      setError(err?.message ?? 'Error al reprogramar');
    }
  }

  async function handleCancel() {
    if (!cancelReason) return;
    try {
      await apiFetch(`/trainings/${id}/cancel`, {
        method: 'POST',
        json: { reason: cancelReason },
      });
      setShowCancel(false);
      setCancelReason('');
      await loadTraining();
    } catch (err: any) {
      setError(err?.message ?? 'Error al cancelar');
    }
  }

  async function handleComplete() {
    try {
      await apiFetch(`/trainings/${id}/complete`, {
        method: 'POST',
        json: completionDate ? { completionDate } : {},
      });
      setShowComplete(false);
      setCompletionDate('');
      await loadTraining();
    } catch (err: any) {
      setError(err?.message ?? 'Error al completar');
    }
  }

  async function submitSatisfaction() {
    if (satisfactionForm.overallSatisfaction === 0) {
      setError('Por favor califique la satisfacción general');
      return;
    }
    try {
      await apiFetch(`/trainings/${id}/satisfaction`, {
        method: 'POST',
        json: satisfactionForm,
      });
      setShowSatisfaction(false);
      setSatisfactionForm({
        contentRelevance: 0,
        instructorQuality: 0,
        materialsQuality: 0,
        methodologyQuality: 0,
        overallSatisfaction: 0,
        comments: '',
      });
      await loadTraining();
    } catch (err: any) {
      setError(err?.message ?? 'Error al enviar evaluación');
    }
  }

  useEffect(() => {
    if (showAddAttendees) {
      loadAvailableEmployees();
    }
  }, [showAddAttendees]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
      </div>
    );
  }

  if (!training) {
    return (
      <div className="p-6">
        <p className="text-red-600">{error || 'Capacitación no encontrada'}</p>
        <button onClick={() => router.push('/capacitaciones')} className="mt-2 text-blue-600 text-sm hover:underline">
          ← Volver a capacitaciones
        </button>
      </div>
    );
  }

  const stCfg = STATUS_CONFIG[training.status] ?? STATUS_CONFIG.SCHEDULED;
  const attendees = training.attendees ?? [];
  const attendedCount = attendees.filter(a => a.attended).length;

  return (
    <div className="max-w-[1000px] mx-auto space-y-6">
      {/* Back + Actions */}
      <div className="flex items-center justify-between">
        <button onClick={() => router.push('/capacitaciones')} className="flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-800 transition-colors">
          <ArrowLeft className="h-4 w-4" /> Capacitaciones
        </button>
        <div className="flex items-center gap-2">
          {/* Action Buttons based on status */}
          {training.status === 'SCHEDULED' && (
            <>
              <button 
                onClick={() => setShowReschedule(true)}
                className="flex items-center gap-1.5 rounded-lg bg-amber-100 px-3 py-2 text-sm text-amber-700 hover:bg-amber-200"
              >
                <Calendar className="h-4 w-4" /> Reprogramar
              </button>
              <button 
                onClick={() => setShowComplete(true)}
                className="flex items-center gap-1.5 rounded-lg bg-green-100 px-3 py-2 text-sm text-green-700 hover:bg-green-200"
              >
                <CheckCircle2 className="h-4 w-4" /> Completar
              </button>
              <button 
                onClick={() => setShowCancel(true)}
                className="flex items-center gap-1.5 rounded-lg bg-red-100 px-3 py-2 text-sm text-red-700 hover:bg-red-200"
              >
                <XCircle className="h-4 w-4" /> Cancelar
              </button>
            </>
          )}
          <button 
            onClick={() => setShowAttendanceSheet(true)}
            className="flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-600 hover:bg-neutral-50"
          >
            <Users className="h-4 w-4" /> Lista de Asistencia
          </button>
          <button 
            onClick={() => setShowSatisfaction(true)}
            className="flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-600 hover:bg-neutral-50"
          >
            <Star className="h-4 w-4" /> Evaluar
          </button>
          <button onClick={() => setEditing(!editing)} className="flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-600 hover:bg-neutral-50">
            <Edit3 className="h-4 w-4" /> {editing ? 'Cancelar' : 'Editar'}
          </button>
          <button onClick={handleDelete} className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm text-red-600 hover:bg-red-50">
            <Trash2 className="h-4 w-4" /> Eliminar
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 flex-shrink-0" /> {error}
        </div>
      )}

      {/* Header Card */}
      <div className="bg-white rounded-xl border border-neutral-200 p-6">
        <div className="flex items-start gap-4">
          <div className="rounded-lg bg-indigo-50 p-3">
            <GraduationCap className="h-6 w-6 text-indigo-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-xs text-neutral-400 bg-neutral-100 px-2 py-0.5 rounded">{training.code}</span>
              <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${stCfg.bg} ${stCfg.color}`}>{stCfg.label}</span>
              <span className="text-xs text-neutral-400 bg-neutral-100 px-2 py-0.5 rounded">{training.category}</span>
              <span className="text-xs text-neutral-400 bg-neutral-100 px-2 py-0.5 rounded">{MODALITY_MAP[training.modality] || training.modality}</span>
            </div>
            <h1 className="mt-2 text-xl font-semibold text-neutral-900">{training.title}</h1>
            {training.description && <p className="mt-1 text-sm text-neutral-600">{training.description}</p>}
            <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-neutral-400">
              {training.standard && <span className="flex items-center gap-1"><Shield className="h-3 w-3" /> {training.standard}</span>}
              <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {training.durationHours}h</span>
              <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {attendees.length}/{training.expectedParticipants} participantes</span>
              {training.coordinator && <span className="flex items-center gap-1"><User className="h-3 w-3" /> {training.coordinator.email}</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-neutral-200 p-5">
          <div className="flex items-center gap-2 text-neutral-500 text-xs mb-2"><Calendar className="h-4 w-4" /> Fecha programada</div>
          <p className="text-sm font-medium text-neutral-900">
            {training.scheduledDate ? new Date(training.scheduledDate).toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' }) : 'Sin programar'}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-neutral-200 p-5">
          <div className="flex items-center gap-2 text-neutral-500 text-xs mb-2"><MapPin className="h-4 w-4" /> Lugar</div>
          <p className="text-sm font-medium text-neutral-900">{training.location || 'No especificado'}</p>
        </div>
        <div className="bg-white rounded-xl border border-neutral-200 p-5">
          <div className="flex items-center gap-2 text-neutral-500 text-xs mb-2"><User className="h-4 w-4" /> Instructor</div>
          <p className="text-sm font-medium text-neutral-900">{training.instructor || 'No asignado'}</p>
        </div>
      </div>

      {/* Edit Form */}
      {editing && (
        <div className="bg-white rounded-xl border border-neutral-200 p-6 space-y-4">
          <h2 className="font-semibold text-neutral-900">Editar Capacitación</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Estado</label>
              <select className="w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-sm" value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}>
                {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Duración (horas)</label>
              <input type="number" min={1} className="w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-sm" value={editForm.durationHours} onChange={(e) => setEditForm({ ...editForm, durationHours: Number(e.target.value) })} />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Instructor</label>
              <input className="w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-sm" value={editForm.instructor} onChange={(e) => setEditForm({ ...editForm, instructor: e.target.value })} placeholder="Nombre del instructor" />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Lugar</label>
              <input className="w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-sm" value={editForm.location} onChange={(e) => setEditForm({ ...editForm, location: e.target.value })} placeholder="Ubicación" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={saving} className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">
              {saving ? 'Guardando...' : 'Guardar cambios'}
            </button>
            <button onClick={() => setEditing(false)} className="text-sm text-neutral-500 hover:text-neutral-700 px-3">Cancelar</button>
          </div>
        </div>
      )}

      {/* Attendees */}
      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
        <div className="p-5 border-b border-neutral-200 flex items-center justify-between">
          <h2 className="font-semibold text-neutral-900 flex items-center gap-2">
            <Users className="h-4 w-4 text-neutral-500" /> Asistentes
            <span className="text-xs bg-neutral-100 text-neutral-500 px-2 py-0.5 rounded-full">{attendees.length}</span>
          </h2>
          <div className="flex items-center gap-2">
            {training.status === 'COMPLETED' && (
              <span className="text-xs text-green-600 flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" /> {attendedCount}/{attendees.length} asistieron
              </span>
            )}
            <button 
              onClick={() => setShowAddAttendees(true)}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700"
            >
              <UserPlus className="h-4 w-4" /> Agregar
            </button>
          </div>
        </div>
        {attendees.length === 0 ? (
          <div className="py-10 text-center">
            <Users className="h-8 w-8 text-neutral-200 mx-auto mb-2" />
            <p className="text-sm text-neutral-400">Sin asistentes registrados</p>
            <button 
              onClick={() => setShowAddAttendees(true)}
              className="mt-2 text-sm text-blue-600 hover:underline"
            >
              Agregar primer asistente
            </button>
          </div>
        ) : (
          <div className="divide-y divide-neutral-100">
            {attendees.map(a => {
              const displayEmail = a.user?.email || a.employee?.email || 'Sin email';
              const displayName = a.user?.firstName || a.employee?.firstName || a.user?.email?.split('@')[0] || a.employee?.email?.split('@')[0] || 'Asistente';
              const displayLastName = a.user?.lastName || a.employee?.lastName || '';
              return (
              <div key={a.id} className="px-5 py-3 flex items-center justify-between hover:bg-neutral-50">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-100 text-xs font-medium text-neutral-600">
                    {displayName.charAt(0).toUpperCase()}{displayLastName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <span className="text-sm text-neutral-800">{displayName} {displayLastName}</span>
                    <p className="text-xs text-neutral-500">{displayEmail}</p>
                    {a.attendanceMarkedAt && (
                      <p className="text-xs text-neutral-400">
                        Registrado: {new Date(a.attendanceMarkedAt).toLocaleDateString('es-AR')}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {/* Quiz Status */}
                  {a.quizCompletedAt ? (
                    <span className={`text-xs px-2 py-0.5 rounded-full ${a.quizPassed ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {a.quizPassed ? '✓ Quiz' : '✗ Quiz'} {a.quizScore}%
                    </span>
                  ) : (
                    <button 
                      onClick={() => loadQuiz(a.id)}
                      className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100"
                    >
                      Tomar Quiz
                    </button>
                  )}

                  <button
                    onClick={() => handleRemoveAttendee(a.id)}
                    className="flex items-center gap-1 rounded-md border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                    aria-label="Quitar asistente"
                    title="Quitar asistente"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Quitar
                  </button>
                  
                  {/* Attendance Checkbox */}
                  <label className="flex items-center gap-1.5 cursor-pointer px-2 py-1 rounded hover:bg-neutral-100">
                    <input 
                      type="checkbox" 
                      checked={a.attended}
                      onChange={(e) => markAttendance(a.id, e.target.checked)}
                      className="h-4 w-4 rounded border-neutral-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className={`text-xs ${a.attended ? 'text-green-600' : 'text-neutral-400'}`}>
                      {a.attended ? 'Asistió' : 'No asistió'}
                    </span>
                  </label>
                </div>
              </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Attendees Modal */}
      {showAddAttendees && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full max-h-[80vh] flex flex-col">
            <div className="p-4 border-b border-neutral-200 flex items-center justify-between">
              <h3 className="font-semibold text-neutral-900">Agregar Asistentes</h3>
              <button 
                onClick={() => setShowAddAttendees(false)}
                className="p-1 hover:bg-neutral-100 rounded-lg"
              >
                <X className="h-5 w-5 text-neutral-500" />
              </button>
            </div>
            <div className="p-4 flex-1 overflow-y-auto">
              {availableEmployees.length === 0 ? (
                <p className="text-sm text-neutral-500 text-center py-4">
                  No hay empleados disponibles para agregar
                </p>
              ) : (
                <div className="space-y-2">
                  {availableEmployees.map(emp => (
                    <label 
                      key={emp.id} 
                      className="flex items-center gap-3 p-3 border border-neutral-200 rounded-lg hover:bg-neutral-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedEmployeeIds.includes(emp.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedEmployeeIds([...selectedEmployeeIds, emp.id]);
                          } else {
                            setSelectedEmployeeIds(selectedEmployeeIds.filter(id => id !== emp.id));
                          }
                        }}
                        className="h-4 w-4 rounded border-neutral-300"
                      />
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-100 text-xs font-medium text-neutral-600">
                        {emp.firstName.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-neutral-900">{emp.firstName} {emp.lastName}</p>
                        <p className="text-xs text-neutral-500">{emp.email}</p>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>
            <div className="p-4 border-t border-neutral-200 flex justify-end gap-2">
              <button 
                onClick={() => setShowAddAttendees(false)}
                className="px-4 py-2 text-sm text-neutral-600 hover:bg-neutral-100 rounded-lg"
              >
                Cancelar
              </button>
              <button 
                onClick={handleAddAttendees}
                disabled={selectedEmployeeIds.length === 0}
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                Agregar {selectedEmployeeIds.length > 0 ? `(${selectedEmployeeIds.length})` : ''}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Quiz Modal */}
      {showQuiz && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
            <div className="p-4 border-b border-neutral-200 flex items-center justify-between">
              <h3 className="font-semibold text-neutral-900">Evaluación de Aprendizaje - ISO 9001:2015</h3>
              <button 
                onClick={() => setShowQuiz(null)}
                className="p-1 hover:bg-neutral-100 rounded-lg"
              >
                <X className="h-5 w-5 text-neutral-500" />
              </button>
            </div>
            <div className="p-4 flex-1 overflow-y-auto">
              <p className="text-sm text-neutral-500 mb-4">
                Complete esta evaluación para verificar la comprensión de la capacitación. 
                Se requiere 70% para aprobar.
              </p>
              <div className="space-y-4">
                {quizQuestions.map((q, idx) => (
                  <div key={q.id} className="p-4 border border-neutral-200 rounded-lg">
                    <p className="font-medium text-sm text-neutral-900 mb-3">
                      {idx + 1}. {q.question}
                    </p>
                    <div className="space-y-2">
                      {q.options.map((opt: string, optIdx: number) => (
                        <label key={optIdx} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name={`question-${idx}`}
                            checked={quizAnswers[`q${idx}`] === optIdx}
                            onChange={() => setQuizAnswers({ ...quizAnswers, [`q${idx}`]: optIdx })}
                            className="h-4 w-4 text-blue-600"
                          />
                          <span className="text-sm text-neutral-700">{opt}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="p-4 border-t border-neutral-200 flex justify-end gap-2">
              <button 
                onClick={() => setShowQuiz(null)}
                className="px-4 py-2 text-sm text-neutral-600 hover:bg-neutral-100 rounded-lg"
              >
                Cancelar
              </button>
              <button 
                onClick={submitQuiz}
                disabled={submittingQuiz}
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {submittingQuiz ? 'Enviando...' : 'Enviar Evaluación'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reschedule Modal */}
      {showReschedule && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full">
            <div className="p-4 border-b border-neutral-200">
              <h3 className="font-semibold text-neutral-900">Reprogramar Capacitación</h3>
              <p className="text-sm text-neutral-500">Indique la nueva fecha y el motivo</p>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Nueva Fecha y Hora</label>
                <input 
                  type="datetime-local" 
                  value={rescheduleForm.newDate}
                  onChange={(e) => setRescheduleForm({...rescheduleForm, newDate: e.target.value})}
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Motivo de Reprogramación</label>
                <textarea 
                  value={rescheduleForm.reason}
                  onChange={(e) => setRescheduleForm({...rescheduleForm, reason: e.target.value})}
                  placeholder="Ej: Conflicto de horario, instructor no disponible..."
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm h-20 resize-none"
                />
              </div>
            </div>
            <div className="p-4 border-t border-neutral-200 flex justify-end gap-2">
              <button onClick={() => setShowReschedule(false)} className="px-4 py-2 text-sm text-neutral-600 hover:bg-neutral-100 rounded-lg">Cancelar</button>
              <button 
                onClick={handleReschedule}
                disabled={!rescheduleForm.newDate || !rescheduleForm.reason}
                className="px-4 py-2 bg-amber-600 text-white text-sm rounded-lg hover:bg-amber-700 disabled:opacity-50"
              >
                Reprogramar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Modal */}
      {showCancel && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full">
            <div className="p-4 border-b border-neutral-200">
              <h3 className="font-semibold text-neutral-900 text-red-600">Cancelar Capacitación</h3>
              <p className="text-sm text-neutral-500">Esta acción no se puede deshacer</p>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Motivo de Cancelación *</label>
                <textarea 
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Ej: Falta de quorum, problema logístico..."
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm h-24 resize-none"
                />
              </div>
            </div>
            <div className="p-4 border-t border-neutral-200 flex justify-end gap-2">
              <button onClick={() => setShowCancel(false)} className="px-4 py-2 text-sm text-neutral-600 hover:bg-neutral-100 rounded-lg">Volver</button>
              <button 
                onClick={handleCancel}
                disabled={!cancelReason}
                className="px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                Confirmar Cancelación
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Complete Modal */}
      {showComplete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full">
            <div className="p-4 border-b border-neutral-200">
              <h3 className="font-semibold text-neutral-900 text-green-600">Completar Capacitación</h3>
              <p className="text-sm text-neutral-500">Marcar como realizada exitosamente</p>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Fecha de Realización (opcional)</label>
                <input 
                  type="date" 
                  value={completionDate}
                  onChange={(e) => setCompletionDate(e.target.value)}
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                />
                <p className="text-xs text-neutral-400 mt-1">Si no se indica, se usa la fecha actual</p>
              </div>
            </div>
            <div className="p-4 border-t border-neutral-200 flex justify-end gap-2">
              <button onClick={() => setShowComplete(false)} className="px-4 py-2 text-sm text-neutral-600 hover:bg-neutral-100 rounded-lg">Cancelar</button>
              <button 
                onClick={handleComplete}
                className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700"
              >
                Confirmar Completada
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Satisfaction Survey Modal */}
      {showSatisfaction && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] flex flex-col">
            <div className="p-4 border-b border-neutral-200">
              <h3 className="font-semibold text-neutral-900">Evaluación de Satisfacción</h3>
              <p className="text-sm text-neutral-500">ISO 9001:2015 - Retroalimentación del participante</p>
            </div>
            <div className="p-4 flex-1 overflow-y-auto space-y-4">
              {[
                { key: 'contentRelevance', label: 'Relevancia del contenido' },
                { key: 'instructorQuality', label: 'Calidad del instructor' },
                { key: 'materialsQuality', label: 'Calidad de materiales' },
                { key: 'methodologyQuality', label: 'Calidad de metodología' },
                { key: 'overallSatisfaction', label: 'Satisfacción general' },
              ].map((item) => (
                <div key={item.key}>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">{item.label}</label>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        onClick={() => setSatisfactionForm({...satisfactionForm, [item.key]: star})}
                        className={`p-1 ${(satisfactionForm as any)[item.key] >= star ? 'text-yellow-400' : 'text-neutral-200'}`}
                      >
                        <Star className="h-6 w-6 fill-current" />
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Comentarios adicionales</label>
                <textarea 
                  value={satisfactionForm.comments}
                  onChange={(e) => setSatisfactionForm({...satisfactionForm, comments: e.target.value})}
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm h-20 resize-none"
                  placeholder="¿Qué fue lo mejor? ¿Qué se puede mejorar?"
                />
              </div>
            </div>
            <div className="p-4 border-t border-neutral-200 flex justify-end gap-2">
              <button onClick={() => setShowSatisfaction(false)} className="px-4 py-2 text-sm text-neutral-600 hover:bg-neutral-100 rounded-lg">Cancelar</button>
              <button 
                onClick={submitSatisfaction}
                disabled={satisfactionForm.overallSatisfaction === 0}
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                Enviar Evaluación
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Attendance Sheet Modal */}
      {showAttendanceSheet && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-3xl w-full max-h-[90vh] flex flex-col">
            <div className="p-4 border-b border-neutral-200 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-neutral-900">Lista de Asistencia - Registro ISO</h3>
                <p className="text-sm text-neutral-500">{training.title}</p>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
                >
                  Imprimir / PDF
                </button>
                <button onClick={() => setShowAttendanceSheet(false)} className="p-1 hover:bg-neutral-100 rounded-lg">
                  <X className="h-5 w-5 text-neutral-500" />
                </button>
              </div>
            </div>
            <div className="p-6 flex-1 overflow-y-auto print:p-0">
              <div className="border border-neutral-300 rounded-lg p-6 print:border-black">
                <div className="text-center mb-6">
                  <h2 className="text-lg font-bold text-neutral-900">REGISTRO DE ASISTENCIA</h2>
                  <p className="text-sm text-neutral-600">ISO 9001:2015 - Requisito 7.2 Competencia</p>
                </div>
                
                <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
                  <div>
                    <span className="font-medium text-neutral-700">Capacitación:</span>
                    <p className="text-neutral-900">{training.title}</p>
                  </div>
                  <div>
                    <span className="font-medium text-neutral-700">Código:</span>
                    <p className="text-neutral-900">{training.code}</p>
                  </div>
                  <div>
                    <span className="font-medium text-neutral-700">Fecha:</span>
                    <p className="text-neutral-900">{training.scheduledDate ? new Date(training.scheduledDate).toLocaleDateString('es-AR') : 'Sin fecha'}</p>
                  </div>
                  <div>
                    <span className="font-medium text-neutral-700">Duración:</span>
                    <p className="text-neutral-900">{training.durationHours} horas</p>
                  </div>
                  <div>
                    <span className="font-medium text-neutral-700">Instructor:</span>
                    <p className="text-neutral-900">{training.instructor || 'No asignado'}</p>
                  </div>
                  <div>
                    <span className="font-medium text-neutral-700">Lugar:</span>
                    <p className="text-neutral-900">{training.location || 'No especificado'}</p>
                  </div>
                </div>

                <table className="w-full text-sm border-collapse mb-6">
                  <thead>
                    <tr className="border-b-2 border-neutral-300">
                      <th className="text-left py-2 px-2 font-medium text-neutral-700">#</th>
                      <th className="text-left py-2 px-2 font-medium text-neutral-700">Nombre</th>
                      <th className="text-left py-2 px-2 font-medium text-neutral-700">Firma</th>
                      <th className="text-center py-2 px-2 font-medium text-neutral-700">Asistió</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendees.map((a, idx) => {
                      const displayName = a.user?.firstName || a.user?.email?.split('@')[0] || 'Sin nombre';
                      return (
                      <tr key={a.id} className="border-b border-neutral-200">
                        <td className="py-3 px-2 text-neutral-600">{idx + 1}</td>
                        <td className="py-3 px-2 text-neutral-900">{a.user?.email || 'Sin email'}</td>
                        <td className="py-3 px-2">
                          <div className="h-8 border-b border-neutral-300 w-32"></div>
                        </td>
                        <td className="py-3 px-2 text-center">
                          <div className="inline-flex items-center justify-center w-6 h-6 border border-neutral-300 rounded">
                            {a.attended && <CheckCircle2 className="h-4 w-4 text-green-600" />}
                          </div>
                        </td>
                      </tr>
                      );
                    })}
                    {attendees.length === 0 && (
                      <tr>
                        <td colSpan={4} className="py-6 text-center text-neutral-400 italic">
                          No hay asistentes registrados
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>

                <div className="grid grid-cols-2 gap-8 mt-8 text-sm">
                  <div className="border-t border-neutral-300 pt-2">
                    <p className="font-medium text-neutral-700">Firma del Instructor:</p>
                    <div className="h-12 border-b border-neutral-300 mt-1"></div>
                  </div>
                  <div className="border-t border-neutral-300 pt-2">
                    <p className="font-medium text-neutral-700">Firma del Responsable:</p>
                    <div className="h-12 border-b border-neutral-300 mt-1"></div>
                  </div>
                </div>

                <div className="mt-8 text-xs text-neutral-400 text-center">
                  <p>Este documento es un registro conforme a ISO 9001:2015 - 7.2 Competencia</p>
                  <p>Documento controlado - No. de revisión: 1.0</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

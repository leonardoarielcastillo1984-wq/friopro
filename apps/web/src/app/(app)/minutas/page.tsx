'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { Plus, FileText, Calendar, Users, AlertCircle, CheckCircle, Clock, Filter, Search, MessageCircle, CheckSquare, ArrowRight, Trash2, Edit, Sparkles, Loader2, Target, AlertTriangle, FolderKanban, Mic, Upload, History, Volume2, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

type Minuta = {
  id: string;
  title: string;
  date: string;
  time?: string;
  duration?: string;
  area?: string;
  type: string;
  participants: string[];
  responsible?: string;
  tags: string[];
  priority: string;
  status: string;
  confidentiality: string;
  content?: string;
  summary?: string;
  createdAt: string;
};

type MinutaBlock = {
  id: string;
  minutaId: string;
  type: 'CONVERSATION' | 'DECISION' | 'ACTION';
  content: string;
  order: number;
  responsible?: string;
  dueDate?: string;
  completed: boolean;
  tags: string[];
};

const STATUS_LABELS: Record<string, string> = {
  'DRAFT': 'Borrador',
  'IN_PROGRESS': 'En Progreso',
  'COMPLETED': 'Completada',
  'CANCELLED': 'Cancelada',
};

const STATUS_COLORS: Record<string, string> = {
  'DRAFT': 'bg-yellow-100 text-yellow-800',
  'IN_PROGRESS': 'bg-blue-100 text-blue-800',
  'COMPLETED': 'bg-green-100 text-green-800',
  'CANCELLED': 'bg-gray-100 text-gray-800',
};

const PRIORITY_LABELS: Record<string, string> = {
  'LOW': 'Baja',
  'MEDIUM': 'Media',
  'HIGH': 'Alta',
  'CRITICAL': 'Crítica',
};

const PRIORITY_COLORS: Record<string, string> = {
  'LOW': 'bg-gray-100 text-gray-800',
  'MEDIUM': 'bg-blue-100 text-blue-800',
  'HIGH': 'bg-orange-100 text-orange-800',
  'CRITICAL': 'bg-red-100 text-red-800',
};

const TYPE_LABELS: Record<string, string> = {
  'REVISION_DIRECCION': 'Revisión por la Dirección',
  'COMITE_CALIDAD': 'Comité de Calidad',
  'REUNION_OPERATIVA': 'Reunión Operativa',
  'REUNION_COMERCIAL': 'Reunión Comercial',
  'REUNION_CLIENTE': 'Reunión con Cliente',
  'REUNION_PROVEEDOR': 'Reunión con Proveedor',
  'REUNION_ESTRATEGICA': 'Reunión Estratégica',
  'AUDITORIA': 'Auditoría',
  'INCIDENTE': 'Investigación de Incidente',
  'CRISIS': 'Crisis',
  'PROYECTO': 'Proyecto',
  'SEGURIDAD': 'Seguridad e Higiene',
  'MANTENIMIENTO': 'Mantenimiento',
  'RRHH': 'RRHH',
};

const BLOCK_TYPE_LABELS: Record<string, string> = {
  'CONVERSATION': 'Conversación',
  'DECISION': 'Decisión',
  'ACTION': 'Acción',
};

const BLOCK_TYPE_COLORS: Record<string, string> = {
  'CONVERSATION': 'bg-blue-50 border-blue-200',
  'DECISION': 'bg-purple-50 border-purple-200',
  'ACTION': 'bg-green-50 border-green-200',
};

const BLOCK_TYPE_ICONS: Record<string, any> = {
  'CONVERSATION': MessageCircle,
  'DECISION': CheckSquare,
  'ACTION': ArrowRight,
};

export default function MinutasPage() {
  const [minutas, setMinutas] = useState<Minuta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMinuta, setEditingMinuta] = useState<Minuta | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [blocks, setBlocks] = useState<MinutaBlock[]>([]);
  const [blockDialogOpen, setBlockDialogOpen] = useState(false);
  const [editingBlock, setEditingBlock] = useState<MinutaBlock | null>(null);
  const [summarizing, setSummarizing] = useState(false);
  const [detectingActions, setDetectingActions] = useState(false);
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [transcribing, setTranscribing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [recordedChunks, setRecordedChunks] = useState<Blob[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    title: '',
    date: new Date().toISOString().split('T')[0],
    time: '',
    duration: '',
    area: '',
    type: 'REVISION_DIRECCION',
    participants: '',
    responsible: '',
    tags: '',
    priority: 'MEDIUM',
    status: 'DRAFT',
    confidentiality: 'INTERNAL',
    content: '',
    audioUrl: '',
  });
  const [blockFormData, setBlockFormData] = useState({
    type: 'CONVERSATION' as 'CONVERSATION' | 'DECISION' | 'ACTION',
    content: '',
    responsible: '',
    dueDate: '',
    tags: '',
  });

  useEffect(() => {
    loadMinutas();
    loadDepartments();
    loadEmployees();
  }, []);

  async function loadEmployees() {
    try {
      const res = await apiFetch('/minutas/employees') as { employees: any[] };
      setEmployees(res.employees);
    } catch (err) {
      console.error('Error loading employees:', err);
    }
  }

  async function loadDepartments() {
    try {
      const res = await apiFetch('/minutas/departments') as { departments: any[] };
      setDepartments(res.departments);
    } catch (err) {
      console.error('Error loading departments:', err);
    }
  }

  async function loadMinutas() {
    try {
      setLoading(true);
      setError(null);
      const res = await apiFetch('/minutas') as Minuta[];
      setMinutas(res);
    } catch (err) {
      console.error('Error loading minutas:', err);
      setError(err instanceof Error ? err.message : 'Error al cargar minutas');
    } finally {
      setLoading(false);
    }
  }

  async function loadBlocks(minutaId: string) {
    try {
      const res = await apiFetch(`/minutas/${minutaId}/blocks`) as MinutaBlock[];
      setBlocks(res);
    } catch (err) {
      console.error('Error loading blocks:', err);
    }
  }

  async function handleSaveBlock() {
    if (!editingMinuta || !blockFormData.content.trim()) {
      alert('El contenido es obligatorio');
      return;
    }

    try {
      const payload = {
        type: blockFormData.type,
        content: blockFormData.content,
        responsible: blockFormData.responsible || undefined,
        dueDate: blockFormData.dueDate || undefined,
        tags: blockFormData.tags ? blockFormData.tags.split(',').map(t => t.trim()) : [],
      };

      const url = editingBlock
        ? `/minutas/${editingMinuta.id}/blocks/${editingBlock.id}`
        : `/minutas/${editingMinuta.id}/blocks`;
      const method = editingBlock ? 'PATCH' : 'POST';

      await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      setBlockDialogOpen(false);
      setEditingBlock(null);
      setBlockFormData({
        type: 'CONVERSATION',
        content: '',
        responsible: '',
        dueDate: '',
        tags: '',
      });
      loadBlocks(editingMinuta.id);
    } catch (err) {
      console.error('Error saving block:', err);
      alert('Error al guardar el bloque');
    }
  }

  async function handleDeleteBlock(blockId: string) {
    if (!confirm('¿Eliminar este bloque?')) return;
    if (!editingMinuta) return;

    try {
      await apiFetch(`/minutas/${editingMinuta.id}/blocks/${blockId}`, { method: 'DELETE' });
      setBlocks(prev => prev.filter(b => b.id !== blockId));
    } catch (err) {
      console.error('Error deleting block:', err);
      alert('Error al eliminar el bloque');
    }
  }

  function openNewBlock() {
    setEditingBlock(null);
    setBlockFormData({
      type: 'CONVERSATION',
      content: '',
      responsible: '',
      dueDate: '',
      tags: '',
    });
    setBlockDialogOpen(true);
  }

  function openEditBlock(block: MinutaBlock) {
    setEditingBlock(block);
    setBlockFormData({
      type: block.type,
      content: block.content,
      responsible: block.responsible || '',
      dueDate: block.dueDate ? block.dueDate.split('T')[0] : '',
      tags: block.tags.join(', '),
    });
    setBlockDialogOpen(true);
  }

  async function handleSummarize() {
    if (!editingMinuta) return;

    try {
      setSummarizing(true);
      const res = await apiFetch(`/minutas/${editingMinuta.id}/summarize`, {
        method: 'POST',
      }) as { summary: string };

      // Actualizar la minuta localmente
      setEditingMinuta({ ...editingMinuta, summary: res.summary });
      setMinutas(prev => prev.map(m => m.id === editingMinuta.id ? { ...m, summary: res.summary } : m));
    } catch (err) {
      console.error('Error summarizing:', err);
      alert('Error al generar resumen con IA');
    } finally {
      setSummarizing(false);
    }
  }

  async function handleDetectActions() {
    if (!editingMinuta) return;

    try {
      setDetectingActions(true);
      const res = await apiFetch(`/minutas/${editingMinuta.id}/detect-actions`, {
        method: 'POST',
      }) as { blocks: MinutaBlock[]; count: number };

      // Recargar bloques
      await loadBlocks(editingMinuta.id);
      alert(`Se detectaron ${res.count} bloques automáticamente`);
    } catch (err) {
      console.error('Error detecting actions:', err);
      alert('Error al detectar acciones con IA');
    } finally {
      setDetectingActions(false);
    }
  }

  async function handleCreateCAPA(blockId: string) {
    if (!editingMinuta) return;

    try {
      await apiFetch(`/minutas/${editingMinuta.id}/blocks/${blockId}/create-capa`, {
        method: 'POST',
      });
      alert('CAPA creada exitosamente');
    } catch (err) {
      console.error('Error creating CAPA:', err);
      alert('Error al crear CAPA');
    }
  }

  async function handleCreateRisk(blockId: string) {
    if (!editingMinuta) return;

    try {
      await apiFetch(`/minutas/${editingMinuta.id}/blocks/${blockId}/create-risk`, {
        method: 'POST',
      });
      alert('Riesgo creado exitosamente');
    } catch (err) {
      console.error('Error creating risk:', err);
      alert('Error al crear riesgo');
    }
  }

  async function handleCreateProject() {
    if (!editingMinuta) return;

    try {
      await apiFetch(`/minutas/${editingMinuta.id}/create-project`, {
        method: 'POST',
      });
      alert('Proyecto creado exitosamente');
    } catch (err) {
      console.error('Error creating project:', err);
      alert('Error al crear proyecto');
    }
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        const file = new File([blob], 'grabacion.webm', { type: 'audio/webm' });
        setAudioFile(file);
        setRecordedChunks([]);
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      setMediaRecorder(recorder);
      setRecordedChunks(chunks);
      setIsRecording(true);
    } catch (err) {
      console.error('Error al iniciar grabación:', err);
      alert('No se pudo acceder al micrófono');
    }
  }

  function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
      setMediaRecorder(null);
      setIsRecording(false);
    }
  }

  async function handleAudioUpload() {
    if (!audioFile) return;

    try {
      setUploadingAudio(true);
      const uploadFormData = new FormData();
      uploadFormData.append('file', audioFile);

      const res = await apiFetch('/storage/upload', {
        method: 'POST',
        headers: {},
        body: uploadFormData,
      }) as { url: string };

      const audioUrl = res.url.replace('https://', 'http://');
      setFormData({ ...formData, audioUrl });
      setAudioFile(null);

      // Guardar minuta automáticamente para que audioUrl se guarde en la base de datos
      if (formData.title.trim()) {
        const payload = {
          ...formData,
          participants: formData.participants ? formData.participants.split(',').map(p => p.trim()) : [],
          tags: formData.tags ? formData.tags.split(',').map(t => t.trim()) : [],
        };

        const url = editingMinuta ? `/minutas/${editingMinuta.id}` : '/minutas';
        const method = editingMinuta ? 'PATCH' : 'POST';

        await apiFetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        await loadMinutas();
      }

      alert('Audio subido exitosamente');
    } catch (err) {
      console.error('Error uploading audio:', err);
      alert('Error al subir audio');
    } finally {
      setUploadingAudio(false);
    }
  }

  async function handleTranscribe() {
    if (!editingMinuta || !editingMinuta.audioUrl) {
      alert('La minuta no tiene audio');
      return;
    }

    try {
      setTranscribing(true);
      const res = await apiFetch(`/minutas/${editingMinuta.id}/transcribe`, {
        method: 'POST',
      }) as { transcription: string };

      setEditingMinuta({ ...editingMinuta, content: res.transcription });
      setFormData({ ...formData, content: res.transcription });
      alert('Audio transcrito exitosamente');
    } catch (err) {
      console.error('Error transcribing:', err);
      alert('Error al transcribir audio');
    } finally {
      setTranscribing(false);
    }
  }

  async function handleSave() {
    if (!formData.title.trim()) {
      alert('El título es obligatorio');
      return;
    }

    try {
      const payload = {
        ...formData,
        participants: formData.participants ? formData.participants.split(',').map(p => p.trim()) : [],
        tags: formData.tags ? formData.tags.split(',').map(t => t.trim()) : [],
      };

      const url = editingMinuta ? `/minutas/${editingMinuta.id}` : '/minutas';
      const method = editingMinuta ? 'PATCH' : 'POST';

      await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      setDialogOpen(false);
      setEditingMinuta(null);
      setFormData({
        title: '',
        date: new Date().toISOString().split('T')[0],
        time: '',
        duration: '',
        area: '',
        type: 'REVISION_DIRECCION',
        participants: '',
        responsible: '',
        tags: '',
        priority: 'MEDIUM',
        status: 'DRAFT',
        confidentiality: 'INTERNAL',
        content: '',
      });
      loadMinutas();
    } catch (err) {
      console.error('Error saving minuta:', err);
      alert('Error al guardar la minuta');
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar esta minuta?')) return;

    try {
      await apiFetch(`/minutas/${id}`, { method: 'DELETE' });
      setMinutas(prev => prev.filter(m => m.id !== id));
    } catch (err) {
      console.error('Error deleting minuta:', err);
      alert('Error al eliminar la minuta');
    }
  }

  function openEdit(minuta: Minuta) {
    setEditingMinuta(minuta);
    setFormData({
      title: minuta.title,
      date: minuta.date.split('T')[0],
      time: minuta.time || '',
      duration: minuta.duration || '',
      area: minuta.area || '',
      type: minuta.type,
      participants: minuta.participants.join(', '),
      responsible: minuta.responsible || '',
      tags: minuta.tags.join(', '),
      priority: minuta.priority,
      status: minuta.status,
      confidentiality: minuta.confidentiality,
      content: minuta.content || '',
      audioUrl: minuta.audioUrl || '',
    });
    setDialogOpen(true);
    loadBlocks(minuta.id);
  }

  function openNew() {
    setEditingMinuta(null);
    setFormData({
      title: '',
      date: new Date().toISOString().split('T')[0],
      time: '',
      duration: '',
      area: '',
      type: 'REVISION_DIRECCION',
      participants: '',
      responsible: '',
      tags: '',
      priority: 'MEDIUM',
      status: 'DRAFT',
      confidentiality: 'INTERNAL',
      content: '',
      audioUrl: '',
    });
    setDialogOpen(true);
  }

  const filteredMinutas = minutas.filter(m =>
    m.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.tags.some(t => t.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Cargando minutas...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">MINUTAS</h1>
          <p className="text-gray-500">Centro inteligente de decisiones y seguimiento corporativo</p>
        </div>
        <Button onClick={openNew} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="h-4 w-4 mr-2" />
          Nueva Minuta
        </Button>
      </div>

      {/* Buscador y filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Buscar por título, tipo o etiqueta..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button variant="outline">
              <Filter className="h-4 w-4 mr-2" />
              Filtros
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Minutas</p>
                <p className="text-2xl font-bold">{minutas.length}</p>
              </div>
              <FileText className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">En Progreso</p>
                <p className="text-2xl font-bold">{minutas.filter(m => m.status === 'IN_PROGRESS').length}</p>
              </div>
              <Clock className="h-8 w-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Completadas</p>
                <p className="text-2xl font-bold">{minutas.filter(m => m.status === 'COMPLETED').length}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Prioridad Alta</p>
                <p className="text-2xl font-bold">{minutas.filter(m => m.priority === 'HIGH' || m.priority === 'CRITICAL').length}</p>
              </div>
              <AlertCircle className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Tasa de Completación</p>
                <p className="text-2xl font-bold">{Math.round((minutas.filter(m => m.status === 'COMPLETED').length / minutas.length) * 100)}%</p>
              </div>
              <BarChart3 className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Minutas del Mes</p>
                <p className="text-2xl font-bold">{minutas.filter(m => {
                  const date = new Date(m.date);
                  const now = new Date();
                  return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
                }).length}</p>
              </div>
              <Calendar className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Minutas con Resumen</p>
                <p className="text-2xl font-bold">{minutas.filter(m => m.summary && m.summary.length > 0).length}</p>
              </div>
              <FileText className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Minutas con Audio</p>
                <p className="text-2xl font-bold">{minutas.filter(m => m.audioUrl && m.audioUrl.length > 0).length}</p>
              </div>
              <Clock className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Distribución por Tipo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(TYPE_LABELS).map(([type, label]) => {
                const count = minutas.filter(m => m.type === type).length;
                const percentage = minutas.length > 0 ? (count / minutas.length) * 100 : 0;
                return (
                  <div key={type}>
                    <div className="flex justify-between text-sm mb-1">
                      <span>{label}</span>
                      <span className="font-semibold">{count}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Distribución por Prioridad</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((priority) => {
                const count = minutas.filter(m => m.priority === priority).length;
                const percentage = minutas.length > 0 ? (count / minutas.length) * 100 : 0;
                const colors = {
                  LOW: 'bg-green-500',
                  MEDIUM: 'bg-yellow-500',
                  HIGH: 'bg-orange-500',
                  CRITICAL: 'bg-red-500',
                };
                const labels = {
                  LOW: 'Baja',
                  MEDIUM: 'Media',
                  HIGH: 'Alta',
                  CRITICAL: 'Crítica',
                };
                return (
                  <div key={priority}>
                    <div className="flex justify-between text-sm mb-1">
                      <span>{labels[priority as keyof typeof labels]}</span>
                      <span className="font-semibold">{count}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`${colors[priority as keyof typeof colors]} h-2 rounded-full`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Métricas adicionales */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Duración Promedio</p>
                <p className="text-2xl font-bold">
                  {minutas.length > 0
                    ? Math.round(minutas.reduce((sum, m) => sum + (parseInt(m.duration || '0') || 0), 0) / minutas.length)
                    : 0} min
                </p>
              </div>
              <Clock className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Bloques</p>
                <p className="text-2xl font-bold">
                  {minutas.reduce((sum, m) => sum + (m.blocks?.length || 0), 0)}
                </p>
              </div>
              <MessageCircle className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Acciones Detectadas</p>
                <p className="text-2xl font-bold">
                  {minutas.reduce((sum, m) => sum + (m.blocks?.filter((b: any) => b.type === 'ACTION').length || 0), 0)}
                </p>
              </div>
              <ArrowRight className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Timeline Corporativo */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Timeline Corporativo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {minutas
              .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
              .slice(0, 5)
              .map((minuta) => (
                <div key={minuta.id} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="h-3 w-3 rounded-full bg-blue-600"></div>
                    <div className="h-full w-0.5 bg-gray-200"></div>
                  </div>
                  <div className="flex-1 pb-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium">{minuta.title}</p>
                        <p className="text-sm text-gray-500">{new Date(minuta.date).toLocaleDateString('es-AR')}</p>
                      </div>
                      <Badge className={STATUS_COLORS[minuta.status] || 'bg-gray-100'}>
                        {STATUS_LABELS[minuta.status] || minuta.status}
                      </Badge>
                    </div>
                    {minuta.summary && (
                      <p className="text-sm text-gray-600 mt-2 line-clamp-2">{minuta.summary}</p>
                    )}
                  </div>
                </div>
              ))}
            {minutas.length === 0 && (
              <p className="text-center text-gray-500 py-4">No hay minutas para mostrar en el timeline</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Lista de minutas */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredMinutas.map((minuta) => (
          <Card key={minuta.id} className="hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <CardTitle className="text-base font-semibold line-clamp-2">{minuta.title}</CardTitle>
                <Badge className={STATUS_COLORS[minuta.status] || 'bg-gray-100'}>
                  {STATUS_LABELS[minuta.status] || minuta.status}
                </Badge>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <Badge variant="outline" className="text-xs">
                  {TYPE_LABELS[minuta.type] || minuta.type}
                </Badge>
                <Badge className={PRIORITY_COLORS[minuta.priority] || 'bg-gray-100'}>
                  {PRIORITY_LABELS[minuta.priority] || minuta.priority}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-gray-500">
                  <Calendar className="h-4 w-4" />
                  {new Date(minuta.date).toLocaleDateString('es-AR')}
                  {minuta.time && ` ${minuta.time}`}
                  {minuta.duration && ` (${minuta.duration} min)`}
                </div>
                {minuta.participants.length > 0 && (
                  <div className="flex items-center gap-2 text-gray-500">
                    <Users className="h-4 w-4" />
                    {minuta.participants.length} participante{minuta.participants.length !== 1 ? 's' : ''}
                  </div>
                )}
                {minuta.area && (
                  <div className="text-gray-500">
                    Área: {minuta.area}
                  </div>
                )}
                {minuta.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {minuta.tags.slice(0, 3).map((tag, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                    {minuta.tags.length > 3 && (
                      <Badge variant="secondary" className="text-xs">
                        +{minuta.tags.length - 3}
                      </Badge>
                    )}
                  </div>
                )}
                {minuta.summary && (
                  <div className="mt-3 p-2 bg-purple-50 rounded border border-purple-200">
                    <div className="flex items-center gap-1 mb-1">
                      <Sparkles className="h-3 w-3 text-purple-600" />
                      <span className="text-xs font-medium text-purple-700">Resumen IA</span>
                    </div>
                    <p className="text-xs text-gray-700 line-clamp-3">{minuta.summary}</p>
                  </div>
                )}
              </div>
              <div className="flex gap-2 mt-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => openEdit(minuta)}
                  className="flex-1"
                >
                  Editar
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(minuta.id)}
                  className="text-red-600 hover:text-red-700"
                >
                  Eliminar
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredMinutas.length === 0 && (
        <Card>
          <CardContent className="pt-6 text-center text-gray-500">
            <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p>No hay minutas registradas</p>
            <Button onClick={openNew} variant="outline" className="mt-4">
              <Plus className="h-4 w-4 mr-2" />
              Crear primera minuta
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Dialogo de crear/editar */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" resizable={true}>
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle>
                {editingMinuta ? 'Editar Minuta' : 'Nueva Minuta'}
              </DialogTitle>
              {editingMinuta && (
                <Button onClick={handleCreateProject} size="sm" variant="outline">
                  <FolderKanban className="h-4 w-4 mr-2" />
                  Crear Proyecto
                </Button>
              )}
            </div>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="title">Título *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Título de la minuta"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="date">Fecha *</Label>
                <Input
                  id="date"
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="time">Hora</Label>
                <Input
                  id="time"
                  type="time"
                  value={formData.time}
                  onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="duration">Duración (min)</Label>
                <Input
                  id="duration"
                  value={formData.duration}
                  onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                  placeholder="60"
                />
              </div>
              <div>
                <Label htmlFor="area">Área</Label>
                <select
                  id="area"
                  value={formData.area}
                  onChange={(e) => setFormData({ ...formData, area: e.target.value })}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <option value="">Seleccionar departamento</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.name}>
                      {dept.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <Label htmlFor="type">Tipo *</Label>
              <select
                id="type"
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                className="w-full p-2 border rounded-md"
              >
                {Object.entries(TYPE_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>

            <div>
              <Label htmlFor="participants">Participantes (separados por coma)</Label>
              <Input
                id="participants"
                list="employees-list"
                value={formData.participants}
                onChange={(e) => setFormData({ ...formData, participants: e.target.value })}
                placeholder="Juan, María, Carlos"
              />
              <datalist id="employees-list">
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.name}>
                    {emp.position} - {emp.email}
                  </option>
                ))}
              </datalist>
            </div>

            <div>
              <Label htmlFor="responsible">Responsable</Label>
              <Input
                id="responsible"
                list="employees-list"
                value={formData.responsible}
                onChange={(e) => setFormData({ ...formData, responsible: e.target.value })}
                placeholder="Nombre del responsable"
              />
            </div>

            <div>
              <Label htmlFor="tags">Etiquetas (separadas por coma)</Label>
              <Input
                id="tags"
                value={formData.tags}
                onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                placeholder="Urgente, Estratégico, ISO 9001"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="priority">Prioridad</Label>
                <select
                  id="priority"
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                  className="w-full p-2 border rounded-md"
                >
                  <option value="LOW">Baja</option>
                  <option value="MEDIUM">Media</option>
                  <option value="HIGH">Alta</option>
                  <option value="CRITICAL">Crítica</option>
                </select>
              </div>
              <div>
                <Label htmlFor="status">Estado</Label>
                <select
                  id="status"
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full p-2 border rounded-md"
                >
                  <option value="DRAFT">Borrador</option>
                  <option value="IN_PROGRESS">En Progreso</option>
                  <option value="COMPLETED">Completada</option>
                  <option value="CANCELLED">Cancelada</option>
                </select>
              </div>
              <div>
                <Label htmlFor="confidentiality">Confidencialidad</Label>
                <select
                  id="confidentiality"
                  value={formData.confidentiality}
                  onChange={(e) => setFormData({ ...formData, confidentiality: e.target.value })}
                  className="w-full p-2 border rounded-md"
                >
                  <option value="INTERNAL">Interna</option>
                  <option value="CONFIDENTIAL">Confidencial</option>
                  <option value="RESTRICTED">Restringida</option>
                </select>
              </div>
            </div>

            <div>
              <Label htmlFor="content">Contenido</Label>
              <Textarea
                id="content"
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                placeholder="Contenido de la minuta..."
                rows={6}
              />
            </div>

            {/* Sección de Audio */}
            <div className="border-t pt-4">
              <Label>Audio de la reunión</Label>
              <div className="flex gap-2 mt-2">
                <Input
                  type="file"
                  accept="audio/*"
                  onChange={(e) => setAudioFile(e.target.files?.[0] || null)}
                  className="flex-1"
                />
                <Button
                  onClick={isRecording ? stopRecording : startRecording}
                  variant={isRecording ? "destructive" : "outline"}
                >
                  <Mic className={`h-4 w-4 mr-2 ${isRecording ? 'animate-pulse' : ''}`} />
                  {isRecording ? 'Detener' : 'Grabar'}
                </Button>
                <Button
                  onClick={handleAudioUpload}
                  disabled={!audioFile || uploadingAudio}
                  variant="outline"
                >
                  {uploadingAudio ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4 mr-2" />
                  )}
                  Subir
                </Button>
              </div>
              {formData.audioUrl && (
                <div className="mt-2 p-2 bg-blue-50 rounded border border-blue-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Mic className="h-4 w-4 text-blue-600" />
                      <span className="text-sm text-blue-700">Audio cargado</span>
                    </div>
                    <Button
                      onClick={handleTranscribe}
                      size="sm"
                      variant="outline"
                      disabled={transcribing}
                    >
                      {transcribing ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Sparkles className="h-4 w-4 mr-2" />
                      )}
                      Transcribir
                    </Button>
                  </div>
                  <audio controls src={formData.audioUrl} className="h-8 mt-2 w-full" />
                </div>
              )}
            </div>

            {/* Sección de Bloques de Decisión */}
            {editingMinuta && (
              <div className="border-t pt-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold">Bloques de Decisión</h3>
                  <div className="flex gap-2">
                    <Button onClick={handleSummarize} size="sm" variant="outline" disabled={summarizing}>
                      {summarizing ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Sparkles className="h-4 w-4 mr-2" />
                      )}
                      Resumen IA
                    </Button>
                    <Button onClick={handleDetectActions} size="sm" variant="outline" disabled={detectingActions}>
                      {detectingActions ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Sparkles className="h-4 w-4 mr-2" />
                      )}
                      Detectar Acciones
                    </Button>
                    <Button onClick={openNewBlock} size="sm" variant="outline">
                      <Plus className="h-4 w-4 mr-2" />
                      Agregar Bloque
                    </Button>
                  </div>
                </div>

                {blocks.length === 0 ? (
                  <div className="text-center text-gray-500 py-4">
                    <p>No hay bloques agregados</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {blocks.map((block) => {
                      const BlockIcon = BLOCK_TYPE_ICONS[block.type];
                      return (
                        <Card key={block.id} className={`${BLOCK_TYPE_COLORS[block.type]} border`}>
                          <CardContent className="pt-4">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <BlockIcon className="h-4 w-4" />
                                  <Badge className={BLOCK_TYPE_COLORS[block.type]}>
                                    {BLOCK_TYPE_LABELS[block.type]}
                                  </Badge>
                                  {block.type === 'ACTION' && block.completed && (
                                    <CheckCircle className="h-4 w-4 text-green-600" />
                                  )}
                                </div>
                                <p className="text-sm mb-2">{block.content}</p>
                                {block.responsible && (
                                  <p className="text-xs text-gray-600">
                                    Responsable: {block.responsible}
                                  </p>
                                )}
                                {block.dueDate && (
                                  <p className="text-xs text-gray-600">
                                    Fecha límite: {new Date(block.dueDate).toLocaleDateString('es-AR')}
                                  </p>
                                )}
                                {block.tags.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-2">
                                    {block.tags.map((tag, i) => (
                                      <Badge key={i} variant="secondary" className="text-xs">
                                        {tag}
                                      </Badge>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <div className="flex gap-1">
                                {block.type === 'ACTION' && (
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => handleCreateCAPA(block.id)}
                                    title="Crear CAPA"
                                  >
                                    <Target className="h-4 w-4 text-blue-600" />
                                  </Button>
                                )}
                                {block.type === 'DECISION' && (
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => handleCreateRisk(block.id)}
                                    title="Crear Riesgo"
                                  >
                                    <AlertTriangle className="h-4 w-4 text-orange-600" />
                                  </Button>
                                )}
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => openEditBlock(block)}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => handleDeleteBlock(block.id)}
                                  className="text-red-600"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700">
                {editingMinuta ? 'Actualizar' : 'Crear'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialogo para crear/editar bloques */}
      <Dialog open={blockDialogOpen} onOpenChange={setBlockDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingBlock ? 'Editar Bloque' : 'Nuevo Bloque'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="blockType">Tipo *</Label>
              <select
                id="blockType"
                value={blockFormData.type}
                onChange={(e) => setBlockFormData({ ...blockFormData, type: e.target.value as any })}
                className="w-full p-2 border rounded-md"
              >
                <option value="CONVERSATION">Conversación</option>
                <option value="DECISION">Decisión</option>
                <option value="ACTION">Acción</option>
              </select>
            </div>

            <div>
              <Label htmlFor="blockContent">Contenido *</Label>
              <Textarea
                id="blockContent"
                value={blockFormData.content}
                onChange={(e) => setBlockFormData({ ...blockFormData, content: e.target.value })}
                placeholder="Contenido del bloque..."
                rows={4}
              />
            </div>

            {blockFormData.type === 'ACTION' && (
              <>
                <div>
                  <Label htmlFor="blockResponsible">Responsable</Label>
                  <Input
                    id="blockResponsible"
                    value={blockFormData.responsible}
                    onChange={(e) => setBlockFormData({ ...blockFormData, responsible: e.target.value })}
                    placeholder="Nombre del responsable"
                  />
                </div>

                <div>
                  <Label htmlFor="blockDueDate">Fecha límite</Label>
                  <Input
                    id="blockDueDate"
                    type="date"
                    value={blockFormData.dueDate}
                    onChange={(e) => setBlockFormData({ ...blockFormData, dueDate: e.target.value })}
                  />
                </div>
              </>
            )}

            <div>
              <Label htmlFor="blockTags">Etiquetas (separadas por coma)</Label>
              <Input
                id="blockTags"
                value={blockFormData.tags}
                onChange={(e) => setBlockFormData({ ...blockFormData, tags: e.target.value })}
                placeholder="Urgente, Estratégico, etc."
              />
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setBlockDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveBlock} className="bg-blue-600 hover:bg-blue-700">
                {editingBlock ? 'Actualizar' : 'Crear'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

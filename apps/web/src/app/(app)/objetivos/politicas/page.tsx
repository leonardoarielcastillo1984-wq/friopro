'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, Plus, Pencil, Trash2, Shield, Save, X } from 'lucide-react';
import { toast } from 'sonner';

interface Policy {
  id: string;
  name: string;
  content: string;
  scope: string;
  active: boolean;
  createdAt: string;
}

export default function PoliciesPage() {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<Policy | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    content: '',
    scope: 'QUALITY',
    active: true,
  });

  const fetchPolicies = useCallback(async () => {
    try {
      const res = await fetch('/api/policies');
      if (!res.ok) throw new Error('Error al cargar políticas');
      const data = await res.json();
      setPolicies(data);
    } catch {
      toast.error('No se pudieron cargar las políticas');
    }
  }, []);

  useEffect(() => {
    fetchPolicies();
  }, [fetchPolicies]);

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error('El nombre de la política es obligatorio');
      return;
    }
    try {
      const url = editingPolicy ? `/api/policies/${editingPolicy.id}` : '/api/policies';
      const method = editingPolicy ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (!res.ok) throw new Error('Error al guardar');
      toast.success(editingPolicy ? 'Política actualizada' : 'Política creada');
      setDialogOpen(false);
      setEditingPolicy(null);
      setFormData({ name: '', content: '', scope: 'QUALITY', active: true });
      fetchPolicies();
    } catch {
      toast.error('Error al guardar la política');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar esta política?')) return;
    try {
      const res = await fetch(`/api/policies/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Error al eliminar');
      toast.success('Política eliminada');
      fetchPolicies();
    } catch {
      toast.error('Error al eliminar');
    }
  };

  const openEdit = (policy: Policy) => {
    setEditingPolicy(policy);
    setFormData({
      name: policy.name,
      content: policy.content,
      scope: policy.scope,
      active: policy.active,
    });
    setDialogOpen(true);
  };

  const openNew = () => {
    setEditingPolicy(null);
    setFormData({ name: '', content: '', scope: 'QUALITY', active: true });
    setDialogOpen(true);
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Políticas SGI</h1>
        </div>
        <Button onClick={openNew}>
          <Plus className="mr-2 h-4 w-4" />
          Nueva política
        </Button>
      </div>

      <p className="text-muted-foreground text-sm">
        Gestione las políticas de la organización. Cada norma puede tener su propia política (Calidad, Medio Ambiente, Seguridad, etc.).
      </p>

      {policies.length === 0 && !loading && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No hay políticas registradas</p>
            <Button variant="outline" className="mt-4" onClick={openNew}>
              <Plus className="mr-2 h-4 w-4" />
              Crear primera política
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {policies.map((policy) => (
          <Card key={policy.id} className={policy.active ? '' : 'opacity-60'}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <CardTitle className="text-base font-semibold">{policy.name}</CardTitle>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(policy)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(policy.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-muted w-fit">
                {policy.scope === 'QUALITY' && 'Calidad'}
                {policy.scope === 'ENVIRONMENT' && 'Medio Ambiente'}
                {policy.scope === 'SAFETY' && 'Seguridad'}
                {policy.scope === 'INTEGRATED' && 'Integrado'}
              </span>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground line-clamp-4 whitespace-pre-wrap">
                {policy.content || 'Sin contenido'}
              </p>
              {!policy.active && (
                <span className="inline-block mt-2 text-xs text-destructive font-medium">
                  Inactiva
                </span>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingPolicy ? 'Editar política' : 'Nueva política SGI'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nombre *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ej: Política de Calidad"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Alcance</Label>
                <select
                  className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                  value={formData.scope}
                  onChange={(e) => setFormData({ ...formData, scope: e.target.value })}
                >
                  <option value="QUALITY">Calidad</option>
                  <option value="ENVIRONMENT">Medio Ambiente</option>
                  <option value="SAFETY">Seguridad</option>
                  <option value="INTEGRATED">Integrado</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Estado</Label>
                <select
                  className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                  value={formData.active ? 'true' : 'false'}
                  onChange={(e) => setFormData({ ...formData, active: e.target.value === 'true' })}
                >
                  <option value="true">Activa</option>
                  <option value="false">Inactiva</option>
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Contenido</Label>
              <Textarea
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                placeholder="Redacte aquí el contenido de la política..."
                rows={8}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              <X className="mr-2 h-4 w-4" />
              Cancelar
            </Button>
            <Button onClick={handleSave}>
              <Save className="mr-2 h-4 w-4" />
              {editingPolicy ? 'Actualizar' : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Send, Users, Search, CheckSquare, Square, Loader2 } from 'lucide-react';
import { apiFetch } from '@/lib/api';

export default function EnviarEncuestaPage() {
  const router = useRouter();
  const { id } = useParams() as { id: string };
  const [survey, setSurvey] = useState<any>(null);
  const [employees, setEmployees] = useState<any[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [method, setMethod] = useState<'EMAIL' | 'INTERNAL'>('EMAIL');
  const [allEmployees, setAllEmployees] = useState(false);

  useEffect(() => {
    Promise.all([
      apiFetch(`/clima/encuestas/${id}`).then((d: any) => setSurvey(d.survey)),
      apiFetch('/hr/employees').then((d: any) => setEmployees((d.employees || d || []).sort((a: any, b: any) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`)))),
    ]).catch(() => {});
  }, [id]);

  const filtered = employees.filter(e =>
    `${e.firstName} ${e.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
    e.email?.toLowerCase().includes(search.toLowerCase())
  );

  function toggleAll() {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((e: any) => e.id)));
  }

  function toggleEmployee(empId: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(empId)) next.delete(empId);
      else next.add(empId);
      return next;
    });
  }

  async function handleSend() {
    if (!allEmployees && selected.size === 0) return alert('Seleccioná al menos un empleado');
    setSending(true);
    try {
      const body: any = { method, allEmployees };
      if (!allEmployees) body.employeeIds = Array.from(selected);
      const data = await apiFetch(`/clima/encuestas/${id}/enviar`, {
        method: 'POST', json: body,
      }) as any;
      setSent(true);
      setTimeout(() => router.push(`/clima/encuestas/${id}`), 2000);
    } catch (e) {
      alert('Error al enviar');
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <div className="p-6 max-w-lg mx-auto text-center py-20">
        <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
          <Send className="w-8 h-8 text-emerald-600" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">¡Encuesta enviada!</h2>
        <p className="text-sm text-gray-500">Los destinatarios recibirán el link por email.</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 rounded-xl text-gray-500 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Enviar Encuesta</h1>
          <p className="text-sm text-gray-500 mt-0.5">{survey?.title}</p>
        </div>
      </div>

      {/* Method */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700">Método de envío</h2>
        <div className="flex gap-3">
          {[{ key: 'EMAIL', label: 'Email' }, { key: 'INTERNAL', label: 'Enlace interno' }].map(m => (
            <button
              key={m.key}
              onClick={() => setMethod(m.key as any)}
              className={`flex-1 text-sm py-2.5 rounded-xl border transition-colors font-medium ${method === m.key ? 'bg-teal-600 text-white border-teal-600' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Employees */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">Destinatarios</h2>
          <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-600">
            <input type="checkbox" checked={allEmployees} onChange={e => { setAllEmployees(e.target.checked); if (e.target.checked) setSelected(new Set()); }} className="rounded" />
            Todos los empleados activos
          </label>
        </div>

        {!allEmployees && (
          <>
            <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2">
              <Search className="w-4 h-4 text-gray-400" />
              <input type="text" placeholder="Buscar empleado..." value={search} onChange={e => setSearch(e.target.value)}
                className="text-sm bg-transparent outline-none text-gray-700 w-full" />
            </div>

            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>{selected.size} seleccionado(s)</span>
              <button onClick={toggleAll} className="text-teal-600 hover:text-teal-800 font-medium">
                {selected.size === filtered.length ? 'Deseleccionar todos' : 'Seleccionar todos'}
              </button>
            </div>

            <div className="max-h-64 overflow-y-auto space-y-1">
              {filtered.map(emp => (
                <div key={emp.id} onClick={() => toggleEmployee(emp.id)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-colors ${selected.has(emp.id) ? 'bg-teal-50 border border-teal-200' : 'hover:bg-gray-50 border border-transparent'}`}>
                  {selected.has(emp.id)
                    ? <CheckSquare className="w-4 h-4 text-teal-600 flex-shrink-0" />
                    : <Square className="w-4 h-4 text-gray-300 flex-shrink-0" />
                  }
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800">{emp.firstName} {emp.lastName}</p>
                    {emp.email && <p className="text-xs text-gray-500 truncate">{emp.email}</p>}
                  </div>
                </div>
              ))}
              {filtered.length === 0 && <p className="text-sm text-gray-400 text-center py-4">Sin resultados</p>}
            </div>
          </>
        )}
      </div>

      {/* Send button */}
      <div className="flex gap-3">
        <button onClick={() => router.back()} className="flex-1 text-sm text-gray-600 border border-gray-200 py-3 rounded-xl hover:bg-gray-50 transition-colors">Cancelar</button>
        <button onClick={handleSend} disabled={sending}
          className="flex-1 flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white text-sm font-medium py-3 rounded-xl shadow transition-colors">
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          {sending ? 'Enviando...' : `Enviar a ${allEmployees ? 'todos' : `${selected.size} empleados`}`}
        </button>
      </div>
    </div>
  );
}

'use client';

import { useRouter } from 'next/navigation';
import { Zap, CheckCircle, BarChart3, FileText, Shield } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

const STEPS = [
  { icon: FileText, label: 'Documentos', desc: 'Gestión de normas y documentos' },
  { icon: BarChart3, label: 'Indicadores', desc: 'KPIs en tiempo real' },
  { icon: Shield, label: 'No Conformidades', desc: 'Hallazgos y acciones correctivas' },
  { icon: CheckCircle, label: 'Dashboard IA', desc: 'Análisis autónomo con inteligencia artificial' },
];

export default function OnboardingPage() {
  const router = useRouter();
  const { user } = useAuth();

  const handleStart = () => {
    router.push('/suite');
  };

  return (
    <div
      style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(135deg, #f0f9ff 0%, #fef3e8 100%)',
        padding: 24,
      }}
    >
      <div style={{ maxWidth: 560, width: '100%', textAlign: 'center' }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 40 }}>
          <div style={{ width: 44, height: 44, background: '#E8541A', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Zap size={22} color="white" />
          </div>
          <span style={{ fontSize: 22, fontWeight: 700, color: '#1a1a1a' }}>SGI 360</span>
        </div>

        {/* Heading */}
        <h1 style={{ fontSize: 32, fontWeight: 800, color: '#1a1a1a', marginBottom: 12, lineHeight: 1.2 }}>
          Bienvenido{(user as any)?.firstName ? `, ${(user as any).firstName}` : ''} a SGI360
        </h1>
        <p style={{ fontSize: 16, color: '#6b7280', lineHeight: 1.6, marginBottom: 36 }}>
          Configurá tu sistema en minutos.<br />Tenés <strong>3 días de demo gratuita</strong> para explorar todo el sistema.
        </p>

        {/* Steps preview */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 36 }}>
          {STEPS.map((s, i) => (
            <div
              key={i}
              style={{
                background: 'white', borderRadius: 12, padding: '16px',
                boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
                display: 'flex', alignItems: 'flex-start', gap: 12, textAlign: 'left',
              }}
            >
              <div style={{ width: 34, height: 34, background: '#fef3e8', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <s.icon size={16} color="#E8541A" />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', marginBottom: 2 }}>{s.label}</div>
                <div style={{ fontSize: 11, color: '#9ca3af', lineHeight: 1.4 }}>{s.desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <button
          onClick={handleStart}
          style={{
            width: '100%', background: '#E8541A', color: 'white',
            border: 'none', borderRadius: 10, padding: '14px 0',
            fontSize: 16, fontWeight: 700, cursor: 'pointer',
            boxShadow: '0 4px 16px rgba(232,84,26,0.3)',
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => { (e.target as HTMLButtonElement).style.background = '#d14318'; }}
          onMouseLeave={e => { (e.target as HTMLButtonElement).style.background = '#E8541A'; }}
        >
          Comenzar demo guiada →
        </button>

        <p style={{ fontSize: 11, color: '#d1d5db', marginTop: 14 }}>
          Sin tarjeta de crédito requerida
        </p>
      </div>
    </div>
  );
}

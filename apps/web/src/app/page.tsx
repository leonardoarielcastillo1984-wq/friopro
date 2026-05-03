'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Zap, Shield, BarChart3, Users, FileCheck, AlertTriangle,
  ArrowRight, CheckCircle, TrendingUp, Layers,
  Phone, Mail, MapPin, Facebook, Twitter, Linkedin,
  ChevronDown
} from 'lucide-react';
import './landing.css';

const NAV_LINKS = [
  { label: 'Módulos', href: '#modulos' },
  { label: 'Planes', href: '#planes' },
  { label: 'Contacto', href: '#contact' },
];

const MODULES = [
  { icon: FileCheck, label: 'Documentos', desc: 'Control de versiones y trazabilidad completa de normativos.' },
  { icon: AlertTriangle, label: 'No Conformidades', desc: 'Hallazgos, causas raíz y planes de acción correctiva.' },
  { icon: BarChart3, label: 'Indicadores', desc: 'KPIs en tiempo real con dashboards configurables.' },
  { icon: Shield, label: 'Auditorías ISO', desc: 'Planificación y ejecución de auditorías internas y externas.' },
  { icon: Users, label: 'RRHH & Capacitación', desc: 'Competencias, capacitaciones y evaluaciones del personal.' },
  { icon: AlertTriangle, label: 'Riesgos', desc: 'Matriz de riesgos con evaluación de impacto y probabilidad.' },
  { icon: TrendingUp, label: 'Proyectos 360', desc: 'Gestión integral de proyectos con seguimiento de hitos.' },
  { icon: Layers, label: 'Gestión de Cambios', desc: 'Control de cambios organizacionales con evaluación de impacto y aprobaciones.' },
];

const PLANS = [
  { name: 'Básico', price: 35, features: ['Hasta 5 usuarios', 'Documentos y Normativos', 'No Conformidades', 'Indicadores de gestión', 'Soporte por email'], highlight: false },
  { name: 'Profesional', price: 69, features: ['Hasta 20 usuarios', 'Todo lo del plan Básico', 'Auditorías ISO completas', 'Capacitaciones y RRHH', 'Gestión de Riesgos', 'Soporte prioritario'], highlight: true },
  { name: 'Premium', price: 99, features: ['Usuarios ilimitados', 'Todo lo del plan Profesional', 'Auditoría IA avanzada', 'Business Intelligence', 'Integraciones API', 'Gestión de Proyectos 360'], highlight: false },
];

const ISOS = ['ISO 9001', 'ISO 39001', 'ISO 14001', 'ISO 45001', 'IATF 16949', 'ISO 27001'];

const FAQS = [
  { q: '¿Puedo gestionar múltiples normas ISO a la vez?', a: 'Sí. SGI 360 está diseñado para gestión multi-norma desde un único panel, eliminando la duplicidad de documentos y esfuerzos.' },
  { q: '¿Qué tan difícil es la implementación?', a: 'La mayoría de nuestros clientes están operativos en menos de 48 horas. El onboarding es guiado y contamos con soporte dedicado en español.' },
  { q: '¿Puedo cambiar de plan cuando quiera?', a: 'Absolutamente. Los cambios de plan se aplican de forma inmediata y el cobro se ajusta de forma proporcional.' },
  { q: '¿Los datos están seguros?', a: 'Encriptación AES-256 en reposo y TLS 1.3 en tránsito. Backups automáticos diarios. Infraestructura en servidores europeos certificados.' },
];

export default function Home() {
  const router = useRouter();
  const [landingSettings, setLandingSettings] = useState<any>(null);
  const [realStats, setRealStats] = useState<any>(null);
  const [expandedFAQ, setExpandedFAQ] = useState<number | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [registered, setRegistered] = useState(false);
  const [loading, setLoading] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [productMenuOpen, setProductMenuOpen] = useState(false);
  const [formData, setFormData] = useState({ companyName: '', email: '', phone: '' });

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/landing/settings`)
      .then(r => r.json())
      .then(data => { if (data.settings) setLandingSettings(data.settings); })
      .catch(() => {});
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/landing/stats`)
      .then(r => r.json())
      .then(data => { if (data) setRealStats(data); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('sr-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08 });
    document.querySelectorAll('.sr').forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/register-company`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyName: formData.companyName, socialReason: formData.companyName, email: formData.email, phone: formData.phone, rut: `PENDIENTE-${Date.now()}`, website: '', address: 'N/A', primaryColor: '#E8541A' }),
      });
      const data = await res.json();
      console.log('Register response:', res.status, data);
      if (res.status < 400) { setRegistered(true); }
      else { alert('Error: ' + (data.error || 'Error desconocido')); }
    } catch(e) { console.error(e); }
    setLoading(false);
  };

  return (
    <>
      {/* NAV */}
      <nav className={scrolled ? 'nav-glass-light scrolled' : 'nav-glass-light'} style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, padding: '0 40px' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64 }}>
          <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
            <div style={{ width: 34, height: 34, background: '#E8541A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Zap size={18} color="white" />
            </div>
            <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 600, fontSize: 17, color: '#1A1A1A', letterSpacing: '-0.01em' }}>SGI 360</span>
          </a>
          <div style={{ display: 'flex', gap: 32, alignItems: 'center' }}>
            {NAV_LINKS.map(l => (
              <a key={l.label} href={l.href} style={{ color: '#777770', textDecoration: 'none', fontSize: 14, fontFamily: "'Syne', sans-serif", fontWeight: 500 }}>{l.label}</a>
            ))}
            <a href="/suite" style={{ color: '#777770', textDecoration: 'none', fontSize: 14, fontFamily: "'Syne', sans-serif" }}>Ingresar</a>
            <button className="btn-primary-light" onClick={() => setShowModal(true)}>Empezar gratis</button>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', padding: '120px 40px 80px', position: 'relative', overflow: 'hidden', background: 'linear-gradient(135deg, #F0EEE9 60%, #FFE8DE 100%)' }}>
        <div style={{ position: 'absolute', top: -100, right: -100, width: 500, height: 500, borderRadius: '50%', background: 'rgba(232,84,26,0.07)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: 60, right: 120, width: 200, height: 200, borderRadius: '50%', background: 'rgba(232,84,26,0.05)', pointerEvents: 'none' }} />
        <div style={{ maxWidth: 1280, margin: '0 auto', width: '100%', position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: 64, flexWrap: 'wrap' as const }}>
          <div style={{ flex: '1 1 420px', minWidth: 300 }}>
            <div className="sr" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, border: '1px solid rgba(232,84,26,0.3)', padding: '5px 14px', marginBottom: 36, background: 'rgba(232,84,26,0.06)' }}>
              <span className="pulse-dot-dark" />
              <span style={{ fontSize: 11, fontFamily: "'Syne', sans-serif", fontWeight: 700, letterSpacing: '0.1em', color: '#E8541A', textTransform: 'uppercase' as const }}>Sistema de Gestión Integrado</span>
            </div>
            <h1 className="sr sr-delay-1" style={{ fontFamily: "'Syne', sans-serif", fontWeight: 500, fontSize: 'clamp(36px, 5vw, 72px)', lineHeight: 0.95, letterSpacing: '-0.035em', margin: '0 0 24px', maxWidth: 800 }}>
              <span style={{ display: 'block', color: '#1A1A1A' }}>Gestión ISO</span>
              <span style={{ display: 'block', color: '#1A1A1A' }}>sin caos.</span>
              <span style={{ display: 'block', color: '#E8541A' }}>Sin excusas.</span>
            </h1>
            <div className="hero-line-dark sr sr-delay-2" style={{ height: 2, background: 'linear-gradient(90deg, #E8541A, transparent)', marginBottom: 24, maxWidth: 320 }} />
            <p className="sr sr-delay-3" style={{ fontSize: 17, color: '#666660', maxWidth: 460, lineHeight: 1.65, margin: '0 0 36px', fontFamily: "'Syne', sans-serif", fontWeight: 400 }}>
              Una plataforma para gestionar ISO 9001, 14001, 45001 y más — con IA integrada y sin hojas de cálculo.
            </p>
            <div className="sr sr-delay-4" style={{ display: 'flex', gap: 12, flexWrap: 'wrap' as const, alignItems: 'flex-start' }}>
              <div style={{ position: 'relative' }}>
                <button className="btn-primary-light" onClick={() => setProductMenuOpen(o => !o)} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  Comenzar ahora <ChevronDown size={14} />
                </button>
                {productMenuOpen && (
                  <div style={{ position: 'absolute', bottom: 'calc(100% + 8px)', left: 0, background: 'white', borderRadius: 10, boxShadow: '0 -12px 40px rgba(0,0,0,0.15)', padding: '8px 0', minWidth: 220, zIndex: 50, border: '1px solid rgba(0,0,0,0.06)' }}>
                    {[
                      { name: 'SGI 360', color: '#E8541A', desc: 'Gestión integrada ISO' },
                      { name: 'AUDIT 360', color: '#2563EB', desc: 'Auditorías inteligentes' },
                      { name: 'FLOTA 360', color: '#0891B2', desc: 'Gestión de flota' },
                      { name: 'SEH 360', color: '#059669', desc: 'Seguridad e higiene' },
                    ].map(p => (
                      <button key={p.name} onClick={() => { setProductMenuOpen(false); setShowModal(true); }} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 16px', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left' }} onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.03)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: p.color, flexShrink: 0 }} />
                        <div>
                          <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 13, color: '#1A1A1A' }}>{p.name}</div>
                          <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 11, color: '#888880' }}>{p.desc}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button className="btn-ghost-light" onClick={() => document.getElementById('modulos')?.scrollIntoView({ behavior: 'smooth' })}>Ver módulos</button>
            </div>
            <div className="sr sr-delay-5" style={{ marginTop: 52, display: 'flex', gap: 8, flexWrap: 'wrap' as const }}>
              {ISOS.map(iso => (
                <span key={iso} style={{ fontSize: 10, fontFamily: "'Syne', sans-serif", fontWeight: 700, letterSpacing: '0.08em', color: '#999990', border: '1px solid rgba(0,0,0,0.12)', padding: '4px 10px', textTransform: 'uppercase' as const, background: 'rgba(255,255,255,0.5)' }}>{iso}</span>
              ))}
            </div>
          </div>
          {/* Dashboard preview visual */}
          <div style={{ flex: '1 1 420px', minWidth: 300, display: 'flex', justifyContent: 'center' }}>
            <div style={{ width: '100%', maxWidth: 520, background: 'white', borderRadius: 16, boxShadow: '0 20px 60px rgba(0,0,0,0.12)', padding: 24, display: 'flex', flexDirection: 'column' as const, gap: 16, transform: 'perspective(1000px) rotateY(-8deg) rotateX(4deg)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(0,0,0,0.06)', paddingBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#E8541A' }} />
                  <div style={{ fontSize: 11, color: '#999990', fontWeight: 600, fontFamily: "'Syne', sans-serif" }}>SGI 360 Dashboard</div>
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  {['#FF5F57','#FFBD2E','#28C840'].map(c => <div key={c} style={{ width: 8, height: 8, borderRadius: '50%', background: c }} />)}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {[
                  { label: 'Hallazgos IA', val: '23', sub: 'Analizados hoy', color: '#E8541A' },
                  { label: 'Auditorías', val: '8', sub: 'Programadas', color: '#2563EB' },
                  { label: 'Indicadores', val: '32', sub: 'Activos', color: '#059669' },
                  { label: 'Acciones auto', val: '12', sub: 'Autónomas', color: '#DC2626' },
                ].map(card => (
                  <div key={card.label} style={{ background: '#F5F4F0', borderRadius: 10, padding: '14px 16px' }}>
                    <div style={{ fontSize: 10, color: '#888880', fontFamily: "'Syne', sans-serif", marginBottom: 4 }}>{card.label}</div>
                    <div style={{ fontSize: 22, fontWeight: 600, color: card.color, fontFamily: "'Syne', sans-serif", lineHeight: 1, marginBottom: 2 }}>{card.val}</div>
                    <div style={{ fontSize: 9, color: '#AAAAA0', fontFamily: "'Syne', sans-serif" }}>{card.sub}</div>
                  </div>
                ))}
              </div>
              <div style={{ background: '#F5F4F0', borderRadius: 10, padding: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg,#E8541A,#F97316)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Zap size={16} color="white" />
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#1A1A1A', fontFamily: "'Syne', sans-serif" }}>Asistente IA activo</div>
                  <div style={{ fontSize: 10, color: '#888880', fontFamily: "'Syne', sans-serif" }}>Análisis autónomo de hallazgos y normativas</div>
                </div>
              </div>
              <div style={{ background: '#F5F4F0', borderRadius: 10, padding: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg,#2563EB,#3B82F6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <CheckCircle size={16} color="white" />
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#1A1A1A', fontFamily: "'Syne', sans-serif" }}>5 flujos autónomos activos</div>
                  <div style={{ fontSize: 10, color: '#888880', fontFamily: "'Syne', sans-serif" }}>NCRs, acciones correctivas y recordatorios</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {['ISO 9001','ISO 14001','ISO 45001'].map(tag => (
                  <span key={tag} style={{ fontSize: 9, fontFamily: "'Syne', sans-serif", fontWeight: 600, color: '#666660', border: '1px solid rgba(0,0,0,0.08)', padding: '3px 8px', borderRadius: 4, background: 'white' }}>{tag}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* TICKER */}
      <div style={{ background: '#E8541A', padding: '12px 0', overflow: 'hidden' }}>
        <div className="ticker-track">
          {[...ISOS, ...ISOS, ...ISOS, ...ISOS].map((iso, i) => (
            <span key={i} style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase' as const, color: 'white', paddingRight: 40, whiteSpace: 'nowrap' as const }}>{iso} <span style={{ opacity: 0.5, marginRight: 40 }}>—</span></span>
          ))}
        </div>
      </div>

      {/* STATS */}
      <section style={{ padding: '80px 40px', background: '#E8E6E0' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
            {[
              { icon: Zap, title: 'IA integrada', desc: 'Análisis de documentos y hallazgos con inteligencia artificial.', accent: true },
              { icon: CheckCircle, title: 'Automatización', desc: 'Flujos automáticos para NCRs y acciones correctivas.', accent: false },
              { icon: BarChart3, title: 'Gestión autónoma', desc: 'Dashboards en tiempo real sin intervención manual.', accent: false },
              { icon: TrendingUp, title: 'Análisis predictivo', desc: 'Detección proactiva de riesgos y tendencias.', orange: true },
            ].map((s, i) => (
              <div key={i} className="sr stat-card-light" style={{ transitionDelay: `${i * 0.1}s`, background: s.orange ? '#E8541A' : 'white', padding: '36px 28px', borderLeft: s.accent ? '3px solid #E8541A' : 'none' }}>
                <div style={{ width: 36, height: 36, background: s.orange ? 'rgba(255,255,255,0.12)' : 'rgba(232,84,26,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16, borderRadius: 8 }}>
                  <s.icon size={18} color={s.orange ? 'white' : '#E8541A'} />
                </div>
                <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 600, fontSize: 18, lineHeight: 1.2, letterSpacing: '-0.02em', color: s.orange ? 'white' : s.accent ? '#E8541A' : '#1A1A1A', marginBottom: 10 }}>{s.title}</div>
                <div style={{ fontSize: 12, color: s.orange ? 'rgba(255,255,255,0.75)' : '#777770', lineHeight: 1.6, fontFamily: "'Syne', sans-serif" }}>{s.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>


      {/* PRODUCTOS / ECOSISTEMA */}
      <section style={{ padding: '100px 40px', background: '#F0EEE9' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
          <div className="sr" style={{ marginBottom: 64 }}>
            <span style={{ fontSize: 11, fontFamily: "'Syne', sans-serif", fontWeight: 700, letterSpacing: '0.12em', color: '#E8541A', textTransform: 'uppercase' as const, display: 'block', marginBottom: 16 }}>Ecosistema</span>
            <h2 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 500, fontSize: 'clamp(22px, 2.8vw, 36px)', letterSpacing: '-0.02em', lineHeight: 1, margin: 0, color: '#1A1A1A' }}>
              Cuatro productos.<br />Un solo ecosistema.
            </h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
            {[
              {
                tag: 'SGI 360',
                title: 'Sistema de Gestión Integrado',
                desc: 'Gestión normas ISO, procesos, documentos, riesgos, acciones y mucho más.',
                color: '#E8541A',
                available: true,
              },
              {
                tag: 'SEH 360',
                title: 'Seguridad e Higiene Laboral',
                desc: 'Gestión de seguridad laboral, higiene, capacitaciones e incidentes.',
                color: '#059669',
                available: false,
              },
              {
                tag: 'AUDIT 360',
                title: 'Auditorías Inteligentes',
                desc: 'Herramientas para auditores y consultores de calidad.',
                color: '#2563EB',
                available: false,
              },
              {
                tag: 'FLOTA 360',
                title: 'Gestión de Flota',
                desc: 'Control y mantenimiento de flota, inspecciones y costos.',
                color: '#0891B2',
                available: false,
              },
            ].map((p, i) => (
              <div key={i} className="sr module-card-light" style={{ transitionDelay: `${i * 0.1}s`, background: 'white', padding: '36px 28px', border: `1px solid ${p.color}20`, borderRadius: 12, position: 'relative' as const }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: `${p.color}12`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Shield size={20} color={p.color} />
                  </div>
                  {p.available
                    ? <span style={{ fontSize: 10, fontFamily: "'Syne', sans-serif", fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: 'white', background: p.color, padding: '3px 10px', borderRadius: 4 }}>Disponible</span>
                    : <span style={{ fontSize: 10, fontFamily: "'Syne', sans-serif", fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: '#888880', background: '#E8E6E0', padding: '3px 10px', borderRadius: 4 }}>Próximamente</span>
                  }
                </div>
                <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 15, color: p.color, marginBottom: 10, letterSpacing: '0.02em', lineHeight: 1.5 }}>{p.tag}</div>
                <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 600, fontSize: 19, marginBottom: 12, color: '#1A1A1A', lineHeight: 1.5 }}>{p.title}</div>
                <div style={{ fontSize: 14, color: '#777770', lineHeight: 1.6, fontFamily: "'Syne', sans-serif" }}>{p.desc}</div>
                {p.available && (
                  <a href="/suite" style={{ display: 'block', marginTop: 20, padding: '10px 0', textAlign: 'center', background: p.color, color: 'white', textDecoration: 'none', borderRadius: 6, fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 13 }}>Ingresar al módulo →</a>
                )}
                {!p.available && (
                  <div style={{ marginTop: 20, padding: '10px 0', textAlign: 'center', background: '#F0EEE9', color: '#999990', borderRadius: 6, fontFamily: "'Syne', sans-serif", fontWeight: 600, fontSize: 13 }}>Próximamente</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* MÓDULOS */}
      <section id="modulos" style={{ padding: '100px 40px', background: '#F0EEE9' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
          <div className="sr" style={{ marginBottom: 64 }}>
            <span style={{ fontSize: 11, fontFamily: "'Syne', sans-serif", fontWeight: 700, letterSpacing: '0.12em', color: '#E8541A', textTransform: 'uppercase' as const, display: 'block', marginBottom: 16 }}>Módulos</span>
            <h2 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 500, fontSize: 'clamp(24px, 3vw, 38px)', letterSpacing: '-0.03em', lineHeight: 0.95, margin: 0, color: '#1A1A1A' }}>
              Todo lo que necesitás,<br /><span style={{ color: '#E8541A' }}>en un solo lugar.</span>
            </h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
            {MODULES.map((m, i) => (
              <div key={i} className="sr module-card-light" style={{ transitionDelay: `${i * 0.07}s`, background: 'white', padding: '36px 32px', border: '1px solid rgba(0,0,0,0.08)' }}>
                <div style={{ width: 42, height: 42, background: 'rgba(232,84,26,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
                  <m.icon size={20} color="#E8541A" />
                </div>
                <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 16, marginBottom: 10, color: '#1A1A1A' }}>{m.label}</div>
                <div style={{ fontSize: 13, color: '#777770', lineHeight: 1.6 }}>{m.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PLANES */}
      <section id="planes" style={{ padding: '100px 40px', background: '#E8E6E0' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
          <div className="sr" style={{ marginBottom: 56 }}>
            <span style={{ fontSize: 11, fontFamily: "'Syne', sans-serif", fontWeight: 700, letterSpacing: '0.12em', color: '#E8541A', textTransform: 'uppercase' as const, display: 'block', marginBottom: 16 }}>Planes</span>
            <h2 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 500, fontSize: 'clamp(24px, 3vw, 38px)', letterSpacing: '-0.03em', lineHeight: 0.95, margin: 0, color: '#1A1A1A' }}>
              Simple.<br />Transparente.
            </h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
            {[
              {
                name: 'SGI 360', price: 99, color: '#E8541A',
                features: ['Sistema de Gestión Integrado completo', 'Documentos y normativos', 'Auditorías ISO', 'Indicadores de gestión', 'No conformidades', 'Proyectos 360', 'IA integrada'],
                highlight: true, available: true,
              },
              {
                name: 'FLOTA 360', price: 99, color: '#0891B2',
                features: ['Gestión de flota completa', 'Mantenimientos programados', 'Control de costos', 'Inspecciones vehiculares', 'Documentación operativa'],
                highlight: false, available: false,
              },
              {
                name: 'SEH 360', price: 29, color: '#059669',
                features: ['Seguridad e higiene laboral', 'Gestión de incidentes', 'Capacitaciones', 'Controles de EPP'],
                highlight: false, available: false,
              },
              {
                name: 'AUDIT 360', price: 29, color: '#2563EB',
                features: ['Herramientas para auditores', 'Planificación de auditorías', 'Informes profesionales', 'Gestión de clientes auditados'],
                highlight: false, available: false,
              },
            ].map((plan, i) => (
              <div key={i} className="sr plan-card-light" style={{ transitionDelay: `${i * 0.1}s`, background: plan.highlight ? plan.color : 'white', padding: '40px 32px', border: plan.highlight ? 'none' : `1px solid ${plan.color}30`, borderRadius: 12, position: 'relative' }}>
                {plan.highlight && <div style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(0,0,0,0.2)', padding: '3px 10px', fontSize: 10, fontFamily: "'Syne', sans-serif", fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: 'white', borderRadius: 4 }}>Más popular</div>}
                <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase' as const, marginBottom: 20, color: plan.highlight ? 'rgba(255,255,255,0.7)' : '#999990' }}>{plan.name}</div>
                <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 500, fontSize: 56, letterSpacing: '-0.04em', lineHeight: 1, marginBottom: 6, color: plan.highlight ? 'white' : '#1A1A1A' }}>${plan.price}</div>
                <div style={{ fontSize: 12, color: plan.highlight ? 'rgba(255,255,255,0.6)' : '#999990', marginBottom: 32, fontFamily: "'Syne', sans-serif" }}>USD / mes</div>
                <div style={{ height: 1, background: plan.highlight ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.08)', marginBottom: 28 }} />
                <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 36px', display: 'flex', flexDirection: 'column' as const, gap: 11 }}>
                  {plan.features.map((f, j) => (
                    <li key={j} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 13, color: plan.highlight ? 'white' : '#444440', fontFamily: "'Syne', sans-serif" }}>
                      <CheckCircle size={14} style={{ flexShrink: 0, marginTop: 2, color: plan.highlight ? 'white' : plan.color }} />{f}
                    </li>
                  ))}
                </ul>
                {plan.available
                  ? <button onClick={() => setShowModal(true)} style={{ width: '100%', padding: '13px', fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 13, cursor: 'pointer', background: plan.highlight ? 'white' : plan.color, color: plan.highlight ? plan.color : 'white', border: 'none', borderRadius: 6 }}>Empezar con {plan.name}</button>
                  : <div style={{ width: '100%', padding: '13px', fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 13, textAlign: 'center', background: '#F0EEE9', color: '#999990', borderRadius: 6 }}>Próximamente</div>
                }
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section style={{ padding: '100px 40px', background: '#F0EEE9' }}>
        <div style={{ maxWidth: 760, margin: '0 auto' }}>
          <div className="sr" style={{ marginBottom: 56 }}>
            <span style={{ fontSize: 11, fontFamily: "'Syne', sans-serif", fontWeight: 700, letterSpacing: '0.12em', color: '#E8541A', textTransform: 'uppercase' as const, display: 'block', marginBottom: 16 }}>FAQ</span>
            <h2 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 500, fontSize: 'clamp(22px, 2.8vw, 36px)', letterSpacing: '-0.03em', lineHeight: 1, margin: 0, color: '#1A1A1A' }}>Preguntas frecuentes</h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' as const }}>
            {FAQS.map((faq, i) => (
              <div key={i} className="sr" style={{ transitionDelay: `${i * 0.08}s`, borderTop: '1px solid rgba(0,0,0,0.1)' }}>
                <button onClick={() => setExpandedFAQ(expandedFAQ === i ? null : i)} style={{ width: '100%', background: 'none', border: 'none', padding: '24px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', gap: 24, textAlign: 'left' as const }}>
                  <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 600, fontSize: 15, color: '#1A1A1A' }}>{faq.q}</span>
                  <span style={{ color: '#E8541A', flexShrink: 0, fontSize: 20, fontWeight: 300 }}>{expandedFAQ === i ? '−' : '+'}</span>
                </button>
                {expandedFAQ === i && <div style={{ paddingBottom: 24, color: '#777770', fontSize: 14, lineHeight: 1.7, fontFamily: "'Syne', sans-serif" }}>{faq.a}</div>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer id="contact" style={{ background: '#1A1A1A', padding: '72px 40px 36px', color: '#FAFAF8' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1.5fr', gap: 48, marginBottom: 56 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
                <div style={{ width: 32, height: 32, background: '#E8541A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Zap size={16} color="white" />
                </div>
                <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 600, fontSize: 16, color: '#FAFAF8' }}>SGI 360</span>
              </div>
              <p style={{ fontSize: 13, color: '#888880', lineHeight: 1.7, marginBottom: 24, maxWidth: 240, fontFamily: "'Syne', sans-serif" }}>Plataforma de gestión integrada para empresas que toman en serio su calidad.</p>
              <div style={{ display: 'flex', gap: 16 }}>
                <Facebook size={17} color="#888880" style={{ cursor: 'pointer' }} />
                <Twitter size={17} color="#888880" style={{ cursor: 'pointer' }} />
                <Linkedin size={17} color="#888880" style={{ cursor: 'pointer' }} />
              </div>
            </div>
            <div>
              <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: '#FAFAF8', marginBottom: 18 }}>Productos</div>
              {['SGI 360', 'SEH 360', 'Audit360'].map(p => <a key={p} href="#" style={{ display: 'block', color: '#888880', textDecoration: 'none', fontSize: 13, marginBottom: 10, fontFamily: "'Syne', sans-serif" }}>{p}</a>)}
            </div>
            <div>
              <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: '#FAFAF8', marginBottom: 18 }}>Legal</div>
              {['Términos', 'Privacidad', 'Cookies'].map(p => <a key={p} href="#" style={{ display: 'block', color: '#888880', textDecoration: 'none', fontSize: 13, marginBottom: 10, fontFamily: "'Syne', sans-serif" }}>{p}</a>)}
            </div>
            <div>
              <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: '#FAFAF8', marginBottom: 18 }}>Contacto</div>
              <a href="https://wa.me/5491166169368" target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#888880', textDecoration: 'none', fontSize: 13, fontFamily: "'Syne', sans-serif" }}>
                <Phone size={14} />+54 9 1166169368
              </a>
            </div>
          </div>
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 28, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' as const, gap: 16 }}>
            <span style={{ fontSize: 12, color: '#888880', fontFamily: "'Syne', sans-serif" }}>© 2025 SGI 360. Todos los derechos reservados.</span>
            <div style={{ display: 'flex', gap: 10 }}>
              {['ISO 9001:2015', 'ISO 45001:2018', 'ISO 14001:2015'].map(tag => (
                <span key={tag} style={{ fontSize: 10, color: '#888880', border: '1px solid rgba(255,255,255,0.1)', padding: '4px 10px', fontFamily: "'Syne', sans-serif", fontWeight: 600, letterSpacing: '0.05em' }}>{tag}</span>
              ))}
            </div>
          </div>
        </div>
      </footer>

      {/* MODAL */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ background: 'white', border: '1px solid rgba(0,0,0,0.1)', padding: '48px', maxWidth: 460, width: '100%', position: 'relative' }}>
            <button onClick={() => setShowModal(false)} style={{ position: 'absolute', top: 20, right: 20, background: 'none', border: 'none', color: '#999990', cursor: 'pointer', fontSize: 22 }}>×</button>
            {registered ? (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <div style={{ width: 64, height: 64, background: '#E8541A', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}><span style={{ color: 'white', fontSize: 32 }}>✓</span></div>
                <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 22, color: '#1A1A1A', marginBottom: 12 }}>¡Solicitud enviada!</div>
                <p style={{ color: '#777770', fontSize: 14, lineHeight: 1.6 }}>Recibimos tu solicitud. Nos comunicaremos con vos a la brevedad.</p>
                <button onClick={() => { setShowModal(false); setRegistered(false); }} style={{ marginTop: 24, background: '#E8541A', color: 'white', border: 'none', padding: '12px 32px', fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>Cerrar</button>
              </div>
            ) : (
            <>
            <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 500, fontSize: 26, letterSpacing: '-0.03em', marginBottom: 8, color: '#1A1A1A' }}>Crear cuenta</div>
            <p style={{ color: '#999990', fontSize: 14, marginBottom: 28, fontFamily: "'Syne', sans-serif" }}>Gratis por 30 días. Sin tarjeta de crédito.</p>
            <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column' as const, gap: 14 }}>
              <input required placeholder="Nombre de la empresa" value={formData.companyName} onChange={e => setFormData(p => ({ ...p, companyName: e.target.value }))} style={{ background: '#F5F4F0', border: '1px solid rgba(0,0,0,0.1)', color: '#1A1A1A', padding: '13px 16px', fontSize: 14, outline: 'none', width: '100%', fontFamily: "'Syne', sans-serif" }} />
              <input required type="email" placeholder="Email corporativo" value={formData.email} onChange={e => setFormData(p => ({ ...p, email: e.target.value }))} style={{ background: '#F5F4F0', border: '1px solid rgba(0,0,0,0.1)', color: '#1A1A1A', padding: '13px 16px', fontSize: 14, outline: 'none', width: '100%', fontFamily: "'Syne', sans-serif" }} />
              <input placeholder="Teléfono (opcional)" value={formData.phone} onChange={e => setFormData(p => ({ ...p, phone: e.target.value }))} style={{ background: '#F5F4F0', border: '1px solid rgba(0,0,0,0.1)', color: '#1A1A1A', padding: '13px 16px', fontSize: 14, outline: 'none', width: '100%', fontFamily: "'Syne', sans-serif" }} />
              <button type="submit" disabled={loading} style={{ background: '#E8541A', color: 'white', border: 'none', padding: '14px', fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 6 }}>
                {loading ? 'Creando...' : 'Empezar gratis'} {!loading && <ArrowRight size={15} />}
              </button>
            </form>
            </>
            )}
          </div>
        </div>
      )}

      {/* WHATSAPP */}
      <a href="https://wa.me/5491166169368" target="_blank" rel="noopener noreferrer" className="wsp-float"
        style={{ position: 'fixed', bottom: 28, right: 28, width: 56, height: 56, borderRadius: '50%', background: '#25D366', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 20px rgba(37,211,102,0.4)', zIndex: 999, textDecoration: 'none' }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="white">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
          <path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.122 1.532 5.855L.057 23.943l6.284-1.648A11.933 11.933 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 01-5.002-1.368l-.359-.213-3.728.977.995-3.638-.234-.374A9.818 9.818 0 1112 21.818z"/>
        </svg>
      </a>
    </>
  );
}

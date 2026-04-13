'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Zap, Shield, BarChart3, Users, FileCheck, AlertTriangle,
  ArrowRight, CheckCircle, TrendingUp, Layers,
  Phone, Mail, MapPin, Facebook, Twitter, Linkedin
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
  { icon: Layers, label: 'Integraciones', desc: 'API abierta compatible con Excel, Google Workspace y más.' },
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
  const [expandedFAQ, setExpandedFAQ] = useState<number | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [registered, setRegistered] = useState(false);
  const [loading, setLoading] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [formData, setFormData] = useState({ companyName: '', email: '', phone: '' });

  useEffect(() => {
    fetch('https://logismart.ar/api/landing/settings')
      .then(r => r.json())
      .then(data => { if (data.settings) setLandingSettings(data.settings); })
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
      const res = await fetch('https://logismart.ar/api/register-company', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyName: formData.companyName, socialReason: formData.companyName, email: formData.email, phone: formData.phone, rut: 'N/A', website: '', address: 'N/A', primaryColor: '#E8541A' }),
      });
      if (res.status < 400) { setRegistered(true); }
    } catch {}
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
            <a href="/login" style={{ color: '#777770', textDecoration: 'none', fontSize: 14, fontFamily: "'Syne', sans-serif" }}>Ingresar</a>
            <button className="btn-primary-light" onClick={() => setShowModal(true)}>Empezar gratis</button>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '120px 40px 80px', position: 'relative', overflow: 'hidden', background: 'linear-gradient(135deg, #F0EEE9 60%, #FFE8DE 100%)' }}>
        <div style={{ position: 'absolute', top: -100, right: -100, width: 500, height: 500, borderRadius: '50%', background: 'rgba(232,84,26,0.07)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: 60, right: 120, width: 200, height: 200, borderRadius: '50%', background: 'rgba(232,84,26,0.05)', pointerEvents: 'none' }} />
        <div style={{ maxWidth: 1280, margin: '0 auto', width: '100%', position: 'relative', zIndex: 1 }}>
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
          <div className="sr sr-delay-4" style={{ display: 'flex', gap: 12, flexWrap: 'wrap' as const }}>
            <button className="btn-primary-light" onClick={() => setShowModal(true)}>Comenzar ahora <ArrowRight size={15} /></button>
            <button className="btn-ghost-light" onClick={() => document.getElementById('modulos')?.scrollIntoView({ behavior: 'smooth' })}>Ver módulos</button>
          </div>
          <div className="sr sr-delay-5" style={{ marginTop: 52, display: 'flex', gap: 8, flexWrap: 'wrap' as const }}>
            {ISOS.map(iso => (
              <span key={iso} style={{ fontSize: 10, fontFamily: "'Syne', sans-serif", fontWeight: 700, letterSpacing: '0.08em', color: '#999990', border: '1px solid rgba(0,0,0,0.12)', padding: '4px 10px', textTransform: 'uppercase' as const, background: 'rgba(255,255,255,0.5)' }}>{iso}</span>
            ))}
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
              { value: '500+', label: 'Empresas activas', accent: true },
              { value: '1500+', label: 'Usuarios', accent: false },
              { value: '99.9%', label: 'Uptime garantizado', accent: false },
              { value: '15 años', label: 'Experiencia ISO', orange: true },
            ].map((s, i) => (
              <div key={i} className="sr stat-card-light" style={{ transitionDelay: `${i * 0.1}s`, background: s.orange ? '#E8541A' : 'white', padding: '36px 28px', borderLeft: s.accent ? '3px solid #E8541A' : 'none' }}>
                <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 500, fontSize: 'clamp(36px, 4vw, 52px)', lineHeight: 1, letterSpacing: '-0.04em', color: s.orange ? 'white' : s.accent ? '#E8541A' : '#1A1A1A', marginBottom: 8 }}>{s.value}</div>
                <div style={{ fontSize: 11, color: s.orange ? 'rgba(255,255,255,0.7)' : '#999990', letterSpacing: '0.06em', textTransform: 'uppercase' as const, fontFamily: "'Syne', sans-serif", fontWeight: 600 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>


      {/* PRODUCTOS */}
      <section style={{ padding: '100px 40px', background: '#F0EEE9' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
          <div className="sr" style={{ marginBottom: 64 }}>
            <span style={{ fontSize: 11, fontFamily: "'Syne', sans-serif", fontWeight: 700, letterSpacing: '0.12em', color: '#E8541A', textTransform: 'uppercase' as const, display: 'block', marginBottom: 16 }}>Ecosistema</span>
            <h2 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 500, fontSize: 'clamp(22px, 2.8vw, 36px)', letterSpacing: '-0.02em', lineHeight: 1, margin: 0, color: '#1A1A1A' }}>
              Tres productos.<br />Un solo ecosistema.
            </h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            {[
              {
                tag: 'SGI 360',
                title: 'Sistema de Gestión Integrado',
                features: ['Gestión multi-norma ISO en una sola plataforma', 'Documentos, auditorías, indicadores y más', 'IA integrada para análisis y reportes'],
                available: true,
              },
              {
                tag: 'SEH 360',
                title: 'Seguridad e Higiene Laboral',
                features: ['Gestión de Riesgos Laborales', 'Investigación de Incidentes', 'EPP y Controles'],
                available: true,
              },
              {
                tag: 'AUDIT 360',
                title: 'Para Auditores y Consultoras',
                features: ['Gestión de clientes y empresas auditadas', 'Planificación y ejecución de auditorías externas', 'Generación de informes profesionales'],
                available: false,
              },
            ].map((p, i) => (
              <div key={i} className="sr module-card-light" style={{ transitionDelay: `${i * 0.1}s`, background: 'white', padding: '40px 36px', border: '1px solid rgba(0,0,0,0.08)', position: 'relative' as const }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                  <span style={{ fontSize: 11, fontFamily: "'Syne', sans-serif", fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: '#E8541A', background: 'rgba(232,84,26,0.08)', padding: '4px 10px' }}>{p.tag}</span>
                  {!p.available && <span style={{ fontSize: 10, fontFamily: "'Syne', sans-serif", fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: '#999990', border: '1px solid rgba(0,0,0,0.1)', padding: '3px 8px' }}>Próximamente</span>}
                </div>
                <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 600, fontSize: 18, marginBottom: 24, color: '#1A1A1A', lineHeight: 1.3 }}>{p.title}</div>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column' as const, gap: 12 }}>
                  {p.features.map((f, j) => (
                    <li key={j} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 13, color: '#666660', fontFamily: "'Syne', sans-serif", lineHeight: 1.5 }}>
                      <span style={{ color: '#E8541A', flexShrink: 0, marginTop: 1 }}>→</span>{f}
                    </li>
                  ))}
                </ul>
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            {PLANS.map((plan, i) => (
              <div key={i} className="sr plan-card-light" style={{ transitionDelay: `${i * 0.1}s`, background: plan.highlight ? '#E8541A' : 'white', padding: '40px 32px', border: plan.highlight ? 'none' : '1px solid rgba(0,0,0,0.08)', position: 'relative' }}>
                {plan.highlight && <div style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(0,0,0,0.15)', padding: '3px 10px', fontSize: 10, fontFamily: "'Syne', sans-serif", fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: 'white' }}>Más popular</div>}
                <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase' as const, marginBottom: 20, color: plan.highlight ? 'rgba(255,255,255,0.7)' : '#999990' }}>{plan.name}</div>
                <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 500, fontSize: 56, letterSpacing: '-0.04em', lineHeight: 1, marginBottom: 6, color: plan.highlight ? 'white' : '#1A1A1A' }}>${plan.price}</div>
                <div style={{ fontSize: 12, color: plan.highlight ? 'rgba(255,255,255,0.6)' : '#999990', marginBottom: 32, fontFamily: "'Syne', sans-serif" }}>USD / mes</div>
                <div style={{ height: 1, background: plan.highlight ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.08)', marginBottom: 28 }} />
                <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 36px', display: 'flex', flexDirection: 'column' as const, gap: 11 }}>
                  {plan.features.map((f, j) => (
                    <li key={j} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 13, color: plan.highlight ? 'white' : '#444440', fontFamily: "'Syne', sans-serif" }}>
                      <CheckCircle size={14} style={{ flexShrink: 0, marginTop: 2 }} />{f}
                    </li>
                  ))}
                </ul>
                <button onClick={() => setShowModal(true)} style={{ width: '100%', padding: '13px', fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 13, cursor: 'pointer', background: plan.highlight ? 'white' : '#1A1A1A', color: plan.highlight ? '#E8541A' : 'white', border: 'none' }}>
                  Empezar con {plan.name}
                </button>
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
              <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 12 }}>
                <a href={'mailto:' + (landingSettings?.email || 'info@sgi360.com')} style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#888880', textDecoration: 'none', fontSize: 13, fontFamily: "'Syne', sans-serif" }}>
                  <Mail size={14} />{landingSettings?.email || 'info@sgi360.com'}
                </a>
                <a href={'tel:' + (landingSettings?.phone || '')} style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#888880', textDecoration: 'none', fontSize: 13, fontFamily: "'Syne', sans-serif" }}>
                  <Phone size={14} />{landingSettings?.phone || '+54 011 15 66169368'}
                </a>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#888880', fontSize: 13, fontFamily: "'Syne', sans-serif" }}>
                  <MapPin size={14} />{landingSettings?.address || 'Buenos Aires, Argentina'}
                </div>
              </div>
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

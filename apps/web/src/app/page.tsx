'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Zap, Shield, BarChart3, Users, FileCheck, AlertTriangle,
  ChevronRight, ArrowRight, CheckCircle, Star, Menu, X,
  Phone, Mail, MapPin, Facebook, Twitter, Linkedin,
  MessageSquare, Globe, Award, TrendingUp, Clock, Layers
} from 'lucide-react';

// ─── DATA ────────────────────────────────────────────────────────────────────

const NAV_LINKS = [
  { label: 'Producto', href: '#producto' },
  { label: 'Módulos', href: '#modulos' },
  { label: 'Planes', href: '#planes' },
  { label: 'Clientes', href: '#clientes' },
  { label: 'Contacto', href: '#contact' },
];

const MODULES = [
  { icon: FileCheck, label: 'Documentos', desc: 'Control de versiones y trazabilidad completa de normativos y procedimientos.' },
  { icon: AlertTriangle, label: 'No Conformidades', desc: 'Gestión de hallazgos, causas raíz y planes de acción correctiva.' },
  { icon: BarChart3, label: 'Indicadores', desc: 'KPIs en tiempo real con dashboards configurables por área.' },
  { icon: Shield, label: 'Auditorías ISO', desc: 'Planificación, ejecución y seguimiento de auditorías internas y externas.' },
  { icon: Users, label: 'RRHH & Capacitación', desc: 'Gestión de competencias, capacitaciones y evaluaciones del personal.' },
  { icon: AlertTriangle, label: 'Riesgos', desc: 'Matriz de riesgos con evaluación de impacto y probabilidad.' },
  { icon: TrendingUp, label: 'Proyectos 360', desc: 'Gestión integral de proyectos con seguimiento de hitos y recursos.' },
  { icon: Layers, label: 'Integraciones', desc: 'API abierta compatible con Excel, Google Workspace, Power BI y más.' },
];

const PLANS = [
  {
    name: 'Básico',
    price: 35,
    features: ['Hasta 5 usuarios', 'Documentos y Normativos', 'No Conformidades', 'Indicadores de gestión', 'Soporte por email'],
    highlight: false,
  },
  {
    name: 'Profesional',
    price: 69,
    features: ['Hasta 20 usuarios', 'Todo lo del plan Básico', 'Auditorías ISO completas', 'Capacitaciones y RRHH', 'Gestión de Riesgos', 'Soporte prioritario'],
    highlight: true,
  },
  {
    name: 'Premium',
    price: 99,
    features: ['Usuarios ilimitados', 'Todo lo del plan Profesional', 'Auditoría IA avanzada', 'Business Intelligence', 'Integraciones API', 'Gestión de Proyectos 360'],
    highlight: false,
  },
];

const ISOS = ['ISO 9001', 'ISO 39001', 'ISO 14001', 'ISO 45001', 'IATF 16949', 'ISO 27001'];

const STATS = [
  { value: 500, suffix: '+', label: 'Empresas activas' },
  { value: 1500, suffix: '+', label: 'Usuarios en plataforma' },
  { value: 99.9, suffix: '%', label: 'Uptime garantizado' },
  { value: 15, suffix: ' años', label: 'De experiencia ISO' },
];

const FAQS = [
  { q: '¿Puedo gestionar múltiples normas ISO a la vez?', a: 'Sí. SGI 360 está diseñado para gestión multi-norma desde un único panel, eliminando la duplicidad de documentos y esfuerzos.' },
  { q: '¿Qué tan difícil es la implementación?', a: 'La mayoría de nuestros clientes están operativos en menos de 48 horas. El onboarding es guiado y contamos con soporte dedicado en español.' },
  { q: '¿Puedo cambiar de plan cuando quiera?', a: 'Absolutamente. Los cambios de plan se aplican de forma inmediata y el cobro se ajusta de forma proporcional.' },
  { q: '¿Los datos están seguros?', a: 'Encriptación AES-256 en reposo y TLS 1.3 en tránsito. Backups automáticos diarios. Infraestructura en servidores europeos certificados.' },
  { q: '¿Funciona para empresas de cualquier tamaño?', a: 'Desde PYMEs de 5 personas hasta corporaciones con miles de empleados. La arquitectura multi-tenant escala sin límite.' },
];

// ─── ANIMATED COUNTER ────────────────────────────────────────────────────────

function Counter({ value, suffix }: { value: number; suffix: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !started.current) {
        started.current = true;
        const duration = 1800;
        const steps = 60;
        const increment = value / steps;
        let current = 0;
        const timer = setInterval(() => {
          current += increment;
          if (current >= value) { setCount(value); clearInterval(timer); }
          else setCount(Math.floor(current));
        }, duration / steps);
      }
    }, { threshold: 0.5 });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [value]);

  return <span ref={ref}>{count}{suffix}</span>;
}

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────

export default function Home() {
  const router = useRouter();
  const [landingSettings, setLandingSettings] = useState<any>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [expandedFAQ, setExpandedFAQ] = useState<number | null>(null);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ companyName: '', email: '', phone: '', country: 'Argentina' });
  const [scrolled, setScrolled] = useState(false);
  const heroRef = useRef<HTMLDivElement>(null);

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

  // Scroll reveal
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
      const res = await fetch('/api/register-company', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        setShowRegisterModal(false);
        router.push('/onboarding');
      }
    } catch {}
    setLoading(false);
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;1,9..40,300&display=swap');

        *, *::before, *::after { box-sizing: border-box; }

        :root {
          --ink: #0A0A0B;
          --ink-2: #111114;
          --ink-3: #1A1A1F;
          --surface: #F5F4F0;
          --surface-2: #EBEBE6;
          --accent: #E8541A;
          --accent-2: #FF6B35;
          --white: #FAFAF8;
          --muted: #888880;
          --border: rgba(255,255,255,0.08);
          --font-display: 'Syne', sans-serif;
          --font-body: 'DM Sans', sans-serif;
        }

        html { scroll-behavior: smooth; }
        body { background: var(--ink); color: var(--white); font-family: var(--font-body); margin: 0; }

        /* Scroll reveal */
        .sr { opacity: 0; transform: translateY(28px); transition: opacity 0.7s cubic-bezier(.16,1,.3,1), transform 0.7s cubic-bezier(.16,1,.3,1); }
        .sr.sr-visible { opacity: 1; transform: none; }
        .sr-delay-1 { transition-delay: 0.1s; }
        .sr-delay-2 { transition-delay: 0.2s; }
        .sr-delay-3 { transition-delay: 0.3s; }
        .sr-delay-4 { transition-delay: 0.4s; }
        .sr-delay-5 { transition-delay: 0.5s; }

        /* Ticker */
        @keyframes ticker {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        .ticker-track { animation: ticker 22s linear infinite; display: flex; width: max-content; }
        .ticker-track:hover { animation-play-state: paused; }

        /* Gradient text */
        .grad-text {
          background: linear-gradient(135deg, var(--white) 0%, var(--accent) 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        /* Nav */
        .nav-glass {
          transition: background 0.4s ease, backdrop-filter 0.4s ease, border-bottom 0.4s ease;
        }
        .nav-glass.scrolled {
          background: rgba(10,10,11,0.95);
          backdrop-filter: blur(20px);
          border-bottom: 1px solid rgba(255,255,255,0.06);
        }

        /* Hero line animation */
        @keyframes line-in {
          from { width: 0; }
          to { width: 100%; }
        }
        .hero-line { animation: line-in 1.2s cubic-bezier(.16,1,.3,1) forwards; }

        /* Pulse dot */
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.4); }
        }
        .pulse-dot { animation: pulse-dot 2s ease-in-out infinite; }

        /* Card hover */
        .module-card { transition: transform 0.3s cubic-bezier(.16,1,.3,1), border-color 0.3s ease; }
        .module-card:hover { transform: translateY(-6px); border-color: var(--accent) !important; }

        /* Plan card */
        .plan-card { transition: transform 0.3s cubic-bezier(.16,1,.3,1); }
        .plan-card:hover { transform: translateY(-8px); }

        /* Btn */
        .btn-primary {
          background: var(--accent);
          color: white;
          border: none;
          padding: 14px 32px;
          font-family: var(--font-display);
          font-weight: 600;
          font-size: 15px;
          letter-spacing: 0.02em;
          cursor: pointer;
          transition: background 0.2s, transform 0.2s;
          display: inline-flex;
          align-items: center;
          gap: 8px;
        }
        .btn-primary:hover { background: var(--accent-2); transform: translateY(-1px); }

        .btn-ghost {
          background: transparent;
          color: var(--white);
          border: 1px solid rgba(255,255,255,0.2);
          padding: 13px 32px;
          font-family: var(--font-display);
          font-weight: 500;
          font-size: 15px;
          cursor: pointer;
          transition: border-color 0.2s, background 0.2s;
          display: inline-flex;
          align-items: center;
          gap: 8px;
        }
        .btn-ghost:hover { border-color: var(--accent); background: rgba(232,84,26,0.06); }

        /* Noise overlay */
        .noise::after {
          content: '';
          position: absolute;
          inset: 0;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E");
          pointer-events: none;
          z-index: 0;
        }
      `}</style>

      {/* ── NAV ── */}
      <nav className={`nav-glass${scrolled ? ' scrolled' : ''}`} style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, padding: '0 32px' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 68 }}>
          {/* Logo */}
          <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
            <div style={{ width: 36, height: 36, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Zap size={20} color="white" />
            </div>
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 18, color: 'var(--white)', letterSpacing: '-0.02em' }}>SGI 360</span>
          </a>

          {/* Links desktop */}
          <div style={{ display: 'flex', gap: 36, alignItems: 'center' }} className="hidden md:flex">
            {NAV_LINKS.map(l => (
              <a key={l.label} href={l.href} style={{ color: 'var(--muted)', textDecoration: 'none', fontSize: 14, fontWeight: 400, transition: 'color 0.2s' }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--white)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted)')}>
                {l.label}
              </a>
            ))}
          </div>

          {/* CTA */}
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <a href="/login" style={{ color: 'var(--muted)', textDecoration: 'none', fontSize: 14, fontWeight: 400 }}>Ingresar</a>
            <button className="btn-primary" style={{ padding: '10px 22px', fontSize: 14 }} onClick={() => setShowRegisterModal(true)}>
              Empezar gratis
            </button>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section ref={heroRef} style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '120px 32px 80px', position: 'relative', overflow: 'hidden' }}>
        {/* Background grid */}
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)', backgroundSize: '80px 80px', zIndex: 0 }} />
        {/* Accent glow */}
        <div style={{ position: 'absolute', top: '20%', right: '10%', width: 600, height: 600, background: 'radial-gradient(circle, rgba(232,84,26,0.12) 0%, transparent 70%)', zIndex: 0, pointerEvents: 'none' }} />

        <div style={{ maxWidth: 1280, margin: '0 auto', width: '100%', position: 'relative', zIndex: 1 }}>
          {/* Badge */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, border: '1px solid rgba(232,84,26,0.3)', padding: '6px 16px', marginBottom: 48, background: 'rgba(232,84,26,0.06)' }}>
            <span className="pulse-dot" style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', display: 'inline-block' }} />
            <span style={{ fontSize: 12, fontFamily: 'var(--font-display)', fontWeight: 600, letterSpacing: '0.1em', color: 'var(--accent)', textTransform: 'uppercase' }}>Sistema de Gestión Integrado</span>
          </div>

          {/* Headline */}
          <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'clamp(52px, 8vw, 110px)', lineHeight: 0.92, letterSpacing: '-0.04em', margin: '0 0 32px', maxWidth: 900 }}>
            <span style={{ display: 'block', color: 'var(--white)' }}>Gestión ISO</span>
            <span style={{ display: 'block', color: 'var(--white)' }}>sin caos.</span>
            <span className="grad-text" style={{ display: 'block' }}>Sin excusas.</span>
          </h1>

          {/* Separator line */}
          <div style={{ height: 1, background: 'linear-gradient(90deg, var(--accent), transparent)', marginBottom: 32, maxWidth: 400 }} className="hero-line" />

          {/* Subhead */}
          <p style={{ fontSize: 'clamp(16px, 2vw, 20px)', color: 'var(--muted)', maxWidth: 540, lineHeight: 1.6, margin: '0 0 48px', fontWeight: 300 }}>
            Una plataforma para gestionar ISO 9001, 14001, 45001 y más — con IA integrada, trazabilidad total y sin hojas de cálculo.
          </p>

          {/* CTAs */}
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <button className="btn-primary" onClick={() => setShowRegisterModal(true)}>
              Comenzar ahora <ArrowRight size={16} />
            </button>
            <button className="btn-ghost" onClick={() => document.getElementById('modulos')?.scrollIntoView({ behavior: 'smooth' })}>
              Ver módulos
            </button>
          </div>

          {/* ISO tags */}
          <div style={{ marginTop: 64, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {ISOS.map(iso => (
              <span key={iso} style={{ fontSize: 11, fontFamily: 'var(--font-display)', fontWeight: 600, letterSpacing: '0.08em', color: 'var(--muted)', border: '1px solid rgba(255,255,255,0.1)', padding: '5px 12px', textTransform: 'uppercase' }}>
                {iso}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── ISO TICKER ── */}
      <div style={{ background: 'var(--accent)', padding: '14px 0', overflow: 'hidden', position: 'relative' }}>
        <div className="ticker-track">
          {[...ISOS, ...ISOS, ...ISOS, ...ISOS].map((iso, i) => (
            <span key={i} style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'white', paddingRight: 48, whiteSpace: 'nowrap' }}>
              {iso} <span style={{ opacity: 0.5, marginRight: 48 }}>—</span>
            </span>
          ))}
        </div>
      </div>

      {/* ── STATS ── */}
      <section style={{ padding: '100px 32px', background: 'var(--ink-2)' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 2 }}>
            {STATS.map((s, i) => (
              <div key={i} className="sr" style={{ transitionDelay: `${i * 0.1}s`, padding: '48px 40px', background: i % 2 === 0 ? 'var(--ink-3)' : 'var(--ink-2)', borderLeft: i === 0 ? '3px solid var(--accent)' : 'none' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'clamp(40px, 5vw, 64px)', lineHeight: 1, letterSpacing: '-0.04em', color: i === 0 ? 'var(--accent)' : 'var(--white)', marginBottom: 12 }}>
                  <Counter value={s.value} suffix={s.suffix} />
                </div>
                <div style={{ fontSize: 13, color: 'var(--muted)', letterSpacing: '0.05em', textTransform: 'uppercase', fontWeight: 500 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── MÓDULOS ── */}
      <section id="modulos" style={{ padding: '120px 32px', background: 'var(--ink)' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
          <div className="sr" style={{ marginBottom: 80 }}>
            <span style={{ fontSize: 11, fontFamily: 'var(--font-display)', fontWeight: 700, letterSpacing: '0.12em', color: 'var(--accent)', textTransform: 'uppercase', display: 'block', marginBottom: 20 }}>Módulos</span>
            <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'clamp(36px, 5vw, 60px)', letterSpacing: '-0.03em', lineHeight: 0.95, margin: 0, maxWidth: 600 }}>
              Todo lo que necesitás,<br />
              <span className="grad-text">en un solo lugar.</span>
            </h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 1, background: 'rgba(255,255,255,0.05)' }}>
            {MODULES.map((m, i) => (
              <div key={i} className="sr module-card" style={{ transitionDelay: `${i * 0.07}s`, background: 'var(--ink)', padding: '40px 36px', border: '1px solid rgba(255,255,255,0.06)', cursor: 'default' }}>
                <div style={{ width: 44, height: 44, background: 'rgba(232,84,26,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
                  <m.icon size={22} color="var(--accent)" />
                </div>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 17, marginBottom: 12, color: 'var(--white)' }}>{m.label}</div>
                <div style={{ fontSize: 14, color: 'var(--muted)', lineHeight: 1.6 }}>{m.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PLANES ── */}
      <section id="planes" style={{ padding: '120px 32px', background: 'var(--ink-2)' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
          <div className="sr" style={{ marginBottom: 72, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 24 }}>
            <div>
              <span style={{ fontSize: 11, fontFamily: 'var(--font-display)', fontWeight: 700, letterSpacing: '0.12em', color: 'var(--accent)', textTransform: 'uppercase', display: 'block', marginBottom: 20 }}>Planes</span>
              <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'clamp(36px, 5vw, 60px)', letterSpacing: '-0.03em', lineHeight: 0.95, margin: 0 }}>
                Simple.<br />Transparente.
              </h2>
            </div>
            <p style={{ fontSize: 15, color: 'var(--muted)', maxWidth: 320, lineHeight: 1.6 }}>Sin contratos anuales obligatorios. Cambiá de plan cuando quieras.</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 2 }}>
            {PLANS.map((plan, i) => (
              <div key={i} className={`sr plan-card sr-delay-${i + 1}`} style={{
                background: plan.highlight ? 'var(--accent)' : 'var(--ink-3)',
                padding: '48px 40px',
                border: plan.highlight ? 'none' : '1px solid rgba(255,255,255,0.06)',
                position: 'relative',
              }}>
                {plan.highlight && (
                  <div style={{ position: 'absolute', top: 20, right: 20, background: 'rgba(0,0,0,0.2)', padding: '4px 12px', fontSize: 11, fontFamily: 'var(--font-display)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                    Más popular
                  </div>
                )}
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 24, opacity: 0.7 }}>{plan.name}</div>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 64, letterSpacing: '-0.04em', lineHeight: 1, marginBottom: 8 }}>
                  ${plan.price}
                </div>
                <div style={{ fontSize: 13, opacity: 0.6, marginBottom: 40 }}>USD / mes</div>
                <div style={{ height: 1, background: plan.highlight ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.08)', marginBottom: 32 }} />
                <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 40px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {plan.features.map((f, j) => (
                    <li key={j} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, fontSize: 14, opacity: 0.9, lineHeight: 1.4 }}>
                      <CheckCircle size={16} style={{ flexShrink: 0, marginTop: 1, opacity: plan.highlight ? 1 : 0.6 }} />
                      {f}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => setShowRegisterModal(true)}
                  style={{
                    width: '100%', padding: '14px', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14,
                    letterSpacing: '0.02em', cursor: 'pointer', transition: 'all 0.2s',
                    background: plan.highlight ? 'white' : 'var(--accent)',
                    color: plan.highlight ? 'var(--accent)' : 'white',
                    border: 'none',
                  }}>
                  Empezar con {plan.name}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section style={{ padding: '120px 32px', background: 'var(--ink)' }}>
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          <div className="sr" style={{ marginBottom: 72 }}>
            <span style={{ fontSize: 11, fontFamily: 'var(--font-display)', fontWeight: 700, letterSpacing: '0.12em', color: 'var(--accent)', textTransform: 'uppercase', display: 'block', marginBottom: 20 }}>FAQ</span>
            <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'clamp(32px, 5vw, 52px)', letterSpacing: '-0.03em', lineHeight: 1, margin: 0 }}>
              Preguntas frecuentes
            </h2>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {FAQS.map((faq, i) => (
              <div key={i} className="sr" style={{ transitionDelay: `${i * 0.08}s`, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                <button
                  onClick={() => setExpandedFAQ(expandedFAQ === i ? null : i)}
                  style={{ width: '100%', background: 'none', border: 'none', padding: '28px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', gap: 24, textAlign: 'left' }}>
                  <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 16, color: 'var(--white)', letterSpacing: '-0.01em' }}>{faq.q}</span>
                  <span style={{ color: 'var(--accent)', flexShrink: 0, fontSize: 22, lineHeight: 1 }}>{expandedFAQ === i ? '−' : '+'}</span>
                </button>
                {expandedFAQ === i && (
                  <div style={{ paddingBottom: 28, color: 'var(--muted)', fontSize: 15, lineHeight: 1.7, paddingRight: 40 }}>
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA FINAL ── */}
      <section style={{ padding: '120px 32px', background: 'var(--accent)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -80, right: -80, width: 400, height: 400, borderRadius: '50%', background: 'rgba(0,0,0,0.1)', pointerEvents: 'none' }} />
        <div style={{ maxWidth: 800, margin: '0 auto', textAlign: 'center', position: 'relative', zIndex: 1 }}>
          <h2 className="sr" style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'clamp(40px, 7vw, 80px)', letterSpacing: '-0.04em', lineHeight: 0.92, margin: '0 0 32px', color: 'white' }}>
            Tu primer mes<br />es gratis.
          </h2>
          <p className="sr sr-delay-1" style={{ fontSize: 18, color: 'rgba(255,255,255,0.8)', marginBottom: 48, lineHeight: 1.6 }}>
            Sin tarjeta de crédito. Sin compromisos. Empezá hoy.
          </p>
          <div className="sr sr-delay-2" style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button onClick={() => setShowRegisterModal(true)} style={{ background: 'white', color: 'var(--accent)', border: 'none', padding: '16px 40px', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16, cursor: 'pointer', transition: 'transform 0.2s', display: 'inline-flex', alignItems: 'center', gap: 8 }}
              onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-2px)')}
              onMouseLeave={e => (e.currentTarget.style.transform = 'none')}>
              Crear cuenta gratis <ArrowRight size={18} />
            </button>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer id="contact" style={{ background: '#07070A', padding: '80px 32px 40px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1.5fr', gap: 48, marginBottom: 64 }}>
            {/* Brand */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                <div style={{ width: 32, height: 32, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Zap size={18} color="white" />
                </div>
                <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 16, color: 'var(--white)' }}>SGI 360</span>
              </div>
              <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.7, marginBottom: 24, maxWidth: 260 }}>
                Plataforma de gestión integrada para empresas que toman en serio su calidad.
              </p>
              <div style={{ display: 'flex', gap: 16 }}>
                {landingSettings?.facebook && <a href={landingSettings.facebook} target="_blank"><Facebook size={18} color="var(--muted)" /></a>}
                {landingSettings?.twitter && <a href={landingSettings.twitter} target="_blank"><Twitter size={18} color="var(--muted)" /></a>}
                {landingSettings?.linkedin && <a href={landingSettings.linkedin} target="_blank"><Linkedin size={18} color="var(--muted)" /></a>}
                {!landingSettings?.facebook && !landingSettings?.twitter && !landingSettings?.linkedin && (
                  <>
                    <Facebook size={18} color="var(--muted)" style={{ cursor: 'pointer' }} />
                    <Twitter size={18} color="var(--muted)" style={{ cursor: 'pointer' }} />
                    <Linkedin size={18} color="var(--muted)" style={{ cursor: 'pointer' }} />
                  </>
                )}
              </div>
            </div>

            {/* Productos */}
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--white)', marginBottom: 20 }}>Productos</div>
              {['SGI 360', 'SEH 360', 'Audit360'].map(p => (
                <a key={p} href="#" style={{ display: 'block', color: 'var(--muted)', textDecoration: 'none', fontSize: 14, marginBottom: 12, transition: 'color 0.2s' }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--white)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted)')}>{p}</a>
              ))}
            </div>

            {/* Legal */}
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--white)', marginBottom: 20 }}>Legal</div>
              {['Términos', 'Privacidad', 'Cookies'].map(p => (
                <a key={p} href="#" style={{ display: 'block', color: 'var(--muted)', textDecoration: 'none', fontSize: 14, marginBottom: 12, transition: 'color 0.2s' }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--white)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted)')}>{p}</a>
              ))}
            </div>

            {/* Recursos */}
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--white)', marginBottom: 20 }}>Recursos</div>
              {['Centro de Ayuda', 'Documentación', 'Estado del Sistema'].map(p => (
                <a key={p} href="#" style={{ display: 'block', color: 'var(--muted)', textDecoration: 'none', fontSize: 14, marginBottom: 12, transition: 'color 0.2s' }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--white)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted)')}>{p}</a>
              ))}
            </div>

            {/* Contacto */}
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--white)', marginBottom: 20 }}>Contacto</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <a href={`mailto:${landingSettings?.email || 'info@sgi360.com'}`} style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--muted)', textDecoration: 'none', fontSize: 14 }}>
                  <Mail size={15} /> {landingSettings?.email || 'info@sgi360.com'}
                </a>
                <a href={`tel:${landingSettings?.phone || ''}`} style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--muted)', textDecoration: 'none', fontSize: 14 }}>
                  <Phone size={15} /> {landingSettings?.phone || '+54 011 15 66169368'}
                </a>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--muted)', fontSize: 14 }}>
                  <MapPin size={15} /> {landingSettings?.address || 'Buenos Aires, Argentina'}
                </div>
              </div>
            </div>
          </div>

          {/* Bottom bar */}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 32, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
            <span style={{ fontSize: 13, color: 'var(--muted)' }}>© 2025 SGI 360. Todos los derechos reservados.</span>
            <div style={{ display: 'flex', gap: 12 }}>
              {['ISO 9001:2015', 'ISO 45001:2018', 'ISO 14001:2015'].map(tag => (
                <span key={tag} style={{ fontSize: 11, color: 'var(--muted)', border: '1px solid rgba(255,255,255,0.08)', padding: '4px 10px', fontFamily: 'var(--font-display)', fontWeight: 600, letterSpacing: '0.05em' }}>{tag}</span>
              ))}
            </div>
          </div>
        </div>
      </footer>

      {/* ── REGISTER MODAL ── */}
      {showRegisterModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ background: 'var(--ink-2)', border: '1px solid rgba(255,255,255,0.1)', padding: '48px', maxWidth: 480, width: '100%', position: 'relative' }}>
            <button onClick={() => setShowRegisterModal(false)} style={{ position: 'absolute', top: 20, right: 20, background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 22 }}>×</button>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 28, letterSpacing: '-0.03em', marginBottom: 8 }}>Crear cuenta</div>
            <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 32 }}>Gratis por 30 días. Sin tarjeta de crédito.</p>
            <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <input required placeholder="Nombre de la empresa" value={formData.companyName} onChange={e => setFormData(p => ({ ...p, companyName: e.target.value }))}
                style={{ background: 'var(--ink-3)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--white)', padding: '14px 16px', fontSize: 15, fontFamily: 'var(--font-body)', outline: 'none', width: '100%' }} />
              <input required type="email" placeholder="Email corporativo" value={formData.email} onChange={e => setFormData(p => ({ ...p, email: e.target.value }))}
                style={{ background: 'var(--ink-3)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--white)', padding: '14px 16px', fontSize: 15, fontFamily: 'var(--font-body)', outline: 'none', width: '100%' }} />
              <input placeholder="Teléfono (opcional)" value={formData.phone} onChange={e => setFormData(p => ({ ...p, phone: e.target.value }))}
                style={{ background: 'var(--ink-3)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--white)', padding: '14px 16px', fontSize: 15, fontFamily: 'var(--font-body)', outline: 'none', width: '100%' }} />
              <button type="submit" disabled={loading} className="btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 8, padding: '16px' }}>
                {loading ? 'Creando cuenta...' : 'Empezar gratis'} {!loading && <ArrowRight size={16} />}
              </button>
            </form>
          </div>
        </div>
      )}
    
      
        href="https://wa.me/5491115661693688"
        target="_blank"
        rel="noopener noreferrer"
        style={{
          position: 'fixed',
          bottom: 28,
          right: 28,
          width: 58,
          height: 58,
          borderRadius: '50%',
          background: '#25D366',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 24px rgba(37,211,102,0.4)',
          zIndex: 999,
          transition: 'transform 0.2s, box-shadow 0.2s',
          textDecoration: 'none',
        }}
        onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.1)'; e.currentTarget.style.boxShadow = '0 8px 32px rgba(37,211,102,0.5)'; }}
        onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 4px 24px rgba(37,211,102,0.4)'; }}
      >
        <svg width="30" height="30" viewBox="0 0 24 24" fill="white">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
          <path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.122 1.532 5.855L.057 23.943l6.284-1.648A11.933 11.933 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 01-5.002-1.368l-.359-.213-3.728.977.995-3.638-.234-.374A9.818 9.818 0 1112 21.818z"/>
        </svg>
      </a>
    </>
  );
}

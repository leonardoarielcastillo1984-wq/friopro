'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Zap, Shield, BarChart3, Users, FileCheck, AlertTriangle,
  ArrowRight, CheckCircle, TrendingUp, Clock, Layers,
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
      const res = await fetch('/api/register-company', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (res.ok) { setShowModal(false); router.push('/onboarding'); }
    } catch {}
    setLoading(false);
  };

  return (
    <>
      {/* NAV */}
      <nav className={scrolled ? 'nav-glass scrolled' : 'nav-glass'} style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, padding: '0 32px' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 68 }}>
          <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
            <div style={{ width: 36, height: 36, background: '#E8541A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Zap size={20} color="white" />
            </div>
            <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 18, color: '#FAFAF8', letterSpacing: '-0.02em' }}>SGI 360</span>
          </a>
          <div style={{ display: 'flex', gap: 36, alignItems: 'center' }}>
            {NAV_LINKS.map(l => (
              <a key={l.label} href={l.href} style={{ color: '#888880', textDecoration: 'none', fontSize: 14 }}>{l.label}</a>
            ))}
            <a href="/login" style={{ color: '#888880', textDecoration: 'none', fontSize: 14 }}>Ingresar</a>
            <button className="btn-primary" style={{ padding: '10px 22px', fontSize: 14 }} onClick={() => setShowModal(true)}>Empezar gratis</button>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '120px 32px 80px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)', backgroundSize: '80px 80px' }} />
        <div style={{ position: 'absolute', top: '20%', right: '10%', width: 600, height: 600, background: 'radial-gradient(circle, rgba(232,84,26,0.12) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ maxWidth: 1280, margin: '0 auto', width: '100%', position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, border: '1px solid rgba(232,84,26,0.3)', padding: '6px 16px', marginBottom: 48, background: 'rgba(232,84,26,0.06)' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#E8541A', display: 'inline-block' }} className="pulse-dot" />
            <span style={{ fontSize: 12, fontFamily: "'Syne', sans-serif", fontWeight: 600, letterSpacing: '0.1em', color: '#E8541A', textTransform: 'uppercase' as const }}>Sistema de Gestión Integrado</span>
          </div>
          <h1 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 'clamp(52px, 8vw, 110px)', lineHeight: 0.92, letterSpacing: '-0.04em', margin: '0 0 32px', maxWidth: 900 }}>
            <span style={{ display: 'block', color: '#FAFAF8' }}>Gestión ISO</span>
            <span style={{ display: 'block', color: '#FAFAF8' }}>sin caos.</span>
            <span className="grad-text" style={{ display: 'block' }}>Sin excusas.</span>
          </h1>
          <div className="hero-line" style={{ height: 1, background: 'linear-gradient(90deg, #E8541A, transparent)', marginBottom: 32, maxWidth: 400 }} />
          <p style={{ fontSize: 'clamp(16px, 2vw, 20px)', color: '#888880', maxWidth: 540, lineHeight: 1.6, margin: '0 0 48px', fontWeight: 300 }}>
            Una plataforma para gestionar ISO 9001, 14001, 45001 y más — con IA integrada, trazabilidad total y sin hojas de cálculo.
          </p>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' as const, alignItems: 'center' }}>
            <button className="btn-primary" onClick={() => setShowModal(true)}>Comenzar ahora <ArrowRight size={16} /></button>
            <button className="btn-ghost" onClick={() => document.getElementById('modulos')?.scrollIntoView({ behavior: 'smooth' })}>Ver módulos</button>
          </div>
          <div style={{ marginTop: 64, display: 'flex', gap: 12, flexWrap: 'wrap' as const }}>
            {ISOS.map(iso => (
              <span key={iso} style={{ fontSize: 11, fontFamily: "'Syne', sans-serif", fontWeight: 600, letterSpacing: '0.08em', color: '#888880', border: '1px solid rgba(255,255,255,0.1)', padding: '5px 12px', textTransform: 'uppercase' as const }}>{iso}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ISO TICKER */}
      <div style={{ background: '#E8541A', padding: '14px 0', overflow: 'hidden' }}>
        <div className="ticker-track">
          {[...ISOS, ...ISOS, ...ISOS, ...ISOS].map((iso, i) => (
            <span key={i} style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 13, letterSpacing: '0.12em', textTransform: 'uppercase' as const, color: 'white', paddingRight: 48, whiteSpace: 'nowrap' as const }}>
              {iso} <span style={{ opacity: 0.5, marginRight: 48 }}>—</span>
            </span>
          ))}
        </div>
      </div>

      {/* STATS */}
      <section style={{ padding: '100px 32px', background: '#111114' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 2 }}>
            {[
              { value: '500+', label: 'Empresas activas' },
              { value: '1500+', label: 'Usuarios en plataforma' },
              { value: '99.9%', label: 'Uptime garantizado' },
              { value: '15 años', label: 'De experiencia ISO' },
            ].map((s, i) => (
              <div key={i} className="sr" style={{ transitionDelay: `${i * 0.1}s`, padding: '48px 40px', background: i % 2 === 0 ? '#1A1A1F' : '#111114', borderLeft: i === 0 ? '3px solid #E8541A' : 'none' }}>
                <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 'clamp(40px, 5vw, 64px)', lineHeight: 1, letterSpacing: '-0.04em', color: i === 0 ? '#E8541A' : '#FAFAF8', marginBottom: 12 }}>{s.value}</div>
                <div style={{ fontSize: 13, color: '#888880', letterSpacing: '0.05em', textTransform: 'uppercase' as const, fontWeight: 500 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* MÓDULOS */}
      <section id="modulos" style={{ padding: '120px 32px', background: '#0A0A0B' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
          <div className="sr" style={{ marginBottom: 80 }}>
            <span style={{ fontSize: 11, fontFamily: "'Syne', sans-serif", fontWeight: 700, letterSpacing: '0.12em', color: '#E8541A', textTransform: 'uppercase' as const, display: 'block', marginBottom: 20 }}>Módulos</span>
            <h2 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 'clamp(36px, 5vw, 60px)', letterSpacing: '-0.03em', lineHeight: 0.95, margin: 0, maxWidth: 600 }}>
              Todo lo que necesitás,<br /><span className="grad-text">en un solo lugar.</span>
            </h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 1, background: 'rgba(255,255,255,0.05)' }}>
            {MODULES.map((m, i) => (
              <div key={i} className={'sr module-card'} style={{ transitionDelay: `${i * 0.07}s`, background: '#0A0A0B', padding: '40px 36px', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ width: 44, height: 44, background: 'rgba(232,84,26,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
                  <m.icon size={22} color="#E8541A" />
                </div>
                <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 17, marginBottom: 12, color: '#FAFAF8' }}>{m.label}</div>
                <div style={{ fontSize: 14, color: '#888880', lineHeight: 1.6 }}>{m.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PLANES */}
      <section id="planes" style={{ padding: '120px 32px', background: '#111114' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
          <div className="sr" style={{ marginBottom: 72 }}>
            <span style={{ fontSize: 11, fontFamily: "'Syne', sans-serif", fontWeight: 700, letterSpacing: '0.12em', color: '#E8541A', textTransform: 'uppercase' as const, display: 'block', marginBottom: 20 }}>Planes</span>
            <h2 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 'clamp(36px, 5vw, 60px)', letterSpacing: '-0.03em', lineHeight: 0.95, margin: 0 }}>
              Simple.<br />Transparente.
            </h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 2 }}>
            {PLANS.map((plan, i) => (
              <div key={i} className={'sr plan-card'} style={{ transitionDelay: `${i * 0.1}s`, background: plan.highlight ? '#E8541A' : '#1A1A1F', padding: '48px 40px', border: plan.highlight ? 'none' : '1px solid rgba(255,255,255,0.06)', position: 'relative' }}>
                {plan.highlight && <div style={{ position: 'absolute', top: 20, right: 20, background: 'rgba(0,0,0,0.2)', padding: '4px 12px', fontSize: 11, fontFamily: "'Syne', sans-serif", fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' as const }}>Más popular</div>}
                <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 13, letterSpacing: '0.1em', textTransform: 'uppercase' as const, marginBottom: 24, opacity: 0.7 }}>{plan.name}</div>
                <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 64, letterSpacing: '-0.04em', lineHeight: 1, marginBottom: 8 }}>${plan.price}</div>
                <div style={{ fontSize: 13, opacity: 0.6, marginBottom: 40 }}>USD / mes</div>
                <div style={{ height: 1, background: plan.highlight ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.08)', marginBottom: 32 }} />
                <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 40px', display: 'flex', flexDirection: 'column' as const, gap: 14 }}>
                  {plan.features.map((f, j) => (
                    <li key={j} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, fontSize: 14, opacity: 0.9 }}>
                      <CheckCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />{f}
                    </li>
                  ))}
                </ul>
                <button onClick={() => setShowModal(true)} style={{ width: '100%', padding: '14px', fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 14, cursor: 'pointer', background: plan.highlight ? 'white' : '#E8541A', color: plan.highlight ? '#E8541A' : 'white', border: 'none' }}>
                  Empezar con {plan.name}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section style={{ padding: '120px 32px', background: '#0A0A0B' }}>
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          <div className="sr" style={{ marginBottom: 72 }}>
            <span style={{ fontSize: 11, fontFamily: "'Syne', sans-serif", fontWeight: 700, letterSpacing: '0.12em', color: '#E8541A', textTransform: 'uppercase' as const, display: 'block', marginBottom: 20 }}>FAQ</span>
            <h2 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 'clamp(32px, 5vw, 52px)', letterSpacing: '-0.03em', lineHeight: 1, margin: 0 }}>Preguntas frecuentes</h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 2 }}>
            {FAQS.map((faq, i) => (
              <div key={i} className="sr" style={{ transitionDelay: `${i * 0.08}s`, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                <button onClick={() => setExpandedFAQ(expandedFAQ === i ? null : i)} style={{ width: '100%', background: 'none', border: 'none', padding: '28px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', gap: 24, textAlign: 'left' as const }}>
                  <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 600, fontSize: 16, color: '#FAFAF8' }}>{faq.q}</span>
                  <span style={{ color: '#E8541A', flexShrink: 0, fontSize: 22 }}>{expandedFAQ === i ? '−' : '+'}</span>
                </button>
                {expandedFAQ === i && <div style={{ paddingBottom: 28, color: '#888880', fontSize: 15, lineHeight: 1.7 }}>{faq.a}</div>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA FINAL */}
      <section style={{ padding: '120px 32px', background: '#E8541A', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -80, right: -80, width: 400, height: 400, borderRadius: '50%', background: 'rgba(0,0,0,0.1)', pointerEvents: 'none' }} />
        <div style={{ maxWidth: 800, margin: '0 auto', textAlign: 'center' as const, position: 'relative', zIndex: 1 }}>
          <h2 className="sr" style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 'clamp(40px, 7vw, 80px)', letterSpacing: '-0.04em', lineHeight: 0.92, margin: '0 0 32px', color: 'white' }}>Tu primer mes<br />es gratis.</h2>
          <p className="sr sr-delay-1" style={{ fontSize: 18, color: 'rgba(255,255,255,0.8)', marginBottom: 48, lineHeight: 1.6 }}>Sin tarjeta de crédito. Sin compromisos.</p>
          <div className="sr sr-delay-2">
            <button onClick={() => setShowModal(true)} style={{ background: 'white', color: '#E8541A', border: 'none', padding: '16px 40px', fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 16, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              Crear cuenta gratis <ArrowRight size={18} />
            </button>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer id="contact" style={{ background: '#07070A', padding: '80px 32px 40px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1.5fr', gap: 48, marginBottom: 64 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                <div style={{ width: 32, height: 32, background: '#E8541A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Zap size={18} color="white" />
                </div>
                <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 16, color: '#FAFAF8' }}>SGI 360</span>
              </div>
              <p style={{ fontSize: 13, color: '#888880', lineHeight: 1.7, marginBottom: 24, maxWidth: 260 }}>Plataforma de gestión integrada para empresas que toman en serio su calidad.</p>
              <div style={{ display: 'flex', gap: 16 }}>
                <Facebook size={18} color="#888880" style={{ cursor: 'pointer' }} />
                <Twitter size={18} color="#888880" style={{ cursor: 'pointer' }} />
                <Linkedin size={18} color="#888880" style={{ cursor: 'pointer' }} />
              </div>
            </div>
            <div>
              <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: '#FAFAF8', marginBottom: 20 }}>Productos</div>
              {['SGI 360', 'SEH 360', 'Audit360'].map(p => <a key={p} href="#" style={{ display: 'block', color: '#888880', textDecoration: 'none', fontSize: 14, marginBottom: 12 }}>{p}</a>)}
            </div>
            <div>
              <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: '#FAFAF8', marginBottom: 20 }}>Legal</div>
              {['Términos', 'Privacidad', 'Cookies'].map(p => <a key={p} href="#" style={{ display: 'block', color: '#888880', textDecoration: 'none', fontSize: 14, marginBottom: 12 }}>{p}</a>)}
            </div>
            <div>
              <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: '#FAFAF8', marginBottom: 20 }}>Contacto</div>
              <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 14 }}>
                <a href={'mailto:' + (landingSettings?.email || 'info@sgi360.com')} style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#888880', textDecoration: 'none', fontSize: 14 }}>
                  <Mail size={15} />{landingSettings?.email || 'info@sgi360.com'}
                </a>
                <a href={'tel:' + (landingSettings?.phone || '')} style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#888880', textDecoration: 'none', fontSize: 14 }}>
                  <Phone size={15} />{landingSettings?.phone || '+54 011 15 66169368'}
                </a>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#888880', fontSize: 14 }}>
                  <MapPin size={15} />{landingSettings?.address || 'Buenos Aires, Argentina'}
                </div>
              </div>
            </div>
          </div>
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 32, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' as const, gap: 16 }}>
            <span style={{ fontSize: 13, color: '#888880' }}>© 2025 SGI 360. Todos los derechos reservados.</span>
            <div style={{ display: 'flex', gap: 12 }}>
              {['ISO 9001:2015', 'ISO 45001:2018', 'ISO 14001:2015'].map(tag => (
                <span key={tag} style={{ fontSize: 11, color: '#888880', border: '1px solid rgba(255,255,255,0.08)', padding: '4px 10px', fontFamily: "'Syne', sans-serif", fontWeight: 600 }}>{tag}</span>
              ))}
            </div>
          </div>
        </div>
      </footer>

      {/* MODAL */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ background: '#111114', border: '1px solid rgba(255,255,255,0.1)', padding: '48px', maxWidth: 480, width: '100%', position: 'relative' }}>
            <button onClick={() => setShowModal(false)} style={{ position: 'absolute', top: 20, right: 20, background: 'none', border: 'none', color: '#888880', cursor: 'pointer', fontSize: 22 }}>×</button>
            <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 28, letterSpacing: '-0.03em', marginBottom: 8 }}>Crear cuenta</div>
            <p style={{ color: '#888880', fontSize: 14, marginBottom: 32 }}>Gratis por 30 días. Sin tarjeta de crédito.</p>
            <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column' as const, gap: 16 }}>
              <input required placeholder="Nombre de la empresa" value={formData.companyName} onChange={e => setFormData(p => ({ ...p, companyName: e.target.value }))} style={{ background: '#1A1A1F', border: '1px solid rgba(255,255,255,0.1)', color: '#FAFAF8', padding: '14px 16px', fontSize: 15, outline: 'none', width: '100%' }} />
              <input required type="email" placeholder="Email corporativo" value={formData.email} onChange={e => setFormData(p => ({ ...p, email: e.target.value }))} style={{ background: '#1A1A1F', border: '1px solid rgba(255,255,255,0.1)', color: '#FAFAF8', padding: '14px 16px', fontSize: 15, outline: 'none', width: '100%' }} />
              <input placeholder="Teléfono (opcional)" value={formData.phone} onChange={e => setFormData(p => ({ ...p, phone: e.target.value }))} style={{ background: '#1A1A1F', border: '1px solid rgba(255,255,255,0.1)', color: '#FAFAF8', padding: '14px 16px', fontSize: 15, outline: 'none', width: '100%' }} />
              <button type="submit" disabled={loading} className="btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 8, padding: '16px' }}>
                {loading ? 'Creando...' : 'Empezar gratis'} {!loading && <ArrowRight size={16} />}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* WHATSAPP FLOTANTE */}
      <a href="https://wa.me/5491115661693688" target="_blank" rel="noopener noreferrer"
        style={{ position: 'fixed', bottom: 28, right: 28, width: 58, height: 58, borderRadius: '50%', background: '#25D366', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 24px rgba(37,211,102,0.4)', zIndex: 999, textDecoration: 'none', transition: 'transform 0.2s' }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1.1)'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)'; }}>
        <svg width="30" height="30" viewBox="0 0 24 24" fill="white">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
          <path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.122 1.532 5.855L.057 23.943l6.284-1.648A11.933 11.933 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 01-5.002-1.368l-.359-.213-3.728.977.995-3.638-.234-.374A9.818 9.818 0 1112 21.818z"/>
        </svg>
      </a>
    </>
  );
}

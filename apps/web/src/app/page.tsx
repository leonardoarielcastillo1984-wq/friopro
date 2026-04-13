'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Shield, BarChart3, CheckCircle2, ArrowRight, Globe, Lock, Zap,
  Menu, X, MessageSquare, ChevronDown, Phone, Mail, MapPin, Facebook, Twitter, Linkedin
} from 'lucide-react';
import { Button } from '@/components/ui/button';

// Estilos de animación
const animationStyles = `
  @keyframes fadeInUp {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes fadeInDown {
    from {
      opacity: 0;
      transform: translateY(-20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes slideInLeft {
    from {
      opacity: 0;
      transform: translateX(-40px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }

  @keyframes slideInRight {
    from {
      opacity: 0;
      transform: translateX(40px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }

  @keyframes pulse-glow {
    0%, 100% {
      box-shadow: 0 0 20px rgba(59, 130, 246, 0.5);
    }
    50% {
      box-shadow: 0 0 40px rgba(59, 130, 246, 0.8);
    }
  }

  @keyframes float {
    0%, 100% {
      transform: translateY(0px);
    }
    50% {
      transform: translateY(-10px);
    }
  }

  @keyframes shimmer {
    0% {
      background-position: -1000px 0;
    }
    100% {
      background-position: 1000px 0;
    }
  }

  .animate-fade-in-up {
    animation: fadeInUp 0.6s ease-out;
  }

  .animate-fade-in-down {
    animation: fadeInDown 0.6s ease-out;
  }

  .animate-slide-in-left {
    animation: slideInLeft 0.6s ease-out;
  }

  .animate-slide-in-right {
    animation: slideInRight 0.6s ease-out;
  }

  .animate-pulse-glow {
    animation: pulse-glow 2s ease-in-out infinite;
  }

  .animate-float {
    animation: float 3s ease-in-out infinite;
  }

  .animate-delay-1 {
    animation-delay: 0.1s;
  }

  .animate-delay-2 {
    animation-delay: 0.2s;
  }

  .animate-delay-3 {
    animation-delay: 0.3s;
  }

  .animate-delay-4 {
    animation-delay: 0.4s;
  }

  .animate-delay-5 {
    animation-delay: 0.5s;
  }

  .animate-delay-6 {
    animation-delay: 0.6s;
  }

  @keyframes moveRight {
    0%, 100% { transform: translateX(0); }
    50% { transform: translateX(20px); }
  }

  @keyframes rotate-slow {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  @keyframes pulse-circle {
    0%, 100% { r: 3px; opacity: 0.6; }
    50% { r: 8px; opacity: 0; }
  }

  @keyframes reveal-up {
    from {
      opacity: 0;
      transform: translateY(40px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes reveal-left {
    from {
      opacity: 0;
      transform: translateX(-40px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }

  @keyframes reveal-right {
    from {
      opacity: 0;
      transform: translateX(40px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }

  .reveal-on-scroll {
    opacity: 0;
  }

  .reveal-on-scroll.visible {
    animation: reveal-up 0.8s ease-out forwards;
  }

  .reveal-on-scroll.visible-left {
    animation: reveal-left 0.8s ease-out forwards;
  }

  .reveal-on-scroll.visible-right {
    animation: reveal-right 0.8s ease-out forwards;
  }

  .animate-move-right {
    animation: moveRight 3s ease-in-out infinite;
  }

  .animate-rotate-slow {
    animation: rotate-slow 20s linear infinite;
  }

  .bg-animated-grid {
    background-image:
      linear-gradient(0deg, transparent 24%, rgba(59, 130, 246, 0.05) 25%, rgba(59, 130, 246, 0.05) 26%, transparent 27%, transparent 74%, rgba(59, 130, 246, 0.05) 75%, rgba(59, 130, 246, 0.05) 76%, transparent 77%, transparent),
      linear-gradient(90deg, transparent 24%, rgba(59, 130, 246, 0.05) 25%, rgba(59, 130, 246, 0.05) 26%, transparent 27%, transparent 74%, rgba(59, 130, 246, 0.05) 75%, rgba(59, 130, 246, 0.05) 76%, transparent 77%, transparent);
    background-size: 40px 40px;
    background-position: 0 0, 20px 20px;
  }
`;

const MODULES = [
  {
    id: 'sgi360',
    name: 'SGI 360',
    description: 'Sistema Integrado de Gestión ISO',
    icon: BarChart3,
    color: 'from-blue-500 to-blue-600',
    features: ['Documentos', 'Indicadores', 'Auditorías', 'Riesgos', 'Capacitaciones'],
    active: true,
    buttonText: 'Ingresar',
  },
  {
    id: 'seguridad360',
    name: 'SEH 360',
    description: 'Sistema de Gestión de Seguridad e Higiene Laboral',
    icon: Shield,
    color: 'from-red-500 to-red-600',
    features: ['Gestión de Riesgos Laborales', 'Investigación de Incidentes', 'EPP y Controles', 'Capacitaciones OBL', 'Auditorías SHE'],
    active: false,
    buttonText: 'Próximamente',
  },
  {
    id: 'audit360',
    name: 'Audit360',
    description: 'Plataforma especializada para Auditores y Consultores',
    icon: Lock,
    color: 'from-purple-500 to-purple-600',
    features: ['Gestión de Auditorías', 'No Conformidades', 'Hallazgos y Acciones', 'Programas Anuales', 'IA Auditora'],
    active: false,
    buttonText: 'Próximamente',
  },
];

const FEATURES = [
  {
    icon: '📊',
    title: 'Integración Total',
    description: 'Acceso a SGI 360, SEH 360 y Audit360 en una única plataforma centralizada'
  },
  {
    icon: '🔒',
    title: 'Seguridad Bancaria',
    description: 'Encriptación de nivel empresarial y cumplimiento con estándares internacionales'
  },
  {
    icon: '⚡',
    title: 'Rendimiento Ultra Rápido',
    description: 'Infraestructura en la nube con latencia mínima y disponibilidad 99.9%'
  },
  {
    icon: '🤖',
    title: 'IA Auditora',
    description: 'Automatización inteligente de procesos de auditoría y análisis de datos'
  },
  {
    icon: '📱',
    title: 'Acceso Multi-Dispositivo',
    description: 'Disponible en web, tablet y dispositivos móviles con sincronización en tiempo real'
  },
  {
    icon: '👥',
    title: 'Soporte 24/7',
    description: 'Equipo de expertos disponibles para ayudarte en cualquier momento'
  }
];

const TESTIMONIALS = [
  {
    name: 'Juan Carrillo',
    role: 'Gerente de Calidad',
    text: '\"SGI 360 ha transformado completamente nuestros procesos de gestión. La plataforma es intuitiva y muy potente. Altamente recomendado.\"',
    rating: 5
  },
  {
    name: 'María Rodríguez',
    role: 'Directora Ejecutiva',
    text: '\"El soporte técnico es excepcional. Cualquier duda la resuelven inmediatamente. Excelente inversión para nuestra empresa.\"',
    rating: 5
  },
  {
    name: 'Carlos Gómez',
    role: 'Coordinador de Auditoría',
    text: '\"Implementamos la plataforma en 2 semanas sin disrupciones. El ROI fue evidente en los primeros meses. Impresionante.\"',
    rating: 5
  }
];

const FAQS = [
  {
    question: '¿Cuáles son los planes disponibles?',
    answer: 'Ofrecemos planes Básico, Profesional y Premium con diferentes módulos y niveles de soporte. Puedes cambiar de plan en cualquier momento.'
  },
  {
    question: '¿Cuánto tiempo toma la implementación?',
    answer: 'En promedio 2-4 semanas sin disrupciones operacionales. Nuestro equipo te acompañará en cada paso del proceso.'
  },
  {
    question: '¿Ofrecen capacitación para nuestro equipo?',
    answer: 'Sí, capacitación inicial incluida y acceso a centro de recursos con tutoriales y documentación completa.'
  },
  {
    question: '¿Puedo integrar SGI 360 con otras herramientas?',
    answer: 'Sí, contamos con API completa y webhooks para integraciones con tus sistemas actuales.'
  },
  {
    question: '¿Qué garantías de seguridad ofrecen?',
    answer: 'Encriptación de datos de nivel bancario, backup automático diario, cumplimiento ISO y SLA de 99.9%.'
  }
];

// Hook para scroll reveal animations
const useScrollReveal = () => {
  useEffect(() => {
    fetch('https://logismart.ar/api/landing/settings')
      .then(r => r.json())
      .then(data => { if (data.settings) setLandingSettings(data.settings); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          // Para elementos con data-reveal-direction
          const direction = entry.target.getAttribute('data-reveal-direction');
          if (direction === 'left') {
            entry.target.classList.remove('visible');
            entry.target.classList.add('visible-left');
          } else if (direction === 'right') {
            entry.target.classList.remove('visible');
            entry.target.classList.add('visible-right');
          }
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1 });

    document.querySelectorAll('.reveal-on-scroll').forEach(el => observer.observe(el));

    return () => observer.disconnect();
  }, []);
};

// Componente de fondo animado con indicadores e IA
const AnimatedBackground = ({ variant = 'default' }) => {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Grid de fondo */}
      <div className="absolute inset-0 bg-animated-grid opacity-30"></div>

      {/* SVG con elementos animados */}
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 1000 600" preserveAspectRatio="none">
        {/* Líneas animadas de IA */}
        <g className="opacity-40">
          <line x1="50" y1="100" x2="200" y2="200" stroke="#3B82F6" strokeWidth="2" strokeDasharray="5,5" className="animate-move-right" />
          <line x1="800" y1="150" x2="900" y2="300" stroke="#8B5CF6" strokeWidth="2" strokeDasharray="5,5" className="animate-move-right" style={{ animationDelay: '0.5s' }} />
          <line x1="100" y1="400" x2="300" y2="500" stroke="#10B981" strokeWidth="2" strokeDasharray="5,5" className="animate-move-right" style={{ animationDelay: '1s' }} />
        </g>

        {/* Círculos pulsantes (indicadores) */}
        <g className="opacity-40">
          <circle cx="150" cy="150" r="3" fill="#3B82F6" className="animate-pulse-glow" />
          <circle cx="850" cy="250" r="3" fill="#8B5CF6" className="animate-pulse-glow" style={{ animationDelay: '0.3s' }} />
          <circle cx="200" cy="450" r="3" fill="#10B981" className="animate-pulse-glow" style={{ animationDelay: '0.6s' }} />
          <circle cx="800" cy="500" r="3" fill="#EC4899" className="animate-pulse-glow" style={{ animationDelay: '0.9s' }} />
        </g>

        {/* Gráficos de barras animados */}
        <g className="opacity-40">
          {/* Barra 1 */}
          <rect x="300" y="400" width="20" height="80" fill="#3B82F6" opacity="0.6" className="animate-float" style={{ animationDelay: '0s' }} />
          {/* Barra 2 */}
          <rect x="340" y="350" width="20" height="130" fill="#8B5CF6" opacity="0.6" className="animate-float" style={{ animationDelay: '0.2s' }} />
          {/* Barra 3 */}
          <rect x="380" y="300" width="20" height="180" fill="#10B981" opacity="0.6" className="animate-float" style={{ animationDelay: '0.4s' }} />
          {/* Barra 4 */}
          <rect x="420" y="380" width="20" height="100" fill="#F59E0B" opacity="0.6" className="animate-float" style={{ animationDelay: '0.6s' }} />
        </g>

        {/* Red de IA (nodos y conexiones) */}
        <g className="opacity-40">
          {/* Conexiones */}
          <line x1="100" y1="100" x2="200" y2="150" stroke="#3B82F6" strokeWidth="1.5" className="animate-move-right" style={{ animationDelay: '-1s' }} />
          <line x1="200" y1="150" x2="300" y2="120" stroke="#8B5CF6" strokeWidth="1.5" className="animate-move-right" style={{ animationDelay: '-1.5s' }} />
          <line x1="700" y1="200" x2="800" y2="300" stroke="#10B981" strokeWidth="1.5" className="animate-move-right" style={{ animationDelay: '-0.5s' }} />

          {/* Nodos */}
          <circle cx="100" cy="100" r="4" fill="#3B82F6" opacity="0.8" />
          <circle cx="200" cy="150" r="4" fill="#8B5CF6" opacity="0.8" />
          <circle cx="300" cy="120" r="4" fill="#10B981" opacity="0.8" />
          <circle cx="700" cy="200" r="4" fill="#EC4899" opacity="0.8" />
          <circle cx="800" cy="300" r="4" fill="#F59E0B" opacity="0.8" />
        </g>
      </svg>
    </div>
  );
};

export default function Home() {
  const router = useRouter();
  const [landingSettings, setLandingSettings] = useState<any>(null);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [expandedFAQ, setExpandedFAQ] = useState<number | null>(0);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [formData, setFormData] = useState({
    companyName: '',
    socialReason: '',
    rut: '',
    email: '',
    phone: '',
    website: '',
    address: '',
    logo: null as File | null,
    primaryColor: '#3B82F6',
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setFormData(prev => ({ ...prev, logo: e.target.files![0] }));
    }
  };

  // Scroll reveal animations
  useScrollReveal();

  // Carousel automático
  useEffect(() => {
    const interval = setInterval(() => {
      setCarouselIndex((prev) => (prev + 1) % 3);
    }, 5000); // Cambiar cada 5 segundos
    return () => clearInterval(interval);
  }, []);

  const carouselItems = [
    {
      icon: '🎯',
      title: 'Misión',
      description: 'Transformar los procesos de gestión empresarial mediante tecnología innovadora y soporte experto',
      color: 'from-blue-500 to-blue-600'
    },
    {
      icon: '🚀',
      title: 'Objetivo',
      description: 'Ser la plataforma de gestión integrada número 1 en Latinoamérica, confiada por más de 1000 empresas',
      color: 'from-purple-500 to-purple-600'
    },
    {
      icon: '✨',
      title: 'Visión',
      description: 'Empoderar a las organizaciones con herramientas de IA y automatización para lograr excelencia operacional',
      color: 'from-pink-500 to-pink-600'
    }
  ];

  const handleSubmitRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002'}/api/register-company`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: formData.companyName,
          socialReason: formData.socialReason,
          rut: formData.rut,
          email: formData.email,
          phone: formData.phone,
          website: formData.website,
          address: formData.address,
          primaryColor: formData.primaryColor,
          module: 'sgi360',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Error en el registro');
      }

      const data = await response.json();
      alert('✅ Solicitud enviada correctamente. El administrador revisará tu registro pronto.');
      setShowRegisterModal(false);
      setFormData({
        companyName: '',
        socialReason: '',
        rut: '',
        email: '',
        phone: '',
        website: '',
        address: '',
        logo: null,
        primaryColor: '#3B82F6',
      });

      router.push('/planes');
    } catch (error) {
      alert('❌ Error al enviar el registro: ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <style>{animationStyles}</style>

      {/* ============ HEADER / NAVEGACIÓN ============ */}
      <header className="sticky top-0 z-40 border-b border-gray-200 bg-white animate-fade-in-down">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
              <Zap className="h-6 w-6 text-white" />
            </div>
            <span className="text-xl font-bold text-gray-900">SGI 360</span>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-8">
            <a href="#inicio" className="text-gray-600 hover:text-blue-600 transition">Inicio</a>
            <a href="#productos" className="text-gray-600 hover:text-blue-600 transition">Productos</a>
            <a href="#about" className="text-gray-600 hover:text-blue-600 transition">Sobre Nosotros</a>
            <a href="#features" className="text-gray-600 hover:text-blue-600 transition">Características</a>
            <a href="#faq" className="text-gray-600 hover:text-blue-600 transition">FAQ</a>
            <a href="#contact" className="text-gray-600 hover:text-blue-600 transition">Contacto</a>
          </nav>

          {/* Buttons */}
          <div className="hidden md:flex items-center gap-3">
            <Button
              onClick={() => router.push('/login')}
              className="bg-gray-900 text-white hover:bg-gray-800"
            >
              Ingresar
            </Button>
            <Button
              onClick={() => setShowRegisterModal(true)}
              className="bg-gray-900 hover:bg-gray-800 text-white"
            >
              Registrar Empresa
            </Button>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2"
          >
            {mobileMenuOpen ? (
              <X className="w-6 h-6 text-gray-900" />
            ) : (
              <Menu className="w-6 h-6 text-gray-900" />
            )}
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-gray-200 bg-white">
            <nav className="flex flex-col gap-4 p-4">
              <a href="#inicio" className="text-gray-600 hover:text-blue-600">Inicio</a>
              <a href="#productos" className="text-gray-600 hover:text-blue-600">Productos</a>
              <a href="#about" className="text-gray-600 hover:text-blue-600">Sobre Nosotros</a>
              <a href="#features" className="text-gray-600 hover:text-blue-600">Características</a>
              <a href="#faq" className="text-gray-600 hover:text-blue-600">FAQ</a>
              <a href="#contact" className="text-gray-600 hover:text-blue-600">Contacto</a>
              <div className="flex gap-2 pt-4">
                <Button onClick={() => router.push('/login')} className="flex-1 bg-gray-900 text-white hover:bg-gray-800">
                  Ingresar
                </Button>
                <Button onClick={() => setShowRegisterModal(true)} className="flex-1 bg-gray-900 text-white hover:bg-gray-800">
                  Registrar
                </Button>
              </div>
            </nav>
          </div>
        )}
      </header>

      {/* ============ HERO SECTION ============ */}
      <section id="inicio" className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white py-20 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16 animate-fade-in-up">
            <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-blue-600 animate-fade-in-up">
              Soluciones Integrales de Gestión
            </h1>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto animate-fade-in-up animate-delay-1">
              Tres sistemas potentes diseñados para diferentes necesidades de gestión, integrados en una sola plataforma
            </p>
          </div>

          {/* CTA Principal */}
          <div className="text-center mb-16 animate-fade-in-up">
            <button
              onClick={() => setShowRegisterModal(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-8 rounded-lg text-lg transition-all transform hover:scale-105 shadow-lg hover:shadow-xl"
            >
              ⚡ Empezar Ahora - Prueba Gratuita
            </button>
          </div>

          {/* Módulos */}
          <div id="productos" className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
            {MODULES.map((module, idx) => {
              const IconComponent = module.icon;
              return (
                <div
                  key={module.id}
                  className={`group relative overflow-hidden rounded-2xl bg-slate-800/50 border border-slate-700/50 hover:border-slate-600 transition-all duration-300 p-8 animate-fade-in-up hover:shadow-xl hover:shadow-blue-500/20 cursor-pointer transform hover:-translate-y-2 ${idx === 0 ? 'animate-delay-1' : idx === 1 ? 'animate-delay-2' : 'animate-delay-3'}`}
                >
                  <div className={`absolute inset-0 opacity-0 group-hover:opacity-10 bg-gradient-to-br ${module.color} transition-opacity`} />

                  <div className="relative z-10">
                    <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${module.color} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform animate-float group-hover:animate-pulse-glow`}>
                      <IconComponent className="h-7 w-7 text-white" />
                    </div>

                    <h3 className="text-2xl font-bold text-white mb-2">{module.name}</h3>
                    <p className="text-slate-400 mb-6">{module.description}</p>

                    <ul className="space-y-2 mb-8">
                      {module.features.slice(0, 3).map((feature, idx) => (
                        <li key={idx} className="flex items-center gap-2 text-slate-300 text-sm">
                          <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                          {feature}
                        </li>
                      ))}
                    </ul>

                    <Button
                      onClick={() => module.active ? router.push('/login') : null}
                      disabled={!module.active}
                      className={`w-full font-medium ${
                        module.active
                          ? 'bg-blue-600 text-white hover:bg-blue-700'
                          : 'bg-slate-600 text-slate-300 cursor-not-allowed'
                      }`}
                    >
                      {module.buttonText}
                      {module.active && <ArrowRight className="h-4 w-4 ml-2" />}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ============ ABOUT US SECTION ============ */}
      <section id="about" className="py-20 bg-white relative reveal-on-scroll">
        <AnimatedBackground />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center mb-16 animate-fade-in-up">
            <h2 className="text-4xl font-bold text-gray-900 mb-4 animate-fade-in-up">¿Quiénes Somos?</h2>
            <p className="text-lg text-gray-600 animate-fade-in-up animate-delay-1">Líderes en soluciones integrales de gestión empresarial con certificaciones ISO</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div className="animate-slide-in-left">
              <h3 className="text-2xl font-bold text-gray-900 mb-6">Transformando la gestión empresarial</h3>
              <p className="text-gray-600 mb-4 leading-relaxed">
                Contamos con más de 15 años de experiencia ayudando a empresas de todos los tamaños
                a mejorar sus procesos de gestión y cumplimiento normativo.
              </p>
              <p className="text-gray-600 mb-4 leading-relaxed">
                Nuestro equipo de expertos certificados en ISO 9001, 14001 y 45001 trabaja
                constantemente para ofrecerte las mejores soluciones del mercado.
              </p>
              <p className="text-gray-600 leading-relaxed">
                Confiamos en la transparencia, la excelencia y el compromiso con tus objetivos.
              </p>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-4 mt-8">
                <div className="bg-blue-50 p-6 rounded-lg text-center animate-fade-in-up animate-delay-1 hover:shadow-lg hover:shadow-blue-200 transition transform hover:scale-105">
                  <p className="text-3xl font-bold text-blue-600">+500</p>
                  <p className="text-gray-600 text-sm">Empresas Activas</p>
                </div>
                <div className="bg-blue-50 p-6 rounded-lg text-center animate-fade-in-up animate-delay-2 hover:shadow-lg hover:shadow-blue-200 transition transform hover:scale-105">
                  <p className="text-3xl font-bold text-blue-600">+1500</p>
                  <p className="text-gray-600 text-sm">Usuarios Registrados</p>
                </div>
                <div className="bg-blue-50 p-6 rounded-lg text-center animate-fade-in-up animate-delay-3 hover:shadow-lg hover:shadow-blue-200 transition transform hover:scale-105">
                  <p className="text-3xl font-bold text-blue-600">15+</p>
                  <p className="text-gray-600 text-sm">Años Experiencia</p>
                </div>
                <div className="bg-blue-50 p-6 rounded-lg text-center animate-fade-in-up animate-delay-4 hover:shadow-lg hover:shadow-blue-200 transition transform hover:scale-105">
                  <p className="text-3xl font-bold text-blue-600">99.9%</p>
                  <p className="text-gray-600 text-sm">Uptime</p>
                </div>
              </div>
            </div>

            {/* Carousel Automático */}
            <div className="relative h-96 rounded-2xl overflow-hidden">
              {carouselItems.map((item, idx) => (
                <div
                  key={idx}
                  className={`absolute inset-0 bg-gradient-to-br ${item.color} flex items-center justify-center text-white text-center p-8 transition-all duration-700 transform ${
                    idx === carouselIndex
                      ? 'opacity-100 translate-x-0'
                      : idx < carouselIndex
                      ? 'opacity-0 -translate-x-full'
                      : 'opacity-0 translate-x-full'
                  }`}
                >
                  <div className="animate-fade-in-up">
                    <p className="text-6xl mb-4 animate-float">{item.icon}</p>
                    <p className="text-2xl font-bold mb-4">{item.title}</p>
                    <p className="mt-2 text-gray-100 max-w-xs">{item.description}</p>
                  </div>
                </div>
              ))}

              {/* Indicadores de progreso */}
              <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-2 z-10">
                {carouselItems.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCarouselIndex(idx)}
                    className={`h-2 rounded-full transition-all ${
                      idx === carouselIndex
                        ? 'bg-white w-8 animate-pulse'
                        : 'bg-white/50 w-2 hover:bg-white/70'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ FEATURES SECTION ============ */}
      <section id="features" className="py-20 bg-gray-50 relative overflow-hidden">
        <AnimatedBackground />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center mb-16 animate-fade-in-up">
            <h2 className="text-4xl font-bold text-gray-900 mb-4 animate-fade-in-up">Características Principales</h2>
            <p className="text-lg text-gray-600 animate-fade-in-up animate-delay-1">Integración completa de tres sistemas potentes en una sola plataforma</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {FEATURES.map((feature, idx) => (
              <div key={idx} className={`bg-white p-8 rounded-xl border border-gray-200 hover:shadow-xl hover:shadow-blue-200 transition-all transform hover:-translate-y-2 hover:border-blue-300 animate-fade-in-up ${idx === 0 ? 'animate-delay-1' : idx === 1 ? 'animate-delay-2' : idx === 2 ? 'animate-delay-3' : idx === 3 ? 'animate-delay-4' : idx === 4 ? 'animate-delay-5' : 'animate-delay-6'}`}>
                <p className="text-4xl mb-4 hover:scale-125 transition transform duration-300">{feature.icon}</p>
                <h3 className="text-xl font-bold text-gray-900 mb-3">{feature.title}</h3>
                <p className="text-gray-600">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ TESTIMONIALS SECTION ============ */}
      <section className="py-20 bg-white relative overflow-hidden reveal-on-scroll">
        <AnimatedBackground />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center mb-16 animate-fade-in-up">
            <h2 className="text-4xl font-bold text-gray-900 mb-4 animate-fade-in-up">Lo que dicen nuestros clientes</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {TESTIMONIALS.map((testimonial, idx) => (
              <div key={idx} className={`bg-gray-50 p-8 rounded-xl border border-gray-200 hover:shadow-xl hover:shadow-amber-100 hover:border-amber-300 transition-all transform hover:-translate-y-2 animate-fade-in-up ${idx === 0 ? 'animate-delay-1' : idx === 1 ? 'animate-delay-2' : 'animate-delay-3'}`}>
                <div className="flex gap-1 mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <span key={i} className="text-amber-400 text-xl animate-float" style={{ animationDelay: `${i * 0.1}s` }}>★</span>
                  ))}
                </div>
                <p className="text-gray-600 mb-6 italic">{testimonial.text}</p>
                <div>
                  <p className="font-bold text-gray-900">{testimonial.name}</p>
                  <p className="text-sm text-gray-500">{testimonial.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ PRICING SECTION ============ */}
      <section className="py-20 bg-white relative overflow-hidden reveal-on-scroll">
        <AnimatedBackground />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center mb-16 animate-fade-in-up">
            <h2 className="text-4xl font-bold text-gray-900 mb-4 animate-fade-in-up">Planes para Todos</h2>
            <p className="text-lg text-gray-600 animate-fade-in-up animate-delay-1">Elige el plan perfecto para tu empresa</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { name: 'BÁSICO', price: '$35', features: ['Hasta 5 usuarios', 'Auditoría IA', 'Auditorías ISO', 'Capacitaciones', 'No Conformidades'], highlight: false },
              { name: 'PROFESIONAL', price: '$69', features: ['Hasta 20 usuarios', 'Auditoría IA', 'Auditorías ISO', 'Capacitaciones', 'Clientes'], highlight: true },
              { name: 'PREMIUM', price: '$99', features: ['Hasta 50 usuarios', 'Auditoría IA', 'Auditorías ISO', 'Capacitaciones', 'Clientes'], highlight: false }
            ].map((plan, idx) => (
              <div key={idx} className={`p-8 rounded-xl animate-fade-in-up transition-all transform hover:-translate-y-2 ${plan.highlight ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-xl scale-105' : 'bg-gray-50 border border-gray-200'} ${idx === 0 ? 'animate-delay-1' : idx === 1 ? 'animate-delay-2' : 'animate-delay-3'}`}>
                <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
                <p className="text-4xl font-bold mb-6">{plan.price}<span className="text-sm">/mes</span></p>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <span className="text-lg">✓</span> {feature}
                    </li>
                  ))}
                </ul>
                <button className={`w-full py-3 rounded-lg font-bold transition ${plan.highlight ? 'bg-white text-blue-600 hover:bg-gray-100' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>
                  Contratar Ahora
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ CLIENTES SECTION ============ */}
      <section className="py-20 bg-gray-50 relative overflow-hidden reveal-on-scroll">
        <AnimatedBackground />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center mb-16 animate-fade-in-up">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Confían en nosotros</h2>
            <p className="text-lg text-gray-600">+500 empresas en toda Latinoamérica</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-8 items-center">
            {['🏢 Acme Corp', '🏛️ Global SA', '⚙️ TechFlow', '📊 DataPro', '🔧 InnovateLab'].map((company, idx) => (
              <div key={idx} className={`bg-white p-6 rounded-lg text-center border border-gray-200 hover:shadow-lg transition animate-fade-in-up ${idx === 0 ? 'animate-delay-1' : idx === 1 ? 'animate-delay-2' : idx === 2 ? 'animate-delay-3' : idx === 3 ? 'animate-delay-4' : 'animate-delay-5'}`}>
                <p className="text-3xl mb-2">{company.split(' ')[0]}</p>
                <p className="text-gray-600">{company.split(' ')[1]}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ INTEGRACIONES SECTION ============ */}
      <section className="py-20 bg-white relative overflow-hidden reveal-on-scroll">
        <AnimatedBackground />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center mb-16 animate-fade-in-up">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Integraciones</h2>
            <p className="text-lg text-gray-600">Conecta con tus herramientas favoritas</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {['📊 Excel', '📈 Google Sheets', '☁️ Google Drive', '💾 OneDrive', '🔗 Zapier', '📞 Slack', '✉️ Gmail', '⚡ Power BI'].map((integration, idx) => (
              <div key={idx} className={`bg-gray-50 p-6 rounded-lg text-center border border-gray-200 hover:border-blue-300 hover:shadow-lg transition animate-fade-in-up ${idx === 0 ? 'animate-delay-1' : idx === 1 ? 'animate-delay-2' : idx === 2 ? 'animate-delay-3' : idx === 3 ? 'animate-delay-4' : idx === 4 ? 'animate-delay-5' : 'animate-delay-6'}`}>
                <p className="text-4xl mb-2">{integration.split(' ')[0]}</p>
                <p className="text-gray-700 font-semibold">{integration.split(' ')[1]}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ FAQ SECTION ============ */}
      <section id="faq" className="py-20 bg-gray-50 relative overflow-hidden reveal-on-scroll">
        <AnimatedBackground />
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center mb-16 animate-fade-in-up">
            <h2 className="text-4xl font-bold text-gray-900 mb-4 animate-fade-in-up">Preguntas Frecuentes</h2>
            <p className="text-gray-600 animate-fade-in-up animate-delay-1">¿No encuentras lo que buscas? Contáctanos</p>
          </div>

          <div className="space-y-4">
            {FAQS.map((faq, idx) => (
              <div key={idx} className={`bg-white border border-gray-200 rounded-lg hover:border-blue-300 hover:shadow-md transition-all transform hover:scale-102 animate-fade-in-up ${idx === 0 ? 'animate-delay-1' : idx === 1 ? 'animate-delay-2' : idx === 2 ? 'animate-delay-3' : idx === 3 ? 'animate-delay-4' : 'animate-delay-5'}`}>
                <button
                  onClick={() => setExpandedFAQ(expandedFAQ === idx ? null : idx)}
                  className="w-full flex items-center justify-between p-6 hover:bg-blue-50 transition"
                >
                  <span className="font-semibold text-gray-900">{faq.question}</span>
                  <ChevronDown className={`w-5 h-5 text-gray-600 transition transform duration-300 ${expandedFAQ === idx ? 'rotate-180' : ''}`} />
                </button>
                {expandedFAQ === idx && (
                  <div className="px-6 pb-6 border-t border-gray-200 text-gray-600 animate-fade-in-down">
                    {faq.answer}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ FOOTER ============ */}
      <footer id="contact" className="bg-gray-900 text-gray-300 py-16 animate-fade-in-up">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-8 mb-12">
            {/* Company Info */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                  <Zap className="h-5 w-5 text-white" />
                </div>
                <span className="font-bold text-white">SGI 360</span>
              </div>
              <p className="text-sm mb-4">Soluciones integrales de gestión empresarial con tecnología de punta.</p>
              <div className="flex gap-3">
                {landingSettings?.facebook ? <a href={landingSettings.facebook} target="_blank"><Facebook className="w-5 h-5 cursor-pointer hover:text-blue-400" /></a> : <Facebook className="w-5 h-5 cursor-pointer hover:text-blue-400" />}
                {landingSettings?.twitter ? <a href={landingSettings.twitter} target="_blank"><Twitter className="w-5 h-5 cursor-pointer hover:text-blue-400" /></a> : <Twitter className="w-5 h-5 cursor-pointer hover:text-blue-400" />}
                {landingSettings?.linkedin ? <a href={landingSettings.linkedin} target="_blank"><Linkedin className="w-5 h-5 cursor-pointer hover:text-blue-400" /></a> : <Linkedin className="w-5 h-5 cursor-pointer hover:text-blue-400" />}
              </div>
            </div>

            {/* Productos */}
            <div>
              <h4 className="font-bold text-white mb-4">Productos</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-blue-400">SGI 360</a></li>
                <li><a href="#" className="hover:text-blue-400">SEH 360</a></li>
                <li><a href="#" className="hover:text-blue-400">Audit360</a></li>
              </ul>
            </div>

            {/* Recursos */}
            <div>
              <h4 className="font-bold text-white mb-4">Recursos</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-blue-400">Centro de Ayuda</a></li>
                <li><a href="#" className="hover:text-blue-400">Estado del Sistema</a></li>
                <li><a href="#" className="hover:text-blue-400">Documentación</a></li>
              </ul>
            </div>

            {/* Legal */}
            <div>
              <h4 className="font-bold text-white mb-4">Legal</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-blue-400">Términos</a></li>
                <li><a href="#" className="hover:text-blue-400">Privacidad</a></li>
                <li><a href="#" className="hover:text-blue-400">Cookies</a></li>
              </ul>
            </div>

            {/* Soporte */}
            <div>
              <h4 className="font-bold text-white mb-4">Soporte</h4>
              <ul className="space-y-3 text-sm">
                <li className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" />
                  Chat 24/7
                </li>
                <li className="flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  {landingSettings?.email || 'support@sgi360.com'}
                </li>
                <li className="flex items-center gap-2">
                  <Phone className="w-4 h-4" />
                  {landingSettings?.phone || '+56 2 1234 5678'}
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-gray-800 pt-8">
            <div className="flex flex-col md:flex-row justify-between items-center">
              <p className="text-sm">&copy; 2025 SGI 360. Todos los derechos reservados.</p>
              <div className="flex gap-4 mt-4 md:mt-0">
                <span className="px-3 py-1 bg-gray-800 rounded text-xs">ISO 9001:2015</span>
                <span className="px-3 py-1 bg-gray-800 rounded text-xs">ISO 45001:2018</span>
                <span className="px-3 py-1 bg-gray-800 rounded text-xs">ISO 14001:2015</span>
              </div>
            </div>
          </div>
        </div>
      </footer>

      {/* ============ REGISTRATION MODAL ============ */}
      {showRegisterModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in-up">
          <div className="bg-white border border-gray-200 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-fade-in-up shadow-2xl">
            <div className="p-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Registrar Nueva Empresa</h2>
                <button
                  onClick={() => setShowRegisterModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleSubmitRegistration} className="space-y-6">
                {/* Logo */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Logo de Empresa</label>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-gray-400 transition">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      className="hidden"
                      id="logo-input"
                    />
                    <label htmlFor="logo-input" className="cursor-pointer">
                      {formData.logo ? (
                        <p className="text-gray-700">{formData.logo.name}</p>
                      ) : (
                        <div>
                          <p className="text-gray-600">Haz clic para subir logo</p>
                          <p className="text-xs text-gray-500">PNG, JPG, SVG máx 2MB</p>
                        </div>
                      )}
                    </label>
                  </div>
                </div>

                {/* Grid de campos */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Nombre Empresa *</label>
                    <input
                      type="text"
                      name="companyName"
                      value={formData.companyName}
                      onChange={handleInputChange}
                      required
                      className="w-full bg-white border border-gray-300 rounded-lg px-4 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Acme Corp"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Razón Social</label>
                    <input
                      type="text"
                      name="socialReason"
                      value={formData.socialReason}
                      onChange={handleInputChange}
                      className="w-full bg-white border border-gray-300 rounded-lg px-4 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Acme Corporation S.A."
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">RUT / Tax ID *</label>
                    <input
                      type="text"
                      name="rut"
                      value={formData.rut}
                      onChange={handleInputChange}
                      required
                      className="w-full bg-white border border-gray-300 rounded-lg px-4 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="12345678-9"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Email *</label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      required
                      className="w-full bg-white border border-gray-300 rounded-lg px-4 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="empresa@example.com"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Teléfono</label>
                    <input
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleInputChange}
                      className="w-full bg-white border border-gray-300 rounded-lg px-4 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="+56 9 1234 5678"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Sitio Web</label>
                    <input
                      type="url"
                      name="website"
                      value={formData.website}
                      onChange={handleInputChange}
                      className="w-full bg-white border border-gray-300 rounded-lg px-4 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="https://example.com"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Dirección</label>
                  <input
                    type="text"
                    name="address"
                    value={formData.address}
                    onChange={handleInputChange}
                    className="w-full bg-white border border-gray-300 rounded-lg px-4 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Calle Principal 123, Piso 5"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Color Corporativo</label>
                  <div className="flex items-center gap-4">
                    <input
                      type="color"
                      name="primaryColor"
                      value={formData.primaryColor}
                      onChange={handleInputChange}
                      className="w-16 h-10 rounded cursor-pointer"
                    />
                    <span className="text-sm text-gray-500">{formData.primaryColor}</span>
                  </div>
                </div>

                <div className="flex gap-4 pt-6">
                  <Button
                    type="button"
                    onClick={() => setShowRegisterModal(false)}
                    className="flex-1 bg-white text-gray-900 border border-gray-300 hover:bg-gray-50"
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    disabled={loading}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    {loading ? 'Enviando...' : 'Registrar Empresa'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

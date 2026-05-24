/**
 * PREMIUM UX COMPONENTS
 * SGI360 Command Center - UX Premium con Framer Motion
 * 
 * Componentes de UX premium con animaciones avanzadas:
 * - Floating particles background
 * - Glassmorphism effects
 * - Smooth transitions
 * - Micro-interactions
 * - Loading skeletons
 * - Success/error animations
 */

'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useAnimation, useMotionValue, useTransform } from 'framer-motion';
import { 
  Brain, 
  Zap, 
  TrendingUp, 
  Shield, 
  Activity, 
  Sparkles,
  Bot,
  MessageSquare,
  BarChart3,
  AlertTriangle,
  DollarSign,
  FileText,
  Settings,
  ChevronRight,
  Loader2,
  CheckCircle,
  XCircle,
  Info
} from 'lucide-react';

interface Particle {
  id: number;
  x: number;
  y: number;
  size: number;
  duration: number;
  delay: number;
}

interface FloatingCardProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  intensity?: 'subtle' | 'medium' | 'strong';
}

interface AnimatedButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  success?: boolean;
  error?: boolean;
  disabled?: boolean;
  className?: string;
}

interface MetricCardProps {
  title: string;
  value: string | number;
  change?: number;
  icon: React.ReactNode;
  trend?: 'up' | 'down' | 'stable';
  loading?: boolean;
  delay?: number;
}

interface ChatMessageProps {
  message: string;
  isAI: boolean;
  timestamp: Date;
  status?: 'sending' | 'sent' | 'error';
  typing?: boolean;
}

interface WidgetProps {
  title: string;
  children: React.ReactNode;
  type: 'chart' | 'list' | 'metrics' | 'alert';
  loading?: boolean;
  error?: string;
  delay?: number;
}

// Floating Particles Background
export const FloatingParticles: React.FC<{ count?: number }> = ({ count = 50 }) => {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    const newParticles: Particle[] = Array.from({ length: count }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 4 + 1,
      duration: Math.random() * 20 + 10,
      delay: Math.random() * 5
    }));
    setParticles(newParticles);
  }, [count]);

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden">
      {particles.map((particle) => (
        <motion.div
          key={particle.id}
          className="absolute bg-blue-400 rounded-full opacity-20"
          style={{
            width: particle.size,
            height: particle.size,
            left: `${particle.x}%`,
            top: `${particle.y}%`,
          }}
          animate={{
            y: [-100, 100],
            opacity: [0, 0.3, 0],
            scale: [1, 1.2, 1],
          }}
          transition={{
            duration: particle.duration,
            delay: particle.delay,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
      ))}
    </div>
  );
};

// Glassmorphism Card
export const GlassCard: React.FC<FloatingCardProps> = ({ 
  children, 
  className = '', 
  delay = 0,
  intensity = 'medium'
}) => {
  const intensityClasses = {
    subtle: 'bg-white/5 backdrop-blur-sm border-white/10',
    medium: 'bg-white/10 backdrop-blur-md border-white/20',
    strong: 'bg-white/15 backdrop-blur-lg border-white/30'
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      className={`
        relative rounded-2xl border shadow-xl
        ${intensityClasses[intensity]}
        ${className}
      `}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-2xl" />
      <div className="relative z-10">
        {children}
      </div>
    </motion.div>
  );
};

// Animated Button
export const AnimatedButton: React.FC<AnimatedButtonProps> = ({
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  loading = false,
  success = false,
  error = false,
  disabled = false,
  className = ''
}) => {
  const baseClasses = 'relative inline-flex items-center justify-center font-medium rounded-xl transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2';
  
  const variantClasses = {
    primary: 'bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700 focus:ring-blue-500 shadow-lg hover:shadow-xl',
    secondary: 'bg-white/10 backdrop-blur-md border border-white/20 text-white hover:bg-white/20 focus:ring-white',
    ghost: 'text-white/80 hover:text-white hover:bg-white/10 focus:ring-white'
  };

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg'
  };

  return (
    <motion.button
      whileHover={{ scale: loading || disabled ? 1 : 1.05 }}
      whileTap={{ scale: loading || disabled ? 1 : 0.95 }}
      onClick={onClick}
      disabled={disabled || loading}
      className={`
        ${baseClasses}
        ${variantClasses[variant]}
        ${sizeClasses[size]}
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        ${className}
      `}
    >
      <AnimatePresence mode="wait">
        {loading && (
          <motion.div
            key="loading"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="flex items-center"
          >
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
            Cargando...
          </motion.div>
        )}
        
        {success && !loading && (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="flex items-center text-green-400"
          >
            <CheckCircle className="w-4 h-4 mr-2" />
            ¡Listo!
          </motion.div>
        )}
        
        {error && !loading && (
          <motion.div
            key="error"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="flex items-center text-red-400"
          >
            <XCircle className="w-4 h-4 mr-2" />
            Error
          </motion.div>
        )}
        
        {!loading && !success && !error && (
          <motion.div
            key="content"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.button>
  );
};

// Metric Card with Animation
export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  change,
  icon,
  trend,
  loading = false,
  delay = 0
}) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, delay }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      className="relative"
    >
      <GlassCard intensity="medium" className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <motion.p
              animate={{ color: isHovered ? '#60a5fa' : '#9ca3af' }}
              className="text-sm font-medium text-gray-400 mb-2"
            >
              {title}
            </motion.p>
            
            {loading ? (
              <motion.div
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="h-8 bg-white/10 rounded w-20"
              />
            ) : (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3 }}
              >
                <p className="text-2xl font-bold text-white">{value}</p>
                
                {change !== undefined && (
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: 0.1 }}
                    className={`flex items-center mt-2 text-sm ${
                      change > 0 ? 'text-green-400' : change < 0 ? 'text-red-400' : 'text-gray-400'
                    }`}
                  >
                    {trend === 'up' && <TrendingUp className="w-4 h-4 mr-1" />}
                    {trend === 'down' && <TrendingUp className="w-4 h-4 mr-1 rotate-180" />}
                    {change > 0 ? '+' : ''}{change}%
                  </motion.div>
                )}
              </motion.div>
            )}
          </div>
          
          <motion.div
            animate={{ 
              scale: isHovered ? 1.1 : 1,
              rotate: isHovered ? 5 : 0
            }}
            transition={{ duration: 0.2 }}
            className="p-3 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-xl"
          >
            {icon}
          </motion.div>
        </div>
      </GlassCard>
    </motion.div>
  );
};

// Chat Message with Typing Animation
export const ChatMessage: React.FC<ChatMessageProps> = ({
  message,
  isAI,
  timestamp,
  status = 'sent',
  typing = false
}) => {
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(typing);

  useEffect(() => {
    if (typing && isAI) {
      setIsTyping(true);
      setDisplayedText('');
      
      let index = 0;
      const interval = setInterval(() => {
        if (index < message.length) {
          setDisplayedText(message.slice(0, index + 1));
          index++;
        } else {
          setIsTyping(false);
          clearInterval(interval);
        }
      }, 30);

      return () => clearInterval(interval);
    } else {
      setDisplayedText(message);
    }
  }, [message, typing, isAI]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`flex ${isAI ? 'justify-start' : 'justify-end'} mb-4`}
    >
      <div className={`flex max-w-[80%] ${isAI ? 'flex-row' : 'flex-row-reverse'}`}>
        <motion.div
          animate={{ scale: isTyping ? [1, 1.05, 1] : 1 }}
          transition={{ duration: 0.5, repeat: isTyping ? Infinity : 0 }}
          className={`p-3 rounded-2xl ${
            isAI 
              ? 'bg-white/10 backdrop-blur-md border border-white/20 text-white' 
              : 'bg-gradient-to-r from-blue-600 to-purple-600 text-white'
          }`}
        >
          <p className="text-sm whitespace-pre-wrap">
            {displayedText}
            {isTyping && <span className="inline-block w-2 h-4 bg-white/50 ml-1 animate-pulse" />}
          </p>
          
          <div className={`flex items-center mt-2 text-xs opacity-70 ${isAI ? 'justify-start' : 'justify-end'}`}>
            <span>{timestamp.toLocaleTimeString()}</span>
            
            {status === 'sending' && <Loader2 className="w-3 h-3 ml-2 animate-spin" />}
            {status === 'sent' && <CheckCircle className="w-3 h-3 ml-2" />}
            {status === 'error' && <XCircle className="w-3 h-3 ml-2" />}
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
};

// Widget Container with Loading States
export const Widget: React.FC<WidgetProps> = ({
  title,
  children,
  type,
  loading = false,
  error,
  delay = 0
}) => {
  const getIcon = () => {
    switch (type) {
      case 'chart': return <BarChart3 className="w-5 h-5" />;
      case 'list': return <MessageSquare className="w-5 h-5" />;
      case 'metrics': return <Activity className="w-5 h-5" />;
      case 'alert': return <AlertTriangle className="w-5 h-5" />;
      default: return <Info className="w-5 h-5" />;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
    >
      <GlassCard intensity="medium" className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <motion.div
              animate={{ rotate: loading ? 360 : 0 }}
              transition={{ duration: 2, repeat: loading ? Infinity : 0, ease: "linear" }}
              className="p-2 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-lg mr-3"
            >
              {getIcon()}
            </motion.div>
            <h3 className="text-lg font-semibold text-white">{title}</h3>
          </div>
          
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <Settings className="w-4 h-4 text-white/60" />
          </motion.button>
        </div>

        <AnimatePresence mode="wait">
          {loading && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-3"
            >
              {[1, 2, 3].map((i) => (
                <motion.div
                  key={i}
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.2 }}
                  className="h-4 bg-white/10 rounded"
                />
              ))}
            </motion.div>
          )}

          {error && (
            <motion.div
              key="error"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="text-center py-8"
            >
              <XCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
              <p className="text-red-400">{error}</p>
            </motion.div>
          )}

          {!loading && !error && (
            <motion.div
              key="content"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {children}
            </motion.div>
          )}
        </AnimatePresence>
      </GlassCard>
    </motion.div>
  );
};

// Feature Showcase Component
export const FeatureShowcase: React.FC = () => {
  const features = [
    { icon: <Brain className="w-6 h-6" />, title: 'IA Avanzada', description: 'Procesamiento con Groq y OpenAI' },
    { icon: <Zap className="w-6 h-6" />, title: 'Streaming Real-time', description: 'Respuestas instantáneas' },
    { icon: <Shield className="w-6 h-6" />, title: 'Seguridad Total', description: 'Encriptación de extremo a extremo' },
    { icon: <BarChart3 className="w-6 h-6" />, title: 'Análisis Predictivo', description: 'Insights basados en datos' },
    { icon: <MessageSquare className="w-6 h-6" />, title: 'Memoria Contextual', description: 'Conversaciones inteligentes' },
    { icon: <Sparkles className="w-6 h-6" />, title: 'Widgets Dinámicos', description: 'Dashboards personalizados' }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {features.map((feature, index) => (
        <motion.div
          key={index}
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: index * 0.1 }}
          whileHover={{ y: -5 }}
        >
          <GlassCard intensity="medium" className="p-6 text-center group">
            <motion.div
              animate={{ 
                scale: [1, 1.1, 1],
                rotate: [0, 5, -5, 0]
              }}
              transition={{ duration: 3, repeat: Infinity, delay: index * 0.5 }}
              className="w-16 h-16 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:from-blue-500/30 group-hover:to-purple-500/30"
            >
              {feature.icon}
            </motion.div>
            <h3 className="text-lg font-semibold text-white mb-2">{feature.title}</h3>
            <p className="text-sm text-gray-400">{feature.description}</p>
          </GlassCard>
        </motion.div>
      ))}
    </div>
  );
};

// Loading Screen
export const LoadingScreen: React.FC<{ message?: string }> = ({ message = 'Cargando...' }) => {
  return (
    <div className="fixed inset-0 bg-gradient-to-br from-blue-900/90 to-purple-900/90 backdrop-blur-lg flex items-center justify-center z-50">
      <div className="text-center">
        <motion.div
          animate={{ 
            scale: [1, 1.2, 1],
            rotate: [0, 180, 360]
          }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-500 rounded-3xl flex items-center justify-center mx-auto mb-6"
        >
          <Bot className="w-10 h-10 text-white" />
        </motion.div>
        
        <motion.p
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="text-xl font-semibold text-white mb-4"
        >
          {message}
        </motion.p>
        
        <div className="flex justify-center space-x-2">
          {[1, 2, 3].map((i) => (
            <motion.div
              key={i}
              animate={{ 
                y: [0, -10, 0],
                opacity: [0.3, 1, 0.3]
              }}
              transition={{ 
                duration: 1, 
                repeat: Infinity, 
                delay: i * 0.2 
              }}
              className="w-2 h-2 bg-white rounded-full"
            />
          ))}
        </div>
      </div>
    </div>
  );
};

// Success Animation
export const SuccessAnimation: React.FC<{ message: string; onComplete?: () => void }> = ({ 
  message, 
  onComplete 
}) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onComplete?.();
    }, 3000);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0, opacity: 0 }}
      className="fixed top-8 right-8 bg-green-500 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center z-50"
    >
      <motion.div
        animate={{ 
          scale: [1, 1.2, 1],
          rotate: [0, 360, 0]
        }}
        transition={{ duration: 1 }}
      >
        <CheckCircle className="w-6 h-6 mr-3" />
      </motion.div>
      <span className="font-medium">{message}</span>
    </motion.div>
  );
};

export default {
  FloatingParticles,
  GlassCard,
  AnimatedButton,
  MetricCard,
  ChatMessage,
  Widget,
  FeatureShowcase,
  LoadingScreen,
  SuccessAnimation
};

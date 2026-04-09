#!/bin/bash

# Script para configurar OLLAMA con los modelos necesarios para SGI 360

echo "🤖 Configurando OLLAMA para SGI 360..."

# Verificar que Docker está corriendo
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker no está corriendo. Por favor inicia Docker primero."
    exit 1
fi

# Verificar que el contenedor OLLAMA está corriendo
if ! docker ps | grep -q sgi-ollama; then
    echo "🚀 Iniciando contenedor OLLAMA..."
    docker-compose up -d ollama
    sleep 10
fi

# Esperar a que OLLAMA esté disponible
echo "⏳ Esperando a que OLLAMA esté disponible..."
until curl -s http://localhost:11434/api/tags > /dev/null; do
    sleep 2
done

echo "✅ OLLAMA está disponible!"

# Descargar modelos necesarios
echo "📥 Descargando modelos de IA..."

# Modelo principal para auditoría
echo "   • Descargando llama3.1..."
docker exec sgi-ollama ollama pull llama3.1

# Modelo alternativo ligero
echo "   • Descargando mistral..."
docker exec sgi-ollama ollama pull mistral

# Modelo para análisis de código (opcional)
echo "   • Descargando codellama..."
docker exec sgi-ollama ollama pull codellama

echo "✅ Modelos descargados!"

# Verificar modelos instalados
echo "📋 Modelos instalados:"
docker exec sgi-ollama ollama list

# Probar OLLAMA
echo "🧪 Probando OLLAMA con una consulta simple..."
curl -X POST http://localhost:11434/api/generate \
  -H "Content-Type: application/json" \
  -d '{
    "model": "llama3.1",
    "prompt": "Responde en una sola palabra: ¿Estás funcionando?",
    "stream": false
  }'

echo ""
echo "🎉 ¡OLLAMA está configurado y listo para usar!"
echo ""
echo "📍 Endpoints disponibles:"
echo "   • OLLAMA API: http://localhost:11434"
echo "   • health check: curl http://localhost:11434/api/tags"
echo ""
echo "🔧 Para usar en la aplicación:"
echo "   • Asegúrate que LLM_PROVIDER=ollama en .env"
echo "   • OLLAMA_BASE_URL=http://localhost:11434/v1"
echo "   • OLLAMA_MODEL=llama3.1"

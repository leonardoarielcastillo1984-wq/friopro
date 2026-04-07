#!/bin/bash
# Script para mantener el API corriendo

while true; do
  echo "🚀 Iniciando API..."
  node server-data.cjs
  echo "❌ API se apagó, reiniciando en 3 segundos..."
  sleep 3
done

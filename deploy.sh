#!/bin/bash
cd "/Users/leonardocastillo/Desktop/APP/SGI respaldo 360"
git add -A
git commit -m "feat: add Ver en Matriz tab inside Competencias page"
git push origin main

ssh root@46.62.253.81 "cd /root/friopro && git pull && docker compose -p friopro-testing -f docker-compose.testing.yml build --no-cache web && docker compose -p friopro-testing -f docker-compose.testing.yml up -d web"

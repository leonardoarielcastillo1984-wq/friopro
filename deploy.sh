#!/bin/bash
cd "/Users/leonardocastillo/Desktop/APP/SGI respaldo 360"
git add -A
git commit -m "feat: add Ver en Matriz tab inside Competencias page"
git push origin main

ssh -i ~/Downloads/logismart-prod.pem ubuntu@18.191.206.203 "cd /home/ubuntu/friopro && git fetch origin main -q && git checkout origin/main -- apps/web && docker compose -f /home/ubuntu/docker-compose.testing.yml build sgi-web && docker compose -f /home/ubuntu/docker-compose.testing.yml up -d sgi-web"

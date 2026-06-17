#!/bin/bash
# Deploy to Oracle Cloud Free Tier
# Usage: ./deploy-to-oracle.sh <IP>

set -e

IP=${1:?Usage: $0 <server-ip>}
SSH="ssh -o StrictHostKeyChecking=no ubuntu@$IP"

echo "🚀 Deploying to $IP..."

echo "1/4 Installing Docker..."
$SSH 'sudo apt update -qq && sudo apt install -y -qq docker.io && sudo usermod -aG docker $USER'
$SSH 'sudo docker --version'

echo "2/4 Generating secrets..."
DB_PASSWORD=$(openssl rand -hex 16)
SALT=$(openssl rand -hex 32)
VAPID_PUBLIC=$(node -e "const wp=require('web-push'); console.log(wp.generateVAPIDKeys().publicKey)" 2>/dev/null || echo "skipped")
VAPID_PRIVATE=$(node -e "const wp=require('web-push'); console.log(wp.generateVAPIDKeys().privateKey)" 2>/dev/null || echo "skipped")

echo "3/4 Copying project..."
scp -o StrictHostKeyChecking=no -r apps/api_server ubuntu@$IP:~/messenger-api
scp docker-compose.yml ubuntu@$IP:~/

echo "4/4 Starting services..."
$SSH "cd ~ && DB_PASSWORD=$DB_PASSWORD PHONE_HASH_SALT=$SALT VAPID_PUBLIC=$VAPID_PUBLIC VAPID_PRIVATE=$VAPID_PRIVATE sudo docker compose up -d --build"

echo ""
echo "✅ Done!"
echo "   API:      http://$IP:3000"
echo "   Health:   http://$IP:3000/health"
echo "   Metrics:  http://$IP:3000/metrics"
echo "   DB pass:  $DB_PASSWORD"

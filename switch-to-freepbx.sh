#!/bin/bash

# Configuration Switcher: 3CX -> FreePBX
echo "======================================"
echo "📞 Switch to FreePBX / Asterisk Setup"
echo "======================================"
echo "This script will update your .env file to connect to a FreePBX server."
echo ""

if [ -f .env ]; then
  echo "Backing up current .env to .env.backup..."
  cp .env .env.backup
fi

# Gather User Input
read -p "Enter FreePBX IP Address (SIP_DOMAIN): " FREEPBX_IP
read -p "Enter Extension Number (e.g. 9000): " EXTENSION
read -s -p "Enter Extension Secret/Password: " PASSWORD
echo ""

# Read other keys from existing env if possible
if [ -f .env ]; then
  OPENAI_KEY=$(grep OPENAI_API_KEY .env | cut -d '=' -f2)
  ELEVEN_KEY=$(grep ELEVENLABS_API_KEY .env | cut -d '=' -f2)
  GEMINI_URL=$(grep GEMINI_API_URL .env | cut -d '=' -f2)
fi

# Write new .env
cat > .env <<EOL
# ====================================
# Gemini Phone Configuration (FreePBX)
# ====================================

# Network Configuration
EXTERNAL_IP=$(hostname -I | awk '{print $1}')

# Drachtio Configuration
DRACHTIO_HOST=127.0.0.1
DRACHTIO_PORT=9022
DRACHTIO_SECRET=cymru
DRACHTIO_SIP_PORT=5060

# FreeSWITCH Configuration
FREESWITCH_HOST=127.0.0.1
FREESWITCH_PORT=8021
FREESWITCH_SECRET=JambonzR0ck$

# ====================================
# FreePBX / SIP Configuration
# ====================================

SIP_DOMAIN=$FREEPBX_IP
SIP_REGISTRAR=$FREEPBX_IP

# For FreePBX, Auth ID is usually the same as Extension
SIP_EXTENSION=$EXTENSION
SIP_AUTH_ID=$EXTENSION
SIP_PASSWORD=$PASSWORD

# ====================================
# API Keys (Preserved)
# ====================================
OPENAI_API_KEY=$OPENAI_KEY
ELEVENLABS_API_KEY=$ELEVEN_KEY
GEMINI_API_URL=${GEMINI_URL:-http://127.0.0.1:3333}

# ====================================
# Application Settings
# ====================================
HTTP_PORT=3434
WS_PORT=3001
AUDIO_DIR=/app/audio
EOL

echo ""
echo "✅ Configuration updated for FreePBX!"
echo "   - SIP Domain: $FREEPBX_IP"
echo "   - Extension:  $EXTENSION"
echo "   - Auth ID:    $EXTENSION"
echo ""
echo "🔄 Restarting services..."
npm run start

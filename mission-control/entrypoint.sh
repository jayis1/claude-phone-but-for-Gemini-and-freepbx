#!/bin/bash
set -e

echo "🚀 Starting Mission Control..."
echo "=================================="
echo "📡 Networking Info:"
echo "   - External IP: ${EXTERNAL_IP:-'Not Set'}"
echo "   - Port:        ${PORT:-3030}"
echo "   - API Server:  ${API_SERVER_URL:-'Not Set'}"
echo "   - Voice App:   ${VOICE_APP_URL:-'Not Set'}"
echo "=================================="

exec node server.js

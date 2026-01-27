#!/bin/sh
set -e

# This script is used as an ENTRYPOINT to make 'docker ps' output
# more descriptive by showing the service name in the COMMAND column.

if [ "$1" = "gemini-phone-gemini-api-server" ]; then
    echo "🚀 Starting Gemini API Server (Hands)..."
    exec node server.js
fi

exec "$@"

#!/bin/sh
set -e

# This script is used as an ENTRYPOINT to make 'docker ps' output
# more descriptive by showing the service name in the COMMAND column.

if [ "$1" = "gemini-phone-inference-server" ]; then
    echo "🚀 Starting Inference Server (Brain)..."
    exec node server.js
fi

exec "$@"

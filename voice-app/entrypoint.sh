#!/bin/sh
set -e

# This script is used as an ENTRYPOINT to make 'docker ps' output
# more descriptive by showing the service name in the COMMAND column.

if [ "$1" = "gemini-phone-voice-app" ]; then
    echo "🚀 Starting Gemini Phone Voice App..."
    exec node index.js
fi

exec "$@"

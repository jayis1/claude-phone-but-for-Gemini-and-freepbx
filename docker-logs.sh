#!/bin/bash

# Configuration
API_URL="https://127.0.0.1:3030/api/logs"
SERVICES=("drachtio" "freeswitch")

echo "Starting Docker Log Forwarder..."

for SERVICE in "${SERVICES[@]}"; do
  echo "Tailing logs for $SERVICE..."
  docker logs -f "$SERVICE" 2>&1 | while read -r line; do
    # Escape special characters for JSON
    ESCAPED_LINE=$(echo "$line" | sed 's/\\/\\\\/g' | sed 's/"/\\"/g' | sed 's/\t/\\t/g')
    
    # Construct JSON payload
    JSON="{\"level\": \"INFO\", \"message\": \"$ESCAPED_LINE\", \"service\": \"$SERVICE\", \"timestamp\": \"$(date -u +"%Y-%m-%dT%H:%M:%S.%3NZ")\"}"
    
    # Post to Mission Control (insecure for self-signed cert)
    curl -k -s -X POST -H "Content-Type: application/json" -d "$JSON" "$API_URL" > /dev/null
  done &
done

wait

#!/bin/bash

# Gemini Phone - Fresh Update Script
# This script performs a hard reset to the latest GitHub code and reinstalls all dependencies.

set -e

echo "[UPDATE] Starting Fresh Update Process..."

# 1. Update Codebase (Force Git Reset)
echo "[UPDATE] Fetching latest code from GitHub..."
git fetch origin
git reset --hard origin/main

# 2. Install Root Dependencies
echo "[UPDATE] Installing root dependencies..."
npm install --silent

# 3. Install Sub-Project Dependencies
echo "[UPDATE] Installing Service Dependencies..."

# List of directories containing package.json
SERVICES=("cli" "voice-app" "mission-control" "gemini-api-server" "inference-server")

for service in "${SERVICES[@]}"; do
  if [ -d "$service" ]; then
    echo "[UPDATE] Installing dependencies for $service..."
    cd "$service"
    npm install --silent
    cd ..
  fi
done

# 4. Re-link CLI (optional but good practice)
echo "[UPDATE] Re-linking CLI..."
cd cli
npm link --force
cd ..

echo "[UPDATE] Update Complete! Please restart services."

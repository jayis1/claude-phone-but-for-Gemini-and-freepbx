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

# 3.5 Check for Global Gemini CLI
if ! command -v gemini &> /dev/null; then
  echo "[UPDATE] Gemini CLI missing. Installing..."
  npm install -g @google/gemini-cli
else
  echo "[UPDATE] Gemini CLI found."
fi

# 4. Repair Permissions & Symlinks
echo "[UPDATE] Verifying permissions..."
chmod +x cli/bin/gemini-phone.js

# Re-link binary if needed
if [ -d "/usr/local/bin" ] && [ ! -f "/usr/local/bin/gemini-phone" ]; then
    echo "[UPDATE] Restoring global symlink..."
    ln -sf "$(pwd)/cli/bin/gemini-phone.js" "/usr/local/bin/gemini-phone" || echo "[WARN] Failed to link binary (permission denied?)"
elif [ -d "$HOME/.local/bin" ] && [ ! -f "$HOME/.local/bin/gemini-phone" ]; then
     echo "[UPDATE] Restoring user symlink..."
     ln -sf "$(pwd)/cli/bin/gemini-phone.js" "$HOME/.local/bin/gemini-phone"
fi

# 5. Success message
echo "[UPDATE] Update Complete! Please restart services."

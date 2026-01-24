#!/bin/bash
set -e

# Gemini Phone CLI Installer
# Usage: curl -sSL https://raw.githubusercontent.com/jayis1/networkschucks-phone-but-for-gemini/main/install.sh | bash

INSTALL_DIR="$HOME/.gemini-phone-cli"
REPO_URL="https://github.com/jayis1/networkschucks-phone-but-for-gemini.git"

echo "🎯 Gemini Phone CLI Installer"
echo ""

# Detect OS
OS="$(uname -s)"
case "$OS" in
  Darwin*)
    echo "✓ Detected macOS"
    BIN_DIR="/usr/local/bin"
    PKG_MANAGER="brew"
    ;;
  Linux*)
    echo "✓ Detected Linux"
    
    # Check if running as root
    if [ "$(id -u)" -eq 0 ]; then
      BIN_DIR="/usr/local/bin"
      SUDO=""
      echo "  Running as root - installing globally to $BIN_DIR"
    else
      BIN_DIR="$HOME/.local/bin"
      SUDO="sudo"
    fi
    
    mkdir -p "$BIN_DIR"
    # Detect package manager
    if command -v apt-get &> /dev/null; then
      PKG_MANAGER="apt"
    elif command -v dnf &> /dev/null; then
      PKG_MANAGER="dnf"
    elif command -v pacman &> /dev/null; then
      PKG_MANAGER="pacman"
    else
      PKG_MANAGER="unknown"
    fi
    ;;
  *)
    echo "✗ Unsupported OS: $OS"
    exit 1
    ;;
esac

# Function to install Node.js
install_nodejs() {
  echo ""
  echo "📦 Installing Node.js..."
  case "$PKG_MANAGER" in
    apt)
      # Install Node.js 20.x LTS via NodeSource
      if [ -n "$SUDO" ]; then
        curl -fsSL https://deb.nodesource.com/setup_20.x | $SUDO -E bash -
      else
        curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
      fi
      $SUDO apt-get install -y nodejs
      ;;
    dnf)
      $SUDO dnf install -y nodejs npm
      ;;
    pacman)
      $SUDO pacman -S --noconfirm nodejs npm
      ;;
    brew)
      brew install node
      ;;
    *)
      echo "✗ Cannot auto-install Node.js on this system"
      echo "  Install manually from: https://nodejs.org/"
      exit 1
      ;;
  esac
  echo "✓ Node.js installed: $(node -v)"
}

# Function to install Docker
install_docker() {
  echo ""
  echo "📦 Installing Docker..."
  case "$PKG_MANAGER" in
    apt)
      # Install Docker via official script
      curl -fsSL https://get.docker.com | $SUDO sh
      $SUDO usermod -aG docker $USER
      echo "⚠️  You may need to log out and back in for Docker group to take effect"
      ;;
    dnf)
      $SUDO dnf install -y docker
      $SUDO systemctl start docker
      $SUDO systemctl enable docker
      $SUDO usermod -aG docker $USER
      ;;
    pacman)
      $SUDO pacman -S --noconfirm docker
      $SUDO systemctl start docker
      $SUDO systemctl enable docker
      $SUDO usermod -aG docker $USER
      ;;
    brew)
      echo "📦 Docker Desktop required on macOS"
      echo "  Install from: https://www.docker.com/products/docker-desktop"
      echo ""
      read -p "Press Enter after installing Docker Desktop..."
      ;;
    *)
      echo "✗ Cannot auto-install Docker on this system"
      echo "  Install from: https://docs.docker.com/engine/install/"
      exit 1
      ;;
  esac
}

# Function to install git
install_git() {
  echo ""
  echo "📦 Installing git..."
  case "$PKG_MANAGER" in
    apt)
      $SUDO apt-get update && $SUDO apt-get install -y git
      ;;
    dnf)
      $SUDO dnf install -y git
      ;;
    pacman)
      $SUDO pacman -S --noconfirm git
      ;;
    brew)
      brew install git
      ;;
    *)
      echo "✗ Cannot auto-install git"
      exit 1
      ;;
  esac
  echo "✓ Git installed"
}

echo ""
echo "Checking prerequisites..."
echo ""

# Check git
if ! command -v git &> /dev/null; then
  echo "✗ Git not found"
  read -p "  Install git automatically? (Y/n) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Nn]$ ]]; then
    install_git
  else
    exit 1
  fi
else
  echo "✓ Git installed"
fi

# Check Node.js
if ! command -v node &> /dev/null; then
  echo "✗ Node.js not found"
  read -p "  Install Node.js automatically? (Y/n) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Nn]$ ]]; then
    install_nodejs
  else
    echo "  Install manually from: https://nodejs.org/"
    exit 1
  fi
else
  NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
  if [ "$NODE_VERSION" -lt 18 ]; then
    echo "✗ Node.js 18+ required (found v$NODE_VERSION)"
    read -p "  Upgrade Node.js automatically? (Y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Nn]$ ]]; then
      install_nodejs
    else
      exit 1
    fi
  else
    echo "✓ Node.js $(node -v)"
  fi
fi

# Check Docker
if ! command -v docker &> /dev/null; then
  echo "✗ Docker not found"
  read -p "  Install Docker automatically? (Y/n) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Nn]$ ]]; then
    install_docker
  else
    echo "  Install from: https://docs.docker.com/engine/install/"
    exit 1
  fi
else
  echo "✓ Docker installed"
fi

# Check Docker permissions (Linux only)
if [ "$OS" = "Linux" ]; then
  if ! docker info &> /dev/null 2>&1; then
    echo "⚠️  Docker permission issue"
    echo "  Adding user to docker group..."
    $SUDO usermod -aG docker $USER
    echo "  ⚠️  You need to log out and back in, OR run: newgrp docker"
    echo ""
    read -p "Continue anyway? (Y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Nn]$ ]]; then
      exit 1
    fi
  fi
fi

# Check Gemini CLI (optional - only needed for API server)
if ! command -v gemini &> /dev/null; then
  echo "⚠️  Gemini CLI not found (needed for API server only)"
  echo "  Install from: https://geminicli.com/docs/get-started/installation/"
else
  echo "✓ Gemini CLI installed"
fi

# Clone or update repository
echo ""
if [ -d "$INSTALL_DIR" ]; then
  echo "Updating existing installation..."
  cd "$INSTALL_DIR"
  git pull origin main
else
  echo "Cloning Gemini Phone..."
  git clone "$REPO_URL" "$INSTALL_DIR"
  cd "$INSTALL_DIR"
fi

# Install CLI dependencies
echo ""
echo "Installing dependencies..."
cd "$INSTALL_DIR/cli"
npm install --silent --production

# Create symlink
echo ""
if [ -L "$BIN_DIR/gemini-phone" ]; then
  rm "$BIN_DIR/gemini-phone"
fi

# Ensure executable permissions
chmod +x "$INSTALL_DIR/cli/bin/gemini-phone.js"

if [ "$OS" = "Linux" ]; then
  ln -s "$INSTALL_DIR/cli/bin/gemini-phone.js" "$BIN_DIR/gemini-phone"
  echo "✓ Installed to: $BIN_DIR/gemini-phone"

  if [[ ":$PATH:" != *":$HOME/.local/bin:"* ]]; then
    echo ""
    echo "⚠️  Adding $HOME/.local/bin to PATH..."
    
    # Detect shell and update appropriate config
    USER_SHELL=$(basename "$SHELL")
    case "$USER_SHELL" in
      fish)
        mkdir -p ~/.config/fish
        echo 'set -Ua fish_user_paths "$HOME/.local/bin"' >> ~/.config/fish/config.fish
        echo "✓ Updated ~/.config/fish/config.fish"
        ;;
      zsh)
        echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.zshrc
        echo "✓ Updated ~/.zshrc"
        ;;
      *)
        echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
        echo "✓ Updated ~/.bashrc"
        ;;
    esac
    
    export PATH="$HOME/.local/bin:$PATH"
  fi
else
  if [ -w "$BIN_DIR" ]; then
    ln -s "$INSTALL_DIR/cli/bin/gemini-phone.js" "$BIN_DIR/gemini-phone"
  else
    sudo ln -s "$INSTALL_DIR/cli/bin/gemini-phone.js" "$BIN_DIR/gemini-phone"
  fi
  echo "✓ Installed to: $BIN_DIR/gemini-phone"
fi

echo ""
echo "════════════════════════════════════════════"
echo "✓ Installation complete!"
echo "════════════════════════════════════════════"
echo ""
echo "Next steps:"
echo "  gemini-phone setup    # Configure your installation"
echo "  gemini-phone start    # Launch services"
echo ""

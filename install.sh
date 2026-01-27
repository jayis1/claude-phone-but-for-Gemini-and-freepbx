#!/bin/bash
set -e

# Gemini Phone CLI Installer
# Usage: curl -sSL https://raw.githubusercontent.com/jayis1/claude-phone-but-for-Gemini-and-freepbx/v2.2.74/install.sh | bash










main() {
  # Capture where we started, so we can find .env files
  START_DIR="$(pwd)"

  # READ .ENV FIRST: Before we cd or wipe anything
  GEMINI_KEY=""
  ENV_FILE=""
  if [ -f "$START_DIR/.env" ]; then
    ENV_FILE="$START_DIR/.env"
  elif [ -f "$HOME/.env" ]; then
    ENV_FILE="$HOME/.env"
  fi

  if [ -n "$ENV_FILE" ]; then
    # We use a temp var here so we don't accidentally export it yet
    DETECTED_KEY=$(grep "^GEMINI_API_KEY=" "$ENV_FILE" | cut -d '=' -f2- | tr -d '"' | tr -d "'")
    if [ -n "$DETECTED_KEY" ]; then
      echo "✓ Found GEMINI_API_KEY in .env"
      GEMINI_KEY="$DETECTED_KEY"
    fi
  fi

  # Ensure we are in a safe directory (HOME) to avoid CWD deletion errors
  cd "$HOME" || exit 1

  INSTALL_DIR="$HOME/.gemini-phone-cli"

  REPO_URL="https://github.com/jayis1/claude-phone-but-for-Gemini-and-freepbx.git"

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

  # Check disk space (Linux only)
  if [ "$OS" = "Linux" ]; then
    echo ""
    echo "🔍 Checking disk space..."
    # Get available space in KB for the root filesystem
    AVAILABLE_KB=$(df -k / | awk 'NR==2 {print $4}')
    REQUIRED_KB=$((30 * 1024 * 1024)) # 30GB in KB
    
    if [ "$AVAILABLE_KB" -lt "$REQUIRED_KB" ]; then
      AVAILABLE_GB=$(echo "scale=1; $AVAILABLE_KB / 1024 / 1024" | bc 2>/dev/null || echo "$((AVAILABLE_KB / 1024 / 1024))")
      echo "✗ Insufficient disk space: ${AVAILABLE_GB}GB available, 30GB required."
      echo "  Starting Docker containers and pulling images requires significant space."
      echo "  Please free up space and try again."
      exit 1
    fi
    echo "✓ Disk space OK"
  fi

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
    
    # Update npm to latest (since it comes with Node)
    echo "📦 Updating npm to latest..."
    if [ -w "$(npm root -g)" ]; then
      npm install -g npm@latest
    else
      $SUDO npm install -g npm@latest
    fi
    echo "✓ npm updated: $(npm -v)"
  }

  # Function to install npm (for systems where it's separate)
  install_npm() {
    echo ""
    echo "📦 Installing npm..."
    case "$PKG_MANAGER" in
      apt)
        $SUDO apt-get install -y npm
        ;;
      dnf)
        $SUDO dnf install -y npm
        ;;
      pacman)
        $SUDO pacman -S --noconfirm npm
        ;;
      *)
        echo "✗ Cannot auto-install npm on this system"
        echo "  Install manually: https://docs.npmjs.com/downloading-and-installing-node-js-and-npm"
        exit 1
        ;;
    esac
    echo "✓ npm installed: $(npm -v)"
    
    # Update npm to latest
    echo "📦 Updating npm to latest..."
    if [ -w "$(npm root -g)" ]; then
      npm install -g npm@latest
    else
      $SUDO npm install -g npm@latest
    fi
    echo "✓ npm updated: $(npm -v)"
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
        if [ -c /dev/tty ]; then
          read -p "Press Enter after installing Docker Desktop..." < /dev/tty
        else
          echo "Non-interactive: Please ensure Docker Desktop is installed."
        fi
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
    echo "✗ Git not found, installing..."
    install_git
  else
    echo "✓ Git installed"
  fi

  # Check Node.js
  if ! command -v node &> /dev/null; then
    echo "✗ Node.js not found, installing..."
    install_nodejs
  else
    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 18 ]; then
      echo "✗ Node.js 18+ required (found v$NODE_VERSION), upgrading..."
      install_nodejs
    else
      echo "✓ Node.js $(node -v)"
    fi
  fi

  # Check npm (sometimes separate from nodejs on Linux)
  if ! command -v npm &> /dev/null; then
    echo "✗ npm not found (but Node.js is installed), installing..."
    install_npm
  else
    echo "✓ npm $(npm -v)"
  fi

  # Check Docker
  if ! command -v docker &> /dev/null; then
    echo "✗ Docker not found, installing..."
    install_docker
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
      echo "  ⚠️  You need to log out and back in, OR run: newgrp docker"
      echo ""
      
      # FIX: Read from /dev/tty to avoid consuming script stdin when piped
      if [ -c /dev/tty ]; then
        read -p "Continue anyway? (Y/n) " -n 1 -r REPLY < /dev/tty
        echo ""
      else
        echo "Non-interactive: Continuing automatically..."
        REPLY="y"
      fi

      if [[ "$REPLY" =~ ^[Nn]$ ]]; then
        exit 1
      fi
    fi
  fi

  # Clone or update repository
  echo ""
  if [ -d "$INSTALL_DIR" ]; then
    echo "Updating existing installation..."
    
    # Backup .env if it exists inside the install dir
    if [ -f "$INSTALL_DIR/.env" ]; then
      cp "$INSTALL_DIR/.env" "/tmp/gemini-phone.env.backup"
      HAS_BACKUP=true
    else
      HAS_BACKUP=false
    fi

    cd "$INSTALL_DIR"
    git fetch origin main
    git reset --hard origin/main
    
    # Restore .env
    if [ "$HAS_BACKUP" = true ]; then
      cp "/tmp/gemini-phone.env.backup" "$INSTALL_DIR/.env"
      echo "✓ Restored existing .env configuration"
    fi
  else
    echo "Cloning Gemini Phone..."
    git clone "$REPO_URL" "$INSTALL_DIR"
    cd "$INSTALL_DIR"
  fi

  # Install CLI dependencies
  echo ""
  echo "Installing dependencies..."
  cd "$INSTALL_DIR/cli"

  # Final check for npm before running it
  if ! command -v npm &> /dev/null; then
    echo "⚠️  npm missing (required for dependencies)"
    install_npm
  fi

  npm install --silent --production

  # Install API Server dependencies
  echo ""
  echo "Installing API Server dependencies..."
  cd "$INSTALL_DIR/gemini-api-server"
  npm install --silent --production

  # Install Inference Server dependencies
  echo ""
  echo "Installing Inference Server dependencies..."
  cd "$INSTALL_DIR/inference-server"
  npm install --silent --production

  # Install Mission Control dependencies
  echo ""
  echo "Installing Mission Control dependencies..."
  cd "$INSTALL_DIR/mission-control"
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

  # Setup Gemini API Key
  # (GEMINI_KEY was detected at start of script from .env)

  if [ -n "$GEMINI_KEY" ]; then
    echo ""
    echo "Using GEMINI_API_KEY found in .env..."
    
    # Detect shell to update
    USER_SHELL=$(basename "$SHELL")
    
    case "$USER_SHELL" in
      fish)
        mkdir -p ~/.config/fish
        echo "set -Ux GEMINI_API_KEY \"$GEMINI_KEY\"" >> ~/.config/fish/config.fish
        echo "✓ Added to ~/.config/fish/config.fish"
        ;;
      zsh)
        echo "export GEMINI_API_KEY=\"$GEMINI_KEY\"" >> ~/.zshrc
        echo "✓ Added to ~/.zshrc"
        ;;
      *)
        echo "export GEMINI_API_KEY=\"$GEMINI_KEY\"" >> ~/.bashrc
        echo "✓ Added to ~/.bashrc"
        ;;
    esac
    
    # Export for current session just in case
    export GEMINI_API_KEY="$GEMINI_KEY"
  fi

  echo ""
  echo "Next steps:"
  echo "  gemini-phone setup    # Configure your installation"
  echo "  gemini-phone start    # Launch services"
  echo ""
}

# Run main function
main "$@"

FROM node:20-slim

WORKDIR /app

# Install dependencies
COPY package.json ./
RUN npm install

# Install Docker CLI for health checks
RUN apt-get update && apt-get install -y docker.io && rm -rf /var/lib/apt/lists/*

# Install Gemini CLI for terminal bridge
RUN npm install -g @google/gemini-cli

# Copy source
COPY . .

# Create data directory for notes
RUN mkdir -p data

# Expose port
EXPOSE 3030

# Entrypoint script
COPY entrypoint.sh .
RUN chmod +x entrypoint.sh

# Start server via entrypoint
ENTRYPOINT ["./entrypoint.sh"]

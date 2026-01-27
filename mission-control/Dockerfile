FROM node:20-slim

WORKDIR /app

# Install dependencies
RUN apt-get update && apt-get install -y procps && rm -rf /var/lib/apt/lists/*
COPY package.json ./
RUN npm install



# Install Gemini CLI for terminal bridge
RUN npm install -g @google/gemini-cli@latest

# Copy source
COPY . .

# Create data directory for notes
RUN mkdir -p data

# Expose port
EXPOSE 3030

# Entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Start server via entrypoint
ENTRYPOINT ["/entrypoint.sh"]
CMD ["gemini-phone-mission-control"]


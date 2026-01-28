# Build stage
FROM node:20-slim

WORKDIR /app
ENV DEBIAN_FRONTEND=noninteractive

# Install system dependencies only once
RUN apt-get update && apt-get install -y --no-install-recommends \
    apt-utils \
    procps \
    docker.io \
    && rm -rf /var/lib/apt/lists/*

# Install dependencies first (better caching)
COPY package.json ./
RUN npm install --production

# Copy source
COPY . .

# Create data directory
RUN mkdir -p data

# Expose port
EXPOSE 3030

# Entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Start server via entrypoint
ENTRYPOINT ["/entrypoint.sh"]
CMD ["gemini-phone-mission-control"]


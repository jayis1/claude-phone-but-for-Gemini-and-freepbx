FROM us-docker.pkg.dev/gemini-code-dev/gemini-cli/sandbox:0.1.1

# The sandbox image is optimized for running the CLI.
# We need to add our API server wrapper on top.

# Ensure we have permissions to write to /app
USER root
WORKDIR /app

# Copy package definition
COPY package.json ./

# Install express (the only dependency for the wrapper)
# We assume npm is available since Gemini CLI is a Node.js tool
RUN npm install

# Copy application code
COPY server.js structured.js ./

# Expose the API port
EXPOSE 3333

# Start the wrapper server
# Entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
CMD ["gemini-phone-gemini-api-server"]

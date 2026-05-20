# Use Node.js 18 Alpine (lightweight)
FROM node:18-alpine

# Install Python, pip, ffmpeg, and Deno for yt-dlp YouTube JS challenges
RUN apk add --no-cache \
    python3 \
    py3-pip \
    ffmpeg \
    curl \
    unzip \
    && ln -sf python3 /usr/bin/python \
    && curl -fsSL https://deno.land/install.sh | DENO_INSTALL=/usr/local sh

# Install yt-dlp with default extras (EJS solver dependencies)
RUN python3 -m pip install --no-cache-dir --break-system-packages "yt-dlp[default]"

# Verify installations
RUN node --version && \
    python3 --version && \
    deno --version && \
    yt-dlp --version && \
    ffmpeg -version

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install Node.js dependencies
RUN npm ci --only=production

# Copy application files
COPY . .

# Create downloads directory
RUN mkdir -p downloads

# Expose port
EXPOSE 3001

# Start the application
CMD ["node", "server.js"]

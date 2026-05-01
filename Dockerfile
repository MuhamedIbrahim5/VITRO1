# Use Node.js 18 Alpine (lightweight)
FROM node:18-alpine

# Install Python, pip, ffmpeg, and other dependencies
RUN apk add --no-cache \
    python3 \
    py3-pip \
    ffmpeg \
    && ln -sf python3 /usr/bin/python

# Install yt-dlp using pip
RUN python3 -m pip install --no-cache-dir --break-system-packages yt-dlp

# Verify installations
RUN node --version && \
    python3 --version && \
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

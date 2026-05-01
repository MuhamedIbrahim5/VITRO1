# Use Node.js 18 Alpine (lightweight)
FROM node:18-alpine

# Install Python, pip, and ffmpeg (required for yt-dlp)
RUN apk add --no-cache python3 py3-pip ffmpeg

# Install yt-dlp
RUN pip3 install --no-cache-dir yt-dlp

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install Node.js dependencies
RUN npm install --production

# Copy application files
COPY . .

# Create downloads directory
RUN mkdir -p downloads

# Expose port
EXPOSE 3001

# Start the application
CMD ["node", "server.js"]

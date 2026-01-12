FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy built files
COPY dist/ ./dist/

# Set environment variables (will be overridden by Smithery)
ENV NODE_ENV=production

# Run the server
CMD ["node", "dist/index.js"]

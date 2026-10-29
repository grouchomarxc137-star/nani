FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
COPY server/package.json server/package.json
COPY web/package.json web/package.json
COPY server/prisma.config.ts server/prisma.config.ts
COPY server/prisma server/prisma
RUN npm ci --include=dev
COPY . .
RUN npm run build
ENV NODE_ENV=production
CMD ["npm", "run", "start:prod"]

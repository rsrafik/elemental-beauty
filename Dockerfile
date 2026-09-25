# One image, one process: Express serves the API under /api and the statically
# exported Next.js frontend from public/ (see src/server.js).
#
#   docker build -t elemental-beauty .
#   docker run -p 5003:5003 --env-file .env.production elemental-beauty
#
# Needs DATABASE_URL, JWT_SECRET, QR_SECRET, APP_URL and a mail setup
# (GMAIL_USER + GMAIL_APP_PASSWORD, or RESEND_API_KEY) at run time — the server
# refuses to start in production without them. Migrations are applied on boot.

# ---- the frontend, built to static files ------------------------------------
FROM node:22-slim AS frontend
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ---- the server -------------------------------------------------------------
FROM node:22-slim
# Prisma's migration engine links against OpenSSL
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app

COPY package.json package-lock.json ./
# dev dependencies too: prisma.config.ts reads dotenv, and `migrate deploy`
# runs on every boot
RUN npm ci
COPY prisma.config.ts ./
COPY prisma ./prisma
RUN npx prisma generate
COPY src ./src
COPY scripts ./scripts
COPY --from=frontend /app/frontend/out ./public

ENV NODE_ENV=production
ENV PORT=5003
EXPOSE 5003
USER node
CMD ["sh", "-c", "npx prisma migrate deploy && node --experimental-strip-types src/server.js"]

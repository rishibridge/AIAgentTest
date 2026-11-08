# Continuity — PrEP Navigator console, for Google Cloud Run.
# Uses Firestore for storage (selected automatically: Cloud Run sets K_SERVICE).
FROM node:22-slim

WORKDIR /app

# Install production dependencies first for better layer caching.
COPY package.json ./
RUN npm install --omit=dev

# App source.
COPY server.mjs seed.mjs ./
COPY store ./store
COPY public ./public

# Cloud Run provides PORT (default 8080) and sets K_SERVICE, which makes the
# server select the Firestore adapter automatically.
ENV NODE_ENV=production
EXPOSE 8080

# --experimental-sqlite is harmless when Firestore is selected; it keeps the
# same entrypoint working for a local SQLite run too.
CMD ["node", "--experimental-sqlite", "server.mjs"]

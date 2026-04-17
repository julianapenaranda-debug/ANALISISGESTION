FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
COPY packages/shared/package*.json packages/shared/
COPY packages/backend/package*.json packages/backend/
COPY packages/frontend/package*.json packages/frontend/

RUN npm install

COPY packages/shared packages/shared
RUN cd packages/shared && npm run build

COPY packages/backend packages/backend
RUN cd packages/backend && npm run build

COPY packages/frontend packages/frontend
RUN cd packages/frontend && npm run build

FROM node:20-alpine AS runner
WORKDIR /app

COPY --from=builder /app/packages/backend/dist packages/backend/dist
COPY --from=builder /app/packages/backend/package*.json packages/backend/
COPY --from=builder /app/packages/backend/node_modules packages/backend/node_modules
COPY --from=builder /app/packages/shared/dist packages/shared/dist
COPY --from=builder /app/packages/shared/package*.json packages/shared/
COPY --from=builder /app/packages/frontend/dist packages/frontend/dist
COPY --from=builder /app/node_modules node_modules
COPY --from=builder /app/package*.json ./

# Serve frontend static files from backend
ENV NODE_ENV=production
ENV PORT=8080

# Start backend (serves API + static frontend)
CMD ["node", "packages/backend/dist/index.js"]

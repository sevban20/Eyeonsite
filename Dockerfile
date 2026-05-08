FROM node:22-alpine AS builder

WORKDIR /app
RUN apk add --no-cache openssl
COPY package*.json ./
RUN npm install
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:22-alpine
WORKDIR /app
RUN apk add --no-cache openssl
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server.ts ./server.ts

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

# Run migrations and start server
CMD ["sh", "-c", "npx prisma db push --accept-data-loss && npx tsx server.ts"]

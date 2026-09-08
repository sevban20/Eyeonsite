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
COPY --from=builder /app/lib ./lib

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

# Bekleyen migration'lari uygula ve sunucuyu baslat.
#
# Onceden burada `prisma db push --accept-data-loss` vardi. O komut semayi
# veritabanina zorla dayatir ve ADINDAN ANLASILACAGI UZERE veri kaybini pesinen
# kabul eder: ornegin bir kolon yeniden adlandirildiginda bunu "eskisini dusur,
# yenisini ekle" olarak yorumlar ve icindeki musteri verisini sessizce siler.
# `migrate deploy` ise yalnizca prisma/migrations altindaki, gozden gecirilmis
# ve commit'lenmis SQL dosyalarini sirayla uygular; kendiliginden hicbir sey
# dusurmez ve uygulanmis migration'lari _prisma_migrations tablosunda tutar.
CMD ["sh", "-c", "npx prisma migrate deploy && npx tsx server.ts"]

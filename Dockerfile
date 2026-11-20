FROM node:22-alpine AS base
WORKDIR /app

# Prisma'nın schema/migration motoru icin gerekli (alpine'da varsayilan yok)
# postgresql-client: ham SQL migration dosyasini (migrations/001_init.sql) uygulamak icin
RUN apk add --no-cache openssl postgresql-client

# Bağımlılıkları önce kopyala (cache optimizasyonu)
COPY package*.json ./
COPY prisma ./prisma/

# Üretim bağımlılıklarını yükle
RUN npm ci --omit=dev

# Prisma istemcisini üret
RUN npx prisma generate

# Kaynak kodu kopyala
COPY src ./src
COPY migrations ./migrations/

# Kullanıcı oluştur (root olarak çalışma)
RUN addgroup -g 1001 -S nodejs && \
    adduser  -S operio -u 1001 && \
    chown -R operio:nodejs /app

USER operio

EXPOSE 4000

CMD ["node", "src/server.js"]

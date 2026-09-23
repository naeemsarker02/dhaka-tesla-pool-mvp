FROM node:20-alpine

# Prisma's query/schema engine binaries dynamically link against OpenSSL, which node:20-alpine
# does not ship by default — without it, the engine fails to start and Prisma can't parse its
# (non-JSON) error output ("Could not parse schema engine response... is not valid JSON"),
# breaking `prisma migrate deploy`/`prisma generate` at container runtime. Prisma's own CLI warning
# says exactly this: "Please manually install OpenSSL and try installing Prisma again."
RUN apk add --no-cache openssl

WORKDIR /app

COPY package*.json ./
# prisma (the CLI) is a regular dependency here, not dev-only — docker-entrypoint.sh needs it at
# container runtime to apply migrations/seed on startup.
RUN npm install --omit=dev

COPY . .

RUN npx prisma generate

RUN chmod +x docker-entrypoint.sh

EXPOSE 4000

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "src/server.js"]

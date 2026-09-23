FROM node:20-alpine

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

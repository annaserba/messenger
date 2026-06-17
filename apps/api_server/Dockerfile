FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --production

COPY src/ src/

ENV PORT=3000
EXPOSE 3000

CMD ["node", "src/server.ts"]

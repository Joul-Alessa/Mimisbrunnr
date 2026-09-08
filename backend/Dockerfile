FROM node:20-alpine

WORKDIR /app

# Install dependencies first for better layer caching.
COPY package*.json ./
RUN npm install --omit=dev

COPY . .

ENV PORT=3000
ENV DB_PATH=/app/data/mimisbrunnr.sqlite

EXPOSE 3000

CMD ["node", "src/server.js"]

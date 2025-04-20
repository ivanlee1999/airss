# Dockerfile for UI
FROM node:18
WORKDIR /app
COPY ui/package*.json ./
RUN npm install
COPY ui ./
COPY public ./public
EXPOSE 3000
CMD ["node", "server.js"]

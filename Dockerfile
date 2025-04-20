# Multi-service Dockerfile for airss (API, UI, Worker)
FROM node:18
WORKDIR /app
COPY package*.json ./
COPY ui/package*.json ./ui/
RUN npm install && cd ui && npm install && cd ..
COPY . .
EXPOSE 3000 3001
# No default CMD: docker-compose will set it per service

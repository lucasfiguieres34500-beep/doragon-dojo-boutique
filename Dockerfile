FROM node:20-alpine

WORKDIR /app

# Dépendances de production
COPY package*.json ./
RUN npm install --omit=dev

# Code source et fichiers du projet
COPY . .

# Configuration de l'environnement Koyeb
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=8000

EXPOSE 8000

CMD ["node", "server.js"]

FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

EXPOSE 2222

ENV NODE_ENV=production
ENV SSH_PORT=2222
ENV BACKEND_URL=http://backend:5000

CMD ["node", "server.js"]

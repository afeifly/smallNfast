FROM node:18-bullseye
WORKDIR /usr/app
COPY package*.json ./
RUN npm install --legacy-peer-deps
COPY . .
RUN npm run build
CMD ["node", "server/index.js"]

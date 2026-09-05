FROM node:16
RUN mkdir -p /usr/app/client
WORKDIR /usr/app/client
COPY client/package*.json ./
RUN npm install
COPY client .
RUN npm run build

RUN mkdir -p /usr/app/tmpfolder
WORKDIR /usr/app
COPY package*.json ./
RUN npm install
COPY . .
CMD node server.js 


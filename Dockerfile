FROM node:10.16.0-alpine

WORKDIR /app

ADD . /app

RUN npm install

ENTRYPOINT [ "npm", "start" ]

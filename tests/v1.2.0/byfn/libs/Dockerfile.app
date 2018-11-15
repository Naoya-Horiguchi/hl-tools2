FROM node:carbon

WORKDIR /app

EXPOSE 4000

COPY ./app ./app
COPY ./routes ./routes
COPY ./app.js .
COPY ./package.json .

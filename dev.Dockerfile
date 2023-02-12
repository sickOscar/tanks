FROM node:19-alpine

ENV NODE_ENV=development

WORKDIR /app

VOLUME /app

EXPOSE 3000

CMD ["npm", "run", "dev"]

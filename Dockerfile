FROM node:20-alpine
WORKDIR /app
COPY package.json server.js ./
COPY public ./public
ENV NODE_ENV=production PORT=3000 DATA_DIR=/data
EXPOSE 3000
VOLUME ["/data"]
CMD ["node", "server.js"]

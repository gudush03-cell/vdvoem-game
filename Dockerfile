FROM node:24-bookworm-slim
WORKDIR /app
COPY --chown=node:node app.mjs server.mjs bot.mjs ./
COPY --chown=node:node public ./public
COPY --chown=node:node private ./private
RUN mkdir /app/data && chown node:node /app/data
USER node
ENV PORT=8080 DATABASE_PATH=/app/data/game.sqlite
EXPOSE 8080
CMD ["node","server.mjs"]

FROM node:22-bookworm-slim AS deps

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS build
COPY . .
RUN npm run build

FROM node:22-bookworm-slim AS runtime

WORKDIR /app
ENV NODE_ENV=production
COPY --chown=node:node --from=build /app/package.json /app/package-lock.json ./
COPY --chown=node:node --from=build /app/dist ./dist
COPY --chown=node:node --from=build /app/scripts ./scripts
COPY --chown=node:node --from=build /app/docs ./docs
COPY --chown=node:node --from=build /app/examples ./examples
COPY --chown=node:node --from=build /app/public ./public
COPY --chown=node:node --from=build /app/.env.example ./.env.example
RUN npm ci --omit=dev
RUN mkdir -p /app/data && chown node:node /app/data

EXPOSE 8000
USER node
CMD ["node", "dist/main.js"]

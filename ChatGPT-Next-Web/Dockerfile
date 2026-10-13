FROM node:18-alpine AS base

FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn config set registry 'https://registry.npmmirror.com/'
RUN yarn install --no-optional

FROM base AS builder
RUN apk update && apk add --no-cache git
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . ./
RUN yarn build 2>&1 | tee build.log 
RUN cat build.log
FROM base AS runner
WORKDIR /app
# RUN apk add proxychains-ng  
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/.next/server ./.next/server
RUN ls -la /app
COPY .env .  
COPY .env.local .  
RUN mkdir -p /app/app/mcp && chmod 777 /app/app/mcp
# COPY --from=builder /app/app/mcp/mcp_config.default.default.json /app/app/mcp/mcp_config.json
EXPOSE 3000
CMD ["node", "server.js"] 

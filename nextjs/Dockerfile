# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Stage 2: Production Runner
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV production


# সিকিউরিটির জন্য নন-রুট ইউজার ব্যবহার করা
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# শুধু প্রয়োজনীয় বিল্ড আউটপুট কপি করা (Standalone mode)
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs

EXPOSE 3000
ENV PORT 3000
# CMD ["npm", "start"]
CMD ["node", "server.js"]
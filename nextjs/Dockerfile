# Stage 1: Build
FROM node:20 AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install --legacy-peer-deps && npm install @next/swc-linux-x64-gnu
COPY . .
RUN npm run build

# Stage 2: Production Runner
FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0


# সিকিউরিটির জন্য নন-রুট ইউজার ব্যবহার করা
RUN groupadd --system --gid 1001 nodejs
RUN useradd --system --uid 1001 nextjs

# শুধু প্রয়োজনীয় বিল্ড আউটপুট কপি করা (Standalone mode)
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs

EXPOSE 3000
ENV PORT=3000
# CMD ["npm", "start"]
CMD ["node", "server.js"]
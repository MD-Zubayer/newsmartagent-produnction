FROM node:20-alpine

# Build dependencies
RUN apk add --no-cache python3 make g++ cairo-dev pango-dev git

WORKDIR /app

COPY package.json ./
RUN npm install --production

COPY index.js ./

# Auth folder তৈরি
RUN mkdir -p auth_info_baileys

# Non-root user setup
RUN addgroup -S baileys && adduser -S baileys -G baileys
RUN chown -R baileys:baileys /app

# মাউন্ট করা ভলিউম যেন রাইট করতে পারে সেজন্য ইউজার সুইচ করার আগে এটি নিশ্চিত করুন
USER baileys

EXPOSE 3001

CMD ["node", "index.js"]
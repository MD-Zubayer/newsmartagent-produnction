FROM node:20-alpine

# Build dependencies (sharp, canvas, git dependencies ইত্যাদির জন্য)
RUN apk add --no-cache python3 make g++ cairo-dev pango-dev git

WORKDIR /app

# Dependencies আলাদা layer এ copy করুন (cache optimization)
COPY package.json ./

RUN npm install --production

# Source code copy করুন
COPY index.js ./

# Auth folder তৈরি করুন
RUN mkdir -p auth_info_baileys

# Non-root user
RUN addgroup -S baileys && adduser -S baileys -G baileys
RUN chown -R baileys:baileys /app
USER baileys

EXPOSE 3001

CMD ["node", "index.js"]

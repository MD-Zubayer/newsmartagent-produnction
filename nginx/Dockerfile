FROM nginx:1.25-alpine

# আগের ডিফল্ট কনফিগ মুছে আপনারটা বসানো
RUN rm /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/

# widget.js সরাসরি image এ bake করা
RUN mkdir -p /app/static
COPY widget.js /app/static/widget.js
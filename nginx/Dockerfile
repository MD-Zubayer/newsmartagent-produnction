FROM nginx:1.25-alpine

# আগের ডিফল্ট কনফিগ মুছে আপনারটা বসানো
RUN rm /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/
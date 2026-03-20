FROM nginx:1.25-alpine

# আগের ডিফল্ট কনফিগ মুছে আপনারটা বসানো
RUN rm /etc/nginx/conf.d/default.conf

# ২. আপনার কনফিগটা conf.d ফোল্ডারে কপি করুন (যাতে এটি অটোমেটিক http ব্লকের ভেতরে ঢুকে যায়)
COPY nginx.conf /etc/nginx/conf.d/newsmartagent.conf

# widget.js সরাসরি image এ bake করা
RUN mkdir -p /app/widget
COPY widget.js /app/widget/widget.js
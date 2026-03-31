// app/robots.js

export default function robots() {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/dashboard"],
      },
    ],
    sitemap: `${process.env.NEXT_PUBLIC_BASE_URL || "https://newsmartagent.com"}/sitemap.xml`,
  };
}
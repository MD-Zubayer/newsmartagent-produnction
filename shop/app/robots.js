import { SITE } from "@/lib/site";

export default function robots() {
  return {
    rules: [{ userAgent: "*", allow: ["/", "/privacy", "/terms"], disallow: ["/c/", "/account", "/orders", "/checkout"] }],
    host: SITE.url,
  };
}

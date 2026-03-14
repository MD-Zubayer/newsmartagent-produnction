// app/sitemap.js

export default async function sitemap() {
  const baseUrl = "https://newsmartagent.com";

  // ১. আপনার ব্যাকএন্ড থেকে ব্লগ পোস্টগুলো নিয়ে আসার চেষ্টা করুন
  let blogPosts = [];
  try {
    const response = await fetch(`${baseUrl}/api/blog/`, { cache: 'no-store' });
    const data = await response.json();
    blogPosts = Array.isArray(data) ? data : [];
  } catch (error) {
    console.error("Sitemap: Failed to fetch blog posts", error);
  }

  // ২. ব্লগ পোস্টগুলোর জন্য সাইটম্যাপ অবজেক্ট তৈরি করুন
  const blogUrls = blogPosts.map((post) => ({
    url: `${baseUrl}/blog/${post.slug}`,
    lastModified: new Date(post.updated_at || new Date()),
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  // ৩. আপনার স্ট্যাটিক পেজগুলো
  const staticUrls = [
    {
      url: `${baseUrl}`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${baseUrl}/blog`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/docs`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/services`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/about`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.6,
    },
    {
      url: `${baseUrl}/contact`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.6,
    },
    {
      url: `${baseUrl}/signup`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/dashboard`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.5,
    },
  ];

  // সব ইউআরএল একসাথে করে রিটার্ন করুন
  return [...staticUrls, ...blogUrls];
}
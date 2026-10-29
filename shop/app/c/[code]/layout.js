export async function generateMetadata({ params }) {
  const { code } = (await params) || {};
  if (!code) return {};

  const backendUrl = process.env.INTERNAL_API_URL || 'http://backend:8000/api';
  let ogData = null;

  try {
    const res = await fetch(`${backendUrl}/storefront/v1/og/${code}/`, {
      cache: 'no-store'
    });
    if (res.ok) {
      ogData = await res.json();
    }
  } catch (err) {
    console.error('Error fetching OG metadata in Next.js layout:', err);
  }

  const shopName = ogData?.shop_name || 'Smart Shop';
  const title = ogData?.title || `🛒 ${shopName} থেকে অর্ডার কনফার্ম করুন`;
  const description = ogData?.description || '১-ক্লিকে গুগল সাইন ইন ও ক্যাশ অন ডেলিভারিতে অর্ডার নিশ্চিত করুন।';
  const imageUrl = ogData?.image_url;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      siteName: shopName,
      type: 'website',
      images: imageUrl ? [{ url: imageUrl, width: 800, height: 600, alt: title }] : []
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: imageUrl ? [imageUrl] : []
    }
  };
}

export default function CheckoutCodeLayout({ children }) {
  return children;
}

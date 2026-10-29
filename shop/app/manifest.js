export default function manifest() {
  return {
    name: 'Smart Customer App - Order & Tracking',
    short_name: 'SmartShop',
    description: 'Track orders, manage addresses, and one-click checkout across smart merchant stores',
    start_url: '/',
    display: 'standalone',
    background_color: '#0b0f19',
    theme_color: '#4f46e5',
    orientation: 'portrait',
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  };
}

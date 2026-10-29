const SELLER_HISTORY_KEY = 'smartshop-seller-history-v1';
const MAX_SELLERS = 8;

function stableSellerLogo(id, fallback = null) {
  if (!/^\d+$/.test(String(id || ''))) return fallback;
  const apiBase = process.env.NEXT_PUBLIC_API_URL || '/api';
  return apiBase.replace(/\/$/, '') + '/storefront/v1/merchant-avatar/' + id + '/';
}

function sellerKey(session) {
  return String(session?.merchant_id || session?.merchant_shop_name || session?.merchant_name || 'smartshop').trim().toLowerCase();
}

export function sellerFromSession(session, sessionCode = null) {
  if (!session) return null;
  return {
    id: sellerKey(session),
    name: session.merchant_shop_name || session.merchant_name || 'SmartShop',
    logo: stableSellerLogo(session.merchant_id, session.merchant_avatar),
    lastSeen: Date.now(),
    sessionCode: sessionCode || null,
  };
}

export function readSellerHistory() {
  if (typeof window === 'undefined') return [];
  try {
    const data = JSON.parse(window.localStorage.getItem(SELLER_HISTORY_KEY) || '[]');
    return Array.isArray(data) ? data.filter((seller) => seller?.name).slice(0, MAX_SELLERS).map((seller) => ({
      ...seller,
      logo: stableSellerLogo(seller.id, seller.logo),
    })) : [];
  } catch (e) {
    return [];
  }
}

export function rememberSeller(session, sessionCode = null) {
  const seller = sellerFromSession(session, sessionCode);
  if (!seller || typeof window === 'undefined') return readSellerHistory();

  const history = readSellerHistory().filter((item) => item.id !== seller.id);
  const next = [seller, ...history].slice(0, MAX_SELLERS);
  try {
    window.localStorage.setItem(SELLER_HISTORY_KEY, JSON.stringify(next));
  } catch (e) {}
  return next;
}


export function sellersFromApi(items) {
  if (!Array.isArray(items)) return [];
  return items
    .filter((item) => item?.merchant_id && item?.name)
    .map((item) => ({
      id: String(item.merchant_id),
      name: item.name,
      logo: stableSellerLogo(item.merchant_id, item.logo),
      lastSeen: item.last_seen_at ? Date.parse(item.last_seen_at) : Date.now(),
      orderCount: Number(item.order_count || 0),
    }));
}

export function mergeSellerHistories(primary = [], secondary = []) {
  const merged = [];
  [...primary, ...secondary].forEach((seller) => {
    if (!seller?.id || merged.some((item) => item.id === seller.id)) return;
    merged.push(seller);
  });
  return merged.slice(0, MAX_SELLERS);
}

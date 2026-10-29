function getApiBase() {
  const envUrl = process.env.NEXT_PUBLIC_API_URL;
  if (envUrl && envUrl.startsWith('http') && !envUrl.startsWith('https:///')) {
    return envUrl;
  }
  return '/api';
}

export function getStorefrontUrl(endpoint) {
  const apiBase = getApiBase();
  return endpoint.startsWith('http')
    ? endpoint
    : `${apiBase}/storefront/v1${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
}

export async function fetchStorefront(endpoint, options = {}) {
  const apiBase = getApiBase();
  const url = endpoint.startsWith('http') ? endpoint : `${apiBase}/storefront/v1${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include', // sends customer_token cookie
  });

  const contentType = response.headers.get('content-type');
  let data = null;
  if (contentType && contentType.includes('application/json')) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  if (!response.ok) {
    const errorMsg = data?.error || data?.detail || response.statusText || 'Request failed';
    const err = new Error(errorMsg);
    err.status = response.status;
    err.data = data;
    throw err;
  }

  return data;
}

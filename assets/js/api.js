// assets/js/api.js
const API_URL = "https://script.google.com/macros/s/AKfycbytPfD9mq__VO7I2lnpBsqdCIT119ZT0zVyz0eeVjrJVgN_q8FYGgmqY6G66C2m67Pa4g/exec";

// cache local
const CACHE_KEY = "sdc_api_cache_v3";
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos

function getCached() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (!obj || !obj.t || !obj.data) return null;
    if (Date.now() - obj.t > CACHE_TTL_MS) return null;
    return obj.data;
  } catch {
    return null;
  }
}

function setCached(data) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ t: Date.now(), data }));
  } catch {}
}

async function fetchWithTimeout(url, ms = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);

  try {
    const res = await fetch(url, { cache: "no-store", signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

async function apiGetAll() {
  // si hay cache, pintamos rápido y refrescamos por detrás
  const cached = getCached();
  if (cached) {
    fetchWithTimeout(API_URL, 12000)
      .then(r => r.ok ? r.json() : null)
      .then(j => { if (j) setCached(j); })
      .catch(()=>{});
    return cached;
  }

  // primera vez: esperamos API con timeout
  const res = await fetchWithTimeout(API_URL, 12000);
  if (!res.ok) throw new Error(`API HTTP ${res.status}`);
  const data = await res.json();
  setCached(data);
  return data;
}

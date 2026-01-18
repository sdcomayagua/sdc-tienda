// API (Google Apps Script Web App)
const API_URL = "https://script.google.com/macros/s/AKfycbytPfD9mq__VO7I2lnpBsqdCIT119ZT0zVyz0eeVjrJVgN_q8FYGgmqY6G66C2m67Pa4g/exec";

// Cache local
const CACHE_KEY = "sdc_api_cache_v2";
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 min

function getCached() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (!obj || !obj.t || !obj.data) return null;
    if (Date.now() - obj.t > CACHE_TTL_MS) return null;
    return obj.data;
  } catch (e) {
    return null;
  }
}

function setCached(data) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ t: Date.now(), data }));
  } catch (e) {}
}

async function apiGetAll() {
  const cached = getCached();
  if (cached) {
    // Refresca en background
    fetch(API_URL, { cache: "no-store" })
      .then(r => r.ok ? r.json() : null)
      .then(j => { if (j) setCached(j); })
      .catch(()=>{});
    return cached;
  }

  // Primera vez
  const res = await fetch(API_URL, { cache: "no-store" });
  if (!res.ok) throw new Error("Error al conectar con la API");
  const data = await res.json();
  setCached(data);
  return data;
}

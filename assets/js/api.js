// API (Google Apps Script Web App)
const API_URL = "https://script.google.com/macros/s/AKfycbytPfD9mq__VO7I2lnpBsqdCIT119ZT0zVyz0eeVjrJVgN_q8FYGgmqY6G66C2m67Pa4g/exec";

// Cache local (para que cargue casi instantáneo)
const CACHE_KEY = "sdc_api_cache_v1";
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos

function getCachedApi() {
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

function setCachedApi(data) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ t: Date.now(), data }));
  } catch (e) {}
}

// Devuelve: { data, fromCache }
async function apiGetAll() {
  const cached = getCachedApi();
  if (cached) {
    // refresca en segundo plano, pero ya devolvemos cache para que pinte rápido
    fetch(API_URL, { cache: "no-store" })
      .then(r => r.ok ? r.json() : null)
      .then(j => { if (j) setCachedApi(j); })
      .catch(()=>{});
    return cached;
  }

  // primera vez: toca esperar a Apps Script
  const res = await fetch(API_URL, { cache: "no-store" });
  if (!res.ok) throw new Error("Error al conectar con la API");
  const data = await res.json();
  setCachedApi(data);
  return data;
}

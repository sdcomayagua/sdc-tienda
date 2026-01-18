// assets/js/api.js (SDC - robusto con debug)
const API_URL = "https://script.google.com/macros/s/AKfycbytPfD9mq__VO7I2lnpBsqdCIT119ZT0zVyz0eeVjrJVgN_q8FYGgmqY6G66C2m67Pa4g/exec";

const CACHE_KEY = "sdc_api_cache_v4";
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 min

function cacheRead() {
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

function cacheWrite(data) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ t: Date.now(), data }));
  } catch {}
}

function cacheClear() {
  try { localStorage.removeItem(CACHE_KEY); } catch {}
}

function isValidData(d){
  // mínimo viable: debe tener productos (array) y ajustes/categorias (aunque sea vacío)
  return d && Array.isArray(d.productos) && d.productos.length >= 0;
}

async function fetchWithTimeout(url, ms = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { cache: "no-store", signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function apiGetAll() {
  // 1) cache
  const cached = cacheRead();
  if (cached) {
    if (!isValidData(cached)) cacheClear();

    // refresco en background
    fetchWithTimeout(API_URL, 12000)
      .then(r => r.ok ? r.json() : null)
      .then(j => { if (j && isValidData(j)) cacheWrite(j); })
      .catch(()=>{});

    return cached;
  }

  // 2) primera vez
  const res = await fetchWithTimeout(API_URL, 12000);
  if (!res.ok) throw new Error(`API HTTP ${res.status}`);
  const data = await res.json();
  if (!isValidData(data)) {
    cacheClear();
    throw new Error("API devolvió datos inválidos");
  }
  cacheWrite(data);
  return data;
}

// ✅ Debug manual desde consola
window.SDC_DEBUG = async function(){
  console.log("SDC_DEBUG: probando API...");
  const res = await fetchWithTimeout(API_URL, 12000);
  console.log("HTTP:", res.status);
  const txt = await res.text();
  console.log("Primeros 500 chars:", txt.slice(0, 500));
  try{
    const j = JSON.parse(txt);
    console.log("JSON keys:", Object.keys(j));
    console.log("productos:", Array.isArray(j.productos) ? j.productos.length : j.productos);
  }catch(e){
    console.log("No es JSON:", e);
  }
};

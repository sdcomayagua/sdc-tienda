// assets/js/api.js (simple y estable)
const API_URL = "https://script.google.com/macros/s/AKfycbytPfD9mq__VO7I2lnpBsqdCIT119ZT0zVyz0eeVjrJVgN_q8FYGgmqY6G66C2m67Pa4g/exec";

async function apiGetAll() {
  const res = await fetch(API_URL, { cache: "no-store" });
  if (!res.ok) throw new Error(`API HTTP ${res.status}`);
  return await res.json();
}

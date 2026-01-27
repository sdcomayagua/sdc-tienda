// assets/js/api.js (simple y estable)
const API_URL = "API_URL="https://script.google.com/macros/s/AKfycbzv-T26o_oV9NwtiW8Lpk8HRYlBZqWz-9KIyD_FxzOnboccj8SIFUx-L0z22q-JCawqgQ/exec";";

async function apiGetAll() {
  const res = await fetch(API_URL, { cache: "no-store" });
  if (!res.ok) throw new Error(`API HTTP ${res.status}`);
  return await res.json();
}

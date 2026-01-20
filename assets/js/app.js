/* SDComayagua - app.js (COMPLETO)
   - Catálogo + modal producto
   - Carrito 1-2-3
   - Entrega Honduras (18 deptos + municipios desde municipios_hn)
   - Reglas:
     * Comayagua/Comayagua => domicilio por zonas (zonas_comayagua_ciudad)
     * Comayagua + municipios permitidos => domicilio (sin empresas)
     * Otros municipios de Comayagua => empresas/bus
     * Otros departamentos => empresas (sin zonas)
   - Pago:
     * Domicilio => efectivo (con cambio) + transferencia + PayPal + Tigo Money
     * Empresa/bus => transferencia + PayPal + Tigo Money + pagar al recibir (sin cambio)
*/

const API_URL =
  "https://script.google.com/macros/s/AKfycbytPfD9mq__VO7I2lnpBsqdCIT119ZT0zVyz0eeVjrJVgN_q8FYGgmqY6G66C2m67Pa4g/exec";

const CART_KEY = "sdc_cart_pro_v7";
const THEME_KEY = "sdc_theme_pro_v7";
const WA_DEFAULT = "50431517755";

const $ = (id) => document.getElementById(id);
const safe = (v) => String(v ?? "").trim();
const money = (n) => `Lps. ${Math.round(Number(n || 0)).toLocaleString("es-HN")}`;

const isOffer = (p) => Number(p.precio_anterior || 0) > Number(p.precio || 0);
const isOut = (p) => Number(p.stock || 0) <= 0;

/* Empresas */
const EMPRESAS_ENVIO = ["C807", "Cargo Expreso", "Forza"];
const PERMITE_BUS_LOCAL = true;

/* Municipios con entrega a domicilio (cuando depto=Comayagua) */
const MUNICIPIOS_DOMICILIO_COMAYAGUA = new Set([
  "Comayagua", // ciudad, caso especial con zonas
  "Villa de San Antonio",
  "Ajuterique",
  "Lejamaní", "Lejamani",
  "Flores",
  "Lamaní", "Lamani",
  "Yarumela", "Jarumela",
]);

/* También permites La Paz municipio a domicilio (según lo que dijiste) */
const MUNICIPIOS_DOMICILIO_LAPAZ = new Set(["La Paz", "La Paz (Municipio)"]);

/* Estado de datos */
let DATA = null;
let PRODUCTS = [];
let BY_ID = {};
let CART = [];
let CURRENT = null;

let CURRENT_CAT = null;
let CURRENT_SUB = null;
let QUERY = "";
let STEP = 1;

/* Checkout */
let CHECKOUT = {
  depto: "",
  muni: "",

  entrega_tipo: "",        // domicilio_ciudad | domicilio_muni | empresa | bus
  zona: "",
  colonia: "",
  referencia: "",
  envio_costo: 0,

  empresa: "",
  modalidad: "normal",     // normal | pagar_al_recibir

  pago: "",
  efectivo_con: 0,
  cambio: 0,
};

/* ================= THEME ================= */
function applyTheme() {
  const saved = localStorage.getItem(THEME_KEY) || "dark";
  document.body.classList.toggle("light", saved === "light");
  $("themeBtn").innerHTML =
    saved === "light" ? '<i class="ri-sun-line"></i>' : '<i class="ri-moon-line"></i>';
}
function toggleTheme() {
  const isLight = document.body.classList.contains("light");
  localStorage.setItem(THEME_KEY, isLight ? "dark" : "light");
  applyTheme();
}

/* ================= MODALS ================= */
function openOverlay() { $("overlay").style.display = "block"; }
function closeOverlay() { $("overlay").style.display = "none"; }
function openModal(id) { openOverlay(); $(id).style.display = "block"; }
function closeModal(id) {
  $(id).style.display = "none";
  if ($("productModal").style.display !== "block" && $("cartModal").style.display !== "block") {
    closeOverlay();
  }
}

/* ================= CART STORAGE ================= */
function loadCart() {
  try { CART = JSON.parse(localStorage.getItem(CART_KEY) || "[]"); } catch { CART = []; }
  if (!Array.isArray(CART)) CART = [];
  updateBadge();
}
function saveCart() {
  localStorage.setItem(CART_KEY, JSON.stringify(CART));
  updateBadge();
}
function updateBadge() {
  $("cartCount").textContent = String(CART.reduce((a, it) => a + Number(it.qty || 0), 0));
}
function cartSubtotal() {
  return CART.reduce((sum, it) => {
    const p = BY_ID[it.id];
    return p ? sum + Number(p.precio || 0) * Number(it.qty || 0) : sum;
  }, 0);
}
function totalFinal() {
  return cartSubtotal() + Number(CHECKOUT.envio_costo || 0);
}

/* ================= API ================= */
async function loadAPI() {
  const r = await fetch(API_URL, { cache: "no-store" });
  if (!r.ok) throw new Error("API HTTP " + r.status);
  return await r.json();
}

/* ================= HONDURAS: Deptos/Munis ================= */
function hnDeptos() {
  const rows = Array.isArray(DATA?.municipios_hn) ? DATA.municipios_hn : [];
  const set = new Set(rows.map((r) => safe(r.departamento)).filter(Boolean));
  return [...set].sort((a, b) => a.localeCompare(b));
}
function hnMunis(depto) {
  const rows = Array.isArray(DATA?.municipios_hn) ? DATA.municipios_hn : [];
  return rows
    .filter((r) => safe(r.departamento) === depto)
    .map((r) => safe(r.municipio))
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
}

/* ================= ZONAS COMAYAGUA CIUDAD ================= */
function zonasRows() {
  return Array.isArray(DATA?.zonas_comayagua_ciudad) ? DATA.zonas_comayagua_ciudad : [];
}
function zonasUnicas() {
  const set = new Set(zonasRows().map((r) => safe(r.zona)).filter(Boolean));
  const arr = [...set];
  const order = ["centrica", "céntrica", "alejada", "fuera"];
  arr.sort((a, b) => {
    const ai = order.indexOf(a.toLowerCase());
    const bi = order.indexOf(b.toLowerCase());
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });
  return arr;
}
function coloniasByZona(zona) {
  return zonasRows()
    .filter((r) => safe(r.zona) === zona)
    .map((r) => ({
      col: safe(r.colonia_barrio),
      costo: Number(r.costo || 0),
      ref: safe(r.referencia),
    }))
    .filter((x) => x.col);
}

/* ================= CATEGORÍAS (simple) ================= */
function categoriesList() {
  const set = new Set(PRODUCTS.map((p) => p.categoria).filter(Boolean));
  const cats = [...set].sort((a, b) => a.localeCompare(b));
  const out = [];
  if (PRODUCTS.some(isOffer)) out.push("OFERTAS");
  cats.forEach((c) => { if (String(c).toUpperCase() !== "OFERTAS") out.push(c); });
  return out;
}
function subcategoriesList(cat) {
  if (!cat || cat === "OFERTAS") return [];
  return [...new Set(PRODUCTS.filter((p) => p.categoria === cat).map((p) => p.subcategoria).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b));
}
function renderCategories() {
  const bar = $("categoryBar");
  bar.innerHTML = "";

  const all = document.createElement("button");
  all.className = "pill" + (!CURRENT_CAT ? " active" : "");
  all.textContent = "VER TODO";
  all.onclick = () => { CURRENT_CAT = null; CURRENT_SUB = null; renderCategories(); renderSubcategories(); renderProducts(); };
  bar.appendChild(all);

  categoriesList().forEach((cat) => {
    const b = document.createElement("button");
    b.className = "pill" + (CURRENT_CAT === cat ? " active" : "");
    b.textContent = cat;
    b.onclick = () => { CURRENT_CAT = cat; CURRENT_SUB = null; renderCategories(); renderSubcategories(); renderProducts(); };
    bar.appendChild(b);
  });
}
function renderSubcategories() {
  const bar = $("subcategories");
  bar.innerHTML = "";

  const subs = subcategoriesList(CURRENT_CAT);
  if (!CURRENT_CAT || CURRENT_CAT === "OFERTAS" || subs.length === 0) { bar.style.display = "none"; return; }
  bar.style.display = "flex";

  const all = document.createElement("button");
  all.className = "pill" + (!CURRENT_SUB ? " active" : "");
  all.textContent = "Todas";
  all.onclick = () => { CURRENT_SUB = null; renderSubcategories(); renderProducts(); };
  bar.appendChild(all);

  subs.forEach((sc) => {
    const b = document.createElement("button");
    b.className = "pill" + (CURRENT_SUB === sc ? " active" : "");
    b.textContent = sc;
    b.onclick = () => { CURRENT_SUB = sc; renderSubcategories(); renderProducts(); };
    bar.appendChild(b);
  });
}

/* ================= PRODUCTOS ================= */
function filteredProducts() {
  let list = [...PRODUCTS];
  if (CURRENT_CAT) list = CURRENT_CAT === "OFERTAS" ? list.filter(isOffer) : list.filter((p) => p.categoria === CURRENT_CAT);
  if (CURRENT_SUB) list = list.filter((p) => p.subcategoria === CURRENT_SUB);

  const q = (QUERY || "").toLowerCase().trim();
  if (q) {
    list = list.filter((p) =>
      (p.nombre || "").toLowerCase().includes(q) ||
      (p.descripcion || "").toLowerCase().includes(q) ||
      (p.subcategoria || "").toLowerCase().includes(q)
    );
  }

  // disponibles primero
  list.sort((a, b) => {
    const av = a.stock > 0 ? 0 : 1;
    const bv = b.stock > 0 ? 0 : 1;
    if (av !== bv) return av - bv;
    return (a.nombre || "").localeCompare(b.nombre || "");
  });

  return list;
}

function renderProducts() {
  const grid = $("productsGrid");
  const list = filteredProducts();
  grid.innerHTML = "";
  $("productsTitle").textContent = `Productos (${list.length})`;

  if (!list.length) {
    grid.innerHTML = `<div style="grid-column:1/-1;color:var(--muted);padding:12px">No hay productos.</div>`;
    return;
  }

  list.forEach((p) => {
    const out = isOut(p);
    const offer = isOffer(p);

    const card = document.createElement("article");
    card.className = "card";

    const btn = out
      ? `<button class="btnDisabled" disabled>Agotado</button>`
      : `<button class="bp" type="button" onclick="window.__openProduct('${p.id}')">Ver detalles</button>`;

    card.innerHTML = `
      ${offer ? `<div class="tagOffer">OFERTA</div>` : ""}
      <img src="${p.imagen || ""}" alt="">
      <div class="cardBody">
        <div class="cardTitle">${p.nombre}</div>
        <div class="cardDesc">${p.descripcion || p.subcategoria || ""}</div>
        <div class="pr"><div class="p">${money(p.precio)}</div>${offer ? `<div class="o">${money(p.precio_anterior)}</div>` : ""}</div>
        ${btn}
      </div>
      ${out ? `<div class="tagOut">AGOTADO</div>` : ""}
    `;

    if (!out) card.addEventListener("click", (e) => { if (e.target.closest("button")) return; openProduct(p.id); });
    grid.appendChild(card);
  });
}

/* ================= MODAL PRODUCTO ================= */
function parseGallery(p) {
  const urls = [];
  if (p.imagen) urls.push(p.imagen);
  if (p.galeria) String(p.galeria).split(",").map((x) => x.trim()).filter(Boolean).forEach((u) => urls.push(u));
  for (let i = 1; i <= 8; i++) {
    const k = "galeria_" + i;
    if (p[k]) urls.push(p[k]);
  }
  return [...new Set(urls.filter(Boolean))].slice(0, 8);
}
function videoLabel(url) {
  const u = (url || "").toLowerCase();
  if (u.includes("tiktok.com")) return "Ver en TikTok";
  if (u.includes("youtube.com") || u.includes("youtu.be")) return "Ver en YouTube";
  if (u.includes("facebook.com") || u.includes("fb.watch")) return "Ver en Facebook";
  return "Ver video";
}
function openProduct(id) {
  const p = BY_ID[id];
  if (!p) return;
  CURRENT = p;

  $("modalName").textContent = p.nombre || "Producto";
  $("modalSub").textContent = `${p.categoria || ""}${p.subcategoria ? " · " + p.subcategoria : ""}`;
  $("modalPrice").textContent = money(p.precio || 0);
  $("modalOld").textContent = isOffer(p) ? money(p.precio_anterior) : "";
  $("modalDesc").textContent = p.descripcion || "";

  const g = parseGallery(p);
  $("modalMainImg").src = g[0] || p.imagen || "";
  const thumbs = $("modalThumbs");
  thumbs.innerHTML = "";
  if (g.length <= 1) thumbs.classList.add("hidden");
  else {
    thumbs.classList.remove("hidden");
    g.forEach((src, idx) => {
      const im = document.createElement("img");
      im.src = src;
      im.className = idx === 0 ? "active" : "";
      im.onclick = () => {
        $("modalMainImg").src = src;
        [...thumbs.children].forEach((x) => x.classList.remove("active"));
        im.classList.add("active");
      };
      thumbs.appendChild(im);
    });
  }

  const vwrap = $("modalVideo");
  vwrap.innerHTML = "";
  const v = safe(p.video || p.video_url || "");
  if (v) {
    vwrap.classList.remove("hidden");
    const a = document.createElement("a");
    a.href = v; a.target = "_blank"; a.rel = "noopener";
    a.className = "videoBtn";
    a.textContent = videoLabel(v);
    vwrap.appendChild(a);
  } else vwrap.classList.add("hidden");

  $("btnAddCart").disabled = isOut(p);
  $("btnAddCart").textContent = isOut(p) ? "Agotado" : "Agregar al carrito";
  $("modalHint").textContent = "";

  openModal("productModal");
}
window.__openProduct = openProduct;

/* ================= CARRITO UI ================= */
function renderCart() {
  const list = $("cartItems");
  list.innerHTML = "";
  $("cartEmpty").style.display = CART.length ? "none" : "block";

  CART.forEach((it, idx) => {
    const p = BY_ID[it.id];
    if (!p) return;

    const row = document.createElement("div");
    row.className = "cartItem";
    row.innerHTML = `
      <img src="${p.imagen || ""}" alt="">
      <div>
        <div class="cartName">${p.nombre}</div>
        <div class="cartMeta">${money(p.precio)}</div>
        <div class="qtyRow">
          <button class="minus">-</button>
          <span class="qtyNum">${it.qty}</span>
          <button class="plus">+</button>
          <button class="trash">🗑</button>
        </div>
      </div>
    `;

    row.querySelector(".minus").onclick = () => { it.qty = Math.max(1, it.qty - 1); saveCart(); renderCart(); updateTotalsUI(); };
    row.querySelector(".plus").onclick = () => { it.qty++; saveCart(); renderCart(); updateTotalsUI(); };
    row.querySelector(".trash").onclick = () => { CART.splice(idx, 1); saveCart(); renderCart(); updateTotalsUI(); };

    list.appendChild(row);
  });

  updateTotalsUI();
}

function updateTotalsUI() {
  $("subTotal").textContent = money(cartSubtotal());
  $("shipTotal").textContent = money(CHECKOUT.envio_costo || 0);
  $("grandTotal").textContent = money(totalFinal());
}

/* ================= STEP 2 / 3 ================= */
function setStep(n) {
  STEP = n;
  $("step1").classList.toggle("hidden", n !== 1);
  $("step2").classList.toggle("hidden", n !== 2);
  $("step3").classList.toggle("hidden", n !== 3);
  $("tab1").classList.toggle("active", n === 1);
  $("tab2").classList.toggle("active", n === 2);
  $("tab3").classList.toggle("active", n === 3);

  $("btnBack").style.display = n === 1 ? "none" : "inline-block";
  $("btnNext").textContent = n === 3 ? "Enviar por WhatsApp" : "Continuar";
  $("btnSendWA").style.display = n === 3 ? "block" : "none";

  if (n === 2) ensureEntregaUI();
}

function openCart() {
  setStep(1);
  renderCart();
  openModal("cartModal");
}

/* ================= ENTREGA UI (COMPLETA) ================= */
function ensureEntregaUI() {
  const step2 = $("step2");
  if (!step2) return;
  if ($("deptoSel")) return;

  step2.innerHTML = `
    <div class="ckbox">
      <div class="tx"><b>Ubicación (Honduras)</b></div>
      <div class="grid2sel">
        <div>
          <div class="tx">Departamento</div>
          <select id="deptoSel"><option value="">Selecciona departamento</option></select>
        </div>
        <div>
          <div class="tx">Municipio</div>
          <select id="muniSel" disabled><option value="">Selecciona municipio</option></select>
        </div>
      </div>

      <div id="domBlock" class="hidden">
        <div class="hr"></div>
        <div class="tx"><b>Servicio a domicilio</b></div>

        <div id="comCityBlock" class="hidden">
          <div class="tx">Comayagua ciudad: elige zona y colonia/barrio</div>
          <div class="grid2sel">
            <select id="zonaSel"><option value="">Zona</option></select>
            <select id="colSel"><option value="">Colonia/Barrio</option></select>
          </div>
          <div class="note" id="zonaInfo"></div>
        </div>

        <div id="muniDomInfo" class="note hidden"></div>
      </div>

      <div id="empBlock" class="hidden">
        <div class="hr"></div>
        <div class="tx"><b>Envío por empresa</b></div>
        <div class="grid2sel">
          <select id="empSel"></select>
          <select id="modSel">
            <option value="normal">Servicio normal (anticipado)</option>
            <option value="pagar_al_recibir">Pagar al recibir</option>
          </select>
        </div>
        <div class="note" id="empInfo"></div>
        ${PERMITE_BUS_LOCAL ? `<div class="note">🚌 Bus/encomienda: 80–150 (varía, se confirma por WhatsApp).</div>` : ``}
      </div>

      <div class="hr"></div>
      <div class="tx"><b>Datos</b></div>
      <input id="custName" placeholder="Tu nombre">
      <input id="custPhone" placeholder="Ej: 9999-9999">
      <textarea id="custAddr" placeholder="Dirección / Referencia"></textarea>

      <div class="hr"></div>
      <div class="tx"><b>Pago</b></div>
      <select id="paySel"><option value="">Selecciona método</option></select>

      <div id="cashBlock" class="hidden">
        <input id="cashWith" placeholder="¿Con cuánto pagará? (solo domicilio)" inputmode="numeric">
        <div class="note" id="cashInfo"></div>
      </div>

      <div class="hr"></div>
      <div class="note"><b>Envío:</b> <span id="envioPreview">${money(0)}</span> · <b>Total:</b> <span id="totalPreview">${money(totalFinal())}</span></div>
    </div>
  `;

  // llenar deptos
  const ds = $("deptoSel");
  hnDeptos().forEach((d) => {
    const o = document.createElement("option");
    o.value = d; o.textContent = d;
    ds.appendChild(o);
  });

  // empresas
  const es = $("empSel");
  EMPRESAS_ENVIO.forEach((x) => {
    const o = document.createElement("option");
    o.value = x; o.textContent = x;
    es.appendChild(o);
  });

  // listeners
  ds.addEventListener("change", () => {
    CHECKOUT.depto = ds.value;
    fillMunis();
    applyEntregaRules();
  });

  $("muniSel").addEventListener("change", () => {
    CHECKOUT.muni = $("muniSel").value;
    applyEntregaRules();
  });

  $("zonaSel").addEventListener("change", () => {
    CHECKOUT.zona = $("zonaSel").value;
    fillColonias();
    applyEntregaRules();
  });

  $("colSel").addEventListener("change", () => {
    const opt = $("colSel").selectedOptions[0];
    CHECKOUT.colonia = opt?.value || "";
    CHECKOUT.envio_costo = Number(opt?.dataset.costo || 0);
    CHECKOUT.referencia = opt?.dataset.ref || "";
    $("zonaInfo").textContent =
      CHECKOUT.colonia ? `Costo: ${money(CHECKOUT.envio_costo)}${CHECKOUT.referencia ? " · " + CHECKOUT.referencia : ""}` : "";
    refreshPreviews();
  });

  es.addEventListener("change", () => {
    CHECKOUT.empresa = es.value;
    applyEntregaRules();
  });

  $("modSel").addEventListener("change", () => {
    CHECKOUT.modalidad = $("modSel").value;
    applyEntregaRules();
  });

  $("paySel").addEventListener("change", () => {
    CHECKOUT.pago = $("paySel").value;
    updatePagoUI();
    refreshPreviews();
  });

  $("cashWith").addEventListener("input", () => {
    CHECKOUT.efectivo_con = Number(String($("cashWith").value || "").replace(/[^\d]/g, "") || 0);
    refreshPreviews();
  });

  fillMunis();
  applyEntregaRules();
}

function fillMunis() {
  const d = $("deptoSel").value;
  const ms = $("muniSel");
  ms.innerHTML = `<option value="">Selecciona municipio</option>`;
  ms.disabled = !d;
  if (!d) return;
  hnMunis(d).forEach((m) => {
    const o = document.createElement("option");
    o.value = m; o.textContent = m;
    ms.appendChild(o);
  });
  ms.disabled = false;
}

function fillZonas() {
  const zs = $("zonaSel");
  zs.innerHTML = `<option value="">Zona</option>`;
  zonasUnicas().forEach((z) => {
    const nice =
      z.toLowerCase().includes("centr") ? "Zona Céntrica" :
      z.toLowerCase().includes("alej") ? "Zona Alejada" :
      z.toLowerCase().includes("fuera") ? "Fuera" : z;
    const o = document.createElement("option");
    o.value = z;
    o.textContent = nice;
    zs.appendChild(o);
  });
}

function fillColonias() {
  const zona = $("zonaSel").value;
  const cs = $("colSel");
  cs.innerHTML = `<option value="">Colonia/Barrio</option>`;
  if (!zona) return;
  coloniasByZona(zona).forEach((c) => {
    const o = document.createElement("option");
    o.value = c.col;
    o.textContent = `${c.col} (${money(c.costo)})`;
    o.dataset.costo = String(c.costo || 0);
    o.dataset.ref = c.ref || "";
    cs.appendChild(o);
  });
}

function applyEntregaRules() {
  const depto = safe(CHECKOUT.depto);
  const muni = safe(CHECKOUT.muni);

  // reset UI
  $("domBlock").classList.add("hidden");
  $("comCityBlock").classList.add("hidden");
  $("muniDomInfo").classList.add("hidden");
  $("empBlock").classList.add("hidden");

  CHECKOUT.entrega_tipo = "";
  CHECKOUT.envio_costo = 0;
  CHECKOUT.zona = "";
  CHECKOUT.colonia = "";
  CHECKOUT.referencia = "";
  CHECKOUT.pago = "";
  CHECKOUT.efectivo_con = 0;
  CHECKOUT.cambio = 0;

  // sin depto/muni
  if (!depto || !muni) { fillPayOptions(); refreshPreviews(); return; }

  // ✅ Caso COMAYAGUA / COMAYAGUA: zonas
  if (depto === "Comayagua" && muni === "Comayagua") {
    CHECKOUT.entrega_tipo = "domicilio_ciudad";
    $("domBlock").classList.remove("hidden");
    $("comCityBlock").classList.remove("hidden");
    fillZonas();
    $("colSel").innerHTML = `<option value="">Colonia/Barrio</option>`;
    $("zonaInfo").textContent = "Elige zona y colonia/barrio para calcular el costo.";
    fillPayOptions();
    refreshPreviews();
    return;
  }

  // ✅ Depto Comayagua + municipio permitido => SOLO DOMICILIO (sin empresas)
  if (depto === "Comayagua" && MUNICIPIOS_DOMICILIO_COMAYAGUA.has(muni)) {
    CHECKOUT.entrega_tipo = "domicilio_muni";
    $("domBlock").classList.remove("hidden");
    $("muniDomInfo").classList.remove("hidden");
    $("muniDomInfo").textContent = `Entrega a domicilio disponible en ${muni}. (Costo se confirma por WhatsApp).`;
    CHECKOUT.envio_costo = 0;
    fillPayOptions();
    refreshPreviews();
    return;
  }

  // ✅ Depto La Paz + municipio La Paz => SOLO DOMICILIO
  if (depto === "La Paz" && MUNICIPIOS_DOMICILIO_LAPAZ.has(muni)) {
    CHECKOUT.entrega_tipo = "domicilio_muni";
    $("domBlock").classList.remove("hidden");
    $("muniDomInfo").classList.remove("hidden");
    $("muniDomInfo").textContent = `Entrega a domicilio disponible en ${muni}. (Costo se confirma por WhatsApp).`;
    CHECKOUT.envio_costo = 0;
    fillPayOptions();
    refreshPreviews();
    return;
  }

  // ✅ Cualquier otro caso => EMPRESAS (y bus opcional)
  CHECKOUT.entrega_tipo = PERMITE_BUS_LOCAL ? "empresa" : "empresa";
  $("empBlock").classList.remove("hidden");

  CHECKOUT.empresa = $("empSel").value || EMPRESAS_ENVIO[0];
  CHECKOUT.modalidad = $("modSel").value || "normal";

  // costos default (luego lo hacemos editable en Sheets)
  CHECKOUT.envio_costo = CHECKOUT.modalidad === "pagar_al_recibir" ? 170 : 110;

  $("empInfo").textContent =
    `Empresa: ${CHECKOUT.empresa} · ${CHECKOUT.modalidad === "normal" ? "Servicio normal" : "Pagar al recibir"} · Costo: ${money(CHECKOUT.envio_costo)}`;

  fillPayOptions();
  refreshPreviews();
}

function fillPayOptions() {
  const sel = $("paySel");
  sel.innerHTML = `<option value="">Selecciona método</option>`;

  const domicilio = CHECKOUT.entrega_tipo === "domicilio_ciudad" || CHECKOUT.entrega_tipo === "domicilio_muni";

  const add = (v, t) => {
    const o = document.createElement("option");
    o.value = v; o.textContent = t;
    sel.appendChild(o);
  };

  if (domicilio) {
    add("efectivo", "Efectivo (pagar al recibir)");
    add("transferencia", "Transferencia bancaria");
    add("paypal", "PayPal");
    add("tigo_money", "Tigo Money");
  } else {
    add("transferencia", "Transferencia bancaria");
    add("paypal", "PayPal");
    add("tigo_money", "Tigo Money");
    add("pagar_al_recibir", "Pagar al recibir");
  }

  updatePagoUI();
}

function updatePagoUI() {
  const domicilio = CHECKOUT.entrega_tipo === "domicilio_ciudad" || CHECKOUT.entrega_tipo === "domicilio_muni";
  const metodo = $("paySel").value || "";
  CHECKOUT.pago = metodo;

  if (domicilio && metodo === "efectivo") {
    $("cashBlock").classList.remove("hidden");
  } else {
    $("cashBlock").classList.add("hidden");
    CHECKOUT.efectivo_con = 0;
    CHECKOUT.cambio = 0;
    if ($("cashWith")) $("cashWith").value = "";
    if ($("cashInfo")) $("cashInfo").textContent = "";
  }
}

function refreshPreviews() {
  // cambio
  if (CHECKOUT.pago === "efectivo") {
    const con = Number(CHECKOUT.efectivo_con || 0);
    const t = totalFinal();
    const diff = con - t;
    CHECKOUT.cambio = diff > 0 ? diff : 0;

    if (con <= 0) $("cashInfo").textContent = "Escribe con cuánto pagará para calcular el cambio.";
    else if (diff < 0) $("cashInfo").textContent = `Faltan ${money(Math.abs(diff))} para completar el total.`;
    else $("cashInfo").textContent = `Cambio estimado: ${money(diff)}.`;
  }

  updateTotalsUI();
  if ($("envioPreview")) $("envioPreview").textContent = money(CHECKOUT.envio_costo || 0);
  if ($("totalPreview")) $("totalPreview").textContent = money(totalFinal());
}

/* ================= WHATSAPP ================= */
function sendWhatsApp() {
  if (!CART.length) return alert("Carrito vacío");

  const name = safe($("custName").value);
  const phone = safe($("custPhone").value);
  const addr = safe($("custAddr").value);

  const lines = [];
  lines.push("🛒 PEDIDO - SDComayagua", "");
  if (name) lines.push("👤 " + name);
  if (phone) lines.push("📞 " + phone);
  if (CHECKOUT.depto && CHECKOUT.muni) lines.push(`📍 ${CHECKOUT.depto} / ${CHECKOUT.muni}`);

  if (CHECKOUT.entrega_tipo === "domicilio_ciudad") {
    lines.push("🚚 Domicilio (Comayagua ciudad)");
    if (CHECKOUT.zona) lines.push("Zona: " + CHECKOUT.zona);
    if (CHECKOUT.colonia) lines.push("Colonia/Barrio: " + CHECKOUT.colonia);
  } else if (CHECKOUT.entrega_tipo === "domicilio_muni") {
    lines.push("🚚 Domicilio (municipio con cobertura)");
  } else {
    lines.push(`📦 Empresa: ${CHECKOUT.empresa} · ${CHECKOUT.modalidad === "normal" ? "Normal" : "Pagar al recibir"}`);
    if (PERMITE_BUS_LOCAL) lines.push("🚌 Bus/encomienda disponible (80–150, se confirma).");
  }

  if (addr) lines.push("📌 " + addr);

  lines.push("", "Productos:");
  CART.forEach((it) => {
    const p = BY_ID[it.id];
    if (!p) return;
    lines.push(`- ${it.qty} x ${p.nombre} (${money(p.precio)})`);
  });

  lines.push("");
  lines.push("Envío: " + money(CHECKOUT.envio_costo || 0));
  lines.push("Total: " + money(totalFinal()));
  if (CHECKOUT.pago) lines.push("Pago: " + CHECKOUT.pago);
  if (CHECKOUT.pago === "efectivo") {
    lines.push("Efectivo con: " + money(CHECKOUT.efectivo_con || 0));
    lines.push("Cambio: " + money(CHECKOUT.cambio || 0));
  }

  window.open(`https://wa.me/${WA_DEFAULT}?text=${encodeURIComponent(lines.join("\n"))}`, "_blank");
}

/* ================= EVENTOS ================= */
function wire() {
  $("overlay").onclick = () => { closeModal("productModal"); closeModal("cartModal"); };
  $("closeProduct").onclick = () => closeModal("productModal");
  $("closeCart").onclick = () => closeModal("cartModal");

  $("btnKeepBuying").onclick = () => closeModal("productModal");
  $("btnGoPay").onclick = () => { closeModal("productModal"); openCart(); };

  $("btnAddCart").onclick = () => {
    if (!CURRENT || isOut(CURRENT)) return;
    const it = CART.find((x) => x.id === CURRENT.id);
    if (it) it.qty++;
    else CART.push({ id: CURRENT.id, qty: 1 });
    saveCart();
    $("modalHint").textContent = "✅ Agregado. Puedes seguir comprando o ir a pagar.";
  };

  $("tab1").onclick = () => setStep(1);
  $("tab2").onclick = () => setStep(2);
  $("tab3").onclick = () => setStep(3);

  $("btnBack").onclick = () => STEP > 1 && setStep(STEP - 1);

  $("btnNext").onclick = () => {
    if (STEP === 1) {
      if (!CART.length) return alert("Tu carrito está vacío.");
      setStep(2);
      return;
    }
    if (STEP === 2) {
      // validar
      if (!CHECKOUT.depto || !CHECKOUT.muni) return alert("Selecciona departamento y municipio.");
      if (CHECKOUT.entrega_tipo === "domicilio_ciudad" && (!CHECKOUT.zona || !CHECKOUT.colonia)) {
        return alert("Elige zona y colonia/barrio para calcular el costo.");
      }
      if (!safe($("custName").value)) return alert("Escribe tu nombre.");
      if (!safe($("custAddr").value)) return alert("Escribe tu dirección / referencia.");
      if (!CHECKOUT.pago) return alert("Selecciona método de pago.");
      if (CHECKOUT.pago === "efectivo" && Number(CHECKOUT.efectivo_con || 0) <= 0) return alert("Escribe con cuánto pagará.");
      setStep(3);
      return;
    }
    if (STEP === 3) sendWhatsApp();
  };

  $("btnSendWA").onclick = sendWhatsApp;

  $("goTop").onclick = () => window.scrollTo({ top: 0, behavior: "smooth" });
  $("searchBtn").onclick = () => $("searchInput").focus();
  $("themeBtn").onclick = toggleTheme;
  $("cartBtn").onclick = openCart;

  $("searchInput").addEventListener("input", (e) => { QUERY = e.target.value || ""; renderProducts(); });
}

/* ================= INIT ================= */
async function init() {
  applyTheme();
  loadCart();

  $("loadingMsg").style.display = "block";
  try {
    DATA = await loadAPI();

    PRODUCTS = (DATA.productos || [])
      .map((p) => ({
        id: safe(p.id),
        nombre: safe(p.nombre),
        precio: Number(p.precio || 0),
        precio_anterior: Number(p.precio_anterior || 0),
        stock: Number(p.stock || 0),
        categoria: safe(p.categoria || "General") || "General",
        subcategoria: safe(p.subcategoria || ""),
        descripcion: safe(p.descripcion || ""),
        imagen: safe(p.imagen || ""),
        video: safe(p.video || p.video_url || ""),
        galeria: safe(p.galeria || ""),
      }))
      .filter((p) => p.id && p.nombre);

    BY_ID = {};
    PRODUCTS.forEach((p) => (BY_ID[p.id] = p));

    renderCategories();
    renderSubcategories();
    renderProducts();
    wire();

    window.__openProduct = openProduct;
  } catch (err) {
    console.error(err);
    $("productsGrid").innerHTML =
      `<div style="grid-column:1/-1;color:var(--muted);padding:12px">Error cargando catálogo: ${String(err.message || err)}</div>`;
  } finally {
    $("loadingMsg").style.display = "none";
  }
}

document.addEventListener("DOMContentLoaded", init);
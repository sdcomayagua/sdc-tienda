/* SDComayagua - app.js (TODO EN UNO)
   - Catálogo + categorías/subcategorías
   - Modal producto (galería + video)
   - Carrito 1-2-3
   - Entrega Honduras: 18 departamentos + municipios (desde municipios_hn)
   - Caso especial: Comayagua/Comayagua = zonas+colonias (desde zonas_comayagua_ciudad)
   - Municipios con domicilio (lista fija)
   - Otros: empresas C807/Cargo Expreso/Forza + (bus opcional)
   - Pagos:
      * Domicilio: efectivo (con cambio), transferencia, PayPal, Tigo Money
      * Empresa/Bus: transferencia, PayPal, Tigo Money, pagar al recibir (sin cambio)
*/

const API_URL =
  "https://script.google.com/macros/s/AKfycbytPfD9mq__VO7I2lnpBsqdCIT119ZT0zVyz0eeVjrJVgN_q8FYGgmqY6G66C2m67Pa4g/exec";

const CART_KEY = "sdc_cart_pro_v6";
const THEME_KEY = "sdc_theme_pro_v6";
const WA_DEFAULT = "50431517755";

const $ = (id) => document.getElementById(id);
const safe = (v) => String(v ?? "").trim();
const money = (n) => `Lps. ${Math.round(Number(n || 0)).toLocaleString("es-HN")}`;

const isOffer = (p) => Number(p.precio_anterior || 0) > Number(p.precio || 0);
const isOut = (p) => Number(p.stock || 0) <= 0;

let DATA = null;
let PRODUCTS = [];
let BY_ID = {};
let CART = [];
let CURRENT = null;

let CURRENT_CAT = null;
let CURRENT_SUB = null;
let QUERY = "";
let STEP = 1;

/* Municipios con entrega a domicilio (según tu mensaje) */
const MUNICIPIOS_DOMICILIO = new Set([
  "Comayagua",
  "Villa de San Antonio",
  "Lejamaní","Lejamani",
  "Lamaní","Lamani",
  "Ajuterique",
  "Flores",
  "Yarumela","Jarumela",
  "La Paz"
]);

/* Empresas */
const EMPRESAS_ENVIO = ["C807", "Cargo Expreso", "Forza"];
const PERMITE_BUS_LOCAL = true;

/* Checkout state */
let CHECKOUT = {
  departamento: "",
  municipio: "",

  entrega_tipo: "", // domicilio_ciudad | domicilio_muni | empresa | bus
  zona: "",
  colonia_barrio: "",
  referencia: "",
  envio_costo: 0,

  empresa_envio: "",
  modalidad_envio: "", // normal | pagar_al_recibir | bus

  pago_metodo: "", // efectivo | transferencia | paypal | tigo_money | pagar_al_recibir
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

/* ================= API ================= */
async function loadAPI() {
  const r = await fetch(API_URL, { cache: "no-store" });
  if (!r.ok) throw new Error("API HTTP " + r.status);
  return await r.json();
}

/* ================= AJUSTES ================= */
function ajustesMap() {
  const map = {};
  (DATA?.ajustes || []).forEach((r) => {
    const k = safe(r.clave);
    const v = safe(r.valor);
    if (k) map[k] = v;
  });
  return map;
}
function applyAjustes() {
  const a = ajustesMap();
  if ($("storeName")) $("storeName").textContent = a["nombre_tienda"] || "SDComayagua";
  if ($("storeSub")) $("storeSub").textContent = a["subtitulo"] || "Catálogo";
  if ($("logoText")) $("logoText").textContent = a["siglas"] || "SDC";
}

/* ================= CATEGORIES ================= */
function categoriesList() {
  let cats = [];
  if (DATA && Array.isArray(DATA.categorias) && DATA.categorias.length) {
    cats = DATA.categorias
      .filter((c) => String(c.visible ?? 1) === "1" || c.visible === 1 || c.visible === true)
      .sort((a, b) => Number(a.orden || 999999) - Number(b.orden || 999999))
      .map((c) => safe(c.categoria))
      .filter(Boolean);
  } else {
    cats = [...new Set(PRODUCTS.map((p) => p.categoria).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  }
  const out = [];
  if (PRODUCTS.some(isOffer)) out.push("OFERTAS");
  cats.forEach((c) => { if (c && String(c).toUpperCase() !== "OFERTAS") out.push(c); });
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
  all.onclick = () => {
    CURRENT_CAT = null;
    CURRENT_SUB = null;
    renderCategories();
    renderSubcategories();
    renderProducts();
  };
  bar.appendChild(all);

  categoriesList().forEach((cat) => {
    const b = document.createElement("button");
    b.className = "pill" + (CURRENT_CAT === cat ? " active" : "");
    b.textContent = cat;
    b.onclick = () => {
      CURRENT_CAT = cat;
      CURRENT_SUB = null;
      renderCategories();
      renderSubcategories();
      renderProducts();
    };
    bar.appendChild(b);
  });
}
function renderSubcategories() {
  const bar = $("subcategories");
  bar.innerHTML = "";

  const subs = subcategoriesList(CURRENT_CAT);
  if (!CURRENT_CAT || CURRENT_CAT === "OFERTAS" || subs.length === 0) {
    bar.style.display = "none";
    return;
  }
  bar.style.display = "flex";

  const all = document.createElement("button");
  all.className = "pill" + (!CURRENT_SUB ? " active" : "");
  all.textContent = "Todas";
  all.onclick = () => {
    CURRENT_SUB = null;
    renderSubcategories();
    renderProducts();
  };
  bar.appendChild(all);

  subs.forEach((sc) => {
    const b = document.createElement("button");
    b.className = "pill" + (CURRENT_SUB === sc ? " active" : "");
    b.textContent = sc;
    b.onclick = () => {
      CURRENT_SUB = sc;
      renderSubcategories();
      renderProducts();
    };
    bar.appendChild(b);
  });
}

/* ================= PRODUCTS ================= */
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

  list.sort((a, b) => {
    const av = a.stock > 0 ? 0 : 1;
    const bv = b.stock > 0 ? 0 : 1;
    if (av !== bv) return av - bv;
    const ao = Number(a.orden || 999999);
    const bo = Number(b.orden || 999999);
    if (ao !== bo) return ao - bo;
    return (a.nombre || "").localeCompare(b.nombre || "");
  });

  return list;
}

/* Ver detalles infalible: onclick inline */
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
    const offer = isOffer(p);
    const out = isOut(p);

    const card = document.createElement("article");
    card.className = "card";

    const btnHTML = out
      ? `<button class="btnDisabled" disabled>Agotado</button>`
      : `<button class="bp" type="button" onclick="window.__openProduct('${p.id}')">Ver detalles</button>`;

    card.innerHTML = `
      ${offer ? `<div class="tagOffer">OFERTA</div>` : ""}
      <img src="${p.imagen || ""}" alt="">
      <div class="cardBody">
        <div class="cardTitle">${p.nombre}</div>
        <div class="cardDesc">${p.descripcion || p.subcategoria || ""}</div>
        <div class="pr"><div class="p">${money(p.precio)}</div>${offer ? `<div class="o">${money(p.precio_anterior)}</div>` : ""}</div>
        ${btnHTML}
      </div>
      ${out ? `<div class="tagOut">AGOTADO</div>` : ""}
    `;

    if (!out) {
      card.addEventListener("click", (e) => {
        if (e.target.closest("button")) return;
        openProduct(p.id);
      });
    }

    grid.appendChild(card);
  });
}

/* ================= PRODUCT MODAL ================= */
function parseGallery(p) {
  const urls = [];
  if (p.imagen) urls.push(p.imagen);
  for (let i = 1; i <= 8; i++) {
    const k = "galeria_" + i;
    if (p[k]) urls.push(p[k]);
  }
  if (p.galeria) {
    String(p.galeria).split(",").map((x) => x.trim()).filter(Boolean).forEach((u) => urls.push(u));
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
function openProduct(pid) {
  const p = BY_ID[pid];
  if (!p) return;
  CURRENT = p;

  $("modalName").textContent = p.nombre || "Producto";
  $("modalSub").textContent = `${p.categoria || ""}${p.subcategoria ? " · " + p.subcategoria : ""}`;
  $("modalPrice").textContent = money(p.precio || 0);
  $("modalOld").textContent = isOffer(p) ? money(p.precio_anterior) : "";
  $("modalDesc").textContent = p.descripcion || "";

  const gallery = parseGallery(p);
  $("modalMainImg").src = gallery[0] || "";

  const thumbs = $("modalThumbs");
  thumbs.innerHTML = "";
  if (gallery.length <= 1) {
    thumbs.classList.add("hidden");
  } else {
    thumbs.classList.remove("hidden");
    gallery.forEach((src, idx) => {
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

/* ================= HONDURAS: DEPTOS + MUNICIPIOS ================= */
function hnDepartamentos() {
  const rows = Array.isArray(DATA?.municipios_hn) ? DATA.municipios_hn : [];
  const set = new Set(rows.map((r) => safe(r.departamento)).filter(Boolean));
  return [...set].sort((a, b) => a.localeCompare(b));
}
function hnMunicipios(depto) {
  const rows = Array.isArray(DATA?.municipios_hn) ? DATA.municipios_hn : [];
  return rows
    .filter((r) => safe(r.departamento) === depto)
    .map((r) => safe(r.municipio))
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
}

/* ================= COMAYAGUA ZONAS ================= */
function zonasRows() {
  return Array.isArray(DATA?.zonas_comayagua_ciudad) ? DATA.zonas_comayagua_ciudad : [];
}
function zonasUnicas() {
  const set = new Set(zonasRows().map((r) => safe(r.zona)).filter(Boolean));
  return [...set];
}
function coloniasPorZona(zona) {
  return zonasRows()
    .filter((r) => safe(r.zona) === zona)
    .map((r) => ({
      colonia_barrio: safe(r.colonia_barrio),
      costo: Number(r.costo || 0),
      referencia: safe(r.referencia),
    }))
    .filter((x) => x.colonia_barrio);
}

/* ================= STEP 2 UI ================= */
function ensureEntregaUI() {
  const step2 = $("step2");
  if (!step2) return;
  if ($("deptoSelect")) return;

  step2.innerHTML = `
    <div class="tx"><b>Ubicación (Honduras)</b></div>

    <div class="tx">Departamento</div>
    <select id="deptoSelect"><option value="">Selecciona departamento</option></select>

    <div class="tx">Municipio</div>
    <select id="muniSelect" disabled><option value="">Selecciona municipio</option></select>

    <div id="domicilioBlock" class="hidden">
      <div class="tx"><b>Entrega a domicilio</b></div>

      <div id="comayaguaZonasBlock" class="hidden">
        <div class="tx">Comayagua ciudad: elige zona y colonia/barrio</div>
        <select id="zonaSelect"><option value="">Selecciona zona</option></select>
        <select id="coloniaSelect"><option value="">Selecciona colonia/barrio</option></select>
        <div class="tx" id="zonaInfo"></div>
      </div>

      <div id="muniInfo" class="tx hidden"></div>
    </div>

    <div id="empresaBlock" class="hidden">
      <div class="tx"><b>Envío por empresa</b></div>
      <select id="empresaSelect"></select>
      <select id="modalidadSelect">
        <option value="normal">Normal (anticipado)</option>
        <option value="pagar_al_recibir">Pagar al recibir</option>
      </select>
      <div class="tx" id="empresaInfo"></div>
    </div>

    <div id="busBlock" class="hidden">
      <div class="tx"><b>Bus / encomienda</b> (costo varía 80–150)</div>
    </div>

    <div class="tx" style="margin-top:12px"><b>Datos</b></div>
    <input id="custName" placeholder="Tu nombre">
    <input id="custPhone" placeholder="Ej: 9999-9999">
    <textarea id="custAddr" placeholder="Dirección / Referencia"></textarea>

    <div class="tx" style="margin-top:12px"><b>Método de pago</b></div>
    <select id="pagoSelect"><option value="">Selecciona método</option></select>

    <div id="efectivoBlock" class="hidden">
      <input id="efectivoCon" placeholder="¿Con cuánto pagará? (solo domicilio)" inputmode="numeric">
      <div class="tx" id="cambioInfo"></div>
    </div>
  `;

  // empresas
  const emp = $("empresaSelect");
  EMPRESAS_ENVIO.forEach((x) => {
    const o = document.createElement("option");
    o.value = x; o.textContent = x;
    emp.appendChild(o);
  });

  // deptos
  const ds = $("deptoSelect");
  hnDepartamentos().forEach((d) => {
    const o = document.createElement("option");
    o.value = d; o.textContent = d;
    ds.appendChild(o);
  });

  // listeners
  $("deptoSelect").addEventListener("change", () => {
    CHECKOUT.departamento = $("deptoSelect").value;
    fillMunicipios();
    applyEntregaRules();
  });
  $("muniSelect").addEventListener("change", () => {
    CHECKOUT.municipio = $("muniSelect").value;
    applyEntregaRules();
  });

  $("zonaSelect").addEventListener("change", () => {
    CHECKOUT.zona = $("zonaSelect").value;
    fillColonias();
  });
  $("coloniaSelect").addEventListener("change", () => {
    const opt = $("coloniaSelect").selectedOptions[0];
    CHECKOUT.colonia_barrio = opt?.value || "";
    CHECKOUT.envio_costo = Number(opt?.dataset.costo || 0);
    CHECKOUT.referencia = opt?.dataset.ref || "";
    $("zonaInfo").textContent =
      CHECKOUT.colonia_barrio
        ? `Costo: ${money(CHECKOUT.envio_costo)}${CHECKOUT.referencia ? " · " + CHECKOUT.referencia : ""}`
        : "";
    updateTotals();
    updateCambio();
  });

  $("empresaSelect").addEventListener("change", () => {
    CHECKOUT.empresa_envio = $("empresaSelect").value;
    updateEmpresaInfo();
  });
  $("modalidadSelect").addEventListener("change", () => {
    CHECKOUT.modalidad_envio = $("modalidadSelect").value;
    updateEmpresaInfo();
    fillPagos();
    updateTotals();
  });

  $("pagoSelect").addEventListener("change", () => {
    CHECKOUT.pago_metodo = $("pagoSelect").value;
    updatePagoUI();
    updateCambio();
  });

  $("efectivoCon").addEventListener("input", () => {
    CHECKOUT.efectivo_con = Number(String($("efectivoCon").value || "").replace(/[^\d]/g, "") || 0);
    updateCambio();
  });

  // init
  CHECKOUT.departamento = "";
  CHECKOUT.municipio = "";
  applyEntregaRules();
}

function fillMunicipios() {
  const depto = $("deptoSelect").value;
  const ms = $("muniSelect");
  ms.innerHTML = `<option value="">Selecciona municipio</option>`;
  ms.disabled = !depto;
  if (!depto) return;

  hnMunicipios(depto).forEach((m) => {
    const o = document.createElement("option");
    o.value = m; o.textContent = m;
    ms.appendChild(o);
  });
  ms.disabled = false;
}

function fillZonas() {
  const zs = $("zonaSelect");
  zs.innerHTML = `<option value="">Selecciona zona</option>`;
  const zones = zonasUnicas();
  const order = ["centrica", "alejada", "fuera"];
  zones.sort((a,b)=>order.indexOf(a)-order.indexOf(b));
  zones.forEach((z) => {
    const o = document.createElement("option");
    o.value = z; o.textContent = z;
    zs.appendChild(o);
  });
}

function fillColonias() {
  const zona = $("zonaSelect").value;
  const cs = $("coloniaSelect");
  cs.innerHTML = `<option value="">Selecciona colonia/barrio</option>`;
  if (!zona) return;

  coloniasPorZona(zona).forEach((c) => {
    const o = document.createElement("option");
    o.value = c.colonia_barrio;
    o.textContent = `${c.colonia_barrio} (${money(c.costo)})`;
    o.dataset.costo = String(c.costo || 0);
    o.dataset.ref = c.referencia || "";
    cs.appendChild(o);
  });
}

function applyEntregaRules() {
  const depto = safe(CHECKOUT.departamento);
  const muni = safe(CHECKOUT.municipio);

  // reset visibles
  $("domicilioBlock")?.classList.add("hidden");
  $("comayaguaZonasBlock")?.classList.add("hidden");
  $("empresaBlock")?.classList.add("hidden");
  $("busBlock")?.classList.add("hidden");
  $("muniInfo")?.classList.add("hidden");

  // reset checkout
  CHECKOUT.entrega_tipo = "";
  CHECKOUT.zona = "";
  CHECKOUT.colonia_barrio = "";
  CHECKOUT.referencia = "";
  CHECKOUT.envio_costo = 0;
  CHECKOUT.empresa_envio = "";
  CHECKOUT.modalidad_envio = "";
  CHECKOUT.pago_metodo = "";
  CHECKOUT.efectivo_con = 0;
  CHECKOUT.cambio = 0;

  // sin depto/muni
  if (!depto || !muni) {
    fillPagos();
    updateTotals();
    return;
  }

  // Comayagua ciudad
  if (depto === "Comayagua" && muni === "Comayagua") {
    CHECKOUT.entrega_tipo = "domicilio_ciudad";
    $("domicilioBlock").classList.remove("hidden");
    $("comayaguaZonasBlock").classList.remove("hidden");
    fillZonas();
    $("coloniaSelect").innerHTML = `<option value="">Selecciona colonia/barrio</option>`;
    $("zonaInfo").textContent = "Elige zona y colonia para calcular el costo.";
    fillPagos();
    updateTotals();
    return;
  }

  // Municipios con domicilio
  if (MUNICIPIOS_DOMICILIO.has(muni) && (depto === "Comayagua" || depto === "La Paz")) {
    CHECKOUT.entrega_tipo = "domicilio_muni";
    $("domicilioBlock").classList.remove("hidden");
    $("muniInfo").classList.remove("hidden");
    $("muniInfo").textContent = `Entrega a domicilio disponible en ${muni}. (Costo a definir)`;
    CHECKOUT.envio_costo = 0; // si luego quieres tarifa por municipio, lo conectamos a una hoja
    fillPagos();
    updateTotals();
    return;
  }

  // otros -> empresa + bus opcional
  CHECKOUT.entrega_tipo = "empresa";
  $("empresaBlock").classList.remove("hidden");
  if (PERMITE_BUS_LOCAL) $("busBlock").classList.remove("hidden");
  CHECKOUT.empresa_envio = EMPRESAS_ENVIO[0];
  $("empresaSelect").value = CHECKOUT.empresa_envio;
  CHECKOUT.modalidad_envio = $("modalidadSelect").value || "normal";
  updateEmpresaInfo();
  fillPagos();
  updateTotals();
}

function updateEmpresaInfo() {
  CHECKOUT.empresa_envio = $("empresaSelect").value;
  CHECKOUT.modalidad_envio = $("modalidadSelect").value;

  // costos default (luego lo hacemos editable en Sheets)
  const costoNormal = 110;
  const costoContra = 170;

  CHECKOUT.envio_costo = CHECKOUT.modalidad_envio === "pagar_al_recibir" ? costoContra : costoNormal;

  $("empresaInfo").textContent =
    `Empresa: ${CHECKOUT.empresa_envio} · ${CHECKOUT.modalidad_envio === "normal" ? "Normal" : "Pagar al recibir"} · Costo: ${money(CHECKOUT.envio_costo)}`;

  updateTotals();
}

function fillPagos() {
  const sel = $("pagoSelect");
  sel.innerHTML = `<option value="">Selecciona método</option>`;

  const domicilio = CHECKOUT.entrega_tipo === "domicilio_ciudad" || CHECKOUT.entrega_tipo === "domicilio_muni";

  if (domicilio) {
    addPayOpt("efectivo", "Efectivo (pagar al recibir)");
    addPayOpt("transferencia", "Transferencia bancaria");
    addPayOpt("paypal", "PayPal");
    addPayOpt("tigo_money", "Tigo Money");
  } else {
    addPayOpt("transferencia", "Transferencia bancaria");
    addPayOpt("paypal", "PayPal");
    addPayOpt("tigo_money", "Tigo Money");
    addPayOpt("pagar_al_recibir", "Pagar al recibir");
  }

  function addPayOpt(val, label) {
    const o = document.createElement("option");
    o.value = val;
    o.textContent = label;
    sel.appendChild(o);
  }

  updatePagoUI();
}

function updatePagoUI() {
  const domicilio = CHECKOUT.entrega_tipo === "domicilio_ciudad" || CHECKOUT.entrega_tipo === "domicilio_muni";
  const metodo = $("pagoSelect").value;
  CHECKOUT.pago_metodo = metodo;

  if (domicilio && metodo === "efectivo") {
    $("efectivoBlock").classList.remove("hidden");
  } else {
    $("efectivoBlock").classList.add("hidden");
    CHECKOUT.efectivo_con = 0;
    CHECKOUT.cambio = 0;
    if ($("efectivoCon")) $("efectivoCon").value = "";
    if ($("cambioInfo")) $("cambioInfo").textContent = "";
  }
}

function updateCambio() {
  const domicilio = CHECKOUT.entrega_tipo === "domicilio_ciudad" || CHECKOUT.entrega_tipo === "domicilio_muni";
  if (!domicilio) return;
  if (CHECKOUT.pago_metodo !== "efectivo") return;

  const total = cartSubtotal() + Number(CHECKOUT.envio_costo || 0);
  const con = Number(CHECKOUT.efectivo_con || 0);
  const diff = con - total;
  CHECKOUT.cambio = diff > 0 ? diff : 0;

  if (con <= 0) {
    $("cambioInfo").textContent = "Escribe con cuánto pagará para calcular el cambio.";
  } else if (diff < 0) {
    $("cambioInfo").textContent = `Faltan ${money(Math.abs(diff))} para completar el total.`;
  } else {
    $("cambioInfo").textContent = `Cambio estimado: ${money(diff)}.`;
  }
}

/* ========================= CART UI ========================= */
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
          <button class="minus" title="Quitar">-</button>
          <span class="qtyNum">${it.qty}</span>
          <button class="plus" title="Agregar">+</button>
          <button class="trash" title="Eliminar">🗑</button>
        </div>
      </div>
    `;

    row.querySelector(".minus").onclick = () => {
      it.qty = Math.max(1, it.qty - 1);
      saveCart(); renderCart(); updateTotals();
    };
    row.querySelector(".plus").onclick = () => {
      const stock = Number(p.stock || 0);
      if (stock > 0 && it.qty + 1 > stock) return alert("Stock disponible: " + stock);
      it.qty++;
      saveCart(); renderCart(); updateTotals();
    };
    row.querySelector(".trash").onclick = () => {
      CART.splice(idx, 1);
      saveCart(); renderCart(); updateTotals();
    };

    list.appendChild(row);
  });

  updateTotals();
}

function updateTotals() {
  const sub = cartSubtotal();
  $("subTotal").textContent = money(sub);
  $("shipTotal").textContent = money(CHECKOUT.envio_costo || 0);
  $("grandTotal").textContent = money(sub + Number(CHECKOUT.envio_costo || 0));
  updateCambio();
}

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

function sendWhatsApp() {
  if (!CART.length) return alert("Carrito vacío");

  const name = safe($("custName").value);
  const phone = safe($("custPhone").value);
  const addr = safe($("custAddr").value);

  const total = cartSubtotal() + Number(CHECKOUT.envio_costo || 0);

  const lines = [];
  lines.push("🛒 PEDIDO - SDComayagua", "");

  if (name) lines.push("👤 " + name);
  if (phone) lines.push("📞 " + phone);
  if (CHECKOUT.departamento && CHECKOUT.municipio) lines.push(`📍 ${CHECKOUT.departamento} / ${CHECKOUT.municipio}`);

  if (CHECKOUT.entrega_tipo === "domicilio_ciudad") {
    lines.push("🚚 Entrega a domicilio (Comayagua ciudad)");
    if (CHECKOUT.zona) lines.push("Zona: " + CHECKOUT.zona);
    if (CHECKOUT.colonia_barrio) lines.push("Colonia/Barrio: " + CHECKOUT.colonia_barrio);
  } else if (CHECKOUT.entrega_tipo === "domicilio_muni") {
    lines.push("🚚 Entrega a domicilio (municipio cercano)");
  } else {
    lines.push(`📦 Envío por empresa: ${CHECKOUT.empresa_envio || "Por definir"}`);
    if (CHECKOUT.modalidad_envio) lines.push("Modalidad: " + CHECKOUT.modalidad_envio);
    if (PERMITE_BUS_LOCAL) lines.push("🚌 Bus/encomienda disponible (80–150 varía).");
  }

  if (addr) lines.push("📌 " + addr);

  lines.push("");
  lines.push("Productos:");
  CART.forEach((it) => {
    const p = BY_ID[it.id];
    if (p) lines.push(`- ${it.qty} x ${p.nombre} (${money(p.precio)})`);
  });

  lines.push("");
  lines.push("Envío: " + money(CHECKOUT.envio_costo || 0));
  lines.push("Total: " + money(total));

  if (CHECKOUT.pago_metodo) lines.push("Pago: " + CHECKOUT.pago_metodo);
  if (CHECKOUT.pago_metodo === "efectivo") {
    lines.push("Efectivo con: " + money(CHECKOUT.efectivo_con || 0));
    lines.push("Cambio: " + money(CHECKOUT.cambio || 0));
  }

  const a = ajustesMap();
  const wa = (a.whatsapp_numero || WA_DEFAULT).replace(/\D/g, "");
  window.open(`https://wa.me/${wa}?text=${encodeURIComponent(lines.join("\n"))}`, "_blank");
}

/* ========================= EVENTS ========================= */
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
      setStep(2); return;
    }
    if (STEP === 2) {
      // validar ubicación básica
      if (!CHECKOUT.departamento || !CHECKOUT.municipio) return alert("Selecciona departamento y municipio.");
      // si Comayagua ciudad, debe elegir colonia
      if (CHECKOUT.entrega_tipo === "domicilio_ciudad" && (!CHECKOUT.zona || !CHECKOUT.colonia_barrio)) {
        return alert("Elige zona y colonia/barrio para calcular el costo.");
      }
      // datos
      const name = safe($("custName").value);
      const addr = safe($("custAddr").value);
      if (name.length < 3) return alert("Escribe tu nombre");
      if (addr.length < 6) return alert("Escribe tu dirección / referencia");
      if (!CHECKOUT.pago_metodo) return alert("Selecciona método de pago.");
      if (CHECKOUT.pago_metodo === "efectivo" && CHECKOUT.efectivo_con <= 0) return alert("Escribe con cuánto pagará.");
      setStep(3); return;
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

/* ========================= INIT ========================= */
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
        orden: Number(p.orden || 999999),
        video: safe(p.video || p.video_url || ""),
        galeria: safe(p.galeria || ""),
        galeria_1: safe(p.galeria_1 || ""),
        galeria_2: safe(p.galeria_2 || ""),
        galeria_3: safe(p.galeria_3 || ""),
        galeria_4: safe(p.galeria_4 || ""),
        galeria_5: safe(p.galeria_5 || ""),
        galeria_6: safe(p.galeria_6 || ""),
        galeria_7: safe(p.galeria_7 || ""),
        galeria_8: safe(p.galeria_8 || ""),
      }))
      .filter((p) => p.id && p.nombre);

    BY_ID = {};
    PRODUCTS.forEach((p) => (BY_ID[p.id] = p));

    applyAjustes();
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

/* =========================
   SDC TIENDA - app.js FULL (con efectivo + cambio estimado)
========================= */

let DB = {
  productos: [],
  categorias: [],
  subcategorias: [],
  ajustes: [],
  pagos: [],
  municipios_hn: [],
  cobertura_entrega: [],
  zonas_comayagua_ciudad: [],
  tarifas_entrega_propia: [],
  empresas_envio: [],
  bus_local_tarifas: [],
};

let STATE = { categoria: "Todas", subcategoria: "Todas", query: "" };

const $ = (id) => document.getElementById(id);
function fmtLps(n){ return `Lps. ${Number(n||0).toFixed(0)}`; }
function s(v){ return (v===null || v===undefined) ? "" : String(v).trim(); }
function n(v){ const x=Number(v); return Number.isFinite(x)?x:0; }
function pick(obj, keys, fallback=""){
  for (const k of keys){
    if (obj && obj[k] !== undefined && obj[k] !== null && String(obj[k]).trim() !== "") return obj[k];
  }
  return fallback;
}
function eq(a,b){ return s(a).toLowerCase() === s(b).toLowerCase(); }
async function copyText(txt){
  try{ await navigator.clipboard.writeText(txt); alert("Enlace copiado"); }
  catch{ alert("No se pudo copiar"); }
}

/* -------------------------
   Hash share
-------------------------- */
function setHash(cat, sub){
  let h = `#cat=${encodeURIComponent(cat||"Todas")}`;
  if (sub && sub !== "Todas") h += `&sub=${encodeURIComponent(sub)}`;
  history.replaceState(null, "", location.pathname + location.search + h);
}
function parseHash(){
  const h = (location.hash||"").replace("#","");
  const p = new URLSearchParams(h);
  return { cat: p.get("cat"), sub: p.get("sub") };
}

/* -------------------------
   Tema
-------------------------- */
function setTheme(next){
  document.body.classList.toggle("light", next === "light");
  localStorage.setItem("sdc_theme", next);
  const b = $("btnTheme");
  if (b) b.textContent = next === "light" ? "🌙" : "☀️";
}

/* -------------------------
   Loading UI
-------------------------- */
let LOADING_TIMER=null;
function showSkeleton(){
  const grid = $("grid");
  if (!grid) return;

  grid.innerHTML = `
    <div class="loadingWrap fadeIn">
      <div class="loadingTitle" id="loadingTitle">Cargando catálogo…</div>
      <div class="loadingSub" id="loadingSub">Estamos preparando los productos de Soluciones Digitales Comayagua.</div>
      <div class="spinner"></div>
    </div>

    <div class="skelGrid fadeIn">
      ${Array.from({ length: 8 }, () => `
        <div class="skelCard">
          <div class="skelImg"></div>
          <div class="skelBody">
            <div class="skelLine lg"></div>
            <div class="skelLine md"></div>
            <div class="skelLine sm"></div>
          </div>
        </div>
      `).join("")}
    </div>
  `;
}
function startLoadingMessageSwap(){
  if (LOADING_TIMER) clearTimeout(LOADING_TIMER);
  LOADING_TIMER=setTimeout(()=>{
    const t=$("loadingTitle"), s=$("loadingSub");
    if (t) t.textContent="Sigue cargando…";
    if (s) s.textContent="Si no aparece en unos segundos, recarga la página o escríbenos por WhatsApp.";
  },4000);
}
function stopLoadingMessageSwap(){
  if (LOADING_TIMER) clearTimeout(LOADING_TIMER);
  LOADING_TIMER=null;
}

/* -------------------------
   Normalizar datos
-------------------------- */
function normalizeProduct(p){
  const out = {
    id: s(pick(p, ["id","ID"])),
    nombre: s(pick(p, ["nombre","name"])),
    precio: n(pick(p, ["precio","price"], 0)),
    precio_anterior: n(pick(p, ["precio_anterior","precioAnterior","old_price"], 0)),
    stock: n(pick(p, ["stock"], 0)),
    categoria: s(pick(p, ["categoria"], "General")) || "General",
    subcategoria: s(pick(p, ["subcategoria"], "")),
    imagen: s(pick(p, ["imagen"], "")),
    descripcion: s(pick(p, ["descripcion"], "")),
    orden: n(pick(p, ["orden"], 0)),
    video: s(pick(p, ["video","video_url","video_tiktok","video_facebook","video_youtube"], "")),
  };

  // Galería CSV o galeria_1..8
  if (p.galeria && !p.galeria_1){
    const parts = s(p.galeria).split(",").map(x=>x.trim()).filter(Boolean);
    for (let i=1;i<=8;i++) out[`galeria_${i}`] = parts[i-1] || "";
  } else {
    for (let i=1;i<=8;i++) out[`galeria_${i}`] = s(p[`galeria_${i}`]);
  }

  return out;
}

function ajustesMap(){
  const map = {};
  (DB.ajustes||[]).forEach(r=>{
    const k = s(r.clave);
    const v = s(r.valor);
    if (k) map[k]=v;
  });
  return map;
}

function applyAjustes(){
  const a = ajustesMap();
  if ($("storeName")) $("storeName").textContent = a["nombre_tienda"] || "Soluciones Digitales Comayagua";
  if ($("storeSub")) $("storeSub").textContent = a["subtitulo"] || "Catálogo";
  if ($("logoText")) $("logoText").textContent = a["siglas"] || "SDC";
  if ($("footerBrand")) $("footerBrand").textContent = a["siglas"] || "SDC";

  const aviso = [a["aviso_precios"], a["aviso_stock"], a["aviso_envio"]].filter(Boolean).join(" ");
  if ($("footerInfo")) $("footerInfo").textContent = aviso || $("footerInfo").textContent;

  const wa = (a["whatsapp_numero"] || "50431517755").replace(/\D/g,"");
  const msg = a["mensaje_whatsapp"] || "Hola, quiero consultar el catálogo.";
  if ($("waFloat")) $("waFloat").href = `https://wa.me/${wa}?text=${encodeURIComponent(msg)}`;

  if ($("year")) $("year").textContent = new Date().getFullYear();
}

/* -------------------------
   Categorías + Subcategorías
-------------------------- */
function getCategorias(){
  let cats = [];
  if (DB.categorias && DB.categorias.length){
    cats = DB.categorias
      .filter(c => String(pick(c,["visible"],1)) === "1" || pick(c,["visible"],1) === 1)
      .sort((a,b)=>n(pick(a,["orden"],0))-n(pick(b,["orden"],0)))
      .map(c=>s(pick(c,["categoria"],"")))
      .filter(Boolean);
  } else {
    cats = Array.from(new Set(DB.productos.map(p=>p.categoria))).filter(Boolean).sort((a,b)=>a.localeCompare(b));
  }
  return ["Todas", ...cats.filter(c=>c && c!=="Todas")];
}

let lastTapCat = { name:null, t:0 };

function renderCategorias(){
  const chips = $("chips");
  if (!chips) return;
  chips.innerHTML = "";

  getCategorias().forEach(c=>{
    const b = document.createElement("button");
    b.className = "chip" + (STATE.categoria===c ? " active" : "");
    b.textContent = c;

    b.onclick = async ()=>{
      const now = Date.now();
      if (lastTapCat.name===c && (now-lastTapCat.t) < 650){
        await copyText(location.origin + location.pathname + `#cat=${encodeURIComponent(c)}`);
        lastTapCat = {name:null,t:0};
        return;
      }
      lastTapCat = {name:c,t:now};

      STATE.categoria = c;
      STATE.subcategoria = "Todas";
      renderCategorias();
      renderSubcategorias();
      renderProductos();

      if ($("btnShareCategory")) $("btnShareCategory").style.display = (c==="Todas") ? "none" : "inline-flex";
      if ($("btnShareSubcat")) $("btnShareSubcat").style.display = "none";

      setHash(c, "Todas");
    };

    chips.appendChild(b);
  });
}

function getSubcategoriasDeCategoria(cat){
  // Si existe hoja subcategorias -> ordenada
  if (DB.subcategorias && DB.subcategorias.length){
    return DB.subcategorias
      .filter(r => (cat==="Todas" ? true : eq(pick(r,["categoria"]), cat)))
      .filter(r => String(pick(r,["visible"],1))==="1" || pick(r,["visible"],1)===1)
      .sort((a,b)=>n(pick(a,["orden"],0))-n(pick(b,["orden"],0)))
      .map(r=>s(pick(r,["subcategoria"],"")))
      .filter(Boolean);
  }

  // fallback: detectar desde productos
  const set = new Set();
  DB.productos.forEach(p=>{
    if (cat !== "Todas" && p.categoria !== cat) return;
    if (p.subcategoria) set.add(p.subcategoria);
  });
  return Array.from(set).sort((a,b)=>a.localeCompare(b));
}

function renderSubcategorias(){
  const sub = $("subchips");
  if (!sub) return;

  if (STATE.categoria==="Todas"){
    sub.style.display="none";
    sub.innerHTML="";
    STATE.subcategoria="Todas";
    if ($("btnShareSubcat")) $("btnShareSubcat").style.display="none";
    return;
  }

  const subs = getSubcategoriasDeCategoria(STATE.categoria);
  if (!subs.length){
    sub.style.display="none";
    sub.innerHTML="";
    STATE.subcategoria="Todas";
    if ($("btnShareSubcat")) $("btnShareSubcat").style.display="none";
    return;
  }

  sub.style.display="flex";
  sub.innerHTML="";

  const all = document.createElement("button");
  all.className = "chip subchip" + (STATE.subcategoria==="Todas" ? " active" : "");
  all.textContent = "Todas";
  all.onclick = ()=>{
    STATE.subcategoria="Todas";
    renderSubcategorias();
    renderProductos();
    if ($("btnShareSubcat")) $("btnShareSubcat").style.display="none";
    setHash(STATE.categoria,"Todas");
  };
  sub.appendChild(all);

  subs.forEach(sc=>{
    const b = document.createElement("button");
    b.className = "chip subchip" + (STATE.subcategoria===sc ? " active" : "");
    b.textContent = sc;
    b.onclick = ()=>{
      STATE.subcategoria = sc;
      renderSubcategorias();
      renderProductos();
      if ($("btnShareSubcat")) $("btnShareSubcat").style.display="inline-flex";
      setHash(STATE.categoria, sc);
    };
    sub.appendChild(b);
  });
}

/* -------------------------
   Productos
-------------------------- */
function filteredProductos(){
  const q = STATE.query.trim().toLowerCase();
  return DB.productos
    .filter(p => STATE.categoria==="Todas" ? true : p.categoria===STATE.categoria)
    .filter(p => STATE.subcategoria==="Todas" ? true : p.subcategoria===STATE.subcategoria)
    .filter(p => !q ? true : (
      p.nombre.toLowerCase().includes(q) ||
      p.descripcion.toLowerCase().includes(q) ||
      p.subcategoria.toLowerCase().includes(q)
    ))
    .sort((a,b)=>{
      const av = a.stock>0 ? 0 : 1;
      const bv = b.stock>0 ? 0 : 1;
      if (av!==bv) return av-bv;
      if ((a.orden||0)!==(b.orden||0)) return (a.orden||0)-(b.orden||0);
      return a.nombre.localeCompare(b.nombre);
    });
}

function productCard(p){
  const card = document.createElement("div");
  card.className = "card";

  const isOut = p.stock <= 0;
  const isOffer = p.precio_anterior > p.precio;

  if (isOut) card.classList.add("isOut");

  if (isOffer){
    const tag = document.createElement("div");
    tag.className = "offerTag";
    tag.textContent = "OFERTA";
    card.appendChild(tag);
  }

  const imgSrc = p.imagen || "assets/img/no-image.png";

  card.innerHTML += `
    <img class="cardImg" src="${imgSrc}" alt=""
      onerror="this.onerror=null; this.src='assets/img/no-image.png';">
    <div class="cardBody">
      <div class="cardName">${p.nombre}</div>
      <div class="cardDesc">${p.descripcion || p.subcategoria || p.categoria}</div>
      <div class="priceRow">
        <div class="price ${isOffer ? "offer":""}">${fmtLps(p.precio)}</div>
        <div class="old">${isOffer ? fmtLps(p.precio_anterior) : ""}</div>
      </div>
      <div class="cardActions">
        <button class="btn btnPrimary btnFull" ${isOut?"disabled":""}>${isOut?"Agotado":"Ver detalles"}</button>
      </div>
    </div>
  `;

  if (isOut){
    const wm = document.createElement("div");
    wm.className = "watermark";
    wm.textContent = "AGOTADO";
    card.appendChild(wm);
  }

  card.onclick = ()=>{ if (window.openProduct) window.openProduct(p); };
  return card;
}

function renderProductos(){
  const grid = $("grid");
  if (!grid) return;
  grid.innerHTML = "";

  const list = filteredProductos();

  const labelCat = (STATE.categoria==="Todas") ? "Productos" : STATE.categoria;
  const labelSub = (STATE.subcategoria!=="Todas") ? ` · ${STATE.subcategoria}` : "";
  if ($("sectionTitle")) $("sectionTitle").textContent = `${labelCat}${labelSub} (${list.length})`;

  if (!list.length){
    const empty = document.createElement("div");
    empty.style.color="var(--muted)";
    empty.style.padding="10px 2px";
    empty.textContent="No hay productos en esta sección.";
    grid.appendChild(empty);
    return;
  }

  list.forEach(p=>grid.appendChild(productCard(p)));
}

/* -------------------------
   Carrito real (stock limitado)
-------------------------- */
const CART_KEY="sdc_cart_full_v2";
let CART = [];

function loadCart(){ try{ CART = JSON.parse(localStorage.getItem(CART_KEY)||"[]"); }catch{ CART=[]; } }
function saveCart(){ localStorage.setItem(CART_KEY, JSON.stringify(CART)); }
function cartCount(){ return CART.reduce((a,it)=>a+it.qty,0); }
function updateCartBadge(){ if ($("cartCount")) $("cartCount").textContent = String(cartCount()); }
function getStockById(id){
  const p = DB.productos.find(x => String(x.id) === String(id));
  return p ? Number(p.stock||0) : 0;
}
function cartSubtotal(){ return CART.reduce((a,it)=>a + (n(it.precio)*n(it.qty)), 0); }

function addToCart(p){
  const id = String(p.id);
  const maxStock = Number(p.stock||0);

  if (maxStock <= 0){
    alert("Este producto está agotado.");
    return;
  }

  let it = CART.find(x=>String(x.id)===id);
  if (!it){
    it = { id, nombre:p.nombre, precio:p.precio, imagen:p.imagen, qty:0 };
    CART.push(it);
  }

  if (it.qty + 1 > maxStock){
    alert(`Stock disponible: ${maxStock}.`);
    return;
  }

  it.qty += 1;
  saveCart();
  updateCartBadge();
  renderCart();
  updateTotals();
  updateCashAmountVisibility();
  if (window.openCartModal) window.openCartModal();
}
window.addToCart = addToCart;

function renderCart(){
  const empty=$("cartEmpty"), list=$("cartList");
  if (!empty || !list) return;

  empty.style.display = CART.length ? "none" : "block";
  list.innerHTML = "";

  CART.forEach((it, idx)=>{
    const row=document.createElement("div");
    row.className="cartItem";
    row.innerHTML = `
      <img src="${it.imagen || "assets/img/no-image.png"}"
           onerror="this.onerror=null;this.src='assets/img/no-image.png';">
      <div class="cartMeta">
        <div class="n">${it.nombre}</div>
        <div class="p">${fmtLps(it.precio)} · Cant: ${it.qty}</div>
        <div class="qty">
          <button class="dec">-</button>
          <div>${it.qty}</div>
          <button class="inc">+</button>
          <button class="trash" title="Eliminar">🗑️</button>
        </div>
      </div>
    `;

    row.querySelector(".dec").onclick=()=>{
      it.qty--;
      if (it.qty<=0) CART.splice(idx,1);
      saveCart(); updateCartBadge(); renderCart(); updateTotals(); updateCashAmountVisibility();
    };

    row.querySelector(".inc").onclick=()=>{
      const maxStock = getStockById(it.id);
      if (maxStock<=0){ alert("Este producto está agotado."); return; }
      if (it.qty + 1 > maxStock){ alert(`Stock disponible: ${maxStock}.`); return; }
      it.qty++;
      saveCart(); updateCartBadge(); renderCart(); updateTotals(); updateCashAmountVisibility();
    };

    row.querySelector(".trash").onclick=()=>{
      CART.splice(idx,1);
      saveCart(); updateCartBadge(); renderCart(); updateTotals(); updateCashAmountVisibility();
    };

    list.appendChild(row);
  });

  updateTotals();
}

/* -------------------------
   Ubicación depto/muni
-------------------------- */
function fillSelect(selId, items, placeholder="Selecciona"){
  const sel = $(selId);
  if (!sel) return;
  sel.innerHTML = `<option value="">${placeholder}</option>`;
  items.forEach(x=>{
    const opt = document.createElement("option");
    opt.value = x.value;
    opt.textContent = x.label;
    sel.appendChild(opt);
  });
}

function getDepartamentos(){
  const set = new Set(DB.municipios_hn.map(r=>s(pick(r,["departamento"],""))).filter(Boolean));
  return Array.from(set).sort((a,b)=>a.localeCompare(b));
}
function getMunicipios(dep){
  return DB.municipios_hn
    .filter(r=>eq(pick(r,["departamento"]), dep))
    .map(r=>s(pick(r,["municipio"],"")))
    .filter(Boolean)
    .sort((a,b)=>a.localeCompare(b));
}
function refreshMunicipios(){
  const dep = $("depto")?.value || "";
  const munis = dep ? getMunicipios(dep) : [];
  fillSelect("muni", munis.map(m=>({value:m,label:m})), "Municipio");
}

/* -------------------------
   Cobertura + entrega
-------------------------- */
function findCobertura(dep, muni){
  return DB.cobertura_entrega.find(r =>
    eq(pick(r,["departamento"]), dep) && eq(pick(r,["municipio"]), muni)
  ) || null;
}
function normalizeBool(v){
  const x = s(v).toLowerCase();
  return x==="1" || x==="true" || x==="si" || x==="sí";
}

function buildDeliveryOptions(){
  const dep = $("depto")?.value || "";
  const muni = $("muni")?.value || "";
  const opts = [{value:"", label:"Selecciona tipo de entrega"}];

  if (!dep || !muni) return opts;

  // Comayagua ciudad
  if (eq(dep,"Comayagua") && eq(muni,"Comayagua")){
    opts.push({value:"comayagua_ciudad", label:"Comayagua (ciudad) - entrega local"});
    return opts;
  }

  const cov = findCobertura(dep, muni);

  if (cov){
    if (normalizeBool(pick(cov,["permite_entrega_propia"],"0"))) opts.push({value:"entrega_propia", label:"Entrega propia (cercanos)"});
    if (normalizeBool(pick(cov,["permite_empresa"],"1"))) opts.push({value:"empresa", label:"Empresa de envío"});
    if (normalizeBool(pick(cov,["permite_bus"],"1"))) opts.push({value:"bus", label:"Bus local (encomienda)"});
  } else {
    opts.push({value:"empresa", label:"Empresa de envío"});
    opts.push({value:"bus", label:"Bus local (encomienda)"});
  }

  return opts;
}

function updateDeliveryUI(){
  const t = $("deliveryType")?.value || "";
  $("boxComa") && ($("boxComa").style.display = (t==="comayagua_ciudad") ? "grid" : "none");
  $("boxPropia") && ($("boxPropia").style.display = (t==="entrega_propia") ? "grid" : "none");
  $("boxEmpresa") && ($("boxEmpresa").style.display = (t==="empresa") ? "grid" : "none");
  $("boxBus") && ($("boxBus").style.display = (t==="bus") ? "grid" : "none");

  updatePayOptions();
  updateTotals();
  updateCashAmountVisibility();
}

/* -------------------------
   Pagos + efectivo con cambio
-------------------------- */
function updatePayOptions(){
  const t = $("deliveryType")?.value || "";
  const empresaModalidad = $("empresaModalidad")?.value || "";
  const sel = $("payMethod");
  if (!sel) return;

  const hasFlags = DB.pagos.some(p => p.hasOwnProperty("permite_en_ciudad_comayagua") || p.hasOwnProperty("permite_en_empresa_envio"));

  let allowed = [];
  DB.pagos.forEach(p=>{
    const metodo = s(pick(p,["metodo"],""));
    const titulo = s(pick(p,["titulo"], metodo));
    const activo = normalizeBool(pick(p,["activo"],"1"));
    if (!activo) return;

    if (hasFlags){
      if (t==="comayagua_ciudad" && !normalizeBool(pick(p,["permite_en_ciudad_comayagua"],"1"))) return;
      if (t==="entrega_propia" && !normalizeBool(pick(p,["permite_en_entrega_propia"],"1"))) return;
      if (t==="empresa" && !normalizeBool(pick(p,["permite_en_empresa_envio"],"1"))) return;
      if (t==="bus" && !normalizeBool(pick(p,["permite_en_bus_local"],"1"))) return;
    }

    // empresa normal: no efectivo
    if (t==="empresa" && empresaModalidad==="normal" && metodo==="efectivo") return;

    allowed.push({value:metodo,label:titulo});
  });

  if (!allowed.length) allowed = [{value:"transferencia",label:"Transferencia"}];

  const current = sel.value;
  fillSelect("payMethod", allowed, "Selecciona método de pago");
  if (allowed.some(x=>x.value===current)) sel.value=current;
}

function updateCashAmountVisibility(){
  const delivery = $("deliveryType")?.value || "";
  const pay = $("payMethod")?.value || "";
  const cash = $("cashAmount");
  if (!cash) return;

  const show = (delivery === "comayagua_ciudad" && pay === "efectivo");
  cash.style.display = show ? "block" : "none";
  if (!show) cash.value = "";

  // Mostrar cambio estimado en payInfo si aplica
  updateChangeHint();
}

/* -------------------------
   Envíos + totales
-------------------------- */
function calcShipping(){
  const t = $("deliveryType")?.value || "";
  if (!t) return { text:"Por confirmar", min:0, max:0, isRange:false };

  if (t==="comayagua_ciudad"){
    const zona = $("comaZona")?.value || "";
    if (!zona) return { text:"Por confirmar", min:0, max:0, isRange:false };
    const row = DB.zonas_comayagua_ciudad.find(r=>eq(pick(r,["zona"]), zona));
    const cost = n(pick(row||{},["costo","precio"],0));
    return { text: fmtLps(cost), min:cost, max:cost, isRange:false };
  }

  if (t==="entrega_propia"){
    const lugar = $("propiaLugar")?.value || "";
    if (!lugar) return { text:"Por confirmar", min:0, max:0, isRange:false };
    const row = DB.tarifas_entrega_propia.find(r=>eq(pick(r,["municipio","lugar"]), lugar));
    const cost = n(pick(row||{},["costo","precio"],0));
    return { text: fmtLps(cost), min:cost, max:cost, isRange:false };
  }

  if (t==="empresa"){
    const emp = $("empresa")?.value || "";
    const mod = $("empresaModalidad")?.value || "";
    if (!emp || !mod) return { text:"Por confirmar", min:0, max:0, isRange:false };
    const row = DB.empresas_envio.find(r=>eq(pick(r,["empresa"]), emp) && eq(pick(r,["modalidad"]), mod));
    const cost = n(pick(row||{},["precio","costo"],0));
    return { text: fmtLps(cost), min:cost, max:cost, isRange:false };
  }

  if (t==="bus"){
    const lugar = $("busLugar")?.value || "";
    if (!lugar) return { text:"Por confirmar", min:0, max:0, isRange:false };
    const row = DB.bus_local_tarifas.find(r=>eq(pick(r,["municipio","lugar"]), lugar));
    const mn = n(pick(row||{},["tarifa_min","min","precio_min"],0));
    const mx = n(pick(row||{},["tarifa_max","max","precio_max"],mn));
    return { text: `${fmtLps(mn)} – ${fmtLps(mx)}`, min:mn, max:mx, isRange:true };
  }

  return { text:"Por confirmar", min:0, max:0, isRange:false };
}

function updateTotals(){
  const sub = cartSubtotal();
  const ship = calcShipping();

  $("subTotal") && ($("subTotal").textContent = fmtLps(sub));
  $("shippingCost") && ($("shippingCost").textContent = ship.text);

  const totalMin = sub + ship.min;
  const totalMax = sub + ship.max;

  if ($("grandTotal")){
    $("grandTotal").textContent = ship.isRange ? `${fmtLps(totalMin)} – ${fmtLps(totalMax)}` : fmtLps(totalMin);
  }

  if ($("shipHint")){
    $("shipHint").textContent = ship.isRange
      ? "Bus local: el envío es estimado (rango). Se confirma por WhatsApp antes de enviar."
      : "Tarifas calculadas desde Google Sheets.";
  }

  // info pago
  const pay = $("payMethod")?.value || "";
  const row = DB.pagos.find(r=>eq(pick(r,["metodo"]), pay));
  if ($("payInfo")) $("payInfo").textContent = row ? s(pick(row,["detalle"])) : "";

  updateChangeHint();
}

function updateChangeHint(){
  const delivery = $("deliveryType")?.value || "";
  const pay = $("payMethod")?.value || "";
  const cash = $("cashAmount");
  const info = $("payInfo");

  if (!cash || !info) return;

  // Solo efectivo en Comayagua ciudad
  if (!(delivery==="comayagua_ciudad" && pay==="efectivo")) return;

  const amount = n(cash.value || 0);
  const ship = calcShipping();
  const total = cartSubtotal() + ship.min;

  // No hay amount
  if (amount <= 0){
    // dejamos el detalle de pago (si existe) y agregamos hint
    const base = info.textContent || "Efectivo (solo Comayagua ciudad).";
    info.textContent = base + " | Ingresa con cuánto pagarás para calcular el cambio.";
    return;
  }

  const diff = amount - total;
  const base = "Efectivo (solo Comayagua ciudad).";

  if (diff < 0){
    info.textContent = `${base} | Faltan ${fmtLps(Math.abs(diff))}.`;
  } else {
    info.textContent = `${base} | Cambio estimado: ${fmtLps(diff)}.`;
  }
}

/* -------------------------
   WhatsApp pedido
-------------------------- */
function buildWhatsAppLink(){
  const a = ajustesMap();
  const wa = (a["whatsapp_numero"] || "50431517755").replace(/\D/g,"");

  const name = s($("custName")?.value);
  const phone = s($("custPhone")?.value);
  const dep = s($("depto")?.value);
  const muni = s($("muni")?.value);

  const delivery = s($("deliveryType")?.value);
  const ship = calcShipping();

  const pay = s($("payMethod")?.value);
  const payRow = DB.pagos.find(r=>eq(pick(r,["metodo"]), pay));
  const payTitle = payRow ? s(pick(payRow,["titulo"], pay)) : pay;
  const payDetail = payRow ? s(pick(payRow,["detalle"])) : "";

  const subtotal = cartSubtotal();
  const totalMin = subtotal + ship.min;
  const totalMax = subtotal + ship.max;

  let lines=[];
  lines.push("🛒 *PEDIDO - SDC*");
  lines.push(`👤 Nombre: ${name||"-"}`);
  lines.push(`📞 Tel: ${phone||"-"}`);
  lines.push(`📍 Ubicación: ${dep||"-"} / ${muni||"-"}`);
  lines.push("");
  lines.push("*Productos:*");
  CART.forEach(it=>{
    lines.push(`- ${it.qty} x ${it.nombre} (${fmtLps(it.precio)})`);
  });
  lines.push("");
  lines.push(`Subtotal: ${fmtLps(subtotal)}`);
  lines.push(`Envío: ${ship.text}`);
  lines.push(`Total: ${ship.isRange ? (fmtLps(totalMin)+" – "+fmtLps(totalMax)) : fmtLps(totalMin)}`);
  lines.push("");

  lines.push(`🚚 Entrega: ${delivery||"-"}`);
  if (delivery==="comayagua_ciudad"){
    lines.push(`Zona: ${s($("comaZona")?.value) || "-"}`);
    const col = s($("comaColonia")?.value);
    if (col) lines.push(`Ref: ${col}`);
  }
  if (delivery==="entrega_propia"){
    lines.push(`Lugar: ${s($("propiaLugar")?.value) || "-"}`);
  }
  if (delivery==="empresa"){
    lines.push(`Empresa: ${s($("empresa")?.value) || "-"}`);
    lines.push(`Modalidad: ${s($("empresaModalidad")?.value) || "-"}`);
  }
  if (delivery==="bus"){
    lines.push(`Bus (lugar): ${s($("busLugar")?.value) || "-"}`);
  }

  lines.push("");
  lines.push(`💳 Pago: ${payTitle||"-"}`);
  if (payDetail) lines.push(`Info pago: ${payDetail}`);

  // ✅ efectivo en Comayagua: con cuánto pagará + cambio
  if (delivery==="comayagua_ciudad" && pay==="efectivo"){
    const amount = n($("cashAmount")?.value || 0);
    if (amount > 0){
      lines.push(`💵 Efectivo: paga con ${fmtLps(amount)}`);
      const diff = amount - totalMin;
      if (diff < 0) lines.push(`⚠️ Faltan: ${fmtLps(Math.abs(diff))}`);
      else lines.push(`🔁 Cambio estimado: ${fmtLps(diff)}`);
    }
  }

  return `https://wa.me/${wa}?text=${encodeURIComponent(lines.join("\n"))}`;
}

/* -------------------------
   UI events
-------------------------- */
function wireUI(){
  const saved = localStorage.getItem("sdc_theme") || "dark";
  setTheme(saved);

  $("btnTheme")?.addEventListener("click", ()=>{
    const now = document.body.classList.contains("light") ? "light" : "dark";
    setTheme(now==="light" ? "dark" : "light");
  });

  $("btnSearch")?.addEventListener("click", ()=> $("searchInput")?.focus());
  $("searchInput")?.addEventListener("input",(e)=>{
    STATE.query = e.target.value || "";
    renderProductos();
  });

  // Ir al inicio
  document.addEventListener("click",(e)=>{
    const el = e.target.closest("#storeName");
    if (!el) return;
    e.preventDefault();
    window.scrollTo({top:0, behavior:"smooth"});
  });

  // Share
  $("btnShareCategory")?.addEventListener("click", async ()=>{
    if (STATE.categoria==="Todas") return;
    await copyText(location.origin + location.pathname + `#cat=${encodeURIComponent(STATE.categoria)}`);
  });
  $("btnShareSubcat")?.addEventListener("click", async ()=>{
    if (STATE.categoria==="Todas" || STATE.subcategoria==="Todas") return;
    await copyText(location.origin + location.pathname + `#cat=${encodeURIComponent(STATE.categoria)}&sub=${encodeURIComponent(STATE.subcategoria)}`);
  });

  // Carrito open
  $("btnCart")?.addEventListener("click", ()=>{
    renderCart();
    updateTotals();
    updateDeliveryUI();
    updateCashAmountVisibility();
    if (window.openCartModal) window.openCartModal();
  });

  // Copy cart summary
  $("btnCopyCart")?.addEventListener("click", async ()=>{
    const ship = calcShipping();
    const subtotal = cartSubtotal();
    const totalMin = subtotal + ship.min;
    const totalMax = subtotal + ship.max;
    const txt = `Pedido SDC\nSubtotal: ${fmtLps(subtotal)}\nEnvío: ${ship.text}\nTotal: ${ship.isRange ? (fmtLps(totalMin)+" – "+fmtLps(totalMax)) : fmtLps(totalMin)}`;
    await copyText(txt);
  });

  // Send WA
  $("btnSendWA")?.addEventListener("click", ()=>{
    if (!CART.length){ alert("Tu carrito está vacío."); return; }
    if (!s($("custName")?.value) || !s($("custPhone")?.value)){ alert("Completa tu nombre y teléfono."); return; }
    if (!s($("depto")?.value) || !s($("muni")?.value)){ alert("Selecciona departamento y municipio."); return; }
    if (!s($("deliveryType")?.value)){ alert("Selecciona tipo de entrega."); return; }
    if (!s($("payMethod")?.value)){ alert("Selecciona método de pago."); return; }

    // Validación efectivo Comayagua
    const delivery = $("deliveryType")?.value || "";
    const pay = $("payMethod")?.value || "";
    if (delivery==="comayagua_ciudad" && pay==="efectivo"){
      const amt = n($("cashAmount")?.value || 0);
      if (amt <= 0){
        alert("Por favor indica con cuánto pagarás (efectivo).");
        return;
      }
      const ship = calcShipping();
      const total = cartSubtotal() + ship.min;
      if (amt < total){
        alert(`El efectivo es menor al total. Faltan ${fmtLps(total-amt)}.`);
        return;
      }
    }

    window.open(buildWhatsAppLink(), "_blank");
  });

  // Ubicación
  $("depto")?.addEventListener("change", ()=>{
    refreshMunicipios();
    fillSelect("deliveryType", buildDeliveryOptions().map(o=>({value:o.value,label:o.label})), "Tipo de entrega");
    updateDeliveryUI();
  });
  $("muni")?.addEventListener("change", ()=>{
    fillSelect("deliveryType", buildDeliveryOptions().map(o=>({value:o.value,label:o.label})), "Tipo de entrega");
    updateDeliveryUI();
  });

  // Entrega + pago
  $("deliveryType")?.addEventListener("change", updateDeliveryUI);
  $("comaZona")?.addEventListener("change", updateTotals);
  $("propiaLugar")?.addEventListener("change", updateTotals);
  $("empresa")?.addEventListener("change", updateTotals);
  $("empresaModalidad")?.addEventListener("change", ()=>{ updatePayOptions(); updateTotals(); updateCashAmountVisibility(); });
  $("busLugar")?.addEventListener("change", updateTotals);
  $("payMethod")?.addEventListener("change", ()=>{ updateTotals(); updateCashAmountVisibility(); });

  $("cashAmount")?.addEventListener("input", ()=>{
    updateTotals();
    updateCashAmountVisibility();
  });
}

/* -------------------------
   Init
-------------------------- */
async function init(){
  try{
    loadCart();
    updateCartBadge();
    wireUI();

    showSkeleton();
    startLoadingMessageSwap();

    const data = await apiGetAll();
    stopLoadingMessageSwap();

    DB.productos = (data.productos || []).map(normalizeProduct).filter(p=>p.id && p.nombre);
    DB.categorias = data.categorias || [];
    DB.subcategorias = data.subcategorias || [];
    DB.ajustes = data.ajustes || [];
    DB.pagos = data.pagos || [];
    DB.municipios_hn = data.municipios_hn || [];
    DB.cobertura_entrega = data.cobertura_entrega || [];
    DB.zonas_comayagua_ciudad = data.zonas_comayagua_ciudad || [];
    DB.tarifas_entrega_propia = data.tarifas_entrega_propia || [];
    DB.empresas_envio = data.empresas_envio || [];
    DB.bus_local_tarifas = data.bus_local_tarifas || [];

    applyAjustes();

    // aplicar hash
    const h = parseHash();
    if (h.cat) STATE.categoria = decodeURIComponent(h.cat);
    if (h.sub) STATE.subcategoria = decodeURIComponent(h.sub);

    renderCategorias();
    renderSubcategorias();
    renderProductos();

    // llenar deptos/munis
    fillSelect("depto", getDepartamentos().map(d=>({value:d,label:d})), "Departamento");
    refreshMunicipios();

    // tipo de entrega (se rellena al elegir depto/muni)
    fillSelect("deliveryType", [{value:"",label:"Selecciona tipo de entrega"}], "Tipo de entrega");

    // zonas comayagua
    fillSelect("comaZona",
      Array.from(new Set(DB.zonas_comayagua_ciudad.map(r=>s(pick(r,["zona"],""))).filter(Boolean)))
        .map(z=>({value:z,label:z})),
      "Zona (Comayagua)"
    );

    // entrega propia
    fillSelect("propiaLugar",
      Array.from(new Set(DB.tarifas_entrega_propia.map(r=>s(pick(r,["municipio","lugar"],""))).filter(Boolean)))
        .map(z=>({value:z,label:z})),
      "Lugar (entrega propia)"
    );

    // empresas
    fillSelect("empresa",
      Array.from(new Set(DB.empresas_envio.map(r=>s(pick(r,["empresa"],""))).filter(Boolean)))
        .map(z=>({value:z,label:z})),
      "Empresa de envío"
    );

    fillSelect("empresaModalidad",
      [{value:"",label:"Modalidad"},{value:"normal",label:"Normal (anticipado)"},{value:"contra_entrega",label:"Pagar al recibir"}],
      "Modalidad"
    );

    // bus
    fillSelect("busLugar",
      Array.from(new Set(DB.bus_local_tarifas.map(r=>s(pick(r,["municipio","lugar"],""))).filter(Boolean)))
        .map(z=>({value:z,label:z})),
      "Lugar (bus local)"
    );

    updatePayOptions();
    updateTotals();
    updateCashAmountVisibility();

  }catch(err){
    stopLoadingMessageSwap();
    console.error(err);
    if ($("sectionTitle")) $("sectionTitle").textContent="No se pudo cargar el catálogo.";
    if ($("grid")) $("grid").innerHTML=`<div style="color:var(--muted);padding:10px 2px;">${String(err.message||err)}</div>`;
  }
}

init();

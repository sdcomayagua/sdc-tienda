/* =========================
   SDC TIENDA - app.js (FULL ESTABLE)
   - Catálogo + categorías + subcategorías
   - Doble toque categoría: copiar enlace
   - Compartir subcategoría
   - Carrito real + stock límite
   - Envíos: Comayagua / Propia / Empresa / Bus (rango)
   - Pago: efectivo (solo Comayagua) + cambio estimado
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
function n(v){ const x = Number(v); return Number.isFinite(x) ? x : 0; }
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
   Hash (share)
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
   Loading (skeleton)
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
   Categorías / Subcategorías
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

      // doble toque copia link
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
   Carrito real + Stock límite
-------------------------- */
const CART_KEY="sdc_cart_full_v3";
let CART = [];

function loadCart(){ try{ CART = JSON.parse(localStorage.getItem(CART_KEY)||"[]"); }catch{ CART=[]; } }
function saveCart(){ localStorage.setItem(CART_KEY, JSON.stringify(CART)); }
function cartCount(){ return CART.reduce((a,it)=>a+it.qty,0); }
function updateCartBadge(){ if ($("cartCount")) $("cartCount").textContent = String(cartCount()); }
function cartSubtotal(){ return CART.reduce((a,it)=>a + (n(it.precio)*n(it.qty)), 0); }

function getStockById(id){
  const p = DB.productos.find(x => String(x.id) === String(id));
  return p ? Number(p.stock||0) : 0;
}

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
   Pagos + efectivo + cambio estimado
-------------------------- */
function updatePayOptions(){
  const t = $("deliveryType")?.value || "";
  const empresaModalidad = $("empresaModalidad")?.value || "";
  const sel = $("payMethod");
  if (!sel) return;

  const hasFlags = DB.pagos.some(p => p.hasOwnProperty("permite_en_ciudad_comayagua") || p.hasOwnProperty("permite_en_empresa_envio"));
  let allowed = [];

  DB.pagos.forEach(p=>{
    const
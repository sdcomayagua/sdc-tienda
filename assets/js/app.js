let DB = {
  productos: [],
  categorias: [],
  ajustes: [],
  zonas_comayagua_ciudad: [],
  tarifas_entrega_propia: [],
  empresas_envio: [],
  bus_local_tarifas: [],
};

let STATE = { categoria: "Todas", subcategoria: "Todas", query: "" };

const $ = (id) => document.getElementById(id);
function fmtLps(n){ return `Lps. ${Number(n||0).toFixed(0)}`; }

/* ===== TEMA ===== */
function setTheme(next){
  document.body.classList.toggle("light", next === "light");
  localStorage.setItem("sdc_theme", next);
  const b = $("btnTheme");
  if (b) b.textContent = next === "light" ? "🌙" : "☀️";
}

/* ===== AJUSTES ===== */
function ajustesMap(){
  const map = {};
  (DB.ajustes||[]).forEach(r=>{
    const k = String(r.clave||"").trim();
    const v = String(r.valor||"").trim();
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
  if (aviso && $("footerInfo")) $("footerInfo").textContent = aviso;

  const wa = (a["whatsapp_numero"] || "50431517755").replace(/\D/g,"");
  const msg = a["mensaje_whatsapp"] || "Hola, quiero consultar el catálogo.";
  if ($("waFloat")) $("waFloat").href = `https://wa.me/${wa}?text=${encodeURIComponent(msg)}`;

  if ($("year")) $("year").textContent = new Date().getFullYear();
}

/* ===== NORMALIZAR ===== */
function normalizeProduct(p){
  const out = {
    id: String(p.id||"").trim(),
    nombre: String(p.nombre||"").trim(),
    precio: Number(p.precio||0),
    precio_anterior: Number(p.precio_anterior||0),
    stock: Number(p.stock||0),
    categoria: String(p.categoria||"General").trim() || "General",
    subcategoria: String(p.subcategoria||"").trim(),
    imagen: String(p.imagen||"").trim(),
    descripcion: String(p.descripcion||"").trim(),
    orden: Number(p.orden||0),
    video: String(p.video||p.video_url||"").trim(),
  };

  if (p.galeria && !p.galeria_1){
    const parts = String(p.galeria).split(",").map(s=>s.trim()).filter(Boolean);
    for (let i=1;i<=8;i++) out[`galeria_${i}`] = parts[i-1] || "";
  } else {
    for (let i=1;i<=8;i++) out[`galeria_${i}`] = String(p[`galeria_${i}`]||"").trim();
  }
  return out;
}

/* ===== LOADING (simple) ===== */
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

/* ===== CATEGORÍAS + SUB ===== */
function getCategorias(){
  let cats = [];
  if (DB.categorias && DB.categorias.length){
    cats = DB.categorias
      .filter(c => String(c.visible ?? 1) === "1" || c.visible === 1)
      .sort((a,b)=>Number(a.orden||0)-Number(b.orden||0))
      .map(c=>String(c.categoria||"").trim())
      .filter(Boolean);
  } else {
    cats = Array.from(new Set(DB.productos.map(p=>p.categoria))).filter(Boolean).sort((a,b)=>a.localeCompare(b));
  }
  return ["Todas", ...cats.filter(c => c && c !== "Todas")];
}

function renderCategorias(){
  const chips = $("chips");
  if (!chips) return;

  chips.innerHTML = "";
  getCategorias().forEach(c=>{
    const b = document.createElement("button");
    b.className = "chip" + (STATE.categoria===c ? " active" : "");
    b.textContent = c;
    b.onclick = ()=>{
      STATE.categoria=c;
      STATE.subcategoria="Todas";
      renderCategorias();
      renderSubcategorias();
      renderProductos();
    };
    chips.appendChild(b);
  });
}

function getSubcategoriasDeCategoria(cat){
  const set = new Set();
  DB.productos.forEach(p=>{
    if (cat !== "Todas" && p.categoria !== cat) return;
    if (p.subcategoria && p.subcategoria.trim()) set.add(p.subcategoria.trim());
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
    return;
  }

  const subs = getSubcategoriasDeCategoria(STATE.categoria);
  if (!subs.length){
    sub.style.display="none";
    sub.innerHTML="";
    STATE.subcategoria="Todas";
    return;
  }

  sub.style.display="flex";
  sub.innerHTML="";

  const all = document.createElement("button");
  all.className = "chip subchip" + (STATE.subcategoria==="Todas" ? " active" : "");
  all.textContent="Todas";
  all.onclick=()=>{ STATE.subcategoria="Todas"; renderSubcategorias(); renderProductos(); };
  sub.appendChild(all);

  subs.forEach(sc=>{
    const b=document.createElement("button");
    b.className="chip subchip"+(STATE.subcategoria===sc?" active":"");
    b.textContent=sc;
    b.onclick=()=>{ STATE.subcategoria=sc; renderSubcategorias(); renderProductos(); };
    sub.appendChild(b);
  });
}

/* ===== PRODUCTOS ===== */
function filteredProductos(){
  const q = STATE.query.trim().toLowerCase();
  return DB.productos
    .filter(p => STATE.categoria==="Todas" ? true : p.categoria===STATE.categoria)
    .filter(p => STATE.subcategoria==="Todas" ? true : (p.subcategoria||"")===STATE.subcategoria)
    .filter(p => !q ? true : (
      (p.nombre||"").toLowerCase().includes(q) ||
      (p.descripcion||"").toLowerCase().includes(q)
    ))
    .sort((a,b)=>{
      const av=a.stock>0?0:1, bv=b.stock>0?0:1;
      if (av!==bv) return av-bv;
      return (a.nombre||"").localeCompare(b.nombre||"");
    });
}

function productCard(p){
  const card=document.createElement("div");
  card.className="card";

  const isOut = Number(p.stock||0)<=0;
  const isOffer = Number(p.precio_anterior||0) > Number(p.precio||0);

  if (isOut) card.classList.add("isOut");
  if (isOffer){
    const tag=document.createElement("div");
    tag.className="offerTag";
    tag.textContent="OFERTA";
    card.appendChild(tag);
  }

  const imgSrc = p.imagen || "assets/img/no-image.png";

  card.innerHTML += `
    <img class="cardImg" src="${imgSrc}" alt=""
      onerror="this.onerror=null; this.src='assets/img/no-image.png';">
    <div class="cardBody">
      <div class="cardName">${p.nombre||""}</div>
      <div class="cardDesc">${p.descripcion || p.subcategoria || p.categoria || ""}</div>
      <div class="priceRow">
        <div class="price ${isOffer ? "offer":""}">${fmtLps(p.precio||0)}</div>
        <div class="old">${isOffer ? fmtLps(p.precio_anterior) : ""}</div>
      </div>
      <div class="cardActions">
        <button class="btn btnPrimary btnFull" ${isOut?"disabled":""}>${isOut?"Agotado":"Ver detalles"}</button>
      </div>
    </div>
  `;

  if (isOut){
    const wm=document.createElement("div");
    wm.className="watermark";
    wm.textContent="AGOTADO";
    card.appendChild(wm);
  }

  card.onclick=()=>{ if (window.openProduct) window.openProduct(p); };
  return card;
}

function renderProductos(){
  const grid=$("grid");
  if (!grid) return;

  grid.innerHTML="";
  const list=filteredProductos();

  if ($("sectionTitle")){
    const labelCat = (STATE.categoria==="Todas") ? "Productos" : STATE.categoria;
    const labelSub = (STATE.subcategoria!=="Todas") ? ` · ${STATE.subcategoria}` : "";
    $("sectionTitle").textContent = `${labelCat}${labelSub} (${list.length})`;
  }

  if (!list.length){
    const empty=document.createElement("div");
    empty.style.color="var(--muted)";
    empty.style.padding="10px 2px";
    empty.textContent="No hay productos en esta sección.";
    grid.appendChild(empty);
    return;
  }

  list.forEach(p=>grid.appendChild(productCard(p)));
}

/* ===== CARRITO REAL ===== */
const CART_KEY="sdc_cart_real_v1";
let CART = [];

function loadCart(){
  try{ CART = JSON.parse(localStorage.getItem(CART_KEY) || "[]"); }catch{ CART=[]; }
}
function saveCart(){
  localStorage.setItem(CART_KEY, JSON.stringify(CART));
}
function cartCount(){
  return CART.reduce((a,it)=>a+it.qty,0);
}
function updateCartBadge(){
  const c=$("cartCount");
  if (c) c.textContent = String(cartCount());
}
function addToCart(p){
  const id=String(p.id);
  const found=CART.find(x=>String(x.id)===id);
  if (found) found.qty++;
  else CART.push({ id, nombre:p.nombre, precio:p.precio, imagen:p.imagen, qty:1 });
  saveCart();
  updateCartBadge();
  if (window.openCartModal) window.openCartModal();
  renderCart();
}
window.addToCart = addToCart;

function cartSubtotal(){
  return CART.reduce((a,it)=>a+(Number(it.precio||0)*Number(it.qty||0)),0);
}

function renderCart(){
  const empty=$("cartEmpty");
  const list=$("cartList");
  if (!empty || !list) return;

  empty.style.display = CART.length ? "none" : "block";
  list.innerHTML = "";

  CART.forEach((it, idx)=>{
    const row=document.createElement("div");
    row.className="cartItem";
    row.innerHTML = `
      <img src="${it.imagen || "assets/img/no-image.png"}" onerror="this.onerror=null;this.src='assets/img/no-image.png';">
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
    row.querySelector(".dec").onclick=()=>{ it.qty--; if (it.qty<=0) CART.splice(idx,1); saveCart(); updateCartBadge(); renderCart(); updateTotals(); };
    row.querySelector(".inc").onclick=()=>{ it.qty++; saveCart(); updateCartBadge(); renderCart(); updateTotals(); };
    row.querySelector(".trash").onclick=()=>{ CART.splice(idx,1); saveCart(); updateCartBadge(); renderCart(); updateTotals(); };
    list.appendChild(row);
  });

  updateTotals();
}

/* ===== ENVÍO (reglas) =====
- Comayagua ciudad: zonas_comayagua_ciudad (zona,costo)
- Entrega propia: tarifas_entrega_propia (municipio o lugar,costo)
- Empresa: empresas_envio (empresa,modalidad,precio)
- Bus: bus_local_tarifas (lugar,tarifa_min,tarifa_max)
*/
function fillSelect(selId, items, placeholder="Selecciona"){
  const sel=$(selId);
  if (!sel) return;
  sel.innerHTML = `<option value="">${placeholder}</option>`;
  items.forEach(x=>{
    const opt=document.createElement("option");
    opt.value = x.value;
    opt.textContent = x.label;
    sel.appendChild(opt);
  });
}

function updateDeliveryUI(){
  const t = $("deliveryType")?.value || "";

  const boxComa=$("boxComa");
  const boxPropia=$("boxPropia");
  const boxEmpresa=$("boxEmpresa");
  const boxBus=$("boxBus");

  if (boxComa) boxComa.style.display = (t==="comayagua_ciudad") ? "grid" : "none";
  if (boxPropia) boxPropia.style.display = (t==="entrega_propia") ? "grid" : "none";
  if (boxEmpresa) boxEmpresa.style.display = (t==="empresa") ? "grid" : "none";
  if (boxBus) boxBus.style.display = (t==="bus") ? "grid" : "none";

  updateTotals();
}

function calcShipping(){
  const t = $("deliveryType")?.value || "";
  if (!t) return { type:"none", text:"Por confirmar", min:0, max:0, isRange:false };

  if (t==="comayagua_ciudad"){
    const zona = $("comaZona")?.value || "";
    if (!zona) return { type:t, text:"Por confirmar", min:0, max:0, isRange:false };
    const row = DB.zonas_comayagua_ciudad.find(r => String(r.zona||"").trim()===zona);
    const cost = row ? Number(row.costo||row.precio||0) : 0;
    return { type:t, text:fmtLps(cost), min:cost, max:cost, isRange:false };
  }

  if (t==="entrega_propia"){
    const lugar = $("propiaLugar")?.value || "";
    if (!lugar) return { type:t, text:"Por confirmar", min:0, max:0, isRange:false };
    const row = DB.tarifas_entrega_propia.find(r => String(r.municipio||r.lugar||"").trim()===lugar);
    const cost = row ? Number(row.costo||row.precio||0) : 0;
    return { type:t, text:fmtLps(cost), min:cost, max:cost, isRange:false };
  }

  if (t==="empresa"){
    const emp = $("empresa")?.value || "";
    const mod = $("empresaModalidad")?.value || "";
    if (!emp || !mod) return { type:t, text:"Por confirmar", min:0, max:0, isRange:false };
    const row = DB.empresas_envio.find(r =>
      String(r.empresa||"").trim()===emp && String(r.modalidad||"").trim()===mod
    );
    const cost = row ? Number(row.precio||0) : 0;
    return { type:t, text:fmtLps(cost), min:cost, max:cost, isRange:false };
  }

  if (t==="bus"){
    const lugar = $("busLugar")?.value || "";
    if (!lugar) return { type:t, text:"Por confirmar", min:0, max:0, isRange:false };
    const row = DB.bus_local_tarifas.find(r => String(r.municipio||r.lugar||"").trim()===lugar);
    const mn = row ? Number(row.tarifa_min||row.min||0) : 0;
    const mx = row ? Number(row.tarifa_max||row.max||0) : mn;
    return { type:t, text:`${fmtLps(mn)} – ${fmtLps(mx)}`, min:mn, max:mx, isRange:true };
  }

  return { type:"none", text:"Por confirmar", min:0, max:0, isRange:false };
}

function updateTotals(){
  const sub = cartSubtotal();
  const ship = calcShipping();

  if ($("subTotal")) $("subTotal").textContent = fmtLps(sub);
  if ($("shippingCost")) $("shippingCost").textContent = ship.text;

  const totalMin = sub + (ship.min||0);
  const totalMax = sub + (ship.max||0);

  if ($("grandTotal")){
    $("grandTotal").textContent = ship.isRange ? `${fmtLps(totalMin)} – ${fmtLps(totalMax)}` : fmtLps(totalMin);
  }

  const hint = $("shipHint");
  if (hint && ship.isRange){
    hint.textContent = "Bus local: el envío es estimado (rango). Se confirma por WhatsApp antes de enviar.";
  } else if (hint){
    hint.textContent = "Tarifas calculadas desde Google Sheets.";
  }
}

function buildWhatsAppMessage(){
  const a = ajustesMap();
  const wa = (a["whatsapp_numero"] || "50431517755").replace(/\D/g,"");

  const name = ($("custName")?.value||"").trim();
  const phone = ($("custPhone")?.value||"").trim();

  const delivery = $("deliveryType")?.value || "";
  const ship = calcShipping();
  const subtotal = cartSubtotal();

  let lines=[];
  lines.push("🛒 *PEDIDO - SDC*");
  lines.push(`👤 Nombre: ${name||"-"}`);
  lines.push(`📞 Tel: ${phone||"-"}`);
  lines.push("");

  lines.push("*Productos:*");
  CART.forEach(it=>{
    lines.push(`- ${it.qty} x ${it.nombre} (${fmtLps(it.precio)})`);
  });

  lines.push("");
  lines.push(`Subtotal: ${fmtLps(subtotal)}`);
  lines.push(`Envío: ${ship.text}`);
  lines.push(`Total: ${ship.isRange ? (fmtLps(subtotal+ship.min)+" – "+fmtLps(subtotal+ship.max)) : fmtLps(subtotal+ship.min)}`);

  lines.push("");
  lines.push("*Tipo de entrega:* " + (delivery||"—"));

  if (delivery==="comayagua_ciudad"){
    lines.push(`Zona: ${$("comaZona")?.value||"-"}`);
    const col = ($("comaColonia")?.value||"").trim();
    if (col) lines.push(`Colonia/Ref: ${col}`);
  }
  if (delivery==="entrega_propia"){
    lines.push(`Lugar: ${$("propiaLugar")?.value||"-"}`);
  }
  if (delivery==="empresa"){
    lines.push(`Empresa: ${$("empresa")?.value||"-"}`);
    lines.push(`Modalidad: ${$("empresaModalidad")?.value||"-"}`);
  }
  if (delivery==="bus"){
    lines.push(`Bus (lugar): ${$("busLugar")?.value||"-"}`);
  }

  const link = `https://wa.me/${wa}?text=${encodeURIComponent(lines.join("\n"))}`;
  return link;
}

/* UI events */
function wireUI(){
  const saved = localStorage.getItem("sdc_theme") || "dark";
  setTheme(saved);

  $("btnTheme")?.addEventListener("click", ()=>{
    const now = document.body.classList.contains("light") ? "light" : "dark";
    setTheme(now==="light" ? "dark" : "light");
  });

  $("btnSearch")?.addEventListener("click", ()=> $("searchInput")?.focus());
  $("searchInput")?.addEventListener("input", (e)=>{
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

  // Carrito
  $("btnCart")?.addEventListener("click", ()=>{
    if (window.openCartModal) window.openCartModal();
    renderCart();
    updateDeliveryUI();
  });

  $("btnCopyCart")?.addEventListener("click", async ()=>{
    const ship = calcShipping();
    const subtotal = cartSubtotal();
    const txt = `Pedido SDC\nSubtotal: ${fmtLps(subtotal)}\nEnvío: ${ship.text}\nTotal: ${ship.isRange ? (fmtLps(subtotal+ship.min)+" – "+fmtLps(subtotal+ship.max)) : fmtLps(subtotal+ship.min)}`;
    try{ await navigator.clipboard.writeText(txt); alert("Resumen copiado"); }catch{ alert("No se pudo copiar"); }
  });

  $("btnSendWA")?.addEventListener("click", ()=>{
    if (!CART.length){ alert("Tu carrito está vacío."); return; }
    if (!$("deliveryType")?.value){ alert("Selecciona el tipo de entrega."); return; }
    window.open(buildWhatsAppMessage(), "_blank");
  });

  // Entrega
  $("deliveryType")?.addEventListener("change", updateDeliveryUI);
  $("comaZona")?.addEventListener("change", updateTotals);
  $("propiaLugar")?.addEventListener("change", updateTotals);
  $("empresa")?.addEventListener("change", updateTotals);
  $("empresaModalidad")?.addEventListener("change", updateTotals);
  $("busLugar")?.addEventListener("change", updateTotals);
}

/* init */
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
    DB.ajustes = data.ajustes || [];

    // hojas de envío (si existen)
    DB.zonas_comayagua_ciudad = data.zonas_comayagua_ciudad || [];
    DB.tarifas_entrega_propia = data.tarifas_entrega_propia || [];
    DB.empresas_envio = data.empresas_envio || [];
    DB.bus_local_tarifas = data.bus_local_tarifas || [];

    applyAjustes();
    renderCategorias();
    renderSubcategorias();
    renderProductos();

    // llenar selects de envío
    fillSelect("comaZona",
      Array.from(new Set(DB.zonas_comayagua_ciudad.map(r=>String(r.zona||"").trim()).filter(Boolean)))
        .map(z=>({value:z,label:z})),
      "Zona (Comayagua)"
    );

    fillSelect("propiaLugar",
      Array.from(new Set(DB.tarifas_entrega_propia.map(r=>String(r.municipio||r.lugar||"").trim()).filter(Boolean)))
        .map(z=>({value:z,label:z})),
      "Lugar (entrega propia)"
    );

    fillSelect("empresa",
      Array.from(new Set(DB.empresas_envio.map(r=>String(r.empresa||"").trim()).filter(Boolean)))
        .map(z=>({value:z,label:z})),
      "Empresa de envío"
    );

    fillSelect("busLugar",
      Array.from(new Set(DB.bus_local_tarifas.map(r=>String(r.municipio||r.lugar||"").trim()).filter(Boolean)))
        .map(z=>({value:z,label:z})),
      "Lugar (bus local)"
    );

  }catch(err){
    stopLoadingMessageSwap();
    console.error(err);
    if ($("sectionTitle")) $("sectionTitle").textContent = "No se pudo cargar el catálogo.";
    if ($("grid")) $("grid").innerHTML = `<div style="color:var(--muted);padding:10px 2px;">${String(err.message||err)}</div>`;
  }
}

init();

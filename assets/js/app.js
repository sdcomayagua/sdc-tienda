let DB = { productos: [], categorias: [], subcategorias: [], ajustes: [] };
let STATE = { categoria: "Todas", subcategoria: "Todas", query: "" };

const $ = (id) => document.getElementById(id);
function fmtLps(n){ return `Lps. ${Number(n||0).toFixed(0)}`; }

function setTheme(next){
  document.body.classList.toggle("light", next === "light");
  localStorage.setItem("sdc_theme", next);
  const b = $("btnTheme");
  if (b) b.textContent = next === "light" ? "🌙" : "☀️";
}

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

/* ===== Skeleton / loading ===== */
let LOADING_TIMER = null;

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
  LOADING_TIMER = setTimeout(() => {
    const t = document.getElementById("loadingTitle");
    const s = document.getElementById("loadingSub");
    if (!t || !s) return;
    t.textContent = "Sigue cargando…";
    s.textContent = "Si no aparece en unos segundos, recarga la página o escríbenos por WhatsApp.";
  }, 4000);
}

function stopLoadingMessageSwap(){
  if (LOADING_TIMER) clearTimeout(LOADING_TIMER);
  LOADING_TIMER = null;
}

/* ===== Categorías y subcategorías ===== */
function getCategorias(){
  let cats = [];
  if (DB.categorias && DB.categorias.length){
    cats = DB.categorias
      .filter(c => String(c.visible ?? 1) === "1" || c.visible === 1)
      .sort((a,b)=>Number(a.orden||0)-Number(b.orden||0))
      .map(c=>String(c.categoria||"").trim())
      .filter(Boolean);
  } else {
    cats = Array.from(new Set(DB.productos.map(p=>p.categoria)))
      .filter(Boolean)
      .sort((a,b)=>a.localeCompare(b));
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
      STATE.categoria = c;
      STATE.subcategoria = "Todas";  // ✅ reset
      renderCategorias();
      renderSubcategorias();
      renderProductos();

      const btn = $("btnShareCategory");
      if (btn) btn.style.display = (c==="Todas") ? "none" : "inline-flex";
    };

    chips.appendChild(b);
  });
}

function getSubcategoriasDeCategoria(cat){
  // cat = categoría actual (o Todas)
  const set = new Set();
  DB.productos.forEach(p=>{
    const okCat = (cat==="Todas") ? true : p.categoria===cat;
    if (!okCat) return;
    if (p.subcategoria && p.subcategoria.trim()) set.add(p.subcategoria.trim());
  });
  return Array.from(set).sort((a,b)=>a.localeCompare(b));
}

function renderSubcategorias(){
  const sub = $("subchips");
  if (!sub) return;

  const subs = getSubcategoriasDeCategoria(STATE.categoria);

  if (!subs.length){
    sub.style.display = "none";
    sub.innerHTML = "";
    STATE.subcategoria = "Todas";
    return;
  }

  sub.style.display = "flex";
  sub.innerHTML = "";

  // Botón "Todas" (subcategorías)
  const all = document.createElement("button");
  all.className = "chip subchip" + (STATE.subcategoria==="Todas" ? " active" : "");
  all.textContent = "Todas";
  all.onclick = ()=>{
    STATE.subcategoria = "Todas";
    renderSubcategorias();
    renderProductos();
  };
  sub.appendChild(all);

  // Subcategorías reales
  subs.forEach(sc=>{
    const b = document.createElement("button");
    b.className = "chip subchip" + (STATE.subcategoria===sc ? " active" : "");
    b.textContent = sc;
    b.onclick = ()=>{
      STATE.subcategoria = sc;
      renderSubcategorias();
      renderProductos();
    };
    sub.appendChild(b);
  });
}

/* ===== Productos ===== */
function filteredProductos(){
  const q = STATE.query.trim().toLowerCase();

  return DB.productos
    .filter(p => STATE.categoria==="Todas" ? true : p.categoria===STATE.categoria)
    .filter(p => STATE.subcategoria==="Todas" ? true : (p.subcategoria||"")===STATE.subcategoria)
    .filter(p => !q ? true : (
      (p.nombre||"").toLowerCase().includes(q) ||
      (p.descripcion||"").toLowerCase().includes(q) ||
      (p.subcategoria||"").toLowerCase().includes(q)
    ))
    .sort((a,b)=>{
      const av = a.stock>0 ? 0 : 1;
      const bv = b.stock>0 ? 0 : 1;
      if (av!==bv) return av-bv;
      if ((a.orden||0)!==(b.orden||0)) return (a.orden||0)-(b.orden||0);
      return (a.nombre||"").localeCompare(b.nombre||"");
    });
}

function productCard(p){
  const card = document.createElement("div");
  card.className = "card";

  const isOut = Number(p.stock||0) <= 0;
  const isOffer = Number(p.precio_anterior||0) > Number(p.precio||0);

  const imgSrc = p.imagen || "assets/img/no-image.png";

  card.innerHTML = `
    <img class="cardImg"
         src="${imgSrc}"
         alt=""
         onerror="this.onerror=null; this.src='assets/img/no-image.png';">
    <div class="cardBody">
      <div class="cardName">${p.nombre || ""}</div>
      <div class="cardDesc">${p.descripcion || p.subcategoria || p.categoria || ""}</div>
      <div class="priceRow">
        <div class="price">${fmtLps(p.precio||0)}</div>
        <div class="old">${isOffer ? fmtLps(p.precio_anterior) : ""}</div>
      </div>
      <div class="cardActions">
        <button class="btn btnPrimary btnFull" ${isOut ? "disabled":""}>${isOut ? "Agotado" : "Ver detalles"}</button>
      </div>
    </div>
  `;

  if (isOut){
    const wm = document.createElement("div");
    wm.className = "watermark";
    wm.textContent = "AGOTADO";
    card.appendChild(wm);
  }

  card.onclick = ()=>{
    if (typeof window.openProduct === "function") window.openProduct(p);
  };

  return card;
}

function renderProductos(){
  const grid = $("grid");
  if (!grid) return;

  grid.innerHTML = "";

  const list = filteredProductos();

  if ($("sectionTitle")){
    const labelCat = (STATE.categoria==="Todas") ? "Productos" : STATE.categoria;
    const labelSub = (STATE.subcategoria!=="Todas") ? ` · ${STATE.subcategoria}` : "";
    $("sectionTitle").textContent = `${labelCat}${labelSub} (${list.length})`;
  }

  if (!list.length){
    const empty = document.createElement("div");
    empty.style.color = "var(--muted)";
    empty.style.padding = "10px 2px";
    empty.textContent = "No hay productos en esta sección.";
    grid.appendChild(empty);
    return;
  }

  list.forEach(p=>grid.appendChild(productCard(p)));
}

/* ===== UI ===== */
function wireUI(){
  const saved = localStorage.getItem("sdc_theme") || "dark";
  setTheme(saved);

  if ($("btnTheme")){
    $("btnTheme").onclick = ()=>{
      const now = document.body.classList.contains("light") ? "light" : "dark";
      setTheme(now==="light" ? "dark" : "light");
    };
  }

  // Buscar
  if ($("btnSearch") && $("searchInput")){
    $("btnSearch").onclick = ()=>$("searchInput").focus();
    $("searchInput").addEventListener("input",(e)=>{
      STATE.query = e.target.value || "";
      renderProductos();
    });
  }

  // Compartir categoría
  if ($("btnShareCategory")){
    $("btnShareCategory").onclick = async ()=>{
      if (STATE.categoria==="Todas") return;
      const url = location.origin + location.pathname + "#cat=" + encodeURIComponent(STATE.categoria);
      try{ await navigator.clipboard.writeText(url); alert("Enlace copiado"); }
      catch(e){ alert("No se pudo copiar"); }
    };
  }

  // ✅ Tocar título: scroll suave arriba
  if ($("storeName")){
    $("storeName").addEventListener("click",(e)=>{
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }
}

/* ===== Init ===== */
async function init(){
  try{
    wireUI();
    showSkeleton();
    startLoadingMessageSwap();

    const data = await apiGetAll();
    stopLoadingMessageSwap();

    DB.productos = (data.productos || []).map(normalizeProduct).filter(p=>p.id && p.nombre);
    DB.categorias = data.categorias || [];
    function getSubcategoriasDeCategoria(cat){
  // 1) si hay tabla subcategorias, usarla
  if (DB.subcategorias && DB.subcategorias.length){
    return DB.subcategorias
      .filter(r => (cat==="Todas" ? true : String(r.categoria||"")===cat))
      .filter(r => String(r.visible ?? 1)==="1" || r.visible===1)
      .sort((a,b)=>Number(a.orden||0)-Number(b.orden||0))
      .map(r=>String(r.subcategoria||"").trim())
      .filter(Boolean);
  }

  // 2) si no existe, fallback: detectar desde productos (alfabético)
  const set = new Set();
  DB.productos.forEach(p=>{
    const okCat = (cat==="Todas") ? true : p.categoria===cat;
    if (!okCat) return;
    if (p.subcategoria && p.subcategoria.trim()) set.add(p.subcategoria.trim());
  });
  return Array.from(set).sort((a,b)=>a.localeCompare(b));
}

    DB.ajustes = data.ajustes || [];

    applyAjustes();
    renderCategorias();
    renderSubcategorias();
    renderProductos();

  }catch(err){
    stopLoadingMessageSwap();
    console.error(err);
    if ($("sectionTitle")) $("sectionTitle").textContent = "No se pudo cargar el catálogo.";
    if ($("grid")) $("grid").innerHTML = `<div style="color:var(--muted);padding:10px 2px;">${String(err.message||err)}</div>`;
  }
}

init();

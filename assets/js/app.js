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

/* ===== Helpers hash ===== */
function setHash(cat, sub){
  let h = `#cat=${encodeURIComponent(cat||"Todas")}`;
  if (sub && sub !== "Todas") h += `&sub=${encodeURIComponent(sub)}`;
  history.replaceState(null, "", location.pathname + location.search + h);
}
function parseHash(){
  const h = (location.hash || "").replace("#","");
  const params = new URLSearchParams(h);
  const cat = params.get("cat");
  const sub = params.get("sub");
  return { cat, sub };
}

/* ===== Tema ===== */
function setTheme(next){
  document.body.classList.toggle("light", next === "light");
  localStorage.setItem("sdc_theme", next);
  const b = $("btnTheme");
  if (b) b.textContent = next === "light" ? "🌙" : "☀️";
}

/* ===== Ajustes ===== */
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

/* ===== Normalizar ===== */
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

/* ===== Loading ===== */
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

/* ===== Categorías + Sub ===== */
function getCategorias(){
  let cats=[];
  if (DB.categorias && DB.categorias.length){
    cats = DB.categorias
      .filter(c => String(c.visible ?? 1) === "1" || c.visible === 1)
      .sort((a,b)=>Number(a.orden||0)-Number(b.orden||0))
      .map(c=>String(c.categoria||"").trim())
      .filter(Boolean);
  } else {
    cats = Array.from(new Set(DB.productos.map(p=>p.categoria))).filter(Boolean).sort((a,b)=>a.localeCompare(b));
  }
  return ["Todas", ...cats.filter(c=>c && c!=="Todas")];
}

let lastTapCat = { name:null, t:0 };

async function copyText(text){
  try{ await navigator.clipboard.writeText(text); alert("Enlace copiado"); }
  catch(e){ alert("No se pudo copiar"); }
}

function renderCategorias(){
  const chips = $("chips");
  if (!chips) return;
  chips.innerHTML = "";

  getCategorias().forEach(c=>{
    const b=document.createElement("button");
    b.className="chip"+(STATE.categoria===c?" active":"");
    b.textContent=c;

    b.onclick = async ()=>{
      const now=Date.now();
      // ✅ doble toque: copiar enlace
      if (lastTapCat.name===c && (now-lastTapCat.t)<600){
        const url = location.origin + location.pathname + `#cat=${encodeURIComponent(c)}`;
        await copyText(url);
        lastTapCat = {name:null,t:0};
        return;
      }
      lastTapCat = {name:c,t:now};

      STATE.categoria=c;
      STATE.subcategoria="Todas";
      renderCategorias();
      renderSubcategorias();
      renderProductos();

      $("btnShareCategory").style.display = (c==="Todas") ? "none" : "inline-flex";
      $("btnShareSubcat").style.display = "none";
      setHash(c, "Todas");
    };

    chips.appendChild(b);
  });
}

function getSubcategoriasDeCategoria(cat){
  const set=new Set();
  DB.productos.forEach(p=>{
    if (cat!=="Todas" && p.categoria!==cat) return;
    if (p.subcategoria && p.subcategoria.trim()) set.add(p.subcategoria.trim());
  });
  return Array.from(set).sort((a,b)=>a.localeCompare(b));
}

function renderSubcategorias(){
  const sub=$("subchips");
  if (!sub) return;

  if (STATE.categoria==="Todas"){
    sub.style.display="none";
    sub.innerHTML="";
    STATE.subcategoria="Todas";
    $("btnShareSubcat").style.display="none";
    return;
  }

  const subs=getSubcategoriasDeCategoria(STATE.categoria);
  if (!subs.length){
    sub.style.display="none";
    sub.innerHTML="";
    STATE.subcategoria="Todas";
    $("btnShareSubcat").style.display="none";
    return;
  }

  sub.style.display="flex";
  sub.innerHTML="";

  const all=document.createElement("button");
  all.className="chip subchip"+(STATE.subcategoria==="Todas"?" active":"");
  all.textContent="Todas";
  all.onclick=()=>{
    STATE.subcategoria="Todas";
    renderSubcategorias();
    renderProductos();
    $("btnShareSubcat").style.display="none";
    setHash(STATE.categoria, "Todas");
  };
  sub.appendChild(all);

  subs.forEach(sc=>{
    const b=document.createElement("button");
    b.className="chip subchip"+(STATE.subcategoria===sc?" active":"");
    b.textContent=sc;
    b.onclick=()=>{
      STATE.subcategoria=sc;
      renderSubcategorias();
      renderProductos();
      $("btnShareSubcat").style.display="inline-flex";
      setHash(STATE.categoria, sc);
    };
    sub.appendChild(b);
  });
}

/* ===== Productos ===== */
function filteredProductos(){
  const q=STATE.query.trim().toLowerCase();
  return DB.productos
    .filter(p => STATE.categoria==="Todas" ? true : p.categoria===STATE.categoria)
    .filter(p => STATE.subcategoria==="Todas" ? true : (p.subcategoria||"")===STATE.subcategoria)
    .filter(p => !q ? true : ((p.nombre||"").toLowerCase().includes(q) || (p.descripcion||"").toLowerCase().includes(q)))
    .sort((a,b)=>{
      const av=a.stock>0?0:1, bv=b.stock>0?0:1;
      if (av!==bv) return av-bv;
      return (a.nombre||"").localeCompare(b.nombre||"");
    });
}

function productCard(p){
  const card=document.createElement("div");
  card.className="card";
  const isOut=Number(p.stock||0)<=0;
  const isOffer=Number(p.precio_anterior||0)>Number(p.precio||0);
  if (isOut) card.classList.add("isOut");

  if (isOffer){
    const tag=document.createElement("div");
    tag.className="offerTag";
    tag.textContent="OFERTA";
    card.appendChild(tag);
  }

  const imgSrc=p.imagen || "assets/img/no-image.png";

  card.innerHTML += `
    <img class="cardImg" src="${imgSrc}" alt=""
      onerror="this.onerror=null; this.src='assets/img/no-image.png';">
    <div class="cardBody">
      <div class="cardName">${p.nombre||""}</div>
      <div class="cardDesc">${p.descripcion || p.subcategoria || p.categoria || ""}</div>
      <div class="priceRow">
        <div class="price ${isOffer?"offer":""}">${fmtLps(p.precio||0)}</div>
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
  const labelCat = (STATE.categoria==="Todas") ? "Productos" : STATE.categoria;
  const labelSub = (STATE.subcategoria!=="Todas") ? ` · ${STATE.subcategoria}` : "";
  $("sectionTitle").textContent = `${labelCat}${labelSub} (${list.length})`;

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

/* ===== Share buttons ===== */
$("btnShareCategory")?.addEventListener("click", async ()=>{
  if (STATE.categoria==="Todas") return;
  const url = location.origin + location.pathname + `#cat=${encodeURIComponent(STATE.categoria)}`;
  await copyText(url);
});
$("btnShareSubcat")?.addEventListener("click", async ()=>{
  if (STATE.categoria==="Todas" || STATE.subcategoria==="Todas") return;
  const url = location.origin + location.pathname + `#cat=${encodeURIComponent(STATE.categoria)}&sub=${encodeURIComponent(STATE.subcategoria)}`;
  await copyText(url);
});

/* ===== UI ===== */
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

  // ir al inicio
  document.addEventListener("click",(e)=>{
    const el=e.target.closest("#storeName");
    if (!el) return;
    e.preventDefault();
    window.scrollTo({top:0, behavior:"smooth"});
  });

  // abrir carrito
  $("btnCart")?.addEventListener("click", ()=>{
    if (window.openCartModal) window.openCartModal();
  });
}

/* ===== INIT ===== */
async function init(){
  try{
    wireUI();
    showSkeleton();
    startLoadingMessageSwap();

    const data = await apiGetAll();
    stopLoadingMessageSwap();

    DB.productos = (data.productos || []).map(normalizeProduct).filter(p=>p.id && p.nombre);
    DB.categorias = data.categorias || [];
    DB.ajustes = data.ajustes || [];

    applyAjustes();
    renderCategorias();
    renderSubcategorias();
    renderProductos();

    // aplicar hash si viene link compartido
    const h = parseHash();
    if (h.cat){
      STATE.categoria = decodeURIComponent(h.cat);
      renderCategorias();
      renderSubcategorias();
    }
    if (h.sub){
      STATE.subcategoria = decodeURIComponent(h.sub);
      renderSubcategorias();
    }
    renderProductos();

  }catch(err){
    stopLoadingMessageSwap();
    console.error(err);
    $("sectionTitle").textContent="No se pudo cargar el catálogo.";
    $("grid").innerHTML=`<div style="color:var(--muted);padding:10px 2px;">${String(err.message||err)}</div>`;
  }
}

init();

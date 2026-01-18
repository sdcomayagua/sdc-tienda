let DB = { productos: [], categorias: [], ajustes: [] };
let STATE = { categoria: "Todas", query: "" };

const $ = (id) => document.getElementById(id);

function fmtLps(n){ return `Lps. ${Number(n||0).toFixed(0)}`; }

function setTheme(next){
  document.body.classList.toggle("light", next === "light");
  localStorage.setItem("sdc_theme", next);
  $("btnTheme").textContent = next === "light" ? "🌙" : "☀️";
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

  $("storeName").textContent = a["nombre_tienda"] || "Soluciones Digitales Comayagua";
  $("storeSub").textContent = a["subtitulo"] || "Catálogo";
  $("logoText").textContent = a["siglas"] || "SDC";
  $("footerBrand").textContent = a["siglas"] || "SDC";

  const aviso = [a["aviso_precios"], a["aviso_stock"], a["aviso_envio"]].filter(Boolean).join(" ");
  if (aviso) $("footerInfo").textContent = aviso;

  const wa = (a["whatsapp_numero"] || "50431517755").replace(/\D/g,"");
  const msg = a["mensaje_whatsapp"] || "Hola, quiero consultar el catálogo.";
  $("waFloat").href = `https://wa.me/${wa}?text=${encodeURIComponent(msg)}`;

  $("year").textContent = new Date().getFullYear();
}

function normalizeProduct(p){
  // Soporta dos formatos:
  // 1) galeria_1..galeria_8
  // 2) galeria (string con links separados por coma)
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

  // Si viene "galeria" como texto: "url1, url2, url3"
  if (p.galeria && !p.galeria_1){
    const parts = String(p.galeria).split(",").map(s=>s.trim()).filter(Boolean);
    for (let i=1;i<=8;i++){
      out[`galeria_${i}`] = parts[i-1] || "";
    }
  } else {
    for (let i=1;i<=8;i++){
      out[`galeria_${i}`] = String(p[`galeria_${i}`]||"").trim();
    }
  }

  return out;
}

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
  return ["Todas", ...cats.filter(c=>c!=="Todas")];
}

function renderCategorias(){
  const chips = $("chips");
  chips.innerHTML = "";

  getCategorias().forEach(c=>{
    const b = document.createElement("button");
    b.className = "chip" + (STATE.categoria===c ? " active" : "");
    b.textContent = c;

    b.onclick = ()=>{
      STATE.categoria = c;
      renderCategorias();
      renderProductos();
      $("btnShareCategory").style.display = (c==="Todas") ? "none" : "inline-flex";
      if (c==="Todas") history.replaceState(null,"",location.pathname+location.search+"#");
      else location.hash = `#cat=${encodeURIComponent(c)}`;
    };

    chips.appendChild(b);
  });
}

function filteredProductos(){
  const q = STATE.query.trim().toLowerCase();
  return DB.productos
    .filter(p => STATE.categoria==="Todas" ? true : p.categoria===STATE.categoria)
    .filter(p => !q ? true : (
      (p.nombre||"").toLowerCase().includes(q) ||
      (p.descripcion||"").toLowerCase().includes(q) ||
      (p.subcategoria||"").toLowerCase().includes(q)
    ))
    .sort((a,b)=>{
      // disponibles primero
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

  card.innerHTML = `
    <img class="cardImg" src="${p.imagen || ""}" alt="">
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
    // abre modal producto (ui.js)
    if (typeof window.openProduct === "function") window.openProduct(p);
  };

  return card;
}

function renderProductos(){
  const grid = $("grid");
  const list = filteredProductos();

  $("sectionTitle").textContent = STATE.categoria==="Todas"
    ? `Productos (${list.length})`
    : `${STATE.categoria} (${list.length})`;

  grid.innerHTML = "";

  if (!list.length){
    const empty = document.createElement("div");
    empty.style.color = "var(--muted)";
    empty.style.padding = "10px 2px";
    empty.textContent = "No hay productos cargados en Google Sheets todavía.";
    grid.appendChild(empty);
    return;
  }

  list.forEach(p=>grid.appendChild(productCard(p)));
}

function applyHash(){
  const h = location.hash || "";
  if (h.startsWith("#cat=")){
    const cat = decodeURIComponent(h.slice(5));
    STATE.categoria = cat || "Todas";
    renderCategorias();
    renderProductos();
    $("btnShareCategory").style.display = (STATE.categoria==="Todas") ? "none" : "inline-flex";
  }
}

function wireUI(){
  // tema
  const saved = localStorage.getItem("sdc_theme") || "dark";
  setTheme(saved);
  $("btnTheme").onclick = ()=>{
    const now = document.body.classList.contains("light") ? "light" : "dark";
    setTheme(now==="light" ? "dark" : "light");
  };

  // buscar
  $("btnSearch").onclick = ()=>$("searchInput").focus();
  $("searchInput").addEventListener("input",(e)=>{
    STATE.query = e.target.value || "";
    renderProductos();
  });

  // botones hero
  $("btnGoTop").onclick = ()=>window.scrollTo({top:0, behavior:"smooth"});
  $("btnGoAll").onclick = ()=>{
    STATE.categoria="Todas";
    STATE.query="";
    $("searchInput").value="";
    renderCategorias();
    renderProductos();
    $("btnShareCategory").style.display = "none";
    history.replaceState(null,"",location.pathname+location.search+"#");
  };

  // compartir categoría
  $("btnShareCategory").onclick = async ()=>{
    if (STATE.categoria==="Todas") return;
    const url = location.origin + location.pathname + "#cat=" + encodeURIComponent(STATE.categoria);
    try{ await navigator.clipboard.writeText(url); alert("Enlace copiado"); }
    catch(e){ alert("No se pudo copiar"); }
  };
}

async function init(){
  try{
    wireUI();
$("grid").innerHTML = `<div style="color:var(--muted);padding:10px 2px;">Cargando productos…</div>`;

$("grid").innerHTML = `
  <div class="skelGrid">
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
const data = await apiGetAll(); // JSON directo
    DB.productos = (data.productos || []).map(normalizeProduct).filter(p=>p.id && p.nombre);
    DB.categorias = data.categorias || [];
    DB.ajustes = data.ajustes || [];

    applyAjustes();
    renderCategorias();
    renderProductos();

    applyHash();
    window.addEventListener("hashchange", applyHash);

  }catch(err){
    console.error(err);
    $("sectionTitle").textContent = "Error cargando catálogo. Revisa API/Sheets.";
    $("grid").innerHTML = `<div style="color:var(--muted);padding:10px 2px;">${String(err.message||err)}</div>`;
  }
}

init();

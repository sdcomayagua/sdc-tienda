let DB = { productos: [], categorias: [], ajustes: [] };
let STATE = { categoria: "Todas", query: "" };

const $ = (id)=>document.getElementById(id);
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

  // WhatsApp
  const wa = (a["whatsapp_numero"] || "50431517755").replace(/\D/g,"");
  const msg = a["mensaje_whatsapp"] || "Hola, quiero consultar el catálogo.";
  $("waFloat").href = `https://wa.me/${wa}?text=${encodeURIComponent(msg)}`;

  $("year").textContent = new Date().getFullYear();
}

function getCategorias(){
  let cats = [];
  if (DB.categorias && DB.categorias.length){
    cats = DB.categorias
      .filter(c=>String(c.visible||1)==="1" || c.visible===1)
      .sort((a,b)=>Number(a.orden||0)-Number(b.orden||0))
      .map(c=>String(c.categoria||"").trim())
      .filter(Boolean);
  } else {
    cats = Array.from(new Set(DB.productos.map(p=>p.categoria))).sort((a,b)=>a.localeCompare(b));
  }
  return ["Todas", ...cats.filter(c=>c!=="Todas")];
}

function renderCategorias(){
  const chips = $("chips");
  chips.innerHTML = "";
  getCategorias().forEach(c=>{
    const b = document.createElement("button");
    b.className = "chip" + (STATE.categoria===c ? " active": "");
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
    .filter(p => STATE.categoria==="Todas" ? true : String(p.categoria||"")===STATE.categoria)
    .filter(p => !q ? true : (
      String(p.nombre||"").toLowerCase().includes(q) ||
      String(p.descripcion||"").toLowerCase().includes(q) ||
      String(p.subcategoria||"").toLowerCase().includes(q)
    ))
    .sort((a,b)=>{
      const av = Number(a.stock||0)>0 ? 0 : 1;
      const bv = Number(b.stock||0)>0 ? 0 : 1;
      if (av!==bv) return av-bv;
      return String(a.nombre||"").localeCompare(String(b.nombre||""));
    });
}

function productCard(p){
  const card = document.createElement("div");
  card.className = "card";
  const isOut = Number(p.stock||0)<=0;
  const isOffer = Number(p.precio_anterior||0) > Number(p.precio||0);

  card.innerHTML = `
    <img class="cardImg" src="${p.imagen||""}" alt="">
    <div class="cardBody">
      <div class="cardName">${p.nombre||""}</div>
      <div class="cardDesc">${p.descripcion || p.subcategoria || p.categoria || ""}</div>
      <div class="priceRow">
        <div class="price">${fmtLps(p.precio||0)}</div>
        <div class="old">${isOffer ? fmtLps(p.precio_anterior) : ""}</div>
      </div>
      <div class="cardActions">
        <button class="btn btnPrimary btnFull" ${isOut ? "disabled":""}>${isOut ? "Agotado":"Ver detalles"}</button>
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
    if (p.id) location.hash = `#p=${encodeURIComponent(p.id)}`;
    openProduct(p);
  };

  return card;
}

function renderProductos(){
  const list = filteredProductos();
  $("sectionTitle").textContent = STATE.categoria==="Todas"
    ? `Productos (${list.length})`
    : `${STATE.categoria} (${list.length})`;

  const grid = $("grid");
  grid.innerHTML = "";
  list.forEach(p=>grid.appendChild(productCard(p)));
}

function wireUI(){
  const saved = localStorage.getItem("sdc_theme") || "dark";
  setTheme(saved);

  $("btnTheme").onclick = ()=>{
    const now = document.body.classList.contains("light") ? "light" : "dark";
    setTheme(now==="light" ? "dark" : "light");
  };

  $("btnSearch").onclick = ()=>$("searchInput").focus();
  $("searchInput").addEventListener("input",(e)=>{
    STATE.query = e.target.value || "";
    renderProductos();
  });

  $("btnGoTop").onclick = ()=>window.scrollTo({top:0, behavior:"smooth"});
  $("btnGoAll").onclick = ()=>{
    STATE.categoria="Todas";
    STATE.query="";
    $("searchInput").value="";
    renderCategorias();
    renderProductos();
    $("btnShareCategory").style.display="none";
    history.replaceState(null,"",location.pathname+location.search+"#");
  };

  $("btnShareCategory").onclick = async ()=>{
    if (STATE.categoria==="Todas") return;
    const url = location.origin + location.pathname + "#cat=" + encodeURIComponent(STATE.categoria);
    try{ await navigator.clipboard.writeText(url); alert("Enlace copiado"); }
    catch(e){ alert("No se pudo copiar"); }
  };

  // Carrito básico (por ahora solo abre/cierra)
  $("btnCart").onclick = ()=>{ $("backdrop").style.display="block"; $("cartModal").style.display="block"; };
  $("btnCloseCart").onclick = ()=>{ $("backdrop").style.display="none"; $("cartModal").style.display="none"; };
  $("btnCloseProd").onclick = ()=>{ $("backdrop").style.display="none"; $("prodModal").style.display="none"; };
  $("backdrop").onclick = ()=>{
    $("backdrop").style.display="none";
    $("cartModal").style.display="none";
    $("prodModal").style.display="none";
  };
}

function applyHash(){
  const h = location.hash || "";
  if (h.startsWith("#cat=")){
    STATE.categoria = decodeURIComponent(h.slice(5));
    renderCategorias();
    renderProductos();
    $("btnShareCategory").style.display = (STATE.categoria==="Todas") ? "none" : "inline-flex";
  }
  if (h.startsWith("#p=")){
    const id = decodeURIComponent(h.slice(3));
    const p = DB.productos.find(x=>String(x.id)===String(id));
    if (p) openProduct(p);
  }
}

async function init(){
  wireUI();

  const data = await apiGetAll(); // <-- aquí ya es el JSON directo
  DB.productos = (data.productos||[]).map(p=>({
    ...p,
    precio:Number(p.precio||0),
    precio_anterior:Number(p.precio_anterior||0),
    stock:Number(p.stock||0),
  }));
  DB.categorias = data.categorias || [];
  DB.ajustes = data.ajustes || [];

  applyAjustes();
  renderCategorias();
  renderProductos();

  applyHash();
  window.addEventListener("hashchange", applyHash);
}

init().catch(err=>{
  console.error(err);
  $("sectionTitle").textContent = "Error cargando catálogo (API/Sheets).";
});

// assets/js/app.js (CATALOGO ESTABLE - sin alerts del carrito)

let DB = { productos: [], categorias: [], subcategorias: [], ajustes: [] };
let STATE = { categoria:"Todas", subcategoria:"Todas", query:"" };

const $ = (id)=>document.getElementById(id);
function fmtLps(n){ return `Lps. ${Number(n||0).toFixed(0)}`; }
window.fmtLps = fmtLps;

function s(v){ return (v==null) ? "" : String(v).trim(); }
function n(v){ const x=Number(v); return Number.isFinite(x)?x:0; }
function eq(a,b){ return s(a).toLowerCase() === s(b).toLowerCase(); }
async function copyText(txt){
  try{ await navigator.clipboard.writeText(txt); alert("Enlace copiado"); }
  catch{ alert("No se pudo copiar"); }
}

/* ===== Skeleton (mantener si ya lo usas) ===== */
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
    const t=$("loadingTitle"), s2=$("loadingSub");
    if (t) t.textContent="Sigue cargando…";
    if (s2) s2.textContent="Si no aparece en unos segundos, recarga la página o escríbenos por WhatsApp.";
  },4000);
}

function stopLoadingMessageSwap(){
  if (LOADING_TIMER) clearTimeout(LOADING_TIMER);
  LOADING_TIMER=null;
}

/* ===== Ajustes ===== */
function ajustesMap(){
  const map={};
  (DB.ajustes||[]).forEach(r=>{
    const k=s(r.clave), v=s(r.valor);
    if (k) map[k]=v;
  });
  return map;
}
window.ajustesMap = ajustesMap;

function applyAjustes(){
  const a=ajustesMap();
  $("storeName") && ($("storeName").textContent = a.nombre_tienda || "Soluciones Digitales Comayagua");
  $("storeSub") && ($("storeSub").textContent = a.subtitulo || "Catálogo");
  $("logoText") && ($("logoText").textContent = a.siglas || "SDC");
  $("footerBrand") && ($("footerBrand").textContent = a.siglas || "SDC");

  const aviso = [a.aviso_precios, a.aviso_stock, a.aviso_envio].filter(Boolean).join(" ");
  $("footerInfo") && ($("footerInfo").textContent = aviso || $("footerInfo").textContent);

  const wa = (a.whatsapp_numero || "50431517755").replace(/\D/g,"");
  const msg = a.mensaje_whatsapp || "Hola, quiero consultar el catálogo.";
  $("waFloat") && ($("waFloat").href = `https://wa.me/${wa}?text=${encodeURIComponent(msg)}`);

  $("year") && ($("year").textContent = new Date().getFullYear());
}

/* ===== Normalizar producto ===== */
function normalizeProduct(p){
  return {
    id: s(p.id),
    nombre: s(p.nombre),
    precio: n(p.precio),
    precio_anterior: n(p.precio_anterior),
    stock: n(p.stock),
    categoria: s(p.categoria || "General") || "General",
    subcategoria: s(p.subcategoria || ""),
    imagen: s(p.imagen || ""),
    descripcion: s(p.descripcion || ""),
    orden: n(p.orden),
    video: s(p.video || p.video_url || ""),
    galeria: s(p.galeria || ""),
    galeria_1:s(p.galeria_1||""),galeria_2:s(p.galeria_2||""),galeria_3:s(p.galeria_3||""),galeria_4:s(p.galeria_4||""),
    galeria_5:s(p.galeria_5||""),galeria_6:s(p.galeria_6||""),galeria_7:s(p.galeria_7||""),galeria_8:s(p.galeria_8||""),
  };
}

/* ===== Categorías / Subcategorías ===== */
function getCategorias(){
  let cats = [];
  if (DB.categorias && DB.categorias.length){
    cats
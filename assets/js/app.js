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

function ajustesMap(){
  const map={};
  (DB.ajustes||[]).forEach(r=>{
    const k=s(r.clave), v=s(r.valor);
    if (k) map[k]=v;
  });
  return map;
}
function applyAjustes(){
  const a=ajustesMap();
  $("storeName") && ($("storeName").textContent = a.nombre_tienda || "Soluciones Digitales Comayagua");
  $("storeSub") && ($("storeSub").textContent = a.subtitulo || "Catálogo");
  $("logoText") && ($("logoText").textContent = a.siglas || "SDC");
  $("footerBrand") && ($("footerBrand").textContent = a.siglas || "SDC");
  $("footerInfo") && ( $("footerInfo").textContent = [a.aviso_precios,a.aviso_stock,a.aviso_envio].filter(Boolean).join(" ") || $("footerInfo").textContent );
  $("year") && ($("year").textContent = new Date().getFullYear());

  const wa = (a.whatsapp_numero || "50431517755").replace(/\D/g,"");
  const msg = a.mensaje_whatsapp || "Hola, quiero consultar el catálogo.";
  $("waFloat") && ($("waFloat").href = `https://wa.me/${wa}?text=${encodeURIComponent(msg)}`);
}

function normalizeProduct(p){
  return {
    id: s(p.id),
    nombre: s(p.nombre),
    precio: n(p.precio),
    precio_anterior: n(p.precio_anterior),
    stock: n(p.stock),
    categoria: s(p.categoria||"General") || "General",
    subcategoria: s(p.subcategoria||""),
    imagen: s(p.imagen||""),
    descripcion: s(p.descripcion||""),
    orden: n(p.orden),
    video: s(p.video||p.video_url||""),
    galeria: s(p.galeria||""),
    galeria_1:s(p.galeria_1||""),galeria_2:s(p.galeria_2||""),galeria_3:s(p.galeria_3||""),galeria_4:s(p.galeria_4||""),
    galeria_5:s(p.galeria_5||""),galeria_6:s(p.galeria_6||""),galeria_7:s(p.galeria_7||""),galeria_8:s(p.galeria_8||""),
  };
}

function getCategorias(){
  let cats = [];
  if (DB.categorias && DB.categorias.length){
    cats = DB.categorias
      .filter(c => String(c.visible ?? 1) === "1" || c.visible === 1)
      .sort((a,b)=>Number(a.orden||0)-Number(b.orden||0))
      .map(c=>s(c.categoria))
      .filter(Boolean);
  } else {
    cats = Array.from(new Set(DB.productos.map(p=>p.categoria))).filter(Boolean).sort((a,b)=>a.localeCompare(b));
  }
  return ["Todas", ...cats.filter(c=>c && c!=="Todas")];
}

let lastTapCat = {name:null,t:0};

function renderCategorias(){
  const chips=$("chips");
  if (!chips) return;
  chips.innerHTML="";

  getCategorias().forEach(c=>{
    const b=document.createElement("button");
    b.className="chip"+(STATE.categoria===c?" active":"");
    b.textContent=c;

    b.onclick = async ()=>{
      const now=Date.now();
      if (lastTapCat.name===c && (now-lastTapCat.t)<650){
        await copyText(location.origin + location.pathname + `#cat=${encodeURIComponent(c)}`);
        lastTapCat={name:null,t:0};
        return;
      }
      lastTapCat={name:c,t:now};

      STATE.categoria=c;
      STATE.subcategoria="Todas";
      renderCategorias();
      renderSubcategorias();
      renderProductos();

      $("btnShareCategory") && ($("btnShareCategory").style.display = (c==="Todas") ? "none" : "inline-flex");
      $("btnShareSubcat") && ($("btnShareSubcat").style.display = "none");
    };

    chips.appendChild(b);
  });
}

function getSubcategoriasDeCategoria(cat){
  if (cat==="Todas") return [];
  // si hay hoja subcategorias, úsala
  if (DB.subcategorias && DB.subcategorias.length){
    return DB.subcategorias
      .filter(r=>eq(r.categoria,cat))
      .filter(r=>String(r.visible??1)==="1" || r.visible===1)
      .sort((a,b)=>Number(a.orden||0)-Number(b.orden||0))
      .map(r=>s(r.subcategoria))
      .filter(Boolean);
  }
  // fallback: detectar desde productos
  const set=new Set();
  DB.productos.forEach(p=>{ if (p.categoria===cat && p.subcategoria) set.add(p.subcategoria); });
  return Array.from(set).sort((a,b)=>a.localeCompare(b));
}

function renderSubcategorias(){
  const sub=$("subchips");
  if (!sub) return;

  if (STATE.categoria==="Todas"){
    sub.style.display="none";
    sub.innerHTML="";
    STATE.subcategoria="Todas";
    $("btnShareSubcat") && ($("btnShareSubcat").style.display="none");
    return;
  }

  const subs=getSubcategoriasDeCategoria(STATE.categoria);
  if (!subs.length){
    sub.style.display="none";
    sub.innerHTML="";
    STATE.subcategoria="Todas";
    $("btnShareSubcat") && ($("btnShareSubcat").style.display="none");
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
    $("btnShareSubcat") && ($("btnShareSubcat").style.display="none");
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
      $("btnShareSubcat") && ($("btnShareSubcat").style.display="inline-flex");
    };
    sub.appendChild(b);
  });
}

function filteredProductos(){
  const q=STATE.query.trim().toLowerCase();
  return DB.productos
    .filter(p=>STATE.categoria==="Todas" ? true : p.categoria===STATE.categoria)
    .filter(p=>STATE.subcategoria==="Todas" ? true : p.subcategoria===STATE.subcategoria)
    .filter(p=>!q ? true : (p.nombre.toLowerCase().includes(q) || p.descripcion.toLowerCase().includes(q)))
    .sort((a,b)=>{
      const av=a.stock>0?0:1, bv=b.stock>0?0:1;
      if (av!==bv) return av-bv;
      return a.nombre.localeCompare(b.nombre);
    });
}

function productCard(p){
  const card=document.createElement("div");
  card.className="card";

  const isOut = p.stock<=0;
  const isOffer = p.precio_anterior>p.precio;
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
      <div class="cardName">${p.nombre}</div>
      <div class="cardDesc">${p.descripcion || p.subcategoria || p.categoria}</div>
      <div class="priceRow">
        <div class="price ${isOffer?"offer":""}">${fmtLps(p.precio)}</div>
        <div class="old">${isOffer?fmtLps(p.precio_anterior):""}</div>
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
  const labelCat=(STATE.categoria==="Todas")?"Productos":STATE.categoria;
  const labelSub=(STATE.subcategoria!=="Todas")?` · ${STATE.subcategoria}`:"";
  $("sectionTitle") && ($("sectionTitle").textContent=`${labelCat}${labelSub} (${list.length})`);

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

function wireUI(){
  // theme
  const saved = localStorage.getItem("sdc_theme") || "dark";
  setTheme(saved);
  $("btnTheme")?.addEventListener("click", ()=>{
    const now=document.body.classList.contains("light")?"light":"dark";
    setTheme(now==="light"?"dark":"light");
  });

  $("btnSearch")?.addEventListener("click", ()=> $("searchInput")?.focus());
  $("searchInput")?.addEventListener("input",(e)=>{
    STATE.query=e.target.value||"";
    renderProductos();
  });

  // compartir botones
  $("btnShareCategory")?.addEventListener("click", async ()=>{
    if (STATE.categoria==="Todas") return;
    await copyText(location.origin + location.pathname + `#cat=${encodeURIComponent(STATE.categoria)}`);
  });
  $("btnShareSubcat")?.addEventListener("click", async ()=>{
    if (STATE.categoria==="Todas" || STATE.subcategoria==="Todas") return;
    await copyText(location.origin + location.pathname + `#cat=${encodeURIComponent(STATE.categoria)}&sub=${encodeURIComponent(STATE.subcategoria)}`);
  });

  // titulo -> inicio
  document.addEventListener("click",(e)=>{
    const el=e.target.closest("#storeName");
    if (!el) return;
    e.preventDefault();
    window.scrollTo({top:0, behavior:"smooth"});
  });

  // carrito aún no (próximo paso)
  $("btnCart")?.addEventListener("click", ()=>{
    alert("Carrito: lo activamos en el siguiente paso ✅");
  });
}

async function init(){
  try{
    wireUI();
    showSkeleton();
    startLoadingMessageSwap();

    const data = await apiGetAll();
    stopLoadingMessageSwap();

    DB.productos = (data.productos||[]).map(normalizeProduct).filter(p=>p.id && p.nombre);
    DB.categorias = data.categorias||[];
    DB.subcategorias = data.subcategorias||[];
    DB.ajustes = data.ajustes||[];

    applyAjustes();

    const h = parseHash();
    if (h.cat) STATE.categoria = decodeURIComponent(h.cat);
    if (h.sub) STATE.subcategoria = decodeURIComponent(h.sub);

    renderCategorias();
    renderSubcategorias();
    renderProductos();

  }catch(err){
    stopLoadingMessageSwap();
    console.error(err);
    $("sectionTitle") && ($("sectionTitle").textContent="No se pudo cargar el catálogo.");
    $("grid") && ($("grid").innerHTML=`<div style="color:var(--muted);padding:10px 2px;">${String(err.message||err)}</div>`);
  }
}

init();

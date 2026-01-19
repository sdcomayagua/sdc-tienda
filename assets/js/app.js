/* SDComayagua - app.js (LEGIBLE)
   - Catálogo + categorías/subcategorías + ofertas
   - Modal producto (galería + video)
   - Carrito 1-2-3
   - UI carrito mejorada (sin "Eliminar" grande, sin "Cantidad: X")
*/

const API_URL =
  "https://script.google.com/macros/s/AKfycbytPfD9mq__VO7I2lnpBsqdCIT119ZT0zVyz0eeVjrJVgN_q8FYGgmqY6G66C2m67Pa4g/exec";

const CART_KEY = "sdc_cart_pro_v2";
const THEME_KEY = "sdc_theme_pro_v2";
const WA_NUMBER = "50431517755";

const $ = (id) => document.getElementById(id);
const safe = (v) => String(v ?? "").trim();
const money = (n) => `Lps. ${Math.round(Number(n || 0)).toLocaleString("es-HN")}`;

const isOffer = (p) => Number(p.precio_anterior || 0) > Number(p.precio || 0);
const isOut = (p) => Number(p.stock || 0) <= 0;

/** State */
let DATA = null;
let PRODUCTS = [];
let BY_ID = {};
let CART = [];
let CURRENT = null;

let CURRENT_CAT = null; // null = ver todo
let CURRENT_SUB = null; // null = todas
let QUERY = "";
let STEP = 1;

/** Theme */
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

/** Overlay + modals */
function openOverlay() { $("overlay").style.display = "block"; }
function closeOverlay() { $("overlay").style.display = "none"; }

function openModal(id) {
  openOverlay();
  $(id).style.display = "block";
}
function closeModal(id) {
  $(id).style.display = "none";
  if ($("productModal").style.display !== "block" && $("cartModal").style.display !== "block") {
    closeOverlay();
  }
}

/** Cart storage */
function loadCart() {
  try {
    CART = JSON.parse(localStorage.getItem(CART_KEY) || "[]");
  } catch {
    CART = [];
  }
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

/** API */
async function loadAPI() {
  const r = await fetch(API_URL, { cache: "no-store" });
  if (!r.ok) throw new Error("API HTTP " + r.status);
  return await r.json();
}

/** Categories */
function categoriesList() {
  let cats = [];
  if (DATA && Array.isArray(DATA.categorias) && DATA.categorias.length) {
    cats = DATA.categorias
      .filter((c) => String(c.visible ?? 1) === "1" || c.visible === 1 || c.visible === true)
      .sort((a, b) => Number(a.orden || 999999) - Number(b.orden || 999999))
      .map((c) => safe(c.categoria))
      .filter(Boolean);
  } else {
    cats = [...new Set(PRODUCTS.map((p) => p.categoria).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b)
    );
  }

  const out = [];
  if (PRODUCTS.some(isOffer)) out.push("OFERTAS");
  cats.forEach((c) => {
    if (c && String(c).toUpperCase() !== "OFERTAS") out.push(c);
  });
  return out;
}

function subcategoriesList(cat) {
  if (!cat || cat === "OFERTAS") return [];
  return [
    ...new Set(PRODUCTS.filter((p) => p.categoria === cat).map((p) => p.subcategoria).filter(Boolean)),
  ].sort((a, b) => a.localeCompare(b));
}

/** Render bars */
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

/** Filter/sort */
function filteredProducts() {
  let list = [...PRODUCTS];

  if (CURRENT_CAT) {
    list = CURRENT_CAT === "OFERTAS" ? list.filter(isOffer) : list.filter((p) => p.categoria === CURRENT_CAT);
  }
  if (CURRENT_SUB) list = list.filter((p) => p.subcategoria === CURRENT_SUB);

  const q = (QUERY || "").toLowerCase().trim();
  if (q) {
    list = list.filter((p) => {
      return (
        (p.nombre || "").toLowerCase().includes(q) ||
        (p.descripcion || "").toLowerCase().includes(q) ||
        (p.subcategoria || "").toLowerCase().includes(q)
      );
    });
  }

  // disponibles -> orden -> nombre -> agotados
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

/** Render products (Ver detalles 100% funciona) */
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
    card.dataset.pid = p.id;

    const btnHTML = out
      ? `<button class="btnDisabled" disabled>Agotado</button>`
      : `<button class="btnPrimary" type="button" onclick="window.__openProduct('${p.id}')">Ver detalles</button>`;

    card.innerHTML = `
      ${offer ? `<div class="tagOffer">OFERTA</div>` : ""}
      <img src="${p.imagen || ""}" alt="">
      <div class="cardBody">
        <div class="cardTitle">${p.nombre}</div>
        <div class="cardDesc">${p.descripcion || p.subcategoria || ""}</div>
        <div class="pr">
          <div class="p">${money(p.precio)}</div>
          ${offer ? `<div class="o">${money(p.precio_anterior)}</div>` : ""}
        </div>
        ${btnHTML}
      </div>
      ${out ? `<div class="tagOut">AGOTADO</div>` : ""}
    `;

    // tocar tarjeta abre detalles (si no agotado)
    if (!out) {
      card.addEventListener("click", (e) => {
        if (e.target.closest("button")) return;
        openProduct(p.id);
      });
    }

    grid.appendChild(card);
  });
}

/** Product modal */
function parseGallery(p) {
  const urls = [];
  if (p.imagen) urls.push(p.imagen);
  for (let i = 1; i <= 8; i++) {
    const k = "galeria_" + i;
    if (p[k]) urls.push(p[k]);
  }
  if (p.galeria) {
    String(p.galeria)
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean)
      .forEach((u) => urls.push(u));
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
    a.href = v;
    a.target = "_blank";
    a.rel = "noopener";
    a.className = "videoBtn";
    a.textContent = videoLabel(v);
    vwrap.appendChild(a);
  } else {
    vwrap.classList.add("hidden");
  }

  $("btnAddCart").disabled = isOut(p);
  $("btnAddCart").textContent = isOut(p) ? "Agotado" : "Agregar al carrito";
  $("modalHint").textContent = "";

  openModal("productModal");
}
window.__openProduct = openProduct; // ✅ clave del onclick inline

/** Cart UI (mejorada: sin texto "Eliminar" grande, sin "Cantidad: X") */
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
      saveCart();
      renderCart();
      updateTotals();
    };
    row.querySelector(".plus").onclick = () => {
      const stock = Number(p.stock || 0);
      if (stock > 0 && it.qty + 1 > stock) return alert("Stock disponible: " + stock);
      it.qty++;
      saveCart();
      renderCart();
      updateTotals();
    };
    row.querySelector(".trash").onclick = () => {
      CART.splice(idx, 1);
      saveCart();
      renderCart();
      updateTotals();
    };

    list.appendChild(row);
  });

  updateTotals();
}
function updateTotals() {
  const sub = cartSubtotal();
  $("subTotal").textContent = money(sub);
  $("shipTotal").textContent = money(0);
  $("grandTotal").textContent = money(sub);
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

  const lines = [];
  lines.push("🛒 PEDIDO - SDC", "");
  if (name) lines.push("👤 " + name);
  if (phone) lines.push("📞 " + phone);
  if (addr) lines.push("📍 " + addr);
  lines.push("", "Productos:");
  CART.forEach((it) => {
    const p = BY_ID[it.id];
    if (p) lines.push(`- ${it.qty} x ${p.nombre} (${money(p.precio)})`);
  });
  lines.push("", "Total: " + money(cartSubtotal()));
  window.open(`https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(lines.join("\n"))}`, "_blank");
}

/** Events */
function wire() {
  $("overlay").onclick = () => {
    closeModal("productModal");
    closeModal("cartModal");
  };
  $("closeProduct").onclick = () => closeModal("productModal");
  $("closeCart").onclick = () => closeModal("cartModal");

  $("btnKeepBuying").onclick = () => closeModal("productModal");
  $("btnGoPay").onclick = () => {
    closeModal("productModal");
    openCart();
  };

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
      setStep(2);
      return;
    }
    if (STEP === 2) {
      const name = safe($("custName").value);
      const addr = safe($("custAddr").value);
      if (name.length < 3) return alert("Escribe tu nombre");
      if (addr.length < 6) return alert("Escribe tu dirección");
      setStep(3);
      return;
    }
    if (STEP === 3) sendWhatsApp();
  };

  $("btnSendWA").onclick = sendWhatsApp;

  $("goTop").onclick = () => window.scrollTo({ top: 0, behavior: "smooth" });
  $("searchBtn").onclick = () => $("searchInput").focus();
  $("themeBtn").onclick = toggleTheme;
  $("cartBtn").onclick = openCart;

  $("searchInput").addEventListener("input", (e) => {
    QUERY = e.target.value || "";
    renderProducts();
  });
}

/** Init */
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

    renderCategories();
    renderSubcategories();
    renderProducts();
    wire();
  } catch (err) {
    console.error(err);
    $("productsGrid").innerHTML = `<div style="grid-column:1/-1;color:var(--muted);padding:12px">Error cargando catálogo: ${String(
      err.message || err
    )}</div>`;
  } finally {
    $("loadingMsg").style.display = "none";
  }
}

/** renderCategories/subcategories/filteredProducts already in file */
function renderCategories(){const bar=$("categoryBar");bar.innerHTML="";const all=document.createElement("button");all.className="pill"+(!CURRENT_CAT?" active":"");all.textContent="VER TODO";all.onclick=()=>{CURRENT_CAT=null;CURRENT_SUB=null;renderCategories();renderSubcategories();renderProducts();};bar.appendChild(all);categoriesList().forEach(cat=>{const b=document.createElement("button");b.className="pill"+(CURRENT_CAT===cat?" active":"");b.textContent=cat;b.onclick=()=>{CURRENT_CAT=cat;CURRENT_SUB=null;renderCategories();renderSubcategories();renderProducts();};bar.appendChild(b);});}
function renderSubcategories(){const bar=$("subcategories");bar.innerHTML="";const subs=subcategoriesList(CURRENT_CAT);if(!CURRENT_CAT||CURRENT_CAT==="OFERTAS"||subs.length===0){bar.style.display="none";return;}bar.style.display="flex";const all=document.createElement("button");all.className="pill"+(!CURRENT_SUB?" active":"");all.textContent="Todas";all.onclick=()=>{CURRENT_SUB=null;renderSubcategories();renderProducts();};bar.appendChild(all);subs.forEach(sc=>{const b=document.createElement("button");b.className="pill"+(CURRENT_SUB===sc?" active":"");b.textContent=sc;b.onclick=()=>{CURRENT_SUB=sc;renderSubcategories();renderProducts();};bar.appendChild(b);});}
function categoriesList(){let cats=[];if(DATA&&Array.isArray(DATA.categorias)&&DATA.categorias.length){cats=DATA.categorias.filter(c=>String(c.visible??1)==="1"||c.visible===1||c.visible===true).sort((a,b)=>Number(a.orden||999999)-Number(b.orden||999999)).map(c=>safe(c.categoria)).filter(Boolean);}else{cats=[...new Set(PRODUCTS.map(p=>p.categoria).filter(Boolean))].sort((a,b)=>a.localeCompare(b));}const out=[];if(PRODUCTS.some(isOffer))out.push("OFERTAS");cats.forEach(c=>{if(c&&String(c).toUpperCase()!=="OFERTAS")out.push(c);});return out;}
function subcategoriesList(cat){if(!cat||cat==="OFERTAS")return[];return[...new Set(PRODUCTS.filter(p=>p.categoria===cat).map(p=>p.subcategoria).filter(Boolean))].sort((a,b)=>a.localeCompare(b));}
function filteredProducts(){let list=[...PRODUCTS];if(CURRENT_CAT){list=(CURRENT_CAT==="OFERTAS")?list.filter(isOffer):list.filter(p=>p.categoria===CURRENT_CAT);}if(CURRENT_SUB)list=list.filter(p=>p.subcategoria===CURRENT_SUB);const q=(QUERY||"").toLowerCase().trim();if(q){list=list.filter(p=>(p.nombre||"").toLowerCase().includes(q)||(p.descripcion||"").toLowerCase().includes(q)||(p.subcategoria||"").toLowerCase().includes(q));}list.sort((a,b)=>{const av=a.stock>0?0:1,bv=b.stock>0?0:1;if(av!==bv)return av-bv;const ao=Number(a.orden||999999),bo=Number(b.orden||999999);if(ao!==bo)return ao-bo;return(a.nombre||"").localeCompare(b.nombre||"");});return list;}

document.addEventListener("DOMContentLoaded", init);
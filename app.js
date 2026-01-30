// SDComayagua - Tienda 2026 (versión mejorada - enero 2026)
(() => {
  const API_URL = "https://script.google.com/macros/s/AKfycbytPfD9mq__VO7I2lnpBsqdCIT119ZT0zVyz0eeVjrJVgN_q8FYGgmqY6G66C2m67Pa4g/exec";
  const FALLBACK_IMG = "assets/img/no-image.png";
  const CART_KEY = "sdc_cart_2026_v3";
  const THEME_KEY = "sdc_theme_2026_v2";
  const WA_NUMBER = "50431517755";

  const $ = id => document.getElementById(id);
  const safe = v => String(v ?? "").trim();
  const money = n => `Lps. ${Math.round(Number(n || 0)).toLocaleString("es-HN")}`;

  let PRODUCTS = [], BY_ID = {}, CART = [];
  let CURRENT = null, QUERY = "", CURRENT_CAT = null, CURRENT_SUB = null;
  let PAGE = 1, PER_PAGE = 20;
  let fuse = null;

  function applyTheme() {
    const theme = localStorage.getItem(THEME_KEY) || "dark";
    document.body.classList.toggle("light", theme === "light");
    $("themeBtn").innerHTML = theme === "light" ? '<i class="ri-sun-line"></i>' : '<i class="ri-moon-line"></i>';
  }

  function toggleTheme() {
    const isLight = document.body.classList.toggle("light");
    localStorage.setItem(THEME_KEY, isLight ? "light" : "dark");
    applyTheme();
  }

  function loadCart() {
    try {
      CART = JSON.parse(localStorage.getItem(CART_KEY) || "[]");
    } catch {
      CART = [];
    }
    updateCartBadge();
  }

  function saveCart() {
    localStorage.setItem(CART_KEY, JSON.stringify(CART));
    updateCartBadge();
  }

  function updateCartBadge() {
    const count = CART.reduce((sum, item) => sum + (item.qty || 1), 0);
    $("cartCount").textContent = count;
  }

  async function fetchData() {
    try {
      const res = await fetch(API_URL + "?action=get_all", { cache: "no-store" });
      if (!res.ok) throw new Error("API error " + res.status);
      const data = await res.json();
      PRODUCTS = (data.productos || []).map(p => ({
        id: safe(p.id || `prod_${Date.now()}_${Math.random().toString(36).slice(2,8)}`),
        nombre: safe(p.nombre),
        precio: Number(p.precio || 0),
        precio_anterior: Number(p.precio_anterior || 0),
        stock: Number(p.stock || 0),
        categoria: safe(p.categoria || "General"),
        subcategoria: safe(p.subcategoria || ""),
        descripcion: safe(p.descripcion || ""),
        imagen: safe(p.imagen) || FALLBACK_IMG,
        galeria: safe(p.galeria || ""),
        video: safe(p.video || ""),
        galeria_1: safe(p.galeria_1 || ""), // hasta galeria_8 si existen
      })).filter(p => p.nombre);

      BY_ID = {};
      PRODUCTS.forEach(p => BY_ID[p.id] = p);

      // Inicializar Fuse para búsqueda tolerante
      fuse = new Fuse(PRODUCTS, {
        keys: ["nombre", "descripcion", "categoria", "subcategoria"],
        threshold: 0.3,
        ignoreLocation: true,
        includeScore: true
      });

      return true;
    } catch (err) {
      console.error("Error cargando datos:", err);
      $("productsGrid").innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:40px; color:var(--muted);">No pudimos cargar el catálogo.<br><small>${err.message}</small></div>`;
      return false;
    }
  }

  function renderCategories() {
    const container = $("categoryBar");
    container.innerHTML = "";
    const cats = [...new Set(PRODUCTS.map(p => p.categoria))].sort();
    cats.forEach(cat => {
      const btn = document.createElement("button");
      btn.className = "pill" + (CURRENT_CAT === cat ? " active" : "");
      btn.textContent = cat;
      btn.onclick = () => {
        CURRENT_CAT = CURRENT_CAT === cat ? null : cat;
        CURRENT_SUB = null;
        PAGE = 1;
        renderCategories();
        renderSubcategories();
        renderProducts();
      };
      container.appendChild(btn);
    });
  }

  function renderSubcategories() {
    const container = $("subcategories");
    container.innerHTML = "";
    if (!CURRENT_CAT) {
      container.style.display = "none";
      return;
    }
    container.style.display = "flex";
    const subs = [...new Set(PRODUCTS.filter(p => p.categoria === CURRENT_CAT).map(p => p.subcategoria))].filter(Boolean).sort();
    subs.forEach(sub => {
      const btn = document.createElement("button");
      btn.className = "pill" + (CURRENT_SUB === sub ? " active" : "");
      btn.textContent = sub;
      btn.onclick = () => {
        CURRENT_SUB = CURRENT_SUB === sub ? null : sub;
        PAGE = 1;
        renderSubcategories();
        renderProducts();
      };
      container.appendChild(btn);
    });
  }

  function renderProducts() {
    const grid = $("productsGrid");
    grid.innerHTML = "";

    let filtered = PRODUCTS;

    // Filtros de categoría y subcategoría
    if (CURRENT_CAT) filtered = filtered.filter(p => p.categoria === CURRENT_CAT);
    if (CURRENT_SUB) filtered = filtered.filter(p => p.subcategoria === CURRENT_SUB);

    // Búsqueda
    if (QUERY.trim()) {
      const result = fuse.search(QUERY.trim());
      filtered = result.map(r => r.item);
    }

    const total = filtered.length;
    const start = (PAGE - 1) * PER_PAGE;
    const end = start + PER_PAGE;
    const pageItems = filtered.slice(start, end);

    pageItems.forEach(p => {
      const card = document.createElement("div");
      card.className = "card" + (p.stock <= 0 ? " out" : "");
      card.innerHTML = `
        <div class="cardImgWrap">
          <img class="cardImg lazy" src="${FALLBACK_IMG}" data-src="${p.imagen}" alt="${p.nombre}" loading="lazy">
          ${p.stock <= 0 ? '<div class="tagOut">AGOTADO</div>' : ''}
          ${p.precio_anterior > p.precio ? `<div class="tagOffer">-${Math.round((p.precio_anterior - p.precio)/p.precio_anterior*100)}%</div>` : ''}
        </div>
        <div class="cardBody">
          <div class="cardTitle">${p.nombre}</div>
          <div class="cardPrice">${money(p.precio)}</div>
          ${p.precio_anterior > p.precio ? `<div class="cardOldPrice">${money(p.precio_anterior)}</div>` : ''}
          <button class="bp small" data-id="${p.id}">Ver detalles</button>
        </div>
      `;
      grid.appendChild(card);
    });

    // Lazy loading
    document.querySelectorAll("img.lazy").forEach(img => {
      if (img.dataset.src) {
        img.src = img.dataset.src;
        img.onload = () => img.classList.add("loaded");
      }
    });

    // Paginación
    const pagContainer = $("paginationContainer");
    pagContainer.innerHTML = "";
    if (total > PER_PAGE) {
      const pag = document.createElement("div");
      pag.className = "pagination";
      pag.innerHTML = `
        <button ${PAGE === 1 ? "disabled" : ""} onclick="changePage(${PAGE-1})">Anterior</button>
        <span>Pág. ${PAGE} de ${Math.ceil(total / PER_PAGE)}</span>
        <button ${end >= total ? "disabled" : ""} onclick="changePage(${PAGE+1})">Siguiente</button>
      `;
      pagContainer.appendChild(pag);
    }

    $("sectionTitle").textContent = QUERY ? `Resultados para "${QUERY}"` : (CURRENT_CAT || "Catálogo");
  }

  window.changePage = function(newPage) {
    if (newPage < 1) return;
    PAGE = newPage;
    renderProducts();
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Debounce para búsqueda
  let searchTimer;
  $("searchInput").addEventListener("input", e => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      QUERY = e.target.value.trim();
      PAGE = 1;
      renderProducts();
    }, 400);
  });

  function initEventListeners() {
    $("themeBtn").onclick = toggleTheme;
    $("goTop").onclick = () => window.scrollTo({ top: 0, behavior: "smooth" });
    $("searchBtn").onclick = () => $("searchInput").focus();

    document.addEventListener("click", e => {
      if (e.target.matches("[data-id]")) {
        const id = e.target.dataset.id;
        const product = BY_ID[id];
        if (product) showProductModal(product);
      }
    });
  }

  async function init() {
    applyTheme();
    loadCart();
    const loaded = await fetchData();
    if (loaded) {
      renderCategories();
      renderProducts();
      initEventListeners();
    }
    $("pageLoader").style.display = "none";
    document.body.classList.remove("page-loading");
  }

  document.addEventListener("DOMContentLoaded", init);
})();

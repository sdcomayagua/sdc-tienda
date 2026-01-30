// SDComayagua - Tienda 2026 (versión corregida completa - enero 2026)
(() => {
  const API_URL = "https://script.google.com/macros/s/AKfycbytPfD9mq__VO7I2lnpBsqdCIT119ZT0zVyz0eeVjrJVgN_q8FYGgmqY6G66C2m67Pa4g/exec";
  const FALLBACK_IMG = "assets/img/no-image.png";
  const CART_KEY = "sdc_cart_2026_v3";
  const THEME_KEY = "sdc_theme_2026_v2";
  const WA_NUMBER = "50431517755";

  const $ = id => document.getElementById(id);
  const safe = v => String(v ?? "").trim();
  const money = n => `Lps. ${Math.round(Number(n || 0)).toLocaleString("es-HN")}`;
  const isOut = p => Number(p.stock || 0) <= 0;
  const isOffer = p => Number(p.precio_anterior || 0) > Number(p.precio || 0);

  let PRODUCTS = [], BY_ID = {}, CART = [];
  let CURRENT = null, QUERY = "", CURRENT_CAT = null, CURRENT_SUB = null;
  let PAGE = 1, PER_PAGE = 20;
  let fuse = null;
  let STEP = 1;

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
    renderCartItems();
  }

  function saveCart() {
    localStorage.setItem(CART_KEY, JSON.stringify(CART));
    updateCartBadge();
    renderCartItems();
  }

  function updateCartBadge() {
    const count = CART.reduce((sum, item) => sum + (item.qty || 1), 0);
    $("cartCount").textContent = count;
  }

  function cartSubtotal() {
    return CART.reduce((sum, item) => {
      const p = BY_ID[item.id];
      return p ? sum + Number(p.precio || 0) * Number(item.qty || 1) : sum;
    }, 0);
  }

  function renderCartItems() {
    const container = $("cartItems");
    if (!container) return;
    container.innerHTML = "";
    if (!CART.length) {
      $("cartEmpty").style.display = "block";
    } else {
      $("cartEmpty").style.display = "none";
      CART.forEach(item => {
        const p = BY_ID[item.id];
        if (!p) return;
        const div = document.createElement("div");
        div.className = "ciItem";
        div.innerHTML = `
          <img src="${p.imagen || FALLBACK_IMG}" alt="${p.nombre}">
          <div class="ciMeta">
            <div class="ciName">${p.nombre}</div>
            <div class="ciPrice">${money(p.precio * item.qty)}</div>
          </div>
          <div class="ciQty">
            <button onclick="changeQty('${item.id}', -1)">-</button>
            <span>${item.qty}</span>
            <button onclick="changeQty('${item.id}', 1)">+</button>
          </div>
        `;
        container.appendChild(div);
      });
    }
    $("subTotal").textContent = money(cartSubtotal());
    $("grandTotal").textContent = money(cartSubtotal()); // Envío 0 por ahora
  }

  window.changeQty = (id, delta) => {
    const item = CART.find(i => i.id === id);
    if (item) {
      item.qty = Math.max(1, (item.qty || 1) + delta);
      saveCart();
    }
  };

  async function fetchData() {
    try {
      const res = await fetch(API_URL, { cache: "no-store" });
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
        galeria_1: safe(p.galeria_1 || ""), // Soporte para galeria_1 a _8
        // Agregar más si es necesario
      })).filter(p => p.nombre);

      BY_ID = {};
      PRODUCTS.forEach(p => BY_ID[p.id] = p);

      // Inicializar Fuse para búsqueda
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

    if (CURRENT_CAT) filtered = filtered.filter(p => p.categoria === CURRENT_CAT);
    if (CURRENT_SUB) filtered = filtered.filter(p => p.subcategoria === CURRENT_SUB);

    if (QUERY.trim()) {
      const result = fuse.search(QUERY.trim());
      filtered = result.map(r => r.item);
    }

    const total = filtered.length;
    const start = (PAGE - 1) * PER_PAGE;
    const end = Math.min(start + PER_PAGE, total);
    const pageItems = filtered.slice(start, end);

    if (!pageItems.length) {
      grid.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:40px; color:var(--muted);">No se encontraron productos.</div>';
    }

    pageItems.forEach(p => {
      const card = document.createElement("div");
      card.className = "card" + (isOut(p) ? " out" : "");
      card.innerHTML = `
        <div class="cardImgWrap">
          <img class="cardImg lazy" src="${FALLBACK_IMG}" data-src="${p.imagen}" alt="${p.nombre}" loading="lazy">
          ${isOut(p) ? '<div class="tagOut">AGOTADO</div>' : ''}
          ${isOffer(p) ? `<div class="tagOffer">-${Math.round((p.precio_anterior - p.precio)/p.precio_anterior*100)}%</div>` : ''}
        </div>
        <div class="cardBody">
          <div class="cardTitle">${p.nombre}</div>
          <div class="cardPrice">${money(p.precio)}</div>
          ${isOffer(p) ? `<div class="cardOldPrice">${money(p.precio_anterior)}</div>` : ''}
          <button class="bp small" data-id="${p.id}" ${isOut(p) ? 'disabled' : ''}>Ver detalles</button>
        </div>
      `;
      grid.appendChild(card);
    });

    // Lazy load images
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
          if (img.dataset.src) {
            img.src = img.dataset.src;
            img.onload = () => img.classList.add("loaded");
            img.onerror = () => img.src = FALLBACK_IMG;
          }
          observer.unobserve(img);
        }
      });
    });
    document.querySelectorAll("img.lazy").forEach(img => observer.observe(img));

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

    $("sectionTitle").textContent = QUERY ? `Resultados para "${QUERY}" (${total})` : (CURRENT_CAT || "Catálogo");
  }

  window.changePage = function(newPage) {
    if (newPage < 1 || newPage > Math.ceil(PRODUCTS.length / PER_PAGE)) return;
    PAGE = newPage;
    renderProducts();
    window.scrollTo({ top: $("productsGrid").offsetTop - 100, behavior: "smooth" });
  };

  function showProductModal(p) {
    CURRENT = p;
    $("modalTitle").textContent = p.nombre;
    $("modalPrice").textContent = money(p.precio);
    $("modalOldPrice").textContent = isOffer(p) ? money(p.precio_anterior) : "";
    $("modalDesc").textContent = p.descripcion || "Sin descripción disponible.";
    $("modalStock").textContent = isOut(p) ? "Agotado" : `Stock: ${p.stock}`;
    $("modalStock").className = isOut(p) ? "stock out" : "stock";
    $("modalMainImg").src = p.imagen || FALLBACK_IMG;
    $("modalMainImg").alt = p.nombre;

    // Galería
    const thumbs = $("modalThumbs");
    thumbs.innerHTML = "";
    thumbs.style.display = "none";
    const gallery = [p.imagen, p.galeria_1 /* agregar más galeria_X si existen */].filter(Boolean);
    if (gallery.length > 1) {
      thumbs.style.display = "flex";
      gallery.forEach((src, idx) => {
        const btn = document.createElement("button");
        btn.innerHTML = `<img src="${src}" alt="Imagen ${idx+1}">`;
        btn.className = idx === 0 ? "active" : "";
        btn.onclick = () => {
          $("modalMainImg").src = src;
          thumbs.querySelectorAll("button").forEach(b => b.classList.remove("active"));
          btn.classList.add("active");
        };
        thumbs.appendChild(btn);
      });
    }

    // Video
    const video = $("modalVideo");
    video.innerHTML = "";
    video.style.display = "none";
    if (p.video) {
      video.style.display = "block";
      video.innerHTML = `<a href="${p.video}" target="_blank" rel="noopener">Ver video</a>`;
    }

    $("backdrop").style.display = "block";
    $("prodModal").style.display = "block";
  }

  function closeModal(id) {
    $(id).style.display = "none";
    if ($("prodModal").style.display === "none" && $("cartModal").style.display === "none") {
      $("backdrop").style.display = "none";
    }
  }

  function openCart() {
    $("backdrop").style.display = "block";
    $("cartModal").style.display = "block";
    renderCartItems();
  }

  function setStep(newStep) {
    STEP = newStep;
    ["step1", "step2", "step3"].forEach((s, i) => $(s).style.display = (i+1 === STEP) ? "block" : "none");
    $("tab1").classList.toggle("active", STEP === 1);
    $("tab2").classList.toggle("active", STEP === 2);
    $("tab3").classList.toggle("active", STEP === 3);
  }

  function sendWhatsApp() {
    const msg = CART.map(item => {
      const p = BY_ID[item.id];
      return p ? `${p.nombre} x${item.qty} - ${money(p.precio * item.qty)}` : "";
    }).join("\n");
    const total = money(cartSubtotal());
    window.open(`https://wa.me/${WA_NUMBER}?text=Pedido:%0A${encodeURIComponent(msg)}%0ATotal: ${total}`, "_blank");
  }

  // Debounce para búsqueda
  let searchTimer;
  $("searchInput").addEventListener("input", e => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      QUERY = e.target.value.trim();
      PAGE = 1;
      renderProducts();
    }, 300);
  });

  function initEventListeners() {
    $("themeBtn").onclick = toggleTheme;
    $("goTop").onclick = () => window.scrollTo({ top: 0, behavior: "smooth" });
    $("searchBtn").onclick = () => $("searchInput").focus();
    $("cartBtn").onclick = openCart;
    $("btnCloseProd").onclick = () => closeModal("prodModal");
    $("closeCart").onclick = () => closeModal("cartModal");
    $("btnKeepBuying").onclick = () => closeModal("prodModal");
    $("btnGoPay").onclick = () => { closeModal("prodModal"); openCart(); };
    $("btnAddCart").onclick = () => {
      if (!CURRENT || isOut(CURRENT)) return;
      let item = CART.find(i => i.id === CURRENT.id);
      if (item) item.qty = (item.qty || 1) + 1;
      else CART.push({ id: CURRENT.id, qty: 1 });
      saveCart();
      alert("Agregado al carrito!");
    };
    $("tab1").onclick = () => setStep(1);
    $("tab2").onclick = () => setStep(2);
    $("tab3").onclick = () => setStep(3);
    $("btnBack").onclick = () => { if (STEP > 1) setStep(STEP - 1); };
    $("btnNext").onclick = () => {
      if (STEP === 1 && !CART.length) return alert("Carrito vacío");
      if (STEP < 3) setStep(STEP + 1);
      if (STEP === 3) sendWhatsApp();
    };
    $("btnSendWA").onclick = sendWhatsApp;

    document.addEventListener("click", e => {
      if (e.target.matches("[data-id]")) {
        const id = e.target.dataset.id;
        const product = BY_ID[id];
        if (product && !isOut(product)) showProductModal(product);
      }
    });

    $("backdrop").onclick = () => {
      closeModal("prodModal");
      closeModal("cartModal");
    };
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

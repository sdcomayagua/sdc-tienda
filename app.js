(() => {
  const API_URL = "https://script.google.com/macros/s/AKfycbytPfD9mq__VO7I2lnpBsqdCIT119ZT0zVyz0eeVjrJVgN_q8FYGgmqY6G66C2m67Pa4g/exec";
  const FALLBACK_IMG = "no-image.png"; // ajusta la ruta si es necesario
  const CART_KEY = "sdc_cart_2026";
  const WA_NUMBER = "50431517755";

  const $ = id => document.getElementById(id);
  const safe = v => String(v ?? "").trim();
  const money = n => `Lps. ${Math.round(Number(n||0)).toLocaleString("es-HN")}`;

  let PRODUCTS = [], BY_ID = {}, CART = [];
  let CURRENT_PRODUCT = null;
  let QUERY = "", CURRENT_CAT = null, CURRENT_SUB = null;
  let PAGE = 1, PER_PAGE = 20;
  let fuse = null;

  function applyTheme() {
    const theme = localStorage.getItem("theme") || "dark";
    document.body.classList.toggle("light", theme === "light");
    $("themeBtn").innerHTML = theme === "light" ? '<i class="ri-sun-line"></i>' : '<i class="ri-moon-line"></i>';
  }

  function toggleTheme() {
    const isLight = document.body.classList.toggle("light");
    localStorage.setItem("theme", isLight ? "light" : "dark");
    applyTheme();
  }

  function loadCart() {
    try { CART = JSON.parse(localStorage.getItem(CART_KEY) || "[]"); } catch { CART = []; }
    updateBadge();
  }

  function saveCart() {
    localStorage.setItem(CART_KEY, JSON.stringify(CART));
    updateBadge();
  }

  function updateBadge() {
    const count = CART.reduce((sum, item) => sum + (item.qty||1), 0);
    $("cartCount").textContent = count;
  }

  async function loadData() {
    try {
      const res = await fetch(API_URL);
      if (!res.ok) throw new Error(res.status);
      const data = await res.json();
      PRODUCTS = (data.productos || []).map(p => ({
        id: safe(p.id || `auto_${Date.now()}`),
        nombre: safe(p.nombre),
        precio: Number(p.precio || 0),
        precio_anterior: Number(p.precio_anterior || 0),
        stock: Number(p.stock || 0),
        categoria: safe(p.categoria || "General"),
        subcategoria: safe(p.subcategoria || ""),
        descripcion: safe(p.descripcion || ""),
        imagen: safe(p.imagen) || FALLBACK_IMG,
        galeria_1: safe(p.galeria_1 || ""),
        video: safe(p.video || "")
      })).filter(p => p.nombre);

      BY_ID = {};
      PRODUCTS.forEach(p => BY_ID[p.id] = p);

      fuse = new Fuse(PRODUCTS, {
        keys: ["nombre", "descripcion", "categoria", "subcategoria"],
        threshold: 0.3
      });

      return true;
    } catch (e) {
      console.error(e);
      $("productsGrid").innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:60px 20px; color:var(--muted);">Error cargando productos</div>`;
      return false;
    }
  }

  function renderCategories() {
    const bar = $("categoryBar");
    bar.innerHTML = "";
    const cats = [...new Set(PRODUCTS.map(p => p.categoria))].sort();
    cats.forEach(c => {
      const b = document.createElement("button");
      b.className = `pill${CURRENT_CAT === c ? " active" : ""}`;
      b.textContent = c;
      b.onclick = () => {
        CURRENT_CAT = CURRENT_CAT === c ? null : c;
        CURRENT_SUB = null;
        PAGE = 1;
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
    if (!CURRENT_CAT) { bar.style.display = "none"; return; }
    bar.style.display = "flex";
    const subs = [...new Set(PRODUCTS.filter(p => p.categoria === CURRENT_CAT).map(p => p.subcategoria))].filter(Boolean).sort();
    subs.forEach(s => {
      const b = document.createElement("button");
      b.className = `pill${CURRENT_SUB === s ? " active" : ""}`;
      b.textContent = s;
      b.onclick = () => {
        CURRENT_SUB = CURRENT_SUB === s ? null : s;
        PAGE = 1;
        renderSubcategories();
        renderProducts();
      };
      bar.appendChild(b);
    });
  }

  function renderProducts() {
    const grid = $("productsGrid");
    grid.innerHTML = "";

    let list = PRODUCTS;
    if (CURRENT_CAT) list = list.filter(p => p.categoria === CURRENT_CAT);
    if (CURRENT_SUB) list = list.filter(p => p.subcategoria === CURRENT_SUB);
    if (QUERY.trim()) list = fuse.search(QUERY.trim()).map(r => r.item);

    const total = list.length;
    const start = (PAGE - 1) * PER_PAGE;
    const pageItems = list.slice(start, start + PER_PAGE);

    pageItems.forEach(p => {
      const card = document.createElement("div");
      card.className = `card${p.stock <= 0 ? " out" : ""}`;
      card.innerHTML = `
        <div class="cardImgWrap">
          <img class="cardImg lazy" src="${FALLBACK_IMG}" data-src="${p.imagen}" alt="${p.nombre}" loading="lazy">
          ${p.stock <= 0 ? '<span class="tagOut">AGOTADO</span>' : ''}
          ${p.precio_anterior > p.precio ? `<span class="tagOffer">-${Math.round((p.precio_anterior - p.precio) / p.precio_anterior * 100)}%</span>` : ''}
        </div>
        <div class="cardBody">
          <div class="cardTitle">${p.nombre}</div>
          <div class="cardPrice">${money(p.precio)}</div>
          ${p.precio_anterior > p.precio ? `<div class="cardOld">${money(p.precio_anterior)}</div>` : ''}
          <button class="bp small" data-id="${p.id}">Ver detalles</button>
        </div>
      `;
      grid.appendChild(card);
    });

    // Lazy loading observer
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
          img.src = img.dataset.src;
          img.classList.add("loaded");
          observer.unobserve(img);
        }
      });
    });
    document.querySelectorAll("img.lazy").forEach(img => observer.observe(img));

    // Paginación
    $("paginationContainer").innerHTML = total > PER_PAGE ? `
      <div class="pagination">
        <button ${PAGE <= 1 ? "disabled" : ""} onclick="changePage(${PAGE-1})">Anterior</button>
        <span>Pág ${PAGE} de ${Math.ceil(total/PER_PAGE)}</span>
        <button ${start + PER_PAGE >= total ? "disabled" : ""} onclick="changePage(${PAGE+1})">Siguiente</button>
      </div>
    ` : "";

    $("sectionTitle").textContent = QUERY ? `Resultados (${total})` : (CURRENT_CAT || "Catálogo");
  }

  window.changePage = (n) => {
    PAGE = Math.max(1, n);
    renderProducts();
    window.scrollTo({top: $("productsGrid").offsetTop - 80, behavior: "smooth"});
  };

  function showProduct(p) {
    CURRENT_PRODUCT = p;
    $("modalTitle").textContent = p.nombre;
    $("modalPrice").textContent = money(p.precio);
    $("modalOldPrice").textContent = p.precio_anterior > p.precio ? money(p.precio_anterior) : "";
    $("modalDesc").textContent = p.descripcion || "Sin descripción.";
    $("modalStock").textContent = p.stock <= 0 ? "Agotado" : `Disponible (${p.stock})`;
    $("modalStock").style.color = p.stock <= 0 ? "var(--danger)" : "var(--success)";

    $("modalMainImg").src = p.imagen || FALLBACK_IMG;
    $("modalMainImg").onerror = () => $("modalMainImg").src = FALLBACK_IMG;

    // Thumbs simples
    const thumbs = $("modalThumbs");
    thumbs.innerHTML = "";
    thumbs.style.display = "none";
    const imgs = [p.imagen, p.galeria_1].filter(Boolean);
    if (imgs.length > 1) {
      thumbs.style.display = "flex";
      imgs.forEach((src, i) => {
        const img = document.createElement("img");
        img.src = src;
        img.onclick = () => $("modalMainImg").src = src;
        thumbs.appendChild(img);
      });
    }

    // Video
    $("modalVideo").innerHTML = p.video ? `<a href="${p.video}" target="_blank" class="bp">Ver video</a>` : "";

    $("backdrop").style.display = "block";
    $("prodModal").style.display = "block";
  }

  function closeModals() {
    $("prodModal").style.display = "none";
    $("cartModal").style.display = "none";
    $("backdrop").style.display = "none";
  }

  function renderCart() {
    const cont = $("cartItems");
    cont.innerHTML = "";
    if (!CART.length) {
      $("cartEmpty").style.display = "block";
      return;
    }
    $("cartEmpty").style.display = "none";

    let subtotal = 0;
    CART.forEach(item => {
      const p = BY_ID[item.id];
      if (!p) return;
      const totalItem = p.precio * (item.qty || 1);
      subtotal += totalItem;

      const row = document.createElement("div");
      row.className = "cartItem";
      row.innerHTML = `
        <div style="flex:1">
          <strong>${p.nombre}</strong><br>
          <small>${money(p.precio)} × ${item.qty || 1} = ${money(totalItem)}</small>
        </div>
        <div>
          <button onclick="updateQty('${item.id}', -1)">-</button>
          <span>${item.qty || 1}</span>
          <button onclick="updateQty('${item.id}', 1)">+</button>
        </div>
      `;
      cont.appendChild(row);
    });

    $("subTotal").textContent = money(subtotal);
    $("grandTotal").textContent = money(subtotal);
  }

  window.updateQty = (id, delta) => {
    const item = CART.find(i => i.id === id);
    if (item) {
      item.qty = Math.max(1, (item.qty || 1) + delta);
      saveCart();
      renderCart();
    }
  };

  function sendOrder() {
    if (!CART.length) return alert("Carrito vacío");
    let text = "¡Hola! Quiero hacer este pedido:\n\n";
    CART.forEach(i => {
      const p = BY_ID[i.id];
      if (p) text += `• ${p.nombre} x${i.qty || 1} → ${money(p.precio * (i.qty||1))}\n`;
    });
    text += `\nTotal: ${$("grandTotal").textContent}`;
    window.open(`https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(text)}`, "_blank");
  }

  // Eventos
  function initEvents() {
    $("themeBtn").onclick = toggleTheme;
    $("searchBtn").onclick = () => $("searchInput").focus();
    $("cartBtn").onclick = () => {
      renderCart();
      $("backdrop").style.display = "block";
      $("cartModal").style.display = "block";
    };
    $("closeCart").onclick = closeModals;
    $("btnCheckout").onclick = sendOrder;

    $("btnCloseProd").onclick = closeModals;
    $("btnKeepBuying").onclick = closeModals;
    $("btnAddCart").onclick = () => {
      if (!CURRENT_PRODUCT || CURRENT_PRODUCT.stock <= 0) return;
      let item = CART.find(i => i.id === CURRENT_PRODUCT.id);
      if (item) item.qty = (item.qty || 1) + 1;
      else CART.push({id: CURRENT_PRODUCT.id, qty: 1});
      saveCart();
      alert("¡Agregado al carrito!");
    };
    $("btnWhatsApp").onclick = () => {
      if (!CURRENT_PRODUCT) return;
      const text = `Hola, me interesa: ${CURRENT_PRODUCT.nombre} - ${money(CURRENT_PRODUCT.precio)}\n${location.href}`;
      window.open(`https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(text)}`, "_blank");
    };

    $("searchInput").oninput = e => {
      QUERY = e.target.value.trim();
      PAGE = 1;
      renderProducts();
    };

    document.addEventListener("click", e => {
      const btn = e.target.closest("[data-id]");
      if (btn) {
        const id = btn.dataset.id;
        const prod = BY_ID[id];
        if (prod) showProduct(prod);
      }
    });
  }

  async function start() {
    applyTheme();
    loadCart();
    const ok = await loadData();
    if (ok) {
      renderCategories();
      renderProducts();
      initEvents();
    }
    $("pageLoader").style.display = "none";
    document.body.classList.remove("page-loading");
  }

  document.addEventListener("DOMContentLoaded", start);
})();

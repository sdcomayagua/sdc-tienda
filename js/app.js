
(()=> {
  const S = window.SDC || {};
  const API = S.API_URL;

  const $ = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
  const norm = (s) => String(s ?? "").trim().toLowerCase();
  const esc = (s) => String(s ?? "").replace(/[&<>\\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;','\\':'&#92;'}[c]));
  const money = (n) => "L " + Number(n || 0).toLocaleString("es-HN");

  const state = {
    productos: [],
    cat: "Todo",
    sub: "",
    q: "",
    active: null,
    shipping: null
  };

  function initTheme(){
    // Solo modo d�a (claro)
    document.documentElement.setAttribute("data-theme", "light");
  }

  function openModal(sel){
    $(sel)?.classList.add("open");
    document.body.classList.add("modal-open");
  }
  function closeAll(){
    $$(".modal.open").forEach(m => m.classList.remove("open"));
    document.body.classList.remove("modal-open");
  }

  async function fetchJSON(url){
    const r = await fetch(url, { cache: "no-store" });
    if(!r.ok) throw new Error("HTTP " + r.status);
    return await r.json();
  }

  function getImages(p){
    const imgs = [];
    const push = (v) => {
      const s = String(v ?? "").trim();
      if(s) imgs.push(s);
    };
    push(p.imagen || p.image || p.img);
    // campo "galeria" (coma/; o saltos)
    if (p.galeria) String(p.galeria).split(/[,;\n]+/).forEach(push);
    // campos galeria_1..8
    for (let i=1;i<=8;i++){
      const k = "galeria_" + i;
      if (p[k]) String(p[k]).split(/[,;\n]+/).forEach(push);
    }
    // variantes legacy
    ["galeria1","galeria2","galeria3","galeria4","galeria5","galeria6","galeria7","galeria8"].forEach(k=>{
      if (p[k]) String(p[k]).split(/[,;\n]+/).forEach(push);
    });
    return Array.from(new Set(imgs)).slice(0,8);
  }

  function categories(){
    const cats = state.productos.map(p => String(p.categoria || "").trim()).filter(Boolean);
    return ["Todo", ...Array.from(new Set(cats)).sort((a,b)=>a.localeCompare(b,"es"))];
  }

  // Para que no se vea "saturado": mostramos pocas categorías en chips (las más usadas)
  function topCategories(limit = 8){
    const counts = new Map();
    state.productos.forEach(p => {
      const c = String(p.categoria || "").trim();
      if(!c) return;
      counts.set(c, (counts.get(c) || 0) + 1);
    });
    return Array.from(counts.entries())
      .sort((a,b) => (b[1]-a[1]) || a[0].localeCompare(b[0],"es"))
      .slice(0, limit)
      .map(([c]) => c);
  }
  function subcategories(cat){
    if (!cat || cat==="Todo") return [];
    const subs = state.productos
      .filter(p => String(p.categoria || "").trim() === cat)
      .map(p => String(p.subcategoria || "").trim())
      .filter(Boolean);
    return Array.from(new Set(subs)).sort((a,b)=>a.localeCompare(b,"es"));
  }

  function renderSubChips(){
    const el = $("#subChips");
    const subs = subcategories(state.cat);
    if (!subs.length){
      el.style.display = "none";
      el.innerHTML = "";
      state.sub = "";
      return;
    }
    el.style.display = "flex";
    const limit = 12;
    const show = subs.slice(0, limit);
    const hasMore = subs.length > limit;
    const btnAll = `<button class="chip ${state.sub==="" ? "active":""}" data-sub="">Todas</button>`;
    const more = hasMore ? `<button class="chip" data-open="cats">Más…</button>` : "";
    el.innerHTML = [btnAll]
      .concat(show.map(s => `<button class="chip ${s===state.sub?"active":""}" data-sub="${esc(s)}">${esc(s)}</button>`))
      .join("") + more;
  }

  function renderCatsDrawer(){
    const body = $("#catsBody");
    const cats = categories();
    body.innerHTML = cats.map(c => {
      if (c==="Todo"){
        return `<div class="acc open"><div class="acc-h" data-cat="${esc(c)}" data-sub=""><strong>Todo</strong><span>›</span></div></div>`;
      }
      const subs = subcategories(c);
      const subsHtml = subs.length
        ? (`<div class="mini">` + subs.map(s => `<button data-cat="${esc(c)}" data-sub="${esc(s)}">${esc(s)}</button>`).join("") + `</div>`)
        : `<div class="mini"><button data-cat="${esc(c)}" data-sub="">Ver</button></div>`;
      return `<div class="acc">
        <div class="acc-h" data-acc><strong>${esc(c)}</strong><span>▾</span></div>
        <div class="acc-b">
          <button class="btn" style="margin:0 0 10px" data-cat="${esc(c)}" data-sub="">Ver todo ${esc(c)}</button>
          ${subsHtml}
        </div>
      </div>`;
    }).join("");
  }

  function renderCats(){
    const all = categories();
    const top = ["Todo", ...topCategories(8)];
    const hasMore = all.length > top.length;

    // Si el usuario eligió una categoría que no está en el top, la mostramos también (para que se vea activa)
    const chips = top.slice();
    if (state.cat && !chips.includes(state.cat)) chips.splice(1, 0, state.cat);

    const moreChip = hasMore ? `<button class="chip" data-open="cats">Más…</button>` : "";
    $("#catChips").innerHTML = chips
      .map(c => `<button class="chip ${c===state.cat?"active":""}" data-cat="${esc(c)}">${esc(c)}</button>`)
      .join("") + moreChip;
    renderSubChips();
    renderCatsDrawer();
  }

  function matches(p){
    const q = norm(state.q);
    if (q){
      const blob = norm([
        p.id, p.nombre, p.name, p.descripcion, p.categoria, p.subcategoria, p.marca, p.modelo, p.tags
      ].filter(Boolean).join(" "));
      if (!blob.includes(q)) return false;
    }
    if (state.cat !== "Todo" && String(p.categoria || "").trim() !== state.cat) return false;
    if (state.sub && String(p.subcategoria || "").trim() !== state.sub) return false;
    return true;
  }

  function badgeFor(p){
    const stock = Number(p.stock ?? 0);
    const oferta = String(p.oferta ?? "").toLowerCase() === "si" || p.oferta === 1 || p.oferta === true;
    const destacado = String(p.destacado ?? "").toLowerCase() === "si" || p.destacado === 1 || p.destacado === true;
    const pa = Number(p.precio_anterior ?? 0);
    const pr = Number(p.precio ?? 0);
    if (stock <= 0) return { text: "Agotado", kind: "off" };
    if (oferta && pa && pr && pa > pr){
      const pct = Math.round(((pa - pr) / pa) * 100);
      if (pct >= 5) return { text: `-${pct}%`, kind: "sale" };
      return { text: "Oferta", kind: "sale" };
    }
    if (oferta) return { text: "Oferta", kind: "sale" };
    if (destacado) return { text: "Top", kind: "top" };
    return null;
  }

  function productCard(p, opts = {}){
    const name = p.nombre || p.name || "Producto";
    const price = Number(p.precio || p.price || 0);
    const prev = Number(p.precio_anterior || 0);
    const stock = Number(p.stock ?? 0);
    const img = String(p.imagen || "").trim();
    const id = String(p.id || name);
    const b = badgeFor(p);
    const showPrev = prev && prev > price;
    const btnLabel = stock > 0 ? (opts.cta || "Ver detalles") : "No disponible";

    return `<div class="card" data-id="${esc(id)}">
      <div class="thumb" data-open="product">
        ${img ? `<img loading="lazy" src="${esc(img)}" alt="">` : `<div class="ph">Imagen no disponible</div>`}
        ${b ? `<div class="badge">${esc(b.text)}</div>` : ``}
      </div>
      <div class="cbody">
        <p class="title" data-open="product">${esc(name)}</p>
        <div class="metaRow">
          <div class="price">${money(price)} ${showPrev ? `<del>${money(prev)}</del>` : ``}</div>
          <div class="${stock>0 ? "stockOk" : "stockNo"}">${stock>0 ? `Stock: ${stock}` : "Agotado"}</div>
        </div>
        <button class="btnMini ${stock>0 ? "primary":""}" data-open="product" ${stock>0 ? "" : "disabled"}>${esc(btnLabel)}</button>
      </div>
    </div>`;
  }

  function renderProducts(){
    const list = state.productos
      .filter(matches)
      .sort((a,b)=>Number(a.orden||9999)-Number(b.orden||9999));
    $("#status").style.display = list.length ? "none" : "block";
    $("#products").innerHTML = list.map(p => productCard(p)).join("");
  }

  function renderOffers(){
    const ofertaTrue = (p) => {
      const v = p.oferta;
      return String(v ?? "").toLowerCase() === "si" || v === 1 || v === true;
    };
    const list = state.productos
      .filter(p => Number(p.stock ?? 0) > 0)
      .filter(p => ofertaTrue(p) || (Number(p.precio_anterior||0) > Number(p.precio||0)))
      .sort((a,b)=>Number(a.orden||9999)-Number(b.orden||9999))
      .slice(0,12);

    $("#offersGrid").innerHTML = list.map(p => productCard(p, { cta: "Pedir ahora" })).join("");
    $("#offersEmpty").style.display = list.length ? "none" : "block";
  }

  function buildDetails(p){
    const rows = [];
    const add = (k, v) => {
      const s = String(v ?? "").trim();
      if (!s) return;
      rows.push(`<div><strong>${esc(k)}:</strong> ${esc(s)}</div>`);
    };
    add("Marca", p.marca);
    add("Modelo", p.modelo);
    add("Compatibilidad", p.compatibilidad);
    add("Garantía", p.garantia);
    add("Condición", p.condicion);
    return rows.length ? rows.join("") : "—";
  }

  function openProduct(p){
    state.active = p;

    const imgs = getImages(p);
    $("#pBread").textContent = `${p.categoria || "—"} • ${p.subcategoria || "—"}`;
    $("#pTitle").textContent = p.nombre || p.name || "Producto";

    const price = Number(p.precio || p.price || 0);
    const prev  = Number(p.precio_anterior || 0);
    const stock = Number(p.stock ?? 0);

    $("#pPrice").innerHTML = `${money(price)}${(prev && prev>price) ? ` <span class="muted" style="font-size:14px"><del>${money(prev)}</del></span>` : ""}`;
    $("#pStock").textContent = `Stock: ${Number.isFinite(stock) ? stock : "—"}`;

    const b = badgeFor(p);
    $("#pBadge").innerHTML = b ? `<div class="badge">${esc(b.text)}</div>` : "";

    $("#pHero").innerHTML = imgs[0] ? `<img src="${esc(imgs[0])}" alt="">` : `<div class="ph">Imagen no disponible</div>`;
    $("#pGallery").innerHTML = imgs.map(u => `<div class="gthumb" data-img="${esc(u)}"><img loading="lazy" src="${esc(u)}" alt=""></div>`).join("");

    const desc = String(p.descripcion || p.desc || "").trim();
    $("#pDesc").textContent = desc || "—";
    $("#pDetails").innerHTML = buildDetails(p);

    const tt = String(p.video_tiktok||"").trim();
    const yt = String(p.video_youtube||"").trim();
    const fb = String(p.video_facebook||"").trim();
    const vu = String(p.video_url||p.video||"").trim();
    const vids = [
      tt ? `<a class="btn" target="_blank" rel="noopener" href="${esc(tt)}">TikTok</a>` : "",
      yt ? `<a class="btn" target="_blank" rel="noopener" href="${esc(yt)}">YouTube</a>` : "",
      fb ? `<a class="btn" target="_blank" rel="noopener" href="${esc(fb)}">Facebook</a>` : "",
      vu ? `<a class="btn" target="_blank" rel="noopener" href="${esc(vu)}">Video</a>` : "",
    ].filter(Boolean).join("");

    $("#pVideos").innerHTML = vids || `<div class="sectionNote" style="margin-top:0">No hay videos para este producto.</div>`;

    // botón pedir: deshabilitar si no hay stock
    $("#btnOrderNow").disabled = !(stock > 0);

    openModal("#modalProduct");
  }

  function waNumber(){
    return String(S.WHATSAPP || "+5043151-7755").replace(/\D/g,"");
  }
  function sendWhatsAppMessage(msg){
    window.open(`https://wa.me/${waNumber()}?text=${encodeURIComponent(msg)}`, "_blank");
  }
  function orderNow(){
    if(!state.active) return;
    const p = state.active;
    const name = p.nombre || p.name || "Producto";
    const price = Number(p.precio || p.price || 0);
    const stock = Number(p.stock ?? 0);

    const extra = [];
    if (p.categoria) extra.push(`Categoría: ${p.categoria}`);
    if (p.subcategoria) extra.push(`Subcategoría: ${p.subcategoria}`);
    if (p.id) extra.push(`ID: ${p.id}`);

    const msg =
`Hola 👋, quiero pedir este producto en ${S.STORE_NAME || "SDComayagua"}:
- ${name}
- Precio: ${money(price)}
- Cantidad: 1
${extra.length ? ("\n" + extra.join("\n")) : ""}

¿Está disponible? (Stock: ${stock})`;

    sendWhatsAppMessage(msg);
  }

  /* Shipping UI (offline json generated from your sheet) */
  function renderCouriers(){
    const el = $("#couriers");
    const s = state.shipping;
    if (!s || !Array.isArray(s.couriers)){ el.innerHTML = `<div class="sectionNote">No se cargaron empresas de envío.</div>`; return; }

    el.innerHTML = s.couriers.map(c => {
      const cod = (c.cod != null) ? money(c.cod) : "—";
      const pre = (c.prepay != null) ? money(c.prepay) : "—";
      return `<div class="courier">
        <div class="courierTop">
          <div class="courierName">${esc(c.name)}</div>
          <div class="courierPrice">${esc(pre)} <span class="muted" style="font-weight:900">prepago</span></div>
        </div>
        <div class="courierMeta">Contra entrega: <strong>${esc(cod)}</strong><br>${esc(c.prepay_methods || "")}</div>
      </div>`;
    }).join("");
  }

  function setOptions(selectEl, items, placeholder){
    selectEl.innerHTML = "";
    const opt0 = document.createElement("option");
    opt0.value = "";
    opt0.textContent = placeholder;
    selectEl.appendChild(opt0);
    items.forEach(v => {
      const o = document.createElement("option");
      o.value = v;
      o.textContent = v;
      selectEl.appendChild(o);
    });
  }

  function initShippingUI(){
    const s = state.shipping;
    const deptSel = $("#shipDept");
    const muniSel = $("#shipMuni");
    const zoneWrap = $("#shipZoneWrap");
    const zoneSel = $("#shipZone");
    const res = $("#shipResult");

    if(!s || !s.rates_by_municipality){
      res.innerHTML = `<div class="sectionNote">No se pudo cargar la tabla de envíos.</div>`;
      return;
    }

    const depts = Object.keys(s.rates_by_municipality).sort((a,b)=>a.localeCompare(b,"es"));
    setOptions(deptSel, depts, "Seleccionar…");
    setOptions(muniSel, [], "Seleccionar…");
    setOptions(zoneSel, [], "Seleccionar…");

    function compute(){
      const d = deptSel.value;
      const m = muniSel.value;
      const z = zoneSel.value;

      zoneWrap.style.display = "none";
      res.innerHTML = `<div class="sectionNote">Seleccioná tu ubicación para ver precios.</div>`;
      if(!d || !m) return;

      const localFlat = s.local_delivery?.municipality_flat?.[m];
      const isComayaguaCity = (d === "Comayagua" && m === "Comayagua");
      const hasLocalCoverage = Boolean(localFlat) || isComayaguaCity;

      if (isComayaguaCity){
        zoneWrap.style.display = "block";
        const zones = (s.local_delivery?.zones_comayagua || []).map(x=>x.zone).filter(Boolean);
        setOptions(zoneSel, zones, "Seleccionar zona…");

        if(!z){
          res.innerHTML = `<div class="sectionNote">Elegí una zona para ver el costo a domicilio en Comayagua.</div>`;
          return;
        }
        const zoneType = (s.local_delivery?.zones_comayagua || []).find(x=>x.zone===z)?.type;
        const price = zoneType ? s.local_delivery?.comayagua_city?.[zoneType] : null;

        res.innerHTML =
          `<div class="rateBox">
            <div class="rateTitle">🚚 Servicio a domicilio (Comayagua)</div>
            <div class="rateRow"><div class="muted">Zona: <strong>${esc(z)}</strong></div><div class="rateP">${price!=null ? money(price) : "Cotizar"}</div></div>
            <div class="rateHint">Costo según zona/distancia. Si tu zona no aparece, te cotizamos exacto por WhatsApp.</div>
          </div>`;
        return;
      }

      if (localFlat){
        res.innerHTML =
          `<div class="rateBox">
            <div class="rateTitle">🚚 Servicio a domicilio</div>
            <div class="rateRow"><div class="muted">${esc(d)} • ${esc(m)}</div><div class="rateP">${money(localFlat)}</div></div>
            <div class="rateHint">Entrega propia (tarifa de referencia). Puede variar por distancia/volumen.</div>
          </div>`;
        return;
      }

      const rate = s.rates_by_municipality?.[d]?.[m];
      if(!rate){
        res.innerHTML = `<div class="sectionNote">No hay tarifa cargada para ${esc(d)} • ${esc(m)}. Te cotizamos por WhatsApp.</div>`;
        return;
      }

      res.innerHTML =
        `<div class="rateBox">
          <div class="rateTitle">📦 Envío por empresa</div>
          <div class="rateRow"><div class="muted">Prepago</div><div class="rateP">${rate.prepay!=null ? money(rate.prepay) : "—"}</div></div>
          <div class="rateRow"><div class="muted">Contra entrega</div><div class="rateP">${rate.cod!=null ? money(rate.cod) : "—"}</div></div>
          <div class="rateHint">Empresa sugerida: <strong>${esc(rate.default_courier || "—")}</strong>${rate.note ? `<br>${esc(rate.note)}` : ""}</div>
        </div>`;
    }

    deptSel.addEventListener("change", () => {
      const d = deptSel.value;
      const munis = d ? Object.keys(s.rates_by_municipality[d] || {}).sort((a,b)=>a.localeCompare(b,"es")) : [];
      setOptions(muniSel, munis, "Seleccionar…");
      zoneWrap.style.display = "none";
      setOptions(zoneSel, [], "Seleccionar…");
      compute();
    });
    muniSel.addEventListener("change", () => {
      setOptions(zoneSel, [], "Seleccionar…");
      compute();
    });
    zoneSel.addEventListener("change", compute);

    compute();
  }

  function hookEvents(){
    $("#btnCats")?.addEventListener("click", () => openModal("#modalCats"));
    $("#btnOrderNow")?.addEventListener("click", orderNow);

    $("#btnWhatsappQuick")?.addEventListener("click", () => {
      sendWhatsAppMessage(`Hola 👋, vengo del catálogo de ${S.STORE_NAME || "SDComayagua"}. ¿Me podés ayudar a elegir un producto?`);
    });
    $("#btnSupport")?.addEventListener("click", (e) => {
      e.preventDefault();
      document.querySelector("#soporte")?.scrollIntoView({behavior:"smooth"});
    });

    $("#waFloat")?.addEventListener("click", () => {
      sendWhatsAppMessage(`Hola 👋, vengo del catálogo de ${S.STORE_NAME || "SDComayagua"}.`);
    });

    $("#q")?.addEventListener("input", (e) => {
      state.q = e.target.value;
      renderProducts();
    });

    document.addEventListener("click", (e) => {
      if (e.target.classList.contains("overlay") || e.target.closest("[data-close]")){
        closeAll(); return;
      }

      const openCats = e.target.closest("[data-open='cats']");
      if (openCats){
        openModal("#modalCats");
        return;
      }
      const acc = e.target.closest("[data-acc]");
      if (acc){ acc.parentElement.classList.toggle("open"); return; }

      const cat = e.target.closest("[data-cat]");
      if (cat){
        state.cat = cat.getAttribute("data-cat");
        state.sub = cat.getAttribute("data-sub") || "";
        renderCats();
        renderProducts();
        closeAll();
        document.querySelector("#catalogo")?.scrollIntoView({behavior:"smooth", block:"start"});
        return;
      }

      const sub = e.target.closest("[data-sub]");
      if (sub && !sub.hasAttribute("data-cat")){
        state.sub = sub.getAttribute("data-sub") || "";
        renderSubChips();
        renderProducts();
        return;
      }

      const openP = e.target.closest("[data-open='product']");
      if (openP){
        const card = e.target.closest("[data-id]");
        const id = card?.getAttribute("data-id");
        const p = state.productos.find(x => String(x.id || x.nombre || x.name) === id);
        if (p) openProduct(p);
        return;
      }

      const g = e.target.closest("[data-img]");
      if (g){
        const u = g.getAttribute("data-img");
        $("#pHero").innerHTML = `<img src="${esc(u)}" alt="">`;
        return;
      }
    });

    $("#year").textContent = String(new Date().getFullYear());
  }

  async function init(){
    initTheme();
    hookEvents();

    // Shipping (offline json generated from your sheet)
    try{
      state.shipping = await fetchJSON("assets/data/shipping.json");
      renderCouriers();
      initShippingUI();
    }catch(_){
      // no-op
    }

    // Products from Apps Script (keeps sync with Google Sheets)
    try{
      const data = await fetchJSON(API);
      state.productos = (data.productos || data.items || []).filter(Boolean);
      renderCats();
      renderOffers();
      renderProducts();
      $("#status").style.display = "none";
    }catch(err){
      $("#status").textContent = "No se pudo cargar el catálogo. Revisa tu conexión o el Apps Script.";
      $("#status").style.display = "block";
      console.error(err);
    }
  }

  init();
})();

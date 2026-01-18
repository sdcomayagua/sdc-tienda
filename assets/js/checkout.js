// assets/js/checkout.js (Carrito PRO + validaciones + Pay Chips)
// Opción A: el carrito solo abre con 🛒

(function(){
  const $ = (id)=>document.getElementById(id);
  const CART_KEY = "sdc_cart_checkout_v2";
  const FALLBACK_IMG = "assets/img/no-image.png";

  // DB viene de app.js (global)
  function getDB(){ return window.DB || {}; }

  function s(v){ return (v==null) ? "" : String(v).trim(); }
  function n(v){ const x=Number(v); return Number.isFinite(x)?x:0; }
  function eq(a,b){ return s(a).toLowerCase() === s(b).toLowerCase(); }
  function fmtLps(x){ return (window.fmtLps ? window.fmtLps(x) : `Lps. ${Number(x||0).toFixed(0)}`); }

  function bool(v){
    const x = s(v).toLowerCase();
    return x==="1" || x==="true" || x==="si" || x==="sí";
  }

  function toast(msg){
    let t = document.getElementById("toast2");
    if (!t){
      t = document.createElement("div");
      t.id = "toast2";
      t.style.position = "fixed";
      t.style.left = "50%";
      t.style.bottom = "14px";
      t.style.transform = "translateX(-50%)";
      t.style.padding = "10px 14px";
      t.style.borderRadius = "14px";
      t.style.background = "rgba(0,0,0,.78)";
      t.style.color = "white";
      t.style.fontWeight = "900";
      t.style.zIndex = "9999";
      t.style.transition = "opacity .2s ease";
      t.style.opacity = "0";
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.style.opacity = "1";
    clearTimeout(window.__toast2Timer);
    window.__toast2Timer = setTimeout(()=>{ t.style.opacity = "0"; }, 1400);
  }

  // ===== Cart storage =====
  let CART = [];

  function loadCart(){
    try{ CART = JSON.parse(localStorage.getItem(CART_KEY) || "[]"); }catch{ CART=[]; }
  }
  function saveCart(){ localStorage.setItem(CART_KEY, JSON.stringify(CART)); }
  function cartCount(){ return CART.reduce((a,it)=>a + (Number(it.qty)||0), 0); }
  function cartSubtotal(){ return CART.reduce((a,it)=>a + (n(it.precio)*n(it.qty)), 0); }

  function updateBadge(){
    const el = $("cartCount");
    if (el) el.textContent = String(cartCount());
  }

  function getProductById(id){
    const db = getDB();
    return (db.productos || []).find(p => String(p.id) === String(id)) || null;
  }
  function getStockById(id){
    const p = getProductById(id);
    return p ? Number(p.stock||0) : 0;
  }

  // ===== Backdrop + modal open/close =====
  function openBackdrop(){ $("backdrop") && ($("backdrop").style.display="block"); }
  function closeBackdrop(){ $("backdrop") && ($("backdrop").style.display="none"); }

  function openCart(){
    openBackdrop();
    const m = $("cartModal");
    if (m){
      m.style.display="block";
      m.setAttribute("aria-hidden","false");
    }
    renderCart();
    prepareSelectsIfNeeded();
    updateTotals();
    showStep("cart");
  }

  function closeCart(){
    const m = $("cartModal");
    if (m){
      m.style.display="none";
      m.setAttribute("aria-hidden","true");
    }
    // si modal de producto está abierto, no cierres el backdrop
    const prod = $("prodModal");
    const prodOpen = prod && prod.style.display === "block";
    if (!prodOpen) closeBackdrop();
  }

  // ===== Tabs / Steps =====
  function setTabActive(which){
    const a = $("tabCart"), b = $("tabShip"), c = $("tabPay");
    if (!a || !b || !c) return;
    a.classList.toggle("active", which==="cart");
    b.classList.toggle("active", which==="ship");
    c.classList.toggle("active", which==="pay");
  }

  function showStep(which){
    const s1 = $("stepCart"), s2 = $("stepShip"), s3 = $("stepPay");
    if (!s1 || !s2 || !s3) return;

    s1.style.display = (which==="cart") ? "block" : "none";
    s2.style.display = (which==="ship") ? "block" : "none";
    s3.style.display = (which==="pay") ? "block" : "none";

    setTabActive(which);
    syncTotalsLabels();
  }

  function syncTotalsLabels(){
    const sub = cartSubtotal();
    const ship = calcShipping();
    const totalMin = sub + ship.min;
    const totalMax = sub + ship.max;

    $("subTotal") && ($("subTotal").textContent = fmtLps(sub));
    $("shippingCost") && ($("shippingCost").textContent = ship.text);
    $("grandTotal") && ($("grandTotal").textContent = ship.isRange ? `${fmtLps(totalMin)} – ${fmtLps(totalMax)}` : fmtLps(totalMin));

    $("subTotal2") && ($("subTotal2").textContent = fmtLps(sub));
    $("shippingCost2") && ($("shippingCost2").textContent = ship.text);
    $("grandTotal2") && ($("grandTotal2").textContent = ship.isRange ? `${fmtLps(totalMin)} – ${fmtLps(totalMax)}` : fmtLps(totalMin));
  }

  // ===== Render cart list =====
  function renderCart(){
    const empty = $("cartEmpty");
    const list = $("cartList");
    if (!empty || !list) return;

    empty.style.display = CART.length ? "none" : "block";
    list.innerHTML = "";

    CART.forEach((it, idx)=>{
      const row = document.createElement("div");
      row.className = "cartItem";
      row.innerHTML = `
        <img src="${it.imagen || FALLBACK_IMG}" onerror="this.onerror=null;this.src='${FALLBACK_IMG}';">
        <div class="cartMeta">
          <div class="n">${it.nombre || ""}</div>
          <div class="p">${fmtLps(it.precio)} · Cant: ${it.qty}</div>
          <div class="qty">
            <button class="dec" type="button">-</button>
            <div>${it.qty}</div>
            <button class="inc" type="button">+</button>
            <button class="trash" type="button" title="Eliminar">🗑️</button>
          </div>
        </div>
      `;

      row.querySelector(".dec").onclick = ()=>{
        it.qty--;
        if (it.qty <= 0) CART.splice(idx,1);
        saveCart(); updateBadge(); renderCart(); updateTotals();
      };

      row.querySelector(".inc").onclick = ()=>{
        const max = getStockById(it.id);
        if (max <= 0){ toast("Agotado"); return; }
        if (it.qty + 1 > max){ toast(`Stock disponible: ${max}`); return; }
        it.qty++;
        saveCart(); updateBadge(); renderCart(); updateTotals();
      };

      row.querySelector(".trash").onclick = ()=>{
        CART.splice(idx,1);
        saveCart(); updateBadge(); renderCart(); updateTotals();
      };

      list.appendChild(row);
    });

    updateTotals();
  }

  // ===== Public API called by ui.js =====
  window.checkoutAdd = function(product){
    const id = String(product.id);
    const maxStock = Number(product.stock||0);
    if (maxStock <= 0){ toast("Agotado"); return false; }

    let it = CART.find(x=>String(x.id)===id);
    if (!it){
      it = { id, nombre:product.nombre, precio:product.precio, imagen:product.imagen, qty:0 };
      CART.push(it);
    }
    if (it.qty + 1 > maxStock){ toast(`Stock: ${maxStock}`); return false; }

    it.qty += 1;
    saveCart();
    updateBadge();
    return true;
  };

  window.checkoutRefreshBadge = function(){
    updateBadge();
  };

  // ===== Select utils =====
  function fillSelect(id, items, placeholder){
    const sel = $(id);
    if (!sel) return;
    sel.innerHTML = `<option value="">${placeholder || "Selecciona"}</option>`;
    items.forEach(x=>{
      const opt=document.createElement("option");
      opt.value=x.value;
      opt.textContent=x.label;
      sel.appendChild(opt);
    });
  }

  // ===== Location: depto/muni =====
  function getDepartamentos(){
    const db = getDB();
    const set = new Set((db.municipios_hn||[]).map(r=>s(r.departamento)).filter(Boolean));
    return Array.from(set).sort((a,b)=>a.localeCompare(b));
  }

  function getMunicipios(dep){
    const db = getDB();
    return (db.municipios_hn||[])
      .filter(r=>eq(r.departamento, dep))
      .map(r=>s(r.municipio))
      .filter(Boolean)
      .sort((a,b)=>a.localeCompare(b));
  }

  function refreshMunicipios(){
    const dep = $("depto")?.value || "";
    const munis = dep ? getMunicipios(dep) : [];
    fillSelect("muni", munis.map(m=>({value:m,label:m})), "Municipio");
  }

  // ===== Delivery rules =====
  function findCobertura(dep, muni){
    const db = getDB();
    return (db.cobertura_entrega||[]).find(r=>eq(r.departamento, dep) && eq(r.municipio, muni)) || null;
  }

  function buildDeliveryOptions(){
    const dep = $("depto")?.value || "";
    const muni = $("muni")?.value || "";
    const opts = [{value:"", label:"Selecciona tipo de entrega"}];

    if (!dep || !muni) return opts;

    // Comayagua ciudad
    if (eq(dep,"Comayagua") && eq(muni,"Comayagua")){
      opts.push({value:"comayagua_ciudad", label:"Comayagua (ciudad) - entrega local"});
      return opts;
    }

    const cov = findCobertura(dep, muni);
    if (cov){
      if (bool(cov.permite_entrega_propia)) opts.push({value:"entrega_propia", label:"Entrega propia (cercanos)"});
      if (bool(cov.permite_empresa)) opts.push({value:"empresa", label:"Empresa de envío"});
      if (bool(cov.permite_bus)) opts.push({value:"bus", label:"Bus local (encomienda)"});
    } else {
      opts.push({value:"empresa", label:"Empresa de envío"});
      opts.push({value:"bus", label:"Bus local (encomienda)"});
    }

    return opts;
  }

  function updateDeliveryBoxes(){
    const t = $("deliveryType")?.value || "";

    $("boxComa") && ($("boxComa").style.display = (t==="comayagua_ciudad") ? "grid" : "none");
    $("boxPropia") && ($("boxPropia").style.display = (t==="entrega_propia") ? "grid" : "none");
    $("boxEmpresa") && ($("boxEmpresa").style.display = (t==="empresa") ? "grid" : "none");
    $("boxBus") && ($("boxBus").style.display = (t==="bus") ? "grid" : "none");

    updatePayOptions();
    updateTotals();
    updateCashVisibility();
  }

  // ===== Shipping calc =====
  function calcShipping(){
    const db = getDB();
    const t = $("deliveryType")?.value || "";

    if (!t) return { text:"Por confirmar", min:0, max:0, isRange:false };

    if (t==="comayagua_ciudad"){
      const zona = $("comaZona")?.value || "";
      if (!zona) return { text:"Por confirmar", min:0, max:0, isRange:false };
      const row = (db.zonas_comayagua_ciudad||[]).find(r=>eq(r.zona, zona));
      const cost = n(row?.costo ?? row?.precio ?? 0);
      return { text: fmtLps(cost), min:cost, max:cost, isRange:false };
    }

    if (t==="entrega_propia"){
      const lugar = $("propiaLugar")?.value || "";
      if (!lugar) return { text:"Por confirmar", min:0, max:0, isRange:false };
      const row = (db.tarifas_entrega_propia||[]).find(r=>eq(r.municipio||r.lugar, lugar));
      const cost = n(row?.costo ?? row?.precio ?? 0);
      return { text: fmtLps(cost), min:cost, max:cost, isRange:false };
    }

    if (t==="empresa"){
      const emp = $("empresa")?.value || "";
      const mod = $("empresaModalidad")?.value || "";
      if (!emp || !mod) return { text:"Por confirmar", min:0, max:0, isRange:false };
      const row = (db.empresas_envio||[]).find(r=>eq(r.empresa, emp) && eq(r.modalidad, mod));
      const cost = n(row?.precio ?? row?.costo ?? 0);
      return { text: fmtLps(cost), min:cost, max:cost, isRange:false };
    }

    if (t==="bus"){
      const lugar = $("busLugar")?.value || "";
      if (!lugar) return { text:"Por confirmar", min:0, max:0, isRange:false };
      const row = (db.bus_local_tarifas||[]).find(r=>eq(r.municipio||r.lugar, lugar));
      const mn = n(row?.tarifa_min ?? row?.min ?? 0);
      const mx = n(row?.tarifa_max ?? row?.max ?? mn);
      return { text: `${fmtLps(mn)} – ${fmtLps(mx)}`, min:mn, max:mx, isRange:true };
    }

    return { text:"Por confirmar", min:0, max:0, isRange:false };
  }

  // ===== Pay Chips =====
  function iconForMethod(m){
    const k = s(m).toLowerCase();
    if (k==="efectivo") return "💵";
    if (k==="transferencia") return "🏦";
    if (k==="paypal") return "💳";
    if (k==="tigo_money" || k==="tigomoney") return "📱";
    return "💰";
  }

  function renderPayChips(){
    const db = getDB();
    const wrap = $("payChips");
    if (!wrap) return;

    wrap.innerHTML = "";

    const allowed = getAllowedPayMethods();
    allowed.forEach(m=>{
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "payChip";
      btn.dataset.method = m.value;
      btn.innerHTML = `<span>${iconForMethod(m.value)}</span><span>${m.label}</span>`;

      btn.onclick = ()=>{
        const sel = $("payMethod");
        if (!sel) return;
        sel.value = m.value;
        setPayChipActive(m.value);
        updatePayInfo();
        updateCashVisibility();
        updateTotals();
      };

      wrap.appendChild(btn);
    });

    // marcar activo si ya hay uno seleccionado
    const current = $("payMethod")?.value || "";
    if (current) setPayChipActive(current);
  }

  function setPayChipActive(method){
    const wrap = $("payChips");
    if (!wrap) return;
    Array.from(wrap.children).forEach(el=>{
      el.classList.toggle("active", el.dataset.method === method);
    });
  }

  function getAllowedPayMethods(){
    const db = getDB();
    const t = $("deliveryType")?.value || "";
    const empresaModalidad = $("empresaModalidad")?.value || "";

    const hasFlags = (db.pagos||[]).some(p =>
      p.hasOwnProperty("permite_en_ciudad_comayagua") ||
      p.hasOwnProperty("permite_en_empresa_envio") ||
      p.hasOwnProperty("permite_en_entrega_propia") ||
      p.hasOwnProperty("permite_en_bus_local")
    );

    let allowed = [];
    (db.pagos||[]).forEach(p=>{
      const metodo = s(p.metodo);
      const titulo = s(p.titulo || metodo);
      const activo = bool(p.activo ?? "1");
      if (!activo) return;

      if (hasFlags){
        if (t==="comayagua_ciudad" && !bool(p.permite_en_ciudad_comayagua ?? "1")) return;
        if (t==="entrega_propia" && !bool(p.permite_en_entrega_propia ?? "1")) return;
        if (t==="empresa" && !bool(p.permite_en_empresa_envio ?? "1")) return;
        if (t==="bus" && !bool(p.permite_en_bus_local ?? "1")) return;
      }

      if (t==="empresa" && empresaModalidad==="normal" && metodo==="efectivo") return;

      allowed.push({value:metodo, label:titulo});
    });

    if (!allowed.length) allowed = [{value:"transferencia", label:"Transferencia"}];
    return allowed;
  }

  // ===== Payment select + info + cash/change =====
  function updatePayOptions(){
    const allowed = getAllowedPayMethods();
    const sel = $("payMethod");
    if (!sel) return;

    const current = sel.value;
    fillSelect("payMethod", allowed, "Selecciona método de pago");

    // conservar selección si existe
    if (allowed.some(x=>x.value===current)) sel.value = current;

    renderPayChips();
    updatePayInfo();
  }

  function updatePayInfo(){
    const db = getDB();
    const pay = $("payMethod")?.value || "";
    const row = (db.pagos||[]).find(p=>eq(p.metodo, pay));
    const info = $("payInfo");
    if (!info) return;

    // detalle base
    info.textContent = row ? s(row.detalle) : "";
    setPayChipActive(pay);
  }

  function updateCashVisibility(){
    const delivery = $("deliveryType")?.value || "";
    const pay = $("payMethod")?.value || "";
    const cash = $("cashAmount");
    if (!cash) return;

    const show = (delivery==="comayagua_ciudad" && pay==="efectivo");
    cash.style.display = show ? "block" : "none";
    if (!show) cash.value = "";

    updateChangeHint();
  }

  function updateChangeHint(){
    const delivery = $("deliveryType")?.value || "";
    const pay = $("payMethod")?.value || "";
    const cash = $("cashAmount");
    const info = $("payInfo");
    if (!cash || !info) return;

    if (!(delivery==="comayagua_ciudad" && pay==="efectivo")) return;

    const amount = n(cash.value || 0);
    const ship = calcShipping();
    const total = cartSubtotal() + ship.min;
    const base = "Efectivo (solo Comayagua ciudad).";

    if (amount <= 0){
      info.textContent = `${base} Ingresa con cuánto pagarás para calcular el cambio.`;
      return;
    }

    const diff = amount - total;
    if (diff < 0){
      info.textContent = `${base} Faltan ${fmtLps(Math.abs(diff))}.`;
    } else {
      info.textContent = `${base} Cambio estimado: ${fmtLps(diff)}.`;
    }
  }

  function updateTotals(){
    syncTotalsLabels();
    const ship = calcShipping();

    $("shipHint") && ($("shipHint").textContent = ship.isRange
      ? "Bus local: el envío es estimado (rango). Se confirma por WhatsApp antes de enviar."
      : "Tarifas calculadas desde Google Sheets."
    );

    updatePayInfo();
    updateCashVisibility();
  }

  // ===== WhatsApp message =====
  function getAjustes(){
    return (typeof window.ajustesMap === "function") ? window.ajustesMap() : {};
  }

  function buildWhatsAppLink(){
    const db = getDB();
    const a = getAjustes();
    const wa = (a.whatsapp_numero || "50431517755").replace(/\D/g,"");

    const name = s($("custName")?.value);
    const phone = s($("custPhone")?.value);
    const dep = s($("depto")?.value);
    const muni = s($("muni")?.value);

    const delivery = s($("deliveryType")?.value);
    const ship = calcShipping();

    const pay = s($("payMethod")?.value);
    const payRow = (db.pagos||[]).find(p=>eq(p.metodo, pay));
    const payTitle = payRow ? s(payRow.titulo || pay) : pay;
    const payDetail = payRow ? s(payRow.detalle) : "";

    const subtotal = cartSubtotal();
    const totalMin = subtotal + ship.min;
    const totalMax = subtotal + ship.max;

    let lines=[];
    lines.push("🛒 *PEDIDO - SDC*");
    lines.push(`👤 Nombre: ${name||"-"}`);
    lines.push(`📞 Tel: ${phone||"-"}`);
    lines.push(`📍 Ubicación: ${dep||"-"} / ${muni||"-"}`);
    lines.push("");
    lines.push("*Productos:*");
    CART.forEach(it=> lines.push(`- ${it.qty} x ${it.nombre} (${fmtLps(it.precio)})`) );
    lines.push("");
    lines.push(`Subtotal: ${fmtLps(subtotal)}`);
    lines.push(`Envío: ${ship.text}`);
    lines.push(`Total: ${ship.isRange ? (fmtLps(totalMin)+" – "+fmtLps(totalMax)) : fmtLps(totalMin)}`);
    lines.push("");

    lines.push(`🚚 Entrega: ${delivery||"-"}`);
    if (delivery==="comayagua_ciudad"){
      lines.push(`Zona: ${s($("comaZona")?.value) || "-"}`);
      const col = s($("comaColonia")?.value);
      if (col) lines.push(`Ref: ${col}`);
    }
    if (delivery==="entrega_propia"){
      lines.push(`Lugar: ${s($("propiaLugar")?.value) || "-"}`);
    }
    if (delivery==="empresa"){
      lines.push(`Empresa: ${s($("empresa")?.value) || "-"}`);
      lines.push(`Modalidad: ${s($("empresaModalidad")?.value) || "-"}`);
    }
    if (delivery==="bus"){
      lines.push(`Bus (lugar): ${s($("busLugar")?.value) || "-"}`);
    }

    lines.push("");
    lines.push(`💳 Pago: ${payTitle||"-"}`);
    if (payDetail) lines.push(`Info pago: ${payDetail}`);

    if (delivery==="comayagua_ciudad" && pay==="efectivo"){
      const amount = n($("cashAmount")?.value || 0);
      if (amount > 0){
        lines.push(`💵 Efectivo: paga con ${fmtLps(amount)}`);
        const diff = amount - totalMin;
        if (diff < 0) lines.push(`⚠️ Faltan: ${fmtLps(Math.abs(diff))}`);
        else lines.push(`🔁 Cambio estimado: ${fmtLps(diff)}`);
      }
    }

    return `https://wa.me/${wa}?text=${encodeURIComponent(lines.join("\n"))}`;
  }

  // ===== Validación PRO + navegación =====
  function gotoShipWithMsg(msg){
    showStep("ship");
    toast(msg);
  }
  function gotoPayWithMsg(msg){
    showStep("pay");
    toast(msg);
  }

  function validateBeforeSend(){
    if (!CART.length) { showStep("cart"); toast("Tu carrito está vacío."); return false; }

    // datos básicos
    if (!s($("custName")?.value) || !s($("custPhone")?.value)){
      gotoShipWithMsg("Completa tu nombre y teléfono.");
      return false;
    }

    if (!s($("depto")?.value) || !s($("muni")?.value)){
      gotoShipWithMsg("Selecciona departamento y municipio.");
      return false;
    }

    if (!s($("deliveryType")?.value)){
      gotoShipWithMsg("Selecciona el tipo de entrega.");
      return false;
    }

    if (!s($("payMethod")?.value)){
      gotoPayWithMsg("Selecciona el método de pago.");
      return false;
    }

    // efectivo Comayagua
    const delivery = $("deliveryType")?.value || "";
    const pay = $("payMethod")?.value || "";
    if (delivery==="comayagua_ciudad" && pay==="efectivo"){
      const amt = n($("cashAmount")?.value || 0);
      if (amt <= 0){
        gotoPayWithMsg("Indica con cuánto pagarás (efectivo).");
        return false;
      }
      const ship = calcShipping();
      const total = cartSubtotal() + ship.min;
      if (amt < total){
        gotoPayWithMsg(`El efectivo es menor al total. Faltan ${fmtLps(total-amt)}.`);
        return false;
      }
    }

    return true;
  }

  // ===== Prepare selects once =====
  function prepareSelectsIfNeeded(){
    const db = getDB();

    if ($("depto") && $("depto").options.length <= 1){
      fillSelect("depto", getDepartamentos().map(d=>({value:d,label:d})), "Departamento");
      refreshMunicipios();
    }

    if ($("comaZona") && $("comaZona").options.length <= 1){
      const zonas = Array.from(new Set((db.zonas_comayagua_ciudad||[]).map(r=>s(r.zona)).filter(Boolean)));
      fillSelect("comaZona", zonas.map(z=>({value:z,label:z})), "Zona (Comayagua)");
    }

    if ($("propiaLugar") && $("propiaLugar").options.length <= 1){
      const lugares = Array.from(new Set((db.tarifas_entrega_propia||[]).map(r=>s(r.municipio||r.lugar)).filter(Boolean)));
      fillSelect("propiaLugar", lugares.map(z=>({value:z,label:z})), "Lugar (entrega propia)");
    }

    if ($("empresa") && $("empresa").options.length <= 1){
      const emps = Array.from(new Set((db.empresas_envio||[]).map(r=>s(r.empresa)).filter(Boolean)));
      fillSelect("empresa", emps.map(z=>({value:z,label:z})), "Empresa de envío");
    }

    if ($("empresaModalidad") && $("empresaModalidad").options.length <= 1){
      fillSelect("empresaModalidad",
        [{value:"",label:"Modalidad"},{value:"normal",label:"Normal (anticipado)"},{value:"contra_entrega",label:"Pagar al recibir"}],
        "Modalidad"
      );
    }

    if ($("busLugar") && $("busLugar").options.length <= 1){
      const bus = Array.from(new Set((db.bus_local_tarifas||[]).map(r=>s(r.municipio||r.lugar)).filter(Boolean)));
      fillSelect("busLugar", bus.map(z=>({value:z,label:z})), "Lugar (bus local)");
    }

    if ($("deliveryType") && $("deliveryType").options.length <= 1){
      fillSelect("deliveryType", [{value:"",label:"Selecciona tipo de entrega"}], "Tipo de entrega");
    }

    updatePayOptions();
    updateTotals();
  }

  // ===== Bind UI =====
  function bind(){
    $("btnCart")?.addEventListener("click", openCart);
    $("btnCloseCart")?.addEventListener("click", closeCart);

    // backdrop click: cerrar carrito si está abierto
    $("backdrop")?.addEventListener("click", ()=>{
      const cart = $("cartModal");
      if (cart && cart.style.display==="block") closeCart();
    });

    // tabs
    $("tabCart")?.addEventListener("click", ()=>showStep("cart"));
    $("tabShip")?.addEventListener("click", ()=>showStep("ship"));
    $("tabPay")?.addEventListener("click", ()=>showStep("pay"));

    // dep/muni
    $("depto")?.addEventListener("change", ()=>{
      refreshMunicipios();
      fillSelect("deliveryType", buildDeliveryOptions().map(o=>({value:o.value,label:o.label})), "Tipo de entrega");
      updateDeliveryBoxes();
    });
    $("muni")?.addEventListener("change", ()=>{
      fillSelect("deliveryType", buildDeliveryOptions().map(o=>({value:o.value,label:o.label})), "Tipo de entrega");
      updateDeliveryBoxes();
    });

    // entrega
    $("deliveryType")?.addEventListener("change", updateDeliveryBoxes);
    $("comaZona")?.addEventListener("change", updateTotals);
    $("propiaLugar")?.addEventListener("change", updateTotals);
    $("empresa")?.addEventListener("change", updateTotals);
    $("empresaModalidad")?.addEventListener("change", ()=>{ updatePayOptions(); updateTotals(); });
    $("busLugar")?.addEventListener("change", updateTotals);

    // pago
    $("payMethod")?.addEventListener("change", ()=>{ updateTotals(); });
    $("cashAmount")?.addEventListener("input", ()=>{ updateTotals(); });

    // copiar resumen
    $("btnCopyCart")?.addEventListener("click", async ()=>{
      const ship = calcShipping();
      const subtotal = cartSubtotal();
      const totalMin = subtotal + ship.min;
      const totalMax = subtotal + ship.max;
      const txt = `Pedido SDC\nSubtotal: ${fmtLps(subtotal)}\nEnvío: ${ship.text}\nTotal: ${ship.isRange ? (fmtLps(totalMin)+" – "+fmtLps(totalMax)) : fmtLps(totalMin)}`;
      try{ await navigator.clipboard.writeText(txt); toast("Resumen copiado ✅"); }catch{ toast("No se pudo copiar"); }
    });

    // enviar WhatsApp (validación pro)
    $("btnSendWA")?.addEventListener("click", ()=>{
      if (!validateBeforeSend()) return;
      window.open(buildWhatsAppLink(), "_blank");
    });
  }

  // ===== Start =====
  document.addEventListener("DOMContentLoaded", ()=>{
    loadCart();
    updateBadge();
    bind();
  });

})();
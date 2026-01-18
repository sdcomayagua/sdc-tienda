// assets/js/checkout.js (carrito + envío + pago + WA) - Opción A

(function(){
  const $ = (id)=>document.getElementById(id);
  const CART_KEY = "sdc_cart_checkout_v1";
  const FALLBACK_IMG = "assets/img/no-image.png";

  // DB viene desde app.js (global)
  function getDB(){
    return window.DB || {};
  }

  function s(v){ return (v==null) ? "" : String(v).trim(); }
  function n(v){ const x=Number(v); return Number.isFinite(x)?x:0; }
  function eq(a,b){ return s(a).toLowerCase() === s(b).toLowerCase(); }
  function fmtLps(x){ return (window.fmtLps ? window.fmtLps(x) : `Lps. ${Number(x||0).toFixed(0)}`); }

  // ===== Cart storage =====
  let CART = [];

  function loadCart(){
    try{ CART = JSON.parse(localStorage.getItem(CART_KEY) || "[]"); }catch{ CART=[]; }
  }
  function saveCart(){
    localStorage.setItem(CART_KEY, JSON.stringify(CART));
  }
  function cartCount(){
    return CART.reduce((a,it)=>a + (Number(it.qty)||0), 0);
  }
  function cartSubtotal(){
    return CART.reduce((a,it)=>a + (n(it.precio)*n(it.qty)), 0);
  }
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

  // ===== Modal open/close =====
  function openBackdrop(){
    const b = $("backdrop");
    if (b) b.style.display = "block";
  }
  function closeBackdrop(){
    const b = $("backdrop");
    if (b) b.style.display = "none";
  }

  function openCart(){
    openBackdrop();
    const m = $("cartModal");
    if (m){
      m.style.display = "block";
      m.setAttribute("aria-hidden","false");
    }
    renderCart();
    updateTotals();
    showStep("cart");
  }

  function closeCart(){
    const m = $("cartModal");
    if (m){
      m.style.display = "none";
      m.setAttribute("aria-hidden","true");
    }
    closeBackdrop();
  }

  // ===== Tabs / Steps =====
  function showStep(which){
    const s1 = $("stepCart"), s2 = $("stepShip"), s3 = $("stepPay");
    if (!s1 || !s2 || !s3) return;

    s1.style.display = (which==="cart") ? "block" : "none";
    s2.style.display = (which==="ship") ? "block" : "none";
    s3.style.display = (which==="pay") ? "block" : "none";

    // resync totals labels
    syncTotalsLabels();
  }

  function syncTotalsLabels(){
    const sub = cartSubtotal();
    const ship = calcShipping();
    const totalMin = sub + ship.min;
    const totalMax = sub + ship.max;

    if ($("subTotal")) $("subTotal").textContent = fmtLps(sub);
    if ($("shippingCost")) $("shippingCost").textContent = ship.text;
    if ($("grandTotal")) $("grandTotal").textContent = ship.isRange ? `${fmtLps(totalMin)} – ${fmtLps(totalMax)}` : fmtLps(totalMin);

    if ($("subTotal2")) $("subTotal2").textContent = fmtLps(sub);
    if ($("shippingCost2")) $("shippingCost2").textContent = ship.text;
    if ($("grandTotal2")) $("grandTotal2").textContent = ship.isRange ? `${fmtLps(totalMin)} – ${fmtLps(totalMax)}` : fmtLps(totalMin);
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
        if (max <= 0){ alert("Este producto está agotado."); return; }
        if (it.qty + 1 > max){ alert(`Stock disponible: ${max}.`); return; }
        it.qty++;
        saveCart(); updateBadge(); renderCart(); updateTotals();
      };

      row.querySelector(".trash").onclick = ()=>{
        CART.splice(idx,1);
        saveCart(); updateBadge(); renderCart(); updateTotals();
      };

      list.appendChild(row);
    });
  }

  // ===== Location & delivery selectors =====
  function fillSelect(id, items, placeholder){
    const sel = $(id);
    if (!sel) return;
    sel.innerHTML = `<option value="">${placeholder || "Selecciona"}</option>`;
    items.forEach(x=>{
      const opt = document.createElement("option");
      opt.value = x.value;
      opt.textContent = x.label;
      sel.appendChild(opt);
    });
  }

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

  function findCobertura(dep, muni){
    const db = getDB();
    return (db.cobertura_entrega||[]).find(r=>eq(r.departamento, dep) && eq(r.municipio, muni)) || null;
  }
  function bool(v){
    const x = s(v).toLowerCase();
    return x==="1" || x==="true" || x==="si" || x==="sí";
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
      // fuera de cobertura: empresa + bus
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

  // ===== Payment =====
  function updatePayOptions(){
    const db = getDB();
    const t = $("deliveryType")?.value || "";
    const empresaModalidad = $("empresaModalidad")?.value || "";
    const sel = $("payMethod");
    if (!sel) return;

    // si en tu sheet tienes flags, los respeta; si no, muestra todo activo
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

      // Empresa normal: no efectivo
      if (t==="empresa" && empresaModalidad==="normal" && metodo==="efectivo") return;

      allowed.push({value:metodo, label:titulo});
    });

    if (!allowed.length) allowed = [{value:"transferencia", label:"Transferencia"}];

    const current = sel.value;
    fillSelect("payMethod", allowed, "Selecciona método de pago");
    if (allowed.some(x=>x.value===current)) sel.value=current;
  }

  function updatePayInfo(){
    const db = getDB();
    const pay = $("payMethod")?.value || "";
    const row = (db.pagos||[]).find(p=>eq(p.metodo, pay));
    const info = $("payInfo");
    if (!info) return;
    info.textContent = row ? s(row.detalle) : "";
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

  function updateTotals(){
    syncTotalsLabels();
    updatePayInfo();
    updateCashVisibility();
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

  // ===== WhatsApp =====
  function getAjustes(){
    if (typeof window.ajustesMap === "function") return window.ajustesMap();
    // fallback
    return {};
  }

  function buildWhatsAppLink(){
    const a = getAjustes();
    const wa = (a.whatsapp_numero || "50431517755").replace(/\D/g,"");

    const name = s($("custName")?.value);
    const phone = s($("custPhone")?.value);
    const dep = s($("depto")?.value);
    const muni = s($("muni")?.value);

    const delivery = s($("deliveryType")?.value);
    const ship = calcShipping();

    const pay = s($("payMethod")?.value);
    const db = getDB();
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
    CART.forEach(it=>{
      lines.push(`- ${it.qty} x ${it.nombre} (${fmtLps(it.precio)})`);
    });
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

  // ===== Init UI bindings =====
  function bind(){
    // abrir/cerrar
    $("btnCart")?.addEventListener("click", openCart);
    $("btnCloseCart")?.addEventListener("click", closeCart);
    $("backdrop")?.addEventListener("click", closeCart);

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

    // pago + efectivo
    $("payMethod")?.addEventListener("change", ()=>{ updateTotals(); });
    $("cashAmount")?.addEventListener("input", ()=>{ updateTotals(); });

    // copiar resumen
    $("btnCopyCart")?.addEventListener("click", async ()=>{
      const ship = calcShipping();
      const subtotal = cartSubtotal();
      const totalMin = subtotal + ship.min;
      const totalMax = subtotal + ship.max;
      const txt = `Pedido SDC\nSubtotal: ${fmtLps(subtotal)}\nEnvío: ${ship.text}\nTotal: ${ship.isRange ? (fmtLps(totalMin)+" – "+fmtLps(totalMax)) : fmtLps(totalMin)}`;
      await copyText(txt);
    });

    // enviar WhatsApp
    $("btnSendWA")?.addEventListener("click", ()=>{
      if (!CART.length){ alert("Tu carrito está vacío."); return; }
      if (!s($("custName")?.value) || !s($("custPhone")?.value)){ alert("Completa tu nombre y teléfono."); return; }
      if (!s($("depto")?.value) || !s($("muni")?.value)){ alert("Selecciona departamento y municipio."); return; }
      if (!s($("deliveryType")?.value)){ alert("Selecciona tipo de entrega."); return; }
      if (!s($("payMethod")?.value)){ alert("Selecciona método de pago."); return; }

      const delivery = $("deliveryType")?.value || "";
      const pay = $("payMethod")?.value || "";
      if (delivery==="comayagua_ciudad" && pay==="efectivo"){
        const amt = n($("cashAmount")?.value || 0);
        if (amt <= 0){ alert("Indica con cuánto pagarás (efectivo)."); return; }
        const ship = calcShipping();
        const total = cartSubtotal() + ship.min;
        if (amt < total){ alert(`El efectivo es menor al total. Faltan ${fmtLps(total-amt)}.`); return; }
      }

      window.open(buildWhatsAppLink(), "_blank");
    });
  }

  // ===== Public API for app.js =====
  window.checkoutAdd = function(product){
    // suma al carrito SIN abrir (opción A). app.js decide abrir.
    const id = String(product.id);
    const maxStock = Number(product.stock||0);
    if (maxStock <= 0){ alert("Este producto está agotado."); return false; }

    let it = CART.find(x=>String(x.id)===id);
    if (!it){
      it = { id, nombre:product.nombre, precio:product.precio, imagen:product.imagen, qty:0 };
      CART.push(it);
    }
    if (it.qty + 1 > maxStock){ alert(`Stock disponible: ${maxStock}.`); return false; }

    it.qty += 1;
    saveCart();
    updateBadge();
    return true;
  };

  window.checkoutRefreshBadge = function(){
    updateBadge();
  };

  // ===== start =====
  document.addEventListener("DOMContentLoaded", ()=>{
    loadCart();
    updateBadge();
    bind();

    // fill selects base (cuando DB esté disponible)
    // los llenamos al abrir el modal para evitar "undefined" al cargar
  });

  // cuando se abra el carrito, llenar selects con DB actual
  function prepareSelectsIfNeeded(){
    const db = getDB();

    // deptos/munis
    if ($("depto") && $("depto").options.length <= 1){
      fillSelect("depto", getDepartamentos().map(d=>({value:d,label:d})), "Departamento");
      refreshMunicipios();
    }

    // zona comayagua
    if ($("comaZona") && $("comaZona").options.length <= 1){
      const zonas = Array.from(new Set((db.zonas_comayagua_ciudad||[]).map(r=>s(r.zona)).filter(Boolean)));
      fillSelect("comaZona", zonas.map(z=>({value:z,label:z})), "Zona (Comayagua)");
    }

    // propia
    if ($("propiaLugar") && $("propiaLugar").options.length <= 1){
      const lugares = Array.from(new Set((db.tarifas_entrega_propia||[]).map(r=>s(r.municipio||r.lugar)).filter(Boolean)));
      fillSelect("propiaLugar", lugares.map(z=>({value:z,label:z})), "Lugar (entrega propia)");
    }

    // empresa
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

    // bus
    if ($("busLugar") && $("busLugar").options.length <= 1){
      const bus = Array.from(new Set((db.bus_local_tarifas||[]).map(r=>s(r.municipio||r.lugar)).filter(Boolean)));
      fillSelect("busLugar", bus.map(z=>({value:z,label:z})), "Lugar (bus local)");
    }

    // delivery type
    if ($("deliveryType") && $("deliveryType").options.length <= 1){
      fillSelect("deliveryType", [{value:"",label:"Selecciona tipo de entrega"}], "Tipo de entrega");
    }

    // pay method (se llena al cambiar entrega)
    updatePayOptions();
    updateTotals();
  }

  // hook: cuando abres carrito, asegúrate que selects estén listos
  const originalOpenCart = openCart;
  openCart = function(){
    prepareSelectsIfNeeded();
    originalOpenCart();
  };

})();
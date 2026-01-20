(()=>{

/* ================= CONFIG ================= */
const API_URL="https://script.google.com/macros/s/AKfycbytPfD9mq__VO7I2lnpBsqdCIT119ZT0zVyz0eeVjrJVgN_q8FYGgmqY6G66C2m67Pa4g/exec";
const CART_KEY="sdc_cart_v2";
const THEME_KEY="sdc_theme_v2";
const WA="50431517755";
const $=e=>document.getElementById(e);
const money=v=>`Lps. ${Math.round(Number(v||0)).toLocaleString("es-HN")}`;

/* ================= UBICACIONES ================= */
const HN={
 "Comayagua":{
  municipios:{
   "Comayagua":{
    domicilio:true,
    zonas:{
     "Zona Céntrica":{precio:40,lugares:["Colonia Piedras Bonitas","Barrio Arriba","Barrio Abajo","Centro"]},
     "Zona Alejada":{precio:60,lugares:["Montecarlo","Villa Universitaria","Las Colinas"]},
     "Fuera":{precio:90,lugares:["Sifón","Palmerola","El Pajonal"]}
    }
   },
   "Villa de San Antonio":{domicilio:true,precio:80},
   "Lejamani":{domicilio:true,precio:90},
   "La Libertad":{domicilio:true,precio:90},
   "Ajuterique":{domicilio:true,precio:90}
  }
 },
 "La Paz":{
  municipios:{
   "La Paz":{domicilio:true,precio:90},
   "Marcala":{domicilio:false}
  }
 }
};

/* ================= ESTADO ================= */
let DATA=null,PRODUCTS=[],BY_ID={},CART=[],CURRENT=null;
let STEP=1;

/* ================= TEMA ================= */
function applyTheme(){
 const t=localStorage.getItem(THEME_KEY)||"dark";
 document.body.classList.toggle("light",t==="light");
}
function toggleTheme(){
 const l=document.body.classList.contains("light");
 localStorage.setItem(THEME_KEY,l?"dark":"light");
 applyTheme();
}

/* ================= MODALES ================= */
function openOverlay(){$("overlay").style.display="block"}
function closeOverlay(){$("overlay").style.display="none"}
function openModal(id){openOverlay();$(id).style.display="block"}
function closeModal(id){
 $(id).style.display="none";
 if($("productModal").style.display!=="block" && $("cartModal").style.display!=="block") closeOverlay();
}

/* ================= CARRITO ================= */
function loadCart(){
 try{CART=JSON.parse(localStorage.getItem(CART_KEY)||"[]")}catch(e){CART=[]}
 updateBadge();
}
function saveCart(){
 localStorage.setItem(CART_KEY,JSON.stringify(CART));
 updateBadge();
}
function updateBadge(){
 $("cartCount").textContent=CART.reduce((a,b)=>a+Number(b.qty||0),0);
}
function subtotal(){
 return CART.reduce((t,i)=>{
  const p=BY_ID[i.id];
  return p?t+(p.precio*i.qty):t;
 },0);
}

/* ================= API ================= */
async function loadAPI(){
 const r=await fetch(API_URL,{cache:"no-store"});
 if(!r.ok) throw new Error("API error");
 return await r.json();
}

/* ================= PRODUCTOS ================= */
function renderProducts(){
 const g=$("productsGrid");
 g.innerHTML="";
 const list=PRODUCTS;
 $("productsTitle").textContent=`Productos (${list.length})`;
 if(!list.length){
  g.innerHTML=`<div style="grid-column:1/-1;color:var(--muted)">No hay productos.</div>`;
  return;
 }
 list.forEach(p=>{
  const out=p.stock<=0;
  const c=document.createElement("article");
  c.className="card";
  c.innerHTML=`
   <img src="${p.imagen}">
   <div class="cardBody">
    <div class="cardTitle">${p.nombre}</div>
    <div class="cardDesc">${p.descripcion||""}</div>
    <div class="pr">
     <div class="p">${money(p.precio)}</div>
    </div>
    ${out?`<button class="btnDisabled" disabled>Agotado</button>`:
    `<button class="bp" data-id="${p.id}">Ver detalles</button>`}
   </div>
   ${out?`<div class="tagOut">AGOTADO</div>`:""}
  `;
  if(!out){
   c.querySelector("button").onclick=e=>{
    e.stopPropagation();
    openProduct(p.id);
   };
   c.onclick=()=>openProduct(p.id);
  }
  g.appendChild(c);
 });
}

/* ================= PRODUCTO ================= */
function openProduct(id){
 const p=BY_ID[id];
 if(!p) return;
 CURRENT=p;
 $("modalName").textContent=p.nombre;
 $("modalSub").textContent=p.categoria||"";
 $("modalPrice").textContent=money(p.precio);
 $("modalDesc").textContent=p.descripcion||"";
 $("modalMainImg").src=p.imagen;
 $("btnAddCart").disabled=p.stock<=0;
 $("btnAddCart").textContent=p.stock<=0?"Agotado":"Agregar al carrito";
 openModal("productModal");
}
/* ================= CHECKOUT (ENTREGA + PAGO) ================= */

let CHECKOUT={
 depto:"",muni:"",
 entregaTipo:"", // domicilio_ciudad | domicilio_muni | empresa | bus
 zona:"",colonia:"",ref:"",costoEnvio:0,
 empresa:"",modalidad:"", // normal | pagar_al_recibir | bus
 pago:"", // efectivo | transferencia | paypal | tigo_money | pagar_al_recibir
 efectivoCon:0,cambio:0
};

function totalFinal(){return subtotal()+Number(CHECKOUT.costoEnvio||0)}
function calcCambio(){
 if(CHECKOUT.pago!=="efectivo"){CHECKOUT.cambio=0;return}
 const con=Number(CHECKOUT.efectivoCon||0);
 const t=totalFinal();
 CHECKOUT.cambio=Math.max(0,con-t);
}

/* ===== datos Honduras desde Sheets ===== */
function getDeptos(){
 const rows=(DATA?.municipios_hn||[]);
 const set=new Set(rows.map(r=>String(r.departamento||"").trim()).filter(Boolean));
 return [...set].sort((a,b)=>a.localeCompare(b));
}
function getMunis(depto){
 const rows=(DATA?.municipios_hn||[]);
 return rows.filter(r=>String(r.departamento||"").trim()===depto)
  .map(r=>String(r.municipio||"").trim()).filter(Boolean)
  .sort((a,b)=>a.localeCompare(b));
}

/* ===== Zonas Comayagua ciudad desde Sheets ===== */
function zonasRows(){return Array.isArray(DATA?.zonas_comayagua_ciudad)?DATA.zonas_comayagua_ciudad:[]}
function zonasUnicas(){
 const set=new Set(zonasRows().map(r=>String(r.zona||"").trim()).filter(Boolean));
 // orden bonito
 const order=["centrica","céntrica","alejada","fuera"];
 const arr=[...set];
 arr.sort((a,b)=>{
  const ai=order.indexOf(a.toLowerCase()),bi=order.indexOf(b.toLowerCase());
  return (ai===-1?99:ai)-(bi===-1?99:bi);
 });
 return arr;
}
function coloniasByZona(z){
 return zonasRows().filter(r=>String(r.zona||"").trim()===z)
  .map(r=>({
   col:String(r.colonia_barrio||"").trim(),
   costo:Number(r.costo||0),
   ref:String(r.referencia||"").trim()
  })).filter(x=>x.col);
}

/* ================= UI ENTREGA (STEP 2) ================= */
function buildEntregaUI(){
 const s2=$("step2");
 if(!s2) return;
 s2.innerHTML=`
  <div class="ckbox">
    <div class="tx"><b>Ubicación (Honduras)</b></div>
    <div class="grid2sel">
      <div>
        <div class="tx">Departamento</div>
        <select id="deptoSel"><option value="">Selecciona</option></select>
      </div>
      <div>
        <div class="tx">Municipio</div>
        <select id="muniSel" disabled><option value="">Selecciona</option></select>
      </div>
    </div>

    <div id="domBlock" class="hidden">
      <div class="hr"></div>
      <div class="tx"><b>Entrega a domicilio</b></div>

      <div id="comCityBlock" class="hidden">
        <div class="tx">Comayagua ciudad: elige zona y colonia/barrio</div>
        <div class="grid2sel">
          <select id="zonaSel"><option value="">Zona</option></select>
          <select id="colSel"><option value="">Colonia/Barrio</option></select>
        </div>
        <div class="note" id="zonaInfo"></div>
      </div>

      <div id="muniDomInfo" class="note hidden"></div>
    </div>

    <div id="empBlock" class="hidden">
      <div class="hr"></div>
      <div class="tx"><b>Envío por empresa</b></div>
      <div class="grid2sel">
        <select id="empSel"></select>
        <select id="modSel">
          <option value="normal">Normal (anticipado)</option>
          <option value="pagar_al_recibir">Pagar al recibir</option>
        </select>
      </div>
      <div class="note" id="empInfo"></div>
      ${PERMITE_BUS_LOCAL?`<div class="note">🚌 Bus/encomienda disponible (80–150). Se confirma por WhatsApp.</div>`:""}
    </div>

    <div class="hr"></div>
    <div class="tx"><b>Datos</b></div>
    <input id="custName" placeholder="Tu nombre">
    <input id="custPhone" placeholder="Ej: 9999-9999">
    <textarea id="custAddr" placeholder="Dirección / Referencia"></textarea>

    <div class="hr"></div>
    <div class="tx"><b>Método de pago</b></div>
    <select id="paySel"><option value="">Selecciona método</option></select>

    <div id="cashBlock" class="hidden">
      <input id="cashWith" placeholder="¿Con cuánto pagará? (solo domicilio)" inputmode="numeric">
      <div class="note" id="cashInfo"></div>
    </div>

    <div class="hr"></div>
    <div class="note"><b>Total:</b> <span id="previewTotal">${money(totalFinal())}</span></div>
  </div>
 `;
 // llenar deptos
 const dsel=$("deptoSel");
 getDeptos().forEach(d=>{
  const o=document.createElement("option");
  o.value=d;o.textContent=d;
  dsel.appendChild(o);
 });
 // empresas
 const esel=$("empSel");
 EMPRESAS_ENVIO.forEach(x=>{
  const o=document.createElement("option");o.value=x;o.textContent=x;esel.appendChild(o);
 });

 // listeners
 dsel.addEventListener("change",()=>{
  CHECKOUT.depto=dsel.value;
  fillMunisUI();
  applyEntregaRules();
 });
 $("muniSel").addEventListener("change",()=>{
  CHECKOUT.muni=$("muniSel").value;
  applyEntregaRules();
 });
 $("zonaSel").addEventListener("change",()=>{
  CHECKOUT.zona=$("zonaSel").value;
  fillColoniasUI();
  applyEntregaRules();
 });
 $("colSel").addEventListener("change",()=>{
  const opt=$("colSel").selectedOptions[0];
  CHECKOUT.colonia=opt?.value||"";
  CHECKOUT.costoEnvio=Number(opt?.dataset.costo||0);
  CHECKOUT.ref=opt?.dataset.ref||"";
  $("zonaInfo").textContent=CHECKOUT.colonia?(`Costo: ${money(CHECKOUT.costoEnvio)}${CHECKOUT.ref?(" · "+CHECKOUT.ref):""}`):"";
  updateCheckoutTotals();
 });
 $("empSel").addEventListener("change",()=>{
  CHECKOUT.empresa=$("empSel").value;
  applyEntregaRules();
 });
 $("modSel").addEventListener("change",()=>{
  CHECKOUT.modalidad=$("modSel").value;
  applyEntregaRules();
 });
 $("paySel").addEventListener("change",()=>{
  CHECKOUT.pago=$("paySel").value;
  updatePagoUI();
  updateCheckoutTotals();
 });
 $("cashWith").addEventListener("input",()=>{
  CHECKOUT.efectivoCon=Number(String($("cashWith").value||"").replace(/[^\d]/g,"")||0);
  updateCheckoutTotals();
 });

 fillMunisUI();
 applyEntregaRules();
}

function fillMunisUI(){
 const msel=$("muniSel");
 msel.innerHTML=`<option value="">Selecciona</option>`;
 msel.disabled=!$("deptoSel").value;
 if(!$("deptoSel").value) return;
 getMunis($("deptoSel").value).forEach(m=>{
  const o=document.createElement("option");o.value=m;o.textContent=m;msel.appendChild(o);
 });
 msel.disabled=false;
}

function fillZonasUI(){
 const zsel=$("zonaSel");
 zsel.innerHTML=`<option value="">Zona</option>`;
 zonasUnicas().forEach(z=>{
  const o=document.createElement("option");o.value=z;o.textContent=z;o.dataset.z=z;
  zsel.appendChild(o);
 });
}

function fillColoniasUI(){
 const z=$("zonaSel").value;
 const csel=$("colSel");
 csel.innerHTML=`<option value="">Colonia/Barrio</option>`;
 if(!z) return;
 coloniasByZona(z).forEach(c=>{
  const o=document.createElement("option");
  o.value=c.col;
  o.textContent=`${c.col} (${money(c.costo)})`;
  o.dataset.costo=String(c.costo||0);
  o.dataset.ref=c.ref||"";
  csel.appendChild(o);
 });
}

/* ================= REGLAS ENTREGA + PAGO ================= */
function applyEntregaRules(){
 const depto=String(CHECKOUT.depto||"").trim();
 const muni=String(CHECKOUT.muni||"").trim();

 // reset bloques
 $("domBlock")?.classList.add("hidden");
 $("comCityBlock")?.classList.add("hidden");
 $("muniDomInfo")?.classList.add("hidden");
 $("empBlock")?.classList.add("hidden");

 CHECKOUT.entregaTipo="";
 CHECKOUT.costoEnvio=0;
 CHECKOUT.ref="";
 CHECKOUT.empresa=$("empSel")?$("empSel").value:"";
 CHECKOUT.modalidad=$("modSel")?$("modSel").value:"normal";

 if(!depto || !muni){
  fillPayOptions();
  updateCheckoutTotals();
  return;
 }

 // Comayagua/Comayagua -> zonas
 if(depto==="Comayagua" && muni==="Comayagua"){
  CHECKOUT.entregaTipo="domicilio_ciudad";
  $("domBlock").classList.remove("hidden");
  $("comCityBlock").classList.remove("hidden");
  if($("zonaSel").options.length<=1) fillZonasUI();
  // costo queda al elegir colonia
  fillPayOptions();
  updateCheckoutTotals();
  return;
 }

 // municipios domicilio (lista)
 if(MUNICIPIOS_DOMICILIO.has(muni) && (depto==="Comayagua"||depto==="La Paz")){
  CHECKOUT.entregaTipo="domicilio_muni";
  $("domBlock").classList.remove("hidden");
  $("muniDomInfo").classList.remove("hidden");
  $("muniDomInfo").textContent=`Entrega a domicilio disponible en ${muni}. (Costo se confirma por WhatsApp).`;
  CHECKOUT.costoEnvio=0;
  fillPayOptions();
  updateCheckoutTotals();
  return;
 }

 // demás -> empresa/bus
 CHECKOUT.entregaTipo="empresa";
 $("empBlock").classList.remove("hidden");
 // costo por modalidad (configurable luego)
 CHECKOUT.costoEnvio = (CHECKOUT.modalidad==="pagar_al_recibir") ? 170 : 110;
 $("empInfo").textContent=`Empresa: ${CHECKOUT.empresa} · ${CHECKOUT.modalidad==="normal"?"Normal":"Pagar al recibir"} · Costo: ${money(CHECKOUT.costoEnvio)}`;
 fillPayOptions();
 updateCheckoutTotals();
}

function fillPayOptions(){
 const sel=$("paySel");
 if(!sel) return;
 sel.innerHTML=`<option value="">Selecciona método</option>`;

 const domicilio = CHECKOUT.entregaTipo==="domicilio_ciudad" || CHECKOUT.entregaTipo==="domicilio_muni";

 if(domicilio){
  addOpt("efectivo","Efectivo (pagar al recibir)");
  addOpt("transferencia","Transferencia bancaria");
  addOpt("paypal","PayPal");
  addOpt("tigo_money","Tigo Money");
 }else{
  addOpt("transferencia","Transferencia bancaria");
  addOpt("paypal","PayPal");
  addOpt("tigo_money","Tigo Money");
  addOpt("pagar_al_recibir","Pagar al recibir");
 }
 function addOpt(v,t){const o=document.createElement("option");o.value=v;o.textContent=t;sel.appendChild(o)}
 CHECKOUT.pago="";
 updatePagoUI();
}

function updatePagoUI(){
 const domicilio = CHECKOUT.entregaTipo==="domicilio_ciudad" || CHECKOUT.entregaTipo==="domicilio_muni";
 const metodo=$("paySel")?$("paySel").value:"";
 CHECKOUT.pago=metodo;

 if(domicilio && metodo==="efectivo"){
  $("cashBlock").classList.remove("hidden");
 }else{
  $("cashBlock").classList.add("hidden");
  CHECKOUT.efectivoCon=0;
  CHECKOUT.cambio=0;
  if($("cashWith")) $("cashWith").value="";
  if($("cashInfo")) $("cashInfo").textContent="";
 }
}

function updateCheckoutTotals(){
 // total + cambio
 calcCambio();
 if($("previewTotal")) $("previewTotal").textContent = money(totalFinal());
 if($("cashInfo")){
  if(CHECKOUT.pago!=="efectivo") $("cashInfo").textContent="";
  else{
   const t=totalFinal(),con=Number(CHECKOUT.efectivoCon||0);
   const diff=con-t;
   if(con<=0) $("cashInfo").textContent="Escribe con cuánto pagará para calcular el cambio.";
   else if(diff<0) $("cashInfo").textContent=`Faltan ${money(Math.abs(diff))} para completar el total.`;
   else $("cashInfo").textContent=`Cambio estimado: ${money(diff)}.`;
  }
 }
 updateTotalsUI();
}

/* ================= CARRITO UI ================= */
function renderCart(){
 const wrap=$("cartItems");
 wrap.innerHTML="";
 $("cartEmpty").style.display=CART.length?"none":"block";

 CART.forEach((it,idx)=>{
  const p=BY_ID[it.id]; if(!p) return;
  const row=document.createElement("div");
  row.className="cartItem";
  row.innerHTML=`
   <img src="${p.imagen||""}" alt="">
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
  row.querySelector(".minus").onclick=()=>{it.qty=Math.max(1,it.qty-1);saveCart();renderCart();updateTotalsUI()}
  row.querySelector(".plus").onclick=()=>{const stock=Number(p.stock||0);if(stock>0 && it.qty+1>stock)return alert("Stock disponible: "+stock);it.qty++;saveCart();renderCart();updateTotalsUI()}
  row.querySelector(".trash").onclick=()=>{CART.splice(idx,1);saveCart();renderCart();updateTotalsUI()}
  wrap.appendChild(row);
 });
 updateTotalsUI();
}

function updateTotalsUI(){
 const sub=subtotal();
 $("subTotal").textContent=money(sub);
 $("shipTotal").textContent=money(CHECKOUT.costoEnvio||0);
 $("grandTotal").textContent=money(sub+Number(CHECKOUT.costoEnvio||0));
}

function setStep(n){
 STEP=n;
 $("step1").classList.toggle("hidden",n!==1);
 $("step2").classList.toggle("hidden",n!==2);
 $("step3").classList.toggle("hidden",n!==3);
 $("tab1").classList.toggle("active",n===1);
 $("tab2").classList.toggle("active",n===2);
 $("tab3").classList.toggle("active",n===3);
 $("btnBack").style.display=n===1?"none":"inline-block";
 $("btnNext").textContent=n===3?"Enviar por WhatsApp":"Continuar";
 $("btnSendWA").style.display=n===3?"block":"none";
 if(n===2) buildEntregaUI();
}

function openCart(){
 setStep(1);
 renderCart();
 openModal("cartModal");
}

function buildEntregaUI(){
 // construye UI solo una vez
 if($("deptoSel")) return;
 buildEntregaUIInner();
}

function buildEntregaUIInner(){
 buildEntregaUI=()=>{}; // evita recrear
 buildEntregaUIInner=null;
 buildEntregaUIInner=undefined;
 buildEntregaUI(); // no-op
}

/* ================= WHATSAPP ================= */
function sendWhatsApp(){
 if(!CART.length) return alert("Carrito vacío");

 const name=safe($("custName").value);
 const phone=safe($("custPhone").value);
 const addr=safe($("custAddr").value);

 const lines=[];
 lines.push("🛒 PEDIDO - SDComayagua","");
 if(name) lines.push("👤 "+name);
 if(phone) lines.push("📞 "+phone);
 if(CHECKOUT.depto && CHECKOUT.muni) lines.push(`📍 ${CHECKOUT.depto} / ${CHECKOUT.muni}`);

 if(CHECKOUT.entregaTipo==="domicilio_ciudad"){
  lines.push("🚚 Domicilio (Comayagua ciudad)");
  if(CHECKOUT.zona) lines.push("Zona: "+CHECKOUT.zona);
  if(CHECKOUT.colonia) lines.push("Colonia/Barrio: "+CHECKOUT.colonia);
 }else if(CHECKOUT.entregaTipo==="domicilio_muni"){
  lines.push("🚚 Domicilio (municipio cercano)");
 }else{
  lines.push(`📦 Empresa: ${CHECKOUT.empresa} (${CHECKOUT.modalidad==="normal"?"Normal":"Pagar al recibir"})`);
  if(PERMITE_BUS_LOCAL) lines.push("🚌 Bus/encomienda disponible (80–150, se confirma).");
 }
 if(addr) lines.push("📌 "+addr);

 lines.push("","Productos:");
 CART.forEach(it=>{
  const p=BY_ID[it.id]; if(!p) return;
  lines.push(`- ${it.qty} x ${p.nombre} (${money(p.precio)})`);
 });
 lines.push("");
 lines.push("Envío: "+money(CHECKOUT.costoEnvio||0));
 lines.push("Total: "+money(totalFinal()));
 if(CHECKOUT.pago) lines.push("Pago: "+CHECKOUT.pago);
 if(CHECKOUT.pago==="efectivo"){
  lines.push("Efectivo con: "+money(CHECKOUT.efectivoCon||0));
  lines.push("Cambio: "+money(CHECKOUT.cambio||0));
 }

 window.open(`https://wa.me/${WA}?text=${encodeURIComponent(lines.join("\n"))}`,"_blank");
}

/* ================= EVENTOS ================= */
function wire(){
 $("overlay").onclick=()=>{closeModal("productModal");closeModal("cartModal")}
 $("closeProduct").onclick=()=>closeModal("productModal")
 $("closeCart").onclick=()=>closeModal("cartModal")
 $("btnKeepBuying").onclick=()=>closeModal("productModal")
 $("btnGoPay").onclick=()=>{closeModal("productModal");openCart()}
 $("btnAddCart").onclick=()=>{
  if(!CURRENT||CURRENT.stock<=0) return;
  const it=CART.find(x=>x.id===CURRENT.id);
  if(it) it.qty++; else CART.push({id:CURRENT.id,qty:1});
  saveCart();
  $("modalHint").textContent="✅ Agregado. Puedes seguir comprando o ir a pagar.";
 }
 $("tab1").onclick=()=>setStep(1)
 $("tab2").onclick=()=>setStep(2)
 $("tab3").onclick=()=>setStep(3)
 $("btnBack").onclick=()=>{if(STEP>1)setStep(STEP-1)}
 $("btnNext").onclick=()=>{
  if(STEP===1){
   if(!CART.length) return alert("Tu carrito está vacío.");
   setStep(2); return;
  }
  if(STEP===2){
   if(!$("deptoSel").value || !$("muniSel").value) return alert("Selecciona departamento y municipio.");
   if(!safe($("custName").value).length) return alert("Escribe tu nombre.");
   if(!safe($("custAddr").value).length) return alert("Escribe tu dirección / referencia.");
   if(!$("paySel").value) return alert("Selecciona un método de pago.");
   if($("paySel").value==="efectivo" && Number(CHECKOUT.efectivoCon||0)<=0) return alert("Escribe con cuánto pagará.");
   setStep(3); return;
  }
  if(STEP===3) sendWhatsApp();
 }
 $("btnSendWA").onclick=sendWhatsApp
 $("goTop").onclick=()=>window.scrollTo({top:0,behavior:"smooth"})
 $("searchBtn").onclick=()=>$("searchInput").focus()
 $("themeBtn").onclick=toggleTheme
 $("cartBtn").onclick=openCart
 $("searchInput").addEventListener("input",e=>{QUERY=e.target.value||"";renderProducts()})
}

/* ================= INIT ================= */
async function init(){
 applyTheme();
 loadCart();
 $("loadingMsg").style.display="block";
 try{
  DATA=await loadAPI();
  PRODUCTS=(DATA.productos||[]).map(p=>({
   id:String(p.id||"").trim(),
   nombre:String(p.nombre||"").trim(),
   precio:Number(p.precio||0),
   stock:Number(p.stock||0),
   categoria:String(p.categoria||"General").trim(),
   subcategoria:String(p.subcategoria||"").trim(),
   descripcion:String(p.descripcion||"").trim(),
   imagen:String(p.imagen||"").trim()
  })).filter(p=>p.id&&p.nombre);
  BY_ID={};PRODUCTS.forEach(p=>BY_ID[p.id]=p);
  renderProducts();
  wire();
 }catch(e){
  console.error(e);
  $("productsGrid").innerHTML=`<div style="grid-column:1/-1;color:var(--muted);padding:12px">Error cargando catálogo.</div>`;
 }finally{
  $("loadingMsg").style.display="none";
 }
}

document.addEventListener("DOMContentLoaded",()=>{
 // botones básicos
 if($("searchBtn") && !$("searchBtn").onclick) $("searchBtn").onclick=()=>$("searchInput").focus();
 init();
});

})();
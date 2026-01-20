(()=>{
const API_URL="https://script.google.com/macros/s/AKfycbytPfD9mq__VO7I2lnpBsqdCIT119ZT0zVyz0eeVjrJVgN_q8FYGgmqY6G66C2m67Pa4g/exec";
const CART_KEY="sdc_cart_final_today";
const THEME_KEY="sdc_theme_final_today";
const WA_DEFAULT="50431517755";
const EMPRESAS=["C807","Cargo Expreso","Forza"];
const BUS_ON=true;

const COMAYAGUA_DOMICILIO=new Set(["Comayagua","Villa de San Antonio","Ajuterique","Lejamaní","Lejamani","Flores"]);

const $=id=>document.getElementById(id);
const safe=v=>String(v??"").trim();
const money=n=>`Lps. ${Math.round(Number(n||0)).toLocaleString("es-HN")}`;
const isOffer=p=>Number(p.precio_anterior||0)>Number(p.precio||0);
const isOut=p=>Number(p.stock||0)<=0;

let DATA=null,PRODUCTS=[],BY_ID={},CART=[],CURRENT=null;
let CURRENT_CAT=null,CURRENT_SUB=null,QUERY="",STEP=1;

let C={depto:"",muni:"",entrega:"",zona:"",col:"",ref:"",envio:0,empresa:EMPRESAS[0],modalidad:"normal",pago:"",cash:0,cambio:0};

function openOverlay(){$("overlay").style.display="block"}
function closeOverlay(){$("overlay").style.display="none"}
function openModal(id){openOverlay();$(id).style.display="block"}
function closeModal(id){$(id).style.display="none";if($("productModal").style.display!=="block"&&$("cartModal").style.display!=="block")closeOverlay()}

function applyTheme(){const t=localStorage.getItem(THEME_KEY)||"dark";document.body.classList.toggle("light",t==="light");$("themeBtn").innerHTML=t==="light"?'<i class="ri-sun-line"></i>':'<i class="ri-moon-line"></i>'}
function toggleTheme(){const l=document.body.classList.contains("light");localStorage.setItem(THEME_KEY,l?"dark":"light");applyTheme()}

function loadCart(){try{CART=JSON.parse(localStorage.getItem(CART_KEY)||"[]")}catch(e){CART=[]}if(!Array.isArray(CART))CART=[];updateBadge()}
function saveCart(){localStorage.setItem(CART_KEY,JSON.stringify(CART));updateBadge()}
function updateBadge(){$("cartCount").textContent=String(CART.reduce((a,b)=>a+Number(b.qty||0),0))}
function sub(){return CART.reduce((s,i)=>{const p=BY_ID[i.id];return p?s+Number(p.precio||0)*Number(i.qty||0):s},0)}
function total(){return sub()+Number(C.envio||0)}
function calcCambio(){if(C.pago!=="efectivo"){C.cambio=0;return}const diff=Number(C.cash||0)-total();C.cambio=diff>0?diff:0}

async function loadAPI(){const r=await fetch(API_URL,{cache:"no-store"});if(!r.ok)throw new Error("API "+r.status);return await r.json()}

/* Honduras */
function deptos(){const rows=Array.isArray(DATA?.municipios_hn)?DATA.municipios_hn:[];const set=new Set(rows.map(r=>safe(r.departamento)).filter(Boolean));return [...set].sort((a,b)=>a.localeCompare(b))}
function munis(d){const rows=Array.isArray(DATA?.municipios_hn)?DATA.municipios_hn:[];return rows.filter(r=>safe(r.departamento)===d).map(r=>safe(r.municipio)).filter(Boolean).sort((a,b)=>a.localeCompare(b))}

/* Zonas */
function zRows(){return Array.isArray(DATA?.zonas_comayagua_ciudad)?DATA.zonas_comayagua_ciudad:[]}
function zList(){const set=new Set(zRows().map(r=>safe(r.zona)).filter(Boolean));return [...set]}
function cols(z){return zRows().filter(r=>safe(r.zona)===z).map(r=>({col:safe(r.colonia_barrio),c:Number(r.costo||0),ref:safe(r.referencia)})).filter(x=>x.col)}

/* Categorías simples */
function cats(){const set=new Set(PRODUCTS.map(p=>p.categoria).filter(Boolean));const arr=[...set].sort((a,b)=>a.localeCompare(b));if(PRODUCTS.some(isOffer))arr.unshift("OFERTAS");return arr}
function subs(cat){if(!cat||cat==="OFERTAS")return[];return [...new Set(PRODUCTS.filter(p=>p.categoria===cat).map(p=>p.subcategoria).filter(Boolean))].sort((a,b)=>a.localeCompare(b))}
function renderCats(){const bar=$("categoryBar");bar.innerHTML="";const all=document.createElement("button");all.className="pill"+(!CURRENT_CAT?" active":"");all.textContent="VER TODO";all.onclick=()=>{CURRENT_CAT=null;CURRENT_SUB=null;renderCats();renderSubs();renderProducts()};bar.appendChild(all);cats().forEach(c=>{if(c==="OFERTAS"||c){const b=document.createElement("button");b.className="pill"+(CURRENT_CAT===c?" active":"");b.textContent=c;b.onclick=()=>{CURRENT_CAT=c;CURRENT_SUB=null;renderCats();renderSubs();renderProducts()};bar.appendChild(b)}})}
function renderSubs(){const bar=$("subcategories");bar.innerHTML="";const list=subs(CURRENT_CAT);if(!CURRENT_CAT||CURRENT_CAT==="OFERTAS"||!list.length){bar.style.display="none";return}bar.style.display="flex";const all=document.createElement("button");all.className="pill"+(!CURRENT_SUB?" active":"");all.textContent="Todas";all.onclick=()=>{CURRENT_SUB=null;renderSubs();renderProducts()};bar.appendChild(all);list.forEach(s=>{const b=document.createElement("button");b.className="pill"+(CURRENT_SUB===s?" active":"");b.textContent=s;b.onclick=()=>{CURRENT_SUB=s;renderSubs();renderProducts()};bar.appendChild(b)})}

function filtered(){let list=[...PRODUCTS];if(CURRENT_CAT)list=(CURRENT_CAT==="OFERTAS")?list.filter(isOffer):list.filter(p=>p.categoria===CURRENT_CAT);if(CURRENT_SUB)list=list.filter(p=>p.subcategoria===CURRENT_SUB);const q=(QUERY||"").toLowerCase().trim();if(q)list=list.filter(p=>(p.nombre||"").toLowerCase().includes(q)||(p.descripcion||"").toLowerCase().includes(q));list.sort((a,b)=>{const av=a.stock>0?0:1,bv=b.stock>0?0:1;if(av!==bv)return av-bv;return (a.nombre||"").localeCompare(b.nombre||"")});return list}

function renderProducts(){const g=$("productsGrid");const list=filtered();g.innerHTML="";$("productsTitle").textContent=`Productos (${list.length})`;if(!list.length){g.innerHTML=`<div style="grid-column:1/-1;color:var(--muted);padding:12px">No hay productos.</div>`;return}list.forEach(p=>{const out=isOut(p),offer=isOffer(p);const card=document.createElement("article");card.className="card";const btn=out?`<button class="btnDisabled" disabled>Agotado</button>`:`<button class="bp" type="button" onclick="window.__openProduct('${p.id}')">Ver detalles</button>`;card.innerHTML=`${offer?`<div class="tagOffer">OFERTA</div>`:""}<img src="${p.imagen||""}" alt=""><div class="cardBody"><div class="cardTitle">${p.nombre}</div><div class="cardDesc">${p.descripcion||p.subcategoria||""}</div><div class="pr"><div class="p">${money(p.precio)}</div>${offer?`<div class="o">${money(p.precio_anterior)}</div>`:""}</div>${btn}</div>${out?`<div class="tagOut">AGOTADO</div>`:""}`;if(!out)card.addEventListener("click",e=>{if(e.target.closest("button"))return;openProduct(p.id)});g.appendChild(card)})}

function parseGallery(p){const u=[];if(p.imagen)u.push(p.imagen);if(p.galeria)String(p.galeria).split(",").map(x=>x.trim()).filter(Boolean).forEach(x=>u.push(x));return [...new Set(u.filter(Boolean))].slice(0,8)}
function videoLabel(url){const u=(url||"").toLowerCase();if(u.includes("tiktok.com"))return"Ver en TikTok";if(u.includes("youtube.com")||u.includes("youtu.be"))return"Ver en YouTube";if(u.includes("facebook.com")||u.includes("fb.watch"))return"Ver en Facebook";return"Ver video"}
function openProduct(id){const p=BY_ID[id];if(!p)return;CURRENT=p;$("modalName").textContent=p.nombre||"Producto";$("modalSub").textContent=`${p.categoria||""}${p.subcategoria?(" · "+p.subcategoria):""}`;$("modalPrice").textContent=money(p.precio||0);$("modalOld").textContent=isOffer(p)?money(p.precio_anterior):"";$("modalDesc").textContent=p.descripcion||"";const g=parseGallery(p);$("modalMainImg").src=g[0]||p.imagen||"";const th=$("modalThumbs");th.innerHTML="";g.length<=1?th.classList.add("hidden"):(th.classList.remove("hidden"),g.forEach((src,idx)=>{const im=document.createElement("img");im.src=src;im.className=idx===0?"active":"";im.onclick=()=>{$("modalMainImg").src=src;[...th.children].forEach(x=>x.classList.remove("active"));im.classList.add("active")};th.appendChild(im)}));$("btnAddCart").disabled=isOut(p);$("btnAddCart").textContent=isOut(p)?"Agotado":"Agregar al carrito";$("modalHint").textContent="";openModal("productModal")}
window.__openProduct=openProduct;

function renderCart(){const wrap=$("cartItems");wrap.innerHTML="";$("cartEmpty").style.display=CART.length?"none":"block";CART.forEach((it,idx)=>{const p=BY_ID[it.id];if(!p)return;const row=document.createElement("div");row.className="cartItem";row.innerHTML=`<img src="${p.imagen||""}" alt=""><div><div class="cartName">${p.nombre}</div><div class="cartMeta">${money(p.precio)}</div><div class="qtyRow"><button class="minus">-</button><span class="qtyNum">${it.qty}</span><button class="plus">+</button><button class="trash">🗑</button></div></div>`;row.querySelector(".minus").onclick=()=>{it.qty=Math.max(1,it.qty-1);saveCart();renderCart();updateTotalsUI()};row.querySelector(".plus").onclick=()=>{it.qty++;saveCart();renderCart();updateTotalsUI()};row.querySelector(".trash").onclick=()=>{CART.splice(idx,1);saveCart();renderCart();updateTotalsUI()};wrap.appendChild(row)});updateTotalsUI()}
function updateTotalsUI(){$("subTotal").textContent=money(sub());$("shipTotal").textContent=money(C.envio||0);$("grandTotal").textContent=money(total())}

function setStep(n){STEP=n;$("step1").classList.toggle("hidden",n!==1);$("step2").classList.toggle("hidden",n!==2);$("step3").classList.toggle("hidden",n!==3);$("tab1").classList.toggle("active",n===1);$("tab2").classList.toggle("active",n===2);$("tab3").classList.toggle("active",n===3);$("btnBack").style.display=n===1?"none":"inline-block";$("btnNext").textContent=n===3?"Enviar por WhatsApp":"Continuar";$("btnSendWA").style.display=n===3?"block":"none";if(n===2)buildCheckoutUI()}
function openCart(){setStep(1);renderCart();openModal("cartModal")}

function buildCheckoutUI(){
 const s2=$("step2");
 if($("deptoSel")) return;
 s2.innerHTML=`
 <div class="ckbox">
  <div class="tx"><b>Ubicación (Honduras)</b></div>
  <div class="grid2sel">
   <div><div class="tx">Departamento</div><select id="deptoSel"><option value="">Selecciona</option></select></div>
   <div><div class="tx">Municipio</div><select id="muniSel" disabled><option value="">Selecciona</option></select></div>
  </div>

  <div id="domBlock" class="hidden">
   <div class="hr"></div>
   <div class="tx"><b>Domicilio</b></div>
   <div id="comCityBlock" class="hidden">
    <div class="tx">Comayagua ciudad: zona y colonia/barrio</div>
    <div class="grid2sel">
     <select id="zonaSel"><option value="">Zona</option></select>
     <select id="colSel"><option value="">Colonia/Barrio</option></select>
    </div>
    <div class="note" id="zonaInfo"></div>
   </div>
   <div id="domInfo" class="note hidden"></div>
  </div>

  <div id="empBlock" class="hidden">
   <div class="hr"></div>
   <div class="tx"><b>Empresa de envío</b></div>
   <div class="grid2sel">
    <select id="empSel"></select>
    <select id="modSel"><option value="normal">Servicio normal</option><option value="pagar_al_recibir">Pagar al recibir</option></select>
   </div>
   <div class="note" id="empInfo"></div>
   ${BUS_ON?`<div class="note">🚌 Bus/encomienda: 80–150 (varía, se confirma).</div>`:""}
  </div>

  <div class="hr"></div>
  <div class="tx"><b>Datos</b></div>
  <input id="custName" placeholder="Tu nombre">
  <input id="custPhone" placeholder="Ej: 9999-9999">
  <textarea id="custAddr" placeholder="Dirección / Referencia"></textarea>

  <div class="hr"></div>
  <div class="tx"><b>Pago</b></div>
  <select id="paySel"><option value="">Selecciona</option></select>

  <div id="cashBlock" class="hidden">
   <input id="cashWith" placeholder="¿Con cuánto pagará? (solo domicilio)" inputmode="numeric">
   <div class="note" id="cashInfo"></div>
  </div>

  <div class="hr"></div>
  <div class="note"><b>Envío:</b> <span id="envioPreview">${money(0)}</span> · <b>Total:</b> <span id="totalPreview">${money(total())}</span></div>
 </div>`;

 // deptos
 const ds=$("deptoSel"); deptos().forEach(d=>{const o=document.createElement("option");o.value=d;o.textContent=d;ds.appendChild(o)});
 // empresas
 const es=$("empSel"); EMPRESAS.forEach(x=>{const o=document.createElement("option");o.value=x;o.textContent=x;es.appendChild(o)});

 ds.onchange=()=>{C.depto=ds.value;fillMunisUI();applyRules();}
 $("muniSel").onchange=()=>{C.muni=$("muniSel").value;applyRules();}
 $("zonaSel").onchange=()=>{C.zona=$("zonaSel").value;fillColsUI();applyRules();}
 $("colSel").onchange=()=>{const opt=$("colSel").selectedOptions[0];C.col=opt?.value||"";C.envio=Number(opt?.dataset.costo||0);C.ref=opt?.dataset.ref||"";$("zonaInfo").textContent=C.col?`Costo: ${money(C.envio)}${C.ref?(" · "+C.ref):""}`:"";refreshPreview();}
 es.onchange=()=>{C.empresa=es.value;applyRules();}
 $("modSel").onchange=()=>{C.modalidad=$("modSel").value;applyRules();}
 $("paySel").onchange=()=>{C.pago=$("paySel").value;updatePayUI();refreshPreview();}
 $("cashWith").oninput=()=>{C.cash=Number(String($("cashWith").value||"").replace(/[^\d]/g,"")||0);refreshPreview();}

 fillMunisUI();
 applyRules();
}

function fillMunisUI(){
 const d=$("deptoSel").value;
 const ms=$("muniSel");
 ms.innerHTML=`<option value="">Selecciona</option>`;
 ms.disabled=!d;
 if(!d) return;
 munis(d).forEach(m=>{const o=document.createElement("option");o.value=m;o.textContent=m;ms.appendChild(o)});
 ms.disabled=false;
}

function fillZonaUI(){
 const zs=$("zonaSel");
 zs.innerHTML=`<option value="">Zona</option>`;
 zList().forEach(z=>{
  const nice=z.toLowerCase().includes("centr")?"Zona Céntrica":z.toLowerCase().includes("alej")?"Zona Alejada":z.toLowerCase().includes("fuera")?"Fuera":z;
  const o=document.createElement("option");o.value=z;o.textContent=nice;zs.appendChild(o);
 });
}

function fillColsUI(){
 const z=$("zonaSel").value;
 const cs=$("colSel");
 cs.innerHTML=`<option value="">Colonia/Barrio</option>`;
 if(!z) return;
 cols(z).forEach(c=>{
  const o=document.createElement("option");
  o.value=c.col;o.textContent=`${c.col} (${money(c.c)})`;
  o.dataset.costo=String(c.c||0);
  o.dataset.ref=c.ref||"";
  cs.appendChild(o);
 });
}

function applyRules(){
 const dept=safe(C.depto),mun=safe(C.muni);

 // reset UI
 $("domBlock").classList.add("hidden");
 $("comCityBlock").classList.add("hidden");
 $("domInfo").classList.add("hidden");
 $("empBlock").classList.add("hidden");

 C.entrega="";C.envio=0;C.zona="";C.col="";C.ref="";C.pago="";C.cash=0;C.cambio=0;

 if(!dept||!mun){fillPayOptions();refreshPreview();return;}

 // ✅ Comayagua + municipios domicilio
 if(dept==="Comayagua" && COMAYAGUA_DOMICILIO.has(mun)){
  $("domBlock").classList.remove("hidden");
  // ciudad con zonas
  if(mun==="Comayagua"){
   C.entrega="domicilio_ciudad";
   $("comCityBlock").classList.remove("hidden");
   fillZonaUI();
   $("colSel").innerHTML=`<option value="">Colonia/Barrio</option>`;
   $("zonaInfo").textContent="Elige zona y colonia para calcular el costo.";
  }else{
   C.entrega="domicilio_muni";
   $("domInfo").classList.remove("hidden");
   $("domInfo").textContent=`Servicio a domicilio disponible en ${mun}. (Costo se confirma por WhatsApp).`;
   C.envio=0;
  }
  fillPayOptions();
  refreshPreview();
  return;
 }

 // ✅ Otros municipios de Comayagua (La Libertad, Ojos de Agua, etc.) => empresas/bus
 // ✅ Cualquier otro depto => empresas/bus
 C.entrega="empresa";
 $("empBlock").classList.remove("hidden");
 C.empresa=$("empSel").value||EMPRESAS[0];
 C.modalidad=$("modSel").value||"normal";
 C.envio=(C.modalidad==="pagar_al_recibir")?170:110;
 $("empInfo").textContent=`Empresa: ${C.empresa} · ${C.modalidad==="normal"?"Servicio normal":"Pagar al recibir"} · Costo: ${money(C.envio)}`;
 fillPayOptions();
 refreshPreview();
}

function fillPayOptions(){
 const sel=$("paySel"); if(!sel) return;
 sel.innerHTML=`<option value="">Selecciona</option>`;
 const domicilio=(C.entrega==="domicilio_ciudad"||C.entrega==="domicilio_muni");
 const add=(v,t)=>{const o=document.createElement("option");o.value=v;o.textContent=t;sel.appendChild(o)};
 if(domicilio){
  add("efectivo","Efectivo (pagar al recibir)");
  add("transferencia","Transferencia bancaria");
  add("paypal","PayPal");
  add("tigo","Tigo Money");
 }else{
  add("transferencia","Transferencia bancaria");
  add("paypal","PayPal");
  add("tigo","Tigo Money");
  add("recibir","Pagar al recibir");
 }
 updatePayUI();
}

function updatePayUI(){
 const domicilio=(C.entrega==="domicilio_ciudad"||C.entrega==="domicilio_muni");
 const metodo=$("paySel").value||"";
 C.pago=metodo;
 if(domicilio && metodo==="efectivo") $("cashBlock").classList.remove("hidden");
 else{$("cashBlock").classList.add("hidden");C.cash=0;C.cambio=0;if($("cashWith"))$("cashWith").value="";if($("cashInfo"))$("cashInfo").textContent="";}
}

function refreshPreview(){
 calcCambio();
 if($("envioPreview")) $("envioPreview").textContent=money(C.envio||0);
 if($("totalPreview")) $("totalPreview").textContent=money(total());
 if($("cashInfo") && C.pago==="efectivo"){
  const diff=Number(C.cash||0)-total();
  if(Number(C.cash||0)<=0) $("cashInfo").textContent="Escribe con cuánto pagará para calcular el cambio.";
  else if(diff<0) $("cashInfo").textContent=`Faltan ${money(Math.abs(diff))} para completar el total.`;
  else $("cashInfo").textContent=`Cambio estimado: ${money(diff)}.`;
 }
 updateTotalsUI();
}

function calcCambio(){
 if(C.pago!=="efectivo"){C.cambio=0;return}
 const diff=Number(C.cash||0)-total();
 C.cambio=diff>0?diff:0;
}

function sendWhatsApp(){
 if(!CART.length) return alert("Carrito vacío");
 const name=safe($("custName").value);
 const phone=safe($("custPhone").value);
 const addr=safe($("custAddr").value);

 const lines=[];
 lines.push("🛒 PEDIDO - SDComayagua","");
 if(name) lines.push("👤 "+name);
 if(phone) lines.push("📞 "+phone);
 if(C.depto && C.muni) lines.push(`📍 ${C.depto} / ${C.muni}`);

 if(C.entrega==="domicilio_ciudad"){
  lines.push("🚚 Domicilio (Comayagua ciudad)");
  if(C.zona) lines.push("Zona: "+C.zona);
  if(C.col) lines.push("Colonia/Barrio: "+C.col);
 }else if(C.entrega==="domicilio_muni"){
  lines.push("🚚 Domicilio (municipio en Comayagua)");
 }else{
  lines.push(`📦 Empresa: ${C.empresa} · ${C.modalidad==="normal"?"Normal":"Pagar al recibir"}`);
  if(BUS_ON) lines.push("🚌 Bus/encomienda 80–150 (varía, se confirma).");
 }

 if(addr) lines.push("📌 "+addr);

 lines.push("","Productos:");
 CART.forEach(it=>{const p=BY_ID[it.id];if(p) lines.push(`- ${it.qty} x ${p.nombre} (${money(p.precio)})`)});
 lines.push("");
 lines.push("Subtotal: "+money(sub()));
 lines.push("Envío: "+money(C.envio||0));
 lines.push("Total: "+money(total()));
 if(C.pago) lines.push("Pago: "+C.pago);
 if(C.pago==="efectivo"){lines.push("Efectivo con: "+money(C.cash||0));lines.push("Cambio: "+money(C.cambio||0));}

 window.open(`https://wa.me/${WA_DEFAULT}?text=${encodeURIComponent(lines.join("\n"))}`,"_blank");
}

/* EVENTOS */
function wire(){
 $("overlay").onclick=()=>{closeModal("productModal");closeModal("cartModal")}
 $("closeProduct").onclick=()=>closeModal("productModal")
 $("closeCart").onclick=()=>closeModal("cartModal")
 $("btnKeepBuying").onclick=()=>closeModal("productModal")
 $("btnGoPay").onclick=()=>{closeModal("productModal");openCart()}
 $("btnAddCart").onclick=()=>{
  if(!CURRENT||isOut(CURRENT)) return;
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
  if(STEP===1){if(!CART.length)return alert("Tu carrito está vacío.");setStep(2);return;}
  if(STEP===2){
   if(!$("deptoSel").value||!$("muniSel").value) return alert("Selecciona departamento y municipio.");
   if(C.entrega==="domicilio_ciudad" && (!C.zona || !C.col)) return alert("Elige zona y colonia/barrio.");
   if(!safe($("custName").value)) return alert("Escribe tu nombre.");
   if(!safe($("custAddr").value)) return alert("Escribe tu dirección / referencia.");
   if(!$("paySel").value) return alert("Selecciona método de pago.");
   if($("paySel").value==="efectivo" && Number(C.cash||0)<=0) return alert("Escribe con cuánto pagará.");
   setStep(3);return;
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

/* INIT */
async function init(){
 applyTheme();
 loadCart();
 $("loadingMsg").style.display="block";
 try{
  DATA=await loadAPI();
  PRODUCTS=(DATA.productos||[]).map(p=>({
   id:safe(p.id),nombre:safe(p.nombre),precio:Number(p.precio||0),
   precio_anterior:Number(p.precio_anterior||0),stock:Number(p.stock||0),
   categoria:safe(p.categoria||"General"),subcategoria:safe(p.subcategoria||""),
   descripcion:safe(p.descripcion||""),imagen:safe(p.imagen||""),video:safe(p.video||p.video_url||""),galeria:safe(p.galeria||"")
  })).filter(p=>p.id&&p.nombre);
  BY_ID={};PRODUCTS.forEach(p=>BY_ID[p.id]=p);
  renderCats();renderSubs();renderProducts();
  wire();
 }catch(e){
  console.error(e);
  $("productsGrid").innerHTML=`<div style="grid-column:1/-1;color:var(--muted);padding:12px">Error cargando catálogo.</div>`;
 }finally{$("loadingMsg").style.display="none";}
}
document.addEventListener("DOMContentLoaded",()=>{init();});

/* Render cats/subs (wrappers) */
function renderCats(){renderCats=()=>{};renderCategories&&renderCategories();}
function renderSubs(){renderSubs=()=>{};renderSubcategories&&renderSubcategories();}

})();
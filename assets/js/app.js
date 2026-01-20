(()=>{

/* ================= CONFIG ================= */
const WA="50431517755";
const CART_KEY="sdc_cart_v1";
const API_URL="https://script.google.com/macros/s/AKfycbytPfD9mq__VO7I2lnpBsqdCIT119ZT0zVyz0eeVjrJVgN_q8FYGgmqY6G66C2m67Pa4g/exec";

/* ================= HONDURAS ================= */
const HONDURAS={
"Atlántida":["La Ceiba","Tela","Jutiapa","Arizona","El Porvenir","San Francisco"],
"Choluteca":["Choluteca","Apacilagua","Concepción de María","Duyure","El Corpus","Marcovia","Morolica","Namasigüe","Pespire","San Antonio de Flores","San Isidro","San José","San Marcos de Colón","Santa Ana de Yusguare"],
"Colón":["Trujillo","Balfate","Iriona","Limón","Sabá","Santa Fe","Santa Rosa de Aguán","Sonaguera","Tocoa"],
"Comayagua":["Comayagua","Villa de San Antonio","Ajuterique","Lejamaní","Flores","La Libertad","Lamaní","Las Lajas","Meámbar","Minas de Oro","Ojos de Agua","San Jerónimo","San José del Potrero","San Luis","San Sebastián","Siguatepeque","Taulabé"],
"Copán":["Santa Rosa de Copán","Cabañas","Concepción","Copán Ruinas","Corquín","Cucuyagua","Dolores","Dulce Nombre","El Paraíso","Florida","La Jigua","La Unión","Nueva Arcadia","San Agustín","San Antonio","San Jerónimo","San José","San Juan de Opoa","San Nicolás","San Pedro","Santa Rita","Trinidad","Veracruz"],
"Cortés":["San Pedro Sula","Choloma","Puerto Cortés","Villanueva","La Lima","Omoa","Pimienta","Potrerillos","San Antonio de Cortés","San Francisco de Yojoa","San Manuel","Santa Cruz de Yojoa"],
"El Paraíso":["Yuscarán","Alauca","Danlí","El Paraíso","Güinope","Jacaleapa","Liure","Morocelí","Oropolí","Potrerillos","San Antonio de Flores","San Lucas","San Matías","Soledad","Teupasenti","Texiguat","Trojes","Vado Ancho"],
"Francisco Morazán":["Tegucigalpa","Comayagüela","Valle de Ángeles","Santa Lucía","Talanga","Cantarranas","El Porvenir","Guaimaca","La Libertad","La Venta","Lepaterique","Maraita","Marale","Nueva Armenia","Ojojona","Orica","Reitoca","Sabanagrande","San Antonio de Oriente","San Buenaventura","San Ignacio","San Juan de Flores","San Miguelito","Santa Ana","Santa Rita","Tatumbla","Vallecillo","Villa de San Francisco"],
"Gracias a Dios":["Puerto Lempira","Brus Laguna","Ahuas","Juan Francisco Bulnes","Ramón Villeda Morales","Wampusirpe"],
"Intibucá":["La Esperanza","Camasca","Colomoncagua","Concepción","Dolores","Intibucá","Jesús de Otoro","Magdalena","Masaguara","San Antonio","San Francisco de Opalaca","San Isidro","San Juan","San Marcos de la Sierra","San Miguel Guancapla","Santa Lucía","Yamaranguila"],
"Islas de la Bahía":["Roatán","Utila","Guanaja"],
"La Paz":["La Paz","Aguanqueterique","Cabañas","Cane","Chinacla","Guajiquiro","Lauterique","Marcala","Mercedes de Oriente","Opatoro","San Antonio del Norte","San José","San Juan","San Pedro de Tutule","Santa Ana","Santa Elena","Santa María","Santiago de Puringla","Yarula"],
"Lempira":["Gracias","Belén","Candelaria","Cololaca","Erandique","Gualcince","Guarita","La Campa","La Iguala","Las Flores","Lepaera","Mapulaca","Piraera","San Andrés","San Francisco","San Juan Guarita","San Manuel Colohete","San Marcos de Caiquín","San Rafael","San Sebastián","Santa Cruz","Talgua","Tambla","Tomalá","Valladolid","Virginia"],
"Ocotepeque":["Ocotepeque","Belén Gualcho","Concepción","Dolores Merendón","Fraternidad","La Encarnación","La Labor","Lucerna","Mercedes","San Fernando","San Francisco del Valle","San Jorge","San Marcos","Santa Fe","Sensenti","Sinuapa"],
"Olancho":["Juticalpa","Campamento","Catacamas","Concordia","Dulce Nombre de Culmí","El Rosario","Esquipulas del Norte","Gualaco","Guarizama","Guata","Guayape","Jano","La Unión","Mangulile","Manto","Salamá","San Esteban","San Francisco de Becerra","San Francisco de la Paz","Santa María del Real","Silca","Yocón"],
"Santa Bárbara":["Santa Bárbara","Arada","Atima","Azacualpa","Ceguaca","Colinas","Concepción del Norte","Concepción del Sur","Chinda","El Níspero","Gualala","Ilama","Las Vegas","Macuelizo","Naranjito","Nueva Celilac","Petoa","Protección","Quimistán","San Francisco de Ojuera","San José de Colinas","San Luis","San Marcos","San Nicolás","San Pedro Zacapa","San Vicente Centenario","Santa Rita","Trinidad"],
"Valle":["Nacaome","Alianza","Amapala","Aramecina","Caridad","Goascorán","Langue","San Francisco de Coray","San Lorenzo"],
"Yoro":["Yoro","Arenal","El Negrito","El Progreso","Jocón","Morazán","Olanchito","Santa Rita","Sulaco","Victoria","Yorito"]
};

/* Municipios con DOMICILIO en Comayagua */
const DOMICILIO_COMAYAGUA=["Comayagua","Villa de San Antonio","Ajuterique","Lejamaní","Flores"];

/* Zonas Comayagua */
const ZONAS_COMAYAGUA=[
{zona:"Céntrica",precio:50,lugares:["Col. Piedras Bonitas","Centro","Bo. Arriba","Bo. Abajo"]},
{zona:"Alejada",precio:80,lugares:["Col. 21 de Abril","El Edén","Col. Las Torres"]},
{zona:"Fuera",precio:120,lugares:["Sifón","Palmerola","Pajonal"]}
];

/* ================= HELPERS ================= */
const $=e=>document.getElementById(e);
const money=n=>`Lps. ${Number(n||0).toLocaleString("es-HN")}`;
let CART=[];

/* ================= CART ================= */
function loadCart(){CART=JSON.parse(localStorage.getItem(CART_KEY)||"[]")}
function cartTotal(){return CART.reduce((s,i)=>s+i.price*i.qty,0)}

/* ================= UI ENTREGA ================= */
function renderEntrega(){
const dept=$("dept").value;
const muni=$("muni").value;
const box=$("deliveryBox");
box.innerHTML="";

if(!dept||!muni)return;

if(dept==="Comayagua" && DOMICILIO_COMAYAGUA.includes(muni)){
ZONAS_COMAYAGUA.forEach(z=>{
const d=document.createElement("div");
d.innerHTML=`<label><input type="radio" name="delivery" value="${z.precio}"> ${z.zona} – ${money(z.precio)}<br><small>${z.lugares.join(", ")}</small></label>`;
box.appendChild(d);
});
}else{
["CO807","Cargo Expreso","Forza","Bus local"].forEach(e=>{
const d=document.createElement("div");
d.innerHTML=`<label><input type="radio" name="delivery" value="0"> ${e}</label>`;
box.appendChild(d);
});
}
}

/* ================= PAGO ================= */
function renderPago(){
const dept=$("dept").value;
const muni=$("muni").value;
const box=$("payBox");
box.innerHTML="";

if(dept==="Comayagua" && DOMICILIO_COMAYAGUA.includes(muni)){
box.innerHTML=`
<label><input type="radio" name="pay" value="efectivo"> Efectivo</label>
<label><input type="radio" name="pay" value="transferencia"> Transferencia</label>
<label><input type="radio" name="pay" value="paypal"> PayPal</label>
<label><input type="radio" name="pay" value="tigo"> Tigo Money</label>
<div id="cashBox" style="display:none">
<input id="cashWith" placeholder="¿Con cuánto paga?">
<div id="cashChange"></div>
</div>`;
$("cashWith").oninput=()=>{
const v=Number($("cashWith").value||0);
$("cashChange").textContent=v>0?`Cambio: ${money(v-cartTotal())}`:"";
};
}else{
box.innerHTML=`<label><input type="radio" name="pay" value="recibir"> Pagar al recibir</label>`;
}
}

/* ================= SELECTS ================= */
function initLocation(){
Object.keys(HONDURAS).forEach(d=>{
$("dept").innerHTML+=`<option value="${d}">${d}</option>`;
});
$("dept").onchange=()=>{
$("muni").innerHTML='<option value="">Municipio</option>';
HONDURAS[$("dept").value].forEach(m=>{
$("muni").innerHTML+=`<option value="${m}">${m}</option>`;
});
};
$("muni").onchange=()=>{
renderEntrega();
renderPago();
};
}

/* ================= WHATSAPP ================= */
function sendWA(){
let msg=[];
msg.push("🛒 PEDIDO SDC");
CART.forEach(i=>msg.push(`${i.qty} x ${i.name} – ${money(i.price)}`));
msg.push(`Total: ${money(cartTotal())}`);
msg.push(`Depto: ${$("dept").value}`);
msg.push(`Municipio: ${$("muni").value}`);
window.open(`https://wa.me/${WA}?text=${encodeURIComponent(msg.join("\n"))}`);
}

/* ================= INIT ================= */
document.addEventListener("DOMContentLoaded",()=>{
loadCart();
initLocation();
$("sendWA").onclick=sendWA;
});

})();
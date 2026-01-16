/* ============================================================
   ELEMENTOS DEL DOM
   ============================================================ */
const contenedor = document.getElementById("productos");
const btnPagar = document.getElementById("btnPagar");
const departamentoCliente = document.getElementById("departamentoCliente");
const municipioCliente = document.getElementById("municipioCliente");

/* ============================================================
   PRODUCTOS DE PRUEBA (LOCALES)
   ============================================================ */
let productos = [
  {
    id: 1,
    nombre: "Teclado Mecánico RGB Gamer",
    categoria: "Gaming",
    precio: 1800,
    precio_oferta: 1500,
    oferta: true,
    stock: 5,
    imagenPrincipal: "https://via.placeholder.com/600x600?text=Teclado+Gamer",
    imagenes: [
      "https://via.placeholder.com/600x600?text=Teclado+Vista+1",
      "https://via.placeholder.com/600x600?text=Teclado+Vista+2"
    ],
    video: "",
    descripcion: "Teclado mecánico con switches rojos, ideal para gaming competitivo.",
    puntos: [
      "Switches mecánicos de alta respuesta",
      "Iluminación RGB personalizable",
      "Construcción resistente para uso intensivo"
    ],
    etiqueta: "Top Ventas",
    departamento_envio: "Comayagua",
    municipio_envio: "Comayagua"
  },
  {
    id: 2,
    nombre: "Mouse Gamer 7200 DPI",
    categoria: "Gaming",
    precio: 900,
    precio_oferta: null,
    oferta: false,
    stock: 10,
    imagenPrincipal: "https://via.placeholder.com/600x600?text=Mouse+Gamer",
    imagenes: [],
    video: "",
    descripcion: "Mouse gamer ergonómico con 7 botones programables.",
    puntos: [],
    etiqueta: "Nuevo",
    departamento_envio: "Francisco Morazán",
    municipio_envio: "Tegucigalpa"
  },
  {
    id: 3,
    nombre: "Audífonos Inalámbricos Surround",
    categoria: "Audio",
    precio: 2200,
    precio_oferta: 1990,
    oferta: true,
    stock: 3,
    imagenPrincipal: "https://via.placeholder.com/600x600?text=Audifonos+Gamer",
    imagenes: [],
    video: "",
    descripcion: "Audio envolvente para una experiencia inmersiva en juegos y películas.",
    puntos: [],
    etiqueta: "Premium",
    departamento_envio: "Cortés",
    municipio_envio: "San Pedro Sula"
  }
];

let carrito = [];

/* ============================================================
   BULLETS AUTOMÁTICOS POR CATEGORÍA
   ============================================================ */
const bulletsPorCategoria = {
  "gaming": [
    "Eleva tu experiencia al siguiente nivel",
    "Diseñado para jugadores exigentes",
    "Rendimiento superior en cada partida",
    "Perfecto para sesiones largas de juego",
    "Construcción premium para máxima durabilidad",
    "Optimizado para precisión y velocidad",
    "Ideal para juegos competitivos"
  ],
  "audio": [
    "Sonido claro y envolvente",
    "Diseñado para comodidad prolongada",
    "Ideal para música, juegos y llamadas",
    "Calidad premium en cada detalle"
  ]
};

/* ============================================================
   GENERAR BULLETS AUTOMÁTICOS
   ============================================================ */
function generarPuntosAutomaticos(prod) {
  if (prod.puntos && prod.puntos.length) {
    return prod.puntos;
  }

  const catKey = (prod.categoria || "").toLowerCase();
  const pool = bulletsPorCategoria[catKey] || [
    "Calidad premium en cada detalle",
    "Pensado para una experiencia superior",
    "Ideal para quienes buscan algo mejor"
  ];

  const usados = new Set();
  const result = [];

  while (result.length < 3 && usados.size < pool.length) {
    const idx = Math.floor(Math.random() * pool.length);
    if (!usados.has(idx)) {
      usados.add(idx);
      result.push(pool[idx]);
    }
  }

  return result;
}

/* ============================================================
   RENDERIZAR PRODUCTOS
   ============================================================ */
function renderProductos() {
  contenedor.innerHTML = "";

  productos.forEach((p) => {
    const tieneVideo = p.video && p.video.trim() !== "";
    const tieneMasImagenes = p.imagenes && p.imagenes.length > 0;

    const puntosFinales = generarPuntosAutomaticos(p);
    let bulletsHTML = "";
    if (puntosFinales.length) {
      bulletsHTML = `
        <ul class="bullets">
          ${puntosFinales.map(pt => `<li>${pt}</li>`).join("")}
        </ul>
      `;
    }

    let thumbsHTML = "";
    if (tieneMasImagenes) {
      thumbsHTML = `
        <div class="thumbs" data-product="${p.id}">
          ${p.imagenes.map((img, i) => `
            <div class="thumb ${i === 0 ? "active" : ""}" data-index="${i}">
              <img src="${img}">
            </div>
          `).join("")}
        </div>
      `;
    }

    const tieneOferta = p.oferta && p.precio_oferta && p.precio_oferta < p.precio;

    contenedor.innerHTML += `
      <div class="item" data-id="${p.id}">
        <div class="item-header">
          <h3>${p.nombre}</h3>
          <div class="badge-row">
            ${p.categoria ? `<span class="badge">${p.categoria}</span>` : ""}
            ${p.etiqueta ? `<span class="badge etiqueta">${p.etiqueta}</span>` : ""}
            ${tieneOferta ? `<span class="badge oferta">🔥 Oferta</span>` : ""}
          </div>
        </div>

        <div class="price-row">
          <span class="price-main">
            L ${tieneOferta ? p.precio_oferta.toFixed(2) : p.precio.toFixed(2)}
          </span>
          ${tieneOferta ? `<span class="price-old">L ${p.precio.toFixed(2)}</span>` : ""}
        </div>

        <div class="stock">
          Stock: ${p.stock} · Envío desde: ${p.departamento_envio || "N/A"}${p.municipio_envio ? " - " + p.municipio_envio : ""}
        </div>

        <div class="media-wrapper" data-media="${p.id}">
          <img src="${p.imagenPrincipal}">
          <div class="media-tag">🖼️ Imagen principal</div>
        </div>

        ${thumbsHTML}

        <div class="media-actions">
          ${tieneMasImagenes ? `
            <button class="chip-btn" data-action="imagenes" data-id="${p.id}">
              🖼️ Ver más imágenes
            </button>
          ` : ""}

          ${tieneVideo ? `
            <button class="chip-btn" data-action="video" data-id="${p.id}">
              🎥 Ver video
            </button>
          ` : ""}
        </div>

        ${bulletsHTML}

        <div class="desc-toggle" data-toggle="${p.id}">
          Ver descripción completa
        </div>

        <div class="desc-full" data-desc="${p.id}">
          ${p.descripcion}
        </div>

        <button class="btn-add" onclick="agregarAlCarrito(${p.id})">
          Agregar al carrito
        </button>
      </div>
    `;
  });

  activarEventos();
}

/* ============================================================
   EVENTOS DE MINIATURAS, VIDEO Y DESCRIPCIÓN
   ============================================================ */
function activarEventos() {
  document.querySelectorAll(".thumbs").forEach(th => {
    th.addEventListener("click", e => {
      const thumb = e.target.closest(".thumb");
      if (!thumb) return;

      const productId = th.getAttribute("data-product");
      const index = parseInt(thumb.getAttribute("data-index"));
      const prod = productos.find(x => x.id == productId);
      const mediaWrapper = document.querySelector(`.media-wrapper[data-media="${productId}"]`);

      mediaWrapper.innerHTML = `
        <img src="${prod.imagenes[index]}">
        <div class="media-tag">🖼️ Imagen ${index + 1}</div>
      `;

      th.querySelectorAll(".thumb").forEach(t => t.classList.remove("active"));
      thumb.classList.add("active");
    });
  });

  document.querySelectorAll(".chip-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const action = btn.getAttribute("data-action");
      const id = btn.getAttribute("data-id");
      const prod = productos.find(x => x.id == id);
      const mediaWrapper = document.querySelector(`.media-wrapper[data-media="${id}"]`);

      if (action === "imagenes" && prod.imagenes?.length) {
        mediaWrapper.innerHTML = `
          <img src="${prod.imagenes[0]}">
          <div class="media-tag">🖼️ Galería</div>
        `;
      }

      if (action === "video" && prod.video) {
        mediaWrapper.innerHTML = `
          <video controls>
            <source src="${prod.video}" type="video/mp4">
          </video>
          <div class="media-tag">🎥 Video</div>
        `;
      }
    });
  });

  document.querySelectorAll(".desc-toggle").forEach(tg => {
    tg.addEventListener("click", () => {
      const id = tg.getAttribute("data-toggle");
      const desc = document.querySelector(`[data-desc="${id}"]`);
      const visible = desc.style.display === "block";

      desc.style.display = visible ? "none" : "block";
      tg.textContent = visible ? "Ver descripción completa" : "Ocultar descripción";
    });
  });
}

/* ============================================================
   CARRITO
   ============================================================ */
function agregarAlCarrito(id) {
  const prod = productos.find(p => p.id === id);
  if (!prod) return;

  carrito.push(prod);
  btnPagar.style.display = "inline-flex";
  btnPagar.textContent = `Ir a pagar (${carrito.length})`;
}

/* ============================================================
   BOTÓN PAGAR → WHATSAPP
   ============================================================ */
btnPagar.addEventListener("click", () => {
  if (!carrito.length) return;

  const dep = departamentoCliente.value || "No especificado";
  const mun = municipioCliente.value || "No especificado";

  let mensaje = "Hola, quiero comprar:\n\n";
  let total = 0;

  carrito.forEach(c => {
    const precioFinal = (c.oferta && c.precio_oferta && c.precio_oferta < c.precio)
      ? c.precio_oferta
      : c.precio;
    total += precioFinal;
    mensaje += `- ${c.nombre} (L ${precioFinal.toFixed(2)})\n`;
  });

  mensaje += `\nTotal aproximado: L ${total.toFixed(2)}\n`;
  mensaje += `\nDatos de envío:\nDepartamento: ${dep}\nMunicipio/Ciudad: ${mun}\n`;

  const url = "https://wa.me/50400000000?text=" + encodeURIComponent(mensaje);
  window.open(url, "_blank");
});

/* ============================================================
   INICIO
   ============================================================ */
renderProductos();

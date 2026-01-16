/* ============================================================
   CONFIGURACIÓN: URL DE GOOGLE SHEETS (CSV)
   ============================================================ */
const SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/1IG2pHnk7XfZgw4qiyEm_8BuGDNOlJByVv6H_O9PWdrs/export?format=csv";

/* ============================================================
   ELEMENTOS DEL DOM
   ============================================================ */
const contenedor = document.getElementById("productos");
const btnPagar = document.getElementById("btnPagar");
const departamentoCliente = document.getElementById("departamentoCliente");
const municipioCliente = document.getElementById("municipioCliente");

/* ============================================================
   VARIABLES GLOBALES
   ============================================================ */
let productos = [];
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
  "accesorios": [
    "Diseño práctico y funcional",
    "Perfecto para uso diario",
    "Materiales de alta calidad",
    "Compatibilidad amplia garantizada",
    "Ideal para mejorar tu setup",
    "Compacto y fácil de transportar"
  ],
  "streaming": [
    "Calidad estable y confiable",
    "Ideal para contenido en alta definición",
    "Acceso rápido y sin complicaciones",
    "Perfecto para maratones de series",
    "Optimizado para una experiencia fluida"
  ],
  "audio": [
    "Sonido claro y envolvente",
    "Diseñado para comodidad prolongada",
    "Ideal para música, juegos y llamadas",
    "Calidad premium en cada detalle"
  ],
  "servicios": [
    "Atención rápida y personalizada",
    "Proceso seguro y confiable",
    "Ideal para usuarios frecuentes",
    "Optimizado para tu comodidad"
  ],
  "computadoras": [
    "Rendimiento optimizado para multitarea",
    "Componentes de alta calidad",
    "Perfecta para trabajo y entretenimiento",
    "Diseñada para durar"
  ]
};

/* ============================================================
   PARSEAR CSV A OBJETOS
   ============================================================ */
function parseCSV(text) {
  const lines = text.trim().split("\n");
  const headers = lines[0].split(",").map(h => h.trim());
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const cols = lines[i].split(",");
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = (cols[idx] || "").trim();
    });
    rows.push(obj);
  }
  return rows;
}

/* ============================================================
   MAPEAR FILA DEL CSV A PRODUCTO
   ============================================================ */
function mapRowToProducto(row) {
  const imagenes = [];
  if (row.imagen_1) imagenes.push(row.imagen_1);
  if (row.imagen_2) imagenes.push(row.imagen_2);
  if (row.imagen_3) imagenes.push(row.imagen_3);

  const puntos = [];
  if (row.punto_1) puntos.push(row.punto_1);
  if (row.punto_2) puntos.push(row.punto_2);
  if (row.punto_3) puntos.push(row.punto_3);

  return {
    id: Number(row.id || 0),
    nombre: row.nombre || "",
    categoria: row.categoria || "",
    precio: Number(row.precio || 0),
    precio_oferta: row.precio_oferta ? Number(row.precio_oferta) : null,
    oferta: (row.oferta || "").toLowerCase() === "si",
    stock: Number(row.stock || 0),
    imagenPrincipal: row.imagen_principal || "",
    imagenes,
    video: row.video || "",
    descripcion: row.descripcion || "",
    puntos,
    etiqueta: row.etiqueta || "",
    departamento_envio: row.departamento_envio || "",
    municipio_envio: row.municipio_envio || ""
  };
}

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
   CARGAR PRODUCTOS DESDE GOOGLE SHEETS
   ============================================================ */
async function cargarProductos() {
  try {
    const res = await fetch(SHEET_CSV_URL);
    const text = await res.text();
    const rows = parseCSV(text);
    productos = rows.map(mapRowToProducto).filter(p => p.id);
    renderProductos();
  } catch (e) {
    console.error("Error cargando productos desde Google Sheets:", e);
    contenedor.innerHTML = "<p>No se pudieron cargar los productos.</p>";
  }
}

cargarProductos();

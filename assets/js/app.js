async function init() {
  const data = await apiGetAll();

  const productos = data.productos || [];
  const grid = document.getElementById("grid");

  grid.innerHTML = "";

  productos.forEach(p => {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <img src="${p.imagen || ""}">
      <h3>${p.nombre}</h3>
      <p>Lps. ${p.precio}</p>
      <button>Ver producto</button>
    `;

    card.onclick = () => openProduct(p);
    grid.appendChild(card);
  });
}

init();


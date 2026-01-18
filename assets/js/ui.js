// ui.js (sin choques con app.js)

(function () {
  // helper interno
  function getEl(id) { return document.getElementById(id); }

  // Modal de producto (solo funcionará cuando tengas el modal en index.html)
  window.openProduct = function (p) {
    // Si el modal no existe todavía, no rompas la página
    const modal = getEl("prodModal");
    if (!modal) return;

    const name = getEl("modalName");
    const sub = getEl("modalSub");
    const desc = getEl("modalDesc");
    const price = getEl("modalPrice");
    const old = getEl("modalOld");
    const mainImg = getEl("modalMainImg");
    const thumbs = getEl("modalThumbs");
    const vids = getEl("modalVideos");

    if (!name || !mainImg) return;

    name.textContent = p.nombre || "Producto";
    if (sub) sub.textContent = (p.categoria || "—") + (p.subcategoria ? " · " + p.subcategoria : "");
    if (desc) desc.textContent = p.descripcion || "";
    if (price) price.textContent = (window.fmtLps ? window.fmtLps(p.precio || 0) : `Lps. ${p.precio || 0}`);

    const oldOk = Number(p.precio_anterior || 0) > Number(p.precio || 0);
    if (old) old.textContent = oldOk ? (window.fmtLps ? window.fmtLps(p.precio_anterior) : `Lps. ${p.precio_anterior}`) : "";

    // Galería
    const urls = [];
    if (p.imagen) urls.push(String(p.imagen).trim());
    for (let i = 1; i <= 8; i++) {
      const g = p[`galeria_${i}`];
      if (g && String(g).trim()) urls.push(String(g).trim());
    }
    const gallery = Array.from(new Set(urls)).slice(0, 8);

   mainImg.src = gallery[0] || "assets/img/no-image.png";
mainImg.alt = p.nombre || "";

// ✅ fallback si la imagen falla
mainImg.onerror = function () {
  this.onerror = null;
  this.src = "assets/img/no-image.png";
};


    if (thumbs) {
      thumbs.innerHTML = "";
      if (gallery.length <= 1) {
        thumbs.style.display = "none";
      } else {
        thumbs.style.display = "flex";
        gallery.forEach((src, idx) => {
          const im = document.createElement("img");
          im.className = "thumb" + (idx === 0 ? " active" : "");
        im.src = src;
im.alt = "thumb";
im.onerror = function () {
  this.onerror = null;
  this.src = "assets/img/no-image.png";
};
          im.onclick = () => {
            mainImg.src = src;
            Array.from(thumbs.children).forEach(x => x.classList.remove("active"));
            im.classList.add("active");
          };
          thumbs.appendChild(im);
        });
      }
    }

    // Video
    if (vids) {
      vids.innerHTML = "";
      const videoUrl = (p.video || p.video_url || "").toString().trim();
      if (!videoUrl) {
        vids.style.display = "none";
      } else {
        vids.style.display = "flex";
        const a = document.createElement("a");
        a.className = "vbtn";
        a.href = videoUrl;
        a.target = "_blank";
        a.rel = "noopener";
        const u = videoUrl.toLowerCase();
        a.textContent =
          u.includes("tiktok.com") ? "Ver en TikTok" :
          (u.includes("youtube.com") || u.includes("youtu.be")) ? "Ver en YouTube" :
          (u.includes("facebook.com") || u.includes("fb.watch")) ? "Ver en Facebook" :
          "Ver video";
        vids.appendChild(a);
      }
    }

    // Abrir modal/backdrop si existen
    const backdrop = getEl("backdrop");
    if (backdrop) backdrop.style.display = "block";
    modal.style.display = "block";
    modal.setAttribute("aria-hidden", "false");
  };

})();

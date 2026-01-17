const $ = (id) => document.getElementById(id);
function fmtLps(n) { return `Lps. ${Number(n || 0).toFixed(0)}`; }

let CURRENT_PRODUCT = null;

function openProduct(p) {
  CURRENT_PRODUCT = p;

  $("modalName").textContent = p.nombre || "";
  $("modalDesc").textContent = p.descripcion || "";
  $("modalPrice").textContent = fmtLps(p.precio || 0);
  $("modalOld").textContent =
    Number(p.precio_anterior) > Number(p.precio)
      ? fmtLps(p.precio_anterior)
      : "";

  // Galería
  const imgs = [];
  if (p.imagen) imgs.push(p.imagen);
  for (let i = 1; i <= 8; i++) {
    if (p[`galeria_${i}`]) imgs.push(p[`galeria_${i}`]);
  }

  $("modalMainImg").src = imgs[0] || "";
  const thumbs = $("modalThumbs");
  thumbs.innerHTML = "";

  if (imgs.length > 1) {
    imgs.forEach((src, i) => {
      const im = document.createElement("img");
      im.src = src;
      if (i === 0) im.classList.add("active");
      im.onclick = () => {
        $("modalMainImg").src = src;
        [...thumbs.children].forEach(t => t.classList.remove("active"));
        im.classList.add("active");
      };
      thumbs.appendChild(im);
    });
  }

  // Video
  const videos = $("modalVideos");
  videos.innerHTML = "";
  if (p.video) {
    let txt = "Ver video";
    const l = p.video.toLowerCase();
    if (l.includes("tiktok")) txt = "TikTok";
    else if (l.includes("youtube")) txt = "YouTube";
    else if (l.includes("facebook")) txt = "Facebook";

    const a = document.createElement("a");
    a.href = p.video;
    a.target = "_blank";
    a.textContent = txt;
    videos.appendChild(a);
  }

  $("modalAdd").onclick = () => addToCart(p);
  $("productModal").style.display = "flex";
}

function closeProduct() {
  $("productModal").style.display = "none";
}

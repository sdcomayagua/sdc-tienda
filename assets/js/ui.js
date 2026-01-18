(function () {
  function getEl(id){ return document.getElementById(id); }
  const fallback = "assets/img/no-image.png";

  function closeAllModals(){
    const prod = getEl("prodModal");
    const cart = getEl("cartModal");
    const backdrop = getEl("backdrop");

    if (prod){ prod.style.display="none"; prod.setAttribute("aria-hidden","true"); }
    if (cart){ cart.style.display="none"; cart.setAttribute("aria-hidden","true"); }
    if (backdrop) backdrop.style.display="none";
  }

  function openModal(modalId){
    const modal = getEl(modalId);
    const backdrop = getEl("backdrop");
    if (backdrop) backdrop.style.display="block";
    if (modal){
      modal.style.display="block";
      modal.setAttribute("aria-hidden","false");
    }
  }

  function parseGallery(p){
    const urls = [];
    if (p.imagen) urls.push(String(p.imagen).trim());
    for (let i=1;i<=8;i++){
      const g = p[`galeria_${i}`];
      if (g && String(g).trim()) urls.push(String(g).trim());
    }
    if (p.galeria){
      String(p.galeria).split(",").map(s=>s.trim()).filter(Boolean).forEach(u=>urls.push(u));
    }
    return Array.from(new Set(urls)).slice(0,8);
  }

  function videoLabel(url){
    const u = (url||"").toLowerCase();
    if (u.includes("tiktok.com")) return "Ver en TikTok";
    if (u.includes("youtube.com") || u.includes("youtu.be")) return "Ver en YouTube";
    if (u.includes("facebook.com") || u.includes("fb.watch")) return "Ver en Facebook";
    return "Ver video";
  }

  // listeners globales 1 sola vez
  document.addEventListener("DOMContentLoaded", () => {
    const backdrop = getEl("backdrop");
    if (backdrop) backdrop.addEventListener("click", closeAllModals);

    const closeProd = getEl("btnCloseProd");
    if (closeProd) closeProd.addEventListener("click", closeAllModals);

    const closeCart = getEl("btnCloseCart");
    if (closeCart) closeCart.addEventListener("click", closeAllModals);

    document.addEventListener("keydown", (e)=>{
      if (e.key === "Escape") closeAllModals();
    });
  });

  // abre producto
  window.openProduct = function(p){
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
    const addBtn = getEl("modalAdd");
    const shareBtn = getEl("btnShareProduct");

    if (name) name.textContent = p.nombre || "Producto";
    if (sub) sub.textContent = (p.categoria || "—") + (p.subcategoria ? " · " + p.subcategoria : "");
    if (desc) desc.textContent = p.descripcion || "";

    const f = window.fmtLps ? window.fmtLps : (x)=>`Lps. ${Number(x||0).toFixed(0)}`;
    if (price) price.textContent = f(p.precio||0);

    const oldOk = Number(p.precio_anterior||0) > Number(p.precio||0);
    if (old) old.textContent = oldOk ? f(p.precio_anterior) : "";

    const gallery = parseGallery(p);

    if (mainImg){
      mainImg.src = gallery[0] || fallback;
      mainImg.onerror = function(){ this.onerror=null; this.src=fallback; };
      mainImg.alt = p.nombre || "";
    }

    if (thumbs){
      thumbs.innerHTML = "";
      if (gallery.length <= 1){
        thumbs.style.display = "none";
      } else {
        thumbs.style.display = "flex";
        gallery.forEach((src, idx)=>{
          const im = document.createElement("img");
          im.className = "thumb" + (idx===0 ? " active" : "");
          im.src = src;
          im.onerror = function(){ this.onerror=null; this.src=fallback; };
          im.onclick = ()=>{
            if (!mainImg) return;
            mainImg.src = src;
            Array.from(thumbs.children).forEach(x=>x.classList.remove("active"));
            im.classList.add("active");
          };
          thumbs.appendChild(im);
        });
      }
    }

    if (vids){
      vids.innerHTML = "";
      const url = (p.video || p.video_url || p.video_tiktok || p.video_facebook || p.video_youtube || "").toString().trim();
      if (!url){
        vids.style.display = "none";
      } else {
        vids.style.display = "flex";
        const a = document.createElement("a");
        a.className = "vbtn";
        a.href = url;
        a.target = "_blank";
        a.rel = "noopener";
        a.textContent = videoLabel(url);
        vids.appendChild(a);
      }
    }

    if (addBtn){
      const agotado = Number(p.stock||0) <= 0;
      addBtn.disabled = agotado;
      addBtn.textContent = agotado ? "Agotado" : "Agregar al carrito";
      addBtn.onclick = ()=>{ if (!agotado && window.addToCart) window.addToCart(p); };
    }

    if (shareBtn){
      shareBtn.onclick = async ()=>{
        const url = location.origin + location.pathname + "#p=" + encodeURIComponent(p.id||"");
        try{ await navigator.clipboard.writeText(url); alert("Enlace copiado"); }
        catch(e){ alert("No se pudo copiar"); }
      };
    }

    openModal("prodModal");
  };

  // abrir carrito desde app.js
  window.openCartModal = function(){
    openModal("cartModal");
  };

  // cerrar desde app.js si hace falta
  window.closeAllModals = closeAllModals;

})();

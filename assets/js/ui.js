// assets/js/ui.js (modal estable + checkoutAdd)
(function(){
  const fallback = "assets/img/no-image.png";
  const getEl = (id)=>document.getElementById(id);

  function toast(msg){
    let t = document.getElementById("toast");
    if (!t){
      t = document.createElement("div");
      t.id = "toast";
      t.style.position = "fixed";
      t.style.left = "50%";
      t.style.bottom = "88px";
      t.style.transform = "translateX(-50%)";
      t.style.padding = "10px 14px";
      t.style.borderRadius = "14px";
      t.style.background = "rgba(0,0,0,.75)";
      t.style.color = "white";
      t.style.fontWeight = "800";
      t.style.zIndex = "9999";
      t.style.transition = "opacity .2s ease";
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.style.opacity = "1";
    clearTimeout(window.__toastTimer);
    window.__toastTimer = setTimeout(()=>{ t.style.opacity = "0"; }, 1200);
  }

  function closeProductModal(){
    const modal = getEl("prodModal");
    const backdrop = getEl("backdrop");
    if (modal){
      modal.style.display = "none";
      modal.setAttribute("aria-hidden","true");
    }
    // OJO: si carrito está abierto, no apagues backdrop aquí.
    // checkout.js controla el backdrop para carrito.
    // Si no hay carrito abierto, sí lo apagamos.
    const cart = getEl("cartModal");
    const cartOpen = cart && cart.style.display === "block";
    if (backdrop && !cartOpen) backdrop.style.display = "none";
  }

  function openProductModal(){
    const modal = getEl("prodModal");
    const backdrop = getEl("backdrop");
    if (backdrop) backdrop.style.display = "block";
    if (modal){
      modal.style.display = "block";
      modal.setAttribute("aria-hidden","false");
    }
  }

  function parseGallery(p){
    const urls = [];
    if (p.imagen) urls.push(String(p.imagen).trim());

    // galeria_1..8
    for (let i=1;i<=8;i++){
      const g = p[`galeria_${i}`];
      if (g && String(g).trim()) urls.push(String(g).trim());
    }

    // galeria CSV
    if (p.galeria){
      String(p.galeria).split(",").map(x=>x.trim()).filter(Boolean).forEach(u=>urls.push(u));
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

  // listeners globales (una sola vez)
  document.addEventListener("DOMContentLoaded", ()=>{
    getEl("btnCloseProd")?.addEventListener("click", closeProductModal);

    // click en backdrop: si producto está abierto, lo cierra; si carrito está abierto lo maneja checkout.js
    getEl("backdrop")?.addEventListener("click", ()=>{
      const modal = getEl("prodModal");
      if (modal && modal.style.display === "block") closeProductModal();
    });

    document.addEventListener("keydown",(e)=>{
      if (e.key === "Escape"){
        const modal = getEl("prodModal");
        if (modal && modal.style.display === "block") closeProductModal();
      }
    });
  });

  // API para abrir producto desde app.js
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

    // texto
    if (name) name.textContent = p.nombre || "Producto";
    if (sub) sub.textContent = (p.categoria || "—") + (p.subcategoria ? " · " + p.subcategoria : "");
    if (desc) desc.textContent = p.descripcion || "";

    const f = window.fmtLps ? window.fmtLps : (x)=>`Lps. ${Number(x||0).toFixed(0)}`;
    if (price) price.textContent = f(p.precio || 0);

    const oldOk = Number(p.precio_anterior||0) > Number(p.precio||0);
    if (old) old.textContent = oldOk ? f(p.precio_anterior) : "";

    // galería
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

    // video
    if (vids){
      vids.innerHTML = "";
      const url = String(p.video || "").trim();
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

    // Agregar al carrito (opción A: NO abre carrito)
    if (addBtn){
      const agotado = Number(p.stock||0) <= 0;
      addBtn.disabled = agotado;
      addBtn.textContent = agotado ? "Agotado" : "Agregar al carrito";

      addBtn.onclick = ()=>{
        if (agotado) return;

        if (typeof window.checkoutAdd === "function"){
          const ok = window.checkoutAdd(p);
          if (ok){
            toast("Agregado al carrito ✅");
            // actualizar badge por si acaso
            if (typeof window.checkoutRefreshBadge === "function") window.checkoutRefreshBadge();
          }
        } else {
          alert("checkout.js no está cargado aún.");
        }
      };
    }

    // Compartir producto
    if (shareBtn){
      shareBtn.onclick = async ()=>{
        const url = location.origin + location.pathname + "#p=" + encodeURIComponent(p.id||"");
        try{ await navigator.clipboard.writeText(url); alert("Enlace copiado"); }
        catch{ alert("No se pudo copiar"); }
      };
    }

    openProductModal();
  };

})();
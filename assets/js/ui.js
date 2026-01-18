// assets/js/ui.js (toast + badge pulse + compartir WhatsApp)
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
      t.style.background = "rgba(0,0,0,.78)";
      t.style.color = "white";
      t.style.fontWeight = "800";
      t.style.zIndex = "9999";
      t.style.transition = "opacity .2s ease";
      t.style.opacity = "0";
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.style.opacity = "1";
    clearTimeout(window.__toastTimer);
    window.__toastTimer = setTimeout(()=>{ t.style.opacity = "0"; }, 1200);
  }

  function pulseBadge(){
    const b = document.getElementById("cartCount");
    if (!b) return;
    b.classList.remove("pulse");
    // reflow para reiniciar animación
    void b.offsetWidth;
    b.classList.add("pulse");
  }

  function closeProductModal(){
    const modal = getEl("prodModal");
    const backdrop = getEl("backdrop");
    if (modal){
      modal.style.display = "none";
      modal.setAttribute("aria-hidden","true");
    }
    const cart = getEl("cartModal");
    const cartOpen = cart && cart.style.display === "block";
    if (backdrop && !cartOpen) backdrop.style.display = "none";
  }

  function parseGallery(p){
    const urls = [];
    if (p.imagen) urls.push(String(p.imagen).trim());
    for (let i=1;i<=8;i++){
      const g = p[`galeria_${i}`];
      if (g && String(g).trim()) urls.push(String(g).trim());
    }
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

  function getWhatsAppNumber(){
    // Usa ajustes si existen (app.js expone ajustesMap)
    if (typeof window.ajustesMap === "function"){
      const a = window.ajustesMap();
      const wa = (a.whatsapp_numero || "50431517755").replace(/\D/g,"");
      return wa || "50431517755";
    }
    return "50431517755";
  }

  function productShareLink(p){
    return location.origin + location.pathname + "#p=" + encodeURIComponent(p.id||"");
  }

  document.addEventListener("DOMContentLoaded", ()=>{
    getEl("btnCloseProd")?.addEventListener("click", closeProductModal);

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
    const shareWABtn = getEl("btnShareProductWA"); // nuevo botón

    if (name) name.textContent = p.nombre || "Producto";
    if (sub) sub.textContent = (p.categoria || "—") + (p.subcategoria ? " · " + p.subcategoria : "");
    if (desc) desc.textContent = p.descripcion || "";

    const f = window.fmtLps ? window.fmtLps : (x)=>`Lps. ${Number(x||0).toFixed(0)}`;
    if (price) price.textContent = f(p.precio || 0);

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

    // Agregar al carrito (sin abrir carrito)
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
            window.checkoutRefreshBadge && window.checkoutRefreshBadge();
            pulseBadge();
          }
        } else {
          toast("Error: checkout no cargó");
        }
      };
    }

    // Compartir link
    if (shareBtn){
      shareBtn.onclick = async ()=>{
        const url = productShareLink(p);
        try{ await navigator.clipboard.writeText(url); toast("Enlace copiado ✅"); }
        catch{ toast("No se pudo copiar"); }
      };
    }

    // Compartir por WhatsApp
    if (shareWABtn){
      shareWABtn.onclick = ()=>{
        const wa = getWhatsAppNumber();
        const url = productShareLink(p);
        const msg = `Hola, me interesa este producto:\n${p.nombre}\n${url}`;
        window.open(`https://wa.me/${wa}?text=${encodeURIComponent(msg)}`, "_blank");
      };
    }

    // abrir modal
    const backdrop = getEl("backdrop");
    if (backdrop) backdrop.style.display = "block";
    modal.style.display = "block";
    modal.setAttribute("aria-hidden","false");
  };
})();
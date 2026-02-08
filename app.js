(function(){
  const PRODUCTS = (window.CELLZONE_PRODUCTS || []).map(p => ({...p}));
  const DEFAULT_FAVS = window.CELLZONE_DEFAULT_FAVORITES || [];

  const LS_FAV = "cz_favorites";
  const LS_VIEWED = "cz_viewed";
  const LS_CART = "cz_cart";

  const app = document.getElementById("app");
  const searchInput = document.getElementById("searchInput");
  const btnSearch = document.getElementById("btnSearch");
  const btnMenu = document.getElementById("btnMenu");
  const btnFav = document.getElementById("btnFav");
  const drawer = document.getElementById("drawer");
  const btnCloseDrawer = document.getElementById("btnCloseDrawer");
  const drawerBackdrop = document.getElementById("drawerBackdrop");
  const btnTop = document.getElementById("btnTop");
  const waFloat = document.getElementById("waFloat");
  const waBadge = document.getElementById("waBadge");

  const state = {
    tab: "favorites",
    query: "",
    category: "",
    favorites: loadSet(LS_FAV, DEFAULT_FAVS),
    viewed: loadArray(LS_VIEWED, []),
    cartCount: loadNumber(LS_CART, 0),
    pdpImage: null,
    pdpTab: "specs"
  };

  function formatHNL(amount){
    try{
      return "L" + Number(amount || 0).toLocaleString("es-HN", { maximumFractionDigits: 0 });
    }catch(e){
      return "L" + (amount || 0);
    }
  }

  function escapeHtml(str){
    return String(str || "")
      .replace(/&/g,"&amp;")
      .replace(/</g,"&lt;")
      .replace(/>/g,"&gt;")
      .replace(/"/g,"&quot;")
      .replace(/'/g,"&#039;");
  }

  function loadSet(key, fallbackArr){
    try{
      const raw = localStorage.getItem(key);
      if(!raw){
        const s = new Set((fallbackArr || []).map(Number).filter(Boolean));
        localStorage.setItem(key, JSON.stringify([...s]));
        return s;
      }
      const arr = JSON.parse(raw);
      return new Set((arr || []).map(Number).filter(Boolean));
    }catch(e){
      return new Set((fallbackArr || []).map(Number).filter(Boolean));
    }
  }
  function saveSet(key, set){
    localStorage.setItem(key, JSON.stringify([...set]));
  }
  function loadArray(key, fallback){
    try{
      const raw = localStorage.getItem(key);
      if(!raw) return fallback || [];
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : (fallback || []);
    }catch(e){ return fallback || []; }
  }
  function saveArray(key, arr){
    localStorage.setItem(key, JSON.stringify(arr));
  }
  function loadNumber(key, fallback){
    const n = Number(localStorage.getItem(key));
    return Number.isFinite(n) ? n : (fallback || 0);
  }
  function saveNumber(key, n){
    localStorage.setItem(key, String(Number(n)||0));
  }

  function getProductById(id){
    return PRODUCTS.find(p => Number(p.id) === Number(id));
  }

  function setHash(path){
    location.hash = path;
  }

  function parseRoute(){
    const h = (location.hash || "#/").replace(/^#/, "");
    const parts = h.split("/").filter(Boolean);
    if(parts.length === 0) return { name:"home" };
    if(parts[0] === "") return { name:"home" };
    if(parts[0] === "p" && parts[1]) return { name:"pdp", id:Number(parts[1]) };
    return { name:"home" };
  }

  function openDrawer(){
    drawer.classList.add("is-open");
    drawer.setAttribute("aria-hidden","false");
  }
  function closeDrawer(){
    drawer.classList.remove("is-open");
    drawer.setAttribute("aria-hidden","true");
  }

  btnMenu?.addEventListener("click", openDrawer);
  btnCloseDrawer?.addEventListener("click", closeDrawer);
  drawerBackdrop?.addEventListener("click", closeDrawer);

  // Search
  function setQuery(q){
    state.query = (q || "").trim();
    if(searchInput) searchInput.value = state.query;
    render();
  }
  btnSearch?.addEventListener("click", ()=> setQuery(searchInput?.value || ""));
  searchInput?.addEventListener("keydown", (e)=> {
    if(e.key === "Enter") setQuery(searchInput.value || "");
  });

  // Favorites shortcut
  btnFav?.addEventListener("click", ()=>{
    setQuery("");
    state.tab = "favorites";
    render();
    window.scrollTo({top:0, behavior:"smooth"});
  });

  // Scroll top
  window.addEventListener("scroll", ()=>{
    const y = window.scrollY || 0;
    btnTop.classList.toggle("is-show", y > 600);
  });
  btnTop?.addEventListener("click", ()=> window.scrollTo({top:0, behavior:"smooth"}));

  // WhatsApp floating (share store or product)
    function updateWhatsAppLink(product){
    const plain = product
      ? `Hola, me interesa este producto en CellZoneHN:

${product.name}
Precio: ${formatHNL(product.price)}

¿Está disponible?`
      : `Hola CellZoneHN, quiero hacer una consulta.`;
    const text = encodeURIComponent(plain);
    waFloat.href = `https://api.whatsapp.com/send?text=${text}`;
    waBadge.textContent = "1";
  }

  // Viewed tracking
  function addViewed(id){
    const n = Number(id);
    if(!n) return;
    const arr = state.viewed.filter(x => Number(x) !== n);
    arr.unshift(n);
    const trimmed = arr.slice(0, 12);
    state.viewed = trimmed;
    saveArray(LS_VIEWED, trimmed);
  }

  // Toast
  function toast(msg){
    const t = document.createElement("div");
    t.className = "toast";
    t.textContent = msg;
    document.body.appendChild(t);
    requestAnimationFrame(()=> t.classList.add("toast--show"));
    setTimeout(()=> {
      t.classList.remove("toast--show");
      setTimeout(()=> t.remove(), 250);
    }, 1600);
  }

  // Spec extraction
  function extractSpecs(name){
    const s = String(name || "");
    const out = {
      storage: null,
      ram: null,
      battery: null,
      watts: null,
      percent: null
    };

    const mPercent = s.match(/(\d{1,3})\s*%/);
    if(mPercent) out.percent = mPercent[1] + "%";

    // RAM e.g. "8GB RAM", "24RAM", "24 RAM"
    const mRam = s.match(/(\d{1,3})\s*(?:gb)?\s*ram/i) || s.match(/(\d{1,3})\s*ram/i);
    if(mRam) out.ram = (mRam[1] || "").toUpperCase().includes("GB") ? mRam[1] : (mRam[1] + "GB");

    // Storage: prefer TB, then GB not tied to RAM
    const allSizes = [...s.matchAll(/(\d{1,4})\s*(tb|gb)/ig)].map(x => ({n:Number(x[1]), u:x[2].toUpperCase()}));
    if(allSizes.length){
      const hasTB = allSizes.filter(x => x.u === "TB").sort((a,b)=>b.n-a.n)[0];
      if(hasTB) out.storage = `${hasTB.n}${hasTB.u}`;
      else{
        // If multiple GB values (ram + storage), choose largest as storage
        const maxGB = allSizes.filter(x => x.u === "GB").sort((a,b)=>b.n-a.n)[0];
        if(maxGB) out.storage = `${maxGB.n}${maxGB.u}`;
      }
    }

    const mMah = s.match(/(\d{4,5})\s*mAh/i);
    if(mMah) out.battery = mMah[1] + " mAh";

    const mW = s.match(/(\d{1,3})\s*w\b/i);
    if(mW) out.watts = mW[1] + " W";

    return out;
  }

  // Data helpers
  function isFavorite(id){ return state.favorites.has(Number(id)); }
  function toggleFavorite(id){
    const n = Number(id);
    if(state.favorites.has(n)) state.favorites.delete(n);
    else state.favorites.add(n);
    saveSet(LS_FAV, state.favorites);
    render();
  }

  function addCart(){
    state.cartCount = (Number(state.cartCount) || 0) + 1;
    saveNumber(LS_CART, state.cartCount);
    toast("Agregado al carrito ✅");
  }

  // Filtering
  function matchesQuery(p, q){
    q = (q||"").toLowerCase();
    if(!q) return true;
    const hay = (p.name + " " + (p.categories||[]).join(" ")).toLowerCase();
    return hay.includes(q);
  }
  function matchesCategory(p, cat){
    if(!cat) return true;
    return (p.categories || []).some(c => String(c).toLowerCase() === String(cat).toLowerCase());
  }

  function getListForHome(){
    // If search query: return filtered
    const q = state.query;
    const cat = state.category;

    let list = PRODUCTS.slice();
    if(q) list = list.filter(p => matchesQuery(p, q));
    if(cat) list = list.filter(p => matchesCategory(p, cat));

    if(q || cat) return list;

    // tabs
    if(state.tab === "favorites"){
      const favIds = [...state.favorites];
      list = favIds.map(getProductById).filter(Boolean);
      if(list.length === 0) list = PRODUCTS.slice(0, 8);
      return list;
    }
    if(state.tab === "viewed"){
      const ids = state.viewed;
      list = ids.map(getProductById).filter(Boolean);
      if(list.length === 0) list = PRODUCTS.slice(0, 8);
      return list;
    }
    // new
    return PRODUCTS.slice(0, 10);
  }

  // Render pieces
  function hero(product){
    if(!product) return "";
    const img = product.images?.[0] || "";
    return `
      <section class="hero section">
        <div class="hero__inner">
          <span class="hero__badge">NUEVO</span>

          <div class="hero__grid">
            <div class="hero__card">
              <div class="hero__media">
                <img src="${escapeHtml(img)}" alt="${escapeHtml(product.name)}" loading="lazy">
              </div>
              <div class="hero__content">
                <div class="hero__h1">${escapeHtml(product.name)}</div>
                <div class="hero__price">
                  <div class="p">Precio</div>
                  <div class="v">${escapeHtml(formatHNL(product.price))}</div>
                </div>
                <div class="hero__cta">
                  <button class="btn btn--primary" data-go="p/${product.id}">
                    VER MÁS
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
                      <path d="M9 18l6-6-6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                  </button>
                  <button class="btn btn--ghost" data-action="fav" data-id="${product.id}">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
                      <path d="M12 21s-7-4.6-9.4-8.1C.8 9.8 2.4 6.5 5.9 5.7c1.6-.4 3.3.1 4.4 1.3 1.1-1.2 2.8-1.7 4.4-1.3 3.5.8 5.1 4.1 3.3 7.2C19 16.4 12 21 12 21z"
                        stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
                    </svg>
                    ${isFavorite(product.id) ? "Guardado" : "Favorito"}
                  </button>
                </div>
              </div>
            </div>

            <div class="hero__card">
              <div class="hero__content">
                <div class="hero__h1">Envíos a todo Honduras</div>
                <div class="section__subtitle" style="text-align:left;margin:0">
                  Catálogo real con tus productos. Diseño tipo tienda grande, rápido y listo para GitHub Pages.
                </div>

                <div style="margin-top:14px;display:grid;gap:10px">
                  <div class="badge">✅ Pago contra entrega (según zona)</div>
                  <div class="badge">🚚 Envío gratis en muchos productos</div>
                  <div class="badge">💬 WhatsApp: compartí un producto en 1 click</div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>
    `;
  }

  function categoriesBlock(){
    // Pick real images from existing products
    const pickByCat = (key) => PRODUCTS.find(p => (p.categories||[]).some(c => String(c).toLowerCase().includes(key)))?.images?.[0]
      || PRODUCTS.find(p => (p.name||"").toLowerCase().includes(key))?.images?.[0]
      || PRODUCTS[0]?.images?.[0] || "";

    const imgTv = pickByCat("tv");
    const imgPhone = pickByCat("iphone") || pickByCat("samsung") || pickByCat("android");
    const imgHome = pickByCat("hisense") || imgTv;
    const imgTab = pickByCat("tablet") || pickByCat("tab");

    return `
      <section class="section">
        <h2 class="section__title">Tus categorías favoritas</h2>

        <div class="categories">
          <a class="cat" href="#/" data-cat="TV y Smart TV">
            <div class="cat__label">Transforma<br>tu entretenimiento</div>
            <div class="cat__img"><img src="${escapeHtml(imgTv)}" alt="Entretenimiento" loading="lazy"></div>
          </a>

          <a class="cat" href="#/" data-cat="Celulares y Tablets">
            <div class="cat__label">Tecnología<br>que conecta tu vida</div>
            <div class="cat__img"><img src="${escapeHtml(imgPhone)}" alt="Tecnología" loading="lazy"></div>
          </a>

          <a class="cat cat--home" href="#/" data-cat="Android">
            <div class="cat__label">Tecnología<br>para tu día a día</div>
            <div class="cat__img"><img src="${escapeHtml(imgHome)}" alt="Hogar" loading="lazy"></div>
          </a>

          <a class="cat cat--laptops" href="#/" data-cat="Tablets y iPads">
            <div class="cat__label">Tablets<br>para tu ritmo</div>
            <div class="cat__img"><img src="${escapeHtml(imgTab)}" alt="Tablets" loading="lazy"></div>
          </a>
        </div>
      </section>
    `;
  }

  function tabsBlock(){
    const active = (t)=> (state.tab === t ? "is-active" : "");
    return `
      <section class="section">
        <div class="tabs" role="tablist" aria-label="Secciones">
          <button class="tab ${active("favorites")}" data-tab="favorites">Favoritos CellZoneHN</button>
          <button class="tab ${active("new")}" data-tab="new">Nuevos productos</button>
          <button class="tab ${active("viewed")}" data-tab="viewed">Vistos recientemente</button>
        </div>
      </section>
    `;
  }

  function productCard(p){
    if(!p) return "";
    const img = p.images?.[0] || "";
    const pill = p.badge ? `<span class="pill ${p.badge==='Agotado'?'pill--sold':''}">${escapeHtml(p.badge)}</span>` : "";
    const meta = p.category ? escapeHtml(p.category) : "Producto";
    const fav = isFavorite(p.id);
    return `
      <article class="card" data-go="p/${p.id}" role="button" tabindex="0" aria-label="${escapeHtml(p.name)}">
        <div class="card__media">
          ${pill}
          <img src="${escapeHtml(img)}" alt="${escapeHtml(p.name)}" loading="lazy">
        </div>
        <div class="card__body">
          <div class="card__name">${escapeHtml(p.name)}</div>
          <div class="card__meta">${meta}</div>
          <div class="card__price">${escapeHtml(formatHNL(p.price))}</div>
          <div class="card__row">
            <span class="badge ${fav?'badge--fav':''}" data-action="fav" data-id="${p.id}">
              ${fav ? "Favoritos" : "Guardar"}
            </span>
            <span class="badge">${p.shipping_free ? "Envío gratis" : "Envío disponible"}</span>
          </div>
        </div>
      </article>
    `;
  }

  function home(){
    const heroProduct = PRODUCTS[0];
    updateWhatsAppLink(null);

    const list = getListForHome();
    const gridHtml = list.map(productCard).join("");

    const hint = (state.query || state.category)
      ? `<div class="section__subtitle">Mostrando resultados ${state.category ? `de “${escapeHtml(state.category)}”` : ""} ${state.query ? `para “${escapeHtml(state.query)}”` : ""}. <a href="#/" data-clearfilters="1" style="color:var(--primary);font-weight:900">Limpiar</a></div>`
      : "";

    return `
      ${hero(heroProduct)}
      ${categoriesBlock()}
      ${tabsBlock()}
      ${hint}
      <section class="section">
        <div class="grid">${gridHtml || `<div class="section__subtitle" style="grid-column:1/-1">No se encontraron productos.</div>`}</div>
      </section>

      <section class="section">
        <div class="newsletter">
          <h3>Subscríbete a nuestro boletín</h3>
          <p>Sé el primero en enterarte de las ofertas y descuentos que tenemos para ti.</p>
          <div class="nl__row">
            <input type="email" placeholder="Correo Electrónico" />
            <button type="button" data-action="nl">SUBSCRIBIRME</button>
          </div>
          <small>Nos preocupamos por la protección de tus datos. Lee nuestra <a href="#/">Política de Privacidad</a>.</small>
        </div>
      </section>

      <footer class="footer">
        <div class="footer__grid">
          <div class="footer__box">
            <div class="footer__h">Síguenos</div>
            <div class="social">
              <a href="#/" aria-label="Instagram">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none"><path d="M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5Z" stroke="currentColor" stroke-width="2"/><path d="M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z" stroke="currentColor" stroke-width="2"/><path d="M17.5 6.5h.01" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>
              </a>
              <a href="#/" aria-label="TikTok">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none"><path d="M14 3v11.2a3.8 3.8 0 1 1-3.6-3.8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M14 6c1.2 2.1 2.9 3.2 5 3.2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
              </a>
              <a href="#/" aria-label="Facebook">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none"><path d="M14 9h3V6h-3c-1.7 0-3 1.3-3 3v3H8v3h3v6h3v-6h3l1-3h-4V9c0-.6.4-1 1-1Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>
              </a>
              <a href="#/" aria-label="X">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none"><path d="M4 4l16 16M20 4L4 20" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
              </a>
              <a href="#/" aria-label="YouTube">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none"><path d="M22 12s0-4-1-5-5-1-9-1-8 0-9 1-1 5-1 5 0 4 1 5 5 1 9 1 8 0 9-1 1-5 1-5Z" stroke="currentColor" stroke-width="2"/><path d="M10 9l6 3-6 3V9Z" fill="currentColor"/></svg>
              </a>
            </div>
          </div>

          <div class="footer__box">
            <div class="footer__h">Contáctanos</div>
            <p class="footer__p">Puedes contactarnos para consultas o asesoría escribiéndonos por WhatsApp.</p>
            <a class="footer__link" href="https://api.whatsapp.com/send?text=Hola%20CellZoneHN%2C%20quiero%20informaci%C3%B3n." target="_blank" rel="noopener">WhatsApp</a>
          </div>

          <div class="footer__box">
            <div class="footer__h">Catálogo</div>
            <p class="footer__p">Precios en Lempiras. Fotos reales. Actualización rápida.</p>
            <a class="footer__link" href="#/" data-clearfilters="1">Ver todo</a>
          </div>
        </div>

        <div class="copyright">Derechos Reservados © | CellZoneHN 2026</div>
      </footer>
    `;
  }

  function stars(){
    return "☆☆☆☆☆";
  }

  function pdp(product){
    if(!product) return `
      <div class="section__subtitle">Producto no encontrado. <a href="#/">Volver</a></div>
    `;

    addViewed(product.id);
    const imgs = product.images || [];
    const activeImg = state.pdpImage || imgs[0] || "";
    updateWhatsAppLink(product);

    const fav = isFavorite(product.id);
    const desc = product.description || [];
    const specs = extractSpecs(product.name);

    const includeList = desc.slice(0, 4).map(x => `<li>${escapeHtml(x)}</li>`).join("");
    const moreList = desc.slice(4).map(x => `<li>${escapeHtml(x)}</li>`).join("");

    const tabActive = (t)=> state.pdpTab === t ? "is-active" : "";

    // Blocks content per tab
    let content = "";
    if(state.pdpTab === "specs"){
      content = `
        <div class="specs__block">
          <h3 class="specs__h">Almacenamiento</h3>
          <table class="table">
            <tr><th>Almacenamiento</th><td>${escapeHtml(specs.storage || "No especificado")}</td></tr>
            <tr><th>Memoria externa</th><td>No</td></tr>
          </table>
        </div>

        <div class="specs__block">
          <h3 class="specs__h">Rendimiento</h3>
          <table class="table">
            <tr><th>Memoria RAM</th><td>${escapeHtml(specs.ram || "No especificado")}</td></tr>
            <tr><th>Condición</th><td>${escapeHtml(specs.percent || "No especificado")}</td></tr>
            <tr><th>Categoría</th><td>${escapeHtml((product.categories||[]).join(", ") || "Productos")}</td></tr>
          </table>
        </div>

        <div class="specs__block">
          <h3 class="specs__h">Potencia</h3>
          <table class="table">
            <tr><th>Capacidad de batería</th><td>${escapeHtml(specs.battery || "No especificado")}</td></tr>
            <tr><th>Watts</th><td>${escapeHtml(specs.watts || "No especificado")}</td></tr>
          </table>
        </div>

        <div class="specs__block">
          <h3 class="specs__h">Incluye</h3>
          ${includeList ? `<ul class="gift__list">${includeList}</ul>` : `<div class="section__subtitle" style="text-align:left;margin:0">Sin detalles adicionales.</div>`}
          ${moreList ? `<details style="margin-top:10px"><summary style="cursor:pointer;font-weight:900;color:var(--primary)">Ver más</summary><ul class="gift__list">${moreList}</ul></details>` : ""}
        </div>
      `;
    } else if(state.pdpTab === "shipping"){
      content = `
        <div class="specs__block">
          <h3 class="specs__h">Información de envío</h3>
          <table class="table">
            <tr><th>Envío</th><td>${product.shipping_free ? "Gratis (según publicación)" : "Disponible (cotizar por zona)"}</td></tr>
            <tr><th>Tiempo</th><td>Depende de tu ciudad y disponibilidad</td></tr>
            <tr><th>Empaque</th><td>Protegido y asegurado</td></tr>
          </table>
          <div class="section__subtitle" style="text-align:left;margin-top:10px">
            Para confirmar, abrí WhatsApp y enviá el producto con 1 click.
          </div>
        </div>
      `;
    } else {
      content = `
        <div class="specs__block">
          <h3 class="specs__h">Evaluaciones</h3>
          <div class="section__subtitle" style="text-align:left;margin:0">
            Aún no hay reseñas en el catálogo demo. (Luego podemos conectar un formulario o Google Sheets.)
          </div>
        </div>
      `;
    }

    const thumbs = imgs.map((src, idx) => {
      const isActive = src === activeImg ? "is-active" : "";
      return `
        <button class="thumb ${isActive}" data-action="img" data-src="${escapeHtml(src)}" aria-label="Imagen ${idx+1}">
          <img src="${escapeHtml(src)}" alt="Miniatura ${idx+1}" loading="lazy">
        </button>
      `;
    }).join("");

    return `
      <section class="section pdp">
        <div class="pdp__gallery">
          <div class="pdp__heroimg">
            <img src="${escapeHtml(activeImg)}" alt="${escapeHtml(product.name)}" />
          </div>
          <div class="pdp__thumbs">${thumbs}</div>
        </div>

        <div class="pdp__info">
          <a class="pdp__link" href="#/" data-back="1">Ver más productos</a>

          <h1 class="pdp__title">${escapeHtml(product.name)}</h1>
          <div class="pdp__sku">SKU: ${escapeHtml(product.sku || ("CZH-" + product.id))}</div>
          <div class="pdp__rating" aria-label="Calificación">${stars()}</div>
          <div class="pdp__price">${escapeHtml(formatHNL(product.price))}</div>

          <div class="pdp__actions">
            <button class="squarebtn" data-action="share" aria-label="Compartir">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none"><path d="M14 9l-4 4 4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M10 13h8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
            </button>
            <button class="squarebtn" data-action="fav" data-id="${product.id}" aria-label="Favorito">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none"><path d="M12 21s-7-4.6-9.4-8.1C.8 9.8 2.4 6.5 5.9 5.7c1.6-.4 3.3.1 4.4 1.3 1.1-1.2 2.8-1.7 4.4-1.3 3.5.8 5.1 4.1 3.3 7.2C19 16.4 12 21 12 21z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>
            </button>
            <button class="squarebtn" data-action="whatsapp" aria-label="WhatsApp">
              <img src="images/whatsapp-icon.png" alt="WhatsApp" style="width:18px;height:18px">
            </button>
          </div>

          <div class="gift" style="margin-top:14px">
            <div class="gift__side">REGALO</div>
            <div class="gift__body">
              <div class="gift__h">RECIBE GRATIS</div>
              <div class="gift__p">${escapeHtml(desc[0] || "Bonos y extras según publicación")}</div>
              ${desc.length > 1 ? `<ul class="gift__list">${desc.slice(1,4).map(x=>`<li>${escapeHtml(x)}</li>`).join("")}</ul>` : ""}
            </div>
          </div>

          <div class="addcart">
            <button class="btn btn--primary" data-action="addcart">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
                <path d="M6 6h15l-1.5 9h-12z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
                <path d="M6 6L5 3H2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                <path d="M9 22a1 1 0 1 0 0-2 1 1 0 0 0 0 2ZM18 22a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" stroke="currentColor" stroke-width="2"/>
              </svg>
              AGREGAR A CARRITO
            </button>
          </div>
        </div>
      </section>

      <section class="section">
        <div class="pdpTabs">
          <button class="pdpTab ${tabActive("specs")}" data-pdptab="specs">Características</button>
          <button class="pdpTab ${tabActive("shipping")}" data-pdptab="shipping">Información de envío</button>
          <button class="pdpTab ${tabActive("reviews")}" data-pdptab="reviews">Evaluaciones</button>
        </div>

        <div class="specs">
          ${content}
        </div>
      </section>
    `;
  }

  function render(){
    const route = parseRoute();

    // reset PDP state if leaving
    if(route.name !== "pdp"){
      state.pdpImage = null;
      state.pdpTab = "specs";
    }

    if(route.name === "pdp"){
      const product = getProductById(route.id);
      app.innerHTML = pdp(product);
      return;
    }

    app.innerHTML = home();
  }

  // Delegated events
  document.addEventListener("click", (e)=>{
    const el = e.target.closest("[data-go],[data-tab],[data-action],[data-cat],[data-clearfilters],[data-back],[data-pdptab]");
    if(!el) return;

    if(el.hasAttribute("data-go")){
      const path = el.getAttribute("data-go");
      setHash("/" + path);
      window.scrollTo({top:0, behavior:"instant"});
      return;
    }

    if(el.hasAttribute("data-tab")){
      state.tab = el.getAttribute("data-tab");
      state.query = "";
      state.category = "";
      if(searchInput) searchInput.value = "";
      render();
      return;
    }

    if(el.hasAttribute("data-cat")){
      state.category = el.getAttribute("data-cat") || "";
      state.query = "";
      if(searchInput) searchInput.value = "";
      render();
      window.scrollTo({top:0, behavior:"smooth"});
      return;
    }

    if(el.hasAttribute("data-clearfilters")){
      state.query = "";
      state.category = "";
      if(searchInput) searchInput.value = "";
      render();
      return;
    }

    if(el.hasAttribute("data-back")){
      setHash("/");
      return;
    }

    if(el.hasAttribute("data-pdptab")){
      state.pdpTab = el.getAttribute("data-pdptab");
      render();
      return;
    }

    const action = el.getAttribute("data-action");
    if(action === "fav"){
      const id = el.getAttribute("data-id");
      if(id) toggleFavorite(id);
      else toast("Guardado ✅");
      return;
    }
    if(action === "nl"){
      toast("¡Listo! (Demo) ✅");
      return;
    }
    if(action === "addcart"){
      addCart();
      return;
    }
    if(action === "img"){
      const src = el.getAttribute("data-src");
      state.pdpImage = src || null;
      render();
      return;
    }
    if(action === "whatsapp"){
      waFloat.click();
      return;
    }
    if(action === "share"){
      // share link for current product
      try{
        const route = parseRoute();
        if(route.name === "pdp"){
          const url = location.href;
          navigator.clipboard?.writeText(url);
          toast("Enlace copiado ✅");
        }
      }catch(err){
        toast("No se pudo copiar");
      }
      return;
    }
  });

  // Keyboard support for cards
  document.addEventListener("keydown", (e)=>{
    const card = e.target.closest(".card");
    if(!card) return;
    if(e.key === "Enter" || e.key === " "){
      const go = card.getAttribute("data-go");
      if(go){
        e.preventDefault();
        setHash("/" + go);
      }
    }
  });

  window.addEventListener("hashchange", render);

  // Add toast styles once
  const toastStyle = document.createElement("style");
  toastStyle.textContent = `
    .toast{
      position:fixed;
      left:50%;
      transform:translateX(-50%) translateY(12px);
      bottom:calc(16px + max(env(safe-area-inset-bottom), 10px));
      background:#0f172a;
      color:#fff;
      padding:10px 12px;
      border-radius:999px;
      font-weight:900;
      font-size:13px;
      box-shadow:0 18px 34px rgba(2,6,23,.25);
      opacity:0;
      transition:opacity .22s ease, transform .22s ease;
      z-index:120;
      pointer-events:none;
      white-space:nowrap;
    }
    .toast--show{
      opacity:1;
      transform:translateX(-50%) translateY(0);
    }
  `;
  document.head.appendChild(toastStyle);

  // initial
  render();
})();

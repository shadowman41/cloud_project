const API_BASE = window.location.origin.includes('localhost') || window.location.protocol === 'file:' ? 'http://localhost:3000/api' : '/api';

const AppState = {
  user: null,
  token: localStorage.getItem('emarket_token') || null,
  panierCount: 0
};

const EMarket = {
  async request(endpoint, { method = 'GET', body, headers = {}, auth = true } = {}) {
    const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;
    const opts = {
      method,
      headers: { 'Content-Type': 'application/json', ...headers }
    };
    if (auth && AppState.token) opts.headers.Authorization = `Bearer ${AppState.token}`;
    if (body) opts.body = JSON.stringify(body);

    try {
      const res = await fetch(url, opts);
      const ct  = res.headers.get('content-type') || '';
      const data = ct.includes('application/json') ? await res.json() : await res.text();
      if (!res.ok) {
        throw new Error(data?.message || data || `Erreur HTTP ${res.status}`);
      }
      return data;
    } catch (err) {
      if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
        this.toast('Impossible de contacter le serveur', 'error');
      }
      throw err;
    }
  },

  toast(message, type = 'info', duration = 3000) {
    let el = document.getElementById('toast-notif');
    if (!el) {
      el = document.createElement('div');
      el.id = 'toast-notif';
      el.className = 'toast';
      document.body.appendChild(el);
    }
    el.className = `toast ${type}`;
    el.innerHTML = `<span>${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}</span><span>${message}</span>`;
    requestAnimationFrame(() => el.classList.add('show'));
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove('show'), duration);
  },

  fmtFCFA(n) {
    return new Intl.NumberFormat('fr-SN').format(Number(n) || 0) + ' FCFA';
  },

  fmtStars(note) {
    const n = Number(note) || 0;
    const full  = Math.floor(n);
    const half  = n - full >= 0.5 ? 1 : 0;
    const empty = 5 - full - half;
    return '⭐'.repeat(full) + (half ? '½' : '') + '☆'.repeat(empty);
  },

  setUser(user, token) {
    AppState.user = user;
    AppState.token = token;
    if (token) localStorage.setItem('emarket_token', token);
    if (user)  localStorage.setItem('emarket_user', JSON.stringify(user));
    this.renderUserNav();
  },

  logout() {
    AppState.user = null;
    AppState.token = null;
    localStorage.removeItem('emarket_token');
    localStorage.removeItem('emarket_user');
    this.renderUserNav();
    this.toast('Vous êtes déconnecté', 'info');
    setTimeout(() => { if (window.location.pathname.includes('compte')) window.location.href = 'index.html'; }, 600);
  },

  restoreAuth() {
    if (!AppState.token) {
      AppState.token = localStorage.getItem('emarket_token');
    }
    const u = localStorage.getItem('emarket_user');
    if (u) { try { AppState.user = JSON.parse(u); } catch(_){} }
  },

  renderUserNav() {
    const actions = document.getElementById('navActions');
    if (!actions) return;
    if (AppState.user) {
      const initial = (AppState.user.prenom?.[0] || AppState.user.nom?.[0] || 'U').toUpperCase();
      const nom = [AppState.user.prenom, AppState.user.nom].filter(Boolean).join(' ') || AppState.user.email;
      actions.innerHTML = `
        <div id="userMenu">
          <a style="gap:8px;">
            <span class="avatar-mini">${initial}</span>
            ${nom.split(' ')[0]}
          </a>
          <div id="userDropdown">
            ${AppState.user.role === 'admin' ? '<a href="admin.html">🎛️ Dashboard admin</a>' : ''}
            <a href="commandes.html">📦 Mes commandes</a>
            <a href="favoris.html">❤️ Mes favoris</a>
            <a href="profil.html">👤 Mon profil</a>
            <div class="separator"></div>
            <a href="#" id="logoutBtn" style="color:#c0392b;">🚪 Se déconnecter</a>
          </div>
        </div>
        <a href="panier.html">🛒 Panier <span class="cart-count" id="cartCount">0</span></a>
      `;
      document.getElementById('logoutBtn')?.addEventListener('click', (e) => { e.preventDefault(); this.logout(); });
    } else {
      actions.innerHTML = `
        <a href="connexion.html">👤 Se connecter</a>
        <a href="panier.html">🛒 Panier <span class="cart-count" id="cartCount">0</span></a>
      `;
    }
    this.refreshPanierCount();
  },

  async refreshPanierCount() {
    const el = document.getElementById('cartCount');
    if (!el) return;
    try {
      if (AppState.token && AppState.user) {
        const panier = await this.request('/panier');
        AppState.panierCount = panier.nb_articles || 0;
      } else {
        const local = JSON.parse(localStorage.getItem('emarket_panier_local') || '[]');
        AppState.panierCount = local.reduce((s, i) => s + i.quantite, 0);
      }
      el.textContent = AppState.panierCount;
    } catch (_) {}
  },

  async addToCart(produit_id, quantite = 1) {
    try {
      if (AppState.token && AppState.user) {
        const r = await this.request('/panier/ajouter', { method: 'POST', body: { produit_id, quantite } });
        AppState.panierCount = r.panier?.nb_articles || AppState.panierCount + quantite;
      } else {
        let local = JSON.parse(localStorage.getItem('emarket_panier_local') || '[]');
        const exist = local.find(i => i.produit_id === produit_id);
        if (exist) exist.quantite += quantite;
        else local.push({ produit_id, quantite });
        localStorage.setItem('emarket_panier_local', JSON.stringify(local));
        AppState.panierCount = local.reduce((s, i) => s + i.quantite, 0);
      }
      const cc = document.getElementById('cartCount');
      if (cc) cc.textContent = AppState.panierCount;
      this.toast('Ajouté au panier !', 'success');
      return true;
    } catch (err) {
      this.toast(err.message || 'Erreur ajout panier', 'error');
      return false;
    }
  },

  async toggleFavori(produit_id) {
    if (!AppState.user) {
      this.toast('Connectez-vous pour utiliser les favoris', 'info');
      setTimeout(() => window.location.href = 'connexion.html', 800);
      return false;
    }
    try {
      const r = await this.request(`/produits/${produit_id}/favori`, { method: 'POST' });
      return r.estFavori;
    } catch (err) {
      this.toast(err.message, 'error');
      return null;
    }
  },

  productCard(p, opts = {}) {
    const prix = p.prix_promo || p.prix;
    const remise = p.prix_promo ? Math.round((1 - p.prix_promo / p.prix) * 100) : 0;
    const badges = [
      p.est_promo && remise > 0 ? `<span class="badge badge-promo">-${remise}%</span>` : '',
      p.est_nouveau ? `<span class="badge badge-new">Nouveau</span>` : ''
    ].join('');
    const img = p.image_principale ? (p.image_principale.startsWith('http') ? p.image_principale : `images/${p.image_principale.split('/').pop()}`) : 'images/Electro.webp';
    const href = `produit.html?slug=${p.slug}`;
    const initiales = p.nom_boutique?.split(' ').map(s => s[0]).slice(0,2).join('') || '';
    return `
      <div class="product-card" data-id="${p.id}">
        <div class="product-image">
          ${badges}
          <button class="wishlist-btn" data-id="${p.id}" title="Ajouter aux favoris">🤍</button>
          <a href="${href}"><img src="${img}" alt="${p.nom}" onerror="this.src='images/Electro.webp'"></a>
        </div>
        <div class="product-info">
          <div class="seller-tag"><span class="verified">${p.est_verifie ? '✓' : '○'}</span> ${p.nom_boutique || 'Vendeur'}</div>
          <a href="${href}"><h3>${p.nom}</h3></a>
          <div class="stars">${this.fmtStars(p.note_moyenne)} <span class="count">(${p.nb_avis || 0} avis)</span></div>
          <div class="price">${this.fmtFCFA(prix)} ${p.prix_promo ? `<span class="price-old">${this.fmtFCFA(p.prix)}</span>` : ''}</div>
          <button class="btn add-cart-btn" data-id="${p.id}">Ajouter au panier</button>
        </div>
      </div>
    `;
  },

  attachProductEvents(scope = document) {
    scope.querySelectorAll('.add-cart-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = parseInt(btn.dataset.id);
        const ok = await this.addToCart(id, 1);
        if (ok) {
          const orig = btn.textContent;
          btn.textContent = '✓ Ajouté !';
          btn.classList.add('added');
          setTimeout(() => { btn.textContent = orig; btn.classList.remove('added'); }, 1500);
        }
      });
    });
    scope.querySelectorAll('.wishlist-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault(); e.stopPropagation();
        const id = parseInt(btn.dataset.id);
        const fav = await this.toggleFavori(id);
        if (fav !== null) btn.textContent = fav ? '❤️' : '🤍';
      });
    });
  },

  async loadCategories(containerId, { withCount = true } = {}) {
    try {
      const cats = await this.request('/categories', { auth: false });
      const box = document.getElementById(containerId);
      if (box) {
        box.innerHTML = cats.map(c => `
          <li><a href="e-market_homepage.html?categorie=${c.slug}">${c.icone || '📦'} ${c.nom}</a></li>
        `).join('');
      }
    } catch (_) {}
  },

  async loadProduits(params = {}, containerId, paginationId = null) {
    const box = document.getElementById(containerId);
    if (!box) return;
    box.innerHTML = `<div class="loading-wrap"><div class="loader loader-lg"></div><p style="margin-top:10px;color:#666;">Chargement des produits…</p></div>`;
    try {
      const qs = new URLSearchParams(params).toString();
      const data = await this.request(`/produits${qs ? '?' + qs : ''}`, { auth: false });
      if (!data.produits?.length) {
        box.innerHTML = `<div class="empty-state"><div class="icon">📦</div><h3>Aucun produit trouvé</h3><p>Essayez d'autres critères de recherche</p></div>`;
        return;
      }
      box.innerHTML = data.produits.map(p => this.productCard(p)).join('');
      this.attachProductEvents(box);
      if (paginationId && data.pagination) this.renderPagination(paginationId, data.pagination, params);
    } catch (err) {
      box.innerHTML = `<div class="empty-state"><div class="icon">⚠️</div><h3>Erreur chargement</h3><p>${err.message}</p></div>`;
    }
  },

  renderPagination(id, pg, baseParams) {
    const el = document.getElementById(id);
    if (!el || pg.pages <= 1) { if (el) el.innerHTML = ''; return; }
    const { page, pages } = pg;
    const prev = `<button class="prev-next" ${page <= 1 ? 'disabled' : ''} data-page="${page - 1}">← Précédent</button>`;
    const next = `<button class="prev-next" ${page >= pages ? 'disabled' : ''} data-page="${page + 1}">Suivant →</button>`;
    const btns = [];
    for (let i = 1; i <= pages; i++) {
      if (i === 1 || i === pages || (i >= page - 1 && i <= page + 1)) btns.push(i);
      else if (btns[btns.length - 1] !== '…') btns.push('…');
    }
    el.innerHTML = prev + btns.map(p => p === '…'
      ? `<button disabled style="border:none;">…</button>`
      : `<button class="${p === page ? 'active' : ''}" data-page="${p}">${p}</button>`
    ).join('') + next;
    el.querySelectorAll('button[data-page]').forEach(b => {
      b.addEventListener('click', () => {
        const np = parseInt(b.dataset.page);
        const params = { ...baseParams, page: np };
        const qs = new URLSearchParams(params).toString();
        if (window.location.search) {
          const u = new URL(window.location);
          u.searchParams.set('page', np);
          window.location.search = u.searchParams.toString();
        } else {
          this.loadProduits(params, el.dataset.container || 'productsGrid', id);
        }
      });
    });
  },

  qs(name) {
    return new URLSearchParams(window.location.search).get(name);
  },

  init() {
    this.restoreAuth();
    this.renderUserNav();
    document.querySelectorAll('.filter-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const grp = chip.dataset?.group || chip.parentElement;
        document.querySelectorAll(chip.parentElement ? `.filters-bar .filter-chip` : '.filter-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
      });
    });
    document.querySelectorAll('.subcat-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        e.preventDefault();
        document.querySelectorAll('.subcat-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });
    const srch = document.getElementById('searchInput');
    const srchBtn = document.getElementById('searchBtn');
    if (srch && srchBtn) {
      const doSearch = () => {
        const q = srch.value.trim();
        if (!q) return;
        window.location.href = `e-market_homepage.html?recherche=${encodeURIComponent(q)}`;
      };
      srchBtn.addEventListener('click', doSearch);
      srch.addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(); });
    }
  }
};

document.addEventListener('DOMContentLoaded', () => EMarket.init());
window.EMarket = EMarket;

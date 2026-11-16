/* Standalone storefront interactions. No store API or account service is used. */
(() => {
  'use strict';
  const $ = (selector, parent = document) => parent.querySelector(selector);
  const $$ = (selector, parent = document) => [...parent.querySelectorAll(selector)];
  const money = value => Number(value).toLocaleString('en-US') + '₫';
  const normalize = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').toLowerCase();
  const products = new Map();
  $$('.product-block').forEach(card => {
    const link = $('.pro-name a', card);
    if (!link) return;
    const key = new URL(link.href).pathname;
    card.dataset.productKey = key;
    if (!products.has(key)) products.set(key, {
      key, name: link.textContent.trim(), price: Number(card.dataset.ga4ItemPrice || $('.pro-price > span', card)?.textContent.replace(/\D/g, '') || 0),
      image: $('img.img-first', card)?.getAttribute('src'), status: $('.product-tagloop', card)?.textContent.trim() || '', card
    });
  });
  let cart = {};
  let favorites = [];
  try {
    cart = JSON.parse(localStorage.getItem('jh-clone-cart')) || {};
    favorites = JSON.parse(localStorage.getItem('jh-clone-favorites')) || [];
  } catch { /* Storage may be unavailable when opened directly from disk. */ }
  cart = Object.fromEntries(Object.entries(cart).filter(([key, qty]) => products.has(key) && Number.isInteger(qty) && qty > 0));
  favorites = Array.isArray(favorites) ? favorites.filter(key => products.has(key)) : [];
  function persist() {
    try { localStorage.setItem('jh-clone-cart', JSON.stringify(cart)); localStorage.setItem('jh-clone-favorites', JSON.stringify(favorites)); } catch {}
    const count = Object.values(cart).reduce((a, b) => a + b, 0);
    $$('.js-number-cart').forEach(node => node.textContent = count);
  }
  persist();
  const dialog = document.createElement('dialog');
  dialog.className = 'local-modal';
  dialog.setAttribute('aria-label', 'Thông tin sản phẩm');
  document.body.append(dialog);
  function close() { dialog.close(); }
  function modal(content, className = '') {
    dialog.className = 'local-modal ' + className;
    dialog.replaceChildren();
    const button = document.createElement('button');
    button.className = 'local-close'; button.textContent = '×'; button.setAttribute('aria-label', 'Đóng'); button.onclick = close;
    dialog.append(button, content);
    if (!dialog.open) dialog.showModal();
  }
  dialog.addEventListener('click', event => { if (event.target === dialog) { const r = dialog.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) close(); } });
  function element(tag, text, className) { const node = document.createElement(tag); if (text) node.textContent = text; if (className) node.className = className; return node; }
  let toastTimer;
  function toast(message) {
    $('.local-toast')?.remove(); clearTimeout(toastTimer);
    const node = element('div', message, 'local-toast'); node.setAttribute('role', 'status'); document.body.append(node);
    toastTimer = setTimeout(() => node.remove(), 3000);
  }
  function showProduct(product) {
    const content = element('div', '', 'local-product');
    const image = element('img'); image.src = product.image; image.alt = product.name;
    const details = element('div');
    details.append(element('p', product.status), element('h2', product.name), element('div', money(product.price), 'local-price'));
    const quantity = element('label', 'Số lượng', 'local-quantity');
    const input = element('input'); input.type = 'number'; input.min = '1'; input.max = '99'; input.value = '1'; quantity.append(input);
    const add = element('button', 'Thêm vào giỏ hàng', 'local-primary');
    add.onclick = () => {
      const qty = Math.max(1, Math.min(99, parseInt(input.value, 10) || 1));
      cart[product.key] = (cart[product.key] || 0) + qty; persist(); toast('Đã thêm sản phẩm vào giỏ hàng');
    };
    const favorite = element('button', favorites.includes(product.key) ? '♥ Đã yêu thích' : '♡ Yêu thích');
    favorite.style.cssText = 'border:1px solid #ddd;background:white;padding:10px;margin-top:14px;display:block;border-radius:4px';
    favorite.onclick = () => { favorites = favorites.includes(product.key) ? favorites.filter(key => key !== product.key) : [...favorites, product.key]; persist(); favorite.textContent = favorites.includes(product.key) ? '♥ Đã yêu thích' : '♡ Yêu thích'; };
    details.append(quantity, add, favorite); content.append(image, details); modal(content);
  }
  function showCart() {
    const content = element('div'); content.append(element('h2', 'Giỏ hàng'));
    const entries = Object.entries(cart);
    if (!entries.length) content.append(element('p', 'Giỏ hàng của bạn chưa có sản phẩm.'));
    let total = 0;
    entries.forEach(([key, qty]) => {
      const product = products.get(key); total += product.price * qty;
      const row = element('div', '', 'local-cart-row');
      const image = element('img'); image.src = product.image; image.alt = product.name;
      const details = element('div'); details.append(element('p', product.name));
      const minus = element('button', '−'); minus.setAttribute('aria-label', 'Giảm số lượng');
      const plus = element('button', '+'); plus.setAttribute('aria-label', 'Tăng số lượng');
      const remove = element('button', 'Xóa');
      minus.onclick = () => { if (--cart[key] < 1) delete cart[key]; persist(); showCart(); };
      plus.onclick = () => { cart[key]++; persist(); showCart(); };
      remove.onclick = () => { delete cart[key]; persist(); showCart(); };
      details.append(minus, element('span', String(qty)), plus, remove);
      row.append(image, details, element('strong', money(product.price * qty))); content.append(row);
    });
    content.append(element('div', 'Tổng tiền: ' + money(total), 'local-cart-total'));
    if (entries.length) content.append(element('p', 'Giỏ hàng được lưu trên trình duyệt. Bản sao này không nhận đơn hàng hoặc thanh toán.'));
    modal(content);
  }
  function showResults(title, matches) {
    const content = element('div'); content.append(element('h2', title), element('p', `${matches.length} sản phẩm`));
    const grid = element('div', '', 'local-results');
    matches.forEach(product => { const card = product.card.cloneNode(true); grid.append(card); });
    if (!matches.length) content.append(element('p', 'Không tìm thấy sản phẩm. Hãy thử từ khóa khác.'));
    content.append(grid); modal(content);
  }
  document.addEventListener('click', event => {
    const card = event.target.closest('.product-block');
    if (card && event.target.closest('a, .btn-quickview')) { event.preventDefault(); showProduct(products.get(card.dataset.productKey)); return; }
    const link = event.target.closest('a');
    if (!link) return;
    const url = new URL(link.href);
    if (url.hostname !== 'jhfigure.com') return;
    if (/^\/(cart|checkout)/.test(url.pathname)) { event.preventDefault(); showCart(); }
    else if (url.search.includes('watchlist')) { event.preventDefault(); showResults('Sản phẩm yêu thích', favorites.map(key => products.get(key))); }
    else if (url.pathname.startsWith('/collections/')) {
      event.preventDefault();
      const label = (link.title || link.textContent).trim() || 'Tất cả sản phẩm';
      const slug = url.pathname.split('/').pop();
      const all = [...products.values()];
      let matches = all;
      if (/in-stock|best-sellers/.test(slug)) matches = all.filter(p => /In Stock/.test(p.status));
      else if (/order|phat-hanh/.test(slug)) matches = all.filter(p => /Pre-order/.test(p.status));
      else if (!/all|pvc-figure|san-pham-noi-bat/.test(slug)) {
        const query = normalize(slug.replaceAll('-', ' '));
        matches = all.filter(p => normalize(p.name).includes(query) || normalize(p.card.dataset.ga4ItemBrand || '').includes(query));
      }
      showResults(label, matches);
    }
  });
  $$('.wanda-mxm-search').forEach(form => form.addEventListener('submit', event => {
    event.preventDefault(); const query = $('[name="q"]', form).value.trim();
    showResults(query ? `Kết quả tìm kiếm: ${query}` : 'Tất cả sản phẩm', [...products.values()].filter(p => normalize(p.name).includes(normalize(query))));
  }));
  $$('.header-cart button.group-icon-item').forEach(button => button.onclick = showCart);
  $$('.header-account button.group-icon-item').forEach(button => button.onclick = () => {
    const panel = $('#header-account-panel'); const open = panel.classList.toggle('local-open'); button.setAttribute('aria-expanded', String(open));
  });
  document.addEventListener('click', event => { if (!event.target.closest('.header-account')) { $('#header-account-panel')?.classList.remove('local-open'); $('.header-account button')?.setAttribute('aria-expanded', 'false'); } });
  $$('.site_account_container form, .site_account_inner form').forEach(form => form.addEventListener('submit', event => { event.preventDefault(); toast('Đăng nhập và khôi phục tài khoản chỉ có trên website gốc.'); }));
  $$('.social-login-new button').forEach(button => button.onclick = () => toast('Đăng nhập mạng xã hội chỉ có trên website gốc.'));
  $$('.js-link[aria-controls]').forEach(button => button.onclick = () => {
    const recovery = button.getAttribute('aria-controls') === 'header-recovery-toggle';
    $('#header-login-toggle').style.display = recovery ? 'none' : 'block';
    $('#header-recovery-toggle').style.cssText = recovery ? 'display:block;transform:none;visibility:visible;position:static;opacity:1' : 'display:none';
  });
  // Hero slideshow, with manual navigation and reduced-motion support.
  const hero = $('#slick-slider-home'); const slides = $$('.item', hero); let active = 0;
  const dots = element('div', '', 'local-dots');
  function selectSlide(index) { active = index; slides.forEach((slide, i) => slide.classList.toggle('local-active', i === active)); $$('button', dots).forEach((button, i) => button.setAttribute('aria-current', String(i === active))); }
  slides.forEach((_, i) => { const button = element('button'); button.setAttribute('aria-label', `Banner ${i + 1}`); button.onclick = () => selectSlide(i); dots.append(button); });
  hero.append(dots); selectSlide(0);
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) setInterval(() => { if (!document.hidden && !hero.matches(':hover') && !hero.contains(document.activeElement)) selectSlide((active + 1) % slides.length); }, 6000);
  $$('.slick-callback').filter(node => node !== hero).forEach(track => {
    const columns = track.dataset.slidesMd || '5'; track.classList.add('local-track'); track.style.setProperty('--columns', columns);
    const nav = element('div', '', 'local-carousel-nav');
    for (const [label, direction] of [['‹', -1], ['›', 1]]) { const button = element('button', label); button.setAttribute('aria-label', direction < 0 ? 'Sản phẩm trước' : 'Sản phẩm tiếp theo'); button.onclick = () => track.scrollBy({ left: direction * track.clientWidth, behavior: 'smooth' }); nav.append(button); }
    track.after(nav);
  });
  // Reuse the reference category tree in desktop and mobile menus.
  const menu = $('.nav-category-group');
  const desktopMenu = menu.cloneNode(true); desktopMenu.hidden = false; $('.group-fixed-nav')?.append(desktopMenu);
  const menuButton = $('.navigation-category .head-title');
  menuButton?.setAttribute('role', 'button'); menuButton?.setAttribute('tabindex', '0'); menuButton?.setAttribute('aria-expanded', 'false');
  function toggleMenu() { const open = $('.group-fixed-nav').classList.toggle('local-open'); menuButton.setAttribute('aria-expanded', String(open)); }
  if (menuButton) { menuButton.onclick = toggleMenu; menuButton.onkeydown = event => { if (['Enter', ' '].includes(event.key)) { event.preventDefault(); toggleMenu(); } }; }
  document.addEventListener('click', event => { if (!event.target.closest('.navigation-category')) { $('.group-fixed-nav')?.classList.remove('local-open'); menuButton?.setAttribute('aria-expanded', 'false'); } });
  $('.navigation-event button')?.addEventListener('click', () => { const content = element('div'); content.append(element('h2', 'Danh mục sản phẩm'), $('nav', menu).cloneNode(true)); modal(content, 'local-menu-dialog'); });
  $('#jhContactToggle')?.addEventListener('click', () => { const sheet = $('#jhContactSheet'); sheet.hidden = !sheet.hidden; $('#jhContactToggle').setAttribute('aria-expanded', String(!sheet.hidden)); });
  $('.back-to-top')?.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  const video = $('.jh-home-youtube__player');
  if (video) {
    const link = element('a', '', 'local-video'); link.href = 'https://www.youtube.com/@jhfigure'; link.target = '_blank'; link.rel = 'noopener noreferrer';
    const poster = element('img'); poster.src = [...products.values()].find(p => /Cosmic/.test(p.name))?.image || products.values().next().value.image; poster.alt = 'JH Figure — Figure chính hãng Nhật Bản';
    const caption = element('span', 'Khám phá thế giới figure cùng JH Figure'); caption.prepend(element('b', '▶'));
    link.append(poster, caption); video.replaceChildren(link);
  }
})();

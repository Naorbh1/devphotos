/* =========================================================================
   Convert — theme runtime
   Vanilla JS, no dependencies. Everything is progressive: if JS fails the
   forms still POST to Shopify normally and links still navigate.
   ========================================================================= */

(function () {
  'use strict';

  const settings = (window.theme && window.theme.settings) || {};
  const routes = (window.theme && window.theme.routes) || {};
  const strings = (window.theme && window.theme.strings) || {};

  /* ---------------------------------------------------------------- utils */

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  function formatMoney(cents) {
    const format = settings.moneyFormat || '${{amount}}';
    const value = (cents / 100).toFixed(2);
    const parts = value.split('.');
    const withCommas = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');

    return format
      .replace(/\{\{\s*amount\s*\}\}/, withCommas + '.' + parts[1])
      .replace(/\{\{\s*amount_no_decimals\s*\}\}/, withCommas)
      .replace(/\{\{\s*amount_with_comma_separator\s*\}\}/, parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + parts[1])
      .replace(/\{\{\s*amount_no_decimals_with_comma_separator\s*\}\}/, parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.'));
  }

  function toast(message, isError) {
    const root = $('#ToastRoot');
    if (!root) return;

    const el = document.createElement('div');
    el.className = 'toast' + (isError ? ' toast--error' : '');
    el.textContent = message;
    root.appendChild(el);
    setTimeout(() => el.remove(), 3200);
  }

  function trapFocus(container) {
    const focusable = $$(
      'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])',
      container
    );
    if (!focusable.length) return () => {};

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    function onKeydown(event) {
      if (event.key !== 'Tab') return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    container.addEventListener('keydown', onKeydown);
    first.focus();
    return () => container.removeEventListener('keydown', onKeydown);
  }

  /* ------------------------------------------------------------- cart api */

  const Cart = {
    state: null,
    listeners: [],

    subscribe(fn) {
      this.listeners.push(fn);
    },

    publish() {
      this.listeners.forEach((fn) => fn(this.state));
      document.dispatchEvent(new CustomEvent('cart:updated', { detail: this.state }));
    },

    async fetch() {
      const response = await fetch(routes.cart_url + '.js', { headers: { Accept: 'application/json' } });
      this.state = await response.json();
      this.publish();
      return this.state;
    },

    async add(items) {
      const response = await fetch(routes.cart_add_url + '.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ items: Array.isArray(items) ? items : [items] })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.description || data.message || strings.cartError);

      await this.fetch();
      return data;
    },

    async change(payload) {
      const response = await fetch(routes.cart_change_url + '.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.description || data.message || strings.cartError);

      this.state = data;
      this.publish();
      return data;
    }
  };

  window.themeCart = Cart;

  /* ------------------------------------------------------- drawer / modal */

  class Dialog {
    constructor(element) {
      this.element = element;
      this.overlay = element.dataset.overlay ? $('#' + element.dataset.overlay) : null;
      this.releaseFocus = null;
      this.lastFocused = null;

      $$('[data-close]', element).forEach((btn) => btn.addEventListener('click', () => this.close()));
      if (this.overlay) this.overlay.addEventListener('click', () => this.close());

      document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && this.isOpen) this.close();
      });
    }

    get isOpen() {
      return this.element.classList.contains('is-open');
    }

    open() {
      this.lastFocused = document.activeElement;
      this.element.classList.add('is-open');
      this.element.setAttribute('aria-hidden', 'false');
      if (this.overlay) this.overlay.classList.add('is-open');
      document.body.classList.add('no-scroll');
      this.releaseFocus = trapFocus(this.element);
    }

    close() {
      this.element.classList.remove('is-open');
      this.element.setAttribute('aria-hidden', 'true');
      if (this.overlay) this.overlay.classList.remove('is-open');
      document.body.classList.remove('no-scroll');
      if (this.releaseFocus) this.releaseFocus();
      if (this.lastFocused) this.lastFocused.focus();
    }

    toggle() {
      this.isOpen ? this.close() : this.open();
    }
  }

  const dialogs = {};

  function initDialogs() {
    $$('[data-dialog]').forEach((el) => {
      dialogs[el.dataset.dialog] = new Dialog(el);
    });

    document.addEventListener('click', (event) => {
      const trigger = event.target.closest('[data-dialog-open]');
      if (!trigger) return;
      const dialog = dialogs[trigger.dataset.dialogOpen];
      if (!dialog) return;
      event.preventDefault();
      dialog.open();
    });
  }

  window.themeDialogs = dialogs;

  /* --------------------------------------------------------- cart drawer */

  function renderCartDrawer(cart) {
    // Refresh the drawer markup from the section so pricing, discounts and
    // line item properties always match what Shopify actually computed.
    fetch(routes.cart_url + '?section_id=cart-drawer')
      .then((response) => response.text())
      .then((html) => {
        const parsed = new DOMParser().parseFromString(html, 'text/html');
        const fresh = $('[data-cart-drawer-body]', parsed);
        const current = $('[data-cart-drawer-body]');
        if (fresh && current) current.innerHTML = fresh.innerHTML;

        const freshFooter = $('[data-cart-drawer-footer]', parsed);
        const currentFooter = $('[data-cart-drawer-footer]');
        if (freshFooter && currentFooter) currentFooter.innerHTML = freshFooter.innerHTML;
      })
      .catch(() => {});

    updateCartCount(cart);
    updateShippingBars(cart);
  }

  function updateCartCount(cart) {
    $$('[data-cart-count]').forEach((el) => {
      el.textContent = cart.item_count;
      el.hidden = cart.item_count === 0;
    });
  }

  function updateShippingBars(cart) {
    const threshold = settings.freeShippingThreshold;
    if (!threshold) return;

    $$('[data-shipping-bar]').forEach((bar) => {
      const remaining = Math.max(threshold - cart.total_price, 0);
      const percent = Math.min((cart.total_price / threshold) * 100, 100);

      const fill = $('[data-shipping-fill]', bar);
      if (fill) fill.style.width = percent + '%';

      const message = $('[data-shipping-message]', bar);
      if (!message) return;

      if (remaining === 0) {
        message.innerHTML = message.dataset.unlocked || '';
      } else {
        message.innerHTML = (message.dataset.remaining || '').replace('[amount]', '<strong>' + formatMoney(remaining) + '</strong>');
      }
    });
  }

  /* ------------------------------------------------------------ quick add */

  function resolveQuickAddVariant(root) {
    if (!root) return null;

    const json = $('[data-quick-add-variants]', root);
    if (!json) return null;

    let variants;
    try {
      variants = JSON.parse(json.textContent);
    } catch (e) {
      return null;
    }

    const chosen = $$('[data-quick-add-option]:checked', root)
      .sort((a, b) => Number(a.dataset.quickAddOption) - Number(b.dataset.quickAddOption))
      .map((input) => input.value);

    const match = variants.find((variant) => variant.options.every((option, index) => option === chosen[index]));

    return match && match.available ? String(match.id) : null;
  }

  function initQuickAdd() {
    document.addEventListener('click', async (event) => {
      const button = event.target.closest('[data-quick-add]');
      if (!button) return;

      event.preventDefault();

      const root = button.closest('[data-quick-add-root]');

      // Products with several variants open their picker instead of adding
      // a variant the shopper never chose.
      if (button.dataset.quickAddMode === 'options') {
        const panel = $('.quick-add__options', root);
        if (panel) {
          const isOpen = panel.classList.toggle('is-open');
          button.setAttribute('aria-expanded', String(isOpen));
        }
        return;
      }

      let variantId = button.dataset.variantId;

      if (button.dataset.quickAddMode === 'submit') {
        variantId = resolveQuickAddVariant(root);
        if (!variantId) {
          toast(strings.unavailable || 'Unavailable', true);
          return;
        }
      }

      if (!variantId) return;

      button.dataset.loading = 'true';
      button.setAttribute('aria-disabled', 'true');

      try {
        await Cart.add({ id: Number(variantId), quantity: 1 });
        toast(strings.added || 'Added');

        const panel = root && $('.quick-add__options', root);
        if (panel) panel.classList.remove('is-open');

        if (settings.cartType === 'drawer' && dialogs.cart) dialogs.cart.open();
      } catch (error) {
        toast(error.message, true);
      } finally {
        button.dataset.loading = 'false';
        button.removeAttribute('aria-disabled');
      }
    });
  }

  /* --------------------------------------------------------- product form */

  function initProductForms() {
    document.addEventListener('submit', async (event) => {
      const form = event.target.closest('[data-product-form]');
      if (!form) return;
      if (settings.cartType !== 'drawer') return; // let it POST normally to /cart

      event.preventDefault();

      const button = $('[data-add-button]', form);
      const originalLabel = button ? button.textContent : '';
      if (button) {
        button.setAttribute('aria-disabled', 'true');
        button.textContent = '…';
      }

      try {
        const formData = new FormData(form);
        const response = await fetch(routes.cart_add_url + '.js', {
          method: 'POST',
          headers: { Accept: 'application/json' },
          body: formData
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.description || data.message || strings.cartError);

        await Cart.fetch();
        if (dialogs.cart) dialogs.cart.open();
      } catch (error) {
        toast(error.message, true);
      } finally {
        if (button) {
          button.removeAttribute('aria-disabled');
          button.textContent = originalLabel;
        }
      }
    });
  }

  /* ------------------------------------------------------- variant picker */

  class VariantPicker {
    constructor(root) {
      this.root = root;
      this.productHandle = root.dataset.productHandle;
      this.variants = JSON.parse($('[data-variant-json]', root).textContent);
      this.root.addEventListener('change', () => this.onChange());
      this.onChange(true);
    }

    get selectedOptions() {
      return $$('input:checked, select', this.root)
        .filter((input) => input.name && input.name.startsWith('option'))
        .map((input) => input.value);
    }

    findVariant() {
      const selected = this.selectedOptions;
      return this.variants.find((variant) =>
        variant.options.every((option, index) => option === selected[index])
      );
    }

    onChange(isInitial) {
      const variant = this.findVariant();
      this.updateAvailability(variant);

      if (!variant) {
        this.setButton(false, strings.unavailable);
        return;
      }

      this.setButton(variant.available, variant.available ? strings.addToCart : strings.soldOut);
      this.updatePrice(variant);
      this.updateMedia(variant);
      this.updateStock(variant);

      const idInput = $('[data-variant-id]', document);
      if (idInput) idInput.value = variant.id;

      $$('[data-sticky-variant-id]').forEach((el) => (el.value = variant.id));

      if (!isInitial && history.replaceState) {
        const url = new URL(window.location.href);
        url.searchParams.set('variant', variant.id);
        history.replaceState({}, '', url.toString());
      }

      document.dispatchEvent(new CustomEvent('variant:changed', { detail: { variant } }));
    }

    updateAvailability(current) {
      // Grey out option values that produce no purchasable combination.
      const groups = $$('.variant-option', this.root);
      groups.forEach((group, groupIndex) => {
        $$('input', group).forEach((input) => {
          const candidate = this.selectedOptions.slice();
          candidate[groupIndex] = input.value;
          const match = this.variants.find((variant) =>
            variant.options.every((option, index) => option === candidate[index])
          );
          input.disabled = !match || !match.available;
        });
      });

      $$('.variant-option__label span', this.root).forEach((label, index) => {
        const group = groups[index];
        const checked = group && $('input:checked', group);
        if (checked) label.textContent = checked.value;
      });

      void current;
    }

    setButton(available, label) {
      $$('[data-add-button]').forEach((button) => {
        button.disabled = !available;
        button.textContent = label;
      });
    }

    updatePrice(variant) {
      const container = $('[data-price-target]');
      if (!container) return;

      const onSale = variant.compare_at_price && variant.compare_at_price > variant.price;
      container.classList.toggle('price--on-sale', Boolean(onSale));

      const current = $('[data-price-current]', container);
      if (current) current.textContent = formatMoney(variant.price);

      const compare = $('[data-price-compare]', container);
      if (compare) {
        compare.textContent = onSale ? formatMoney(variant.compare_at_price) : '';
        compare.hidden = !onSale;
      }
    }

    updateMedia(variant) {
      if (!variant.featured_media) return;
      const thumb = $('[data-media-id="' + variant.featured_media.id + '"]');
      if (thumb) thumb.click();
    }

    updateStock(variant) {
      const el = $('[data-stock-counter]');
      if (!el) return;

      const threshold = Number(el.dataset.threshold || 10);
      const quantity = variant.inventory_quantity;
      const tracked = el.dataset.tracked === 'true';

      if (!tracked || !variant.available || quantity === null || quantity > threshold) {
        el.hidden = true;
        return;
      }

      el.hidden = false;
      const fill = $('[data-stock-fill]', el);
      if (fill) fill.style.width = Math.max((quantity / threshold) * 100, 8) + '%';
      const label = $('[data-stock-label]', el);
      if (label) label.textContent = (label.dataset.template || '').replace('[count]', quantity);
    }
  }

  function initVariantPickers() {
    $$('[data-variant-picker]').forEach((el) => new VariantPicker(el));
  }

  /* --------------------------------------------------------- product media */

  function initProductGallery() {
    $$('[data-gallery]').forEach((gallery) => {
      const main = $('[data-gallery-main]', gallery);
      if (!main) return;

      $$('[data-media-id]', gallery).forEach((thumb) => {
        thumb.addEventListener('click', () => {
          const src = thumb.dataset.mediaSrc;
          const alt = thumb.dataset.mediaAlt || '';
          const img = $('img', main);
          if (img && src) {
            img.src = src;
            img.srcset = thumb.dataset.mediaSrcset || '';
            img.alt = alt;
          }
          $$('[data-media-id]', gallery).forEach((other) => other.setAttribute('aria-current', 'false'));
          thumb.setAttribute('aria-current', 'true');
        });
      });
    });
  }

  /* ---------------------------------------------------------- sticky atc */

  function initStickyAtc() {
    const sticky = $('[data-sticky-atc]');
    const anchor = $('[data-sticky-anchor]');
    if (!sticky || !anchor) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          sticky.classList.toggle('is-visible', !entry.isIntersecting && entry.boundingClientRect.top < 0);
        });
      },
      { rootMargin: '0px 0px -100% 0px' }
    );

    observer.observe(anchor);
  }

  /* ------------------------------------------------------------- quantity */

  function initQuantity() {
    document.addEventListener('click', (event) => {
      const button = event.target.closest('[data-quantity-change]');
      if (!button) return;

      const wrapper = button.closest('.quantity');
      const input = $('input', wrapper);
      const step = button.dataset.quantityChange === 'up' ? 1 : -1;
      const min = Number(input.min || 1);
      const next = Math.max(Number(input.value || 1) + step, min);

      if (next === Number(input.value)) return;
      input.value = next;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
  }

  /* ------------------------------------------------------------ cart line */

  function initCartLineEvents() {
    document.addEventListener('change', async (event) => {
      const input = event.target.closest('[data-line-quantity]');
      if (!input) return;

      try {
        await Cart.change({ line: Number(input.dataset.line), quantity: Number(input.value) });
        refreshCartSections();
      } catch (error) {
        toast(error.message, true);
      }
    });

    document.addEventListener('click', async (event) => {
      const remove = event.target.closest('[data-line-remove]');
      if (!remove) return;
      event.preventDefault();

      try {
        await Cart.change({ line: Number(remove.dataset.line), quantity: 0 });
        refreshCartSections();
      } catch (error) {
        toast(error.message, true);
      }
    });
  }

  function refreshCartSections() {
    const isCartPage = document.body.classList.contains('template-cart');
    const sectionId = isCartPage ? 'main-cart' : 'cart-drawer';

    fetch(routes.cart_url + '?section_id=' + sectionId)
      .then((response) => response.text())
      .then((html) => {
        const parsed = new DOMParser().parseFromString(html, 'text/html');
        const selector = isCartPage ? '[data-cart-root]' : '[data-cart-drawer-body]';
        const fresh = $(selector, parsed);
        const current = $(selector);
        if (fresh && current) current.innerHTML = fresh.innerHTML;

        if (!isCartPage) {
          const freshFooter = $('[data-cart-drawer-footer]', parsed);
          const currentFooter = $('[data-cart-drawer-footer]');
          if (freshFooter && currentFooter) currentFooter.innerHTML = freshFooter.innerHTML;
        }
      })
      .catch(() => {});
  }

  /* ----------------------------------------------------- announcement bar */

  function initAnnouncement() {
    $$('[data-announcement]').forEach((bar) => {
      const slides = $$('.announcement__slide', bar);
      if (slides.length < 2) return;

      const interval = Number(bar.dataset.interval || 5) * 1000;
      let index = 0;

      setInterval(() => {
        slides[index].classList.remove('is-active');
        index = (index + 1) % slides.length;
        slides[index].classList.add('is-active');
      }, interval);
    });

    document.addEventListener('click', (event) => {
      const close = event.target.closest('[data-announcement-close]');
      if (!close) return;
      const bar = close.closest('[data-announcement]');
      bar.hidden = true;
      try {
        sessionStorage.setItem('announcement-dismissed', '1');
      } catch (e) {
        /* private mode */
      }
    });

    try {
      if (sessionStorage.getItem('announcement-dismissed')) {
        $$('[data-announcement][data-dismissible="true"]').forEach((bar) => (bar.hidden = true));
      }
    } catch (e) {
      /* private mode */
    }
  }

  /* ------------------------------------------------------------ countdown */

  function initCountdowns() {
    $$('[data-countdown]').forEach((el) => {
      const target = new Date(el.dataset.countdown).getTime();
      if (Number.isNaN(target)) return;

      const tick = () => {
        const diff = target - Date.now();

        if (diff <= 0) {
          if (el.dataset.hideOnEnd === 'true') {
            const wrapper = el.closest('[data-countdown-wrapper]') || el;
            wrapper.hidden = true;
          }
          clearInterval(timer);
          return;
        }

        const days = Math.floor(diff / 86400000);
        const hours = Math.floor((diff % 86400000) / 3600000);
        const minutes = Math.floor((diff % 3600000) / 60000);
        const seconds = Math.floor((diff % 60000) / 1000);

        const set = (name, value) => {
          const node = $('[data-countdown-' + name + ']', el);
          if (node) node.textContent = String(value).padStart(2, '0');
        };

        set('days', days);
        set('hours', hours);
        set('minutes', minutes);
        set('seconds', seconds);
      };

      tick();
      const timer = setInterval(tick, 1000);
    });
  }

  /* ------------------------------------------------------ recently viewed */

  const RECENT_KEY = 'theme:recently-viewed';

  function trackRecentlyViewed() {
    const meta = $('[data-product-handle-meta]');
    if (!meta) return;

    const handle = meta.dataset.productHandleMeta;
    if (!handle) return;

    try {
      const stored = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
      const next = [handle].concat(stored.filter((item) => item !== handle)).slice(0, 20);
      localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    } catch (e) {
      /* storage unavailable */
    }
  }

  function renderRecentlyViewed() {
    const container = $('[data-recently-viewed]');
    if (!container) return;

    let handles = [];
    try {
      handles = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
    } catch (e) {
      return;
    }

    const currentHandle = container.dataset.excludeHandle;
    handles = handles.filter((handle) => handle !== currentHandle).slice(0, settings.recentlyViewedLimit || 6);

    if (!handles.length) {
      container.closest('[data-recently-viewed-section]').hidden = true;
      return;
    }

    const hide = () => {
      const section = container.closest('[data-recently-viewed-section]');
      if (section) section.hidden = true;
    };

    const query = handles.map((handle) => 'handle:' + handle).join(' OR ');

    fetch(
      '/search?q=' +
        encodeURIComponent(query) +
        '&type=product&section_id=search-results-fragment'
    )
      .then((response) => response.text())
      .then((html) => {
        const parsed = new DOMParser().parseFromString(html, 'text/html');
        const grid = $('[data-search-fragment-grid]', parsed);
        if (grid && grid.children.length) {
          container.innerHTML = grid.innerHTML;
        } else {
          hide();
        }
      })
      .catch(hide);
  }

  /* ------------------------------------------------- product recommendations */

  function initRecommendations() {
    const section = $('[data-product-recommendations]');
    if (!section || !section.dataset.url) return;

    fetch(section.dataset.url)
      .then((response) => response.text())
      .then((html) => {
        const parsed = new DOMParser().parseFromString(html, 'text/html');
        const fresh = $('[data-product-recommendations]', parsed);
        if (fresh && fresh.querySelector('.card-product')) {
          section.innerHTML = fresh.innerHTML;
        } else {
          section.hidden = true;
        }
      })
      .catch(() => {
        section.hidden = true;
      });
  }

  /* ------------------------------------------------------ newsletter popup */

  function initNewsletterPopup() {
    const popup = $('[data-newsletter-popup]');
    if (!popup) return;

    const key = 'theme:popup-seen';
    let seen = false;
    try {
      seen = Boolean(localStorage.getItem(key));
    } catch (e) {
      seen = true;
    }
    if (seen) return;

    const dialog = dialogs['newsletter'];
    if (!dialog) return;

    const markSeen = () => {
      try {
        localStorage.setItem(key, String(Date.now()));
      } catch (e) {
        /* ignore */
      }
    };

    let opened = false;
    const show = () => {
      if (opened) return;
      opened = true;
      markSeen();
      dialog.open();
    };

    const delay = Number(popup.dataset.delay || 8) * 1000;
    if (delay >= 0) setTimeout(show, delay);

    if (popup.dataset.exitIntent === 'true') {
      document.addEventListener('mouseout', (event) => {
        if (event.clientY <= 0 && !event.relatedTarget) show();
      });
    }
  }

  /* --------------------------------------------------------- view switcher */

  function initViewSwitcher() {
    const grid = $('[data-product-grid]');
    if (!grid) return;

    const key = 'theme:collection-view';
    let stored = null;
    try {
      stored = localStorage.getItem(key);
    } catch (e) {
      /* ignore */
    }

    const apply = (view) => {
      grid.className = grid.className.replace(/product-grid--\w+/g, '').trim();
      grid.classList.add('product-grid');
      if (view !== 'grid') grid.classList.add('product-grid--' + view);
      $$('[data-view]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.view === view)));
    };

    if (stored) apply(stored);

    $$('[data-view]').forEach((button) => {
      button.addEventListener('click', () => {
        const view = button.dataset.view;
        apply(view);
        try {
          localStorage.setItem(key, view);
        } catch (e) {
          /* ignore */
        }
      });
    });
  }

  /* ------------------------------------------------------- facets / sort */

  function initFacets() {
    const form = $('[data-facet-form]');
    if (!form) return;

    let debounce;
    form.addEventListener('change', () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => {
        const params = new URLSearchParams(new FormData(form)).toString();
        const url = window.location.pathname + '?' + params;

        fetch(url + '&section_id=' + form.dataset.sectionId)
          .then((response) => response.text())
          .then((html) => {
            const parsed = new DOMParser().parseFromString(html, 'text/html');
            ['[data-product-grid-wrapper]', '[data-facets]', '[data-collection-count]'].forEach((selector) => {
              const fresh = $(selector, parsed);
              const current = $(selector);
              if (fresh && current) current.innerHTML = fresh.innerHTML;
            });
            history.replaceState({}, '', url);
            initViewSwitcher();
          })
          .catch(() => {
            window.location.href = url;
          });
      }, 350);
    });
  }

  /* --------------------------------------------------- predictive search */

  function initPredictiveSearch() {
    $$('[data-predictive-search]').forEach((wrapper) => {
      const input = $('input[type="search"]', wrapper);
      const results = $('[data-predictive-results]', wrapper);
      if (!input || !results) return;

      let debounce;
      input.addEventListener('input', () => {
        clearTimeout(debounce);
        const query = input.value.trim();

        if (query.length < 2) {
          results.innerHTML = '';
          return;
        }

        debounce = setTimeout(() => {
          fetch(
            routes.predictive_search_url +
              '?q=' +
              encodeURIComponent(query) +
              '&resources[type]=product,collection&resources[limit]=6&section_id=predictive-search'
          )
            .then((response) => response.text())
            .then((html) => {
              const parsed = new DOMParser().parseFromString(html, 'text/html');
              const fresh = $('[data-predictive-results]', parsed);
              results.innerHTML = fresh ? fresh.innerHTML : '';
            })
            .catch(() => {
              results.innerHTML = '';
            });
        }, 250);
      });

      document.addEventListener('click', (event) => {
        if (!wrapper.contains(event.target)) results.innerHTML = '';
      });
    });
  }

  /* ------------------------------------------------------- mobile header */

  function initMobileMenu() {
    document.addEventListener('click', (event) => {
      const toggle = event.target.closest('[data-submenu-toggle]');
      if (!toggle) return;
      const panel = toggle.nextElementSibling;
      if (!panel) return;
      const expanded = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', String(!expanded));
      panel.hidden = expanded;
    });
  }

  /* -------------------------------------------------------- sticky header */

  function initStickyHeader() {
    const header = $('[data-sticky-header]');
    if (!header) return;

    let lastY = window.scrollY;
    window.addEventListener(
      'scroll',
      () => {
        const y = window.scrollY;
        header.classList.toggle('is-scrolled', y > 20);
        lastY = y;
      },
      { passive: true }
    );
    void lastY;
  }

  /* ------------------------------------------------------------- newsletter */

  function initNewsletterSuccess() {
    // Shopify redirects back with ?customer_posted=true after a signup.
    if (new URLSearchParams(window.location.search).get('customer_posted') === 'true') {
      $$('[data-newsletter-success]').forEach((el) => (el.hidden = false));
    }
  }

  /* ------------------------------------------------------------------ init */

  function init() {
    initDialogs();
    initQuickAdd();
    initProductForms();
    initVariantPickers();
    initProductGallery();
    initStickyAtc();
    initQuantity();
    initCartLineEvents();
    initAnnouncement();
    initCountdowns();
    initViewSwitcher();
    initFacets();
    initPredictiveSearch();
    initMobileMenu();
    initStickyHeader();
    initNewsletterSuccess();
    initNewsletterPopup();
    initRecommendations();
    trackRecentlyViewed();
    renderRecentlyViewed();

    Cart.subscribe(renderCartDrawer);
    Cart.fetch().catch(() => {});
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Re-run bindings when a merchant edits a section in the theme editor.
  document.addEventListener('shopify:section:load', () => {
    initVariantPickers();
    initProductGallery();
    initCountdowns();
    initViewSwitcher();
    initStickyAtc();
    initDialogs();
  });
})();

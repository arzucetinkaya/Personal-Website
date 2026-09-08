// ===== Mobile nav toggle =====
// Reused on every page that includes the shared header markup.
function initNavToggle() {
  const header = document.getElementById('site-header');
  const toggle = document.getElementById('nav-toggle');
  if (!header || !toggle) return;

  toggle.addEventListener('click', () => {
    const isOpen = header.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', String(isOpen));
  });

  document.querySelectorAll('.nav-link a').forEach((link) => {
    link.addEventListener('click', () => {
      header.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
    });
  });
}

// ===== Project filter tabs (homepage) =====
function initProjectFilter() {
  const tabsContainer = document.getElementById('project-tabs');
  const covers = document.getElementById('project-covers');
  if (!tabsContainer || !covers) return;

  const tabs = Array.from(tabsContainer.querySelectorAll('.tab'));
  const cards = Array.from(covers.querySelectorAll('.project-card[data-category]'));

  tabsContainer.addEventListener('click', (event) => {
    const tab = event.target.closest('.tab');
    if (!tab) return;

    tabs.forEach((t) => t.classList.toggle('is-active', t === tab));

    const filter = tab.dataset.filter;
    cards.forEach((card) => {
      const categories = card.dataset.category.split(' ');
      const matches = filter === 'all' || categories.includes(filter);
      card.style.display = matches ? '' : 'none';
    });
  });
}

// ===== Footer year =====
function initFooterYear() {
  const el = document.getElementById('footer-year');
  if (el) el.textContent = new Date().getFullYear();
}

// ===== Draggable, looping photo card stack (About page) =====
function initPhotoStack() {
  const stack = document.getElementById('photo-stack');
  if (!stack) return;

  const cards = Array.from(stack.querySelectorAll('.photo-card'));
  if (!cards.length) return;

  let order = cards.slice();
  let dragging = false;
  let swiping = false;
  let pointerId = null;
  let startX = 0;
  let startY = 0;
  let deltaX = 0;
  let deltaY = 0;

  const DRAG_THRESHOLD = 90;

  // Each card keeps its own fixed tilt for its whole lifetime (a messy pile
  // of physical photos, not a "slot" that reassigns a new angle whenever a
  // card moves up). Only position/scale/opacity change with stack depth.
  const CARD_ROTATIONS = [-4, 6, -7, 5, -6];
  cards.forEach((card, i) => {
    card.dataset.baseRotate = String(CARD_ROTATIONS[i % CARD_ROTATIONS.length]);
  });

  const POSITION_BY_DEPTH = [
    { tx: 0, ty: 0 },
    { tx: 16, ty: 8 },
    { tx: -14, ty: 16 },
  ];
  const HIDDEN_POSITION = { tx: 0, ty: 22 };

  function positionForDepth(depth) {
    return POSITION_BY_DEPTH[depth] || HIDDEN_POSITION;
  }

  function layout(animate) {
    order.forEach((card, i) => {
      const depth = Math.min(i, POSITION_BY_DEPTH.length);
      const { tx, ty } = positionForDepth(depth);
      const rotate = card.dataset.baseRotate;
      const scale = 1 - Math.min(depth, 3) * 0.04;
      const opacity = depth < POSITION_BY_DEPTH.length ? 1 : 0;
      card.style.zIndex = String(order.length - i);
      card.style.pointerEvents = i === 0 ? 'auto' : 'none';
      card.style.transition = animate ? '' : 'none';
      card.style.transform = `translate(${tx}px, ${ty}px) rotate(${rotate}deg) scale(${scale})`;
      card.style.opacity = String(opacity);
    });
  }

  function completeSwipe(direction, exitY) {
    if (swiping || order.length < 2) return;
    swiping = true;

    const top = order[0];
    const flyX = direction * (stack.clientWidth + 200);
    const flyY = exitY !== undefined ? exitY : deltaY;

    top.classList.remove('is-dragging');
    // Force the browser to commit the current (pre-transition) transform
    // before changing it, so the fly-out transition reliably triggers
    // instead of being coalesced with the drag's own style changes.
    void top.offsetWidth;
    top.style.transition = 'transform 0.4s ease, opacity 0.4s ease';
    top.style.transform = `translate(${flyX}px, ${flyY}px) rotate(${direction * 24}deg)`;
    top.style.opacity = '0';

    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      clearTimeout(fallbackTimer);
      top.removeEventListener('transitionend', handleEnd);
      order.push(order.shift());
      layout(true);
      swiping = false;
    };
    const handleEnd = (event) => {
      if (event.target !== top || event.propertyName !== 'transform') return;
      finish();
    };
    top.addEventListener('transitionend', handleEnd);
    // Safety net: guarantee the stack never gets stuck even if transitionend
    // is missed (e.g. the tab was backgrounded mid-animation).
    const fallbackTimer = setTimeout(finish, 550);
  }

  function onPointerDown(event) {
    const top = order[0];
    if (dragging || swiping || event.currentTarget !== top) return;
    dragging = true;
    pointerId = event.pointerId;
    try {
      top.setPointerCapture(pointerId);
    } catch (err) {
      /* pointer capture unsupported, drag still works via document-level move/up */
    }
    startX = event.clientX;
    startY = event.clientY;
    deltaX = 0;
    deltaY = 0;
    top.classList.add('is-dragging');
  }

  function onPointerMove(event) {
    if (!dragging || event.pointerId !== pointerId) return;
    const top = order[0];
    deltaX = event.clientX - startX;
    deltaY = event.clientY - startY;
    const baseRotate = Number(top.dataset.baseRotate) || 0;
    const rotate = baseRotate + deltaX / 18;
    top.style.transform = `translate(${deltaX}px, ${deltaY}px) rotate(${rotate}deg)`;
  }

  function endDrag(event) {
    if (!dragging || event.pointerId !== pointerId) return;
    dragging = false;
    const top = order[0];
    try {
      top.releasePointerCapture(pointerId);
    } catch (err) {
      /* no-op */
    }
    pointerId = null;

    if (Math.abs(deltaX) > DRAG_THRESHOLD) {
      completeSwipe(deltaX > 0 ? 1 : -1, deltaY);
    } else {
      top.classList.remove('is-dragging');
      // Same forced-commit trick as completeSwipe, so the snap-back always animates.
      void top.offsetWidth;
      layout(true);
    }
  }

  cards.forEach((card) => {
    card.addEventListener('pointerdown', onPointerDown);
  });
  stack.addEventListener('pointermove', onPointerMove);
  stack.addEventListener('pointerup', endDrag);
  stack.addEventListener('pointercancel', endDrag);

  stack.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      completeSwipe(1, 0);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      completeSwipe(-1, 0);
    }
  });

  layout(false);
}

// ===== Back to top button (every page) =====
function initBackToTop() {
  const button = document.getElementById('back-to-top');
  const footer = document.getElementById('site-footer');
  if (!button) return;

  const SHOW_AFTER = 400;

  function currentGap() {
    return window.innerWidth <= 640 ? 16 : 24;
  }

  function update() {
    button.classList.toggle('is-visible', window.scrollY > SHOW_AFTER);

    if (!footer) return;
    const gap = currentGap();
    const buttonHeight = button.offsetHeight;
    const footerTop = footer.getBoundingClientRect().top;
    const fixedBottomEdge = window.innerHeight - gap;

    if (footerTop <= fixedBottomEdge) {
      // The fixed button would start covering the footer: dock it just
      // above the footer instead, so it scrolls away with the page.
      const dockedTop = footerTop + window.scrollY - buttonHeight - gap;
      button.classList.add('is-docked');
      button.style.top = `${dockedTop}px`;
    } else {
      button.classList.remove('is-docked');
      button.style.top = '';
    }
  }

  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);
  update();

  // Images/videos loading after the initial scroll can change the page's
  // total height, which would leave a docked button stuck at a stale
  // position. Re-run whenever the document's height actually changes.
  if (window.ResizeObserver) {
    const resizeObserver = new ResizeObserver(() => update());
    resizeObserver.observe(document.body);
  } else {
    window.addEventListener('load', update);
  }

  button.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initNavToggle();
  initProjectFilter();
  initFooterYear();
  initPhotoStack();
  initBackToTop();
});

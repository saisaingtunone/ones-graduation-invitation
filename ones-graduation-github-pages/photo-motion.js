const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));
const wrap = (value, count) => ((value % count) + count) % count;
const ringOffset = (index, position, count) => wrap(index - position + count / 2, count) - count / 2;

function appendCards(stage, photos, className) {
  const cards = photos.map((photo) => {
    const card = document.createElement('div');
    const image = document.createElement('img');
    card.className = className;
    image.alt = photo.alt;
    image.draggable = false;
    image.decoding = 'async';
    card.append(image);
    return { card, image, thumbnail: photo.thumb };
  });
  stage.append(...cards.map(({ card }) => card));
  return cards;
}

function showThumbnail(image, thumbnail) {
  if (!image.hasAttribute('src')) image.src = thumbnail;
}

export function initPhotoSpiral(photos, motionPreference) {
  const stage = document.querySelector('#photo-spiral');
  const cards = appendCards(stage, photos, 'spiral-card');
  let bounds;
  let visible = false;
  let position = 0;
  let frame = 0;
  let lastTime = 0;

  function draw() {
    if (!bounds?.width) return;
    const { width, height } = bounds;
    const radius = Math.min(405, width * 0.36);
    const spacing = Math.min(127, height / 7.2);

    cards.forEach(({ card, image, thumbnail }, index) => {
      const offset = ringOffset(index, position, cards.length);
      const y = offset * spacing;
      const fade = clamp((height * 0.65 - Math.abs(y)) / (height * 0.27), 0, 1);
      card.hidden = fade === 0;
      if (card.hidden) return;

      showThumbnail(image, thumbnail);
      const angle = offset * Math.PI * 2 / 7;
      const depth = (Math.cos(angle) + 1) / 2;
      const x = Math.sin(angle) * radius;
      const scale = (0.72 + depth * 0.34) * (1 + 0.13 * Math.max(0, 1 - Math.abs(offset) / 3));
      const tilt = Math.sin(angle) * 10;
      card.style.transform = 'translate(-50%, -50%) translate3d(' + x + 'px, ' + y + 'px, 0) rotate(' + tilt + 'deg) scale(' + scale + ')';
      card.style.opacity = fade * (0.63 + depth * 0.37);
      card.style.zIndex = Math.round(depth * 1000 - Math.abs(offset));
    });
  }

  function wake() {
    if (visible && !frame && !document.hidden && !motionPreference.matches) {
      frame = requestAnimationFrame(step);
    }
  }

  function step(time) {
    frame = 0;
    if (!visible || document.hidden || motionPreference.matches) {
      lastTime = 0;
      return;
    }

    const elapsed = lastTime ? Math.min((time - lastTime) / 1000, 0.05) : 0;
    lastTime = time;
    position = wrap(position + elapsed * 0.49, cards.length);
    draw();
    wake();
  }

  const resize = new ResizeObserver(() => {
    bounds = stage.getBoundingClientRect();
    draw();
    wake();
  });
  resize.observe(stage);

  const visibility = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    lastTime = 0;
    wake();
  }, { threshold: 0.04 });
  visibility.observe(stage);
  document.addEventListener('visibilitychange', wake);
  motionPreference.addEventListener('change', wake);
}

export function initCoverflow(photos, motionPreference) {
  const frame = document.querySelector('.coverflow__frame');
  const stage = frame.querySelector('.coverflow__stage');
  const slides = appendCards(stage, photos, 'coverflow__slide');
  let index = -1;
  let width = 0;
  let position = 0;
  let target = 0;
  let movingFrame;
  let drag;
  let timer;
  let visible = false;
  let hovered = false;
  let focused = false;

  slides.forEach(({ card }, offset) => {
    card.setAttribute('role', 'group');
    card.setAttribute('aria-roledescription', 'slide');
    card.setAttribute('aria-label', (offset + 1) + ' of ' + photos.length);
  });

  function select(positionToSelect) {
    const active = wrap(Math.round(positionToSelect), photos.length);
    if (active === index) return;
    if (index >= 0) slides[index].card.setAttribute('aria-hidden', 'true');
    index = active;
    slides[index].card.setAttribute('aria-hidden', 'false');
  }
  slides.forEach(({ card }) => card.setAttribute('aria-hidden', 'true'));
  select(0);

  function paint() {
    if (!width) return;

    slides.forEach(({ card, image, thumbnail }, order) => {
      const offset = ringOffset(order, position, photos.length);
      const distance = Math.abs(offset);
      card.hidden = distance > 4.35;
      if (card.hidden) return;

      showThumbnail(image, thumbnail);
      const ramp = Math.pow(distance, 0.62);
      const tilt = Math.min(43 * ramp, 78) * Math.sign(offset);
      card.style.transform = 'translateX(calc(-50% + ' + (offset * width * 0.77) + 'px)) ' +
        'translateZ(' + (-width * 0.6 * ramp) + 'px) rotateY(' + (-tilt) + 'deg)';
      card.style.opacity = clamp(1 - distance * 0.16, 0, 1);
      card.style.zIndex = 100 - Math.round(distance * 10);
    });
  }

  function settle(next) {
    if (movingFrame !== undefined) cancelAnimationFrame(movingFrame);
    target = next;
    const origin = position;
    const start = performance.now();

    function advance(time) {
      const fraction = motionPreference.matches ? 1 : Math.min(1, (time - start) / 930);
      const eased = (1 - Math.cos(fraction * Math.PI)) / 2;
      position = origin + (target - origin) * eased;
      select(position);
      paint();
      movingFrame = fraction < 1 ? requestAnimationFrame(advance) : undefined;
    }
    advance(start);
  }

  function scheduleNext() {
    window.clearTimeout(timer);
    if (!visible || document.hidden || hovered || focused || drag || motionPreference.matches) return;
    timer = window.setTimeout(() => {
      settle(Math.round(target) + 1);
      scheduleNext();
    }, 2700);
  }

  frame.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    settle(Math.round(target) + (event.key === 'ArrowLeft' ? -1 : 1));
    scheduleNext();
  });
  frame.addEventListener('pointerenter', (event) => {
    if (event.pointerType !== 'mouse') return;
    hovered = true;
    scheduleNext();
  });
  frame.addEventListener('pointerleave', () => {
    hovered = false;
    scheduleNext();
  });
  frame.addEventListener('focus', () => {
    focused = frame.matches(':focus-visible');
    scheduleNext();
  });
  frame.addEventListener('blur', () => {
    focused = false;
    scheduleNext();
  });

  frame.addEventListener('pointerdown', (event) => {
    if (!event.isPrimary || event.button !== 0 || !width) return;
    if (movingFrame !== undefined) cancelAnimationFrame(movingFrame);
    movingFrame = undefined;
    target = position;
    drag = { id: event.pointerId, x: event.clientX, position, time: performance.now(), velocity: 0 };
    frame.setPointerCapture(event.pointerId);
    frame.classList.add('is-dragging');
    scheduleNext();
  });

  frame.addEventListener('pointermove', (event) => {
    if (drag?.id !== event.pointerId) return;
    const time = performance.now();
    const next = drag.position - (event.clientX - drag.x) / (width * 0.77);
    drag.velocity = (next - position) / Math.max(time - drag.time, 1) * 1000;
    drag.time = time;
    position = next;
    select(position);
    paint();
  });

  function endDrag(event) {
    if (drag?.id !== event.pointerId) return;
    const carry = event.type === 'pointerup' && performance.now() - drag.time < 130
      ? clamp(drag.velocity * 0.15, -1.8, 1.8)
      : 0;
    drag = undefined;
    frame.classList.remove('is-dragging');
    settle(Math.round(position + carry));
    scheduleNext();
  }
  frame.addEventListener('pointerup', endDrag);
  frame.addEventListener('pointercancel', endDrag);
  frame.addEventListener('lostpointercapture', endDrag);

  const resize = new ResizeObserver(() => {
    // The stage inherits the card width, and is measurable even when a card is hidden.
    width = stage.clientWidth;
    paint();
  });
  resize.observe(frame);

  const observer = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    scheduleNext();
  }, { threshold: 0.18 });
  observer.observe(frame);
  document.addEventListener('visibilitychange', scheduleNext);
  motionPreference.addEventListener('change', scheduleNext);
}

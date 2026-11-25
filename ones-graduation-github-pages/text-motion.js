export function initFoldText() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(({ target, isIntersecting }) => {
      if (!isIntersecting) return;
      target.classList.add('is-unfolded');
      observer.unobserve(target);
    });
  }, { threshold: 0.08 });

  document.querySelectorAll('[data-fold-text]').forEach((node) => {
    const text = node.textContent.trim();
    const spokenText = document.createElement('span');
    spokenText.className = 'visually-hidden';
    spokenText.textContent = text;
    let delay = 0;

    const visual = document.createElement('span');
    visual.setAttribute('aria-hidden', 'true');
    text.split(/(\s+)/).forEach((part) => {
      if (/^\s+$/.test(part)) {
        visual.append(part);
        return;
      }

      const word = document.createElement('span');
      word.className = 'fold-word';
      for (const character of part) {
        const letter = document.createElement('span');
        letter.className = 'fold-letter';
        letter.textContent = character;
        letter.style.setProperty('--fold-delay', delay + 'ms');
        delay += 31;
        word.append(letter);
      }
      visual.append(word);
    });

    node.replaceChildren(spokenText, visual);
    node.classList.add('fold-text');
    observer.observe(node);
  });

  observer.observe(document.querySelector('#countdown'));
}

export function playAnimatedContent(root, { distance = 36, delay = 0, duration = 800 } = {}) {
  Array.from(root.children).forEach((child, index) => {
    child.animate([
      { transform: 'translateY(' + distance + 'px)', opacity: 0, filter: 'blur(2px)' },
      { transform: 'translateY(0)', opacity: 1, filter: 'blur(0)' },
    ], {
      duration,
      delay: delay + index * 80,
      easing: 'cubic-bezier(0.215, 0.61, 0.355, 1)',
      fill: 'backwards',
    });
  });
}

export function initStarBorders() {
  document.querySelectorAll('.star-border').forEach((button) => {
    const orbit = document.createElement('span');
    orbit.className = 'star-border__orbit';
    orbit.setAttribute('aria-hidden', 'true');
    for (let index = 0; index < 9; index += 1) {
      const spark = document.createElement('span');
      spark.className = 'star-border__spark';
      spark.style.setProperty('--trail-step', index);
      orbit.append(spark);
    }
    button.append(orbit);
  });
}

export function rollCountdownNumber(unit, text, animate) {
  const previous = unit.dataset.value;
  if (previous === text) return;
  unit.dataset.value = text;

  const accessible = document.createElement('span');
  accessible.className = 'visually-hidden';
  accessible.textContent = text;
  const current = document.createElement('span');
  current.className = 'countdown__digit';
  current.textContent = text;
  current.setAttribute('aria-hidden', 'true');
  unit.replaceChildren(accessible, current);

  if (animate && previous !== undefined) {
    const outgoing = current.cloneNode();
    outgoing.classList.add('countdown__digit--exit');
    outgoing.textContent = previous;
    outgoing.addEventListener('animationend', () => outgoing.remove(), { once: true });
    current.classList.add('countdown__digit--enter');
    unit.append(outgoing);
  }
}

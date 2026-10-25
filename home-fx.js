// Homepage pointer effects: a soft light that follows the cursor, a neon edge that tracks the cursor
// around cards, and magnetic [data-magnetic] controls. Skipped for touch-only devices and reduced motion.
(() => {
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (!finePointer.matches || reducedMotion.matches) return;

  const root = document.documentElement;
  let frame = 0;
  let x = 0;
  let y = 0;
  const paint = () => {
    frame = 0;
    root.style.setProperty('--cx', x + 'px');
    root.style.setProperty('--cy', y + 'px');
  };
  window.addEventListener('pointermove', event => {
    x = event.clientX;
    y = event.clientY;
    root.classList.add('has-cursor-glow');
    if (!frame) frame = requestAnimationFrame(paint);
  }, { passive: true });
  document.addEventListener('pointerleave', () => root.classList.remove('has-cursor-glow'));

  document.querySelectorAll('.project-scene, .journey-card, .paper-card').forEach(card => {
    card.addEventListener('pointermove', event => {
      const rect = card.getBoundingClientRect();
      card.style.setProperty('--card-x', (event.clientX - rect.left).toFixed(0) + 'px');
      card.style.setProperty('--card-y', (event.clientY - rect.top).toFixed(0) + 'px');
    }, { passive: true });
  });

  const STRENGTH = 0.28;
  const MAX_SHIFT = 14;
  document.querySelectorAll('[data-magnetic]').forEach(el => {
    el.addEventListener('pointermove', event => {
      const rect = el.getBoundingClientRect();
      const dx = (event.clientX - (rect.left + rect.width / 2)) * STRENGTH;
      const dy = (event.clientY - (rect.top + rect.height / 2)) * STRENGTH;
      el.style.setProperty('--mag-x', Math.max(-MAX_SHIFT, Math.min(MAX_SHIFT, dx)).toFixed(1) + 'px');
      el.style.setProperty('--mag-y', Math.max(-MAX_SHIFT, Math.min(MAX_SHIFT, dy)).toFixed(1) + 'px');
    }, { passive: true });
    el.addEventListener('pointerleave', () => {
      el.style.setProperty('--mag-x', '0px');
      el.style.setProperty('--mag-y', '0px');
    });
  });
})();

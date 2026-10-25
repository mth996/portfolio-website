// Homepage pointer effects: hero spotlight that follows the cursor, and magnetic [data-magnetic] controls.
// Skipped entirely for touch-only devices and prefers-reduced-motion.
(() => {
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (!finePointer.matches || reducedMotion.matches) return;

  const hero = document.querySelector('.hero');
  if (hero) {
    let frame = 0;
    let x = 0;
    let y = 0;
    const paint = () => {
      frame = 0;
      const rect = hero.getBoundingClientRect();
      if (rect.bottom < 0) return;
      hero.style.setProperty('--mx', ((x - rect.left) / rect.width * 100).toFixed(2) + '%');
      hero.style.setProperty('--my', ((y - rect.top) / rect.height * 100).toFixed(2) + '%');
    };
    window.addEventListener('pointermove', event => {
      x = event.clientX;
      y = event.clientY;
      if (!frame) frame = requestAnimationFrame(paint);
    }, { passive: true });
  }

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

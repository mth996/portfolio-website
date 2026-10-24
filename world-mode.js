(() => {
  const body = document.body;
  const root = document.documentElement;
  if (!body || !body.classList.contains('home')) return;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const routes = [
    { label: 'ENTRY', target: document.querySelector('.immersive-hero'), hue: 192 },
    { label: 'WORLDS', target: document.querySelector('#projects'), hue: 263 },
    { label: 'PROFILE', target: document.querySelector('#profile'), hue: 179 },
    { label: 'CAREER', target: document.querySelector('#experience'), hue: 218 },
    { label: 'RESEARCH', target: document.querySelector('#papers'), hue: 302 },
    { label: 'CONTACT', target: document.querySelector('#contact'), hue: 192 }
  ].filter(route => route.target);

  const routeLinks = [...document.querySelectorAll('[data-world-stop]')];
  const routeCount = document.getElementById('world-route-count');
  const routeName = document.getElementById('world-route-name');
  const progressFill = document.querySelector('.world-progress-fill');
  let activeRoute = -1;
  let scrollFrame = 0;
  let lastScrollY = window.scrollY;
  const focusTargets = [...document.querySelectorAll(".project-scene,.profile-section,.journey-section,.papers-section,.footer")];

  function setRoute(index) {
    if (!routes.length) return;
    index = Math.max(0, Math.min(index, routes.length - 1));
    if (index === activeRoute) return;
    activeRoute = index;
    const route = routes[index];
    root.style.setProperty('--world-hue', route.hue);
    body.dataset.activeWorld = route.label.toLowerCase();
    if (routeCount) routeCount.innerHTML = String(index + 1).padStart(2, '0') + ' <em>/ ' + String(routes.length).padStart(2, '0') + '</em>';
    if (routeName) routeName.textContent = route.label;
    routeLinks.forEach((link, i) => {
      link.classList.toggle('is-active', i === index);
      link.classList.toggle('is-passed', i < index);
      if (i === index) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
  }

  function updateScroll() {
    scrollFrame = 0;
    const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    const currentScrollY = window.scrollY;
    const delta = currentScrollY - lastScrollY;
    const progress = Math.max(0, Math.min(1, currentScrollY / maxScroll));
    root.style.setProperty('--scroll-progress', progress.toFixed(4));
    root.style.setProperty('--scroll-direction', delta >= 0 ? '1' : '-1');
    root.style.setProperty('--scroll-energy', Math.min(1, Math.abs(delta) / 80).toFixed(2));
    body.dataset.scrollDirection = delta >= 0 ? 'down' : 'up';
    lastScrollY = currentScrollY;
    if (progressFill) progressFill.style.transform = 'scaleX(' + progress.toFixed(4) + ')';
    const focusLine = window.innerHeight * 0.52;
    focusTargets.forEach(target => {
      const rect = target.getBoundingClientRect();
      const center = rect.top + Math.min(rect.height * 0.5, window.innerHeight * 0.62);
      const focus = Math.max(0, Math.min(1, 1 - Math.abs(center - focusLine) / (window.innerHeight * 0.82)));
      target.style.setProperty('--scroll-focus', focus.toFixed(3));
    });

    const probe = window.scrollY + window.innerHeight * 0.43;
    let current = 0;
    routes.forEach((route, index) => {
      const top = route.target.getBoundingClientRect().top + window.scrollY;
      if (top <= probe) current = index;
    });
    setRoute(current);
  }

  function scheduleScrollUpdate() {
    if (scrollFrame) return;
    scrollFrame = window.requestAnimationFrame(updateScroll);
  }

  window.addEventListener('scroll', scheduleScrollUpdate, { passive: true });
  window.addEventListener('resize', scheduleScrollUpdate, { passive: true });
  routeLinks.forEach(link => link.addEventListener('click', () => {
    const index = Number(link.dataset.worldStop);
    if (Number.isFinite(index)) setRoute(index);
  }));

  const revealItems = document.querySelectorAll('.hero-content,.showcase-head,.project-scene,.profile-grid,.journey-head,.journey-card,.papers-head,.paper-card,.footer-grid');
  if ('IntersectionObserver' in window && !reducedMotion) {
    root.classList.add('world-motion-ready');
    const revealObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        entry.target.classList.toggle('world-entered', entry.isIntersecting);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -5% 0px' });
    revealItems.forEach(item => {
      item.classList.add('world-reveal');
      revealObserver.observe(item);
    });
  } else {
    revealItems.forEach(item => item.classList.add('world-entered'));
  }

  const canvas = document.getElementById('world-atmosphere');
  const context = canvas && canvas.getContext ? canvas.getContext('2d', { alpha: true }) : null;
  let width = 0;
  let height = 0;
  let ratio = 1;
  let animationFrame = 0;
  const pointer = { x: 0, y: 0 };
  const particleCount = window.innerWidth < 700 ? 22 : 38;
  const particles = Array.from({ length: particleCount }, () => ({
    x: Math.random(), y: Math.random(), phase: Math.random() * Math.PI * 2,
    size: Math.random() * 1.35 + 0.45, speed: Math.random() * 8 + 3,
    depth: Math.random() * 1.2 + 0.25
  }));

  function resizeCanvas() {
    if (!canvas || !context) return;
    width = window.innerWidth;
    height = window.innerHeight;
    ratio = Math.min(window.devicePixelRatio || 1, 1.35);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    drawAtmosphere(0);
  }

  function drawAtmosphere(time) {
    if (!canvas || !context || !width || !height) return;
    context.clearRect(0, 0, width, height);
    const seconds = reducedMotion ? 0 : time * 0.001;
    const hue = Number(getComputedStyle(root).getPropertyValue('--world-hue')) || 192;
    const points = particles.map(point => {
      const drift = reducedMotion ? 0 : Math.sin(seconds * 0.35 + point.phase) * 13 + pointer.x * 7;
      const rise = reducedMotion ? 0 : seconds * point.speed + window.scrollY * point.depth * 0.035;
      const x = point.x * width + drift;
      const y = ((point.y * height - rise) % height + height) % height;
      const alpha = 0.18 + (Math.sin(seconds * 1.25 + point.phase) + 1) * 0.16;
      context.beginPath();
      context.fillStyle = 'hsla(' + hue + ',92%,82%,' + alpha + ')';
      context.arc(x, y, point.size, 0, Math.PI * 2);
      context.fill();
      return { x, y, alpha };
    });

    for (let i = 0; i < points.length; i += 1) {
      for (let j = i + 1; j < points.length; j += 1) {
        const dx = points[i].x - points[j].x;
        const dy = points[i].y - points[j].y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < 112) {
          context.strokeStyle = 'hsla(' + hue + ',88%,72%,' + (0.075 * (1 - distance / 112)) + ')';
          context.lineWidth = 0.65;
          context.beginPath();
          context.moveTo(points[i].x, points[i].y);
          context.lineTo(points[j].x, points[j].y);
          context.stroke();
        }
      }
    }

  }

  function animateAtmosphere(time) {
    drawAtmosphere(time);
    if (!reducedMotion && !document.hidden) animationFrame = window.requestAnimationFrame(animateAtmosphere);
  }

  if (canvas && context) {
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas, { passive: true });
    if (!reducedMotion) {
      window.addEventListener('pointermove', event => {
        pointer.x = (event.clientX / Math.max(1, width) - 0.5) * 1.4;
        pointer.y = (event.clientY / Math.max(1, height) - 0.5) * 1.2;
      }, { passive: true });
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          if (animationFrame) window.cancelAnimationFrame(animationFrame);
          animationFrame = 0;
        } else if (!animationFrame) {
          animationFrame = window.requestAnimationFrame(animateAtmosphere);
        }
      });
      animationFrame = window.requestAnimationFrame(animateAtmosphere);
    }
  }

  if (!reducedMotion && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    document.querySelectorAll('.project-scene').forEach(card => {
      const art = card.querySelector('.scene-art');
      if (!art) return;
      art.addEventListener('pointermove', event => {
        const rect = art.getBoundingClientRect();
        const x = (event.clientX - rect.left) / Math.max(1, rect.width);
        const y = (event.clientY - rect.top) / Math.max(1, rect.height);
        art.style.setProperty('--pointer-x', (x * 100).toFixed(1) + '%');
        art.style.setProperty('--pointer-y', (y * 100).toFixed(1) + '%');
        art.style.setProperty('--tilt-x', ((0.5 - y) * 3.2).toFixed(2) + 'deg');
        art.style.setProperty('--tilt-y', ((x - 0.5) * 4.2).toFixed(2) + 'deg');
        card.style.setProperty('--pointer-x', (x * 100).toFixed(1) + '%');
        card.style.setProperty('--pointer-y', (y * 100).toFixed(1) + '%');
      }, { passive: true });
      art.addEventListener('pointerleave', () => {
        art.style.setProperty('--tilt-x', '0deg');
        art.style.setProperty('--tilt-y', '0deg');
      });
    });
  }

  updateScroll();
})();
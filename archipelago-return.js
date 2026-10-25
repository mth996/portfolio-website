// On a case study opened from the 3D journey (?returnIsland=N), offer a way back to the same stop.
(() => {
  const params = new URLSearchParams(window.location.search);
  const stop = params.get("returnIsland");
  if (stop === null || !/^(\d+|hub|profile|career|research|contact)$/.test(stop)) return;
  const link = document.createElement("a");
  link.className = "archipelago-return-link";
  link.href = "index.html?returnIsland=" + encodeURIComponent(stop);
  link.textContent = "Back to 3D journey";
  link.setAttribute("aria-label", "Return to this project in the 3D journey");
  const style = document.createElement("style");
  style.textContent = `
    .archipelago-return-link{position:fixed;z-index:999;top:20px;right:24px;display:inline-flex;align-items:center;gap:9px;min-height:42px;padding:0 17px;border:1px solid var(--pill-border);border-radius:var(--radius-pill);background:var(--glass-strong);color:var(--text-1);text-decoration:none;font:500 .66rem/1 var(--font-mono);letter-spacing:.12em;text-transform:uppercase;box-shadow:0 0 26px var(--glow-accent-2);backdrop-filter:blur(12px);transition:border-color .22s ease,box-shadow .22s ease,translate .22s ease}
    .archipelago-return-link::before{content:"";width:6px;height:6px;border-radius:50%;background:var(--accent-3);box-shadow:0 0 10px var(--accent-3)}
    .archipelago-return-link:hover{translate:0 -2px;border-color:var(--pill-border-hover);box-shadow:0 0 30px var(--glow-accent-3)}
    .archipelago-return-link:focus-visible{outline:2px solid var(--focus-ring);outline-offset:4px}
    @media(max-width:650px){.archipelago-return-link{top:12px;right:12px;min-height:38px;padding:0 12px;font-size:.58rem}}
    @media(prefers-reduced-motion:reduce){.archipelago-return-link{transition:none}}
  `;
  document.head.appendChild(style);
  document.body.appendChild(link);
})();

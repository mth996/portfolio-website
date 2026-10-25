(() => {
  const params = new URLSearchParams(window.location.search);
  const stop = params.get("returnIsland");
  if (stop === null || !/^(\d+|hub|profile|career|research|contact)$/.test(stop)) return;
  const link = document.createElement("a");
  link.className = "archipelago-return-link";
  link.href = "index.html?returnIsland=" + encodeURIComponent(stop);
  link.textContent = "RETURN TO ISLAND";
  link.setAttribute("aria-label", "Return to the same island in the XR Archipelago");
  link.title = "Return to the same island in the XR Archipelago";
  const style = document.createElement("style");
  style.textContent = `
    .archipelago-return-link{position:fixed;z-index:999;top:20px;right:24px;display:inline-flex;align-items:center;gap:9px;min-height:42px;padding:0 17px;border:1px solid rgba(113,218,255,.55);border-radius:999px;background:rgba(7,24,46,.94);color:#e8f8ff;text-decoration:none;font:700 .66rem/1 var(--font-body);letter-spacing:.12em;box-shadow:0 8px 28px rgba(0,0,0,.36),0 0 26px rgba(52,189,239,.17);backdrop-filter:blur(12px);transition:transform .22s ease,border-color .22s ease,box-shadow .22s ease}
    .archipelago-return-link:before{content:"↶";font-size:1.2rem;line-height:.8;color:#8de9ff}
    .archipelago-return-link:hover{transform:translateY(-2px);border-color:#a9f0ff;box-shadow:0 10px 34px rgba(0,0,0,.4),0 0 32px rgba(52,189,239,.28)}
    .archipelago-return-link:focus-visible{outline:2px solid #c9f7ff;outline-offset:4px}
    @media(max-width:650px){.archipelago-return-link{top:12px;right:12px;min-height:38px;padding:0 12px;font-size:.58rem}}
    @media(prefers-reduced-motion:reduce){.archipelago-return-link{transition:none}}
  `;
  document.head.appendChild(style);
  document.body.appendChild(link);
})();
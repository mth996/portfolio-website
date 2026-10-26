// Optional cinematic 3D journey through the portfolio: projects, profile, experience, publications and contact,
// with a generative soundtrack. It rides a motorcycle through a cyberpunk city (journey-city.js); if the city can't
// load, or with ?journey=grid, it falls back to the original neon-grid world walked by the explorer guide. Three.js and its addons load from the CDN (see the import map in
// index.html) only when the visitor clicks "Enter 3D journey". The regular page stays the default.
(() => {
  const body = document.body;
  const root = document.documentElement;
  const button = document.getElementById("archipelago-toggle");
  const canvas = document.getElementById("archipelago-canvas");
  const status = document.getElementById("archipelago-status");
  if (!body || !button || !canvas) return;

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const coarsePointer = window.matchMedia("(hover:none), (pointer:coarse)");
  let returnParam = new URLSearchParams(window.location.search).get("returnIsland");
  const buttonParent = button.parentNode;
  const buttonNext = button.nextSibling;
  const startLabel = "ENTER 3D JOURNEY";
  // Guide character: "RobotExpressive" by Tomás Laulhé (Quaternius), CC0, from the three.js examples
  const GUIDE_URL = "https://cdn.jsdelivr.net/gh/mrdoob/three.js@r170/examples/models/gltf/RobotExpressive/RobotExpressive.glb";
  const SECTION_SELECTORS = { profile: "#profile", career: "#experience", research: "#papers", outro: "#contact" };
  const stopLabel = "EXIT 3D JOURNEY";

  let active = false;
  let booting = false;
  let teardown = null;
  let statusTimer = 0;
  let savedScrollY = 0;

  function announce(message) {
    if (!status) return;
    status.textContent = message;
    status.classList.add("is-visible");
    clearTimeout(statusTimer);
    statusTimer = setTimeout(() => status.classList.remove("is-visible"), 2600);
  }
  function updateControls() {
    button.textContent = booting ? "LOADING JOURNEY" : active ? stopLabel : startLabel;
    button.setAttribute("aria-pressed", String(active));
    button.setAttribute("aria-label", active ? "Exit the 3D journey and return to the regular portfolio" : "Enter the optional 3D journey through the projects");
  }
  function clearReturnParam() {
    if (returnParam === null) return;
    const url = new URL(window.location.href);
    url.searchParams.delete("returnIsland");
    history.replaceState(history.state, "", url.pathname + url.search + url.hash);
    // Used once: later entries start from wherever the visitor is on the page
    returnParam = null;
  }

  // Projects come straight from the page, so the journey always matches the cards.
  function readProjects() {
    return [...document.querySelectorAll(".project-scene")].map((card, index) => {
      const img = card.querySelector("img");
      return {
        index,
        href: card.href,
        num: (card.querySelector(".scene-num")?.textContent || String(index + 1)).trim(),
        title: (card.querySelector("h3")?.innerText || "").replace(/\s+/g, " ").trim(),
        tags: (card.querySelector(".scene-tags")?.textContent || "").trim(),
        desc: (card.querySelector(".scene-copy p")?.textContent || "").trim(),
        image: img ? img.currentSrc || img.src : "",
        experience: card.dataset.experience === "vr" ? "vr" : "non-vr",
        poster: card.classList.contains("project-scene--poster")
      };
    });
  }
  const text = el => (el?.innerText || el?.textContent || "").replace(/\s+/g, " ").trim();
  function readSections() {
    return {
      profileLead: text(document.querySelector(".profile-copy > p")),
      skills: [...document.querySelectorAll(".skill-line li")].map(text),
      roles: [...document.querySelectorAll(".journey-card")].map(card => ({
        dates: text(card.querySelector(".journey-meta span")),
        type: text(card.querySelector(".journey-type")),
        role: text(card.querySelector(".journey-role")),
        org: text(card.querySelector(".journey-org")),
        education: !!card.closest(".journey-column--education")
      })),
      papers: [...document.querySelectorAll(".paper-card")].map(card => ({
        year: text(card.querySelector(".paper-year")),
        venue: text(card.querySelector(".paper-venue")),
        title: text(card.querySelector(".paper-title")),
        href: card.querySelector(".paper-links a")?.href || card.querySelector(".paper-title")?.href || ""
      }))
    };
  }
  function startStopFor(stops) {
    const kindIndex = kind => stops.findIndex(s => s.kind === kind);
    if (returnParam !== null) {
      if (/^\d+$/.test(returnParam)) return Math.min(stops.length - 2, Number(returnParam) + 1);
      const map = { contact: "outro", profile: "profile", career: "career", research: "research" };
      return Math.max(0, kindIndex(map[returnParam]));
    }
    // Start at whatever the visitor was looking at: a project card or one of the later sections.
    for (const [kind, selector] of Object.entries(SECTION_SELECTORS)) {
      const rect = document.querySelector(selector)?.getBoundingClientRect();
      if (rect && rect.top < window.innerHeight * 0.5 && rect.bottom > window.innerHeight * 0.5) return Math.max(0, kindIndex(kind));
    }
    // Start at the project card nearest the middle of the screen, if the visitor has scrolled to the projects.
    const middle = window.innerHeight / 2;
    let best = 0;
    let bestDistance = Infinity;
    document.querySelectorAll(".project-scene").forEach((card, i) => {
      const rect = card.getBoundingClientRect();
      const distance = Math.abs(rect.top + rect.height / 2 - middle);
      if (rect.bottom > 0 && rect.top < window.innerHeight && distance < bestDistance) { best = i + 1; bestDistance = distance; }
    });
    return best;
  }

  async function enter() {
    if (active || booting) return;
    booting = true;
    button.disabled = true;
    updateControls();
    try {
      const [THREE, { EffectComposer }, { RenderPass }, { UnrealBloomPass }, { OutputPass }, { ShaderPass }, { GLTFLoader }, audio, explorerModule, travelModule, cityModule] = await Promise.all([
        import("three"),
        import("three/addons/postprocessing/EffectComposer.js"),
        import("three/addons/postprocessing/RenderPass.js"),
        import("three/addons/postprocessing/UnrealBloomPass.js"),
        import("three/addons/postprocessing/OutputPass.js"),
        import("three/addons/postprocessing/ShaderPass.js"),
        import("three/addons/loaders/GLTFLoader.js"),
        import("./journey-audio.js?v=1").catch(() => null),
        import("./journey-explorer.js?v=2").catch(() => null),
        import("./journey-travel.js?v=10"),
        import("./journey-city.js?v=2").catch(() => null)
      ]);
      // The city world: its model, bikes and route; any failure falls back to the grid journey
      let cityAssets = null;
      if (cityModule && new URLSearchParams(window.location.search).get("journey") !== "grid") {
        try { cityAssets = await cityModule.loadCity({ THREE, GLTFLoader }); }
        catch (error) { console.warn("City journey unavailable, using the grid journey instead.", error); }
      }
      if (document.fonts) await Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 1500))]);
      teardown = buildJourney({ THREE, EffectComposer, RenderPass, UnrealBloomPass, OutputPass, ShaderPass, GLTFLoader, audio, explorerModule, travelModule, cityModule, cityAssets });
      active = true;
      clearReturnParam();
    } catch (error) {
      console.error("3D journey could not start:", error);
      if (teardown) { teardown(); teardown = null; }
      active = false;
      announce("The 3D journey isn't available in this browser. The portfolio works as normal.");
      clearReturnParam();
    } finally {
      booting = false;
      button.disabled = false;
      updateControls();
    }
  }

  function exit(scrollToSelector) {
    if (!active) return;
    active = false;
    if (teardown) { teardown(); teardown = null; }
    updateControls();
    const target = scrollToSelector ? document.querySelector(scrollToSelector) : null;
    const heading = target ? target.querySelector("h2, h3") : null;
    if (target) {
      target.scrollIntoView({ behavior: "instant", block: "start" });
      if (heading) { heading.setAttribute("tabindex", "-1"); heading.focus({ preventScroll: true }); }
    } else {
      announce("Back to the regular portfolio.");
      button.focus({ preventScroll: true });
    }
  }

  function buildJourney({ THREE, EffectComposer, RenderPass, UnrealBloomPass, OutputPass, ShaderPass, GLTFLoader, audio, explorerModule, travelModule, cityModule, cityAssets }) {
    const lite = coarsePointer.matches || window.innerWidth < 760;
    const still = reducedMotion.matches;
    const css = getComputedStyle(root);
    const token = name => new THREE.Color(css.getPropertyValue(name).trim() || "#ffffff");
    const ink = token("--bg");
    const neon = [token("--accent"), token("--accent-2"), token("--accent-3"), token("--accent-warm")];
    const hdr = (color, power) => color.clone().multiplyScalar(power);
    const fontDisplay = css.getPropertyValue("--font-display").trim();
    const fontMono = css.getPropertyValue("--font-mono").trim();
    const fontBody = css.getPropertyValue("--font-body").trim();
    const cssColor = name => css.getPropertyValue(name).trim();
    const sections = readSections();

    const projects = readProjects();
    if (!projects.length) throw new Error("No projects on the page.");

    // ---------- Renderer, scene, camera ----------
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: "high-performance" });
    let pixelRatio = Math.min(window.devicePixelRatio || 1, lite ? 1 : 1.5);
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.setClearColor(ink, 1);

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(ink, lite ? 0.03 : 0.026);
    const camera = new THREE.PerspectiveCamera(lite ? 56 : 42, window.innerWidth / window.innerHeight, 0.1, 600);
    const disposables = [];
    const keep = obj => { disposables.push(obj); return obj; };

    // ---------- City world (falls back to the grid if it can't be built or doesn't match the page's stops) ----------
    let city = null;
    const stopCount = projects.length + 2 + (sections.roles.length ? 1 : 0) + (sections.papers.length ? 1 : 0) + 1;
    if (cityAssets && cityAssets.route.stops.length === stopCount) {
      try { city = cityModule.createCity({ THREE, assets: cityAssets, scene, renderer, ink, neon, lite }); }
      catch (error) { console.warn("City journey couldn't be built, using the grid journey instead.", error); city = null; }
    } else if (cityAssets) console.warn("City route has a different number of stops than the page; using the grid journey.");
    const cityMode = !!city;
    if (cityMode) scene.fog.density = lite ? 0.009 : 0.0065;

    // ---------- Shared textures drawn on canvas ----------
    function radialTexture(stops) {
      const c = document.createElement("canvas");
      c.width = c.height = 128;
      const g = c.getContext("2d");
      const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      stops.forEach(([at, alpha]) => grad.addColorStop(at, `rgba(255,255,255,${alpha})`));
      g.fillStyle = grad;
      g.fillRect(0, 0, 128, 128);
      return keep(new THREE.CanvasTexture(c));
    }
    const dotTexture = radialTexture([[0, 1], [0.25, 0.55], [1, 0]]);
    const haloTexture = radialTexture([[0, 0.55], [0.45, 0.18], [1, 0]]);

    // ---------- World layout ----------
    // A straight walking path runs down x = 0; project cards alternate left and right of it
    const SPACING = 22;          // metres between project stops
    const SECTION_GAP = 26;
    const PATH_CLEARANCE = 2.3;  // metres from the path's centre line to a card's inner edge
    const CARD_TURN = 0.44;      // cards turn ~25° toward the path
    const CARD_LIFT = 2.2;       // card bottom edge: always above the guide's head (1.9 m)
    const GUIDE_OFFSET = 0.8;    // the guide stands this far across the path from the active card
    // (in the city a card may be enlarged where its spot has room: stop.cardScale from the route data)
    const cardSize = stop => (stop.poster ? [3.5, 4.66] : [6.4, 3.6]).map(v => v * (stop.cardScale || 1));
    const stops = [
      { kind: "intro" },
      ...projects.map(p => ({ kind: "project", ...p })),
      { kind: "profile", label: "Profile" },
      ...(sections.roles.length ? [{ kind: "career", label: "Experience" }] : []),
      ...(sections.papers.length ? [{ kind: "research", label: "Publications" }] : []),
      { kind: "outro", label: "Contact" }
    ];
    const projectZ = j => -16 - (j - 1) * SPACING;
    let sectionZ = projectZ(projects.length) - 6;
    stops.forEach((stop, i) => {
      if (stop.kind === "intro") { stop.center = new THREE.Vector3(0, 3.3, 0); stop.rotY = 0; }
      else if (stop.kind !== "project") { sectionZ -= SECTION_GAP; stop.center = new THREE.Vector3(0, 3.4, sectionZ); stop.rotY = 0; }
      else {
        const side = i % 2 ? -1 : 1;
        const [w, h] = cardSize(stop);
        stop.side = side;
        stop.rotY = -side * CARD_TURN;
        stop.center = new THREE.Vector3(side * (PATH_CLEARANCE + w / 2 * Math.cos(CARD_TURN)), CARD_LIFT + h / 2, projectZ(i));
      }
      stop.normal = new THREE.Vector3(Math.sin(stop.rotY), 0, Math.cos(stop.rotY));
      stop.color = neon[i % 3];
    });
    const endZ = sectionZ;
    // Intro, sections and contact are non-VR stops: the guide holds the headset there
    stops.forEach(stop => { if (!stop.experience) stop.experience = "non-vr"; });
    // City: every display stands at its place beside the road (route data), facing riders arriving along it
    if (cityMode) stops.forEach((stop, i) => {
      const r = city.stops[i], d = r.display, road = city.frameAt(r.s);
      stop.roadS = r.s;
      stop.rotY = d ? Math.atan2(d.nx, d.nz) : Math.atan2(-road.fwd.x, -road.fwd.z);
      stop.normal = new THREE.Vector3(Math.sin(stop.rotY), 0, Math.cos(stop.rotY));
      const base = road.pos.y;
      if (d && d.scale) stop.cardScale = d.scale;
      if (stop.kind === "project") { const [, h] = cardSize(stop); stop.center = new THREE.Vector3(d.x, base + CARD_LIFT + h / 2, d.z); stop.side = -d.side; }
      else stop.center = new THREE.Vector3(d ? d.x : road.pos.x, base + (stop.kind === "intro" || stop.kind === "outro" ? 3.6 : 3.4), d ? d.z : road.pos.z);
    });

    // Sky: ink overhead, violet and magenta haze on the horizon
    const sky = new THREE.Mesh(new THREE.SphereGeometry(450, 32, 16), new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { uInk: { value: ink }, uGlow: { value: neon[1] }, uHot: { value: neon[2] } },
      vertexShader: "varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
      fragmentShader: `uniform vec3 uInk; uniform vec3 uGlow; uniform vec3 uHot; varying vec3 vDir;
        void main(){ float h = vDir.y; float band = exp(-pow(h*7.0,2.0)); float haze = exp(-max(h,0.0)*3.5);
          vec3 col = uInk + uGlow*band*0.42 + uHot*exp(-pow((h+0.02)*16.0,2.0))*0.16 + uGlow*haze*0.05;
          gl_FragColor = vec4(col,1.0); }`
    }));
    if (cityMode) sky.position.copy(city.centre); else sky.position.z = endZ / 2;
    scene.add(sky);

    // Floor: neon grid that fades into the fog; slightly see-through so mirrored screens read as reflections
    const floorMaterial = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, fog: false,
      uniforms: { uLine: { value: hdr(neon[0], 0.55) }, uBase: { value: ink.clone().multiplyScalar(0.9) }, uFog: { value: ink }, uDensity: { value: scene.fog.density }, uTime: { value: 0 }, uPulse: { value: hdr(neon[2], 0.9) } },
      vertexShader: "varying vec3 vWorld; varying float vDepth; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vWorld = w.xyz; vec4 mv = viewMatrix * w; vDepth = -mv.z; gl_Position = projectionMatrix * mv; }",
      fragmentShader: `uniform vec3 uLine; uniform vec3 uBase; uniform vec3 uFog; uniform float uDensity; uniform float uTime; uniform vec3 uPulse;
        varying vec3 vWorld; varying float vDepth;
        void main(){
          vec2 c = vWorld.xz / 2.0;
          vec2 g = abs(fract(c - 0.5) - 0.5) / fwidth(c);
          float line = 1.0 - min(min(g.x, g.y), 1.0);
          float route = exp(-pow(vWorld.x * 0.55, 2.0));
          float pulse = route * smoothstep(0.92, 1.0, fract(vWorld.z * 0.02 + uTime * 0.18));
          vec3 col = uBase + uLine * line * (0.35 + route * 0.5) + uPulse * pulse * line * 1.4;
          float fog = 1.0 - exp(-pow(uDensity * vDepth, 2.0));
          col = mix(col, uFog, fog);
          gl_FragColor = vec4(col, mix(0.82, 1.0, fog));
        }`
    });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(220, Math.abs(endZ) + 140), floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.z = endZ / 2;
    floor.renderOrder = 1;
    if (!cityMode) scene.add(floor);   // the city has its own ground

    // Route: a thin light line down the centre of the walking path
    const routeCurve = new THREE.LineCurve3(new THREE.Vector3(0, 0.03, stops[0].center.z), new THREE.Vector3(0, 0.03, endZ));
    if (!cityMode) scene.add(new THREE.Mesh(new THREE.TubeGeometry(routeCurve, 1, 0.025, 5, false), new THREE.MeshBasicMaterial({ color: hdr(neon[0], 1.6), fog: true })));

    // ---------- Portals at the start and the end ----------
    const portalMaterials = [];
    function addPortal(center, color, rotY = 0) {
      const group = new THREE.Group();
      group.position.copy(center);
      group.rotation.y = rotY;
      const ring = new THREE.Mesh(new THREE.TorusGeometry(3.1, 0.05, 12, 160), new THREE.MeshBasicMaterial({ color: hdr(color, 2.2) }));
      const ringOuter = new THREE.Mesh(new THREE.TorusGeometry(3.45, 0.012, 8, 160), new THREE.MeshBasicMaterial({ color: hdr(color, 1.6) }));
      const veil = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
        uniforms: { uTime: { value: 0 }, uA: { value: color }, uB: { value: neon[1] } },
        vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
        fragmentShader: `uniform float uTime; uniform vec3 uA; uniform vec3 uB; varying vec2 vUv;
          void main(){ vec2 p = vUv - 0.5; float r = length(p) * 2.0; float a = atan(p.y, p.x);
            float swirl = 0.5 + 0.5 * sin(a * 3.0 + r * 9.0 - uTime * 0.9);
            float rim = smoothstep(0.62, 0.97, r) * (1.0 - smoothstep(0.97, 1.0, r));
            float inner = smoothstep(1.0, 0.2, r) * 0.025;
            vec3 col = mix(uB, uA, swirl) * (rim * (0.16 + swirl * 0.12) + inner * swirl);
            gl_FragColor = vec4(col, 1.0); }`
      });
      portalMaterials.push(veil);
      const disk = new THREE.Mesh(new THREE.CircleGeometry(3.08, 64), veil);
      group.add(ring, ringOuter, disk);
      scene.add(group);
      return group;
    }
    const portals = [addPortal(stops[0].center, neon[0], stops[0].rotY), addPortal(stops[stops.length - 1].center, neon[2], stops[stops.length - 1].rotY)];

    // ---------- Project screens ----------
    const screens = [];
    const beamMaterials = [];
    const maxTextureWidth = lite ? 960 : 1600;
    // Card edge: a thin accent border, dimmed below the bloom threshold so it reads as a border rather than a glow
    const CARD_BORDER = 0.035;
    const CARD_EDGE = 0.5;
    const unitPlane = keep(new THREE.PlaneGeometry(1, 1));
    // Soft dark plate behind each card: separates it from the scene with a shadow instead of a coloured halo
    const shadowTexture = canvasTexture(256, 256, g => {
      g.shadowColor = "#000";
      g.shadowBlur = 36;
      g.fillStyle = "#000";
      g.fillRect(64, 64, 128, 128);
    });
    // Sizes a card's layers around artwork drawn at w × h (the plate's dark core is the middle half of its texture)
    function sizeCard(entry, w, h) {
      entry.screen.scale.set(w, h, 1);
      entry.frame.scale.set(w + CARD_BORDER * 2, h + CARD_BORDER * 2, 1);
      entry.back.scale.copy(entry.frame.scale);
      entry.shadow.scale.set((w + CARD_BORDER * 2) * 2, (h + CARD_BORDER * 2) * 2, 1);
      if (entry.reflection) entry.reflection.scale.set(w, -h, 1);
    }
    stops.forEach((stop, i) => {
      if (stop.kind !== "project") return;
      const [w, h] = cardSize(stop);
      const group = new THREE.Group();
      group.position.copy(stop.center);
      group.rotation.y = stop.rotY;

      const frame = new THREE.Mesh(unitPlane, new THREE.MeshBasicMaterial({ color: hdr(stop.color, CARD_EDGE) }));
      frame.position.z = -0.02;
      const back = new THREE.Mesh(unitPlane, new THREE.MeshBasicMaterial({ color: ink }));
      back.position.z = -0.04;
      back.rotation.y = Math.PI;
      const screenMaterial = new THREE.MeshBasicMaterial({ color: ink.clone().multiplyScalar(2) });
      const screen = new THREE.Mesh(unitPlane, screenMaterial);
      screen.userData.stop = i;
      const shadow = new THREE.Mesh(unitPlane, new THREE.MeshBasicMaterial({ map: shadowTexture, color: 0x000000, transparent: true, opacity: 0.55, depthWrite: false }));
      shadow.position.z = -0.3;
      group.add(shadow, back, frame, screen);

      let reflection = null;
      if (!lite && !cityMode) {
        reflection = new THREE.Mesh(unitPlane, new THREE.MeshBasicMaterial({ color: ink.clone().multiplyScalar(2), transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide }));
        // Mirror image below the see-through floor
        reflection.rotation.y = stop.rotY;
        reflection.renderOrder = 0;
        scene.add(reflection);
      }

      // Light beam from above
      const beamHeight = 10;
      const beamMaterial = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
        uniforms: { uColor: { value: stop.color }, uStrength: { value: 0.012 } },
        vertexShader: `varying float vY; varying vec3 vNormal; varying vec3 vView;
          void main(){ vY = position.y / ${beamHeight.toFixed(1)} + 0.5; vNormal = normalize(normalMatrix * normal);
            vec4 mv = modelViewMatrix * vec4(position,1.0); vView = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
        fragmentShader: `uniform vec3 uColor; uniform float uStrength; varying float vY; varying vec3 vNormal; varying vec3 vView;
          void main(){ float facing = pow(abs(dot(vNormal, vView)), 3.0); float fall = vY * vY;
            gl_FragColor = vec4(uColor * uStrength * facing * fall, 1.0); }`
      });
      beamMaterials.push(beamMaterial);
      const beam = new THREE.Mesh(new THREE.ConeGeometry(w * 0.55, beamHeight, 40, 1, true), beamMaterial);
      beam.position.set(stop.center.x, stop.center.y + beamHeight / 2 - 1.2, stop.center.z - 0.4);
      scene.add(group, beam);
      const entry = { stop: i, group, screen, frame, back, shadow, reflection, beamMaterial, baseY: stop.center.y, w, h, material: screenMaterial };
      sizeCard(entry, w, h);
      screens.push(entry);
    });

    // Load artwork nearest to the starting stop first, downscaled so uploads stay light.
    let cancelled = false;
    function loadArtwork(entry) {
      const src = stops[entry.stop].image;
      if (!src) return Promise.resolve();
      return new Promise(resolve => {
        const img = new Image();
        img.decoding = "async";
        img.onload = () => {
          if (cancelled) return resolve();
          const scale = Math.min(1, maxTextureWidth / img.naturalWidth);
          const c = document.createElement("canvas");
          c.width = Math.round(img.naturalWidth * scale);
          c.height = Math.round(img.naturalHeight * scale);
          c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
          const tex = keep(new THREE.CanvasTexture(c));
          tex.colorSpace = THREE.SRGBColorSpace;
          tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
          // Show the whole artwork: the card shrinks to the image's proportions inside its w × h slot
          const screenAspect = entry.w / entry.h, imageAspect = c.width / c.height;
          if (imageAspect > screenAspect) sizeCard(entry, entry.w, entry.w / imageAspect);
          else sizeCard(entry, entry.h * imageAspect, entry.h);
          entry.material.map = tex;
          entry.material.color.setScalar(1);
          entry.material.needsUpdate = true;
          if (entry.reflection) { entry.reflection.material.map = tex; entry.reflection.material.color.setScalar(1); entry.reflection.material.needsUpdate = true; }
          resolve();
        };
        img.onerror = () => resolve();
        img.src = src;
      });
    }

    // ---------- Section stations: profile, experience, publications ----------
    function canvasTexture(width, height, paint) {
      const c = document.createElement("canvas");
      c.width = width; c.height = height;
      paint(c.getContext("2d"), width, height);
      const tex = keep(new THREE.CanvasTexture(c));
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 4;
      return tex;
    }
    function roundRect(g, x, y, w, h, r) {
      g.beginPath();
      g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
      g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
    }
    function glass(g, w, h, edge) {
      roundRect(g, 4, 4, w - 8, h - 8, 28);
      g.fillStyle = cssColor("--glass-strong");
      g.fill();
      g.lineWidth = 4;
      g.strokeStyle = edge;
      g.stroke();
    }
    function wrap(g, words, x, y, maxWidth, lineHeight, maxLines) {
      const parts = words.split(" ");
      let line = "", lines = 0;
      for (let n = 0; n < parts.length; n++) {
        const test = line ? line + " " + parts[n] : parts[n];
        if (g.measureText(test).width > maxWidth && line) {
          if (++lines === maxLines) { g.fillText(line + "…", x, y); return; }
          g.fillText(line, x, y); line = parts[n]; y += lineHeight;
        } else line = test;
      }
      g.fillText(line, x, y);
    }
    const floaters = [];
    const orbiters = [];
    // Experience cards and publication pages grow and come forward when hovered (or tapped on touch screens)
    const zoomables = [];
    stops.forEach(stop => {
      const c = stop.center;
      // Each section station is built around its own centre and turned to face the road (in the grid, straight on)
      const holder = new THREE.Group();
      holder.position.set(c.x, 0, c.z);
      holder.rotation.y = stop.kind === "profile" || stop.kind === "career" || stop.kind === "research" ? stop.rotY : 0;
      scene.add(holder);
      if (stop.kind === "profile") {
        // A glowing core wrapped in a wireframe shell, with the skills orbiting as neon chips
        const core = new THREE.Group();
        core.position.set(0, c.y, 0);
        const shell = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(1.7, 1)), new THREE.LineBasicMaterial({ color: hdr(neon[1], 1.8) }));
        const heart = new THREE.Mesh(new THREE.OctahedronGeometry(0.75), new THREE.MeshBasicMaterial({ color: hdr(neon[0], 2.4) }));
        const glow = new THREE.Mesh(new THREE.PlaneGeometry(7, 7), new THREE.MeshBasicMaterial({ map: haloTexture, color: neon[1], transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false }));
        glow.position.z = -0.5;
        core.add(glow, shell, heart);
        holder.add(core);
        floaters.push({ obj: core, baseY: c.y, spin: shell, heart });
        sections.skills.forEach((skill, n) => {
          const tex = canvasTexture(512, 112, (g, w, h) => {
            roundRect(g, 4, 4, w - 8, h - 8, 52);
            g.fillStyle = cssColor("--glass-strong"); g.fill();
            g.lineWidth = 4; g.strokeStyle = cssColor(["--accent", "--accent-2", "--accent-3"][n % 3]); g.stroke();
            g.fillStyle = cssColor("--text-1"); g.font = `500 40px ${fontMono}`; g.textAlign = "center"; g.textBaseline = "middle";
            g.fillText(skill, w / 2, h / 2 + 2, w - 40);
          });
          const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
          sprite.scale.set(2.1, 0.46, 1);
          scene.add(sprite);
          orbiters.push({ sprite, center: c, angle: (n / sections.skills.length) * Math.PI * 2, radius: 3.4 + (n % 2) * 0.9, lift: ((n % 3) - 1) * 1.1 });
        });
      }
      if (stop.kind === "career") {
        // The roles on a curved holographic wall (experience above, education below), facing the camera
        const focus = new THREE.Vector3(0, 0, 6);
        const radius = 7.5;
        const rows = [sections.roles.filter(r => !r.education), sections.roles.filter(r => r.education)];
        rows.forEach((row, rowIndex) => {
          row.forEach((role, n) => {
            const tex = canvasTexture(1024, 560, (g, w, h) => {
              glass(g, w, h, cssColor(role.education ? "--accent-2" : "--accent"));
              g.textBaseline = "alphabetic";
              g.fillStyle = cssColor("--accent"); g.font = `500 34px ${fontMono}`; g.fillText(role.dates.toUpperCase(), 56, 96);
              g.fillStyle = cssColor("--accent-2-light"); g.textAlign = "right"; g.fillText(role.type.toUpperCase(), w - 56, 96, 420); g.textAlign = "left";
              g.fillStyle = cssColor("--text-1"); g.font = `800 56px ${fontDisplay}`; wrap(g, role.role, 56, 200, w - 112, 66, 2);
              g.fillStyle = cssColor("--text-2"); g.font = `600 38px ${fontBody}`; wrap(g, role.org, 56, h - 110, w - 112, 46, 2);
            });
            const card = new THREE.Mesh(new THREE.PlaneGeometry(2.9, 1.59), new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide }));
            const angle = (n - (row.length - 1) / 2) * 0.4 + 0.12;
            card.position.set(focus.x + Math.sin(angle) * radius, rowIndex ? 1.7 : 4.15, focus.z - Math.cos(angle) * radius);
            card.rotation.y = -angle;
            holder.add(card);
            zoomables.push({ mesh: card, base: card.position.clone(), zoom: 0 });
            floaters.push({ obj: card, baseY: card.position.y, phase: n + rowIndex * 3 });
          });
        });
      }
      if (stop.kind === "research") {
        // Each paper as a tall floating page with its year outlined in neon
        sections.papers.forEach((paper, n) => {
          const tex = canvasTexture(768, 1024, (g, w, h) => {
            glass(g, w, h, cssColor(["--accent", "--accent-2", "--accent-3"][n % 3]));
            g.lineWidth = 3; g.strokeStyle = cssColor("--accent"); g.font = `800 150px ${fontDisplay}`; g.strokeText(paper.year, 52, 200);
            g.fillStyle = cssColor("--text-4"); g.font = `500 24px ${fontMono}`; wrap(g, paper.venue.toUpperCase(), 56, 270, w - 112, 34, 4);
            g.fillStyle = cssColor("--text-1"); g.font = `700 44px ${fontBody}`; wrap(g, paper.title, 56, 470, w - 112, 56, 8);
          });
          const page = new THREE.Mesh(new THREE.PlaneGeometry(3, 4), new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide }));
          const offset = n - (sections.papers.length - 1) / 2;
          page.position.set(offset * 3.9, c.y, -Math.abs(offset) * 1.2);
          page.rotation.set(0, -offset * 0.28, offset * 0.03);
          holder.add(page);
          zoomables.push({ mesh: page, base: page.position.clone(), zoom: 0 });
          floaters.push({ obj: page, baseY: c.y, phase: n * 1.7 });
        });
      }
    });

    // ---------- Guide character ----------
    const lightRig = new THREE.Group();
    const hemi = new THREE.HemisphereLight(neon[0], neon[1], 1.1);
    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    const rim = new THREE.PointLight(neon[2], 18, 9, 2);
    lightRig.add(hemi, key, key.target, rim);
    if (cityMode) { hemi.intensity = 0.25; key.intensity = 1.2; }
    scene.add(lightRig);
    const guide = { model: null, mixer: null, actions: {}, current: null, pos: new THREE.Vector3(), yaw: 0, k: 0, idleFor: 0, arrived: -1, gestures: 0 };
    function standPoint(i, out) {
      const stop = stops[i];
      // City: the travel controller measures straight lines between stand points, so they sit on a line at their
      // distances along the road; the bike is placed on the road itself from that distance
      if (cityMode) return out.set(stop.roadS, 0, 0);
      const c = stop.center;
      // On the path, a step across from the card and a little in front of it, so the card never sits behind the guide
      // and the guide stands nearer the camera than the card does
      if (stop.kind === "project") return out.set(-stop.side * GUIDE_OFFSET, 0, c.z + 3.2);
      if (stop.kind === "career") return out.set(c.x + 1.8, 0, c.z + 1.6);
      if (stop.kind === "research") return out.set(c.x + 1.95, 0, c.z + 2.6);
      if (stop.kind === "profile") return out.set(c.x + 2.4, 0, c.z + 2.4);
      return out.set(c.x + 2.3, 0, c.z + 1.2);
    }
    function play(name, fade = 0.35) {
      const next = guide.actions[name];
      if (!next || guide.current === next) return;
      next.reset().setEffectiveWeight(1).fadeIn(fade).play();
      if (guide.current) guide.current.fadeOut(fade);
      guide.current = next;
    }
    function gesture(name) {
      const action = guide.actions[name];
      if (!action) return;
      action.setLoop(name === "Dance" ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
      action.clampWhenFinished = true;
      play(name, 0.25);
    }
    const loadGuide = () => new GLTFLoader().load(GUIDE_URL, gltf => {
      if (cancelled) return;
      const model = gltf.scene;
      const box = new THREE.Box3().setFromObject(model);
      model.scale.setScalar(1.85 / Math.max(0.01, box.max.y - box.min.y));
      // Neon-noir finish: violet body, dark joints with a cyan glow
      model.traverse(obj => {
        if (!obj.isMesh) return;
        obj.frustumCulled = false;
        const mats = [].concat(obj.material).map(m => {
          const mat = m.clone();
          if (/main/i.test(mat.name)) { mat.color.copy(neon[1]).multiplyScalar(0.55); mat.emissive.copy(neon[1]).multiplyScalar(0.16); mat.metalness = 0.45; mat.roughness = 0.35; }
          else if (/black/i.test(mat.name)) { mat.color.copy(ink); mat.emissive.copy(neon[0]).multiplyScalar(0.55); }
          else { mat.color.copy(ink).multiplyScalar(5); mat.metalness = 0.6; mat.roughness = 0.3; }
          return mat;
        });
        obj.material = mats.length === 1 ? mats[0] : mats;
      });
      guide.mixer = new THREE.AnimationMixer(model);
      gltf.animations.forEach(clip => { guide.actions[clip.name] = guide.mixer.clipAction(clip); });
      guide.mixer.addEventListener("finished", () => play("Idle", 0.4));
      travel.position(guide.pos);
      model.position.copy(guide.pos);
      scene.add(model);
      guide.model = model;
      play("Idle", 0);
      if (still) guide.mixer.update(0);
    }, undefined, () => { /* the journey works without the guide */ });

    // ---------- Atmosphere: dust and sculptures ----------
    const dustCount = lite ? 380 : 1600;
    const dustPositions = new Float32Array(dustCount * 3);
    const dustColors = new Float32Array(dustCount * 3);
    const dustSeeds = new Float32Array(dustCount);
    for (let i = 0; i < dustCount; i++) {
      dustPositions[i * 3] = (Math.random() - 0.5) * 60;
      dustPositions[i * 3 + 1] = Math.random() * 14;
      dustPositions[i * 3 + 2] = 18 - Math.random() * (Math.abs(endZ) + 40);
      const c = neon[Math.floor(Math.random() * 3)].clone().lerp(new THREE.Color(1, 1, 1), 0.35);
      dustColors.set([c.r, c.g, c.b], i * 3);
      dustSeeds[i] = Math.random() * 100;
    }
    const dustGeometry = new THREE.BufferGeometry();
    dustGeometry.setAttribute("position", new THREE.BufferAttribute(dustPositions, 3));
    dustGeometry.setAttribute("color", new THREE.BufferAttribute(dustColors, 3));
    dustGeometry.setAttribute("seed", new THREE.BufferAttribute(dustSeeds, 1));
    const dustMaterial = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexColors: true,
      uniforms: { uTime: { value: 0 }, uMap: { value: dotTexture }, uScale: { value: window.innerHeight * 0.5 }, uFog: { value: scene.fog.density } },
      vertexShader: `attribute float seed; uniform float uTime; uniform float uScale; varying vec3 vColor; varying float vFade; uniform float uFog;
        void main(){ vec3 p = position; p.y = mod(p.y + uTime * (0.12 + fract(seed) * 0.25), 14.0); p.x += sin(uTime * 0.2 + seed) * 0.6;
          vec4 mv = modelViewMatrix * vec4(p,1.0); float d = -mv.z; vFade = exp(-pow(uFog * d, 2.0)) * (0.35 + 0.65 * fract(seed * 7.13));
          vColor = color; gl_PointSize = (0.05 + fract(seed * 3.7) * 0.07) * uScale / d; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: "uniform sampler2D uMap; varying vec3 vColor; varying float vFade; void main(){ float a = texture2D(uMap, gl_PointCoord).a; gl_FragColor = vec4(vColor * a * vFade, 1.0); }"
    });
    if (!cityMode) scene.add(new THREE.Points(dustGeometry, dustMaterial));

    const sculptures = [];
    const sculptureCount = cityMode ? 0 : lite ? 4 : 9;
    const shapes = [() => new THREE.IcosahedronGeometry(5, 1), () => new THREE.TorusKnotGeometry(3.6, 0.9, 90, 8), () => new THREE.OctahedronGeometry(5.5, 0), () => new THREE.TorusGeometry(6, 0.4, 6, 40)];
    for (let i = 0; i < sculptureCount; i++) {
      const geometry = shapes[i % shapes.length]();
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geometry, 12), new THREE.LineBasicMaterial({ color: hdr(neon[i % 3], 1.25), transparent: true, opacity: 0.55, fog: true }));
      geometry.dispose();
      const side = i % 2 ? -1 : 1;
      edges.position.set(side * (20 + (i * 7) % 14), 7 + (i * 5) % 8, 6 - i * (Math.abs(endZ) / sculptureCount));
      edges.rotation.set(i * 0.7, i * 1.3, 0);
      edges.userData.spin = (i % 2 ? 1 : -1) * (0.04 + (i % 3) * 0.02);
      scene.add(edges);
      sculptures.push(edges);
    }

    // ---------- Post-processing ----------
    const composer = new EffectComposer(renderer);
    composer.setPixelRatio(pixelRatio);
    composer.setSize(window.innerWidth, window.innerHeight);
    composer.addPass(new RenderPass(scene, camera));
    // Threshold 1.0: only HDR lights (portals, route, particles) bloom; project artwork tops out at 1.0 and stays crisp
    const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), lite ? 0.55 : 0.7, 0.42, 1.0);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
    // Film finish: soft focus toward the edges (cheap depth-of-field look), slight colour fringing, vignette and grain
    const finish = new ShaderPass({
      uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uRes: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) }, uGrain: { value: still ? 0 : 0.045 }, uVignette: { value: 0.85 }, uAberration: { value: lite ? 0 : 0.0035 }, uBlur: { value: lite ? 0 : 0.0042 } },
      vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
      fragmentShader: `uniform sampler2D tDiffuse; uniform float uTime; uniform vec2 uRes; uniform float uGrain; uniform float uVignette; uniform float uAberration; uniform float uBlur; varying vec2 vUv;
        float rand(vec2 co){ return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453); }
        void main(){
          vec2 d = vUv - 0.5; float r = length(d * vec2(uRes.x / uRes.y, 1.0));
          vec2 fringe = d * uAberration * r;
          float b = uBlur * smoothstep(0.45, 1.0, r);
          vec3 col = vec3(0.0);
          for (int i = 0; i < 8; i++) {
            float a = float(i) * 0.7853982; vec2 o = vec2(cos(a), sin(a)) * b;
            col += vec3(texture2D(tDiffuse, vUv + o + fringe).r, texture2D(tDiffuse, vUv + o).g, texture2D(tDiffuse, vUv + o - fringe).b);
          }
          col /= 8.0;
          col *= mix(1.0, smoothstep(1.15, 0.3, r), uVignette);
          col += (rand(vUv * uRes + fract(uTime) * 91.7) - 0.5) * uGrain;
          gl_FragColor = vec4(col, 1.0);
        }`
    });
    composer.addPass(finish);

    // ---------- Camera ----------
    // The camera always frames the guide (it reads the travel controller, never the scroll), so it can't run ahead.
    // Travelling: behind and above the guide, looking a little way down the path.
    // At a project stop: beside the guide on the side away from the card, looking across the path at the card.
    // Portals and section stations keep their fixed wide shots, which the follow camera blends into.
    const tmpA = new THREE.Vector3();
    // fov: following and project framings use a slightly wider lens than the section shots, to fit card and guide
    const FOLLOW = lite ? { up: 2.7, back: 8.2, ahead: 3, lookY: 0.15, fov: 56 } : { up: 2.1, back: 4.8, ahead: 3, lookY: 0.75, fov: 46 };
    // Desktop values were solved for 16:10 so the card clears the top bar and the panel and the guide's feet clear the hint
    const STOP_VIEW = lite ? { side: 0.9, up: 2.9, back: 9.6, aim: 0.55, lift: -1.7, fov: 56 } : { side: 1.6, up: 1.8, back: 5.5, aim: 0.65, lift: -1.3, fov: 50 };
    const STOP_VIEW_POSTER = lite ? STOP_VIEW : { ...STOP_VIEW, back: 6.5, lift: -1.0 };   // posters are taller
    const baseFov = () => (window.innerWidth < 760 ? 56 : 42);
    let framingFov = FOLLOW.fov;
    const FRAMING_NEAR = 2;          // metres from a stop where its framing has fully taken over
    const FRAMING_FAR = 9;           // metres from a stop where its framing starts to blend in
    const CAMERA_DAMPING = 0.0065;   // per ms: how quickly the camera eases onto its framing
    const smoothstep = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
    function shotFor(i, outPos, outTarget) {
      const stop = stops[i];
      const c = stop.center;
      if (stop.kind === "intro" || stop.kind === "outro") {
        outPos.set(c.x, c.y + 0.1, c.z + 12);
        outTarget.set(c.x, c.y, c.z);
        return;
      }
      // Section stations: a straight-on wide shot; the experience wall needs the most room
      const back = (stop.kind === "career" ? 10.5 : 12) + (lite ? 4 : 0);
      outPos.set(c.x, c.y + 0.6, c.z + back);
      outTarget.set(c.x + (lite ? 0 : -2.4), c.y - (lite ? 2 : 1.5), c.z);
    }
    const followPos = new THREE.Vector3(), followTarget = new THREE.Vector3(), stopPos = new THREE.Vector3(), stopTarget = new THREE.Vector3();
    function framing(at, outPos, outTarget) {
      followPos.set(at.x, FOLLOW.up, at.z + FOLLOW.back);
      followTarget.set(at.x, FOLLOW.lookY, at.z - FOLLOW.ahead);
      const j = travel.nearest;
      const w = still ? 1 : smoother(1 - smoothstep(FRAMING_NEAR, FRAMING_FAR, travel.distanceTo(j)));
      if (w <= 0) { outPos.copy(followPos); outTarget.copy(followTarget); framingFov = FOLLOW.fov; return; }
      const stop = stops[j];
      framingFov = FOLLOW.fov + ((stop.kind === "project" ? STOP_VIEW.fov : baseFov()) - FOLLOW.fov) * w;
      if (stop.kind === "project") {
        const view = stop.poster ? STOP_VIEW_POSTER : STOP_VIEW;
        stopPos.set(at.x - stop.side * view.side, view.up, at.z + view.back);
        stopTarget.set(at.x, 1, at.z).lerp(stop.center, view.aim);
        stopTarget.y += view.lift;
      } else shotFor(j, stopPos, stopTarget);
      outPos.lerpVectors(followPos, stopPos, w);
      outTarget.lerpVectors(followTarget, stopTarget, w);
    }

    // ---------- Overlay UI ----------
    const ui = document.createElement("div");
    ui.className = "journey-ui";
    ui.setAttribute("role", "region");
    ui.setAttribute("aria-label", "3D journey");
    ui.tabIndex = -1;
    const projectTotal = String(projects.length).padStart(2, "0");
    ui.innerHTML = `
      <div class="journey-ui__top"><span class="journey-ui__brand">3D Journey</span><span class="journey-ui__count" aria-hidden="true"></span>
        <button type="button" class="journey-ui__sound" aria-pressed="false"><span class="journey-ui__eq" aria-hidden="true"><i></i><i></i><i></i><i></i></span><span class="journey-ui__sound-label">Sound off</span></button>
        ${cityMode ? `<button type="button" class="journey-ui__view" aria-pressed="false" aria-label="Camera view: riding. Press to switch to the overview">View · Ride</button>` : ""}</div>
      <div class="journey-ui__panel" aria-live="polite"></div>
      <nav class="journey-ui__progress" aria-label="Journey stops"><div class="journey-ui__track" aria-hidden="true"><i></i></div><div class="journey-ui__ticks"></div></nav>
      <p class="journey-ui__hint" aria-hidden="true">${coarsePointer.matches ? (cityMode ? "Swipe to ride" : "Swipe to travel") : cityMode ? "Scroll or use arrow keys to ride · V changes the view · Esc to exit" : "Scroll or use arrow keys to travel · Esc to exit"}</p>
      ${cityMode ? `<p class="journey-ui__credit">City: <a href="https://sketchfab.com/3d-models/cyberpunk-city-1-14d2eaa145ee42938e004115871adf6c" target="_blank" rel="noopener noreferrer">“Cyberpunk City - #1” by born2012</a>, <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">CC BY 4.0</a></p>` : ""}`;
    const panel = ui.querySelector(".journey-ui__panel");
    const count = ui.querySelector(".journey-ui__count");
    const trackFill = ui.querySelector(".journey-ui__track i");
    const ticks = ui.querySelector(".journey-ui__ticks");
    const dwellRing = document.createElement("i");
    dwellRing.className = "journey-ui__dwell";
    dwellRing.setAttribute("aria-hidden", "true");
    ui.querySelector(".journey-ui__progress").appendChild(dwellRing);
    const escapeHtml = text => text.replace(/[&<>"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]);
    stops.forEach((stop, i) => {
      const tick = document.createElement("button");
      tick.type = "button";
      tick.className = "journey-ui__tick journey-ui__tick--" + stop.kind;
      const label = stop.kind === "project" ? stop.title : stop.kind === "intro" ? "Start" : stop.label;
      tick.setAttribute("aria-label", stop.kind === "project" ? `Go to project ${stop.num}: ${stop.title}` : `Go to ${label}`);
      tick.dataset.label = label;
      tick.addEventListener("click", () => goTo(i));
      ticks.appendChild(tick);
    });
    const heroLead = document.querySelector(".hero .lead")?.textContent.trim() || "";
    const footerKicker = document.querySelector(".footer .kicker")?.textContent.trim() || "";
    const email = document.querySelector(".footer-email");
    function panelHtml(stop) {
      if (stop.kind === "intro") {
        return `<p class="journey-ui__kicker">${escapeHtml(document.querySelector(".hero-kicker")?.textContent.trim() || "")}</p>
          <h2 class="journey-ui__title">Building Worlds <span class="grad">You Can Step Into</span></h2>
          <p class="journey-ui__desc">${escapeHtml(heroLead)}</p>`;
      }
      if (stop.kind === "profile") {
        return `<p class="journey-ui__kicker">${escapeHtml(text(document.querySelector("#profile .kicker")))}</p>
          <h2 class="journey-ui__title">Imagine. Build. <span class="grad">Immerse.</span></h2>
          <p class="journey-ui__desc">${escapeHtml(sections.profileLead)}</p>
          <ul class="journey-ui__chips">${sections.skills.map(sk => `<li>${escapeHtml(sk)}</li>`).join("")}</ul>
          <div class="journey-ui__actions"><button type="button" class="journey-ui__open journey-ui__open--ghost" data-goto="#profile">Open profile</button></div>`;
      }
      if (stop.kind === "career") {
        return `<p class="journey-ui__kicker">${escapeHtml(text(document.querySelector("#experience .kicker")))}</p>
          <h2 class="journey-ui__title">Experience <span class="grad">&amp; Education</span></h2>
          <ul class="journey-ui__list">${sections.roles.map(r => `<li><span>${escapeHtml(r.dates)}</span><b>${escapeHtml(r.role)}</b>${escapeHtml(r.org)}</li>`).join("")}</ul>
          <div class="journey-ui__actions"><button type="button" class="journey-ui__open journey-ui__open--ghost" data-goto="#experience">Open experience</button></div>`;
      }
      if (stop.kind === "research") {
        return `<p class="journey-ui__kicker">${escapeHtml(text(document.querySelector("#papers .kicker")))}</p>
          <h2 class="journey-ui__title"><span class="grad">Publications</span></h2>
          <ul class="journey-ui__list">${sections.papers.map(pa => `<li><span>${escapeHtml(pa.year)}</span>${pa.href ? `<a href="${pa.href}" target="_blank" rel="noopener noreferrer">${escapeHtml(pa.title)} ↗</a>` : escapeHtml(pa.title)}</li>`).join("")}</ul>
          <div class="journey-ui__actions"><button type="button" class="journey-ui__open journey-ui__open--ghost" data-goto="#papers">Open publications</button></div>`;
      }
      if (stop.kind === "outro") {
        return `<p class="journey-ui__kicker">${escapeHtml(footerKicker)}</p>
          <h2 class="journey-ui__title">Get in <span class="grad">touch.</span></h2>
          <div class="journey-ui__actions">${email ? `<a class="journey-ui__open" href="${email.href}">${escapeHtml(email.textContent.trim())}</a>` : ""}<button type="button" class="journey-ui__open journey-ui__open--ghost" data-exit>Back to the site</button></div>`;
      }
      return `<p class="journey-ui__kicker"><span>${escapeHtml(stop.num.padStart(2, "0"))}</span>${escapeHtml(stop.tags)}</p>
        <h2 class="journey-ui__title">${escapeHtml(stop.title)}</h2>
        <p class="journey-ui__desc">${escapeHtml(stop.desc)}</p>
        <div class="journey-ui__actions"><a class="journey-ui__open" href="${projectLink(stop)}">Open case study ↗</a></div>`;
    }
    function projectLink(stop) {
      const url = new URL(stop.href, window.location.href);
      url.searchParams.set("returnIsland", String(stop.index));
      return url.toString();
    }
    let shownStop = -1;
    let panelTimer = 0;
    function showStop(i) {
      if (i === shownStop) return;
      shownStop = i;
      const stop = stops[i];
      count.textContent = stop.kind === "project" ? `${stop.num.padStart(2, "0")} / ${projectTotal}` : stop.kind === "intro" ? `00 / ${projectTotal}` : stop.label;
      [...ticks.children].forEach((t, k) => { t.classList.toggle("is-active", k === i); t.toggleAttribute("aria-current", k === i); });
      panel.classList.add("is-changing");
      clearTimeout(panelTimer);
      panelTimer = setTimeout(() => {
        // The panel sits on the active card's side of the screen; the guide has the other side. In the city the
        // panel goes on the side of the arrival shot away from the character, so the rider stays in view
        let right = stop.kind === "project" && stop.side > 0;
        if (cityMode && stop.kind === "project") {
          const probe = new THREE.PerspectiveCamera(framingFov, camera.aspect, 0.1, 200), shotPos = new THREE.Vector3(), shotTarget = new THREE.Vector3();
          city.stationShot(i, shotPos, shotTarget, window.innerWidth < window.innerHeight, framingFov, camera.aspect);
          probe.position.copy(shotPos); probe.lookAt(shotTarget); probe.updateMatrixWorld();
          right = city.stationSpots(i).character.clone().project(probe).x < 0.1;
        }
        panel.classList.toggle("journey-ui__panel--right", right);
        panel.innerHTML = panelHtml(stop);
        panel.querySelector("[data-exit]")?.addEventListener("click", () => exit());
        panel.querySelector("[data-goto]")?.addEventListener("click", event => exit(event.currentTarget.dataset.goto));
        panel.classList.remove("is-changing");
      }, still ? 0 : 220);
    }

    // ---------- Input: wheel, touch, keys, clicks ----------
    // Input only moves the travel controller (journey-travel.js); the guide, camera and panel all follow it.
    const last = stops.length - 1;
    const travel = travelModule.createTravel({ THREE, count: stops.length, standPoint });
    const TRAVEL = travelModule.TRAVEL;
    // City: the motorcycle's speeds and distances (restored on exit); commit, settle, gesture and dwell rules unchanged
    const travelDefaults = { ...TRAVEL };
    if (cityMode) Object.assign(TRAVEL, cityModule.BIKE_TRAVEL);
    const startStop = startStopFor(stops);
    travel.jumpTo(startStop);
    // Scroll is travel distance: NOTCHES_PER_STATION wheel notches cover one station gap
    const GAP = cityMode ? (stops[stops.length - 1].roadS - stops[0].roadS) / (stops.length - 1) : SPACING;   // a typical gap between stops
    const METRES_PER_PIXEL = GAP / (TRAVEL.NOTCHES_PER_STATION * TRAVEL.NOTCH_PIXELS);
    const TRANSITION_SPEED = 1.1;             // m/s while the headset goes on or comes off
    const PUT_ON_DISTANCE = 2.8;              // metres before a VR stop where the headset goes on
    const TAKE_OFF_DISTANCE = 3.4;            // metres past a VR stop where it comes off again
    const PANEL_HIDE_SPEED = 1.5;             // m/s above which the info panel steps aside for the guide
    let wheelBank = 0;
    let cutTimer = 0;
    let pendingJump = null;
    let snapCamera = true;
    const wornAt = i => stops[i].experience === "vr";
    // Shortcuts (keys, ticks, card clicks): ride to a neighbouring stop, teleport further, cut when motion is reduced
    function goTo(i) {
      i = Math.max(0, Math.min(last, Math.round(i)));
      if (still) { cutTo(i); return; }
      if (!travel.goTo(i)) pendingJump = i;
    }
    function cutTo(i) {
      if (cutTimer || i === travel.target) return;
      canvas.classList.add("is-cutting");
      cutTimer = setTimeout(() => { travel.jumpTo(i, performance.now(), true); snapCamera = true; canvas.classList.remove("is-cutting"); cutTimer = 0; }, 320);
    }
    function onWheel(event) {
      if (event.ctrlKey) return;
      const list = event.target instanceof Element ? event.target.closest(".journey-ui__list, .journey-ui__chips") : null;
      if (list && list.scrollHeight > list.clientHeight) return;
      event.preventDefault();
      // Line-based wheels (Firefox: 3 lines a notch) are scaled so one notch is NOTCH_PIXELS, as in Chromium
      const linePixels = TRAVEL.NOTCH_PIXELS / 3;
      const delta = (event.deltaMode === 1 ? event.deltaY * linePixels : event.deltaY) || (event.deltaMode === 1 ? event.deltaX * linePixels : event.deltaX);
      if (still) {
        // Reduced motion: one gesture is one cut to the next stop; the dwell after it ignores the rest of the gesture
        if (!travel.gate(performance.now())) { wheelBank = 0; return; }
        wheelBank += delta;
        if (Math.abs(wheelBank) > 60) { goTo(travel.target + Math.sign(wheelBank)); wheelBank = 0; }
        return;
      }
      travel.nudge(delta * METRES_PER_PIXEL, performance.now());
    }
    let touchY = null;
    function onTouchStart(event) { touchY = event.touches[0].clientY; }
    function onTouchMove(event) {
      if (touchY === null) return;
      event.preventDefault();
      const y = event.touches[0].clientY;
      if (!still) travel.nudge((touchY - y) / (window.innerHeight * 0.75) * GAP, performance.now());
      else if (travel.gate(performance.now())) wheelBank += touchY - y;
      touchY = y;
    }
    function onTouchEnd() {
      touchY = null;
      if (still) { if (Math.abs(wheelBank) > 40) goTo(travel.target + Math.sign(wheelBank)); wheelBank = 0; }
    }
    function onKey(event) {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      const k = event.key;
      if (k === "Escape") { event.preventDefault(); exit(); return; }
      const inUi = event.target instanceof HTMLElement && event.target.closest("a,button") && (k === " " || k === "Enter");
      if (inUi) return;
      if (["ArrowRight", "ArrowDown", "PageDown", " "].includes(k)) { event.preventDefault(); goTo(travel.target + 1); }
      else if (["ArrowLeft", "ArrowUp", "PageUp"].includes(k)) { event.preventDefault(); goTo(travel.target - 1); }
      else if (k === "Home") { event.preventDefault(); goTo(0); }
      else if (k === "End") { event.preventDefault(); goTo(last); }
      else if (k === "m" || k === "M") toggleSound();
      else if ((k === "v" || k === "V") && cityMode) toggleView();
      else if (k === "Enter" && stops[shownStop]?.kind === "project") window.location.assign(projectLink(stops[shownStop]));
    }
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const parallax = { x: 0, y: 0 };
    let hovered = null;       // a project screen under the pointer
    let hoveredCard = null;   // an Experience card or publication page under the pointer (or tapped)
    function pickAt(event) {
      pointer.set((event.clientX / window.innerWidth) * 2 - 1, -(event.clientY / window.innerHeight) * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects([...screens.map(s => s.screen), ...zoomables.map(z => z.mesh)], false)[0];
      if (!hit) return {};
      return { screen: screens.find(s => s.screen === hit.object) || null, card: zoomables.find(z => z.mesh === hit.object) || null };
    }
    const pick = event => pickAt(event).screen;
    function onPointerMove(event) {
      parallax.x = (event.clientX / window.innerWidth - 0.5) * 2;
      parallax.y = (event.clientY / window.innerHeight - 0.5) * 2;
      if (coarsePointer.matches) return;
      const hit = pickAt(event);
      hovered = hit.screen || null;
      hoveredCard = hit.card || null;
      canvas.style.cursor = hovered || hoveredCard ? "pointer" : "";
    }
    function onCanvasClick(event) {
      const hit = pickAt(event);
      // touch screens have no hover: a tap enlarges a card, another tap shrinks it
      if (hit.card) { hoveredCard = hoveredCard === hit.card ? null : hit.card; return; }
      if (!hit.screen) { if (coarsePointer.matches) hoveredCard = null; return; }
      if (hit.screen.stop === shownStop) window.location.assign(projectLink(stops[hit.screen.stop]));
      else goTo(hit.screen.stop);
    }

    // ---------- Sound ----------
    const soundButton = ui.querySelector(".journey-ui__sound");
    const soundLabel = ui.querySelector(".journey-ui__sound-label");
    let soundtrack = null;
    try { soundtrack = audio ? audio.createSoundtrack() : null; } catch (e) { soundtrack = null; }
    let soundPref = "on";
    try { soundPref = localStorage.getItem("journey-sound") || "on"; } catch (e) { /* storage unavailable */ }
    function setSound(on) {
      if (!soundtrack) return;
      soundtrack.setEnabled(on);
      soundButton.setAttribute("aria-pressed", String(on));
      soundButton.classList.toggle("is-on", on);
      soundLabel.textContent = on ? "Sound on" : "Sound off";
      try { localStorage.setItem("journey-sound", on ? "on" : "off"); } catch (e) { /* storage unavailable */ }
    }
    function toggleSound() { if (soundtrack) setSound(!soundtrack.enabled); }
    if (soundtrack) { soundButton.addEventListener("click", toggleSound); setSound(soundPref !== "off"); }
    else soundButton.hidden = true;
    const wake = () => { if (soundtrack) soundtrack.resume(); };
    ["pointerdown", "keydown", "touchstart", "wheel"].forEach(type => window.addEventListener(type, wake, { passive: true }));
    let heardStop = startStop;

    // ---------- Resize and adaptive quality ----------
    function resize() {
      const w = window.innerWidth, h = window.innerHeight;
      renderer.setSize(w, h, false);
      composer.setSize(w, h);
      camera.aspect = w / h;
      camera.fov = w < 760 ? 56 : 42;
      camera.updateProjectionMatrix();
      finish.uniforms.uRes.value.set(w, h);
      dustMaterial.uniforms.uScale.value = h * 0.5 * pixelRatio;
    }
    let slowFrames = 0;
    let qualityStep = 0;
    function adapt(dt) {
      // Aim for 60fps: if frames stay slow, shed the most expensive extras one at a time.
      slowFrames = dt > 22 ? slowFrames + 1 : Math.max(0, slowFrames - 2);
      if (slowFrames < 90 || qualityStep > 3) return;
      slowFrames = 0;
      qualityStep++;
      if (qualityStep === 1) finish.uniforms.uBlur.value = 0;
      else if (qualityStep === 2 || qualityStep === 3) {
        pixelRatio = Math.max(0.75, pixelRatio - 0.25);
        renderer.setPixelRatio(pixelRatio);
        composer.setPixelRatio(pixelRatio);
        resize();
      } else bloom.enabled = false;
    }

    // ---------- City: riding, stations and camera ----------
    // Views: "ride" (riding camera, corner swings and station arrivals) or "overview" (high above the bike)
    let view = "ride";
    const viewButton = ui.querySelector(".journey-ui__view");
    function toggleView() {
      view = view === "ride" ? "overview" : "ride";
      if (!viewButton) return;
      viewButton.textContent = view === "ride" ? "View · Ride" : "View · Overview";
      viewButton.setAttribute("aria-pressed", String(view === "overview"));
      viewButton.setAttribute("aria-label", view === "ride" ? "Camera view: riding. Press to switch to the overview" : "Camera view: overview. Press to switch back to riding");
    }
    if (viewButton) viewButton.addEventListener("click", toggleView);
    const ride = { lastStop: startStop, back: false, turn: 0, parked: -1 };
    const bikeAt = new THREE.Vector3(), cityFollowPos = new THREE.Vector3(), cityFollowTarget = new THREE.Vector3();
    const cityStopPos = new THREE.Vector3(), cityStopTarget = new THREE.Vector3();
    // Speed cap: the bike slows for bends and eases into stops (the travel controller does the rest)
    function cityCap(roadS) {
      const goal = stops[travel.target].roadS, home = stops[ride.lastStop].roadS;
      return city.speedCap({ s: roadS, v: travel.v, goal, home, riding: travel.phase === "ride" });
    }
    // Place the bike for this frame: riding along the road, or parked at the station with the character beside it
    function cityRide(dt, roadS, near) {
      if (travel.phase !== "ride") ride.lastStop = travel.target;
      // riding back to an earlier stop turns the bike round; the short roll back after an uncommitted scroll doesn't
      if (travel.v < -0.3) ride.back = travel.target < ride.lastStop; else if (travel.v > 0.3) ride.back = false;
      ride.turn += ((ride.back ? 1 : 0) - ride.turn) * (still ? 1 : 1 - Math.exp(-dt * 0.004));
      const atStation = travel.phase !== "ride" && travel.distanceTo(near) < 0.05;
      if (atStation) {
        if (ride.parked !== near) { city.parkAt(near); ride.parked = near; }
        bikeAt.copy(city.park.position);
      } else {
        if (ride.parked !== -1) { city.unpark(); ride.parked = -1; }
        bikeAt.copy(city.poseBike(roadS, travel.v, dt / 1000, ride.turn));
      }
      return atStation;
    }
    function cityFraming(roadS, near, dt, outPos, outTarget) {
      const facing = Math.cos(ride.turn * Math.PI);
      framingFov = lite || window.innerWidth < 760 ? 60 : 50;
      if (view === "overview") { city.overviewShot(roadS, facing, bikeAt, outPos, outTarget); return; }
      const from = stops[ride.lastStop].roadS, to = stops[travel.target].roadS, legLength = Math.abs(to - from);
      city.rideShot(roadS, facing, bikeAt, dt, cityFollowPos, cityFollowTarget, Math.min(ride.lastStop, travel.target), legLength > 0 ? Math.abs(roadS - from) / legLength : 0, legLength);
      // the station shot takes over in the last metres before a stop and hands back within a few metres of leaving;
      // until the bike has stopped, the look target stays partly on it so the camera never gets ahead of the rider
      const gap = Math.abs(roadS - stops[near].roadS), leaving = (roadS - stops[near].roadS) * travel.v > 0;
      const w = still ? (gap < 0.5 ? 1 : 0) : smoother(1 - smoothstep(0.5, leaving ? 3 : 12, gap));
      outPos.copy(cityFollowPos); outTarget.copy(cityFollowTarget);
      if (w > 0) {
        city.stationShot(near, cityStopPos, cityStopTarget, window.innerWidth < window.innerHeight, framingFov, camera.aspect);
        outPos.lerp(cityStopPos, w); outTarget.lerp(cityStopTarget, w);
        outTarget.lerp(bikeAt, Math.min(1, gap / 6) * 0.6);
      }
    }

    // ---------- Frame loop ----------
    const camPos = new THREE.Vector3(), camTarget = new THREE.Vector3();
    const posA = new THREE.Vector3(), tgtA = new THREE.Vector3(), guidePos = new THREE.Vector3();
    const smoother = t => t * t * t * (t * (t * 6 - 15) + 10);
    let frame = 0;
    let lastTime = performance.now();
    let elapsed = 0;
    let worn = wornAt(startStop);
    let lastDwellTick = null;
    function draw(now) {
      frame = requestAnimationFrame(draw);
      const dt = Math.max(0, Math.min(64, now - lastTime));   // never negative, never more than 64 ms
      lastTime = now;
      if (!still) elapsed += dt / 1000;

      // Travel: a far jump teleports once the guide is free; headset changes slow it to a walk; a teleport holds it
      if (pendingJump !== null && (cityMode || !(explorer && explorer.busy))) {
        const i = pendingJump;
        pendingJump = null;
        const jump = () => { travel.jumpTo(i, performance.now(), true); worn = wornAt(i); snapCamera = true; };
        if (explorer && !cityMode) explorer.teleport(wornAt(i), jump);
        else jump();
      }
      // (With reduced motion the guide only cuts between stops, so this just times the dwell after each cut)
      const roadS = cityMode ? stops[0].roadS + travel.s : 0;
      travel.update(dt, now, cityMode ? cityCap(roadS) : explorer && explorer.busy ? (explorer.teleporting ? 0 : TRANSITION_SPEED) : TRAVEL.MAX_SPEED);
      travel.position(guidePos);
      const k = travel.k;

      // Headset: on near VR stops and between two VR stops, off elsewhere (with a little hysteresis)
      const near = travel.nearest;
      const seg = Math.min(last - 1, Math.floor(k));
      worn = (wornAt(seg) && wornAt(seg + 1)) || (wornAt(near) && travel.distanceTo(near) < (worn ? TAKE_OFF_DISTANCE : PUT_ON_DISTANCE));
      const roadNear = cityMode ? stops.reduce((best, st, i) => (Math.abs(st.roadS - roadS) < Math.abs(stops[best].roadS - roadS) ? i : best), 0) : near;
      const parked = cityMode ? cityRide(dt, cityMode ? stops[0].roadS + travel.s : 0, roadNear) : false;

      // Camera: framed on the guide (the bike in the city), eased so it never jumps
      if (cityMode) cityFraming(stops[0].roadS + travel.s, roadNear, dt, posA, tgtA);
      else framing(guidePos, posA, tgtA);
      let fov = framingFov;
      if (snapCamera || still) { camPos.copy(posA); camTarget.copy(tgtA); snapCamera = false; }
      else {
        const ease = 1 - Math.exp(-dt * CAMERA_DAMPING);
        camPos.lerp(posA, ease);
        camTarget.lerp(tgtA, ease);
        fov = camera.fov + (framingFov - camera.fov) * ease;
      }
      if (Math.abs(fov - camera.fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }
      camera.position.copy(camPos);
      if (!still) { camera.position.x += parallax.x * 0.25; camera.position.y -= parallax.y * 0.15; }
      camera.lookAt(camTarget);
      showStop(Math.round(k));
      panel.classList.toggle("is-travelling", !still && travel.speed > PANEL_HIDE_SPEED);
      // The scroll hint has done its job once the visitor moves; fading it keeps the guide's corner clear
      if (travel.target !== startStop) ui.classList.add("has-travelled");
      trackFill.style.transform = `scaleX(${(k / last).toFixed(4)})`;
      // Arrival: a ring round the station's tick fills like a timer while the dwell holds scrolling
      const dwellTick = travel.phase === "dwell" ? ticks.children[travel.target] : null;
      if (dwellTick !== lastDwellTick) {
        dwellRing.classList.toggle("is-on", !!dwellTick);
        if (dwellTick) dwellRing.style.translate = `${ticks.offsetLeft + dwellTick.offsetLeft}px ${ticks.offsetTop + dwellTick.offsetTop}px`;
        lastDwellTick = dwellTick;
      }
      if (dwellTick) dwellRing.style.setProperty("--dwell", travel.dwellProgress(now).toFixed(3));
      if (soundtrack) {
        if (travel.target !== heardStop) { heardStop = travel.target; soundtrack.whoosh(); }
        soundtrack.setEnergy(travel.speed / TRAVEL.MAX_SPEED);
      }

      // Guide: the explorer animates itself where the controller puts it; the fallback robot does the same with its clips
      const here = stops[near];
      const atStop = travel.distanceTo(near) < 0.5;
      if (cityMode) {
        // City: the rider is part of the riding bike; at a station the explorer stands beside the parked bike
        const spot = parked ? city.stationSpots(roadNear) : null;
        if (explorer) {
          explorer.group.visible = parked;
          if (parked && explorerLift) explorerLift.position.y = cityMode ? spot.character.y : 0;
          if (parked) explorer.update({
            dt, position: spot.character, speed: 0, heading: Math.atan2(camera.position.x - spot.character.x, camera.position.z - spot.character.z),
            wantWorn: wornAt(roadNear), presentTo: here.kind === "project" ? here.center : null, camera: camera.position
          });
        }
        lightRig.position.copy(parked ? spot.character : bikeAt);
        key.position.set(camera.position.x - lightRig.position.x - 2, 5, camera.position.z - lightRig.position.z);
        key.target.position.set(0, 1, 0);
        rim.position.set(-1.2, 2.4, -1.6);
      } else if (explorer) {
        explorer.update({
          dt, position: guidePos, speed: travel.speed, heading: travel.heading(), wantWorn: worn,
          presentTo: atStop && here.kind === "project" ? here.center : null, camera: camera.position
        });
        const at = explorer.group.position;
        lightRig.position.set(at.x, 0, at.z);
        key.position.set(camera.position.x - at.x - 2, 5, camera.position.z - at.z);
        key.target.position.set(0, 1, 0);
        rim.position.set(-1.2, 2.4, -1.6);
      } else if (guide.model) {
        guide.pos.copy(guidePos);
        const speed = travel.speed;
        let yaw = guide.yaw;
        if (speed > 0.25) { yaw = travel.heading(); guide.idleFor = 0; }
        else { guide.idleFor += dt; yaw = Math.atan2(camera.position.x - guide.pos.x, camera.position.z - guide.pos.z); }
        let turn = yaw - guide.yaw;
        turn = Math.atan2(Math.sin(turn), Math.cos(turn));
        guide.yaw += turn * (still ? 1 : 1 - Math.exp(-dt * 0.008));
        guide.model.position.copy(guide.pos);
        guide.model.rotation.y = guide.yaw;
        if (!still) {
          const moving = speed > 3.2 ? "Running" : speed > 0.35 ? "Walking" : null;
          if (moving) {
            guide.arrived = -1;
            play(moving);
            if (guide.current) guide.current.timeScale = Math.min(1.6, Math.max(0.8, speed / (moving === "Running" ? 6 : 2.2)));
          } else if (guide.idleFor > 220 && atStop && guide.arrived !== near) {
            guide.arrived = near;
            const pick = { intro: "Wave", outro: "Dance", profile: "Wave", career: "ThumbsUp", research: "Yes" }[here.kind] || (guide.gestures++ % 2 ? "ThumbsUp" : "Yes");
            if (guide.current) guide.current.timeScale = 1;
            gesture(pick);
            if (soundtrack) soundtrack.chime();
          } else if (guide.idleFor > 220 && (guide.current === guide.actions.Walking || guide.current === guide.actions.Running)) play("Idle");
          guide.mixer.update(dt / 1000);
        }
        lightRig.position.copy(guide.pos);
        key.position.set(camera.position.x - guide.pos.x - 2, 5, camera.position.z - guide.pos.z);
        key.target.position.set(0, 1, 0);
        rim.position.set(-1.2, 2.4, -1.6);
      }

      // Animate the world
      const t = elapsed;
      floorMaterial.uniforms.uTime.value = t;
      dustMaterial.uniforms.uTime.value = t;
      portalMaterials.forEach(m => { m.uniforms.uTime.value = t; });
      portals.forEach((p, n) => { p.rotation.z = t * 0.05 * (n ? -1 : 1); });
      sculptures.forEach(s => { s.rotation.y += s.userData.spin * dt / 1000; s.rotation.x += s.userData.spin * 0.4 * dt / 1000; });
      floaters.forEach(fl => {
        fl.obj.position.y = fl.baseY + (still ? 0 : Math.sin(t * 0.6 + (fl.phase || 0)) * 0.1);
        if (fl.spin && !still) { fl.spin.rotation.y = t * 0.25; fl.spin.rotation.x = t * 0.12; fl.heart.rotation.y = -t * 0.6; }
      });
      orbiters.forEach(o => {
        const a = o.angle + (still ? 0 : t * 0.16);
        o.sprite.position.set(o.center.x + Math.cos(a) * o.radius, o.center.y + o.lift + Math.sin(a * 2) * 0.25, o.center.z + Math.sin(a) * o.radius * 0.55);
      });
      const zoomEase = still ? 1 : 1 - Math.exp(-dt * 0.012);
      zoomables.forEach(z => {
        z.zoom += ((hoveredCard === z ? 1 : 0) - z.zoom) * zoomEase;
        // grow and step forward along the card's own facing so it rises above its neighbours
        const sc = 1 + z.zoom * 0.45, ry = z.mesh.rotation.y;
        z.mesh.scale.setScalar(sc);
        z.mesh.position.x = z.base.x + Math.sin(ry) * z.zoom * 1.2;
        z.mesh.position.z = z.base.z + Math.cos(ry) * z.zoom * 1.2;
        z.mesh.renderOrder = z.zoom > 0.01 ? 3 : 0;
      });
      screens.forEach((s, n) => {
        const focus = Math.max(0, 1 - Math.abs(k - s.stop));
        s.zoom = (s.zoom || 0) + ((hovered === s ? 1 : 0) - (s.zoom || 0)) * zoomEase;
        s.group.scale.setScalar(1 + s.zoom * 0.18);
        s.group.position.y = s.baseY + (still ? 0 : Math.sin(t * 0.7 + n) * 0.08);
        // Focus and hover only lift the border slightly; it stays below the bloom threshold
        s.frame.material.color.copy(stops[s.stop].color).multiplyScalar(CARD_EDGE + focus * 0.25 + (hovered === s ? 0.2 : 0));
        s.beamMaterial.uniforms.uStrength.value = 0.004 + focus * 0.01;
        if (s.reflection) s.reflection.position.set(s.group.position.x, -s.group.position.y, s.group.position.z);
      });
      finish.uniforms.uTime.value = t;
      composer.render();
      adapt(dt);
    }

    // ---------- Mount ----------
    savedScrollY = window.scrollY;
    root.classList.add("is-journey");
    body.classList.add("is-archipelago");
    body.appendChild(button);
    body.appendChild(ui);
    resize();
    showStop(startStop);
    // Guide: the explorer scans (journey-explorer.js); the robot steps in if they can't load
    let explorer = null;
    let explorerLift = null;
    if (explorerModule) {
      try {
        explorer = explorerModule.createExplorer({
          THREE, GLTFLoader, base: "models/", lite, still,
          colors: { in: neon[0].clone(), out: neon[2].clone(), warp: neon[1].clone() },
          onEvent: type => {
            if (!soundtrack) return;
            if (type === "teleport") soundtrack.whoosh();
            else if (type === "arrive" || type === "headset-on-done" || type === "headset-off-done") soundtrack.chime();
          }
        });
        // in the city the explorer stands on the road surface, which is above y = 0 in places
        explorerLift = new THREE.Group();
        explorerLift.add(explorer.group);
        scene.add(explorerLift);
        explorer.ready.catch(error => {
          console.warn("Explorer scans unavailable, using the robot guide instead.", error);
          if (explorer) { explorer.dispose(); explorer = null; }
          if (!cityMode) loadGuide();
        });
      } catch (error) {
        explorer = null;
      }
    }
    if (!explorer && !cityMode) loadGuide();
    const order = screens.slice().sort((a, b) => Math.abs(a.stop - startStop) - Math.abs(b.stop - startStop));

    (async () => { for (const entry of order) { if (cancelled) return; await loadArtwork(entry); } })();
    window.addEventListener("resize", resize, { passive: true });
    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    canvas.addEventListener("click", onCanvasClick);
    frame = requestAnimationFrame(draw);
    ui.focus({ preventScroll: true });

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      clearTimeout(panelTimer);
      clearTimeout(cutTimer);
      window.removeEventListener("resize", resize);
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("click", onCanvasClick);
      ["pointerdown", "keydown", "touchstart", "wheel"].forEach(type => window.removeEventListener(type, wake));
      if (soundtrack) soundtrack.dispose();
      if (guide.mixer) guide.mixer.stopAllAction();
      if (explorer) explorer.dispose();
      if (city) city.dispose();
      Object.assign(TRAVEL, travelDefaults);

      canvas.style.cursor = "";
      canvas.classList.remove("is-cutting");
      ui.remove();
      scene.traverse(obj => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) [].concat(obj.material).forEach(m => { if (m.map) m.map.dispose(); m.dispose(); });
      });
      disposables.forEach(d => d.dispose());
      composer.dispose();
      renderer.dispose();
      root.classList.remove("is-journey");
      body.classList.remove("is-archipelago");
      if (buttonParent) buttonParent.insertBefore(button, buttonNext);
      window.scrollTo({ top: savedScrollY, behavior: "instant" });
    };
  }

  button.addEventListener("click", () => (active ? exit() : enter()));
  updateControls();
  if (returnParam !== null) {
    const autoEnter = () => enter();
    if (document.readyState === "complete") window.setTimeout(autoEnter, 0);
    else window.addEventListener("load", autoEnter, { once: true });
  }
})();

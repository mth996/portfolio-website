(() => {
  const body = document.body;
  const button = document.getElementById("archipelago-toggle");
  const canvas = document.getElementById("archipelago-canvas");
  const cue = document.querySelector(".scroll-instruction");
  const cueLabel = document.querySelector(".scroll-cue__label");
  const status = document.getElementById("archipelago-status");
  if (!body || !button || !canvas) return;

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const coarsePointer = window.matchMedia("(hover:none), (pointer:coarse)");
  let renderer = null;
  let active = false;
  let booting = false;
  let destroyScene = null;
  let statusTimer = 0;
  const startLabel = "ENTER 3D JOURNEY";
  const stopLabel = "EXIT 3D JOURNEY";

  function announce(message) {
    if (!status) return;
    status.textContent = message;
    status.classList.add("is-visible");
    clearTimeout(statusTimer);
    statusTimer = setTimeout(() => status.classList.remove("is-visible"), 2600);
  }
  function updateControls() {
    button.textContent = active ? stopLabel : startLabel;
    button.setAttribute("aria-pressed", String(active));
    button.setAttribute("aria-label", active ? "Exit the XR Archipelago and return to the regular portfolio view" : "Enter the optional 3D XR Archipelago portfolio view");
    if (cue) cue.setAttribute("aria-label", active ? (coarsePointer.matches ? "Swipe to travel through the portfolio" : "Scroll to travel through the portfolio") : (coarsePointer.matches ? "Swipe to explore" : "Scroll to explore"));
    if (cueLabel) cueLabel.textContent = active ? (coarsePointer.matches ? "SWIPE TO TRAVEL" : "SCROLL TO TRAVEL") : (coarsePointer.matches ? "SWIPE TO EXPLORE" : "SCROLL TO EXPLORE");
  }
  async function enter() {
    if (active || booting) return;
    booting = true;
    button.disabled = true;
    button.textContent = "OPENING ARCHIPELAGO";
    try {
      const THREE = await import("https://cdn.jsdelivr.net/npm/three@0.186.0/build/three.module.js");
      if (!document.body.contains(canvas)) return;
      renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false, powerPreference: "low-power" });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.35));
      renderer.setSize(window.innerWidth, window.innerHeight, false);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.15;
      const scene = new THREE.Scene();
      scene.fog = new THREE.FogExp2(0x07101b, 0.008);
      const camera = new THREE.PerspectiveCamera(49, window.innerWidth / window.innerHeight, 0.1, 260);
      scene.add(new THREE.HemisphereLight(0x9cd8ff, 0x111426, 1.9));
      const keyLight = new THREE.DirectionalLight(0xc8e9ff, 2.4);
      keyLight.position.set(-9, 17, 8);
      scene.add(keyLight);
      const rimLight = new THREE.PointLight(0x28c7f1, 17, 44, 2);
      scene.add(rimLight);
      const violetLight = new THREE.PointLight(0x9e71ff, 18, 48, 2);
      scene.add(violetLight);

      const projectEls = [...document.querySelectorAll(".project-scene")];
      const tailEls = ["#profile", "#experience", "#papers", "#contact"].map(s => document.querySelector(s)).filter(Boolean);
      const landmarks = [
        { el: document.querySelector(".hero"), label: "XR ARCHIPELAGO", kind: "hub" },
        ...projectEls.map((el, i) => ({
          el,
          label: (el.querySelector("h3")?.innerText || "PROJECT " + String(i + 1).padStart(2, "0")).replace(/\s+/g, " ").trim(),
          kind: "project",
          index: i
        })),
        ...tailEls.map((el, i) => ({
          el,
          label: (el.querySelector("h2")?.innerText || ["PROFILE", "EXPERIENCE", "PUBLICATIONS", "CONTACT"][i]).replace(/\s+/g, " ").trim(),
          kind: ["profile", "career", "research", "contact"][i]
        }))
      ].filter(item => item.el);
      if (landmarks.length < 2) throw new Error("Portfolio route could not be assembled.");

      const points = landmarks.map((item, i) => {
        const side = i === 0 ? 0 : (i % 2 ? -1 : 1);
        const x = side * (i === 0 ? 0 : 2.1 + (i % 3) * 0.38);
        const y = i === 0 ? 0 : Math.sin(i * 1.31) * 0.42;
        const z = -i * 12.5;
        const rect = item.el.getBoundingClientRect();
        const scrollTop = window.scrollY + rect.top + (item.kind === "hub" ? 0 : rect.height * 0.48);
        return { ...item, point: new THREE.Vector3(x, y, z), scrollTop };
      });
      const route = new THREE.CatmullRomCurve3(points.map(p => p.point), false, "centripetal", 0.45);
      const routeMaterial = new THREE.MeshBasicMaterial({ color: 0x39d5f4, transparent: true, opacity: 0.6 });
      const routeLine = new THREE.Mesh(new THREE.TubeGeometry(route, Math.max(180, points.length * 18), 0.075, 6, false), routeMaterial);
      routeLine.position.y = 0.14;
      scene.add(routeLine);
      const routeCore = new THREE.Mesh(new THREE.TubeGeometry(route, Math.max(180, points.length * 18), 0.022, 5, false), new THREE.MeshBasicMaterial({ color: 0xc8fbff, transparent: true, opacity: 0.8 }));
      routeCore.position.y = 0.16;
      scene.add(routeCore);

      const islandTop = new THREE.MeshStandardMaterial({ color: 0x214449, roughness: 0.94, metalness: 0.02 });
      const rockMat = new THREE.MeshStandardMaterial({ color: 0x182536, roughness: 0.96, metalness: 0.05, flatShading: true });
      const treeTrunk = new THREE.MeshStandardMaterial({ color: 0x453b3d, roughness: 1 });
      const treeLeaf = new THREE.MeshStandardMaterial({ color: 0x327b72, roughness: 0.9, flatShading: true });
      const accentMats = [
        new THREE.MeshStandardMaterial({ color: 0x5cdaf1, emissive: 0x0d5363, emissiveIntensity: 0.5, metalness: 0.22, roughness: 0.35 }),
        new THREE.MeshStandardMaterial({ color: 0xb393ff, emissive: 0x452574, emissiveIntensity: 0.45, metalness: 0.2, roughness: 0.38 }),
        new THREE.MeshStandardMaterial({ color: 0xffd28a, emissive: 0x754214, emissiveIntensity: 0.35, metalness: 0.16, roughness: 0.4 })
      ];
      const shared = {
        rock: new THREE.CylinderGeometry(3.15, 2.25, 1.42, 9, 1, false),
        top: new THREE.CylinderGeometry(3.08, 3.08, 0.16, 14),
        trunk: new THREE.CylinderGeometry(0.085, 0.13, 0.82, 5),
        crown: new THREE.ConeGeometry(0.53, 1.32, 6),
        shard: new THREE.OctahedronGeometry(0.72, 0),
        smallShard: new THREE.OctahedronGeometry(0.28, 0)
      };
      const seed = n => { const x = Math.sin(n * 127.1 + 18.7) * 43758.5453; return x - Math.floor(x); };

      function makeLabel(text, color, position) {
        const c = document.createElement("canvas");
        c.width = 768; c.height = 160;
        const ctx = c.getContext("2d");
        ctx.clearRect(0, 0, c.width, c.height);
        ctx.fillStyle = "rgba(5,12,23,.72)";
        ctx.strokeStyle = "rgba(137,225,255,.4)";
        ctx.lineWidth = 3;
        const x = 8, y = 22, w = 752, h = 116, r = 30;
        ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
        ctx.fill(); ctx.stroke();
        ctx.font = "700 35px Arial, sans-serif";
        ctx.fillStyle = color;
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        let title = text.toUpperCase();
        if (title.length > 27) title = title.slice(0, 26) + "…";
        ctx.fillText(title, c.width / 2, c.height / 2, 690);
        const texture = new THREE.CanvasTexture(c);
        texture.colorSpace = THREE.SRGBColorSpace;
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }));
        sprite.position.copy(position);
        sprite.scale.set(6.6, 1.38, 1);
        scene.add(sprite);
      }

      function addTree(x, z, scale) {
        const g = new THREE.Group();
        const trunk = new THREE.Mesh(shared.trunk, treeTrunk);
        trunk.position.y = 0.43 * scale;
        trunk.scale.setScalar(scale);
        const crown = new THREE.Mesh(shared.crown, treeLeaf);
        crown.position.y = 1.2 * scale;
        crown.scale.setScalar(scale);
        g.add(trunk, crown);
        g.position.set(x, 0.04, z);
        scene.add(g);
      }

      function addLandmark(item, index) {
        const p = item.point;
        const island = new THREE.Group();
        island.position.set(p.x, p.y - 0.62, p.z);
        const rock = new THREE.Mesh(shared.rock, rockMat);
        rock.position.y = -0.12;
        const grass = new THREE.Mesh(shared.top, islandTop);
        grass.position.y = 0.62;
        island.add(rock, grass);
        scene.add(island);

        for (let j = 0; j < 3; j++) {
          const angle = seed(index * 7 + j) * Math.PI * 2;
          const radius = 1.75 + seed(index * 11 + j + 2) * 0.68;
          addTree(p.x + Math.cos(angle) * radius, p.z + Math.sin(angle) * radius, 0.72 + seed(j + index * 4) * 0.52);
        }

        const glow = accentMats[index % accentMats.length];
        const name = item.label.toLowerCase();
        const structure = new THREE.Group();
        structure.position.set(p.x, p.y + 0.08, p.z);
        const box = (w, h, d, material, x, y, z, geo = null) => {
          const mesh = new THREE.Mesh(geo || new THREE.BoxGeometry(w, h, d), material);
          mesh.position.set(x, y, z); structure.add(mesh); return mesh;
        };
        const cyl = (rt, rb, h, material, x, y, z, sides = 8) => {
          const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, sides), material);
          mesh.position.set(x, y, z); structure.add(mesh); return mesh;
        };
        if (item.kind === "hub") {
          cyl(1.35, 1.8, 0.28, glow, 0, 0.26, 0, 12);
          const ring = new THREE.Mesh(new THREE.TorusGeometry(1.35, 0.055, 6, 24), accentMats[0]);
          ring.position.set(0, 1.1, 0); ring.rotation.x = Math.PI / 2; structure.add(ring);
          cyl(0.28, 0.4, 1.65, accentMats[1], 0, 1.0, 0, 7);
        } else if (/sci|lab|biomed|medical/.test(name)) {
          box(2.3, 1.75, 1.65, accentMats[0], 0, 0.92, 0);
          for (let r = -1; r <= 1; r++) box(0.28, 0.42, 0.08, accentMats[2], r * 0.58, 1.0, 0.86);
          box(0.48, 0.62, 0.16, accentMats[1], 0, 0.48, 0.89);
          box(1.6, 0.12, 1.35, rockMat, 0, 1.88, 0);
        } else if (/museum|conservation|artifact/.test(name)) {
          box(2.8, 0.24, 2.0, accentMats[2], 0, 1.55, 0);
          for (let r = -1; r <= 1; r++) cyl(0.13, 0.17, 1.35, accentMats[0], r * 0.86, 0.75, 0.35, 7);
          box(3.2, 0.18, 2.3, rockMat, 0, 1.7, 0);
        } else if (/offshore|oil|rig|simulator/.test(name)) {
          for (let r = -1; r <= 1; r += 2) {
            box(0.16, 2.7, 0.16, accentMats[0], r * 0.68, 1.35, 0);
            box(1.45, 0.16, 1.12, glow, 0, 0.75, 0);
            box(1.6, 0.12, 1.25, rockMat, 0, 2.7, 0);
          }
          box(0.12, 1.5, 0.12, accentMats[2], 0, 2.25, 0);
        } else if (/contact|get in touch/.test(name)) {
          cyl(0.64, 0.78, 3.25, accentMats[0], 0, 1.65, 0, 7);
          const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.44, 8, 6), accentMats[2]);
          lamp.position.set(0, 3.38, 0); structure.add(lamp);
          for (let r = -1; r <= 1; r += 2) box(0.1, 1.8, 0.1, accentMats[1], r * 0.68, 1.95, 0);
        } else if (/publication|research|paper/.test(name)) {
          for (let r = 0; r < 4; r++) {
            box(1.35 + (r % 2) * 0.2, 0.22, 0.95, r % 2 ? accentMats[1] : accentMats[0], (r % 2) * 0.08, 0.25 + r * 0.27, 0);
          }
        } else if (/experience|career/.test(name)) {
          for (let r = -1; r <= 1; r++) {
            box(0.58, 1.05 + (r + 1) * 0.35, 0.58, r === 0 ? accentMats[1] : accentMats[0], r * 0.76, 0.55 + (r + 1) * 0.16, 0);
          }
        } else if (/profile/.test(name)) {
          const crystal = new THREE.Mesh(shared.shard, accentMats[1]);
          crystal.position.set(0, 1.0, 0); crystal.scale.set(.9, 1.8, .9); structure.add(crystal);
          const base = new THREE.Mesh(new THREE.TorusGeometry(1, 0.06, 6, 20), accentMats[0]);
          base.rotation.x = Math.PI / 2; base.position.y = 0.35; structure.add(base);
        } else if (/quest|hero|everyday/.test(name)) {
          for (let r = -1; r <= 1; r++) {
            box(0.82, 0.7 + (r === 0 ? .35 : 0), 0.72, r === 0 ? accentMats[0] : glow, r * 1.0, 0.45, 0);
            const roof = new THREE.Mesh(new THREE.ConeGeometry(0.7, 0.48, 4), accentMats[1]);
            roof.position.set(r * 1.0, 1.0 + (r === 0 ? .35 : 0), 0); roof.rotation.y = Math.PI / 4; structure.add(roof);
          }
        } else {
          for (let r = 0; r < 5; r++) {
            const cube = new THREE.Mesh(shared.smallShard, r % 2 ? accentMats[1] : accentMats[0]);
            cube.position.set((r - 2) * 0.58, 0.4 + seed(r + index) * 1.8, (seed(r * 4 + index) - .5) * 1.2);
            cube.rotation.set(seed(r) * 2, seed(r + 1) * 2, seed(r + 2) * 2);
            structure.add(cube);
          }
        }
        scene.add(structure);
        const signPos = p.clone().add(new THREE.Vector3(0, 3.35, 0));
        makeLabel(item.label, index % 3 === 0 ? "#b5f3ff" : index % 3 === 1 ? "#d9c8ff" : "#ffe0aa", signPos);
        for (let j = 0; j < 5; j++) {
          const shard = new THREE.Mesh(shared.smallShard, accentMats[(j + index) % accentMats.length]);
          const a = seed(index * 13 + j) * Math.PI * 2;
          const r = 3.5 + seed(index * 8 + j) * 2.1;
          shard.position.set(p.x + Math.cos(a) * r, p.y - 0.3 + seed(j + 24) * 2.2, p.z + Math.sin(a) * r);
          shard.rotation.set(seed(j) * 3, seed(j + 1) * 3, seed(j + 2) * 3);
          shard.scale.setScalar(.45 + seed(j + index) * .72);
          scene.add(shard);
        }
      }
      points.forEach(addLandmark);

      const starGeo = new THREE.BufferGeometry();
      const starPositions = [];
      for (let i = 0; i < 740; i++) {
        starPositions.push((seed(i + 500) - .5) * 92, (seed(i + 1200) - .42) * 35, -seed(i + 2400) * points.length * 14 - 12);
      }
      starGeo.setAttribute("position", new THREE.Float32BufferAttribute(starPositions, 3));
      scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xb7e8ff, size: .07, transparent: true, opacity: .75, sizeAttenuation: true })));

      const avatar = new THREE.Group();
      const suit = new THREE.MeshStandardMaterial({ color: 0x20394a, roughness: .7, metalness: .1 });
      const suitLight = new THREE.MeshStandardMaterial({ color: 0x42cbe8, emissive: 0x0d5269, emissiveIntensity: .55, roughness: .38 });
      const skin = new THREE.MeshStandardMaterial({ color: 0xdda77e, roughness: .78 });
      const dark = new THREE.MeshStandardMaterial({ color: 0x101923, roughness: .88 });
      const torso = new THREE.Mesh(new THREE.CylinderGeometry(.26, .34, .78, 7), suit);
      torso.position.y = 1.16; avatar.add(torso);
      const head = new THREE.Mesh(new THREE.SphereGeometry(.245, 9, 7), skin);
      head.position.y = 1.77; avatar.add(head);
      const visor = new THREE.Mesh(new THREE.SphereGeometry(.252, 9, 5, 0, Math.PI * 2, .2, .5), dark);
      visor.position.set(0, 1.82, -.035); visor.scale.set(1.02, .72, .94); avatar.add(visor);
      const pack = new THREE.Mesh(new THREE.BoxGeometry(.42, .48, .22), suitLight);
      pack.position.set(0, 1.18, .27); avatar.add(pack);
      const hips = new THREE.Mesh(new THREE.BoxGeometry(.46, .22, .32), dark);
      hips.position.y = .72; avatar.add(hips);
      const limb = (geo, material, x, y) => {
        const pivot = new THREE.Group(); pivot.position.set(x, y, 0);
        const mesh = new THREE.Mesh(geo, material); mesh.position.y = -.34; pivot.add(mesh); avatar.add(pivot);
        return pivot;
      };
      const armGeo = new THREE.CylinderGeometry(.095, .075, .7, 6);
      const legGeo = new THREE.CylinderGeometry(.13, .105, .76, 6);
      const arms = [limb(armGeo, suit, -.39, 1.42), limb(armGeo, suit, .39, 1.42)];
      const legs = [limb(legGeo, dark, -.16, .68), limb(legGeo, dark, .16, .68)];
      arms.forEach((a, i) => {
        const glove = new THREE.Mesh(new THREE.SphereGeometry(.105, 6, 5), skin);
        glove.position.y = -.7; a.add(glove);
      });
      legs.forEach((l, i) => {
        const boot = new THREE.Mesh(new THREE.BoxGeometry(.23, .15, .4), suitLight);
        boot.position.set(0, -.69, -.08); l.add(boot);
      });
      scene.add(avatar);

      const shadow = new THREE.Mesh(new THREE.CircleGeometry(.78, 18), new THREE.MeshBasicMaterial({ color: 0x02050b, transparent: true, opacity: .48, depthWrite: false }));
      shadow.rotation.x = -Math.PI / 2; shadow.position.y = .04; scene.add(shadow);

      function progressForScroll(scrollY) {
        if (scrollY <= points[0].scrollTop) return 0;
        const last = points.length - 1;
        if (scrollY >= points[last].scrollTop) return 1;
        for (let i = 0; i < last; i++) {
          const a = points[i].scrollTop, b = Math.max(a + 1, points[i + 1].scrollTop);
          if (scrollY <= b) return (i + Math.max(0, Math.min(1, (scrollY - a) / (b - a)))) / last;
        }
        return 1;
      }

      let targetU = progressForScroll(window.scrollY);
      let currentU = targetU;
      let frame = 0, dead = false;
      function resize() {
        if (dead) return;
        const w = window.innerWidth, h = window.innerHeight;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.fov = w < 700 ? 55 : 49;
        camera.updateProjectionMatrix();
      }
      function onScroll() { targetU = progressForScroll(window.scrollY); }
      function draw(time) {
        if (dead) return;
        frame = requestAnimationFrame(draw);
        currentU += (targetU - currentU) * (reducedMotion.matches ? .22 : .075);
        if (Math.abs(targetU - currentU) < .0004) currentU = targetU;
        const pos = route.getPoint(currentU);
        const tangent = route.getTangent(currentU).normalize();
        const right = new THREE.Vector3().crossVectors(tangent, new THREE.Vector3(0, 1, 0)).normalize();
        const bob = reducedMotion.matches ? 0 : Math.sin(time * .009) * .045;
        avatar.position.copy(pos);
        avatar.position.y += bob;
        avatar.rotation.y = Math.atan2(tangent.x, tangent.z);
        const movement = Math.min(1, Math.abs(targetU - currentU) * 55);
        const walk = reducedMotion.matches ? 0 : time * .012;
        legs[0].rotation.x = Math.sin(walk) * (.14 + movement * .46);
        legs[1].rotation.x = -legs[0].rotation.x;
        arms[0].rotation.x = -legs[0].rotation.x * .62;
        arms[1].rotation.x = -legs[1].rotation.x * .62;
        camera.position.copy(pos).addScaledVector(tangent, -7.5).addScaledVector(right, 0.15).add(new THREE.Vector3(0, 3.55, 0));
        const look = pos.clone().addScaledVector(tangent, 4.2).add(new THREE.Vector3(0, 1.1, 0));
        camera.lookAt(look);
        shadow.position.set(pos.x, pos.y + .04, pos.z);
        rimLight.position.set(pos.x - 5, pos.y + 5, pos.z + 3);
        violetLight.position.set(pos.x + 6, pos.y + 3, pos.z - 6);
        routeMaterial.opacity = .47 + Math.sin(time * .0018) * .1;
        if (!reducedMotion.matches || Math.abs(targetU - currentU) > .0005) renderer.render(scene, camera);
        else renderer.render(scene, camera);
      }
      window.addEventListener("resize", resize, { passive: true });
      window.addEventListener("scroll", onScroll, { passive: true });
      resize();
      active = true;
      body.classList.add("is-archipelago");
      updateControls();
      announce("Scroll to travel the XR Archipelago. Your project pages remain one click away.");
      draw(0);
      destroyScene = () => {
        dead = true;
        cancelAnimationFrame(frame);
        window.removeEventListener("resize", resize);
        window.removeEventListener("scroll", onScroll);
        scene.traverse(o => {
          if (o.geometry) o.geometry.dispose();
          if (o.material) for (const m of (Array.isArray(o.material) ? o.material : [o.material])) {
            if (m.map) m.map.dispose();
            m.dispose();
          }
        });
        renderer.dispose();
        renderer = null;
      };
    } catch (error) {
      console.error("XR Archipelago could not start:", error);
      body.classList.remove("is-archipelago");
      active = false;
      updateControls();
      announce("The 3D view could not start here. The regular portfolio is still available.");
      if (renderer) { renderer.dispose(); renderer = null; }
    } finally {
      booting = false;
      button.disabled = false;
      updateControls();
    }
  }

  function exit() {
    active = false;
    body.classList.remove("is-archipelago");
    if (destroyScene) { destroyScene(); destroyScene = null; }
    else if (renderer) { renderer.dispose(); renderer = null; }
    updateControls();
    announce("Back to the regular portfolio view.");
  }

  button.addEventListener("click", () => active ? exit() : enter());
  window.addEventListener("keydown", event => { if (event.key === "Escape" && active) exit(); });
  coarsePointer.addEventListener?.("change", updateControls);
  updateControls();
})();
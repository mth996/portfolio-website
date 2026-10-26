// The city world for the 3D journey: "Cyberpunk City - #1" by born2012 (CC BY 4.0, see CREDITS.md), a road through it
// (models/city-route.json, designed and checked against the city's geometry), the riding and parked motorcycles,
// and the bike handling and camera shots that go with them. scroll-exploration.js builds the stations, input and
// UI as before; this module only supplies the world, so the grid journey stays available as the fallback.
// Distances are metres along the road; heights are above the city's plaza, which sits at y = 0.

const WHEEL_R = 0.335;                            // tyre radius of the optimised bikes (m)
const WHEELS = { front: 0.728, rear: -0.726 };    // wheel centres in the bike's own frame (m)
// Bike handling on top of the travel controller's speed cap (its commit, settle, gesture and dwell rules are untouched)
export const BIKE_TRAVEL = { MAX_SPEED: 18, ACCEL: 6, BRAKE: 6, MIN_SPEED: 1.5, MAX_LAG: 20, TELEPORT_DISTANCE: 140 };
const HANDLING = {
  LATERAL: 0.5 * 9.81,  // m/s² sideways at a corner's speed limit
  CORNER_BRAKE: 3.0,    // m/s² of braking ahead of a corner
  HOLD: 8,              // metres either side over which a bend's lowest limit holds
  STOP_BRAKE: 3.5,      // m/s² of braking into a stop
  STOP_FLOOR: 1.0,      // m/s the stop curve never goes below
  LOOK: 0.8,            // s: no speeding up if the stop curve would need braking within this time
  SETTLE_BACK: 3.0      // m/s rolling back to the stop it left after an uncommitted scroll
};
// Cameras: riding (behind and above), station (from the route data), overview (high above, behind)
const OVERVIEW = { back: 26, up: 22, ahead: 14 };

export async function loadCity({ THREE, GLTFLoader, base = "models/" }) {
  const loader = new GLTFLoader();
  const [route, city, ride, park] = await Promise.all([
    fetch(base + "city-route.json").then(r => { if (!r.ok) throw new Error("city route " + r.status); return r.json(); }),
    loader.loadAsync(base + "city.glb"), loader.loadAsync(base + "bike-ride.glb"), loader.loadAsync(base + "bike-park.glb")
  ]);
  return { route, city, ride, park, THREE };
}

export function createCity({ THREE, assets, scene, renderer, ink, neon, lite }) {
  const { route } = assets;
  const R = route.road, N = R.length, last = N - 1;
  const glsl = c => `vec3(${c.r.toFixed(3)}, ${c.g.toFixed(3)}, ${c.b.toFixed(3)})`;
  const cyan = neon[0], violet = neon[1], magenta = neon[2];
  const group = new THREE.Group(); group.name = "city";
  scene.add(group);

  // ---------- City ----------
  const city = assets.city.scene;
  city.scale.setScalar(route.scale);
  city.position.y = -route.plazaY;
  city.traverse(o => {
    if (!o.isMesh) return;
    const m = o.material;
    // neon and windows already glow in the model; lift them just past the bloom threshold, colours untouched
    if (m.emissive && m.emissive.getHex()) m.emissiveIntensity = m.emissive.getHSL({}).s > 0.2 ? 1.3 : 1.25;
    m.envMapIntensity = 0.6;
  });
  group.add(city);

  // Night reflections: a small generated environment in the token colours
  const envScene = new THREE.Scene();
  envScene.add(new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: { top: { value: ink.clone().multiplyScalar(0.7) }, band: { value: violet.clone().multiplyScalar(0.35) }, hot: { value: magenta.clone().multiplyScalar(0.25) } },
    vertexShader: "varying vec3 d; void main(){ d = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
    fragmentShader: "uniform vec3 top; uniform vec3 band; uniform vec3 hot; varying vec3 d; void main(){ float h = d.y; gl_FragColor = vec4(top + band*exp(-pow(h*5.0,2.0)) + hot*exp(-pow((h+0.05)*12.0,2.0)), 1.0); }"
  })));
  [[cyan, 4, 2, 1], [magenta, -4, 1.5, 3], [cyan, 1, 2.5, -5], [violet, -2, 3, -4]].forEach(([c, x, y, z]) => {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 3), new THREE.MeshBasicMaterial({ color: c.clone().multiplyScalar(1.6), side: THREE.DoubleSide }));
    p.position.set(x, y, z); p.lookAt(0, 0, 0); envScene.add(p);
  });
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envMap = pmrem.fromScene(envScene, 0.04).texture;
  pmrem.dispose();
  envScene.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
  scene.environment = envMap;
  scene.environmentIntensity = 0.45;
  // Dim cool night light; neon and windows come from the city's own materials
  const sky = violet.clone().lerp(ink, 0.6), moon = new THREE.DirectionalLight(cyan.clone().lerp(new THREE.Color(1, 1, 1), 0.6), 0.3);
  moon.position.set(-120, 220, -80);
  group.add(new THREE.HemisphereLight(sky, ink, 0.5), moon);

  // ---------- Road ----------
  // Samples every metre: [x, z, height, width, follow-camera variant]
  const fwd = [], right = [];
  for (let i = 0; i < N; i++) {
    const a = R[Math.max(0, i - 1)], b = R[Math.min(last, i + 1)];
    const f = new THREE.Vector3(b[0] - a[0], 0, b[1] - a[1]).normalize();
    fwd.push(f); right.push(new THREE.Vector3(-f.z, 0, f.x));
  }
  {
    const pos = [], idx = [], left = [], rightEdge = [];
    R.forEach(([x, z, y, w], i) => {
      const r = right[i], h = w / 2;
      pos.push(x - r.x * h, y, z - r.z * h, x + r.x * h, y, z + r.z * h);
      left.push(new THREE.Vector3(x - r.x * (h - 0.15), y + 0.02, z - r.z * (h - 0.15)));
      rightEdge.push(new THREE.Vector3(x + r.x * (h - 0.15), y + 0.02, z + r.z * (h - 0.15)));
      if (i) { const k = (i - 1) * 2; idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals();
    group.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: ink.clone().multiplyScalar(1.4), roughness: 0.5, metalness: 0.25, side: THREE.DoubleSide })));
    const edge = new THREE.LineBasicMaterial({ color: cyan.clone().multiplyScalar(1.5) });
    [left, rightEdge].forEach(p => group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(p), edge)));
  }

  // Road frame at any distance: position (on the road's centre line), direction, width, camera variant
  function frameAt(s, out = {}) {
    const x = Math.max(0, Math.min(last, s)), i = Math.min(last - 1, Math.floor(x)), t = x - i;
    const a = R[i], b = R[i + 1];
    out.pos = (out.pos || new THREE.Vector3()).set(a[0] + (b[0] - a[0]) * t, a[2] + (b[2] - a[2]) * t, a[1] + (b[1] - a[1]) * t);
    out.fwd = (out.fwd || new THREE.Vector3()).copy(fwd[i]).lerp(fwd[i + 1], t).normalize();
    out.right = (out.right || new THREE.Vector3()).set(-out.fwd.z, 0, out.fwd.x);
    out.width = a[3] + (b[3] - a[3]) * t;
    out.cam = t < 0.5 ? a[4] : b[4];
    return out;
  }
  const lane = w => (w < 3.5 ? 0 : w / 4);   // the bike keeps right of centre, or centred in narrow lanes

  // ---------- Speed limits ----------
  const curve = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const a = fwd[Math.max(0, i - 2)], b = fwd[Math.min(last, i + 2)];
    const k = Math.acos(Math.max(-1, Math.min(1, a.dot(b)))) / Math.max(1, Math.min(last, i + 2) - Math.max(0, i - 2));
    curve[i] = Math.min(BIKE_TRAVEL.MAX_SPEED, Math.sqrt(HANDLING.LATERAL / Math.max(k, 1e-5)));
  }
  const held = curve.map((_, i) => { let m = Infinity; for (let k = -HANDLING.HOLD; k <= HANDLING.HOLD; k++) m = Math.min(m, curve[Math.max(0, Math.min(last, i + k))]); return m; });
  const ahead = Float32Array.from(held), behind = Float32Array.from(held), grow = 2 * HANDLING.CORNER_BRAKE;
  for (let i = last - 1; i >= 0; i--) ahead[i] = Math.min(ahead[i], Math.sqrt(ahead[i + 1] ** 2 + grow));
  for (let i = 1; i < N; i++) behind[i] = Math.min(behind[i], Math.sqrt(behind[i - 1] ** 2 + grow));
  const at = (list, s) => { const x = Math.max(0, Math.min(last, s)), i = Math.min(last - 1, Math.floor(x)); return list[i] + (list[i + 1] - list[i]) * (x - i); };
  // goal: road distance of the stop being headed for; home: of the stop last stood at
  function speedCap({ s, v, goal, home, riding }) {
    let cap = v > 0.05 ? at(ahead, s) : v < -0.05 ? at(behind, s) : Math.min(at(ahead, s), at(behind, s));
    const speed = Math.abs(v);
    if (riding && (goal - s) * v > 0) {
      const gap = Math.abs(goal - s), stopCurve = d => Math.sqrt(2 * HANDLING.STOP_BRAKE * Math.max(0, d));
      cap = Math.min(cap, Math.max(HANDLING.STOP_FLOOR, stopCurve(gap)));
      if (stopCurve(gap - speed * HANDLING.LOOK) < speed) cap = Math.min(cap, Math.max(HANDLING.STOP_FLOOR, speed));
    }
    if (riding && goal === home && (home - s) * v > 0) cap = Math.min(cap, HANDLING.SETTLE_BACK);
    return cap;
  }

  // ---------- Bikes ----------
  const RIM = `{ vec3 vdir = normalize(vViewPosition); float rim = pow(1.0 - clamp(dot(normal, vdir), 0.0, 1.0), 3.0);
    totalEmissiveRadiance += ${glsl(cyan.clone().lerp(new THREE.Color(1, 1, 1), 0.25))} * rim * 0.55; }`;
  // the edge glow, plus light strips where the bike's own texture is a bright, saturated blue
  const tron = material => {
    material.envMapIntensity = 3.0;
    material.onBeforeCompile = sh => {
      sh.fragmentShader = sh.fragmentShader.replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
        { vec3 c = diffuseColor.rgb; float blue = smoothstep(0.10, 0.22, c.b - max(c.r, c.g)) * smoothstep(0.30, 0.55, c.b);
          totalEmissiveRadiance += ${glsl(cyan)} * blue * 2.4; }
        ` + RIM);
    };
    material.needsUpdate = true;
  };
  const ringMat = new THREE.MeshBasicMaterial({ color: cyan.clone().multiplyScalar(3.2) });
  const ringArc = new THREE.TorusGeometry(0.262, 0.011, 6, 40, Math.PI * 2 * 0.27);
  const rimRings = halfWidth => {
    const g = new THREE.Group();
    [-1, 1].forEach(side => { for (let k = 0; k < 3; k++) { const r = new THREE.Mesh(ringArc, ringMat); r.rotation.set(0, Math.PI / 2, k * Math.PI * 2 / 3, "YXZ"); r.position.x = side * halfWidth; g.add(r); } });
    return g;
  };
  const glowTex = (() => {
    const c = document.createElement("canvas"); c.width = c.height = 128;
    const g = c.getContext("2d"), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, "rgba(255,255,255,0.55)"); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  })();
  const underglow = () => {
    const m = new THREE.Mesh(new THREE.CircleGeometry(1, 32), new THREE.MeshBasicMaterial({ map: glowTex, color: cyan.clone().multiplyScalar(0.45), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -2 }));
    m.scale.set(0.9, 1.7, 1); m.rotation.x = -Math.PI / 2; m.position.y = 0.04; return m;
  };
  // separate the tyre-and-rim rings from the body so they can spin
  const splitWheels = mesh => {
    const g = mesh.geometry, p = g.attributes.position.array, index = g.index.array;
    const inRing = (v, z) => { const x = p[v * 3], y = p[v * 3 + 1] - WHEEL_R, dz = p[v * 3 + 2] - z, r = Math.hypot(y, dz); return Math.abs(x) <= 0.16 && r >= 0.2 && r <= 0.36; };
    const body = [], front = [], rear = [];
    for (let t = 0; t < index.length; t += 3) {
      const a = index[t], b = index[t + 1], c = index[t + 2];
      if (inRing(a, WHEELS.front) && inRing(b, WHEELS.front) && inRing(c, WHEELS.front)) front.push(a, b, c);
      else if (inRing(a, WHEELS.rear) && inRing(b, WHEELS.rear) && inRing(c, WHEELS.rear)) rear.push(a, b, c);
      else body.push(a, b, c);
    }
    const make = (ids, z) => {
      const geo = new THREE.BufferGeometry();
      for (const [k, attr] of Object.entries(g.attributes)) geo.setAttribute(k, attr);
      geo.setIndex(ids);
      if (z === null) return new THREE.Mesh(geo, mesh.material);
      const pivot = new THREE.Group(); pivot.position.set(0, WHEEL_R, z);
      const m = new THREE.Mesh(geo, mesh.material); m.position.set(0, -WHEEL_R, -z); pivot.add(m);
      return pivot;
    };
    return { body: make(body, null), front: make(front, WHEELS.front), rear: make(rear, WHEELS.rear) };
  };
  const meshOf = gltf => { let m; gltf.scene.traverse(o => { if (o.isMesh) m = o; }); return m; };
  const rideMesh = meshOf(assets.ride); tron(rideMesh.material);
  const split = splitWheels(rideMesh);
  const ride = new THREE.Group(); ride.name = "riding bike";
  ride.add(split.body, split.front, split.rear, underglow());
  split.front.add(rimRings(0.075)); split.rear.add(rimRings(0.095));
  const parkMesh = meshOf(assets.park); tron(parkMesh.material);
  const park = new THREE.Group(); park.name = "parked bike";
  const pf = rimRings(0.075); pf.position.set(0, WHEEL_R, WHEELS.front);
  const pr = rimRings(0.095); pr.position.set(0, WHEEL_R, WHEELS.rear);
  park.add(assets.park.scene, pf, pr, underglow());
  park.visible = false;
  group.add(ride, park);

  // Pose the riding bike: both tyres on the road (pitch from the two contact heights), heading along the road,
  // leaning into turns; `turn` 0 → 1 turns it round when riding back to an earlier stop
  const state = { roll: 0, spin: 0 };
  const fA = {}, fB = {}, fC = {}, fD = {};
  function poseBike(s, v, dt, turn = 0) {
    frameAt(s, fC);
    frameAt(s + WHEELS.front, fA); frameAt(s + WHEELS.rear, fB);
    const offA = lane(fA.width), offB = lane(fB.width);
    const front = fA.pos.clone().addScaledVector(fA.right, offA), rear = fB.pos.clone().addScaledVector(fB.right, offB);
    const mid = front.clone().add(rear).multiplyScalar(0.5), dir = front.clone().sub(rear);
    const facing = Math.cos(turn * Math.PI);
    const yaw = Math.atan2(dir.x, dir.z) + turn * Math.PI, pitch = -Math.atan2(dir.y, Math.hypot(dir.x, dir.z)) * facing;
    frameAt(s + 3, fD);
    const bend = Math.atan2(fD.fwd.clone().cross(fC.fwd).y, fD.fwd.dot(fC.fwd)) / 3;
    const lean = Math.max(-0.4, Math.min(0.4, -Math.atan(v * v * bend / 9.81))) * facing;
    state.roll += (lean - state.roll) * (1 - Math.exp(-dt * 4));
    ride.position.copy(mid);
    ride.rotation.set(pitch, yaw, state.roll, "YXZ");
    state.spin += v * facing * dt / WHEEL_R;
    split.front.rotation.x = split.rear.rotation.x = state.spin;
    return mid;
  }
  // Stations: the parked bike in the right-hand lane, the character stepping off beside it
  function stationSpots(i) {
    const st = route.stops[i], f = frameAt(st.s);
    return {
      bike: new THREE.Vector3(st.bike[0], f.pos.y, st.bike[1]), heading: Math.atan2(f.fwd.x, f.fwd.z),
      character: new THREE.Vector3(st.character[0], (st.characterY ?? f.pos.y) + 0.02, st.character[1]),
      display: st.display ? new THREE.Vector3(st.display.x, f.pos.y + st.display.y0 + (st.display.y1 - st.display.y0) * (st.display.scale || 1) / 2, st.display.z) : null
    };
  }
  function parkAt(i) {
    const p = stationSpots(i);
    park.position.copy(p.bike); park.rotation.set(0, p.heading, 0);
    park.visible = true; ride.visible = false;
  }
  function unpark() { park.visible = false; ride.visible = true; }

  // ---------- Camera shots ----------
  const VARIANTS = route.cameraVariants;
  // Riding styles [back, side, up, look ahead]: chase, low side (right), high crane, front three-quarter looking back at
  // the rider, low side (left). Each is used only where it was checked clear of the city, with a clear view of the
  // rider, for 6 m either side (route data, bit k of the sample's mask); elsewhere the chase (or corner) shot is used.
  const STYLES = route.shotStyles || [[8.5, -1.6, 3.1, 7]];
  const SEQUENCE = [0, 1, 3, 2, 4, 3, 1, 2];
  const fE = {};
  // Riding: behind and above the bike, looking down the road. Where the usual spot would sit inside a building or lose
  // sight of the rider (checked offline for every metre), the shot swings to the inside of the turn and moves in;
  // `blend` eases between the variants so the change is never a cut.
  const camBlend = { back: VARIANTS[0][0], side: VARIANTS[0][1], up: VARIANTS[0][2], look: 7 };
  // leg: index of the stop the bike left; progress 0 → 1 along that leg. The style changes per leg and again halfway
  // along long legs; changes blend over about half a second.
  function rideShot(s, facing, bike, dt, outPos, outTarget, leg = 0, progress = 0, legLength = 0) {
    frameAt(s, fE);
    const mask = R[Math.max(0, Math.min(last, Math.round(s)))][5] ?? 1;
    let want = SEQUENCE[(leg * 2 + (legLength > 60 && progress > 0.5 ? 1 : 0)) % SEQUENCE.length];
    if (facing < 0.5 || fE.cam !== 0 || !(mask & (1 << want)) || !STYLES[want]) want = 0;
    const style = want === 0 ? [...(VARIANTS[fE.cam] || VARIANTS[0]), 7] : STYLES[want];
    const k = 1 - Math.exp(-dt * 0.0035);
    camBlend.back += (style[0] - camBlend.back) * k; camBlend.side += (style[1] - camBlend.side) * k;
    camBlend.up += (style[2] - camBlend.up) * k; camBlend.look += (style[3] - camBlend.look) * k;
    const f = fE.fwd.clone().multiplyScalar(facing), r = fE.right.clone().multiplyScalar(facing);
    outPos.copy(bike).addScaledVector(f, -camBlend.back).addScaledVector(r, camBlend.side); outPos.y = bike.y + camBlend.up;
    // aim down the road (the front shot looks back at the rider)
    frameAt(s + camBlend.look * facing, fA);
    outTarget.copy(fA.pos).addScaledVector(fA.right, lane(fA.width)).lerp(bike, Math.max(0, 1 - camBlend.look / 4)); outTarget.y = bike.y + 1.1 + camBlend.look * 0.03;
  }
  // Station: the arrival shot from the route data (behind the stop, checked clear of the city with a view of the card,
  // the character head to feet and the bike), fitted to the screen: at project stops it aims between the card and the
  // character and moves along that line to the closest spot (from 0.55 to 1.6 times the checked distance) where the
  // whole card, the character and the parked bike fit in the frame, so the card is as large as it can be
  const fitCache = new Map(), probe = new THREE.PerspectiveCamera(50, 1, 0.1, 200), pt = new THREE.Vector3();
  function stationShot(i, outPos, outTarget, portrait = false, fov = 50, aspect = 16 / 9) {
    const st = route.stops[i], c = st.camera;
    outPos.set(c.pos[0], c.pos[1], c.pos[2]); outTarget.set(c.target[0], c.target[1], c.target[2]);
    if (st.kind !== "project" || !st.display) { if (portrait) outPos.lerp(outTarget, -0.35); return; }
    const key = i + ":" + fov.toFixed(1) + ":" + aspect.toFixed(2);
    let fit = fitCache.get(key);
    if (!fit) {
      const spots = stationSpots(i), d = st.display, y = spots.character.y;
      const along = new THREE.Vector3(-d.nz, 0, d.nx);
      const k = d.scale || 1, H = (d.y1 - d.y0) * k, W = d.w * k;
      const pts = [-1, 1].flatMap(sg => [d.y0, d.y0 + H].map(h => spots.display.clone().setY(y + h).addScaledVector(along, sg * W / 2)));
      pts.push(spots.character.clone().setY(y + 1.9), spots.character.clone().setY(y), spots.bike.clone().setY(y + 1.2), spots.bike.clone());
      const target = spots.display.clone().setY(y + d.y0 + H / 2).lerp(spots.character.clone().setY(y + 0.9), 0.45);
      const dir = outPos.clone().sub(target), base = dir.length(); dir.normalize();
      probe.fov = fov; probe.aspect = aspect; probe.updateProjectionMatrix();
      let dist = base * 0.55;
      for (; dist <= base * 1.6; dist += 0.5) {
        probe.position.copy(target).addScaledVector(dir, dist); probe.lookAt(target); probe.updateMatrixWorld();
        if (pts.every(p => { pt.copy(p).project(probe); return Math.abs(pt.x) < 0.92 && pt.y < 0.9 && pt.y > -0.92 && pt.z < 1; })) break;
      }
      fit = { pos: target.clone().addScaledVector(dir, Math.min(dist, base * 1.6)), target };
      fitCache.set(key, fit);
    }
    outPos.copy(fit.pos); outTarget.copy(fit.target);
  }
  // Overview: high above and behind the bike, looking ahead over the city
  function overviewShot(s, facing, bike, outPos, outTarget) {
    frameAt(s, fE);
    const f = fE.fwd.clone().multiplyScalar(facing);
    outPos.copy(bike).addScaledVector(f, -OVERVIEW.back); outPos.y = bike.y + OVERVIEW.up;
    outTarget.copy(bike).addScaledVector(f, OVERVIEW.ahead); outTarget.y = bike.y;
  }

  return {
    group, route, stops: route.stops, length: route.length,
    centre: new THREE.Vector3(45, 0, 50),
    frameAt, lane, speedCap, poseBike, stationSpots, parkAt, unpark, rideShot, stationShot, overviewShot,
    ride, park,
    dispose() { envMap.dispose(); glowTex.dispose(); ringArc.dispose(); ringMat.dispose(); scene.environment = null; }
  };
}

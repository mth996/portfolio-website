// The explorer guide for the 3D journey: two photo-scans of the same person, one holding a VR headset and one wearing it.
// The scans ship without a skeleton or animations, so this module animates them itself:
//   - a procedural walk in the vertex shader (thighs swing from the hips, knees bend in the swing phase, the free arm
//     counter-swings), with cadence tied to ground speed so the planted foot doesn't slide;
//   - the headset in the "holding" scan was cut out into its own mesh (models/explorer-headset.glb), so it can leave the
//     hand, rise to the face, and hand over to the "wearing" scan with a top-down scan-line dissolve (and back again);
//   - long jumps along the route become an XR-style teleport dissolve instead of a sprint.
// Which state a stop needs comes from its `experience` ("vr" or "non-vr"), set on each project card in index.html.
// Movement lives in journey-travel.js: this module only animates the guide where it is told to be, so a rigged
// character can replace it later behind the same interface: { group, ready, update(frame), teleport(), busy, dispose }.

const ASSETS = {
  holding: { mesh: "explorer-holding-body.glb", color: "explorer-holding-color.webp", normal: "explorer-holding-normal.webp" },
  headset: { mesh: "explorer-headset.glb" },
  vr: { mesh: "explorer-vr.glb", color: "explorer-vr-color.webp", normal: "explorer-vr-normal.webp" }
};
const HEIGHT = 1.9;
const LEG_LENGTH = 0.85;
const HEADSET_IN_HAND = { position: [-0.2553, 1.3645, 0.1873], rotation: [0, 0, 0] };
const HEADSET_ON_FACE = { position: [0.0, 1.76, 0.0], rotation: [0, 0.05, 0.18] };

const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// Shader patch shared by all explorer materials: procedural walk (object space) and the scan-line dissolve.
const VERTEX_HEADER = `
uniform float uPhase;
uniform float uStride;
varying vec3 vExplorerWorld;
void explorerRotate(inout vec3 p, inout vec3 n, vec2 pivot, float a) {
  vec2 d = p.yz - pivot; float c = cos(a), s = sin(a);
  p.yz = pivot + vec2(d.x * c - d.y * s, d.x * s + d.y * c);
  n.yz = vec2(n.y * c - n.z * s, n.y * s + n.z * c);
}
void explorerDeform(inout vec3 p, inout vec3 n) {
#ifdef EXPLORER_LEGS
  float side = p.x >= 0.0 ? 1.0 : -1.0;
  float swing = side * sin(uPhase) * uStride;
  float bend = max(0.0, side * cos(uPhase)) * uStride * 1.3;
  float legW = (1.0 - smoothstep(0.62, 0.92, p.y)) * smoothstep(0.0, 0.03, abs(p.x));
  float kneeW = 1.0 - smoothstep(0.44, 0.56, p.y);
  explorerRotate(p, n, vec2(0.50, -0.13), bend * kneeW * legW);
  explorerRotate(p, n, vec2(0.90, -0.13), -swing * legW);
#endif
#ifdef EXPLORER_ARM
  float armW = smoothstep(0.27, 0.30, p.x) * (1.0 - smoothstep(1.18, 1.34, p.y));
  explorerRotate(p, n, vec2(1.42, -0.12), sin(uPhase) * uStride * 0.55 * armW);
#endif
}
`;
const FRAGMENT_HEADER = `
uniform float uCut;
uniform float uCutSide;
uniform float uRootY;
uniform vec3 uEdge;
varying vec3 vExplorerWorld;
float explorerHash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
`;
const FRAGMENT_DISSOLVE = `
  float explorerEdge = 0.0;
  if (uCutSide != 0.0) {
    float h = clamp((vExplorerWorld.y - uRootY) / ${HEIGHT.toFixed(2)}, 0.0, 1.0);
    float key = (1.0 - h) * 0.84 + explorerHash(floor(vExplorerWorld * 90.0)) * 0.16;
    if (uCutSide > 0.0 && key < uCut) discard;
    if (uCutSide < 0.0 && key >= uCut) discard;
    explorerEdge = 1.0 - smoothstep(0.0, 0.035, abs(key - uCut));
  }
`;

export function createExplorer({ THREE, GLTFLoader, base = "models/", lite = false, still = false, colors, onEvent = () => {} }) {
  const group = new THREE.Group();
  group.name = "explorer";
  const disposables = [];
  const gltf = new GLTFLoader();
  const textures = new THREE.TextureLoader();
  const maxAniso = 8;

  function patchMaterial(material, defines) {
    const u = {
      uPhase: { value: 0 }, uStride: { value: 0 },
      uCut: { value: 0 }, uCutSide: { value: 0 }, uRootY: { value: 0 }, uEdge: { value: colors.in.clone() }
    };
    material.userData.u = u;
    material.defines = { ...(material.defines || {}), ...defines };
    material.customProgramCacheKey = () => "explorer:" + Object.keys(defines).join(",");
    material.onBeforeCompile = shader => {
      Object.assign(shader.uniforms, u);
      shader.vertexShader = VERTEX_HEADER + shader.vertexShader
        .replace("#include <beginnormal_vertex>", "vec3 objectNormal = vec3( normal );\nvec3 explorerPos = vec3( position );\nexplorerDeform( explorerPos, objectNormal );")
        .replace("#include <begin_vertex>", "vec3 transformed = explorerPos;")
        .replace("#include <project_vertex>", "#include <project_vertex>\nvExplorerWorld = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;");
      shader.fragmentShader = FRAGMENT_HEADER + shader.fragmentShader
        .replace("void main() {", "void main() {\n" + FRAGMENT_DISSOLVE)
        .replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\ntotalEmissiveRadiance += uEdge * explorerEdge * 3.0;");
    };
    return material;
  }
  async function loadTexture(file, isColor) {
    const tex = await textures.loadAsync(base + file);
    tex.flipY = false;
    if (isColor) tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = maxAniso;
    disposables.push(tex);
    return tex;
  }
  async function loadMesh(file) {
    const result = await gltf.loadAsync(base + file);
    let mesh = null;
    result.scene.traverse(o => { if (o.isMesh && !mesh) mesh = o; });
    if (!mesh) throw new Error("No mesh in " + file);
    mesh.removeFromParent();
    mesh.frustumCulled = false;
    disposables.push(mesh.geometry);
    return mesh;
  }
  function material(map, normalMap, defines) {
    const m = patchMaterial(new THREE.MeshStandardMaterial({ map, normalMap: lite ? null : normalMap, roughness: 0.82, metalness: 0 }), defines);
    disposables.push(m);
    return m;
  }

  // ---------- Parts ----------
  const parts = { holding: null, headset: null, vr: null };
  const headsetHome = { pos: new THREE.Vector3(...HEADSET_IN_HAND.position), quat: new THREE.Quaternion().setFromEuler(new THREE.Euler(...HEADSET_IN_HAND.rotation)) };
  const headsetFace = { pos: new THREE.Vector3(...HEADSET_ON_FACE.position), quat: new THREE.Quaternion().setFromEuler(new THREE.Euler(...HEADSET_ON_FACE.rotation)) };
  const headsetArcControl = new THREE.Vector3(-0.2, 1.74, 0.45);

  const holdingReady = (async () => {
    const [body, prop, map, normalMap] = await Promise.all([
      loadMesh(ASSETS.holding.mesh), loadMesh(ASSETS.headset.mesh),
      loadTexture(ASSETS.holding.color, true), loadTexture(ASSETS.holding.normal, false)
    ]);
    body.material = material(map, normalMap, { EXPLORER_LEGS: "", EXPLORER_ARM: "" });
    prop.material = material(map, normalMap, {});
    prop.position.copy(headsetHome.pos);
    prop.quaternion.copy(headsetHome.quat);
    group.add(body, prop);
    parts.holding = body;
    parts.headset = prop;
  })();
  // The wearing scan loads after the holding one; until it arrives the guide simply keeps holding the headset.
  const vrReady = holdingReady.then(async () => {
    const [body, map, normalMap] = await Promise.all([loadMesh(ASSETS.vr.mesh), loadTexture(ASSETS.vr.color, true), loadTexture(ASSETS.vr.normal, false)]);
    body.material = material(map, normalMap, { EXPLORER_LEGS: "" });
    body.visible = false;
    group.add(body);
    parts.vr = body;
  }).catch(error => { console.warn("Explorer: VR scan unavailable, the guide will keep holding the headset.", error); });

  // ---------- State ----------
  const state = {
    speed: 0, worn: false, wantWorn: false, yaw: 0, phase: 0, stride: 0, walk: 0, idleFor: 0,
    transition: null, arrived: false, present: 0, placed: false
  };
  const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3(), tmpC = new THREE.Vector3();

  function holdingParts() { return [parts.holding, parts.headset].filter(Boolean); }
  function showWorn(worn) {
    state.worn = worn && !!parts.vr;
    holdingParts().forEach(m => { m.visible = !state.worn; });
    if (parts.vr) parts.vr.visible = state.worn;
    if (parts.headset) { parts.headset.position.copy(headsetHome.pos); parts.headset.quaternion.copy(headsetHome.quat); }
    [...holdingParts(), parts.vr].filter(Boolean).forEach(m => { m.material.userData.u.uCutSide.value = 0; });
  }
  function placeHeadset(t) {
    // Quadratic arc from the hand, up and out in front, onto the face
    const a = 1 - t;
    tmpA.copy(headsetHome.pos).multiplyScalar(a * a)
      .add(tmpB.copy(headsetArcControl).multiplyScalar(2 * a * t))
      .add(tmpC.copy(headsetFace.pos).multiplyScalar(t * t));
    parts.headset.position.copy(tmpA);
    parts.headset.quaternion.slerpQuaternions(headsetHome.quat, headsetFace.quat, smooth(0, 1, t));
  }
  function crossfade(outgoing, incoming, cut, edge) {
    outgoing.forEach(m => { m.visible = true; const u = m.material.userData.u; u.uCutSide.value = 1; u.uCut.value = cut; u.uEdge.value.copy(edge); });
    incoming.forEach(m => { m.visible = true; const u = m.material.userData.u; u.uCutSide.value = -1; u.uCut.value = cut; u.uEdge.value.copy(edge); });
  }
  function startTransition(type, extra = {}) {
    state.transition = { type, t: 0, dur: { on: 1.9, off: 1.8, teleport: 1.05 }[type], ...extra };
    onEvent(type === "teleport" ? "teleport" : "headset-" + type);
  }
  function runTransition(tr, dt) {
    tr.t += dt / 1000;
    const p = Math.min(1, tr.t / tr.dur);
    const cutAt = (a, b) => -0.05 + smooth(a, b, p) * 1.1;
    if (tr.type === "on") {
      placeHeadset(smooth(0.08, 0.5, p));
      crossfade(holdingParts(), [parts.vr], cutAt(0.42, 0.86), colors.in);
    } else if (tr.type === "off") {
      if (p < 0.5) placeHeadset(1);
      crossfade([parts.vr], holdingParts(), cutAt(0.04, 0.46), colors.out);
      if (p >= 0.46) placeHeadset(1 - smooth(0.46, 0.9, p));
    } else if (tr.type === "teleport") {
      const visible = state.worn ? [parts.vr] : holdingParts();
      if (p < 0.45) crossfade(visible, [], cutAt(0, 0.42), colors.warp);
      else {
        if (!tr.jumped) {
          tr.jumped = true;
          if (tr.onJump) tr.onJump();   // the travel controller moves the guide while it is fully dissolved
          showWorn(tr.worn);
        }
        crossfade([], state.worn ? [parts.vr] : holdingParts(), cutAt(0.52, 1), colors.warp);
      }
    }
    if (p >= 1) {
      state.transition = null;
      if (tr.type === "on") showWorn(true);
      else if (tr.type === "off") showWorn(false);
      else showWorn(state.worn);
      onEvent(tr.type === "teleport" ? "arrive-teleport" : "headset-" + tr.type + "-done");
    }
  }

  // ---------- Per-frame update ----------
  // frame: { dt (ms), position (Vector3 on the floor), speed (m/s, ≥ 0), heading (yaw while moving),
  //          wantWorn (should the headset be on?), presentTo (point to turn to on arrival, or null), camera (Vector3) }
  function update(frame) {
    if (!parts.holding) return;
    const { dt, position, speed, heading, wantWorn, presentTo, camera } = frame;
    state.wantWorn = wantWorn;
    group.position.x = position.x;
    group.position.z = position.z;
    if (!state.placed) {
      state.placed = true;
      showWorn(wantWorn);
      vrReady.then(() => { if (!state.transition) showWorn(state.wantWorn); });
    }
    [parts.holding, parts.headset, parts.vr].filter(Boolean).forEach(m => { m.material.userData.u.uRootY.value = group.position.y; });

    if (still) {
      // Reduced motion: hold a still pose; state changes are instant
      if (state.worn !== (wantWorn && !!parts.vr)) showWorn(wantWorn);
      faceToward(camera, 16, Infinity);
      setPose(0, 0);
      return;
    }

    if (state.transition) runTransition(state.transition, dt);
    else if (parts.vr && state.worn !== wantWorn) startTransition(wantWorn ? "on" : "off");
    state.speed = speed;

    // Facing: travel direction while moving, the card briefly on arrival, then the camera
    const moving = speed > 0.15;
    if (moving) { state.idleFor = 0; state.present = 0; state.arrived = false; faceAngle(heading, dt, 0.009); }
    else {
      state.idleFor += dt;
      if (!state.transition && state.idleFor > 250 && !state.arrived) {
        state.arrived = true;
        state.present = presentTo ? 1400 : 0;
        onEvent("arrive");
      }
      if (state.present > 0 && presentTo) {
        state.present -= dt;
        faceToward(presentTo, dt, 0.006);
      } else faceToward(camera, dt, 0.006);
    }

    // Gait: cadence follows ground speed so the planted foot keeps pace with the body
    const amp = 0.36 + 0.18 * smooth(1.6, 3.6, state.speed);
    const walkTarget = moving ? 1 : 0;
    state.walk += (walkTarget - state.walk) * (1 - Math.exp(-dt * 0.012));
    if (moving) state.phase += (state.speed / (amp * LEG_LENGTH)) * dt / 1000;
    else if (state.walk < 0.02) state.phase = Math.round(state.phase / Math.PI) * Math.PI;
    setPose(state.phase, amp * state.walk);
  }
  function setPose(phase, stride) {
    [parts.holding, parts.vr].filter(Boolean).forEach(m => { const u = m.material.userData.u; u.uPhase.value = phase; u.uStride.value = stride; });
    // Keep the stance foot on the floor: drop the body by how much the swing raises the hips
    const drop = LEG_LENGTH * (1 - Math.cos(stride * Math.abs(Math.sin(phase))));
    const breathe = still ? 0 : Math.sin(performance.now() * 0.0016) * 0.0035 * (1 - Math.min(1, stride * 3));
    group.position.y = -drop;
    group.scale.set(1, 1 + breathe, 1);
    group.rotation.z = Math.sin(phase) * stride * 0.05;
  }
  function faceAngle(target, dt, rate) {
    let turn = target - state.yaw;
    turn = Math.atan2(Math.sin(turn), Math.cos(turn));
    state.yaw += turn * (1 - Math.exp(-dt * rate));
    group.rotation.y = state.yaw;
  }
  function faceToward(point, dt, rate = 0.006) {
    faceAngle(Math.atan2(point.x - group.position.x, point.z - group.position.z), dt, rate);
  }

  return {
    group,
    ready: holdingReady,
    update,
    // XR-style teleport: dissolve out, onJump() moves the guide while unseen, dissolve back in wearing the right gear
    teleport(worn, onJump) {
      if (still || !parts.holding) { onJump(); if (parts.holding) showWorn(worn); return; }
      startTransition("teleport", { worn: worn && !!parts.vr, onJump });
    },
    get busy() { return !!state.transition; },
    get teleporting() { return state.transition?.type === "teleport"; },
    dispose() { disposables.forEach(d => d.dispose && d.dispose()); group.removeFromParent(); }
  };
}

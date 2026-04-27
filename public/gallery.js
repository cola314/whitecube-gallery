import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { getOrSeedState, getActiveGallery, getImage, setActiveGallery, imageUrl } from './storage.js';
import { getRoom, ROOMS } from './rooms.js';

const state = await getOrSeedState();
const gallery = getActiveGallery(state);
const room = getRoom(gallery.roomId);

document.getElementById('splash-name').textContent = gallery.name;
document.getElementById('splash-count').textContent = `${gallery.artworks.length}점의 작품`;

(function renderGalleryList() {
  const list = document.getElementById('gallery-list');
  if (!list) return;
  list.innerHTML = '';
  for (const g of state.galleries) {
    const r = ROOMS[g.roomId] || ROOMS['single-hall'];
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'gallery-card' + (g.id === state.activeGalleryId ? ' active' : '');

    const name = document.createElement('div');
    name.className = 'gc-name';
    name.textContent = g.name;
    card.appendChild(name);

    const meta = document.createElement('div');
    meta.className = 'gc-meta';
    const roomShort = (r.name || '').split(' (')[0];
    meta.textContent = `${roomShort} · ${g.artworks.length}점`;
    card.appendChild(meta);

    const mark = document.createElement('div');
    mark.className = 'gc-active-mark';
    mark.textContent = '현재 선택';
    card.appendChild(mark);

    card.addEventListener('click', async () => {
      if (g.id === state.activeGalleryId) return;
      try {
        await setActiveGallery(g.id);
        window.location.reload();
      } catch (e) { console.error(e); }
    });
    list.appendChild(card);
  }
})();

function makeProceduralTexture(art) {
  const aspectFromDim = (() => {
    const parts = (art.dim || '').split('×').map(s => parseFloat(s));
    if (parts.length >= 2 && parts[0] > 0 && parts[1] > 0) return parts[0] / parts[1];
    return 1;
  })();
  const w = 512, h = Math.round(512 / aspectFromDim);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  const sat = art.sat ?? 22;
  const hue = art.hue ?? 30;
  const seed = art.seed ?? 42;
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, `hsl(${hue}, ${sat}%, 92%)`);
  bg.addColorStop(1, `hsl(${hue}, ${sat}%, 78%)`);
  ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);

  let s = seed * 9301 + 49297;
  const rand = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };

  for (let i = 0; i < 18; i++) {
    ctx.fillStyle = `hsla(${hue + (rand()*40-20)}, ${sat + 10}%, ${20 + rand()*60}%, ${0.18 + rand()*0.4})`;
    const x = rand()*w, y = rand()*h, r = 30 + rand()*180;
    ctx.beginPath(); ctx.ellipse(x, y, r, r*(0.4+rand()*1.2), rand()*Math.PI, 0, Math.PI*2); ctx.fill();
  }
  for (let i = 0; i < 14; i++) {
    ctx.strokeStyle = `hsla(${hue + (rand()*60-30)}, ${sat + 20}%, ${15 + rand()*50}%, ${0.5 + rand()*0.4})`;
    ctx.lineWidth = 2 + rand()*8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(rand()*w, rand()*h);
    ctx.bezierCurveTo(rand()*w, rand()*h, rand()*w, rand()*h, rand()*w, rand()*h);
    ctx.stroke();
  }
  const img = ctx.getImageData(0, 0, w, h);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 14;
    img.data[i]   += n; img.data[i+1] += n; img.data[i+2] += n;
  }
  ctx.putImageData(img, 0, 0);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return { tex, dataUrl: c.toDataURL('image/jpeg', 0.85), aspect: w/h };
}

async function makeUploadedTexture(blob) {
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });
    const w = img.naturalWidth, h = img.naturalHeight;
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    c.getContext('2d').drawImage(img, 0, 0);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    return { tex, dataUrl: c.toDataURL('image/jpeg', 0.85), aspect: w / h };
  } finally {
    URL.revokeObjectURL(url);
  }
}

const scene = new THREE.Scene();
scene.background = new THREE.Color(room.colors.wall === 0xfafafa ? 0xf5f5f7 : room.colors.wall);

const camera = new THREE.PerspectiveCamera(70, window.innerWidth/window.innerHeight, 0.05, 100);
camera.position.set(room.spawn.x, room.spawn.y, room.spawn.z);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.25;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

scene.add(new THREE.HemisphereLight(0xffffff, 0xeeeef0, 0.85));
const ceilingLight = new THREE.DirectionalLight(0xffffff, 0.7);
ceilingLight.position.set(0, room.dim.h * 2, 0);
scene.add(ceilingLight);

const HALL = room.dim;
const OUTER_PAD = 36;

// Inner walls: solid white (back to original)
const wallMat  = new THREE.MeshStandardMaterial({
  color: room.colors.wall, roughness: 0.95, metalness: 0.0
});
// Glass material for the single door cut into the back wall
const doorMat = new THREE.MeshStandardMaterial({
  color: 0xffffff, roughness: 0.05, metalness: 0.05,
  transparent: true, opacity: 0.18, side: THREE.DoubleSide
});
const floorMat = new THREE.MeshStandardMaterial({ color: room.colors.floor, roughness: 0.7, metalness: 0.05 });
const ceilMat  = new THREE.MeshStandardMaterial({ color: room.colors.ceiling, roughness: 1.0 });

// Outer solid wall material (opaque, white like original)
const outerWallMat = new THREE.MeshStandardMaterial({ color: room.colors.wall, roughness: 0.95 });

// Extended floor and ceiling covering outer area
const outerW = HALL.w + OUTER_PAD * 2;
const outerD = HALL.d + OUTER_PAD * 2;

const floor = new THREE.Mesh(new THREE.PlaneGeometry(outerW, outerD), floorMat);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(outerW, outerD), ceilMat);
ceiling.rotation.x = Math.PI / 2;
ceiling.position.y = HALL.h;
scene.add(ceiling);

function addWall(w, h, x, y, z, ry, mat) {
  const mat_ = mat || wallMat;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat_);
  m.position.set(x, y, z);
  m.rotation.y = ry;
  m.receiveShadow = true;
  scene.add(m);
}
// Inner solid walls. Front wall (behind spawn) has a small transparent door.
const DOOR_W = 1.5, DOOR_H = 2.2;

// Back, left, right: full solid walls
addWall(HALL.w, HALL.h, 0,         HALL.h/2, -HALL.d/2, 0);
addWall(HALL.d, HALL.h, -HALL.w/2, HALL.h/2, 0,         Math.PI/2);
addWall(HALL.d, HALL.h,  HALL.w/2, HALL.h/2, 0,        -Math.PI/2);

// Front wall (z = +HALL.d/2) split into 3 segments around the door cutout
const _sideW = HALL.w/2 - DOOR_W/2;
const _sideCenterX = (HALL.w/2 + DOOR_W/2) / 2;
addWall(HALL.w,  HALL.h - DOOR_H,  0,             (HALL.h + DOOR_H)/2,  HALL.d/2, Math.PI);
addWall(_sideW,  DOOR_H,           -_sideCenterX, DOOR_H/2,             HALL.d/2, Math.PI);
addWall(_sideW,  DOOR_H,            _sideCenterX, DOOR_H/2,             HALL.d/2, Math.PI);

// Transparent glass door
const door = new THREE.Mesh(new THREE.PlaneGeometry(DOOR_W, DOOR_H), doorMat);
door.position.set(0, DOOR_H/2, HALL.d/2);
scene.add(door);

// Door frame trim (dark)
const doorFrameMat = new THREE.MeshStandardMaterial({ color: 0x1d1d1f, roughness: 0.6, metalness: 0.2 });
const _t = 0.06;
const _tr_top = new THREE.Mesh(new THREE.BoxGeometry(DOOR_W + _t*2, _t, 0.04), doorFrameMat);
_tr_top.position.set(0, DOOR_H + _t/2, HALL.d/2);
scene.add(_tr_top);
const _tr_l = new THREE.Mesh(new THREE.BoxGeometry(_t, DOOR_H, 0.04), doorFrameMat);
_tr_l.position.set(-(DOOR_W/2 + _t/2), DOOR_H/2, HALL.d/2);
scene.add(_tr_l);
const _tr_r = new THREE.Mesh(new THREE.BoxGeometry(_t, DOOR_H, 0.04), doorFrameMat);
_tr_r.position.set(DOOR_W/2 + _t/2, DOOR_H/2, HALL.d/2);
scene.add(_tr_r);

// Outer solid walls (~12m outside inner walls)
const OUTER_WALL_OFFSET = 12;
const outerWallH = HALL.h;
const outerWallLenZ = HALL.d + 4;   // side walls length
const outerWallLenX = HALL.w + 8;   // front/back walls length

// Left outer wall (x negative side), faces inward (+x direction)
addWall(outerWallLenZ, outerWallH, -(HALL.w/2 + OUTER_WALL_OFFSET), outerWallH/2, 0, Math.PI/2, outerWallMat);
// Right outer wall (x positive side), faces inward (-x direction)
addWall(outerWallLenZ, outerWallH,  (HALL.w/2 + OUTER_WALL_OFFSET), outerWallH/2, 0, -Math.PI/2, outerWallMat);
// Back outer wall (z negative side), faces inward (+z direction)
addWall(outerWallLenX, outerWallH, 0, outerWallH/2, -(HALL.d/2 + OUTER_WALL_OFFSET), 0, outerWallMat);
// Front outer wall (z positive side, farther from entry), faces inward (-z direction)
addWall(outerWallLenX, outerWallH, 0, outerWallH/2,  (HALL.d/2 + OUTER_WALL_OFFSET), Math.PI, outerWallMat);

const baseMat = new THREE.MeshStandardMaterial({ color: 0xd2d2d7, roughness: 1.0 });
const baseH = 0.08;
function addBase(w, x, z, ry) {
  const b = new THREE.Mesh(new THREE.BoxGeometry(w, baseH, 0.02), baseMat);
  b.position.set(x, baseH/2, z);
  b.rotation.y = ry;
  scene.add(b);
}
addBase(HALL.w, 0, -HALL.d/2 + 0.011, 0);
addBase(HALL.w, 0,  HALL.d/2 - 0.011, 0);
addBase(HALL.d, -HALL.w/2 + 0.011, 0, Math.PI/2);
addBase(HALL.d,  HALL.w/2 - 0.011, 0, Math.PI/2);

const frameMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.6, metalness: 0.1 });
const matteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1.0 });
const interactables = [];

async function placeArtwork(art) {
  const slot = room.slots.find(s => s.id === art.slotId);
  if (!slot) return;

  let texInfo;
  if (art.imageId) {
    try {
      const blob = await getImage(art.imageId);
      if (blob) texInfo = await makeUploadedTexture(blob);
    } catch (e) { console.warn('image load failed', e); }
  }
  if (!texInfo) texInfo = makeProceduralTexture(art);

  const { tex, dataUrl, aspect } = texInfo;
  art._dataUrl = dataUrl;

  const maxW = 2.2, maxH = 2.2;
  let w = maxW, h = maxW / aspect;
  if (h > maxH) { h = maxH; w = maxH * aspect; }

  const group = new THREE.Group();
  const offsetY = slot.y - 1.7;
  group.position.set(slot.x, slot.y, slot.z);
  group.rotation.y = slot.ry;

  const frame = new THREE.Mesh(new THREE.BoxGeometry(w + 0.16, h + 0.16, 0.06), frameMat);
  frame.position.z = 0;
  group.add(frame);

  const matte = new THREE.Mesh(new THREE.BoxGeometry(w + 0.04, h + 0.04, 0.012), matteMat);
  matte.position.z = 0.036;
  group.add(matte);

  const canvasMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.35 })
  );
  canvasMesh.position.z = 0.044;
  canvasMesh.userData.art = art;
  group.add(canvasMesh);

  const labelCanvas = document.createElement('canvas');
  labelCanvas.width = 512; labelCanvas.height = 96;
  const lctx = labelCanvas.getContext('2d');
  lctx.fillStyle = '#ffffff'; lctx.fillRect(0, 0, 512, 96);
  lctx.fillStyle = '#1d1d1f';
  lctx.font = '600 28px -apple-system, Helvetica, Arial';
  lctx.fillText(art.title || '제목 없음', 16, 38);
  lctx.fillStyle = '#6e6e73';
  lctx.font = '400 22px -apple-system, Helvetica, Arial';
  lctx.fillText(`${art.artist || ''} · ${art.year || ''}`, 16, 72);
  const labelTex = new THREE.CanvasTexture(labelCanvas);
  labelTex.colorSpace = THREE.SRGBColorSpace;
  const label = new THREE.Mesh(
    new THREE.PlaneGeometry(0.6, 0.6 * 96/512),
    new THREE.MeshBasicMaterial({ map: labelTex, transparent: true })
  );
  label.position.set(-(w/2) + 0.3, -h/2 - 0.18, 0.075);
  group.add(label);

  const spot = new THREE.SpotLight(0xfff5e6, 1.2, 8, Math.PI/6, 0.45, 1.4);
  const fwd = new THREE.Vector3(0, 0, 1).applyEuler(new THREE.Euler(0, slot.ry, 0));
  spot.position.set(slot.x + fwd.x * 1.6, HALL.h - 0.4, slot.z + fwd.z * 1.6);
  spot.target.position.set(slot.x + fwd.x * 0.1, slot.y, slot.z + fwd.z * 0.1);
  scene.add(spot);
  scene.add(spot.target);

  scene.add(group);
  interactables.push({ mesh: canvasMesh, art });
}

const totalCount = gallery.artworks.length;
document.getElementById('counter').textContent = `— / ${totalCount}`;

(async () => {
  for (const art of gallery.artworks) {
    await placeArtwork(art);
  }
})();

// ── Outer gallery: decorative artworks on exterior walls (no interaction) ──
(function placeOuterArtworks() {
  const OFFSET = 12;
  // hue, sat, seed, dim(aspect ratio as w×h string), wall position params
  const outerDefs = [
    // Left outer wall (x = -(HALL.w/2 + OFFSET)), facing +x (ry = -Math.PI/2)
    { hue: 210, sat: 30, seed: 17,  dim: '3×4',  x: -(HALL.w/2 + OFFSET - 0.06), y: HALL.h * 0.55, z: -HALL.d * 0.25, ry: -Math.PI/2 },
    { hue: 340, sat: 18, seed: 83,  dim: '4×3',  x: -(HALL.w/2 + OFFSET - 0.06), y: HALL.h * 0.55, z:  HALL.d * 0.2,  ry: -Math.PI/2 },
    // Right outer wall (x = +(HALL.w/2 + OFFSET)), facing -x (ry = Math.PI/2)
    { hue:  40, sat: 25, seed: 55,  dim: '3×4',  x:  (HALL.w/2 + OFFSET - 0.06), y: HALL.h * 0.55, z: -HALL.d * 0.2,  ry:  Math.PI/2 },
    { hue: 160, sat: 20, seed: 101, dim: '4×3',  x:  (HALL.w/2 + OFFSET - 0.06), y: HALL.h * 0.55, z:  HALL.d * 0.25, ry:  Math.PI/2 },
    // Back outer wall (z = -(HALL.d/2 + OFFSET)), facing +z (ry = 0)
    { hue:  20, sat: 35, seed: 211, dim: '4×3',  x: -HALL.w * 0.2, y: HALL.h * 0.55, z: -(HALL.d/2 + OFFSET - 0.06), ry: 0 },
    { hue: 270, sat: 15, seed: 137, dim: '3×4',  x:  HALL.w * 0.2, y: HALL.h * 0.55, z: -(HALL.d/2 + OFFSET - 0.06), ry: 0 },
    // Front outer wall (z = +(HALL.d/2 + OFFSET)), facing -z (ry = Math.PI)
    { hue:  80, sat: 22, seed: 307, dim: '4×3',  x: -HALL.w * 0.15, y: HALL.h * 0.55, z:  (HALL.d/2 + OFFSET - 0.06), ry: Math.PI },
    { hue: 195, sat: 28, seed: 421, dim: '3×4',  x:  HALL.w * 0.15, y: HALL.h * 0.55, z:  (HALL.d/2 + OFFSET - 0.06), ry: Math.PI },
  ];

  const outerFrameMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.6, metalness: 0.1 });
  const outerMatteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1.0 });

  for (const def of outerDefs) {
    const { tex } = makeProceduralTexture({ hue: def.hue, sat: def.sat, seed: def.seed, dim: def.dim });

    const parts = def.dim.split('×').map(Number);
    const aspect = parts[0] / parts[1];
    const maxW = 2.0, maxH = 2.0;
    let w = maxW, h = maxW / aspect;
    if (h > maxH) { h = maxH; w = maxH * aspect; }

    const group = new THREE.Group();
    group.position.set(def.x, def.y, def.z);
    group.rotation.y = def.ry;

    const frame = new THREE.Mesh(new THREE.BoxGeometry(w + 0.14, h + 0.14, 0.05), outerFrameMat);
    group.add(frame);

    const matte = new THREE.Mesh(new THREE.BoxGeometry(w + 0.03, h + 0.03, 0.01), outerMatteMat);
    matte.position.z = 0.03;
    group.add(matte);

    const canvas = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.35 })
    );
    canvas.position.z = 0.038;
    group.add(canvas);

    scene.add(group);
    // NOT added to interactables — decorative only

    // Spotlight for each outer artwork
    const fwd = new THREE.Vector3(0, 0, 1).applyEuler(new THREE.Euler(0, def.ry, 0));
    const spot = new THREE.SpotLight(0xfff0d8, 0.9, 10, Math.PI / 6, 0.5, 1.5);
    spot.position.set(def.x + fwd.x * 1.4, HALL.h - 0.4, def.z + fwd.z * 1.4);
    spot.target.position.set(def.x, def.y, def.z);
    scene.add(spot);
    scene.add(spot.target);
  }
})();

const controls = new PointerLockControls(camera, renderer.domElement);
const move = { fwd: false, back: false, left: false, right: false };
const velocity = new THREE.Vector3();

document.addEventListener('keydown', (e) => {
  switch (e.code) {
    case 'KeyW': case 'ArrowUp':    move.fwd = true; break;
    case 'KeyS': case 'ArrowDown':  move.back = true; break;
    case 'KeyA': case 'ArrowLeft':  move.left = true; break;
    case 'KeyD': case 'ArrowRight': move.right = true; break;
  }
});
document.addEventListener('keyup', (e) => {
  switch (e.code) {
    case 'KeyW': case 'ArrowUp':    move.fwd = false; break;
    case 'KeyS': case 'ArrowDown':  move.back = false; break;
    case 'KeyA': case 'ArrowLeft':  move.left = false; break;
    case 'KeyD': case 'ArrowRight': move.right = false; break;
  }
});

const splash   = document.getElementById('splash');
const hud      = document.getElementById('hud');
const enterBtn = document.getElementById('enter');
const escHint  = document.getElementById('esc-hint');

const isTouch = matchMedia('(pointer: coarse)').matches;
if (isTouch) document.body.classList.add('touch');

enterBtn.addEventListener('click', () => {
  splash.classList.add('hidden');
  hud.classList.add('visible');
  if (!isTouch) controls.lock();
});
controls.addEventListener('lock', () => escHint.classList.remove('visible'));
controls.addEventListener('unlock', () => {
  if (!splash.classList.contains('hidden')) return;
  escHint.classList.add('visible');
  setTimeout(() => escHint.classList.remove('visible'), 2000);
});
renderer.domElement.addEventListener('click', () => {
  if (isTouch) return;
  if (splash.classList.contains('hidden') && !controls.isLocked) controls.lock();
});

const raycaster = new THREE.Raycaster();
const center = new THREE.Vector2(0, 0);
let hovered = null;

function pick() {
  raycaster.setFromCamera(center, camera);
  const meshes = interactables.map(o => o.mesh);
  const hits = raycaster.intersectObjects(meshes, false);
  if (hits.length && hits[0].distance < 4) return hits[0].object;
  return null;
}

renderer.domElement.addEventListener('pointerdown', (e) => {
  if (!splash.classList.contains('hidden')) return;
  if (isTouch) {
    const rect = renderer.domElement.getBoundingClientRect();
    const cx = rect.width/2, cy = rect.height/2;
    if (Math.hypot(e.clientX - cx, e.clientY - cy) < 80) {
      const obj = pick();
      if (obj) openPanel(obj.userData.art);
    }
  } else if (controls.isLocked) {
    const obj = pick();
    if (obj) openPanel(obj.userData.art);
  }
});

const panel = document.getElementById('panel');
document.getElementById('panel-close').addEventListener('click', () => {
  panel.classList.remove('open');
  if (!isTouch && splash.classList.contains('hidden')) controls.lock();
});

function openPanel(art) {
  document.getElementById('panel-no').textContent = `No. ${art.no || '—'}`;
  document.getElementById('panel-title').textContent = art.title || '제목 없음';
  document.getElementById('panel-artist').textContent = art.artist || '';
  document.getElementById('panel-year').textContent = art.year || '';
  document.getElementById('panel-medium').textContent = art.medium || '';
  document.getElementById('panel-dim').textContent = art.dim || '';
  document.getElementById('panel-desc').textContent = art.desc || '';
  if (art._dataUrl) document.getElementById('panel-thumb').style.backgroundImage = `url(${art._dataUrl})`;
  panel.classList.add('open');
  if (!isTouch) controls.unlock();
  document.getElementById('counter').textContent = `${art.no || '—'} / ${totalCount}`;
}

const joystick = document.getElementById('joystick');
const stick = document.getElementById('stick');
const lookpad = document.getElementById('lookpad');
let stickActive = false;
let stickVec = { x: 0, y: 0 };

joystick.addEventListener('pointerdown', (e) => { stickActive = true; joystick.setPointerCapture(e.pointerId); });
joystick.addEventListener('pointermove', (e) => {
  if (!stickActive) return;
  const rect = joystick.getBoundingClientRect();
  const dx = e.clientX - (rect.left + rect.width/2);
  const dy = e.clientY - (rect.top + rect.height/2);
  const max = rect.width/2 - 10;
  const len = Math.min(Math.hypot(dx, dy), max);
  const ang = Math.atan2(dy, dx);
  const x = Math.cos(ang) * len, y = Math.sin(ang) * len;
  stick.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;
  stickVec.x = x / max; stickVec.y = y / max;
});
const resetStick = () => {
  stickActive = false; stickVec = { x: 0, y: 0 };
  stick.style.transform = `translate(-50%, -50%)`;
};
joystick.addEventListener('pointerup', resetStick);
joystick.addEventListener('pointercancel', resetStick);

let lookActive = false; let lastLook = { x: 0, y: 0 };
let touchYaw = 0, touchPitch = 0;
lookpad.addEventListener('pointerdown', (e) => { lookActive = true; lookpad.setPointerCapture(e.pointerId); lastLook = { x: e.clientX, y: e.clientY }; });
lookpad.addEventListener('pointermove', (e) => {
  if (!lookActive) return;
  const dx = e.clientX - lastLook.x;
  const dy = e.clientY - lastLook.y;
  lastLook = { x: e.clientX, y: e.clientY };
  touchYaw   -= dx * 0.0035;
  touchPitch -= dy * 0.0035;
  touchPitch = Math.max(-Math.PI/2 + 0.1, Math.min(Math.PI/2 - 0.1, touchPitch));
});
lookpad.addEventListener('pointerup', () => { lookActive = false; });
lookpad.addEventListener('pointercancel', () => { lookActive = false; });

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const clock = new THREE.Clock();
const tmpEuler = new THREE.Euler(0, 0, 0, 'YXZ');

function tick() {
  const dt = Math.min(clock.getDelta(), 0.1);
  const speed = 3.4;
  velocity.x -= velocity.x * 10 * dt;
  velocity.z -= velocity.z * 10 * dt;

  let fwdInput = 0, rightInput = 0;
  if (move.fwd)   fwdInput += 1;
  if (move.back)  fwdInput -= 1;
  if (move.right) rightInput += 1;
  if (move.left)  rightInput -= 1;
  if (isTouch) { fwdInput -= stickVec.y; rightInput += stickVec.x; }
  fwdInput   = Math.max(-1, Math.min(1, fwdInput));
  rightInput = Math.max(-1, Math.min(1, rightInput));

  if (isTouch) {
    tmpEuler.setFromQuaternion(camera.quaternion);
    tmpEuler.y = touchYaw;
    tmpEuler.x = touchPitch;
    camera.quaternion.setFromEuler(tmpEuler);
  }

  if (controls.isLocked || isTouch) {
    velocity.z -= fwdInput   * speed * 10 * dt;
    velocity.x -= rightInput * speed * 10 * dt;
    if (controls.isLocked) {
      controls.moveRight(-velocity.x * dt);
      controls.moveForward(-velocity.z * dt);
    } else {
      const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion); forward.y = 0; forward.normalize();
      const right   = new THREE.Vector3(1, 0,  0).applyQuaternion(camera.quaternion); right.y = 0; right.normalize();
      camera.position.addScaledVector(forward, -velocity.z * dt);
      camera.position.addScaledVector(right,   -velocity.x * dt);
    }
  }

  const m = 0.6;
  camera.position.x = Math.max(-HALL.w/2 + m, Math.min(HALL.w/2 - m, camera.position.x));
  camera.position.z = Math.max(-HALL.d/2 + m, Math.min(HALL.d/2 - m, camera.position.z));
  camera.position.y = 1.65;

  const hit = pick();
  if (hit !== hovered) {
    hovered = hit;
    document.getElementById('counter').textContent = hit
      ? `${hit.userData.art.no || '—'} / ${totalCount}`
      : `— / ${totalCount}`;
  }

  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
tick();

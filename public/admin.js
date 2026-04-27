import {
  getOrSeedState, refreshState, loadState, getActiveGallery,
  createGallery, updateGalleryMeta, deleteGallery, setActiveGallery,
  createArtwork, updateArtwork, deleteArtwork,
  imageUrl, uid, processImageFile, exportAll, importAll
} from './storage.js';
import { ROOMS, listRooms } from './rooms.js';

let state = await getOrSeedState();
let editingArtworkId = null;
let pendingImageBlob = null;
let pendingImageDims = null;
let pendingImageRevoke = null;

const $ = (id) => document.getElementById(id);

function activeGallery() {
  return getActiveGallery(state);
}

function showToast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('visible');
  clearTimeout(showToast._tid);
  showToast._tid = setTimeout(() => t.classList.remove('visible'), 2000);
}

function thumbUrl(art) {
  return art.imageId ? imageUrl(art.imageId) : null;
}

function renderGallerySelect() {
  const sel = $('gallery-select');
  sel.innerHTML = '';
  for (const g of state.galleries) {
    const opt = document.createElement('option');
    opt.value = g.id;
    opt.textContent = g.name;
    if (g.id === state.activeGalleryId) opt.selected = true;
    sel.appendChild(opt);
  }
  const g = activeGallery();
  if (g) {
    $('gallery-name').value = g.name;
    $('room-select').value = g.roomId;
  }
}

function renderRoomSelect() {
  const sel = $('room-select');
  sel.innerHTML = '';
  for (const r of listRooms()) {
    const opt = document.createElement('option');
    opt.value = r.id;
    opt.textContent = r.name;
    sel.appendChild(opt);
  }
}

const SVG_NS = 'http://www.w3.org/2000/svg';

function renderMinimap() {
  const g = activeGallery();
  const room = ROOMS[g.roomId] || ROOMS['single-hall'];
  const { w, d } = room.dim;
  const svg = $('minimap');
  const pad = 1.6;
  svg.setAttribute('viewBox', `${-w/2 - pad} ${-d/2 - pad} ${w + pad*2} ${d + pad*2}`);
  while (svg.firstChild) svg.removeChild(svg.firstChild);
  $('minimap-info').textContent = `${room.name} · 슬롯 ${room.slots.length}개 · 작품 ${g.artworks.length}점`;

  const floor = document.createElementNS(SVG_NS, 'rect');
  floor.setAttribute('x', -w/2); floor.setAttribute('y', -d/2);
  floor.setAttribute('width', w); floor.setAttribute('height', d);
  floor.setAttribute('fill', '#ffffff');
  floor.setAttribute('stroke', '#1d1d1f');
  floor.setAttribute('stroke-width', '0.12');
  svg.appendChild(floor);

  const dimText = document.createElementNS(SVG_NS, 'text');
  dimText.setAttribute('x', 0);
  dimText.setAttribute('y', d/2 + 1.1);
  dimText.setAttribute('text-anchor', 'middle');
  dimText.setAttribute('font-size', '0.55');
  dimText.setAttribute('fill', '#86868b');
  dimText.textContent = `${w} × ${d} m`;
  svg.appendChild(dimText);

  const spawn = document.createElementNS(SVG_NS, 'circle');
  spawn.setAttribute('cx', room.spawn.x);
  spawn.setAttribute('cy', room.spawn.z);
  spawn.setAttribute('r', '0.4');
  spawn.setAttribute('fill', '#ffd60a');
  spawn.setAttribute('stroke', '#1d1d1f');
  spawn.setAttribute('stroke-width', '0.08');
  svg.appendChild(spawn);
  const spawnLabel = document.createElementNS(SVG_NS, 'text');
  spawnLabel.setAttribute('x', room.spawn.x);
  spawnLabel.setAttribute('y', room.spawn.z + 1.05);
  spawnLabel.setAttribute('text-anchor', 'middle');
  spawnLabel.setAttribute('font-size', '0.45');
  spawnLabel.setAttribute('fill', '#6e6e73');
  spawnLabel.textContent = '입장';
  svg.appendChild(spawnLabel);

  const slotByArt = Object.fromEntries(g.artworks.filter(a => a.slotId).map(a => [a.slotId, a]));

  const HIT_W = 2.6, HIT_DEPTH = 2.0;
  const CARD_W = 2.0, CARD_H = 1.7;
  const BAR_W = 1.9, BAR_H = 0.5;

  for (const slot of room.slots) {
    const art = slotByArt[slot.id];
    const grp = document.createElementNS(SVG_NS, 'g');
    grp.setAttribute('class', 'slot-group');
    grp.setAttribute('transform',
      `translate(${slot.x},${slot.z}) rotate(${-slot.ry * 180 / Math.PI})`);

    const hit = document.createElementNS(SVG_NS, 'rect');
    hit.setAttribute('x', -HIT_W/2);
    hit.setAttribute('y', -0.4);
    hit.setAttribute('width', HIT_W);
    hit.setAttribute('height', HIT_DEPTH);
    hit.setAttribute('class', 'slot-hit');
    hit.setAttribute('pointer-events', 'all');
    grp.appendChild(hit);

    if (art) {
      const card = document.createElementNS(SVG_NS, 'rect');
      card.setAttribute('x', -CARD_W/2);
      card.setAttribute('y', -0.05);
      card.setAttribute('width', CARD_W);
      card.setAttribute('height', CARD_H);
      card.setAttribute('rx', 0.1);
      card.setAttribute('class', 'slot-card');
      card.setAttribute('fill', '#ffffff');
      card.setAttribute('stroke', '#0071e3');
      card.setAttribute('stroke-width', '0.06');
      grp.appendChild(card);

      const inset = 0.08;
      const imgX = -CARD_W/2 + inset, imgY = -0.05 + inset;
      const imgW = CARD_W - inset*2, imgH = CARD_H - inset*2;
      const url = thumbUrl(art);

      if (url) {
        const clipId = `clip-${slot.id}-${Math.random().toString(36).slice(2,7)}`;
        const defs = document.createElementNS(SVG_NS, 'defs');
        const clip = document.createElementNS(SVG_NS, 'clipPath');
        clip.setAttribute('id', clipId);
        const cr = document.createElementNS(SVG_NS, 'rect');
        cr.setAttribute('x', imgX); cr.setAttribute('y', imgY);
        cr.setAttribute('width', imgW); cr.setAttribute('height', imgH);
        cr.setAttribute('rx', 0.05);
        clip.appendChild(cr);
        defs.appendChild(clip);
        grp.appendChild(defs);

        const img = document.createElementNS(SVG_NS, 'image');
        img.setAttribute('href', url);
        img.setAttribute('x', imgX);
        img.setAttribute('y', imgY);
        img.setAttribute('width', imgW);
        img.setAttribute('height', imgH);
        img.setAttribute('preserveAspectRatio', 'xMidYMid slice');
        img.setAttribute('clip-path', `url(#${clipId})`);
        img.setAttribute('pointer-events', 'none');
        grp.appendChild(img);
      } else {
        const tone = document.createElementNS(SVG_NS, 'rect');
        tone.setAttribute('x', imgX); tone.setAttribute('y', imgY);
        tone.setAttribute('width', imgW); tone.setAttribute('height', imgH);
        tone.setAttribute('rx', 0.05);
        tone.setAttribute('fill', `hsl(${art.hue ?? 30}, ${(art.sat ?? 22)}%, 80%)`);
        tone.setAttribute('pointer-events', 'none');
        grp.appendChild(tone);
      }

      const badge = document.createElementNS(SVG_NS, 'rect');
      badge.setAttribute('x', -CARD_W/2 - 0.04);
      badge.setAttribute('y', -0.32);
      badge.setAttribute('width', 0.7);
      badge.setAttribute('height', 0.36);
      badge.setAttribute('rx', 0.08);
      badge.setAttribute('fill', '#0071e3');
      badge.setAttribute('pointer-events', 'none');
      grp.appendChild(badge);

      const noText = document.createElementNS(SVG_NS, 'text');
      noText.setAttribute('x', -CARD_W/2 + 0.31);
      noText.setAttribute('y', -0.06);
      noText.setAttribute('text-anchor', 'middle');
      noText.setAttribute('font-size', '0.26');
      noText.setAttribute('font-weight', '700');
      noText.setAttribute('fill', '#ffffff');
      noText.setAttribute('pointer-events', 'none');
      noText.textContent = art.no || '·';
      grp.appendChild(noText);
    } else {
      const bar = document.createElementNS(SVG_NS, 'rect');
      bar.setAttribute('x', -BAR_W/2);
      bar.setAttribute('y', -BAR_H/2);
      bar.setAttribute('width', BAR_W);
      bar.setAttribute('height', BAR_H);
      bar.setAttribute('rx', 0.1);
      bar.setAttribute('class', 'slot-bar empty');
      bar.setAttribute('fill', 'rgba(255,255,255,0.6)');
      bar.setAttribute('stroke', '#86868b');
      bar.setAttribute('stroke-width', '0.06');
      bar.setAttribute('stroke-dasharray', '0.2 0.14');
      bar.setAttribute('pointer-events', 'none');
      grp.appendChild(bar);

      const plus = document.createElementNS(SVG_NS, 'text');
      plus.setAttribute('x', -BAR_W/2 + 0.32);
      plus.setAttribute('y', 0.09);
      plus.setAttribute('text-anchor', 'middle');
      plus.setAttribute('font-size', '0.36');
      plus.setAttribute('font-weight', '300');
      plus.setAttribute('fill', '#86868b');
      plus.setAttribute('pointer-events', 'none');
      plus.textContent = '+';
      grp.appendChild(plus);

      const label = document.createElementNS(SVG_NS, 'text');
      label.setAttribute('x', 0.18);
      label.setAttribute('y', 0.09);
      label.setAttribute('text-anchor', 'middle');
      label.setAttribute('font-size', '0.26');
      label.setAttribute('font-weight', '500');
      label.setAttribute('fill', '#6e6e73');
      label.setAttribute('pointer-events', 'none');
      label.textContent = slot.label || slot.id;
      grp.appendChild(label);
    }

    grp.addEventListener('click', () => {
      if (art) openEdit(art.id);
      else openAddWithSlot(slot.id);
    });
    grp.addEventListener('pointerenter', (e) => showMmTip(e, slot, art));
    grp.addEventListener('pointermove', moveMmTip);
    grp.addEventListener('pointerleave', hideMmTip);

    svg.appendChild(grp);
  }
}

const mmTip = () => $('minimap-tooltip');
function showMmTip(e, slot, art) {
  const t = mmTip();
  if (art) {
    t.innerHTML = `<div class="t-title">No. ${art.no || '—'} · ${art.title || '제목 없음'}</div><div class="t-sub">${art.artist || ''} · ${slot.label || slot.id}</div>`;
  } else {
    t.innerHTML = `<div class="t-title">${slot.label || slot.id}</div><div class="t-sub">빈 슬롯 · 클릭하여 작품 추가</div>`;
  }
  t.classList.add('visible');
  moveMmTip(e);
}
function moveMmTip(e) {
  const t = mmTip();
  const x = Math.min(e.clientX + 14, window.innerWidth - 240);
  const y = Math.min(e.clientY + 14, window.innerHeight - 60);
  t.style.left = `${x}px`;
  t.style.top = `${y}px`;
}
function hideMmTip() { mmTip().classList.remove('visible'); }

function openAddWithSlot(slotId) {
  editingArtworkId = null;
  clearForm();
  populateSlotSelect(slotId);
  const g = activeGallery();
  const next = String(g.artworks.length + 1).padStart(2, '0');
  $('f-no').value = next;
  $('f-slot').value = slotId;
  openModal('작품 추가');
}

function renderArtworks() {
  const g = activeGallery();
  const tbody = $('artwork-rows');
  tbody.innerHTML = '';
  $('artwork-count').textContent = `${g.artworks.length} 점`;
  $('empty-state').style.display = g.artworks.length === 0 ? '' : 'none';
  renderMinimap();

  const room = ROOMS[g.roomId] || ROOMS['single-hall'];
  const slotMap = Object.fromEntries(room.slots.map(s => [s.id, s]));

  for (const art of g.artworks) {
    const tr = document.createElement('tr');
    const tdThumb = document.createElement('td');
    tdThumb.className = 'thumb-cell';
    const div = document.createElement('div');
    div.className = 'thumb-img';
    const u = thumbUrl(art);
    if (u) div.style.backgroundImage = `url(${u})`;
    tdThumb.appendChild(div);

    const tdNo = document.createElement('td'); tdNo.textContent = art.no || '—';
    const tdTitle = document.createElement('td'); tdTitle.textContent = art.title || '—';
    const tdArtist = document.createElement('td'); tdArtist.textContent = art.artist || '';

    const tdSlot = document.createElement('td');
    if (art.slotId && slotMap[art.slotId]) {
      const pill = document.createElement('span');
      pill.className = 'pill assigned';
      pill.textContent = slotMap[art.slotId].label || art.slotId;
      tdSlot.appendChild(pill);
    } else {
      const pill = document.createElement('span');
      pill.className = 'pill empty';
      pill.textContent = '미배치';
      tdSlot.appendChild(pill);
    }

    const tdAct = document.createElement('td');
    tdAct.className = 'row-actions';
    const editBtn = document.createElement('button');
    editBtn.className = 'btn-ghost btn-sm';
    editBtn.textContent = '편집';
    editBtn.onclick = () => openEdit(art.id);
    const delBtn = document.createElement('button');
    delBtn.className = 'btn-danger btn-sm';
    delBtn.textContent = '삭제';
    delBtn.onclick = () => doDeleteArtwork(art.id);
    tdAct.appendChild(editBtn);
    tdAct.appendChild(delBtn);

    tr.append(tdThumb, tdNo, tdTitle, tdArtist, tdSlot, tdAct);
    tbody.appendChild(tr);
  }
}

function populateSlotSelect(currentSlotId) {
  const g = activeGallery();
  const room = ROOMS[g.roomId] || ROOMS['single-hall'];
  const taken = new Set(
    g.artworks.filter(a => a.id !== editingArtworkId && a.slotId).map(a => a.slotId)
  );
  const sel = $('f-slot');
  sel.innerHTML = '';
  const empty = document.createElement('option');
  empty.value = '';
  empty.textContent = '— 미배치 —';
  sel.appendChild(empty);
  for (const slot of room.slots) {
    const opt = document.createElement('option');
    opt.value = slot.id;
    opt.textContent = slot.label || slot.id;
    if (taken.has(slot.id)) {
      opt.disabled = true;
      opt.textContent += ' (사용 중)';
    }
    if (currentSlotId === slot.id) opt.selected = true;
    sel.appendChild(opt);
  }
}

function clearForm() {
  $('f-no').value = '';
  $('f-title').value = '';
  $('f-artist').value = '';
  $('f-year').value = '';
  $('f-medium').value = '';
  $('f-dim').value = '';
  $('f-desc').value = '';
  $('f-slot').value = '';
  $('f-image').value = '';
  $('image-preview').style.display = 'none';
  $('image-preview').src = '';
  $('file-drop-text').textContent = '이미지를 드래그하거나 클릭해서 업로드';
  if (pendingImageRevoke) { URL.revokeObjectURL(pendingImageRevoke); pendingImageRevoke = null; }
  pendingImageBlob = null;
  pendingImageDims = null;
}

function openModal(title) {
  $('modal-title').textContent = title;
  $('modal').classList.add('open');
}
function closeModal() {
  $('modal').classList.remove('open');
  editingArtworkId = null;
  clearForm();
}

function openAdd() {
  editingArtworkId = null;
  clearForm();
  populateSlotSelect(null);
  const g = activeGallery();
  const next = String(g.artworks.length + 1).padStart(2, '0');
  $('f-no').value = next;
  openModal('작품 추가');
}

function openEdit(id) {
  const g = activeGallery();
  const art = g.artworks.find(a => a.id === id);
  if (!art) return;
  editingArtworkId = id;
  clearForm();
  populateSlotSelect(art.slotId);
  $('f-no').value = art.no || '';
  $('f-title').value = art.title || '';
  $('f-artist').value = art.artist || '';
  $('f-year').value = art.year || '';
  $('f-medium').value = art.medium || '';
  $('f-dim').value = art.dim || '';
  $('f-desc').value = art.desc || '';
  $('f-slot').value = art.slotId || '';
  if (art.imageId) {
    $('image-preview').src = imageUrl(art.imageId);
    $('image-preview').style.display = '';
    $('file-drop-text').textContent = '현재 이미지 있음 · 새로 업로드하면 교체됩니다';
  }
  openModal('작품 편집');
}

async function saveArtwork() {
  const g = activeGallery();
  const data = {
    no: $('f-no').value.trim(),
    title: $('f-title').value.trim(),
    artist: $('f-artist').value.trim(),
    year: $('f-year').value.trim() ? parseInt($('f-year').value.trim(), 10) : '',
    medium: $('f-medium').value.trim(),
    dim: $('f-dim').value.trim(),
    desc: $('f-desc').value.trim(),
    slotId: $('f-slot').value || ''
  };
  if (!data.title) { showToast('제목을 입력해주세요'); return; }

  try {
    if (editingArtworkId) {
      await updateArtwork(editingArtworkId, data, pendingImageBlob, pendingImageDims);
    } else {
      await createArtwork(g.id, data, pendingImageBlob, pendingImageDims);
    }
    state = loadState();
    closeModal();
    renderArtworks();
    showToast('저장되었습니다');
  } catch (e) {
    console.error(e);
    showToast('저장 실패');
  }
}

async function doDeleteArtwork(id) {
  if (!confirm('이 작품을 삭제할까요? 이미지도 함께 삭제됩니다.')) return;
  try {
    await deleteArtwork(id);
    state = loadState();
    renderArtworks();
    showToast('삭제되었습니다');
  } catch (e) {
    console.error(e);
    showToast('삭제 실패');
  }
}

async function newGallery() {
  try {
    await createGallery('새 전시', 'single-hall');
    state = loadState();
    renderGallerySelect();
    renderArtworks();
    showToast('새 갤러리가 생성되었습니다');
  } catch (e) {
    console.error(e);
    showToast('생성 실패');
  }
}

async function delGallery() {
  if (state.galleries.length <= 1) { showToast('마지막 갤러리는 삭제할 수 없습니다'); return; }
  const g = activeGallery();
  if (!confirm(`갤러리 "${g.name}"와 모든 작품/이미지를 삭제할까요?`)) return;
  try {
    await deleteGallery(g.id);
    state = loadState();
    renderGallerySelect();
    renderArtworks();
    showToast('갤러리가 삭제되었습니다');
  } catch (e) {
    console.error(e);
    showToast('삭제 실패');
  }
}

function setupFileDrop() {
  const drop = $('file-drop');
  const input = $('f-image');
  const preview = $('image-preview');

  const handle = async (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) { showToast('이미지 파일만 업로드 가능합니다'); return; }
    try {
      const { blob, width, height } = await processImageFile(file);
      pendingImageBlob = blob;
      pendingImageDims = { width, height };
      if (pendingImageRevoke) URL.revokeObjectURL(pendingImageRevoke);
      const u = URL.createObjectURL(blob);
      pendingImageRevoke = u;
      preview.src = u;
      preview.style.display = '';
      $('file-drop-text').textContent = `업로드 대기 · ${width} × ${height}`;
    } catch (e) {
      console.error(e);
      showToast('이미지 처리 실패');
    }
  };

  input.addEventListener('change', (e) => handle(e.target.files[0]));
  drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('dragging'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('dragging'));
  drop.addEventListener('drop', (e) => {
    e.preventDefault();
    drop.classList.remove('dragging');
    handle(e.dataTransfer.files[0]);
  });
}

async function doExport() {
  try {
    const data = await exportAll();
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const u = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    a.href = u;
    a.download = `whitecube-backup-${ts}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(u);
    showToast('백업 파일을 다운로드했습니다');
  } catch (e) {
    console.error(e);
    showToast('내보내기 실패');
  }
}

async function doImport(file) {
  if (!file) return;
  try {
    const text = await file.text();
    const payload = JSON.parse(text);
    if (!confirm('현재 데이터를 백업 파일로 덮어쓸까요? 기존 갤러리/작품/이미지가 모두 교체됩니다.')) return;
    await importAll(payload);
    state = loadState();
    renderGallerySelect();
    renderArtworks();
    showToast('불러오기 완료');
  } catch (e) {
    console.error(e);
    showToast('불러오기 실패: 잘못된 파일');
  }
}

$('gallery-select').addEventListener('change', async (e) => {
  try {
    await setActiveGallery(e.target.value);
    state = loadState();
    renderGallerySelect();
    renderArtworks();
  } catch (err) { console.error(err); showToast('갤러리 전환 실패'); }
});

$('gallery-name').addEventListener('change', async (e) => {
  try {
    const g = activeGallery();
    await updateGalleryMeta(g.id, { name: e.target.value.trim() || '이름 없음' });
    state = loadState();
    renderGallerySelect();
    showToast('이름이 변경되었습니다');
  } catch (err) { console.error(err); showToast('변경 실패'); }
});

$('room-select').addEventListener('change', async (e) => {
  const g = activeGallery();
  const newRoomId = e.target.value;
  const newRoom = ROOMS[newRoomId];
  const newSlotIds = new Set(newRoom.slots.map(s => s.id));
  const orphaned = g.artworks.filter(a => a.slotId && !newSlotIds.has(a.slotId));

  if (orphaned.length > 0) {
    if (!confirm(`전시장을 변경하면 슬롯이 다른 ${orphaned.length}개 작품이 미배치 상태가 됩니다. 계속할까요?`)) {
      e.target.value = g.roomId;
      return;
    }
  }
  try {
    for (const o of orphaned) {
      await updateArtwork(o.id, { slotId: '' });
    }
    await updateGalleryMeta(g.id, { roomId: newRoomId });
    state = loadState();
    renderArtworks();
    showToast('전시장이 변경되었습니다');
  } catch (err) {
    console.error(err);
    showToast('변경 실패');
  }
});

$('new-gallery').addEventListener('click', newGallery);
$('delete-gallery').addEventListener('click', delGallery);
$('add-artwork').addEventListener('click', openAdd);
$('modal-cancel').addEventListener('click', closeModal);
$('modal-save').addEventListener('click', saveArtwork);
$('modal').addEventListener('click', (e) => { if (e.target === $('modal')) closeModal(); });

$('export-btn').addEventListener('click', doExport);
$('import-btn').addEventListener('click', () => $('import-file').click());
$('import-file').addEventListener('change', (e) => doImport(e.target.files[0]));

setupFileDrop();
renderRoomSelect();
renderGallerySelect();
renderArtworks();

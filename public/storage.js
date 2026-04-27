// REST client over the Express + SQLite backend.
// Same export surface as the previous IndexedDB-based version
// where it makes sense; some helpers became thin async wrappers.

let _state = null;

async function _refresh() {
  const res = await fetch('/api/galleries');
  if (!res.ok) throw new Error(`failed to load state: ${res.status}`);
  _state = await res.json();
  return _state;
}

export async function getOrSeedState() {
  if (_state) return _state;
  return _refresh();
}

export function loadState() {
  return _state;
}

export async function refreshState() {
  return _refresh();
}

export function getActiveGallery(state) {
  if (!state || !state.galleries) return null;
  return state.galleries.find(g => g.id === state.activeGalleryId) || state.galleries[0] || null;
}

export async function setActiveGallery(id) {
  const res = await fetch(`/api/galleries/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ isActive: true })
  });
  if (!res.ok) throw new Error('setActiveGallery failed');
  await _refresh();
}

export async function createGallery(name, roomId) {
  const res = await fetch('/api/galleries', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, roomId })
  });
  if (!res.ok) throw new Error('createGallery failed');
  const { id } = await res.json();
  await setActiveGallery(id);
  return id;
}

export async function updateGalleryMeta(id, patch) {
  const res = await fetch(`/api/galleries/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch)
  });
  if (!res.ok) throw new Error('updateGalleryMeta failed');
  await _refresh();
}

export async function deleteGallery(id) {
  const res = await fetch(`/api/galleries/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('deleteGallery failed');
  await _refresh();
}

function _formData(data, imageBlob, imageDims) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(data || {})) {
    if (v === null || v === undefined) continue;
    fd.append(k, String(v));
  }
  if (imageBlob) {
    fd.append('image', imageBlob, 'image.jpg');
    if (imageDims) {
      if (imageDims.width)  fd.append('imageWidth',  String(imageDims.width));
      if (imageDims.height) fd.append('imageHeight', String(imageDims.height));
    }
  }
  return fd;
}

export async function createArtwork(galleryId, data, imageBlob, imageDims) {
  const res = await fetch(`/api/galleries/${galleryId}/artworks`, {
    method: 'POST',
    body: _formData(data, imageBlob, imageDims)
  });
  if (!res.ok) throw new Error('createArtwork failed');
  const out = await res.json();
  await _refresh();
  return out.id;
}

export async function updateArtwork(id, data, imageBlob, imageDims) {
  const res = await fetch(`/api/artworks/${id}`, {
    method: 'PATCH',
    body: _formData(data, imageBlob, imageDims)
  });
  if (!res.ok) throw new Error('updateArtwork failed');
  await _refresh();
}

export async function deleteArtwork(id) {
  const res = await fetch(`/api/artworks/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('deleteArtwork failed');
  await _refresh();
}

export async function getImage(id) {
  if (!id) return null;
  const res = await fetch(`/api/images/${id}`);
  if (!res.ok) return null;
  return await res.blob();
}

export function imageUrl(id) {
  return id ? `/api/images/${id}` : null;
}

export function uid() {
  return 'x' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export async function processImageFile(file, maxDim = 2048) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });
    let { naturalWidth: width, naturalHeight: height } = img;
    const scale = Math.min(1, maxDim / Math.max(width, height));
    width = Math.max(1, Math.round(width * scale));
    height = Math.max(1, Math.round(height * scale));
    const c = document.createElement('canvas');
    c.width = width; c.height = height;
    c.getContext('2d').drawImage(img, 0, 0, width, height);
    const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.88));
    return { blob, width, height };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function exportAll() {
  const res = await fetch('/api/export');
  if (!res.ok) throw new Error('export failed');
  return await res.json();
}

export async function importAll(payload) {
  const res = await fetch('/api/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error('import failed');
  await _refresh();
}

// Compatibility shims (unused by new code but kept harmless)
export function saveState() { /* server is the source of truth */ }

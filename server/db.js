import Database from 'better-sqlite3';
import path from 'node:path';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
mkdirSync(DATA_DIR, { recursive: true });
const dbPath = path.join(DATA_DIR, 'whitecube.db');

export const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS galleries (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  room_id TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS artworks (
  id TEXT PRIMARY KEY,
  gallery_id TEXT NOT NULL REFERENCES galleries(id) ON DELETE CASCADE,
  no TEXT,
  title TEXT,
  artist TEXT,
  year INTEGER,
  medium TEXT,
  dim TEXT,
  description TEXT,
  slot_id TEXT,
  image_id TEXT,
  hue INTEGER,
  sat INTEGER,
  seed INTEGER,
  position INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_artworks_gallery ON artworks(gallery_id);

CREATE TABLE IF NOT EXISTS images (
  id TEXT PRIMARY KEY,
  blob BLOB NOT NULL,
  mime TEXT NOT NULL DEFAULT 'image/jpeg',
  width INTEGER,
  height INTEGER,
  created_at INTEGER NOT NULL
);
`;
db.exec(SCHEMA);

export function uid() {
  return 'x' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

const DEFAULT_ARTWORKS = [
  { no: '01', title: 'Quiet Geometry', artist: 'Lena Park', year: 2025, medium: 'Acrylic on canvas', dim: '120 × 90 cm', description: '단순한 기하학적 형태가 반복되며 만들어내는 고요함을 탐구한 작업. 색면의 미묘한 경계가 시간의 흐름을 암시한다.', seed: 11, hue: 28, sat: 22, slot_id: 'L-1' },
  { no: '02', title: 'Tide & Memory', artist: 'Joon Lee', year: 2024, medium: 'Oil on linen', dim: '150 × 110 cm', description: '어린 시절 바라본 동해의 파도와 잔상을 거친 붓질로 옮긴 풍경. 푸른빛과 모래색의 충돌이 기억의 두께를 만든다.', seed: 33, hue: 210, sat: 22, slot_id: 'L-2' },
  { no: '03', title: 'Atelier No. 7', artist: 'Mira Choi', year: 2025, medium: 'Photograph, archival pigment', dim: '80 × 100 cm', description: '비어 있는 작업실의 한낮. 빛이 만들어내는 정물을 그대로 사진에 담았다.', seed: 7, hue: 45, sat: 22, slot_id: 'L-3' },
  { no: '04', title: 'Soft Static', artist: 'Hyun Kang', year: 2023, medium: 'Mixed media', dim: '100 × 100 cm', description: '노이즈와 정적 사이의 진동을 시각화한 작업. 회색조의 미세한 입자가 화면 전체에서 떨리고 있다.', seed: 91, hue: 0, sat: 0, slot_id: 'L-4' },
  { no: '05', title: 'Garden, after', artist: 'Yuna Im', year: 2024, medium: 'Watercolor on paper', dim: '70 × 90 cm', description: '장마가 지나간 정원의 한 장면. 물에 번진 색이 식물의 호흡처럼 움직인다.', seed: 22, hue: 130, sat: 22, slot_id: 'R-1' },
  { no: '06', title: 'Black Field', artist: 'Sangwoo Bae', year: 2025, medium: 'Charcoal on canvas', dim: '180 × 130 cm', description: '검은 면이 만들어내는 깊이와 부피. 가까이 다가갈수록 표면의 질감이 풍경처럼 펼쳐진다.', seed: 4, hue: 0, sat: 0, slot_id: 'R-2' },
  { no: '07', title: 'Long Afternoon', artist: 'Eun Han', year: 2024, medium: 'Oil on canvas', dim: '90 × 120 cm', description: '오후의 빛이 길게 드리워진 실내. 일상의 평범한 시간을 따뜻한 톤으로 응시한다.', seed: 55, hue: 35, sat: 22, slot_id: 'R-3' },
  { no: '08', title: 'Pulse', artist: 'Doha Shin', year: 2025, medium: 'Digital print', dim: '100 × 70 cm', description: '도시의 리듬을 색띠로 환원한 작업. 일정한 간격이지만 불규칙한 강도가 살아 있다.', seed: 73, hue: 320, sat: 22, slot_id: 'R-4' },
  { no: '09', title: 'Snow Letters', artist: 'Mingyu Oh', year: 2023, medium: 'Ink on hanji', dim: '60 × 90 cm', description: '눈 위에 적힌 문자들이 천천히 사라지는 풍경. 서예적 선과 여백이 번갈아 호흡한다.', seed: 18, hue: 220, sat: 8, slot_id: 'B-1' },
  { no: '10', title: 'Inner Light', artist: 'Sora Kim', year: 2025, medium: 'Oil & gold leaf', dim: '110 × 110 cm', description: '어두운 면 사이로 비치는 작은 금빛. 명상의 순간을 회화적 빛으로 옮긴 작업.', seed: 88, hue: 50, sat: 22, slot_id: 'B-2' }
];

const galleryCount = db.prepare('SELECT COUNT(*) AS c FROM galleries').get().c;
if (galleryCount === 0) {
  const galleryId = uid();
  const now = Date.now();
  db.prepare(`INSERT INTO galleries (id, name, room_id, is_active, created_at, updated_at)
              VALUES (?, ?, ?, 1, ?, ?)`).run(galleryId, 'White Cube — 기본 전시', 'single-hall', now, now);
  const insertArt = db.prepare(`INSERT INTO artworks
    (id, gallery_id, no, title, artist, year, medium, dim, description, slot_id, image_id,
     hue, sat, seed, position, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?)`);
  DEFAULT_ARTWORKS.forEach((a, i) => {
    insertArt.run(uid(), galleryId, a.no, a.title, a.artist, a.year, a.medium, a.dim,
      a.description, a.slot_id, a.hue, a.sat, a.seed, i, now, now);
  });
  console.log('[db] seeded default gallery with', DEFAULT_ARTWORKS.length, 'artworks');
}

export function listGalleries() {
  const galleries = db.prepare(
    `SELECT id, name, room_id AS roomId, is_active AS isActive,
            created_at AS createdAt, updated_at AS updatedAt
       FROM galleries ORDER BY created_at ASC`).all();
  const artStmt = db.prepare(
    `SELECT id, no, title, artist, year, medium, dim, description AS "desc",
            slot_id AS slotId, image_id AS imageId, hue, sat, seed
       FROM artworks WHERE gallery_id = ? ORDER BY position ASC, created_at ASC`);
  for (const g of galleries) {
    g.artworks = artStmt.all(g.id);
    g.isActive = !!g.isActive;
  }
  const active = galleries.find(g => g.isActive) || galleries[0] || null;
  return { galleries, activeGalleryId: active?.id || null };
}

export function createGallery({ name, roomId }) {
  const id = uid();
  const now = Date.now();
  db.prepare(`INSERT INTO galleries (id, name, room_id, is_active, created_at, updated_at)
              VALUES (?, ?, ?, 0, ?, ?)`).run(id, name, roomId || 'single-hall', now, now);
  return id;
}

export function updateGallery(id, { name, roomId, isActive }) {
  const exists = db.prepare('SELECT id FROM galleries WHERE id = ?').get(id);
  if (!exists) return false;
  const now = Date.now();
  if (isActive === true) {
    db.prepare('UPDATE galleries SET is_active = 0').run();
    db.prepare('UPDATE galleries SET is_active = 1, updated_at = ? WHERE id = ?').run(now, id);
  }
  if (name !== undefined) db.prepare('UPDATE galleries SET name = ?, updated_at = ? WHERE id = ?').run(name, now, id);
  if (roomId !== undefined) {
    db.prepare('UPDATE galleries SET room_id = ?, updated_at = ? WHERE id = ?').run(roomId, now, id);
  }
  return true;
}

export function deleteGallery(id) {
  const imageIds = db.prepare(
    'SELECT image_id FROM artworks WHERE gallery_id = ? AND image_id IS NOT NULL').all(id);
  const txn = db.transaction(() => {
    db.prepare('DELETE FROM galleries WHERE id = ?').run(id);
    for (const row of imageIds) {
      db.prepare('DELETE FROM images WHERE id = ?').run(row.image_id);
    }
  });
  txn();
  if (!db.prepare('SELECT id FROM galleries WHERE is_active = 1').get()) {
    const first = db.prepare('SELECT id FROM galleries ORDER BY created_at ASC LIMIT 1').get();
    if (first) db.prepare('UPDATE galleries SET is_active = 1 WHERE id = ?').run(first.id);
  }
}

export function createArtwork(galleryId, data, imageBlob, imageMeta) {
  const id = uid();
  const now = Date.now();
  let imageId = null;
  const txn = db.transaction(() => {
    if (imageBlob) {
      imageId = uid();
      db.prepare(`INSERT INTO images (id, blob, mime, width, height, created_at)
                  VALUES (?, ?, ?, ?, ?, ?)`).run(
        imageId, imageBlob, imageMeta?.mime || 'image/jpeg',
        imageMeta?.width || null, imageMeta?.height || null, now);
    }
    const pos = db.prepare('SELECT COUNT(*) AS c FROM artworks WHERE gallery_id = ?').get(galleryId).c;
    db.prepare(`INSERT INTO artworks
      (id, gallery_id, no, title, artist, year, medium, dim, description, slot_id, image_id,
       hue, sat, seed, position, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      id, galleryId, data.no || null, data.title || null, data.artist || null,
      data.year || null, data.medium || null, data.dim || null, data.desc || null,
      data.slotId || null, imageId,
      data.hue ?? Math.floor(Math.random() * 360), data.sat ?? 22, data.seed ?? Math.floor(Math.random() * 100),
      pos, now, now);
  });
  txn();
  return id;
}

export function updateArtwork(id, data, imageBlob, imageMeta) {
  const cur = db.prepare('SELECT * FROM artworks WHERE id = ?').get(id);
  if (!cur) return false;
  const now = Date.now();
  const txn = db.transaction(() => {
    let imageId = cur.image_id;
    if (imageBlob) {
      if (cur.image_id) db.prepare('DELETE FROM images WHERE id = ?').run(cur.image_id);
      imageId = uid();
      db.prepare(`INSERT INTO images (id, blob, mime, width, height, created_at)
                  VALUES (?, ?, ?, ?, ?, ?)`).run(
        imageId, imageBlob, imageMeta?.mime || 'image/jpeg',
        imageMeta?.width || null, imageMeta?.height || null, now);
    }
    const fields = [];
    const values = [];
    const map = {
      no: 'no', title: 'title', artist: 'artist', year: 'year',
      medium: 'medium', dim: 'dim', desc: 'description', slotId: 'slot_id'
    };
    for (const [k, col] of Object.entries(map)) {
      if (data[k] !== undefined) { fields.push(`${col} = ?`); values.push(data[k]); }
    }
    if (imageId !== cur.image_id) { fields.push('image_id = ?'); values.push(imageId); }
    fields.push('updated_at = ?'); values.push(now);
    values.push(id);
    db.prepare(`UPDATE artworks SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  });
  txn();
  return true;
}

export function deleteArtwork(id) {
  const cur = db.prepare('SELECT image_id FROM artworks WHERE id = ?').get(id);
  if (!cur) return false;
  const txn = db.transaction(() => {
    db.prepare('DELETE FROM artworks WHERE id = ?').run(id);
    if (cur.image_id) db.prepare('DELETE FROM images WHERE id = ?').run(cur.image_id);
  });
  txn();
  return true;
}

export function getImageRow(id) {
  return db.prepare('SELECT blob, mime FROM images WHERE id = ?').get(id);
}

export function exportSnapshot() {
  const state = listGalleries();
  const rows = db.prepare('SELECT id, blob, mime FROM images').all();
  const images = {};
  for (const r of rows) {
    images[r.id] = { mime: r.mime, data: Buffer.from(r.blob).toString('base64') };
  }
  return { version: 1, state, images };
}

export function importSnapshot(payload) {
  if (!payload || !payload.state) throw new Error('Invalid payload');
  const txn = db.transaction(() => {
    db.prepare('DELETE FROM galleries').run();
    db.prepare('DELETE FROM images').run();
    const insertGal = db.prepare(`INSERT INTO galleries
      (id, name, room_id, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`);
    const insertArt = db.prepare(`INSERT INTO artworks
      (id, gallery_id, no, title, artist, year, medium, dim, description, slot_id, image_id,
       hue, sat, seed, position, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    const insertImg = db.prepare(`INSERT INTO images (id, blob, mime, width, height, created_at)
      VALUES (?, ?, ?, ?, ?, ?)`);
    const now = Date.now();
    if (payload.images) {
      for (const [id, v] of Object.entries(payload.images)) {
        const buf = Buffer.from(v.data, 'base64');
        insertImg.run(id, buf, v.mime || 'image/jpeg', null, null, now);
      }
    }
    const galleries = payload.state.galleries || [];
    galleries.forEach((g) => {
      insertGal.run(g.id, g.name, g.roomId, g.isActive ? 1 : 0,
        g.createdAt || now, g.updatedAt || now);
      (g.artworks || []).forEach((a, i) => {
        insertArt.run(a.id, g.id, a.no, a.title, a.artist, a.year, a.medium, a.dim,
          a.desc, a.slotId, a.imageId, a.hue, a.sat, a.seed, i, now, now);
      });
    });
    if (payload.state.activeGalleryId) {
      db.prepare('UPDATE galleries SET is_active = 0').run();
      db.prepare('UPDATE galleries SET is_active = 1 WHERE id = ?').run(payload.state.activeGalleryId);
    }
  });
  txn();
}

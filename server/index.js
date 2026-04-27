import express from 'express';
import multer from 'multer';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  listGalleries, createGallery, updateGallery, deleteGallery,
  createArtwork, updateArtwork, deleteArtwork,
  getImageRow, exportSnapshot, importSnapshot
} from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '50mb' }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024 } // 12MB per image
});

const api = express.Router();

api.get('/health', (req, res) => res.json({ ok: true }));

api.get('/galleries', (req, res) => {
  res.json(listGalleries());
});

api.post('/galleries', (req, res) => {
  const { name, roomId } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name required' });
  const id = createGallery({ name, roomId });
  res.json({ id });
});

api.patch('/galleries/:id', (req, res) => {
  const ok = updateGallery(req.params.id, req.body || {});
  if (!ok) return res.status(404).json({ error: 'not found' });
  res.json({ ok: true });
});

api.delete('/galleries/:id', (req, res) => {
  deleteGallery(req.params.id);
  res.json({ ok: true });
});

function parseArtworkBody(body) {
  const data = {};
  for (const k of ['no', 'title', 'artist', 'medium', 'dim', 'desc', 'slotId']) {
    if (body[k] !== undefined) data[k] = body[k] === '' ? null : body[k];
  }
  if (body.year !== undefined) data.year = body.year ? parseInt(body.year, 10) : null;
  if (body.hue !== undefined) data.hue = parseInt(body.hue, 10);
  if (body.sat !== undefined) data.sat = parseInt(body.sat, 10);
  if (body.seed !== undefined) data.seed = parseInt(body.seed, 10);
  return data;
}

api.post('/galleries/:id/artworks', upload.single('image'), (req, res) => {
  const { id: galleryId } = req.params;
  const data = parseArtworkBody(req.body);
  const blob = req.file?.buffer || null;
  const meta = req.file ? {
    mime: req.file.mimetype,
    width: req.body.imageWidth ? parseInt(req.body.imageWidth, 10) : null,
    height: req.body.imageHeight ? parseInt(req.body.imageHeight, 10) : null
  } : null;
  try {
    const id = createArtwork(galleryId, data, blob, meta);
    res.json({ id });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'failed' });
  }
});

api.patch('/artworks/:id', upload.single('image'), (req, res) => {
  const data = parseArtworkBody(req.body);
  const blob = req.file?.buffer || null;
  const meta = req.file ? {
    mime: req.file.mimetype,
    width: req.body.imageWidth ? parseInt(req.body.imageWidth, 10) : null,
    height: req.body.imageHeight ? parseInt(req.body.imageHeight, 10) : null
  } : null;
  const ok = updateArtwork(req.params.id, data, blob, meta);
  if (!ok) return res.status(404).json({ error: 'not found' });
  res.json({ ok: true });
});

api.delete('/artworks/:id', (req, res) => {
  const ok = deleteArtwork(req.params.id);
  if (!ok) return res.status(404).json({ error: 'not found' });
  res.json({ ok: true });
});

api.get('/images/:id', (req, res) => {
  const row = getImageRow(req.params.id);
  if (!row) return res.status(404).end();
  res.set('Content-Type', row.mime || 'image/jpeg');
  res.set('Cache-Control', 'public, max-age=31536000, immutable');
  res.send(row.blob);
});

api.get('/export', (req, res) => {
  res.json(exportSnapshot());
});

api.post('/import', (req, res) => {
  try {
    importSnapshot(req.body);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: e.message });
  }
});

app.use('/api', api);

app.use(express.static(PUBLIC_DIR, {
  maxAge: '1h',
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) res.set('Cache-Control', 'no-cache');
  }
}));

app.use((req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'not found' });
  res.status(404).send('Not Found');
});

const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || '0.0.0.0';
app.listen(PORT, HOST, () => {
  console.log(`whitecube-gallery listening on http://${HOST}:${PORT}`);
});

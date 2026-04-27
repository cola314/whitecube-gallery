# Whitecube Gallery

3D online art exhibition. Walk through a gallery in 1st-person (WASD + mouse), click paintings to read details. Admin panel manages galleries, rooms, and uploaded images.

## Stack

- **Frontend**: Three.js (vanilla ES modules)
- **Backend**: Express + better-sqlite3
- **Container**: ghcr.io/cola314/whitecube-gallery (multi-arch amd64/arm64)
- **Deploy**: GitHub Actions → GHCR → ArgoCD → OCI K3s

## Local dev

```bash
npm install
npm run dev
# open http://localhost:3000
```

SQLite DB lives at `./data/whitecube.db`. Delete the file to reset to seed.

## Layout

```
public/        Static frontend (HTML / Three.js / admin)
server/        Express + SQLite (REST API)
k8s/           Deployment, Service, Ingress, PVC
.github/       Multi-arch Docker build workflow
argocd/        ArgoCD Application manifest (copy into ColaServerInfra)
```

## Deploy

1. Push to `main` → GHA builds linux/amd64 + linux/arm64 and pushes to `ghcr.io/cola314/whitecube-gallery:latest`.
2. ArgoCD (in OCI K3s, watching this repo's `k8s/`) syncs the manifest.
3. Add `argocd/application.yaml` to ColaServerInfra under `oci/argocd/whitecube-gallery/` once.

## API

- `GET    /api/galleries` — full state (galleries + artworks + active id)
- `POST   /api/galleries` — create
- `PATCH  /api/galleries/:id` — rename / change room / set active
- `DELETE /api/galleries/:id`
- `POST   /api/galleries/:id/artworks` — multipart with `image` field
- `PATCH  /api/artworks/:id` — multipart
- `DELETE /api/artworks/:id`
- `GET    /api/images/:id` — binary
- `GET    /api/export` / `POST /api/import`
- `GET    /api/health`

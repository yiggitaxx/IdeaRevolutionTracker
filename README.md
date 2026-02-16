# Idea Evolution Tracker

Modern full-stack product MVP: fikir oluştur, revizyonları dallandır, görsel akışta yönet, kullanıcı hesabınla takip et, premium özelliklerle gelişimi hızlandır.

## ✨ Neler Var?
- Kullanıcı kaydı / giriş / çıkış
- Free & Premium plan modeli
- Fikir oluşturma ve listeleme (kullanıcıya özel)
- Revizyon ekleme (branching için parentRevision destekli)
- React Flow ile interaktif evrim ağacı
- Node tıklayınca detay paneli
- Demo seed: 8 revizyon + çoklu branch
- Premium features:
  - Innovation insights (branch/momentum/impact özetleri)
  - JSON export
  - Deney notu + etki skoru ile akıllı değerlendirme

## Tech Stack
- Frontend: React + Vite
- Visualization: React Flow
- Backend: Node.js + Express
- DB: SQLite (`server/data.sqlite`)

## Proje Yapısı
```text
.
├── client
│   ├── src
│   │   ├── components
│   │   ├── api.js
│   │   └── ...
│   └── package.json
├── server
│   ├── db.js
│   ├── index.js
│   └── package.json
└── README.md
```

## Kurulum
```bash
cd server
npm install
cd ../client
npm install
```

## Çalıştırma
Backend:
```bash
cd server
npm run start
```

Frontend:
```bash
cd client
npm run dev
```

- API: `http://localhost:4000`
- UI: `http://localhost:5173`

## API (özet)
### Auth
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `POST /api/auth/upgrade`

### Ideas / Revisions
- `POST /api/ideas`
- `GET /api/ideas`
- `GET /api/ideas/:id`
- `POST /api/ideas/:id/revisions`
- `GET /api/ideas/:id/revisions`
- `POST /api/demo-seed`

### Premium
- `GET /api/ideas/:id/insights`
- `GET /api/ideas/:id/export`

### Health
- `GET /api/health`

## Screenshots
- `docs/screenshots/dashboard-modern.png` *(placeholder)*
- `docs/screenshots/idea-workspace-premium.png` *(placeholder)*

## Roadmap
- Gerçek ödeme entegrasyonu (Stripe)
- Takım/organizasyon workspace
- Gerçek AI öneri motoru
- Gelişmiş layout engine (ELK/Dagre)
- Collaboration + canlı çoklu kullanıcı düzenleme

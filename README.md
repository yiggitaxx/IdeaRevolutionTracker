# Idea Evolution Tracker

A full-stack MVP web app to create ideas, add revisions (including branches), and visualize the full revision tree.

## Tech Stack
- **Frontend:** React + Vite
- **Visualization:** React Flow
- **Backend:** Node.js + Express
- **Database:** SQLite (file-based)

## Project Structure

```text
.
├── client
│   ├── src
│   ├── package.json
│   └── ...
├── server
│   ├── index.js
│   ├── db.js
│   ├── data.sqlite (auto-created)
│   └── package.json
└── README.md
```

## Install

### 1) Install server dependencies
```bash
cd server
npm install
```

### 2) Install client dependencies
```bash
cd ../client
npm install
```

## Run

### Start backend server
```bash
cd server
npm run start
```
Server runs on `http://localhost:4000`.

### Start frontend client
```bash
cd client
npm run dev
```
Client runs on `http://localhost:5173`.

## API Endpoints
- `GET /api/health`
- `POST /api/ideas`
- `GET /api/ideas`
- `GET /api/ideas/:id`
- `POST /api/ideas/:id/revisions`
- `GET /api/ideas/:id/revisions`
- `POST /api/demo-seed` (bonus demo utility)

## Usage Flow
1. Open the app.
2. Create a new idea (title + short description).
3. Open idea details.
4. Add revisions, optionally selecting a parent revision to branch.
5. Click nodes in the React Flow graph to view revision details.
6. Use **Seed Demo Idea** to generate a sample idea with 8 revisions and multiple branches.

## Screenshots
- `docs/screenshots/ideas-list.png` *(placeholder)*
- `docs/screenshots/idea-detail-tree.png` *(placeholder)*

## Roadmap
- Revision editing/deleting
- Authentication + multi-user support
- Diff view between revisions
- Search/filter in large trees
- Export tree as image/JSON
- Auto-layout improvements (Dagre/ELK)

## Notes for production rollout
- SQLite DB file is `server/data.sqlite`; back it up before deployments.
- CORS is enabled for cross-origin local development.
- API returns JSON errors with clear messages and validates path/body inputs.

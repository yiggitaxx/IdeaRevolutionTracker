const express = require('express');
const cors = require('cors');
const { initDb, run, get, all, closeDb } = require('./db');

const app = express();
const PORT = Number(process.env.PORT) || 4000;

app.use(cors());
app.use(express.json({ limit: '200kb' }));

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0;
}

function isValidPositiveIntString(value) {
  return /^\d+$/.test(value) && Number(value) > 0;
}

function parseIdeaId(req, res, next) {
  const { id } = req.params;
  if (!isValidPositiveIntString(id)) {
    return res.status(400).json({ error: 'Idea id must be a positive integer.' });
  }

  req.ideaId = Number(id);
  return next();
}

function validateIdeaInput(req, res, next) {
  const { title, description } = req.body;

  if (!isNonEmptyString(title)) {
    return res.status(400).json({ error: 'Title is required and must be a non-empty string.' });
  }

  if (!isNonEmptyString(description)) {
    return res.status(400).json({ error: 'Description is required and must be a non-empty string.' });
  }

  req.body.title = title.trim();
  req.body.description = description.trim();
  return next();
}

async function validateRevisionInput(req, res, next) {
  try {
    const { change_text: changeText, reason_text: reasonText, parent_revision_id: parentRevisionId } = req.body;

    if (!isNonEmptyString(changeText)) {
      return res.status(400).json({ error: 'change_text is required and must be a non-empty string.' });
    }

    if (reasonText !== undefined && reasonText !== null && typeof reasonText !== 'string') {
      return res.status(400).json({ error: 'reason_text must be a string when provided.' });
    }

    if (parentRevisionId !== undefined && parentRevisionId !== null) {
      if (!Number.isInteger(parentRevisionId) || parentRevisionId <= 0) {
        return res.status(400).json({ error: 'parent_revision_id must be a positive integer or null.' });
      }

      const parentRow = await get(
        'SELECT id FROM revisions WHERE id = ? AND idea_id = ?',
        [parentRevisionId, req.ideaId]
      );

      if (!parentRow) {
        return res.status(400).json({ error: 'parent_revision_id does not exist for this idea.' });
      }
    }

    req.body.change_text = changeText.trim();
    req.body.reason_text = typeof reasonText === 'string' ? (reasonText.trim() || null) : null;

    return next();
  } catch (error) {
    return next(error);
  }
}

function asyncHandler(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.post('/api/ideas', validateIdeaInput, asyncHandler(async (req, res) => {
  const { title, description } = req.body;
  const result = await run(
    'INSERT INTO ideas (title, description) VALUES (?, ?)',
    [title, description]
  );

  const idea = await get('SELECT * FROM ideas WHERE id = ?', [result.lastID]);
  return res.status(201).json(idea);
}));

app.get('/api/ideas', asyncHandler(async (_req, res) => {
  const ideas = await all('SELECT * FROM ideas ORDER BY created_at DESC, id DESC');
  return res.json(ideas);
}));

app.get('/api/ideas/:id', parseIdeaId, asyncHandler(async (req, res) => {
  const idea = await get('SELECT * FROM ideas WHERE id = ?', [req.ideaId]);

  if (!idea) {
    return res.status(404).json({ error: 'Idea not found.' });
  }

  return res.json(idea);
}));

app.post('/api/ideas/:id/revisions', parseIdeaId, asyncHandler(async (req, res, next) => {
  const idea = await get('SELECT id FROM ideas WHERE id = ?', [req.ideaId]);

  if (!idea) {
    return res.status(404).json({ error: 'Idea not found.' });
  }

  return next();
}), validateRevisionInput, asyncHandler(async (req, res) => {
  const {
    parent_revision_id: parentRevisionId = null,
    change_text: changeText,
    reason_text: reasonText = null,
  } = req.body;

  const result = await run(
    `INSERT INTO revisions (idea_id, parent_revision_id, change_text, reason_text)
     VALUES (?, ?, ?, ?)`,
    [req.ideaId, parentRevisionId, changeText, reasonText]
  );

  const revision = await get('SELECT * FROM revisions WHERE id = ?', [result.lastID]);
  return res.status(201).json(revision);
}));

app.get('/api/ideas/:id/revisions', parseIdeaId, asyncHandler(async (req, res) => {
  const idea = await get('SELECT id FROM ideas WHERE id = ?', [req.ideaId]);

  if (!idea) {
    return res.status(404).json({ error: 'Idea not found.' });
  }

  const revisions = await all(
    'SELECT * FROM revisions WHERE idea_id = ? ORDER BY created_at ASC, id ASC',
    [req.ideaId]
  );

  return res.json(revisions);
}));

app.post('/api/demo-seed', asyncHandler(async (_req, res) => {
  const existing = await get('SELECT id FROM ideas WHERE title = ?', ['Demo: Smart Note App']);
  if (existing) {
    return res.json({ message: 'Demo idea already exists.', ideaId: existing.id });
  }

  const ideaResult = await run(
    'INSERT INTO ideas (title, description) VALUES (?, ?)',
    ['Demo: Smart Note App', 'A note-taking app that evolves from simple notes to AI-assisted workflows.']
  );

  const ideaId = ideaResult.lastID;

  const r1 = await run(
    'INSERT INTO revisions (idea_id, parent_revision_id, change_text, reason_text) VALUES (?, ?, ?, ?)',
    [ideaId, null, 'Initial concept: basic text notes and folders.', 'Keep MVP focused.']
  );

  const r2 = await run(
    'INSERT INTO revisions (idea_id, parent_revision_id, change_text, reason_text) VALUES (?, ?, ?, ?)',
    [ideaId, r1.lastID, 'Added markdown support in editor.', 'Users requested richer formatting.']
  );

  const r3 = await run(
    'INSERT INTO revisions (idea_id, parent_revision_id, change_text, reason_text) VALUES (?, ?, ?, ?)',
    [ideaId, r2.lastID, 'Added full-text search.', 'Growing note volume needs quick retrieval.']
  );

  const r4 = await run(
    'INSERT INTO revisions (idea_id, parent_revision_id, change_text, reason_text) VALUES (?, ?, ?, ?)',
    [ideaId, r2.lastID, 'Explored lightweight tag system.', 'Alternative organization path.']
  );

  const r5 = await run(
    'INSERT INTO revisions (idea_id, parent_revision_id, change_text, reason_text) VALUES (?, ?, ?, ?)',
    [ideaId, r3.lastID, 'Synced notes to cloud backend.', 'Enable multi-device usage.']
  );

  const r6 = await run(
    'INSERT INTO revisions (idea_id, parent_revision_id, change_text, reason_text) VALUES (?, ?, ?, ?)',
    [ideaId, r4.lastID, 'Added tag auto-suggestions.', 'Improve tagging consistency.']
  );

  await run(
    'INSERT INTO revisions (idea_id, parent_revision_id, change_text, reason_text) VALUES (?, ?, ?, ?)',
    [ideaId, r5.lastID, 'Introduced AI summarization for long notes.', 'Reduce reading time.']
  );

  await run(
    'INSERT INTO revisions (idea_id, parent_revision_id, change_text, reason_text) VALUES (?, ?, ?, ?)',
    [ideaId, r6.lastID, 'Built tag-based recommendation feed.', 'Surface related ideas proactively.']
  );

  return res.status(201).json({ message: 'Demo seed created.', ideaId });
}));

app.use((req, res) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` });
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error.' });
});

let server;

initDb()
  .then(() => {
    server = app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to initialize DB:', err);
    process.exit(1);
  });

async function shutdown(signal) {
  console.log(`Received ${signal}. Shutting down...`);
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  await closeDb().catch((err) => console.error('Error closing DB:', err));
  process.exit(0);
}

process.on('SIGINT', () => {
  shutdown('SIGINT');
});
process.on('SIGTERM', () => {
  shutdown('SIGTERM');
});

const crypto = require('crypto');
const express = require('express');
const cors = require('cors');
const { initDb, run, get, all, closeDb } = require('./db');

const app = express();
const PORT = Number(process.env.PORT) || 4000;
const SESSION_DAYS = 14;

app.use(cors());
app.use(express.json({ limit: '300kb' }));

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0;
}

function isValidPositiveIntString(value) {
  return /^\d+$/.test(value) && Number(value) > 0;
}

function asyncHandler(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return `${salt}:${derived}`;
}

function verifyPassword(password, storedHash) {
  const [salt, expected] = String(storedHash).split(':');
  if (!salt || !expected) return false;
  const derived = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return crypto.timingSafeEqual(Buffer.from(derived, 'hex'), Buffer.from(expected, 'hex'));
}

function createSessionToken() {
  return crypto.randomBytes(48).toString('hex');
}

function buildFutureDate(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

function parseIdeaId(req, res, next) {
  const { id } = req.params;
  if (!isValidPositiveIntString(id)) {
    return res.status(400).json({ error: 'Idea id must be a positive integer.' });
  }
  req.ideaId = Number(id);
  return next();
}

async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    const session = await get(
      `SELECT s.token, s.user_id, s.expires_at, u.name, u.email, u.plan
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token = ?`,
      [token]
    );

    if (!session) {
      return res.status(401).json({ error: 'Invalid session.' });
    }

    if (new Date(session.expires_at).getTime() < Date.now()) {
      await run('DELETE FROM sessions WHERE token = ?', [token]);
      return res.status(401).json({ error: 'Session expired. Please login again.' });
    }

    req.user = {
      id: session.user_id,
      name: session.name,
      email: session.email,
      plan: session.plan,
      token,
    };

    return next();
  } catch (error) {
    return next(error);
  }
}

function requirePremium(req, res, next) {
  if (req.user.plan !== 'premium') {
    return res.status(403).json({ error: 'Premium membership required for this feature.' });
  }
  return next();
}

function validateAuthPayload(req, res, next) {
  const { name, email, password } = req.body;

  if (name !== undefined && !isNonEmptyString(name)) {
    return res.status(400).json({ error: 'name must be a non-empty string.' });
  }

  if (!isNonEmptyString(email) || !email.includes('@')) {
    return res.status(400).json({ error: 'Valid email is required.' });
  }

  if (!isNonEmptyString(password) || password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }

  req.body.email = email.trim().toLowerCase();
  if (name !== undefined) req.body.name = name.trim();
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
    const {
      change_text: changeText,
      reason_text: reasonText,
      parent_revision_id: parentRevisionId,
      experiment_note: experimentNote,
      impact_score: impactScore,
    } = req.body;

    if (!isNonEmptyString(changeText)) {
      return res.status(400).json({ error: 'change_text is required and must be a non-empty string.' });
    }

    if (reasonText !== undefined && reasonText !== null && typeof reasonText !== 'string') {
      return res.status(400).json({ error: 'reason_text must be a string when provided.' });
    }

    if (experimentNote !== undefined && experimentNote !== null && typeof experimentNote !== 'string') {
      return res.status(400).json({ error: 'experiment_note must be a string when provided.' });
    }

    if (impactScore !== undefined && impactScore !== null) {
      if (!Number.isInteger(impactScore) || impactScore < 1 || impactScore > 10) {
        return res.status(400).json({ error: 'impact_score must be an integer between 1 and 10.' });
      }
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
    req.body.experiment_note = typeof experimentNote === 'string' ? (experimentNote.trim() || null) : null;
    req.body.impact_score = impactScore ?? null;

    return next();
  } catch (error) {
    return next(error);
  }
}

async function loadOwnedIdea(req, res, next) {
  const idea = await get('SELECT * FROM ideas WHERE id = ? AND user_id = ?', [req.ideaId, req.user.id]);
  if (!idea) return res.status(404).json({ error: 'Idea not found.' });
  req.idea = idea;
  return next();
}

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.post('/api/auth/register', validateAuthPayload, asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;
  const existing = await get('SELECT id FROM users WHERE email = ?', [email]);
  if (existing) return res.status(409).json({ error: 'An account with this email already exists.' });

  const result = await run(
    'INSERT INTO users (name, email, password_hash, plan) VALUES (?, ?, ?, ?)',
    [name, email, hashPassword(password), 'free']
  );

  const token = createSessionToken();
  await run('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)', [token, result.lastID, buildFutureDate(SESSION_DAYS)]);

  const user = await get('SELECT id, name, email, plan, created_at FROM users WHERE id = ?', [result.lastID]);
  return res.status(201).json({ user, token });
}));

app.post('/api/auth/login', validateAuthPayload, asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await get('SELECT * FROM users WHERE email = ?', [email]);

  if (!user || !verifyPassword(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  const token = createSessionToken();
  await run('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)', [token, user.id, buildFutureDate(SESSION_DAYS)]);

  return res.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      plan: user.plan,
      created_at: user.created_at,
    },
  });
}));

app.post('/api/auth/logout', requireAuth, asyncHandler(async (req, res) => {
  await run('DELETE FROM sessions WHERE token = ?', [req.user.token]);
  res.json({ message: 'Logged out successfully.' });
}));

app.get('/api/auth/me', requireAuth, asyncHandler(async (req, res) => {
  const user = await get('SELECT id, name, email, plan, created_at FROM users WHERE id = ?', [req.user.id]);
  res.json(user);
}));

app.post('/api/auth/upgrade', requireAuth, asyncHandler(async (req, res) => {
  await run('UPDATE users SET plan = ? WHERE id = ?', ['premium', req.user.id]);
  const user = await get('SELECT id, name, email, plan, created_at FROM users WHERE id = ?', [req.user.id]);
  res.json({ message: 'Welcome to premium 🎉', user });
}));

app.post('/api/ideas', requireAuth, validateIdeaInput, asyncHandler(async (req, res) => {
  const { title, description } = req.body;
  const result = await run(
    'INSERT INTO ideas (user_id, title, description) VALUES (?, ?, ?)',
    [req.user.id, title, description]
  );

  const idea = await get('SELECT * FROM ideas WHERE id = ?', [result.lastID]);
  return res.status(201).json(idea);
}));

app.get('/api/ideas', requireAuth, asyncHandler(async (req, res) => {
  const ideas = await all(
    `SELECT i.*, COUNT(r.id) AS revision_count
     FROM ideas i
     LEFT JOIN revisions r ON r.idea_id = i.id
     WHERE i.user_id = ?
     GROUP BY i.id
     ORDER BY i.created_at DESC, i.id DESC`,
    [req.user.id]
  );
  return res.json(ideas);
}));

app.get('/api/ideas/:id', requireAuth, parseIdeaId, asyncHandler(async (req, res, next) => loadOwnedIdea(req, res, next)), asyncHandler(async (req, res) => {
  res.json(req.idea);
}));

app.post('/api/ideas/:id/revisions', requireAuth, parseIdeaId, asyncHandler(async (req, res, next) => loadOwnedIdea(req, res, next)), validateRevisionInput, asyncHandler(async (req, res) => {
  const {
    parent_revision_id: parentRevisionId = null,
    change_text: changeText,
    reason_text: reasonText = null,
    experiment_note: experimentNote = null,
    impact_score: impactScore = null,
  } = req.body;

  const result = await run(
    `INSERT INTO revisions (idea_id, parent_revision_id, change_text, reason_text, experiment_note, impact_score)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [req.ideaId, parentRevisionId, changeText, reasonText, experimentNote, impactScore]
  );

  const revision = await get('SELECT * FROM revisions WHERE id = ?', [result.lastID]);
  return res.status(201).json(revision);
}));

app.get('/api/ideas/:id/revisions', requireAuth, parseIdeaId, asyncHandler(async (req, res, next) => loadOwnedIdea(req, res, next)), asyncHandler(async (req, res) => {
  const revisions = await all(
    'SELECT * FROM revisions WHERE idea_id = ? ORDER BY created_at ASC, id ASC',
    [req.ideaId]
  );
  return res.json(revisions);
}));

app.get('/api/ideas/:id/insights', requireAuth, requirePremium, parseIdeaId, asyncHandler(async (req, res, next) => loadOwnedIdea(req, res, next)), asyncHandler(async (req, res) => {
  const revisions = await all('SELECT * FROM revisions WHERE idea_id = ?', [req.ideaId]);
  const revisionMap = new Map(revisions.map((r) => [r.id, r]));

  let branchCount = 0;
  const children = {};
  revisions.forEach((r) => {
    if (r.parent_revision_id != null) {
      children[r.parent_revision_id] = children[r.parent_revision_id] || [];
      children[r.parent_revision_id].push(r.id);
    }
  });

  Object.values(children).forEach((arr) => {
    if (arr.length > 1) branchCount += arr.length - 1;
  });

  const avgImpact = revisions.length
    ? Number((revisions.reduce((sum, r) => sum + (r.impact_score || 0), 0) / revisions.length).toFixed(2))
    : 0;

  const momentum = revisions.length >= 2
    ? 'High momentum: your idea is evolving rapidly.'
    : revisions.length === 1
      ? 'Early stage: add more revisions to detect trends.'
      : 'No revisions yet.';

  const experimentRich = revisions.filter((r) => r.experiment_note && r.experiment_note.trim().length > 0).length;

  res.json({
    ideaId: req.ideaId,
    totalRevisions: revisions.length,
    branches: branchCount,
    avgImpact,
    experimentsLogged: experimentRich,
    premiumSignals: [
      momentum,
      branchCount > 1 ? 'You are exploring multiple product directions.' : 'Single-stream evolution so far.',
      avgImpact >= 7 ? 'High-impact change pattern detected.' : 'Consider higher-impact experiments.',
    ],
    latestRevision: revisions.length ? revisionMap.get(revisions[revisions.length - 1].id) : null,
  });
}));

app.get('/api/ideas/:id/export', requireAuth, requirePremium, parseIdeaId, asyncHandler(async (req, res, next) => loadOwnedIdea(req, res, next)), asyncHandler(async (req, res) => {
  const revisions = await all('SELECT * FROM revisions WHERE idea_id = ? ORDER BY id ASC', [req.ideaId]);
  res.json({ idea: req.idea, revisions, exportedAt: new Date().toISOString() });
}));

app.post('/api/demo-seed', requireAuth, asyncHandler(async (req, res) => {
  const existing = await get('SELECT id FROM ideas WHERE title = ? AND user_id = ?', ['Demo: Smart Note App', req.user.id]);
  if (existing) {
    return res.json({ message: 'Demo idea already exists.', ideaId: existing.id });
  }

  const ideaResult = await run(
    'INSERT INTO ideas (user_id, title, description) VALUES (?, ?, ?)',
    [req.user.id, 'Demo: Smart Note App', 'A note-taking app that evolves from simple notes to AI-assisted workflows.']
  );

  const ideaId = ideaResult.lastID;

  const r1 = await run('INSERT INTO revisions (idea_id, parent_revision_id, change_text, reason_text, experiment_note, impact_score) VALUES (?, ?, ?, ?, ?, ?)', [ideaId, null, 'Initial concept: basic text notes and folders.', 'Keep MVP focused.', 'Landing page smoke test', 5]);
  const r2 = await run('INSERT INTO revisions (idea_id, parent_revision_id, change_text, reason_text, experiment_note, impact_score) VALUES (?, ?, ?, ?, ?, ?)', [ideaId, r1.lastID, 'Added markdown support in editor.', 'Users requested richer formatting.', 'Beta cohort release', 7]);
  const r3 = await run('INSERT INTO revisions (idea_id, parent_revision_id, change_text, reason_text, experiment_note, impact_score) VALUES (?, ?, ?, ?, ?, ?)', [ideaId, r2.lastID, 'Added full-text search.', 'Growing note volume needs quick retrieval.', 'Search relevance benchmark', 8]);
  const r4 = await run('INSERT INTO revisions (idea_id, parent_revision_id, change_text, reason_text, experiment_note, impact_score) VALUES (?, ?, ?, ?, ?, ?)', [ideaId, r2.lastID, 'Explored lightweight tag system.', 'Alternative organization path.', 'Tagging usability test', 6]);
  const r5 = await run('INSERT INTO revisions (idea_id, parent_revision_id, change_text, reason_text, experiment_note, impact_score) VALUES (?, ?, ?, ?, ?, ?)', [ideaId, r3.lastID, 'Synced notes to cloud backend.', 'Enable multi-device usage.', 'Retention cohort test', 9]);
  const r6 = await run('INSERT INTO revisions (idea_id, parent_revision_id, change_text, reason_text, experiment_note, impact_score) VALUES (?, ?, ?, ?, ?, ?)', [ideaId, r4.lastID, 'Added tag auto-suggestions.', 'Improve tagging consistency.', 'NLP keyword trial', 7]);
  await run('INSERT INTO revisions (idea_id, parent_revision_id, change_text, reason_text, experiment_note, impact_score) VALUES (?, ?, ?, ?, ?, ?)', [ideaId, r5.lastID, 'Introduced AI summarization for long notes.', 'Reduce reading time.', 'Activation A/B test', 8]);
  await run('INSERT INTO revisions (idea_id, parent_revision_id, change_text, reason_text, experiment_note, impact_score) VALUES (?, ?, ?, ?, ?, ?)', [ideaId, r6.lastID, 'Built tag-based recommendation feed.', 'Surface related ideas proactively.', 'Discovery engagement test', 7]);

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
  if (server) await new Promise((resolve) => server.close(resolve));
  await closeDb().catch((err) => console.error('Error closing DB:', err));
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

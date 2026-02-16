import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import ReactFlow, { Background, Controls, MiniMap } from 'reactflow';
import 'reactflow/dist/style.css';
import { api } from '../api';

function buildTreeLayout(revisions) {
  if (!revisions.length) return { nodes: [], edges: [] };

  const childrenByParent = new Map();
  const roots = [];

  revisions.forEach((rev) => {
    if (rev.parent_revision_id == null) {
      roots.push(rev);
      return;
    }

    const list = childrenByParent.get(rev.parent_revision_id) || [];
    list.push(rev);
    childrenByParent.set(rev.parent_revision_id, list);
  });

  let xCursor = 0;
  const positions = new Map();
  const gapX = 250;
  const gapY = 140;

  function dfs(node, depth) {
    const children = childrenByParent.get(node.id) || [];

    if (children.length === 0) {
      const x = xCursor;
      xCursor += gapX;
      positions.set(node.id, { x, y: depth * gapY });
      return x;
    }

    const childXs = children.map((child) => dfs(child, depth + 1));
    const avgX = childXs.reduce((sum, x) => sum + x, 0) / childXs.length;
    positions.set(node.id, { x: avgX, y: depth * gapY });
    return avgX;
  }

  roots.forEach((root) => dfs(root, 0));

  const nodes = revisions.map((rev) => ({
    id: String(rev.id),
    data: {
      label: `R${rev.id}: ${rev.change_text.slice(0, 30)}${rev.change_text.length > 30 ? '...' : ''}`,
    },
    position: positions.get(rev.id) || { x: 0, y: 0 },
    style: {
      padding: 8,
      width: 180,
      border: '1px solid #ccc',
      borderRadius: 8,
      background: '#fff',
      fontSize: 12,
    },
  }));

  const edges = revisions
    .filter((rev) => rev.parent_revision_id != null)
    .map((rev) => ({
      id: `e-${rev.parent_revision_id}-${rev.id}`,
      source: String(rev.parent_revision_id),
      target: String(rev.id),
      type: 'smoothstep',
      animated: false,
    }));

  return { nodes, edges };
}

export default function IdeaDetailPage() {
  const { id } = useParams();
  const [idea, setIdea] = useState(null);
  const [revisions, setRevisions] = useState([]);
  const [selectedRevisionId, setSelectedRevisionId] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    change_text: '',
    reason_text: '',
    parent_revision_id: '',
  });

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const [ideaData, revisionData] = await Promise.all([
        api.getIdea(id),
        api.getRevisions(id),
      ]);
      setIdea(ideaData);
      setRevisions(revisionData);

      if (revisionData.length) {
        const hasCurrent = selectedRevisionId
          ? revisionData.some((rev) => rev.id === selectedRevisionId)
          : false;
        if (!hasCurrent) {
          setSelectedRevisionId(revisionData[revisionData.length - 1].id);
        }
      } else {
        setSelectedRevisionId(null);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [id]);

  const { nodes, edges } = useMemo(() => buildTreeLayout(revisions), [revisions]);
  const selectedRevision = useMemo(
    () => revisions.find((rev) => rev.id === selectedRevisionId) || null,
    [revisions, selectedRevisionId]
  );

  async function onSubmit(e) {
    e.preventDefault();
    setError('');

    if (!form.change_text.trim()) {
      setError('What changed is required.');
      return;
    }

    setSubmitting(true);

    try {
      const payload = {
        change_text: form.change_text,
        reason_text: form.reason_text || null,
        parent_revision_id: form.parent_revision_id ? Number(form.parent_revision_id) : null,
      };

      const created = await api.createRevision(id, payload);
      setForm({ change_text: '', reason_text: '', parent_revision_id: '' });
      await loadData();
      setSelectedRevisionId(created.id);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page">
      <p><Link to="/">← Back to ideas</Link></p>
      {idea ? (
        <header>
          <h1>{idea.title}</h1>
          <p>{idea.description}</p>
        </header>
      ) : (
        <p>{loading ? 'Loading idea...' : 'Idea not found.'}</p>
      )}

      <section className="card">
        <h2>Add Revision</h2>
        <form onSubmit={onSubmit} className="form-grid">
          <label>
            What changed
            <textarea
              rows={3}
              value={form.change_text}
              onChange={(e) => setForm((prev) => ({ ...prev, change_text: e.target.value }))}
              placeholder="Describe the revision"
            />
          </label>
          <label>
            Why it changed (optional)
            <textarea
              rows={2}
              value={form.reason_text}
              onChange={(e) => setForm((prev) => ({ ...prev, reason_text: e.target.value }))}
              placeholder="Reason behind this change"
            />
          </label>
          <label>
            Parent Revision
            <select
              value={form.parent_revision_id}
              onChange={(e) => setForm((prev) => ({ ...prev, parent_revision_id: e.target.value }))}
            >
              <option value="">No parent (root)</option>
              {revisions.map((rev) => (
                <option key={rev.id} value={rev.id}>
                  R{rev.id}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" disabled={submitting}>
            {submitting ? 'Adding...' : 'Add Revision'}
          </button>
        </form>
      </section>

      <section className="detail-grid">
        <div className="card flow-card">
          <h2>Evolution Tree</h2>
          <div className="flow-wrapper">
            {revisions.length === 0 ? (
              <p className="empty-flow">No revisions yet. Add the first revision to start the tree.</p>
            ) : (
              <ReactFlow
                nodes={nodes}
                edges={edges}
                fitView
                onNodeClick={(_, node) => {
                  setSelectedRevisionId(Number(node.id));
                }}
              >
                <MiniMap />
                <Controls />
                <Background />
              </ReactFlow>
            )}
          </div>
        </div>

        <aside className="card side-panel">
          <h2>Revision Details</h2>
          {selectedRevision ? (
            <div>
              <p><strong>ID:</strong> R{selectedRevision.id}</p>
              <p><strong>Parent:</strong> {selectedRevision.parent_revision_id ? `R${selectedRevision.parent_revision_id}` : 'None (root)'}</p>
              <p><strong>Changed:</strong> {selectedRevision.change_text}</p>
              <p><strong>Reason:</strong> {selectedRevision.reason_text || 'Not provided'}</p>
              <p><strong>Created:</strong> {selectedRevision.created_at}</p>
            </div>
          ) : (
            <p>Click a node to view revision details.</p>
          )}
        </aside>
      </section>

      {error ? <p className="error">{error}</p> : null}
    </div>
  );
}

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

  function dfs(node, depth) {
    const children = childrenByParent.get(node.id) || [];
    if (!children.length) {
      const x = xCursor;
      xCursor += 240;
      positions.set(node.id, { x, y: depth * 135 });
      return x;
    }

    const xs = children.map((child) => dfs(child, depth + 1));
    const avgX = xs.reduce((sum, x) => sum + x, 0) / xs.length;
    positions.set(node.id, { x: avgX, y: depth * 135 });
    return avgX;
  }

  roots.forEach((root) => dfs(root, 0));

  const nodes = revisions.map((rev) => ({
    id: String(rev.id),
    data: {
      label: `R${rev.id} • ${rev.change_text.slice(0, 28)}${rev.change_text.length > 28 ? '...' : ''}`,
    },
    position: positions.get(rev.id) || { x: 0, y: 0 },
    style: {
      padding: 10,
      width: 190,
      border: '1px solid #9ca3af',
      borderRadius: 12,
      background: '#ffffff',
      fontSize: 12,
      boxShadow: '0 10px 25px rgba(15, 23, 42, 0.08)',
    },
  }));

  const edges = revisions
    .filter((rev) => rev.parent_revision_id != null)
    .map((rev) => ({
      id: `e-${rev.parent_revision_id}-${rev.id}`,
      source: String(rev.parent_revision_id),
      target: String(rev.id),
      type: 'smoothstep',
      animated: rev.impact_score >= 8,
    }));

  return { nodes, edges };
}

export default function IdeaDetailPage({ user }) {
  const { id } = useParams();
  const [idea, setIdea] = useState(null);
  const [revisions, setRevisions] = useState([]);
  const [insights, setInsights] = useState(null);
  const [exportJson, setExportJson] = useState('');
  const [selectedRevisionId, setSelectedRevisionId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    change_text: '',
    reason_text: '',
    parent_revision_id: '',
    experiment_note: '',
    impact_score: 5,
  });

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const [ideaData, revisionData] = await Promise.all([api.getIdea(id), api.getRevisions(id)]);
      setIdea(ideaData);
      setRevisions(revisionData);
      if (revisionData.length && !revisionData.some((r) => r.id === selectedRevisionId)) {
        setSelectedRevisionId(revisionData[revisionData.length - 1].id);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadPremiumData() {
    if (user.plan !== 'premium') {
      setInsights(null);
      setExportJson('');
      return;
    }

    try {
      const [insightsData, exportData] = await Promise.all([api.getInsights(id), api.exportIdea(id)]);
      setInsights(insightsData);
      setExportJson(JSON.stringify(exportData, null, 2));
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    loadData();
  }, [id]);

  useEffect(() => {
    loadPremiumData();
  }, [id, user.plan]);

  const { nodes, edges } = useMemo(() => buildTreeLayout(revisions), [revisions]);
  const selectedRevision = useMemo(
    () => revisions.find((rev) => rev.id === selectedRevisionId) || null,
    [revisions, selectedRevisionId]
  );

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    if (!form.change_text.trim()) {
      setError('Değişiklik alanı zorunludur.');
      return;
    }

    setSubmitting(true);
    try {
      const created = await api.createRevision(id, {
        change_text: form.change_text,
        reason_text: form.reason_text || null,
        parent_revision_id: form.parent_revision_id ? Number(form.parent_revision_id) : null,
        experiment_note: form.experiment_note || null,
        impact_score: Number(form.impact_score) || null,
      });
      setForm({ change_text: '', reason_text: '', parent_revision_id: '', experiment_note: '', impact_score: 5 });
      setSelectedRevisionId(created.id);
      await loadData();
      await loadPremiumData();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page modern-bg">
      <p><Link to="/">← Dashboard</Link></p>
      {idea ? (
        <header className="glass-card">
          <h1>{idea.title}</h1>
          <p>{idea.description}</p>
        </header>
      ) : <p>{loading ? 'Yükleniyor...' : 'Fikir bulunamadı.'}</p>}

      <section className="card modern-card">
        <h2>Yeni Revizyon + Deney Notu</h2>
        <form onSubmit={onSubmit} className="form-grid">
          <label>Ne değişti?
            <textarea rows={3} value={form.change_text} onChange={(e) => setForm((p) => ({ ...p, change_text: e.target.value }))} />
          </label>
          <label>Neden değişti?
            <textarea rows={2} value={form.reason_text} onChange={(e) => setForm((p) => ({ ...p, reason_text: e.target.value }))} />
          </label>
          <label>Deney notu (yenilikçi)
            <input value={form.experiment_note} onChange={(e) => setForm((p) => ({ ...p, experiment_note: e.target.value }))} placeholder="A/B test, cohort, pilot vb." />
          </label>
          <label>Etki skoru (1-10)
            <input type="number" min="1" max="10" value={form.impact_score} onChange={(e) => setForm((p) => ({ ...p, impact_score: e.target.value }))} />
          </label>
          <label>Ana revizyon
            <select value={form.parent_revision_id} onChange={(e) => setForm((p) => ({ ...p, parent_revision_id: e.target.value }))}>
              <option value="">Yok (kök)</option>
              {revisions.map((rev) => <option key={rev.id} value={rev.id}>R{rev.id}</option>)}
            </select>
          </label>
          <button type="submit" disabled={submitting}>{submitting ? 'Ekleniyor...' : 'Revizyon Ekle'}</button>
        </form>
      </section>

      <section className="detail-grid">
        <div className="card flow-card modern-card">
          <h2>Evrim Ağacı</h2>
          <div className="flow-wrapper">
            {revisions.length === 0 ? <p className="empty-flow">İlk revizyonunu ekleyerek ağacı başlat.</p> : (
              <ReactFlow nodes={nodes} edges={edges} fitView onNodeClick={(_, node) => setSelectedRevisionId(Number(node.id))}>
                <MiniMap />
                <Controls />
                <Background />
              </ReactFlow>
            )}
          </div>
        </div>

        <aside className="card side-panel modern-card">
          <h2>Detay Paneli</h2>
          {selectedRevision ? (
            <>
              <p><strong>ID:</strong> R{selectedRevision.id}</p>
              <p><strong>Parent:</strong> {selectedRevision.parent_revision_id ? `R${selectedRevision.parent_revision_id}` : 'Kök'}</p>
              <p><strong>Değişiklik:</strong> {selectedRevision.change_text}</p>
              <p><strong>Neden:</strong> {selectedRevision.reason_text || 'Yok'}</p>
              <p><strong>Deney:</strong> {selectedRevision.experiment_note || 'Yok'}</p>
              <p><strong>Etki:</strong> {selectedRevision.impact_score || '-'}/10</p>
            </>
          ) : <p>Bir node seç.</p>}

          <hr />
          <h3>Premium Zone</h3>
          {user.plan !== 'premium' ? (
            <p>Premium üye olunca AI insight ve export açılır.</p>
          ) : (
            <>
              <p><strong>Toplam Revizyon:</strong> {insights?.totalRevisions ?? '-'}</p>
              <p><strong>Branch:</strong> {insights?.branches ?? '-'}</p>
              <p><strong>Ortalama Etki:</strong> {insights?.avgImpact ?? '-'}</p>
              <ul className="insight-list">
                {(insights?.premiumSignals || []).map((text) => <li key={text}>{text}</li>)}
              </ul>
              <details>
                <summary>JSON Export</summary>
                <pre className="export-block">{exportJson || 'Yükleniyor...'}</pre>
              </details>
            </>
          )}
        </aside>
      </section>

      {error ? <p className="error">{error}</p> : null}
    </div>
  );
}

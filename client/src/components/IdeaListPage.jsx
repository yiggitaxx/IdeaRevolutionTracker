import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';

const initialForm = { title: '', description: '' };

export default function IdeaListPage({ user, onUserChange }) {
  const [ideas, setIdeas] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [upgrading, setUpgrading] = useState(false);
  const [error, setError] = useState('');
  const [seedStatus, setSeedStatus] = useState('');
  const navigate = useNavigate();

  const stats = useMemo(() => {
    const total = ideas.length;
    const revisions = ideas.reduce((acc, idea) => acc + Number(idea.revision_count || 0), 0);
    return { total, revisions };
  }, [ideas]);

  async function loadIdeas() {
    setLoading(true);
    setError('');
    try {
      const data = await api.getIdeas();
      setIdeas(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadIdeas();
  }, []);

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    if (!form.title.trim() || !form.description.trim()) {
      setError('Başlık ve açıklama zorunludur.');
      return;
    }

    setSubmitting(true);
    try {
      const created = await api.createIdea(form);
      setForm(initialForm);
      await loadIdeas();
      navigate(`/ideas/${created.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function onSeedDemo() {
    setError('');
    setSeeding(true);
    setSeedStatus('Demo oluşturuluyor...');
    try {
      const result = await api.seedDemo();
      setSeedStatus(result.message);
      await loadIdeas();
    } catch (err) {
      setError(err.message);
      setSeedStatus('');
    } finally {
      setSeeding(false);
    }
  }

  async function onUpgrade() {
    setUpgrading(true);
    setError('');
    try {
      const result = await api.upgrade();
      onUserChange(result.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setUpgrading(false);
    }
  }

  async function onLogout() {
    try {
      await api.logout();
    } catch {
      // ignore server logout failure
    }
    api.setToken('');
    onUserChange(null);
  }

  return (
    <div className="page modern-bg">
      <header className="topbar glass-card">
        <div>
          <h1>✨ Idea Evolution Tracker</h1>
          <p>{user.name} olarak giriş yapıldı • Plan: <strong>{user.plan.toUpperCase()}</strong></p>
        </div>
        <div className="topbar-actions">
          {user.plan !== 'premium' ? (
            <button type="button" onClick={onUpgrade} disabled={upgrading} className="premium-btn">
              {upgrading ? 'Yükseltiliyor...' : 'Premiuma Geç'}
            </button>
          ) : <span className="premium-badge">PREMIUM</span>}
          <button type="button" onClick={onLogout} className="secondary-btn">Çıkış</button>
        </div>
      </header>

      <section className="kpi-grid">
        <article className="glass-card kpi"><h3>Toplam Fikir</h3><p>{stats.total}</p></article>
        <article className="glass-card kpi"><h3>Toplam Revizyon</h3><p>{stats.revisions}</p></article>
        <article className="glass-card kpi"><h3>Durum</h3><p>{user.plan === 'premium' ? 'Insights açık' : 'Premium kilitli'}</p></article>
      </section>

      <section className="card modern-card">
        <h2>Yeni Fikir Oluştur</h2>
        <form onSubmit={onSubmit} className="form-grid">
          <label>
            Başlık
            <input value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} placeholder="Örn: Yapay zekalı eğitim asistanı" />
          </label>
          <label>
            Kısa Açıklama
            <textarea rows={3} value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} placeholder="Problemi ve çözümü kısa anlat" />
          </label>
          <button type="submit" disabled={submitting}>{submitting ? 'Kaydediliyor...' : 'Fikri Başlat'}</button>
        </form>
      </section>

      <section className="card modern-card">
        <div className="row-between">
          <h2>Fikir Portföyü</h2>
          <button type="button" onClick={onSeedDemo} disabled={seeding} className="secondary-btn">
            {seeding ? 'Seeding...' : 'Demo Yükle'}
          </button>
        </div>
        {seedStatus ? <p className="info">{seedStatus}</p> : null}
        {loading ? <p>Yükleniyor...</p> : null}
        {ideas.length === 0 && !loading ? <p>Henüz fikir yok.</p> : null}
        <ul className="idea-list modern-list">
          {ideas.map((idea) => (
            <li key={idea.id}>
              <Link to={`/ideas/${idea.id}`}>{idea.title}</Link>
              <p>{idea.description}</p>
              <small>{idea.revision_count || 0} revizyon</small>
            </li>
          ))}
        </ul>
      </section>

      {error ? <p className="error">{error}</p> : null}
    </div>
  );
}

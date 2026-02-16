import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';

const initialForm = {
  title: '',
  description: '',
};

export default function IdeaListPage() {
  const [ideas, setIdeas] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [error, setError] = useState('');
  const [seedStatus, setSeedStatus] = useState('');
  const navigate = useNavigate();

  async function loadIdeas() {
    setLoading(true);
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
      setError('Both title and description are required.');
      return;
    }

    setSubmitting(true);
    try {
      const idea = await api.createIdea(form);
      setForm(initialForm);
      await loadIdeas();
      navigate(`/ideas/${idea.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function onSeedDemo() {
    setSeeding(true);
    setSeedStatus('Creating demo...');
    setError('');
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

  return (
    <div className="page">
      <header>
        <h1>Idea Evolution Tracker</h1>
        <p>Track how your ideas change over time with branching revisions.</p>
      </header>

      <section className="card">
        <h2>Create Idea</h2>
        <form onSubmit={onSubmit} className="form-grid">
          <label>
            Title
            <input
              value={form.title}
              onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
              placeholder="Ex: Collaborative travel planner"
            />
          </label>
          <label>
            Description
            <textarea
              value={form.description}
              onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
              rows={3}
              placeholder="Short description of the core idea"
            />
          </label>
          <button type="submit" disabled={submitting}>
            {submitting ? 'Creating...' : 'Create Idea'}
          </button>
        </form>
      </section>

      <section className="card">
        <div className="row-between">
          <h2>Ideas</h2>
          <button onClick={onSeedDemo} type="button" disabled={seeding}>
            {seeding ? 'Seeding...' : 'Seed Demo Idea'}
          </button>
        </div>
        {seedStatus ? <p className="info">{seedStatus}</p> : null}
        {loading ? <p>Loading ideas...</p> : null}
        {ideas.length === 0 && !loading ? <p>No ideas yet.</p> : null}
        <ul className="idea-list">
          {ideas.map((idea) => (
            <li key={idea.id}>
              <Link to={`/ideas/${idea.id}`}>{idea.title}</Link>
              <p>{idea.description}</p>
            </li>
          ))}
        </ul>
      </section>

      {error ? <p className="error">{error}</p> : null}
    </div>
  );
}

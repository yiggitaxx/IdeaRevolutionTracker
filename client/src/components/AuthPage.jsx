import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { api } from '../api';

export default function AuthPage({ onAuthSuccess }) {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (api.getToken()) {
    return <Navigate to="/" replace />;
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const payload = {
        email: form.email,
        password: form.password,
      };

      let result;
      if (mode === 'register') {
        result = await api.register({ ...payload, name: form.name });
      } else {
        result = await api.login(payload);
      }

      api.setToken(result.token);
      onAuthSuccess(result.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-shell">
      <div className="hero-card">
        <h1>Idea Evolution Tracker</h1>
        <p>
          Fikirlerinizi sadece takip etmeyin — dallandırın, deneyin, premium insight'larla büyütün.
        </p>
        <div className="feature-chips">
          <span>🌳 Branching timeline</span>
          <span>⚡ Premium AI insights</span>
          <span>🧪 Experiment intelligence</span>
        </div>
      </div>

      <div className="auth-card">
        <div className="auth-tabs">
          <button type="button" className={mode === 'login' ? 'tab active' : 'tab'} onClick={() => setMode('login')}>Giriş</button>
          <button type="button" className={mode === 'register' ? 'tab active' : 'tab'} onClick={() => setMode('register')}>Kayıt Ol</button>
        </div>

        <form onSubmit={onSubmit} className="form-grid">
          {mode === 'register' ? (
            <label>
              İsim
              <input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
            </label>
          ) : null}

          <label>
            E-posta
            <input type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} />
          </label>

          <label>
            Şifre
            <input type="password" value={form.password} onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))} />
          </label>

          <button type="submit" disabled={loading}>
            {loading ? 'İşleniyor...' : mode === 'register' ? 'Hesap Oluştur' : 'Giriş Yap'}
          </button>
        </form>

        {error ? <p className="error">{error}</p> : null}
      </div>
    </div>
  );
}

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const GENDERS = ['male', 'female', 'nonbinary', 'other'];

export default function Signup() {
  const { signup } = useAuth();
  const nav = useNavigate();
  const [f, setF] = useState({ name: '', email: '', password: '', age: 25, gender: 'female', interestedIn: ['male'] });
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  function toggleInterest(g) {
    setF((p) => ({
      ...p,
      interestedIn: p.interestedIn.includes(g) ? p.interestedIn.filter((x) => x !== g) : [...p.interestedIn, g],
    }));
  }

  async function submit(e) {
    e.preventDefault();
    setErr('');
    setLoading(true);
    try {
      await signup({ ...f, age: Number(f.age) });
      nav('/profile/edit');
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-card">
      <h1>Create account</h1>
      <form onSubmit={submit}>
        <input placeholder="Name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required />
        <input type="email" placeholder="Email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} required />
        <input type="password" placeholder="Password (min 8)" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} required minLength={8} />
        <input type="number" min="18" max="120" placeholder="Age" value={f.age} onChange={(e) => setF({ ...f, age: e.target.value })} required />
        <label>I am</label>
        <select value={f.gender} onChange={(e) => setF({ ...f, gender: e.target.value })}>
          {GENDERS.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
        <label>Interested in</label>
        <div className="chips">
          {GENDERS.map((g) => (
            <button type="button" key={g} className={`chip ${f.interestedIn.includes(g) ? 'on' : ''}`} onClick={() => toggleInterest(g)}>{g}</button>
          ))}
        </div>
        {err && <div className="error">{err}</div>}
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? 'Creating account...' : 'Sign up'}
        </button>
      </form>
      <p>Already have an account? <Link to="/login">Log in</Link></p>
    </div>
  );
}
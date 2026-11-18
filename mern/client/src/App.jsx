// src/App.jsx
// ---------------------------------------------------------------------------
// React user interface for the Nelson Community Tool Shed (MERN prototype).
//  [R1] Register / log in / update own account   -> AuthForm, AccountPanel
//  [R2] Beneficiary offers a token; member accepts -> Catalogue, Transactions
//  [R3] Members list tools stored in MongoDB       -> AddToolForm, Catalogue
//  [PWA] Install button, notifications button, offline banner
// State lives in React hooks (useState/useEffect); the JWT is kept in
// localStorage so the user stays logged in, including when offline.
// ---------------------------------------------------------------------------
import { useEffect, useState, useCallback } from 'react';
import { api } from './api.js';
import { listenForInstall, promptInstall, isInstalled, enablePush, watchConnection } from './pwa.js';

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem('jwt'));
  const [me, setMe] = useState(null);
  const [online, setOnline] = useState(true);
  const [canInstall, setCanInstall] = useState(false);
  const [message, setMessage] = useState('');

  // [PWA] Listen for the install prompt and for connection changes once
  useEffect(() => {
    listenForInstall(setCanInstall);
    watchConnection(setOnline);
  }, []);

  // [R1] Load the logged-in user's account whenever the token changes
  const loadMe = useCallback(async () => {
    if (!token) return setMe(null);
    try {
      setMe((await api('/auth/me', { token })).data);
    } catch {
      logout(); // token expired or invalid
    }
  }, [token]);
  useEffect(() => { loadMe(); }, [loadMe]);

  function onLogin(jwt) {
    localStorage.setItem('jwt', jwt);
    setToken(jwt);
  }
  function logout() {
    localStorage.removeItem('jwt');
    setToken(null);
    // [PWA] Remove the previous user's cached API data from this device
    navigator.serviceWorker?.controller?.postMessage('clear-data-cache');
  }

  return (
    <div className="app">
      <header>
        <h1>Nelson Community Tool Shed</h1>
        <div className="actions">
          {/* [PWA] Situation 2 - install to home screen */}
          {canInstall && !isInstalled() && (
            <button onClick={async () => setMessage(`Install: ${await promptInstall()}`)}>Install app</button>
          )}
          {/* [PWA] Situation 3 - push notifications */}
          {token && 'Notification' in window && (
            <button
              onClick={() =>
                enablePush(token)
                  .then(() => setMessage('Notifications enabled'))
                  .catch((e) => setMessage(e.message))
              }
            >
              Enable notifications
            </button>
          )}
          {token && <button onClick={logout}>Log out</button>}
        </div>
      </header>

      {/* [PWA] Situation 1 - offline banner */}
      {!online && <p className="banner">You are offline - showing saved tools. Borrow requests will be sent when you reconnect.</p>}
      {message && <p className="notice" onClick={() => setMessage('')}>{message}</p>}

      {!token ? (
        <AuthForm onLogin={onLogin} setMessage={setMessage} />
      ) : (
        me && (
          <>
            <AccountPanel me={me} token={token} onSaved={loadMe} setMessage={setMessage} />
            {me.role === 'member' && <AddToolForm token={token} setMessage={setMessage} />}
            <Transactions me={me} token={token} onChange={loadMe} setMessage={setMessage} />
          </>
        )
      )}
      <Catalogue me={me} token={token} setMessage={setMessage} onBorrow={loadMe} />
    </div>
  );
}

// ---------- [R1] Register / Log in ----------
function AuthForm({ onLogin, setMessage }) {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ fullName: '', email: '', password: '', role: 'beneficiary' });
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    try {
      if (mode === 'register') {
        await api('/auth/register', { method: 'POST', body: form });
        setMessage('Account created - you can now log in');
        setMode('login');
      } else {
        const { data } = await api('/auth/login', { method: 'POST', body: form });
        onLogin(data.token); // store the JWT returned by the server
      }
    } catch (err) {
      setMessage(err.message);
    }
  }

  return (
    <form className="card" onSubmit={submit}>
      <h2>{mode === 'login' ? 'Log in' : 'Create an account'}</h2>
      {mode === 'register' && (
        <>
          <input placeholder="Full name" value={form.fullName} onChange={set('fullName')} required />
          <select value={form.role} onChange={set('role')}>
            <option value="beneficiary">Beneficiary (borrow tools)</option>
            <option value="member">Member (lend tools)</option>
          </select>
        </>
      )}
      <input type="email" placeholder="Email" value={form.email} onChange={set('email')} required />
      <input type="password" placeholder="Password (min 8 characters)" value={form.password} onChange={set('password')} required />
      <button type="submit">{mode === 'login' ? 'Log in' : 'Register'}</button>
      <button type="button" className="link" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
        {mode === 'login' ? 'Need an account? Register' : 'Have an account? Log in'}
      </button>
    </form>
  );
}

// ---------- [R1] Administer own account ----------
function AccountPanel({ me, token, onSaved, setMessage }) {
  const [fullName, setFullName] = useState(me.fullName);
  async function save(e) {
    e.preventDefault();
    try {
      await api('/auth/me', { method: 'PUT', token, body: { fullName } });
      setMessage('Account updated');
      onSaved();
    } catch (err) {
      setMessage(err.message);
    }
  }
  return (
    <form className="card" onSubmit={save}>
      <h2>My account</h2>
      <p>{me.email} - <strong>{me.role}</strong> - Tokens: <strong>{me.tokenBalance}</strong></p>
      <input value={fullName} onChange={(e) => setFullName(e.target.value)} />
      <button type="submit">Save name</button>
    </form>
  );
}

// ---------- [R3] Member lists a tool (stored in MongoDB) ----------
function AddToolForm({ token, setMessage }) {
  const empty = { name: '', category: 'Hand Tools', description: '', condition: 'Good', tokenCost: 1 };
  const [tool, setTool] = useState(empty);
  const set = (k) => (e) => setTool({ ...tool, [k]: e.target.value });
  async function submit(e) {
    e.preventDefault();
    try {
      await api('/tools', { method: 'POST', token, body: { ...tool, tokenCost: Number(tool.tokenCost) } });
      setMessage(`${tool.name} listed`);
      setTool(empty);
      window.dispatchEvent(new Event('tools-changed')); // tell the catalogue to reload
    } catch (err) {
      setMessage(err.message);
    }
  }
  return (
    <form className="card" onSubmit={submit}>
      <h2>List a tool</h2>
      <input placeholder="Tool name" value={tool.name} onChange={set('name')} required />
      <select value={tool.category} onChange={set('category')}>
        <option>Hand Tools</option><option>Power Tools</option><option>Garden</option>
      </select>
      <select value={tool.condition} onChange={set('condition')}>
        <option>Like New</option><option>Good</option><option>Well Loved</option>
      </select>
      <input type="number" min="1" value={tool.tokenCost} onChange={set('tokenCost')} title="Token cost" />
      <textarea placeholder="Description" value={tool.description} onChange={set('description')} />
      <button type="submit">Add tool</button>
    </form>
  );
}

// ---------- [R3] Catalogue + [R2] beneficiary borrow request ----------
function Catalogue({ me, token, setMessage, onBorrow }) {
  const [tools, setTools] = useState([]);
  const [q, setQ] = useState('');
  const [fromCache, setFromCache] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api(`/tools${q ? `?q=${encodeURIComponent(q)}` : ''}`);
      setTools(res.data);
      setFromCache(res.fromCache); // true when the service worker served saved data
    } catch (err) {
      setMessage(err.message);
    }
  }, [q]);
  useEffect(() => {
    load();
    window.addEventListener('tools-changed', load);
    return () => window.removeEventListener('tools-changed', load);
  }, [load]);

  async function borrow(id) {
    try {
      const { data } = await api(`/tools/${id}/borrow`, { method: 'POST', token });
      setMessage(data.message); // "queued" message comes from the service worker when offline
      load();
      onBorrow();
    } catch (err) {
      setMessage(err.message);
    }
  }

  return (
    <section className="card">
      <h2>Tool catalogue {fromCache && <small>(saved copy)</small>}</h2>
      <input placeholder="Search tools..." value={q} onChange={(e) => setQ(e.target.value)} />
      <ul className="tools">
        {tools.map((t) => (
          <li key={t._id}>
            <strong>{t.name}</strong> <span>{t.category} - {t.condition}</span>
            <span className={`status ${t.status}`}>{t.status}</span>
            <span>{t.tokenCost} token(s) - listed by {t.owner?.fullName}</span>
            {me?.role === 'beneficiary' && t.status === 'available' && (
              <button onClick={() => borrow(t._id)}>Borrow</button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

// ---------- [R2] Member accepts the token ----------
function Transactions({ me, token, onChange, setMessage }) {
  const [list, setList] = useState([]);
  const load = useCallback(async () => {
    try {
      setList((await api('/borrowings', { token })).data);
    } catch (err) {
      setMessage(err.message);
    }
  }, [token]);
  useEffect(() => { load(); }, [load]);

  async function act(id, action) {
    try {
      const { data } = await api(`/borrowings/${id}/${action}`, { method: 'POST', token });
      setMessage(data.message);
      load();
      onChange();
      window.dispatchEvent(new Event('tools-changed'));
    } catch (err) {
      setMessage(err.message);
    }
  }

  return (
    <section className="card">
      <h2>My transactions</h2>
      {list.length === 0 && <p>No transactions yet.</p>}
      <ul>
        {list.map((b) => (
          <li key={b._id}>
            {b.tool?.name} - {b.borrower?.fullName} to {b.lender?.fullName} - {b.tokensSpent} token(s) - <em>{b.status}</em>
            {me.role === 'member' && b.status === 'pending' && (
              <>
                <button onClick={() => act(b._id, 'accept')}>Accept token</button>
                <button onClick={() => act(b._id, 'decline')}>Decline</button>
              </>
            )}
            {me.role === 'member' && b.status === 'active' && <button onClick={() => act(b._id, 'return')}>Confirm return</button>}
          </li>
        ))}
      </ul>
    </section>
  );
}

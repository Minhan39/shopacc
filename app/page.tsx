'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      router.push('/dashboard');
    } catch {
      setError('Lỗi kết nối');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: '16px' }}>
      <div style={{ position: 'fixed', top: '20%', left: '50%', transform: 'translateX(-50%)', width: '600px', height: '400px', background: 'radial-gradient(ellipse, rgba(124,58,237,0.15) 0%, transparent 70%)', pointerEvents: 'none' }} />
      <div style={{ width: '100%', maxWidth: '400px' }}>
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '56px', height: '56px', background: 'linear-gradient(135deg, var(--accent), var(--accent2))', borderRadius: '16px', marginBottom: '16px', boxShadow: '0 0 30px var(--accent-glow)' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          </div>
          <h1 style={{ fontSize: '28px', fontWeight: '800', margin: 0, letterSpacing: '-0.5px' }}>AccShop</h1>
          <p style={{ color: 'var(--text2)', marginTop: '6px', fontSize: '14px' }}>Hệ thống quản lý tài khoản bán hàng</p>
        </div>
        <div className="glass" style={{ padding: '32px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '24px', marginTop: 0 }}>Đăng nhập</h2>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: 'var(--text2)', marginBottom: '6px' }}>Tài khoản</label>
              <input className="input" placeholder="Nhập tài khoản..." value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} required />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: 'var(--text2)', marginBottom: '6px' }}>Mật khẩu</label>
              <input className="input" type="password" placeholder="Nhập mật khẩu..." value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required />
            </div>
            {error && <div style={{ background: 'var(--red-bg)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', padding: '10px 14px', color: 'var(--red)', fontSize: '13px' }}>{error}</div>}
            <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: '100%', justifyContent: 'center', padding: '12px', fontSize: '15px', marginTop: '4px' }}>
              {loading ? <><div className="spinner" style={{ width: '16px', height: '16px' }} /> Đang đăng nhập...</> : 'Đăng nhập'}
            </button>
          </form>
        </div>
        <p style={{ textAlign: 'center', color: 'var(--text3)', fontSize: '12px', marginTop: '24px' }}>AccShop © 2025 — Quản lý tài khoản bán hàng</p>
      </div>
    </div>
  );
}

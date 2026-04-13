'use client';
import { useEffect, useState } from 'react';
import { useUser } from '../layout';
import { useRouter } from 'next/navigation';

interface User { id: number; name: string; username: string; role: string; created_at: string; }

export default function UsersPage() {
  const { user, toast } = useUser();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', username: '', password: '', role: 'seller' });
  const [saving, setSaving] = useState(false);

  if (user?.role !== 'creator') {
    router.push('/dashboard');
    return null;
  }

  async function load() {
    const res = await fetch('/api/users');
    const data = await res.json();
    setUsers(data.users || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok) {
        toast('Tạo người dùng thành công!');
        setShowAdd(false);
        setForm({ name: '', username: '', password: '', role: 'seller' });
        load();
      } else {
        toast(data.error || 'Lỗi', 'error');
      }
    } finally {
      setSaving(false);
    }
  }

  function fmt(d: string) {
    return new Date(d).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '800', letterSpacing: '-0.5px', marginBottom: '4px' }}>Người dùng</h1>
          <p style={{ color: 'var(--text2)', fontSize: '14px' }}>Quản lý tài khoản người bán và người tạo</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Thêm người dùng
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', marginBottom: '24px' }}>
        {[
          { label: 'Tổng người dùng', value: users.length, color: 'purple' },
          { label: 'Người bán', value: users.filter(u => u.role === 'seller').length, color: 'green' },
          { label: 'Người tạo', value: users.filter(u => u.role === 'creator').length, color: 'amber' },
        ].map(s => (
          <div key={s.label} className={`stat-card ${s.color}`}>
            <div style={{ fontSize: '11px', color: 'var(--text3)', fontFamily: 'Space Mono', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>{s.label}</div>
            <div style={{ fontSize: '30px', fontWeight: '800', letterSpacing: '-1px' }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="glass">
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}><div className="spinner" /></div>
        ) : users.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text3)' }}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>👥</div>
            <div style={{ fontWeight: '600', marginBottom: '4px' }}>Chưa có người dùng nào</div>
            <div style={{ fontSize: '14px' }}>Nhấn "Thêm người dùng" để tạo tài khoản</div>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Họ tên</th>
                  <th>Tài khoản</th>
                  <th>Vai trò</th>
                  <th>Ngày tạo</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '36px', height: '36px', background: u.role === 'seller' ? 'rgba(168,85,247,0.1)' : 'rgba(59,130,246,0.1)', border: `1px solid ${u.role === 'seller' ? 'rgba(168,85,247,0.3)' : 'rgba(59,130,246,0.3)'}`, borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '14px', color: u.role === 'seller' ? 'var(--accent2)' : '#60a5fa', flexShrink: 0 }}>
                          {u.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: '600', fontSize: '14px' }}>{u.name}</div>
                          {u.id === user?.id && <div style={{ fontSize: '11px', color: 'var(--accent2)' }}>• Tài khoản của bạn</div>}
                        </div>
                      </div>
                    </td>
                    <td><span className="mono" style={{ fontSize: '13px', color: 'var(--text2)' }}>@{u.username}</span></td>
                    <td>
                      <span className={`badge ${u.role === 'seller' ? 'badge-seller' : 'badge-creator'}`}>
                        {u.role === 'seller' ? '🏪 Người bán' : '✏️ Người tạo'}
                      </span>
                    </td>
                    <td><span className="mono" style={{ fontSize: '13px', color: 'var(--text3)' }}>{fmt(u.created_at)}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Modal */}
      {showAdd && (
        <div className="modal-overlay" onClick={() => setShowAdd(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '700' }}>Thêm người dùng</h2>
              <button onClick={() => setShowAdd(false)} style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: '20px' }}>✕</button>
            </div>
            <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: 'var(--text2)', marginBottom: '6px' }}>Họ tên *</label>
                <input className="input" placeholder="Nhập họ tên..." value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: 'var(--text2)', marginBottom: '6px' }}>Tài khoản đăng nhập *</label>
                <input className="input mono" placeholder="Nhập username..." value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} required />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: 'var(--text2)', marginBottom: '6px' }}>Mật khẩu *</label>
                <input className="input" type="password" placeholder="Nhập mật khẩu..." value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required minLength={6} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: 'var(--text2)', marginBottom: '6px' }}>Vai trò *</label>
                <select className="input" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                  <option value="seller">🏪 Người bán hàng</option>
                  <option value="creator">✏️ Người tạo tài khoản</option>
                </select>
              </div>
              <div style={{ background: 'var(--bg3)', borderRadius: '8px', padding: '12px', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text3)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Quyền hạn</div>
                {form.role === 'seller' ? (
                  <ul style={{ margin: 0, padding: '0 0 0 16px', color: 'var(--text2)', fontSize: '13px', lineHeight: '1.8' }}>
                    <li>✓ Xem danh sách tài khoản</li>
                    <li>✓ Đánh dấu đã bán</li>
                    <li>✓ Thêm ngày bán, liên hệ người mua</li>
                    <li>✓ Upload ảnh minh chứng</li>
                  </ul>
                ) : (
                  <ul style={{ margin: 0, padding: '0 0 0 16px', color: 'var(--text2)', fontSize: '13px', lineHeight: '1.8' }}>
                    <li>✓ Tất cả quyền của người bán</li>
                    <li>✓ Thêm tài khoản vào kho</li>
                    <li>✓ Import hàng loạt bằng text</li>
                    <li>✓ Quản lý người dùng</li>
                  </ul>
                )}
              </div>
              <div style={{ display: 'flex', gap: '10px', paddingTop: '4px' }}>
                <button type="submit" className="btn btn-primary" disabled={saving} style={{ flex: 1, justifyContent: 'center' }}>
                  {saving ? <><div className="spinner" style={{ width: '16px', height: '16px' }} /> Đang tạo...</> : 'Tạo người dùng'}
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => setShowAdd(false)}>Hủy</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

'use client';
import { useEffect, useState, createContext, useContext, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';

interface User { id: number; username: string; name: string; role: string; }
const UserContext = createContext<{ user: User | null; toast: (msg: string, type?: 'success' | 'error') => void }>({ user: null, toast: () => {} });
export const useUser = () => useContext(UserContext);

interface Toast { id: number; msg: string; type: 'success' | 'error'; }

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
    const id = Date.now();
    setToasts(t => [...t, { id, msg, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500);
  }, []);

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => {
      if (d.user) setUser(d.user);
      else router.push('/');
    }).catch(() => router.push('/')).finally(() => setLoading(false));
  }, [router]);

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/');
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <div className="spinner" style={{ width: '32px', height: '32px' }} />
    </div>
  );
  if (!user) return null;

  const navItems = [
    { href: '/dashboard', label: 'Tổng quan', icon: <ChartIcon /> },
    { href: '/dashboard/accounts', label: 'Tài khoản', icon: <AccountIcon /> },
    ...(user.role === 'creator' ? [{ href: '/dashboard/import', label: 'Import nhanh', icon: <ImportIcon /> }] : []),
    ...(user.role === 'creator' ? [{ href: '/dashboard/users', label: 'Người dùng', icon: <UsersIcon /> }] : []),
  ];

  return (
    <UserContext.Provider value={{ user, toast }}>
      {/* Sidebar */}
      <aside className="sidebar">
        <div style={{ padding: '20px 16px 12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '36px', height: '36px', background: 'linear-gradient(135deg, var(--accent), var(--accent2))', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            </div>
            <div>
              <div style={{ fontWeight: '800', fontSize: '16px', letterSpacing: '-0.3px' }}>AccShop</div>
              <div style={{ fontSize: '11px', color: 'var(--text3)', fontFamily: 'Space Mono, monospace' }}>v1.0.0</div>
            </div>
          </div>
        </div>
        <div className="glow-line" style={{ margin: '0 16px' }} />

        {/* User info */}
        <div style={{ padding: '12px 16px' }}>
          <div style={{ background: 'var(--bg3)', borderRadius: '10px', padding: '12px' }}>
            <div style={{ fontWeight: '700', fontSize: '14px', marginBottom: '2px' }}>{user.name}</div>
            <div style={{ fontSize: '12px', color: 'var(--text3)', fontFamily: 'Space Mono', marginBottom: '8px' }}>@{user.username}</div>
            <span className={`badge ${user.role === 'seller' ? 'badge-seller' : 'badge-creator'}`}>
              {user.role === 'seller' ? '🏪 Người bán' : '✏️ Người tạo'}
            </span>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ padding: '8px 12px', flex: 1 }}>
          {navItems.map(item => (
            <a key={item.href} href={item.href} className={`nav-item ${pathname === item.href ? 'active' : ''}`}>
              {item.icon}
              {item.label}
            </a>
          ))}
        </nav>

        {/* Logout */}
        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
          <button onClick={logout} className="nav-item" style={{ width: '100%', color: 'var(--red)' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            Đăng xuất
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="main-content">{children}</main>

      {/* Toasts */}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast toast-${t.type}`}>{t.msg}</div>
        ))}
      </div>
    </UserContext.Provider>
  );
}

function ChartIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>; }
function AccountIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>; }
function ImportIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>; }
function UsersIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>; }

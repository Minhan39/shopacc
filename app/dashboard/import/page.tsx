'use client';
import { useState } from 'react';
import { useUser } from '../layout';
import { useRouter } from 'next/navigation';

export default function ImportPage() {
  const { user, toast } = useUser();
  const router = useRouter();
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ inserted: number; accounts: any[] } | null>(null);

  if (user?.role !== 'creator') {
    router.push('/dashboard');
    return null;
  }

  function preview() {
    const lines = text.trim().split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length % 2 !== 0) return null;
    const pairs = [];
    for (let i = 0; i < lines.length; i += 2) {
      pairs.push({ account: lines[i], password: lines[i + 1] });
    }
    return pairs;
  }

  const pairs = preview();

  async function handleImport() {
    if (!pairs) return;
    setLoading(true);
    try {
      const res = await fetch('/api/accounts/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (res.ok) {
        setResult(data);
        toast(`Import thành công ${data.inserted} tài khoản! 🎉`);
      } else {
        toast(data.error || 'Lỗi import', 'error');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '800', letterSpacing: '-0.5px', marginBottom: '4px' }}>Import nhanh</h1>
        <p style={{ color: 'var(--text2)', fontSize: '14px' }}>Nhập nhiều tài khoản cùng lúc bằng text</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        {/* Input */}
        <div>
          <div className="glass" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <div style={{ background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.3)', borderRadius: '8px', padding: '8px', color: 'var(--accent2)' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              </div>
              <div>
                <div style={{ fontWeight: '700', fontSize: '15px' }}>Nhập dữ liệu</div>
                <div style={{ color: 'var(--text3)', fontSize: '12px' }}>Mỗi tài khoản 2 dòng: tài khoản / mật khẩu</div>
              </div>
            </div>

            {/* Format hint */}
            <div style={{ background: 'var(--bg3)', borderRadius: '8px', padding: '12px', marginBottom: '16px', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '12px', color: 'var(--text3)', fontFamily: 'Space Mono', marginBottom: '6px' }}>ĐỊNH DẠNG:</div>
              <pre style={{ margin: 0, fontFamily: 'Space Mono', fontSize: '13px', color: 'var(--accent2)', lineHeight: '1.6' }}>{`taikhoan1\nmatkhau1\ntaikhoan2\nmatkhau2`}</pre>
            </div>

            <textarea
              className="input mono"
              placeholder={`taikhoan1\nmatkhau1\ntaikhoan2\nmatkhau2`}
              value={text}
              onChange={e => { setText(e.target.value); setResult(null); }}
              style={{ minHeight: '280px', fontSize: '13px', lineHeight: '1.7' }}
            />

            <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
              <button className="btn btn-primary" onClick={handleImport} disabled={!pairs || pairs.length === 0 || loading} style={{ flex: 1, justifyContent: 'center' }}>
                {loading ? <><div className="spinner" style={{ width: '16px', height: '16px' }} /> Đang import...</> : `Import ${pairs ? pairs.length : 0} tài khoản`}
              </button>
              <button className="btn btn-ghost" onClick={() => { setText(''); setResult(null); }}>Xóa</button>
            </div>
          </div>
        </div>

        {/* Preview / Result */}
        <div>
          {result ? (
            <div className="glass" style={{ padding: '24px' }}>
              <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                <div style={{ fontSize: '48px', marginBottom: '8px' }}>🎉</div>
                <div style={{ fontWeight: '800', fontSize: '22px', color: 'var(--sold)' }}>Import thành công!</div>
                <div style={{ color: 'var(--text2)', fontSize: '14px', marginTop: '4px' }}>Đã thêm <strong style={{ color: 'var(--sold)' }}>{result.inserted}</strong> tài khoản</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '350px', overflowY: 'auto' }}>
                {result.accounts.map((acc: any, i: number) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'var(--bg3)', borderRadius: '8px', padding: '10px 14px' }}>
                    <div style={{ width: '24px', height: '24px', background: 'var(--sold-bg)', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <span style={{ color: 'var(--sold)', fontSize: '12px' }}>✓</span>
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div className="mono" style={{ fontSize: '13px', fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{acc.account}</div>
                      <div className="mono" style={{ fontSize: '11px', color: 'var(--text3)' }}>{acc.temp_password}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
                <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => router.push('/dashboard/accounts')}>
                  Xem danh sách
                </button>
                <button className="btn btn-ghost" onClick={() => { setText(''); setResult(null); }}>Import thêm</button>
              </div>
            </div>
          ) : (
            <div className="glass" style={{ padding: '24px' }}>
              <div style={{ fontWeight: '700', fontSize: '15px', marginBottom: '16px' }}>
                Xem trước {pairs ? <span style={{ color: 'var(--accent2)' }}>({pairs.length} tài khoản)</span> : ''}
              </div>
              {!text.trim() ? (
                <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text3)' }}>
                  <div style={{ fontSize: '36px', marginBottom: '10px' }}>📋</div>
                  <div style={{ fontSize: '14px' }}>Nhập dữ liệu ở bên trái để xem trước</div>
                </div>
              ) : !pairs ? (
                <div style={{ background: 'var(--red-bg)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '10px', padding: '16px', textAlign: 'center' }}>
                  <div style={{ fontSize: '24px', marginBottom: '8px' }}>⚠️</div>
                  <div style={{ color: 'var(--red)', fontWeight: '600', marginBottom: '4px' }}>Dữ liệu không hợp lệ</div>
                  <div style={{ color: 'var(--text3)', fontSize: '13px' }}>Số dòng phải là số chẵn (mỗi tài khoản cần 2 dòng)</div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '400px', overflowY: 'auto' }}>
                  {pairs.map((p, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'var(--bg3)', borderRadius: '8px', padding: '10px 14px' }}>
                      <div style={{ width: '24px', height: '24px', background: 'rgba(124,58,237,0.1)', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <span className="mono" style={{ color: 'var(--accent2)', fontSize: '10px' }}>{i + 1}</span>
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div className="mono" style={{ fontSize: '13px', fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.account}</div>
                        <div className="mono" style={{ fontSize: '11px', color: 'var(--text3)' }}>{p.password}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

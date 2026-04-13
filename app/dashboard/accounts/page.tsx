'use client';
import { useEffect, useState, useRef } from 'react';
import { useUser } from '../layout';

interface Account {
  id: number;
  account: string;
  temp_password: string;
  received_at: string;
  status: 'unsold' | 'sold';
  sold_at: string | null;
  warranty_expires_at: string | null;
  buyer_contact: string | null;
  proof_images: string[] | null;
  creator_name: string;
  creator_username: string;
  seller_name: string | null;
  seller_username: string | null;
}

function fmt(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
function fmtFull(d: string | null) {
  if (!d) return '';
  const dt = new Date(d);
  return dt.toISOString().slice(0, 16);
}

export default function AccountsPage() {
  const { user, toast } = useUser();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [showSell, setShowSell] = useState<Account | null>(null);
  const [showDetail, setShowDetail] = useState<Account | null>(null);
  const [addForm, setAddForm] = useState({ account: '', temp_password: '' });
  const [sellForm, setSellForm] = useState({ sold_at: '', warranty_expires_at: '', buyer_contact: '', proof_images: [] as string[] });
  const [uploadingImg, setUploadingImg] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [showImg, setShowImg] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter) params.set('status', statusFilter);
    if (search) params.set('search', search);
    const res = await fetch('/api/accounts?' + params);
    const data = await res.json();
    setAccounts(data.accounts || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, [statusFilter, search]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(addForm),
    });
    if (res.ok) {
      toast('Thêm tài khoản thành công!');
      setShowAdd(false);
      setAddForm({ account: '', temp_password: '' });
      load();
    } else {
      const d = await res.json();
      toast(d.error || 'Lỗi', 'error');
    }
  }

  async function handleSell(e: React.FormEvent) {
    e.preventDefault();
    if (!showSell) return;
    const res = await fetch(`/api/accounts/${showSell.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sellForm),
    });
    if (res.ok) {
      toast('Cập nhật thành công! Tài khoản đã được đánh dấu đã bán ✅');
      setShowSell(null);
      setSellForm({ sold_at: '', warranty_expires_at: '', buyer_contact: '', proof_images: [] });
      load();
    } else {
      const d = await res.json();
      toast(d.error || 'Lỗi', 'error');
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Xác nhận xóa tài khoản này?')) return;
    const res = await fetch(`/api/accounts/${id}`, { method: 'DELETE' });
    if (res.ok) { toast('Đã xóa tài khoản'); load(); }
  }

  async function uploadImages(files: FileList) {
    setUploadingImg(true);
    const fd = new FormData();
    Array.from(files).forEach(f => fd.append('files', f));
    const res = await fetch('/api/upload', { method: 'POST', body: fd });
    const data = await res.json();
    setSellForm(f => ({ ...f, proof_images: [...f.proof_images, ...data.urls] }));
    setUploadingImg(false);
  }

  function copyToClipboard(text: string, key: string) {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  }

  function openSell(acc: Account) {
    setShowSell(acc);
    setSellForm({
      sold_at: acc.sold_at ? fmtFull(acc.sold_at) : fmtFull(new Date().toISOString()),
      warranty_expires_at: acc.warranty_expires_at ? fmtFull(acc.warranty_expires_at) : '',
      buyer_contact: acc.buyer_contact || '',
      proof_images: acc.proof_images || [],
    });
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '800', letterSpacing: '-0.5px', marginBottom: '4px' }}>Tài khoản</h1>
          <p style={{ color: 'var(--text2)', fontSize: '14px' }}>Quản lý danh sách tài khoản trong kho</p>
        </div>
        {user?.role === 'creator' && (
          <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Thêm tài khoản
          </button>
        )}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <input className="input" placeholder="Tìm kiếm tài khoản, người mua..." value={search} onChange={e => setSearch(e.target.value)} style={{ maxWidth: '300px' }} />
        <select className="input" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ maxWidth: '180px' }}>
          <option value="">Tất cả trạng thái</option>
          <option value="unsold">Chưa bán</option>
          <option value="sold">Đã bán</option>
        </select>
        <button className="btn btn-ghost" onClick={load}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.65"/></svg>
          Làm mới
        </button>
      </div>

      {/* Table */}
      <div className="glass">
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px' }}>
            <div className="spinner" />
          </div>
        ) : accounts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text3)' }}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>📭</div>
            <div style={{ fontWeight: '600', fontSize: '16px', marginBottom: '4px' }}>Không có tài khoản nào</div>
            <div style={{ fontSize: '14px' }}>
              {user?.role === 'creator' ? 'Nhấn "Thêm tài khoản" để bắt đầu' : 'Chưa có tài khoản trong kho'}
            </div>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Tài khoản</th>
                  <th>Mật khẩu tạm</th>
                  <th>Ngày nhận</th>
                  <th>Trạng thái</th>
                  <th>Ngày bán</th>
                  <th>Bảo hành đến</th>
                  <th>Người tạo</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map(acc => (
                  <tr key={acc.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className="mono" style={{ fontSize: '13px', color: 'var(--text)' }}>{acc.account}</span>
                        <button onClick={() => copyToClipboard(acc.account, `acc-${acc.id}`)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: copied === `acc-${acc.id}` ? 'var(--sold)' : 'var(--text3)', padding: '2px' }}>
                          {copied === `acc-${acc.id}` ? '✓' : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>}
                        </button>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className="mono" style={{ fontSize: '13px', color: 'var(--text2)' }}>{acc.temp_password}</span>
                        <button onClick={() => copyToClipboard(acc.temp_password, `pw-${acc.id}`)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: copied === `pw-${acc.id}` ? 'var(--sold)' : 'var(--text3)', padding: '2px' }}>
                          {copied === `pw-${acc.id}` ? '✓' : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>}
                        </button>
                      </div>
                    </td>
                    <td style={{ color: 'var(--text2)', fontSize: '13px' }} className="mono">{fmt(acc.received_at)}</td>
                    <td>
                      <span className={`badge ${acc.status === 'sold' ? 'badge-sold' : 'badge-unsold'}`}>
                        {acc.status === 'sold' ? '✓ Đã bán' : '○ Chưa bán'}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text2)', fontSize: '13px' }} className="mono">{fmt(acc.sold_at)}</td>
                    <td style={{ color: acc.warranty_expires_at && new Date(acc.warranty_expires_at) < new Date() ? 'var(--red)' : 'var(--text2)', fontSize: '13px' }} className="mono">{fmt(acc.warranty_expires_at)}</td>
                    <td>
                      <span style={{ fontSize: '13px', color: 'var(--text2)' }}>{acc.creator_name || '—'}</span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button className="btn btn-ghost" style={{ padding: '6px 10px', fontSize: '12px' }} onClick={() => setShowDetail(acc)}>
                          Chi tiết
                        </button>
                        {user?.role === 'seller' && (
                          <button className="btn btn-success" style={{ padding: '6px 10px', fontSize: '12px' }} onClick={() => openSell(acc)}>
                            {acc.status === 'sold' ? 'Sửa' : '✓ Đã bán'}
                          </button>
                        )}
                        {user?.role === 'creator' && (
                          <button className="btn btn-danger" style={{ padding: '6px 10px', fontSize: '12px' }} onClick={() => handleDelete(acc.id)}>
                            Xóa
                          </button>
                        )}
                      </div>
                    </td>
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
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '700' }}>Thêm tài khoản mới</h2>
              <button onClick={() => setShowAdd(false)} style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: '20px' }}>✕</button>
            </div>
            <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: 'var(--text2)', marginBottom: '6px' }}>Tài khoản *</label>
                <input className="input mono" placeholder="Nhập tài khoản..." value={addForm.account} onChange={e => setAddForm(f => ({ ...f, account: e.target.value }))} required />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: 'var(--text2)', marginBottom: '6px' }}>Mật khẩu tạm *</label>
                <input className="input mono" placeholder="Nhập mật khẩu tạm..." value={addForm.temp_password} onChange={e => setAddForm(f => ({ ...f, temp_password: e.target.value }))} required />
              </div>
              <div style={{ display: 'flex', gap: '10px', paddingTop: '8px' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }}>Thêm tài khoản</button>
                <button type="button" className="btn btn-ghost" onClick={() => setShowAdd(false)}>Hủy</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Sell Modal */}
      {showSell && (
        <div className="modal-overlay" onClick={() => setShowSell(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '700' }}>Đánh dấu đã bán</h2>
                <div className="mono" style={{ fontSize: '12px', color: 'var(--accent2)', marginTop: '4px' }}>{showSell.account}</div>
              </div>
              <button onClick={() => setShowSell(null)} style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: '20px' }}>✕</button>
            </div>
            <form onSubmit={handleSell} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: 'var(--text2)', marginBottom: '6px' }}>Ngày bán</label>
                <input className="input" type="datetime-local" value={sellForm.sold_at} onChange={e => setSellForm(f => ({ ...f, sold_at: e.target.value }))} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: 'var(--text2)', marginBottom: '6px' }}>Ngày hết hạn bảo hành</label>
                <input className="input" type="datetime-local" value={sellForm.warranty_expires_at} onChange={e => setSellForm(f => ({ ...f, warranty_expires_at: e.target.value }))} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: 'var(--text2)', marginBottom: '6px' }}>Liên hệ người mua (Facebook, Zalo...)</label>
                <input className="input" placeholder="VD: https://facebook.com/..." value={sellForm.buyer_contact} onChange={e => setSellForm(f => ({ ...f, buyer_contact: e.target.value }))} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: 'var(--text2)', marginBottom: '6px' }}>Ảnh minh chứng</label>
                <input ref={fileRef} type="file" multiple accept="image/*" style={{ display: 'none' }} onChange={e => e.target.files && uploadImages(e.target.files)} />
                <div className="drop-zone" onClick={() => fileRef.current?.click()}
                  onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('drag-over'); }}
                  onDragLeave={e => e.currentTarget.classList.remove('drag-over')}
                  onDrop={e => { e.preventDefault(); e.currentTarget.classList.remove('drag-over'); uploadImages(e.dataTransfer.files); }}>
                  {uploadingImg ? <div className="spinner" style={{ margin: '0 auto' }} /> : (
                    <>
                      <div style={{ fontSize: '24px', marginBottom: '8px' }}>🖼️</div>
                      <div style={{ fontSize: '13px', color: 'var(--text3)' }}>Kéo thả hoặc click để tải ảnh</div>
                    </>
                  )}
                </div>
                {sellForm.proof_images.length > 0 && (
                  <div className="proof-grid" style={{ marginTop: '10px' }}>
                    {sellForm.proof_images.map((url, i) => (
                      <div key={i} style={{ position: 'relative' }}>
                        <img src={url} alt="" className="proof-img" onClick={() => setShowImg(url)} />
                        <button onClick={() => setSellForm(f => ({ ...f, proof_images: f.proof_images.filter((_, j) => j !== i) }))}
                          style={{ position: 'absolute', top: '2px', right: '2px', background: 'rgba(0,0,0,0.7)', border: 'none', color: 'white', cursor: 'pointer', borderRadius: '4px', width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px' }}>✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: '10px', paddingTop: '8px' }}>
                <button type="submit" className="btn btn-success" style={{ flex: 1, justifyContent: 'center' }}>✓ Xác nhận đã bán</button>
                <button type="button" className="btn btn-ghost" onClick={() => setShowSell(null)}>Hủy</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {showDetail && (
        <div className="modal-overlay" onClick={() => setShowDetail(null)}>
          <div className="modal" style={{ maxWidth: '640px' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '700' }}>Chi tiết tài khoản</h2>
                <span className={`badge ${showDetail.status === 'sold' ? 'badge-sold' : 'badge-unsold'}`} style={{ marginTop: '6px', display: 'inline-flex' }}>
                  {showDetail.status === 'sold' ? '✓ Đã bán' : '○ Chưa bán'}
                </span>
              </div>
              <button onClick={() => setShowDetail(null)} style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: '20px' }}>✕</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              {[
                ['Tài khoản', showDetail.account],
                ['Mật khẩu tạm', showDetail.temp_password],
                ['Ngày nhận', fmt(showDetail.received_at)],
                ['Người tạo', showDetail.creator_name || '—'],
                ['Ngày bán', fmt(showDetail.sold_at)],
                ['Người bán', showDetail.seller_name || '—'],
                ['Bảo hành đến', fmt(showDetail.warranty_expires_at)],
                ['Liên hệ người mua', showDetail.buyer_contact || '—'],
              ].map(([label, value]) => (
                <div key={label} style={{ background: 'var(--bg3)', borderRadius: '8px', padding: '12px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text3)', fontFamily: 'Space Mono', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>{label}</div>
                  <div style={{ fontWeight: '600', fontSize: '14px', wordBreak: 'break-all' }}>{value}</div>
                </div>
              ))}
            </div>
            {showDetail.proof_images && showDetail.proof_images.length > 0 && (
              <div style={{ marginTop: '16px' }}>
                <div style={{ fontSize: '13px', color: 'var(--text2)', fontWeight: '600', marginBottom: '10px' }}>Ảnh minh chứng ({showDetail.proof_images.length})</div>
                <div className="proof-grid">
                  {showDetail.proof_images.map((url, i) => <img key={i} src={url} alt="" className="proof-img" onClick={() => setShowImg(url)} />)}
                </div>
              </div>
            )}
            {user?.role === 'seller' && (
              <div style={{ marginTop: '16px' }}>
                <button className="btn btn-success" style={{ width: '100%', justifyContent: 'center' }} onClick={() => { setShowDetail(null); openSell(showDetail); }}>
                  {showDetail.status === 'sold' ? 'Chỉnh sửa thông tin bán' : '✓ Đánh dấu đã bán'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Image lightbox */}
      {showImg && (
        <div className="modal-overlay" onClick={() => setShowImg(null)} style={{ zIndex: 200 }}>
          <img src={showImg} alt="" style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain', borderRadius: '8px' }} />
        </div>
      )}
    </div>
  );
}

'use client';
import { useEffect, useState } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { useUser } from './layout';

interface Stats {
  summary: { total: number; sold: number; unsold: number };
  daily: { date: string; count: string }[];
  monthly: { month: string; count: string }[];
  byCreator: { name: string; username: string; created: string; sold: string }[];
}

const COLORS = ['#7c3aed', '#10b981', '#f59e0b', '#60a5fa', '#f43f5e'];

export default function DashboardPage() {
  const { user } = useUser();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/stats').then(r => r.json()).then(d => setStats(d)).finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      <div className="spinner" style={{ width: '36px', height: '36px' }} />
    </div>
  );
  if (!stats) return null;

  const pieData = [
    { name: 'Đã bán', value: stats.summary.sold },
    { name: 'Chưa bán', value: stats.summary.unsold },
  ];
  const pieColors = ['#10b981', '#f59e0b'];

  const dailyData = stats.daily.map(d => ({
    date: new Date(d.date).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }),
    'Đã bán': parseInt(d.count),
  }));

  const monthlyData = stats.monthly.map(d => ({
    month: d.month,
    'Đã bán': parseInt(d.count),
  }));

  const tooltipStyle = { background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '8px', fontFamily: 'Syne, sans-serif', fontSize: '13px', color: 'var(--text)' };

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: '26px', fontWeight: '800', letterSpacing: '-0.5px', marginBottom: '4px' }}>
          Tổng quan 👋
        </h1>
        <p style={{ color: 'var(--text2)', fontSize: '14px' }}>Xin chào, <strong style={{ color: 'var(--accent2)' }}>{user?.name}</strong> — {user?.role === 'seller' ? 'Người bán hàng' : 'Người tạo tài khoản'}</p>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '28px' }}>
        <div className="stat-card purple">
          <div style={{ fontSize: '12px', color: 'var(--text3)', fontFamily: 'Space Mono', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '10px' }}>Tổng tài khoản</div>
          <div style={{ fontSize: '36px', fontWeight: '800', letterSpacing: '-1px' }}>{stats.summary.total}</div>
          <div style={{ color: 'var(--accent2)', fontSize: '13px', marginTop: '4px' }}>Tất cả tài khoản</div>
        </div>
        <div className="stat-card green">
          <div style={{ fontSize: '12px', color: 'var(--text3)', fontFamily: 'Space Mono', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '10px' }}>Đã bán</div>
          <div style={{ fontSize: '36px', fontWeight: '800', letterSpacing: '-1px', color: 'var(--sold)' }}>{stats.summary.sold}</div>
          <div style={{ color: 'var(--sold)', fontSize: '13px', marginTop: '4px' }}>
            {stats.summary.total > 0 ? Math.round(stats.summary.sold / stats.summary.total * 100) : 0}% tổng số
          </div>
        </div>
        <div className="stat-card amber">
          <div style={{ fontSize: '12px', color: 'var(--text3)', fontFamily: 'Space Mono', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '10px' }}>Chưa bán</div>
          <div style={{ fontSize: '36px', fontWeight: '800', letterSpacing: '-1px', color: 'var(--unsold)' }}>{stats.summary.unsold}</div>
          <div style={{ color: 'var(--unsold)', fontSize: '13px', marginTop: '4px' }}>Còn trong kho</div>
        </div>
        <div className="stat-card red">
          <div style={{ fontSize: '12px', color: 'var(--text3)', fontFamily: 'Space Mono', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '10px' }}>Tỷ lệ bán</div>
          <div style={{ fontSize: '36px', fontWeight: '800', letterSpacing: '-1px', color: '#ef4444' }}>
            {stats.summary.total > 0 ? Math.round(stats.summary.sold / stats.summary.total * 100) : 0}%
          </div>
          <div style={{ color: '#ef4444', fontSize: '13px', marginTop: '4px' }}>Conversion rate</div>
        </div>
      </div>

      {/* Charts row 1 */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px', marginBottom: '16px' }}>
        {/* Line chart - daily */}
        <div className="glass" style={{ padding: '20px' }}>
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontWeight: '700', fontSize: '15px' }}>Bán hàng 30 ngày qua</div>
            <div style={{ color: 'var(--text3)', fontSize: '12px', fontFamily: 'Space Mono' }}>Số tài khoản bán mỗi ngày</div>
          </div>
          {dailyData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="date" tick={{ fill: 'var(--text3)', fontSize: 11, fontFamily: 'Space Mono' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--text3)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Line type="monotone" dataKey="Đã bán" stroke="var(--accent2)" strokeWidth={2} dot={{ fill: 'var(--accent)', r: 3 }} activeDot={{ r: 5, fill: 'var(--accent2)' }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', fontSize: '14px' }}>Chưa có dữ liệu bán hàng</div>
          )}
        </div>

        {/* Pie chart */}
        <div className="glass" style={{ padding: '20px' }}>
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontWeight: '700', fontSize: '15px' }}>Trạng thái kho</div>
            <div style={{ color: 'var(--text3)', fontSize: '12px', fontFamily: 'Space Mono' }}>Tỷ lệ đã/chưa bán</div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={4} dataKey="value">
                {pieData.map((_, i) => <Cell key={i} fill={pieColors[i]} />)}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontFamily: 'Syne', fontSize: '13px', color: 'var(--text2)' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts row 2 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
        {/* Bar chart - monthly */}
        <div className="glass" style={{ padding: '20px' }}>
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontWeight: '700', fontSize: '15px' }}>Doanh số theo tháng</div>
            <div style={{ color: 'var(--text3)', fontSize: '12px', fontFamily: 'Space Mono' }}>12 tháng gần nhất</div>
          </div>
          {monthlyData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="month" tick={{ fill: 'var(--text3)', fontSize: 11, fontFamily: 'Space Mono' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--text3)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="Đã bán" fill="var(--accent)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', fontSize: '14px' }}>Chưa có dữ liệu</div>
          )}
        </div>

        {/* Creator table */}
        <div className="glass" style={{ padding: '20px' }}>
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontWeight: '700', fontSize: '15px' }}>Thống kê theo người tạo</div>
            <div style={{ color: 'var(--text3)', fontSize: '12px', fontFamily: 'Space Mono' }}>Số tài khoản mỗi người tạo</div>
          </div>
          {stats.byCreator.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {stats.byCreator.map((c, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '32px', height: '32px', background: `${COLORS[i % COLORS.length]}22`, border: `1px solid ${COLORS[i % COLORS.length]}44`, borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: '700', color: COLORS[i % COLORS.length], flexShrink: 0 }}>
                    {c.name.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: '600', fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</div>
                    <div style={{ color: 'var(--text3)', fontSize: '11px', fontFamily: 'Space Mono' }}>@{c.username}</div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontWeight: '700', fontSize: '14px' }}>{c.created}</div>
                    <div style={{ fontSize: '11px', color: 'var(--sold)', fontFamily: 'Space Mono' }}>{c.sold} đã bán</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '150px', color: 'var(--text3)', fontSize: '14px' }}>Chưa có người tạo nào</div>
          )}
        </div>
      </div>
    </div>
  );
}

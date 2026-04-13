import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { requireAuth } from '@/lib/middleware';

export async function GET(req: NextRequest) {
  const { error } = requireAuth(req);
  if (error) return error;

  const client = await pool.connect();
  try {
    const [total, sold, unsold, daily, monthly, byCreator] = await Promise.all([
      client.query('SELECT COUNT(*) as count FROM accounts'),
      client.query("SELECT COUNT(*) as count FROM accounts WHERE status = 'sold'"),
      client.query("SELECT COUNT(*) as count FROM accounts WHERE status = 'unsold'"),
      client.query(`
        SELECT DATE(sold_at) as date, COUNT(*) as count
        FROM accounts WHERE status = 'sold' AND sold_at > NOW() - INTERVAL '30 days'
        GROUP BY DATE(sold_at) ORDER BY date ASC
      `),
      client.query(`
        SELECT TO_CHAR(sold_at, 'YYYY-MM') as month, COUNT(*) as count
        FROM accounts WHERE status = 'sold' AND sold_at > NOW() - INTERVAL '12 months'
        GROUP BY TO_CHAR(sold_at, 'YYYY-MM') ORDER BY month ASC
      `),
      client.query(`
        SELECT u.name, u.username, COUNT(a.id) as created, 
          SUM(CASE WHEN a.status='sold' THEN 1 ELSE 0 END) as sold
        FROM users u
        LEFT JOIN accounts a ON a.created_by = u.id
        WHERE u.role = 'creator'
        GROUP BY u.id, u.name, u.username
      `),
    ]);

    return NextResponse.json({
      summary: {
        total: parseInt(total.rows[0].count),
        sold: parseInt(sold.rows[0].count),
        unsold: parseInt(unsold.rows[0].count),
      },
      daily: daily.rows,
      monthly: monthly.rows,
      byCreator: byCreator.rows,
    });
  } finally {
    client.release();
  }
}

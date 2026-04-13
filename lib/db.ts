import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export default pool;

export async function initDB() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        username VARCHAR(50) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(20) NOT NULL CHECK (role IN ('seller', 'creator')),
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS accounts (
        id SERIAL PRIMARY KEY,
        account VARCHAR(255) NOT NULL,
        temp_password VARCHAR(255) NOT NULL,
        received_at TIMESTAMP NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'unsold' CHECK (status IN ('unsold', 'sold')),
        sold_at TIMESTAMP,
        warranty_expires_at TIMESTAMP,
        buyer_contact VARCHAR(255),
        proof_images TEXT[],
        created_by INTEGER REFERENCES users(id),
        sold_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('DB initialized');
  } finally {
    client.release();
  }
}

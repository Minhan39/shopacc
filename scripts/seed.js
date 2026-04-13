#!/usr/bin/env node
// Run: node scripts/seed.js
// Creates default admin user: admin / admin123

const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({ connectionString: process.env.DATABASE_URL || 'postgresql://postgres:abcd%401234@localhost:5432/accshop' });

async function seed() {
  const client = await pool.connect();
  try {
    console.log('🔧 Initializing database...');

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

    // Create default creator admin
    const hashed = bcrypt.hashSync('abcd@1234', 10);
    await client.query(`
      INSERT INTO users (name, username, password, role)
      VALUES ('Admin', 'admin', $1, 'creator')
      ON CONFLICT (username) DO NOTHING
    `, [hashed]);

    // Create default seller
    const sellerPass = bcrypt.hashSync('abcd@1234', 10);
    await client.query(`
      INSERT INTO users (name, username, password, role)
      VALUES ('Người bán', 'seller', $1, 'seller')
      ON CONFLICT (username) DO NOTHING
    `, [sellerPass]);

    console.log('✅ Database initialized!');
    console.log('');
    console.log('📌 Default accounts:');
    console.log('   Creator: admin / abcd@1234');
    console.log('   Seller:  seller / abcd@1234');
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch(err => { console.error('❌ Seed failed:', err.message); process.exit(1); });

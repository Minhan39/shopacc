#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
// Run: node scripts/seed.js

require('./load-env');

const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const primaryConnectionString =
  process.env.DATABASE_URL || 'postgresql://postgres:abcd%401234@localhost:5432/accshop';
const mirrorConnectionString = process.env.MIRROR_DATABASE_URL;

const primaryPool = new Pool({ connectionString: primaryConnectionString });
const mirrorPool = mirrorConnectionString ? new Pool({ connectionString: mirrorConnectionString }) : null;

async function initSchema(pool) {
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
  } finally {
    client.release();
  }
}

async function seedUsers(pool) {
  const client = await pool.connect();
  try {
    const creatorPassword = bcrypt.hashSync('abcd@1234', 10);
    await client.query(
      `
        INSERT INTO users (name, username, password, role)
        VALUES ('Admin', 'admin', $1, 'creator')
        ON CONFLICT (username) DO NOTHING
      `,
      [creatorPassword]
    );

    const sellerPassword = bcrypt.hashSync('abcd@1234', 10);
    await client.query(
      `
        INSERT INTO users (name, username, password, role)
        VALUES ('Nguoi ban', 'seller', $1, 'seller')
        ON CONFLICT (username) DO NOTHING
      `,
      [sellerPassword]
    );
  } finally {
    client.release();
  }
}

async function seed() {
  try {
    console.log('Initializing primary database...');
    await initSchema(primaryPool);
    await seedUsers(primaryPool);

    if (mirrorPool) {
      console.log('Initializing mirror database...');
      await initSchema(mirrorPool);
      await seedUsers(mirrorPool);
    }

    console.log('Database initialized successfully.');
    console.log('Default accounts:');
    console.log('Creator: admin / abcd@1234');
    console.log('Seller: seller / abcd@1234');
  } finally {
    await primaryPool.end();

    if (mirrorPool) {
      await mirrorPool.end();
    }
  }
}

seed().catch((error) => {
  console.error('Seed failed:', error.message);
  process.exit(1);
});

#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
// Run: node scripts/seed.js

require('./load-env');

const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

function getPrimaryPool() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('Missing DATABASE_URL');
  }

  return new Pool({ connectionString });
}

function getMirrorConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

  if (!url || !serviceRoleKey) {
    return null;
  }

  return {
    url: url.replace(/\/$/, ''),
    serviceRoleKey,
  };
}

async function mirrorUpsert(table, row) {
  const config = getMirrorConfig();
  if (!config) return;

  const response = await fetch(`${config.url}/rest/v1/${table}?on_conflict=id`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`,
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(row),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Failed to mirror ${table}`);
  }
}

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
    const defaults = [
      {
        name: 'Admin',
        username: 'admin',
        password: bcrypt.hashSync('abcd@1234', 10),
        role: 'creator',
      },
      {
        name: 'Nguoi ban',
        username: 'seller',
        password: bcrypt.hashSync('abcd@1234', 10),
        role: 'seller',
      },
    ];

    for (const user of defaults) {
      const result = await client.query(
        `
          INSERT INTO users (name, username, password, role)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (username) DO UPDATE
          SET name = EXCLUDED.name,
              password = EXCLUDED.password,
              role = EXCLUDED.role
          RETURNING id, name, username, password, role, created_at
        `,
        [user.name, user.username, user.password, user.role]
      );

      await mirrorUpsert('users', result.rows[0]);
      console.log(`Upserted user: ${user.username}`);
    }
  } finally {
    client.release();
  }
}

async function seed() {
  const pool = getPrimaryPool();

  try {
    console.log('Initializing primary database...');
    await initSchema(pool);
    await seedUsers(pool);

    if (getMirrorConfig()) {
      console.log('Supabase mirror sync enabled.');
    }

    console.log('Seed completed.');
    console.log('Default accounts:');
    console.log('Creator: admin / abcd@1234');
    console.log('Seller: seller / abcd@1234');
  } finally {
    await pool.end();
  }
}

seed().catch((error) => {
  console.error('Seed failed:', error.message);
  process.exit(1);
});

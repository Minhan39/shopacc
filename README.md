# AccShop

He thong quan ly tai khoan ban hang xay dung bang Next.js, dung Neon/Postgres lam database chinh va Supabase REST lam mirror.

## Cai dat nhanh

### 1. Cai packages
```bash
npm install
```

### 2. Tao file .env.local
```env
DATABASE_URL=postgresql://postgres:password@host:5432/database
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_publishable_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
JWT_SECRET=your_secret_key_here
ACCOUNT_SECRET_KEY=replace_with_base64_32_byte_key
DB_MIRROR_STRICT=false
```

### 3. Seed du lieu mac dinh
```bash
node scripts/seed.js
```

### 4. Chay ung dung
```bash
npm run dev
```

Mo http://localhost:3000

## Tai khoan mac dinh

| Vai tro | Username | Password |
|---------|----------|----------|
| Creator | admin | abcd@1234 |
| Seller | seller | abcd@1234 |

## Luu y

- `DATABASE_URL` la nguon du lieu chinh cho toan bo API runtime.
- Supabase chi duoc dung de mirror du lieu sau khi ghi thanh cong vao primary database.
- `SUPABASE_SERVICE_ROLE_KEY` duoc dung cho server-side mirror sync. `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` giu lai cho cac nhu cau client-side neu can.
- Neu `DB_MIRROR_STRICT=true`, moi loi mirror se lam request ghi that bai. Mac dinh la best-effort.

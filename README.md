# AccShop — Hệ thống Quản lý Tài khoản Bán hàng

Phần mềm quản lý tài khoản bán hàng, NextJS + PostgreSQL, 2 vai trò: Người tạo & Người bán.

## Cài đặt nhanh

### 1. Cài packages
```bash
npm install
```

### 2. Tạo file .env.local
```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/accshop
JWT_SECRET=your_secret_key_here
```

### 3. Tạo database & seed
```bash
createdb accshop
node scripts/seed.js
```

### 4. Chạy
```bash
npm run dev
# Mở http://localhost:3000
```

## Tài khoản mặc định
| Vai trò | Username | Password |
|---------|----------|----------|
| Creator (Admin) | admin | admin123 |
| Seller | seller | seller123 |

## Tính năng

### Người tạo (Creator)
- Thêm tài khoản đơn lẻ (tài khoản + mật khẩu tạm)
- Import hàng loạt bằng text (tk1 / mk1 / tk2 / mk2...)
- Quản lý người dùng (tạo seller/creator)

### Người bán (Seller)
- Xem kho tài khoản, tìm kiếm & lọc
- Đánh dấu đã bán + ngày bán
- Nhập thông tin người mua (Facebook, Zalo...)
- Upload ảnh minh chứng

### Dashboard
- Biểu đồ bán hàng 30 ngày (Line chart)
- Biểu đồ tỷ lệ đã/chưa bán (Pie chart)
- Biểu đồ doanh số theo tháng (Bar chart)
- Thống kê theo người tạo

## Tech Stack
- **Next.js 14** (App Router) + TypeScript
- **PostgreSQL** + pg driver
- **Recharts** (biểu đồ)
- **JWT** + bcryptjs (auth)

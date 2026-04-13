import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AccShop — Quản lý tài khoản bán hàng',
  description: 'Hệ thống quản lý tài khoản bán hàng',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body className="antialiased">{children}</body>
    </html>
  );
}

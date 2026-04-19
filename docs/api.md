# API tai khoan

Tai lieu nay mo ta 3 API chinh phuc vu dang nhap va quan ly tai khoan dang ban trong he thong.

## 1. Dang nhap

- Method: `POST`
- URL: `/api/auth/login`

Request:

```json
{
  "username": "seller",
  "password": "seller123"
}
```

Response thanh cong:

```json
{
  "message": "Dang nhap thanh cong",
  "token": "<jwt-token>",
  "user": {
    "id": 2,
    "username": "seller",
    "name": "Seller",
    "role": "seller"
  }
}
```

Ghi chu:

- API dong thoi set cookie `token` dang `httpOnly`.
- Neu sai thong tin dang nhap, API tra `401`.

## 2. Xem danh sach tai khoan dang ban

- Method: `GET`
- URL: `/api/accounts`
- Yeu cau da dang nhap.

Query ho tro:

- `status=unsold`: loc tai khoan chua ban, phu hop voi man "tai khoan dang ban".
- `status=sold`: loc tai khoan da ban.
- `search=...`: tim theo `account` hoac `buyer_contact`.

Vi du:

```http
GET /api/accounts?status=unsold&search=facebook
```

Response:

```json
{
  "filters": {
    "status": "unsold",
    "search": "facebook"
  },
  "total": 1,
  "accounts": [
    {
      "id": 10,
      "account": "via-01",
      "temp_password": "123456",
      "status": "unsold",
      "creator_name": "Admin",
      "creator_username": "admin"
    }
  ]
}
```

Neu muon xem chi tiet 1 tai khoan:

- Method: `GET`
- URL: `/api/accounts/:id`

## 3. Cap nhat tai khoan da ban

- Method: `PATCH`
- URL: `/api/accounts/:id`
- Chi role `seller` duoc cap nhat.

Request:

```json
{
  "sold_at": "2026-04-15T10:30:00.000Z",
  "warranty_expires_at": "2026-05-15T10:30:00.000Z",
  "buyer_contact": "https://facebook.com/buyer.demo",
  "proof_images": [
    "/api/uploads/proof-1.png"
  ]
}
```

Response:

```json
{
  "message": "Danh dau da ban thanh cong",
  "account": {
    "id": 10,
    "status": "sold",
    "sold_by": 2,
    "buyer_contact": "https://facebook.com/buyer.demo"
  }
}
```

Ghi chu:

- Neu khong gui `sold_at`, he thong tu lay thoi gian hien tai.
- `proof_images` phai la mang chuoi.
- Sau khi cap nhat, `status` se duoc chuyen thanh `sold`.

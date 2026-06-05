# TECH STACK — Web POS cho Coffee Shop Chain

## Nguyên tắc
Giữ nguyên stack đã có để "đơn giản nhất có thể". Không framework, không build tool, không npm/composer.

## Thành phần
| Lớp | Công nghệ | Lý do |
|---|---|---|
| Database | **MariaDB / MySQL** (`final`, 18 bảng + 1 view) | Đã có sẵn schema + sample data |
| Backend | **PHP thuần + mysqli** (prepared statements) | db.php và 6 endpoint cũ đều viết kiểu này |
| Frontend | **HTML + CSS + JavaScript thuần** (fetch API) | Nhẹ nhất, không cần build |
| Auth | **PHP session + `password_hash()`/`password_verify()`** | Mật khẩu thật, không cần thư viện ngoài |
| Server | **XAMPP (Apache + MySQL)** hoặc `php -S localhost:8000` | Môi trường local sẵn có, dùng MySQL Workbench |
| Định dạng API | JSON (`{success, data, ...}`) | Đúng convention 6 endpoint hiện tại |

## Cấu trúc thư mục
```
db/  (đặt trong htdocs/coffee_pos nếu dùng XAMPP)
├── sql/
│   ├── 01_schema.sql          (có sẵn)
│   ├── 02_sample_data.sql     (có sẵn)
│   ├── 03_queries.sql         (có sẵn — 6 use case)
│   └── 04_auth.sql            (MỚI: ALTER TABLE staff thêm password_hash + UPDATE hash)
├── api/
│   ├── db.php                 (có sẵn — kết nối)
│   ├── _helpers.php           (MỚI: json(), require_login(), require_role())
│   ├── auth.php               (MỚI: login / logout / me)
│   ├── prep_queue.php         (có sẵn — UC1)
│   ├── low_stock.php          (có sẵn — UC2)
│   ├── modifier_revenue.php   (có sẵn — UC3)
│   ├── best_sellers.php       (có sẵn — UC4)
│   ├── price_check.php        (có sẵn — UC5)
│   ├── loyalty_balance.php    (có sẵn — UC6)
│   ├── menu.php               (MỚI — read)
│   ├── tables.php             (MỚI — read)
│   ├── order_history.php      (MỚI — read)
│   ├── inventory.php          (MỚI — read)
│   ├── sales_by_item.php      (MỚI — read)
│   ├── sales_by_hour.php      (MỚI — read)
│   ├── staff.php              (MỚI — read: roster / directory)
│   ├── promotions.php         (MỚI — read)
│   ├── branches.php           (MỚI — read)
│   ├── chain_dashboard.php    (MỚI — read)
│   ├── revenue_by_branch.php  (MỚI — read)
│   ├── audit_log.php          (MỚI — read)
│   └── create_order.php       (MỚI — WRITE: 1 transaction tạo đơn)
└── web/
    ├── index.html             (login)
    ├── pos.html               (Barista / Shift Lead — touchscreen)
    ├── manager.html           (Store Manager)
    ├── admin.html             (Admin Portal)
    ├── css/style.css
    └── js/
        ├── api.js             (wrapper fetch chung)
        ├── pos.js
        ├── manager.js
        └── admin.js
```

## Quy ước kỹ thuật
- **Bảo mật**: mọi truy vấn dùng prepared statement (`bind_param`); endpoint gọi `require_login()` / `require_role()`.
- **Phân quyền role**: `Admin` → admin.html · `StoreManager` → manager.html · `ShiftLead`/`Barista` → pos.html (ShiftLead thấy thêm mục "Shift Lead Only").
- **Price Integrity**: khi tạo đơn lưu snapshot `unit_price`, `price_delta_at_sale`.
- **Ghi đơn**: bọc trong transaction (`begin_transaction` / `commit` / `rollback`).
- **CORS**: giữ header như các endpoint hiện tại; nếu chạy cùng origin trên XAMPP thì không cần.

## Cấu hình cần đổi
- `api/db.php`: `DB_USER`, `DB_PASS` theo MySQL Workbench của bạn.
- Mật khẩu demo trong `04_auth.sql`: đề xuất `tên-thường + 123` (vd `kevin123`).

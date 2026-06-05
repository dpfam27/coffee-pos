# TIMELINE — Web POS cho Coffee Shop Chain

Thứ tự triển khai 6 giai đoạn. Mỗi giai đoạn chạy/kiểm thử được trước khi sang bước sau.

## Giai đoạn 1 — Setup & Đăng nhập
- Gom file vào `sql/`, `api/`, `web/`.
- Viết `04_auth.sql`: `ALTER TABLE staff ADD password_hash` + UPDATE hash cho 7 staff.
- Viết `_helpers.php` (`json`, `require_login`, `require_role`) và `auth.php` (login/logout/me).
- `index.html`: form đăng nhập, lưu session, redirect theo role.
- **Xong khi**: đăng nhập được, vào đúng dashboard.

## Giai đoạn 2 — POS (read)
- Endpoint: `menu.php`, `tables.php`, `order_history.php` (Prep Queue đã có).
- `pos.html` khung tab + render Prep Queue, Tables, Order History, danh sách Menu.
- **Xong khi**: barista xem được hàng chờ, bàn, lịch sử đơn, thực đơn.

## Giai đoạn 3 — POS (write) — luồng tạo đơn
- `create_order.php`: 1 transaction (orders → order_item → modifier → payment → trừ kho → loyalty → table → audit).
- Luồng UI: New Order → chọn món + modifier → Cart Review → Payment → gọi API.
- **Xong khi**: tạo đơn mới thành công và thấy nó ở Prep Queue / Order History.

## Giai đoạn 4 — Store Manager
- Endpoint: `inventory.php`, `sales_by_item.php`, `sales_by_hour.php`, `staff.php` (+ `low_stock`, `modifier_revenue` đã có).
- `manager.html`: Branch (Dashboard, Inventory, Low-Stock, Stock Adjustments), Reports, Staff.
- **Xong khi**: quản lý xem được tồn kho, cảnh báo, báo cáo, nhân sự.

## Giai đoạn 5 — Admin Portal
- Endpoint: `promotions.php`, `branches.php`, `chain_dashboard.php`, `revenue_by_branch.php`, `audit_log.php` (+ `best_sellers`, `modifier_revenue`, `loyalty_balance`, `price_check` đã có).
- `admin.html`: Menu Management, Promotions, Chain Operations, Reports, Audit Log.
- **Xong khi**: admin xem được toàn bộ màn quản trị chuỗi.

## Giai đoạn 6 — Hoàn thiện
- CSS gọn, responsive cho touchscreen; kiểm tra phân quyền từng role.
- Kiểm thử end-to-end với sample data; sửa lỗi.
- (Tùy chọn) Bổ sung các form ghi còn lại: Stock Adjustments, Voids & Refunds, Promotions Create/Edit, Menu CRUD.
- **Xong khi**: đủ tiêu chí trong `goal.md`.

## Phụ thuộc
G1 → G2 → G3 (tuần tự, vì cần login + menu trước khi tạo đơn).
G4 và G5 độc lập nhau, có thể làm song song sau G1.
G6 sau cùng.

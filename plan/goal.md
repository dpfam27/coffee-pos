# GOAL — Web POS cho Coffee Shop Chain

## Mục tiêu
Xây dựng web đơn giản nhất có thể theo sitemap, tái dùng tối đa những gì đã có (database `coffee_pos` + 6 endpoint PHP read-only).

## Quyết định phạm vi (đã chốt)
- **Phạm vi**: Toàn bộ sitemap — đủ 3 vai trò và mọi màn hình trong sơ đồ.
- **Ghi DB**: 1 luồng tạo đơn thật (New Order → Cart → Payment). Các màn "ghi" còn lại làm read-only/hiển thị trước, bổ sung form sau nếu cần.
- **Đăng nhập**: Có mật khẩu thật (hash bằng `password_hash()` của PHP + session).

## Sitemap → màn hình cần có

### Login/Authentication
- Form đăng nhập, phân quyền theo `role`, redirect đúng dashboard.

### Barista / Shift Lead (touchscreen / mobile) — `pos.html`
- **Order Flow**: New Order · Menu & Modifiers · Cart Review · Payment  ← **luồng ghi DB chính**
- **Operations**: Prep Queue · Tables · Order History
- **Shift Lead Only**: Voids & Refunds · Cash Drawer · Clock In/Out · Shift Close (hiện theo role)

### Store Manager (web) — `manager.html`
- **Branch**: Dashboard · Inventory Levels · Low-Stock Alerts · Stock Adjustments
- **Reports**: Sales by Item · Sales by Hour · Modifier Analysis
- **Staff**: Schedule · Roster

### Admin Portal (web) — `admin.html`
- **Menu Management**: Categories · Menu Items · Modifier Groups · Modifier Options · Item ↔ Modifier Links
- **Promotions**: Active Promos · Create/Edit
- **Chain Operations**: All Branches · Chain Dashboard · Staff Directory
- **Reports**: Revenue by Branch · Best Sellers · Modifier Revenue · Top Loyalty Customers
- **Audit**: Audit Log

## Luồng tạo đơn (write — tiêu chí thành công)
1 transaction trong `create_order.php`:
`orders` → `order_item` → `order_item_modifier` → `payment` → trừ `ingredient` theo recipe → `loyalty_transaction` → cập nhật `dining_table` → `audit_log`.
Áp dụng snapshot giá (Price Integrity): lưu `unit_price` và `price_delta_at_sale` tại thời điểm bán.

## Tiêu chí hoàn thành
- Đăng nhập được bằng 7 staff trong sample data, vào đúng dashboard theo role.
- Mọi màn trong sitemap đều mở được và hiển thị dữ liệu thật từ DB.
- Tạo được 1 đơn hàng mới và thấy nó xuất hiện ở Prep Queue / Order History.
- Chạy được trực tiếp trên XAMPP với database hiện tại, không cần build tool.

## ⚠️ Lưu ý mâu thuẫn cần xác nhận
"Toàn bộ sitemap" nhưng chỉ "1 luồng ghi" → các màn vốn là thao tác ghi
(Stock Adjustments, Voids & Refunds, Promotions Create/Edit, Menu CRUD, Clock In/Out, Shift Close)
sẽ làm **read-only trước**, ghi sau. Cần xác nhận trước khi code.

# Danh sách các câu truy vấn SQL (SQL Queries List)

Tài liệu này tổng hợp toàn bộ các câu truy vấn SQL được sử dụng trong hệ thống **Coffee Shop Chain POS**, phân theo vai trò và Use Case theo tài liệu DBA.

> **Phân quyền vai trò:** `Admin` · `StoreManager` · `Barista` (Staff)
>
> **Lưu ý schema:** `order_status` chỉ có hai giá trị: `'Completed'` và `'Cancelled'` (thanh toán ngay tại quầy — không có trạng thái `Pending`/`Preparing`/`Paid`).
> Bảng `promotion` có cột `location_id` nullable: `NULL` = toàn chuỗi, số = chi nhánh cụ thể.

---

## 📌 Mục lục

1. [Use Cases chính (UC1 – UC9)](#1-use-cases-chính-uc1--uc9)
2. [Truy vấn xác thực & đăng nhập (auth.php)](#2-truy-vấn-xác-thực--đăng-nhập-authphp)
3. [Truy vấn thực đơn & Modifier (menu.php)](#3-truy-vấn-thực-đơn--modifier-menuphp)
4. [Truy vấn kho hàng (inventory.php & low_stock.php)](#4-truy-vấn-kho-hàng-inventoryphp--low_stockphp)
5. [Truy vấn báo cáo & phân tích doanh số](#5-truy-vấn-báo-cáo--phân-tích-doanh-số)
6. [Truy vấn nhân viên (staff.php)](#6-truy-vấn-nhân-viên-staffphp)
7. [Truy vấn khuyến mãi (promotions.php)](#7-truy-vấn-khuyến-mãi-promotionsphp)
8. [Truy vấn loyalty khách hàng (loyalty_balance.php)](#8-truy-vấn-loyalty-khách-hàng-loyalty_balancephp)
9. [Truy vấn lịch sử đơn hàng (order_history.php)](#9-truy-vấn-lịch-sử-đơn-hàng-order_historyphp)
10. [Truy vấn nhật ký hệ thống (audit_log.php)](#10-truy-vấn-nhật-ký-hệ-thống-audit_logphp)

---

## 1. Use Cases chính (UC1 – UC9)

*Các câu truy vấn này được lưu tại [sql/03_queries.sql](sql/03_queries.sql).*

---

### UC1: Xem hàng đợi pha chế (CHỈ BARISTA)

* **Quyền:** Barista — chỉ chi nhánh mình.
* **Mô tả:** Lấy danh sách đơn hàng hôm nay kèm modifier đã chọn, gộp thành chuỗi. Hệ thống thanh toán ngay tại quầy nên không có trạng thái hàng đợi riêng — prep queue hiển thị các đơn `Completed` trong ngày.
* **Kỹ thuật:** `LEFT JOIN` + `GROUP_CONCAT` + `GROUP BY`.

```sql
SELECT
    o.order_id,
    o.order_date,
    mi.item_name,
    oi.quantity,
    GROUP_CONCAT(
        mo.option_name
        ORDER BY mg.group_name
        SEPARATOR ', '
    )                       AS customizations,
    o.order_status
FROM   orders o
JOIN   order_item oi              ON oi.order_id       = o.order_id
JOIN   menu_item  mi              ON mi.item_id        = oi.item_id
LEFT JOIN order_item_modifier oim ON oim.order_item_id = oi.order_item_id
LEFT JOIN modifier_option mo      ON mo.option_id      = oim.option_id
LEFT JOIN modifier_group  mg      ON mg.group_id       = mo.group_id
WHERE  o.location_id   = ?
  AND  DATE(o.order_date) = CURDATE()
GROUP BY oi.order_item_id, o.order_id, o.order_date,
         mi.item_name, oi.quantity, o.order_status
ORDER BY o.order_date ASC;
```

---

### UC2: Nguyên liệu có nguy cơ hết hàng (StoreManager / Admin)

* **Quyền:** StoreManager — chỉ chi nhánh mình; Admin — toàn chuỗi (bỏ filter `location_id`).
* **Mô tả:** Tìm nguyên liệu có tồn kho dưới ngưỡng cảnh báo.
* **Kỹ thuật:** Filter trực tiếp trên bảng `ingredient`.

```sql
-- Chi nhánh (StoreManager):
SELECT name, stock_level, low_stock_threshold, unit
FROM   ingredient
WHERE  location_id  = ?
  AND  stock_level  < low_stock_threshold
ORDER BY (low_stock_threshold - stock_level) DESC;

-- Toàn chuỗi (Admin — dùng trong chain_dashboard.php):
SELECT COUNT(*) AS low_stock_count
FROM   ingredient
WHERE  stock_level < low_stock_threshold;
```

---

### UC3: Doanh thu theo Modifier Option (Admin / StoreManager)

* **Quyền:** Admin — toàn chuỗi; StoreManager — lọc thêm `o.location_id = ?`.
* **Mô tả:** Tính doanh thu thặng dư từ các tùy chọn đính kèm (size, milk, add-on).
* **Kỹ thuật:** Aggregation trên bảng junction M:N.

```sql
SELECT
    mg.group_name,
    mo.option_name,
    COUNT(*)                                       AS times_chosen,
    SUM(oim.price_delta_at_sale * oi.quantity)     AS extra_revenue
FROM   order_item_modifier oim
JOIN   modifier_option mo ON mo.option_id      = oim.option_id
JOIN   modifier_group  mg ON mg.group_id       = mo.group_id
JOIN   order_item      oi ON oi.order_item_id  = oim.order_item_id
JOIN   orders          o  ON o.order_id        = oi.order_id
WHERE  o.order_status = 'Completed'
  AND  o.order_date  >= DATE_FORMAT(CURDATE(), '%Y-%m-01')
  -- AND o.location_id = ?   -- thêm dòng này cho StoreManager
GROUP BY mo.option_id, mg.group_name, mo.option_name
ORDER BY extra_revenue DESC;
```

---

### UC4: Sản phẩm bán chạy nhất (Admin / StoreManager)

* **Quyền:** Admin — toàn chuỗi; StoreManager — lọc thêm `o.location_id = ?`.
* **Mô tả:** Báo cáo các món bán chạy nhất, có thể lọc theo kỳ.
* **Kỹ thuật:** `JOIN` + `GROUP BY` + `ORDER BY`.

```sql
SELECT
    mi.item_name,
    SUM(oi.quantity)  AS quantity_sold,
    SUM(oi.subtotal)  AS total_revenue
FROM   order_item oi
JOIN   orders    o  ON o.order_id  = oi.order_id
JOIN   menu_item mi ON mi.item_id  = oi.item_id
WHERE  o.order_status = 'Completed'
  -- AND o.location_id = ?   -- thêm cho StoreManager
GROUP BY mi.item_id, mi.item_name
ORDER BY quantity_sold DESC;
```

---

### UC5: Kiểm tra toàn vẹn giá bán (Admin / StoreManager)

* **Quyền:** Admin — toàn chuỗi; StoreManager — lọc thêm `o.location_id`.
* **Mô tả:** Phát hiện chênh lệch giữa giá bán lịch sử (`unit_price` snapshot) và giá niêm yết hiện tại.
* **Kỹ thuật:** Multi-table join + filter chênh lệch.

```sql
SELECT
    o.order_id,
    o.order_date,
    mi.item_name,
    oi.unit_price                    AS price_charged,
    mi.base_price                    AS current_menu_price,
    (mi.base_price - oi.unit_price)  AS difference
FROM   order_item oi
JOIN   orders    o  ON o.order_id = oi.order_id
JOIN   menu_item mi ON mi.item_id = oi.item_id
WHERE  oi.unit_price <> mi.base_price
ORDER BY o.order_date;
```

---

### UC6: Số dư điểm Loyalty (Admin / StoreManager / Barista)

* **Quyền:** Admin và StoreManager — danh sách top khách; Barista — tra cứu theo SĐT.
* **Mô tả:** Top khách hàng có điểm loyalty cao nhất, tính qua VIEW.
* **Kỹ thuật:** VIEW `v_customer_loyalty_balance` + `LEFT JOIN`.

```sql
-- Top khách theo điểm (Admin / StoreManager):
SELECT name, phone, points_balance
FROM   v_customer_loyalty_balance
ORDER BY points_balance DESC
LIMIT 50;

-- Tra cứu theo SĐT (Barista / POS):
SELECT c.name, c.phone, v.points_balance
FROM   customer c
JOIN   v_customer_loyalty_balance v ON v.customer_id = c.customer_id
WHERE  c.phone = ?;
```

---

### UC7: Doanh thu theo chi nhánh — so sánh toàn chuỗi (CHỈ ADMIN)

* **Quyền:** CHỈ ADMIN.
* **Mô tả:** So sánh doanh thu và số đơn giữa các chi nhánh.
* **Kỹ thuật:** `JOIN` + `GROUP BY` + `ORDER BY`.

```sql
SELECT
    l.location_id,
    l.name                  AS location_name,
    COUNT(o.order_id)       AS order_count,
    SUM(o.total_amount)     AS total_revenue
FROM   orders o
JOIN   location l ON l.location_id = o.location_id
WHERE  o.order_status = 'Completed'
GROUP BY l.location_id, l.name
ORDER BY total_revenue DESC;
```

---

### UC8: Tạo đơn hàng mới (CHỈ BARISTA)

* **Quyền:** CHỈ BARISTA — tạo đơn hàng mới tại chi nhánh mình.
* **Mô tả:** Luồng tạo đơn đầy đủ bọc trong **Database Transaction**. Bao gồm extend: áp dụng khuyến mãi, áp dụng điểm loyalty.

#### A. Kiểm tra món hợp lệ

```sql
SELECT item_name, base_price, is_available
FROM   menu_item
WHERE  item_id = ?;
```

#### B. Lấy phụ phí modifier

```sql
SELECT option_name, price_delta
FROM   modifier_option
WHERE  option_id = ?;
```

#### C. Tìm khuyến mãi đang kích hoạt (`<<extend>>`)

```sql
-- Lấy promo áp dụng cho chi nhánh (chi nhánh cụ thể ưu tiên, sau đó toàn chuỗi):
SELECT promotion_id, name, discount_type, discount_value
FROM   promotion
WHERE  is_active = 1
  AND  CURDATE() BETWEEN start_date AND end_date
  AND  (location_id IS NULL OR location_id = ?)
LIMIT 1;
```

#### D. Kiểm tra điểm loyalty khách (`<<extend>>`)

```sql
SELECT customer_id, name, loyalty_points
FROM   customer
WHERE  phone = ?;
```

#### E. Tạo đơn hàng

```sql
INSERT INTO orders (location_id, staff_id, customer_id, order_type, order_status, total_amount)
VALUES (?, ?, ?, ?, 'Completed', ?);
```

#### F. Thêm món vào đơn (snapshot `unit_price`)

```sql
INSERT INTO order_item (order_id, item_id, quantity, unit_price, subtotal)
VALUES (?, ?, ?, ?, ?);
```

#### G. Thêm modifier đã chọn (snapshot `price_delta_at_sale`)

```sql
INSERT INTO order_item_modifier (order_item_id, option_id, price_delta_at_sale)
VALUES (?, ?, ?);
```

#### H. Ghi nhận thanh toán (`<<include>>`)

```sql
INSERT INTO payment (order_id, payment_method, amount_paid)
VALUES (?, ?, ?);
```

#### I. Ghi nhận khuyến mãi áp dụng (`<<extend>>`)

```sql
INSERT INTO order_promotion (order_id, promotion_id, amount_discounted)
VALUES (?, ?, ?);
```

#### J. Ghi nhận tích / đổi điểm loyalty (`<<extend>>`)

```sql
-- Tích điểm (earn — floor(total / 1000) pts):
INSERT INTO loyalty_transaction (customer_id, order_id, points_change, txn_type)
VALUES (?, ?, ?, 'earn');

-- Đổi điểm (redeem — 1 pt = 1,000đ):
INSERT INTO loyalty_transaction (customer_id, order_id, points_change, txn_type)
VALUES (?, ?, ?, 'redeem');

-- Cập nhật cached balance:
UPDATE customer
SET    loyalty_points = loyalty_points + ?
WHERE  customer_id = ?;
```

#### K. Ghi audit log

```sql
INSERT INTO audit_log (staff_id, action_type, table_affected, record_id, details)
VALUES (?, 'CREATE', 'orders', ?, ?);
```

---

### UC9: Xác nhận hủy đơn (StoreManager — cùng chi nhánh)

* **Quyền:** Barista khởi tạo hủy → xác nhận mã PIN chi nhánh (`cancel_pin`) → cập nhật trạng thái.
* **Mô tả:** Cập nhật `order_status` sang `Cancelled` và ghi audit log.

```sql
-- Kiểm tra mã hủy đơn của chi nhánh:
SELECT cancel_pin FROM location WHERE location_id = ?;

-- Cập nhật trạng thái hủy:
UPDATE orders
SET    order_status = 'Cancelled'
WHERE  order_id    = ?
  AND  location_id = ?
  AND  order_status = 'Completed';

-- Ghi audit log:
INSERT INTO audit_log (staff_id, action_type, table_affected, record_id, details)
VALUES (?, 'CANCEL', 'orders', ?, ?);
```

---

## 2. Truy vấn xác thực & đăng nhập (auth.php)

### A. Đăng nhập bằng số điện thoại

```sql
SELECT s.staff_id, s.location_id, s.name, s.role, s.password_hash,
       l.name AS location_name
FROM   staff s
JOIN   location l ON s.location_id = l.location_id
WHERE  s.phone = ?;
```

### B. Kiểm tra phiên hiện tại (auth.php?action=me)

```sql
SELECT s.staff_id, s.location_id, s.name, s.role, l.name AS location_name
FROM   staff s
JOIN   location l ON s.location_id = l.location_id
WHERE  s.staff_id = ?;
```

### C. Đặt lại mật khẩu mặc định (setup_db.php)

```sql
-- Cập nhật password_hash cho toàn bộ nhân viên:
UPDATE staff
SET    password_hash = ?
WHERE  staff_id = ?;
```

---

## 3. Truy vấn thực đơn & Modifier (menu.php)

### A. Danh sách danh mục

```sql
SELECT category_id, category_name FROM menu_category ORDER BY category_id;
```

### B. Danh sách tất cả món (kể cả ẩn — cho Manager/Admin)

```sql
SELECT item_id, category_id, item_name, base_price, is_available
FROM   menu_item
ORDER BY item_name;
-- Thêm WHERE is_available = 1 cho POS (chỉ hiện món đang bán)
```

### C. Liên kết modifier group với món

```sql
SELECT mim.item_id, mg.group_id, mg.group_name, mg.selection_type, mg.is_required
FROM   menu_item_modifier mim
JOIN   modifier_group mg ON mim.group_id = mg.group_id
ORDER BY mim.item_id, mg.group_id;
```

### D. Chi tiết modifier option

```sql
SELECT option_id, group_id, option_name, price_delta
FROM   modifier_option
ORDER BY group_id, option_id;
```

### E. Thêm món mới

```sql
INSERT INTO menu_item (category_id, item_name, base_price, is_available)
VALUES (?, ?, ?, 1);
```

### F. Cập nhật món

```sql
UPDATE menu_item
SET    category_id = ?, item_name = ?, base_price = ?, is_available = ?
WHERE  item_id = ?;
```

### G. Ẩn / Hiện món (toggle)

```sql
UPDATE menu_item SET is_available = 1 - is_available WHERE item_id = ?;
```

---

## 4. Truy vấn kho hàng (inventory.php & low_stock.php)

### A. Danh sách nguyên liệu của chi nhánh

```sql
SELECT ingredient_id, name, stock_level, unit, low_stock_threshold
FROM   ingredient
WHERE  location_id = ?
ORDER BY ingredient_id;
```

### B. Điều chỉnh tồn kho — nhập kho thêm (add)

```sql
UPDATE ingredient
SET    stock_level = stock_level + ?
WHERE  ingredient_id = ? AND location_id = ?;
```

### C. Điều chỉnh tồn kho — xuất kho hao phí (reduce)

```sql
UPDATE ingredient
SET    stock_level = GREATEST(0, stock_level - ?)
WHERE  ingredient_id = ? AND location_id = ?;
```

### D. Thiết lập lại số lượng (override)

```sql
UPDATE ingredient
SET    stock_level = ?
WHERE  ingredient_id = ? AND location_id = ?;
```

### E. Thêm nguyên liệu mới vào chi nhánh

```sql
INSERT INTO ingredient (location_id, name, stock_level, unit, low_stock_threshold)
VALUES (?, ?, ?, ?, ?);
```

### F. Ghi audit log điều chỉnh kho

```sql
INSERT INTO audit_log (staff_id, action_type, table_affected, record_id, details)
VALUES (?, 'UPDATE', 'ingredient', ?, ?);
```

---

## 5. Truy vấn báo cáo & phân tích doanh số

### A. Doanh thu theo giờ trong ngày — `period=day` (sales_by_hour.php)

```sql
SELECT HOUR(o.order_date)                              AS period_key,
       CONCAT(LPAD(HOUR(o.order_date), 2, '0'), ':00') AS period_label,
       COUNT(o.order_id)                               AS order_count,
       SUM(o.total_amount)                             AS total_revenue
FROM   orders o
WHERE  o.location_id  = ?
  AND  o.order_status = 'Completed'
  AND  DATE(o.order_date) = CURDATE()
GROUP BY period_key, period_label
ORDER BY period_key ASC;
```

### B. Doanh thu theo tuần — `period=week` (sales_by_hour.php)

```sql
SELECT YEARWEEK(o.order_date, 1)                                    AS period_key,
       CONCAT('Tuần ', WEEK(o.order_date, 1), '/', YEAR(o.order_date)) AS period_label,
       COUNT(o.order_id)                                            AS order_count,
       SUM(o.total_amount)                                          AS total_revenue
FROM   orders o
WHERE  o.location_id  = ?
  AND  o.order_status = 'Completed'
GROUP BY period_key, period_label
ORDER BY period_key ASC;
```

### C. Doanh thu theo tháng — `period=month` (sales_by_hour.php)

```sql
SELECT DATE_FORMAT(o.order_date, '%Y-%m')  AS period_key,
       DATE_FORMAT(o.order_date, '%m/%Y')  AS period_label,
       COUNT(o.order_id)                   AS order_count,
       SUM(o.total_amount)                 AS total_revenue
FROM   orders o
WHERE  o.location_id  = ?
  AND  o.order_status = 'Completed'
GROUP BY period_key, period_label
ORDER BY period_key ASC;
-- Admin (branch_daily_revenue.php): bỏ WHERE location_id để lấy toàn chuỗi
```

### D. Doanh thu theo món của chi nhánh (sales_by_item.php)

```sql
SELECT mi.item_name,
       SUM(oi.quantity) AS quantity_sold,
       SUM(oi.subtotal) AS total_revenue
FROM   order_item oi
JOIN   orders    o  ON oi.order_id = o.order_id
JOIN   menu_item mi ON oi.item_id  = mi.item_id
WHERE  o.location_id  = ?
  AND  o.order_status = 'Completed'
GROUP BY mi.item_id, mi.item_name
ORDER BY total_revenue DESC;
```

### E. Doanh thu theo món toàn chuỗi (item_revenue.php — Admin)

```sql
SELECT mi.item_name,
       SUM(oi.quantity) AS quantity_sold,
       SUM(oi.subtotal) AS total_revenue
FROM   order_item oi
JOIN   orders    o  ON oi.order_id = o.order_id
JOIN   menu_item mi ON oi.item_id  = mi.item_id
WHERE  o.order_status = 'Completed'
GROUP BY mi.item_id, mi.item_name
ORDER BY total_revenue DESC;
```

### F. Doanh thu phân bổ theo chi nhánh toàn chuỗi (revenue_by_branch.php — Admin)

```sql
SELECT l.location_id,
       l.name               AS location_name,
       SUM(o.total_amount)  AS revenue,
       COUNT(o.order_id)    AS order_count
FROM   orders o
JOIN   location l ON o.location_id = l.location_id
WHERE  o.order_status = 'Completed'
GROUP BY l.location_id, l.name
ORDER BY revenue DESC;
```

### G. Thống kê tổng quan chuỗi (chain_dashboard.php — Admin)

```sql
SELECT
    SUM(o.total_amount)                         AS total_revenue,
    COUNT(o.order_id)                           AS total_orders,
    (SELECT COUNT(*)
     FROM   ingredient
     WHERE  stock_level < low_stock_threshold)  AS low_stock_count
FROM   orders o
WHERE  o.order_status = 'Completed';
```

---

## 6. Truy vấn nhân viên (staff.php)

### A. Danh sách nhân viên theo chi nhánh

```sql
-- Admin: xem tất cả vai trò
SELECT s.staff_id, s.name, s.role, s.phone, s.is_active, l.name AS location_name
FROM   staff s
JOIN   location l ON l.location_id = s.location_id
WHERE  s.location_id = ?
ORDER BY s.role, s.name;

-- StoreManager: không xem được Admin
SELECT s.staff_id, s.name, s.role, s.phone, s.is_active, l.name AS location_name
FROM   staff s
JOIN   location l ON l.location_id = s.location_id
WHERE  s.location_id = ?
  AND  s.role != 'Admin'
ORDER BY s.role, s.name;
```

### B. Tạo nhân viên mới

```sql
-- Admin: tạo mọi vai trò; StoreManager: chỉ tạo Barista
INSERT INTO staff (location_id, name, role, phone, is_active, password_hash)
VALUES (?, ?, ?, ?, 1, ?);
-- password_hash = bcrypt(first_name_lower + '123')
```

### C. Cập nhật thông tin nhân viên

```sql
UPDATE staff SET name = ?, phone = ?, role = ? WHERE staff_id = ?;
```

### D. Vô hiệu hóa / kích hoạt tài khoản (toggle)

```sql
UPDATE staff SET is_active = 1 - is_active WHERE staff_id = ?;
```

### E. Đặt lại mật khẩu về mặc định

```sql
UPDATE staff SET password_hash = ? WHERE staff_id = ?;
-- password_hash mới = bcrypt(first_name_lower + '123')
```

---

## 7. Truy vấn khuyến mãi (promotions.php)

> `location_id IS NULL` = toàn chuỗi; `location_id = n` = chi nhánh cụ thể.

### A. Lấy khuyến mãi đang kích hoạt hôm nay (POS — tất cả vai trò)

```sql
SELECT promotion_id, name, discount_type, discount_value
FROM   promotion
WHERE  is_active = 1
  AND  CURDATE() BETWEEN start_date AND end_date
  AND  (location_id IS NULL OR location_id = ?)
LIMIT 1;
```

### B. Danh sách khuyến mãi (Admin — toàn bộ)

```sql
SELECT p.promotion_id, p.name, p.discount_type, p.discount_value,
       p.start_date, p.end_date, p.is_active, p.location_id,
       COALESCE(l.name, 'Toàn chuỗi') AS scope_label
FROM   promotion p
LEFT JOIN location l ON l.location_id = p.location_id
ORDER BY p.start_date DESC;
```

### C. Danh sách khuyến mãi (StoreManager — chi nhánh mình + toàn chuỗi)

```sql
SELECT p.promotion_id, p.name, p.discount_type, p.discount_value,
       p.start_date, p.end_date, p.is_active, p.location_id,
       CASE WHEN p.location_id IS NULL THEN 'Toàn chuỗi' ELSE 'Chi nhánh' END AS scope_label
FROM   promotion p
WHERE  p.location_id = ? OR p.location_id IS NULL
ORDER BY p.start_date DESC;
```

### D. Tạo khuyến mãi

```sql
INSERT INTO promotion (name, discount_type, discount_value, start_date, end_date, is_active, location_id)
VALUES (?, ?, ?, ?, ?, ?, ?);
-- Admin: location_id = NULL (toàn chuỗi) hoặc số chi nhánh
-- StoreManager: location_id = own location_id (bắt buộc)
```

### E. Cập nhật khuyến mãi

```sql
UPDATE promotion
SET    name = ?, discount_type = ?, discount_value = ?,
       start_date = ?, end_date = ?, is_active = ?, location_id = ?
WHERE  promotion_id = ?;
-- StoreManager chỉ được sửa promotion có location_id = own location_id
```

### F. Xóa / vô hiệu hóa khuyến mãi

```sql
-- Nếu có đơn hàng đã dùng → vô hiệu hóa:
UPDATE promotion SET is_active = 0 WHERE promotion_id = ?;

-- Nếu chưa có đơn hàng nào → xóa hẳn:
DELETE FROM promotion WHERE promotion_id = ?;

-- Kiểm tra đơn dùng promo:
SELECT COUNT(*) AS cnt FROM order_promotion WHERE promotion_id = ?;
```

---

## 8. Truy vấn loyalty khách hàng (loyalty_balance.php)

### A. Top khách hàng theo điểm

```sql
SELECT customer_id, name, phone, points_balance
FROM   v_customer_loyalty_balance
ORDER BY points_balance DESC
LIMIT 50;
```

### B. Tra cứu theo số điện thoại

```sql
SELECT v.customer_id, v.name, v.phone, v.points_balance
FROM   v_customer_loyalty_balance v
WHERE  v.phone = ?;
```

---

## 9. Truy vấn lịch sử đơn hàng (order_history.php)

### A. Lịch sử đơn — chi nhánh (StoreManager / Barista)

```sql
SELECT o.order_id, o.order_date, o.order_type, o.order_status, o.total_amount,
       s.name AS staff_name, c.name AS customer_name
FROM   orders o
JOIN   staff    s ON s.staff_id    = o.staff_id
LEFT JOIN customer c ON c.customer_id = o.customer_id
WHERE  o.location_id = ?
ORDER BY o.order_date DESC
LIMIT 100;
```

### B. Lịch sử đơn — toàn chuỗi (CHỈ ADMIN)

```sql
SELECT o.order_id, o.order_date, o.order_type, o.order_status, o.total_amount,
       s.name AS staff_name, c.name AS customer_name, l.name AS location_name
FROM   orders o
JOIN   staff    s ON s.staff_id    = o.staff_id
JOIN   location l ON l.location_id = o.location_id
LEFT JOIN customer c ON c.customer_id = o.customer_id
ORDER BY o.order_date DESC
LIMIT 200;
```

### C. Chi tiết một đơn hàng (order_details.php)

```sql
-- Thông tin đơn:
SELECT o.order_id, o.order_date, o.order_type, o.order_status, o.total_amount,
       s.name AS staff_name, l.name AS location_name,
       c.name AS customer_name,
       COALESCE(SUM(op.amount_discounted), 0)            AS promo_discount,
       COALESCE(
           (SELECT SUM(lt.points_change) * 1000
            FROM loyalty_transaction lt
            WHERE lt.order_id = o.order_id AND lt.txn_type = 'redeem'), 0
       )                                                 AS loyalty_discount,
       COALESCE(
           (SELECT SUM(lt.points_change)
            FROM loyalty_transaction lt
            WHERE lt.order_id = o.order_id AND lt.txn_type = 'earn'), 0
       )                                                 AS points_earned
FROM   orders o
JOIN   staff    s  ON s.staff_id    = o.staff_id
JOIN   location l  ON l.location_id = o.location_id
LEFT JOIN customer    c  ON c.customer_id  = o.customer_id
LEFT JOIN order_promotion op ON op.order_id = o.order_id
WHERE  o.order_id = ?
GROUP BY o.order_id;

-- Các món trong đơn + modifier:
SELECT oi.order_item_id, mi.item_name, oi.quantity, oi.unit_price, oi.subtotal,
       GROUP_CONCAT(mo.option_name ORDER BY mg.group_name SEPARATOR ', ') AS customizations
FROM   order_item oi
JOIN   menu_item mi ON mi.item_id = oi.item_id
LEFT JOIN order_item_modifier oim ON oim.order_item_id = oi.order_item_id
LEFT JOIN modifier_option mo      ON mo.option_id      = oim.option_id
LEFT JOIN modifier_group  mg      ON mg.group_id       = mo.group_id
WHERE  oi.order_id = ?
GROUP BY oi.order_item_id, mi.item_name, oi.quantity, oi.unit_price, oi.subtotal;
```

---

## 10. Truy vấn nhật ký hệ thống (audit_log.php)

### A. 100 hành động gần nhất (CHỈ ADMIN)

```sql
SELECT al.log_id, al.action_timestamp, al.action_type,
       al.table_affected, al.record_id, al.details,
       s.name  AS staff_name,
       s.role  AS staff_role,
       l.name  AS location_name
FROM   audit_log al
JOIN   staff    s ON s.staff_id    = al.staff_id
JOIN   location l ON l.location_id = s.location_id
ORDER BY al.action_timestamp DESC
LIMIT 100;
```

### B. Ghi audit log (pattern chung — dùng trong mọi API write)

```sql
INSERT INTO audit_log (staff_id, action_type, table_affected, record_id, details)
VALUES (?, ?, ?, ?, ?);
-- action_type: 'CREATE' | 'UPDATE' | 'DELETE' | 'CANCEL' | 'LOGIN'
```

# Danh sách các câu truy vấn SQL (SQL Queries List)

Tài liệu này tổng hợp toàn bộ các câu truy vấn SQL được sử dụng trong hệ thống **Coffee Shop Chain POS**, bao gồm các câu truy vấn Use Cases chính, luồng Transaction tạo đơn hàng và các câu lệnh nghiệp vụ báo cáo, vận hành hệ thống.

---

## 📌 Mục lục
1. [Các Truy Vấn Use Cases Chính (UC1 - UC6)](#1-các-truy-vấn-use-cases-chính-uc1---uc6)
2. [Truy Vấn Luồng Giao Dịch Tạo Đơn Hàng (create_order.php)](#2-truy-vấn-luồng-giao-dịch-tạo-đơn-hàng-create_orderphp)
3. [Truy Vấn Xác Thực & Đăng Nhập (auth.php)](#3-truy-vấn-xác-thực--đăng-nhập-authphp)
4. [Truy Vấn Lấy Dữ Liệu Thực Đơn & Modifier (menu.php)](#4-truy-vấn-lấy-dữ-liệu-thực-đơn--modifier-menuphp)
5. [Truy Vấn Nghiệp Vụ Kho Hàng (inventory.php & low_stock.php)](#5-truy-vấn-nghiệp-vụ-kho-hàng-inventoryphp--low_stockphp)
6. [Truy Vấn Báo Cáo & Phân Tích Doanh Số](#6-truy-vấn-báo-cáo--phân-tích-doanh-số)

---

## 1. Các Truy Vấn Use Cases Chính (UC1 - UC6)
*Các câu truy vấn này được lưu tại file [sql/03_queries.sql](file:///c:/Users/BAN%20AI-02/Downloads/db/Final_INS3060/sql/03_queries.sql).*

### UC1: Hàng đợi pha chế (Prep Queue - Barista)
* **Mô tả:** Lấy danh sách các đơn hàng ở trạng thái `Pending` hoặc `Preparing` kèm theo các tùy chọn tùy biến (modifiers) được gộp lại thành chuỗi.
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
JOIN   order_item oi             ON oi.order_id       = o.order_id
JOIN   menu_item  mi             ON mi.item_id        = oi.item_id
LEFT JOIN order_item_modifier oim ON oim.order_item_id = oi.order_item_id
LEFT JOIN modifier_option mo      ON mo.option_id      = oim.option_id
LEFT JOIN modifier_group  mg      ON mg.group_id       = mo.group_id
WHERE  o.location_id   = ?
  AND  o.order_status IN ('Pending', 'Preparing')
GROUP BY oi.order_item_id, o.order_id, o.order_date,
         mi.item_name, oi.quantity, o.order_status
ORDER BY o.order_date ASC;
```

### UC2: Món ăn có nguy cơ ngừng phục vụ (Low Stock - Store Manager)
* **Mô tả:** Tìm kiếm những món ăn có nguyên liệu cấu thành nằm dưới ngưỡng cảnh báo hết hàng tại chi nhánh.
* **Kỹ thuật:** Truy vấn con tương quan với `EXISTS`.
```sql
SELECT
    mi.item_id,
    mi.item_name
FROM   menu_item mi
WHERE  mi.is_available = 1
  AND  EXISTS (
           SELECT 1
           FROM   recipe r
           JOIN   ingredient i ON i.ingredient_id = r.ingredient_id
           WHERE  r.item_id      = mi.item_id
             AND  i.location_id  = ?
             AND  i.stock_level  < i.low_stock_threshold
       )
ORDER BY mi.item_name;
```

### UC3: Doanh thu theo Modifier Option (Admin)
* **Mô tả:** Tính toán doanh thu thặng dư kiếm được từ các tùy chọn đính kèm (size lớn, thêm shot espresso, sữa yến mạch,...) trong tháng hiện tại.
* **Kỹ thuật:** Gom nhóm trên bảng liên kết M:N.
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
WHERE  o.order_status = 'Paid'
  AND  o.order_date  >= DATE_FORMAT(CURDATE(), '%Y-%m-01')
GROUP BY mo.option_id, mg.group_name, mo.option_name
ORDER BY extra_revenue DESC;
```

### UC4: Sản phẩm bán chạy doanh số cao (Admin)
* **Mô tả:** Báo cáo các món hàng bán chạy nhất tháng có tổng số lượng bán vượt mức chỉ định.
* **Kỹ thuật:** `GROUP BY ... HAVING`.
```sql
SELECT
    mi.item_name,
    SUM(oi.quantity)  AS units_sold,
    SUM(oi.subtotal)  AS revenue
FROM   order_item oi
JOIN   orders    o  ON o.order_id  = oi.order_id
JOIN   menu_item mi ON mi.item_id  = oi.item_id
WHERE  o.order_status = 'Paid'
  AND  o.order_date  >= DATE_FORMAT(CURDATE(), '%Y-%m-01')
GROUP BY mi.item_id, mi.item_name
HAVING SUM(oi.quantity) >= 1        -- Ngưỡng demo, thực tế sản xuất > 500
ORDER BY units_sold DESC;
```

### UC5: Kiểm tra tính toàn vẹn giá bán (Price Integrity - Admin)
* **Mô tả:** So sánh giá bán thực tế ghi nhận trong hóa đơn lịch sử với giá bán niêm yết hiện tại của thực đơn để phát hiện chênh lệch giá.
* **Kỹ thuật:** Multi-table join.
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

### UC6: Báo cáo số dư điểm Loyalty của khách hàng (Admin/Marketing)
* **Mô tả:** Lấy danh sách 10 khách hàng có số dư điểm loyalty cao nhất từ View tính điểm dựa trên sổ cái giao dịch.
* **Kỹ thuật:** Truy vấn từ View `v_customer_loyalty_balance`.
```sql
SELECT
    name,
    phone,
    points_balance
FROM  v_customer_loyalty_balance
ORDER BY points_balance DESC
LIMIT 10;
```

---

## 2. Truy Vấn Luồng Giao Dịch Tạo Đơn Hàng (create_order.php)
*Toàn bộ luồng tạo đơn hàng dưới đây được bọc trong một **Database Transaction** (`$conn->begin_transaction()`).*

### A. Kiểm tra tính hợp lệ của món ăn
```sql
SELECT item_name, base_price, is_available 
FROM   menu_item 
WHERE  item_id = ?;
```

### B. Lấy giá tiền phụ phí Modifier Option
```sql
SELECT option_name, price_delta 
FROM   modifier_option 
WHERE  option_id = ?;
```

### C. Kiểm tra điểm tích lũy của khách hàng
```sql
SELECT loyalty_points 
FROM   customer 
WHERE  customer_id = ?;
```

### D. Tìm kiếm khuyến mãi đang kích hoạt
```sql
SELECT promotion_id, name, discount_type, discount_value 
FROM   promotion 
WHERE  is_active = 1 
  AND  CURDATE() BETWEEN start_date AND end_date 
ORDER BY promotion_id LIMIT 1;
```

### E. Thêm mới đơn hàng vào bảng `orders`
```sql
INSERT INTO orders (location_id, staff_id, customer_id, table_id, order_type, order_status, total_amount)
VALUES (?, ?, ?, ?, ?, ?, ?);
```

### F. Thêm món ăn vào bảng `order_item` (Lưu snapshot giá gốc `unit_price`)
```sql
INSERT INTO order_item (order_id, item_id, quantity, unit_price, subtotal)
VALUES (?, ?, ?, ?, ?);
```

### G. Thêm tùy biến vào bảng `order_item_modifier` (Lưu snapshot phụ phí `price_delta_at_sale`)
```sql
INSERT INTO order_item_modifier (order_item_id, option_id, price_delta_at_sale)
VALUES (?, ?, ?);
```

### H. Khấu trừ tồn kho nguyên liệu (Công thức món ăn chính)
* **Lấy nguyên liệu từ công thức:**
  ```sql
  SELECT ingredient_id, quantity_required 
  FROM   recipe 
  WHERE  item_id = ?;
  ```
* **Cập nhật trừ kho của chi nhánh:**
  ```sql
  UPDATE ingredient 
  SET    stock_level = stock_level - ? 
  WHERE  ingredient_id = ? AND location_id = ?;
  ```

### I. Khấu trừ tồn kho nguyên liệu (Công thức của các Modifier Option)
* **Lấy nguyên liệu phụ thêm:**
  ```sql
  SELECT ingredient_id, quantity_required 
  FROM   modifier_recipe 
  WHERE  option_id = ?;
  ```
* **Cập nhật trừ kho chi nhánh:**
  ```sql
  UPDATE ingredient 
  SET    stock_level = stock_level - ? 
  WHERE  ingredient_id = ? AND location_id = ?;
  ```

### J. Thêm thông tin thanh toán
```sql
INSERT INTO payment (order_id, payment_method, amount_paid)
VALUES (?, ?, ?);
```

### K. Lưu thông tin khuyến mãi đã áp dụng
```sql
INSERT INTO order_promotion (order_id, promotion_id, amount_discounted)
VALUES (?, ?, ?);
```

### L. Cập nhật tích lũy và sử dụng điểm Loyalty khách hàng
* **Ghi nhận giao dịch quy đổi điểm (Redeem):**
  ```sql
  INSERT INTO loyalty_transaction (customer_id, order_id, points_change, txn_type)
  VALUES (?, ?, ?, 'redeem');
  ```
* **Ghi nhận giao dịch tích điểm mới (Earn):**
  ```sql
  INSERT INTO loyalty_transaction (customer_id, order_id, points_change, txn_type)
  VALUES (?, ?, ?, 'earn');
  ```
* **Cập nhật số dư điểm cached của khách hàng:**
  ```sql
  UPDATE customer 
  SET    loyalty_points = loyalty_points + ? 
  WHERE  customer_id = ?;
  ```

### M. Chuyển trạng thái bàn sang "Occupied" (nếu là Dine-in)
```sql
UPDATE dining_table 
SET    status = 'Occupied' 
WHERE  table_id = ?;
```

### N. Ghi nhật ký hệ thống (Audit Log)
```sql
INSERT INTO audit_log (staff_id, action_type, table_affected, record_id, details)
VALUES (?, 'CREATE_ORDER', 'orders', ?, ?);
```

---

## 3. Truy Vấn Xác Thực & Đăng Nhập (auth.php)

### A. Kiểm tra tài khoản bằng số điện thoại
```sql
SELECT s.staff_id, s.location_id, s.name, s.role, s.password_hash, l.name as location_name 
FROM   staff s
JOIN   location l ON s.location_id = l.location_id
WHERE  s.phone = ?;
```

### B. Khởi tạo mật khẩu mã hóa ban đầu (setup_db.php)
* **Lấy danh sách tất cả nhân viên:**
  ```sql
  SELECT staff_id, name, role FROM staff;
  ```
* **Thêm cột `password_hash` nếu chưa có:**
  ```sql
  ALTER TABLE staff ADD COLUMN password_hash VARCHAR(255) NULL;
  ```
* **Cập nhật mật khẩu mã hóa mới:**
  ```sql
  UPDATE staff 
  SET    password_hash = ? 
  WHERE  staff_id = ? 
    AND  (password_hash IS NULL OR password_hash = '');
  ```

---

## 4. Truy Vấn Lấy Dữ Liệu Thực Đơn & Modifier (menu.php)

### A. Lấy danh sách danh mục món ăn
```sql
SELECT category_id, category_name FROM menu_category ORDER BY category_id;
```

### B. Lấy danh sách món ăn đang phục vụ
```sql
SELECT item_id, category_id, item_name, base_price, is_available 
FROM   menu_item 
ORDER BY item_id;
```

### C. Lấy liên kết nhóm Modifier với các món ăn
```sql
SELECT mim.item_id, mg.group_id, mg.group_name, mg.selection_type, mg.is_required
FROM   menu_item_modifier mim
JOIN   modifier_group mg ON mim.group_id = mg.group_id
ORDER BY mim.item_id, mg.group_id;
```

### D. Lấy chi tiết các tùy chọn Modifier Option
```sql
SELECT option_id, group_id, option_name, price_delta 
FROM   modifier_option 
ORDER BY group_id, option_id;
```

---

## 5. Truy Vấn Nghiệp Vụ Kho Hàng (inventory.php & low_stock.php)

### A. Lấy danh sách nguyên liệu của chi nhánh
```sql
SELECT ingredient_id, name, stock_level, unit, low_stock_threshold 
FROM   ingredient 
WHERE  location_id = ? 
ORDER BY ingredient_id;
```

### B. Cập nhật số lượng kho điều chỉnh thủ công
```sql
UPDATE ingredient 
SET    stock_level = ? 
WHERE  ingredient_id = ?;
```

### C. Kiểm tra nguyên liệu trước khi cập nhật kho
```sql
SELECT name, stock_level, unit 
FROM   ingredient 
WHERE  ingredient_id = ? AND location_id = ?;
```

### D. Ghi Audit Log hành động điều chỉnh kho
```sql
INSERT INTO audit_log (staff_id, action_type, table_affected, record_id, details)
VALUES (?, 'STOCK_ADJUST', 'ingredient', ?, ?);
```

---

## 6. Truy Vấn Báo Cáo & Phân Tích Doanh Số

### A. Báo cáo doanh số theo giờ của chi nhánh (sales_by_hour.php)
```sql
SELECT HOUR(o.order_date) as hour_of_day, 
       COUNT(o.order_id) as order_count, 
       SUM(o.total_amount) as total_revenue
FROM   orders o
WHERE  o.location_id = ? 
  AND  o.order_status = 'Paid'
GROUP BY HOUR(o.order_date)
ORDER BY hour_of_day ASC;
```

### B. Báo cáo doanh số theo món của chi nhánh (sales_by_item.php)
```sql
SELECT mi.item_name, 
       SUM(oi.quantity) as quantity_sold, 
       SUM(oi.subtotal) as total_revenue
FROM   order_item oi
JOIN   orders o ON oi.order_id = o.order_id
JOIN   menu_item mi ON oi.item_id = mi.item_id
WHERE  o.location_id = ? 
  AND  o.order_status = 'Paid'
GROUP BY mi.item_id, mi.item_name
ORDER BY total_revenue DESC;
```

### C. Báo cáo doanh thu phân bổ theo chi nhánh toàn chuỗi (revenue_by_branch.php)
```sql
SELECT l.location_id, l.name as location_name, 
       SUM(o.total_amount) as revenue, 
       COUNT(o.order_id) as order_count
FROM   orders o
JOIN   location l ON o.location_id = l.location_id
WHERE  o.order_status = 'Paid'
GROUP BY l.location_id, l.name
ORDER BY revenue DESC;
```

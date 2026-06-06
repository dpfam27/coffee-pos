# UI → API → SQL Mapping

Tài liệu liên kết từng chức năng giao diện → endpoint API → thao tác SQL tương ứng.

---

## 1. Màn hình POS (`pos.html` / `pos.js`) — Thu ngân / Barista

| Hành động trên UI | Hàm JS | API Endpoint | Use Case (03_queries.sql) | Thao tác SQL |
|---|---|---|---|---|
| Tải trang | `initApp()` | `GET auth.php?action=me` | — | SELECT staff theo session |
| Tải menu | `loadMenu()` | `GET menu.php` | — | SELECT danh mục, món, modifier, option |
| Tải khuyến mãi | `loadActivePromotion()` | `GET promotions.php?active=1` | **UC2** — Fetch today's active promotion | SELECT promotion đang hiệu lực (ưu tiên chi nhánh > toàn chuỗi) |
| Tải lịch sử đơn | `loadOrderHistory()` | `GET order_history.php` | **UC1** — View today's orders (prep queue) | SELECT đơn Completed trong ngày của chi nhánh |
| Click món → chọn modifier | `handleAddItemClick()` | _(local)_ | — | Hiển thị modal cục bộ, không gọi API |
| Thêm vào giỏ | `addToCart()` | _(local)_ | — | Cập nhật state giỏ hàng cục bộ |
| Tìm khách hàng | `searchCustomer()` | `GET customer_search.php?phone=X` | **UC3** — Look up customer loyalty by phone | SELECT customer + points_balance theo SĐT |
| Tạo khách hàng mới | `confirmCreateCustomer()` | `POST customer_search.php` | — | INSERT customer (phone, name, email) |
| Thanh toán | `confirmPayment()` | `POST create_order.php` | — | INSERT orders, order_items, order_item_modifiers, payment, loyalty_transaction; UPDATE customer.loyalty_points; INSERT audit_log |
| Xem hoá đơn | `viewInvoice()` | `GET order_details.php?order_id=X` | **UTILITY** — Order detail with items + modifiers | SELECT order header + line items + customizations |
| Huỷ đơn | `confirmCancelOrder()` | `POST prep_queue.php` | **UC9** — Cancel order with branch PIN validation | Validate PIN → UPDATE order_status='Cancelled' → INSERT audit_log |
| Đăng xuất | _(logout btn)_ | `GET auth.php?action=logout` | — | Huỷ session |

---

## 2. Màn hình Manager (`manager.html` / `manager.js`) — Quản lý chi nhánh

| Hành động trên UI | Hàm JS | API Endpoint | Use Case (03_queries.sql) | Thao tác SQL |
|---|---|---|---|---|
| Tải trang | `initApp()` | `GET auth.php?action=me` | — | SELECT staff theo session |
| Tab Tổng quan | `loadDashboardTab()` | `GET order_history.php`, `GET low_stock.php` | **UC1** + **UTILITY Low-stock** | SELECT đơn chi nhánh; SELECT nguyên liệu dưới ngưỡng |
| Tab Báo cáo | `loadReportsTab()` | `GET sales_by_item.php` | **UC5** — Revenue by item (own branch) | SELECT món + SUM(quantity_sold, revenue) theo chi nhánh |
| Báo cáo theo kỳ (day) | `loadPeriodReport('day')` | `GET sales_by_hour.php?period=day` | **UC6a** — Revenue by hour (today) | SELECT HOUR, order_count, revenue nhóm theo giờ |
| Báo cáo theo kỳ (week) | `loadPeriodReport('week')` | `GET sales_by_hour.php?period=week` | **UC6b** — Revenue by ISO week | SELECT YEARWEEK, order_count, revenue nhóm theo tuần |
| Báo cáo theo kỳ (month) | `loadPeriodReport('month')` | `GET sales_by_hour.php?period=month` | **UC6c** — Revenue by month | SELECT DATE_FORMAT(%Y-%m), order_count, revenue nhóm theo tháng |
| Tab Kho hàng | `loadInventoryTab()` | `GET inventory.php` | — | SELECT ingredients theo location |
| Điều chỉnh tồn kho | `saveStockAdjustment()` | `POST inventory.php` | — | UPDATE ingredient.stock_level (add/reduce/set) |
| Thêm nguyên liệu | `saveNewIngredient()` | `POST inventory.php (action=add_new)` | — | INSERT ingredient cho chi nhánh |
| Tab Quản lý thực đơn | `loadMenuTab()` | `GET menu.php?all=1` | — | SELECT toàn bộ món (kể cả is_available=0) — view only |
| Bật/tắt món | `toggleMenuAvailability()` | `POST menu.php {_method:DELETE}` | — | UPDATE menu_item.is_available (toggle) |
| Tab Nhân viên | `loadStaffTab()` | `GET staff.php` | **UC11** — Staff roster (no Admin role) | SELECT staff role ≠ Admin theo chi nhánh |
| Thêm/sửa nhân viên | `saveMgrStaff()` | `POST staff.php` / `POST {_method:PUT}` | — | INSERT / UPDATE staff |
| Bật/tắt tài khoản | `toggleStaffActive()` | `POST staff.php {_method:DEACTIVATE}` | — | UPDATE staff.is_active (toggle) |
| Reset mật khẩu | `resetStaffPin()` | `POST staff.php {_method:RESET_PIN}` | — | UPDATE staff.password_hash |
| Tab Khuyến mãi | `loadPromotionsTab()` | `GET promotions.php` | **UC12** — Promotion (own branch + chain-wide) | SELECT promotion location_id=own OR IS NULL |
| Tab Loyalty | `loadLoyaltyTab()` | `GET loyalty_balance.php?limit=50` | **UC4** — Top loyalty customers | SELECT v_customer_loyalty_balance ORDER BY points DESC LIMIT 50 |
| Đăng xuất | _(logout btn)_ | `GET auth.php?action=logout` | — | Huỷ session |

---

## 3. Màn hình Admin (`admin.html` / `admin.js`) — Quản trị toàn chuỗi

| Hành động trên UI | Hàm JS | API Endpoint | Use Case (03_queries.sql) | Thao tác SQL |
|---|---|---|---|---|
| Tải trang | `initApp()` | `GET auth.php?action=me` | — | SELECT staff theo session |
| Tab Tổng quan | `loadOverviewTab()` | `GET chain_dashboard.php` | **UC8** — Chain-wide overview stats | SELECT SUM(total_amount), COUNT(orders), low_stock_count toàn chuỗi |
| Tab Tổng quan | `loadOverviewTab()` | `GET revenue_by_branch.php` | **UC7** — Revenue by branch | SELECT location + revenue + order_count, ORDER BY revenue DESC |
| Tab Tổng quan | `loadOverviewTab()` | `GET loyalty_balance.php` | **UC4** — Top loyalty customers | SELECT v_customer_loyalty_balance ORDER BY points DESC |
| Tab Báo cáo | `loadReportsTab()` | `GET item_revenue.php` | **UC5** — Revenue by item (chain-wide) | SELECT món + SUM(qty, revenue) toàn chuỗi (bỏ lọc location_id) |
| Báo cáo theo kỳ (day) | `loadAdminPeriodReport('day')` | `GET branch_daily_revenue.php?period=day` | **UC6a** — Revenue by hour (chain) | SELECT HOUR, order_count, revenue (toàn chuỗi) |
| Báo cáo theo kỳ (week) | `loadAdminPeriodReport('week')` | `GET branch_daily_revenue.php?period=week` | **UC6b** — Revenue by ISO week (chain) | SELECT YEARWEEK, order_count, revenue (toàn chuỗi) |
| Báo cáo theo kỳ (month) | `loadAdminPeriodReport('month')` | `GET branch_daily_revenue.php?period=month` | **UC6c** — Revenue by month (chain) | SELECT DATE_FORMAT(%Y-%m), order_count, revenue (toàn chuỗi) |
| Tab Chi nhánh | `loadBranchesTab()` | `GET branches.php` | — | SELECT locations + staff_count |
| Thêm/sửa chi nhánh | `saveBranch()` | `POST branches.php` / `POST {_method:PUT}` | — | INSERT / UPDATE location |
| Tab Khuyến mãi | `loadPromotionsTab()` | `GET promotions.php` | **UC12** — Promotion management (all, with scope_label) | SELECT tất cả promotions + COALESCE(l.name, 'Toàn chuỗi') AS scope_label |
| Thêm/sửa KM | `savePromo()` | `POST promotions.php` / `POST {_method:PUT}` | — | INSERT / UPDATE promotion |
| Xoá KM | `deletePromo()` | `POST promotions.php {_method:DELETE}` | — | DELETE hoặc UPDATE is_active=0 nếu đã dùng trong đơn |
| Tab Nhân viên | `loadStaffTab()` | `GET branches.php`, `GET staff.php?location_id=X` | **UC11** — Staff roster (all roles) | SELECT staff mọi role theo chi nhánh được chọn |
| Thêm/sửa NV | `saveStaff()` | `POST staff.php` / `POST {_method:PUT}` | — | INSERT / UPDATE staff |
| Bật/tắt tài khoản | `toggleStaffActive()` | `POST staff.php {_method:DEACTIVATE}` | — | UPDATE staff.is_active (toggle) |
| Reset mật khẩu | `resetStaffPin()` | `POST staff.php {_method:RESET_PIN}` | — | UPDATE staff.password_hash |
| Tab Lịch sử đơn | `loadOrderHistoryTab()` | `GET order_history.php` | **UC10** — Order history (chain-wide, latest 200) | SELECT orders toàn chuỗi + staff + customer + location, LIMIT 200 |
| Xem hoá đơn | `viewAdminInvoice()` | `GET order_details.php?order_id=X` | **UTILITY** — Order detail with items + modifiers | SELECT order header + line items + customizations |
| Tab Loyalty | `loadLoyaltyTab()` | `GET loyalty_balance.php?limit=200` | **UC4** — Top loyalty customers | SELECT v_customer_loyalty_balance LIMIT 200 |
| Sửa điểm loyalty | `saveLoyaltyEdit()` | `PUT loyalty_balance.php?id=X` | — | UPDATE customer.loyalty_points |
| Tab Audit Log | `loadAuditLogTab()` | `GET audit_log.php` | **UC13** — System audit log (100 most recent) | SELECT audit_log + staff + location ORDER BY timestamp DESC LIMIT 100 |
| Đăng xuất | _(logout btn)_ | `GET auth.php?action=logout` | — | Huỷ session |

---

## 4. Toàn bộ API Endpoints

### Xác thực (`auth.php`)
| Endpoint | SQL |
|---|---|
| `GET auth.php?action=me` | SELECT staff, location, role từ session |
| `POST auth.php?action=login` | Xác minh phone + password_hash, tạo session |
| `GET auth.php?action=logout` | Huỷ session |

### Đơn hàng
| Endpoint | SQL |
|---|---|
| `POST create_order.php` | INSERT orders, order_items, order_item_modifiers, payment, loyalty_transaction; UPDATE customer.loyalty_points; INSERT audit_log |
| `GET order_history.php` | SELECT orders (lọc theo location nếu không phải Admin) |
| `GET order_details.php?order_id=X` | SELECT đơn + món + modifier + loyalty |
| `GET prep_queue.php` | SELECT đơn Completed trong ngày của chi nhánh |
| `POST prep_queue.php` | UPDATE order_status='Cancelled'; INSERT audit_log |

### Khách hàng & Loyalty
| Endpoint | Quyền | SQL |
|---|---|---|
| `GET customer_search.php?phone=X` | All | SELECT customer theo SĐT |
| `POST customer_search.php` | All | INSERT customer mới |
| `GET loyalty_balance.php?limit=N` | Admin, StoreManager | **UC4** — SELECT v_customer_loyalty_balance ORDER BY points DESC |
| `GET loyalty_balance.php?phone=X` | All | **UC3** — SELECT customer + points_balance theo SĐT |
| `PUT loyalty_balance.php?id=X` | Admin only | UPDATE customer.loyalty_points (admin override) |

**Công thức Loyalty:**
- Tích điểm: `floor(total_amount / 1000)` điểm/đơn → VD: 55.000đ = 55 điểm
- Đổi điểm: 1 điểm = 1.000đ giảm giá
- Nguồn dữ liệu: `v_customer_loyalty_balance` tính từ `loyalty_transaction` ledger (earn - redeem), không đọc `customer.loyalty_points` trực tiếp

### Menu
| Endpoint | SQL |
|---|---|
| `GET menu.php` | SELECT categories + items + modifiers + options |
| `GET menu.php?all=1` | SELECT tất cả (kể cả is_available=0) |
| `POST menu.php` | INSERT menu_item |
| `POST menu.php {_method:PUT}` | UPDATE menu_item |
| `POST menu.php {_method:DELETE}` | UPDATE menu_item.is_available (toggle) |
| `POST menu.php {_method:POST_CAT}` | INSERT menu_category |
| `POST menu.php {_method:PUT_CAT}` | UPDATE menu_category.name |

### Kho hàng
| Endpoint | SQL |
|---|---|
| `GET inventory.php` | SELECT ingredients theo location |
| `POST inventory.php` | UPDATE ingredient.stock_level |
| `POST inventory.php (action=add_new)` | INSERT ingredient mới |
| `GET low_stock.php` | SELECT ingredients dưới ngưỡng tồn tối thiểu |

### Nhân viên
| Endpoint | SQL |
|---|---|
| `GET staff.php` | SELECT staff theo location |
| `POST staff.php` | INSERT staff |
| `POST staff.php {_method:PUT}` | UPDATE staff |
| `POST staff.php {_method:DEACTIVATE}` | UPDATE staff.is_active (toggle) |
| `POST staff.php {_method:RESET_PIN}` | UPDATE staff.password_hash |

### Chi nhánh
| Endpoint | SQL |
|---|---|
| `GET branches.php` | SELECT locations + staff_count |
| `POST branches.php` | INSERT location |
| `POST branches.php {_method:PUT}` | UPDATE location |

### Khuyến mãi
| Endpoint | SQL |
|---|---|
| `GET promotions.php` | SELECT promotions (lọc theo is_active, location_id) |
| `POST promotions.php` | INSERT promotion |
| `POST promotions.php {_method:PUT}` | UPDATE promotion |
| `POST promotions.php {_method:DELETE}` | DELETE hoặc UPDATE is_active=0 |

### Báo cáo
| Endpoint | SQL |
|---|---|
| `GET chain_dashboard.php` | SELECT SUM(revenue), COUNT(orders), low_stock_count toàn chuỗi |
| `GET daily_revenue.php` | SELECT DATE, total_orders, revenue (30 ngày gần nhất) |
| `GET revenue_by_branch.php` | SELECT location + revenue + order_count |
| `GET branch_daily_revenue.php?period=X` | SELECT đơn nhóm theo thời gian (toàn chuỗi) |
| `GET sales_by_hour.php?period=X` | SELECT đơn nhóm theo thời gian (chi nhánh) |
| `GET sales_by_item.php` | SELECT món + qty_sold + revenue (chi nhánh) |
| `GET item_revenue.php` | SELECT món + qty_sold + revenue (toàn chuỗi) |
| `GET best_sellers.php?min_units=N` | SELECT items có SUM(quantity) >= N |
| `GET modifier_revenue.php` | SELECT modifier options + SUM extra revenue |
| `GET price_check.php` | SELECT đơn có giá charged ≠ giá menu hiện tại |

### Khác
| Endpoint | SQL |
|---|---|
| `GET audit_log.php` | SELECT audit_log + staff + location (100 dòng gần nhất) |
| `GET tables.php` | SELECT dining_table theo location |

---

## 5. ERD Bảng → Use Case Query

Map từng bảng trong ERD sang các UC query sử dụng bảng đó (tra nhanh khi thầy hỏi "bảng X dùng ở đâu").

| Bảng (ERD) | Cột chính | Liên kết FK | Xuất hiện trong UC |
|---|---|---|---|
| **location** | location_id, name, address, phone, cancel_pin | ← staff, orders, ingredient, promotion | UC7 (revenue by branch), UC8 (chain overview), UC9 (cancel_pin), UC11 (staff roster), UC12 (promotion scope) |
| **staff** | staff_id, location_id, name, role, phone, is_active, password_hash | → location | UC9 (audit_log staff_id), UC10 (staff_name in order history), UC11 (staff roster), UC13 (audit_log) |
| **audit_log** | log_id, staff_id, action_type, table_affected, record_id, action_timestamp, details | → staff | **UC13** — SELECT log + staff.name + location.name ORDER BY timestamp DESC LIMIT 100 |
| **customer** | customer_id, name, email, phone, loyalty_points | ← orders, loyalty_transaction | UC3 (lookup by phone), UC4 (top loyalty), UC10 (customer_name in order history) |
| **orders** | order_id, location_id, staff_id, customer_id, order_type, order_date, order_status, total_amount | → location, staff, customer | UC1, UC5, UC6a/b/c, UC7, UC8, UC9, UC10 |
| **order_item** | order_item_id, order_id, item_id, quantity, unit_price, subtotal | → orders, menu_item | UC1 (prep queue items), UC5 (revenue by item), **UTILITY** order detail |
| **order_item_modifier** | oi_modifier_id, order_item_id, option_id, price_delta_at_sale | → order_item, modifier_option | UC1 (customizations), **UTILITY** order detail (GROUP_CONCAT option_name) |
| **menu_item** | item_id, category_id, item_name, base_price, is_available | → menu_category | UC1, UC5 (item_name + revenue), **UTILITY** order detail |
| **menu_category** | category_id, category_name | ← menu_item | — (join ngầm qua menu_item) |
| **modifier_group** | group_id, group_name, selection_type, is_required | ← modifier_option, menu_item_modifier | UC1 (GROUP BY group_name cho customizations) |
| **modifier_option** | option_id, group_id, option_name, price_delta | → modifier_group | UC1, **UTILITY** order detail (option_name), modifier_revenue |
| **menu_item_modifier** | item_modifier_id, item_id, group_id | → menu_item, modifier_group | Junction table — dùng khi load menu để biết modifier nào áp cho món nào |
| **payment** | payment_id, order_id, payment_method, amount_paid, payment_time | → orders | **UTILITY** order detail (payment_method) |
| **promotion** | promotion_id, name, discount_type, discount_value, start_date, end_date, is_active, location_id | → location (nullable) | UC2 (active promo at POS), UC12 (promotion management) |
| **order_promotion** | order_promotion_id, order_id, promotion_id, amount_discounted | → orders, promotion | **UTILITY** order detail (promo_discount = SUM(amount_discounted)) |
| **loyalty_transaction** | loyalty_txn_id, customer_id, order_id, points_change, txn_type, created_at | → customer, orders | UC3/UC4 (via VIEW v_customer_loyalty_balance), tạo khi checkout |
| **ingredient** | ingredient_id, location_id, name, stock_level, unit, low_stock_threshold | → location | UC8 (low_stock_count chain), **UTILITY Low-stock** (stock_level < threshold) |
| **v_customer_loyalty_balance** _(VIEW)_ | customer_id, name, phone, points_balance | — | UC3, UC4 — tính SUM(earn) - SUM(redeem) từ loyalty_transaction |

### Quan hệ chính cần nhớ

```
location ──< staff ──< orders >── customer
                         │
                    order_item >── menu_item >── menu_category
                         │              │
               order_item_modifier    menu_item_modifier
                         │
                   modifier_option >── modifier_group

orders >── payment
orders >── order_promotion >── promotion
orders >── loyalty_transaction >── customer

location ──< ingredient
staff ──< audit_log
```

---

## 5. Lưu ý kiến trúc

| Điểm | Mô tả |
|---|---|
| **Lọc theo chi nhánh** | Admin thấy toàn chuỗi; Manager/Barista chỉ thấy chi nhánh mình (session.location_id) |
| **Phân quyền** | Admin ⊃ StoreManager ⊃ Barista — kiểm tra trong PHP theo session.role |
| **Giả lập HTTP method** | POST với `_method: PUT/DELETE/DEACTIVATE/RESET_PIN` (PHP không nhận PUT/DELETE trực tiếp) |
| **Mô hình Loyalty** | Tích 1 điểm / 1.000đ; đổi 1 điểm = giảm 1.000đ |
| **Phạm vi khuyến mãi** | `location_id = NULL` → toàn chuỗi; `location_id = N` → chi nhánh cụ thể |
| **Trạng thái đơn** | Chỉ `Completed` hoặc `Cancelled` (không có trạng thái trung gian) |
| **Audit trail** | Tự động INSERT vào `audit_log` khi tạo đơn, huỷ đơn, cập nhật quan trọng |

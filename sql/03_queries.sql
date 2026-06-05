-- =============================================================
-- FILE  : 03_queries.sql
-- DESC  : Use Case Queries — Coffee POS Coffee Shop Chain
-- Schema rules:
--   * order_status  ∈ {'Completed', 'Cancelled'}  (no Pending/Preparing/Paid)
--   * order_type    ∈ {'takeaway', 'pickup'}
--   * promotion.location_id NULL = chain-wide; number = branch-specific
--   * Loyalty: earn floor(total_amount / 1000) pts; 1 pt = 1,000đ off
--   * Roles: Admin ⊇ StoreManager ⊇ Barista (funnel permission)
-- =============================================================

USE final;

-- ─────────────────────────────────────────────────────────────
-- UC1 — Barista: View today's orders (prep queue / order history)
-- Actor: Barista (scoped to own branch)
-- ─────────────────────────────────────────────────────────────
SELECT
    o.order_id,
    o.order_type,
    DATE_FORMAT(o.order_date, '%H:%i') AS order_time,
    mi.item_name,
    oi.quantity,
    GROUP_CONCAT(
        mo.option_name ORDER BY mg.group_name SEPARATOR ', '
    ) AS customizations
FROM   orders o
JOIN   order_item oi              ON oi.order_id       = o.order_id
JOIN   menu_item  mi              ON mi.item_id        = oi.item_id
LEFT JOIN order_item_modifier oim ON oim.order_item_id = oi.order_item_id
LEFT JOIN modifier_option     mo  ON mo.option_id      = oim.option_id
LEFT JOIN modifier_group      mg  ON mg.group_id       = mo.group_id
WHERE  o.order_status = 'Completed'
  AND  DATE(o.order_date) = CURDATE()
  AND  o.location_id = 1                -- inject: session location_id
GROUP BY o.order_id, o.order_type, o.order_date,
         oi.order_item_id, mi.item_name, oi.quantity
ORDER BY o.order_date ASC;

-- ─────────────────────────────────────────────────────────────
-- UC2 — Barista: Fetch today's active promotion
-- Actor: Barista / all roles
-- Includes both chain-wide (location_id IS NULL) and branch promo
-- ─────────────────────────────────────────────────────────────
SELECT promotion_id, name, discount_type, discount_value
FROM   promotion
WHERE  is_active = 1
  AND  CURDATE() BETWEEN start_date AND end_date
  AND  (location_id IS NULL OR location_id = 1)   -- inject: session location_id
ORDER BY location_id DESC   -- branch-specific promo takes priority over chain-wide
LIMIT  1;

-- ─────────────────────────────────────────────────────────────
-- UC3 — Barista: Look up customer loyalty balance by phone
-- Actor: Barista
-- ─────────────────────────────────────────────────────────────
SELECT v.customer_id, v.name, v.phone, v.points_balance
FROM   v_customer_loyalty_balance v
WHERE  v.phone = '090-201-0001';          -- inject: customer phone

-- ─────────────────────────────────────────────────────────────
-- UC4 — Admin / StoreManager: Top loyalty customers
-- Actor: Admin (chain-wide) | StoreManager (own branch via order join)
-- ─────────────────────────────────────────────────────────────
SELECT
    v.customer_id,
    v.name,
    v.phone,
    v.points_balance
FROM   v_customer_loyalty_balance v
WHERE  v.points_balance >= 1
ORDER BY v.points_balance DESC
LIMIT  50;

-- ─────────────────────────────────────────────────────────────
-- UC5 — StoreManager: Revenue by item (own branch, all time)
-- Actor: StoreManager
-- Admin version: remove the location_id filter
-- ─────────────────────────────────────────────────────────────
SELECT
    mi.item_id,
    mi.item_name,
    SUM(oi.quantity) AS quantity_sold,
    SUM(oi.subtotal) AS total_revenue
FROM   order_item oi
JOIN   menu_item  mi ON mi.item_id = oi.item_id
JOIN   orders     o  ON o.order_id = oi.order_id
WHERE  o.location_id  = 1             -- inject: manager's location_id
  AND  o.order_status = 'Completed'
GROUP BY mi.item_id, mi.item_name
ORDER BY total_revenue DESC;

-- ─────────────────────────────────────────────────────────────
-- UC6a — StoreManager: Revenue by hour (own branch, today) — period=day
-- Actor: StoreManager
-- ─────────────────────────────────────────────────────────────
SELECT
    HOUR(o.order_date)                              AS period_key,
    CONCAT(LPAD(HOUR(o.order_date), 2, '0'), ':00') AS period_label,
    COUNT(o.order_id)                               AS order_count,
    SUM(o.total_amount)                             AS total_revenue
FROM   orders o
WHERE  o.location_id  = 1             -- inject: location_id
  AND  o.order_status = 'Completed'
  AND  DATE(o.order_date) = CURDATE()
GROUP BY period_key, period_label
ORDER BY period_key ASC;

-- ─────────────────────────────────────────────────────────────
-- UC6b — StoreManager: Revenue by ISO week (own branch) — period=week
-- Admin version: remove location_id filter for chain total
-- ─────────────────────────────────────────────────────────────
SELECT
    YEARWEEK(o.order_date, 1)                                      AS period_key,
    CONCAT('Tuần ', WEEK(o.order_date, 1), '/', YEAR(o.order_date)) AS period_label,
    COUNT(o.order_id)                                              AS order_count,
    SUM(o.total_amount)                                            AS total_revenue
FROM   orders o
WHERE  o.location_id  = 1             -- inject: location_id (omit for Admin)
  AND  o.order_status = 'Completed'
GROUP BY period_key, period_label
ORDER BY period_key ASC;

-- ─────────────────────────────────────────────────────────────
-- UC6c — StoreManager: Revenue by month (own branch) — period=month
-- Admin version: remove location_id filter for chain total
-- ─────────────────────────────────────────────────────────────
SELECT
    DATE_FORMAT(o.order_date, '%Y-%m')  AS period_key,
    DATE_FORMAT(o.order_date, '%m/%Y')  AS period_label,
    COUNT(o.order_id)                   AS order_count,
    SUM(o.total_amount)                 AS total_revenue
FROM   orders o
WHERE  o.location_id  = 1             -- inject: location_id (omit for Admin)
  AND  o.order_status = 'Completed'
GROUP BY period_key, period_label
ORDER BY period_key ASC;

-- ─────────────────────────────────────────────────────────────
-- UC7 — Admin: Revenue by branch (chain dashboard comparison)
-- Actor: Admin only
-- ─────────────────────────────────────────────────────────────
SELECT
    l.location_id,
    l.name                             AS location_name,
    COUNT(o.order_id)                  AS order_count,
    COALESCE(SUM(o.total_amount), 0)   AS revenue
FROM   location l
LEFT JOIN orders o ON o.location_id  = l.location_id
                  AND o.order_status = 'Completed'
GROUP BY l.location_id, l.name
ORDER BY revenue DESC;

-- ─────────────────────────────────────────────────────────────
-- UC8 — Admin: Chain-wide overview stats
-- Actor: Admin only
-- ─────────────────────────────────────────────────────────────
SELECT
    COALESCE(SUM(o.total_amount), 0)                AS total_revenue,
    COUNT(o.order_id)                               AS total_orders,
    (SELECT COUNT(*)
     FROM   ingredient
     WHERE  stock_level < low_stock_threshold)      AS low_stock_count
FROM   orders o
WHERE  o.order_status = 'Completed';

-- ─────────────────────────────────────────────────────────────
-- UC9 — Barista: Cancel order with branch PIN validation
-- Actor: Barista (PIN provided by StoreManager / posted at counter)
-- ─────────────────────────────────────────────────────────────

-- 9a. Fetch branch cancel_pin (server-side validation)
SELECT cancel_pin
FROM   location
WHERE  location_id = 1;              -- inject: session location_id

-- 9b. Validate order belongs to same branch and is still Completed
SELECT order_id, location_id, order_status
FROM   orders
WHERE  order_id    = 19             -- inject: order_id
  AND  location_id = 1
  AND  order_status = 'Completed';

-- 9c. Mark as Cancelled
UPDATE orders
SET    order_status = 'Cancelled'
WHERE  order_id    = 19
  AND  location_id = 1;

-- 9d. Write audit log
INSERT INTO audit_log (staff_id, action_type, table_affected, record_id, details)
VALUES (5, 'CANCEL', 'orders', 19, 'Customer changed mind — PIN verified');

-- ─────────────────────────────────────────────────────────────
-- UC10 — Admin: Order history (chain-wide, latest 200)
-- Actor: Admin only (StoreManager sees own branch only, LIMIT 100)
-- ─────────────────────────────────────────────────────────────

-- Admin (all branches):
SELECT o.order_id, o.order_date, o.order_type, o.order_status, o.total_amount,
       s.name AS staff_name, c.name AS customer_name, l.name AS location_name
FROM   orders o
JOIN   staff    s ON s.staff_id    = o.staff_id
JOIN   location l ON l.location_id = o.location_id
LEFT JOIN customer c ON c.customer_id = o.customer_id
ORDER BY o.order_date DESC
LIMIT 200;

-- StoreManager (own branch):
SELECT o.order_id, o.order_date, o.order_type, o.order_status, o.total_amount,
       s.name AS staff_name, c.name AS customer_name
FROM   orders o
JOIN   staff    s ON s.staff_id    = o.staff_id
LEFT JOIN customer c ON c.customer_id = o.customer_id
WHERE  o.location_id = 1             -- inject: location_id
ORDER BY o.order_date DESC
LIMIT 100;

-- ─────────────────────────────────────────────────────────────
-- UC11 — Admin / StoreManager: Staff roster (own branch)
-- Admin: pass ?location_id=X; StoreManager: always own branch
-- Admin sees all roles; StoreManager cannot see Admin accounts
-- ─────────────────────────────────────────────────────────────

-- Admin (all roles):
SELECT s.staff_id, s.name, s.role, s.phone, s.is_active,
       l.name AS location_name
FROM   staff s
JOIN   location l ON l.location_id = s.location_id
WHERE  s.location_id = 1            -- inject: chosen location_id
ORDER BY s.role, s.name;

-- StoreManager (Barista + StoreManager only, no Admin):
SELECT s.staff_id, s.name, s.role, s.phone, s.is_active,
       l.name AS location_name
FROM   staff s
JOIN   location l ON l.location_id = s.location_id
WHERE  s.location_id = 1
  AND  s.role != 'Admin'            -- StoreManager cannot see Admin accounts
ORDER BY s.role, s.name;

-- ─────────────────────────────────────────────────────────────
-- UC12 — Admin: Promotion management (chain-wide view)
-- StoreManager sees own branch promos + chain-wide (read-only for chain-wide)
-- ─────────────────────────────────────────────────────────────

-- Admin: all promotions with scope label
SELECT p.promotion_id, p.name, p.discount_type, p.discount_value,
       p.start_date, p.end_date, p.is_active, p.location_id,
       COALESCE(l.name, 'Toàn chuỗi') AS scope_label
FROM   promotion p
LEFT JOIN location l ON l.location_id = p.location_id
ORDER BY p.start_date DESC;

-- StoreManager: own branch + chain-wide
SELECT p.promotion_id, p.name, p.discount_type, p.discount_value,
       p.start_date, p.end_date, p.is_active, p.location_id,
       CASE WHEN p.location_id IS NULL THEN 'Toàn chuỗi' ELSE 'Chi nhánh' END AS scope_label
FROM   promotion p
WHERE  p.location_id = 1 OR p.location_id IS NULL   -- inject: own location_id
ORDER BY p.start_date DESC;

-- ─────────────────────────────────────────────────────────────
-- UC13 — Admin: System audit log (100 most recent actions)
-- Actor: Admin only
-- ─────────────────────────────────────────────────────────────
SELECT al.log_id, al.action_timestamp, al.action_type,
       al.table_affected, al.record_id, al.details,
       s.name AS staff_name, s.role AS staff_role,
       l.name AS location_name
FROM   audit_log al
JOIN   staff    s ON s.staff_id    = al.staff_id
JOIN   location l ON l.location_id = s.location_id
ORDER BY al.action_timestamp DESC
LIMIT 100;

-- ─────────────────────────────────────────────────────────────
-- UTILITY — Low-stock alert (StoreManager: own branch)
-- Admin version: remove location_id filter to count chain-wide
-- ─────────────────────────────────────────────────────────────
SELECT ingredient_id, name, stock_level, unit, low_stock_threshold
FROM   ingredient
WHERE  location_id  = 1             -- inject: location_id
  AND  stock_level < low_stock_threshold
ORDER BY (stock_level / low_stock_threshold) ASC;

-- ─────────────────────────────────────────────────────────────
-- UTILITY — Order detail with items + modifiers (all roles)
-- ─────────────────────────────────────────────────────────────

-- Order header:
SELECT o.order_id, o.order_date, o.order_type, o.order_status, o.total_amount,
       s.name AS staff_name, l.name AS location_name, c.name AS customer_name,
       COALESCE(SUM(op.amount_discounted), 0) AS promo_discount
FROM   orders o
JOIN   staff    s  ON s.staff_id    = o.staff_id
JOIN   location l  ON l.location_id = o.location_id
LEFT JOIN customer     c  ON c.customer_id  = o.customer_id
LEFT JOIN order_promotion op ON op.order_id = o.order_id
WHERE  o.order_id = 1               -- inject: order_id
GROUP BY o.order_id;

-- Order line items + customizations:
SELECT oi.order_item_id, mi.item_name, oi.quantity, oi.unit_price, oi.subtotal,
       GROUP_CONCAT(mo.option_name ORDER BY mg.group_name SEPARATOR ', ') AS customizations
FROM   order_item oi
JOIN   menu_item mi ON mi.item_id = oi.item_id
LEFT JOIN order_item_modifier oim ON oim.order_item_id = oi.order_item_id
LEFT JOIN modifier_option     mo  ON mo.option_id      = oim.option_id
LEFT JOIN modifier_group      mg  ON mg.group_id       = mo.group_id
WHERE  oi.order_id = 1             -- inject: order_id
GROUP BY oi.order_item_id, mi.item_name, oi.quantity, oi.unit_price, oi.subtotal;

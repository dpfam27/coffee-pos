-- =============================================================
-- FILE  : 03_queries.sql
-- DESC  : Use Case Queries — Coffee POS Coffee Shop Chain
--         Reflects updated schema: no dining_table, no ShiftLead,
--         order_status ∈ {Completed, Cancelled},
--         order_type ∈ {takeaway, pickup}
--         Loyalty: earn floor(total/1000) pts, 1pt = 1,000đ
-- =============================================================

USE final;

-- ─────────────────────────────────────────────────────────────
-- UC1 — Barista: View today's completed orders (prep queue)
-- Actor: Barista
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
JOIN   menu_item  mi              ON mi.item_id         = oi.item_id
LEFT JOIN order_item_modifier oim ON oim.order_item_id  = oi.order_item_id
LEFT JOIN modifier_option     mo  ON mo.option_id        = oim.option_id
LEFT JOIN modifier_group      mg  ON mg.group_id          = mo.group_id
WHERE  o.order_status = 'Completed'
  AND  DATE(o.order_date) = CURDATE()
  AND  o.location_id = 1                -- inject: session location_id
GROUP BY o.order_id, o.order_type, o.order_date, oi.order_item_id, mi.item_name, oi.quantity
ORDER BY o.order_date ASC;

-- ─────────────────────────────────────────────────────────────
-- UC2 — Cashier: Active promotion for today
-- Actor: Barista
-- ─────────────────────────────────────────────────────────────
SELECT promotion_id, name, discount_type, discount_value
FROM   promotion
WHERE  is_active = 1
  AND  CURDATE() BETWEEN start_date AND end_date
LIMIT  1;

-- ─────────────────────────────────────────────────────────────
-- UC3 — Cashier: Look up customer by phone
-- Actor: Barista
-- ─────────────────────────────────────────────────────────────
SELECT customer_id, name, phone, email, loyalty_points
FROM   customer
WHERE  phone = '090-201-0001';            -- inject: customer phone

-- ─────────────────────────────────────────────────────────────
-- UC4 — Admin: Top loyalty customers (≥ 1 point)
-- Actor: Admin
-- ─────────────────────────────────────────────────────────────
SELECT
    c.customer_id,
    c.name,
    c.phone,
    c.loyalty_points,
    COALESCE(SUM(CASE WHEN lt.txn_type = 'earn'   THEN lt.points_change END), 0) AS total_earned,
    COALESCE(SUM(CASE WHEN lt.txn_type = 'redeem' THEN lt.points_change END), 0) AS total_redeemed
FROM   customer c
LEFT JOIN loyalty_transaction lt ON lt.customer_id = c.customer_id
GROUP BY c.customer_id, c.name, c.phone, c.loyalty_points
HAVING c.loyalty_points >= 1
ORDER BY c.loyalty_points DESC;

-- ─────────────────────────────────────────────────────────────
-- UC5 — Manager: Revenue by item (own branch, current month)
-- Actor: StoreManager
-- ─────────────────────────────────────────────────────────────
SELECT
    mi.item_id,
    mi.item_name,
    SUM(oi.quantity) AS quantity_sold,
    SUM(oi.subtotal) AS total_revenue
FROM   order_item oi
JOIN   menu_item  mi ON mi.item_id  = oi.item_id
JOIN   orders     o  ON o.order_id  = oi.order_id
WHERE  o.location_id  = 1             -- inject: manager's location_id
  AND  o.order_status = 'Completed'
  AND  MONTH(o.order_date) = MONTH(CURDATE())
  AND  YEAR(o.order_date)  = YEAR(CURDATE())
GROUP BY mi.item_id, mi.item_name
ORDER BY total_revenue DESC;

-- ─────────────────────────────────────────────────────────────
-- UC6 — Manager: Sales by hour (own branch, today)
-- Actor: StoreManager
-- ─────────────────────────────────────────────────────────────
SELECT
    HOUR(o.order_date)  AS hour_of_day,
    COUNT(*)            AS order_count,
    SUM(o.total_amount) AS total_revenue
FROM   orders o
WHERE  o.location_id  = 1             -- inject: location_id
  AND  o.order_status = 'Completed'
  AND  DATE(o.order_date) = CURDATE()
GROUP BY HOUR(o.order_date)
ORDER BY hour_of_day;

-- ─────────────────────────────────────────────────────────────
-- UC7 — Admin: Revenue by branch (chain dashboard)
-- Actor: Admin
-- ─────────────────────────────────────────────────────────────
SELECT
    l.location_id,
    l.name              AS location_name,
    COUNT(o.order_id)   AS order_count,
    COALESCE(SUM(o.total_amount), 0) AS revenue
FROM   location l
LEFT JOIN orders o ON o.location_id  = l.location_id
                  AND o.order_status = 'Completed'
GROUP BY l.location_id, l.name
ORDER BY revenue DESC;

-- ─────────────────────────────────────────────────────────────
-- UC8 — Admin / Manager: Daily revenue (last 30 days)
-- Actor: Admin | StoreManager
-- ─────────────────────────────────────────────────────────────
SELECT
    DATE(o.order_date)  AS sale_date,
    COUNT(*)            AS total_orders,
    SUM(o.total_amount) AS total_revenue
FROM   orders o
WHERE  o.order_status = 'Completed'
  AND  o.order_date  >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
GROUP BY DATE(o.order_date)
ORDER BY sale_date DESC;

-- ─────────────────────────────────────────────────────────────
-- UC9 — Barista: Cancel order with PIN validation
-- Actor: Barista (API-enforced; queries shown for clarity)
-- ─────────────────────────────────────────────────────────────

-- 9a. Fetch branch cancel_pin (server-side)
SELECT cancel_pin
FROM   location
WHERE  location_id = 1;              -- inject: session location_id

-- 9b. Validate order belongs to same branch and is Completed
SELECT order_id, location_id, order_status
FROM   orders
WHERE  order_id    = 19             -- inject: order_id
  AND  location_id = 1
  AND  order_status = 'Completed';

-- 9c. Set to Cancelled
UPDATE orders
SET    order_status = 'Cancelled'
WHERE  order_id = 19;

-- 9d. Audit log
INSERT INTO audit_log (staff_id, action_type, table_affected, record_id, details)
VALUES (5, 'CANCEL_ORDER', 'orders', 19, 'Customer changed mind — PIN verified');

-- ─────────────────────────────────────────────────────────────
-- UC10 — Manager: Staff roster & shift schedule (own branch)
-- Actor: StoreManager
-- ─────────────────────────────────────────────────────────────
SELECT
    s.staff_id,
    s.name,
    s.role,
    s.phone,
    s.is_active,
    ss.shift_type,
    ss.day_of_week
FROM   staff s
LEFT JOIN shift_schedule ss ON ss.staff_id = s.staff_id
WHERE  s.location_id = 1             -- inject: location_id
ORDER BY s.role, s.name,
         FIELD(ss.day_of_week, 'Mon','Tue','Wed','Thu','Fri','Sat','Sun');

-- ─────────────────────────────────────────────────────────────
-- UTILITY: Best-selling items (chain-wide, all time)
-- Actor: Admin
-- ─────────────────────────────────────────────────────────────
SELECT
    mi.item_name,
    SUM(oi.quantity) AS total_quantity_sold,
    SUM(oi.subtotal) AS total_revenue
FROM   order_item oi
JOIN   menu_item  mi ON mi.item_id = oi.item_id
JOIN   orders     o  ON o.order_id = oi.order_id
WHERE  o.order_status = 'Completed'
GROUP BY mi.item_id, mi.item_name
ORDER BY total_quantity_sold DESC
LIMIT 10;

-- ─────────────────────────────────────────────────────────────
-- UTILITY: Low-stock alert for a branch
-- Actor: StoreManager
-- ─────────────────────────────────────────────────────────────
SELECT
    ingredient_id,
    name,
    stock_level,
    unit,
    low_stock_threshold
FROM   ingredient
WHERE  location_id  = 1             -- inject: location_id
  AND  stock_level < low_stock_threshold
ORDER BY (stock_level / low_stock_threshold) ASC;

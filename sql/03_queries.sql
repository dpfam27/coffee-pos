-- =============================================================
-- FILE  : 03_queries.sql
-- DESC  : Six use-case queries for Coffee Shop Chain POS
--         Matches Mục 6 (Use Cases) in the final report.
--         Technique references: Coronel & Morris, 13th ed.
-- =============================================================

USE final;

-- ─────────────────────────────────────────────────────────────
-- UC1  Beverage Preparation Queue  (Barista)
-- Technique: LEFT JOIN + GROUP_CONCAT + functional dependency
-- ─────────────────────────────────────────────────────────────
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
WHERE  o.location_id   = 1
  AND  o.order_status IN ('Pending', 'Preparing')
GROUP BY oi.order_item_id, o.order_id, o.order_date,
         mi.item_name, oi.quantity, o.order_status
ORDER BY o.order_date ASC;

-- ─────────────────────────────────────────────────────────────
-- UC2  Ingredients at Risk of Going Unavailable  (Store Manager)
-- Technique: simple query on ingredient
-- ─────────────────────────────────────────────────────────────
SELECT
    name,
    stock_level,
    low_stock_threshold,
    unit
FROM  ingredient
WHERE location_id  = 1
  AND stock_level  < low_stock_threshold
ORDER BY (low_stock_threshold - stock_level) DESC;

-- ─────────────────────────────────────────────────────────────
-- UC3  Revenue by Customization Option  (Admin)
-- Technique: aggregation over M:N junction table  (Ch. 7)
-- Design proof: impossible on a flat schema with text modifiers
-- ─────────────────────────────────────────────────────────────
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

-- ─────────────────────────────────────────────────────────────
-- UC4  High-Volume Menu Items  (Admin)
-- Technique: GROUP BY … HAVING  (Ch. 7)
-- NOTE: threshold 500 is for production data.
--       With sample data use HAVING SUM(oi.quantity) >= 1.
-- ─────────────────────────────────────────────────────────────
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
HAVING SUM(oi.quantity) > 500        -- lower to >= 1 for demo dataset
ORDER BY units_sold DESC;

-- ─────────────────────────────────────────────────────────────
-- UC5  Price Integrity Check  (Admin)
-- Technique: multi-table join + filter  (Ch. 7)
-- Design proof: snapshot in order_item.unit_price protects history
-- ─────────────────────────────────────────────────────────────
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

-- ─────────────────────────────────────────────────────────────
-- UC6  Customer Loyalty Balance  (Admin / Marketing)
-- Technique: VIEW definition + LEFT JOIN + CASE WHEN  (Ch. 8)
-- Design proof: balance computed from transaction ledger, not cached column
-- ─────────────────────────────────────────────────────────────

-- The VIEW is already created in 01_schema.sql.
-- Query the view:
SELECT
    name,
    phone,
    points_balance
FROM  v_customer_loyalty_balance
ORDER BY points_balance DESC
LIMIT 10;

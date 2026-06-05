-- =============================================================
-- FILE  : 02_sample_data.sql
-- DESC  : Sample data — Coffee POS Coffee Shop Chain
--         2 branches · 7 staff · 5 customers
--         13 menu items · 20 orders (Completed / Cancelled)
-- Business rules reflected:
--   * No dining_table — takeaway / pickup only
--   * order_status ∈ {Completed, Cancelled}
--   * Loyalty: earn floor(total/1000) pts; redeem 1pt = 1,000đ
--   * cancel_pin stored per branch
--   * No shift_schedule data (feature removed)
-- =============================================================

USE final;
SET FOREIGN_KEY_CHECKS = 0;

-- ── location ──────────────────────────────────────────────────
INSERT INTO location (location_id, name, address, phone, cancel_pin) VALUES
    (1, 'Downtown Branch', '23 Nguyen Hue Boulevard, District 1, Ho Chi Minh City', '028-3822-1001', '1234'),
    (2, 'Airport Branch', 'Domestic Terminal, Tan Son Nhat Airport, Ho Chi Minh City', '028-3844-2002', '5678');

-- ── staff ─────────────────────────────────────────────────────
-- Default password for all accounts: "password"
-- Hash generated with: php -r "echo password_hash('password', PASSWORD_BCRYPT);"
INSERT INTO staff (staff_id, location_id, name, role, phone, is_active, password_hash) VALUES
    (1, 1, 'James Carter',  'Admin',        '090-111-0001', 1, '$2y$12$XJQDmu4AbwncGfuiGyTVYuZSwC1sU.80gPs6Qn5fxXfu/laWFBrSa'),
    (2, 1, 'Sarah Nguyen',  'StoreManager', '090-111-0002', 1, '$2y$12$XJQDmu4AbwncGfuiGyTVYuZSwC1sU.80gPs6Qn5fxXfu/laWFBrSa'),
    (3, 2, 'Tom Pham',      'StoreManager', '090-111-0003', 1, '$2y$12$XJQDmu4AbwncGfuiGyTVYuZSwC1sU.80gPs6Qn5fxXfu/laWFBrSa'),
    (5, 1, 'Kevin Le',      'Barista',      '090-111-0005', 1, '$2y$12$XJQDmu4AbwncGfuiGyTVYuZSwC1sU.80gPs6Qn5fxXfu/laWFBrSa'),
    (6, 1, 'Minh Hoang',    'Barista',      '090-111-0006', 1, '$2y$12$XJQDmu4AbwncGfuiGyTVYuZSwC1sU.80gPs6Qn5fxXfu/laWFBrSa'),
    (7, 2, 'Lan Vo',        'Barista',      '090-111-0007', 1, '$2y$12$XJQDmu4AbwncGfuiGyTVYuZSwC1sU.80gPs6Qn5fxXfu/laWFBrSa'),
    (8, 2, 'Duy Tran',      'Barista',      '090-111-0008', 1, '$2y$12$XJQDmu4AbwncGfuiGyTVYuZSwC1sU.80gPs6Qn5fxXfu/laWFBrSa');

-- ── customer ──────────────────────────────────────────────────
INSERT INTO customer (customer_id, name, email, phone, loyalty_points) VALUES
    (1, 'An Nguyen',   'an.nguyen@email.com',   '090-201-0001', 155),
    (2, 'Binh Tran',   'binh.tran@email.com',   '090-202-0002', 262),
    (3, 'Chau Le',     'chau.le@email.com',     '090-203-0003', 340),
    (4, 'Dung Pham',   'dung.pham@email.com',   '090-204-0004', 138),
    (5, 'Em Hoang',    'em.hoang@email.com',    '090-205-0005', 120);

-- ── menu_category ─────────────────────────────────────────────
INSERT INTO menu_category (category_id, category_name) VALUES
    (1, 'Espresso'),
    (2, 'Cold Brew'),
    (3, 'Tea & Matcha'),
    (4, 'Food');

-- ── menu_item ─────────────────────────────────────────────────
INSERT INTO menu_item (item_id, category_id, item_name, base_price, is_available) VALUES
    (1,  1, 'Espresso',           45000.00, 1),
    (2,  1, 'Cappuccino',         55000.00, 1),
    (3,  1, 'Cafe Latte',         55000.00, 1),
    (4,  1, 'Caramel Macchiato',  65000.00, 1),
    (5,  1, 'Flat White',         55000.00, 1),
    (6,  2, 'Cold Brew Classic',  55000.00, 1),
    (7,  2, 'Cold Brew Tonic',    65000.00, 1),
    (8,  3, 'Matcha Latte',       60000.00, 1),
    (9,  3, 'Chai Latte',         55000.00, 1),
    (10, 4, 'Croissant',          35000.00, 1),
    (11, 4, 'Blueberry Muffin',   40000.00, 1),
    (12, 4, 'Avocado Toast',      65000.00, 1),
    (13, 4, 'Banana Bread',       40000.00, 1);

-- ── modifier_group ────────────────────────────────────────────
INSERT INTO modifier_group (group_id, group_name, selection_type, is_required) VALUES
    (1, 'Size',        'single',   1),
    (2, 'Temperature', 'single',   1),
    (3, 'Milk',        'single',   0),
    (4, 'Sweetness',   'single',   0),
    (5, 'Add-on',      'multiple', 0);

-- ── modifier_option ───────────────────────────────────────────
INSERT INTO modifier_option (option_id, group_id, option_name, price_delta) VALUES
    (1,  1, 'Regular',       0.00),
    (2,  1, 'Large',     10000.00),
    (3,  2, 'Hot',           0.00),
    (4,  2, 'Iced',          0.00),
    (5,  3, 'Regular milk',  0.00),
    (6,  3, 'Oat milk',   8000.00),
    (7,  3, 'Almond milk', 8000.00),
    (8,  3, 'Soy milk',   5000.00),
    (9,  4, 'Normal',        0.00),
    (10, 4, 'Less sweet',    0.00),
    (11, 4, 'No sugar',      0.00),
    (12, 5, 'Extra shot', 12000.00),
    (13, 5, 'Extra syrup', 8000.00),
    (14, 5, 'Whipped cream',10000.00);

-- ── menu_item_modifier ────────────────────────────────────────
INSERT INTO menu_item_modifier (item_modifier_id, item_id, group_id) VALUES
    (1, 1, 1), (2, 1, 2), (3, 1, 5),
    (4, 2, 1), (5, 2, 2), (6, 2, 3), (7, 2, 4), (8, 2, 5),
    (9, 3, 1), (10, 3, 2), (11, 3, 3), (12, 3, 4), (13, 3, 5),
    (14, 4, 1), (15, 4, 2), (16, 4, 3), (17, 4, 4), (18, 4, 5),
    (19, 5, 1), (20, 5, 2), (21, 5, 3), (22, 5, 5),
    (23, 6, 1), (24, 6, 3), (25, 6, 4), (26, 6, 5),
    (27, 7, 1), (28, 7, 4), (29, 7, 5),
    (30, 8, 1), (31, 8, 2), (32, 8, 3), (33, 8, 4), (34, 8, 5),
    (35, 9, 1), (36, 9, 2), (37, 9, 3), (38, 9, 4), (39, 9, 5);

-- ── ingredient ────────────────────────────────────────────────
INSERT INTO ingredient (ingredient_id, location_id, name, stock_level, unit, low_stock_threshold) VALUES
    (1,  1, 'Arabica beans',    8.50, 'kg',   2.00),
    (2,  1, 'Whole milk',      12.00, 'liter', 5.00),
    (3,  1, 'Oat milk',         1.50, 'liter', 5.00),
    (4,  1, 'Almond milk',      3.00, 'liter', 2.00),
    (5,  1, 'Soy milk',         2.50, 'liter', 1.00),
    (6,  1, 'Espresso syrup',   1.20, 'liter', 0.50),
    (7,  1, 'Caramel syrup',    0.30, 'liter', 0.50),
    (8,  1, 'Matcha powder',    0.15, 'kg',    0.20),
    (9,  1, 'Chai mix',         0.90, 'kg',    0.30),
    (10, 1, 'Croissant',       10.00, 'unit',  5.00),
    (11, 1, 'Blueberry muffin', 8.00, 'unit',  4.00),
    (12, 2, 'Arabica beans',    6.00, 'kg',    2.00),
    (13, 2, 'Whole milk',      10.00, 'liter', 5.00),
    (14, 2, 'Oat milk',         4.00, 'liter', 3.00),
    (15, 2, 'Almond milk',      2.50, 'liter', 2.00),
    (16, 2, 'Soy milk',         1.50, 'liter', 1.00),
    (17, 2, 'Espresso syrup',   0.80, 'liter', 0.50),
    (18, 2, 'Caramel syrup',    0.70, 'liter', 0.50),
    (19, 2, 'Matcha powder',    0.40, 'kg',    0.20),
    (20, 2, 'Chai mix',         0.60, 'kg',    0.30),
    (21, 2, 'Croissant',        8.00, 'unit',  5.00),
    (22, 2, 'Blueberry muffin', 6.00, 'unit',  4.00);

-- ── promotion ─────────────────────────────────────────────────
-- location_id NULL = chain-wide; number = branch-specific
INSERT INTO promotion (promotion_id, name, discount_type, discount_value, start_date, end_date, is_active, location_id) VALUES
    (1, 'Happy Hour 10% Off',  'percent', 10.00,    '2026-01-01', '2026-12-31', 1, NULL),
    (2, 'First Order 20k Off', 'fixed',   20000.00, '2026-01-01', '2026-06-30', 0, NULL);

-- ── orders ────────────────────────────────────────────────────
-- All orders: Completed (paid at counter) or Cancelled (voided with PIN)
-- No table_id, no dine_in
INSERT INTO orders (order_id, location_id, staff_id, customer_id, order_type, order_date, order_status, total_amount) VALUES
    -- Downtown Branch — 2026-06-01
    (5,  1, 5, 1,    'takeaway', '2026-06-01 09:00:00', 'Completed',  73000.00),
    (6,  1, 6, 2,    'pickup',   '2026-06-01 09:30:00', 'Completed', 132000.00),
    (7,  1, 5, NULL, 'takeaway', '2026-06-01 10:00:00', 'Completed',  90000.00),
    (8,  1, 6, 3,    'pickup',   '2026-06-01 10:30:00', 'Completed', 135000.00),
    (9,  1, 5, 1,    'takeaway', '2026-06-01 11:00:00', 'Completed', 100000.00),
    (10, 1, 5, 4,    'takeaway', '2026-06-01 11:30:00', 'Completed',  73000.00),
    (11, 1, 6, NULL, 'takeaway', '2026-06-01 14:00:00', 'Completed', 118000.00),
    (12, 1, 5, 2,    'pickup',   '2026-06-01 14:30:00', 'Completed', 130000.00),
    -- Downtown Branch — 2026-06-02
    (13, 1, 6, 3,    'takeaway', '2026-06-02 09:00:00', 'Completed', 132000.00),
    (14, 1, 5, NULL, 'takeaway', '2026-06-02 09:30:00', 'Completed', 115000.00),
    (15, 1, 5, 5,    'pickup',   '2026-06-02 10:00:00', 'Completed', 120000.00),
    (16, 1, 5, 3,    'takeaway', '2026-06-02 10:30:00', 'Completed',  73000.00),
    (17, 1, 6, 4,    'pickup',   '2026-06-02 11:00:00', 'Completed',  65000.00),
    (20, 1, 5, 1,    'takeaway', '2026-06-02 15:00:00', 'Completed',  55000.00),
    (21, 1, 5, 5,    'takeaway', '2026-06-02 15:30:00', 'Completed',  49500.00),
    -- Downtown — Cancelled order
    (19, 1, 5, NULL, 'takeaway', '2026-06-03 10:05:00', 'Cancelled',  55000.00),
    -- Airport Branch — 2026-06-01
    (22, 2, 7, 2,    'pickup',   '2026-06-01 08:30:00', 'Completed', 120000.00),
    (23, 2, 7, 3,    'takeaway', '2026-06-01 09:15:00', 'Completed',  65000.00),
    -- Airport Branch — 2026-06-02
    (26, 2, 7, NULL, 'pickup',   '2026-06-02 09:30:00', 'Completed', 110000.00),
    -- Airport Branch — 2026-06-03
    (28, 2, 7, NULL, 'takeaway', '2026-06-03 07:45:00', 'Completed', 130000.00);

-- ── order_item ────────────────────────────────────────────────
INSERT INTO order_item (order_item_id, order_id, item_id, quantity, unit_price, subtotal) VALUES
    (6,  5,  3, 1, 55000.00,  73000.00),
    (7,  6,  2, 1, 55000.00,  77000.00),
    (8,  6,  6, 1, 55000.00,  55000.00),
    (9,  7,  1, 2, 45000.00,  90000.00),
    (10, 8,  4, 1, 65000.00,  95000.00),
    (11, 8, 11, 1, 40000.00,  40000.00),
    (12, 9,  6, 1, 55000.00,  65000.00),
    (13, 9, 10, 1, 35000.00,  35000.00),
    (14, 10, 5, 1, 55000.00,  73000.00),
    (15, 11, 8, 1, 60000.00,  78000.00),
    (16, 11,13, 1, 40000.00,  40000.00),
    (17, 12, 9, 1, 55000.00,  60000.00),
    (18, 12,10, 2, 35000.00,  70000.00),
    (19, 13, 3, 1, 55000.00,  77000.00),
    (20, 13, 2, 1, 55000.00,  55000.00),
    (21, 14, 7, 1, 65000.00,  75000.00),
    (22, 14,11, 1, 40000.00,  40000.00),
    (23, 15, 5, 1, 55000.00,  55000.00),
    (24, 15,12, 1, 65000.00,  65000.00),
    (25, 16, 3, 1, 55000.00,  73000.00),
    (26, 17, 4, 1, 65000.00,  65000.00),
    (28, 19, 3, 1, 55000.00,  55000.00),
    (29, 20, 6, 1, 55000.00,  55000.00),
    (30, 21, 2, 1, 55000.00,  55000.00),
    (31, 22, 4, 1, 65000.00,  75000.00),
    (32, 22,10, 1, 35000.00,  45000.00),
    (33, 23, 7, 1, 65000.00,  65000.00),
    (37, 26, 8, 1, 60000.00,  70000.00),
    (38, 26,11, 1, 40000.00,  40000.00),
    (40, 28, 4, 1, 65000.00,  75000.00),
    (41, 28, 6, 1, 55000.00,  55000.00);

-- ── order_item_modifier ───────────────────────────────────────
INSERT INTO order_item_modifier (oi_modifier_id, order_item_id, option_id, price_delta_at_sale) VALUES
    (10,  6,  2, 10000.00),
    (11,  6,  6,  8000.00),
    (12,  7,  2, 10000.00),
    (13,  7, 12, 12000.00),
    (14,  9,  1,     0.00),
    (15,  9,  3,     0.00),
    (16, 10,  2, 10000.00),
    (17, 10,  3,     0.00),
    (18, 10,  6,  8000.00),
    (21, 12,  2, 10000.00),
    (22, 12, 10,     0.00),
    (23, 14,  2, 10000.00),
    (24, 14,  3,     0.00),
    (25, 14,  7,  8000.00),
    (26, 15,  2, 10000.00),
    (27, 15,  4,     0.00),
    (28, 15,  6,  8000.00),
    (34, 19,  2, 10000.00),
    (35, 19,  3,     0.00),
    (39, 20,  1,     0.00),
    (40, 20,  3,     0.00),
    (41, 20,  5,     0.00),
    (43, 21,  2, 10000.00),
    (44, 21, 11,     0.00),
    (48, 25,  2, 10000.00),
    (49, 25,  4,     0.00),
    (50, 25,  6,  8000.00),
    (56, 27,  2, 10000.00),
    (57, 27,  3,     0.00);

-- ── payment ───────────────────────────────────────────────────
INSERT INTO payment (payment_id, order_id, payment_method, amount_paid, payment_time) VALUES
    (2,  5,  'Mobile',  73000.00, '2026-06-01 09:05:00'),
    (3,  6,  'Card',   132000.00, '2026-06-01 09:35:00'),
    (4,  7,  'Cash',    90000.00, '2026-06-01 10:05:00'),
    (5,  8,  'Mobile', 135000.00, '2026-06-01 10:35:00'),
    (6,  9,  'Cash',   100000.00, '2026-06-01 11:05:00'),
    (7,  10, 'Card',    73000.00, '2026-06-01 11:35:00'),
    (8,  11, 'Cash',   118000.00, '2026-06-01 14:05:00'),
    (9,  12, 'Mobile', 130000.00, '2026-06-01 14:35:00'),
    (10, 13, 'Card',   132000.00, '2026-06-02 09:05:00'),
    (11, 14, 'Cash',   115000.00, '2026-06-02 09:35:00'),
    (12, 15, 'Card',   120000.00, '2026-06-02 10:05:00'),
    (13, 16, 'Mobile',  73000.00, '2026-06-02 10:35:00'),
    (14, 17, 'Cash',    65000.00, '2026-06-02 11:05:00'),
    (16, 20, 'Mobile',  55000.00, '2026-06-02 15:05:00'),
    (17, 21, 'Cash',    49500.00, '2026-06-02 15:35:00'),
    (18, 22, 'Card',   120000.00, '2026-06-01 08:35:00'),
    (19, 23, 'Cash',    65000.00, '2026-06-01 09:20:00'),
    (22, 26, 'Card',   110000.00, '2026-06-02 09:35:00'),
    (24, 28, 'Cash',   130000.00, '2026-06-03 07:50:00');

-- ── order_promotion ───────────────────────────────────────────
INSERT INTO order_promotion (order_promotion_id, order_id, promotion_id, amount_discounted) VALUES
    (1, 21, 1, 5500.00);

-- ── loyalty_transaction ───────────────────────────────────────
-- Earn rate: floor(total_amount / 1000) pts per order
INSERT INTO loyalty_transaction (loyalty_txn_id, customer_id, order_id, points_change, txn_type, created_at) VALUES
    (1, 1,  9, 100, 'earn', '2026-06-01 11:05:00'),
    (2, 1, 20,  55, 'earn', '2026-06-02 15:05:00'),
    (3, 2,  6, 132, 'earn', '2026-06-01 09:35:00'),
    (4, 2, 12, 130, 'earn', '2026-06-01 14:35:00'),
    (5, 3,  8, 135, 'earn', '2026-06-01 10:35:00'),
    (6, 3, 13, 132, 'earn', '2026-06-02 09:05:00'),
    (7, 3, 16,  73, 'earn', '2026-06-02 10:35:00'),
    (8, 4, 10,  73, 'earn', '2026-06-01 11:35:00'),
    (9, 4, 17,  65, 'earn', '2026-06-02 11:05:00'),
    (10,5, 15, 120, 'earn', '2026-06-02 10:05:00');

-- ── audit_log ─────────────────────────────────────────────────
INSERT INTO audit_log (log_id, staff_id, action_type, table_affected, record_id, action_timestamp, details) VALUES
    (1, 5, 'CANCEL_ORDER', 'orders', 19, '2026-06-03 10:07:00', 'Customer changed mind — PIN verified');

SET FOREIGN_KEY_CHECKS = 1;

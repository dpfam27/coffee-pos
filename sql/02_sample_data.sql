-- =============================================================
-- FILE  : 02_sample_data.sql
-- DESC  : Sample data for Coffee Shop Chain POS
--         2 branches · 7 staff · 5 customers
--         13 menu items · 21 orders (3 pending, 17 paid, 1 cancelled)
-- All subtotals and totals are mathematically verified.
-- =============================================================

USE final;
SET FOREIGN_KEY_CHECKS = 0;

INSERT INTO location (location_id, name, address, phone) VALUES
    (1, 'Downtown Branch', '23 Nguyen Hue Boulevard, District 1, Ho Chi Minh City', '028-3822-1001'),
    (2, 'Airport Branch', 'Domestic Terminal, Tan Son Nhat Airport, Ho Chi Minh City', '028-3844-2002');

INSERT INTO staff (staff_id, location_id, name, role, phone) VALUES
    (1, 1, 'James Carter', 'Admin', '090-111-0001'),
    (2, 1, 'Sarah Nguyen', 'StoreManager', '090-111-0002'),
    (3, 2, 'Tom Pham', 'StoreManager', '090-111-0003'),
    (4, 1, 'Lisa Tran', 'ShiftLead', '090-111-0004'),
    (5, 1, 'Kevin Le', 'Barista', '090-111-0005'),
    (6, 1, 'Minh Hoang', 'Barista', '090-111-0006'),
    (7, 2, 'Lan Vo', 'Barista', '090-111-0007');

INSERT INTO customer (customer_id, name, email, phone, loyalty_points) VALUES
    (1, 'An Nguyen', 'an.nguyen@email.com', '090-201-0001', 155),
    (2, 'Binh Tran', 'binh.tran@email.com', '090-202-0002', 262),
    (3, 'Chau Le', 'chau.le@email.com', '090-203-0003', 340),
    (4, 'Dung Pham', 'dung.pham@email.com', '090-204-0004', 138),
    (5, 'Em Hoang', 'em.hoang@email.com', '090-205-0005', 120);

INSERT INTO menu_category (category_id, category_name) VALUES
    (1, 'Espresso'),
    (2, 'Cold Brew'),
    (3, 'Tea & Matcha'),
    (4, 'Food');

INSERT INTO menu_item (item_id, category_id, item_name, base_price, is_available) VALUES
    (1, 1, 'Espresso', 45000.00, 1),
    (2, 1, 'Cappuccino', 55000.00, 1),
    (3, 1, 'Cafe Latte', 55000.00, 1),
    (4, 1, 'Caramel Macchiato', 65000.00, 1),
    (5, 1, 'Flat White', 55000.00, 1),
    (6, 2, 'Cold Brew Classic', 55000.00, 1),
    (7, 2, 'Cold Brew Tonic', 65000.00, 1),
    (8, 3, 'Matcha Latte', 60000.00, 1),
    (9, 3, 'Chai Latte', 55000.00, 1),
    (10, 4, 'Croissant', 35000.00, 1),
    (11, 4, 'Blueberry Muffin', 40000.00, 1),
    (12, 4, 'Avocado Toast', 65000.00, 1),
    (13, 4, 'Banana Bread', 40000.00, 1);

INSERT INTO modifier_group (group_id, group_name, selection_type, is_required) VALUES
    (1, 'Size', 'single', 1),
    (2, 'Temperature', 'single', 1),
    (3, 'Milk', 'single', 0),
    (4, 'Sweetness', 'single', 0),
    (5, 'Add-on', 'multiple', 0);

INSERT INTO modifier_option (option_id, group_id, option_name, price_delta) VALUES
    (1, 1, 'Regular', 0.00),
    (2, 1, 'Large', 10000.00),
    (3, 2, 'Hot', 0.00),
    (4, 2, 'Iced', 0.00),
    (5, 3, 'Regular milk', 0.00),
    (6, 3, 'Oat milk', 8000.00),
    (7, 3, 'Almond milk', 8000.00),
    (8, 3, 'Soy milk', 5000.00),
    (9, 4, 'Normal', 0.00),
    (10, 4, 'Less sweet', 0.00),
    (11, 4, 'No sugar', 0.00),
    (12, 5, 'Extra shot', 12000.00),
    (13, 5, 'Extra syrup', 8000.00),
    (14, 5, 'Whipped cream', 10000.00);

INSERT INTO menu_item_modifier (item_modifier_id, item_id, group_id) VALUES
    (1, 1, 1),
    (2, 1, 2),
    (3, 1, 5),
    (4, 2, 1),
    (5, 2, 2),
    (6, 2, 3),
    (7, 2, 4),
    (8, 2, 5),
    (9, 3, 1),
    (10, 3, 2),
    (11, 3, 3),
    (12, 3, 4),
    (13, 3, 5),
    (14, 4, 1),
    (15, 4, 2),
    (16, 4, 3),
    (17, 4, 4),
    (18, 4, 5),
    (19, 5, 1),
    (20, 5, 2),
    (21, 5, 3),
    (22, 5, 5),
    (23, 6, 1),
    (24, 6, 3),
    (25, 6, 4),
    (26, 6, 5),
    (27, 7, 1),
    (28, 7, 4),
    (29, 7, 5),
    (30, 8, 1),
    (31, 8, 2),
    (32, 8, 3),
    (33, 8, 4),
    (34, 8, 5),
    (35, 9, 1),
    (36, 9, 2),
    (37, 9, 3),
    (38, 9, 4),
    (39, 9, 5);

INSERT INTO dining_table (table_id, location_id, table_number, status) VALUES
    (1, 1, 1, 'Available'),
    (2, 1, 2, 'Occupied'),
    (3, 1, 3, 'Available'),
    (4, 1, 4, 'Occupied'),
    (5, 1, 5, 'Available'),
    (6, 2, 1, 'Available'),
    (7, 2, 2, 'Available'),
    (8, 2, 3, 'Available'),
    (9, 2, 4, 'Available');

INSERT INTO ingredient (ingredient_id, location_id, name, stock_level, unit, low_stock_threshold) VALUES
    (1, 1, 'Arabica beans', 8.50, 'kg', 2.00),
    (2, 1, 'Whole milk', 12.00, 'liter', 5.00),
    (3, 1, 'Oat milk', 1.50, 'liter', 5.00),
    (4, 1, 'Almond milk', 3.00, 'liter', 2.00),
    (5, 1, 'Soy milk', 2.50, 'liter', 1.00),
    (6, 1, 'Espresso syrup', 1.20, 'liter', 0.50),
    (7, 1, 'Caramel syrup', 0.30, 'liter', 0.50),
    (8, 1, 'Matcha powder', 0.15, 'kg', 0.20),
    (9, 1, 'Chai mix', 0.90, 'kg', 0.30),
    (10, 1, 'Croissant', 10.00, 'unit', 5.00),
    (11, 1, 'Blueberry muffin', 8.00, 'unit', 4.00),
    (12, 2, 'Arabica beans', 6.00, 'kg', 2.00),
    (13, 2, 'Whole milk', 10.00, 'liter', 5.00),
    (14, 2, 'Oat milk', 4.00, 'liter', 3.00),
    (15, 2, 'Almond milk', 2.50, 'liter', 2.00),
    (16, 2, 'Soy milk', 1.50, 'liter', 1.00),
    (17, 2, 'Espresso syrup', 0.80, 'liter', 0.50),
    (18, 2, 'Caramel syrup', 0.70, 'liter', 0.50),
    (19, 2, 'Matcha powder', 0.40, 'kg', 0.20),
    (20, 2, 'Chai mix', 0.60, 'kg', 0.30),
    (21, 2, 'Croissant', 8.00, 'unit', 5.00),
    (22, 2, 'Blueberry muffin', 6.00, 'unit', 4.00);

INSERT INTO recipe (recipe_id, item_id, ingredient_id, quantity_required) VALUES
    (1, 1, 1, 0.01),
    (2, 2, 1, 0.01),
    (3, 2, 2, 0.08),
    (4, 3, 1, 0.01),
    (5, 3, 2, 0.20),
    (6, 4, 1, 0.01),
    (7, 4, 2, 0.20),
    (8, 4, 7, 0.02),
    (9, 5, 1, 0.02),
    (10, 5, 2, 0.15),
    (11, 6, 1, 0.02),
    (12, 7, 1, 0.02),
    (13, 7, 6, 0.01),
    (14, 8, 8, 0.01),
    (15, 8, 2, 0.20),
    (16, 9, 9, 0.01),
    (17, 9, 2, 0.20),
    (18, 10, 10, 1.00),
    (19, 11, 11, 1.00);

INSERT INTO modifier_recipe (mod_recipe_id, option_id, ingredient_id, quantity_required) VALUES
    (1, 6, 3, 0.20),
    (2, 7, 4, 0.20),
    (3, 8, 5, 0.20),
    (4, 12, 1, 0.01),
    (5, 13, 6, 0.01);

INSERT INTO promotion (promotion_id, name, discount_type, discount_value, start_date, end_date, is_active) VALUES
    (1, 'Happy Hour 10% Off', 'percent', 10.00, '2026-01-01', '2026-12-31', 1),
    (2, 'First Order 20k Off', 'fixed', 20000.00, '2026-01-01', '2026-06-30', 0);

INSERT INTO orders (order_id, location_id, staff_id, customer_id, table_id, order_type, order_date, order_status, total_amount) VALUES
    (1, 1, 5, NULL, 1, 'dine_in', '2026-06-03 08:15:02', 'Preparing', 155000.00),
    (2, 1, 5, NULL, NULL, 'takeaway', '2026-06-03 08:16:40', 'Pending', 65000.00),
    (3, 1, 6, 1, 2, 'dine_in', '2026-06-03 08:20:15', 'Preparing', 55000.00),
    (4, 1, 5, 2, NULL, 'takeaway', '2026-04-28 09:00:00', 'Paid', 50000.00),
    (5, 1, 5, 1, NULL, 'takeaway', '2026-06-01 09:00:00', 'Paid', 73000.00),
    (6, 1, 6, 2, 3, 'dine_in', '2026-06-01 09:30:00', 'Paid', 132000.00),
    (7, 1, 5, NULL, NULL, 'takeaway', '2026-06-01 10:00:00', 'Paid', 90000.00),
    (8, 1, 6, 3, 4, 'dine_in', '2026-06-01 10:30:00', 'Paid', 135000.00),
    (9, 1, 5, 1, NULL, 'takeaway', '2026-06-01 11:00:00', 'Paid', 100000.00),
    (10, 1, 4, 4, 5, 'dine_in', '2026-06-01 11:30:00', 'Paid', 73000.00),
    (11, 1, 6, NULL, NULL, 'takeaway', '2026-06-01 14:00:00', 'Paid', 118000.00),
    (12, 1, 5, 2, 1, 'dine_in', '2026-06-01 14:30:00', 'Paid', 130000.00),
    (13, 1, 6, 3, NULL, 'takeaway', '2026-06-02 09:00:00', 'Paid', 132000.00),
    (14, 1, 5, NULL, NULL, 'takeaway', '2026-06-02 09:30:00', 'Paid', 115000.00),
    (15, 1, 4, 5, 2, 'dine_in', '2026-06-02 10:00:00', 'Paid', 120000.00),
    (16, 1, 5, 3, NULL, 'takeaway', '2026-06-02 10:30:00', 'Paid', 73000.00),
    (17, 1, 6, 4, 3, 'dine_in', '2026-06-02 11:00:00', 'Paid', 65000.00),
    (18, 2, 7, NULL, 6, 'dine_in', '2026-06-02 11:30:00', 'Paid', 65000.00),
    (19, 1, 4, NULL, 3, 'dine_in', '2026-06-03 10:05:00', 'Cancelled', 55000.00),
    (20, 1, 5, 1, NULL, 'delivery', '2026-06-02 15:00:00', 'Paid', 55000.00),
    (21, 1, 5, 5, NULL, 'takeaway', '2026-06-02 15:30:00', 'Paid', 49500.00);

INSERT INTO order_item (order_item_id, order_id, item_id, quantity, unit_price, subtotal) VALUES
    (1, 1, 3, 1, 55000.00, 85000.00),
    (2, 1, 10, 2, 35000.00, 70000.00),
    (3, 2, 6, 1, 55000.00, 65000.00),
    (4, 3, 2, 1, 55000.00, 55000.00),
    (5, 4, 3, 1, 50000.00, 50000.00),
    (6, 5, 3, 1, 55000.00, 73000.00),
    (7, 6, 2, 1, 55000.00, 77000.00),
    (8, 6, 6, 1, 55000.00, 55000.00),
    (9, 7, 1, 2, 45000.00, 90000.00),
    (10, 8, 4, 1, 65000.00, 95000.00),
    (11, 8, 11, 1, 40000.00, 40000.00),
    (12, 9, 6, 1, 55000.00, 65000.00),
    (13, 9, 10, 1, 35000.00, 35000.00),
    (14, 10, 5, 1, 55000.00, 73000.00),
    (15, 11, 8, 1, 60000.00, 78000.00),
    (16, 11, 13, 1, 40000.00, 40000.00),
    (17, 12, 9, 1, 55000.00, 60000.00),
    (18, 12, 10, 2, 35000.00, 70000.00),
    (19, 13, 3, 1, 55000.00, 77000.00),
    (20, 13, 2, 1, 55000.00, 55000.00),
    (21, 14, 7, 1, 65000.00, 75000.00),
    (22, 14, 11, 1, 40000.00, 40000.00),
    (23, 15, 5, 1, 55000.00, 55000.00),
    (24, 15, 12, 1, 65000.00, 65000.00),
    (25, 16, 3, 1, 55000.00, 73000.00),
    (26, 17, 4, 1, 65000.00, 65000.00),
    (27, 18, 2, 1, 55000.00, 65000.00),
    (28, 19, 3, 1, 55000.00, 55000.00),
    (29, 20, 6, 1, 55000.00, 55000.00),
    (30, 21, 2, 1, 55000.00, 55000.00);

INSERT INTO order_item_modifier (oi_modifier_id, order_item_id, option_id, price_delta_at_sale) VALUES
    (1, 1, 2, 10000.00),
    (2, 1, 6, 8000.00),
    (3, 1, 12, 12000.00),
    (4, 3, 2, 10000.00),
    (5, 3, 10, 0.00),
    (6, 4, 1, 0.00),
    (7, 4, 3, 0.00),
    (8, 4, 5, 0.00),
    (9, 4, 9, 0.00),
    (10, 6, 2, 10000.00),
    (11, 6, 6, 8000.00),
    (12, 7, 2, 10000.00),
    (13, 7, 12, 12000.00),
    (14, 9, 1, 0.00),
    (15, 9, 3, 0.00),
    (16, 10, 2, 10000.00),
    (17, 10, 3, 0.00),
    (18, 10, 6, 8000.00),
    (19, 10, 9, 0.00),
    (20, 10, 12, 12000.00),
    (21, 12, 2, 10000.00),
    (22, 12, 10, 0.00),
    (23, 14, 2, 10000.00),
    (24, 14, 3, 0.00),
    (25, 14, 7, 8000.00),
    (26, 15, 2, 10000.00),
    (27, 15, 4, 0.00),
    (28, 15, 6, 8000.00),
    (29, 15, 10, 0.00),
    (30, 17, 1, 0.00),
    (31, 17, 3, 0.00),
    (32, 17, 8, 5000.00),
    (33, 17, 9, 0.00),
    (34, 19, 2, 10000.00),
    (35, 19, 3, 0.00),
    (36, 19, 5, 0.00),
    (37, 19, 9, 0.00),
    (38, 19, 12, 12000.00),
    (39, 20, 1, 0.00),
    (40, 20, 3, 0.00),
    (41, 20, 5, 0.00),
    (42, 20, 9, 0.00),
    (43, 21, 2, 10000.00),
    (44, 21, 11, 0.00),
    (45, 23, 1, 0.00),
    (46, 23, 3, 0.00),
    (47, 23, 5, 0.00),
    (48, 25, 2, 10000.00),
    (49, 25, 4, 0.00),
    (50, 25, 6, 8000.00),
    (51, 25, 10, 0.00),
    (52, 26, 1, 0.00),
    (53, 26, 3, 0.00),
    (54, 26, 5, 0.00),
    (55, 26, 9, 0.00),
    (56, 27, 2, 10000.00),
    (57, 27, 3, 0.00),
    (58, 27, 5, 0.00),
    (59, 27, 9, 0.00),
    (60, 29, 1, 0.00),
    (61, 29, 10, 0.00),
    (62, 30, 1, 0.00),
    (63, 30, 3, 0.00),
    (64, 30, 5, 0.00),
    (65, 30, 9, 0.00);

INSERT INTO payment (payment_id, order_id, payment_method, amount_paid, payment_time) VALUES
    (1, 4, 'Cash', 50000.00, '2026-04-28 09:05:00'),
    (2, 5, 'Mobile', 73000.00, '2026-06-01 09:05:00'),
    (3, 6, 'Card', 132000.00, '2026-06-01 09:35:00'),
    (4, 7, 'Cash', 90000.00, '2026-06-01 10:05:00'),
    (5, 8, 'Mobile', 135000.00, '2026-06-01 10:35:00'),
    (6, 9, 'Cash', 100000.00, '2026-06-01 11:05:00'),
    (7, 10, 'Card', 73000.00, '2026-06-01 11:35:00'),
    (8, 11, 'Cash', 118000.00, '2026-06-01 14:05:00'),
    (9, 12, 'Mobile', 130000.00, '2026-06-01 14:35:00'),
    (10, 13, 'Card', 132000.00, '2026-06-02 09:05:00'),
    (11, 14, 'Cash', 115000.00, '2026-06-02 09:35:00'),
    (12, 15, 'Card', 120000.00, '2026-06-02 10:05:00'),
    (13, 16, 'Mobile', 73000.00, '2026-06-02 10:35:00'),
    (14, 17, 'Cash', 65000.00, '2026-06-02 11:05:00'),
    (15, 18, 'Cash', 65000.00, '2026-06-02 11:35:00'),
    (16, 20, 'Mobile', 55000.00, '2026-06-02 15:05:00'),
    (17, 21, 'Cash', 49500.00, '2026-06-02 15:35:00');

INSERT INTO order_promotion (order_promotion_id, order_id, promotion_id, amount_discounted) VALUES
    (1, 21, 1, 5500.00);

INSERT INTO loyalty_transaction (loyalty_txn_id, customer_id, order_id, points_change, txn_type, created_at) VALUES
    (1, 1, 9, 100, 'earn', '2026-06-01 11:05:00'),
    (2, 1, 20, 55, 'earn', '2026-06-02 15:05:00'),
    (3, 2, 6, 132, 'earn', '2026-06-01 09:35:00'),
    (4, 2, 12, 130, 'earn', '2026-06-01 14:35:00'),
    (5, 3, 8, 135, 'earn', '2026-06-01 10:35:00'),
    (6, 3, 13, 132, 'earn', '2026-06-02 09:05:00'),
    (7, 3, 16, 73, 'earn', '2026-06-02 10:35:00'),
    (8, 4, 10, 73, 'earn', '2026-06-01 11:35:00'),
    (9, 4, 17, 65, 'earn', '2026-06-02 11:05:00'),
    (10, 5, 15, 120, 'earn', '2026-06-02 10:05:00');

INSERT INTO delivery (delivery_id, order_id, shipping_address, delivery_status) VALUES
    (1, 20, '45 Le Loi Street, District 1, Ho Chi Minh City', 'Delivered');

INSERT INTO audit_log (log_id, staff_id, action_type, table_affected, record_id, action_timestamp, details) VALUES
    (1, 4, 'VOID_ORDER', 'orders', 19, '2026-06-03 10:07:00', 'Customer changed mind');

SET FOREIGN_KEY_CHECKS = 1;

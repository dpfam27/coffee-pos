-- =============================================================
-- FILE  : 01_schema.sql
-- DB    : final
-- ENGINE: MySQL / MariaDB
-- DESC  : Full schema — Coffee POS — Coffee Shop Chain
--         17 tables + 1 view + 1 table shift_schedule
--         Business rules:
--           * Payment at counter immediately → order_status ENUM('Completed','Cancelled')
--           * No dining tables (takeaway / pickup only)
--           * Loyalty: earn floor(total/1000) pts; redeem 1pt = 1,000đ
--           * Cancel requires cancel_pin stored in location
-- =============================================================

CREATE DATABASE IF NOT EXISTS final
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE final;

SET FOREIGN_KEY_CHECKS = 0;

-- ── 1. location ───────────────────────────────────────────────
-- cancel_pin: 4-10 digit string; barista enters to confirm cancellation
DROP TABLE IF EXISTS location;
CREATE TABLE location (
    location_id INT          NOT NULL AUTO_INCREMENT,
    name        VARCHAR(255) NOT NULL,
    address     TEXT         NOT NULL,
    phone       VARCHAR(20),
    cancel_pin  VARCHAR(10)  NOT NULL DEFAULT '0000',
    PRIMARY KEY (location_id)
) ENGINE=InnoDB;

-- ── 2. staff ──────────────────────────────────────────────────
DROP TABLE IF EXISTS staff;
CREATE TABLE staff (
    staff_id      INT          NOT NULL AUTO_INCREMENT,
    location_id   INT          NOT NULL,
    name          VARCHAR(255) NOT NULL,
    role          ENUM('Admin','StoreManager','Barista') NOT NULL,
    phone         VARCHAR(20),
    is_active     TINYINT(1)   NOT NULL DEFAULT 1,
    password_hash VARCHAR(255) NOT NULL DEFAULT '',
    PRIMARY KEY (staff_id),
    CONSTRAINT fk_staff_location
        FOREIGN KEY (location_id) REFERENCES location(location_id)
) ENGINE=InnoDB;

-- ── 3. shift_schedule ─────────────────────────────────────────
DROP TABLE IF EXISTS shift_schedule;
CREATE TABLE shift_schedule (
    schedule_id INT  NOT NULL AUTO_INCREMENT,
    staff_id    INT  NOT NULL,
    location_id INT  NOT NULL,
    shift_type  ENUM('morning','afternoon','full_day') NOT NULL DEFAULT 'morning',
    day_of_week ENUM('Mon','Tue','Wed','Thu','Fri','Sat','Sun') NOT NULL,
    PRIMARY KEY (schedule_id),
    UNIQUE KEY uq_staff_day (staff_id, day_of_week),
    CONSTRAINT fk_sched_staff    FOREIGN KEY (staff_id)    REFERENCES staff(staff_id),
    CONSTRAINT fk_sched_location FOREIGN KEY (location_id) REFERENCES location(location_id)
) ENGINE=InnoDB;

-- ── 4. customer ───────────────────────────────────────────────
DROP TABLE IF EXISTS customer;
CREATE TABLE customer (
    customer_id    INT          NOT NULL AUTO_INCREMENT,
    name           VARCHAR(255) NOT NULL,
    email          VARCHAR(100),
    phone          VARCHAR(20),
    loyalty_points INT          NOT NULL DEFAULT 0,
    PRIMARY KEY (customer_id)
) ENGINE=InnoDB;

-- ── 5. menu_category ──────────────────────────────────────────
DROP TABLE IF EXISTS menu_category;
CREATE TABLE menu_category (
    category_id   INT          NOT NULL AUTO_INCREMENT,
    category_name VARCHAR(100) NOT NULL,
    PRIMARY KEY (category_id)
) ENGINE=InnoDB;

-- ── 6. menu_item ──────────────────────────────────────────────
DROP TABLE IF EXISTS menu_item;
CREATE TABLE menu_item (
    item_id      INT           NOT NULL AUTO_INCREMENT,
    category_id  INT           NOT NULL,
    item_name    VARCHAR(255)  NOT NULL,
    base_price   DECIMAL(10,2) NOT NULL,
    is_available TINYINT(1)    NOT NULL DEFAULT 1,
    PRIMARY KEY (item_id),
    CONSTRAINT fk_menuitem_category
        FOREIGN KEY (category_id) REFERENCES menu_category(category_id)
) ENGINE=InnoDB;

-- ── 7. modifier_group ─────────────────────────────────────────
DROP TABLE IF EXISTS modifier_group;
CREATE TABLE modifier_group (
    group_id       INT          NOT NULL AUTO_INCREMENT,
    group_name     VARCHAR(100) NOT NULL,
    selection_type ENUM('single','multiple') NOT NULL DEFAULT 'single',
    is_required    TINYINT(1)   NOT NULL DEFAULT 0,
    PRIMARY KEY (group_id)
) ENGINE=InnoDB;

-- ── 8. modifier_option ────────────────────────────────────────
DROP TABLE IF EXISTS modifier_option;
CREATE TABLE modifier_option (
    option_id   INT           NOT NULL AUTO_INCREMENT,
    group_id    INT           NOT NULL,
    option_name VARCHAR(100)  NOT NULL,
    price_delta DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    PRIMARY KEY (option_id),
    CONSTRAINT fk_modoption_group
        FOREIGN KEY (group_id) REFERENCES modifier_group(group_id)
) ENGINE=InnoDB;

-- ── 9. menu_item_modifier (M:N junction) ──────────────────────
DROP TABLE IF EXISTS menu_item_modifier;
CREATE TABLE menu_item_modifier (
    item_modifier_id INT NOT NULL AUTO_INCREMENT,
    item_id          INT NOT NULL,
    group_id         INT NOT NULL,
    PRIMARY KEY (item_modifier_id),
    UNIQUE KEY uq_item_group (item_id, group_id),
    CONSTRAINT fk_mim_item  FOREIGN KEY (item_id)  REFERENCES menu_item(item_id),
    CONSTRAINT fk_mim_group FOREIGN KEY (group_id) REFERENCES modifier_group(group_id)
) ENGINE=InnoDB;

-- ── 10. orders ────────────────────────────────────────────────
-- customer_id NULL = walk-in (no loyalty account)
-- No table_id — coffee shop pays at counter immediately
-- order_status: Completed = payment received; Cancelled = voided with PIN
DROP TABLE IF EXISTS orders;
CREATE TABLE orders (
    order_id     INT           NOT NULL AUTO_INCREMENT,
    location_id  INT           NOT NULL,
    staff_id     INT           NOT NULL,
    customer_id  INT           NULL,
    order_type   ENUM('takeaway','pickup') NOT NULL DEFAULT 'takeaway',
    order_date   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    order_status ENUM('Completed','Cancelled') NOT NULL DEFAULT 'Completed',
    total_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    PRIMARY KEY (order_id),
    CONSTRAINT fk_orders_location FOREIGN KEY (location_id) REFERENCES location(location_id),
    CONSTRAINT fk_orders_staff    FOREIGN KEY (staff_id)    REFERENCES staff(staff_id),
    CONSTRAINT fk_orders_customer FOREIGN KEY (customer_id) REFERENCES customer(customer_id)
) ENGINE=InnoDB;

-- ── 11. order_item ────────────────────────────────────────────
-- unit_price = snapshot of base_price at time of sale (price integrity)
-- subtotal   = (unit_price + SUM(price_delta_at_sale)) * quantity
DROP TABLE IF EXISTS order_item;
CREATE TABLE order_item (
    order_item_id INT           NOT NULL AUTO_INCREMENT,
    order_id      INT           NOT NULL,
    item_id       INT           NOT NULL,
    quantity      INT           NOT NULL DEFAULT 1,
    unit_price    DECIMAL(10,2) NOT NULL,
    subtotal      DECIMAL(10,2) NOT NULL,
    PRIMARY KEY (order_item_id),
    CONSTRAINT fk_oi_order FOREIGN KEY (order_id) REFERENCES orders(order_id),
    CONSTRAINT fk_oi_item  FOREIGN KEY (item_id)  REFERENCES menu_item(item_id)
) ENGINE=InnoDB;

-- ── 12. order_item_modifier ───────────────────────────────────
DROP TABLE IF EXISTS order_item_modifier;
CREATE TABLE order_item_modifier (
    oi_modifier_id      INT           NOT NULL AUTO_INCREMENT,
    order_item_id       INT           NOT NULL,
    option_id           INT           NOT NULL,
    price_delta_at_sale DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    PRIMARY KEY (oi_modifier_id),
    CONSTRAINT fk_oim_orderitem FOREIGN KEY (order_item_id) REFERENCES order_item(order_item_id),
    CONSTRAINT fk_oim_option    FOREIGN KEY (option_id)     REFERENCES modifier_option(option_id)
) ENGINE=InnoDB;

-- ── 13. payment ───────────────────────────────────────────────
DROP TABLE IF EXISTS payment;
CREATE TABLE payment (
    payment_id     INT           NOT NULL AUTO_INCREMENT,
    order_id       INT           NOT NULL,
    payment_method ENUM('Cash','Card','Mobile') NOT NULL,
    amount_paid    DECIMAL(10,2) NOT NULL,
    payment_time   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (payment_id),
    CONSTRAINT fk_payment_order FOREIGN KEY (order_id) REFERENCES orders(order_id)
) ENGINE=InnoDB;

-- ── 14. ingredient (per-branch stock) ────────────────────────
DROP TABLE IF EXISTS ingredient;
CREATE TABLE ingredient (
    ingredient_id       INT           NOT NULL AUTO_INCREMENT,
    location_id         INT           NOT NULL,
    name                VARCHAR(255)  NOT NULL,
    stock_level         DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    unit                VARCHAR(50)   NOT NULL,
    low_stock_threshold DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    PRIMARY KEY (ingredient_id),
    CONSTRAINT fk_ingredient_location
        FOREIGN KEY (location_id) REFERENCES location(location_id)
) ENGINE=InnoDB;

-- ── 15. promotion ─────────────────────────────────────────────
DROP TABLE IF EXISTS promotion;
CREATE TABLE promotion (
    promotion_id   INT           NOT NULL AUTO_INCREMENT,
    name           VARCHAR(255)  NOT NULL,
    discount_type  ENUM('percent','fixed') NOT NULL,
    discount_value DECIMAL(10,2) NOT NULL,
    start_date     DATE          NOT NULL,
    end_date       DATE          NOT NULL,
    is_active      TINYINT(1)    NOT NULL DEFAULT 1,
    PRIMARY KEY (promotion_id)
) ENGINE=InnoDB;

-- ── 16. order_promotion ───────────────────────────────────────
DROP TABLE IF EXISTS order_promotion;
CREATE TABLE order_promotion (
    order_promotion_id INT           NOT NULL AUTO_INCREMENT,
    order_id           INT           NOT NULL,
    promotion_id       INT           NOT NULL,
    amount_discounted  DECIMAL(10,2) NOT NULL,
    PRIMARY KEY (order_promotion_id),
    CONSTRAINT fk_op_order     FOREIGN KEY (order_id)     REFERENCES orders(order_id),
    CONSTRAINT fk_op_promotion FOREIGN KEY (promotion_id) REFERENCES promotion(promotion_id)
) ENGINE=InnoDB;

-- ── 17. loyalty_transaction ───────────────────────────────────
-- Append-only ledger. Earn rate: floor(total_amount / 1000) pts.
-- Redeem rate: 1pt = 1,000đ off.
-- customer.loyalty_points is a cached balance (updated on each order).
DROP TABLE IF EXISTS loyalty_transaction;
CREATE TABLE loyalty_transaction (
    loyalty_txn_id INT      NOT NULL AUTO_INCREMENT,
    customer_id    INT      NOT NULL,
    order_id       INT      NOT NULL,
    points_change  INT      NOT NULL,
    txn_type       ENUM('earn','redeem') NOT NULL,
    created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (loyalty_txn_id),
    CONSTRAINT fk_lt_customer FOREIGN KEY (customer_id) REFERENCES customer(customer_id),
    CONSTRAINT fk_lt_order    FOREIGN KEY (order_id)    REFERENCES orders(order_id)
) ENGINE=InnoDB;

-- ── 18. audit_log ─────────────────────────────────────────────
DROP TABLE IF EXISTS audit_log;
CREATE TABLE audit_log (
    log_id           INT         NOT NULL AUTO_INCREMENT,
    staff_id         INT         NOT NULL,
    action_type      VARCHAR(50) NOT NULL,
    table_affected   VARCHAR(50) NOT NULL,
    record_id        INT         NOT NULL,
    action_timestamp DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    details          TEXT,
    PRIMARY KEY (log_id),
    CONSTRAINT fk_auditlog_staff FOREIGN KEY (staff_id) REFERENCES staff(staff_id)
) ENGINE=InnoDB;

SET FOREIGN_KEY_CHECKS = 1;

-- =============================================================
-- VIEW: v_customer_loyalty_balance
-- Computes each customer's balance from loyalty_transaction ledger.
-- =============================================================
CREATE OR REPLACE VIEW v_customer_loyalty_balance AS
SELECT
    c.customer_id,
    c.name,
    c.phone,
    COALESCE(
        SUM(
            CASE
                WHEN lt.txn_type = 'earn'   THEN  lt.points_change
                WHEN lt.txn_type = 'redeem' THEN -lt.points_change
            END
        ), 0
    ) AS points_balance
FROM customer c
LEFT JOIN loyalty_transaction lt ON lt.customer_id = c.customer_id
GROUP BY c.customer_id, c.name, c.phone;

<?php
// =============================================================
// FILE : api/order_details.php
// DESC : Fetch comprehensive details of a single order for invoice rendering
// =============================================================

require_once __DIR__ . '/_helpers.php';
require_once __DIR__ . '/db.php';

// Authentication required
require_login();

$order_id = isset($_GET['order_id']) ? (int)$_GET['order_id'] : 0;
if (!$order_id) {
    json(['success' => false, 'error' => 'Mã đơn hàng không hợp lệ'], 400);
}

try {
    // 1. Fetch main order information
    $order_stmt = $conn->prepare("
        SELECT o.order_id, o.order_date, o.order_type, o.order_status, o.total_amount,
               t.table_number, s.name as staff_name, c.name as customer_name,
               l.name as location_name, l.phone as location_phone,
               p.payment_method,
               COALESCE(op.amount_discounted, 0) as promo_discount,
               COALESCE((
                   SELECT SUM(points_change) 
                   FROM loyalty_transaction 
                   WHERE order_id = o.order_id AND txn_type = 'redeem'
               ), 0) as points_redeemed
        FROM   orders o
        LEFT JOIN dining_table t ON o.table_id = t.table_id
        JOIN   staff s ON o.staff_id = s.staff_id
        LEFT JOIN customer c ON o.customer_id = c.customer_id
        JOIN   location l ON o.location_id = l.location_id
        LEFT JOIN payment p ON o.order_id = p.order_id
        LEFT JOIN order_promotion op ON o.order_id = op.order_id
        WHERE  o.order_id = ?
        LIMIT 1
    ");
    $order_stmt->bind_param('i', $order_id);
    $order_stmt->execute();
    $order = $order_stmt->get_result()->fetch_assoc();
    $order_stmt->close();
    
    if (!$order) {
        json(['success' => false, 'error' => 'Không tìm thấy đơn hàng'], 404);
    }
    
    // 2. Fetch order items with their customizations
    $items_stmt = $conn->prepare("
        SELECT oi.order_item_id, mi.item_name, oi.quantity, oi.unit_price, oi.subtotal,
               GROUP_CONCAT(
                   mo.option_name 
                   ORDER BY mg.group_name 
                   SEPARATOR ', '
               ) as customizations
        FROM   order_item oi
        JOIN   menu_item mi ON oi.item_id = mi.item_id
        LEFT JOIN order_item_modifier oim ON oim.order_item_id = oi.order_item_id
        LEFT JOIN modifier_option mo ON oim.option_id = mo.option_id
        LEFT JOIN modifier_group mg ON mo.group_id = mg.group_id
        WHERE  oi.order_id = ?
        GROUP BY oi.order_item_id, mi.item_name, oi.quantity, oi.unit_price, oi.subtotal
    ");
    $items_stmt->bind_param('i', $order_id);
    $items_stmt->execute();
    $items = $items_stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $items_stmt->close();
    
    // Calculate subtotal amount (before discounts)
    $subtotal_amount = 0;
    foreach ($items as &$it) {
        $it['quantity'] = (int)$it['quantity'];
        $it['unit_price'] = (float)$it['unit_price'];
        $it['subtotal'] = (float)$it['subtotal'];
        $subtotal_amount += $it['subtotal'];
    }
    unset($it);
    
    // Format numeric values of the order
    $order['total_amount'] = (float)$order['total_amount'];
    $order['promo_discount'] = (float)$order['promo_discount'];
    $order['points_redeemed'] = (int)$order['points_redeemed'];
    $order['discount_amount'] = $order['promo_discount'] + ($order['points_redeemed'] * 100);
    $order['subtotal_amount'] = $subtotal_amount;
    
    // Attach items
    $order['items'] = $items;
    
    json(['success' => true, 'data' => $order]);

} catch (Exception $e) {
    json(['success' => false, 'error' => 'Lỗi tải hóa đơn chi tiết: ' . $e->getMessage()], 500);
}

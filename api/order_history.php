<?php
// =============================================================
// FILE : api/order_history.php
// DESC : Fetch recent orders history for the logged-in staff's location
// =============================================================

require_once __DIR__ . '/_helpers.php';
require_once __DIR__ . '/db.php';

// Authentication required
require_login();

$location_id = $_SESSION['location_id'] ?? null;
if (!$location_id) {
    json(['success' => false, 'error' => 'Không xác định được chi nhánh làm việc'], 400);
}

try {
    $stmt = $conn->prepare("
        SELECT o.order_id, o.order_type, o.order_date, o.order_status, o.total_amount,
               t.table_number, s.name as staff_name, c.name as customer_name
        FROM   orders o
        LEFT JOIN dining_table t ON o.table_id = t.table_id
        JOIN   staff s ON o.staff_id = s.staff_id
        LEFT JOIN customer c ON o.customer_id = c.customer_id
        WHERE  o.location_id = ?
        ORDER BY o.order_date DESC
        LIMIT 50
    ");
    $stmt->bind_param('i', $location_id);
    $stmt->execute();
    $orders = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt->close();
    
    // Format numeric values
    foreach ($orders as &$order) {
        $order['total_amount'] = (float)$order['total_amount'];
    }
    unset($order);
    
    json(['success' => true, 'data' => $orders]);

} catch (Exception $e) {
    json(['success' => false, 'error' => 'Lỗi tải lịch sử đơn hàng: ' . $e->getMessage()], 500);
}

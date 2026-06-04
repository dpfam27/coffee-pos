<?php
// =============================================================
// FILE : api/branch_daily_revenue.php
// DESC : Fetch daily revenue summary for a branch (for ShiftLead/Manager)
//        Returns last 7 days of this branch's sales
// =============================================================

require_once __DIR__ . '/_helpers.php';
require_once __DIR__ . '/db.php';

require_login();

$location_id = $_SESSION['location_id'] ?? null;
if (!$location_id) {
    json(['success' => false, 'error' => 'Không xác định được chi nhánh'], 400);
}

try {
    $stmt = $conn->prepare("
        SELECT 
            DATE(order_date)        AS sale_date,
            COUNT(order_id)         AS total_orders,
            SUM(total_amount)       AS total_revenue
        FROM   orders
        WHERE  location_id = ?
          AND  order_status = 'Paid'
          AND  order_date >= CURDATE() - INTERVAL 7 DAY
        GROUP  BY DATE(order_date)
        ORDER  BY sale_date DESC
    ");
    $stmt->bind_param('i', $location_id);
    $stmt->execute();
    $rows = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt->close();

    foreach ($rows as &$row) {
        $row['total_revenue'] = (float)$row['total_revenue'];
        $row['total_orders']  = (int)$row['total_orders'];
    }
    unset($row);

    json(['success' => true, 'data' => $rows]);

} catch (Exception $e) {
    json(['success' => false, 'error' => 'Lỗi: ' . $e->getMessage()], 500);
}

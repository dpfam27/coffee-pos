<?php
// =============================================================
// FILE : api/sales_by_item.php
// DESC : Fetch sales statistics by menu items for the branch
// =============================================================

require_once __DIR__ . '/_helpers.php';
require_once __DIR__ . '/db.php';

// Authentication required
require_login();
require_role(['StoreManager', 'Admin']);

$location_id = $_SESSION['location_id'] ?? null;
if (!$location_id) {
    json(['success' => false, 'error' => 'Không xác định được chi nhánh làm việc'], 400);
}

try {
    $stmt = $conn->prepare("
        SELECT mi.item_name, 
               SUM(oi.quantity) as quantity_sold, 
               SUM(oi.subtotal) as total_revenue
        FROM   order_item oi
        JOIN   orders o ON oi.order_id = o.order_id
        JOIN   menu_item mi ON oi.item_id = mi.item_id
        WHERE  o.location_id = ? 
          AND  o.order_status = 'Paid'
        GROUP BY mi.item_id, mi.item_name
        ORDER BY total_revenue DESC
    ");
    $stmt->bind_param('i', $location_id);
    $stmt->execute();
    $data = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt->close();
    
    // Format numeric values
    foreach ($data as &$row) {
        $row['quantity_sold'] = (int)$row['quantity_sold'];
        $row['total_revenue'] = (float)$row['total_revenue'];
    }
    unset($row);
    
    json(['success' => true, 'data' => $data]);

} catch (Exception $e) {
    json(['success' => false, 'error' => 'Lỗi tải báo cáo doanh số món: ' . $e->getMessage()], 500);
}

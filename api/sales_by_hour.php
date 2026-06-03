<?php
// =============================================================
// FILE : api/sales_by_hour.php
// DESC : Fetch hourly sales stats for the branch
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
        SELECT HOUR(o.order_date) as hour_of_day, 
               COUNT(o.order_id) as order_count, 
               SUM(o.total_amount) as total_revenue
        FROM   orders o
        WHERE  o.location_id = ? 
          AND  o.order_status = 'Paid'
        GROUP BY HOUR(o.order_date)
        ORDER BY hour_of_day ASC
    ");
    $stmt->bind_param('i', $location_id);
    $stmt->execute();
    $data = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt->close();
    
    // Format numeric values
    foreach ($data as &$row) {
        $row['hour_of_day'] = (int)$row['hour_of_day'];
        $row['order_count'] = (int)$row['order_count'];
        $row['total_revenue'] = (float)$row['total_revenue'];
    }
    unset($row);
    
    // Populate all 24 hours to make chart rendering easy on the front-end
    $hourly_map = array_fill(0, 24, ['order_count' => 0, 'total_revenue' => 0.0]);
    foreach ($data as $row) {
        $hourly_map[$row['hour_of_day']] = [
            'order_count' => $row['order_count'],
            'total_revenue' => $row['total_revenue']
        ];
    }
    
    $result = [];
    foreach ($hourly_map as $hour => $stats) {
        $result[] = [
            'hour_of_day' => $hour,
            'order_count' => $stats['order_count'],
            'total_revenue' => $stats['total_revenue']
        ];
    }
    
    json(['success' => true, 'data' => $result]);

} catch (Exception $e) {
    json(['success' => false, 'error' => 'Lỗi tải báo cáo doanh số theo giờ: ' . $e->getMessage()], 500);
}

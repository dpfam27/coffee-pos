<?php
// =============================================================
// FILE : api/daily_revenue.php
// DESC : Fetch daily revenue aggregates for the entire chain
// =============================================================

require_once __DIR__ . '/_helpers.php';
require_once __DIR__ . '/db.php';

// Authentication required
require_login();
require_role('Admin');

try {
    $res = $conn->query("
        SELECT 
            DATE(o.order_date)          AS sale_date,
            COUNT(o.order_id)           AS total_orders,
            SUM(o.total_amount)         AS total_revenue,
            SUM(CASE WHEN o.location_id = 1 THEN o.total_amount ELSE 0 END) AS downtown_revenue,
            SUM(CASE WHEN o.location_id = 2 THEN o.total_amount ELSE 0 END) AS airport_revenue
        FROM   orders o
        WHERE  o.order_status = 'Paid'
        GROUP BY DATE(o.order_date)
        ORDER BY sale_date DESC
        LIMIT 30
    ");

    $rows = $res->fetch_all(MYSQLI_ASSOC);

    foreach ($rows as &$row) {
        $row['total_revenue']     = (float)$row['total_revenue'];
        $row['downtown_revenue']  = (float)$row['downtown_revenue'];
        $row['airport_revenue']   = (float)$row['airport_revenue'];
        $row['total_orders']      = (int)$row['total_orders'];
    }
    unset($row);

    json(['success' => true, 'data' => $rows]);

} catch (Exception $e) {
    json(['success' => false, 'error' => 'Lỗi tải dữ liệu doanh thu theo ngày: ' . $e->getMessage()], 500);
}

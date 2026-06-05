<?php
// =============================================================
// FILE : api/sales_by_hour.php
// DESC : Revenue over time — filter by day / week / month
// PARAMS: GET period = day|week|month (default: day)
// =============================================================

require_once __DIR__ . '/_helpers.php';
require_once __DIR__ . '/db.php';

require_login();
require_role(['StoreManager', 'Admin']);

$location_id = $_SESSION['location_id'] ?? null;
if (!$location_id) {
    json(['success' => false, 'error' => 'Không xác định được chi nhánh làm việc'], 400);
}

$period = $_GET['period'] ?? 'day';

try {
    if ($period === 'month') {
        $stmt = $conn->prepare("
            SELECT DATE_FORMAT(o.order_date, '%Y-%m') AS period_key,
                   DATE_FORMAT(o.order_date, '%m/%Y')  AS period_label,
                   COUNT(o.order_id)   AS order_count,
                   SUM(o.total_amount) AS total_revenue
            FROM   orders o
            WHERE  o.location_id = ?
              AND  o.order_status = 'Completed'
            GROUP BY period_key, period_label
            ORDER BY period_key ASC
        ");
    } elseif ($period === 'week') {
        $stmt = $conn->prepare("
            SELECT YEARWEEK(o.order_date, 1)                                AS period_key,
                   CONCAT('Tuần ', WEEK(o.order_date,1), '/', YEAR(o.order_date)) AS period_label,
                   COUNT(o.order_id)   AS order_count,
                   SUM(o.total_amount) AS total_revenue
            FROM   orders o
            WHERE  o.location_id = ?
              AND  o.order_status = 'Completed'
            GROUP BY period_key, period_label
            ORDER BY period_key ASC
        ");
    } else {
        // day: hourly breakdown for today
        $stmt = $conn->prepare("
            SELECT HOUR(o.order_date)  AS period_key,
                   CONCAT(LPAD(HOUR(o.order_date),2,'0'), ':00') AS period_label,
                   COUNT(o.order_id)   AS order_count,
                   SUM(o.total_amount) AS total_revenue
            FROM   orders o
            WHERE  o.location_id = ?
              AND  o.order_status = 'Completed'
              AND  DATE(o.order_date) = CURDATE()
            GROUP BY period_key, period_label
            ORDER BY period_key ASC
        ");
    }

    $stmt->bind_param('i', $location_id);
    $stmt->execute();
    $data = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt->close();

    foreach ($data as &$row) {
        $row['order_count']   = (int)$row['order_count'];
        $row['total_revenue'] = (float)$row['total_revenue'];
    }
    unset($row);

    json(['success' => true, 'data' => $data, 'period' => $period]);

} catch (Exception $e) {
    json(['success' => false, 'error' => 'Lỗi tải báo cáo doanh thu: ' . $e->getMessage()], 500);
}

<?php
// =============================================================
// FILE : api/branch_daily_revenue.php
// DESC : Revenue over time — Admin (toàn chuỗi) / Manager (branch)
// PARAMS: GET period = day|week|month (default: day)
// =============================================================

require_once __DIR__ . '/_helpers.php';
require_once __DIR__ . '/db.php';

require_login();

$role        = $_SESSION['role'] ?? '';
$location_id = (int)($_SESSION['location_id'] ?? 0);
$period      = $_GET['period'] ?? 'day';
$is_admin    = ($role === 'Admin');

// Admin: no location filter; others: scope to own branch
$loc_clause = $is_admin ? '' : 'AND o.location_id = ?';

try {
    if ($period === 'month') {
        $sql = "
            SELECT DATE_FORMAT(o.order_date,'%Y-%m')  AS period_key,
                   DATE_FORMAT(o.order_date,'%m/%Y')  AS period_label,
                   COUNT(o.order_id)                  AS order_count,
                   SUM(o.total_amount)                AS total_revenue
            FROM   orders o
            WHERE  o.order_status = 'Completed' $loc_clause
            GROUP  BY period_key, period_label
            ORDER  BY period_key ASC
        ";
    } elseif ($period === 'week') {
        $sql = "
            SELECT YEARWEEK(o.order_date,1)                                  AS period_key,
                   CONCAT('Tuần ',WEEK(o.order_date,1),'/',YEAR(o.order_date)) AS period_label,
                   COUNT(o.order_id)                                         AS order_count,
                   SUM(o.total_amount)                                       AS total_revenue
            FROM   orders o
            WHERE  o.order_status = 'Completed' $loc_clause
            GROUP  BY period_key, period_label
            ORDER  BY period_key ASC
        ";
    } else {
        // day: hourly for today
        $sql = "
            SELECT HOUR(o.order_date)                             AS period_key,
                   CONCAT(LPAD(HOUR(o.order_date),2,'0'),':00')  AS period_label,
                   COUNT(o.order_id)                              AS order_count,
                   SUM(o.total_amount)                            AS total_revenue
            FROM   orders o
            WHERE  o.order_status = 'Completed'
              AND  DATE(o.order_date) = CURDATE() $loc_clause
            GROUP  BY period_key, period_label
            ORDER  BY period_key ASC
        ";
    }

    if ($is_admin) {
        $result = $conn->query($sql);
        $rows   = $result->fetch_all(MYSQLI_ASSOC);
    } else {
        if (!$location_id) json(['success' => false, 'error' => 'Không xác định chi nhánh'], 400);
        $stmt = $conn->prepare($sql);
        $stmt->bind_param('i', $location_id);
        $stmt->execute();
        $rows = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
        $stmt->close();
    }

    foreach ($rows as &$row) {
        $row['order_count']   = (int)$row['order_count'];
        $row['total_revenue'] = (float)$row['total_revenue'];
    }
    unset($row);

    json(['success' => true, 'data' => $rows, 'period' => $period]);

} catch (Exception $e) {
    json(['success' => false, 'error' => 'Lỗi: ' . $e->getMessage()], 500);
}

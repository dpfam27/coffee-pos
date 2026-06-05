<?php
// =============================================================
// FILE  : api/best_sellers.php
// UC4   : High-Volume Menu Items  (Admin)
// PARAMS: GET min_units (int, default 1 for demo — use 500 in prod)
// NOTE  : HAVING threshold set to 1 for demo dataset.
//         Change to 500 for production data.
// =============================================================

require_once __DIR__ . '/_helpers.php';
require_once __DIR__ . '/db.php';

require_login();

// Default 1 for demo; frontend can pass ?min_units=500 for production
$min_units = isset($_GET['min_units']) ? (int) $_GET['min_units'] : 1;

$sql = "
    SELECT
        mi.item_name,
        SUM(oi.quantity)  AS units_sold,
        SUM(oi.subtotal)  AS revenue
    FROM   order_item oi
    JOIN   orders    o  ON o.order_id  = oi.order_id
    JOIN   menu_item mi ON mi.item_id  = oi.item_id
    WHERE  o.order_status = 'Completed'
      AND  o.order_date  >= DATE_FORMAT(CURDATE(), '%Y-%m-01')
    GROUP BY mi.item_id, mi.item_name
    HAVING SUM(oi.quantity) >= ?
    ORDER BY units_sold DESC
";

$stmt = $conn->prepare($sql);
$stmt->bind_param('i', $min_units);
$stmt->execute();
$data = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);

echo json_encode(['success' => true, 'data' => $data]);

$stmt->close();
$conn->close();

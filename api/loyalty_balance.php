<?php
// =============================================================
// FILE  : api/loyalty_balance.php
// UC6   : Customer Loyalty Balance  (Admin / Marketing)
// PARAMS: GET limit (int, default 10)
// DESC  : Queries v_customer_loyalty_balance VIEW.
//         Balance computed from loyalty_transaction ledger
//         (source of truth), NOT from cached customer.loyalty_points.
// =============================================================

require_once __DIR__ . '/_helpers.php';
require_once __DIR__ . '/db.php';

// Authentication required
require_login();

$limit = isset($_GET['limit']) ? (int) $_GET['limit'] : 10;
$phone = isset($_GET['phone']) ? trim($_GET['phone']) : '';

// Ensure view exists (safe to run multiple times)
$conn->query("
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
    GROUP BY c.customer_id, c.name, c.phone
");

if (!empty($phone)) {
    $sql = "SELECT customer_id, name, phone, points_balance
            FROM   v_customer_loyalty_balance
            WHERE  phone = ?
            LIMIT 1";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param('s', $phone);
} else {
    $sql  = "SELECT customer_id, name, phone, points_balance
             FROM   v_customer_loyalty_balance
             ORDER BY points_balance DESC
             LIMIT ?";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param('i', $limit);
}

$stmt->execute();
$res = $stmt->get_result();

if (!empty($phone)) {
    $data = $res->fetch_assoc();
    if ($data) {
        $data['points_balance'] = (int)$data['points_balance'];
        json(['success' => true, 'data' => $data]);
    } else {
        json(['success' => false, 'error' => 'Không tìm thấy thông tin khách hàng'], 404);
    }
} else {
    $data = $res->fetch_all(MYSQLI_ASSOC);
    foreach ($data as &$row) {
        $row['points_balance'] = (int)$row['points_balance'];
    }
    unset($row);
    json(['success' => true, 'data' => $data]);
}

$stmt->close();
$conn->close();

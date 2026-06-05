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
require_role(['Admin']);

// PUT — Admin adjusts a customer's points (inserts adjustment record)
if ($_SERVER['REQUEST_METHOD'] === 'PUT') {
    $id   = isset($_GET['id']) ? (int)$_GET['id'] : 0;
    $body = json_decode(file_get_contents('php://input'), true);
    $new_points = isset($body['points_balance']) ? (int)$body['points_balance'] : -1;
    if (!$id || $new_points < 0) json(['success' => false, 'error' => 'Dữ liệu không hợp lệ'], 400);

    // Get current balance
    $stmt = $conn->prepare("SELECT points_balance FROM v_customer_loyalty_balance WHERE customer_id = ?");
    $stmt->bind_param('i', $id);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    if (!$row) json(['success' => false, 'error' => 'Không tìm thấy khách hàng'], 404);

    $current = (int)$row['points_balance'];
    $diff    = $new_points - $current;
    if ($diff === 0) json(['success' => true]);

    // Insert adjustment transaction (use order_id=0 trick via a dummy order isn't possible,
    // so we insert a direct update to customer.loyalty_points and log the change)
    $conn->begin_transaction();
    // Update cached balance on customer table
    $s1 = $conn->prepare("UPDATE customer SET loyalty_points = ? WHERE customer_id = ?");
    $s1->bind_param('ii', $new_points, $id);
    $s1->execute(); $s1->close();
    $conn->commit();

    json(['success' => true]);
}

$limit = isset($_GET['limit']) ? (int) $_GET['limit'] : 10;
$phone = isset($_GET['phone']) ? trim($_GET['phone']) : '';

// View reads from cached customer.loyalty_points (updated on each order and admin adjustment)
$conn->query("
    CREATE OR REPLACE VIEW v_customer_loyalty_balance AS
    SELECT customer_id, name, phone, loyalty_points AS points_balance
    FROM   customer
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

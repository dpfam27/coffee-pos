<?php
// =============================================================
// FILE  : api/prep_queue.php
// DESC  : Beverage Preparation Queue (Barista) + Cancel order
// Cancel rule: requires manager PIN stored in location.cancel_pin
//              (fallback hardcoded PIN: "0000" until location table updated)
// =============================================================

require_once __DIR__ . '/_helpers.php';
require_once __DIR__ . '/db.php';

require_login();

$location_id = (int)($_SESSION['location_id'] ?? 0);

// ── POST: cancel an order ──────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input    = json_decode(file_get_contents('php://input'), true);
    $order_id = isset($input['order_id']) ? (int)$input['order_id'] : 0;
    $pin      = trim($input['cancel_pin'] ?? '');

    if (!$order_id || $pin === '') {
        json(['success' => false, 'error' => 'Thiếu mã đơn hoặc mã xác nhận hủy'], 400);
    }

    // Verify PIN against location's manager cancel pin
    // cancel_pin column will be added to location table in Phase 8 schema update
    // For now fall back to a configurable constant
    define('CANCEL_PIN', '0000');
    $valid_pin = CANCEL_PIN;

    // Try to read per-location pin if column exists
    $pin_check = $conn->query("SHOW COLUMNS FROM location LIKE 'cancel_pin'");
    if ($pin_check && $pin_check->num_rows > 0) {
        $lpin_stmt = $conn->prepare("SELECT cancel_pin FROM location WHERE location_id = ?");
        $lpin_stmt->bind_param('i', $location_id);
        $lpin_stmt->execute();
        $lpin_row = $lpin_stmt->get_result()->fetch_assoc();
        $lpin_stmt->close();
        if ($lpin_row && !empty($lpin_row['cancel_pin'])) {
            $valid_pin = $lpin_row['cancel_pin'];
        }
    }

    if ($pin !== $valid_pin) {
        json(['success' => false, 'error' => 'Mã xác nhận không đúng'], 403);
    }

    // Verify order belongs to this location
    $chk = $conn->prepare("SELECT order_id, order_status FROM orders WHERE order_id = ? AND location_id = ?");
    $chk->bind_param('ii', $order_id, $location_id);
    $chk->execute();
    $order_row = $chk->get_result()->fetch_assoc();
    $chk->close();

    if (!$order_row) {
        json(['success' => false, 'error' => 'Đơn hàng không tồn tại tại chi nhánh này'], 404);
    }
    if ($order_row['order_status'] === 'Cancelled') {
        json(['success' => false, 'error' => 'Đơn hàng đã bị hủy trước đó'], 409);
    }

    try {
        $upd = $conn->prepare("UPDATE orders SET order_status = 'Cancelled' WHERE order_id = ?");
        $upd->bind_param('i', $order_id);
        $upd->execute();
        $upd->close();

        $staff_id = (int)$_SESSION['staff_id'];
        $details  = "Cancelled order #$order_id via manager PIN";
        $log = $conn->prepare("INSERT INTO audit_log (staff_id, action_type, table_affected, record_id, details) VALUES (?, 'VOID_ORDER', 'orders', ?, ?)");
        $log->bind_param('iis', $staff_id, $order_id, $details);
        $log->execute();
        $log->close();

        json(['success' => true, 'message' => "Đơn hàng #$order_id đã được hủy thành công"]);
    } catch (Exception $e) {
        json(['success' => false, 'error' => 'Lỗi hủy đơn: ' . $e->getMessage()], 500);
    }
}

// ── GET: fetch today's completed orders for prep display ───────
// Shows all Completed orders from today so barista knows what to prepare
$stmt = $conn->prepare("
    SELECT
        o.order_id,
        DATE_FORMAT(o.order_date, '%H:%i')  AS order_time,
        o.order_type,
        o.order_status,
        mi.item_name,
        oi.quantity,
        GROUP_CONCAT(
            mo.option_name
            ORDER BY mg.group_name
            SEPARATOR ', '
        ) AS customizations
    FROM   orders o
    JOIN   order_item oi              ON oi.order_id       = o.order_id
    JOIN   menu_item  mi              ON mi.item_id        = oi.item_id
    LEFT JOIN order_item_modifier oim ON oim.order_item_id = oi.order_item_id
    LEFT JOIN modifier_option mo      ON mo.option_id      = oim.option_id
    LEFT JOIN modifier_group  mg      ON mg.group_id       = mo.group_id
    WHERE  o.location_id = ?
      AND  DATE(o.order_date) = CURDATE()
      AND  o.order_status = 'Completed'
    GROUP BY oi.order_item_id, o.order_id, o.order_date,
             mi.item_name, oi.quantity, o.order_status, o.order_type
    ORDER BY o.order_date DESC
");
$stmt->bind_param('i', $location_id);
$stmt->execute();
$data = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
$stmt->close();

json(['success' => true, 'data' => $data]);

<?php
// =============================================================
// FILE  : api/prep_queue.php
// UC1   : Beverage Preparation Queue  (Barista)
// PARAMS: GET location_id (int, default 1)
// =============================================================

require_once __DIR__ . '/_helpers.php';
require_once __DIR__ . '/db.php';

// Support both GET to read prep queue and POST to update order status
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    require_login();
    $input = json_decode(file_get_contents('php://input'), true);
    $order_id = $input['order_id'] ?? null;
    $new_status = $input['status'] ?? '';
    
    $allowed_statuses = ['Pending', 'Preparing', 'Served', 'Paid', 'Cancelled'];
    if (!$order_id || !in_array($new_status, $allowed_statuses)) {
        json(['success' => false, 'error' => 'Thông tin trạng thái hoặc mã đơn hàng không hợp lệ'], 400);
    }
    
    try {
        $stmt = $conn->prepare("UPDATE orders SET order_status = ? WHERE order_id = ?");
        $stmt->bind_param('si', $new_status, $order_id);
        $stmt->execute();
        $affected = $stmt->affected_rows;
        $stmt->close();
        
        // Log action in audit log
        $staff_id = $_SESSION['staff_id'];
        $details = "Updated order #$order_id status to $new_status";
        $log_stmt = $conn->prepare("
            INSERT INTO audit_log (staff_id, action_type, table_affected, record_id, details)
            VALUES (?, 'UPDATE_ORDER_STATUS', 'orders', ?, ?)
        ");
        $log_stmt->bind_param('iis', $staff_id, $order_id, $details);
        $log_stmt->execute();
        $log_stmt->close();
        
        json(['success' => true, 'message' => 'Cập nhật trạng thái đơn hàng thành công']);
    } catch (Exception $e) {
        json(['success' => false, 'error' => 'Lỗi cập nhật trạng thái: ' . $e->getMessage()], 500);
    }
}

// GET method: Read the prep queue
$location_id = $_SESSION['location_id'] ?? (isset($_GET['location_id']) ? (int) $_GET['location_id'] : 1);

$sql = "
    SELECT
        o.order_id,
        DATE_FORMAT(o.order_date, '%H:%i:%s')   AS order_time,
        mi.item_name,
        oi.quantity,
        GROUP_CONCAT(
            mo.option_name
            ORDER BY mg.group_name
            SEPARATOR ', '
        )                                        AS customizations,
        o.order_status
    FROM   orders o
    JOIN   order_item oi             ON oi.order_id       = o.order_id
    JOIN   menu_item  mi             ON mi.item_id        = oi.item_id
    LEFT JOIN order_item_modifier oim ON oim.order_item_id = oi.order_item_id
    LEFT JOIN modifier_option mo      ON mo.option_id      = oim.option_id
    LEFT JOIN modifier_group  mg      ON mg.group_id       = mo.group_id
    WHERE  o.location_id   = ?
      AND  o.order_status IN ('Pending', 'Preparing')
    GROUP BY oi.order_item_id, o.order_id, o.order_date,
             mi.item_name, oi.quantity, o.order_status
    ORDER BY o.order_date ASC
";

$stmt = $conn->prepare($sql);
$stmt->bind_param('i', $location_id);
$stmt->execute();
$result = $stmt->get_result();
$data   = $result->fetch_all(MYSQLI_ASSOC);

echo json_encode(['success' => true, 'data' => $data]);

$stmt->close();
$conn->close();

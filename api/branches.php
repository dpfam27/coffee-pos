<?php
// =============================================================
// FILE : api/branches.php
// DESC : CRUD branches/locations — Admin only
//        cancel_pin: 4-digit PIN used by barista to confirm order cancellation
// GET                → list all branches
// POST               → create branch
// POST {_method:PUT} → update branch (name, address, phone, cancel_pin)
// =============================================================

require_once __DIR__ . '/_helpers.php';
require_once __DIR__ . '/db.php';

require_login();
require_role('Admin');

$method = $_SERVER['REQUEST_METHOD'];

// ── GET: list all ──────────────────────────────────────────────
if ($method === 'GET') {
    $result = $conn->query("
        SELECT l.location_id, l.name, l.address, l.phone, l.cancel_pin,
               COUNT(DISTINCT s.staff_id) AS staff_count
        FROM   location l
        LEFT JOIN staff s ON s.location_id = l.location_id AND s.is_active = 1
        GROUP BY l.location_id
        ORDER BY l.location_id
    ");
    json(['success' => true, 'data' => $result->fetch_all(MYSQLI_ASSOC)]);
}

$input      = json_decode(file_get_contents('php://input'), true) ?? [];
$pseudo     = strtoupper($input['_method'] ?? '');
$eff_method = ($method === 'POST' && $pseudo) ? $pseudo : $method;

function validate_branch(array $d): void {
    if (empty(trim($d['name'] ?? '')))    throw new Exception('Tên chi nhánh không được để trống');
    if (empty(trim($d['address'] ?? ''))) throw new Exception('Địa chỉ không được để trống');
    $pin = $d['cancel_pin'] ?? '0000';
    if (!preg_match('/^\d{4,10}$/', $pin)) throw new Exception('Mã hủy đơn phải là 4–10 chữ số');
}

// ── POST: create ───────────────────────────────────────────────
if ($eff_method === 'POST') {
    try {
        validate_branch($input);
        $name       = trim($input['name']);
        $address    = trim($input['address']);
        $phone      = trim($input['phone'] ?? '');
        $cancel_pin = $input['cancel_pin'] ?? '0000';

        $stmt = $conn->prepare("INSERT INTO location (name, address, phone, cancel_pin) VALUES (?, ?, ?, ?)");
        $stmt->bind_param('ssss', $name, $address, $phone, $cancel_pin);
        $stmt->execute();
        $new_id = (int)$conn->insert_id;
        $stmt->close();
        json(['success' => true, 'location_id' => $new_id, 'message' => 'Tạo chi nhánh thành công']);
    } catch (Exception $e) {
        json(['success' => false, 'error' => $e->getMessage()], 400);
    }
}

// ── PUT: update ────────────────────────────────────────────────
if ($eff_method === 'PUT') {
    $loc_id = (int)($input['location_id'] ?? 0);
    if (!$loc_id) json(['success' => false, 'error' => 'Thiếu location_id'], 400);
    try {
        validate_branch($input);
        $name       = trim($input['name']);
        $address    = trim($input['address']);
        $phone      = trim($input['phone'] ?? '');
        $cancel_pin = $input['cancel_pin'] ?? '0000';

        $stmt = $conn->prepare("UPDATE location SET name=?, address=?, phone=?, cancel_pin=? WHERE location_id=?");
        $stmt->bind_param('ssssi', $name, $address, $phone, $cancel_pin, $loc_id);
        $stmt->execute();
        $stmt->close();
        json(['success' => true, 'message' => 'Cập nhật chi nhánh thành công']);
    } catch (Exception $e) {
        json(['success' => false, 'error' => $e->getMessage()], 400);
    }
}

json(['success' => false, 'error' => 'Phương thức không được hỗ trợ'], 405);

<?php
// =============================================================
// FILE : api/staff.php
// DESC : Staff CRUD — StoreManager (own branch) / Admin (all branches)
// GET                          → list staff + shifts for branch
// POST                         → create staff account
// POST {_method:PUT}           → update staff (name, role, phone)
// POST {_method:DEACTIVATE}    → toggle is_active
// POST {_method:RESET_PIN}     → reset password to default (firstname123)
// =============================================================

require_once __DIR__ . '/_helpers.php';
require_once __DIR__ . '/db.php';

require_login();
require_role(['StoreManager', 'Admin']);

$method      = $_SERVER['REQUEST_METHOD'];
$caller_role = $_SESSION['role'];
$caller_loc  = (int)$_SESSION['location_id'];

// Resolve which location to operate on
// Admin may pass ?location_id=X; StoreManager always uses own branch
function resolve_location(int $caller_loc, string $caller_role, $query_param): int {
    if ($caller_role === 'Admin' && $query_param) return (int)$query_param;
    return $caller_loc;
}

// ── GET: list staff ────────────────────────────────────────────
if ($method === 'GET') {
    $loc = resolve_location($caller_loc, $caller_role, $_GET['location_id'] ?? null);

    // StoreManager cannot see Admin accounts
    $role_filter = ($caller_role === 'Admin') ? '' : "AND s.role != 'Admin'";
    $stmt = $conn->prepare("
        SELECT s.staff_id, s.name, s.role, s.phone, s.is_active,
               l.name AS location_name
        FROM   staff s
        JOIN   location l ON l.location_id = s.location_id
        WHERE  s.location_id = ? $role_filter
        ORDER BY s.role, s.name
    ");
    $stmt->bind_param('i', $loc);
    $stmt->execute();
    $staff_list = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt->close();

    foreach ($staff_list as &$s) $s['is_active'] = (int)$s['is_active'];

    // Shift roster from shift_schedule table (if exists) else empty
    $shifts_by_staff = [];
    $tbl_check = $conn->query("SHOW TABLES LIKE 'shift_schedule'");
    if ($tbl_check && $tbl_check->num_rows > 0) {
        $ss = $conn->prepare("
            SELECT staff_id, shift_type, day_of_week
            FROM   shift_schedule
            WHERE  location_id = ?
            ORDER BY staff_id, FIELD(day_of_week,'Mon','Tue','Wed','Thu','Fri','Sat','Sun')
        ");
        $ss->bind_param('i', $loc);
        $ss->execute();
        foreach ($ss->get_result()->fetch_all(MYSQLI_ASSOC) as $row) {
            $shifts_by_staff[$row['staff_id']][] = $row;
        }
        $ss->close();
    }

    json(['success' => true, 'staff' => $staff_list, 'shifts' => $shifts_by_staff]);
}

// StoreManager can write (create/update/deactivate Barista in own branch)
// Admin can write anything

$input      = json_decode(file_get_contents('php://input'), true) ?? [];
$pseudo     = strtoupper($input['_method'] ?? '');
$eff_method = ($method === 'POST' && $pseudo) ? $pseudo : $method;

// Helper: enforce SM can only manage own branch
function assert_branch(int $target_loc, int $caller_loc, string $role): void {
    if ($role !== 'Admin' && $target_loc !== $caller_loc) {
        json(['success' => false, 'error' => 'Bạn chỉ có thể quản lý nhân viên chi nhánh mình'], 403);
    }
}

// ── POST: create staff ─────────────────────────────────────────
if ($eff_method === 'POST') {
    $name        = trim($input['name']        ?? '');
    $role        = trim($input['role']        ?? '');
    $phone       = trim($input['phone']       ?? '');
    $location_id = (int)($input['location_id'] ?? $caller_loc);

    $allowed_roles = ($caller_role === 'Admin') ? ['Admin','StoreManager','Barista'] : ['Barista'];
    if (empty($name) || !in_array($role, $allowed_roles)) {
        json(['success' => false, 'error' => 'Tên hoặc vai trò không hợp lệ'], 400);
    }
    assert_branch($location_id, $caller_loc, $caller_role);

    // Check duplicate phone
    if ($phone) {
        $chk = $conn->prepare("SELECT staff_id FROM staff WHERE phone = ?");
        $chk->bind_param('s', $phone);
        $chk->execute();
        if ($chk->get_result()->fetch_assoc()) {
            json(['success' => false, 'error' => 'Số điện thoại đã được sử dụng'], 409);
        }
        $chk->close();
    }

    // Default password: first word of name lowercased + "123"
    $first_name     = strtolower(explode(' ', $name)[0]);
    $default_pass   = $first_name . '123';
    $password_hash  = password_hash($default_pass, PASSWORD_BCRYPT);

    $stmt = $conn->prepare("INSERT INTO staff (location_id, name, role, phone, is_active, password_hash) VALUES (?, ?, ?, ?, 1, ?)");
    $stmt->bind_param('issss', $location_id, $name, $role, $phone, $password_hash);
    $stmt->execute();
    $new_id = (int)$conn->insert_id;
    $stmt->close();

    json(['success' => true, 'staff_id' => $new_id, 'default_password' => $default_pass, 'message' => 'Tạo tài khoản nhân viên thành công']);
}

// ── PUT: update staff info ─────────────────────────────────────
if ($eff_method === 'PUT') {
    $staff_id    = (int)($input['staff_id']    ?? 0);
    $name        = trim($input['name']         ?? '');
    $phone       = trim($input['phone']        ?? '');
    $role        = trim($input['role']         ?? '');

    if (!$staff_id || empty($name)) json(['success' => false, 'error' => 'Thiếu thông tin cập nhật'], 400);

    // Fetch target staff branch
    $chk = $conn->prepare("SELECT location_id, role FROM staff WHERE staff_id = ?");
    $chk->bind_param('i', $staff_id);
    $chk->execute();
    $target = $chk->get_result()->fetch_assoc();
    $chk->close();
    if (!$target) json(['success' => false, 'error' => 'Không tìm thấy nhân viên'], 404);

    assert_branch((int)$target['location_id'], $caller_loc, $caller_role);

    $allowed_roles = ($caller_role === 'Admin') ? ['Admin','StoreManager','Barista'] : ['Barista'];
    if (!in_array($role, $allowed_roles)) {
        json(['success' => false, 'error' => 'Vai trò không hợp lệ hoặc không đủ quyền thay đổi'], 403);
    }

    $stmt = $conn->prepare("UPDATE staff SET name=?, phone=?, role=? WHERE staff_id=?");
    $stmt->bind_param('sssi', $name, $phone, $role, $staff_id);
    $stmt->execute();
    $stmt->close();
    json(['success' => true, 'message' => 'Cập nhật nhân viên thành công']);
}

// ── DEACTIVATE: toggle is_active ───────────────────────────────
if ($eff_method === 'DEACTIVATE') {
    $staff_id = (int)($input['staff_id'] ?? 0);
    if (!$staff_id) json(['success' => false, 'error' => 'Thiếu staff_id'], 400);

    $chk = $conn->prepare("SELECT location_id, is_active FROM staff WHERE staff_id = ?");
    $chk->bind_param('i', $staff_id);
    $chk->execute();
    $target = $chk->get_result()->fetch_assoc();
    $chk->close();
    if (!$target) json(['success' => false, 'error' => 'Không tìm thấy nhân viên'], 404);

    assert_branch((int)$target['location_id'], $caller_loc, $caller_role);

    $stmt = $conn->prepare("UPDATE staff SET is_active = 1 - is_active WHERE staff_id = ?");
    $stmt->bind_param('i', $staff_id);
    $stmt->execute();
    $stmt->close();
    $new_state = 1 - (int)$target['is_active'];
    json(['success' => true, 'is_active' => $new_state, 'message' => $new_state ? 'Tài khoản đã được kích hoạt' : 'Tài khoản đã bị vô hiệu hóa']);
}

// ── RESET_PIN: reset password ──────────────────────────────────
if ($eff_method === 'RESET_PIN') {
    $staff_id = (int)($input['staff_id'] ?? 0);
    if (!$staff_id) json(['success' => false, 'error' => 'Thiếu staff_id'], 400);

    $chk = $conn->prepare("SELECT location_id, name FROM staff WHERE staff_id = ?");
    $chk->bind_param('i', $staff_id);
    $chk->execute();
    $target = $chk->get_result()->fetch_assoc();
    $chk->close();
    if (!$target) json(['success' => false, 'error' => 'Không tìm thấy nhân viên'], 404);

    assert_branch((int)$target['location_id'], $caller_loc, $caller_role);

    $first_name    = strtolower(explode(' ', $target['name'])[0]);
    $default_pass  = $first_name . '123';
    $password_hash = password_hash($default_pass, PASSWORD_BCRYPT);

    $stmt = $conn->prepare("UPDATE staff SET password_hash=? WHERE staff_id=?");
    $stmt->bind_param('si', $password_hash, $staff_id);
    $stmt->execute();
    $stmt->close();
    json(['success' => true, 'default_password' => $default_pass, 'message' => 'Đặt lại mật khẩu thành công']);
}

json(['success' => false, 'error' => 'Phương thức không được hỗ trợ'], 405);

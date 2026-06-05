<?php
// =============================================================
// FILE : api/promotions.php
// DESC : CRUD promotions
//   Admin   → xem + CRUD toàn chuỗi (location_id IS NULL) và chi nhánh
//   SM      → xem + CRUD promo của chi nhánh mình (location_id = own)
//   Others  → chỉ GET ?active=1
// =============================================================

require_once __DIR__ . '/_helpers.php';
require_once __DIR__ . '/db.php';

require_login();

$method      = $_SERVER['REQUEST_METHOD'];
$caller_role = $_SESSION['role'] ?? '';
$caller_loc  = (int)($_SESSION['location_id'] ?? 0);
$is_admin    = ($caller_role === 'Admin');
$is_sm       = ($caller_role === 'StoreManager');

// ── GET ────────────────────────────────────────────────────────
if ($method === 'GET') {
    // ?active=1 → today's active promo visible to all (POS / barista)
    // Returns both chain-wide (location_id IS NULL) and branch promos
    if (isset($_GET['active'])) {
        $loc_clause = $caller_loc ? "AND (p.location_id IS NULL OR p.location_id = $caller_loc)" : "AND p.location_id IS NULL";
        $result = $conn->query("
            SELECT promotion_id, name, discount_type, discount_value
            FROM   promotion p
            WHERE  is_active = 1
              AND  CURDATE() BETWEEN start_date AND end_date
              $loc_clause
            LIMIT 1
        ");
        $row = $result->fetch_assoc();
        if ($row) $row['discount_value'] = (float)$row['discount_value'];
        json(['success' => true, 'promotion' => $row ?: null]);
    }

    // Full list — Admin or StoreManager only
    if (!$is_admin && !$is_sm) {
        json(['success' => false, 'error' => 'Forbidden. Insufficient permissions.'], 403);
    }

    if ($is_admin) {
        // Admin: all promotions, show scope label
        $result = $conn->query("
            SELECT p.promotion_id, p.name, p.discount_type, p.discount_value,
                   p.start_date, p.end_date, p.is_active,
                   p.location_id,
                   COALESCE(l.name, 'Toàn chuỗi') AS scope_label
            FROM   promotion p
            LEFT JOIN location l ON l.location_id = p.location_id
            ORDER  BY p.start_date DESC
        ");
    } else {
        // StoreManager: only own branch + chain-wide promos
        $stmt = $conn->prepare("
            SELECT p.promotion_id, p.name, p.discount_type, p.discount_value,
                   p.start_date, p.end_date, p.is_active,
                   p.location_id,
                   CASE WHEN p.location_id IS NULL THEN 'Toàn chuỗi' ELSE 'Chi nhánh' END AS scope_label
            FROM   promotion p
            WHERE  p.location_id = ? OR p.location_id IS NULL
            ORDER  BY p.start_date DESC
        ");
        $stmt->bind_param('i', $caller_loc);
        $stmt->execute();
        $result = $stmt->get_result();
        $stmt->close();
    }

    $rows = $result->fetch_all(MYSQLI_ASSOC);
    foreach ($rows as &$r) {
        $r['discount_value'] = (float)$r['discount_value'];
        $r['is_active']      = (int)$r['is_active'];
        $r['location_id']    = $r['location_id'] ? (int)$r['location_id'] : null;
    }
    json(['success' => true, 'data' => $rows]);
}

// ── Write ops: Admin (toàn chuỗi) or StoreManager (chi nhánh mình) ──
if (!$is_admin && !$is_sm) {
    json(['success' => false, 'error' => 'Forbidden'], 403);
}

$input      = json_decode(file_get_contents('php://input'), true) ?? [];
$pseudo     = strtoupper($input['_method'] ?? '');
$eff_method = ($method === 'POST' && $pseudo) ? $pseudo : $method;

function validate_promo(array $d): void {
    if (empty(trim($d['name'] ?? ''))) throw new Exception('Tên khuyến mãi không được để trống');
    if (!in_array($d['discount_type'] ?? '', ['percent', 'fixed'])) throw new Exception('Loại giảm giá không hợp lệ');
    $val = (float)($d['discount_value'] ?? 0);
    if ($val <= 0) throw new Exception('Giá trị giảm giá phải lớn hơn 0');
    if ($d['discount_type'] === 'percent' && $val > 100) throw new Exception('Phần trăm không được vượt quá 100');
    if (empty($d['start_date']) || empty($d['end_date'])) throw new Exception('Ngày bắt đầu và kết thúc không được để trống');
    if ($d['start_date'] > $d['end_date']) throw new Exception('Ngày bắt đầu phải trước ngày kết thúc');
}

// Resolve location_id for write:
// Admin may pass location_id (or null for chain-wide)
// StoreManager always writes to own branch
function resolve_promo_location(bool $is_admin, int $caller_loc, $input_loc): ?int {
    if (!$is_admin) return $caller_loc; // SM always own branch
    if ($input_loc === null || $input_loc === '' || $input_loc === 0) return null; // Admin: chain-wide
    return (int)$input_loc;
}

// ── POST: create ───────────────────────────────────────────────
if ($eff_method === 'POST') {
    try {
        validate_promo($input);
        $name      = trim($input['name']);
        $dtype     = $input['discount_type'];
        $dval      = (float)$input['discount_value'];
        $start     = $input['start_date'];
        $end       = $input['end_date'];
        $is_active = isset($input['is_active']) ? (int)(bool)$input['is_active'] : 1;
        $loc_id    = resolve_promo_location($is_admin, $caller_loc, $input['location_id'] ?? null);

        $stmt = $conn->prepare("INSERT INTO promotion (name, discount_type, discount_value, start_date, end_date, is_active, location_id) VALUES (?, ?, ?, ?, ?, ?, ?)");
        $stmt->bind_param('ssdssii', $name, $dtype, $dval, $start, $end, $is_active, $loc_id);
        $stmt->execute();
        $new_id = (int)$conn->insert_id;
        $stmt->close();
        json(['success' => true, 'promotion_id' => $new_id, 'message' => 'Tạo khuyến mãi thành công']);
    } catch (Exception $e) {
        json(['success' => false, 'error' => $e->getMessage()], 400);
    }
}

// ── PUT: update ────────────────────────────────────────────────
if ($eff_method === 'PUT') {
    $promo_id = (int)($input['promotion_id'] ?? 0);
    if (!$promo_id) json(['success' => false, 'error' => 'Thiếu promotion_id'], 400);

    // Verify ownership: SM can only edit own branch promos
    if (!$is_admin) {
        $chk = $conn->prepare("SELECT location_id FROM promotion WHERE promotion_id = ?");
        $chk->bind_param('i', $promo_id);
        $chk->execute();
        $row = $chk->get_result()->fetch_assoc();
        $chk->close();
        if (!$row || (int)$row['location_id'] !== $caller_loc) {
            json(['success' => false, 'error' => 'Không có quyền chỉnh sửa khuyến mãi này'], 403);
        }
    }

    try {
        validate_promo($input);
        $name      = trim($input['name']);
        $dtype     = $input['discount_type'];
        $dval      = (float)$input['discount_value'];
        $start     = $input['start_date'];
        $end       = $input['end_date'];
        $is_active = (int)(bool)($input['is_active'] ?? 1);
        $loc_id    = resolve_promo_location($is_admin, $caller_loc, $input['location_id'] ?? null);

        $stmt = $conn->prepare("UPDATE promotion SET name=?, discount_type=?, discount_value=?, start_date=?, end_date=?, is_active=?, location_id=? WHERE promotion_id=?");
        $stmt->bind_param('ssdssiii', $name, $dtype, $dval, $start, $end, $is_active, $loc_id, $promo_id);
        $stmt->execute();
        $stmt->close();
        json(['success' => true, 'message' => 'Cập nhật khuyến mãi thành công']);
    } catch (Exception $e) {
        json(['success' => false, 'error' => $e->getMessage()], 400);
    }
}

// ── DELETE ─────────────────────────────────────────────────────
if ($eff_method === 'DELETE') {
    $promo_id = (int)($input['promotion_id'] ?? 0);
    if (!$promo_id) json(['success' => false, 'error' => 'Thiếu promotion_id'], 400);

    // SM: verify ownership
    if (!$is_admin) {
        $chk = $conn->prepare("SELECT location_id FROM promotion WHERE promotion_id = ?");
        $chk->bind_param('i', $promo_id);
        $chk->execute();
        $row = $chk->get_result()->fetch_assoc();
        $chk->close();
        if (!$row || (int)$row['location_id'] !== $caller_loc) {
            json(['success' => false, 'error' => 'Không có quyền xóa khuyến mãi này'], 403);
        }
    }

    $chk = $conn->prepare("SELECT COUNT(*) AS cnt FROM order_promotion WHERE promotion_id = ?");
    $chk->bind_param('i', $promo_id);
    $chk->execute();
    $cnt = (int)$chk->get_result()->fetch_assoc()['cnt'];
    $chk->close();

    if ($cnt > 0) {
        $stmt = $conn->prepare("UPDATE promotion SET is_active = 0 WHERE promotion_id = ?");
        $stmt->bind_param('i', $promo_id);
        $stmt->execute();
        $stmt->close();
        json(['success' => true, 'message' => 'Khuyến mãi đã được vô hiệu hóa (đã có đơn hàng sử dụng)']);
    } else {
        $stmt = $conn->prepare("DELETE FROM promotion WHERE promotion_id = ?");
        $stmt->bind_param('i', $promo_id);
        $stmt->execute();
        $stmt->close();
        json(['success' => true, 'message' => 'Xóa khuyến mãi thành công']);
    }
}

json(['success' => false, 'error' => 'Phương thức không được hỗ trợ'], 405);

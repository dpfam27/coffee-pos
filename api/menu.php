<?php
// =============================================================
// FILE : api/menu.php
// DESC : Menu — read for all roles, CRUD for Admin/StoreManager
// GET                          → full menu with modifiers (POS use)
// GET ?all=1                   → all items incl. unavailable (manager use)
// POST                         → create menu_item
// POST {_method:PUT}           → update menu_item
// POST {_method:DELETE}        → toggle is_available (soft delete)
// POST {_method:PUT_CAT}       → update category name
// POST {_method:POST_CAT}      → create category
// =============================================================

require_once __DIR__ . '/_helpers.php';
require_once __DIR__ . '/db.php';

require_login();

$method = $_SERVER['REQUEST_METHOD'];

// ── GET: full menu ─────────────────────────────────────────────
if ($method === 'GET') {
    $show_all = isset($_GET['all']) && $_GET['all'] == '1';
    $where    = $show_all ? '' : 'WHERE is_available = 1';

    $categories = $conn->query("SELECT category_id, category_name FROM menu_category ORDER BY category_id")->fetch_all(MYSQLI_ASSOC);

    $items = $conn->query("SELECT item_id, category_id, item_name, base_price, is_available FROM menu_item $where ORDER BY item_name")->fetch_all(MYSQLI_ASSOC);

    $mim_res = $conn->query("SELECT mim.item_id, mg.group_id, mg.group_name, mg.selection_type, mg.is_required FROM menu_item_modifier mim JOIN modifier_group mg ON mim.group_id = mg.group_id ORDER BY mg.group_id");
    $item_modifiers = [];
    while ($row = $mim_res->fetch_assoc()) {
        $item_modifiers[$row['item_id']][] = ['group_id' => $row['group_id'], 'group_name' => $row['group_name'], 'selection_type' => $row['selection_type'], 'is_required' => (int)$row['is_required'], 'options' => []];
    }

    $opt_res = $conn->query("SELECT option_id, group_id, option_name, price_delta FROM modifier_option ORDER BY option_id");
    $group_options = [];
    while ($row = $opt_res->fetch_assoc()) {
        $group_options[$row['group_id']][] = ['option_id' => (int)$row['option_id'], 'option_name' => $row['option_name'], 'price_delta' => (float)$row['price_delta']];
    }

    foreach ($item_modifiers as &$groups) {
        foreach ($groups as &$group) {
            $group['options'] = $group_options[$group['group_id']] ?? [];
        }
    }

    $menu = [];
    foreach ($categories as $cat) {
        $cat_items = [];
        foreach ($items as $item) {
            if ($item['category_id'] == $cat['category_id']) {
                $item['base_price']  = (float)$item['base_price'];
                $item['is_available']= (int)$item['is_available'];
                $item['modifiers']   = $item_modifiers[$item['item_id']] ?? [];
                $cat_items[] = $item;
            }
        }
        $menu[] = ['category_id' => (int)$cat['category_id'], 'category_name' => $cat['category_name'], 'items' => $cat_items];
    }

    json(['success' => true, 'data' => $menu]);
}

// All write operations require Admin or StoreManager
require_role(['Admin', 'StoreManager']);

$input      = json_decode(file_get_contents('php://input'), true) ?? [];
$pseudo     = strtoupper($input['_method'] ?? '');
$eff_method = ($method === 'POST' && $pseudo) ? $pseudo : $method;

// ── POST: create menu_item ─────────────────────────────────────
if ($eff_method === 'POST') {
    $name        = trim($input['item_name']   ?? '');
    $category_id = (int)($input['category_id'] ?? 0);
    $base_price  = (float)($input['base_price'] ?? 0);

    if (empty($name) || !$category_id || $base_price <= 0) {
        json(['success' => false, 'error' => 'Tên món, danh mục và giá không được để trống hoặc không hợp lệ'], 400);
    }

    $stmt = $conn->prepare("INSERT INTO menu_item (category_id, item_name, base_price, is_available) VALUES (?, ?, ?, 1)");
    $stmt->bind_param('isd', $category_id, $name, $base_price);
    $stmt->execute();
    $new_id = (int)$conn->insert_id;
    $stmt->close();
    json(['success' => true, 'item_id' => $new_id, 'message' => 'Thêm món thành công']);
}

// ── PUT: update menu_item ──────────────────────────────────────
if ($eff_method === 'PUT') {
    $item_id     = (int)($input['item_id']     ?? 0);
    $name        = trim($input['item_name']    ?? '');
    $category_id = (int)($input['category_id'] ?? 0);
    $base_price  = (float)($input['base_price'] ?? 0);
    $is_available= (int)(bool)($input['is_available'] ?? 1);

    if (!$item_id || empty($name) || !$category_id || $base_price <= 0) {
        json(['success' => false, 'error' => 'Thông tin cập nhật không hợp lệ'], 400);
    }

    $stmt = $conn->prepare("UPDATE menu_item SET category_id=?, item_name=?, base_price=?, is_available=? WHERE item_id=?");
    $stmt->bind_param('isdii', $category_id, $name, $base_price, $is_available, $item_id);
    $stmt->execute();
    $stmt->close();
    json(['success' => true, 'message' => 'Cập nhật món thành công']);
}

// ── DELETE: toggle availability ────────────────────────────────
if ($eff_method === 'DELETE') {
    $item_id = (int)($input['item_id'] ?? 0);
    if (!$item_id) json(['success' => false, 'error' => 'Thiếu item_id'], 400);

    $stmt = $conn->prepare("UPDATE menu_item SET is_available = 1 - is_available WHERE item_id = ?");
    $stmt->bind_param('i', $item_id);
    $stmt->execute();
    $stmt->close();
    json(['success' => true, 'message' => 'Đã thay đổi trạng thái phục vụ của món']);
}

// ── POST_CAT: create category ──────────────────────────────────
if ($eff_method === 'POST_CAT') {
    $cat_name = trim($input['category_name'] ?? '');
    if (empty($cat_name)) json(['success' => false, 'error' => 'Tên danh mục không được để trống'], 400);
    $stmt = $conn->prepare("INSERT INTO menu_category (category_name) VALUES (?)");
    $stmt->bind_param('s', $cat_name);
    $stmt->execute();
    $new_id = (int)$conn->insert_id;
    $stmt->close();
    json(['success' => true, 'category_id' => $new_id, 'message' => 'Tạo danh mục thành công']);
}

// ── PUT_CAT: update category ───────────────────────────────────
if ($eff_method === 'PUT_CAT') {
    $cat_id   = (int)($input['category_id']   ?? 0);
    $cat_name = trim($input['category_name']  ?? '');
    if (!$cat_id || empty($cat_name)) json(['success' => false, 'error' => 'Thông tin danh mục không hợp lệ'], 400);
    $stmt = $conn->prepare("UPDATE menu_category SET category_name=? WHERE category_id=?");
    $stmt->bind_param('si', $cat_name, $cat_id);
    $stmt->execute();
    $stmt->close();
    json(['success' => true, 'message' => 'Cập nhật danh mục thành công']);
}

json(['success' => false, 'error' => 'Phương thức không được hỗ trợ'], 405);

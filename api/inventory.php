<?php
// =============================================================
// FILE : api/inventory.php
// DESC : Fetch inventory level and perform stock adjustments
// =============================================================

require_once __DIR__ . '/_helpers.php';
require_once __DIR__ . '/db.php';

// Authentication required
require_login();

$location_id = $_SESSION['location_id'] ?? null;
if (!$location_id) {
    json(['success' => false, 'error' => 'Không xác định được chi nhánh làm việc'], 400);
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // Process Stock Adjustment (StoreManager or Admin)
    require_role(['StoreManager', 'Admin']);
    
    $input = json_decode(file_get_contents('php://input'), true);
    $action_flag = $input['action'] ?? '';

    // ---- ADD NEW INGREDIENT ----
    if ($action_flag === 'add_new') {
        require_role(['StoreManager', 'Admin']);
        $name      = trim($input['name'] ?? '');
        $stock     = isset($input['stock_level']) ? (float)$input['stock_level'] : 0.0;
        $unit      = trim($input['unit'] ?? 'kg');
        $threshold = isset($input['low_stock_threshold']) ? (float)$input['low_stock_threshold'] : 1.0;

        if (empty($name)) {
            json(['success' => false, 'error' => 'Tên nguyên vật liệu không được để trống'], 400);
        }

        try {
            $ins = $conn->prepare("INSERT INTO ingredient (location_id, name, stock_level, unit, low_stock_threshold) VALUES (?, ?, ?, ?, ?)");
            $ins->bind_param('isdsd', $location_id, $name, $stock, $unit, $threshold);
            $ins->execute();
            $new_id = $conn->insert_id;
            $ins->close();
            json(['success' => true, 'message' => 'Đã thêm nguyên vật liệu mới vào kho', 'ingredient_id' => $new_id]);
        } catch (Exception $e) {
            json(['success' => false, 'error' => 'Lỗi thêm nguyên vật liệu: ' . $e->getMessage()], 500);
        }
    }

    $ingredient_id = isset($input['ingredient_id']) ? (int)$input['ingredient_id'] : 0;
    $adjustment_amount = isset($input['amount']) ? (float)$input['amount'] : 0.0;
    $action_type = $input['action_type'] ?? 'adjust'; // 'add' (restock) or 'set' (manual override) or 'reduce' (waste/export)
    $reason = trim($input['reason'] ?? '');
    
    if (!$ingredient_id || empty($reason)) {
        json(['success' => false, 'error' => 'Thông tin điều chỉnh kho không đầy đủ hoặc không hợp lệ'], 400);
    }
    
    // Verify ingredient belongs to this location
    $chk_stmt = $conn->prepare("SELECT name, stock_level, unit FROM ingredient WHERE ingredient_id = ? AND location_id = ?");
    $chk_stmt->bind_param('ii', $ingredient_id, $location_id);
    $chk_stmt->execute();
    $ing = $chk_stmt->get_result()->fetch_assoc();
    $chk_stmt->close();
    
    if (!$ing) {
        json(['success' => false, 'error' => 'Nguyên vật liệu không tồn tại ở chi nhánh này'], 404);
    }
    
    $old_stock = (float)$ing['stock_level'];
    $new_stock = $old_stock;
    
    if ($action_type === 'add') {
        $new_stock = $old_stock + $adjustment_amount;
        $details = "Restocked " . $ing['name'] . " by $adjustment_amount " . $ing['unit'] . ". Old: $old_stock, New: $new_stock. Reason: $reason";
    } else if ($action_type === 'reduce') {
        $new_stock = $old_stock - $adjustment_amount;
        if ($new_stock < 0) $new_stock = 0;
        $details = "Reduced " . $ing['name'] . " by $adjustment_amount " . $ing['unit'] . ". Old: $old_stock, New: $new_stock. Reason: $reason";
    } else { // 'set'
        $new_stock = $adjustment_amount;
        $details = "Adjusted " . $ing['name'] . " stock level manually. Old: $old_stock, New: $new_stock. Reason: $reason";
    }
    
    $conn->begin_transaction();
    try {
        // Update stock level
        $upd_stmt = $conn->prepare("UPDATE ingredient SET stock_level = ? WHERE ingredient_id = ?");
        $upd_stmt->bind_param('di', $new_stock, $ingredient_id);
        $upd_stmt->execute();
        $upd_stmt->close();
        
        $conn->commit();
        
        json(['success' => true, 'message' => 'Điều chỉnh kho nguyên vật liệu thành công', 'new_stock' => $new_stock]);
        
    } catch (Exception $e) {
        $conn->rollback();
        json(['success' => false, 'error' => 'Lỗi điều chỉnh kho: ' . $e->getMessage()], 500);
    }

} else if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    // Return all ingredients for location
    try {
        $stmt = $conn->prepare("
            SELECT ingredient_id, name, stock_level, unit, low_stock_threshold 
            FROM   ingredient 
            WHERE  location_id = ? 
            ORDER BY name
        ");
        $stmt->bind_param('i', $location_id);
        $stmt->execute();
        $ingredients = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
        $stmt->close();
        
        // Format decimal values
        foreach ($ingredients as &$ing) {
            $ing['stock_level'] = (float)$ing['stock_level'];
            $ing['low_stock_threshold'] = (float)$ing['low_stock_threshold'];
        }
        unset($ing);
        
        json(['success' => true, 'data' => $ingredients]);
        
    } catch (Exception $e) {
        json(['success' => false, 'error' => 'Lỗi tải dữ liệu kho: ' . $e->getMessage()], 500);
    }
}

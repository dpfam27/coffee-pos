<?php
// =============================================================
// FILE : api/promotions.php
// DESC : Fetch active chain promotions for the Admin panel
// =============================================================

require_once __DIR__ . '/_helpers.php';
require_once __DIR__ . '/db.php';

// Authentication required
require_login();
require_role('Admin');

try {
    $sql = "
        SELECT promotion_id, name, discount_type, discount_value, start_date, end_date, is_active 
        FROM   promotion 
        ORDER BY start_date DESC
    ";
    $result = $conn->query($sql);
    $promotions = $result->fetch_all(MYSQLI_ASSOC);
    
    // Format numeric values
    foreach ($promotions as &$p) {
        $p['discount_value'] = (float)$p['discount_value'];
        $p['is_active'] = (int)$p['is_active'];
    }
    unset($p);
    
    json(['success' => true, 'data' => $promotions]);

} catch (Exception $e) {
    json(['success' => false, 'error' => 'Lỗi tải danh sách khuyến mãi: ' . $e->getMessage()], 500);
}

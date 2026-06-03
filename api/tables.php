<?php
// =============================================================
// FILE : api/tables.php
// DESC : Fetch dining tables for the logged-in staff's location
// =============================================================

require_once __DIR__ . '/_helpers.php';
require_once __DIR__ . '/db.php';

// Authentication required
require_login();

$location_id = $_SESSION['location_id'] ?? null;
if (!$location_id) {
    json(['success' => false, 'error' => 'Không xác định được chi nhánh làm việc'], 400);
}

try {
    $stmt = $conn->prepare("
        SELECT table_id, table_number, status 
        FROM   dining_table 
        WHERE  location_id = ? 
        ORDER BY table_number
    ");
    $stmt->bind_param('i', $location_id);
    $stmt->execute();
    $tables = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt->close();
    
    json(['success' => true, 'data' => $tables]);

} catch (Exception $e) {
    json(['success' => false, 'error' => 'Lỗi tải danh sách bàn: ' . $e->getMessage()], 500);
}

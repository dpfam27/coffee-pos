<?php
// =============================================================
// FILE : api/branches.php
// DESC : Fetch all locations/branches for the Admin panel
// =============================================================

require_once __DIR__ . '/_helpers.php';
require_once __DIR__ . '/db.php';

// Authentication required
require_login();
require_role('Admin');

try {
    $result = $conn->query("SELECT location_id, name, address, phone FROM location ORDER BY location_id");
    $branches = $result->fetch_all(MYSQLI_ASSOC);
    json(['success' => true, 'data' => $branches]);

} catch (Exception $e) {
    json(['success' => false, 'error' => 'Lỗi tải danh sách chi nhánh: ' . $e->getMessage()], 500);
}

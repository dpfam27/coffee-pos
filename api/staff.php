<?php
// =============================================================
// FILE : api/staff.php
// DESC : Fetch staff directory and dynamic shift schedules for the branch
// =============================================================

require_once __DIR__ . '/_helpers.php';
require_once __DIR__ . '/db.php';

// Authentication required
require_login();
require_role(['StoreManager', 'Admin']);

$location_id = $_SESSION['location_id'] ?? null;
if (!$location_id) {
    json(['success' => false, 'error' => 'Không xác định được chi nhánh làm việc'], 400);
}

try {
    // 1. Fetch staff members
    $stmt = $conn->prepare("
        SELECT staff_id, name, role, phone 
        FROM   staff 
        WHERE  location_id = ? 
        ORDER BY role, name
    ");
    $stmt->bind_param('i', $location_id);
    $stmt->execute();
    $staff_list = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt->close();
    
    // 2. Generate mock shift roster for display (since there is no schedule table in the DB schema)
    // Shift types: Morning (06:00 - 14:00), Afternoon (14:00 - 22:00)
    $roster = [];
    $days = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ Nhật'];
    
    foreach ($staff_list as $idx => $s) {
        // Distribute shifts deterministically based on staff ID
        $shift_type = ($idx % 2 === 0) ? 'Ca Sáng (06:00 - 14:00)' : 'Ca Chiều (14:00 - 22:00)';
        
        // Days active
        $active_days = [];
        if ($s['role'] === 'StoreManager') {
            $active_days = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6'];
            $shift_type = 'Hành chính (08:00 - 17:00)';
        } else if ($idx % 3 === 0) {
            $active_days = ['Thứ 2', 'Thứ 4', 'Thứ 6', 'Thứ 7'];
        } else if ($idx % 3 === 1) {
            $active_days = ['Thứ 3', 'Thứ 5', 'Thứ 7', 'Chủ Nhật'];
        } else {
            $active_days = ['Thứ 2', 'Thứ 3', 'Thứ 5', 'Chủ Nhật'];
        }
        
        $roster[] = [
            'staff_id' => $s['staff_id'],
            'name' => $s['name'],
            'role' => $s['role'],
            'phone' => $s['phone'],
            'shift' => $shift_type,
            'days' => implode(', ', $active_days)
        ];
    }
    
    json([
        'success' => true, 
        'staff' => $staff_list,
        'roster' => $roster
    ]);

} catch (Exception $e) {
    json(['success' => false, 'error' => 'Lỗi tải danh sách nhân viên: ' . $e->getMessage()], 500);
}

<?php
// =============================================================
// FILE : api/audit_log.php
// DESC : Fetch audit logs of staff actions for Admin auditing
// =============================================================

require_once __DIR__ . '/_helpers.php';
require_once __DIR__ . '/db.php';

// Authentication required
require_login();
require_role('Admin');

try {
    $sql = "
        SELECT al.log_id, al.action_type, al.table_affected, al.record_id, 
               al.action_timestamp, al.details,
               s.name as staff_name, s.role as staff_role, l.name as location_name
        FROM   audit_log al
        JOIN   staff s ON al.staff_id = s.staff_id
        JOIN   location l ON s.location_id = l.location_id
        ORDER BY al.action_timestamp DESC
        LIMIT 100
    ";
    
    $result = $conn->query($sql);
    $logs = $result->fetch_all(MYSQLI_ASSOC);
    json(['success' => true, 'data' => $logs]);

} catch (Exception $e) {
    json(['success' => false, 'error' => 'Lỗi tải nhật ký hệ thống: ' . $e->getMessage()], 500);
}

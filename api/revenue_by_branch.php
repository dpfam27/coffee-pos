<?php
// =============================================================
// FILE : api/revenue_by_branch.php
// DESC : Fetch sales revenue and order counts distributed by branch locations
// =============================================================

require_once __DIR__ . '/_helpers.php';
require_once __DIR__ . '/db.php';

// Authentication required
require_login();
require_role('Admin');

try {
    $sql = "
        SELECT l.location_id, l.name as location_name, 
               SUM(o.total_amount) as revenue, 
               COUNT(o.order_id) as order_count
        FROM   orders o
        JOIN   location l ON o.location_id = l.location_id
        WHERE  o.order_status = 'Paid'
        GROUP BY l.location_id, l.name
        ORDER BY revenue DESC
    ";
    
    $result = $conn->query($sql);
    $data = $result->fetch_all(MYSQLI_ASSOC);
    
    foreach ($data as &$row) {
        $row['revenue'] = (float)$row['revenue'];
        $row['order_count'] = (int)$row['order_count'];
    }
    unset($row);
    
    json(['success' => true, 'data' => $data]);

} catch (Exception $e) {
    json(['success' => false, 'error' => 'Lỗi tải doanh thu theo chi nhánh: ' . $e->getMessage()], 500);
}

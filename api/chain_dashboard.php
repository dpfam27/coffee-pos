<?php
// =============================================================
// FILE : api/chain_dashboard.php
// DESC : Fetch summary statistics for the entire chain
// =============================================================

require_once __DIR__ . '/_helpers.php';
require_once __DIR__ . '/db.php';

// Authentication required
require_login();
require_role('Admin');

try {
    // 1. Fetch chain summary stats
    $stats_res = $conn->query("
        SELECT SUM(total_amount) as total_revenue, 
               COUNT(order_id) as total_orders, 
               AVG(total_amount) as avg_ticket 
        FROM   orders 
        WHERE  order_status = 'Completed'
    ");
    $stats = $stats_res->fetch_assoc();
    
    // 2. Count low stock items across entire chain
    $low_res = $conn->query("
        SELECT COUNT(*) as low_stock_count 
        FROM   ingredient 
        WHERE  stock_level < low_stock_threshold
    ");
    $low = $low_res->fetch_assoc();
    
    $total_revenue = (float)($stats['total_revenue'] ?? 0.0);
    $total_orders = (int)($stats['total_orders'] ?? 0);
    $avg_ticket = (float)($stats['avg_ticket'] ?? 0.0);
    $low_stock_count = (int)($low['low_stock_count'] ?? 0);
    
    json([
        'success' => true,
        'data' => [
            'total_revenue' => $total_revenue,
            'total_orders' => $total_orders,
            'avg_ticket' => $avg_ticket,
            'low_stock_count' => $low_stock_count
        ]
    ]);

} catch (Exception $e) {
    json(['success' => false, 'error' => 'Lỗi tải dữ liệu tổng quan chuỗi: ' . $e->getMessage()], 500);
}

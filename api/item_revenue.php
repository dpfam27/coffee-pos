<?php
// =============================================================
// FILE : api/item_revenue.php
// DESC : Fetch revenue breakdown by menu item across the chain
// =============================================================

require_once __DIR__ . '/_helpers.php';
require_once __DIR__ . '/db.php';

require_login();
require_role('Admin');

try {
    $res = $conn->query("
        SELECT 
            mi.item_name,
            SUM(oi.quantity)       AS quantity_sold,
            SUM(oi.subtotal)       AS total_revenue
        FROM   order_item oi
        JOIN   menu_item  mi ON oi.item_id = mi.item_id
        JOIN   orders     o  ON oi.order_id = o.order_id
        WHERE  o.order_status = 'Completed'
        GROUP  BY mi.item_id, mi.item_name
        ORDER  BY total_revenue DESC
    ");

    $rows = $res->fetch_all(MYSQLI_ASSOC);

    foreach ($rows as &$row) {
        $row['quantity_sold']   = (int)$row['quantity_sold'];
        $row['total_revenue']   = (float)$row['total_revenue'];
    }
    unset($row);

    json(['success' => true, 'data' => $rows]);

} catch (Exception $e) {
    json(['success' => false, 'error' => 'Lỗi tải dữ liệu doanh thu theo món: ' . $e->getMessage()], 500);
}

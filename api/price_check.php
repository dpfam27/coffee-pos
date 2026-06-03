<?php
// =============================================================
// FILE  : api/price_check.php
// UC5   : Price Integrity Check  (Admin)
// PARAMS: none
// DESC  : Returns order lines where the charged price differs
//         from the current menu price, proving the snapshot
//         design works (Price Integrity rule).
// =============================================================

require_once __DIR__ . '/_helpers.php';
require_once __DIR__ . '/db.php';

require_login();

$sql = "
    SELECT
        o.order_id,
        DATE_FORMAT(o.order_date, '%Y-%m-%d')  AS order_date,
        mi.item_name,
        oi.unit_price                           AS price_charged,
        mi.base_price                           AS current_menu_price,
        (mi.base_price - oi.unit_price)         AS difference
    FROM   order_item oi
    JOIN   orders    o  ON o.order_id = oi.order_id
    JOIN   menu_item mi ON mi.item_id = oi.item_id
    WHERE  oi.unit_price <> mi.base_price
    ORDER BY o.order_date
";

$result = $conn->query($sql);
$data   = $result->fetch_all(MYSQLI_ASSOC);

echo json_encode(['success' => true, 'data' => $data]);

$conn->close();

<?php
// =============================================================
// FILE  : api/modifier_revenue.php
// UC3   : Revenue by Customization Option  (Admin)
// PARAMS: none  (chain-wide, current month)
// =============================================================

require_once __DIR__ . '/_helpers.php';
require_once __DIR__ . '/db.php';

require_login();

$sql = "
    SELECT
        mg.group_name,
        mo.option_name,
        COUNT(*)                                    AS times_chosen,
        SUM(oim.price_delta_at_sale * oi.quantity)  AS extra_revenue
    FROM   order_item_modifier oim
    JOIN   modifier_option mo ON mo.option_id      = oim.option_id
    JOIN   modifier_group  mg ON mg.group_id       = mo.group_id
    JOIN   order_item      oi ON oi.order_item_id  = oim.order_item_id
    JOIN   orders          o  ON o.order_id        = oi.order_id
    WHERE  o.order_status = 'Paid'
      AND  o.order_date  >= DATE_FORMAT(CURDATE(), '%Y-%m-01')
    GROUP BY mo.option_id, mg.group_name, mo.option_name
    ORDER BY extra_revenue DESC
";

$result = $conn->query($sql);
$data   = $result->fetch_all(MYSQLI_ASSOC);

echo json_encode(['success' => true, 'data' => $data]);

$conn->close();

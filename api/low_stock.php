<?php
// =============================================================
// FILE  : api/low_stock.php
// UC2   : Items at Risk of Going Unavailable  (Store Manager)
// PARAMS: GET location_id (int, default 1)
// =============================================================

require_once __DIR__ . '/_helpers.php';
require_once __DIR__ . '/db.php';

require_login();

$location_id = $_SESSION['location_id'] ?? (isset($_GET['location_id']) ? (int) $_GET['location_id'] : 1);

$at_risk = [];

// Sub-query 2: the actual low-stock ingredients at this branch
$sql_ingredients = "
    SELECT
        name,
        stock_level,
        low_stock_threshold,
        unit
    FROM  ingredient
    WHERE location_id  = ?
      AND stock_level  < low_stock_threshold
    ORDER BY (low_stock_threshold - stock_level) DESC
";

$stmt2 = $conn->prepare($sql_ingredients);
$stmt2->bind_param('i', $location_id);
$stmt2->execute();
$low_ingredients = $stmt2->get_result()->fetch_all(MYSQLI_ASSOC);
$stmt2->close();

echo json_encode([
    'success'         => true,
    'at_risk_items'   => $at_risk,
    'low_ingredients' => $low_ingredients,
]);

$conn->close();

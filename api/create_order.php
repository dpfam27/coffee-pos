<?php
// =============================================================
// FILE : api/create_order.php
// DESC : POS transaction — create order, charge payment, manage loyalty
// Rules:
//   - Order status = Completed immediately (payment at counter)
//   - No table assignment
//   - Loyalty: earn 1 pt per 1,000đ spent; redeem 1 pt = 1,000đ off
//   - Promotion applied first, then loyalty discount
// =============================================================

require_once __DIR__ . '/_helpers.php';
require_once __DIR__ . '/db.php';

require_login();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json(['success' => false, 'error' => 'Phương thức không được hỗ trợ'], 405);
}

$input = json_decode(file_get_contents('php://input'), true);
if (!$input) {
    json(['success' => false, 'error' => 'Dữ liệu đầu vào không hợp lệ'], 400);
}

$order_type      = $input['order_type']      ?? 'takeaway';
$customer_id     = $input['customer_id']     ?? null;
$payment_method  = $input['payment_method']  ?? 'Cash';
$points_redeemed = isset($input['points_redeemed']) ? (int)$input['points_redeemed'] : 0;
$items           = $input['items']           ?? [];

$allowed_types = ['takeaway', 'pickup'];
if (!in_array($order_type, $allowed_types) || empty($items)) {
    json(['success' => false, 'error' => 'Thiếu thông tin loại đơn hoặc danh sách món'], 400);
}

$location_id = (int)$_SESSION['location_id'];
$staff_id    = (int)$_SESSION['staff_id'];

$conn->begin_transaction();

try {
    // ── 1. Validate items & calculate subtotal ─────────────────
    $subtotal      = 0.0;
    $items_details = [];

    foreach ($items as $cart_item) {
        $item_id   = (int)$cart_item['item_id'];
        $quantity  = (int)($cart_item['quantity'] ?? 1);
        $modifiers = $cart_item['modifiers'] ?? [];

        if ($quantity <= 0) throw new Exception("Số lượng món không hợp lệ.");

        $item_stmt = $conn->prepare("SELECT item_name, base_price, is_available FROM menu_item WHERE item_id = ?");
        $item_stmt->bind_param('i', $item_id);
        $item_stmt->execute();
        $item_db = $item_stmt->get_result()->fetch_assoc();
        $item_stmt->close();

        if (!$item_db || !$item_db['is_available']) {
            throw new Exception("Món không tồn tại hoặc đã ngừng phục vụ.");
        }

        $base_price      = (float)$item_db['base_price'];
        $modifiers_price = 0.0;
        $mods_details    = [];

        foreach ($modifiers as $opt_id) {
            $opt_id_int = (int)$opt_id;
            $opt_stmt = $conn->prepare("SELECT option_name, price_delta FROM modifier_option WHERE option_id = ?");
            $opt_stmt->bind_param('i', $opt_id_int);
            $opt_stmt->execute();
            $opt_db = $opt_stmt->get_result()->fetch_assoc();
            $opt_stmt->close();

            if (!$opt_db) throw new Exception("Tùy chọn modifier không hợp lệ.");
            $modifiers_price += (float)$opt_db['price_delta'];
            $mods_details[]   = ['option_id' => (int)$opt_id, 'price_delta' => (float)$opt_db['price_delta']];
        }

        $line_subtotal = ($base_price + $modifiers_price) * $quantity;
        $subtotal     += $line_subtotal;

        $items_details[] = [
            'item_id'   => $item_id,
            'quantity'  => $quantity,
            'unit_price'=> $base_price,
            'subtotal'  => $line_subtotal,
            'modifiers' => $mods_details,
        ];
    }

    // ── 2. Promotion (applied first) ───────────────────────────
    $promo_discount  = 0.0;
    $applied_promo_id = null;

    $promo_stmt = $conn->prepare("
        SELECT promotion_id, discount_type, discount_value
        FROM   promotion
        WHERE  is_active = 1
          AND  CURDATE() BETWEEN start_date AND end_date
        ORDER BY promotion_id LIMIT 1
    ");
    $promo_stmt->execute();
    $promo = $promo_stmt->get_result()->fetch_assoc();
    $promo_stmt->close();

    if ($promo) {
        $applied_promo_id = (int)$promo['promotion_id'];
        if ($promo['discount_type'] === 'percent') {
            $promo_discount = round($subtotal * ((float)$promo['discount_value'] / 100.0));
        } else {
            $promo_discount = min((float)$promo['discount_value'], $subtotal);
        }
    }

    $after_promo = $subtotal - $promo_discount;

    // ── 3. Loyalty points validation & discount ────────────────
    // Earn: 1 pt per 1,000đ of final amount
    // Redeem: 1 pt = 1,000đ discount
    $loyalty_discount = 0.0;

    if ($customer_id) {
        $cust_id_int = (int)$customer_id;
        $cust_stmt = $conn->prepare("SELECT loyalty_points FROM customer WHERE customer_id = ?");
        $cust_stmt->bind_param('i', $cust_id_int);
        $cust_stmt->execute();
        $cust_db = $cust_stmt->get_result()->fetch_assoc();
        $cust_stmt->close();

        if (!$cust_db) throw new Exception("Khách hàng không tồn tại.");

        if ($points_redeemed > 0) {
            if ($points_redeemed > (int)$cust_db['loyalty_points']) {
                throw new Exception("Điểm tích lũy không đủ.");
            }
            $loyalty_discount = min($points_redeemed * 1000.0, $after_promo);
            // Recalc actual points used in case discount capped
            $points_redeemed = (int)ceil($loyalty_discount / 1000.0);
        }
    }

    $total_amount = max(0.0, $after_promo - $loyalty_discount);

    // ── 4. Insert order ────────────────────────────────────────
    $order_status  = 'Completed';
    $customer_id_n = $customer_id ? (int)$customer_id : null;
    $ins_order = $conn->prepare("
        INSERT INTO orders (location_id, staff_id, customer_id, order_type, order_status, total_amount)
        VALUES (?, ?, ?, ?, ?, ?)
    ");
    $ins_order->bind_param('iiissd', $location_id, $staff_id, $customer_id_n, $order_type, $order_status, $total_amount);
    $ins_order->execute();
    $order_id = (int)$conn->insert_id;
    $ins_order->close();

    // ── 5. Insert order_item + modifiers ───────────────────────
    foreach ($items_details as $item) {
        $ins_item = $conn->prepare("
            INSERT INTO order_item (order_id, item_id, quantity, unit_price, subtotal)
            VALUES (?, ?, ?, ?, ?)
        ");
        $ins_item->bind_param('iiidd', $order_id, $item['item_id'], $item['quantity'], $item['unit_price'], $item['subtotal']);
        $ins_item->execute();
        $order_item_id = (int)$conn->insert_id;
        $ins_item->close();

        foreach ($item['modifiers'] as $mod) {
            $ins_mod = $conn->prepare("
                INSERT INTO order_item_modifier (order_item_id, option_id, price_delta_at_sale)
                VALUES (?, ?, ?)
            ");
            $ins_mod->bind_param('iid', $order_item_id, $mod['option_id'], $mod['price_delta']);
            $ins_mod->execute();
            $ins_mod->close();
        }
    }

    // ── 6. Payment ─────────────────────────────────────────────
    $ins_pay = $conn->prepare("INSERT INTO payment (order_id, payment_method, amount_paid) VALUES (?, ?, ?)");
    $ins_pay->bind_param('isd', $order_id, $payment_method, $total_amount);
    $ins_pay->execute();
    $ins_pay->close();

    // ── 7. Promotion record ────────────────────────────────────
    if ($applied_promo_id && $promo_discount > 0) {
        $ins_promo = $conn->prepare("INSERT INTO order_promotion (order_id, promotion_id, amount_discounted) VALUES (?, ?, ?)");
        $ins_promo->bind_param('iid', $order_id, $applied_promo_id, $promo_discount);
        $ins_promo->execute();
        $ins_promo->close();
    }

    // ── 8. Loyalty transactions ────────────────────────────────
    $points_earned = 0;
    if ($customer_id) {
        if ($points_redeemed > 0) {
            $ins_redeem = $conn->prepare("INSERT INTO loyalty_transaction (customer_id, order_id, points_change, txn_type) VALUES (?, ?, ?, 'redeem')");
            $ins_redeem->bind_param('iii', $customer_id, $order_id, $points_redeemed);
            $ins_redeem->execute();
            $ins_redeem->close();
        }

        $points_earned = (int)floor($total_amount / 1000.0);
        if ($points_earned > 0) {
            $ins_earn = $conn->prepare("INSERT INTO loyalty_transaction (customer_id, order_id, points_change, txn_type) VALUES (?, ?, ?, 'earn')");
            $ins_earn->bind_param('iii', $customer_id, $order_id, $points_earned);
            $ins_earn->execute();
            $ins_earn->close();
        }

        $net_change = $points_earned - $points_redeemed;
        $upd_cust = $conn->prepare("UPDATE customer SET loyalty_points = loyalty_points + ? WHERE customer_id = ?");
        $upd_cust->bind_param('ii', $net_change, $customer_id);
        $upd_cust->execute();
        $upd_cust->close();
    }

    // ── 9. Audit log ───────────────────────────────────────────
    $details = "Order #$order_id | Total: " . number_format($total_amount) . "đ | Payment: $payment_method";
    $ins_audit = $conn->prepare("INSERT INTO audit_log (staff_id, action_type, table_affected, record_id, details) VALUES (?, 'CREATE_ORDER', 'orders', ?, ?)");
    $ins_audit->bind_param('iis', $staff_id, $order_id, $details);
    $ins_audit->execute();
    $ins_audit->close();

    $conn->commit();

    json([
        'success'        => true,
        'order_id'       => $order_id,
        'subtotal'       => $subtotal,
        'promo_discount' => $promo_discount,
        'loyalty_discount'=> $loyalty_discount,
        'total_amount'   => $total_amount,
        'points_earned'  => $points_earned,
        'points_redeemed'=> $points_redeemed,
        'message'        => 'Đơn hàng đã được tạo thành công!',
    ]);

} catch (Exception $e) {
    $conn->rollback();
    json(['success' => false, 'error' => 'Lỗi tạo đơn: ' . $e->getMessage()], 500);
}

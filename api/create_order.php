<?php
// =============================================================
// FILE : api/create_order.php
// DESC : POS transaction to create orders, charge payment, deduct inventory and manage loyalty points
// =============================================================

require_once __DIR__ . '/_helpers.php';
require_once __DIR__ . '/db.php';

// Authentication required
require_login();

// Accept POST requests only
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json(['success' => false, 'error' => 'Phương thức không được hỗ trợ'], 405);
}

$input = json_decode(file_get_contents('php://input'), true);
if (!$input) {
    json(['success' => false, 'error' => 'Dữ liệu đầu vào không hợp lệ'], 400);
}

$order_type = $input['order_type'] ?? '';
$table_id = $input['table_id'] ?? null;
$customer_id = $input['customer_id'] ?? null;
$payment_method = $input['payment_method'] ?? 'Cash';
$points_redeemed = isset($input['points_redeemed']) ? (int)$input['points_redeemed'] : 0;
$items = $input['items'] ?? [];

// Basic validations
if (empty($order_type) || empty($items)) {
    json(['success' => false, 'error' => 'Thiếu thông tin hình thức gọi món hoặc danh sách món ăn'], 400);
}

$location_id = $_SESSION['location_id'];
$staff_id = $_SESSION['staff_id'];

// Start Transaction
$conn->begin_transaction();

try {
    // 1. Calculate pricing and verify items
    $subtotal = 0.0;
    $items_details = [];

    foreach ($items as $cart_item) {
        $item_id = (int)$cart_item['item_id'];
        $quantity = (int)$cart_item['quantity'];
        $modifiers = $cart_item['modifiers'] ?? [];

        if ($quantity <= 0) {
            throw new Exception("Số lượng món ăn không hợp lệ.");
        }

        // Get menu item base price
        $item_stmt = $conn->prepare("SELECT item_name, base_price, is_available FROM menu_item WHERE item_id = ?");
        $item_stmt->bind_param('i', $item_id);
        $item_stmt->execute();
        $item_db = $item_stmt->get_result()->fetch_assoc();
        $item_stmt->close();

        if (!$item_db || !$item_db['is_available']) {
            throw new Exception("Món ăn không tồn tại hoặc đã ngừng phục vụ.");
        }

        $base_price = (float)$item_db['base_price'];
        $modifiers_price = 0.0;
        $mods_details = [];

        // Fetch modifier option prices
        foreach ($modifiers as $opt_id) {
            $opt_stmt = $conn->prepare("SELECT option_name, price_delta FROM modifier_option WHERE option_id = ?");
            $opt_stmt->bind_param('i', $opt_id);
            $opt_stmt->execute();
            $opt_db = $opt_stmt->get_result()->fetch_assoc();
            $opt_stmt->close();

            if (!$opt_db) {
                throw new Exception("Tùy chọn đính kèm không hợp lệ.");
            }

            $modifiers_price += (float)$opt_db['price_delta'];
            $mods_details[] = [
                'option_id' => $opt_id,
                'price_delta' => (float)$opt_db['price_delta']
            ];
        }

        $unit_price = $base_price;
        $line_subtotal = ($unit_price + $modifiers_price) * $quantity;
        $subtotal += $line_subtotal;

        $items_details[] = [
            'item_id' => $item_id,
            'quantity' => $quantity,
            'unit_price' => $unit_price,
            'subtotal' => $line_subtotal,
            'modifiers' => $mods_details
        ];
    }

    // 2. Validate Customer and Loyalty Points
    $points_earned = 0;
    $loyalty_discount = 0.0;
    
    if ($customer_id) {
        // Fetch current loyalty points balance
        $cust_stmt = $conn->prepare("
            SELECT loyalty_points 
            FROM   customer 
            WHERE  customer_id = ?
        ");
        $cust_stmt->bind_param('i', $customer_id);
        $cust_stmt->execute();
        $cust_db = $cust_stmt->get_result()->fetch_assoc();
        $cust_stmt->close();

        if (!$cust_db) {
            throw new Exception("Khách hàng không tồn tại.");
        }

        if ($points_redeemed > 0) {
            // Check if customer has enough points
            if ($points_redeemed > $cust_db['loyalty_points']) {
                throw new Exception("Điểm tích lũy khả dụng của khách hàng không đủ.");
            }
            
            // 1 point = 100 VND
            $loyalty_discount = $points_redeemed * 100.0;
            if ($loyalty_discount > $subtotal) {
                $loyalty_discount = $subtotal;
                $points_redeemed = ceil($loyalty_discount / 100.0);
            }
        }
    }

    // 3. Check for Active Promotions (e.g. Happy Hour 10% off)
    $promo_discount = 0.0;
    $applied_promo_id = null;
    
    // Look up active promotions matching current date
    $promo_stmt = $conn->prepare("
        SELECT promotion_id, name, discount_type, discount_value 
        FROM   promotion 
        WHERE  is_active = 1 
          AND  CURDATE() BETWEEN start_date AND end_date 
        ORDER BY promotion_id LIMIT 1
    ");
    $promo_stmt->execute();
    $promo = $promo_stmt->get_result()->fetch_assoc();
    $promo_stmt->close();

    if ($promo) {
        $applied_promo_id = $promo['promotion_id'];
        $discountable_amount = $subtotal - $loyalty_discount;
        
        if ($discountable_amount > 0) {
            if ($promo['discount_type'] === 'percent') {
                $promo_discount = round($discountable_amount * ($promo['discount_value'] / 100.0));
            } else {
                $promo_discount = (float)$promo['discount_value'];
                if ($promo_discount > $discountable_amount) {
                    $promo_discount = $discountable_amount;
                }
            }
        }
    }

    // Final Bill Total
    $total_amount = $subtotal - $loyalty_discount - $promo_discount;
    if ($total_amount < 0) {
        $total_amount = 0;
    }

    // 4. Create Order
    $order_status = 'Preparing'; // Placed orders automatically enter the KDS Prep Queue
    $ins_order_stmt = $conn->prepare("
        INSERT INTO orders (location_id, staff_id, customer_id, table_id, order_type, order_status, total_amount)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ");
    $ins_order_stmt->bind_param('iiiissd', $location_id, $staff_id, $customer_id, $table_id, $order_type, $order_status, $total_amount);
    $ins_order_stmt->execute();
    $order_id = $ins_order_stmt->insert_id;
    $ins_order_stmt->close();

    // 5. Insert Order Items & Modifiers
    foreach ($items_details as $item) {
        $ins_item_stmt = $conn->prepare("
            INSERT INTO order_item (order_id, item_id, quantity, unit_price, subtotal)
            VALUES (?, ?, ?, ?, ?)
        ");
        $ins_item_stmt->bind_param('iiidd', $order_id, $item['item_id'], $item['quantity'], $item['unit_price'], $item['subtotal']);
        $ins_item_stmt->execute();
        $order_item_id = $ins_item_stmt->insert_id;
        $ins_item_stmt->close();

        // Modifiers
        foreach ($item['modifiers'] as $mod) {
            $ins_mod_stmt = $conn->prepare("
                INSERT INTO order_item_modifier (order_item_id, option_id, price_delta_at_sale)
                VALUES (?, ?, ?)
            ");
            $ins_mod_stmt->bind_param('iid', $order_item_id, $mod['option_id'], $mod['price_delta']);
            $ins_mod_stmt->execute();
            $ins_mod_stmt->close();
        }

        // Note: Inventory deduction is disabled because the recipe and modifier_recipe tables have been removed.
    }

    // 7. Insert Payment record
    $ins_pay_stmt = $conn->prepare("
        INSERT INTO payment (order_id, payment_method, amount_paid)
        VALUES (?, ?, ?)
    ");
    $ins_pay_stmt->bind_param('isd', $order_id, $payment_method, $total_amount);
    $ins_pay_stmt->execute();
    $ins_pay_stmt->close();

    // 8. Record applied Promotion
    if ($applied_promo_id) {
        $ins_promo_stmt = $conn->prepare("
            INSERT INTO order_promotion (order_id, promotion_id, amount_discounted)
            VALUES (?, ?, ?)
        ");
        $ins_promo_stmt->bind_param('iid', $order_id, $applied_promo_id, $promo_discount);
        $ins_promo_stmt->execute();
        $ins_promo_stmt->close();
    }

    // 9. Loyalty Points earn and redeem
    if ($customer_id) {
        // Points Earned = 1 point per 1000 VND spent
        $points_earned = floor($total_amount / 1000);
        
        // Log redemption
        if ($points_redeemed > 0) {
            $ins_txn_stmt = $conn->prepare("
                INSERT INTO loyalty_transaction (customer_id, order_id, points_change, txn_type)
                VALUES (?, ?, ?, 'redeem')
            ");
            $ins_txn_stmt->bind_param('iii', $customer_id, $order_id, $points_redeemed);
            $ins_txn_stmt->execute();
            $ins_txn_stmt->close();
        }

        // Log earning
        if ($points_earned > 0) {
            $ins_txn_stmt = $conn->prepare("
                INSERT INTO loyalty_transaction (customer_id, order_id, points_change, txn_type)
                VALUES (?, ?, ?, 'earn')
            ");
            $ins_txn_stmt->bind_param('iii', $customer_id, $order_id, $points_earned);
            $ins_txn_stmt->execute();
            $ins_txn_stmt->close();
        }

        // Update cached loyalty points
        $new_points_change = $points_earned - $points_redeemed;
        $upd_cust_stmt = $conn->prepare("
            UPDATE customer 
            SET    loyalty_points = loyalty_points + ? 
            WHERE  customer_id = ?
        ");
        $upd_cust_stmt->bind_param('ii', $new_points_change, $customer_id);
        $upd_cust_stmt->execute();
        $upd_cust_stmt->close();
    }

    // 10. Update table status if dine-in
    if ($order_type === 'dine_in' && $table_id) {
        $upd_table_stmt = $conn->prepare("
            UPDATE dining_table 
            SET    status = 'Occupied' 
            WHERE  table_id = ?
        ");
        $upd_table_stmt->bind_param('i', $table_id);
        $upd_table_stmt->execute();
        $upd_table_stmt->close();
    }

    // 11. Write Audit Log
    $details = "Created order #$order_id with total amount: " . number_format($total_amount) . "đ";
    $ins_audit_stmt = $conn->prepare("
        INSERT INTO audit_log (staff_id, action_type, table_affected, record_id, details)
        VALUES (?, 'CREATE_ORDER', 'orders', ?, ?)
    ");
    $ins_audit_stmt->bind_param('iis', $staff_id, $order_id, $details);
    $ins_audit_stmt->execute();
    $ins_audit_stmt->close();

    // Commit Transaction
    $conn->commit();
    
    json([
        'success' => true,
        'order_id' => $order_id,
        'total_amount' => $total_amount,
        'points_earned' => $points_earned,
        'message' => 'Đơn hàng đã được tạo thành công!'
    ]);

} catch (Exception $e) {
    // Rollback on any failure
    $conn->rollback();
    json(['success' => false, 'error' => 'Lỗi tạo đơn hàng: ' . $e->getMessage()], 500);
}

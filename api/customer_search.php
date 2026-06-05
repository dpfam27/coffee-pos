<?php
// =============================================================
// FILE : api/customer_search.php
// DESC : Search customer by phone number, or create new customer
// =============================================================

require_once __DIR__ . '/_helpers.php';
require_once __DIR__ . '/db.php';

require_login();

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    // Search customer by phone
    $phone = trim($_GET['phone'] ?? '');
    if (empty($phone)) {
        json(['success' => false, 'error' => 'Vui lòng nhập số điện thoại'], 400);
    }

    $stmt = $conn->prepare("
        SELECT customer_id, name, phone, email, loyalty_points
        FROM   customer
        WHERE  phone = ?
        LIMIT 1
    ");
    $stmt->bind_param('s', $phone);
    $stmt->execute();
    $customer = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    if ($customer) {
        $customer['loyalty_points'] = (int)$customer['loyalty_points'];
        json(['success' => true, 'found' => true, 'customer' => $customer]);
    } else {
        json(['success' => true, 'found' => false, 'customer' => null]);
    }
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // Create new customer
    $input = json_decode(file_get_contents('php://input'), true);
    $name  = trim($input['name']  ?? '');
    $phone = trim($input['phone'] ?? '');
    $email = trim($input['email'] ?? '');

    if (empty($name) || empty($phone)) {
        json(['success' => false, 'error' => 'Họ tên và số điện thoại không được để trống'], 400);
    }

    // Check duplicate phone
    $chk = $conn->prepare("SELECT customer_id FROM customer WHERE phone = ?");
    $chk->bind_param('s', $phone);
    $chk->execute();
    if ($chk->get_result()->fetch_assoc()) {
        json(['success' => false, 'error' => 'Số điện thoại đã được đăng ký'], 409);
    }
    $chk->close();

    $stmt = $conn->prepare("
        INSERT INTO customer (name, phone, email, loyalty_points)
        VALUES (?, ?, ?, 0)
    ");
    $stmt->bind_param('sss', $name, $phone, $email);
    $stmt->execute();
    $new_id = $conn->insert_id;
    $stmt->close();

    json([
        'success'  => true,
        'customer' => [
            'customer_id'    => $new_id,
            'name'           => $name,
            'phone'          => $phone,
            'email'          => $email,
            'loyalty_points' => 0,
        ]
    ]);
}

json(['success' => false, 'error' => 'Phương thức không được hỗ trợ'], 405);

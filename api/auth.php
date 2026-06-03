<?php
// =============================================================
// FILE : api/auth.php
// DESC : Staff Login, Logout and Current User check endpoint
// =============================================================

require_once __DIR__ . '/_helpers.php';
require_once __DIR__ . '/db.php';

$action = $_GET['action'] ?? '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if ($action === 'login') {
        // Read JSON input
        $input = json_decode(file_get_contents('php://input'), true);
        $phone = $input['phone'] ?? '';
        $password = $input['password'] ?? '';
        
        if (empty($phone) || empty($password)) {
            json(['success' => false, 'error' => 'Vui lòng điền số điện thoại và mật khẩu'], 400);
        }
        
        // Find staff by phone number
        $stmt = $conn->prepare("
            SELECT s.staff_id, s.location_id, s.name, s.role, s.password_hash, l.name as location_name 
            FROM   staff s
            JOIN   location l ON s.location_id = l.location_id
            WHERE  s.phone = ?
        ");
        $stmt->bind_param('s', $phone);
        $stmt->execute();
        $staff = $stmt->get_result()->fetch_assoc();
        $stmt->close();
        
        if ($staff && password_verify($password, $staff['password_hash'])) {
            // Store details in session
            $_SESSION['staff_id'] = $staff['staff_id'];
            $_SESSION['location_id'] = $staff['location_id'];
            $_SESSION['name'] = $staff['name'];
            $_SESSION['role'] = $staff['role'];
            $_SESSION['location_name'] = $staff['location_name'];
            
            json([
                'success' => true,
                'user' => [
                    'staff_id' => $staff['staff_id'],
                    'location_id' => $staff['location_id'],
                    'name' => $staff['name'],
                    'role' => $staff['role'],
                    'location_name' => $staff['location_name']
                ]
            ]);
        } else {
            json(['success' => false, 'error' => 'Số điện thoại hoặc mật khẩu không chính xác'], 401);
        }
    } else {
        json(['success' => false, 'error' => 'Yêu cầu không hợp lệ'], 400);
    }
} else if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    if ($action === 'me') {
        if (isset($_SESSION['staff_id'])) {
            json([
                'success' => true,
                'user' => [
                    'staff_id' => $_SESSION['staff_id'],
                    'location_id' => $_SESSION['location_id'],
                    'name' => $_SESSION['name'],
                    'role' => $_SESSION['role'],
                    'location_name' => $_SESSION['location_name'] ?? ''
                ]
            ]);
        } else {
            json(['success' => false, 'error' => 'Chưa đăng nhập'], 401);
        }
    } else if ($action === 'logout') {
        // Destroy session
        $_SESSION = array();
        if (ini_get("session.use_cookies")) {
            $params = session_get_cookie_params();
            setcookie(session_name(), '', time() - 42000,
                $params["path"], $params["domain"],
                $params["secure"], $params["httponly"]
            );
        }
        session_destroy();
        json(['success' => true, 'message' => 'Đăng xuất thành công']);
    } else {
        json(['success' => false, 'error' => 'Yêu cầu không hợp lệ'], 400);
    }
} else {
    json(['success' => false, 'error' => 'Phương thức không được hỗ trợ'], 405);
}

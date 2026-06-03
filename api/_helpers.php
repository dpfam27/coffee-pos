<?php
// =============================================================
// FILE : api/_helpers.php
// DESC : Common helper functions for Coffee Shop Chain POS API
// =============================================================

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

/**
 * Send JSON response and exit
 */
function json($data, $status = 200) {
    http_response_code($status);
    header('Content-Type: application/json');
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization');
    echo json_encode($data);
    exit;
}

/**
 * Ensure user is logged in
 */
function require_login() {
    if (!isset($_SESSION['staff_id'])) {
        json(['success' => false, 'error' => 'Unauthorized. Please login.'], 401);
    }
}

/**
 * Ensure user has one of the allowed roles
 * Roles: 'Admin', 'StoreManager', 'ShiftLead', 'Barista'
 */
function require_role($allowed_roles) {
    require_login();
    $user_role = $_SESSION['role'] ?? '';
    
    if (is_array($allowed_roles)) {
        if (!in_array($user_role, $allowed_roles)) {
            json(['success' => false, 'error' => 'Forbidden. Insufficient permissions.'], 403);
        }
    } else {
        if ($user_role !== $allowed_roles) {
            json(['success' => false, 'error' => 'Forbidden. Insufficient permissions.'], 403);
        }
    }
}

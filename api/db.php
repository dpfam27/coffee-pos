<?php
// =============================================================
// FILE : api/db.php
// DESC : MariaDB connection for Coffee Shop Chain POS
// USAGE: require_once 'db.php';  — included by all endpoints
// =============================================================

define('DB_HOST', 'localhost');
define('DB_USER', 'root');       // change to your MySQL Workbench user
define('DB_PASS', 'tqqnnmmhh68');           // change to your password
define('DB_NAME', 'final');

$conn = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);
$conn->set_charset('utf8mb4');

if ($conn->connect_error) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database connection failed']);
    exit;
}

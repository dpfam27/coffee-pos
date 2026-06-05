<?php
// =============================================================
// FILE : api/setup_db.php
// DESC : Initialize staff passwords with hash values
// =============================================================

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/_helpers.php';

// Check if we are running from CLI or if authorized (for security, anyone can run it once)
// Add column if it doesn't exist
// Check if password_hash column exists
$check_col = $conn->query("SHOW COLUMNS FROM staff LIKE 'password_hash'");
if ($check_col && $check_col->num_rows === 0) {
    if (!$conn->query("ALTER TABLE staff ADD COLUMN password_hash VARCHAR(255) NULL")) {
        json(['success' => false, 'error' => 'Failed to alter table staff: ' . $conn->error], 500);
    }
}

// Fetch all staff
$sql = "SELECT staff_id, name, role FROM staff";
$result = $conn->query($sql);
if (!$result) {
    json(['success' => false, 'error' => 'Failed to query staff: ' . $conn->error], 500);
}

$updated = 0;
$details = [];

while ($row = $result->fetch_assoc()) {
    $staff_id = $row['staff_id'];
    $name = $row['name'];
    $role = $row['role'];
    
    // Generate password: lowercase first name + 123
    // Example: "James Carter" -> "james" -> "james123"
    $parts = explode(' ', trim($name));
    $firstName = strtolower($parts[0]);
    $defaultPassword = $firstName . '123';
    
    // Generate secure hash
    $hash = password_hash($defaultPassword, PASSWORD_BCRYPT);
    
    // Update if password_hash is currently empty
    $stmt = $conn->prepare("
        UPDATE staff 
        SET    password_hash = ? 
        WHERE  staff_id = ? 
          AND  (password_hash IS NULL OR password_hash = '')
    ");
    $stmt->bind_param('si', $hash, $staff_id);
    $stmt->execute();
    
    if ($stmt->affected_rows > 0) {
        $updated++;
        $details[] = [
            'staff_id' => $staff_id,
            'name' => $name,
            'role' => $role,
            'password_default' => $defaultPassword
        ];
    }
    $stmt->close();
}

json([
    'success' => true,
    'message' => 'Staff password hashes initialized successfully.',
    'passwords_updated_count' => $updated,
    'details' => $details
]);

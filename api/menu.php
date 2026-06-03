<?php
// =============================================================
// FILE : api/menu.php
// DESC : Fetch active menu items grouped by categories with modifiers
// =============================================================

require_once __DIR__ . '/_helpers.php';
require_once __DIR__ . '/db.php';

// Authentication required to view menu
require_login();

try {
    // 1. Fetch categories
    $categories_res = $conn->query("SELECT category_id, category_name FROM menu_category ORDER BY category_id");
    $categories = $categories_res->fetch_all(MYSQLI_ASSOC);
    
    // 2. Fetch all menu items
    $items_res = $conn->query("
        SELECT item_id, category_id, item_name, base_price, is_available 
        FROM   menu_item 
        WHERE  is_available = 1 
        ORDER BY item_name
    ");
    $items = $items_res->fetch_all(MYSQLI_ASSOC);
    
    // 3. Fetch all modifier groups linked to items
    $mim_res = $conn->query("
        SELECT mim.item_id, mg.group_id, mg.group_name, mg.selection_type, mg.is_required
        FROM   menu_item_modifier mim
        JOIN   modifier_group mg ON mim.group_id = mg.group_id
        ORDER BY mg.group_id
    ");
    $item_modifiers = [];
    while ($row = $mim_res->fetch_assoc()) {
        $item_modifiers[$row['item_id']][] = [
            'group_id' => $row['group_id'],
            'group_name' => $row['group_name'],
            'selection_type' => $row['selection_type'],
            'is_required' => $row['is_required'],
            'options' => [] // Will populate next
        ];
    }
    
    // 4. Fetch all modifier options
    $options_res = $conn->query("
        SELECT option_id, group_id, option_name, price_delta 
        FROM   modifier_option 
        ORDER BY option_id
    ");
    $group_options = [];
    while ($row = $options_res->fetch_assoc()) {
        $group_options[$row['group_id']][] = [
            'option_id' => $row['option_id'],
            'option_name' => $row['option_name'],
            'price_delta' => (float)$row['price_delta']
        ];
    }
    
    // Map options to item modifiers
    foreach ($item_modifiers as $itemId => &$groups) {
        foreach ($groups as &$group) {
            $groupId = $group['group_id'];
            if (isset($group_options[$groupId])) {
                $group['options'] = $group_options[$groupId];
            }
        }
    }
    unset($group); // Break reference
    
    // Assemble menu structure
    $menu = [];
    foreach ($categories as $cat) {
        $cat_id = $cat['category_id'];
        $cat_items = [];
        
        foreach ($items as $item) {
            if ($item['category_id'] == $cat_id) {
                $item_id = $item['item_id'];
                $item['base_price'] = (float)$item['base_price'];
                $item['modifiers'] = $item_modifiers[$item_id] ?? [];
                $cat_items[] = $item;
            }
        }
        
        $menu[] = [
            'category_id' => $cat_id,
            'category_name' => $cat['category_name'],
            'items' => $cat_items
        ];
    }
    
    json(['success' => true, 'data' => $menu]);

} catch (Exception $e) {
    json(['success' => false, 'error' => 'Lỗi tải danh mục thực đơn: ' . $e->getMessage()], 500);
}

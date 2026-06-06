// =============================================================
// FILE : web/js/manager.js
// DESC : Store Manager — dashboard, inventory, reports, menu CRUD, staff
// =============================================================

let currentUser    = null;
let inventoryData  = [];
let menuData       = [];
let editingItemId  = null;
let editingMenuStaffId = null;
let activeIngredientForAdjustment = null;

document.addEventListener('DOMContentLoaded', () => {
    initApp();
    setupEventListeners();
});

async function initApp() {
    try {
        const userRes = await API.get('auth.php?action=me');
        if (userRes && userRes.success) {
            currentUser = userRes.user;
            if (currentUser.role !== 'StoreManager' && currentUser.role !== 'Admin') {
                alert('Tài khoản không có quyền truy cập trang quản lý chi nhánh.');
                window.location.href = 'index.html';
                return;
            }
            document.getElementById('userName').textContent    = currentUser.name;
            document.getElementById('userRole').textContent    = currentUser.role === 'Admin' ? 'Quản trị viên' : 'Cửa hàng trưởng';
            document.getElementById('userAvatar').textContent  = currentUser.name.charAt(0);
            // Sync mobile bottom-nav account dropdown
            const _roleLabel = currentUser.role === 'Admin' ? 'Quản trị viên' : 'Cửa hàng trưởng';
            const _av = document.getElementById('bnAvatarMgr');
            const _nm = document.getElementById('bnNameMgr');
            const _rl = document.getElementById('bnRoleMgr');
            if (_av) _av.textContent = currentUser.name.charAt(0);
            if (_nm) _nm.textContent = currentUser.name;
            if (_rl) _rl.textContent = _roleLabel;
            document.getElementById('currentBranch').textContent = 'Chi nhánh: ' + (currentUser.location_name || '');
        } else {
            window.location.href = 'index.html';
            return;
        }
        setInterval(updateClock, 1000);
        updateClock();
        await loadReportsTab();
    } catch (err) { console.error('Init Error:', err); }
}

function updateClock() {
    const now = new Date();
    document.getElementById('currentTime').textContent =
        now.toLocaleTimeString('vi-VN') + ' — ' + now.toLocaleDateString('vi-VN');
}

// ── TAB LOADERS ────────────────────────────────────────────────

async function loadDashboardTab() {
    try {
        const [histRes, lowRes] = await Promise.all([
            API.get('order_history.php'),
            API.get('low_stock.php'),
        ]);

        if (histRes?.success) {
            const todayStr = new Date().toLocaleDateString('vi-VN');
            let revenue = 0, count = 0;
            histRes.data.forEach(o => {
                if (o.order_status === 'Completed') {
                    // order_date from API: "dd/mm/yyyy HH:MM" or ISO; try match today
                    const oDate = new Date(o.order_date);
                    if (oDate.toLocaleDateString('vi-VN') === todayStr) {
                        revenue += parseFloat(o.total_amount);
                        count++;
                    }
                }
            });
            document.getElementById('branchRevenue').textContent     = formatVND(revenue);
            document.getElementById('branchOrderCount').textContent  = count;
        }

        if (lowRes?.success) {
            const lowIngs  = lowRes.low_ingredients || [];
            const lowCount = lowIngs.length;
            const countEl  = document.getElementById('branchLowStockCount');
            const iconEl   = document.getElementById('lowStockIcon');
            countEl.textContent = lowCount;
            countEl.style.color = lowCount > 0 ? 'var(--red)' : 'var(--t1)';
            if (iconEl) {
                iconEl.className = lowCount > 0 ? 'stat-icon danger' : 'stat-icon success';
                iconEl.querySelector('i').className = lowCount > 0
                    ? 'fa-solid fa-triangle-exclamation'
                    : 'fa-solid fa-circle-check';
            }
        }
    } catch (err) { console.error('loadDashboardTab:', err); }
}

async function loadInventoryTab() {
    try {
        const res = await API.get('inventory.php');
        inventoryData = res?.data || [];
        const tbody = document.getElementById('inventoryTableBody');
        tbody.innerHTML = '';
        if (inventoryData.length) {
            inventoryData.forEach(ing => {
                const isLow = ing.stock_level < ing.low_stock_threshold;
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${ing.ingredient_id}</td>
                    <td><strong>${ing.name}</strong></td>
                    <td style="font-weight:600;${isLow ? 'color:var(--red);' : ''}">${ing.stock_level}</td>
                    <td>${ing.unit}</td>
                    <td>${ing.low_stock_threshold}</td>
                    <td>
                        <button class="btn btn-secondary" style="padding:4px 8px;font-size:.75rem;" onclick="openAdjustmentModal(${ing.ingredient_id})">
                            <i class="fa-solid fa-sliders"></i> Điều chỉnh
                        </button>
                    </td>`;
                tbody.appendChild(tr);
            });
        } else {
            tbody.innerHTML = emptyRow(7);
        }
    } catch (err) { console.error('loadInventoryTab:', err); }
}

let currentPeriod = 'day';

async function loadReportsTab() {
    try {
        const [itemRes] = await Promise.all([API.get('sales_by_item.php')]);

        const itemTbody = document.getElementById('salesByItemBody');
        itemTbody.innerHTML = '';
        if (itemRes?.success && itemRes.data?.length) {
            itemRes.data.forEach(row => {
                const tr = document.createElement('tr');
                tr.innerHTML = `<td><strong>${row.item_name}</strong></td><td>${row.quantity_sold}</td><td><strong>${formatVND(row.total_revenue)}</strong></td>`;
                itemTbody.appendChild(tr);
            });
        } else { itemTbody.innerHTML = emptyRow(3); }

        await loadPeriodReport(currentPeriod);
    } catch (err) { console.error('loadReportsTab:', err); }
}

async function loadPeriodReport(period) {
    currentPeriod = period;

    // Update button styles
    document.querySelectorAll('.period-btn').forEach(b => {
        b.className = b.dataset.period === period ? 'btn btn-primary period-btn' : 'btn btn-secondary period-btn';
    });

    const colLabels = { day: 'Khung giờ', week: 'Tuần', month: 'Tháng' };
    const summaryLabels = { day: 'Tổng hôm nay:', week: 'Tổng 12 tuần:', month: 'Tổng 12 tháng:' };
    document.getElementById('periodColHeader').textContent   = colLabels[period];
    document.getElementById('periodSummaryLabel').textContent = summaryLabels[period];

    const tbody = document.getElementById('salesByHourBody');
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:var(--t2);padding:20px;"><i class="fa-solid fa-spinner fa-spin"></i> Đang tải...</td></tr>`;

    try {
        const res = await API.get(`sales_by_hour.php?period=${period}`);
        tbody.innerHTML = '';
        if (!res?.success || !res.data?.length) {
            tbody.innerHTML = emptyRow(4, 'Không có dữ liệu cho kỳ này.');
            document.getElementById('periodSummaryTotal').textContent = formatVND(0);
            return;
        }
        const maxRev = Math.max(...res.data.map(r => r.total_revenue)) || 1;
        let totalRev = 0;
        res.data.forEach(row => {
            if (row.order_count === 0) return; // skip zero rows for week/month
            const pct = Math.round((row.total_revenue / maxRev) * 100);
            totalRev += row.total_revenue;
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="white-space:nowrap;">${row.period_label}</td>
                <td>${row.order_count} đơn</td>
                <td><strong>${formatVND(row.total_revenue)}</strong></td>
                <td style="width:35%;">
                    <div style="width:100%;height:7px;background:rgba(255,255,255,.05);border-radius:4px;overflow:hidden;">
                        <div style="width:${pct}%;height:100%;background:linear-gradient(90deg,var(--amber),var(--blue));border-radius:4px;"></div>
                    </div>
                </td>`;
            tbody.appendChild(tr);
        });
        if (!tbody.children.length) tbody.innerHTML = emptyRow(4, 'Không có đơn nào trong kỳ này.');
        document.getElementById('periodSummaryTotal').textContent = formatVND(totalRev);
    } catch (err) {
        tbody.innerHTML = emptyRow(4, 'Lỗi tải dữ liệu.');
        console.error('loadPeriodReport:', err);
    }
}

async function loadMenuTab() {
    try {
        const res = await API.get('menu.php?all=1');
        menuData = res?.data || [];
        // Populate category selector
        const catSel = document.getElementById('menuCategoryFilter');
        catSel.innerHTML = '<option value="all">Tất cả danh mục</option>';
        menuData.forEach(cat => {
            catSel.innerHTML += `<option value="${cat.category_id}">${cat.category_name}</option>`;
        });
        renderMenuTable('all');
    } catch (err) { console.error('loadMenuTab:', err); }
}

function renderMenuTable(catId) {
    const tbody = document.getElementById('menuTableBody');
    tbody.innerHTML = '';
    let found = false;
    menuData.forEach(cat => {
        if (catId !== 'all' && cat.category_id != catId) return;
        cat.items.forEach(item => {
            found = true;
            const availBadge = item.is_available
                ? '<span class="badge badge-success">Đang bán</span>'
                : '<span class="badge badge-secondary">Tạm ngừng</span>';
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${item.item_id}</td>
                <td><strong>${item.item_name}</strong></td>
                <td>${cat.category_name}</td>
                <td>${formatVND(item.base_price)}</td>
                <td>${availBadge}</td>
                <td>
                    <button class="btn btn-secondary" style="padding:4px 8px;font-size:.75rem;" onclick="toggleMenuAvailability(${item.item_id}, '${item.item_name}', ${item.is_available})">
                        <i class="fa-solid fa-power-off"></i>
                    </button>
                </td>`;
            tbody.appendChild(tr);
        });
    });
    if (!found) tbody.innerHTML = emptyRow(6);
}

async function loadStaffTab() {
    try {
        const res = await API.get('staff.php');
        // SM: can add/deactivate Barista; Admin: full control
        const canWrite = currentUser?.role === 'Admin' || currentUser?.role === 'StoreManager';

        const thead = document.querySelector('#staff-tab table thead tr');
        if (thead) {
            thead.innerHTML = '<th>Họ tên</th><th>Vai trò</th><th>SĐT</th><th>Trạng thái</th><th>Thao tác</th>';
        }

        const tbody = document.getElementById('rosterTableBody');
        tbody.innerHTML = '';
        if (res?.success && res.staff?.length) {
            res.staff.forEach(s => {
                const activeBadge = s.is_active
                    ? '<span class="badge badge-success">Đang làm</span>'
                    : '<span class="badge badge-secondary">Đã nghỉ</span>';
                const roleLabel = { StoreManager: 'Quản lý', Barista: 'Pha chế', Admin: 'Admin' }[s.role] || s.role;
                // SM can only edit Barista accounts; Admin can edit all
                const canEditThis = currentUser?.role === 'Admin' || s.role === 'Barista';
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><strong>${s.name}</strong></td>
                    <td>${roleLabel}</td>
                    <td>${s.phone || '—'}</td>
                    <td>${activeBadge}</td>
                    <td>${canWrite && canEditThis ? `
                        <button class="btn btn-secondary" style="padding:4px 8px;font-size:.75rem;margin-right:2px;" onclick='openMgrStaffModal(${JSON.stringify(s)})'>
                            <i class="fa-solid fa-pen-to-square"></i>
                        </button>
                        <button class="btn btn-secondary" style="padding:4px 8px;font-size:.75rem;margin-right:2px;" onclick="toggleStaffActive(${s.staff_id}, ${s.is_active})">
                            <i class="fa-solid fa-power-off"></i>
                        </button>
                        <button class="btn btn-secondary" style="padding:4px 8px;font-size:.75rem;" onclick="resetStaffPin(${s.staff_id}, '${s.name}')">
                            <i class="fa-solid fa-key"></i>
                        </button>` : '—'}</td>`;
                tbody.appendChild(tr);
            });
        } else {
            tbody.innerHTML = emptyRow(5);
        }
    } catch (err) { console.error('loadStaffTab:', err); }
}

// ── INVENTORY MODALS ───────────────────────────────────────────

function openAdjustmentModal(ingId) {
    activeIngredientForAdjustment = inventoryData.find(i => i.ingredient_id === ingId);
    if (!activeIngredientForAdjustment) return;
    document.getElementById('adjustingIngredientName').textContent = activeIngredientForAdjustment.name;
    document.getElementById('adjustIngredientUnit').textContent    = activeIngredientForAdjustment.unit;
    document.getElementById('adjustAmount').value  = '';
    document.getElementById('adjustReason').value  = '';
    document.getElementById('adjustActionType').value = 'add';
    document.getElementById('adjustmentModal').classList.add('show');
}

async function saveStockAdjustment() {
    const amount = parseFloat(document.getElementById('adjustAmount').value);
    const action = document.getElementById('adjustActionType').value;
    const reason = document.getElementById('adjustReason').value.trim();
    if (isNaN(amount) || amount < 0) { alert('Số lượng không hợp lệ!'); return; }
    if (!reason) { alert('Vui lòng điền lý do điều chỉnh!'); return; }
    const btn = document.getElementById('saveAdjustmentBtn');
    btn.disabled = true;
    try {
        const res = await API.post('inventory.php', {
            ingredient_id: activeIngredientForAdjustment.ingredient_id,
            amount, action_type: action, reason,
        });
        if (res?.success) {
            alert(res.message || 'Cập nhật kho thành công!');
            document.getElementById('adjustmentModal').classList.remove('show');
            await loadInventoryTab();
            await loadDashboardTab();
        } else { alert(res?.error || 'Lỗi lưu điều chỉnh kho'); }
    } catch (err) { alert(err.message); }
    finally { btn.disabled = false; btn.innerHTML = 'Lưu thay đổi'; }
}

function openAddIngredientModal() {
    ['newIngName','newIngStock','newIngThreshold'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('newIngUnit').value = 'kg';
    document.getElementById('addIngredientModal').classList.add('show');
}

async function saveNewIngredient() {
    const name      = document.getElementById('newIngName').value.trim();
    const stock     = parseFloat(document.getElementById('newIngStock').value);
    const unit      = document.getElementById('newIngUnit').value;
    const threshold = parseFloat(document.getElementById('newIngThreshold').value);
    if (!name || isNaN(stock) || stock < 0 || isNaN(threshold) || threshold < 0) {
        alert('Vui lòng điền đầy đủ và hợp lệ thông tin nguyên liệu!'); return;
    }
    const btn = document.getElementById('saveAddIngredientBtn');
    btn.disabled = true;
    try {
        const res = await API.post('inventory.php', { action: 'add_new', name, stock_level: stock, unit, low_stock_threshold: threshold });
        if (res?.success) {
            alert(`Đã thêm "${name}" vào kho thành công!`);
            document.getElementById('addIngredientModal').classList.remove('show');
            await loadInventoryTab();
        } else { alert(res?.error || 'Lỗi thêm nguyên liệu'); }
    } catch (err) { alert(err.message); }
    finally { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-plus"></i> Thêm vào kho'; }
}

// ── MENU MODAL ─────────────────────────────────────────────────

function openMenuItemModal(item = null, catId = null) {
    editingItemId = item ? item.item_id : null;
    document.getElementById('menuItemModalTitle').textContent = item ? 'Sửa món ăn' : 'Thêm món mới';
    document.getElementById('menuItemName').value    = item?.item_name  || '';
    document.getElementById('menuItemPrice').value   = item?.base_price || '';
    // Populate category selector
    const catSel = document.getElementById('menuItemCategory');
    catSel.innerHTML = '';
    menuData.forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat.category_id;
        opt.textContent = cat.category_name;
        if (catId && cat.category_id == catId) opt.selected = true;
        catSel.appendChild(opt);
    });
    document.getElementById('menuItemAvailable').checked = item ? !!item.is_available : true;
    document.getElementById('menuItemModal').classList.add('show');
}

async function saveMenuItem() {
    const payload = {
        item_name:    document.getElementById('menuItemName').value.trim(),
        category_id:  parseInt(document.getElementById('menuItemCategory').value),
        base_price:   parseFloat(document.getElementById('menuItemPrice').value),
        is_available: document.getElementById('menuItemAvailable').checked ? 1 : 0,
    };
    if (!payload.item_name || !payload.category_id || payload.base_price <= 0) {
        alert('Vui lòng điền đầy đủ tên, danh mục và giá hợp lệ!'); return;
    }
    if (editingItemId) payload._method = 'PUT', payload.item_id = editingItemId;
    try {
        const res = await API.post('menu.php', payload);
        if (res?.success) {
            document.getElementById('menuItemModal').classList.remove('show');
            await loadMenuTab();
            renderMenuTable(document.getElementById('menuCategoryFilter').value);
        } else { alert(res?.error || 'Lỗi lưu món'); }
    } catch (err) { alert(err.message); }
}

async function toggleMenuAvailability(itemId, name, currentState) {
    const action = currentState ? 'tạm ngừng' : 'mở bán lại';
    if (!confirm(`${action} món "${name}"?`)) return;
    try {
        const res = await API.post('menu.php', { _method: 'DELETE', item_id: itemId });
        if (res?.success) await loadMenuTab(), renderMenuTable(document.getElementById('menuCategoryFilter').value);
        else alert(res?.error || 'Lỗi');
    } catch (err) { alert(err.message); }
}

// ── STAFF MODAL (Manager view — Barista only) ──────────────────

function openMgrStaffModal(staff = null) {
    editingMenuStaffId = staff ? staff.staff_id : null;
    document.getElementById('mgrStaffModalTitle').textContent = staff ? 'Sửa nhân viên' : 'Thêm nhân viên mới';
    document.getElementById('mgrStaffName').value  = staff?.name  || '';
    document.getElementById('mgrStaffPhone').value = staff?.phone || '';
    document.getElementById('mgrStaffModal').classList.add('show');
}

async function saveMgrStaff() {
    const payload = {
        name:  document.getElementById('mgrStaffName').value.trim(),
        phone: document.getElementById('mgrStaffPhone').value.trim(),
        role:  'Barista',
    };
    if (editingMenuStaffId) payload._method = 'PUT', payload.staff_id = editingMenuStaffId;
    try {
        const res = await API.post('staff.php', payload);
        if (res?.success) {
            if (!editingMenuStaffId && res.default_password) {
                alert(`Tạo tài khoản thành công!\nMật khẩu mặc định: ${res.default_password}`);
            }
            document.getElementById('mgrStaffModal').classList.remove('show');
            await loadStaffTab();
        } else { alert(res?.error || 'Lỗi lưu nhân viên'); }
    } catch (err) { alert(err.message); }
}

async function toggleStaffActive(staffId, currentState) {
    if (!confirm(`${currentState ? 'Vô hiệu hóa' : 'Kích hoạt lại'} tài khoản nhân viên này?`)) return;
    try {
        const res = await API.post('staff.php', { _method: 'DEACTIVATE', staff_id: staffId });
        if (res?.success) await loadStaffTab();
        else alert(res?.error || 'Lỗi');
    } catch (err) { alert(err.message); }
}

async function resetStaffPin(staffId, name) {
    if (!confirm(`Đặt lại mật khẩu cho "${name}"?`)) return;
    try {
        const res = await API.post('staff.php', { _method: 'RESET_PIN', staff_id: staffId });
        if (res?.success) alert(`Mật khẩu mới: ${res.default_password}`);
        else alert(res?.error || 'Lỗi');
    } catch (err) { alert(err.message); }
}

// ── PROMOTIONS (chi nhánh — view only) ────────────────────────

async function loadPromotionsTab() {
    try {
        const res = await API.get('promotions.php');
        const tbody = document.getElementById('mgrPromotionsTableBody');
        tbody.innerHTML = '';
        if (res?.success && res.data?.length) {
            res.data.forEach(p => {
                const typeText   = p.discount_type === 'percent' ? 'Giảm %' : 'Giảm tiền';
                const valText    = p.discount_type === 'percent' ? `${p.discount_value}%` : formatVND(p.discount_value);
                const badge      = p.is_active
                    ? '<span class="badge badge-success">Đang chạy</span>'
                    : '<span class="badge badge-secondary">Tạm ngừng</span>';
                const scopeBadge = p.location_id === null
                    ? '<span class="badge badge-info">Toàn chuỗi</span>'
                    : '<span class="badge badge-brand">Chi nhánh</span>';
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><strong>${p.name}</strong></td>
                    <td>${typeText}</td>
                    <td><strong style="color:var(--amber);">${valText}</strong></td>
                    <td>${p.start_date}</td>
                    <td>${p.end_date}</td>
                    <td>${scopeBadge}</td>
                    <td>${badge}</td>`;
                tbody.appendChild(tr);
            });
        } else {
            tbody.innerHTML = emptyRow(7, 'Chưa có khuyến mãi nào.');
        }
    } catch (err) { console.error('loadPromotionsTab:', err); }
}

// ── LOYALTY / KHTT ────────────────────────────────────────────

let _loyaltyData = [];

async function loadLoyaltyTab() {
    try {
        const res = await API.get('loyalty_balance.php?limit=50');
        _loyaltyData = (res?.success && res.data?.length) ? res.data : [];
        filterLoyaltyList();
    } catch (err) { console.error('loadLoyaltyTab:', err); }
}

function filterLoyaltyList() {
    const q = (document.getElementById('loyaltySearchPhone')?.value || '').trim().toLowerCase();
    const tbody = document.getElementById('loyaltyListBody');
    tbody.innerHTML = '';
    const rows = q ? _loyaltyData.filter(c => c.phone?.toLowerCase().includes(q)) : _loyaltyData;
    if (rows.length) {
        rows.forEach(c => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${c.name}</strong></td>
                <td>${c.phone}</td>
                <td><strong style="color:var(--amber);">${c.points_balance} điểm</strong></td>`;
            tbody.appendChild(tr);
        });
    } else {
        tbody.innerHTML = emptyRow(3, q ? 'Không tìm thấy khách hàng.' : 'Chưa có khách hàng thân thiết.');
    }
}

// ── EVENT LISTENERS ────────────────────────────────────────────

function setupEventListeners() {
    document.querySelectorAll('.sidebar-menu .menu-item-btn').forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.target));
    });

    document.getElementById('logoutBtn').addEventListener('click', async () => {
        if (confirm('Đăng xuất?')) {
            const res = await API.get('auth.php?action=logout');
            if (res?.success) window.location.href = 'index.html';
        }
    });

    // Inventory
    document.getElementById('refreshInventoryBtn').addEventListener('click', loadInventoryTab);
    document.getElementById('addIngredientBtn').addEventListener('click', openAddIngredientModal);
    document.getElementById('closeAdjustmentModal').addEventListener('click', () => document.getElementById('adjustmentModal').classList.remove('show'));
    document.getElementById('cancelAdjustmentBtn').addEventListener('click', () => document.getElementById('adjustmentModal').classList.remove('show'));
    document.getElementById('saveAdjustmentBtn').addEventListener('click', saveStockAdjustment);
    document.getElementById('closeAddIngredientModal').addEventListener('click', () => document.getElementById('addIngredientModal').classList.remove('show'));
    document.getElementById('cancelAddIngredientBtn').addEventListener('click', () => document.getElementById('addIngredientModal').classList.remove('show'));
    document.getElementById('saveAddIngredientBtn').addEventListener('click', saveNewIngredient);

    // Menu (manager: view + toggle only)
    document.getElementById('menuCategoryFilter').addEventListener('change', e => renderMenuTable(e.target.value));

    // Staff (manager)
    document.getElementById('openAddMgrStaffBtn').addEventListener('click', () => openMgrStaffModal());
    document.getElementById('closeMgrStaffModal').addEventListener('click', () => document.getElementById('mgrStaffModal').classList.remove('show'));
    document.getElementById('cancelMgrStaffBtn').addEventListener('click', () => document.getElementById('mgrStaffModal').classList.remove('show'));
    document.getElementById('saveMgrStaffBtn').addEventListener('click', saveMgrStaff);

    // Reports — period filter buttons (delegated, buttons added dynamically)
    document.addEventListener('click', e => {
        const btn = e.target.closest('.period-btn');
        if (btn) loadPeriodReport(btn.dataset.period);
    });

    // Loyalty
    document.getElementById('refreshLoyaltyBtn').addEventListener('click', loadLoyaltyTab);
    document.getElementById('loyaltySearchPhone').addEventListener('input', filterLoyaltyList);
}

function switchTab(tabId) {
    document.querySelectorAll('.view-section').forEach(s => s.classList.remove('active'));
    const sec = document.getElementById(tabId);
    if (sec) sec.classList.add('active');
    document.querySelectorAll('.sidebar-menu .menu-item-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.target === tabId);
    });
    const titles = {
        'reports-tab':     'Báo cáo doanh thu',
        'inventory-tab':   'Quản lý kho hàng',
        'menu-tab':        'Thực đơn',
        'staff-tab':       'Quản lý nhân viên',
        'promotions-tab':  'Khuyến mãi chi nhánh',
        'loyalty-tab':     'Khách hàng thân thiết',
    };
    document.getElementById('currentTabTitle').textContent = titles[tabId] || '';
    if (tabId === 'inventory-tab')  loadInventoryTab();
    if (tabId === 'reports-tab')    loadReportsTab();
    if (tabId === 'menu-tab')       loadMenuTab();
    if (tabId === 'staff-tab')      loadStaffTab();
    if (tabId === 'promotions-tab') loadPromotionsTab();
    if (tabId === 'loyalty-tab')    loadLoyaltyTab();
}

function emptyRow(cols, msg = 'Không có dữ liệu.') {
    return `<tr><td colspan="${cols}" style="text-align:center;color:var(--text-3);padding:24px;">${msg}</td></tr>`;
}

function formatVND(amount) {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
}

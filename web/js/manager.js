// =============================================================
// FILE : web/js/manager.js
// DESC : Store Manager Dashboard front-end logic
// =============================================================

let currentUser = null;
let inventoryData = [];
let activeIngredientForAdjustment = null;

document.addEventListener('DOMContentLoaded', () => {
    initApp();
    setupEventListeners();
});

async function initApp() {
    try {
        // 1. Get user context
        const userRes = await API.get('auth.php?action=me');
        if (userRes && userRes.success) {
            currentUser = userRes.user;
            
            // Check authorization
            if (currentUser.role !== 'StoreManager' && currentUser.role !== 'Admin') {
                alert('Tài khoản không có quyền truy cập trang quản lý chi nhánh.');
                window.location.href = 'index.html';
                return;
            }
            
            document.getElementById('userName').textContent = currentUser.name;
            document.getElementById('userRole').textContent = currentUser.role === 'Admin' ? 'Admin / Manager' : 'Cửa hàng trưởng';
            document.getElementById('userAvatar').textContent = currentUser.name.charAt(0);
            document.getElementById('currentBranch').textContent = 'Chi nhánh: ' + currentUser.location_name;
        } else {
            window.location.href = 'index.html';
            return;
        }

        // Start clock
        setInterval(updateClock, 1000);
        updateClock();

        // 2. Load initially active tab data
        await loadDashboardTab();

    } catch (err) {
        console.error('Init Error:', err);
    }
}

function updateClock() {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('vi-VN') + ' - ' + now.toLocaleDateString('vi-VN');
    document.getElementById('currentTime').textContent = timeStr;
}

// ==============================================================================
// DATA LOADING BY TABS
// ==============================================================================

async function loadDashboardTab() {
    try {
        // Load branch history to calculate stats
        const historyRes = await API.get('order_history.php');
        if (historyRes && historyRes.success) {
            const orders = historyRes.data;
            let totalRevenue = 0;
            let paidCount = 0;

            orders.forEach(o => {
                if (o.order_status === 'Paid') {
                    // Check if order date is today
                    const orderDate = new Date(o.order_date).toDateString();
                    const today = new Date().toDateString();
                    if (orderDate === today) {
                        totalRevenue += o.total_amount;
                        paidCount++;
                    }
                }
            });

            document.getElementById('branchRevenue').textContent = formatVND(totalRevenue);
            document.getElementById('branchOrderCount').textContent = paidCount;
        }

        // Load low-stock alerts
        const lowStockRes = await API.get('low_stock.php');
        if (lowStockRes && lowStockRes.success) {
            const lowIngs = lowStockRes.low_ingredients;

            document.getElementById('branchLowStockCount').textContent = lowIngs.length;

            // Render low-stock ingredients
            const lowIngsTbody = document.getElementById('lowIngredientsBody');
            lowIngsTbody.innerHTML = '';
            if (lowIngs.length === 0) {
                lowIngsTbody.innerHTML = '<tr><td colspan="3" style="text-align: center; color: var(--text-muted); color: var(--success);"><i class="fa-solid fa-circle-check"></i> Đủ nguyên liệu trong kho.</td></tr>';
            } else {
                lowIngs.forEach(ing => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td><strong>${ing.name}</strong></td>
                        <td style="color: var(--danger); font-weight: bold;">${ing.stock_level} ${ing.unit}</td>
                        <td>${ing.low_stock_threshold} ${ing.unit}</td>
                    `;
                    lowIngsTbody.appendChild(tr);
                });
            }
        }
    } catch (err) {
        console.error('Error loading dashboard stats:', err);
    }
}

async function loadInventoryTab() {
    try {
        const res = await API.get('inventory.php');
        if (res && res.success) {
            inventoryData = res.data;
            const tbody = document.getElementById('inventoryTableBody');
            tbody.innerHTML = '';

            inventoryData.forEach(ing => {
                const tr = document.createElement('tr');
                const isLow = ing.stock_level < ing.low_stock_threshold;
                
                let statusBadge = '';
                if (ing.stock_level <= 0) {
                    statusBadge = '<span class="badge badge-danger">Hết hàng</span>';
                } else if (isLow) {
                    statusBadge = '<span class="badge badge-warning">Sắp hết</span>';
                } else {
                    statusBadge = '<span class="badge badge-success">An toàn</span>';
                }

                tr.innerHTML = `
                    <td>${ing.ingredient_id}</td>
                    <td><strong>${ing.name}</strong></td>
                    <td style="font-weight: 600; ${isLow ? 'color: var(--danger);' : ''}">${ing.stock_level}</td>
                    <td>${ing.unit}</td>
                    <td>${ing.low_stock_threshold}</td>
                    <td>${statusBadge}</td>
                    <td>
                        <button class="btn btn-secondary" style="padding: 4px 8px; font-size: 0.75rem;" onclick="openAdjustmentModal(${ing.ingredient_id})">
                            <i class="fa-solid fa-sliders"></i> Điều chỉnh
                        </button>
                    </td>
                `;
                tbody.appendChild(tr);
            });

            if (inventoryData.length === 0) {
                tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 30px;">Không có nguyên liệu nào trong kho.</td></tr>';
            }
        }
    } catch (err) {
        console.error('Error loading inventory:', err);
    }
}

async function loadReportsTab() {
    try {
        // 1. Load Sales by Item
        const itemRes = await API.get('sales_by_item.php');
        const itemTbody = document.getElementById('salesByItemBody');
        itemTbody.innerHTML = '';
        
        if (itemRes && itemRes.success && itemRes.data) {
            itemRes.data.forEach(row => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><strong>${row.item_name}</strong></td>
                    <td>${row.quantity_sold} ly/đĩa</td>
                    <td><strong>${formatVND(row.total_revenue)}</strong></td>
                `;
                itemTbody.appendChild(tr);
            });
            if (itemRes.data.length === 0) {
                itemTbody.innerHTML = '<tr><td colspan="3" style="text-align: center; color: var(--text-muted); padding: 20px;">Không có dữ liệu doanh thu món ăn.</td></tr>';
            }
        }

        // 2. Load Sales by Hour
        const hourRes = await API.get('sales_by_hour.php');
        const hourTbody = document.getElementById('salesByHourBody');
        hourTbody.innerHTML = '';

        if (hourRes && hourRes.success && hourRes.data) {
            // Find max revenue hour for percentage calculation
            const maxRev = Math.max(...hourRes.data.map(h => h.total_revenue)) || 1.0;

            hourRes.data.forEach(row => {
                const tr = document.createElement('tr');
                const activityPct = Math.round((row.total_revenue / maxRev) * 100);
                
                tr.innerHTML = `
                    <td>${row.hour_of_day.toString().padStart(2, '0')}:00</td>
                    <td>${row.order_count} đơn</td>
                    <td><strong>${formatVND(row.total_revenue)}</strong></td>
                    <td style="width: 40%;">
                        <div style="width: 100%; height: 8px; background: rgba(255,255,255,0.05); border-radius: 4px; overflow: hidden;">
                            <div style="width: ${activityPct}%; height: 100%; background: linear-gradient(90deg, var(--primary), var(--info)); border-radius: 4px;"></div>
                        </div>
                    </td>
                `;
                hourTbody.appendChild(tr);
            });
            if (hourRes.data.length === 0) {
                hourTbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--text-muted); padding: 20px;">Không có dữ liệu bán hàng theo giờ.</td></tr>';
            }
        }
    } catch (err) {
        console.error('Error loading reports:', err);
    }
}

async function loadStaffTab() {
    try {
        const res = await API.get('staff.php');
        if (res && res.success) {
            const tbody = document.getElementById('rosterTableBody');
            tbody.innerHTML = '';

            res.roster.forEach(r => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><strong>${r.name}</strong></td>
                    <td><span class="badge ${r.role === 'StoreManager' ? 'badge-info' : 'badge-secondary'}">${r.role}</span></td>
                    <td>${r.phone}</td>
                    <td><span style="color: var(--primary); font-weight: bold;">${r.shift}</span></td>
                    <td>${r.days}</td>
                `;
                tbody.appendChild(tr);
            });

            if (res.roster.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 30px;">Không có nhân viên đăng ký ca.</td></tr>';
            }
        }
    } catch (err) {
        console.error('Error loading staff roster:', err);
    }
}

// ==============================================================================
// STOCK ADJUSTMENT MODAL & POST ACTIONS
// ==============================================================================

function openAdjustmentModal(ingId) {
    activeIngredientForAdjustment = inventoryData.find(i => i.ingredient_id === ingId);
    if (!activeIngredientForAdjustment) return;

    document.getElementById('adjustingIngredientName').textContent = activeIngredientForAdjustment.name;
    document.getElementById('adjustIngredientUnit').textContent = activeIngredientForAdjustment.unit;
    document.getElementById('adjustAmount').value = '';
    document.getElementById('adjustReason').value = '';
    document.getElementById('adjustActionType').value = 'add';
    
    document.getElementById('adjustmentModal').classList.add('show');
}

async function saveStockAdjustment() {
    const amountInput = document.getElementById('adjustAmount');
    const amount = parseFloat(amountInput.value);
    const actionType = document.getElementById('adjustActionType').value;
    const reasonInput = document.getElementById('adjustReason');
    const reason = reasonInput.value.trim();

    if (isNaN(amount) || amount < 0) {
        alert('Vui lòng điền số lượng điều chỉnh hợp lệ!');
        return;
    }

    if (empty(reason)) {
        alert('Vui lòng điền lý do điều chỉnh kho (Bắt buộc)!');
        return;
    }

    const saveBtn = document.getElementById('saveAdjustmentBtn');
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang lưu...';

    const payload = {
        ingredient_id: activeIngredientForAdjustment.ingredient_id,
        amount: amount,
        action_type: actionType,
        reason: reason
    };

    try {
        const res = await API.post('inventory.php', payload);
        if (res && res.success) {
            alert(res.message || 'Cập nhật kho thành công!');
            closeAdjustmentModal();
            
            // Reload views
            await loadInventoryTab();
            await loadDashboardTab();
        } else {
            alert(res.error || 'Lỗi lưu điều chỉnh kho');
        }
    } catch (err) {
        alert(err.message);
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = 'Lưu thay đổi';
    }
}

function closeAdjustmentModal() {
    document.getElementById('adjustmentModal').classList.remove('show');
    activeIngredientForAdjustment = null;
}

// ==============================================================================
// ADD INGREDIENT MODAL
// ==============================================================================

function openAddIngredientModal() {
    document.getElementById('newIngName').value = '';
    document.getElementById('newIngStock').value = '';
    document.getElementById('newIngUnit').value = 'kg';
    document.getElementById('newIngThreshold').value = '';
    document.getElementById('addIngredientModal').classList.add('show');
}

async function saveNewIngredient() {
    const name = document.getElementById('newIngName').value.trim();
    const stock = parseFloat(document.getElementById('newIngStock').value);
    const unit = document.getElementById('newIngUnit').value;
    const threshold = parseFloat(document.getElementById('newIngThreshold').value);

    if (!name) {
        alert('Vui lòng nhập tên nguyên vật liệu!');
        return;
    }
    if (isNaN(stock) || stock < 0) {
        alert('Số lượng không hợp lệ!');
        return;
    }
    if (isNaN(threshold) || threshold < 0) {
        alert('Định mức cảnh báo không hợp lệ!');
        return;
    }

    const saveBtn = document.getElementById('saveAddIngredientBtn');
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang lưu...';

    try {
        const res = await API.post('inventory.php', {
            action: 'add_new',
            name: name,
            stock_level: stock,
            unit: unit,
            low_stock_threshold: threshold
        });
        if (res && res.success) {
            alert(`Đã thêm ngành vật liệu "${name}" vào kho thành công!`);
            document.getElementById('addIngredientModal').classList.remove('show');
            await loadInventoryTab();
            await loadDashboardTab();
        } else {
            alert(res.error || 'Lỗi thêm nguyên vật liệu');
        }
    } catch (err) {
        alert(err.message);
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<i class="fa-solid fa-plus"></i> Thêm vào kho';
    }
}

// ==============================================================================
// VIEW TABS & SWITCHING
// ==============================================================================

function setupEventListeners() {
    // Menu Tab Switching
    document.querySelectorAll('.sidebar-menu .menu-item-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const target = btn.getAttribute('data-target');
            switchTab(target);
        });
    });

    // Logout
    document.getElementById('logoutBtn').addEventListener('click', async () => {
        if (confirm('Bạn có chắc chắn muốn đăng xuất không?')) {
            const res = await API.get('auth.php?action=logout');
            if (res && res.success) {
                window.location.href = 'index.html';
            }
        }
    });

    // Refresh inventory table
    document.getElementById('refreshInventoryBtn').addEventListener('click', loadInventoryTab);

    // Modal close buttons
    document.getElementById('closeAdjustmentModal').addEventListener('click', closeAdjustmentModal);
    document.getElementById('cancelAdjustmentBtn').addEventListener('click', closeAdjustmentModal);
    document.getElementById('saveAdjustmentBtn').addEventListener('click', saveStockAdjustment);

    // Add ingredient modal
    document.getElementById('addIngredientBtn').addEventListener('click', openAddIngredientModal);
    document.getElementById('closeAddIngredientModal').addEventListener('click', () => document.getElementById('addIngredientModal').classList.remove('show'));
    document.getElementById('cancelAddIngredientBtn').addEventListener('click', () => document.getElementById('addIngredientModal').classList.remove('show'));
    document.getElementById('saveAddIngredientBtn').addEventListener('click', saveNewIngredient);
}

function switchTab(tabId) {
    document.querySelectorAll('.view-section').forEach(sec => sec.classList.remove('active'));
    
    const targetSec = document.getElementById(tabId);
    if (targetSec) {
        targetSec.classList.add('active');
        
        document.querySelectorAll('.sidebar-menu .menu-item-btn').forEach(btn => {
            if (btn.getAttribute('data-target') === tabId) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        // Trigger updates depending on active tab
        let tabTitle = 'Tổng quan chi nhánh';
        if (tabId === 'dashboard-tab') {
            tabTitle = 'Tổng quan chi nhánh';
            loadDashboardTab();
        } else if (tabId === 'inventory-tab') {
            tabTitle = 'Quản lý kho hàng';
            loadInventoryTab();
        } else if (tabId === 'reports-tab') {
            tabTitle = 'Báo cáo doanh số';
            loadReportsTab();
        } else if (tabId === 'staff-tab') {
            tabTitle = 'Nhân viên & Ca trực';
            loadStaffTab();
        }
        document.getElementById('currentTabTitle').textContent = tabTitle;
    }
}

// ==============================================================================
// UTILITY FUNCTIONS
// ==============================================================================

function formatVND(amount) {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
}

function empty(val) {
    return val === undefined || val === null || val.length === 0;
}

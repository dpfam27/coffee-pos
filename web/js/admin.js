// =============================================================
// FILE : web/js/admin.js
// DESC : Chain Admin Portal Dashboard front-end logic
// =============================================================

let currentUser = null;

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
            if (currentUser.role !== 'Admin') {
                alert('Tài khoản không có quyền truy cập trang quản trị chuỗi.');
                window.location.href = 'index.html';
                return;
            }
            
            document.getElementById('userName').textContent = currentUser.name;
            document.getElementById('userRole').textContent = 'Quản trị viên chuỗi';
            document.getElementById('userAvatar').textContent = currentUser.name.charAt(0);
        } else {
            window.location.href = 'index.html';
            return;
        }

        // Start clock
        setInterval(updateClock, 1000);
        updateClock();

        // 2. Load initial dashboard view
        await loadOverviewTab();

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

async function loadOverviewTab() {
    try {
        // 1. Load chain summary stats
        const statsRes = await API.get('chain_dashboard.php');
        if (statsRes && statsRes.success && statsRes.data) {
            const data = statsRes.data;
            document.getElementById('chainRevenue').textContent = formatVND(data.total_revenue);
            document.getElementById('chainOrders').textContent = data.total_orders;
            document.getElementById('chainAvgTicket').textContent = formatVND(data.avg_ticket);
            document.getElementById('chainLowStockCount').textContent = data.low_stock_count;
        }

        // 2. Load revenue by branch
        const branchRes = await API.get('revenue_by_branch.php');
        const branchTbody = document.getElementById('branchRevenueBody');
        branchTbody.innerHTML = '';
        
        if (branchRes && branchRes.success && branchRes.data) {
            const branches = branchRes.data;
            const totalRev = branches.reduce((sum, b) => sum + b.revenue, 0.0) || 1.0;

            branches.forEach(b => {
                const tr = document.createElement('tr');
                const contributionPct = Math.round((b.revenue / totalRev) * 100);
                
                tr.innerHTML = `
                    <td><strong>${b.location_name}</strong></td>
                    <td>${b.order_count} đơn</td>
                    <td><strong>${formatVND(b.revenue)}</strong></td>
                    <td>
                        <span style="font-weight: 600; color: var(--primary);">${contributionPct}%</span>
                        <div style="width: 100%; height: 5px; background: rgba(255,255,255,0.05); border-radius: 2px; overflow: hidden; margin-top: 5px;">
                            <div style="width: ${contributionPct}%; height: 100%; background: var(--primary); border-radius: 2px;"></div>
                        </div>
                    </td>
                `;
                branchTbody.appendChild(tr);
            });
            if (branches.length === 0) {
                branchTbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--text-muted); padding: 20px;">Không có dữ liệu chi nhánh.</td></tr>';
            }
        }

        // 3. Load top customer loyalty list
        const custRes = await API.get('loyalty_balance.php');
        const custTbody = document.getElementById('topCustomersBody');
        custTbody.innerHTML = '';

        if (custRes && custRes.success && custRes.data) {
            custRes.data.forEach(c => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><strong>${c.name}</strong></td>
                    <td>${c.phone}</td>
                    <td><strong style="color: var(--warning);">${c.points_balance} điểm</strong></td>
                `;
                custTbody.appendChild(tr);
            });
            if (custRes.data.length === 0) {
                custTbody.innerHTML = '<tr><td colspan="3" style="text-align: center; color: var(--text-muted); padding: 20px;">Không có dữ liệu hội viên.</td></tr>';
            }
        }

    } catch (err) {
        console.error('Error loading overview:', err);
    }
}

async function loadBranchesTab() {
    try {
        const res = await API.get('branches.php');
        if (res && res.success) {
            const tbody = document.getElementById('branchesTableBody');
            tbody.innerHTML = '';

            res.data.forEach(b => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${b.location_id}</td>
                    <td><strong>${b.name}</strong></td>
                    <td>${b.address}</td>
                    <td>${b.phone}</td>
                `;
                tbody.appendChild(tr);
            });

            if (res.data.length === 0) {
                tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--text-muted); padding: 20px;">Không có chi nhánh nào.</td></tr>';
            }
        }
    } catch (err) {
        console.error('Error loading branches:', err);
    }
}

async function loadCustomizationTab() {
    try {
        const res = await API.get('modifier_revenue.php');
        if (res && res.success) {
            const tbody = document.getElementById('customizationTableBody');
            tbody.innerHTML = '';

            res.data.forEach(m => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${m.group_name}</td>
                    <td><strong>${m.option_name}</strong></td>
                    <td>${m.times_chosen} lần</td>
                    <td><strong style="color: var(--success);">${formatVND(parseFloat(m.extra_revenue))}</strong></td>
                `;
                tbody.appendChild(tr);
            });

            if (res.data.length === 0) {
                tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--text-muted); padding: 20px;">Không có dữ liệu doanh thu topping.</td></tr>';
            }
        }
    } catch (err) {
        console.error('Error loading customizations report:', err);
    }
}

async function loadPromotionsTab() {
    try {
        const res = await API.get('promotions.php');
        if (res && res.success) {
            const tbody = document.getElementById('promotionsTableBody');
            tbody.innerHTML = '';

            res.data.forEach(p => {
                const tr = document.createElement('tr');
                
                const typeText = p.discount_type === 'percent' ? 'Giảm %' : 'Giảm tiền mặt';
                const valText = p.discount_type === 'percent' ? `${p.discount_value}%` : formatVND(p.discount_value);
                const isActive = p.is_active === 1;
                const statusBadge = isActive ? '<span class="badge badge-success">Đang chạy</span>' : '<span class="badge badge-secondary">Tạm ngừng</span>';

                tr.innerHTML = `
                    <td>${p.promotion_id}</td>
                    <td><strong>${p.name}</strong></td>
                    <td>${typeText}</td>
                    <td><strong style="color: var(--primary);">${valText}</strong></td>
                    <td>${p.start_date}</td>
                    <td>${p.end_date}</td>
                    <td>${statusBadge}</td>
                `;
                tbody.appendChild(tr);
            });

            if (res.data.length === 0) {
                tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 20px;">Không có chương trình khuyến mãi nào.</td></tr>';
            }
        }
    } catch (err) {
        console.error('Error loading promotions:', err);
    }
}

async function loadAuditTab() {
    try {
        const res = await API.get('audit_log.php');
        if (res && res.success) {
            const tbody = document.getElementById('auditTableBody');
            tbody.innerHTML = '';

            res.data.forEach(log => {
                const tr = document.createElement('tr');
                
                let actionBadge = '';
                if (log.action_type.includes('CREATE')) {
                    actionBadge = `<span class="badge badge-success">${log.action_type}</span>`;
                } else if (log.action_type.includes('UPDATE')) {
                    actionBadge = `<span class="badge badge-info">${log.action_type}</span>`;
                } else if (log.action_type.includes('DELETE') || log.action_type.includes('VOID') || log.action_type.includes('CANCEL')) {
                    actionBadge = `<span class="badge badge-danger">${log.action_type}</span>`;
                } else {
                    actionBadge = `<span class="badge badge-secondary">${log.action_type}</span>`;
                }

                tr.innerHTML = `
                    <td>${log.log_id}</td>
                    <td style="font-size: 0.8rem; white-space: nowrap;">${log.action_timestamp}</td>
                    <td><small>${log.location_name}</small></td>
                    <td><strong>${log.staff_name}</strong> <small style="color: var(--text-secondary);">(${log.staff_role})</small></td>
                    <td>${actionBadge}</td>
                    <td><code>${log.table_affected}</code></td>
                    <td><code>${log.record_id}</code></td>
                    <td><span style="font-size: 0.85rem;">${log.details}</span></td>
                `;
                tbody.appendChild(tr);
            });

            if (res.data.length === 0) {
                tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: var(--text-muted); padding: 30px;">Nhật ký hệ thống trống.</td></tr>';
            }
        }
    } catch (err) {
        console.error('Error loading audit log:', err);
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
        let tabTitle = 'Tổng quan chuỗi';
        if (tabId === 'overview-tab') {
            tabTitle = 'Tổng quan chuỗi';
            loadOverviewTab();
        } else if (tabId === 'branches-tab') {
            tabTitle = 'Danh sách chi nhánh';
            loadBranchesTab();
        } else if (tabId === 'customization-tab') {
            tabTitle = 'Phân tích doanh thu Topping';
            loadCustomizationTab();
        } else if (tabId === 'promotions-tab') {
            tabTitle = 'Quản lý chương trình khuyến mãi';
            loadPromotionsTab();
        } else if (tabId === 'audit-tab') {
            tabTitle = 'Nhật ký hệ thống (Audit Log)';
            loadAuditTab();
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

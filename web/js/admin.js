// =============================================================
// FILE : web/js/admin.js
// DESC : Admin Portal — chain overview, CRUD branches, promotions, staff
// =============================================================

let currentUser = null;

document.addEventListener('DOMContentLoaded', () => {
    initApp();
    setupEventListeners();
});

async function initApp() {
    try {
        const userRes = await API.get('auth.php?action=me');
        if (userRes && userRes.success) {
            currentUser = userRes.user;
            if (currentUser.role !== 'Admin') {
                alert('Tài khoản không có quyền truy cập trang quản trị chuỗi.');
                window.location.href = 'index.html';
                return;
            }
            document.getElementById('userName').textContent   = currentUser.name;
            document.getElementById('userRole').textContent   = 'Quản trị viên chuỗi';
            document.getElementById('userAvatar').textContent = currentUser.name.charAt(0);
            // Sync mobile bottom-nav account dropdown
            const _av = document.getElementById('bnAvatarAdmin');
            const _nm = document.getElementById('bnNameAdmin');
            const _rl = document.getElementById('bnRoleAdmin');
            if (_av) _av.textContent = currentUser.name.charAt(0);
            if (_nm) _nm.textContent = currentUser.name;
            if (_rl) _rl.textContent = 'Quản trị viên chuỗi';
        } else {
            window.location.href = 'index.html';
            return;
        }
        setInterval(updateClock, 1000);
        updateClock();
        await loadReportsTab();
    } catch (err) {
        console.error('Init Error:', err);
    }
}

function updateClock() {
    const now = new Date();
    document.getElementById('currentTime').textContent =
        now.toLocaleTimeString('vi-VN') + ' — ' + now.toLocaleDateString('vi-VN');
}

// ── TAB LOADERS ────────────────────────────────────────────────

async function loadOverviewTab() {
    try {
        const [statsRes, branchRes, custRes] = await Promise.all([
            API.get('chain_dashboard.php'),
            API.get('revenue_by_branch.php'),
            API.get('loyalty_balance.php'),
        ]);

        if (statsRes?.success && statsRes.data) {
            const d = statsRes.data;
            document.getElementById('chainRevenue').textContent       = formatVND(d.total_revenue);
            document.getElementById('chainOrders').textContent        = d.total_orders;
            const lowCount = parseInt(d.low_stock_count) || 0;
            const countEl  = document.getElementById('chainLowStockCount');
            const iconEl   = document.getElementById('chainLowStockIcon');
            countEl.textContent  = lowCount;
            countEl.style.color  = lowCount > 0 ? 'var(--red)' : 'var(--t1)';
            if (iconEl) {
                iconEl.className = lowCount > 0 ? 'stat-icon danger' : 'stat-icon success';
                iconEl.querySelector('i').className = lowCount > 0
                    ? 'fa-solid fa-triangle-exclamation'
                    : 'fa-solid fa-circle-check';
            }
        }

        const branchTbody = document.getElementById('branchRevenueBody');
        branchTbody.innerHTML = '';
        if (branchRes?.success && branchRes.data?.length) {
            const totalRev = branchRes.data.reduce((s, b) => s + parseFloat(b.revenue), 0) || 1;
            branchRes.data.forEach(b => {
                const pct = Math.round((parseFloat(b.revenue) / totalRev) * 100);
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><strong>${b.location_name}</strong></td>
                    <td>${b.order_count} đơn</td>
                    <td><strong>${formatVND(b.revenue)}</strong></td>
                    <td>
                        <span style="font-weight:600;color:var(--amber);">${pct}%</span>
                        <div style="width:100%;height:5px;background:rgba(255,255,255,.05);border-radius:2px;overflow:hidden;margin-top:5px;">
                            <div style="width:${pct}%;height:100%;background:var(--amber);border-radius:2px;"></div>
                        </div>
                    </td>`;
                branchTbody.appendChild(tr);
            });
        } else {
            branchTbody.innerHTML = emptyRow(4);
        }

        const custTbody = document.getElementById('topCustomersBody');
        custTbody.innerHTML = '';
        if (custRes?.success && custRes.data?.length) {
            custRes.data.forEach(c => {
                const tr = document.createElement('tr');
                tr.innerHTML = `<td><strong>${c.name}</strong></td><td>${c.phone}</td><td><strong style="color:var(--amber);">${c.points_balance} điểm</strong></td>`;
                custTbody.appendChild(tr);
            });
        } else {
            custTbody.innerHTML = emptyRow(3);
        }
    } catch (err) { console.error('loadOverviewTab:', err); }
}

async function loadBranchesTab() {
    try {
        const res = await API.get('branches.php');
        const tbody = document.getElementById('branchesTableBody');
        tbody.innerHTML = '';
        if (res?.success && res.data?.length) {
            res.data.forEach(b => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${b.location_id}</td>
                    <td><strong>${b.name}</strong></td>
                    <td>${b.address}</td>
                    <td>${b.phone || '—'}</td>
                    <td><code style="font-size:.8rem;">${b.cancel_pin}</code></td>
                    <td>${b.staff_count} NV</td>
                    <td>
                        <button class="btn btn-secondary" style="padding:4px 8px;font-size:.75rem;" onclick="openBranchModal(${JSON.stringify(b).split('"').join('&quot;')})">
                            <i class="fa-solid fa-pen-to-square"></i> Sửa
                        </button>
                    </td>`;
                tbody.appendChild(tr);
            });
        } else {
            tbody.innerHTML = emptyRow(7);
        }
    } catch (err) { console.error('loadBranchesTab:', err); }
}

let adminCurrentPeriod = 'day';

async function loadReportsTab() {
    try {
        const res = await API.get('item_revenue.php');
        const tbody = document.getElementById('adminItemRevenueBody');
        tbody.innerHTML = '';
        if (res?.success && res.data?.length) {
            res.data.forEach(m => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><strong>${m.item_name}</strong></td>
                    <td>${m.quantity_sold}</td>
                    <td><strong style="color:var(--green);">${formatVND(parseFloat(m.total_revenue))}</strong></td>`;
                tbody.appendChild(tr);
            });
        } else {
            tbody.innerHTML = emptyRow(3);
        }
    } catch (err) { console.error('loadReportsTab:', err); }
    await loadAdminPeriodReport(adminCurrentPeriod);
}

async function loadAdminPeriodReport(period) {
    adminCurrentPeriod = period;
    document.querySelectorAll('.admin-period-btn').forEach(b => {
        b.className = b.dataset.period === period ? 'btn btn-primary admin-period-btn' : 'btn btn-secondary admin-period-btn';
    });
    const colLabels     = { day: 'Khung giờ', week: 'Tuần', month: 'Tháng' };
    const summaryLabels = { day: 'Tổng hôm nay:', week: 'Tổng các tuần:', month: 'Tổng các tháng:' };
    document.getElementById('adminPeriodColHeader').textContent    = colLabels[period];
    document.getElementById('adminPeriodSummaryLabel').textContent = summaryLabels[period];

    const tbody = document.getElementById('adminSalesByTimeBody');
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:var(--t2);padding:20px;"><i class="fa-solid fa-spinner fa-spin"></i></td></tr>`;
    try {
        const res = await API.get(`branch_daily_revenue.php?period=${period}`);
        tbody.innerHTML = '';
        if (!res?.success || !res.data?.length) {
            tbody.innerHTML = emptyRow(4, 'Không có dữ liệu cho kỳ này.');
            document.getElementById('adminPeriodSummaryTotal').textContent = formatVND(0);
            return;
        }
        const maxRev = Math.max(...res.data.map(r => r.total_revenue)) || 1;
        let totalRev = 0;
        res.data.forEach(row => {
            const pct = Math.round((row.total_revenue / maxRev) * 100);
            totalRev += parseFloat(row.total_revenue);
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
        document.getElementById('adminPeriodSummaryTotal').textContent = formatVND(totalRev);
    } catch (err) {
        tbody.innerHTML = emptyRow(4, 'Lỗi tải dữ liệu.');
    }
}

async function loadPromotionsTab() {
    try {
        const res = await API.get('promotions.php');
        const tbody = document.getElementById('promotionsTableBody');
        tbody.innerHTML = '';
        if (res?.success && res.data?.length) {
            res.data.forEach(p => {
                const typeText   = p.discount_type === 'percent' ? 'Giảm %' : 'Giảm tiền';
                const valText    = p.discount_type === 'percent' ? `${p.discount_value}%` : formatVND(p.discount_value);
                const badge      = p.is_active ? '<span class="badge badge-success">Đang chạy</span>' : '<span class="badge badge-secondary">Tạm ngừng</span>';
                const scopeBadge = p.location_id === null
                    ? '<span class="badge badge-info">Toàn chuỗi</span>'
                    : `<span class="badge badge-secondary">${p.scope_label}</span>`;
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${p.promotion_id}</td>
                    <td><strong>${p.name}</strong></td>
                    <td>${scopeBadge}</td>
                    <td>${typeText}</td>
                    <td><strong style="color:var(--amber);">${valText}</strong></td>
                    <td>${p.start_date}</td>
                    <td>${p.end_date}</td>
                    <td>${badge}</td>
                    <td>
                        <button class="btn btn-secondary" style="padding:4px 8px;font-size:.75rem;margin-right:4px;" onclick='openPromoModal(${JSON.stringify(p)})'>
                            <i class="fa-solid fa-pen-to-square"></i>
                        </button>
                        <button class="btn btn-danger" style="padding:4px 8px;font-size:.75rem;" onclick="deletePromo(${p.promotion_id}, '${p.name}')">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </td>`;
                tbody.appendChild(tr);
            });
        } else {
            tbody.innerHTML = emptyRow(9);
        }
    } catch (err) { console.error('loadPromotionsTab:', err); }
}

async function loadStaffTab() {
    try {
        const locRes = await API.get('branches.php');
        const locSel = document.getElementById('staffLocationFilter');
        if (locRes?.success && locRes.data) {
            const existingVal = locSel.value;
            locSel.innerHTML = locRes.data.map(l =>
                `<option value="${l.location_id}">${l.name}</option>`).join('');
            if (existingVal) locSel.value = existingVal;
        }
        await loadStaffForLocation();
    } catch (err) { console.error('loadStaffTab:', err); }
}

async function loadStaffForLocation() {
    const locId = document.getElementById('staffLocationFilter').value;
    if (!locId) return;
    try {
        const res = await API.get(`staff.php?location_id=${locId}`);
        const tbody = document.getElementById('staffTableBody');
        tbody.innerHTML = '';
        if (res?.success && res.staff?.length) {
            res.staff.forEach(s => {
                const activeBadge = s.is_active
                    ? '<span class="badge badge-success">Đang làm</span>'
                    : '<span class="badge badge-secondary">Đã nghỉ</span>';
                const roleLabel = { Admin: 'Quản trị viên', StoreManager: 'Quản lý CS', Barista: 'Pha chế' }[s.role] || s.role;
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${s.staff_id}</td>
                    <td><strong>${s.name}</strong></td>
                    <td>${roleLabel}</td>
                    <td>${s.phone || '—'}</td>
                    <td>${activeBadge}</td>
                    <td>
                        <button class="btn btn-secondary" style="padding:4px 8px;font-size:.75rem;margin-right:2px;" onclick='openStaffModal(${JSON.stringify(s)}, ${locId})'>
                            <i class="fa-solid fa-pen-to-square"></i>
                        </button>
                        <button class="btn btn-secondary" style="padding:4px 8px;font-size:.75rem;margin-right:2px;" onclick="toggleStaffActive(${s.staff_id}, ${s.is_active})">
                            <i class="fa-solid fa-power-off"></i>
                        </button>
                        <button class="btn btn-secondary" style="padding:4px 8px;font-size:.75rem;" onclick="resetStaffPin(${s.staff_id}, '${s.name}')">
                            <i class="fa-solid fa-key"></i>
                        </button>
                    </td>`;
                tbody.appendChild(tr);
            });
        } else {
            tbody.innerHTML = emptyRow(6);
        }
    } catch (err) { console.error('loadStaffForLocation:', err); }
}

// ── BRANCH MODAL ───────────────────────────────────────────────

let editingBranchId = null;

function openBranchModal(branch = null) {
    editingBranchId = branch ? branch.location_id : null;
    document.getElementById('branchModalTitle').textContent = branch ? 'Sửa chi nhánh' : 'Thêm chi nhánh mới';
    document.getElementById('branchName').value       = branch?.name    || '';
    document.getElementById('branchAddress').value    = branch?.address || '';
    document.getElementById('branchPhone').value      = branch?.phone   || '';
    document.getElementById('branchCancelPin').value  = branch?.cancel_pin || '0000';
    document.getElementById('branchModal').classList.add('show');
}

async function saveBranch() {
    const payload = {
        name:       document.getElementById('branchName').value.trim(),
        address:    document.getElementById('branchAddress').value.trim(),
        phone:      document.getElementById('branchPhone').value.trim(),
        cancel_pin: document.getElementById('branchCancelPin').value.trim(),
    };
    if (editingBranchId) payload._method = 'PUT', payload.location_id = editingBranchId;
    try {
        const res = await API.post('branches.php', payload);
        if (res?.success) {
            document.getElementById('branchModal').classList.remove('show');
            await loadBranchesTab();
        } else {
            alert(res?.error || 'Lỗi lưu chi nhánh');
        }
    } catch (err) { alert(err.message); }
}

// ── PROMO MODAL ────────────────────────────────────────────────

let editingPromoId = null;

async function openPromoModal(promo = null) {
    editingPromoId = promo ? promo.promotion_id : null;
    document.getElementById('promoModalTitle').textContent = promo ? 'Sửa khuyến mãi' : 'Thêm khuyến mãi mới';
    document.getElementById('promoName').value         = promo?.name           || '';
    document.getElementById('promoType').value         = promo?.discount_type  || 'percent';
    document.getElementById('promoValue').value        = promo?.discount_value || '';
    document.getElementById('promoStartDate').value    = promo?.start_date     || '';
    document.getElementById('promoEndDate').value      = promo?.end_date       || '';
    document.getElementById('promoIsActive').checked  = promo ? !!promo.is_active : true;

    // Populate location dropdown
    const locSel = document.getElementById('promoLocationId');
    const branchRes = await API.get('branches.php');
    locSel.innerHTML = '<option value="">Toàn chuỗi</option>';
    if (branchRes?.success && branchRes.data) {
        branchRes.data.forEach(b => {
            locSel.innerHTML += `<option value="${b.location_id}">${b.name}</option>`;
        });
    }
    locSel.value = promo?.location_id || '';

    document.getElementById('promoModal').classList.add('show');
}

async function savePromo() {
    const locVal = document.getElementById('promoLocationId').value;
    const payload = {
        name:           document.getElementById('promoName').value.trim(),
        discount_type:  document.getElementById('promoType').value,
        discount_value: parseFloat(document.getElementById('promoValue').value),
        start_date:     document.getElementById('promoStartDate').value,
        end_date:       document.getElementById('promoEndDate').value,
        is_active:      document.getElementById('promoIsActive').checked ? 1 : 0,
        location_id:    locVal ? parseInt(locVal) : null,
    };
    if (editingPromoId) payload._method = 'PUT', payload.promotion_id = editingPromoId;
    try {
        const res = await API.post('promotions.php', payload);
        if (res?.success) {
            document.getElementById('promoModal').classList.remove('show');
            await loadPromotionsTab();
        } else {
            alert(res?.error || 'Lỗi lưu khuyến mãi');
        }
    } catch (err) { alert(err.message); }
}

async function deletePromo(promoId, name) {
    if (!confirm(`Xóa/vô hiệu hóa khuyến mãi "${name}"?`)) return;
    try {
        const res = await API.post('promotions.php', { _method: 'DELETE', promotion_id: promoId });
        if (res?.success) {
            alert(res.message);
            await loadPromotionsTab();
        } else {
            alert(res?.error || 'Lỗi xóa khuyến mãi');
        }
    } catch (err) { alert(err.message); }
}

// ── STAFF MODAL ────────────────────────────────────────────────

let editingStaffId = null;
let editingStaffLocId = null;

async function openStaffModal(staff = null, locationId = null) {
    editingStaffId    = staff ? staff.staff_id : null;
    editingStaffLocId = locationId || document.getElementById('staffLocationFilter').value;

    // Populate branch dropdown
    const locSel = document.getElementById('staffLocationId');
    const branchRes = await API.get('branches.php');
    locSel.innerHTML = '<option value="">-- Chọn chi nhánh --</option>';
    if (branchRes?.success && branchRes.data) {
        branchRes.data.forEach(b => {
            locSel.innerHTML += `<option value="${b.location_id}">${b.name}</option>`;
        });
    }
    locSel.value = staff?.location_id || editingStaffLocId || '';

    document.getElementById('staffModalTitle').textContent = staff ? 'Sửa nhân viên' : 'Thêm nhân viên mới';
    document.getElementById('staffName').value  = staff?.name  || '';
    document.getElementById('staffPhone').value = staff?.phone || '';
    document.getElementById('staffRole').value  = staff?.role  || 'Barista';
    document.getElementById('staffModal').classList.add('show');
}

async function saveStaff() {
    const locId = parseInt(document.getElementById('staffLocationId').value);
    if (!locId) { alert('Vui lòng chọn chi nhánh!'); return; }
    const payload = {
        name:        document.getElementById('staffName').value.trim(),
        phone:       document.getElementById('staffPhone').value.trim(),
        role:        document.getElementById('staffRole').value,
        location_id: locId,
    };
    if (editingStaffId) payload._method = 'PUT', payload.staff_id = editingStaffId;
    try {
        const res = await API.post('staff.php', payload);
        if (res?.success) {
            if (!editingStaffId && res.default_password) {
                alert(`Tạo tài khoản thành công!\nMật khẩu mặc định: ${res.default_password}`);
            }
            document.getElementById('staffModal').classList.remove('show');
            await loadStaffForLocation();
        } else {
            alert(res?.error || 'Lỗi lưu nhân viên');
        }
    } catch (err) { alert(err.message); }
}

async function toggleStaffActive(staffId, currentState) {
    const action = currentState ? 'vô hiệu hóa' : 'kích hoạt lại';
    if (!confirm(`Xác nhận ${action} tài khoản nhân viên này?`)) return;
    try {
        const res = await API.post('staff.php', { _method: 'DEACTIVATE', staff_id: staffId });
        if (res?.success) await loadStaffForLocation();
        else alert(res?.error || 'Lỗi');
    } catch (err) { alert(err.message); }
}

async function resetStaffPin(staffId, name) {
    if (!confirm(`Đặt lại mật khẩu cho nhân viên "${name}"?`)) return;
    try {
        const res = await API.post('staff.php', { _method: 'RESET_PIN', staff_id: staffId });
        if (res?.success) alert(`Mật khẩu mới: ${res.default_password}`);
        else alert(res?.error || 'Lỗi đặt lại mật khẩu');
    } catch (err) { alert(err.message); }
}

// ── ORDER HISTORY (toàn chuỗi) ────────────────────────────────

let allOrderHistory = [];

async function loadOrderHistoryTab() {
    try {
        const res = await API.get('order_history.php');
        allOrderHistory = res?.data || [];

        // Populate branch filter
        const branchSel = document.getElementById('orderHistoryBranchFilter');
        const branches = [...new Set(allOrderHistory.map(o => o.location_name).filter(Boolean))];
        branchSel.innerHTML = '<option value="all">Tất cả chi nhánh</option>';
        branches.forEach(b => {
            branchSel.innerHTML += `<option value="${b}">${b}</option>`;
        });

        renderOrderHistoryTable('all');
    } catch (err) { console.error('loadOrderHistoryTab:', err); }
}

function renderOrderHistoryTable(branchFilter) {
    const tbody = document.getElementById('adminOrderHistoryBody');
    tbody.innerHTML = '';
    const filtered = branchFilter === 'all'
        ? allOrderHistory
        : allOrderHistory.filter(o => o.location_name === branchFilter);

    let total = 0;
    if (!filtered.length) {
        tbody.innerHTML = emptyRow(9);
        document.getElementById('adminOrderHistoryTotal').textContent = formatVND(0);
        return;
    }
    filtered.forEach(o => {
        const statusBadge = o.order_status === 'Completed'
            ? '<span class="badge badge-success">Hoàn thành</span>'
            : '<span class="badge badge-danger">Đã hủy</span>';
        const typeText = o.order_type === 'pickup' ? 'Pickup' : 'Mang đi';
        if (o.order_status === 'Completed') total += parseFloat(o.total_amount);
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>#${o.order_id}</strong></td>
            <td style="font-size:12px;">${o.order_date}</td>
            <td><span class="badge badge-secondary">${o.location_name || '—'}</span></td>
            <td>${o.staff_name}</td>
            <td>${o.customer_name || '<span style="color:var(--t3)">Vãng lai</span>'}</td>
            <td>${typeText}</td>
            <td>${statusBadge}</td>
            <td><strong>${formatVND(o.total_amount)}</strong></td>
            <td>
                <button class="btn btn-secondary" style="padding:3px 8px;font-size:.75rem;" onclick="viewAdminInvoice(${o.order_id})">
                    <i class="fa-solid fa-receipt"></i>
                </button>
            </td>`;
        tbody.appendChild(tr);
    });
    document.getElementById('adminOrderHistoryTotal').textContent = formatVND(total);
}

async function viewAdminInvoice(orderId) {
    try {
        const res = await API.get(`order_details.php?order_id=${orderId}`);
        if (!res?.success) { alert('Không tải được hóa đơn'); return; }
        const o = res.data;
        const items = o.items || [];
        let itemsHtml = items.map(i => `
            <tr>
                <td>${i.item_name}${i.customizations ? `<br><small style="color:#666">${i.customizations}</small>` : ''}</td>
                <td style="text-align:center">${i.quantity}</td>
                <td style="text-align:right">${formatVND(i.unit_price)}</td>
                <td style="text-align:right"><strong>${formatVND(i.subtotal)}</strong></td>
            </tr>`).join('');
        const win = window.open('', '_blank', 'width=480,height=640');
        win.document.write(`<html><head><title>Hóa đơn #${orderId}</title>
            <style>body{font-family:monospace;padding:20px;background:#fff;color:#000}
            table{width:100%;border-collapse:collapse}td{padding:4px 8px}
            .sep{border-top:1px dashed #ccc;margin:8px 0}</style></head><body>
            <h2 style="text-align:center">Coffee POS</h2>
            <p style="text-align:center;font-size:12px">${o.location_name}</p>
            <p style="text-align:center;font-size:12px">Hóa đơn #${orderId} — ${o.order_date}</p>
            <p style="text-align:center;font-size:12px">NV: ${o.staff_name}</p>
            <div class="sep"></div>
            <table><thead><tr><th style="text-align:left">Món</th><th>SL</th><th style="text-align:right">Đơn giá</th><th style="text-align:right">Thành tiền</th></tr></thead>
            <tbody>${itemsHtml}</tbody></table>
            <div class="sep"></div>
            ${o.promo_discount > 0 ? `<p style="text-align:right">Khuyến mãi: -${formatVND(o.promo_discount)}</p>` : ''}
            ${o.loyalty_discount > 0 ? `<p style="text-align:right">Điểm tích lũy: -${formatVND(o.loyalty_discount)}</p>` : ''}
            <p style="text-align:right;font-size:16px"><strong>Tổng: ${formatVND(o.total_amount)}</strong></p>
            ${o.points_earned > 0 ? `<p style="text-align:center;font-size:11px">Tích lũy: +${o.points_earned} điểm</p>` : ''}
            </body></html>`);
    } catch (err) { alert('Lỗi tải hóa đơn'); }
}

// ── MENU CRUD (Admin) ─────────────────────────────────────────

let adminMenuData    = [];
let adminEditingItemId = null;

async function loadMenuTab() {
    try {
        const res = await API.get('menu.php?all=1');
        adminMenuData = res?.data || [];
        const catSel = document.getElementById('adminMenuCategoryFilter');
        catSel.innerHTML = '<option value="all">Tất cả danh mục</option>';
        adminMenuData.forEach(cat => {
            catSel.innerHTML += `<option value="${cat.category_id}">${cat.category_name}</option>`;
        });
        renderAdminMenuTable('all');
    } catch (err) { console.error('loadMenuTab:', err); }
}

function renderAdminMenuTable(catId) {
    const tbody = document.getElementById('adminMenuTableBody');
    tbody.innerHTML = '';
    let found = false;
    adminMenuData.forEach(cat => {
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
                    <button class="btn btn-secondary" style="padding:4px 8px;font-size:.75rem;margin-right:2px;" onclick='openAdminMenuItemModal(${JSON.stringify(item)}, ${cat.category_id})'>
                        <i class="fa-solid fa-pen-to-square"></i>
                    </button>
                    <button class="btn btn-secondary" style="padding:4px 8px;font-size:.75rem;margin-right:2px;" onclick="adminToggleMenuAvailability(${item.item_id}, '${item.item_name}', ${item.is_available})">
                        <i class="fa-solid fa-power-off"></i>
                    </button>
                    <button class="btn btn-danger" style="padding:4px 8px;font-size:.75rem;" onclick="adminDeleteMenuItem(${item.item_id}, '${item.item_name}')">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </td>`;
            tbody.appendChild(tr);
        });
    });
    if (!found) tbody.innerHTML = emptyRow(6);
}

function openAdminMenuItemModal(item = null, catId = null) {
    adminEditingItemId = item ? item.item_id : null;
    document.getElementById('adminMenuItemModalTitle').textContent = item ? 'Sửa món ăn' : 'Thêm món mới';
    document.getElementById('adminMenuItemName').value  = item?.item_name  || '';
    document.getElementById('adminMenuItemPrice').value = item?.base_price || '';
    const catSel = document.getElementById('adminMenuItemCategory');
    catSel.innerHTML = '';
    adminMenuData.forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat.category_id;
        opt.textContent = cat.category_name;
        if (catId && cat.category_id == catId) opt.selected = true;
        catSel.appendChild(opt);
    });
    document.getElementById('adminMenuItemAvailable').checked = item ? !!item.is_available : true;
    document.getElementById('adminMenuItemModal').classList.add('show');
}

async function saveAdminMenuItem() {
    const payload = {
        item_name:    document.getElementById('adminMenuItemName').value.trim(),
        category_id:  parseInt(document.getElementById('adminMenuItemCategory').value),
        base_price:   parseFloat(document.getElementById('adminMenuItemPrice').value),
        is_available: document.getElementById('adminMenuItemAvailable').checked ? 1 : 0,
    };
    if (!payload.item_name || !payload.category_id || payload.base_price <= 0) {
        alert('Vui lòng điền đầy đủ tên, danh mục và giá hợp lệ!'); return;
    }
    if (adminEditingItemId) payload._method = 'PUT', payload.item_id = adminEditingItemId;
    try {
        const res = await API.post('menu.php', payload);
        if (res?.success) {
            document.getElementById('adminMenuItemModal').classList.remove('show');
            await loadMenuTab();
            renderAdminMenuTable(document.getElementById('adminMenuCategoryFilter').value);
        } else { alert(res?.error || 'Lỗi lưu món'); }
    } catch (err) { alert(err.message); }
}

async function adminToggleMenuAvailability(itemId, name, currentState) {
    const action = currentState ? 'tạm ngừng' : 'mở bán lại';
    if (!confirm(`${action} món "${name}"?`)) return;
    try {
        const res = await API.post('menu.php', { _method: 'DELETE', item_id: itemId });
        if (res?.success) {
            await loadMenuTab();
            renderAdminMenuTable(document.getElementById('adminMenuCategoryFilter').value);
        } else { alert(res?.error || 'Lỗi'); }
    } catch (err) { alert(err.message); }
}

async function adminDeleteMenuItem(itemId, name) {
    if (!confirm(`Xoá vĩnh viễn món "${name}"? Không thể hoàn tác.`)) return;
    try {
        const res = await API.post('menu.php', { _method: 'HARD_DELETE', item_id: itemId });
        if (res?.success) {
            await loadMenuTab();
            renderAdminMenuTable(document.getElementById('adminMenuCategoryFilter').value);
        } else { alert(res?.error || 'Lỗi xoá món'); }
    } catch (err) { alert(err.message); }
}

// ── AUDIT LOG ─────────────────────────────────────────────────

async function loadAuditLogTab() {
    try {
        const res = await API.get('audit_log.php');
        const tbody = document.getElementById('auditLogBody');
        tbody.innerHTML = '';
        if (!res?.success || !res.data?.length) {
            tbody.innerHTML = emptyRow(7, 'Chưa có nhật ký hành động nào.');
            return;
        }
        const actionColors = {
            CREATE: 'badge-success', UPDATE: 'badge-info',
            DELETE: 'badge-danger',  LOGIN:  'badge-secondary',
            CANCEL: 'badge-warning',
        };
        res.data.forEach(log => {
            const colorClass = actionColors[log.action_type] || 'badge-secondary';
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="font-size:11px;white-space:nowrap;">${log.action_timestamp}</td>
                <td><strong>${log.staff_name}</strong><br><small style="color:var(--t2)">${log.staff_role}</small></td>
                <td><span class="badge badge-secondary">${log.location_name}</span></td>
                <td><span class="badge ${colorClass}">${log.action_type}</span></td>
                <td style="font-size:12px;">${log.table_affected || '—'}</td>
                <td style="font-size:12px;">${log.record_id || '—'}</td>
                <td style="font-size:11px;color:var(--t2);max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${log.details || ''}">${log.details || '—'}</td>`;
            tbody.appendChild(tr);
        });
    } catch (err) { console.error('loadAuditLogTab:', err); }
}

// ── TAB SWITCHING ──────────────────────────────────────────────

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

    // Branch modal
    document.getElementById('openAddBranchBtn').addEventListener('click', () => openBranchModal());
    document.getElementById('closeBranchModal').addEventListener('click', () => document.getElementById('branchModal').classList.remove('show'));
    document.getElementById('cancelBranchBtn').addEventListener('click', () => document.getElementById('branchModal').classList.remove('show'));
    document.getElementById('saveBranchBtn').addEventListener('click', saveBranch);

    // Promo modal
    document.getElementById('openAddPromoBtn').addEventListener('click', () => openPromoModal());
    document.getElementById('closePromoModal').addEventListener('click', () => document.getElementById('promoModal').classList.remove('show'));
    document.getElementById('cancelPromoBtn').addEventListener('click', () => document.getElementById('promoModal').classList.remove('show'));
    document.getElementById('savePromoBtn').addEventListener('click', savePromo);

    // Staff modal
    document.getElementById('openAddStaffBtn').addEventListener('click', () => openStaffModal(null, document.getElementById('staffLocationFilter').value));
    document.getElementById('closeStaffModal').addEventListener('click', () => document.getElementById('staffModal').classList.remove('show'));
    document.getElementById('cancelStaffBtn').addEventListener('click', () => document.getElementById('staffModal').classList.remove('show'));
    document.getElementById('saveStaffBtn').addEventListener('click', saveStaff);
    document.getElementById('staffLocationFilter').addEventListener('change', loadStaffForLocation);

    // Reports tab — period buttons
    document.addEventListener('click', e => {
        const btn = e.target.closest('.admin-period-btn');
        if (btn) loadAdminPeriodReport(btn.dataset.period);
    });

    // Order History tab
    document.getElementById('refreshOrderHistoryBtn').addEventListener('click', loadOrderHistoryTab);
    document.getElementById('orderHistoryBranchFilter').addEventListener('change', e => renderOrderHistoryTable(e.target.value));

    // Loyalty tab
    document.getElementById('refreshLoyaltyBtn').addEventListener('click', loadLoyaltyTab);
    document.getElementById('adminLoyaltySearch').addEventListener('input', filterAdminLoyalty);
    document.getElementById('closeLoyaltyEditModal').addEventListener('click', () => document.getElementById('loyaltyEditModal').classList.remove('show'));
    document.getElementById('cancelLoyaltyEditBtn').addEventListener('click', () => document.getElementById('loyaltyEditModal').classList.remove('show'));
    document.getElementById('saveLoyaltyEditBtn').addEventListener('click', saveLoyaltyEdit);

    // Menu tab (Admin)
    document.getElementById('adminOpenAddMenuItemBtn').addEventListener('click', () => openAdminMenuItemModal());
    document.getElementById('adminCloseMenuItemModal').addEventListener('click', () => document.getElementById('adminMenuItemModal').classList.remove('show'));
    document.getElementById('adminCancelMenuItemBtn').addEventListener('click', () => document.getElementById('adminMenuItemModal').classList.remove('show'));
    document.getElementById('adminSaveMenuItemBtn').addEventListener('click', saveAdminMenuItem);
    document.getElementById('adminMenuCategoryFilter').addEventListener('change', e => renderAdminMenuTable(e.target.value));

    // Audit Log tab
    document.getElementById('refreshAuditLogBtn').addEventListener('click', loadAuditLogTab);
}

// ── LOYALTY ────────────────────────────────────────────────────

let _adminLoyaltyData = [];
let _editingLoyaltyId = null;

async function loadLoyaltyTab() {
    try {
        const res = await API.get('loyalty_balance.php?limit=200');
        _adminLoyaltyData = (res?.success && res.data?.length) ? res.data : [];
        filterAdminLoyalty();
    } catch (err) { console.error('loadLoyaltyTab:', err); }
}

function filterAdminLoyalty() {
    const q = (document.getElementById('adminLoyaltySearch')?.value || '').trim().toLowerCase();
    const tbody = document.getElementById('adminLoyaltyBody');
    tbody.innerHTML = '';
    const rows = q ? _adminLoyaltyData.filter(c => c.phone?.toLowerCase().includes(q)) : _adminLoyaltyData;
    if (!rows.length) {
        tbody.innerHTML = emptyRow(5, q ? 'Không tìm thấy khách hàng.' : 'Chưa có khách hàng thân thiết.');
        return;
    }
    rows.forEach(c => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${c.name}</strong></td>
            <td>${c.phone}</td>
            <td><strong style="color:var(--amber);">${c.points_balance} điểm</strong></td>
            <td style="color:var(--t2);">${formatVND(c.points_balance * 1000)}</td>
            <td>
                <button class="btn btn-secondary" style="font-size:11px;padding:4px 10px;"
                    onclick="openLoyaltyEditModal(${c.customer_id},'${c.name.replace(/'/g,"\\'")}','${c.phone}',${c.points_balance})">
                    <i class="fa-solid fa-pen"></i> Chỉnh điểm
                </button>
            </td>`;
        tbody.appendChild(tr);
    });
}

function openLoyaltyEditModal(id, name, phone, points) {
    _editingLoyaltyId = id;
    document.getElementById('loyaltyEditName').textContent  = name;
    document.getElementById('loyaltyEditPhone').textContent = phone;
    document.getElementById('loyaltyEditPoints').value      = points;
    document.getElementById('loyaltyEditModal').classList.add('show');
}

async function saveLoyaltyEdit() {
    const pts = parseInt(document.getElementById('loyaltyEditPoints').value);
    if (isNaN(pts) || pts < 0) return alert('Điểm không hợp lệ.');
    try {
        const res = await API.put(`loyalty_balance.php?id=${_editingLoyaltyId}`, { points_balance: pts });
        if (res?.success) {
            document.getElementById('loyaltyEditModal').classList.remove('show');
            loadLoyaltyTab();
        } else {
            alert(res?.error || 'Lỗi khi lưu.');
        }
    } catch (err) { alert('Lỗi kết nối.'); }
}

function switchTab(tabId) {
    document.querySelectorAll('.view-section').forEach(s => s.classList.remove('active'));
    const sec = document.getElementById(tabId);
    if (sec) sec.classList.add('active');
    document.querySelectorAll('.sidebar-menu .menu-item-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.target === tabId);
    });
    const titles = {
        'reports-tab':       'Báo cáo doanh thu',
        'branches-tab':      'Quản lý chi nhánh',
        'menu-tab':          'Quản lý thực đơn',
        'promotions-tab':    'Quản lý khuyến mãi',
        'staff-tab':         'Quản lý nhân viên',
        'order-history-tab': 'Lịch sử đơn hàng — Toàn chuỗi',
        'loyalty-tab':       'Khách hàng thân thiết',
        'audit-log-tab':     'Nhật ký hệ thống',
    };
    document.getElementById('currentTabTitle').textContent = titles[tabId] || '';
    if (tabId === 'branches-tab')      loadBranchesTab();
    if (tabId === 'menu-tab')          loadMenuTab();
    if (tabId === 'promotions-tab')    loadPromotionsTab();
    if (tabId === 'staff-tab')         loadStaffTab();
    if (tabId === 'reports-tab')       loadReportsTab();
    if (tabId === 'order-history-tab') loadOrderHistoryTab();
    if (tabId === 'loyalty-tab')       loadLoyaltyTab();
    if (tabId === 'audit-log-tab')     loadAuditLogTab();
}

function emptyRow(cols, msg = 'Không có dữ liệu.') {
    return `<tr><td colspan="${cols}" style="text-align:center;color:var(--text-3);padding:24px;">${msg}</td></tr>`;
}

function formatVND(amount) {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
}

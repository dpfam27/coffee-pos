// =============================================================
// FILE : web/js/pos.js
// DESC : POS — tạo đơn, in hóa đơn, hủy đơn (PIN), customer search
// Model: thanh toán ngay tại quầy, không có bàn ăn
// Loyalty: tích 1pt/1000đ, đổi 1pt=1000đ
// =============================================================

let currentUser    = null;
let categoriesData = [];
let cart           = [];
let selectedCustomer    = null;
let appliedRedeemPoints = 0;
let activeItemForModifiers = null;
let selectedModifiers   = {};
let activePromotion     = null;  // today's active promotion

document.addEventListener('DOMContentLoaded', () => {
    initApp();
    setupEventListeners();
});

async function initApp() {
    try {
        const userRes = await API.get('auth.php?action=me');
        if (userRes && userRes.success) {
            currentUser = userRes.user;
            const roleLabel = { Admin: 'Quản trị viên', StoreManager: 'Cửa hàng trưởng', Barista: 'Nhân viên pha chế' };
            document.getElementById('userName').textContent    = currentUser.name;
            document.getElementById('userRole').textContent    = roleLabel[currentUser.role] || currentUser.role;
            document.getElementById('userAvatar').textContent  = currentUser.name.charAt(0);
            document.getElementById('currentBranch').textContent = 'Chi nhánh: ' + currentUser.location_name;
            // Admin & StoreManager can cancel orders
            if (currentUser.role === 'Admin' || currentUser.role === 'StoreManager') {
                document.getElementById('cancelOrderMenu').style.display = 'block';
            }
        } else {
            window.location.href = 'index.html';
            return;
        }
        setInterval(updateClock, 1000);
        updateClock();
        await Promise.all([loadMenu(), loadActivePromotion()]);
        await loadOrderHistory();
    } catch (err) {
        console.error('Init error:', err);
    }
}

function updateClock() {
    const now = new Date();
    document.getElementById('currentTime').textContent =
        now.toLocaleTimeString('vi-VN') + ' — ' + now.toLocaleDateString('vi-VN');
}

// ── DATA LOADING ───────────────────────────────────────────────

async function loadActivePromotion() {
    try {
        const res = await API.get('promotions.php?active=1');
        activePromotion = res?.promotion || null;
        const banner = document.getElementById('promoBanner');
        if (activePromotion && banner) {
            const valText = activePromotion.discount_type === 'percent'
                ? `${activePromotion.discount_value}%`
                : formatVND(activePromotion.discount_value);
            banner.textContent = `🎉 Khuyến mãi: ${activePromotion.name} — Giảm ${valText}`;
            banner.style.display = 'block';
        } else if (banner) {
            banner.style.display = 'none';
        }
    } catch (e) { activePromotion = null; }
}

async function loadMenu() {
    const res = await API.get('menu.php');
    if (res && res.success) {
        categoriesData = res.data;
        renderCategoryButtons();
        renderMenu('all');
    }
}

async function loadOrderHistory() {
    const res = await API.get('order_history.php');
    if (res && res.success) renderOrderHistory(res.data);
}

async function loadCancelQueue() {
    const res = await API.get('order_history.php');
    if (res && res.success) renderCancelQueue(res.data);
}

// ── RENDERERS ──────────────────────────────────────────────────

function renderCategoryButtons() {
    const bar = document.getElementById('categoryFilterBar');
    bar.innerHTML = '<button class="cat-btn active" data-cat-id="all">Tất cả</button>';
    categoriesData.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = 'cat-btn';
        btn.dataset.catId = cat.category_id;
        btn.textContent = cat.category_name;
        bar.appendChild(btn);
    });
    bar.querySelectorAll('.cat-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            bar.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderMenu(btn.dataset.catId);
        });
    });
}

function renderMenu(catId) {
    const grid = document.getElementById('menuGrid');
    grid.innerHTML = '';
    categoriesData.forEach(cat => {
        if (catId !== 'all' && cat.category_id != catId) return;
        cat.items.forEach(item => {
            const card = document.createElement('div');
            card.className = 'menu-card';
            card.innerHTML = `
                <div class="menu-card-title">${item.item_name}</div>
                <div class="menu-card-footer">
                    <div class="menu-card-price">${formatVND(item.base_price)}</div>
                    <div class="menu-card-add-icon"><i class="fa-solid fa-plus"></i></div>
                </div>`;
            card.addEventListener('click', () => handleAddItemClick(item));
            grid.appendChild(card);
        });
    });
    if (!grid.children.length) {
        grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:var(--text-3);padding:40px;">Không có món nào.</div>';
    }
}

function renderOrderHistory(orders) {
    const tbody = document.getElementById('historyTableBody');
    tbody.innerHTML = '';
    let totalRevenue = 0;
    if (!orders.length) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-3);padding:30px;">Không có đơn hàng nào.</td></tr>';
        document.getElementById('historyTotalRevenue').textContent = formatVND(0);
        return;
    }
    orders.forEach(o => {
        const statusBadge = o.order_status === 'Completed'
            ? '<span class="badge badge-success">Hoàn thành</span>'
            : '<span class="badge badge-danger">Đã hủy</span>';
        const typeText = o.order_type === 'pickup' ? 'Pickup' : 'Mang đi';
        if (o.order_status === 'Completed') totalRevenue += parseFloat(o.total_amount);
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>#${o.order_id}</strong></td>
            <td>${o.order_date}</td>
            <td>${typeText}</td>
            <td>${o.staff_name}</td>
            <td>${o.customer_name || '<span style="color:var(--text-3)">Khách vãng lai</span>'}</td>
            <td>${statusBadge}</td>
            <td><strong>${formatVND(o.total_amount)}</strong></td>
            <td>
                <button class="btn btn-secondary" style="padding:4px 8px;font-size:.75rem;" onclick="viewInvoice(${o.order_id})">
                    <i class="fa-solid fa-receipt"></i> Hóa đơn
                </button>
                ${o.order_status === 'Completed' ? `
                <button class="btn btn-danger" style="padding:4px 8px;font-size:.75rem;margin-left:4px;" onclick="openCancelModal(${o.order_id})">
                    <i class="fa-solid fa-ban"></i> Hủy
                </button>` : ''}
            </td>`;
        tbody.appendChild(tr);
    });
    document.getElementById('historyTotalRevenue').textContent = formatVND(totalRevenue);
}

function renderCancelQueue(orders) {
    const tbody = document.getElementById('cancelQueueBody');
    tbody.innerHTML = '';
    const completedOrders = orders.filter(o => o.order_status === 'Completed');
    const cancelledOrders = orders.filter(o => o.order_status === 'Cancelled');

    let revenue = 0, cancelCount = 0;
    completedOrders.forEach(o => revenue += parseFloat(o.total_amount));
    cancelCount = cancelledOrders.length;

    document.getElementById('todayRevenue').textContent   = formatVND(revenue);
    document.getElementById('todayOrders').textContent    = completedOrders.length;
    document.getElementById('cancelledCount').textContent = cancelCount;

    if (!completedOrders.length) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-3);padding:20px;">Không có đơn hàng nào có thể hủy.</td></tr>';
        return;
    }
    completedOrders.forEach(o => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>#${o.order_id}</strong></td>
            <td>${o.order_date}</td>
            <td>${o.customer_name || 'Khách vãng lai'}</td>
            <td><strong>${formatVND(o.total_amount)}</strong></td>
            <td>
                <button class="btn btn-danger" style="padding:4px 10px;font-size:.8rem;" onclick="openCancelModal(${o.order_id})">
                    <i class="fa-solid fa-ban"></i> Hủy đơn
                </button>
            </td>`;
        tbody.appendChild(tr);
    });
}

// ── CART ───────────────────────────────────────────────────────

function handleAddItemClick(item) {
    if (item.modifiers && item.modifiers.length > 0) openModifierModal(item);
    else addToCart(item, []);
}

function openModifierModal(item) {
    activeItemForModifiers = item;
    selectedModifiers = {};
    document.getElementById('modifierItemName').textContent = item.item_name;
    const body = document.getElementById('modifierModalBody');
    body.innerHTML = '';
    item.modifiers.forEach(group => {
        selectedModifiers[group.group_id] = [];
        const container = document.createElement('div');
        container.className = 'modifier-group-container';
        container.innerHTML = `
            <div class="modifier-group-title">${group.group_name} ${group.is_required ? '<span class="req-tag">Bắt buộc</span>' : ''}</div>
            <div class="modifier-options-grid" id="group-grid-${group.group_id}"></div>`;
        body.appendChild(container);
        const grid = container.querySelector(`#group-grid-${group.group_id}`);
        group.options.forEach((opt, idx) => {
            const btn = document.createElement('button');
            btn.className = 'modifier-option-btn';
            btn.innerHTML = `<span>${opt.option_name}</span>${opt.price_delta > 0 ? `<span class="price-delta">+${formatVND(opt.price_delta)}</span>` : ''}`;
            if (group.is_required && group.selection_type === 'single' && idx === 0) {
                btn.classList.add('selected');
                selectedModifiers[group.group_id].push(opt);
            }
            btn.addEventListener('click', () => {
                if (group.selection_type === 'single') {
                    grid.querySelectorAll('.modifier-option-btn').forEach(b => b.classList.remove('selected'));
                    btn.classList.add('selected');
                    selectedModifiers[group.group_id] = [opt];
                } else {
                    btn.classList.toggle('selected');
                    if (btn.classList.contains('selected')) selectedModifiers[group.group_id].push(opt);
                    else selectedModifiers[group.group_id] = selectedModifiers[group.group_id].filter(o => o.option_id !== opt.option_id);
                }
                recalcModifierPrice();
            });
            grid.appendChild(btn);
        });
    });
    recalcModifierPrice();
    document.getElementById('modifierModal').classList.add('show');
}

function recalcModifierPrice() {
    let total = activeItemForModifiers.base_price;
    Object.values(selectedModifiers).forEach(opts => opts.forEach(o => total += o.price_delta));
    document.getElementById('modifierItemTotalPrice').textContent = formatVND(total);
}

function closeModifierModal() {
    document.getElementById('modifierModal').classList.remove('show');
    activeItemForModifiers = null;
    selectedModifiers = {};
}

function addToCart(item, modifiersList) {
    const modIds = modifiersList.map(m => m.option_id).sort().join(',');
    const cartKey = `${item.item_id}_${modIds}`;
    const existing = cart.find(c => c.cartKey === cartKey);
    if (existing) existing.quantity++;
    else cart.push({ cartKey, item, modifiers: modifiersList, quantity: 1 });
    updateCartUI();
}

function updateCartUI() {
    const list = document.getElementById('cartItemsList');
    list.innerHTML = '';
    if (!cart.length) {
        list.innerHTML = `<div style="text-align:center;color:var(--text-3);margin-top:50px;"><i class="fa-solid fa-basket-shopping" style="font-size:2.5rem;margin-bottom:12px;display:block;"></i>Giỏ hàng trống</div>`;
        document.getElementById('checkoutBtn').disabled = true;
        document.getElementById('cartSubtotal').textContent = '0đ';
        document.getElementById('cartTotal').textContent = '0đ';
        return;
    }
    document.getElementById('checkoutBtn').disabled = false;
    let subtotal = 0;
    cart.forEach((c, idx) => {
        let itemPrice = c.item.base_price;
        c.modifiers.forEach(m => itemPrice += m.price_delta);
        const lineTotal = itemPrice * c.quantity;
        subtotal += lineTotal;
        const div = document.createElement('div');
        div.className = 'cart-item';
        div.innerHTML = `
            <button class="cart-item-delete" onclick="removeFromCart(${idx})"><i class="fa-regular fa-trash-can"></i></button>
            <div class="cart-item-header">
                <div class="cart-item-name">${c.item.item_name}</div>
                <div class="cart-item-price">${formatVND(lineTotal)}</div>
            </div>
            ${c.modifiers.length ? `<div class="cart-item-modifiers">${c.modifiers.map(m => m.option_name).join(', ')}</div>` : ''}
            <div class="cart-item-controls">
                <div class="quantity-controls">
                    <button class="qty-btn" onclick="updateQty(${idx},-1)"><i class="fa-solid fa-minus"></i></button>
                    <span class="qty-num">${c.quantity}</span>
                    <button class="qty-btn" onclick="updateQty(${idx},1)"><i class="fa-solid fa-plus"></i></button>
                </div>
                <span style="font-size:.75rem;color:var(--text-3);">${formatVND(itemPrice)} / cái</span>
            </div>`;
        list.appendChild(div);
    });

    document.getElementById('cartSubtotal').textContent = formatVND(subtotal);

    // Loyalty discount: 1pt = 1000đ
    let loyaltyDiscount = appliedRedeemPoints * 1000;
    if (loyaltyDiscount > subtotal) { loyaltyDiscount = subtotal; appliedRedeemPoints = subtotal / 1000; }
    if (loyaltyDiscount > 0) {
        document.getElementById('loyaltyDiscountRow').style.display = 'flex';
        document.getElementById('cartLoyaltyDiscount').textContent = `-${formatVND(loyaltyDiscount)}`;
    } else {
        document.getElementById('loyaltyDiscountRow').style.display = 'none';
    }

    const finalTotal = Math.max(0, subtotal - loyaltyDiscount);
    document.getElementById('cartTotal').textContent = formatVND(finalTotal);
}

function updateQty(idx, change) {
    cart[idx].quantity += change;
    if (cart[idx].quantity <= 0) cart.splice(idx, 1);
    updateCartUI();
}

function removeFromCart(idx) { cart.splice(idx, 1); updateCartUI(); }

// ── CUSTOMER SEARCH ────────────────────────────────────────────

async function searchCustomer() {
    const phone = document.getElementById('customerPhoneInput').value.trim();
    if (!phone) return;
    try {
        const res = await API.get(`customer_search.php?phone=${encodeURIComponent(phone)}`);
        if (res && res.success && res.found) {
            selectedCustomer = res.customer;
            document.getElementById('customerNameText').textContent   = selectedCustomer.name;
            document.getElementById('customerPointsText').textContent = selectedCustomer.loyalty_points;
            document.getElementById('selectedCustomerInfo').style.display = 'flex';
            document.getElementById('loyaltyRedeemSection').style.display = 'block';
            document.getElementById('redeemMaxPoints').textContent = selectedCustomer.loyalty_points;
            document.getElementById('customerPhoneInput').value = '';
        } else if (res && res.success && !res.found) {
            if (confirm(`Không tìm thấy khách hàng với SĐT "${phone}".\nTạo tài khoản mới?`)) {
                openCreateCustomerModal(phone);
            }
        } else {
            alert(res.error || 'Lỗi tìm kiếm');
        }
    } catch (err) { alert(err.message); }
}

function openCreateCustomerModal(phone) {
    document.getElementById('newCustomerPhone').value = phone || '';
    document.getElementById('newCustomerName').value = '';
    document.getElementById('createCustomerModal').classList.add('show');
}

async function confirmCreateCustomer() {
    const name  = document.getElementById('newCustomerName').value.trim();
    const phone = document.getElementById('newCustomerPhone').value.trim();
    if (!name || !phone) { alert('Vui lòng nhập đầy đủ họ tên và số điện thoại'); return; }
    try {
        const res = await API.post('customer_search.php', { name, phone });
        if (res && res.success) {
            selectedCustomer = res.customer;
            document.getElementById('customerNameText').textContent   = selectedCustomer.name;
            document.getElementById('customerPointsText').textContent = 0;
            document.getElementById('selectedCustomerInfo').style.display = 'flex';
            document.getElementById('loyaltyRedeemSection').style.display = 'none';
            document.getElementById('createCustomerModal').classList.remove('show');
        } else {
            alert(res.error || 'Lỗi tạo khách hàng');
        }
    } catch (err) { alert(err.message); }
}

function removeCustomer() {
    selectedCustomer = null;
    appliedRedeemPoints = 0;
    document.getElementById('selectedCustomerInfo').style.display = 'none';
    document.getElementById('loyaltyRedeemSection').style.display = 'none';
    document.getElementById('redeemPointsInput').value = '';
    updateCartUI();
}

// ── CHECKOUT ───────────────────────────────────────────────────

function openCheckoutModal() {
    if (!cart.length) return;

    // Recalculate subtotal
    let subtotal = 0;
    cart.forEach(c => {
        let p = c.item.base_price;
        c.modifiers.forEach(m => p += m.price_delta);
        subtotal += p * c.quantity;
    });

    // Promotion discount
    let promoDiscount = 0;
    const promoRow = document.getElementById('checkoutPromoRow');
    const promoText = document.getElementById('checkoutPromoText');
    const promoAmt  = document.getElementById('checkoutPromoAmt');
    if (activePromotion) {
        if (activePromotion.discount_type === 'percent') {
            promoDiscount = subtotal * (activePromotion.discount_value / 100);
        } else {
            promoDiscount = Math.min(activePromotion.discount_value, subtotal);
        }
        if (promoRow) {
            promoRow.style.display = 'flex';
            promoText.textContent = activePromotion.name;
            promoAmt.textContent  = `-${formatVND(promoDiscount)}`;
        }
    } else if (promoRow) {
        promoRow.style.display = 'none';
    }

    const afterPromo = subtotal - promoDiscount;
    const loyaltyDiscount = appliedRedeemPoints * 1000;
    const total = Math.max(0, afterPromo - loyaltyDiscount);

    // Loyalty row
    const loyRow = document.getElementById('checkoutLoyaltyRow');
    const loyAmt = document.getElementById('checkoutLoyaltyAmt');
    if (loyRow) {
        if (loyaltyDiscount > 0) {
            loyRow.style.display = 'flex';
            loyAmt.textContent   = `-${formatVND(loyaltyDiscount)}`;
        } else {
            loyRow.style.display = 'none';
        }
    }

    document.getElementById('checkoutSubtotalAmt').textContent = formatVND(subtotal);
    document.getElementById('checkoutTotalText').textContent   = formatVND(total);
    document.getElementById('checkoutModal').classList.add('show');
}

async function confirmPayment() {
    const orderType     = document.getElementById('orderTypeSelect').value;
    const paymentBtn    = document.querySelector('.payment-method-btn.selected');
    const paymentMethod = paymentBtn ? paymentBtn.dataset.method : 'Cash';
    const btn = document.getElementById('confirmPaymentBtn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang xử lý...';

    const payload = {
        order_type:       orderType,
        customer_id:      selectedCustomer ? selectedCustomer.customer_id : null,
        items:            cart.map(c => ({ item_id: c.item.item_id, quantity: c.quantity, modifiers: c.modifiers.map(m => m.option_id) })),
        payment_method:   paymentMethod,
        points_redeemed:  appliedRedeemPoints,
    };

    try {
        const res = await API.post('create_order.php', payload);
        if (res && res.success) {
            document.getElementById('checkoutModal').classList.remove('show');
            cart = [];
            removeCustomer();
            updateCartUI();
            await loadOrderHistory();
            viewInvoice(res.order_id);
        } else {
            alert(res.error || 'Lỗi tạo đơn hàng');
        }
    } catch (err) { alert(err.message); }
    finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-circle-check"></i> Xác nhận thanh toán';
    }
}

// ── INVOICE ────────────────────────────────────────────────────

async function viewInvoice(orderId) {
    try {
        const res = await API.get(`order_details.php?order_id=${orderId}`);
        if (res && res.success) renderInvoiceModal(res.data);
        else alert(res.error || 'Lỗi tải hóa đơn');
    } catch (err) { alert(err.message); }
}

function renderInvoiceModal(data) {
    const typeText = data.order_type === 'pickup' ? 'Nhận tại quầy' : 'Mang đi';
    let itemsHtml = '';
    (data.items || []).forEach(it => {
        const mods = it.customizations ? `<div style="font-size:.75rem;color:#9ca3af;padding-left:8px;">${it.customizations}</div>` : '';
        itemsHtml += `<div style="display:flex;justify-content:space-between;padding:3px 0;"><span>x${it.quantity} ${it.item_name}</span><span>${formatVND(it.subtotal)}</span></div>${mods}`;
    });
    const discountHtml = data.promo_discount > 0
        ? `<div style="display:flex;justify-content:space-between;color:#f87171;"><span>Khuyến mãi</span><span>-${formatVND(data.promo_discount)}</span></div>` : '';
    const loyaltyHtml = data.loyalty_discount > 0
        ? `<div style="display:flex;justify-content:space-between;color:#f87171;"><span>Đổi điểm</span><span>-${formatVND(data.loyalty_discount)}</span></div>` : '';
    const earnHtml = data.points_earned > 0
        ? `<div style="display:flex;justify-content:space-between;color:#34d399;"><span>Điểm tích lũy thêm</span><span>+${data.points_earned} điểm</span></div>` : '';

    document.getElementById('invoiceModalBody').innerHTML = `
        <div style="text-align:center;margin-bottom:12px;">
            <div style="font-size:1.1rem;font-weight:700;color:#fff;">☕ COFFEE POS</div>
            <div style="font-size:.8rem;color:#9ca3af;">${data.location_name || ''}</div>
            <div style="font-size:.75rem;color:#6b7280;">${data.location_phone || ''}</div>
        </div>
        <div style="border-top:1px dashed #374151;padding-top:10px;margin-bottom:10px;font-size:.78rem;color:#d1d5db;">
            <div>Đơn hàng: <strong>#${data.order_id}</strong></div>
            <div>Thời gian: ${data.order_date}</div>
            <div>Thu ngân: ${data.staff_name}</div>
            <div>Hình thức: ${typeText}</div>
            <div>Khách hàng: ${data.customer_name || 'Khách vãng lai'}</div>
        </div>
        <div style="border-top:1px dashed #374151;padding:10px 0;font-size:.82rem;color:#e5e7eb;">${itemsHtml}</div>
        <div style="border-top:1px dashed #374151;padding-top:10px;font-size:.82rem;">
            <div style="display:flex;justify-content:space-between;color:#d1d5db;"><span>Tạm tính</span><span>${formatVND(data.subtotal_amount)}</span></div>
            ${discountHtml}${loyaltyHtml}
            <div style="display:flex;justify-content:space-between;font-size:1rem;font-weight:700;color:#34d399;margin-top:6px;"><span>TỔNG CỘNG</span><span>${formatVND(data.total_amount)}</span></div>
            <div style="display:flex;justify-content:space-between;color:#9ca3af;margin-top:4px;"><span>Thanh toán</span><span>${data.payment_method}</span></div>
            ${earnHtml}
        </div>
        <div style="text-align:center;margin-top:12px;color:#6b7280;font-size:.75rem;border-top:1px dashed #374151;padding-top:10px;">Cảm ơn quý khách! Hẹn gặp lại! ☕</div>`;
    document.getElementById('invoiceModal').classList.add('show');
}

// ── CANCEL ORDER (PIN) ─────────────────────────────────────────

let cancelTargetOrderId = null;

function openCancelModal(orderId) {
    cancelTargetOrderId = orderId;
    document.getElementById('cancelOrderId').textContent = orderId;
    document.getElementById('cancelPinInput').value = '';
    document.getElementById('cancelOrderModal').classList.add('show');
}

async function confirmCancelOrder() {
    const pin = document.getElementById('cancelPinInput').value.trim();
    if (!pin) { alert('Vui lòng nhập mã xác nhận'); return; }
    const btn = document.getElementById('confirmCancelBtn');
    btn.disabled = true;
    try {
        const res = await API.post('prep_queue.php', { order_id: cancelTargetOrderId, cancel_pin: pin });
        if (res && res.success) {
            document.getElementById('cancelOrderModal').classList.remove('show');
            alert(`Đã hủy đơn hàng #${cancelTargetOrderId} thành công.`);
            await loadOrderHistory();
            await loadCancelQueue();
        } else {
            alert(res.error || 'Mã xác nhận không đúng hoặc lỗi hệ thống');
        }
    } catch (err) { alert(err.message); }
    finally { btn.disabled = false; }
}

// ── EVENT LISTENERS ────────────────────────────────────────────

function setupEventListeners() {
    document.querySelectorAll('.sidebar-menu .menu-item-btn').forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.target));
    });

    document.getElementById('logoutBtn').addEventListener('click', async () => {
        if (confirm('Đăng xuất?')) {
            const res = await API.get('auth.php?action=logout');
            if (res && res.success) window.location.href = 'index.html';
        }
    });

    document.getElementById('clearCartBtn').addEventListener('click', () => {
        if (cart.length && confirm('Xóa toàn bộ giỏ hàng?')) { cart = []; updateCartUI(); }
    });

    document.getElementById('searchCustomerBtn').addEventListener('click', searchCustomer);
    document.getElementById('customerPhoneInput').addEventListener('keypress', e => { if (e.key === 'Enter') { e.preventDefault(); searchCustomer(); } });
    document.getElementById('removeCustomerBtn').addEventListener('click', removeCustomer);

    document.getElementById('closeModifierModal').addEventListener('click', closeModifierModal);
    document.getElementById('cancelModifierBtn').addEventListener('click', closeModifierModal);
    document.getElementById('addCartWithModifiersBtn').addEventListener('click', () => {
        const selectedList = [];
        let missingRequired = false;
        activeItemForModifiers.modifiers.forEach(group => {
            const opts = selectedModifiers[group.group_id] || [];
            if (group.is_required && !opts.length) missingRequired = true;
            else opts.forEach(o => selectedList.push(o));
        });
        if (missingRequired) { alert('Vui lòng chọn đủ các tùy chọn bắt buộc!'); return; }
        addToCart(activeItemForModifiers, selectedList);
        closeModifierModal();
    });

    document.getElementById('checkoutBtn').addEventListener('click', openCheckoutModal);
    document.getElementById('closeCheckoutModal').addEventListener('click', () => document.getElementById('checkoutModal').classList.remove('show'));
    document.getElementById('cancelCheckoutBtn').addEventListener('click', () => document.getElementById('checkoutModal').classList.remove('show'));
    document.getElementById('confirmPaymentBtn').addEventListener('click', confirmPayment);

    document.querySelectorAll('.payment-method-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.payment-method-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
        });
    });

    document.getElementById('applyRedeemBtn').addEventListener('click', () => {
        const points = parseInt(document.getElementById('redeemPointsInput').value) || 0;
        if (points < 0) { alert('Số điểm không hợp lệ'); return; }
        if (points > selectedCustomer.loyalty_points) { alert('Điểm tích lũy không đủ'); return; }
        // Max redeemable: subtotal / 1000
        let subtotal = 0;
        cart.forEach(c => { let p = c.item.base_price; c.modifiers.forEach(m => p += m.price_delta); subtotal += p * c.quantity; });
        const maxPts = Math.floor(subtotal / 1000);
        appliedRedeemPoints = Math.min(points, maxPts);
        if (points > maxPts) { alert(`Tối đa ${maxPts} điểm cho đơn này`); document.getElementById('redeemPointsInput').value = maxPts; }
        updateCartUI();
        document.getElementById('checkoutTotalText').textContent = document.getElementById('cartTotal').textContent;
    });

    document.getElementById('closeInvoiceModal').addEventListener('click', () => document.getElementById('invoiceModal').classList.remove('show'));
    document.getElementById('closeInvoiceBtn').addEventListener('click', () => document.getElementById('invoiceModal').classList.remove('show'));
    document.getElementById('printInvoiceBtn').addEventListener('click', () => window.print());

    document.getElementById('refreshHistoryBtn').addEventListener('click', loadOrderHistory);

    // Create customer modal
    document.getElementById('closeCreateCustomerModal').addEventListener('click', () => document.getElementById('createCustomerModal').classList.remove('show'));
    document.getElementById('cancelCreateCustomerBtn').addEventListener('click', () => document.getElementById('createCustomerModal').classList.remove('show'));
    document.getElementById('confirmCreateCustomerBtn').addEventListener('click', confirmCreateCustomer);

    // Cancel order modal
    document.getElementById('closeCancelModal').addEventListener('click', () => document.getElementById('cancelOrderModal').classList.remove('show'));
    document.getElementById('cancelCancelBtn').addEventListener('click', () => document.getElementById('cancelOrderModal').classList.remove('show'));
    document.getElementById('confirmCancelBtn').addEventListener('click', confirmCancelOrder);
}

function switchTab(tabId) {
    document.querySelectorAll('.view-section').forEach(s => s.classList.remove('active'));
    const sec = document.getElementById(tabId);
    if (sec) sec.classList.add('active');
    document.querySelectorAll('.sidebar-menu .menu-item-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.target === tabId);
    });
    const titles = { 'new-order-tab': 'Đơn hàng mới', 'history-tab': 'Lịch sử bán hàng', 'cancel-tab': 'Quản lý hủy đơn' };
    document.getElementById('currentTabTitle').textContent = titles[tabId] || '';
    if (tabId === 'history-tab') loadOrderHistory();
    if (tabId === 'cancel-tab') loadCancelQueue();
}

function formatVND(amount) {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
}

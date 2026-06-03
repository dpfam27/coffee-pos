// =============================================================
// FILE : web/js/pos.js
// DESC : POS Front-end logic, cart management, and event handling
// =============================================================

let currentUser = null;
let categoriesData = [];
let tablesData = [];
let cart = [];
let selectedCustomer = null;
let appliedRedeemPoints = 0;
let activeItemForModifiers = null;
let selectedModifiers = {}; // groupId -> array of optionIds or single optionId

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
            document.getElementById('userName').textContent = currentUser.name;
            document.getElementById('userRole').textContent = currentUser.role;
            document.getElementById('userAvatar').textContent = currentUser.name.charAt(0);
            document.getElementById('currentBranch').textContent = 'Chi nhánh: ' + currentUser.location_name;
            
            if (currentUser.role === 'ShiftLead' || currentUser.role === 'Admin') {
                document.getElementById('shiftLeadMenu').style.display = 'block';
            }
        } else {
            window.location.href = 'index.html';
            return;
        }

        // Start clock
        setInterval(updateClock, 1000);
        updateClock();

        // 2. Load POS Data
        await loadMenu();
        await loadTables();
        await loadPrepQueue();
        await loadOrderHistory();

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
// DATA LOADING
// ==============================================================================

async function loadMenu() {
    const res = await API.get('menu.php');
    if (res && res.success) {
        categoriesData = res.data;
        renderCategoryButtons();
        renderMenu('all');
    }
}

async function loadTables() {
    const res = await API.get('tables.php');
    if (res && res.success) {
        tablesData = res.data;
        
        // Render in tables tab
        renderTablesTab();
        
        // Populate cart table select
        const cartTableSelect = document.getElementById('cartTableSelect');
        cartTableSelect.innerHTML = '<option value="">-- Chọn bàn --</option>';
        tablesData.forEach(t => {
            const option = document.createElement('option');
            option.value = t.table_id;
            option.textContent = `Bàn ${t.table_number} (${t.status === 'Available' ? 'Trống' : 'Có khách'})`;
            cartTableSelect.appendChild(option);
        });
    }
}

async function loadPrepQueue() {
    const res = await API.get('prep_queue.php');
    if (res && res.success) {
        renderPrepQueue(res.data);
    }
}

async function loadOrderHistory() {
    const res = await API.get('order_history.php');
    if (res && res.success) {
        renderOrderHistory(res.data);
    }
}

// ==============================================================================
// RENDERERS
// ==============================================================================

function renderCategoryButtons() {
    const bar = document.getElementById('categoryFilterBar');
    bar.innerHTML = '<button class="cat-btn active" data-cat-id="all">Tất cả</button>';
    
    categoriesData.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = 'cat-btn';
        btn.setAttribute('data-cat-id', cat.category_id);
        btn.textContent = cat.category_name;
        bar.appendChild(btn);
    });

    // Add click listeners
    bar.querySelectorAll('.cat-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            bar.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderMenu(btn.getAttribute('data-cat-id'));
        });
    });
}

function renderMenu(catId) {
    const grid = document.getElementById('menuGrid');
    grid.innerHTML = '';

    categoriesData.forEach(cat => {
        if (catId === 'all' || cat.category_id == catId) {
            cat.items.forEach(item => {
                const card = document.createElement('div');
                card.className = 'menu-card';
                card.innerHTML = `
                    <div class="menu-card-title">${item.item_name}</div>
                    <div class="menu-card-footer">
                        <div class="menu-card-price">${formatVND(item.base_price)}</div>
                        <div class="menu-card-add-icon">
                            <i class="fa-solid fa-plus"></i>
                        </div>
                    </div>
                `;
                card.addEventListener('click', () => handleAddItemClick(item));
                grid.appendChild(card);
            });
        }
    });

    if (grid.children.length === 0) {
        grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 40px;">Không tìm thấy món ăn nào.</div>';
    }
}

function renderTablesTab() {
    const grid = document.getElementById('tablesGrid');
    grid.innerHTML = '';

    tablesData.forEach(t => {
        const card = document.createElement('div');
        const isAvailable = t.status === 'Available';
        card.className = `pos-table-card ${isAvailable ? 'available' : 'occupied'}`;
        card.innerHTML = `
            <div class="table-card-number">Bàn ${t.table_number}</div>
            <div class="table-card-status">${isAvailable ? 'Trống' : 'Đang có khách'}</div>
        `;
        
        card.addEventListener('click', () => {
            if (isAvailable) {
                // Preselect this table and switch to New Order
                document.getElementById('orderTypeSelect').value = 'dine_in';
                document.getElementById('cartTableSelect').value = t.table_id;
                switchTab('new-order-tab');
            } else {
                // Show order detail / checkout modal
                viewTableOrder(t.table_id);
            }
        });
        grid.appendChild(card);
    });
}

function renderPrepQueue(queue) {
    const grid = document.getElementById('prepQueueGrid');
    grid.innerHTML = '';

    if (queue.length === 0) {
        grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 40px;">Không có thức uống nào trong hàng chờ pha chế.</div>';
        return;
    }

    // Group items by order_id
    const ordersMap = {};
    queue.forEach(item => {
        if (!ordersMap[item.order_id]) {
            ordersMap[item.order_id] = {
                order_id: item.order_id,
                order_time: item.order_time,
                order_status: item.order_status,
                items: []
            };
        }
        ordersMap[item.order_id].items.push(item);
    });

    Object.values(ordersMap).forEach(order => {
        const card = document.createElement('div');
        const isUrgent = order.order_status === 'Pending';
        card.className = `prep-card ${isUrgent ? 'urgent' : ''}`;
        
        let itemsHtml = '';
        order.items.forEach(it => {
            itemsHtml += `
                <div class="prep-item-row">
                    <strong>x${it.quantity} ${it.item_name}</strong>
                </div>
                ${it.customizations ? `<div class="prep-item-modifiers">${it.customizations}</div>` : ''}
            `;
        });

        let actionBtnHtml = '';
        if (order.order_status === 'Pending') {
            actionBtnHtml = `<button class="btn btn-primary btn-block btn-sm" onclick="updateOrderStatus(${order.order_id}, 'Preparing')"><i class="fa-solid fa-play"></i> Pha chế</button>`;
        } else if (order.order_status === 'Preparing') {
            actionBtnHtml = `<button class="btn btn-primary btn-block btn-sm" style="background: var(--success); box-shadow: 0 4px 10px var(--success-glow);" onclick="updateOrderStatus(${order.order_id}, 'Served')"><i class="fa-solid fa-check"></i> Hoàn tất</button>`;
        }

        card.innerHTML = `
            <div class="prep-card-header">
                <span class="prep-card-order-id">Đơn #${order.order_id}</span>
                <span class="prep-card-time"><i class="fa-regular fa-clock"></i> ${order.order_time}</span>
            </div>
            <div class="prep-card-items">
                ${itemsHtml}
            </div>
            <div class="prep-card-actions">
                ${actionBtnHtml}
            </div>
        `;
        grid.appendChild(card);
    });
}

function renderOrderHistory(orders) {
    const tbody = document.getElementById('historyTableBody');
    tbody.innerHTML = '';

    if (orders.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; color: var(--text-muted); padding: 30px;">Không có đơn hàng nào trong lịch sử.</td></tr>';
        return;
    }

    orders.forEach(o => {
        const tr = document.createElement('tr');
        
        let statusBadge = '';
        switch(o.order_status) {
            case 'Paid': statusBadge = '<span class="badge badge-success">Đã TT</span>'; break;
            case 'Served': statusBadge = '<span class="badge badge-info">Đã giao</span>'; break;
            case 'Preparing': statusBadge = '<span class="badge badge-warning">Đang làm</span>'; break;
            case 'Pending': statusBadge = '<span class="badge badge-warning">Chờ làm</span>'; break;
            case 'Cancelled': statusBadge = '<span class="badge badge-danger">Đã hủy</span>'; break;
        }

        let typeText = '';
        switch(o.order_type) {
            case 'dine_in': typeText = 'Tại bàn'; break;
            case 'takeaway': typeText = 'Mang đi'; break;
            case 'pickup': typeText = 'Nhận hàng'; break;
            case 'delivery': typeText = 'Giao hàng'; break;
        }

        tr.innerHTML = `
            <td><strong>#${o.order_id}</strong></td>
            <td>${o.order_date}</td>
            <td>${typeText}</td>
            <td>${o.table_number ? 'Bàn ' + o.table_number : '-'}</td>
            <td>${o.staff_name}</td>
            <td>${o.customer_name || '<span style="color: var(--text-muted);">Khách vãng lai</span>'}</td>
            <td>${statusBadge}</td>
            <td><strong>${formatVND(o.total_amount)}</strong></td>
            <td>
                <button class="btn btn-secondary" style="padding: 4px 8px; font-size: 0.75rem;" onclick="viewInvoice(${o.order_id})">
                    <i class="fa-solid fa-receipt"></i> Hóa đơn
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

async function updateOrderStatus(orderId, status) {
    try {
        const res = await API.post('prep_queue.php', { order_id: orderId, status: status });
        if (res && res.success) {
            await loadPrepQueue();
            await loadOrderHistory();
            await loadTables();
        } else {
            alert(res.error || 'Lỗi cập nhật trạng thái');
        }
    } catch (err) {
        alert(err.message);
    }
}

// ==============================================================================
// CART MANAGEMENT
// ==============================================================================

function handleAddItemClick(item) {
    if (item.modifiers && item.modifiers.length > 0) {
        openModifierModal(item);
    } else {
        addToCart(item, []);
    }
}

function openModifierModal(item) {
    activeItemForModifiers = item;
    selectedModifiers = {};

    document.getElementById('modifierItemName').textContent = item.item_name;
    document.getElementById('modifierItemTotalPrice').textContent = formatVND(item.base_price);
    
    const body = document.getElementById('modifierModalBody');
    body.innerHTML = '';

    item.modifiers.forEach(group => {
        const container = document.createElement('div');
        container.className = 'modifier-group-container';
        
        const reqTag = group.is_required ? '<span class="req-tag">Bắt buộc</span>' : '';
        container.innerHTML = `
            <div class="modifier-group-title">${group.group_name} ${reqTag}</div>
            <div class="modifier-options-grid" id="group-grid-${group.group_id}"></div>
        `;
        
        body.appendChild(container);
        
        const grid = container.querySelector(`#group-grid-${group.group_id}`);
        
        // Selection mode
        selectedModifiers[group.group_id] = [];
        
        group.options.forEach((opt, idx) => {
            const btn = document.createElement('button');
            btn.className = 'modifier-option-btn';
            
            const deltaText = opt.price_delta > 0 ? `+${formatVND(opt.price_delta)}` : '';
            btn.innerHTML = `
                <span>${opt.option_name}</span>
                ${deltaText ? `<span class="price-delta">${deltaText}</span>` : ''}
            `;
            
            // Auto-select first option if required and single selection
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
                    // Multiple selection
                    btn.classList.toggle('selected');
                    const isSelected = btn.classList.contains('selected');
                    if (isSelected) {
                        selectedModifiers[group.group_id].push(opt);
                    } else {
                        selectedModifiers[group.group_id] = selectedModifiers[group.group_id].filter(o => o.option_id !== opt.option_id);
                    }
                }
                recalculateModifierTotalPrice();
            });
            
            grid.appendChild(btn);
        });
    });

    recalculateModifierTotalPrice();
    document.getElementById('modifierModal').classList.add('show');
}

function recalculateModifierTotalPrice() {
    let total = activeItemForModifiers.base_price;
    Object.values(selectedModifiers).forEach(opts => {
        opts.forEach(opt => {
            total += opt.price_delta;
        });
    });
    document.getElementById('modifierItemTotalPrice').textContent = formatVND(total);
}

function addToCart(item, modifiersList) {
    // Generate a unique key for item + combination of modifiers
    const modIds = modifiersList.map(m => m.option_id).sort();
    const cartKey = `${item.item_id}_${modIds.join(',')}`;

    // Check if identical item+modifiers already in cart
    const existing = cart.find(c => c.cartKey === cartKey);
    if (existing) {
        existing.quantity++;
    } else {
        cart.push({
            cartKey: cartKey,
            item: item,
            modifiers: modifiersList,
            quantity: 1
        });
    }

    updateCartUI();
}

function updateCartUI() {
    const list = document.getElementById('cartItemsList');
    list.innerHTML = '';

    if (cart.length === 0) {
        list.innerHTML = `
            <div style="text-align: center; color: var(--text-muted); margin-top: 50px;">
                <i class="fa-solid fa-basket-shopping" style="font-size: 2.5rem; margin-bottom: 12px; display: block;"></i>
                Giỏ hàng trống
            </div>
        `;
        document.getElementById('checkoutBtn').disabled = true;
        document.getElementById('cartSubtotal').textContent = '0đ';
        document.getElementById('cartTotal').textContent = '0đ';
        return;
    }

    document.getElementById('checkoutBtn').disabled = false;
    let subtotal = 0;

    cart.forEach((c, idx) => {
        let itemPrice = c.item.base_price;
        let modsText = '';
        
        if (c.modifiers && c.modifiers.length > 0) {
            c.modifiers.forEach(m => {
                itemPrice += m.price_delta;
            });
            modsText = c.modifiers.map(m => m.option_name).join(', ');
        }
        
        const lineTotal = itemPrice * c.quantity;
        subtotal += lineTotal;

        const cartItemDiv = document.createElement('div');
        cartItemDiv.className = 'cart-item';
        cartItemDiv.innerHTML = `
            <button class="cart-item-delete" onclick="removeFromCart(${idx})"><i class="fa-regular fa-trash-can"></i></button>
            <div class="cart-item-header">
                <div class="cart-item-name">${c.item.item_name}</div>
                <div class="cart-item-price">${formatVND(lineTotal)}</div>
            </div>
            ${modsText ? `<div class="cart-item-modifiers">${modsText}</div>` : ''}
            <div class="cart-item-controls">
                <div class="quantity-controls">
                    <button class="qty-btn" onclick="updateQty(${idx}, -1)"><i class="fa-solid fa-minus"></i></button>
                    <span class="qty-num">${c.quantity}</span>
                    <button class="qty-btn" onclick="updateQty(${idx}, 1)"><i class="fa-solid fa-plus"></i></button>
                </div>
                <span style="font-size: 0.75rem; color: var(--text-muted);">${formatVND(itemPrice)} / cái</span>
            </div>
        `;
        list.appendChild(cartItemDiv);
    });

    document.getElementById('cartSubtotal').textContent = formatVND(subtotal);

    // Apply loyalty redeem discount
    let loyaltyDiscount = appliedRedeemPoints * 100;
    if (loyaltyDiscount > subtotal) {
        loyaltyDiscount = subtotal;
        appliedRedeemPoints = subtotal / 100;
    }
    
    if (loyaltyDiscount > 0) {
        document.getElementById('loyaltyDiscountRow').style.display = 'flex';
        document.getElementById('cartLoyaltyDiscount').textContent = `-${formatVND(loyaltyDiscount)}`;
    } else {
        document.getElementById('loyaltyDiscountRow').style.display = 'none';
    }

    // Apply Promotions (e.g. 10% off Happy Hour Promotion if active)
    let promoDiscount = 0;
    // For demo purposes, if "Happy Hour 10% Off" is active, apply 10%
    const currentHour = new Date().getHours();
    // Assuming happy hour discount of 10% applies
    const hasHappyHour = true; 
    if (hasHappyHour) {
        promoDiscount = Math.round((subtotal - loyaltyDiscount) * 0.1);
        document.getElementById('promoDiscountRow').style.display = 'flex';
        document.getElementById('cartPromoDiscount').textContent = `-${formatVND(promoDiscount)}`;
    } else {
        document.getElementById('promoDiscountRow').style.display = 'none';
    }

    const finalTotal = subtotal - loyaltyDiscount - promoDiscount;
    document.getElementById('cartTotal').textContent = formatVND(finalTotal > 0 ? finalTotal : 0);
}

function updateQty(idx, change) {
    cart[idx].quantity += change;
    if (cart[idx].quantity <= 0) {
        cart.splice(idx, 1);
    }
    updateCartUI();
}

function removeFromCart(idx) {
    cart.splice(idx, 1);
    updateCartUI();
}

// ==============================================================================
// CUSTOMER LOYALTY SEARCH
// ==============================================================================

async function searchCustomer() {
    const phoneInput = document.getElementById('customerPhoneInput');
    const phone = phoneInput.value.trim();
    if (!phone) return;

    try {
        const res = await API.get(`loyalty_balance.php?phone=${encodeURIComponent(phone)}`);
        if (res && res.success && res.data) {
            selectedCustomer = res.data;
            document.getElementById('customerNameText').textContent = selectedCustomer.name;
            document.getElementById('customerPointsText').textContent = selectedCustomer.points_balance;
            document.getElementById('selectedCustomerInfo').style.display = 'flex';
            phoneInput.value = '';
            
            // Show loyalty section in payment modal
            document.getElementById('loyaltyRedeemSection').style.display = 'block';
            document.getElementById('redeemMaxPoints').textContent = selectedCustomer.points_balance;
        } else {
            alert('Không tìm thấy khách hàng với số điện thoại này.');
        }
    } catch (err) {
        alert(err.message || 'Lỗi tìm kiếm khách hàng');
    }
}

function removeCustomer() {
    selectedCustomer = null;
    appliedRedeemPoints = 0;
    document.getElementById('selectedCustomerInfo').style.display = 'none';
    document.getElementById('loyaltyRedeemSection').style.display = 'none';
    document.getElementById('redeemPointsInput').value = '';
    updateCartUI();
}

// ==============================================================================
// CHECKOUT & CREATE ORDER (G3 WRITE FLOW)
// ==============================================================================

function openCheckoutModal() {
    // Check if table select is required
    const orderType = document.getElementById('orderTypeSelect').value;
    const tableId = document.getElementById('cartTableSelect').value;

    if (orderType === 'dine_in' && !tableId) {
        alert('Vui lòng chọn bàn ăn cho hình thức Ăn tại bàn!');
        return;
    }

    const totalText = document.getElementById('cartTotal').textContent;
    document.getElementById('checkoutTotalText').textContent = totalText;
    document.getElementById('checkoutModal').classList.add('show');
}

async function confirmPayment() {
    const orderType = document.getElementById('orderTypeSelect').value;
    const tableId = document.getElementById('cartTableSelect').value;
    const paymentMethodBtn = document.querySelector('.payment-method-btn.selected');
    const paymentMethod = paymentMethodBtn ? paymentMethodBtn.getAttribute('data-method') : 'Cash';
    
    const checkoutBtn = document.getElementById('confirmPaymentBtn');
    checkoutBtn.disabled = true;
    checkoutBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang xử lý...';

    // Build items payload
    const itemsPayload = cart.map(c => {
        return {
            item_id: c.item.item_id,
            quantity: c.quantity,
            modifiers: c.modifiers.map(m => m.option_id)
        };
    });

    const payload = {
        order_type: orderType,
        table_id: tableId ? parseInt(tableId) : null,
        customer_id: selectedCustomer ? selectedCustomer.customer_id : null,
        items: itemsPayload,
        payment_method: paymentMethod,
        points_redeemed: appliedRedeemPoints
    };

    try {
        const res = await API.post('create_order.php', payload);
        
        if (res && res.success) {
            document.getElementById('checkoutModal').classList.remove('show');
            alert('Tạo đơn hàng và thanh toán thành công!');
            
            // Clear cart & state
            cart = [];
            removeCustomer();
            document.getElementById('cartTableSelect').value = '';
            updateCartUI();
            
            // Reload views
            await loadTables();
            await loadPrepQueue();
            await loadOrderHistory();
            
            // View newly created invoice
            viewInvoice(res.order_id);
        } else {
            alert(res.error || 'Lỗi máy chủ khi tạo đơn hàng');
        }
    } catch (err) {
        alert(err.message);
    } finally {
        checkoutBtn.disabled = false;
        checkoutBtn.innerHTML = '<i class="fa-solid fa-circle-check"></i> Xác nhận và Giao đơn';
    }
}

// ==============================================================================
// INVOICE DIALOG & PRINTING
// ==============================================================================

async function viewInvoice(orderId) {
    try {
        const res = await API.get(`order_history.php`); // We don't have a single order details endpoint yet, so let's fetch details.
        // Wait, let's create a quick API `api/order_details.php` to fetch detailed receipt data!
        // For now, let's build the invoice dialog by fetching invoice details.
        const detailsRes = await API.get(`prep_queue.php`); // Fallback helper or similar
        // Wait, we need an endpoint to fetch order receipt details: `api/order_details.php` (We will write this in G2/G3!).
        // Let's call `api/order_details.php?order_id=...`
        const orderDetails = await API.get(`order_history.php`); // Temporary
        
        // Let's implement `api/order_details.php` first or we can write the JS code to fetch it from `api/order_details.php` which we will create shortly!
        // Yes, let's call `api/order_details.php?order_id=${orderId}`
        const receiptRes = await API.get(`order_details.php?order_id=${orderId}`);
        if (receiptRes && receiptRes.success) {
            renderInvoiceModal(receiptRes.data);
        } else {
            alert(receiptRes.error || 'Lỗi hiển thị hóa đơn');
        }
    } catch (err) {
        alert(err.message);
    }
}

function renderInvoiceModal(data) {
    const body = document.getElementById('invoiceModalBody');
    
    let itemsLines = '';
    data.items.forEach(it => {
        itemsLines += `
${it.item_name.padEnd(24)} x${it.quantity} ${formatVND(it.subtotal).padStart(12)}
${it.customizations ? `  (${it.customizations})\n` : ''}`;
    });

    const discountLine = data.discount_amount > 0 ? `Giảm giá:                 -${formatVND(data.discount_amount)}\n` : '';
    const pointsLine = data.points_redeemed > 0 ? `Điểm dùng:                ${data.points_redeemed} điểm\n` : '';

    body.innerHTML = `
========================================
           ANTIGRAVITY COFFEE
       Chi nhánh: ${data.location_name}
  SĐT: ${data.location_phone || '028-XXXX-XXXX'}
========================================
Đơn hàng: #${data.order_id}
Thời gian: ${data.order_date}
Thu ngân: ${data.staff_name}
Hình thức: ${data.order_type === 'dine_in' ? 'Tại bàn (' + (data.table_number ? 'Bàn ' + data.table_number : '-') + ')' : 'Mang đi'}
Khách hàng: ${data.customer_name || 'Khách vãng lai'}
----------------------------------------
Sản phẩm                   SL    Thành tiền
----------------------------------------${itemsLines}
----------------------------------------
Tạm tính:                 ${formatVND(data.subtotal_amount)}
${discountLine}${pointsLine}----------------------------------------
TỔNG CỘNG:                ${formatVND(data.total_amount)}
Thanh toán:               ${data.payment_method}
========================================
     Cảm ơn quý khách! Hẹn gặp lại!
========================================
    `;

    document.getElementById('invoiceModal').classList.add('show');
}

// ==============================================================================
// SHIFT LEAD ONLY: VOIDS & REFUNDS
// ==============================================================================

async function loadShiftLeadData() {
    if (currentUser.role !== 'ShiftLead' && currentUser.role !== 'Admin') return;

    try {
        // Fetch all orders for this branch to perform voids
        const res = await API.get('order_history.php');
        if (res && res.success) {
            const orders = res.data;
            
            // Calculate shift stats
            let revenue = 0;
            let paidCount = 0;
            let refundedCount = 0;

            const tbody = document.getElementById('refundsTableBody');
            tbody.innerHTML = '';

            orders.forEach(o => {
                if (o.order_status === 'Paid') {
                    revenue += o.total_amount;
                    paidCount++;
                    
                    // Render row for Voids/Refunds table
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td><strong>#${o.order_id}</strong></td>
                        <td>${o.order_date}</td>
                        <td>${o.table_number ? 'Bàn ' + o.table_number : '-'}</td>
                        <td><strong>${formatVND(o.total_amount)}</strong></td>
                        <td><span class="badge badge-success">Đã TT</span></td>
                        <td>
                            <button class="btn btn-danger" style="padding: 4px 8px; font-size: 0.75rem;" onclick="voidOrder(${o.order_id})">
                                <i class="fa-solid fa-ban"></i> Hủy & Hoàn
                            </button>
                        </td>
                    `;
                    tbody.appendChild(tr);
                } else if (o.order_status === 'Cancelled') {
                    refundedCount++;
                }
            });

            document.getElementById('shiftRevenue').textContent = formatVND(revenue);
            document.getElementById('shiftOrderCount').textContent = paidCount;
            document.getElementById('shiftRefundCount').textContent = refundedCount;

            if (tbody.children.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 30px;">Không có đơn hàng nào đủ điều kiện để hoàn trả.</td></tr>';
            }
        }
    } catch (err) {
        console.error('Error loading Shift Lead view:', err);
    }
}

async function voidOrder(orderId) {
    const reason = prompt("Vui lòng nhập lý do hủy đơn hàng:");
    if (reason === null) return; // Cancelled prompt
    if (!reason.trim()) {
        alert("Lý do hủy đơn hàng không được để trống!");
        return;
    }

    try {
        const res = await API.post('prep_queue.php', { order_id: orderId, status: 'Cancelled' }); // Can re-use prep_queue to cancel
        // Or write a custom refund query if ingredient restore is needed. 
        // In full flow we will write api/refund_order.php in the plan! Let's make it hit create_order.php with void action or prep_queue.
        if (res && res.success) {
            alert(`Đã hủy thành công đơn hàng #${orderId}.`);
            await loadShiftLeadData();
            await loadOrderHistory();
            await loadTables();
        } else {
            alert(res.error || 'Lỗi hủy đơn');
        }
    } catch (err) {
        alert(err.message);
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

    // Clear Cart
    document.getElementById('clearCartBtn').addEventListener('click', () => {
        if (cart.length > 0 && confirm('Xóa toàn bộ giỏ hàng?')) {
            cart = [];
            updateCartUI();
        }
    });

    // Search Customer
    document.getElementById('searchCustomerBtn').addEventListener('click', searchCustomer);
    document.getElementById('customerPhoneInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            searchCustomer();
        }
    });
    document.getElementById('removeCustomerBtn').addEventListener('click', removeCustomer);

    // Modifier Modal close
    document.getElementById('closeModifierModal').addEventListener('click', closeModifierModal);
    document.getElementById('cancelModifierBtn').addEventListener('click', closeModifierModal);
    document.getElementById('addCartWithModifiersBtn').addEventListener('click', () => {
        // Collect selected modifiers
        const selectedList = [];
        
        // Validate required groups
        let missingRequired = false;
        activeItemForModifiers.modifiers.forEach(group => {
            const selectedOpts = selectedModifiers[group.group_id] || [];
            if (group.is_required && selectedOpts.length === 0) {
                missingRequired = true;
            } else {
                selectedOpts.forEach(o => selectedList.push(o));
            }
        });

        if (missingRequired) {
            alert('Vui lòng chọn đầy đủ các tùy chọn bắt buộc!');
            return;
        }

        addToCart(activeItemForModifiers, selectedList);
        closeModifierModal();
    });

    // Checkout Modal
    document.getElementById('checkoutBtn').addEventListener('click', openCheckoutModal);
    document.getElementById('closeCheckoutModal').addEventListener('click', () => {
        document.getElementById('checkoutModal').classList.remove('show');
    });
    document.getElementById('cancelCheckoutBtn').addEventListener('click', () => {
        document.getElementById('checkoutModal').classList.remove('show');
    });
    document.getElementById('confirmPaymentBtn').addEventListener('click', confirmPayment);

    // Payment Method selection
    document.querySelectorAll('.payment-method-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.payment-method-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
        });
    });

    // Loyalty Points Redeem in Payment Modal
    document.getElementById('applyRedeemBtn').addEventListener('click', () => {
        const input = document.getElementById('redeemPointsInput');
        const points = parseInt(input.value) || 0;
        
        if (points < 0) {
            alert('Số điểm không hợp lệ!');
            return;
        }

        if (points > selectedCustomer.points_balance) {
            alert('Điểm tích lũy không đủ!');
            return;
        }

        // Calculate maximum points that can be redeemed
        // subtotal / 100
        let subtotal = 0;
        cart.forEach(c => {
            let itemPrice = c.item.base_price;
            c.modifiers.forEach(m => itemPrice += m.price_delta);
            subtotal += itemPrice * c.quantity;
        });

        const maxRedeemablePoints = Math.floor(subtotal / 100);
        if (points > maxRedeemablePoints) {
            alert(`Chỉ được sử dụng tối đa ${maxRedeemablePoints} điểm cho đơn hàng này!`);
            input.value = maxRedeemablePoints;
            appliedRedeemPoints = maxRedeemablePoints;
        } else {
            appliedRedeemPoints = points;
        }

        updateCartUI();
        
        // Update checkout modal total text
        const totalText = document.getElementById('cartTotal').textContent;
        document.getElementById('checkoutTotalText').textContent = totalText;
    });

    // Invoice Modal
    document.getElementById('closeInvoiceModal').addEventListener('click', () => {
        document.getElementById('invoiceModal').classList.remove('show');
    });
    document.getElementById('closeInvoiceBtn').addEventListener('click', () => {
        document.getElementById('invoiceModal').classList.remove('show');
    });
    document.getElementById('printInvoiceBtn').addEventListener('click', () => {
        alert('Đã gửi yêu cầu đến máy in nhiệt chi nhánh thành công! (Chế độ giả lập)');
    });

    // Table view refresh buttons
    document.getElementById('refreshPrepQueueBtn').addEventListener('click', loadPrepQueue);
    document.getElementById('refreshTablesBtn').addEventListener('click', loadTables);
    document.getElementById('refreshHistoryBtn').addEventListener('click', loadOrderHistory);

    // Order Type Selection change
    document.getElementById('orderTypeSelect').addEventListener('change', (e) => {
        const type = e.target.value;
        const tableSelect = document.getElementById('cartTableSelect');
        if (type !== 'dine_in') {
            tableSelect.value = '';
            tableSelect.disabled = true;
        } else {
            tableSelect.disabled = false;
        }
    });
}

function switchTab(tabId) {
    // Hide all sections
    document.querySelectorAll('.view-section').forEach(sec => sec.classList.remove('active'));
    
    // Show target section
    const targetSec = document.getElementById(tabId);
    if (targetSec) {
        targetSec.classList.add('active');
        
        // Update sidebar active state
        document.querySelectorAll('.sidebar-menu .menu-item-btn').forEach(btn => {
            if (btn.getAttribute('data-target') === tabId) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        // Update Top Bar title
        let tabTitle = 'Đơn hàng mới';
        if (tabId === 'prep-queue-tab') {
            tabTitle = 'Hàng chờ pha chế';
            loadPrepQueue();
        } else if (tabId === 'tables-tab') {
            tabTitle = 'Sơ đồ bàn ăn';
            loadTables();
        } else if (tabId === 'history-tab') {
            tabTitle = 'Lịch sử bán hàng';
            loadOrderHistory();
        } else if (tabId === 'shift-lead-tab') {
            tabTitle = 'Quản lý ca trực (Shift Lead Only)';
            loadShiftLeadData();
        }
        document.getElementById('currentTabTitle').textContent = tabTitle;
    }
}

function closeModifierModal() {
    document.getElementById('modifierModal').classList.remove('show');
    activeItemForModifiers = null;
    selectedModifiers = {};
}

// ==============================================================================
// UTILITY FUNCTIONS
// ==============================================================================

function formatVND(amount) {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
}

/* ==========================================================================
   POS Frontend & Kitchen Audit Dashboard Controller (`js/pos.js`)
   ========================================================================== */

const POSController = (function() {
  'use strict';

  let currentCart = [];
  let selectedCategory = 'all';
  let activeCustomizingIndex = -1;
  let activeAuditTab = 'all'; // 'all', 'active', 'done'

  function init() {
    setupEventListeners();
    renderMenuGrid();
    renderCart();
    renderAuditDashboard();
    renderTargetMarkers();
  }

  function setupEventListeners() {
    const chips = document.querySelectorAll('.cat-chip');
    chips.forEach(chip => {
      chip.addEventListener('click', function(e) {
        e.preventDefault();
        document.querySelectorAll('.cat-chip').forEach(c => c.classList.remove('active'));
        this.classList.add('active');
        selectedCategory = this.getAttribute('data-cat') || 'all';
        renderMenuGrid();
      });
    });

    // Audit Tab Delegation using e.target.closest for 100% reliable clicks
    const auditTabContainer = document.querySelector('.audit-tab-bar');
    if (auditTabContainer) {
      auditTabContainer.addEventListener('click', function(e) {
        const btn = e.target.closest('.audit-tab-btn');
        if (btn) {
          e.preventDefault();
          const tabVal = btn.getAttribute('data-tab');
          if (tabVal) setAuditTab(tabVal);
        }
      });
    }

    if (window.EventBus) {
      window.EventBus.on('NETWORK_SYNC_UPDATED', function() {
        renderAuditDashboard();
      });
    }

    const sendBtn = document.getElementById('btn-send-order');
    if (sendBtn) {
      sendBtn.addEventListener('click', handleSendOrder);
    }

    const clearBtn = document.getElementById('btn-clear-cart');
    if (clearBtn) {
      clearBtn.addEventListener('click', function() {
        currentCart = [];
        renderCart();
      });
    }

    const closeModalBtn = document.getElementById('btn-modal-close');
    if (closeModalBtn) {
      closeModalBtn.addEventListener('click', hideCustomModal);
    }
  }

  function setAuditTab(tabName) {
    if (!tabName) return;
    activeAuditTab = tabName;
    
    const btns = document.querySelectorAll('.audit-tab-btn');
    btns.forEach(btn => {
      const tabVal = btn.getAttribute('data-tab');
      if (tabVal === tabName) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    renderAuditDashboard();
  }

  function renderMenuGrid() {
    const gridContainer = document.getElementById('menu-grid-container');
    if (!gridContainer) return;

    if (!window.DB) {
      gridContainer.innerHTML = '<div style="color:var(--color-danger); padding:20px;">資料庫未載入</div>';
      return;
    }

    const allItems = window.DB.getMenu();
    const filteredItems = selectedCategory === 'all' 
      ? allItems 
      : allItems.filter(item => item.category === selectedCategory);

    if (filteredItems.length === 0) {
      gridContainer.innerHTML = '<div style="color:var(--text-muted); padding:20px; text-align:center;">此分類下尚無餐點</div>';
      return;
    }

    gridContainer.innerHTML = filteredItems.map(item => `
      <div class="menu-card" data-id="${item.id}">
        <div class="menu-card-icon">${item.icon}</div>
        <div>
          <div class="menu-card-title">${item.name}</div>
          <div class="menu-card-desc">${item.description}</div>
        </div>
        <div class="menu-card-footer">
          <span class="menu-price">NT$ ${item.price}</span>
          <button class="add-btn" onclick="window.POSController.addToCart('${item.id}')">+</button>
        </div>
      </div>
    `).join('');
  }

  function addToCart(itemId) {
    if (!window.DB) return;
    const menuItem = window.DB.getItemById(itemId);
    if (!menuItem) return;

    currentCart.push({
      id: menuItem.id,
      name: menuItem.name,
      price: menuItem.price,
      customizations: []
    });

    renderCart();
  }

  function renderCart() {
    const cartContainer = document.getElementById('cart-items-container');
    const totalEl = document.getElementById('cart-total-price');
    const sendBtn = document.getElementById('btn-send-order');
    if (!cartContainer) return;

    if (currentCart.length === 0) {
      cartContainer.innerHTML = `
        <div class="empty-placeholder">
          🛒 購物車目前空空如也<br>請在左側點選餐點加入
        </div>
      `;
      if (totalEl) totalEl.textContent = 'NT$ 0';
      if (sendBtn) sendBtn.disabled = true;
      return;
    }

    let totalPrice = 0;

    cartContainer.innerHTML = currentCart.map((item, index) => {
      totalPrice += item.price;
      const customTagsHtml = item.customizations.map(c => `
        <span class="custom-tag ${c.type === 'add' ? 'add-tag' : ''}">
          ${c.type === 'remove' ? '⚠️ ' : '➕ '}${c.name}
        </span>
      `).join('');

      return `
        <div class="cart-item">
          <div class="cart-item-main">
            <span class="cart-item-name">${item.name}</span>
            <span class="cart-item-price">NT$ ${item.price}</span>
          </div>
          ${customTagsHtml ? `<div class="cart-custom-tags">${customTagsHtml}</div>` : ''}
          <div class="cart-item-actions">
            <button class="customize-trigger-btn" onclick="window.POSController.openCustomModal(${index})">
              ⚙️ 客製化要求 (${item.customizations.length})
            </button>
            <button style="background:none; border:none; color:var(--color-danger); cursor:pointer;" onclick="window.POSController.removeFromCart(${index})">
              ✕ 移除
            </button>
          </div>
        </div>
      `;
    }).join('');

    if (totalEl) totalEl.textContent = `NT$ ${totalPrice}`;
    if (sendBtn) sendBtn.disabled = false;
  }

  function removeFromCart(index) {
    currentCart.splice(index, 1);
    renderCart();
  }

  function openCustomModal(cartIndex) {
    activeCustomizingIndex = cartIndex;
    const item = currentCart[cartIndex];
    if (!window.DB) return;
    const menuItem = window.DB.getItemById(item.id);
    if (!menuItem || !menuItem.customOptions) return;

    const modalTitle = document.getElementById('modal-item-title');
    const modalOptions = document.getElementById('modal-options-list');
    const backdrop = document.getElementById('custom-modal-backdrop');

    if (modalTitle) modalTitle.textContent = `客製化：${item.name}`;

    if (modalOptions) {
      modalOptions.innerHTML = menuItem.customOptions.map(opt => {
        const isSelected = item.customizations.some(c => c.id === opt.id);
        const cls = isSelected 
          ? (opt.type === 'remove' ? 'selected-remove' : 'selected-add')
          : '';

        return `
          <div class="custom-opt-btn ${cls}" onclick="window.POSController.toggleCustomOption('${opt.id}')">
            <span>${opt.name}</span>
            <span>${isSelected ? '✓ 已選擇' : '+ 選擇'}</span>
          </div>
        `;
      }).join('');
    }

    if (backdrop) backdrop.classList.add('active');
  }

  function toggleCustomOption(optId) {
    if (activeCustomizingIndex < 0 || activeCustomizingIndex >= currentCart.length) return;

    const item = currentCart[activeCustomizingIndex];
    if (!window.DB) return;
    const menuItem = window.DB.getItemById(item.id);
    const opt = menuItem.customOptions.find(o => o.id === optId);
    if (!opt) return;

    const existingIdx = item.customizations.findIndex(c => c.id === optId);
    if (existingIdx >= 0) {
      item.customizations.splice(existingIdx, 1);
    } else {
      item.customizations.push(opt);
    }

    renderCart();
    openCustomModal(activeCustomizingIndex);
  }

  function hideCustomModal() {
    const backdrop = document.getElementById('custom-modal-backdrop');
    if (backdrop) backdrop.classList.remove('active');
    activeCustomizingIndex = -1;
  }

  function handleSendOrder() {
    if (currentCart.length === 0 || !window.DB) return;

    const newOrder = window.DB.createOrder(currentCart);
    currentCart = [];
    renderCart();

    if (window.EventBus) {
      window.EventBus.emit('NEW_ORDER_DISPATCHED', newOrder);
    }

    renderAuditDashboard();
    alert(`🎉 訂單 ${newOrder.orderId} 已派發至 Xreal AR 眼鏡系統！`);
  }

  function renderAuditDashboard() {
    const auditContainer = document.getElementById('audit-body-container');
    if (!auditContainer || !window.DB) return;

    const activeOrders = window.DB.getActiveOrders();
    const doneOrders = window.DB.getCompletedOrders();

    const countActiveEl = document.getElementById('count-active-orders');
    const countDoneEl = document.getElementById('count-done-orders');
    if (countActiveEl) countActiveEl.textContent = activeOrders.length;
    if (countDoneEl) countDoneEl.textContent = doneOrders.length;

    let html = '';

    // Render Active Section (if tab is 'all' or 'active')
    if (activeAuditTab === 'all' || activeAuditTab === 'active') {
      html += `
        <div style="font-size: 0.82rem; font-weight: 700; color: var(--primary); margin: 4px 0 6px 0;">
          ⏱️ 進行中訂單 (${activeOrders.length})
        </div>
      `;

      if (activeOrders.length === 0) {
        html += `<div class="empty-placeholder">目前尚無進行中的廚房訂單</div>`;
      } else {
        html += activeOrders.map(order => {
          const item = order.items[order.activeItemIndex || 0];
          const stepLogs = item.stepTimestamps.map(log => `
            <div class="audit-step-item completed">
              <span>✓ ${log.title}</span>
              <span class="audit-step-timestamp">${log.timestamp}</span>
            </div>
          `).join('');

          return `
            <div class="audit-order-card">
              <div class="audit-order-header">
                <span class="audit-order-id">${order.orderId}</span>
                <span style="font-size:0.72rem; background:rgba(0,229,255,0.15); color:var(--primary); padding:2px 8px; border-radius:10px;">
                  階段 ${item.currentStepIndex + 1}/${item.sop.length}
                </span>
              </div>
              <div style="font-weight:600; font-size:0.88rem;">${item.name}</div>
              <div class="audit-step-timeline">${stepLogs}</div>
            </div>
          `;
        }).join('');
      }
    }

    // Render Completed Section (if tab is 'all' or 'done')
    if (activeAuditTab === 'all' || activeAuditTab === 'done') {
      html += `
        <div style="font-size: 0.82rem; font-weight: 700; color: var(--color-success); margin: 12px 0 6px 0;">
          ✅ 已高品質交付歷史 (${doneOrders.length})
        </div>
      `;

      if (doneOrders.length === 0) {
        html += `<div class="empty-placeholder">尚未有已交付的歷史紀錄</div>`;
      } else {
        html += doneOrders.map(order => `
          <div class="audit-order-card" style="border-color:rgba(0,230,118,0.3);">
            <div class="audit-order-header">
              <span class="audit-order-id" style="color:var(--color-success);">${order.orderId}</span>
              <span class="audit-step-timestamp">${order.completedAt} 完成</span>
            </div>
            <div style="font-size:0.82rem;">已完美品質交付</div>
          </div>
        `).join('');
      }
    }

    auditContainer.innerHTML = html;
  }

  function renderTargetMarkers() {
    drawMarkerCanvas('canvas-toaster-marker', 'TOASTER-20S', '#00e5ff');
    drawMarkerCanvas('canvas-grill-marker', 'GRILL-45S', '#ff3366');
    drawMarkerCanvas('canvas-beverage-marker', 'BEVERAGE-30S', '#7c4dff');
  }

  function drawMarkerCanvas(canvasId, textLabel, accentColor) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width = 100;
    const h = canvas.height = 100;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 8;
    ctx.strokeRect(6, 6, w - 12, h - 12);

    ctx.fillStyle = accentColor;
    ctx.fillRect(20, 20, w - 40, h - 40);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(textLabel, w / 2, h / 2 + 3);
  }

  return {
    init: init,
    renderMenuGrid: renderMenuGrid,
    addToCart: addToCart,
    removeFromCart: removeFromCart,
    openCustomModal: openCustomModal,
    toggleCustomOption: toggleCustomOption,
    renderAuditDashboard: renderAuditDashboard,
    setAuditTab: setAuditTab
  };
})();

// Explicit Window Export
window.POSController = POSController;

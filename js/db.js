/* ==========================================================================
   XR Catalyst - Data Access Layer (DAL) & Real-Time Sync (`js/db.js`)
   Cross-Device Local Network Realtime Sync Engine (PC POS <-> Tablet/Glasses)
   ========================================================================== */

const DB = (function() {
  'use strict';

  // Preset Menu Items Database Schema
  const MENU_DATABASE = [
    {
      id: 'item_burger_classic',
      name: '經典雙層牛肉堡',
      category: 'burgers',
      price: 135,
      icon: '🍔',
      description: '嚴選雙層純牛肉餅、切達起司、特製漢堡醬與新鮮生菜',
      sop: [
        { stepId: 1, title: '準備食材與漢堡麵包', type: 'prep', detail: '取雙層麵包與起司' },
        { stepId: 2, title: '煎台肉餅烹調', type: 'timer', duration: 45, targetId: 'patty_grill_target', detail: '至Patty標籤，手勢啟動45s計時' },
        { stepId: 3, title: '客製化組裝醬料與生菜', type: 'custom_check', detail: '核對客製化需求（去生菜/去醬）' },
        { stepId: 4, title: '包裝與出餐交付', type: 'deliver', detail: '擺盤送至出餐台' }
      ],
      customOptions: [
        { id: 'no_lettuce', name: '去生菜 (No Lettuce)', type: 'remove' },
        { id: 'no_mayo', name: '去美乃滋 (No Mayo)', type: 'remove' },
        { id: 'extra_cheese', name: '加起司 (Extra Cheese)', type: 'add', extraPrice: 15 }
      ]
    },
    {
      id: 'item_toast_cheese',
      name: '現烤起司火腿吐司',
      category: 'toast',
      price: 85,
      icon: '🥪',
      description: '金黃酥脆現烤吐司，搭配雙重起司與優質煙燻火腿',
      sop: [
        { stepId: 1, title: '吐司放入烤麵包機', type: 'timer', duration: 20, targetId: 'toaster_target', detail: '注視Toaster標籤，Pinch手勢觸發20s計時' },
        { stepId: 2, title: '夾入起司與熱火腿', type: 'prep', detail: '剛出爐吐司迅速鋪上起司融化' },
        { stepId: 3, title: '對切與裝袋交付', type: 'deliver', detail: '對角切塊裝入提袋' }
      ],
      customOptions: [
        { id: 'extra_ham', name: '加火腿 (Extra Ham)', type: 'add', extraPrice: 20 },
        { id: 'no_butter', name: '不抹奶油 (No Butter)', type: 'remove' }
      ]
    },
    {
      id: 'item_coffee_iced_americano',
      name: '特調冰美式咖啡',
      category: 'beverages',
      price: 90,
      icon: '☕',
      description: '中深烘焙精品豆現萃 espresso，口感醇厚回甘',
      sop: [
        { stepId: 1, title: '萃茶/咖啡機極速萃取', type: 'timer', duration: 30, targetId: 'beverage_target', detail: '注視Beverage標籤，手勢觸發30s萃取計時' },
        { stepId: 2, title: '加入冰塊與純淨水', type: 'custom_check', detail: '依據客製化（去冰/少冰）調整冰量' },
        { stepId: 3, title: '封口與附吸管交付', type: 'deliver', detail: '杯蓋封口完成' }
      ],
      customOptions: [
        { id: 'no_ice', name: '去冰 (No Ice)', type: 'remove' },
        { id: 'less_ice', name: '少冰 (Less Ice)', type: 'adjust' },
        { id: 'no_sugar', name: '無糖 (No Sugar)', type: 'remove' }
      ]
    }
  ];

  let activeOrders = [];
  let completedOrders = [];
  let orderCounter = 101;
  let syncIntervalId = null;

  function init() {
    const savedActive = localStorage.getItem('xr_active_orders');
    const savedDone = localStorage.getItem('xr_completed_orders');
    if (savedActive) {
      try { activeOrders = JSON.parse(savedActive); } catch(e) {}
    }
    if (savedDone) {
      try { completedOrders = JSON.parse(savedDone); } catch(e) {}
    }

    // Start 1-second cross-device real-time sync polling
    startNetworkSync();
  }

  function startNetworkSync() {
    if (syncIntervalId) clearInterval(syncIntervalId);
    syncNetwork();
    syncIntervalId = setInterval(syncNetwork, 1000);
  }

  function syncNetwork() {
    fetch('/api/sync')
      .then(res => res.json())
      .then(data => {
        if (data && (data.activeOrders !== undefined || data.completedOrders !== undefined)) {
          const prevActiveStr = JSON.stringify(activeOrders);
          const prevDoneStr = JSON.stringify(completedOrders);

          activeOrders = data.activeOrders || [];
          completedOrders = data.completedOrders || [];

          saveLocalState();

          const newActiveStr = JSON.stringify(activeOrders);
          const newDoneStr = JSON.stringify(completedOrders);

          // If network state changed, trigger sync update event
          if (prevActiveStr !== newActiveStr || prevDoneStr !== newDoneStr) {
            if (window.EventBus) {
              window.EventBus.emit('NETWORK_SYNC_UPDATED', {
                activeOrders: activeOrders,
                completedOrders: completedOrders
              });
            }
          }
        }
      })
      .catch(err => {
        // Silently fallback to LocalStorage if offline
      });
  }

  function saveLocalState() {
    try {
      localStorage.setItem('xr_active_orders', JSON.stringify(activeOrders));
      localStorage.setItem('xr_completed_orders', JSON.stringify(completedOrders));
    } catch(e) {}
  }

  return {
    init: init,

    getMenu: function() {
      return MENU_DATABASE;
    },

    getItemById: function(itemId) {
      return MENU_DATABASE.find(item => item.id === itemId);
    },

    createOrder: function(itemsInCart) {
      const orderId = `ORD-#${orderCounter++}`;
      const now = new Date();
      
      const newOrder = {
        orderId: orderId,
        createdAt: now.toISOString(),
        createdAtFormatted: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        status: 'pending',
        items: itemsInCart.map(cartItem => {
          const menuItem = MENU_DATABASE.find(m => m.id === cartItem.id);
          return {
            itemId: cartItem.id,
            name: menuItem.name,
            icon: menuItem.icon,
            customizations: cartItem.customizations || [],
            sop: JSON.parse(JSON.stringify(menuItem.sop)),
            currentStepIndex: 0,
            slaSeconds: menuItem.sop ? menuItem.sop.reduce((acc, s) => acc + (s.duration || 15), 30) : 120,
            stepTimestamps: []
          };
        }),
        activeItemIndex: 0
      };

      activeOrders.push(newOrder);
      saveLocalState();

      // Post Order to Network Sync Server
      fetch('/api/orders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order: newOrder })
      }).catch(e => {});

      return newOrder;
    },

    getActiveOrders: function() {
      return activeOrders;
    },

    getCompletedOrders: function() {
      return completedOrders;
    },

    recordStepTimestamp: function(orderId, itemIndex, stepId, stepTitle) {
      const order = activeOrders.find(o => o.orderId === orderId);
      const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

      if (order) {
        const item = order.items[itemIndex];
        if (item) {
          item.stepTimestamps.push({
            stepId: stepId,
            title: stepTitle,
            timestamp: timestamp
          });
          item.currentStepIndex++;

          if (item.currentStepIndex >= item.sop.length) {
            order.status = 'completed';
            order.completedAt = timestamp;
            activeOrders = activeOrders.filter(o => o.orderId !== orderId);
            completedOrders.unshift(order);
          }
        }
      }

      saveLocalState();

      // Post Step Timestamp to Network Sync Server
      fetch('/api/orders/step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: orderId,
          itemIndex: itemIndex,
          stepId: stepId,
          stepTitle: stepTitle,
          timestamp: timestamp
        })
      }).catch(e => {});

      return order;
    },

    clearAllData: function() {
      activeOrders = [];
      completedOrders = [];
      orderCounter = 101;
      localStorage.removeItem('xr_active_orders');
      localStorage.removeItem('xr_completed_orders');

      fetch('/api/orders/clear', { method: 'POST' }).catch(e => {});
    }
  };
})();

// Explicit Window Export
window.DB = DB;

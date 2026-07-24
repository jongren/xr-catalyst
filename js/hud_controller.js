/* ==========================================================================
   Xreal AR Glasses HUD Controller (`js/hud_controller.js`)
   Dual UI Modes, Sequential SOP Machine, Customization Banner & Timestamp Audit
   Includes Auto-Clear Viewport on Order Delivery Completion
   ========================================================================== */

const HUDController = (function() {
  'use strict';

  let currentMode = 'training';
  let currentOrder = null;
  let activeItemIndex = 0;
  let slaIntervalId = null;
  let currentSlaSeconds = 0;
  let isCompletingTransition = false;

  function init() {
    setupModeSwitchers();
    listenToEvents();
    syncOrderFromDB();
  }

  function setupModeSwitchers() {
    const compactBtn = document.getElementById('btn-mode-compact');
    const trainingBtn = document.getElementById('btn-mode-training');

    if (compactBtn) {
      compactBtn.addEventListener('click', function() {
        setMode('compact');
      });
    }
    if (trainingBtn) {
      trainingBtn.addEventListener('click', function() {
        setMode('training');
      });
    }
  }

  function setMode(mode) {
    currentMode = mode;
    const compactBtn = document.getElementById('btn-mode-compact');
    const trainingBtn = document.getElementById('btn-mode-training');

    if (mode === 'compact') {
      if (compactBtn) compactBtn.classList.add('active');
      if (trainingBtn) trainingBtn.classList.remove('active');
    } else {
      if (trainingBtn) trainingBtn.classList.add('active');
      if (compactBtn) compactBtn.classList.remove('active');
    }

    if (!isCompletingTransition) {
      renderHUDContent();
    }
  }

  function syncOrderFromDB() {
    if (isCompletingTransition) return;

    if (window.DB) {
      const activeOrders = window.DB.getActiveOrders();
      if (activeOrders.length > 0) {
        if (!currentOrder || currentOrder.orderId !== activeOrders[0].orderId) {
          currentOrder = activeOrders[0];
          activeItemIndex = 0;
          startSlaCountdown();
          playNotificationSound();
        } else {
          currentOrder = activeOrders[0];
        }
      } else {
        currentOrder = null;
      }
    }
    renderHUDContent();
  }

  function listenToEvents() {
    if (!window.EventBus) return;

    window.EventBus.on('NEW_ORDER_DISPATCHED', function(order) {
      if (isCompletingTransition) return;
      currentOrder = order;
      activeItemIndex = 0;
      startSlaCountdown();
      playNotificationSound();
      renderHUDContent();
    });

    window.EventBus.on('NETWORK_SYNC_UPDATED', function() {
      syncOrderFromDB();
    });

    window.EventBus.on('GESTURE_TARGET_PINCHED', function(targetId) {
      handleGestureTrigger(targetId);
    });

    window.EventBus.on('GESTURE_MISFIRE_WARNING', function(msg) {
      showWarningToast(msg);
    });
  }

  function startSlaCountdown() {
    if (slaIntervalId) clearInterval(slaIntervalId);
    if (!currentOrder) return;

    const currentItem = currentOrder.items[activeItemIndex];
    currentSlaSeconds = currentItem ? currentItem.slaSeconds : 120;

    slaIntervalId = setInterval(function() {
      if (currentSlaSeconds > 0) {
        currentSlaSeconds--;
        updateSlaDisplay();
      } else {
        clearInterval(slaIntervalId);
      }
    }, 1000);
  }

  function updateSlaDisplay() {
    const el = document.getElementById('hud-sla-timer');
    if (el) {
      const min = Math.floor(currentSlaSeconds / 60);
      const sec = currentSlaSeconds % 60;
      el.textContent = `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
      if (currentSlaSeconds <= 15) {
        el.style.color = 'var(--color-danger)';
      } else {
        el.style.color = 'var(--primary)';
      }
    }
  }

  function handleGestureTrigger(targetId) {
    if (isCompletingTransition) return;

    if (!currentOrder && window.DB) {
      const active = window.DB.getActiveOrders();
      if (active.length > 0) currentOrder = active[0];
    }
    if (!currentOrder) return;

    const currentItem = currentOrder.items[activeItemIndex];
    if (!currentItem) return;

    const currentStep = currentItem.sop[currentItem.currentStepIndex];
    if (!currentStep) return;

    if (currentStep.type === 'timer' && currentStep.targetId === targetId) {
      if (currentStep.timerStarted && !currentStep.timerFinished) {
        return; // Timer already running
      }

      currentStep.timerStarted = true;
      currentStep.timerRemaining = currentStep.duration;
      currentStep.timerFinished = false;

      if (window.AREngine) {
        window.AREngine.addSpatialTimer(targetId, currentStep.duration, currentStep.title);
      }
      playTimerStartSound();
      renderHUDContent();

      if (currentStep.timerIntervalId) clearInterval(currentStep.timerIntervalId);

      const startTime = Date.now();
      const durationSec = currentStep.duration;

      currentStep.timerIntervalId = setInterval(function() {
        const elapsedSec = Math.floor((Date.now() - startTime) / 1000);
        const remaining = Math.max(0, durationSec - elapsedSec);

        if (remaining > 0) {
          if (currentStep.timerRemaining !== remaining) {
            currentStep.timerRemaining = remaining;
            renderHUDContent();
          }
        } else {
          currentStep.timerRemaining = 0;
          currentStep.timerFinished = true;
          clearInterval(currentStep.timerIntervalId);
          currentStep.timerIntervalId = null;

          playSuccessBeep();
          advanceSOPStep(true);
        }
      }, 200);
    }
  }

  function triggerStepTimer(targetId) {
    handleGestureTrigger(targetId);
  }

  function advanceSOPStep(isAutoAdvance) {
    if (isCompletingTransition) return;

    if (!currentOrder && window.DB) {
      const activeOrders = window.DB.getActiveOrders();
      if (activeOrders.length > 0) {
        currentOrder = activeOrders[0];
        activeItemIndex = 0;
      }
    }

    if (!currentOrder) {
      alert('💡 目前尚無待處理的派單任務，請先在「前台 POS 點餐」頁面點選餐點並按下「送出訂單至 AR 眼鏡」！');
      return;
    }

    const currentItem = currentOrder.items[activeItemIndex];
    if (!currentItem) return;

    if (currentItem.currentStepIndex < currentItem.sop.length) {
      const currentStep = currentItem.sop[currentItem.currentStepIndex];

      // Strict SOP Timer Validation on manual click
      if (!isAutoAdvance && currentStep && currentStep.type === 'timer') {
        if (!currentStep.timerStarted) {
          alert(`⚠️ 嚴格 SOP 品質控管：此步驟（${currentStep.title}）需要進行 ${currentStep.duration} 秒設備烹調計時，請先注視對應設備標籤（或點擊橘色按鈕）啟動計時器！`);
          return;
        }
        if (!currentStep.timerFinished) {
          alert(`⏳ 嚴格 SOP 品質控管：設備烹調計時中（剩餘 ${currentStep.timerRemaining} 秒），為了確保產品高品質交付，倒數結束前禁止跳過！`);
          return;
        }
      }

      if (window.DB && currentStep) {
        window.DB.recordStepTimestamp(
          currentOrder.orderId,
          activeItemIndex,
          currentStep.stepId,
          currentStep.title
        );
      } else {
        currentItem.currentStepIndex++;
      }
    }

    if (!isAutoAdvance) {
      playSuccessBeep();
    }

    // Check if item / order is completed
    if (currentItem.currentStepIndex >= currentItem.sop.length) {
      const completedOrderId = currentOrder.orderId;
      playSuccessBeep();
      
      isCompletingTransition = true;
      renderHUDCompletionBanner(completedOrderId);

      setTimeout(function() {
        isCompletingTransition = false;
        if (window.DB) {
          const activeOrders = window.DB.getActiveOrders();
          if (activeOrders.length > 0) {
            currentOrder = activeOrders[0];
            activeItemIndex = 0;
            startSlaCountdown();
          } else {
            currentOrder = null;
          }
        } else {
          currentOrder = null;
        }
        renderHUDContent();
      }, 1500);
    } else {
      renderHUDContent();
    }

    if (window.POSController) {
      window.POSController.renderAuditDashboard();
    }
  }

  function renderHUDCompletionBanner(orderId) {
    const container = document.getElementById('hud-dynamic-content');
    if (!container) return;

    container.innerHTML = `
      <div style="text-align: center; padding: 36px 16px; background: rgba(0, 230, 118, 0.12); border: 1px solid var(--color-success); border-radius: var(--radius-lg); box-shadow: 0 0 20px rgba(0, 230, 118, 0.2);">
        <div style="font-size: 3rem; margin-bottom: 8px;">🎉</div>
        <div style="font-size: 1.2rem; font-weight: 700; color: var(--color-success); margin-bottom: 6px;">
          訂單 ${orderId} 已完美品質出餐交付！
        </div>
        <div style="font-size: 0.85rem; color: var(--text-muted);">
          正在自動清空畫面，準備接收下一筆訂單...
        </div>
      </div>
    `;
  }

  function renderHUDContent() {
    if (isCompletingTransition) return;

    const container = document.getElementById('hud-dynamic-content');
    if (!container) return;

    if (!currentOrder && window.DB) {
      const activeOrders = window.DB.getActiveOrders();
      if (activeOrders.length > 0) {
        currentOrder = activeOrders[0];
        activeItemIndex = 0;
      }
    }

    if (!currentOrder) {
      container.innerHTML = `
        <div style="text-align: center; padding: 40px 10px; color: var(--text-muted);">
          <div style="font-size: 2.5rem; margin-bottom: 8px;">🕶️</div>
          <div style="font-weight: 700; color: var(--text-main); margin-bottom: 4px;">Xreal AR 視野已啟動 (Standby)</div>
          <div style="font-size: 0.85rem;">等待前台 POS 派發出餐單...</div>
        </div>
      `;
      return;
    }

    const currentItem = currentOrder.items[activeItemIndex];
    if (!currentItem) return;

    let customBannerHtml = '';
    if (currentItem.customizations && currentItem.customizations.length > 0) {
      const customText = currentItem.customizations.map(c => c.name).join(' / ');
      customBannerHtml = `
        <div class="custom-alert-banner">
          <span class="alert-icon">⚠️</span>
          <div class="alert-text-group">
            <span class="alert-label">顧客客製化特殊要求 (Strict Alert)</span>
            <span class="alert-content">${customText}</span>
          </div>
        </div>
      `;
    }

    if (currentMode === 'compact') {
      renderCompactView(container, currentItem, customBannerHtml);
    } else {
      renderTrainingView(container, currentItem, customBannerHtml);
    }
  }

  function renderCompactView(container, currentItem, customBannerHtml) {
    const min = Math.floor(currentSlaSeconds / 60);
    const sec = currentSlaSeconds % 60;
    const timeStr = `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;

    container.innerHTML = `
      <div class="compact-mode-view">
        <div class="compact-order-header">
          <span style="font-family:var(--font-mono); font-weight:700; color:var(--primary);">${currentOrder.orderId}</span>
          <span style="font-size:0.75rem; background:rgba(255,255,255,0.1); padding:2px 8px; border-radius:10px;">簡易出餐 HUD</span>
        </div>
        
        <div class="compact-item-title">${currentItem.icon} ${currentItem.name}</div>
        
        ${customBannerHtml}

        <div class="compact-timer-box">
          <div style="display:flex; flex-direction:column;">
            <span style="font-size:0.75rem; color:var(--text-muted);">SLA 出餐剩餘時間</span>
            <span style="font-size:0.85rem; font-weight:600;">標準時限內高品質交付</span>
          </div>
          <div class="sla-countdown" id="hud-sla-timer">${timeStr}</div>
        </div>

        <button class="btn-primary" style="width:100%; margin-top:8px;" onclick="window.HUDController.advanceSOPStep()">
          ✓ 步驟完成 / 出餐交付 (Confirm Step)
        </button>
      </div>
    `;
  }

  function renderTrainingView(container, currentItem, customBannerHtml) {
    const min = Math.floor(currentSlaSeconds / 60);
    const sec = currentSlaSeconds % 60;
    const timeStr = `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;

    const currentStep = currentItem.sop[currentItem.currentStepIndex];
    let isTimerBlocked = false;
    let timerStatusText = '👉 執行 / 確定完成目前步驟 (Advance SOP)';

    if (currentStep && currentStep.type === 'timer') {
      if (!currentStep.timerStarted) {
        isTimerBlocked = true;
        timerStatusText = `🔒 需先注視標籤啟動計時 (${currentStep.duration}s Required)`;
      } else if (!currentStep.timerFinished) {
        isTimerBlocked = true;
        timerStatusText = `⏳ 設備烹調計時中 (剩餘 ${currentStep.timerRemaining}s 倒數)...`;
      }
    }

    const sopCardsHtml = currentItem.sop.map((step, idx) => {
      const isActive = idx === currentItem.currentStepIndex;
      const isDone = idx < currentItem.currentStepIndex;
      const timestampLog = currentItem.stepTimestamps.find(l => l.stepId === step.stepId);

      let stepStatusClass = '';
      if (isDone) stepStatusClass = 'completed';
      else if (isActive) stepStatusClass = 'active';

      let actionHint = step.detail;
      let timerBtnHtml = '';

      if (isActive && step.type === 'timer') {
        if (!step.timerStarted) {
          actionHint = `🎯 請注視 [${step.targetId}] 並 Pinch 手勢啟動 ${step.duration}s 計時器`;
          timerBtnHtml = `
            <button class="btn-primary" style="margin-top:6px; padding:6px 12px; font-size:0.8rem; background:linear-gradient(135deg, var(--color-warning) 0%, #ff6600 100%);" onclick="window.HUDController.triggerStepTimer('${step.targetId}')">
              🎯 模擬對焦 [${step.targetId}] + Pinch 啟動 ${step.duration}s 計時
            </button>
          `;
        } else if (!step.timerFinished) {
          actionHint = `⏳ 烹調倒數中（剩餘 ${step.timerRemaining} 秒）...`;
          timerBtnHtml = `
            <div style="margin-top:6px; font-family:var(--font-mono); font-size:1.1rem; font-weight:700; color:var(--color-warning);">
              🔥 倒數中: ${step.timerRemaining} 秒
            </div>
          `;
        } else {
          actionHint = `✅ 計時完成！`;
        }
      }

      return `
        <div class="sop-step-card ${stepStatusClass}">
          <div class="step-number">${isDone ? '✓' : (idx + 1)}</div>
          <div class="step-info">
            <div class="step-title">${step.title}</div>
            <div class="step-subtitle">${actionHint}</div>
            ${timerBtnHtml}
          </div>
          ${timestampLog ? `<span style="font-family:var(--font-mono); font-size:0.75rem; color:var(--color-success);">${timestampLog.timestamp}</span>` : ''}
        </div>
      `;
    }).join('');

    const isOrderComplete = currentItem.currentStepIndex >= currentItem.sop.length;

    let buttonStyle = 'width:100%; margin-top:8px;';
    if (isTimerBlocked) {
      buttonStyle += ' background: rgba(255, 51, 102, 0.2); border: 1px solid var(--color-danger); color: var(--color-danger); opacity: 0.8;';
    }

    container.innerHTML = `
      <div class="training-mode-view">
        <div class="compact-order-header">
          <span style="font-family:var(--font-mono); font-weight:700; color:var(--primary);">${currentOrder.orderId}</span>
          <span class="sla-countdown" id="hud-sla-timer" style="font-size:1.2rem;">${timeStr}</span>
        </div>

        <div class="compact-item-title">${currentItem.icon} ${currentItem.name}</div>

        ${customBannerHtml}

        <div style="font-size:0.8rem; font-weight:700; color:var(--text-muted); margin-top:4px;">
          🎓 實習培訓 & 考核步驟 SOP (Step ${Math.min(currentItem.currentStepIndex + 1, currentItem.sop.length)} / ${currentItem.sop.length})
        </div>

        <div class="sop-step-list">
          ${sopCardsHtml}
        </div>

        ${!isOrderComplete ? `
          <button class="btn-primary" style="${buttonStyle}" onclick="window.HUDController.advanceSOPStep()">
            ${timerStatusText}
          </button>
        ` : `
          <div style="text-align:center; padding:12px; background:rgba(0,230,118,0.15); color:var(--color-success); border-radius:12px; font-weight:700;">
            🎉 此餐點已完成品質覆核並成功交付！
          </div>
        `}
      </div>
    `;
  }

  function playBeep(freq, duration) {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.value = freq;
      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      gain.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + duration);
      osc.stop(ctx.currentTime + duration);
    } catch(e) {}
  }

  function playNotificationSound() { playBeep(880, 0.3); }
  function playTimerStartSound() { playBeep(587.33, 0.2); }
  function playSuccessBeep() { playBeep(1046.5, 0.4); }

  function showWarningToast(msg) {
    const container = document.getElementById('hud-view-panel');
    if (!container) return;

    let toast = container.querySelector('.hud-toast-warning');
    if (toast) toast.remove();

    toast = document.createElement('div');
    toast.className = 'hud-toast-warning';
    toast.innerHTML = `<span>${msg}</span>`;
    container.appendChild(toast);

    playBeep(300, 0.25);

    setTimeout(function() {
      if (toast && toast.parentElement) {
        toast.remove();
      }
    }, 2500);
  }

  return {
    init: init,
    setMode: setMode,
    advanceSOPStep: advanceSOPStep,
    triggerStepTimer: triggerStepTimer,
    syncOrderFromDB: syncOrderFromDB,
    showWarningToast: showWarningToast
  };
})();

// Explicit Window Export
window.HUDController = HUDController;

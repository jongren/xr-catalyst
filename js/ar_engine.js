/* ==========================================================================
   XR Catalyst - AR Engine & Spatial Target Tracking (`js/ar_engine.js`)
   WebXR Camera View Backdrop, Marker Recognition Engine & Reticle Cursor
   ========================================================================== */

const AREngine = (function() {
  'use strict';

  let canvas, ctx;
  let animFrameId = null;
  let isRunning = false;
  let lastFrameTime = performance.now();

  const targets = {
    toaster_target: { id: 'toaster_target', name: '烤麵包機 (Toaster)', x: 0.3, y: 0.5, size: 120, detected: false, color: '#00e5ff' },
    patty_grill_target: { id: 'patty_grill_target', name: '肉餅煎台 (Patty Grill)', x: 0.5, y: 0.5, size: 120, detected: false, color: '#ff3366' },
    beverage_target: { id: 'beverage_target', name: '萃茶/咖啡機 (Beverage)', x: 0.7, y: 0.5, size: 120, detected: false, color: '#7c4dff' }
  };

  const reticle = { x: 0.5, y: 0.5, isPinched: false };
  let activeSpatialTimers = [];

  function init(canvasElement) {
    canvas = canvasElement;
    if (!canvas) return;
    ctx = canvas.getContext('2d');

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    setupMouseGazeListeners();
  }

  function resizeCanvas() {
    if (!canvas) return;
    canvas.width = canvas.parentElement ? canvas.parentElement.clientWidth : window.innerWidth;
    canvas.height = canvas.parentElement ? canvas.parentElement.clientHeight : window.innerHeight;
  }

  function setupMouseGazeListeners() {
    if (!canvas) return;
    const hudContainer = document.getElementById('hud-view-panel');
    if (!hudContainer) return;

    hudContainer.addEventListener('mousemove', function(e) {
      const rect = canvas.getBoundingClientRect();
      reticle.x = (e.clientX - rect.left) / (rect.width || 1);
      reticle.y = (e.clientY - rect.top) / (rect.height || 1);
    });

    hudContainer.addEventListener('mousedown', function() {
      reticle.isPinched = true;
      triggerPinchAction();
    });

    hudContainer.addEventListener('mouseup', function() {
      reticle.isPinched = false;
    });
  }

  function start() {
    if (isRunning) return;
    isRunning = true;
    lastFrameTime = performance.now();
    animFrameId = requestAnimationFrame(loop);
  }

  function stop() {
    isRunning = false;
    if (animFrameId) {
      cancelAnimationFrame(animFrameId);
      animFrameId = null;
    }
  }

  function loop() {
    if (!isRunning) return;
    const now = performance.now();
    const dt = Math.min((now - lastFrameTime) / 1000, 0.1); // Real-world delta time in seconds
    lastFrameTime = now;

    update(dt);
    render();
    animFrameId = requestAnimationFrame(loop);
  }

  function update(dt) {
    if (!canvas) return;
    const reticlePxX = reticle.x * canvas.width;
    const reticlePxY = reticle.y * canvas.height;

    Object.values(targets).forEach(target => {
      const tx = target.x * canvas.width;
      const ty = target.y * canvas.height;
      const dist = Math.hypot(reticlePxX - tx, reticlePxY - ty);
      target.detected = dist < (target.size / 2 + 20);
    });

    // Update active spatial timers using real delta time
    activeSpatialTimers.forEach(timer => {
      if (timer.remaining > 0) {
        timer.remaining -= dt;
        if (timer.remaining < 0) timer.remaining = 0;
      }
    });
  }

  function render() {
    if (!ctx || !canvas) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    drawKitchenBackdrop();

    Object.values(targets).forEach(target => {
      const tx = target.x * canvas.width;
      const ty = target.y * canvas.height;

      ctx.save();
      ctx.strokeStyle = target.detected ? '#00e676' : target.color;
      ctx.lineWidth = target.detected ? 4 : 2;
      if (!target.detected && ctx.setLineDash) ctx.setLineDash([6, 4]);

      ctx.strokeRect(tx - target.size/2, ty - target.size/2, target.size, target.size);

      ctx.fillStyle = target.detected ? '#00e676' : target.color;
      ctx.font = '600 12px Outfit, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(target.name, tx, ty - target.size/2 - 10);
      ctx.restore();

      const spatialTimer = activeSpatialTimers.find(t => t.targetId === target.id);
      if (spatialTimer) {
        drawSpatialTimerOverlay(tx, ty - target.size/2 - 40, spatialTimer);
      }
    });

    drawReticle();
  }

  function drawKitchenBackdrop() {
    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = 'rgba(0, 229, 255, 0.04)';
    ctx.lineWidth = 1;
    const step = 40;
    for (let x = 0; x < canvas.width; x += step) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += step) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
    }
    ctx.restore();
  }

  function drawSpatialTimerOverlay(x, y, spatialTimer) {
    ctx.save();
    const sec = Math.ceil(spatialTimer.remaining);
    const progress = spatialTimer.remaining / (spatialTimer.total || 1);

    const cardW = 160;
    const cardH = 70;
    const rx = x - cardW/2;
    const ry = y - cardH;

    ctx.fillStyle = 'rgba(8, 14, 26, 0.95)';
    ctx.strokeStyle = sec === 0 ? '#00e676' : (sec <= 5 ? '#ff3366' : '#00e5ff');
    ctx.lineWidth = 2;

    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(rx, ry, cardW, cardH, 12);
    } else {
      ctx.rect(rx, ry, cardW, cardH);
    }
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = sec <= 5 ? '#ff3366' : '#00e5ff';
    ctx.fillRect(rx + 8, ry + cardH - 12, (cardW - 16) * Math.max(0, Math.min(1, progress)), 4);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${sec}s`, x, ry + 36);

    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = '11px Outfit, sans-serif';
    ctx.fillText(spatialTimer.label || 'SOP 計時中', x, ry + 18);

    ctx.restore();
  }

  function drawReticle() {
    const rx = reticle.x * canvas.width;
    const ry = reticle.y * canvas.height;

    ctx.save();
    ctx.strokeStyle = reticle.isPinched ? '#ffffff' : '#00e5ff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(rx, ry, reticle.isPinched ? 10 : 18, 0, Math.PI * 2);
    ctx.stroke();

    if (reticle.isPinched) {
      ctx.fillStyle = '#00e5ff';
      ctx.beginPath();
      ctx.arc(rx, ry, 6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function triggerPinchAction() {
    const detectedTarget = Object.values(targets).find(t => t.detected);
    if (detectedTarget && window.EventBus) {
      window.EventBus.emit('GESTURE_TARGET_PINCHED', detectedTarget.id);
    }
  }

  function addSpatialTimer(targetId, durationSeconds, labelText) {
    activeSpatialTimers = activeSpatialTimers.filter(t => t.targetId !== targetId);
    activeSpatialTimers.push({
      targetId: targetId,
      total: durationSeconds,
      remaining: durationSeconds,
      label: labelText
    });
  }

  return {
    init: init,
    start: start,
    stop: stop,
    addSpatialTimer: addSpatialTimer
  };
})();

// Explicit Window Export
window.AREngine = AREngine;

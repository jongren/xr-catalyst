/* ==========================================================================
   XR Catalyst - Main Application Entry Point & EventBus (`js/app.js`)
   ========================================================================== */

// Immediately check URL parameters for Dedicated AR Glasses HUD Mode
(function checkDedicatedHudMode() {
  const href = (window.location.href || '').toLowerCase();
  if (href.includes('mode=hud') || href.includes('mode-hud') || href.includes('hud=1')) {
    if (document.documentElement) {
      document.documentElement.classList.add('hud-dedicated-mode');
    }
    if (document.body) {
      document.body.classList.add('hud-dedicated-mode');
    } else {
      document.addEventListener('DOMContentLoaded', function() {
        if (document.body) document.body.classList.add('hud-dedicated-mode');
      });
    }
  }
})();

// Lightweight EventBus for decoupling POS, AR Engine, and HUD Controllers
window.EventBus = (function() {
  const listeners = {};
  return {
    on: function(event, callback) {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(callback);
    },
    emit: function(event, data) {
      if (listeners[event]) {
        listeners[event].forEach(cb => cb(data));
      }
    }
  };
})();

function initializeApp() {
  'use strict';

  const href = (window.location.href || '').toLowerCase();
  const isHudMode = href.includes('mode=hud') || href.includes('mode-hud') || href.includes('hud=1');

  if (isHudMode) {
    document.documentElement.classList.add('hud-dedicated-mode');
    if (document.body) document.body.classList.add('hud-dedicated-mode');
  }

  // Initialize DB Data Access Layer
  if (window.DB) {
    window.DB.init();
  }

  // Initialize POS Controller
  if (window.POSController) {
    window.POSController.init();
  }

  // Initialize HUD Controller
  if (window.HUDController) {
    window.HUDController.init();
  }

  // Initialize AR Engine with Canvas
  const arCanvas = document.getElementById('ar-canvas');
  if (window.AREngine && arCanvas) {
    window.AREngine.init(arCanvas);
    window.AREngine.start();
  }

  // Setup Viewport Navigation Tabs
  const tabPos = document.getElementById('tab-pos');
  const tabHud = document.getElementById('tab-hud');
  const panelPos = document.getElementById('pos-view-panel');
  const panelHud = document.getElementById('hud-view-panel');

  if (tabPos && tabHud && panelPos && panelHud) {
    tabPos.addEventListener('click', function() {
      tabPos.classList.add('active');
      tabHud.classList.remove('active');
      panelPos.classList.add('active');
      panelHud.classList.remove('active');
    });

    tabHud.addEventListener('click', function() {
      tabHud.classList.add('active');
      tabPos.classList.remove('active');
      panelHud.classList.add('active');
      panelPos.classList.remove('active');

      if (window.AREngine) {
        window.AREngine.start();
        // Force canvas to resize after panel becomes visible
        setTimeout(() => window.dispatchEvent(new Event('resize')), 100);
      }
    });

    if (isHudMode) {
      tabHud.click();
    }
  }

  console.log('🚀 XR Catalyst App initialized!');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}

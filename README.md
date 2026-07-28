# 🕶️ XR 催化者計劃：Xreal AR 智慧餐飲廚房與出餐管理助理 (Xreal Aura & Air 2 Ultra F&B Smart Kitchen)

本專案為 **XR 催化者計劃 (XR Catalyst Program)** 示範專案，專為餐飲銷售與廚房備餐量身打造，旨在運用 **Xreal Aura / Air 2 Ultra 擴增實境眼鏡** 的視場角與圖像追蹤 (Image Target Tracking) 技術，協助店家控制接單、製作到交付的每個節點時間與正確率，讓新人在實習階段亦能維繫高品質高標準交付。

---

## 🌟 核心功能亮點 (Key Features)

1. **前台 POS 點餐與實時派單**：
   - 提供直觀的點餐介面，包含經典漢堡、現烤吐司與特調飲品品項。
   - 支援靈活的**客製化需求選項**（如：去生菜、去美買滋、去冰、加起司等）。
   - 下單後透過 HTTP/WebSocket 實時跨裝置發送至 AR 眼鏡端。

2. **Xreal AR 眼鏡端雙 UI 視野模式 (Dual HUD Modes)**：
   - **⚡ 簡易出餐模式 (Compact Express Mode)**：適合熟練員工。僅高亮顯示「餐點名稱」、「紅字醒目客製警告 Banner」與「SLA 出餐總倒數計時器」。
   - **🎓 教育訓練與考核模式 (Detailed Training & Audit Mode)**：適合實習新人。展開完整的 SOP 製作步驟，需按順序執行，並**自動記錄每個階段節點的完成時間戳記 (Timestamps)**。

3. **實體與畫面 AR 圖像追蹤 (Image Target Tracking + Timers)**：
   - 將傳統麥當勞式實體 8 通道計時器搬到虛擬視界中。
   - **防誤觸機制**：注視設備標籤 (Image Target) 並且搭配**官方標準手勢 (Pinch pinch/tap 手勢)**，雙重確認後才會啟動 20s/30s/45s 3D 浮動倒數計時器。
   - 平板 POS 畫面底部內建**動態待追蹤影像 (On-Screen Markers)**，亦可直接使用眼鏡掃描平板螢幕進行追蹤。

4. **時間戳記與實習考核監控看板 (Live Audit Dashboard)**：
   - 於 POS 右側提供實時廚房看板，記錄實習生在各 SOP 節點的精確完成時間，方便導師評估並優化出餐瓶頸。

---

## 🛠️ 技術架構與硬體適配 (Technology Stack & Hardware Topology)

- **開發語言與框架**：HTML5, Modern CSS3 (Glassmorphism & Responsive Tokens), Vanilla JS (ES6+), WebXR / WebGL Canvas 2D/3D Engine, Python 3 Server.
- **硬體驗證組合**：
  - **前台 / 控制端**：PC / Mac / Android 平板電腦（運行 POS 端網頁）。
  - **眼鏡端**：Xreal Air 2 Ultra + Beam Pro 手機（目前現有設備驗證），架構完全相容未來 **Xreal Aura (Android XR 系統)** 的 WebXR / Web Engine 部署。

---

## 🌐 雲端服務與眼鏡端網址 (Cloud Deployment & Dedicated URLs)

本專案支援部署至 **Render.com** (或 Google Cloud Run) 免費 HTTPS 伺服器，滿足 Android / WebXR 鏡頭權限要求。

### 📱 雙端專用存取網址 (Dedicated Endpoints)

假設您的 Render 部署網址為 `https://xr-catalyst.onrender.com`：

| 裝置端 (Device Target) | 專用網址 URL | 用途與說明 |
| :--- | :--- | :--- |
| 💻 **前台 POS / 平板電腦** | `https://xr-catalyst.onrender.com/` | 用於收銀點餐、查看實時考核看板，以及提供畫面待追蹤圖像標籤。 |
| 🥽 **Xreal AR 眼鏡 / Beam Pro** | `https://xr-catalyst.onrender.com/?mode=hud` | **眼鏡專用模式網址**：開啟後自動隱藏 POS 介面，直接進入全螢幕透視 AR HUD 視界與相機追蹤模式。 |

> 💡 **提示**：在 Beam Pro 或 Android XR 眼鏡的瀏覽器中，可以直接將 `https://xr-catalyst.onrender.com/?mode=hud` 儲存為書籤或桌面捷徑，一鍵開啟 AR 眼鏡 HUD！

---

## 🚀 本地快速啟動與測試 (Local Development)

### 1. 啟動跨裝置同步伺服器 (Local Server)
```bash
python3 server.py
```

- **電腦 (POS 控制端)**：開啟 `http://localhost:8080`
- **眼鏡 (Beam Pro / AR HUD 端)**：開啟 `http://<您的電腦IP>:8080/?mode=hud`

### 2. 操作示範流程 (Demo Walkthrough)

1. **POS 點餐**：
   - 點選「經典雙層牛肉堡」，並點擊「⚙️ 客製化要求」勾選 `⚠️ 去生菜 (No Lettuce)`。
   - 點擊「🚀 送出訂單至 AR 眼鏡」。
2. **切換至眼鏡視界**：
   - 使用眼鏡瀏覽器開啟 `?mode=hud` 專用網址，或點擊頂部導覽列「🥽 Xreal AR 眼鏡出餐 HUD 視界」。
   - 觀察 HUD 上跳出的醒目紅色客製化 Alert Banner `⚠️ 漢堡：去生菜`。
3. **圖像追蹤與手勢計時**：
   - 移動視線注視畫面中央的標籤，或點擊「👉 執行 / 確定完成目前步驟」按鈕。
   - 當 SOP 進入計時步驟時，注視對應的設備標籤 (Patty / Toaster Target)，點擊 Pinch 手勢啟動空間 3D 倒數計時器。
4. **實習考核時間戳記**：
   - 切換回「🛒 前台 POS 點餐與實習考核看板」，觀察右側看板中記錄的 Step 1, Step 2, Step 3 具體完成時間戳記。

---

## 📄 專案目錄結構 (Project Directory)

```
/Users/S020019/StudioProjects/XR Catalyst /
├── README.md                          # 專案說明與操作指南
├── index.html                         # 系統主入口 (包含 POS 前台與 眼鏡 AR HUD 模式)
├── server.py                          # 實時跨裝置同步與 API 伺服器 (相容 Render 部署)
├── requirements.txt                   # Render / Cloud 部署依賴說明檔
├── orders_db.json                     # 訂單持久化儲存檔案
├── css/
│   ├── main.css                       # 全局 UI 視覺設計系統
│   ├── pos.css                        # POS 前台點餐與實施進度看板樣式
│   └── hud.css                        # 眼鏡端 AR 疊加與 HUD 雙模式樣式
└── js/
    ├── app.js                         # 主程序控制器與 Event Sync Bus
    ├── db.js                          # 可擴充菜單與訂單 Data Access Layer (DAL)
    ├── pos.js                         # POS 前台點餐與動態標籤生成邏輯
    ├── ar_engine.js                   # WebXR Image Target 追蹤與 3D 浮動計時器渲染
    └── hud_controller.js              # 雙 UI 模式、順序 SOP 控管與時間戳記記錄
```

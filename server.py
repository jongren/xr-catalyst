# ==========================================================================
# XR Catalyst - Cross-Device Real-Time Sync Server (`server.py`)
# Serves static web app + provides real-time HTTP Sync APIs for PC & Glasses
# Includes Disk Persistence (orders_db.json) for 100% Reliability
# ==========================================================================

import http.server
import socketserver
import json
import urllib.parse
import os
import socket

PORT = int(os.environ.get('PORT', 8080))
DB_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'orders_db.json')

active_orders = []
completed_orders = []

def load_db_from_disk():
    global active_orders, completed_orders
    if os.path.exists(DB_FILE):
        try:
            with open(DB_FILE, 'r', encoding='utf-8') as f:
                data = json.load(f)
                active_orders = data.get('activeOrders', [])
                completed_orders = data.get('completedOrders', [])
                print(f"📦 Loaded {len(active_orders)} active orders and {len(completed_orders)} completed orders from disk.")
        except Exception as e:
            print(f"⚠️ Error loading disk DB: {e}")

def save_db_to_disk():
    try:
        data = {
            'activeOrders': active_orders,
            'completedOrders': completed_orders
        }
        with open(DB_FILE, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"⚠️ Error saving disk DB: {e}")

class XRCatalystSyncHandler(http.server.SimpleHTTPRequestHandler):
    def translate_path(self, path):
        return super().translate_path(path)

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == '/api/sync':
            self._send_json({
                'activeOrders': active_orders,
                'completedOrders': completed_orders
            })
        else:
            super().do_GET()

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        content_length = int(self.headers.get('Content-Length', 0))
        post_data = self.rfile.read(content_length) if content_length > 0 else b'{}'
        
        try:
            body = json.loads(post_data.decode('utf-8'))
        except Exception:
            body = {}

        if parsed.path == '/api/orders/create':
            order = body.get('order')
            if order:
                # Avoid duplicate orders by orderId
                existing = next((o for o in active_orders if o.get('orderId') == order.get('orderId')), None)
                if not existing:
                    active_orders.append(order)
                    save_db_to_disk()
            self._send_json({'success': True, 'order': order})

        elif parsed.path == '/api/orders/step':
            order_id = body.get('orderId')
            item_index = body.get('itemIndex', 0)
            step_id = body.get('stepId')
            step_title = body.get('stepTitle')
            timestamp = body.get('timestamp')

            for order in active_orders:
                if order.get('orderId') == order_id:
                    items = order.get('items', [])
                    if item_index < len(items):
                        item = items[item_index]
                        if 'stepTimestamps' not in item:
                            item['stepTimestamps'] = []
                        
                        # Avoid duplicate step logs
                        if not any(l.get('stepId') == step_id for l in item['stepTimestamps']):
                            item['stepTimestamps'].append({
                                'stepId': step_id,
                                'title': step_title,
                                'timestamp': timestamp
                            })
                            item['currentStepIndex'] = item.get('currentStepIndex', 0) + 1
                        
                        if item['currentStepIndex'] >= len(item.get('sop', [])):
                            if order in active_orders:
                                active_orders.remove(order)
                            order['completedAt'] = timestamp
                            order['status'] = 'completed'
                            if not any(o.get('orderId') == order_id for o in completed_orders):
                                completed_orders.insert(0, order)
                    break

            save_db_to_disk()
            self._send_json({'success': True})

        elif parsed.path == '/api/orders/clear':
            active_orders.clear()
            completed_orders.clear()
            save_db_to_disk()
            self._send_json({'success': True})

        else:
            self.send_error(404, "API Endpoint Not Found")

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def _send_json(self, obj):
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Cache-Control', 'no-cache')
        self.end_headers()
        self.wfile.write(json.dumps(obj).encode('utf-8'))

def get_local_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(('8.8.8.8', 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return 'localhost'

if __name__ == '__main__':
    load_db_from_disk()
    socketserver.TCPServer.allow_reuse_address = True
    local_ip = get_local_ip()
    print(f"============================================================")
    print(f"🚀 XR Catalyst Cross-Device Real-Time Sync Server Running!")
    print(f"👉 Computer (POS View): http://localhost:{PORT}")
    print(f"👉 Tablet (AR Glasses View): http://{local_ip}:{PORT}/?mode=hud")
    print(f"============================================================")
    
    with socketserver.TCPServer(("", PORT), XRCatalystSyncHandler) as httpd:
        httpd.serve_forever()

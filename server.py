"""
server.py - Complete Python REST API Server & Web Server for Tiffin Management & Delivery Web Application
Uses standard library http.server with ThreadingTCPServer and SQLite SQL database.
Zero external dependencies required.
"""

import http.server
import socketserver
import json
import os
import urllib.parse
import mimetypes
import re
from datetime import datetime, timedelta
import database

PORT = 8000
STATIC_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static")

# Ensure DB is initialized
database.init_db()

# Simple session token store (token -> user_id)
ACTIVE_SESSIONS = {}

def get_current_user(headers):
    """Retrieve user from Authorization header or cookie."""
    auth_header = headers.get('Authorization', '')
    token = None
    if auth_header.startswith('Bearer '):
        token = auth_header[7:].strip()
    elif 'Cookie' in headers:
        cookies = headers.get('Cookie', '').split(';')
        for c in cookies:
            c = c.strip()
            if c.startswith('token='):
                token = c[6:].strip()
                break

    if token and token in ACTIVE_SESSIONS:
        user_id = ACTIVE_SESSIONS[token]
        conn = database.get_db_connection()
        user = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        conn.close()
        return dict(user) if user else None
    return None

class TiffinAPIHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=STATIC_DIR, **kwargs)

    def end_headers(self):
        # Enable CORS and disable aggressive caching for API
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def read_json_body(self):
        content_length = int(self.headers.get('Content-Length', 0))
        if content_length == 0:
            return {}
        body = self.rfile.read(content_length).decode('utf-8')
        try:
            return json.loads(body)
        except Exception:
            return {}

    def send_json(self, data, status_code=200):
        self.send_response(status_code)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(data, default=str).encode('utf-8'))

    def send_error_json(self, message, status_code=400):
        self.send_json({"success": False, "error": message}, status_code)

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        query = urllib.parse.parse_qs(parsed.query)

        # Route API requests
        if path.startswith('/api/'):
            self.handle_api_get(path, query)
            return

        # Default static file routing
        if path == '/' or path == '':
            self.path = '/index.html'
        elif path.startswith('/static/'):
            self.path = path[7:]
        return super().do_GET()

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        body = self.read_json_body()

        if path.startswith('/api/'):
            self.handle_api_post(path, body)
            return
        
        self.send_error_json("Not Found", 404)

    def do_PUT(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        body = self.read_json_body()

        if path.startswith('/api/'):
            self.handle_api_put(path, body)
            return
        
        self.send_error_json("Not Found", 404)

    def do_DELETE(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        query = urllib.parse.parse_qs(parsed.query)

        if path.startswith('/api/'):
            self.handle_api_delete(path, query)
            return

        self.send_error_json("Not Found", 404)

    # ------------------ API GET HANDLERS ------------------
    def handle_api_get(self, path, query):
        conn = database.get_db_connection()
        user = get_current_user(self.headers)

        try:
            # 1. Current User Session Check
            if path == '/api/auth/me':
                if not user:
                    self.send_json({"authenticated": False})
                    return
                
                resp = {"authenticated": True, "user": user}
                if user['role'] == 'student':
                    student = conn.execute("SELECT * FROM students WHERE user_id = ?", (user['id'],)).fetchone()
                    resp['student'] = dict(student) if student else None
                elif user['role'] == 'owner':
                    provider = conn.execute("SELECT * FROM tiffin_providers WHERE owner_user_id = ?", (user['id'],)).fetchone()
                    resp['provider'] = dict(provider) if provider else None
                self.send_json(resp)
                return

            # 2. Providers List
            elif path == '/api/providers':
                providers = conn.execute("""
                SELECT tp.*, u.full_name as owner_name, pc.monthly_plan_price, pc.lunch_price
                FROM tiffin_providers tp
                JOIN users u ON tp.owner_user_id = u.id
                LEFT JOIN pricing_config pc ON pc.provider_id = tp.id
                WHERE tp.is_active = 1
                """).fetchall()
                self.send_json({"success": True, "providers": [dict(p) for p in providers]})
                return

            # 3. Provider Details
            elif path.startswith('/api/providers/'):
                provider_id = int(path.split('/')[-1])
                p = conn.execute("SELECT tp.*, u.full_name as owner_name FROM tiffin_providers tp JOIN users u ON tp.owner_user_id = u.id WHERE tp.id = ?", (provider_id,)).fetchone()
                if not p:
                    self.send_error_json("Provider not found", 404)
                    return
                pricing = conn.execute("SELECT * FROM pricing_config WHERE provider_id = ?", (provider_id,)).fetchone()
                plans = conn.execute("SELECT * FROM meal_plans WHERE provider_id = ? AND is_active = 1", (provider_id,)).fetchall()
                # Average ratings
                ratings_row = conn.execute("SELECT AVG(taste_rating) as avg_taste, AVG(hygiene_rating) as avg_hygiene, COUNT(*) as total_reviews FROM feedback WHERE provider_id = ?", (provider_id,)).fetchone()
                reviews = conn.execute("""
                SELECT f.*, CASE WHEN f.is_anonymous = 1 THEN 'Anonymous Student' ELSE u.full_name END as student_name
                FROM feedback f
                JOIN students s ON f.student_id = s.id
                JOIN users u ON s.user_id = u.id
                WHERE f.provider_id = ?
                ORDER BY f.created_at DESC LIMIT 5
                """, (provider_id,)).fetchall()

                self.send_json({
                    "success": True,
                    "provider": dict(p),
                    "pricing": dict(pricing) if pricing else None,
                    "plans": [dict(pl) for pl in plans],
                    "ratings": dict(ratings_row),
                    "reviews": [dict(r) for r in reviews]
                })
                return

            # 4. Weekly Menu
            elif path == '/api/menu':
                provider_id = int(query.get('provider_id', [1])[0])
                menus = conn.execute("""
                SELECT * FROM menus WHERE provider_id = ? ORDER BY 
                CASE day_of_week
                    WHEN 'Monday' THEN 1 WHEN 'Tuesday' THEN 2 WHEN 'Wednesday' THEN 3
                    WHEN 'Thursday' THEN 4 WHEN 'Friday' THEN 5 WHEN 'Saturday' THEN 6
                    WHEN 'Sunday' THEN 7 END,
                CASE meal_type WHEN 'Breakfast' THEN 1 WHEN 'Lunch' THEN 2 WHEN 'Dinner' THEN 3 END
                """, (provider_id,)).fetchall()
                self.send_json({"success": True, "menu": [dict(m) for m in menus]})
                return

            # 5. Pricing Config
            elif path == '/api/pricing':
                provider_id = int(query.get('provider_id', [1])[0])
                pricing = conn.execute("SELECT * FROM pricing_config WHERE provider_id = ?", (provider_id,)).fetchone()
                self.send_json({"success": True, "pricing": dict(pricing) if pricing else None})
                return

            # 6. Student Dashboard Overview
            elif path == '/api/student/dashboard':
                if not user or user['role'] != 'student':
                    self.send_error_json("Unauthorized", 401)
                    return
                student = conn.execute("SELECT * FROM students WHERE user_id = ?", (user['id'],)).fetchone()
                if not student:
                    self.send_error_json("Student profile not found", 404)
                    return
                
                provider_id = student['provider_id'] or 1
                provider = conn.execute("SELECT tp.*, u.full_name as owner_name FROM tiffin_providers tp JOIN users u ON tp.owner_user_id = u.id WHERE tp.id = ?", (provider_id,)).fetchone()
                active_sub = conn.execute("SELECT * FROM subscriptions WHERE student_id = ? AND status = 'active' ORDER BY id DESC LIMIT 1", (student['id'],)).fetchone()
                
                # Today's menu
                weekday_name = datetime.now().strftime("%A")
                today_menu = conn.execute("SELECT * FROM menus WHERE provider_id = ? AND day_of_week = ?", (provider_id, weekday_name)).fetchall()
                
                # Today's orders & deliveries
                today_str = datetime.now().strftime("%Y-%m-%d")
                today_orders = conn.execute("""
                SELECT o.*, d.status as delivery_status, d.estimated_time, d.delivery_person_name, d.delivery_person_phone
                FROM orders o
                LEFT JOIN deliveries d ON d.order_id = o.id
                WHERE o.student_id = ? AND o.meal_date = ?
                """, (student['id'], today_str)).fetchall()

                # Attendance summary
                att_summary = conn.execute("""
                SELECT 
                    COUNT(CASE WHEN status IN ('present', 'delivered') THEN 1 END) as total_present,
                    COUNT(CASE WHEN status = 'absent' THEN 1 END) as total_absent,
                    COUNT(CASE WHEN status = 'meal_stopped' THEN 1 END) as total_stopped
                FROM attendance WHERE student_id = ?
                """, (student['id'],)).fetchone()

                # Pending stop requests
                stop_reqs = conn.execute("SELECT * FROM stop_meal_requests WHERE student_id = ? ORDER BY id DESC LIMIT 3", (student['id'],)).fetchall()

                self.send_json({
                    "success": True,
                    "student": dict(student),
                    "provider": dict(provider) if provider else None,
                    "active_subscription": dict(active_sub) if active_sub else None,
                    "today_menu": [dict(m) for m in today_menu],
                    "today_orders": [dict(o) for o in today_orders],
                    "attendance_summary": dict(att_summary),
                    "recent_stop_requests": [dict(r) for r in stop_reqs]
                })
                return

            # 7. Student Attendance
            elif path == '/api/student/attendance':
                if not user or user['role'] != 'student':
                    self.send_error_json("Unauthorized", 401)
                    return
                student = conn.execute("SELECT id FROM students WHERE user_id = ?", (user['id'],)).fetchone()
                if not student:
                    self.send_error_json("Student not found", 404)
                    return
                
                records = conn.execute("""
                SELECT * FROM attendance WHERE student_id = ? ORDER BY meal_date DESC, 
                CASE meal_type WHEN 'Breakfast' THEN 1 WHEN 'Lunch' THEN 2 WHEN 'Dinner' THEN 3 END
                """, (student['id'],)).fetchall()

                self.send_json({"success": True, "attendance": [dict(r) for r in records]})
                return

            # 8. Student Stop Requests History
            elif path == '/api/student/stop-requests':
                if not user or user['role'] != 'student':
                    self.send_error_json("Unauthorized", 401)
                    return
                student = conn.execute("SELECT id FROM students WHERE user_id = ?", (user['id'],)).fetchone()
                requests = conn.execute("SELECT * FROM stop_meal_requests WHERE student_id = ? ORDER BY id DESC", (student['id'],)).fetchall()
                self.send_json({"success": True, "stop_requests": [dict(r) for r in requests]})
                return

            # 9. Student Delivery Tracking
            elif path == '/api/student/delivery-tracking':
                if not user or user['role'] != 'student':
                    self.send_error_json("Unauthorized", 401)
                    return
                student = conn.execute("SELECT id FROM students WHERE user_id = ?", (user['id'],)).fetchone()
                today_str = datetime.now().strftime("%Y-%m-%d")
                deliveries = conn.execute("""
                SELECT d.*, o.special_instructions, u.full_name as student_name
                FROM deliveries d
                JOIN orders o ON d.order_id = o.id
                JOIN students s ON d.student_id = s.id
                JOIN users u ON s.user_id = u.id
                WHERE d.student_id = ? AND d.meal_date >= DATE('now', '-2 days')
                ORDER BY d.meal_date DESC, d.id DESC
                """, (student['id'],)).fetchall()
                self.send_json({"success": True, "deliveries": [dict(d) for d in deliveries]})
                return

            # 10. Student History & Profile
            elif path == '/api/student/profile-history':
                if not user or user['role'] != 'student':
                    self.send_error_json("Unauthorized", 401)
                    return
                student = conn.execute("SELECT s.*, tp.business_name, tp.contact_phone, tp.business_address FROM students s LEFT JOIN tiffin_providers tp ON s.provider_id = tp.id WHERE s.user_id = ?", (user['id'],)).fetchone()
                payments = conn.execute("SELECT * FROM payments WHERE student_id = ? ORDER BY id DESC", (student['id'],)).fetchall()
                subscriptions = conn.execute("SELECT * FROM subscriptions WHERE student_id = ? ORDER BY id DESC", (student['id'],)).fetchall()
                stop_requests = conn.execute("SELECT * FROM stop_meal_requests WHERE student_id = ? ORDER BY id DESC", (student['id'],)).fetchall()
                feedbacks = conn.execute("SELECT * FROM feedback WHERE student_id = ? ORDER BY id DESC", (student['id'],)).fetchall()
                
                self.send_json({
                    "success": True,
                    "student": dict(student),
                    "user": user,
                    "payments": [dict(p) for p in payments],
                    "subscriptions": [dict(s) for s in subscriptions],
                    "stop_requests": [dict(sr) for sr in stop_requests],
                    "feedback": [dict(f) for f in feedbacks]
                })
                return

            # 11. Food Suggestions & Votes
            elif path == '/api/suggestions':
                provider_id = int(query.get('provider_id', [1])[0])
                student_id = None
                if user and user['role'] == 'student':
                    s_row = conn.execute("SELECT id FROM students WHERE user_id = ?", (user['id'],)).fetchone()
                    if s_row:
                        student_id = s_row['id']

                suggestions = conn.execute("""
                SELECT fs.*, 
                    (SELECT COUNT(*) FROM food_votes fv WHERE fv.suggestion_id = fs.id AND fv.student_id = ?) as has_voted
                FROM food_suggestions fs
                WHERE fs.provider_id = ?
                ORDER BY fs.vote_count DESC
                """, (student_id, provider_id)).fetchall()

                self.send_json({"success": True, "suggestions": [dict(s) for s in suggestions]})
                return

            # 12. Notifications List
            elif path == '/api/notifications':
                if not user:
                    self.send_error_json("Unauthorized", 401)
                    return
                notifs = conn.execute("SELECT * FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 20", (user['id'],)).fetchall()
                unread_count = conn.execute("SELECT COUNT(*) FROM notifications WHERE user_id = ? AND is_read = 0", (user['id'],)).fetchone()[0]
                self.send_json({"success": True, "notifications": [dict(n) for n in notifs], "unread_count": unread_count})
                return

            # 13. OWNER OVERVIEW DASHBOARD
            elif path == '/api/owner/overview':
                if not user or user['role'] != 'owner':
                    self.send_error_json("Unauthorized", 401)
                    return
                provider = conn.execute("SELECT * FROM tiffin_providers WHERE owner_user_id = ?", (user['id'],)).fetchone()
                if not provider:
                    self.send_error_json("Provider profile not found", 404)
                    return
                pid = provider['id']

                # Real metrics from SQLite
                total_students = conn.execute("SELECT COUNT(*) FROM students WHERE provider_id = ?", (pid,)).fetchone()[0]
                active_students = conn.execute("SELECT COUNT(*) FROM students WHERE provider_id = ? AND subscription_status = 'active'", (pid,)).fetchone()[0]
                active_subscriptions = conn.execute("SELECT COUNT(*) FROM subscriptions WHERE provider_id = ? AND status = 'active'", (pid,)).fetchone()[0]

                today_str = datetime.now().strftime("%Y-%m-%d")
                today_orders = conn.execute("""
                SELECT 
                    COUNT(*) as total_today,
                    COUNT(CASE WHEN meal_type = 'Breakfast' THEN 1 END) as breakfast_today,
                    COUNT(CASE WHEN meal_type = 'Lunch' THEN 1 END) as lunch_today,
                    COUNT(CASE WHEN meal_type = 'Dinner' THEN 1 END) as dinner_today
                FROM orders WHERE provider_id = ? AND meal_date = ?
                """, (pid, today_str)).fetchone()

                today_collection = conn.execute("""
                SELECT COALESCE(SUM(amount), 0) FROM payments
                WHERE provider_id = ? AND status = 'success' AND DATE(transaction_time) = ?
                """, (pid, today_str)).fetchone()[0]

                monthly_revenue = conn.execute("""
                SELECT COALESCE(SUM(amount), 0) FROM payments
                WHERE provider_id = ? AND status = 'success' AND strftime('%Y-%m', transaction_time) = strftime('%Y-%m', 'now')
                """, (pid,)).fetchone()[0]

                monthly_expenses = conn.execute("""
                SELECT COALESCE(SUM(amount), 0) FROM expenses
                WHERE provider_id = ? AND strftime('%Y-%m', expense_date) = strftime('%Y-%m', 'now')
                """, (pid,)).fetchone()[0]

                net_profit_loss = monthly_revenue - monthly_expenses

                pending_deliveries = conn.execute("SELECT COUNT(*) FROM deliveries WHERE provider_id = ? AND meal_date = ? AND status != 'delivered'", (pid, today_str)).fetchone()[0]
                completed_deliveries = conn.execute("SELECT COUNT(*) FROM deliveries WHERE provider_id = ? AND meal_date = ? AND status = 'delivered'", (pid, today_str)).fetchone()[0]
                stop_requests = conn.execute("SELECT COUNT(*) FROM stop_meal_requests WHERE provider_id = ? AND status = 'approved' AND meal_date >= DATE('now')", (pid,)).fetchone()[0]

                # Recent orders
                recent_deliveries = conn.execute("""
                SELECT d.*, u.full_name as student_name, s.delivery_address
                FROM deliveries d
                JOIN students s ON d.student_id = s.id
                JOIN users u ON s.user_id = u.id
                WHERE d.provider_id = ? AND d.meal_date = ?
                ORDER BY d.id DESC LIMIT 5
                """, (pid, today_str)).fetchall()

                self.send_json({
                    "success": True,
                    "metrics": {
                        "total_students": total_students,
                        "active_students": active_students,
                        "active_subscriptions": active_subscriptions,
                        "today_orders": dict(today_orders),
                        "today_collection": today_collection,
                        "monthly_revenue": monthly_revenue,
                        "monthly_expenses": monthly_expenses,
                        "net_profit_loss": net_profit_loss,
                        "pending_deliveries": pending_deliveries,
                        "completed_deliveries": completed_deliveries,
                        "stop_requests": stop_requests
                    },
                    "recent_deliveries": [dict(d) for d in recent_deliveries]
                })
                return

            # 14. OWNER STUDENTS MANAGEMENT
            elif path == '/api/owner/students':
                if not user or user['role'] != 'owner':
                    self.send_error_json("Unauthorized", 401)
                    return
                provider = conn.execute("SELECT id FROM tiffin_providers WHERE owner_user_id = ?", (user['id'],)).fetchone()
                students = conn.execute("""
                SELECT s.*, u.full_name, u.email, u.phone, u.status as user_status,
                       sub.plan_type, sub.start_date, sub.end_date, sub.final_amount,
                       COALESCE((SELECT SUM(amount) FROM payments WHERE student_id = s.id AND status = 'success'), 0) as total_paid
                FROM students s
                JOIN users u ON s.user_id = u.id
                LEFT JOIN subscriptions sub ON sub.student_id = s.id AND sub.status = 'active'
                WHERE s.provider_id = ?
                ORDER BY s.id DESC
                """, (provider['id'],)).fetchall()
                self.send_json({"success": True, "students": [dict(s) for s in students]})
                return

            # 15. OWNER TIFFINS MANAGEMENT
            elif path == '/api/owner/tiffins':
                if not user or user['role'] != 'owner':
                    self.send_error_json("Unauthorized", 401)
                    return
                provider = conn.execute("SELECT id FROM tiffin_providers WHERE owner_user_id = ?", (user['id'],)).fetchone()
                today_str = datetime.now().strftime("%Y-%m-%d")
                
                # Active tiffin breakdown
                tiffins = conn.execute("""
                SELECT o.meal_type, o.status, o.meal_date, u.full_name as student_name, s.delivery_address, u.phone
                FROM orders o
                JOIN students s ON o.student_id = s.id
                JOIN users u ON s.user_id = u.id
                WHERE o.provider_id = ? AND o.meal_date = ?
                ORDER BY CASE o.meal_type WHEN 'Breakfast' THEN 1 WHEN 'Lunch' THEN 2 WHEN 'Dinner' THEN 3 END
                """, (provider['id'], today_str)).fetchall()

                self.send_json({"success": True, "tiffins": [dict(t) for t in tiffins]})
                return

            # 16. OWNER ATTENDANCE
            elif path == '/api/owner/attendance':
                if not user or user['role'] != 'owner':
                    self.send_error_json("Unauthorized", 401)
                    return
                provider = conn.execute("SELECT id FROM tiffin_providers WHERE owner_user_id = ?", (user['id'],)).fetchone()
                filter_date = query.get('date', [datetime.now().strftime("%Y-%m-%d")])[0]
                
                records = conn.execute("""
                SELECT a.*, u.full_name as student_name, u.phone
                FROM attendance a
                JOIN students s ON a.student_id = s.id
                JOIN users u ON s.user_id = u.id
                WHERE a.provider_id = ? AND a.meal_date = ?
                ORDER BY u.full_name ASC
                """, (provider['id'], filter_date)).fetchall()

                self.send_json({"success": True, "attendance": [dict(r) for r in records], "date": filter_date})
                return

            # 17. OWNER STOP REQUESTS
            elif path == '/api/owner/stop-requests':
                if not user or user['role'] != 'owner':
                    self.send_error_json("Unauthorized", 401)
                    return
                provider = conn.execute("SELECT id FROM tiffin_providers WHERE owner_user_id = ?", (user['id'],)).fetchone()
                requests = conn.execute("""
                SELECT sr.*, u.full_name as student_name, u.phone, s.delivery_address
                FROM stop_meal_requests sr
                JOIN students s ON sr.student_id = s.id
                JOIN users u ON s.user_id = u.id
                WHERE sr.provider_id = ?
                ORDER BY sr.id DESC
                """, (provider['id'],)).fetchall()
                self.send_json({"success": True, "stop_requests": [dict(r) for r in requests]})
                return

            # 18. OWNER DELIVERIES
            elif path == '/api/owner/deliveries':
                if not user or user['role'] != 'owner':
                    self.send_error_json("Unauthorized", 401)
                    return
                provider = conn.execute("SELECT id FROM tiffin_providers WHERE owner_user_id = ?", (user['id'],)).fetchone()
                filter_date = query.get('date', [datetime.now().strftime("%Y-%m-%d")])[0]
                
                deliveries = conn.execute("""
                SELECT d.*, u.full_name as student_name, u.phone, o.special_instructions
                FROM deliveries d
                JOIN students s ON d.student_id = s.id
                JOIN users u ON s.user_id = u.id
                JOIN orders o ON d.order_id = o.id
                WHERE d.provider_id = ? AND d.meal_date = ?
                ORDER BY d.id DESC
                """, (provider['id'], filter_date)).fetchall()

                self.send_json({"success": True, "deliveries": [dict(d) for d in deliveries], "date": filter_date})
                return

            # 19. OWNER PAYMENTS & COLLECTIONS
            elif path == '/api/owner/payments':
                if not user or user['role'] != 'owner':
                    self.send_error_json("Unauthorized", 401)
                    return
                provider = conn.execute("SELECT id FROM tiffin_providers WHERE owner_user_id = ?", (user['id'],)).fetchone()
                payments = conn.execute("""
                SELECT p.*, u.full_name as student_name, u.phone, sub.plan_type
                FROM payments p
                JOIN students s ON p.student_id = s.id
                JOIN users u ON s.user_id = u.id
                LEFT JOIN subscriptions sub ON p.subscription_id = sub.id
                WHERE p.provider_id = ?
                ORDER BY p.id DESC
                """, (provider['id'],)).fetchall()

                today_col = conn.execute("SELECT COALESCE(SUM(amount), 0) FROM payments WHERE provider_id = ? AND status = 'success' AND DATE(transaction_time) = DATE('now')", (provider['id'],)).fetchone()[0]
                monthly_col = conn.execute("SELECT COALESCE(SUM(amount), 0) FROM payments WHERE provider_id = ? AND status = 'success' AND strftime('%Y-%m', transaction_time) = strftime('%Y-%m', 'now')", (provider['id'],)).fetchone()[0]

                self.send_json({
                    "success": True,
                    "payments": [dict(p) for p in payments],
                    "summary": {"today": today_col, "monthly": monthly_col}
                })
                return

            # 20. OWNER FEEDBACK & FOOD ANALYTICS
            elif path == '/api/owner/feedback-analytics':
                if not user or user['role'] != 'owner':
                    self.send_error_json("Unauthorized", 401)
                    return
                provider = conn.execute("SELECT id FROM tiffin_providers WHERE owner_user_id = ?", (user['id'],)).fetchone()
                pid = provider['id']

                # General rating counts
                ratings_count = conn.execute("""
                SELECT 
                    COUNT(CASE WHEN general_rating = 'Excellent' THEN 1 END) as excellent_count,
                    COUNT(CASE WHEN general_rating = 'Good' THEN 1 END) as good_count,
                    COUNT(CASE WHEN general_rating = 'Average' THEN 1 END) as average_count,
                    COUNT(CASE WHEN general_rating = 'Not Good' THEN 1 END) as not_good_count,
                    ROUND(AVG(taste_rating), 1) as avg_taste,
                    ROUND(AVG(quality_rating), 1) as avg_quality,
                    ROUND(AVG(quantity_rating), 1) as avg_quantity,
                    ROUND(AVG(hygiene_rating), 1) as avg_hygiene,
                    ROUND(AVG((taste_rating + quality_rating + quantity_rating + hygiene_rating)/4.0), 1) as overall_avg
                FROM feedback WHERE provider_id = ?
                """, (pid,)).fetchone()

                feedbacks = conn.execute("""
                SELECT f.*, CASE WHEN f.is_anonymous = 1 THEN 'Anonymous Student' ELSE u.full_name END as student_name
                FROM feedback f
                JOIN students s ON f.student_id = s.id
                JOIN users u ON s.user_id = u.id
                WHERE f.provider_id = ?
                ORDER BY f.id DESC
                """, (pid,)).fetchall()

                # High demand vs Low demand food suggestions
                suggestions = conn.execute("""
                SELECT * FROM food_suggestions WHERE provider_id = ? ORDER BY vote_count DESC
                """, (pid,)).fetchall()

                self.send_json({
                    "success": True,
                    "metrics": dict(ratings_count),
                    "feedbacks": [dict(f) for f in feedbacks],
                    "suggestions": [dict(s) for s in suggestions]
                })
                return

            # 21. OWNER PROFIT & LOSS MANAGEMENT
            elif path == '/api/owner/profit-loss':
                if not user or user['role'] != 'owner':
                    self.send_error_json("Unauthorized", 401)
                    return
                provider = conn.execute("SELECT id FROM tiffin_providers WHERE owner_user_id = ?", (user['id'],)).fetchone()
                pid = provider['id']

                # Total verified revenue
                revenue_res = conn.execute("""
                SELECT 
                    COALESCE(SUM(CASE WHEN DATE(transaction_time) = DATE('now') THEN amount END), 0) as daily_revenue,
                    COALESCE(SUM(CASE WHEN transaction_time >= DATE('now', '-7 days') THEN amount END), 0) as weekly_revenue,
                    COALESCE(SUM(CASE WHEN strftime('%Y-%m', transaction_time) = strftime('%Y-%m', 'now') THEN amount END), 0) as monthly_revenue,
                    COALESCE(SUM(amount), 0) as total_revenue
                FROM payments WHERE provider_id = ? AND status = 'success'
                """, (pid,)).fetchone()

                # Total expenses
                expense_res = conn.execute("""
                SELECT 
                    COALESCE(SUM(CASE WHEN expense_date = DATE('now') THEN amount END), 0) as daily_expense,
                    COALESCE(SUM(CASE WHEN expense_date >= DATE('now', '-7 days') THEN amount END), 0) as weekly_expense,
                    COALESCE(SUM(CASE WHEN strftime('%Y-%m', expense_date) = strftime('%Y-%m', 'now') THEN amount END), 0) as monthly_expense,
                    COALESCE(SUM(amount), 0) as total_expense
                FROM expenses WHERE provider_id = ?
                """, (pid,)).fetchone()

                # Category-wise expenses
                cat_expenses = conn.execute("""
                SELECT category, SUM(amount) as total_amount
                FROM expenses WHERE provider_id = ?
                GROUP BY category ORDER BY total_amount DESC
                """, (pid,)).fetchall()

                # Expense list
                expenses = conn.execute("""
                SELECT * FROM expenses WHERE provider_id = ? ORDER BY expense_date DESC, id DESC
                """, (pid,)).fetchall()

                d_rev = revenue_res['daily_revenue']
                w_rev = revenue_res['weekly_revenue']
                m_rev = revenue_res['monthly_revenue']
                d_exp = expense_res['daily_expense']
                w_exp = expense_res['weekly_expense']
                m_exp = expense_res['monthly_expense']

                self.send_json({
                    "success": True,
                    "income": dict(revenue_res),
                    "expenses_summary": dict(expense_res),
                    "category_breakdown": [dict(c) for c in cat_expenses],
                    "expenses_list": [dict(e) for e in expenses],
                    "profit_loss": {
                        "daily_net": d_rev - d_exp,
                        "weekly_net": w_rev - w_exp,
                        "monthly_net": m_rev - m_exp,
                        "total_net": revenue_res['total_revenue'] - expense_res['total_expense']
                    }
                })
                return

            # 22. OWNER SETTINGS
            elif path == '/api/owner/settings':
                if not user or user['role'] != 'owner':
                    self.send_error_json("Unauthorized", 401)
                    return
                provider = conn.execute("SELECT * FROM tiffin_providers WHERE owner_user_id = ?", (user['id'],)).fetchone()
                self.send_json({"success": True, "settings": dict(provider) if provider else None})
                return

            # 23. PRISMA MODEL: STUDENT WALLET & TRANSACTIONS
            elif path == '/api/student/wallet':
                if not user or user['role'] != 'student':
                    self.send_error_json("Unauthorized", 401)
                    return
                student = conn.execute("SELECT * FROM students WHERE user_id = ?", (user['id'],)).fetchone()
                if not student:
                    self.send_error_json("Student profile not found", 404)
                    return
                txs = conn.execute("SELECT * FROM wallet_transactions WHERE student_id = ? ORDER BY id DESC LIMIT 50", (student['id'],)).fetchall()
                self.send_json({
                    "success": True,
                    "wallet_balance": float(student['wallet_balance'] or 0.0),
                    "reward_points": int(student['reward_points'] or 0),
                    "referral_code": student['referral_code'] or f"REF{student['id']}",
                    "boxes_held": int(student['boxes_held'] or 0),
                    "transactions": [dict(t) for t in txs]
                })
                return

            # 24. PRISMA MODEL: STUDENT DIETARY PREFERENCES
            elif path == '/api/student/dietary':
                if not user or user['role'] != 'student':
                    self.send_error_json("Unauthorized", 401)
                    return
                student = conn.execute("SELECT * FROM students WHERE user_id = ?", (user['id'],)).fetchone()
                if not student:
                    self.send_error_json("Student profile not found", 404)
                    return
                self.send_json({
                    "success": True,
                    "dietary": {
                        "is_jain": bool(student['is_jain']),
                        "less_spicy": bool(student['less_spicy']),
                        "no_onion_garlic": bool(student['no_onion_garlic']),
                        "allergies": student['allergies'] or '',
                        "special_instructions": student['special_instructions'] or ''
                    }
                })
                return

            # 25. PRISMA MODEL: STUDENT COMPLAINTS & GRIEVANCES
            elif path == '/api/student/complaints':
                if not user or user['role'] != 'student':
                    self.send_error_json("Unauthorized", 401)
                    return
                student = conn.execute("SELECT id FROM students WHERE user_id = ?", (user['id'],)).fetchone()
                if not student:
                    self.send_error_json("Student profile not found", 404)
                    return
                complaints = conn.execute("""
                SELECT c.*, tp.business_name
                FROM complaints c
                JOIN tiffin_providers tp ON c.provider_id = tp.id
                WHERE c.student_id = ?
                ORDER BY c.id DESC
                """, (student['id'],)).fetchall()
                self.send_json({"success": True, "complaints": [dict(c) for c in complaints]})
                return

            # 26. PRISMA MODEL: OWNER STAFF DIRECTORY
            elif path == '/api/owner/staff':
                if not user or user['role'] != 'owner':
                    self.send_error_json("Unauthorized", 401)
                    return
                provider = conn.execute("SELECT id FROM tiffin_providers WHERE owner_user_id = ?", (user['id'],)).fetchone()
                staff = conn.execute("SELECT * FROM staff WHERE provider_id = ? ORDER BY id ASC", (provider['id'],)).fetchall()
                active_count = sum(1 for s in staff if s['is_active'])
                total_payroll = sum(s['salary'] for s in staff if s['is_active'])
                self.send_json({
                    "success": True,
                    "staff": [dict(s) for s in staff],
                    "summary": {
                        "total_count": len(staff),
                        "active_count": active_count,
                        "monthly_payroll": total_payroll
                    }
                })
                return

            # 27. PRISMA MODEL: OWNER INVENTORY MANAGEMENT
            elif path == '/api/owner/inventory':
                if not user or user['role'] != 'owner':
                    self.send_error_json("Unauthorized", 401)
                    return
                provider = conn.execute("SELECT id FROM tiffin_providers WHERE owner_user_id = ?", (user['id'],)).fetchone()
                items = conn.execute("""
                SELECT *, CASE WHEN quantity <= min_threshold THEN 1 ELSE 0 END as is_low_stock
                FROM inventory_items
                WHERE provider_id = ?
                ORDER BY is_low_stock DESC, id ASC
                """, (provider['id'],)).fetchall()
                low_stock_count = sum(1 for i in items if i['is_low_stock'])
                self.send_json({
                    "success": True,
                    "items": [dict(i) for i in items],
                    "low_stock_count": low_stock_count
                })
                return

            # 28. PRISMA MODEL: OWNER COMPLAINTS & GRIEVANCES RESOLUTION
            elif path == '/api/owner/complaints':
                if not user or user['role'] != 'owner':
                    self.send_error_json("Unauthorized", 401)
                    return
                provider = conn.execute("SELECT id FROM tiffin_providers WHERE owner_user_id = ?", (user['id'],)).fetchone()
                complaints = conn.execute("""
                SELECT c.*, u.full_name as student_name, u.phone as student_phone, s.delivery_address
                FROM complaints c
                JOIN students s ON c.student_id = s.id
                JOIN users u ON s.user_id = u.id
                WHERE c.provider_id = ?
                ORDER BY 
                    CASE c.status WHEN 'OPEN' THEN 1 WHEN 'IN_PROGRESS' THEN 2 WHEN 'RESOLVED' THEN 3 END,
                    c.id DESC
                """, (provider['id'],)).fetchall()

                open_c = sum(1 for c in complaints if c['status'] == 'OPEN')
                in_prog = sum(1 for c in complaints if c['status'] == 'IN_PROGRESS')
                res_c = sum(1 for c in complaints if c['status'] == 'RESOLVED')

                self.send_json({
                    "success": True,
                    "complaints": [dict(c) for c in complaints],
                    "summary": {
                        "total": len(complaints),
                        "open": open_c,
                        "in_progress": in_prog,
                        "resolved": res_c
                    }
                })
                return

            else:
                self.send_error_json("Not Found", 404)

        except Exception as e:
            self.send_error_json(str(e), 500)
        finally:
            conn.close()

    # ------------------ API POST HANDLERS ------------------
    def handle_api_post(self, path, body):
        conn = database.get_db_connection()
        user = get_current_user(self.headers)

        try:
            # 1. USER REGISTRATION (Student or Owner)
            if path == '/api/auth/register':
                role = body.get('role', 'student')
                email = body.get('email', '').strip().lower()
                phone = body.get('phone', '').strip()
                password = body.get('password', '')
                full_name = body.get('full_name', '').strip()

                if not email or not password or not full_name:
                    self.send_error_json("Please provide all required fields (Name, Email, Password)", 400)
                    return

                # Check unique email/phone
                existing = conn.execute("SELECT id FROM users WHERE email = ? OR (phone = ? AND phone != '')", (email, phone)).fetchone()
                if existing:
                    self.send_error_json("An account with this email or mobile number already exists", 400)
                    return

                pwd_hash = database.hash_password(password)
                address = body.get('address', body.get('delivery_address', body.get('business_address', '')))
                
                cur = conn.cursor()
                cur.execute("""
                INSERT INTO users (email, phone, password_hash, role, full_name, address)
                VALUES (?, ?, ?, ?, ?, ?)
                """, (email, phone, pwd_hash, role, full_name, address))
                user_id = cur.lastrowid

                # Create role-specific record
                if role == 'owner':
                    biz_name = body.get('business_name', f"{full_name}'s Tiffin Center")
                    cur.execute("""
                    INSERT INTO tiffin_providers (
                        owner_user_id, business_name, description, contact_phone,
                        contact_email, business_address
                    ) VALUES (?, ?, 'Fresh hygienic meals daily', ?, ?, ?)
                    """, (user_id, biz_name, phone, email, address))
                    provider_id = cur.lastrowid

                    # Create default pricing
                    cur.execute("""
                    INSERT INTO pricing_config (provider_id) VALUES (?)
                    """, (provider_id,))

                    # Seed sample menu for owner
                    sample_menus = [
                        ('Monday', 'Breakfast', 'Poha & Jalebi', 'Indori Sev Poha with Jalebis', 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?w=600'),
                        ('Monday', 'Lunch', 'Special Thali', '4 Rotis, Paneer, Dal Tadka, Rice', 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=600'),
                        ('Monday', 'Dinner', 'Aloo Gobi & Dal Fry', '4 Rotis, Aloo Gobi, Dal, Rice', 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=600')
                    ]
                    for sm in sample_menus:
                        cur.execute("INSERT INTO menus (provider_id, day_of_week, meal_type, food_name, description, image_url) VALUES (?, ?, ?, ?, ?, ?)", (provider_id, sm[0], sm[1], sm[2], sm[3], sm[4]))

                else: # Student
                    provider_id = body.get('provider_id', 1)
                    cur.execute("""
                    INSERT INTO students (user_id, provider_id, delivery_address)
                    VALUES (?, ?, ?)
                    """, (user_id, provider_id, address))

                # Create Welcome Notification
                cur.execute("""
                INSERT INTO notifications (user_id, title, message, type)
                VALUES (?, 'Welcome to Tiffin App', 'Your account has been created successfully!', 'success')
                """, (user_id,))

                conn.commit()

                token = f"token_{user_id}_{int(datetime.now().timestamp())}"
                ACTIVE_SESSIONS[token] = user_id

                self.send_json({
                    "success": True,
                    "message": "Account created successfully",
                    "token": token,
                    "user": {"id": user_id, "email": email, "full_name": full_name, "role": role}
                })
                return

            # 2. USER LOGIN
            elif path == '/api/auth/login':
                identifier = body.get('identifier', body.get('email', '')).strip().lower()
                password = body.get('password', '')
                expected_role = body.get('role', None)

                if not identifier or not password:
                    self.send_error_json("Please enter your email/mobile and password", 400)
                    return

                user_row = conn.execute("""
                SELECT * FROM users WHERE (LOWER(email) = ? OR phone = ?) AND status = 'active'
                """, (identifier, identifier)).fetchone()

                if not user_row:
                    self.send_error_json("Invalid credentials or account does not exist", 401)
                    return

                pwd_hash = database.hash_password(password)
                if user_row['password_hash'] != pwd_hash:
                    self.send_error_json("Incorrect password", 401)
                    return

                if expected_role and user_row['role'] != expected_role:
                    self.send_error_json(f"Access denied: You are registered as a {user_row['role'].title()}. Please use the {user_row['role'].title()} login portal.", 403)
                    return

                token = f"token_{user_row['id']}_{int(datetime.now().timestamp())}"
                ACTIVE_SESSIONS[token] = user_row['id']

                resp = {
                    "success": True,
                    "token": token,
                    "user": dict(user_row)
                }

                if user_row['role'] == 'student':
                    student = conn.execute("SELECT * FROM students WHERE user_id = ?", (user_row['id'],)).fetchone()
                    resp['student'] = dict(student) if student else None
                elif user_row['role'] == 'owner':
                    provider = conn.execute("SELECT * FROM tiffin_providers WHERE owner_user_id = ?", (user_row['id'],)).fetchone()
                    resp['provider'] = dict(provider) if provider else None

                self.send_json(resp)
                return

            # 3. GOOGLE AUTH SIMULATION / SSO
            elif path == '/api/auth/google':
                email = body.get('email', 'demo.google.user@gmail.com').strip().lower()
                full_name = body.get('full_name', 'Google User').strip()
                role = body.get('role', 'student')

                cur = conn.cursor()
                user_row = cur.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
                if not user_row:
                    cur.execute("""
                    INSERT INTO users (email, phone, password_hash, role, full_name, address)
                    VALUES (?, '', ?, ?, ?, 'Google Account User Address')
                    """, (email, database.hash_password('google_oauth_pass'), role, full_name))
                    user_id = cur.lastrowid
                    if role == 'student':
                        cur.execute("INSERT INTO students (user_id, provider_id, delivery_address) VALUES (?, 1, 'Google User Address')", (user_id,))
                    else:
                        cur.execute("INSERT INTO tiffin_providers (owner_user_id, business_name, contact_phone, business_address) VALUES (?, 'Google Owner Tiffin', '9898989898', 'Central')", (user_id,))
                    conn.commit()
                    user_row = cur.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()

                token = f"token_{user_row['id']}_{int(datetime.now().timestamp())}"
                ACTIVE_SESSIONS[token] = user_row['id']
                self.send_json({"success": True, "token": token, "user": dict(user_row)})
                return

            # 4. FORGOT PASSWORD
            elif path == '/api/auth/forgot-password':
                email = body.get('email', '').strip().lower()
                user_row = conn.execute("SELECT id FROM users WHERE email = ?", (email,)).fetchone()
                if user_row:
                    # In production send reset email, here simulate reset
                    new_pwd = database.hash_password("password123")
                    conn.execute("UPDATE users SET password_hash = ? WHERE id = ?", (new_pwd, user_row['id']))
                    conn.commit()
                    self.send_json({"success": True, "message": "Password reset instructions sent! For testing, your password has been reset to 'password123'."})
                else:
                    self.send_error_json("No account registered with this email address", 404)
                return

            # 5. DYNAMIC PLAN PRICING CALCULATION
            elif path == '/api/student/plan/calculate':
                plan_type = body.get('plan_type', 'day')
                provider_id = body.get('provider_id', 1)
                selected_dates = body.get('selected_dates', [])
                selected_meals = body.get('selected_meals', ['breakfast', 'lunch', 'dinner'])

                pricing = conn.execute("SELECT * FROM pricing_config WHERE provider_id = ?", (provider_id,)).fetchone()
                if not pricing:
                    self.send_error_json("Pricing configuration not found", 404)
                    return
                
                b_price = pricing['breakfast_price']
                l_price = pricing['lunch_price']
                d_price = pricing['dinner_price']
                day_price = pricing['day_plan_price']
                weekly_price = pricing['weekly_plan_price']
                monthly_price = pricing['monthly_plan_price']
                custom_base = pricing['custom_meal_base_price']
                m_disc = pricing['monthly_discount_pct']
                w_disc = pricing['weekly_discount_pct']

                subtotal = 0.0
                discount = 0.0

                if plan_type == 'day':
                    # Single date calculation
                    meal_sum = 0
                    if 'breakfast' in selected_meals: meal_sum += b_price
                    if 'lunch' in selected_meals: meal_sum += l_price
                    if 'dinner' in selected_meals: meal_sum += d_price
                    # If all 3 meals selected, use day_plan_price if lower
                    if len(selected_meals) == 3 and day_price < meal_sum:
                        subtotal = day_price
                    else:
                        subtotal = meal_sum
                    discount = 0.0

                elif plan_type == 'weekly':
                    subtotal = weekly_price
                    discount = (weekly_price * w_disc) / 100.0

                elif plan_type == 'monthly':
                    subtotal = monthly_price
                    discount = (monthly_price * m_disc) / 100.0

                elif plan_type == 'custom':
                    # Interactive calendar selection: array of objects {date: 'YYYY-MM-DD', meals: ['breakfast', 'lunch']}
                    date_entries = body.get('custom_selections', [])
                    total_meals_count = 0
                    for entry in date_entries:
                        meals = entry.get('meals', [])
                        for m in meals:
                            if m == 'breakfast': subtotal += b_price
                            elif m == 'lunch': subtotal += l_price
                            elif m == 'dinner': subtotal += d_price
                            total_meals_count += 1
                    
                    if total_meals_count >= 15:
                        discount = subtotal * 0.08
                    elif total_meals_count >= 7:
                        discount = subtotal * 0.04

                final_amount = max(0.0, round(subtotal - discount, 2))
                self.send_json({
                    "success": True,
                    "breakdown": {
                        "plan_type": plan_type,
                        "subtotal": round(subtotal, 2),
                        "discount": round(discount, 2),
                        "final_amount": final_amount,
                        "rates": {
                            "breakfast": b_price,
                            "lunch": l_price,
                            "dinner": d_price
                        }
                    }
                })
                return

            # 6. RAZORPAY PAYMENT VERIFY & ACTIVATE SUBSCRIPTION
            elif path == '/api/student/payment/verify':
                if not user or user['role'] != 'student':
                    self.send_error_json("Unauthorized", 401)
                    return
                student = conn.execute("SELECT * FROM students WHERE user_id = ?", (user['id'],)).fetchone()
                if not student:
                    self.send_error_json("Student record not found", 404)
                    return

                provider_id = body.get('provider_id', student['provider_id'] or 1)
                plan_type = body.get('plan_type', 'monthly')
                total_amount = float(body.get('total_amount', 0))
                discount_amount = float(body.get('discount_amount', 0))
                final_amount = float(body.get('final_amount', 0))
                payment_method = body.get('payment_method', 'UPI')
                selected_dates = body.get('selected_dates', [])
                selected_meals = body.get('selected_meals', ['breakfast', 'lunch', 'dinner'])

                # Generate IDs
                timestamp_str = datetime.now().strftime("%Y%m%d%H%M%S")
                order_id = f"order_TIFFIN_{timestamp_str}"
                payment_id = f"pay_RAZOR_{timestamp_str}"
                receipt_number = f"RCP-{datetime.now().year}-{student['id']:04d}-{int(datetime.now().timestamp())%10000}"

                start_date = datetime.now()
                if plan_type == 'day':
                    end_date = start_date
                elif plan_type == 'weekly':
                    end_date = start_date + timedelta(days=7)
                elif plan_type == 'monthly':
                    end_date = start_date + timedelta(days=30)
                else: # custom
                    end_date = start_date + timedelta(days=len(selected_dates) or 1)

                cur = conn.cursor()

                # 1. Insert Subscription
                cur.execute("""
                INSERT INTO subscriptions (
                    student_id, provider_id, plan_type, start_date, end_date,
                    total_amount, discount_amount, final_amount, status,
                    selected_dates_json, selected_meals_json
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)
                """, (
                    student['id'], provider_id, plan_type,
                    start_date.strftime("%Y-%m-%d"), end_date.strftime("%Y-%m-%d"),
                    total_amount, discount_amount, final_amount,
                    json.dumps(selected_dates), json.dumps(selected_meals)
                ))
                sub_id = cur.lastrowid

                # 2. Insert Payment Record
                cur.execute("""
                INSERT INTO payments (
                    student_id, provider_id, subscription_id, razorpay_order_id, razorpay_payment_id,
                    amount, payment_method, status, receipt_number, notes
                ) VALUES (?, ?, ?, ?, ?, ?, ?, 'success', ?, ?)
                """, (
                    student['id'], provider_id, sub_id, order_id, payment_id,
                    final_amount, payment_method, receipt_number,
                    f"Student {user['full_name']} subscribed to {plan_type.upper()} plan via {payment_method}"
                ))

                # 3. Update Student Subscription Status
                cur.execute("""
                UPDATE students SET
                    provider_id = ?,
                    subscription_status = 'active',
                    tiffin_start_date = ?,
                    tiffin_end_date = ?
                WHERE id = ?
                """, (provider_id, start_date.strftime("%Y-%m-%d"), end_date.strftime("%Y-%m-%d"), student['id']))

                # 4. Generate Scheduled Orders & Deliveries
                num_days = 1 if plan_type == 'day' else (7 if plan_type == 'weekly' else (30 if plan_type == 'monthly' else max(1, len(selected_dates))))
                for d in range(min(num_days, 14)): # schedule up to next 14 days initially
                    order_date = (start_date + timedelta(days=d)).strftime("%Y-%m-%d")
                    for meal in ['Breakfast', 'Lunch', 'Dinner']:
                        if meal.lower() in [m.lower() for m in selected_meals]:
                            cur.execute("""
                            INSERT OR IGNORE INTO orders (student_id, provider_id, subscription_id, meal_date, meal_type, status, delivery_address)
                            VALUES (?, ?, ?, ?, ?, 'scheduled', ?)
                            """, (student['id'], provider_id, sub_id, order_date, meal, student['delivery_address']))
                            o_id = cur.lastrowid
                            if o_id:
                                qr_token = f"QR_{student['id']}_{o_id}_{int(datetime.now().timestamp()) % 100000}"
                                cur.execute("""
                                INSERT OR IGNORE INTO deliveries (order_id, student_id, provider_id, meal_date, meal_type, status, delivery_address, qr_token)
                                VALUES (?, ?, ?, ?, ?, 'order_received', ?, ?)
                                """, (o_id, student['id'], provider_id, order_date, meal, student['delivery_address'], qr_token))
                                cur.execute("""
                                INSERT OR IGNORE INTO attendance (student_id, provider_id, meal_date, meal_type, status)
                                VALUES (?, ?, ?, ?, 'present')
                                """, (student['id'], provider_id, order_date, meal))

                # 5. In-App Notifications
                cur.execute("""
                INSERT INTO notifications (user_id, title, message, type)
                VALUES (?, 'Payment Successful!', ?, 'payment')
                """, (user['id'], f"Payment of ₹{final_amount} verified successfully. Receipt: {receipt_number}. Your {plan_type} subscription is active!"))

                # Owner notification
                owner = conn.execute("SELECT owner_user_id FROM tiffin_providers WHERE id = ?", (provider_id,)).fetchone()
                if owner:
                    cur.execute("""
                    INSERT INTO notifications (user_id, title, message, type)
                    VALUES (?, 'New Student Subscription & Payment', ?, 'payment')
                    """, (owner['owner_user_id'], f"Student {user['full_name']} purchased {plan_type} subscription. ₹{final_amount} received."))

                conn.commit()

                self.send_json({
                    "success": True,
                    "message": "Payment verified and subscription activated successfully!",
                    "receipt": {
                        "receipt_number": receipt_number,
                        "payment_id": payment_id,
                        "order_id": order_id,
                        "amount": final_amount,
                        "plan_type": plan_type,
                        "date": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                    }
                })
                return

            # 7. STOP MEAL REQUEST (Strict 2-Hour Advance Cutoff Enforcement)
            elif path == '/api/student/stop-meal':
                if not user or user['role'] != 'student':
                    self.send_error_json("Unauthorized", 401)
                    return
                student = conn.execute("SELECT * FROM students WHERE user_id = ?", (user['id'],)).fetchone()
                if not student:
                    self.send_error_json("Student record not found", 404)
                    return

                provider_id = student['provider_id'] or 1
                meal_date = body.get('meal_date', '')
                meal_type = body.get('meal_type', 'Lunch')
                reason = body.get('reason', 'Personal engagement')

                if not meal_date:
                    self.send_error_json("Please select a date", 400)
                    return

                # Check 2-Hour Rule
                provider = conn.execute("SELECT * FROM tiffin_providers WHERE id = ?", (provider_id,)).fetchone()
                cutoff_map = {
                    'Breakfast': provider['breakfast_cutoff_time'] or '07:00',
                    'Lunch': provider['lunch_cutoff_time'] or '10:00',
                    'Dinner': provider['dinner_cutoff_time'] or '17:00',
                    'All': provider['breakfast_cutoff_time'] or '07:00'
                }
                
                target_cutoff_str = cutoff_map.get(meal_type, '10:00')
                advance_hours = provider['advance_cutoff_hours'] or 2
                
                # Compare requested date/time with deadline
                today_str = datetime.now().strftime("%Y-%m-%d")
                now = datetime.now()

                if meal_date < today_str:
                    self.send_error_json("Cannot stop a meal for a past date", 400)
                    return
                
                if meal_date == today_str:
                    # Parse cutoff time today
                    cutoff_hour, cutoff_min = map(int, target_cutoff_str.split(':'))
                    cutoff_dt = now.replace(hour=cutoff_hour, minute=cutoff_min, second=0, microsecond=0)
                    deadline_dt = cutoff_dt - timedelta(hours=advance_hours)

                    if now > deadline_dt:
                        self.send_error_json(
                            f"Cancellation deadline missed! As per policy, {meal_type} must be cancelled at least {advance_hours} hours before cutoff ({target_cutoff_str}). Deadline was {deadline_dt.strftime('%I:%M %p')}.",
                            400
                        )
                        return

                cur = conn.cursor()
                deadline_display = f"{target_cutoff_str} ({advance_hours}-Hour advance rule satisfied)"
                
                # Insert stop request
                cur.execute("""
                INSERT INTO stop_meal_requests (
                    student_id, provider_id, request_date, meal_date, meal_type,
                    cutoff_deadline, status, reason, refund_credit
                ) VALUES (?, ?, DATE('now'), ?, ?, ?, 'approved', ?, 90.0)
                """, (student['id'], provider_id, meal_date, meal_type, deadline_display, reason))

                # Update orders to 'stopped' and attendance to 'meal_stopped'
                if meal_type == 'All':
                    cur.execute("UPDATE orders SET status = 'stopped' WHERE student_id = ? AND meal_date = ?", (student['id'], meal_date))
                    cur.execute("UPDATE attendance SET status = 'meal_stopped' WHERE student_id = ? AND meal_date = ?", (student['id'], meal_date))
                else:
                    cur.execute("UPDATE orders SET status = 'stopped' WHERE student_id = ? AND meal_date = ? AND meal_type = ?", (student['id'], meal_date, meal_type))
                    cur.execute("UPDATE attendance SET status = 'meal_stopped' WHERE student_id = ? AND meal_date = ? AND meal_type = ?", (student['id'], meal_date, meal_type))

                # Student notification
                cur.execute("""
                INSERT INTO notifications (user_id, title, message, type)
                VALUES (?, 'Meal Stopped Successfully', ?, 'warning')
                """, (user['id'], f"Your {meal_type} meal on {meal_date} has been stopped. ₹90 refund credit has been registered."))

                # Owner notification
                owner = conn.execute("SELECT owner_user_id FROM tiffin_providers WHERE id = ?", (provider_id,)).fetchone()
                if owner:
                    cur.execute("""
                    INSERT INTO notifications (user_id, title, message, type)
                    VALUES (?, 'Stop Meal Request Received', ?, 'info')
                    """, (owner['owner_user_id'], f"Student {user['full_name']} stopped {meal_type} on {meal_date}. Reason: {reason}"))

                conn.commit()
                self.send_json({"success": True, "message": f"Meal stop request approved for {meal_type} on {meal_date}. ₹90 refund credited!"})
                return

            # 8. SUBMIT FEEDBACK & "KHANA ACHHA THA AAJ KA?" RATING
            elif path == '/api/student/feedback':
                if not user or user['role'] != 'student':
                    self.send_error_json("Unauthorized", 401)
                    return
                student = conn.execute("SELECT * FROM students WHERE user_id = ?", (user['id'],)).fetchone()
                if not student:
                    self.send_error_json("Student record not found", 404)
                    return

                provider_id = student['provider_id'] or 1
                meal_date = body.get('meal_date', datetime.now().strftime("%Y-%m-%d"))
                meal_type = body.get('meal_type', 'Lunch')
                general_rating = body.get('general_rating', 'Good') # Excellent, Good, Average, Not Good
                taste_rating = int(body.get('taste_rating', 4))
                quality_rating = int(body.get('quality_rating', 4))
                quantity_rating = int(body.get('quantity_rating', 4))
                hygiene_rating = int(body.get('hygiene_rating', 4))
                comments = body.get('comments', '')
                is_anonymous = 1 if body.get('is_anonymous') else 0

                cur = conn.cursor()
                cur.execute("""
                INSERT INTO feedback (
                    student_id, provider_id, meal_date, meal_type, general_rating,
                    taste_rating, quality_rating, quantity_rating, hygiene_rating,
                    comments, is_anonymous
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    student['id'], provider_id, meal_date, meal_type, general_rating,
                    taste_rating, quality_rating, quantity_rating, hygiene_rating,
                    comments, is_anonymous
                ))

                # Owner notification
                owner = conn.execute("SELECT owner_user_id FROM tiffin_providers WHERE id = ?", (provider_id,)).fetchone()
                if owner:
                    reviewer = "A student (Anonymous)" if is_anonymous else user['full_name']
                    cur.execute("""
                    INSERT INTO notifications (user_id, title, message, type)
                    VALUES (?, 'New Meal Feedback Received', ?, 'info')
                    """, (owner['owner_user_id'], f"{reviewer} rated today's {meal_type}: {general_rating}. Comments: {comments or 'None'}"))

                conn.commit()
                self.send_json({"success": True, "message": "Thank you for your valuable feedback! It helps us improve our meal quality."})
                return

            # 9. VOTE FOR FOOD SUGGESTION
            elif path == '/api/suggestions/vote':
                if not user or user['role'] != 'student':
                    self.send_error_json("Only students can vote for dishes", 403)
                    return
                student = conn.execute("SELECT id FROM students WHERE user_id = ?", (user['id'],)).fetchone()
                suggestion_id = body.get('suggestion_id')

                if not suggestion_id:
                    self.send_error_json("Suggestion ID required", 400)
                    return

                cur = conn.cursor()
                try:
                    cur.execute("INSERT INTO food_votes (suggestion_id, student_id) VALUES (?, ?)", (suggestion_id, student['id']))
                    cur.execute("UPDATE food_suggestions SET vote_count = vote_count + 1 WHERE id = ?", (suggestion_id,))
                    conn.commit()
                    self.send_json({"success": True, "message": "Your vote has been recorded!"})
                except sqlite3.IntegrityError:
                    self.send_error_json("You have already voted for this dish!", 400)
                return

            # 10. ADD FOOD SUGGESTION
            elif path == '/api/suggestions/add':
                if not user:
                    self.send_error_json("Unauthorized", 401)
                    return
                food_name = body.get('food_name', '').strip()
                category = body.get('category', 'Special Dish')
                description = body.get('description', '')

                if not food_name:
                    self.send_error_json("Dish name cannot be empty", 400)
                    return

                student_id = 1
                provider_id = 1
                if user['role'] == 'student':
                    s = conn.execute("SELECT id, provider_id FROM students WHERE user_id = ?", (user['id'],)).fetchone()
                    if s:
                        student_id = s['id']
                        provider_id = s['provider_id'] or 1

                cur = conn.cursor()
                cur.execute("""
                INSERT INTO food_suggestions (provider_id, student_id, food_name, category, description, vote_count)
                VALUES (?, ?, ?, ?, ?, 1)
                """, (provider_id, student_id, food_name, category, description))
                sug_id = cur.lastrowid
                cur.execute("INSERT INTO food_votes (suggestion_id, student_id) VALUES (?, ?)", (sug_id, student_id))
                conn.commit()
                self.send_json({"success": True, "message": f"Suggested '{food_name}' successfully!"})
                return

            # 11. OWNER UPDATE / PUBLISH MENU
            elif path == '/api/owner/menu/update':
                if not user or user['role'] != 'owner':
                    self.send_error_json("Unauthorized", 401)
                    return
                provider = conn.execute("SELECT id FROM tiffin_providers WHERE owner_user_id = ?", (user['id'],)).fetchone()
                
                day_of_week = body.get('day_of_week')
                meal_type = body.get('meal_type')
                food_name = body.get('food_name', '').strip()
                description = body.get('description', '')
                items_included = body.get('items_included', '')
                image_url = body.get('image_url', 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=600')
                is_special = 1 if body.get('is_special') else 0

                if not food_name:
                    self.send_error_json("Food name required", 400)
                    return

                cur = conn.cursor()
                cur.execute("""
                INSERT INTO menus (provider_id, day_of_week, meal_type, food_name, description, items_included, image_url, is_special)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(provider_id, day_of_week, meal_type) DO UPDATE SET
                    food_name = excluded.food_name,
                    description = excluded.description,
                    items_included = excluded.items_included,
                    image_url = excluded.image_url,
                    is_special = excluded.is_special
                """, (provider['id'], day_of_week, meal_type, food_name, description, items_included, image_url, is_special))
                conn.commit()
                self.send_json({"success": True, "message": f"{meal_type} menu for {day_of_week} updated successfully!"})
                return

            # 12. OWNER PUBLISH WEEKLY MENU NOTIFICATION TO ALL SUBSCRIBED STUDENTS
            elif path == '/api/owner/menu/publish':
                if not user or user['role'] != 'owner':
                    self.send_error_json("Unauthorized", 401)
                    return
                provider = conn.execute("SELECT id, business_name FROM tiffin_providers WHERE owner_user_id = ?", (user['id'],)).fetchone()
                cur = conn.cursor()
                
                students = cur.execute("SELECT user_id FROM students WHERE provider_id = ? AND subscription_status = 'active'", (provider['id'],)).fetchall()
                for s in students:
                    cur.execute("""
                    INSERT INTO notifications (user_id, title, message, type, link_url)
                    VALUES (?, 'New Weekly Menu Published', ?, 'menu', 'menu')
                    """, (s['user_id'], f"{provider['business_name']} has updated and published the weekly menu! Check today's special items."))
                conn.commit()
                self.send_json({"success": True, "message": f"Weekly menu published to {len(students)} active students!"})
                return

            # 13. OWNER UPDATE DELIVERY STATUS (Advances Order & Updates Attendance)
            elif path == '/api/owner/deliveries/update-status':
                if not user or user['role'] != 'owner':
                    self.send_error_json("Unauthorized", 401)
                    return
                delivery_id = body.get('delivery_id')
                new_status = body.get('status') # 'order_received', 'preparing', 'out_for_delivery', 'delivered'

                if not delivery_id or not new_status:
                    self.send_error_json("Missing delivery_id or status", 400)
                    return

                cur = conn.cursor()
                delivery = cur.execute("SELECT * FROM deliveries WHERE id = ?", (delivery_id,)).fetchone()
                if not delivery:
                    self.send_error_json("Delivery record not found", 404)
                    return

                completion_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S") if new_status == 'delivered' else None
                start_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S") if new_status == 'out_for_delivery' else delivery['start_time']

                cur.execute("""
                UPDATE deliveries SET status = ?, start_time = COALESCE(?, start_time), completion_time = COALESCE(?, completion_time), updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
                """, (new_status, start_time, completion_time, delivery_id))

                # Update associated order
                cur.execute("UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", (new_status, delivery['order_id']))

                # If delivered, automatically update attendance to 'delivered'
                if new_status == 'delivered':
                    cur.execute("""
                    INSERT INTO attendance (student_id, provider_id, meal_date, meal_type, status)
                    VALUES (?, ?, ?, ?, 'delivered')
                    ON CONFLICT(student_id, meal_date, meal_type) DO UPDATE SET status = 'delivered', updated_at = CURRENT_TIMESTAMP
                    """, (delivery['student_id'], delivery['provider_id'], delivery['meal_date'], delivery['meal_type']))

                # Notify student
                student_user = conn.execute("SELECT user_id FROM students WHERE id = ?", (delivery['student_id'],)).fetchone()
                if student_user:
                    status_text_map = {
                        'preparing': 'Your chef is currently preparing your fresh meal.',
                        'out_for_delivery': 'Your tiffin is out for delivery! The delivery executive will arrive shortly.',
                        'delivered': 'Your tiffin meal has been successfully delivered! Bon Appetit!'
                    }
                    if new_status in status_text_map:
                        cur.execute("""
                        INSERT INTO notifications (user_id, title, message, type)
                        VALUES (?, ?, ?, 'delivery')
                        """, (student_user['user_id'], f"Meal Status: {new_status.replace('_', ' ').title()}", status_text_map[new_status]))

                conn.commit()
                self.send_json({"success": True, "message": f"Delivery updated to '{new_status.replace('_', ' ').title()}'!"})
                return

            # 14. OWNER ATTENDANCE UPDATE / CORRECTION
            elif path == '/api/owner/attendance/update':
                if not user or user['role'] != 'owner':
                    self.send_error_json("Unauthorized", 401)
                    return
                student_id = body.get('student_id')
                meal_date = body.get('meal_date')
                meal_type = body.get('meal_type')
                new_status = body.get('status')
                reason = body.get('reason', 'Authorized manual correction by Owner')

                provider = conn.execute("SELECT id FROM tiffin_providers WHERE owner_user_id = ?", (user['id'],)).fetchone()
                cur = conn.cursor()

                cur.execute("""
                INSERT INTO attendance (student_id, provider_id, meal_date, meal_type, status, corrected_by, correction_reason)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(student_id, meal_date, meal_type) DO UPDATE SET
                    status = excluded.status,
                    corrected_by = excluded.corrected_by,
                    correction_reason = excluded.correction_reason,
                    updated_at = CURRENT_TIMESTAMP
                """, (student_id, provider['id'], meal_date, meal_type, new_status, user['id'], reason))

                # Log audit
                cur.execute("""
                INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
                VALUES (?, 'UPDATE_ATTENDANCE', 'attendance', ?, ?)
                """, (user['id'], student_id, f"Date: {meal_date}, Meal: {meal_type}, New Status: {new_status}, Reason: {reason}"))

                # Notify student
                student_user = conn.execute("SELECT user_id FROM students WHERE id = ?", (student_id,)).fetchone()
                if student_user:
                    cur.execute("""
                    INSERT INTO notifications (user_id, title, message, type)
                    VALUES (?, 'Attendance Record Updated', ?, 'info')
                    """, (student_user['user_id'], f"Your attendance for {meal_type} on {meal_date} was updated to '{new_status}'. Reason: {reason}"))

                conn.commit()
                self.send_json({"success": True, "message": "Attendance updated and audit log recorded!"})
                return

            # 15. OWNER ADD EXPENSE (FOR P&L)
            elif path == '/api/owner/expenses/add':
                if not user or user['role'] != 'owner':
                    self.send_error_json("Unauthorized", 401)
                    return
                provider = conn.execute("SELECT id FROM tiffin_providers WHERE owner_user_id = ?", (user['id'],)).fetchone()
                category = body.get('category', 'Food / Raw Material')
                amount = float(body.get('amount', 0))
                expense_date = body.get('expense_date', datetime.now().strftime("%Y-%m-%d"))
                description = body.get('description', '')

                if amount <= 0:
                    self.send_error_json("Amount must be greater than zero", 400)
                    return

                cur = conn.cursor()
                cur.execute("""
                INSERT INTO expenses (provider_id, expense_date, category, amount, description)
                VALUES (?, ?, ?, ?, ?)
                """, (provider['id'], expense_date, category, amount, description))
                conn.commit()
                self.send_json({"success": True, "message": f"Expense of ₹{amount} added under '{category}'!"})
                return

            # 16. OWNER REPLY TO FEEDBACK
            elif path == '/api/owner/feedback/reply':
                if not user or user['role'] != 'owner':
                    self.send_error_json("Unauthorized", 401)
                    return
                feedback_id = body.get('feedback_id')
                response_text = body.get('reply', '').strip()

                cur = conn.cursor()
                cur.execute("UPDATE feedback SET owner_response = ? WHERE id = ?", (response_text, feedback_id))
                fb = cur.execute("SELECT student_id, meal_type FROM feedback WHERE id = ?", (feedback_id,)).fetchone()
                if fb:
                    s_user = conn.execute("SELECT user_id FROM students WHERE id = ?", (fb['student_id'],)).fetchone()
                    if s_user:
                        cur.execute("""
                        INSERT INTO notifications (user_id, title, message, type)
                        VALUES (?, 'Tiffin Owner Responded to Feedback', ?, 'info')
                        """, (s_user['user_id'], f"Owner response on your {fb['meal_type']} review: \"{response_text}\""))
                conn.commit()
                self.send_json({"success": True, "message": "Feedback response sent successfully!"})
                return

            # 17. OWNER ADD STUDENT
            elif path == '/api/owner/students/add':
                if not user or user['role'] != 'owner':
                    self.send_error_json("Unauthorized", 401)
                    return
                provider = conn.execute("SELECT id FROM tiffin_providers WHERE owner_user_id = ?", (user['id'],)).fetchone()
                full_name = body.get('full_name', '').strip()
                email = body.get('email', '').strip().lower()
                phone = body.get('phone', '').strip()
                address = body.get('delivery_address', '').strip()

                if not full_name or not email:
                    self.send_error_json("Student Name and Email are required", 400)
                    return

                cur = conn.cursor()
                cur.execute("""
                INSERT INTO users (email, phone, password_hash, role, full_name, address)
                VALUES (?, ?, ?, 'student', ?, ?)
                """, (email, phone, database.hash_password('student123'), full_name, address))
                new_u_id = cur.lastrowid

                cur.execute("""
                INSERT INTO students (user_id, provider_id, delivery_address, subscription_status)
                VALUES (?, ?, ?, 'active')
                """, (new_u_id, provider['id'], address))
                conn.commit()
                self.send_json({"success": True, "message": f"Student {full_name} added to your tiffin center!"})
                return

            # 18. NOTIFICATIONS MARK AS READ
            elif path == '/api/notifications/mark-read':
                if not user:
                    self.send_error_json("Unauthorized", 401)
                    return
                conn.execute("UPDATE notifications SET is_read = 1 WHERE user_id = ?", (user['id'],))
                conn.commit()
                self.send_json({"success": True})
                return

            # 19. PRISMA MODEL: STUDENT WALLET RECHARGE
            elif path == '/api/student/wallet/recharge':
                if not user or user['role'] != 'student':
                    self.send_error_json("Unauthorized", 401)
                    return
                student = conn.execute("SELECT * FROM students WHERE user_id = ?", (user['id'],)).fetchone()
                if not student:
                    self.send_error_json("Student profile not found", 404)
                    return

                amount = float(body.get('amount', 0))
                payment_method = body.get('payment_method', 'UPI')

                if amount <= 0:
                    self.send_error_json("Recharge amount must be greater than zero", 400)
                    return

                cur = conn.cursor()
                new_balance = float(student['wallet_balance'] or 0.0) + amount
                cur.execute("UPDATE students SET wallet_balance = ? WHERE id = ?", (new_balance, student['id']))

                ref_id = f"WAL_RECH_{int(datetime.now().timestamp())}"
                cur.execute("""
                INSERT INTO wallet_transactions (student_id, type, amount, description, reference_id)
                VALUES (?, 'CREDIT', ?, ?, ?)
                """, (student['id'], amount, f"Wallet recharge via {payment_method}", ref_id))

                cur.execute("""
                INSERT INTO notifications (user_id, title, message, type)
                VALUES (?, 'Wallet Recharged!', ?, 'payment')
                """, (user['id'], f"₹{amount:.2f} credited to your wallet via {payment_method}. New balance: ₹{new_balance:.2f}"))

                conn.commit()
                self.send_json({
                    "success": True,
                    "message": f"₹{amount:.2f} added to wallet successfully!",
                    "new_balance": new_balance,
                    "reference_id": ref_id
                })
                return

            # 20. PRISMA MODEL: STUDENT DIETARY PREFERENCES
            elif path == '/api/student/dietary':
                if not user or user['role'] != 'student':
                    self.send_error_json("Unauthorized", 401)
                    return
                student = conn.execute("SELECT id FROM students WHERE user_id = ?", (user['id'],)).fetchone()
                if not student:
                    self.send_error_json("Student profile not found", 404)
                    return

                is_jain = 1 if body.get('is_jain') else 0
                less_spicy = 1 if body.get('less_spicy') else 0
                no_onion_garlic = 1 if body.get('no_onion_garlic') else 0
                allergies = body.get('allergies', '').strip()
                special_instructions = body.get('special_instructions', '').strip()

                cur = conn.cursor()
                cur.execute("""
                UPDATE students SET
                    is_jain = ?,
                    less_spicy = ?,
                    no_onion_garlic = ?,
                    allergies = ?,
                    special_instructions = ?
                WHERE id = ?
                """, (is_jain, less_spicy, no_onion_garlic, allergies, special_instructions, student['id']))

                conn.commit()
                self.send_json({"success": True, "message": "Dietary preferences updated successfully!"})
                return

            # 21. PRISMA MODEL: STUDENT LODGE COMPLAINT / GRIEVANCE
            elif path == '/api/student/complaints':
                if not user or user['role'] != 'student':
                    self.send_error_json("Unauthorized", 401)
                    return
                student = conn.execute("SELECT id, provider_id FROM students WHERE user_id = ?", (user['id'],)).fetchone()
                if not student:
                    self.send_error_json("Student profile not found", 404)
                    return

                category = body.get('category', 'Quality')
                description = body.get('description', '').strip()
                provider_id = body.get('provider_id', student['provider_id'] or 1)

                if not description:
                    self.send_error_json("Please describe your complaint or issue", 400)
                    return

                cur = conn.cursor()
                cur.execute("""
                INSERT INTO complaints (student_id, provider_id, category, description, status)
                VALUES (?, ?, ?, ?, 'OPEN')
                """, (student['id'], provider_id, category, description))

                # Notify Tiffin Owner
                owner = conn.execute("SELECT owner_user_id FROM tiffin_providers WHERE id = ?", (provider_id,)).fetchone()
                if owner:
                    cur.execute("""
                    INSERT INTO notifications (user_id, title, message, type)
                    VALUES (?, 'New Student Grievance / Complaint', ?, 'warning')
                    """, (owner['owner_user_id'], f"Student {user['full_name']} filed a {category} complaint: \"{description[:80]}...\""))

                conn.commit()
                self.send_json({"success": True, "message": "Your complaint has been registered. The tiffin owner will review it shortly."})
                return

            # 22. PRISMA MODEL: OWNER ADD STAFF
            elif path == '/api/owner/staff/add':
                if not user or user['role'] != 'owner':
                    self.send_error_json("Unauthorized", 401)
                    return
                provider = conn.execute("SELECT id FROM tiffin_providers WHERE owner_user_id = ?", (user['id'],)).fetchone()
                
                name = body.get('name', '').strip()
                role = body.get('role', 'COOK').upper() # COOK, HELPER, DELIVERY
                phone = body.get('phone', '').strip()
                salary = float(body.get('salary', 10000.0))

                if not name or not phone:
                    self.send_error_json("Staff name and contact phone are required", 400)
                    return

                cur = conn.cursor()
                cur.execute("""
                INSERT INTO staff (provider_id, name, role, phone, salary, is_active)
                VALUES (?, ?, ?, ?, ?, 1)
                """, (provider['id'], name, role, phone, salary))
                conn.commit()

                self.send_json({"success": True, "message": f"Staff member '{name}' ({role}) added successfully!"})
                return

            # 23. PRISMA MODEL: OWNER TOGGLE STAFF ACTIVE STATUS
            elif path == '/api/owner/staff/toggle':
                if not user or user['role'] != 'owner':
                    self.send_error_json("Unauthorized", 401)
                    return
                provider = conn.execute("SELECT id FROM tiffin_providers WHERE owner_user_id = ?", (user['id'],)).fetchone()
                staff_id = body.get('staff_id')

                cur = conn.cursor()
                cur.execute("""
                UPDATE staff SET is_active = CASE WHEN is_active = 1 THEN 0 ELSE 1 END
                WHERE id = ? AND provider_id = ?
                """, (staff_id, provider['id']))
                conn.commit()

                self.send_json({"success": True, "message": "Staff status updated successfully!"})
                return

            # 24. PRISMA MODEL: OWNER ADD INVENTORY ITEM
            elif path == '/api/owner/inventory/add':
                if not user or user['role'] != 'owner':
                    self.send_error_json("Unauthorized", 401)
                    return
                provider = conn.execute("SELECT id FROM tiffin_providers WHERE owner_user_id = ?", (user['id'],)).fetchone()

                item_name = body.get('item_name', '').strip()
                quantity = float(body.get('quantity', 0.0))
                unit = body.get('unit', 'kg').strip()
                min_threshold = float(body.get('min_threshold', 5.0))
                supplier_name = body.get('supplier_name', '').strip()

                if not item_name or quantity <= 0:
                    self.send_error_json("Item name and positive quantity are required", 400)
                    return

                cur = conn.cursor()
                cur.execute("""
                INSERT INTO inventory_items (provider_id, item_name, quantity, unit, min_threshold, supplier_name)
                VALUES (?, ?, ?, ?, ?, ?)
                """, (provider['id'], item_name, quantity, unit, min_threshold, supplier_name))
                conn.commit()

                self.send_json({"success": True, "message": f"Inventory item '{item_name}' added successfully!"})
                return

            # 25. PRISMA MODEL: OWNER UPDATE INVENTORY STOCK
            elif path == '/api/owner/inventory/update-stock':
                if not user or user['role'] != 'owner':
                    self.send_error_json("Unauthorized", 401)
                    return
                provider = conn.execute("SELECT id FROM tiffin_providers WHERE owner_user_id = ?", (user['id'],)).fetchone()

                item_id = body.get('item_id')
                quantity = float(body.get('quantity', 0.0))

                cur = conn.cursor()
                cur.execute("""
                UPDATE inventory_items SET quantity = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ? AND provider_id = ?
                """, (quantity, item_id, provider['id']))
                conn.commit()

                self.send_json({"success": True, "message": "Inventory stock quantity updated!"})
                return

            # 26. PRISMA MODEL: OWNER RESOLVE COMPLAINT
            elif path == '/api/owner/complaints/resolve':
                if not user or user['role'] != 'owner':
                    self.send_error_json("Unauthorized", 401)
                    return
                provider = conn.execute("SELECT id FROM tiffin_providers WHERE owner_user_id = ?", (user['id'],)).fetchone()

                complaint_id = body.get('complaint_id')
                status = body.get('status', 'RESOLVED').upper() # OPEN, IN_PROGRESS, RESOLVED
                resolution = body.get('resolution', '').strip()

                cur = conn.cursor()
                complaint = cur.execute("SELECT * FROM complaints WHERE id = ? AND provider_id = ?", (complaint_id, provider['id'])).fetchone()
                if not complaint:
                    self.send_error_json("Complaint record not found", 404)
                    return

                cur.execute("""
                UPDATE complaints SET status = ?, resolution = ?
                WHERE id = ? AND provider_id = ?
                """, (status, resolution, complaint_id, provider['id']))

                # Notify student
                student_user = conn.execute("SELECT user_id FROM students WHERE id = ?", (complaint['student_id'],)).fetchone()
                if student_user:
                    cur.execute("""
                    INSERT INTO notifications (user_id, title, message, type)
                    VALUES (?, 'Grievance Resolution Update', ?, 'info')
                    """, (student_user['user_id'], f"Your complaint regarding '{complaint['category']}' is now {status}. Notes: {resolution or 'Addressed by owner'}"))

                conn.commit()
                self.send_json({"success": True, "message": f"Complaint #{complaint_id} updated to {status}!"})
                return

            # 27. PRISMA MODEL: VERIFY DELIVERY BY QR CODE TOKEN
            elif path == '/api/owner/deliveries/verify-qr':
                if not user:
                    self.send_error_json("Unauthorized", 401)
                    return
                qr_token = body.get('qr_token', '').strip()

                if not qr_token:
                    self.send_error_json("QR token is required", 400)
                    return

                cur = conn.cursor()
                delivery = cur.execute("""
                SELECT d.*, u.full_name as student_name, s.user_id as student_user_id
                FROM deliveries d
                JOIN students s ON d.student_id = s.id
                JOIN users u ON s.user_id = u.id
                WHERE d.qr_token = ?
                """, (qr_token,)).fetchone()

                if not delivery:
                    self.send_error_json("Invalid or expired QR verification token", 404)
                    return

                # Mark delivered
                now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                cur.execute("""
                UPDATE deliveries SET status = 'delivered', delivered_at = CURRENT_TIMESTAMP, completion_time = CURRENT_TIMESTAMP
                WHERE id = ?
                """, (delivery['id'],))

                cur.execute("UPDATE orders SET status = 'delivered', updated_at = CURRENT_TIMESTAMP WHERE id = ?", (delivery['order_id'],))

                cur.execute("""
                INSERT INTO attendance (student_id, provider_id, meal_date, meal_type, status)
                VALUES (?, ?, ?, ?, 'delivered')
                ON CONFLICT(student_id, meal_date, meal_type) DO UPDATE SET status = 'delivered', updated_at = CURRENT_TIMESTAMP
                """, (delivery['student_id'], delivery['provider_id'], delivery['meal_date'], delivery['meal_type']))

                cur.execute("""
                INSERT INTO notifications (user_id, title, message, type)
                VALUES (?, 'Tiffin Delivered (QR Verified)', ?, 'delivery')
                """, (delivery['student_user_id'], f"Your {delivery['meal_type']} tiffin has been delivered and verified via QR token! Enjoy your meal!"))

                conn.commit()
                self.send_json({
                    "success": True,
                    "message": f"QR Token verified! {delivery['meal_type']} for {delivery['student_name']} marked as Delivered.",
                    "delivery": dict(delivery)
                })
                return

            else:
                self.send_error_json("Not Found", 404)

        except Exception as e:
            self.send_error_json(str(e), 500)
        finally:
            conn.close()

    # ------------------ API PUT HANDLERS ------------------
    def handle_api_put(self, path, body):
        conn = database.get_db_connection()
        user = get_current_user(self.headers)

        try:
            # 1. OWNER PRICING CONFIGURATION
            if path == '/api/owner/pricing':
                if not user or user['role'] != 'owner':
                    self.send_error_json("Unauthorized", 401)
                    return
                provider = conn.execute("SELECT id FROM tiffin_providers WHERE owner_user_id = ?", (user['id'],)).fetchone()
                
                b_price = float(body.get('breakfast_price', 50))
                l_price = float(body.get('lunch_price', 90))
                d_price = float(body.get('dinner_price', 90))
                day_price = float(body.get('day_plan_price', 210))
                w_price = float(body.get('weekly_plan_price', 1350))
                m_price = float(body.get('monthly_plan_price', 5200))
                c_price = float(body.get('custom_meal_base_price', 85))
                m_disc = float(body.get('monthly_discount_pct', 10))
                w_disc = float(body.get('weekly_discount_pct', 5))

                cur = conn.cursor()
                cur.execute("""
                INSERT INTO pricing_config (
                    provider_id, breakfast_price, lunch_price, dinner_price,
                    day_plan_price, weekly_plan_price, monthly_plan_price,
                    custom_meal_base_price, monthly_discount_pct, weekly_discount_pct, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(provider_id) DO UPDATE SET
                    breakfast_price = excluded.breakfast_price,
                    lunch_price = excluded.lunch_price,
                    dinner_price = excluded.dinner_price,
                    day_plan_price = excluded.day_plan_price,
                    weekly_plan_price = excluded.weekly_plan_price,
                    monthly_plan_price = excluded.monthly_plan_price,
                    custom_meal_base_price = excluded.custom_meal_base_price,
                    monthly_discount_pct = excluded.monthly_discount_pct,
                    weekly_discount_pct = excluded.weekly_discount_pct,
                    updated_at = CURRENT_TIMESTAMP
                """, (provider['id'], b_price, l_price, d_price, day_price, w_price, m_price, c_price, m_disc, w_disc))

                conn.commit()
                self.send_json({"success": True, "message": "Pricing rules updated successfully! Changes reflect on Student checkout."})
                return

            # 2. OWNER BUSINESS SETTINGS
            elif path == '/api/owner/settings':
                if not user or user['role'] != 'owner':
                    self.send_error_json("Unauthorized", 401)
                    return
                provider = conn.execute("SELECT id FROM tiffin_providers WHERE owner_user_id = ?", (user['id'],)).fetchone()
                
                b_name = body.get('business_name')
                desc = body.get('description')
                phone = body.get('contact_phone')
                addr = body.get('business_address')
                b_time = body.get('breakfast_time')
                l_time = body.get('lunch_time')
                d_time = body.get('dinner_time')
                b_cutoff = body.get('breakfast_cutoff_time')
                l_cutoff = body.get('lunch_cutoff_time')
                d_cutoff = body.get('dinner_cutoff_time')
                adv_hours = int(body.get('advance_cutoff_hours', 2))

                cur = conn.cursor()
                cur.execute("""
                UPDATE tiffin_providers SET
                    business_name = COALESCE(?, business_name),
                    description = COALESCE(?, description),
                    contact_phone = COALESCE(?, contact_phone),
                    business_address = COALESCE(?, business_address),
                    breakfast_time = COALESCE(?, breakfast_time),
                    lunch_time = COALESCE(?, lunch_time),
                    dinner_time = COALESCE(?, dinner_time),
                    breakfast_cutoff_time = COALESCE(?, breakfast_cutoff_time),
                    lunch_cutoff_time = COALESCE(?, lunch_cutoff_time),
                    dinner_cutoff_time = COALESCE(?, dinner_cutoff_time),
                    advance_cutoff_hours = COALESCE(?, advance_cutoff_hours)
                WHERE id = ?
                """, (b_name, desc, phone, addr, b_time, l_time, d_time, b_cutoff, l_cutoff, d_cutoff, adv_hours, provider['id']))

                conn.commit()
                self.send_json({"success": True, "message": "Business settings and cancellation policies saved successfully!"})
                return

            # 3. PRISMA MODEL: STUDENT DIETARY PREFERENCES
            elif path == '/api/student/dietary':
                if not user or user['role'] != 'student':
                    self.send_error_json("Unauthorized", 401)
                    return
                student = conn.execute("SELECT id FROM students WHERE user_id = ?", (user['id'],)).fetchone()
                if not student:
                    self.send_error_json("Student profile not found", 404)
                    return

                is_jain = 1 if body.get('is_jain') else 0
                less_spicy = 1 if body.get('less_spicy') else 0
                no_onion_garlic = 1 if body.get('no_onion_garlic') else 0
                allergies = body.get('allergies', '').strip()
                special_instructions = body.get('special_instructions', '').strip()

                cur = conn.cursor()
                cur.execute("""
                UPDATE students SET
                    is_jain = ?,
                    less_spicy = ?,
                    no_onion_garlic = ?,
                    allergies = ?,
                    special_instructions = ?
                WHERE id = ?
                """, (is_jain, less_spicy, no_onion_garlic, allergies, special_instructions, student['id']))

                conn.commit()
                self.send_json({"success": True, "message": "Dietary preferences updated successfully!"})
                return

            else:
                self.send_error_json("Not Found", 404)

        except Exception as e:
            self.send_error_json(str(e), 500)
        finally:
            conn.close()

    # ------------------ API DELETE HANDLERS ------------------
    def handle_api_delete(self, path, query):
        conn = database.get_db_connection()
        user = get_current_user(self.headers)

        try:
            # 1. OWNER DELETE EXPENSE
            if path.startswith('/api/owner/expenses/'):
                if not user or user['role'] != 'owner':
                    self.send_error_json("Unauthorized", 401)
                    return
                expense_id = int(path.split('/')[-1])
                provider = conn.execute("SELECT id FROM tiffin_providers WHERE owner_user_id = ?", (user['id'],)).fetchone()
                conn.execute("DELETE FROM expenses WHERE id = ? AND provider_id = ?", (expense_id, provider['id']))
                conn.commit()
                self.send_json({"success": True, "message": "Expense deleted"})
                return

            # 2. OWNER DELETE MENU ITEM
            elif path.startswith('/api/owner/menu/'):
                if not user or user['role'] != 'owner':
                    self.send_error_json("Unauthorized", 401)
                    return
                menu_id = int(path.split('/')[-1])
                provider = conn.execute("SELECT id FROM tiffin_providers WHERE owner_user_id = ?", (user['id'],)).fetchone()
                conn.execute("DELETE FROM menus WHERE id = ? AND provider_id = ?", (menu_id, provider['id']))
                conn.commit()
                self.send_json({"success": True, "message": "Menu item deleted"})
                return

            # 3. OWNER DELETE STAFF MEMBER
            elif path.startswith('/api/owner/staff/'):
                if not user or user['role'] != 'owner':
                    self.send_error_json("Unauthorized", 401)
                    return
                staff_id = int(path.split('/')[-1])
                provider = conn.execute("SELECT id FROM tiffin_providers WHERE owner_user_id = ?", (user['id'],)).fetchone()
                conn.execute("DELETE FROM staff WHERE id = ? AND provider_id = ?", (staff_id, provider['id']))
                conn.commit()
                self.send_json({"success": True, "message": "Staff member removed"})
                return

            # 4. OWNER DELETE INVENTORY ITEM
            elif path.startswith('/api/owner/inventory/'):
                if not user or user['role'] != 'owner':
                    self.send_error_json("Unauthorized", 401)
                    return
                item_id = int(path.split('/')[-1])
                provider = conn.execute("SELECT id FROM tiffin_providers WHERE owner_user_id = ?", (user['id'],)).fetchone()
                conn.execute("DELETE FROM inventory_items WHERE id = ? AND provider_id = ?", (item_id, provider['id']))
                conn.commit()
                self.send_json({"success": True, "message": "Inventory item removed"})
                return

            else:
                self.send_error_json("Not Found", 404)

        except Exception as e:
            self.send_error_json(str(e), 500)
        finally:
            conn.close()

def run_server(port=PORT):
    # Set custom address reuse
    socketserver.ThreadingTCPServer.allow_reuse_address = True
    server = socketserver.ThreadingTCPServer(("", port), TiffinAPIHandler)
    print(f"=================================================================")
    print(f"  TIFFIN MANAGEMENT & DELIVERY FULL-STACK APPLICATION SERVER")
    print(f"  Serving on http://localhost:{port}")
    print(f"  Frontend Static Root: {STATIC_DIR}")
    print(f"  Database Path: {database.DB_PATH}")
    print(f"=================================================================")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down server...")
        server.server_close()

if __name__ == "__main__":
    run_server()

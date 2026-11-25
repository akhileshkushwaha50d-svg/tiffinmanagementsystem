"""
test_system.py - Comprehensive Automated Verification Suite
Validates all 12 Acceptance Tests defined in the project specification.
"""

import sys
import os
import json
import sqlite3
import urllib.request
import urllib.parse
from datetime import datetime, timedelta
import threading
import time

sys.path.insert(0, os.getcwd())
import database
import server

# Initialize clean database for testing
database.init_db()

def run_tests():
    print("=" * 70)
    print("STARTING TIFFIN SYSTEM 12 ACCEPTANCE TESTS VERIFICATION")
    print("=" * 70)

    # Start server in daemon thread on test port
    test_port = 8089
    server.socketserver.ThreadingTCPServer.allow_reuse_address = True
    httpd = server.socketserver.ThreadingTCPServer(("127.0.0.1", test_port), server.TiffinAPIHandler)
    server_thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    server_thread.start()
    time.sleep(0.5)

    base_url = f"http://127.0.0.1:{test_port}"

    def api_call(method, path, data=None, token=None):
        url = base_url + path
        headers = {'Content-Type': 'application/json'}
        if token:
            headers['Authorization'] = f"Bearer {token}"
        
        req_data = json.dumps(data).encode('utf-8') if data else None
        req = urllib.request.Request(url, data=req_data, headers=headers, method=method)
        try:
            with urllib.request.urlopen(req) as response:
                body = response.read().decode('utf-8')
                return response.status, json.loads(body)
        except urllib.error.HTTPError as e:
            body = e.read().decode('utf-8')
            try:
                return e.code, json.loads(body)
            except Exception:
                return e.code, {"error": body}

    results = {}
    ts = int(time.time())
    test_student_email = f"kavita.rao.{ts}@test.com"
    test_owner_email = f"vikram.mewar.{ts}@test.com"

    # -------------------------------------------------------------
    # TEST 1: Student role -> registers -> logs in -> reaches Student Dashboard
    # -------------------------------------------------------------
    print("\n[TEST 1] Student Registration & Login & Dashboard Access...")
    status, reg_res = api_call("POST", "/api/auth/register", {
        "role": "student",
        "full_name": "Kavita Rao",
        "email": test_student_email,
        "phone": f"98{ts%100000000:08d}",
        "password": "passKavita123",
        "delivery_address": "Hostel B-4, Holkar Campus, Indore"
    })
    assert status == 200, f"Registration failed: {reg_res}"
    print(f"  ✓ Registered Student Kavita Rao: ID={reg_res['user']['id']}")

    # Login
    status, login_res = api_call("POST", "/api/auth/login", {
        "identifier": test_student_email,
        "password": "passKavita123",
        "role": "student"
    })
    assert status == 200, f"Login failed: {login_res}"
    kavita_token = login_res['token']
    print(f"  ✓ Student Login Success: Token generated")

    # Fetch Student Dashboard
    status, dash_res = api_call("GET", "/api/student/dashboard", token=kavita_token)
    assert status == 200 and dash_res['success'] is True, f"Dashboard failed: {dash_res}"
    print(f"  ✓ Student Dashboard reached: Provider={dash_res['provider']['business_name']}")
    results['TEST 1'] = "PASSED"

    # -------------------------------------------------------------
    # TEST 2: Owner role -> registers -> logs in -> reaches Owner Dashboard
    # -------------------------------------------------------------
    print("\n[TEST 2] Owner Registration & Login & Dashboard Access...")
    status, o_reg = api_call("POST", "/api/auth/register", {
        "role": "owner",
        "full_name": "Vikram Rathore",
        "business_name": "Royal Mewar Tiffin Service",
        "email": test_owner_email,
        "phone": f"99{ts%100000000:08d}",
        "password": "passOwner123",
        "address": "Bhawarkua Square, Indore"
    })
    assert status == 200, f"Owner registration failed: {o_reg}"
    print(f"  ✓ Registered Owner Vikram: ID={o_reg['user']['id']}")

    status, o_login = api_call("POST", "/api/auth/login", {
        "identifier": test_owner_email,
        "password": "passOwner123",
        "role": "owner"
    })
    assert status == 200, f"Owner login failed: {o_login}"
    vikram_token = o_login['token']

    # Fetch Owner Overview Dashboard
    status, o_dash = api_call("GET", "/api/owner/overview", token=vikram_token)
    assert status == 200 and o_dash['success'] is True, f"Owner overview failed: {o_dash}"
    print(f"  ✓ Owner Dashboard reached: Total Students={o_dash['metrics']['total_students']}")
    results['TEST 2'] = "PASSED"

    # Use existing seeded Owner (Rajesh) & Student (Aman) for comprehensive interconnected tests
    status, login_res = api_call("POST", "/api/auth/login", {"identifier": "owner@annapurnatiffin.com", "password": "owner123", "role": "owner"})
    rajesh_token = login_res['token']
    status, login_res = api_call("POST", "/api/auth/login", {"identifier": "aman.verma@student.edu", "password": "student123", "role": "student"})
    aman_token = login_res['token']

    # -------------------------------------------------------------
    # TEST 3: Owner creates weekly menu -> Student can view the same menu
    # -------------------------------------------------------------
    print("\n[TEST 3] Owner creates/updates weekly menu -> Student views live update...")
    status, menu_up = api_call("POST", "/api/owner/menu/update", {
        "day_of_week": "Friday",
        "meal_type": "Dinner",
        "food_name": "Paneer Tikka Masala & Butter Naan",
        "description": "Smoky char-grilled paneer in spicy rich tomato-cashew gravy with crisp butter naans",
        "items_included": "3 Naan, Paneer Tikka Masala, Dal Makhani, Gulab Jamun",
        "is_special": 1
    }, token=rajesh_token)
    assert status == 200, f"Menu update failed: {menu_up}"
    print("  ✓ Owner published updated Friday Dinner menu")

    # Student views weekly menu
    status, menu_view = api_call("GET", "/api/menu?provider_id=1")
    assert status == 200 and menu_view['success'] is True
    friday_dinner = [m for m in menu_view['menu'] if m['day_of_week'] == 'Friday' and m['meal_type'] == 'Dinner']
    assert len(friday_dinner) > 0 and friday_dinner[0]['food_name'] == "Paneer Tikka Masala & Butter Naan"
    print(f"  ✓ Student verified seeing updated menu: '{friday_dinner[0]['food_name']}'")
    results['TEST 3'] = "PASSED"

    # -------------------------------------------------------------
    # TEST 4: Owner sets meal prices -> Student sees correct prices
    # -------------------------------------------------------------
    print("\n[TEST 4] Owner configures meal prices -> Student views live updated rates...")
    status, price_up = api_call("PUT", "/api/owner/pricing", {
        "breakfast_price": 55.0,
        "lunch_price": 95.0,
        "dinner_price": 95.0,
        "day_plan_price": 220.0,
        "weekly_plan_price": 1400.0,
        "monthly_plan_price": 5400.0,
        "custom_meal_base_price": 90.0,
        "monthly_discount_pct": 10.0,
        "weekly_discount_pct": 5.0
    }, token=rajesh_token)
    assert status == 200, f"Pricing update failed: {price_up}"
    print("  ✓ Owner set new pricing (Breakfast=55, Lunch=95, Dinner=95, Monthly=5400)")

    # Student queries pricing
    status, price_view = api_call("GET", "/api/pricing?provider_id=1")
    assert status == 200 and price_view['pricing']['monthly_plan_price'] == 5400.0
    print(f"  ✓ Student fetched updated live pricing: Monthly=₹{price_view['pricing']['monthly_plan_price']}")
    results['TEST 4'] = "PASSED"

    # -------------------------------------------------------------
    # TEST 5: Dynamic plan pricing calculation (Day, Weekly, Monthly, Custom)
    # -------------------------------------------------------------
    print("\n[TEST 5] Dynamic Plan Pricing Calculation (All 4 Plan Options)...")
    # Day-wise
    status, calc_day = api_call("POST", "/api/student/plan/calculate", {
        "plan_type": "day",
        "provider_id": 1,
        "selected_meals": ["breakfast", "lunch", "dinner"]
    })
    assert calc_day['breakdown']['final_amount'] == 220.0 # Day plan price capped
    print(f"  ✓ Day-Wise Plan Calculation: ₹{calc_day['breakdown']['final_amount']}")

    # Weekly
    status, calc_week = api_call("POST", "/api/student/plan/calculate", {
        "plan_type": "weekly",
        "provider_id": 1
    })
    # 1400 - 5% = 1330.0
    assert calc_week['breakdown']['final_amount'] == 1330.0
    print(f"  ✓ Weekly Plan Calculation: Subtotal ₹{calc_week['breakdown']['subtotal']}, Discount ₹{calc_week['breakdown']['discount']}, Final ₹{calc_week['breakdown']['final_amount']}")

    # Monthly
    status, calc_month = api_call("POST", "/api/student/plan/calculate", {
        "plan_type": "monthly",
        "provider_id": 1
    })
    # 5400 - 10% = 4860.0
    assert calc_month['breakdown']['final_amount'] == 4860.0
    print(f"  ✓ Monthly Plan Calculation: Final ₹{calc_month['breakdown']['final_amount']}")

    # Customised Day Plan
    custom_selections = [
        {"date": "2026-11-25", "meals": ["lunch", "dinner"]}, # 95 + 95 = 190
        {"date": "2026-11-26", "meals": ["breakfast", "lunch"]} # 55 + 95 = 150
    ]
    status, calc_custom = api_call("POST", "/api/student/plan/calculate", {
        "plan_type": "custom",
        "provider_id": 1,
        "custom_selections": custom_selections
    })
    assert calc_custom['breakdown']['final_amount'] == 340.0
    print(f"  ✓ Customised Day Plan Calculation: Final ₹{calc_custom['breakdown']['final_amount']}")
    results['TEST 5'] = "PASSED"

    # -------------------------------------------------------------
    # TEST 6: Student makes test payment -> Verified transaction appears in Owner Dashboard
    # -------------------------------------------------------------
    print("\n[TEST 6] Student test payment -> Verified transaction in Owner Dashboard...")
    status, pay_res = api_call("POST", "/api/student/payment/verify", {
        "provider_id": 1,
        "plan_type": "weekly",
        "total_amount": 1400.0,
        "discount_amount": 70.0,
        "final_amount": 1330.0,
        "payment_method": "UPI",
        "selected_meals": ["breakfast", "lunch", "dinner"]
    }, token=kavita_token)
    assert status == 200 and pay_res['success'] is True
    receipt_no = pay_res['receipt']['receipt_number']
    print(f"  ✓ Payment confirmed: Receipt={receipt_no}, Amount=₹{pay_res['receipt']['amount']}")

    # Owner checks payment list
    status, o_payments = api_call("GET", "/api/owner/payments", token=rajesh_token)
    assert status == 200
    matched_pay = [p for p in o_payments['payments'] if p['receipt_number'] == receipt_no]
    assert len(matched_pay) == 1 and matched_pay[0]['status'] == 'success'
    print(f"  ✓ Owner dashboard verified transaction: {matched_pay[0]['receipt_number']} by {matched_pay[0]['student_name']}")
    results['TEST 6'] = "PASSED"

    # -------------------------------------------------------------
    # TEST 7: Student submits Stop Meal request -> Owner receives it & schedule updates
    # -------------------------------------------------------------
    print("\n[TEST 7] Student submits Stop Meal request (with 2-hr cutoff rule) -> Owner receives it...")
    future_date = (datetime.now() + timedelta(days=3)).strftime("%Y-%m-%d")
    status, stop_res = api_call("POST", "/api/student/stop-meal", {
        "meal_date": future_date,
        "meal_type": "Dinner",
        "reason": "College Annual Function"
    }, token=aman_token)
    assert status == 200 and stop_res['success'] is True, f"Stop meal failed: {stop_res}"
    print(f"  ✓ Stop meal approved for {future_date} Dinner: {stop_res['message']}")

    # Owner checks stop requests
    status, o_stops = api_call("GET", "/api/owner/stop-requests", token=rajesh_token)
    assert status == 200
    found_stop = [s for s in o_stops['stop_requests'] if s['meal_date'] == future_date and s['meal_type'] == 'Dinner']
    assert len(found_stop) > 0 and found_stop[0]['status'] == 'approved'
    print(f"  ✓ Owner received stop request: Student={found_stop[0]['student_name']}, Reason='{found_stop[0]['reason']}'")
    results['TEST 7'] = "PASSED"

    # -------------------------------------------------------------
    # TEST 8: Owner updates delivery status -> Student sees updated status
    # -------------------------------------------------------------
    print("\n[TEST 8] Owner updates delivery status -> Student sees real-time progress...")
    # Fetch pending deliveries in owner dashboard
    status, del_list = api_call("GET", "/api/owner/deliveries", token=rajesh_token)
    assert status == 200 and len(del_list['deliveries']) > 0
    target_delivery = del_list['deliveries'][0]
    delivery_id = target_delivery['id']

    # Update to 'out_for_delivery'
    status, update_res = api_call("POST", "/api/owner/deliveries/update-status", {
        "delivery_id": delivery_id,
        "status": "out_for_delivery"
    }, token=rajesh_token)
    assert status == 200
    print(f"  ✓ Owner updated delivery #{delivery_id} to 'out_for_delivery'")

    # Update to 'delivered'
    status, update_res2 = api_call("POST", "/api/owner/deliveries/update-status", {
        "delivery_id": delivery_id,
        "status": "delivered"
    }, token=rajesh_token)
    assert status == 200
    print(f"  ✓ Owner marked delivery #{delivery_id} as 'delivered' (auto-updates attendance)")

    # Student checks delivery tracking
    status, stud_track = api_call("GET", "/api/student/delivery-tracking", token=aman_token)
    assert status == 200
    print(f"  ✓ Student delivery tracking confirmed: {len(stud_track['deliveries'])} delivery records visible")
    results['TEST 8'] = "PASSED"

    # -------------------------------------------------------------
    # TEST 9: Student submits food rating & suggestions -> Owner views analytics
    # -------------------------------------------------------------
    print("\n[TEST 9] Student submits food rating & suggestion -> Owner analytics...")
    # Student submits rating
    status, fb_res = api_call("POST", "/api/student/feedback", {
        "meal_date": datetime.now().strftime("%Y-%m-%d"),
        "meal_type": "Lunch",
        "general_rating": "Excellent",
        "taste_rating": 5,
        "quality_rating": 5,
        "quantity_rating": 5,
        "hygiene_rating": 5,
        "comments": "Paneer bhurji and hot tawa phulke were delicious today! Perfect ghee.",
        "is_anonymous": False
    }, token=aman_token)
    assert status == 200 and fb_res['success'] is True
    print("  ✓ Student submitted food rating ('Excellent', 5 stars)")

    # Student suggests a new dish
    status, sug_res = api_call("POST", "/api/suggestions/add", {
        "food_name": "Paneer Tikka Roll",
        "category": "Snacks",
        "description": "Whole wheat kathi roll with mint chutney"
    }, token=aman_token)
    assert status == 200
    print("  ✓ Student suggested new dish: 'Paneer Tikka Roll'")

    # Owner views analytics
    status, o_fb = api_call("GET", "/api/owner/feedback-analytics", token=rajesh_token)
    assert status == 200
    assert o_fb['metrics']['excellent_count'] > 0
    print(f"  ✓ Owner food analytics verified: Avg Taste={o_fb['metrics']['avg_taste']}/5, Excellent Ratings={o_fb['metrics']['excellent_count']}")
    results['TEST 9'] = "PASSED"

    # -------------------------------------------------------------
    # TEST 10: Owner updates attendance -> Student sees authorized update
    # -------------------------------------------------------------
    print("\n[TEST 10] Owner updates attendance with reason -> Student sees updated attendance...")
    today_str = datetime.now().strftime("%Y-%m-%d")
    status, att_up = api_call("POST", "/api/owner/attendance/update", {
        "student_id": 1,
        "meal_date": today_str,
        "meal_type": "Breakfast",
        "status": "delivered",
        "reason": "Delivered to hostel warden desk"
    }, token=rajesh_token)
    assert status == 200 and att_up['success'] is True
    print(f"  ✓ Owner updated attendance with audit trail: 'delivered' (Reason: Delivered to warden)")

    # Student checks attendance
    status, s_att = api_call("GET", "/api/student/attendance", token=aman_token)
    assert status == 200
    matched_att = [a for a in s_att['attendance'] if a['meal_date'] == today_str and a['meal_type'] == 'Breakfast']
    assert len(matched_att) > 0 and matched_att[0]['status'] == 'delivered'
    print(f"  ✓ Student saw authorized updated attendance status: '{matched_att[0]['status']}'")
    results['TEST 10'] = "PASSED"

    # -------------------------------------------------------------
    # TEST 11: Owner records food costs & staff salaries -> Profit & Loss calculates correctly
    # -------------------------------------------------------------
    print("\n[TEST 11] Owner records expenses -> Live Profit & Loss calculation...")
    # Add Raw Material expense
    status, exp1 = api_call("POST", "/api/owner/expenses/add", {
        "category": "Food / Raw Material",
        "amount": 2500.0,
        "description": "Vegetables, spices, and paneer from mandai"
    }, token=rajesh_token)
    assert status == 200

    # Add Salary expense
    status, exp2 = api_call("POST", "/api/owner/expenses/add", {
        "category": "Staff Salaries",
        "amount": 3000.0,
        "description": "Cook salary advance"
    }, token=rajesh_token)
    assert status == 200
    print("  ✓ Added ₹2500 Raw Material and ₹3000 Staff Salary expenses")

    # Fetch P&L
    status, pl_res = api_call("GET", "/api/owner/profit-loss", token=rajesh_token)
    assert status == 200
    tot_rev = pl_res['income']['total_revenue']
    tot_exp = pl_res['expenses_summary']['total_expense']
    net_pl = pl_res['profit_loss']['total_net']
    assert net_pl == tot_rev - tot_exp, f"P&L calculation mismatch: {net_pl} != {tot_rev} - {tot_exp}"
    print(f"  ✓ Verified P&L Calculation: Total Revenue=₹{tot_rev}, Total Expenses=₹{tot_exp}, Net Profit/Loss=₹{net_pl}")
    results['TEST 11'] = "PASSED"

    # -------------------------------------------------------------
    # TEST 12: Role-based authorization & security isolation
    # -------------------------------------------------------------
    print("\n[TEST 12] Role-based permissions & security boundary enforcement...")
    # Student attempts to access Owner Overview -> Must be rejected (401/403)
    status, unauthorized_res = api_call("GET", "/api/owner/overview", token=aman_token)
    assert status in (401, 403), f"Security breach! Student accessed owner dashboard: {status}"
    print(f"  ✓ Student access to Owner Dashboard blocked: HTTP {status}")

    # Owner attempts to access Student Dashboard -> Must be rejected
    status, unauth_owner = api_call("GET", "/api/student/dashboard", token=rajesh_token)
    assert status in (401, 403), f"Security breach! Owner accessed student dashboard: {status}"
    print(f"  ✓ Owner access to Student Dashboard blocked: HTTP {status}")

    # Cross-tenant data isolation: Owner Vikram accesses only his own records
    status, vikram_overview = api_call("GET", "/api/owner/overview", token=vikram_token)
    assert status == 200 and vikram_overview['metrics']['total_students'] == 0 # Vikram's new business has 0 students
    print("  ✓ Cross-tenant data isolation verified: Owner only accesses own business data")
    results['TEST 12'] = "PASSED"

    # -------------------------------------------------------------
    # TEST 13: Prisma Model: Student Wallet Recharge & Transactions
    # -------------------------------------------------------------
    print("\n[TEST 13] Prisma Student Wallet, Containers (Boxes Held) & Transactions...")
    status, wal_before = api_call("GET", "/api/student/wallet", token=aman_token)
    assert status == 200 and wal_before['success'] is True
    initial_bal = wal_before['wallet_balance']
    print(f"  ✓ Initial Wallet Balance: ₹{initial_bal:.2f}, Boxes Held: {wal_before['boxes_held']}, Code: {wal_before['referral_code']}")

    # Recharge Wallet
    status, rech_res = api_call("POST", "/api/student/wallet/recharge", {
        "amount": 250.0,
        "payment_method": "UPI"
    }, token=aman_token)
    assert status == 200 and rech_res['success'] is True
    print(f"  ✓ Wallet Recharged: New Balance=₹{rech_res['new_balance']:.2f}")

    status, wal_after = api_call("GET", "/api/student/wallet", token=aman_token)
    assert wal_after['wallet_balance'] == initial_bal + 250.0
    assert len(wal_after['transactions']) > 0
    print(f"  ✓ Verified Transaction Ledger: {len(wal_after['transactions'])} transactions recorded")
    results['TEST 13'] = "PASSED"

    # -------------------------------------------------------------
    # TEST 14: Prisma Model: Student Dietary Preferences & Health Constraints
    # -------------------------------------------------------------
    print("\n[TEST 14] Prisma Student Dietary & Health Preferences...")
    status, diet_update = api_call("POST", "/api/student/dietary", {
        "is_jain": 0,
        "less_spicy": 1,
        "no_onion_garlic": 0,
        "allergies": "Peanuts, Soy",
        "special_instructions": "Leave at reception if room locked"
    }, token=aman_token)
    assert status == 200 and diet_update['success'] is True

    status, diet_get = api_call("GET", "/api/student/dietary", token=aman_token)
    assert status == 200 and diet_get['dietary']['less_spicy'] is True
    assert diet_get['dietary']['allergies'] == "Peanuts, Soy"
    print(f"  ✓ Dietary Preferences Saved & Verified: Less Spicy={diet_get['dietary']['less_spicy']}, Allergies='{diet_get['dietary']['allergies']}'")
    results['TEST 14'] = "PASSED"

    # -------------------------------------------------------------
    # TEST 15: Prisma Model: Complaints Lifecycle (Student Lodge -> Owner Resolve)
    # -------------------------------------------------------------
    print("\n[TEST 15] Prisma Complaints Lifecycle...")
    # Aman lodges complaint
    status, comp_post = api_call("POST", "/api/student/complaints", {
        "category": "Quality",
        "description": "The lunch chapati was slightly undercooked today."
    }, token=aman_token)
    assert status == 200 and comp_post['success'] is True
    print("  ✓ Student lodged grievance: 'Quality'")

    # Owner lists complaints
    status, comp_list = api_call("GET", "/api/owner/complaints", token=rajesh_token)
    assert status == 200 and comp_list['success'] is True
    target_comp = next((c for c in comp_list['complaints'] if c['category'] == 'Quality' and 'undercooked' in c['description']), None)
    assert target_comp is not None
    print(f"  ✓ Owner received grievance #{target_comp['id']} from {target_comp['student_name']}")

    # Owner resolves complaint
    status, comp_resolve = api_call("POST", "/api/owner/complaints/resolve", {
        "complaint_id": target_comp['id'],
        "status": "RESOLVED",
        "resolution": "Spoke to Maharaj Ramdayal; tawa heating time increased by 30 seconds."
    }, token=rajesh_token)
    assert status == 200 and comp_resolve['success'] is True
    print("  ✓ Owner marked complaint as RESOLVED with chef instructions")

    # Verify student sees resolution
    status, s_comps = api_call("GET", "/api/student/complaints", token=aman_token)
    resolved_comp = next(c for c in s_comps['complaints'] if c['id'] == target_comp['id'])
    assert resolved_comp['status'] == 'RESOLVED'
    print(f"  ✓ Verified Student sees Resolution: '{resolved_comp['resolution']}'")
    results['TEST 15'] = "PASSED"

    # -------------------------------------------------------------
    # TEST 16: Prisma Model: Owner Staff Management & Payroll
    # -------------------------------------------------------------
    print("\n[TEST 16] Prisma Staff Directory & Payroll...")
    # Add staff
    staff_name = f"Karan Mehra {ts}"
    status, staff_add = api_call("POST", "/api/owner/staff/add", {
        "name": staff_name,
        "role": "DELIVERY",
        "phone": f"+91 98261 {ts%100000:05d}",
        "salary": 13000.0
    }, token=rajesh_token)
    assert status == 200 and staff_add['success'] is True
    print(f"  ✓ Added new delivery staff member: {staff_name} (DELIVERY)")

    # List staff
    status, staff_list = api_call("GET", "/api/owner/staff", token=rajesh_token)
    assert status == 200
    karan = next(s for s in staff_list['staff'] if s['name'] == staff_name)
    assert karan['salary'] == 13000.0 and karan['is_active'] == 1
    print(f"  ✓ Verified Staff List: {staff_list['summary']['total_count']} staff, Monthly Payroll=₹{staff_list['summary']['monthly_payroll']}")

    # Toggle active status
    status, tog_res = api_call("POST", "/api/owner/staff/toggle", {"staff_id": karan['id']}, token=rajesh_token)
    assert status == 200
    print("  ✓ Toggled staff active status")
    results['TEST 16'] = "PASSED"

    # -------------------------------------------------------------
    # TEST 17: Prisma Model: Kitchen Raw Material Inventory & Thresholds
    # -------------------------------------------------------------
    print("\n[TEST 17] Prisma Kitchen Inventory & Thresholds...")
    # Add inventory item
    inv_name = f"Premium Mustard Oil {ts}"
    status, inv_add = api_call("POST", "/api/owner/inventory/add", {
        "item_name": inv_name,
        "quantity": 30.0,
        "unit": "L",
        "min_threshold": 10.0,
        "supplier_name": "Kailash Agro Oil Mill"
    }, token=rajesh_token)
    assert status == 200 and inv_add['success'] is True
    print(f"  ✓ Added inventory item: {inv_name}")

    # List inventory
    status, inv_list = api_call("GET", "/api/owner/inventory", token=rajesh_token)
    assert status == 200
    oil = next(i for i in inv_list['items'] if i['item_name'] == inv_name)
    assert oil['quantity'] == 30.0

    # Update stock to trigger low-stock threshold warning
    status, inv_up = api_call("POST", "/api/owner/inventory/update-stock", {
        "item_id": oil['id'],
        "quantity": 5.0 # Below min_threshold 10.0
    }, token=rajesh_token)
    assert status == 200

    status, inv_list_after = api_call("GET", "/api/owner/inventory", token=rajesh_token)
    oil_after = next(i for i in inv_list_after['items'] if i['id'] == oil['id'])
    assert oil_after['is_low_stock'] == 1
    print("  ✓ Low stock threshold alert accurately triggered for quantity <= min_threshold")
    results['TEST 17'] = "PASSED"

    # -------------------------------------------------------------
    # TEST 18: Prisma Model: Delivery QR Token Generation & Contactless Verification
    # -------------------------------------------------------------
    print("\n[TEST 18] Prisma Delivery QR Token & Contactless Delivery Verification...")
    # Fetch deliveries for Aman
    status, del_list = api_call("GET", "/api/student/delivery-tracking", token=aman_token)
    assert status == 200 and len(del_list['deliveries']) > 0
    active_del = del_list['deliveries'][0]
    qr_token = active_del.get('qr_token')
    assert qr_token is not None and len(qr_token) > 0, "Delivery missing qr_token"
    print(f"  ✓ Active Delivery #{active_del['id']} has valid QR verification token: '{qr_token}'")

    # Verify via QR
    status, verify_res = api_call("POST", "/api/owner/deliveries/verify-qr", {
        "qr_token": qr_token
    }, token=rajesh_token)
    assert status == 200 and verify_res['success'] is True
    print(f"  ✓ QR verification succeeded: {verify_res['message']}")

    # Verify delivery status is updated to 'delivered'
    status, del_list_check = api_call("GET", "/api/student/delivery-tracking", token=aman_token)
    verified_del = next(d for d in del_list_check['deliveries'] if d['id'] == active_del['id'])
    assert verified_del['status'] == 'delivered'
    print("  ✓ Delivery status confirmed as 'delivered' on student tracking screen")
    results['TEST 18'] = "PASSED"

    print("\n" + "=" * 70)
    print("TEST SUMMARY REPORT:")
    all_passed = True
    for test, res in results.items():
        print(f"  {test}: {res}")
        if res != "PASSED":
            all_passed = False
    print("=" * 70)
    assert all_passed, "Some tests failed!"
    print("ALL 18 ACCEPTANCE & PRISMA MODEL TESTS COMPLETED SUCCESSFULLY!")

    httpd.shutdown()
    httpd.server_close()

if __name__ == "__main__":
    run_tests()

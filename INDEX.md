# 📖 PROJECT MASTER INDEX: Complete Tiffin Management & Delivery Web Application

This document serves as the **Master Architectural Index, Schema Registry, and Component Directory** for the entire project. It indexes all frontend views, backend Python services, Prisma PostgreSQL & SQLite schemas, REST API endpoints, and live cross-dashboard interconnections.

---

## 🗂️ 1. Complete File Directory & Component Manifest

| File / Path | Type | Technology | Purpose & Capabilities |
|---|---|---|---|
| [`index.html`](file:///c:/Users/akhil/Downloads/0808/index.html) | Root SPA Entry | HTML5 / Vanilla JS | Master Single Page Application entrypoint for root directory. Can be opened directly (`file:///`) or served via HTTP. |
| [`static/index.html`](file:///c:/Users/akhil/Downloads/0808/static/index.html) | Static Shell | HTML5 / Vanilla JS | Application shell inside `static/` with role selection, auth, student portal, owner portal, and modal dialogs. |
| [`static/css/style.css`](file:///c:/Users/akhil/Downloads/0808/static/css/style.css) | Stylesheet | CSS3 | Complete responsive design system (Emerald green `#059669`, clean cards, tables, trackers, emoji buttons, modals). |
| [`static/js/app.js`](file:///c:/Users/akhil/Downloads/0808/static/js/app.js) | App Core | JavaScript | View switching, global toast notifications, drawer orchestration, and mobile sidebar toggle. |
| [`static/js/api.js`](file:///c:/Users/akhil/Downloads/0808/static/js/api.js) | API Client | JavaScript | Full REST API client with Bearer token authentication and integrated `LocalFallback` offline state simulation. |
| [`static/js/auth.js`](file:///c:/Users/akhil/Downloads/0808/static/js/auth.js) | Auth Logic | JavaScript | Role selection, login/registration validation, Google Auth simulation, password eye toggles, and demo auto-fill chips. |
| [`static/js/student.js`](file:///c:/Users/akhil/Downloads/0808/static/js/student.js) | Student Portal | JavaScript | All 15 student modules: Home, Hotel profile, 4 Meal plans, Checkout, Weekly menu, Food voting, Khana rating, Attendance calendar, Stop meal (2-hr rule), Tracking (with QR Token), Wallet & Rewards, Dietary Preferences, Grievances, Profile. |
| [`static/js/owner.js`](file:///c:/Users/akhil/Downloads/0808/static/js/owner.js) | Owner Portal | JavaScript | All 15 owner modules: 12 Metrics overview, Student directory, Active tiffins, Menu editor & publisher, Price manager, Attendance audit, Stop requests, Dispatch & QR Verification, Collections, Feedback analytics, P&L, Staff & Salaries, Kitchen Inventory, Grievance Resolutions, Settings. |
| [`static/js/charts.js`](file:///c:/Users/akhil/Downloads/0808/static/js/charts.js) | Visualization | HTML5 Canvas | Zero-dependency responsive Canvas chart renderer for Bar charts, Line charts, and Doughnut charts. |
| [`prisma/schema.prisma`](file:///c:/Users/akhil/Downloads/0808/prisma/schema.prisma) | ORM Schema | Prisma / PostgreSQL | Master Prisma schema defining all 18 models (`User`, `TiffinProvider`, `StudentProfile`, `Subscription`, `Menu`, `MenuItem`, `StopMealRequest`, `Delivery`, `Payment`, `WalletTransaction`, `Feedback`, `FoodSuggestion`, `Vote`, `Complaint`, `InventoryItem`, `Expense`, `Staff`, `Notification`, `AuditLog`). |
| [`prisma/schema.sql`](file:///c:/Users/akhil/Downloads/0808/prisma/schema.sql) | DDL Migration | PostgreSQL SQL | Complete production PostgreSQL DDL with enums, constraints, foreign keys, and performant indexes. |
| [`server.py`](file:///c:/Users/akhil/Downloads/0808/server.py) | Backend Server | Python 3 | Multithreaded REST API server + Static file server using standard library `http.server`. Zero external pip dependencies. |
| [`database.py`](file:///c:/Users/akhil/Downloads/0808/database.py) | Database Layer | Python / SQLite | Relational SQLite database manager, table definitions, foreign keys, migrations, password hashing, and realistic seed data. |
| [`data/tiffin.db`](file:///c:/Users/akhil/Downloads/0808/data/tiffin.db) | Relational DB | SQLite 3 | Relational database file storing all live application state and Prisma addon tables. |
| [`test_system.py`](file:///c:/Users/akhil/Downloads/0808/test_system.py) | Test Suite | Python | Comprehensive automated test script validating all 18 Acceptance & Prisma tests. |
| [`start_server.bat`](file:///c:/Users/akhil/Downloads/0808/start_server.bat) | Windows Launcher | Batch Script | 1-click Windows batch launcher that starts the Python server and opens `http://localhost:8000` in the default browser. |
| [`INDEX.md`](file:///c:/Users/akhil/Downloads/0808/INDEX.md) | Master Index | Markdown | Master architectural blueprint, database index, API directory, and cross-dashboard synchronization matrix. |
| [`project_index.json`](file:///c:/Users/akhil/Downloads/0808/project_index.json) | Metadata Index | JSON | Machine-readable project metadata, components, and endpoint manifests. |

---

## 🗄️ 2. Database Schema Index (22 Relational SQL Tables & Models)

All tables reside in [`data/tiffin.db`](file:///c:/Users/akhil/Downloads/0808/data/tiffin.db) and mirror the Prisma schema defined in [`prisma/schema.prisma`](file:///c:/Users/akhil/Downloads/0808/prisma/schema.prisma):

| Table Name | Prisma Model | Primary Key | Foreign Keys | Key Columns | Purpose |
|---|---|---|---|---|---|
| `users` | `User` | `id` | - | `email`, `phone`, `password_hash`, `role`, `full_name`, `address` | Stores user credentials, roles (`student`, `owner`, `admin`), and contact info. |
| `tiffin_providers` | `TiffinProvider` | `id` | `owner_user_id` → `users.id` | `business_name`, `contact_phone`, `breakfast_time`, `lunch_time`, `dinner_time`, `advance_cutoff_hours` | Profiles tiffin centers, meal timings, and cancellation rules. |
| `pricing_config` | - | `id` | `provider_id` → `tiffin_providers.id` | `breakfast_price`, `lunch_price`, `dinner_price`, `day_plan_price`, `weekly_plan_price`, `monthly_plan_price`, `monthly_discount_pct` | Live pricing and discount rules configured by owners. |
| `meal_plans` | - | `id` | `provider_id` → `tiffin_providers.id` | `plan_type`, `name`, `price`, `duration_days`, `discount_percentage`, `included_meals` | Standard meal plan catalog (Day, Weekly, Monthly, Custom). |
| `students` | `StudentProfile` | `id` | `user_id` → `users.id`, `provider_id` → `tiffin_providers.id` | `wallet_balance`, `referral_code`, `reward_points`, `is_jain`, `less_spicy`, `no_onion_garlic`, `allergies`, `special_instructions`, `boxes_held` | Student profiles, wallet balances, physical container tracking, and dietary rules. |
| `menus` | `Menu` | `id` | `provider_id` → `tiffin_providers.id` | `day_of_week`, `meal_type`, `food_name`, `description`, `items_included`, `image_url`, `is_special` | Mon–Sun breakfast, lunch, and dinner food descriptions and photos. |
| `subscriptions` | `Subscription` | `id` | `student_id` → `students.id`, `provider_id` → `tiffin_providers.id` | `plan_type`, `start_date`, `end_date`, `total_amount`, `discount_amount`, `final_amount`, `status` | Active and historical meal subscriptions. |
| `payments` | `Payment` | `id` | `student_id` → `students.id`, `provider_id` → `tiffin_providers.id` | `razorpay_order_id`, `razorpay_payment_id`, `amount`, `payment_method`, `receipt_number`, `status` | Verified payment transactions and generated receipt numbers. |
| `orders` | - | `id` | `student_id` → `students.id`, `subscription_id` → `subscriptions.id` | `meal_date`, `meal_type`, `status` (`scheduled`, `preparing`, `out_for_delivery`, `delivered`, `stopped`) | Daily scheduled meals and order lifecycle. |
| `deliveries` | `Delivery` | `id` | `order_id` → `orders.id`, `student_id` → `students.id` | `meal_date`, `meal_type`, `status`, `delivery_address`, `qr_token`, `delivered_at`, `delivery_person_name`, `estimated_time` | Real-time dispatch, contactless QR token verification, and delivery timestamps. |
| `attendance` | - | `id` | `student_id` → `students.id`, `provider_id` → `tiffin_providers.id` | `meal_date`, `meal_type`, `status` (`present`, `absent`, `meal_stopped`, `delivered`), `correction_reason` | Daily and monthly student meal consumption records. |
| `stop_meal_requests` | `StopMealRequest` | `id` | `student_id` → `students.id`, `provider_id` → `tiffin_providers.id` | `meal_date`, `meal_type`, `cutoff_deadline`, `status`, `reason`, `refund_credit` | 2-hour advance meal stoppage requests and refund ledger. |
| `food_suggestions` | `FoodSuggestion` | `id` | `provider_id` → `tiffin_providers.id`, `student_id` → `students.id` | `food_name`, `category`, `description`, `vote_count` | Student dish suggestions for upcoming special menus. |
| `food_votes` | `Vote` | `id` | `suggestion_id` → `food_suggestions.id`, `student_id` → `students.id` | `voted_at` (UNIQUE constraint on suggestion + student) | Enforces 1 vote per student per dish. |
| `feedback` | `Feedback` | `id` | `student_id` → `students.id`, `provider_id` → `tiffin_providers.id` | `general_rating`, `taste_rating`, `quality_rating`, `quantity_rating`, `hygiene_rating`, `comments`, `owner_response` | "KHANA ACHHA THA AAJ KA?" ratings and owner replies. |
| `expenses` | `Expense` | `id` | `provider_id` → `tiffin_providers.id` | `expense_date`, `category`, `amount`, `description` | Recorded business expenses for Net Profit/Loss calculations. |
| `notifications` | `Notification` | `id` | `user_id` → `users.id` | `title`, `message`, `type`, `is_read`, `link_url` | In-app real-time alerts and unread counters. |
| `audit_logs` | `AuditLog` | `id` | `user_id` → `users.id` | `action`, `entity_type`, `entity_id`, `details` | Audit log of manual attendance corrections and system events. |
| `wallet_transactions` | `WalletTransaction` | `id` | `student_id` → `students.id` | `type` (`CREDIT`, `DEBIT`, `REFUND`), `amount`, `description`, `reference_id` | Full ledger of wallet credits, plan debits, and stop meal refund credits. |
| `complaints` | `Complaint` | `id` | `student_id` → `students.id`, `provider_id` → `tiffin_providers.id` | `category`, `description`, `status` (`OPEN`, `IN_PROGRESS`, `RESOLVED`), `resolution` | Student grievances, tracking status, and owner resolution notes. |
| `inventory_items` | `InventoryItem` | `id` | `provider_id` → `tiffin_providers.id` | `item_name`, `quantity`, `unit`, `min_threshold`, `supplier_name` | Raw materials inventory with automated low-stock warnings. |
| `staff` | `Staff` | `id` | `provider_id` → `tiffin_providers.id` | `name`, `role` (`COOK`, `HELPER`, `DELIVERY`), `phone`, `salary`, `is_active` | Kitchen staff directory, duty status toggle, and monthly payroll. |

---

## 🌐 3. REST API Endpoint Index (Implemented in `server.py`)

All endpoints support JSON requests/responses, CORS headers, and Bearer Token authentication:

### Authentication & Sessions
- `POST /api/auth/register` — Register student or owner account with role-specific profile.
- `POST /api/auth/login` — Authenticate email/mobile + password, returns user object and session token.
- `POST /api/auth/google` — Simulated Google SSO login and account linkage.
- `GET /api/auth/me` — Restore active session from Bearer token.
- `POST /api/auth/forgot-password` — Password recovery simulation.

### Shared & Public Endpoints
- `GET /api/providers` — List of verified active tiffin centers.
- `GET /api/providers/:id` — Detailed hotel profile, ratings, timings, cutoff rules, and reviews.
- `GET /api/menu?provider_id=1` — Weekly menu filtered by day of week and meal type.
- `GET /api/pricing?provider_id=1` — Live pricing configuration for calculating plans.
- `GET /api/suggestions?provider_id=1` — List of student dish suggestions sorted by vote rank.
- `POST /api/suggestions/vote` — Cast upvote on a dish (enforces 1 vote per student).
- `POST /api/suggestions/add` — Propose a new food dish for upcoming menus.
- `GET /api/notifications` — Retrieve user's in-app notifications and unread badge count.
- `POST /api/notifications/mark-read` — Mark notifications as read.

### Student Portal Endpoints
- `GET /api/student/dashboard` — Comprehensive home overview (welcome, active subscription, today's meals, delivery status, attendance counters, dietary summary, wallet balance).
- `POST /api/student/plan/calculate` — Dynamic price breakdown for Day-wise, Weekly, Monthly, and Custom dates.
- `POST /api/student/payment/verify` — Verify test Razorpay payment, activate subscription, generate invoice receipt number (`RCP-YYYY-XXXX`), and schedule future meal orders with QR tokens.
- `POST /api/student/stop-meal` — Submit stop meal request. Enforces **2-hour advance cutoff rule** against configured kitchen deadlines.
- `GET /api/student/stop-requests` — History of student's past stop requests and refund credits.
- `GET /api/student/attendance` — Monthly meal attendance records for calendar view.
- `GET /api/student/delivery-tracking` — Live 4-stage delivery tracking with driver name, phone, ETA, and **contactless QR verification token**.
- `POST /api/student/feedback` — Submit "KHANA ACHHA THA AAJ KA?" rating (Excellent/Good/Average/Not Good) + 5-star criteria scores.
- `GET /api/student/profile-history` — Full profile, subscription validity, and payment receipts.
- `GET /api/student/wallet` — Student wallet balance, reward points, boxes held, and transaction history.
- `POST /api/student/wallet/recharge` — Instant wallet top-up via UPI or cards.
- `GET /api/student/dietary` — Current dietary settings (Jain, less spicy, no onion/garlic, allergies).
- `POST /api/student/dietary` & `PUT /api/student/dietary` — Save dietary constraints and health instructions.
- `GET /api/student/complaints` — Retrieve filed complaints with kitchen resolution notes.
- `POST /api/student/complaints` — File a new grievance across Quality, Delivery, Order, or Payment.

### Tiffin Owner Portal Endpoints
- `GET /api/owner/overview` — 12 real metrics cards, today's B/L/D orders distribution, and live dispatch summary.
- `GET /api/owner/students` — Directory of all registered students, active plans, and lifetime payments.
- `POST /api/owner/students/add` — Register a new student manually from owner dashboard.
- `GET /api/owner/tiffins` — Scheduled delivery manifest for today's active tiffins.
- `POST /api/owner/menu/update` — Add or edit dishes for Monday–Sunday (Breakfast, Lunch, Dinner).
- `DELETE /api/owner/menu/:id` — Delete a dish from the weekly menu.
- `POST /api/owner/menu/publish` — Broadcast notification to all active students that weekly menu is published.
- `PUT /api/owner/pricing` — Update live meal prices, subscription costs, and discount percentages.
- `GET /api/owner/attendance` — Date-filtered student attendance table.
- `POST /api/owner/attendance/update` — Authorized attendance status correction with mandatory audit reason.
- `GET /api/owner/stop-requests` — All incoming meal cancellation requests with cutoff compliance.
- `GET /api/owner/deliveries` — Real-time delivery dispatch list.
- `POST /api/owner/deliveries/update-status` — Update delivery status (`order_received` → `preparing` → `out_for_delivery` → `delivered`).
- `POST /api/owner/deliveries/verify-qr` — **Contactless QR Token verification**: instantly marks delivery as delivered and updates attendance.
- `GET /api/owner/payments` — Payment ledger, receipts, today's collection, and monthly totals.
- `GET /api/owner/feedback-analytics` — Average rating scores, criteria distribution, and student dish suggestions.
- `POST /api/owner/feedback/reply` — Send direct response to student feedback.
- `GET /api/owner/profit-loss` — Real-time income, category-wise expenses, and net profit/loss calculation.
- `POST /api/owner/expenses/add` — Record business expense under 8 standardized categories.
- `DELETE /api/owner/expenses/:id` — Delete a recorded business expense.
- `GET /api/owner/settings` — Business profile, meal timings, and cutoff hour rules.
- `PUT /api/owner/settings` — Update business profile, meal timings, and advance cutoff hours.
- `GET /api/owner/staff` — List of all kitchen staff, active duty count, and total monthly payroll.
- `POST /api/owner/staff/add` — Add new cook, helper, or delivery executive with salary.
- `POST /api/owner/staff/toggle` — Toggle staff member active duty status.
- `DELETE /api/owner/staff/:id` — Remove staff member.
- `GET /api/owner/inventory` — Raw materials inventory with low-stock alert flags.
- `POST /api/owner/inventory/add` — Add new raw material stock item with minimum threshold.
- `POST /api/owner/inventory/update-stock` — Update inventory stock quantity.
- `DELETE /api/owner/inventory/:id` — Remove inventory item.
- `GET /api/owner/complaints` — View student grievances with status filters.
- `POST /api/owner/complaints/resolve` — Update grievance status to `RESOLVED` with action notes and student alert.

---

## ⚡ 4. Acceptance Tests Verification (18/18 Passing)

Automated acceptance tests in [`test_system.py`](file:///c:/Users/akhil\Downloads808	est_system.py) verify the full end-to-end integration:

| # | Test Scenario | Verified Outcomes | Status |
|---|---|---|---|
| 1 | Student Auth & Dashboard | Student registers, logs in, obtains JWT Bearer token, loads student dashboard with assigned provider. | **PASSED** |
| 2 | Owner Auth & Dashboard | Owner registers, logs in, accesses business dashboard, metrics initialized. | **PASSED** |
| 3 | Menu Management | Owner publishes updated Friday dinner; Student immediately sees updated menu in real time. | **PASSED** |
| 4 | Pricing Configuration | Owner updates meal prices; Student plan calculator fetches updated live rates dynamically. | **PASSED** |
| 5 | Dynamic Plan Calculation | Day-wise, Weekly, Monthly, and Custom date selections calculate accurate totals and discounts. | **PASSED** |
| 6 | Payment & Subscription | Student test payment verifies, generates receipt `RCP-YYYY-XXXX`, schedules meals, appears in Owner collections. | **PASSED** |
| 7 | Stop Meal Cutoff Rule | Enforces strict 2-hour advance cancellation cutoff; valid cancellations register ₹90 refund credits. | **PASSED** |
| 8 | Delivery Tracking | Owner advances status (`order_received` → `preparing` → `out_for_delivery` → `delivered`); student sees live state. | **PASSED** |
| 9 | Rating & Demand Analytics | Student submits "Khana Achha Tha Aaj Ka?" rating; Owner analytics computes average taste scores. | **PASSED** |
| 10 | Attendance & Audit Trail | Owner modifies attendance with mandatory reason; audit log recorded; student sees updated status. | **PASSED** |
| 11 | Profit & Loss Management | Real-time calculations: Total Revenue minus Total Expenses equals accurate Net Profit/Loss. | **PASSED** |
| 12 | Role-Based Security | Cross-role boundary enforced: Students blocked from Owner APIs; Owners blocked from Student APIs; multi-tenant isolation preserved. | **PASSED** |
| 13 | Student Digital Wallet | Wallet recharge crediting, transaction ledger auditing, physical boxes held tracking (`boxes_held`). | **PASSED** |
| 14 | Dietary Preferences | Jain food, less spicy, no onion/garlic, allergies, and delivery instructions saved and queried. | **PASSED** |
| 15 | Complaints Lifecycle | Student lodges quality grievance; Owner resolves it with notes; Student receives resolution notice. | **PASSED** |
| 16 | Staff & Salaries | Staff directory, active duty toggle, salary tracking, and total monthly payroll computation. | **PASSED** |
| 17 | Kitchen Stock Inventory | Raw materials inventory, stock adjustments, and low-stock threshold warning triggers. | **PASSED** |
| 18 | Contactless QR Verification | QR token generated with delivery; verified by owner/delivery fleet; auto-marks as delivered. | **PASSED** |


---

## 13. Production Deployment & Cloud Hosting Options
All deployment manifests and container recipes are prepared for zero-friction launch:

| Manifest / Configuration | Target Platform | Description |
| :--- | :--- | :--- |
| [`DEPLOYMENT_GUIDE.md`](DEPLOYMENT_GUIDE.md) | Universal Guide | Comprehensive step-by-step guide in English & Hindi/Hinglish |
| [`render.yaml`](render.yaml) | Render.com | Blueprint for 1-click free Web Service + free PostgreSQL database |
| [`Dockerfile`](Dockerfile) | Docker / Cloud | Multi-stage Node.js 20 production container with Prisma engine |
| [`docker-compose.yml`](docker-compose.yml) | Local / VPS | 1-command startup for PostgreSQL 16 + Express app on port 5000 |
| [`Dockerfile.python`](Dockerfile.python) | Docker / VPS | Minimal Python 3 standard library container with persistent SQLite volume |
| [`Procfile`](Procfile) | Render / Railway / Heroku | Process file (`web: node server.js`) |
| [`railway.json`](railway.json) | Railway.app | Nixpacks builder configuration with Prisma generate |
| [`.env.production.example`](.env.production.example) | Production Envs | Production environment variables template |
| [`prisma/seed.js`](prisma/seed.js) | PostgreSQL Seeding | Automatic demo data seeding (`npx prisma db seed`) |

### Default Live Credentials
- 👨‍🎓 **Student**: `student@tiffin.com` / `student123`
- 👨‍🍳 **Tiffin Owner**: `owner@annapurnatiffin.com` / `owner123`

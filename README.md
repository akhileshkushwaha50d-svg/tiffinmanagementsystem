# TiffinMate - Complete Tiffin Management & Delivery Web Application

A full-stack, responsive, production-ready **Tiffin Management & Delivery Web Application** built with modern **HTML5, CSS3, JavaScript** on the frontend, and a modular **Python REST API backend** backed by a relational **SQLite database**.

---

## 🌟 Key Highlights & Architecture

- **Two Distinct Roles**:
  1. **Student / Customer**: Meal booking, plan configuration, payments, delivery tracking, attendance, food suggestions, ratings, stop meal requests.
  2. **Tiffin Owner**: Business overview, student records, daily orders, live delivery dispatch, weekly menu publishing, price management, attendance audit, and profit & loss (P&L) tracking.
- **Single Connected Database**: Both dashboards run on the same relational SQLite database (`data/tiffin.db`) with relational integrity and role-based authorization.
- **Zero-Dependency Backend**: Uses Python's standard library `http.server`, `socketserver.ThreadingTCPServer`, `sqlite3`, and `json`. Runs instantly with `python server.py` without requiring any external `pip` packages!
- **Zero-Dependency Frontend**: Pure modern HTML5, CSS3, and Vanilla JavaScript with custom HTML5 Canvas charts and responsive mobile navigation.

---

## 📱 Application Flow & Features

### Screen 1 – Role Selection
- Two large interactive cards: **Student / Customer** and **Tiffin Owner**.
- Role remembrance in `localStorage` across page reloads.
- Quick 1-click demo login buttons for instant testing.

### Screen 2 – Authentication & Registration
- Role-specific login and registration views:
  - **Student Fields**: Full Name, Mobile, Email, Delivery Address, Password.
  - **Owner Fields**: Owner Name, Tiffin Business Name, Mobile, Email, Kitchen Address, Password.
- Google Authentication simulation.
- Password visibility toggles (eye icons) and input validation.
- Role-based route protection on backend.

### Screen 3B – Student Dashboard
- **Home Overview**: Personalized welcome greeting, current tiffin provider badge, active subscription status, today's Breakfast, Lunch, and Dinner cards with special meal indicators, live delivery progress bar, and attendance summaries.
- **Tiffin Hotel Details**: Kitchen description, owner contacts, business location, meal timings, cutoff rules, food photo gallery, and student reviews.
- **Meal Plans & Pricing**: 4 dynamic plans:
  1. *Day-Wise Plan* (custom breakfast, lunch, dinner selection)
  2. *7-Day Weekly Plan* (with 5% saver discount)
  3. *30-Day Monthly Plan* (with 10% discount and Sunday feasts)
  4. *Customised Day Plan* (interactive date and meal picker)
- **Payment Screen & Checkout**: Razorpay test mode (UPI, Debit Card, Credit Card, Net Banking) with instant tax invoice generation and printable/downloadable payment receipt (`RCP-YYYY-XXXX`).
- **Weekly Menu**: Monday to Sunday filter with meal descriptions, included items, and chef's special badges.
- **Food Suggestions & High-Demand Voting**: Upvoting favourite upcoming meals (*Paneer Butter Masala*, *Chole Bhature*, *Rajma Chawal*, *Veg Biryani*, etc.) with duplicate-vote prevention.
- **"KHANA ACHHA THA AAJ KA?"**: 4 reaction rating buttons (*Excellent* 😍, *Good* 😊, *Average* 😐, *Not Good* 😞), 5-star ratings for Taste, Quality, Quantity, Hygiene, plus comments and anonymous option.
- **Monthly Attendance**: Interactive monthly calendar with meal-wise status tags (*Present*, *Delivered*, *Absent*, *Stopped*).
- **Stop Meal Feature**: Strict **2-hour advance cutoff rule** enforcement with refund credit registration.
- **Delivery Tracking**: 4 real-time stages (*Order Placed* → *Preparing* → *Out for Delivery* → *Delivered*), with delivery associate details and arrival estimates.
- **Feedback & Complaints**: Submission form and past history with owner replies.
- **Profile & History**: Student records, active subscription validity, and payment transaction logs.

### Screen 3A – Tiffin Owner Dashboard
- **Business Overview**: 12 real metrics cards (*Total Students*, *Active Subscriptions*, *Today's Orders B/L/D*, *Today's Collection*, *Pending Deliveries*, *Completed Deliveries*, *Stop Requests*, *Monthly Revenue*, *Monthly Expenses*, *Net Profit/Loss*).
- **Student Management**: Full student directory, search, filter, and *Add New Student* modal.
- **Active Tiffins**: Daily dispatch manifest with student delivery addresses and meal breakdown.
- **Weekly Menu Management**: Add, edit, or delete items for Monday–Sunday (Breakfast, Lunch, Dinner), upload photos, and broadcast menu updates to students.
- **Pricing Management**: Live configuration of meal prices, plan costs, and discount percentages.
- **Attendance Management**: Date-filtered attendance table with authorized status correction and audit trail.
- **Stop Tiffin Management**: Student stop meal requests review with deadline compliance check and refund calculation.
- **Delivery Management**: Single-click status transitions (*Preparing* → *Out for Delivery* → *Delivered*), which automatically marks student attendance as *Delivered*.
- **Payments & Collections**: Real-time verified revenue logs, receipt numbers, and payment modes.
- **Feedback & Food Analytics**: Ratings distribution doughnut chart, average scores, high-demand vs. low-demand ranking, and reply to student reviews.
- **Profit & Loss (P&L)**: Real-time calculation (`Net Profit = Verified Revenue - Recorded Expenses`), expense categories (*Food/Raw Material*, *Salaries*, *Delivery*, *LPG Gas*, *Rent*, *Packaging*), and Canvas bar/doughnut charts.
- **Business Settings**: Meal timings, cancellation cutoffs, and 2-hour advance policy settings.

---

## 🔗 Live Interconnections Between Student and Owner

1. **Menu Updates**: When Owner edits or publishes weekly menu, it immediately updates on the Student Menu and Home screens.
2. **Dynamic Pricing**: When Owner adjusts meal or plan prices, Student checkout calculations update dynamically.
3. **Subscriptions**: When Student purchases a plan, Owner overview and student directory reflect the active subscription immediately.
4. **Payments**: Verified student payments generate receipts and update Owner's collected revenue.
5. **Stop Meal Requests**: When Student stops a meal before the 2-hour cutoff, Owner receives the request, and the meal order is stopped with refund credits.
6. **Live Deliveries**: When Owner marks an order as *Out for Delivery* or *Delivered*, the Student's delivery tracker updates in real time.
7. **Delivery-Attendance Link**: Marking an order *Delivered* automatically marks the student's attendance as *Delivered*.
8. **Feedback & Replies**: Ratings and feedback submitted by students appear in Owner analytics; Owner replies display directly on the student feedback view.
9. **Food Voting**: Student votes dynamically rank dishes on both Student and Owner demand analytics.
10. **Profit & Loss**: When Owner logs kitchen expenses, the Net Profit/Loss is updated automatically against verified student revenue.

---

## 📁 Directory Structure

```text
c:\Users\akhil\Downloads\0808\
├── server.py              # Zero-dependency Python REST API Server & Static Server
├── database.py            # SQLite schema initialization, seed data, queries
├── test_system.py         # Automated test suite (12 Acceptance Tests)
├── start_server.bat       # Windows 1-click batch launcher
├── README.md              # Project documentation & verification report
├── static/                # Single Page Application Frontend
│   ├── index.html         # SPA Shell (Role Selection, Auth, Dashboards, Modals)
│   ├── css/
│   │   └── style.css      # Responsive CSS design system (Emerald green theme)
│   └── js/
│       ├── app.js         # Core router, notification drawer, toast alerts
│       ├── api.js         # REST API client with JWT bearer tokens
│       ├── auth.js        # Role selection, login, registration, demo accounts
│       ├── student.js     # All Student portal features
│       ├── owner.js       # All Owner portal features
│       └── charts.js      # Zero-dependency HTML5 Canvas chart renderer
└── data/
    └── tiffin.db          # Relational SQLite database
```

---

## 🚀 How to Run the Application

### Option A: 1-Click Launch (Windows)
Double-click `start_server.bat` in the project root directory. It will start the server and open `http://localhost:8000` in your default browser.

### Option B: Terminal Command
```powershell
python server.py
```
Open `http://localhost:8000` in your web browser.

---

## 🧪 Acceptance Test Verification (All 12 Tests Passed)

To run the automated verification suite:
```powershell
python test_system.py
```

| Test # | Acceptance Test Description | Status |
|---|---|---|
| **TEST 1** | Student selects role → registers → logs in → reaches Student Dashboard | **PASSED** |
| **TEST 2** | Owner selects role → registers → logs in → reaches Owner Dashboard | **PASSED** |
| **TEST 3** | Owner creates weekly menu → Student views identical live menu | **PASSED** |
| **TEST 4** | Owner sets meal prices → Student sees correct updated prices | **PASSED** |
| **TEST 5** | Dynamic pricing calculation (Day-wise, Weekly, Monthly, Custom) | **PASSED** |
| **TEST 6** | Student test payment → Verified transaction appears in Owner Dashboard | **PASSED** |
| **TEST 7** | Student submits Stop Meal request (2-hr cutoff rule) → Owner receives request | **PASSED** |
| **TEST 8** | Owner updates delivery status → Student sees real-time progress | **PASSED** |
| **TEST 9** | Student submits food rating & suggestions → Owner views analytics | **PASSED** |
| **TEST 10** | Owner updates attendance with reason → Student sees updated attendance | **PASSED** |
| **TEST 11** | Owner records expenses → Live Profit & Loss calculates correctly | **PASSED** |
| **TEST 12** | Role-based permissions & security boundary enforcement | **PASSED** |

---

## 👥 Demo Credentials

| Role | Email / Username | Password |
|---|---|---|
| **Student** | `aman.verma@student.edu` | `student123` |
| **Tiffin Owner** | `owner@annapurnatiffin.com` | `owner123` |

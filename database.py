"""
database.py - Complete SQLite Database Management for Tiffin Management & Delivery Web Application
Relational schema, seed data, and query interfaces.
"""

import sqlite3
import hashlib
import json
import os
from datetime import datetime, timedelta

DB_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
DB_PATH = os.path.join(DB_DIR, "tiffin.db")

def hash_password(password: str) -> str:
    """Return SHA-256 hash of password with a fixed salt."""
    salt = "tiffin_secure_salt_2026"
    return hashlib.sha256((password + salt).encode('utf-8')).hexdigest()

def get_db_connection():
    """Create and return a SQLite database connection with row factory."""
    os.makedirs(DB_DIR, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn

def init_db():
    """Initialize all SQL tables, indexes, and seed initial data."""
    conn = get_db_connection()
    cur = conn.cursor()

    # 1. Users Table
    cur.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE,
        phone TEXT UNIQUE,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('student', 'owner', 'admin')),
        full_name TEXT NOT NULL,
        address TEXT,
        avatar_url TEXT,
        status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive', 'suspended')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    # 2. Tiffin Providers Table
    cur.execute("""
    CREATE TABLE IF NOT EXISTS tiffin_providers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        owner_user_id INTEGER NOT NULL UNIQUE,
        business_name TEXT NOT NULL,
        description TEXT,
        contact_phone TEXT NOT NULL,
        contact_email TEXT,
        business_address TEXT NOT NULL,
        city TEXT DEFAULT 'Indore',
        breakfast_time TEXT DEFAULT '07:30 AM - 09:30 AM',
        lunch_time TEXT DEFAULT '12:30 PM - 02:30 PM',
        dinner_time TEXT DEFAULT '07:30 PM - 09:30 PM',
        breakfast_cutoff_time TEXT DEFAULT '07:00',
        lunch_cutoff_time TEXT DEFAULT '10:00',
        dinner_cutoff_time TEXT DEFAULT '17:00',
        advance_cutoff_hours INTEGER DEFAULT 2,
        is_active INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE
    )
    """)

    # 3. Pricing Configurations Table
    cur.execute("""
    CREATE TABLE IF NOT EXISTS pricing_config (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        provider_id INTEGER NOT NULL UNIQUE,
        breakfast_price REAL DEFAULT 50.0,
        lunch_price REAL DEFAULT 90.0,
        dinner_price REAL DEFAULT 90.0,
        day_plan_price REAL DEFAULT 210.0,
        weekly_plan_price REAL DEFAULT 1350.0,
        monthly_plan_price REAL DEFAULT 5200.0,
        custom_meal_base_price REAL DEFAULT 80.0,
        monthly_discount_pct REAL DEFAULT 10.0,
        weekly_discount_pct REAL DEFAULT 5.0,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (provider_id) REFERENCES tiffin_providers(id) ON DELETE CASCADE
    )
    """)

    # 4. Meal Plans
    cur.execute("""
    CREATE TABLE IF NOT EXISTS meal_plans (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        provider_id INTEGER NOT NULL,
        plan_type TEXT NOT NULL CHECK(plan_type IN ('day', 'weekly', 'monthly', 'custom')),
        name TEXT NOT NULL,
        description TEXT,
        price REAL NOT NULL,
        duration_days INTEGER NOT NULL,
        discount_percentage REAL DEFAULT 0,
        included_meals TEXT DEFAULT 'breakfast,lunch,dinner',
        is_active INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (provider_id) REFERENCES tiffin_providers(id) ON DELETE CASCADE
    )
    """)

    # 5. Students Profiles Table
    cur.execute("""
    CREATE TABLE IF NOT EXISTS students (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL UNIQUE,
        provider_id INTEGER,
        current_plan_id INTEGER,
        delivery_address TEXT NOT NULL,
        tiffin_start_date DATE,
        tiffin_end_date DATE,
        subscription_status TEXT DEFAULT 'inactive' CHECK(subscription_status IN ('active', 'inactive', 'expired', 'paused')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (provider_id) REFERENCES tiffin_providers(id) ON DELETE SET NULL,
        FOREIGN KEY (current_plan_id) REFERENCES meal_plans(id) ON DELETE SET NULL
    )
    """)

    # 6. Menus Table
    cur.execute("""
    CREATE TABLE IF NOT EXISTS menus (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        provider_id INTEGER NOT NULL,
        day_of_week TEXT NOT NULL CHECK(day_of_week IN ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday')),
        meal_type TEXT NOT NULL CHECK(meal_type IN ('Breakfast', 'Lunch', 'Dinner')),
        food_name TEXT NOT NULL,
        description TEXT,
        items_included TEXT,
        image_url TEXT,
        is_special INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (provider_id) REFERENCES tiffin_providers(id) ON DELETE CASCADE,
        UNIQUE(provider_id, day_of_week, meal_type)
    )
    """)

    # 7. Subscriptions Table
    cur.execute("""
    CREATE TABLE IF NOT EXISTS subscriptions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id INTEGER NOT NULL,
        provider_id INTEGER NOT NULL,
        plan_id INTEGER,
        plan_type TEXT NOT NULL,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        total_amount REAL NOT NULL,
        discount_amount REAL DEFAULT 0,
        final_amount REAL NOT NULL,
        status TEXT DEFAULT 'active' CHECK(status IN ('active', 'completed', 'cancelled', 'pending')),
        selected_dates_json TEXT,
        selected_meals_json TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
        FOREIGN KEY (provider_id) REFERENCES tiffin_providers(id) ON DELETE CASCADE
    )
    """)

    # 8. Payments Table
    cur.execute("""
    CREATE TABLE IF NOT EXISTS payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id INTEGER NOT NULL,
        provider_id INTEGER NOT NULL,
        subscription_id INTEGER,
        razorpay_order_id TEXT,
        razorpay_payment_id TEXT UNIQUE,
        amount REAL NOT NULL,
        payment_method TEXT DEFAULT 'UPI' CHECK(payment_method IN ('UPI', 'Debit Card', 'Credit Card', 'Net Banking', 'Cash')),
        status TEXT DEFAULT 'success' CHECK(status IN ('success', 'pending', 'failed', 'refunded')),
        receipt_number TEXT UNIQUE NOT NULL,
        notes TEXT,
        transaction_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
        FOREIGN KEY (provider_id) REFERENCES tiffin_providers(id) ON DELETE CASCADE,
        FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE SET NULL
    )
    """)

    # 9. Orders / Scheduled Meals Table
    cur.execute("""
    CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id INTEGER NOT NULL,
        provider_id INTEGER NOT NULL,
        subscription_id INTEGER,
        meal_date DATE NOT NULL,
        meal_type TEXT NOT NULL CHECK(meal_type IN ('Breakfast', 'Lunch', 'Dinner')),
        status TEXT DEFAULT 'scheduled' CHECK(status IN ('scheduled', 'preparing', 'out_for_delivery', 'delivered', 'cancelled', 'stopped')),
        delivery_address TEXT NOT NULL,
        special_instructions TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
        FOREIGN KEY (provider_id) REFERENCES tiffin_providers(id) ON DELETE CASCADE,
        FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE SET NULL,
        UNIQUE(student_id, meal_date, meal_type)
    )
    """)

    # 10. Deliveries Table
    cur.execute("""
    CREATE TABLE IF NOT EXISTS deliveries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL UNIQUE,
        student_id INTEGER NOT NULL,
        provider_id INTEGER NOT NULL,
        meal_date DATE NOT NULL,
        meal_type TEXT NOT NULL,
        status TEXT DEFAULT 'order_received' CHECK(status IN ('order_received', 'preparing', 'out_for_delivery', 'delivered', 'cancelled')),
        delivery_address TEXT NOT NULL,
        start_time TIMESTAMP,
        completion_time TIMESTAMP,
        estimated_time TEXT,
        delivery_person_name TEXT DEFAULT 'Ramesh Kumar',
        delivery_person_phone TEXT DEFAULT '+91 98765 43210',
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
        FOREIGN KEY (provider_id) REFERENCES tiffin_providers(id) ON DELETE CASCADE
    )
    """)

    # 11. Attendance Table
    cur.execute("""
    CREATE TABLE IF NOT EXISTS attendance (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id INTEGER NOT NULL,
        provider_id INTEGER NOT NULL,
        meal_date DATE NOT NULL,
        meal_type TEXT NOT NULL CHECK(meal_type IN ('Breakfast', 'Lunch', 'Dinner')),
        status TEXT DEFAULT 'present' CHECK(status IN ('present', 'absent', 'meal_stopped', 'delivered', 'not_scheduled')),
        corrected_by INTEGER,
        correction_reason TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
        FOREIGN KEY (provider_id) REFERENCES tiffin_providers(id) ON DELETE CASCADE,
        UNIQUE(student_id, meal_date, meal_type)
    )
    """)

    # 12. Stop Meal Requests Table
    cur.execute("""
    CREATE TABLE IF NOT EXISTS stop_meal_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id INTEGER NOT NULL,
        provider_id INTEGER NOT NULL,
        request_date DATE NOT NULL,
        meal_date DATE NOT NULL,
        meal_type TEXT NOT NULL CHECK(meal_type IN ('Breakfast', 'Lunch', 'Dinner', 'All')),
        request_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        cutoff_deadline TEXT NOT NULL,
        status TEXT DEFAULT 'approved' CHECK(status IN ('pending', 'approved', 'rejected')),
        reason TEXT,
        refund_credit REAL DEFAULT 0.0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
        FOREIGN KEY (provider_id) REFERENCES tiffin_providers(id) ON DELETE CASCADE
    )
    """)

    # 13. Food Suggestions Table
    cur.execute("""
    CREATE TABLE IF NOT EXISTS food_suggestions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        provider_id INTEGER NOT NULL,
        student_id INTEGER NOT NULL,
        food_name TEXT NOT NULL,
        category TEXT DEFAULT 'Main Course',
        description TEXT,
        vote_count INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (provider_id) REFERENCES tiffin_providers(id) ON DELETE CASCADE,
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
    )
    """)

    # 14. Food Votes Table
    cur.execute("""
    CREATE TABLE IF NOT EXISTS food_votes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        suggestion_id INTEGER NOT NULL,
        student_id INTEGER NOT NULL,
        voted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (suggestion_id) REFERENCES food_suggestions(id) ON DELETE CASCADE,
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
        UNIQUE(suggestion_id, student_id)
    )
    """)

    # 15. Feedback & Ratings Table
    cur.execute("""
    CREATE TABLE IF NOT EXISTS feedback (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id INTEGER NOT NULL,
        provider_id INTEGER NOT NULL,
        meal_date DATE NOT NULL,
        meal_type TEXT NOT NULL CHECK(meal_type IN ('Breakfast', 'Lunch', 'Dinner')),
        general_rating TEXT NOT NULL CHECK(general_rating IN ('Excellent', 'Good', 'Average', 'Not Good')),
        taste_rating INTEGER DEFAULT 4 CHECK(taste_rating BETWEEN 1 AND 5),
        quality_rating INTEGER DEFAULT 4 CHECK(quality_rating BETWEEN 1 AND 5),
        quantity_rating INTEGER DEFAULT 4 CHECK(quantity_rating BETWEEN 1 AND 5),
        hygiene_rating INTEGER DEFAULT 4 CHECK(hygiene_rating BETWEEN 1 AND 5),
        comments TEXT,
        is_anonymous INTEGER DEFAULT 0,
        owner_response TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
        FOREIGN KEY (provider_id) REFERENCES tiffin_providers(id) ON DELETE CASCADE
    )
    """)

    # 16. Expenses Table
    cur.execute("""
    CREATE TABLE IF NOT EXISTS expenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        provider_id INTEGER NOT NULL,
        expense_date DATE NOT NULL,
        category TEXT NOT NULL CHECK(category IN ('Food / Raw Material', 'Staff Salaries', 'Delivery Expenses', 'Electricity', 'Gas', 'Rent', 'Packaging', 'Other Business Expenses')),
        amount REAL NOT NULL,
        description TEXT,
        payment_mode TEXT DEFAULT 'Online',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (provider_id) REFERENCES tiffin_providers(id) ON DELETE CASCADE
    )
    """)

    # 17. Notifications Table
    cur.execute("""
    CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        type TEXT DEFAULT 'info' CHECK(type IN ('info', 'success', 'warning', 'danger', 'delivery', 'menu', 'payment')),
        is_read INTEGER DEFAULT 0,
        link_url TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
    """)

    # 18. Audit Logs Table
    cur.execute("""
    CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        action TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id INTEGER,
        details TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    # 19. Wallet Transactions Table (Prisma WalletTransaction)
    cur.execute("""
    CREATE TABLE IF NOT EXISTS wallet_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id INTEGER NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('CREDIT', 'DEBIT', 'REFUND')),
        amount REAL NOT NULL,
        description TEXT NOT NULL,
        reference_id TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
    )
    """)

    # 20. Complaints Table (Prisma Complaint)
    cur.execute("""
    CREATE TABLE IF NOT EXISTS complaints (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id INTEGER NOT NULL,
        provider_id INTEGER NOT NULL,
        category TEXT NOT NULL CHECK(category IN ('Quality', 'Delivery Delay', 'Payment', 'Incorrect Order', 'Other')),
        description TEXT NOT NULL,
        status TEXT DEFAULT 'OPEN' CHECK(status IN ('OPEN', 'IN_PROGRESS', 'RESOLVED')),
        resolution TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
        FOREIGN KEY (provider_id) REFERENCES tiffin_providers(id) ON DELETE CASCADE
    )
    """)

    # 21. Inventory Items Table (Prisma InventoryItem)
    cur.execute("""
    CREATE TABLE IF NOT EXISTS inventory_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        provider_id INTEGER NOT NULL,
        item_name TEXT NOT NULL,
        quantity REAL NOT NULL,
        unit TEXT NOT NULL,
        min_threshold REAL NOT NULL,
        supplier_name TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (provider_id) REFERENCES tiffin_providers(id) ON DELETE CASCADE
    )
    """)

    # 22. Staff Table (Prisma Staff)
    cur.execute("""
    CREATE TABLE IF NOT EXISTS staff (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        provider_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('COOK', 'HELPER', 'DELIVERY')),
        phone TEXT NOT NULL,
        salary REAL NOT NULL,
        is_active INTEGER DEFAULT 1,
        FOREIGN KEY (provider_id) REFERENCES tiffin_providers(id) ON DELETE CASCADE
    )
    """)

    # Safe column migrations on existing tables
    def safe_add_column(table, col_name, col_def):
        try:
            cur.execute(f"ALTER TABLE {table} ADD COLUMN {col_name} {col_def}")
        except sqlite3.OperationalError:
            pass

    safe_add_column("students", "wallet_balance", "REAL DEFAULT 0.0")
    safe_add_column("students", "referral_code", "TEXT")
    safe_add_column("students", "referred_by", "TEXT")
    safe_add_column("students", "reward_points", "INTEGER DEFAULT 0")
    safe_add_column("students", "is_jain", "INTEGER DEFAULT 0")
    safe_add_column("students", "less_spicy", "INTEGER DEFAULT 0")
    safe_add_column("students", "no_onion_garlic", "INTEGER DEFAULT 0")
    safe_add_column("students", "allergies", "TEXT")
    safe_add_column("students", "special_instructions", "TEXT")
    safe_add_column("students", "boxes_held", "INTEGER DEFAULT 0")

    safe_add_column("deliveries", "qr_token", "TEXT")
    safe_add_column("deliveries", "delivered_at", "TIMESTAMP")

    conn.commit()
    seed_initial_data(conn)
    seed_prisma_addons(conn)
    conn.close()
    print("Database initialized successfully with all tables and seed data.")

def seed_initial_data(conn):
    """Seed initial realistic data if database is fresh."""
    cur = conn.cursor()

    # Check if Owner exists
    cur.execute("SELECT COUNT(*) FROM users WHERE role = 'owner'")
    if cur.fetchone()[0] > 0:
        return  # Already seeded

    print("Seeding initial tiffin management demo data...")

    # 1. Create Owner User
    owner_pwd = hash_password("owner123")
    cur.execute("""
    INSERT INTO users (email, phone, password_hash, role, full_name, address)
    VALUES (?, ?, ?, 'owner', ?, ?)
    """, ("owner@annapurnatiffin.com", "9826012345", owner_pwd, "Rajesh Sharma", "Shop 12, Student Nagar, Bhawarkua, Indore"))
    owner_user_id = cur.lastrowid

    # 2. Create Tiffin Provider
    cur.execute("""
    INSERT INTO tiffin_providers (
        owner_user_id, business_name, description, contact_phone, contact_email,
        business_address, city, breakfast_time, lunch_time, dinner_time,
        breakfast_cutoff_time, lunch_cutoff_time, dinner_cutoff_time, advance_cutoff_hours
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        owner_user_id,
        "Shree Annapurna Pure Veg Tiffin & Meals",
        "Healthy, hygienic, and authentic home-style vegetarian tiffin service for students and professionals. Fresh ingredients prepared daily.",
        "+91 98260 12345",
        "contact@annapurnatiffin.com",
        "Plot 45, Near Holkar Science College, Bhawarkua, Indore, MP - 452001",
        "Indore",
        "07:30 AM - 09:30 AM",
        "12:30 PM - 02:30 PM",
        "07:30 PM - 09:30 PM",
        "07:00",
        "10:00",
        "17:00",
        2
    ))
    provider_id = cur.lastrowid

    # 3. Create Pricing Config
    cur.execute("""
    INSERT INTO pricing_config (
        provider_id, breakfast_price, lunch_price, dinner_price,
        day_plan_price, weekly_plan_price, monthly_plan_price,
        custom_meal_base_price, monthly_discount_pct, weekly_discount_pct
    ) VALUES (?, 50.0, 90.0, 90.0, 210.0, 1350.0, 5200.0, 85.0, 10.0, 5.0)
    """, (provider_id,))

    # 4. Create Meal Plans
    plans = [
        ('day', 'Full Day Meal Plan', 'Includes Breakfast, Special Lunch, and Warm Dinner for the selected day', 210.0, 1, 0, 'breakfast,lunch,dinner'),
        ('weekly', '7-Day Student Weekly Saver', '7 Days of nutritious breakfast, lunch, and dinner. Flexible 2-hour stop meal included.', 1350.0, 7, 5.0, 'breakfast,lunch,dinner'),
        ('monthly', '30-Day Royal Monthly Subscription', 'Complete 30-day nutrition plan with weekend sweets and holiday credits.', 5200.0, 30, 10.0, 'breakfast,lunch,dinner'),
        ('custom', 'Customized Flexible Days Plan', 'Pick and choose specific dates and meals according to your college schedule.', 85.0, 1, 0, 'custom')
    ]
    for p in plans:
        cur.execute("""
        INSERT INTO meal_plans (provider_id, plan_type, name, description, price, duration_days, discount_percentage, included_meals)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (provider_id, p[0], p[1], p[2], p[3], p[4], p[5], p[6]))

    # 5. Create Student Users
    student_pwd = hash_password("student123")
    students_data = [
        ("Aman Verma", "aman.verma@student.edu", "9876543210", "Room 302, Royal Boys Hostel, Bhawarkua, Indore"),
        ("Pooja Sharma", "pooja.sharma@college.in", "9876543211", "Flat 104, Shanti Kunj Girls PG, Geeta Bhawan, Indore"),
        ("Rohit Patidar", "rohit.p@campus.org", "9876543212", "Room 12, Shivam Residency, Tower Square, Indore"),
        ("Sneha Kulkarni", "sneha.k@univ.ac.in", "9876543213", "C-8, Saraswati Girls Hostel, Sapna Sangeeta, Indore")
    ]

    student_records = []
    for s in students_data:
        cur.execute("""
        INSERT INTO users (email, phone, password_hash, role, full_name, address)
        VALUES (?, ?, ?, 'student', ?, ?)
        """, (s[1], s[2], student_pwd, s[0], s[3]))
        s_user_id = cur.lastrowid
        
        cur.execute("""
        INSERT INTO students (user_id, provider_id, delivery_address, tiffin_start_date, tiffin_end_date, subscription_status)
        VALUES (?, ?, ?, DATE('now', '-5 days'), DATE('now', '+25 days'), 'active')
        """, (s_user_id, provider_id, s[3]))
        s_id = cur.lastrowid
        student_records.append((s_id, s_user_id, s[0]))

    primary_student_id = student_records[0][0]
    primary_student_user_id = student_records[0][1]

    # 6. Weekly Menu (Monday - Sunday, Breakfast, Lunch, Dinner)
    weekly_menu = [
        # Monday
        ('Monday', 'Breakfast', 'Poha Jalebi & Sprouts', 'Authentic Indori Sev Poha with fresh crispy hot Jalebis and boiled sprouted moong.', 'Poha, Jalebi, Sprouts, Mint Chutney, Tea/Coffee', 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?w=600', 0),
        ('Monday', 'Lunch', 'Homestyle Thali - Paneer & Dal Tadka', 'Fresh 4 Phulkas with ghee, Matar Paneer, Yellow Dal Tadka, Jeera Rice, Salad, Pickle.', '4 Rotis, Matar Paneer, Dal Tadka, Jeera Rice, Kachumber Salad', 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=600', 0),
        ('Monday', 'Dinner', 'Aloo Gobi & Dal Fry Special', 'Hot Tava Rotis with Aloo Gobi Masala, Dal Fry, Steamed Basmati Rice, and Papad.', '4 Rotis, Aloo Gobi, Dal Fry, Rice, Papad', 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=600', 0),
        
        # Tuesday
        ('Tuesday', 'Breakfast', 'Stuffed Aloo Paratha with Curd', 'Two large butter toasted Aloo Parathas served with fresh spiced curd and mixed pickle.', '2 Aloo Parathas, Fresh Dahi, Butter, Mango Pickle', 'https://images.unsplash.com/photo-1606491956689-2ea866880c84?w=600', 0),
        ('Tuesday', 'Lunch', 'Chole Kulche & Jeera Rice Thali', 'Amritsari Chole curry cooked in aromatic spices, 4 Butter Rotis, Steamed Rice, Onions.', '4 Butter Rotis, Amritsari Chole, Rice, Green Salad', 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=600', 0),
        ('Tuesday', 'Dinner', 'Lauki Kofta Curry & Dal Palak', 'Crispy cottage gourd koftas in rich tomato-onion gravy, Dal Palak, hot rotis.', '4 Rotis, Lauki Kofta, Dal Palak, Rice, Gulab Jamun', 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?w=600', 0),
        
        # Wednesday
        ('Wednesday', 'Breakfast', 'Idli Sambar & Coconut Chutney', '4 Steamed soft rice idlis with aromatic vegetable drumstick sambar and fresh coconut chutney.', '4 Idlis, Veg Sambar, Coconut Chutney, Tomato Chutney', 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=600', 0),
        ('Wednesday', 'Lunch', 'Rajma Chawal & Seasonal Sabzi', 'Punjabi Rajma slow cooked in rich masala gravy, steamed basmati rice, Bhindi Do Pyaza, 4 rotis.', '4 Rotis, Rajma Masala, Bhindi Masala, Steamed Rice, Raita', 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=600', 1),
        ('Wednesday', 'Dinner', 'Mix Veg Curry & Moong Dal Khichdi', 'Healthy nutrient-packed Mix Vegetable curry with warm tempered Moong Dal Khichdi and Curd.', '4 Rotis, Mix Veg Curry, Moong Khichdi, Dahi, Papad', 'https://images.unsplash.com/photo-1606491956689-2ea866880c84?w=600', 0),
        
        # Thursday
        ('Thursday', 'Breakfast', 'Methi Thepla with Chhundo & Tea', '3 Soft Gujarati Methi Theplas served with sweet and sour raw mango chutney and tea.', '3 Methi Theplas, Sweet Mango Chhundo, Pickle, Tea', 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?w=600', 0),
        ('Thursday', 'Lunch', 'Kadhi Pakoda & Jeera Pulao', 'Traditional tangy Rajasthani Kadhi with crispy onion besan pakodas, vegetable pulao, 4 rotis.', '4 Rotis, Kadhi Pakoda, Jeera Pulao, Aloo Jeera dry, Salad', 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=600', 0),
        ('Thursday', 'Dinner', 'Sev Tamatar & Dal Makhani', 'Indori favourite Sev Tamatar ki Sabzi, slow cooked creamy Dal Makhani, 4 warm Rotis.', '4 Rotis, Sev Tamatar Sabzi, Dal Makhani, Rice, Sweet Kheer', 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=600', 0),

        # Friday
        ('Friday', 'Breakfast', 'Veg Upma with Coconut Chutney', 'Roasted semolina cooked with roasted peanuts, curry leaves, carrots and green peas.', 'Veg Upma, Coconut Chutney, Banana, Tea/Milk', 'https://images.unsplash.com/photo-1606491956689-2ea866880c84?w=600', 0),
        ('Friday', 'Lunch', 'Paneer Butter Masala Thali', 'Rich buttery Shahi Paneer gravy, Panchmel Dal, 4 Butter Phulkas, Peas Pulao, Boondi Raita.', '4 Butter Phulkas, Paneer Butter Masala, Dal, Peas Pulao, Boondi Raita', 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=600', 1),
        ('Friday', 'Dinner', 'Baingan Bharta & Toor Dal', 'Smoky roasted Punjabi Baingan Bharta, spiced Toor Dal, 4 Rotis, Onion rings with lemon.', '4 Rotis, Baingan Bharta, Toor Dal, Rice, Salad', 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=600', 0),

        # Saturday
        ('Saturday', 'Breakfast', 'Masala Dosa with Sambar', 'Crispy Golden Masala Dosa filled with potato onion bhaji, piping hot sambar and chutney.', '1 Big Masala Dosa, Potato Bhaji, Sambar, 2 Chutneys', 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=600', 0),
        ('Saturday', 'Lunch', 'Dal Baati Churma Mahabhoj (Special)', 'Traditional authentic baked Baatis dipped in pure Desi Ghee, Spicy Panchmel Dal, Sweet Churma Laddu.', '4 Ghee Baatis, Panchmel Dal, Garlic Chutney, Sweet Churma', 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?w=600', 1),
        ('Saturday', 'Dinner', 'Dum Aloo & Yellow Dal Fry', 'Kashmiri style Dum Aloo simmered in curd and fennel gravy, cumin rice, 4 soft rotis.', '4 Rotis, Kashmiri Dum Aloo, Dal Fry, Rice, Papad', 'https://images.unsplash.com/photo-1606491956689-2ea866880c84?w=600', 0),

        # Sunday
        ('Sunday', 'Breakfast', 'Chole Puri & Halwa (Sunday Feast)', 'Fluffy hot puris with spiced chickpea gravy and warm semolina sooji halwa.', '4 Puris, Chole Masala, Sooji Halwa, Pickle', 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?w=600', 1),
        ('Sunday', 'Lunch', 'Hyderabadi Veg Biryani with Mirchi Ka Salan', 'Fragrant basmati rice layered with garden vegetables, paneer, and saffron, with peanut salan.', 'Veg Dum Biryani, Mirchi Ka Salan, Veg Raita, Gulab Jamun', 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=600', 1),
        ('Sunday', 'Dinner', 'Light Comfort Khichdi & Aloo Chokha', 'Light nutritious Moong Dal Khichdi with pure ghee, Bihari Aloo Chokha, Roasted Papad.', 'Moong Khichdi, Desi Ghee, Aloo Chokha, Papad, Fresh Dahi', 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=600', 0)
    ]

    for m in weekly_menu:
        cur.execute("""
        INSERT INTO menus (provider_id, day_of_week, meal_type, food_name, description, items_included, image_url, is_special)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (provider_id, m[0], m[1], m[2], m[3], m[4], m[5], m[6]))

    # 7. Subscriptions & Payments for Demo Students
    today = datetime.now()
    start_date = (today - timedelta(days=5)).strftime("%Y-%m-%d")
    end_date = (today + timedelta(days=25)).strftime("%Y-%m-%d")

    # Primary Student Subscription
    cur.execute("""
    INSERT INTO subscriptions (
        student_id, provider_id, plan_id, plan_type, start_date, end_date,
        total_amount, discount_amount, final_amount, status
    ) VALUES (?, ?, 3, 'monthly', ?, ?, 5200.0, 520.0, 4680.0, 'active')
    """, (primary_student_id, provider_id, start_date, end_date))
    primary_sub_id = cur.lastrowid

    # Payment Record for Primary Student
    cur.execute("""
    INSERT INTO payments (
        student_id, provider_id, subscription_id, razorpay_order_id, razorpay_payment_id,
        amount, payment_method, status, receipt_number, notes, transaction_time
    ) VALUES (?, ?, ?, 'order_TIFFIN_9871', 'pay_RAZOR_TEST_9871', 4680.0, 'UPI', 'success', 'RCP-2026-1001', 'Monthly Student Tiffin Subscription Paid via Google Pay UPI', ?)
    """, (primary_student_id, provider_id, primary_sub_id, (today - timedelta(days=5)).strftime("%Y-%m-%d %H:%M:%S")))

    # Other Students Payments
    other_payments = [
        (student_records[1][0], 1350.0, 'Debit Card', 'pay_RAZOR_TEST_9872', 'RCP-2026-1002'),
        (student_records[2][0], 4680.0, 'UPI', 'pay_RAZOR_TEST_9873', 'RCP-2026-1003'),
        (student_records[3][0], 210.0, 'Credit Card', 'pay_RAZOR_TEST_9874', 'RCP-2026-1004')
    ]
    for s_id, amt, meth, pid, rcp in other_payments:
        cur.execute("""
        INSERT INTO subscriptions (
            student_id, provider_id, plan_id, plan_type, start_date, end_date,
            total_amount, discount_amount, final_amount, status
        ) VALUES (?, ?, 2, 'weekly', ?, ?, ?, 50.0, ?, 'active')
        """, (s_id, provider_id, start_date, end_date, amt, amt - 50.0))
        sub_id = cur.lastrowid

        cur.execute("""
        INSERT INTO payments (
            student_id, provider_id, subscription_id, razorpay_order_id, razorpay_payment_id,
            amount, payment_method, status, receipt_number, notes, transaction_time
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'success', ?, 'Automated Verified Payment', ?)
        """, (s_id, provider_id, sub_id, f"order_{pid}", pid, amt - 50.0, meth, rcp, (today - timedelta(days=3)).strftime("%Y-%m-%d %H:%M:%S")))

    # 8. Seed Attendance and Scheduled Orders for Past 5 days and Today
    meals = ['Breakfast', 'Lunch', 'Dinner']
    for day_offset in range(-5, 2):
        curr_date = (today + timedelta(days=day_offset)).strftime("%Y-%m-%d")
        for meal in meals:
            status = 'delivered' if day_offset < 0 else ('preparing' if (day_offset == 0 and meal == 'Lunch') else ('out_for_delivery' if (day_offset == 0 and meal == 'Breakfast') else 'scheduled'))
            att_status = 'present' if day_offset <= 0 else 'not_scheduled'
            if status == 'delivered':
                att_status = 'delivered'

            # Order
            cur.execute("""
            INSERT OR IGNORE INTO orders (student_id, provider_id, subscription_id, meal_date, meal_type, status, delivery_address)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (primary_student_id, provider_id, primary_sub_id, curr_date, meal, status, students_data[0][3]))
            order_id = cur.lastrowid

            if order_id and order_id > 0:
                # Delivery record
                del_status = 'delivered' if day_offset < 0 else ('preparing' if (day_offset == 0 and meal == 'Lunch') else ('out_for_delivery' if (day_offset == 0 and meal == 'Breakfast') else 'order_received'))
                cur.execute("""
                INSERT OR IGNORE INTO deliveries (
                    order_id, student_id, provider_id, meal_date, meal_type, status,
                    delivery_address, estimated_time
                ) VALUES (?, ?, ?, ?, ?, ?, ?, '30 mins')
                """, (order_id, primary_student_id, provider_id, curr_date, meal, del_status, students_data[0][3]))

            # Attendance
            cur.execute("""
            INSERT OR IGNORE INTO attendance (student_id, provider_id, meal_date, meal_type, status)
            VALUES (?, ?, ?, ?, ?)
            """, (primary_student_id, provider_id, curr_date, meal, att_status))

    # 9. Stop Meal Request example (for tomorrow's dinner)
    tomorrow = (today + timedelta(days=1)).strftime("%Y-%m-%d")
    cur.execute("""
    INSERT INTO stop_meal_requests (
        student_id, provider_id, request_date, meal_date, meal_type, cutoff_deadline, status, reason, refund_credit
    ) VALUES (?, ?, DATE('now'), ?, 'Dinner', '17:00 PM (2-Hour advance rule met)', 'approved', 'Attending college symposium and late dinner outside with batchmates', 90.0)
    """, (primary_student_id, provider_id, tomorrow))

    # 10. Food Suggestions & Votes
    suggestions = [
        ("Paneer Butter Masala", "Curry", "Rich cashew gravy with malai paneer cubes", 12),
        ("Chole Bhature", "North Indian", "Fluffy hot bhaturas with spiced tangy chole", 18),
        ("Rajma Chawal", "Comfort Food", "Slow cooked Punjabi rajma with jeera rice", 15),
        ("Veg Biryani", "Rice", "Hyderabadi dum biryani with burani raita", 14),
        ("Dal Makhani", "Dal", "Creamy slow-simmered black urad dal", 10),
        ("Special Gujarati Thali", "Thali", "Complete thali with kadhi, khichdi, fafda & sweets", 8)
    ]
    for s_name, cat, desc, votes in suggestions:
        cur.execute("""
        INSERT INTO food_suggestions (provider_id, student_id, food_name, category, description, vote_count)
        VALUES (?, ?, ?, ?, ?, ?)
        """, (provider_id, primary_student_id, s_name, cat, desc, votes))
        sug_id = cur.lastrowid
        cur.execute("""
        INSERT OR IGNORE INTO food_votes (suggestion_id, student_id)
        VALUES (?, ?)
        """, (sug_id, primary_student_id))

    # 11. Feedbacks & Ratings
    feedbacks_data = [
        (primary_student_id, (today - timedelta(days=1)).strftime("%Y-%m-%d"), 'Lunch', 'Excellent', 5, 5, 5, 5, 'Khana sach me bahut swadisht tha! Paneer ekdam fresh tha aur phulke bilkul ghar jaise naram the.', 0, 'Dhanyawad Aman ji! We strive to deliver healthy meals every day.'),
        (student_records[1][0], (today - timedelta(days=2)).strftime("%Y-%m-%d"), 'Dinner', 'Good', 4, 4, 4, 5, 'Roti was warm and soft. Please keep spices slightly balanced in dal.', 0, 'Noted Pooja ji, our head cook will moderate spices.'),
        (student_records[2][0], (today - timedelta(days=3)).strftime("%Y-%m-%d"), 'Lunch', 'Excellent', 5, 5, 4, 5, 'Superb Rajma Chawal. Perfect packaging and no oil leakage.', 1, None),
        (student_records[3][0], (today - timedelta(days=4)).strftime("%Y-%m-%d"), 'Breakfast', 'Average', 3, 3, 3, 4, 'Poha was slightly cold when it arrived at 9:15 AM.', 0, 'We have assigned a dedicated delivery associate to your hostel route.')
    ]
    for f in feedbacks_data:
        cur.execute("""
        INSERT INTO feedback (
            student_id, provider_id, meal_date, meal_type, general_rating,
            taste_rating, quality_rating, quantity_rating, hygiene_rating, comments,
            is_anonymous, owner_response
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (f[0], provider_id, f[1], f[2], f[3], f[4], f[5], f[6], f[7], f[8], f[9], f[10]))

    # 12. Expenses for Owner P&L
    expenses_data = [
        ((today - timedelta(days=1)).strftime("%Y-%m-%d"), 'Food / Raw Material', 1850.0, 'Daily vegetables, Amul Paneer, fresh milk, and spices purchase'),
        ((today - timedelta(days=2)).strftime("%Y-%m-%d"), 'Delivery Expenses', 450.0, 'Fuel allowance for 2 delivery boys'),
        ((today - timedelta(days=3)).strftime("%Y-%m-%d"), 'Gas', 1100.0, 'Commercial LPG Cylinder refill for kitchen'),
        ((today - timedelta(days=5)).strftime("%Y-%m-%d"), 'Staff Salaries', 4500.0, 'Weekly wages for 2 kitchen assistants and cleaning staff'),
        ((today - timedelta(days=10)).strftime("%Y-%m-%d"), 'Rent', 8000.0, 'Kitchen premises monthly rent'),
        ((today - timedelta(days=4)).strftime("%Y-%m-%d"), 'Packaging', 950.0, 'Eco-friendly biodegradable 4-compartment meal trays and foil rolls')
    ]
    for exp in expenses_data:
        cur.execute("""
        INSERT INTO expenses (provider_id, expense_date, category, amount, description)
        VALUES (?, ?, ?, ?, ?)
        """, (provider_id, exp[0], exp[1], exp[2], exp[3]))

    # 13. Notifications
    notifs = [
        (primary_student_user_id, "Welcome to Annapurna Tiffin!", "Your 30-Day Royal Monthly Subscription is active. Enjoy hygienic home-cooked meals!", "success", "profile"),
        (primary_student_user_id, "Weekly Menu Published", "Chef Rajesh has published the new weekly menu with weekend special Dal Baati Churma!", "menu", "menu"),
        (primary_student_user_id, "Stop Meal Approved", "Your dinner stop request for tomorrow has been confirmed. Refund credit of ₹90 applied.", "warning", "stop-meal"),
        (owner_user_id, "New Subscription Activated", "Student Aman Verma renewed 30-Day Royal Monthly Plan. ₹4,680 collected.", "payment", "payments"),
        (owner_user_id, "New Stop Meal Request", "Stop request received for tomorrow dinner from Aman Verma.", "info", "stop-requests"),
        (owner_user_id, "New Food Suggestion", "18 students voted for Chole Bhature on upcoming Friday special lunch.", "success", "analytics")
    ]
    for n in notifs:
        cur.execute("""
        INSERT INTO notifications (user_id, title, message, type, link_url)
        VALUES (?, ?, ?, ?, ?)
        """, (n[0], n[1], n[2], n[3], n[4]))

    conn.commit()
    print("Demo data seeded successfully.")

def seed_prisma_addons(conn):
    """Seed data for Prisma models: Staff, Inventory, Complaints, and Student details."""
    cur = conn.cursor()

    # 1. Update Student Profile Dietary & Wallet details
    cur.execute("""
    UPDATE students SET
        wallet_balance = 350.0,
        referral_code = 'AMAN' || id,
        reward_points = 120,
        is_jain = 0,
        less_spicy = 1,
        no_onion_garlic = 0,
        allergies = 'No peanuts',
        special_instructions = 'Deliver to room 302 directly',
        boxes_held = 2
    WHERE wallet_balance IS NULL OR wallet_balance = 0.0
    """)

    # 2. Staff
    cur.execute("SELECT COUNT(*) FROM staff")
    if cur.fetchone()[0] == 0:
        staff_data = [
            (1, "Maharaj Ramdayal", "COOK", "+91 98261 11223", 22000.0, 1),
            (1, "Gopal Verma", "HELPER", "+91 98261 44556", 11000.0, 1),
            (1, "Ramesh Kumar", "DELIVERY", "+91 98765 43210", 12500.0, 1),
            (1, "Suresh Yadav", "DELIVERY", "+91 98765 43219", 12500.0, 1)
        ]
        for st in staff_data:
            cur.execute("""
            INSERT INTO staff (provider_id, name, role, phone, salary, is_active)
            VALUES (?, ?, ?, ?, ?, ?)
            """, st)

    # 3. Inventory Items
    cur.execute("SELECT COUNT(*) FROM inventory_items")
    if cur.fetchone()[0] == 0:
        inv_data = [
            (1, "Sharbati Wheat Flour (Atta)", 120.0, "kg", 30.0, "Kailash Agro Mill"),
            (1, "Basmati Rice (Dubar)", 85.0, "kg", 20.0, "Indore Mandi Trd."),
            (1, "Pure Desi Ghee", 15.0, "L", 5.0, "Amul Dairy Depot"),
            (1, "Fresh Malai Paneer", 14.0, "kg", 4.0, "Gwalior Fresh Dairy"),
            (1, "Commercial LPG 19kg", 3.0, "cylinders", 1.0, "Bharat Gas Agency"),
            (1, "Refined Soybean Oil", 45.0, "L", 10.0, "Fortune Depot"),
            (1, "Toor Dal (Patan Premium)", 35.0, "kg", 8.0, "Mandi Grains")
        ]
        for iv in inv_data:
            cur.execute("""
            INSERT INTO inventory_items (provider_id, item_name, quantity, unit, min_threshold, supplier_name)
            VALUES (?, ?, ?, ?, ?, ?)
            """, iv)

    # 4. Complaints & Grievances
    cur.execute("SELECT COUNT(*) FROM complaints")
    if cur.fetchone()[0] == 0:
        comp_data = [
            (1, 1, "Delivery Delay", "Tuesday lunch delivery arrived 20 minutes late around 1:45 PM.", "RESOLVED", "Assigned dedicated delivery executive to hostel route."),
            (2, 1, "Quality", "Please moderate red chili spice in dal tadka.", "IN_PROGRESS", "Head chef instructed to use mild green chilies for student tiffins.")
        ]
        for cd in comp_data:
            cur.execute("""
            INSERT INTO complaints (student_id, provider_id, category, description, status, resolution)
            VALUES (?, ?, ?, ?, ?, ?)
            """, cd)

    # 5. Wallet Transactions
    cur.execute("SELECT COUNT(*) FROM wallet_transactions")
    if cur.fetchone()[0] == 0:
        tx_data = [
            (1, "CREDIT", 500.0, "Welcome sign-up reward credit", "TXN_INIT_001"),
            (1, "DEBIT", 240.0, "Subscribed single meal day plan", "TXN_SUB_002"),
            (1, "REFUND", 90.0, "Stop meal refund for Dinner (2-hr rule)", "TXN_REF_003")
        ]
        for tx in tx_data:
            cur.execute("""
            INSERT INTO wallet_transactions (student_id, type, amount, description, reference_id)
            VALUES (?, ?, ?, ?, ?)
            """, tx)

    # 6. Ensure QR Tokens on deliveries
    cur.execute("UPDATE deliveries SET qr_token = 'QR_' || id || '_' || substr(hex(randomblob(4)), 1, 8) WHERE qr_token IS NULL")

    conn.commit()
    print("Prisma addon models seeded successfully.")

if __name__ == "__main__":
    init_db()

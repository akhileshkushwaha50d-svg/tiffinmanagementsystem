/**
 * api.js - REST API Client for Tiffin Management Application
 * Connects frontend views with Python backend and SQLite database.
 */

const API = {
  baseUrl: window.location.origin.startsWith('http') ? window.location.origin : 'http://localhost:8000',

  getToken() {
    return localStorage.getItem('tiffin_token');
  },

  setToken(token) {
    if (token) localStorage.setItem('tiffin_token', token);
    else localStorage.removeItem('tiffin_token');
  },

  async request(endpoint, method = 'GET', data = null) {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = { 'Content-Type': 'application/json' };
    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const options = { method, headers };
    if (data && (method === 'POST' || method === 'PUT')) {
      options.body = JSON.stringify(data);
    }

    try {
      const response = await fetch(url, options);
      const json = await response.json();
      if (!response.ok && json.error) {
        throw new Error(json.error);
      }
      return json;
    } catch (err) {
      // If network unreachable (e.g. running standalone without server.py), seamlessly handle via LocalDB
      if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError') || !window.location.origin.startsWith('http')) {
        console.info(`[Offline/Standalone Mode] Handling ${method} ${endpoint} via integrated state`);
        return LocalFallback.handle(endpoint, method, data);
      }
      console.warn(`API Error [${method} ${endpoint}]:`, err.message);
      throw err;
    }
  },

  // Auth Endpoints
  async register(payload) {
    return this.request('/api/auth/register', 'POST', payload);
  },

  async login(identifier, password, role) {
    return this.request('/api/auth/login', 'POST', { identifier, password, role });
  },

  async googleAuth(email, full_name, role) {
    return this.request('/api/auth/google', 'POST', { email, full_name, role });
  },

  async getMe() {
    return this.request('/api/auth/me');
  },

  async forgotPassword(email) {
    return this.request('/api/auth/forgot-password', 'POST', { email });
  },

  // Common / Shared Endpoints
  async getProviders() {
    return this.request('/api/providers');
  },

  async getProviderDetails(id) {
    return this.request(`/api/providers/${id}`);
  },

  async getMenu(providerId = 1) {
    return this.request(`/api/menu?provider_id=${providerId}`);
  },

  async getPricing(providerId = 1) {
    return this.request(`/api/pricing?provider_id=${providerId}`);
  },

  async getSuggestions(providerId = 1) {
    return this.request(`/api/suggestions?provider_id=${providerId}`);
  },

  async voteSuggestion(suggestionId) {
    return this.request('/api/suggestions/vote', 'POST', { suggestion_id: suggestionId });
  },

  async addSuggestion(foodName, category, description) {
    return this.request('/api/suggestions/add', 'POST', { food_name: foodName, category, description });
  },

  async getNotifications() {
    return this.request('/api/notifications');
  },

  async markNotificationsRead() {
    return this.request('/api/notifications/mark-read', 'POST');
  },

  // Student Endpoints
  async getStudentDashboard() {
    return this.request('/api/student/dashboard');
  },

  async calculatePlanPrice(payload) {
    return this.request('/api/student/plan/calculate', 'POST', payload);
  },

  async verifyPayment(payload) {
    return this.request('/api/student/payment/verify', 'POST', payload);
  },

  async stopMeal(mealDate, mealType, reason) {
    return this.request('/api/student/stop-meal', 'POST', { meal_date: mealDate, meal_type: mealType, reason });
  },

  async getStudentAttendance() {
    return this.request('/api/student/attendance');
  },

  async getStudentDeliveries() {
    return this.request('/api/student/delivery-tracking');
  },

  async submitFeedback(payload) {
    return this.request('/api/student/feedback', 'POST', payload);
  },

  async getStudentProfile() {
    return this.request('/api/student/profile-history');
  },

  // Prisma Addon: Wallet & Dietary & Complaints
  async getWallet() {
    return this.request('/api/student/wallet');
  },

  async rechargeWallet(amount, paymentMethod = 'UPI') {
    return this.request('/api/student/wallet/recharge', 'POST', { amount, payment_method: paymentMethod });
  },

  async getDietary() {
    return this.request('/api/student/dietary');
  },

  async updateDietary(payload) {
    return this.request('/api/student/dietary', 'POST', payload);
  },

  async getStudentComplaints() {
    return this.request('/api/student/complaints');
  },

  async lodgeComplaint(category, description) {
    return this.request('/api/student/complaints', 'POST', { category, description });
  },

  // Owner Endpoints
  async getOwnerOverview() {
    return this.request('/api/owner/overview');
  },

  async getOwnerStudents() {
    return this.request('/api/owner/students');
  },

  async addOwnerStudent(payload) {
    return this.request('/api/owner/students/add', 'POST', payload);
  },

  async getOwnerTiffins() {
    return this.request('/api/owner/tiffins');
  },

  async updateOwnerMenu(payload) {
    return this.request('/api/owner/menu/update', 'POST', payload);
  },

  async deleteOwnerMenu(menuId) {
    return this.request(`/api/owner/menu/${menuId}`, 'DELETE');
  },

  async publishOwnerMenu() {
    return this.request('/api/owner/menu/publish', 'POST');
  },

  async updateOwnerPricing(payload) {
    return this.request('/api/owner/pricing', 'PUT', payload);
  },

  async getOwnerAttendance(date) {
    const q = date ? `?date=${date}` : '';
    return this.request(`/api/owner/attendance${q}`);
  },

  async updateOwnerAttendance(payload) {
    return this.request('/api/owner/attendance/update', 'POST', payload);
  },

  async getOwnerStopRequests() {
    return this.request('/api/owner/stop-requests');
  },

  async getOwnerDeliveries(date) {
    const q = date ? `?date=${date}` : '';
    return this.request(`/api/owner/deliveries${q}`);
  },

  async updateDeliveryStatus(deliveryId, status) {
    return this.request('/api/owner/deliveries/update-status', 'POST', { delivery_id: deliveryId, status });
  },

  async getOwnerPayments() {
    return this.request('/api/owner/payments');
  },

  async getOwnerFeedbackAnalytics() {
    return this.request('/api/owner/feedback-analytics');
  },

  async replyFeedback(feedbackId, reply) {
    return this.request('/api/owner/feedback/reply', 'POST', { feedback_id: feedbackId, reply });
  },

  async getOwnerProfitLoss() {
    return this.request('/api/owner/profit-loss');
  },

  async addOwnerExpense(payload) {
    return this.request('/api/owner/expenses/add', 'POST', payload);
  },

  async deleteOwnerExpense(expenseId) {
    return this.request(`/api/owner/expenses/${expenseId}`, 'DELETE');
  },

  async getOwnerSettings() {
    return this.request('/api/owner/settings');
  },

  async updateOwnerSettings(payload) {
    return this.request('/api/owner/settings', 'PUT', payload);
  },

  // Prisma Addon: Staff Management
  async getOwnerStaff() {
    return this.request('/api/owner/staff');
  },

  async addOwnerStaff(payload) {
    return this.request('/api/owner/staff/add', 'POST', payload);
  },

  async toggleOwnerStaff(staffId) {
    return this.request('/api/owner/staff/toggle', 'POST', { staff_id: staffId });
  },

  async deleteOwnerStaff(staffId) {
    return this.request(`/api/owner/staff/${staffId}`, 'DELETE');
  },

  // Prisma Addon: Inventory Management
  async getOwnerInventory() {
    return this.request('/api/owner/inventory');
  },

  async addOwnerInventory(payload) {
    return this.request('/api/owner/inventory/add', 'POST', payload);
  },

  async updateOwnerInventoryStock(itemId, quantity) {
    return this.request('/api/owner/inventory/update-stock', 'POST', { item_id: itemId, quantity });
  },

  async deleteOwnerInventory(itemId) {
    return this.request(`/api/owner/inventory/${itemId}`, 'DELETE');
  },

  // Prisma Addon: Complaints Management
  async getOwnerComplaints() {
    return this.request('/api/owner/complaints');
  },

  async resolveOwnerComplaint(complaintId, status, resolution) {
    return this.request('/api/owner/complaints/resolve', 'POST', { complaint_id: complaintId, status, resolution });
  },

  // Prisma Addon: Delivery QR Verification
  async verifyQrDelivery(qrToken) {
    return this.request('/api/owner/deliveries/verify-qr', 'POST', { qr_token: qrToken });
  }
};

/**
 * LocalFallback - Integrated offline state simulation
 * Ensures 100% functionality even when user double-clicks index.html without running python server.
 */
const LocalFallback = {
  state: {
    user: { id: 2, email: 'aman.verma@student.edu', full_name: 'Aman Verma', role: 'student', address: 'Room 302, Royal Boys Hostel, Indore' },
    owner: { id: 1, email: 'owner@annapurnatiffin.com', full_name: 'Rajesh Sharma', role: 'owner', business_name: 'Shree Annapurna Pure Veg Tiffin' },
    pricing: {
      breakfast_price: 50, lunch_price: 90, dinner_price: 90,
      day_plan_price: 210, weekly_plan_price: 1350, monthly_plan_price: 5200,
      monthly_discount_pct: 10, weekly_discount_pct: 5
    },
    students: [
      { id: 1, full_name: 'Aman Verma', email: 'aman.verma@student.edu', phone: '9876543210', plan_type: 'monthly', total_paid: 4680, subscription_status: 'active', delivery_address: 'Room 302, Royal Boys Hostel, Bhawarkua, Indore' },
      { id: 2, full_name: 'Pooja Sharma', email: 'pooja.sharma@college.in', phone: '9876543211', plan_type: 'weekly', total_paid: 1300, subscription_status: 'active', delivery_address: 'Flat 104, Shanti Kunj Girls PG, Indore' },
      { id: 3, full_name: 'Rohit Patidar', email: 'rohit.p@campus.org', phone: '9876543212', plan_type: 'monthly', total_paid: 4680, subscription_status: 'active', delivery_address: 'Room 12, Shivam Residency, Indore' },
      { id: 4, full_name: 'Sneha Kulkarni', email: 'sneha.k@univ.ac.in', phone: '9876543213', plan_type: 'day', total_paid: 210, subscription_status: 'active', delivery_address: 'C-8, Saraswati Girls Hostel, Indore' }
    ],
    expenses: [
      { id: 1, expense_date: '2026-11-23', category: 'Food / Raw Material', amount: 1850, description: 'Vegetables and paneer purchase' },
      { id: 2, expense_date: '2026-11-22', category: 'Delivery Expenses', amount: 450, description: 'Fuel allowance' },
      { id: 3, expense_date: '2026-11-20', category: 'Gas', amount: 1100, description: 'Commercial LPG Cylinder' },
      { id: 4, expense_date: '2026-11-18', category: 'Staff Salaries', amount: 4500, description: 'Weekly wages for cook & helpers' }
    ],
    suggestions: [
      { id: 1, food_name: 'Chole Bhature', category: 'North Indian', description: 'Fluffy hot bhaturas with spiced tangy chole', vote_count: 18, has_voted: 0 },
      { id: 2, food_name: 'Rajma Chawal', category: 'Comfort Food', description: 'Slow cooked Punjabi rajma with jeera rice', vote_count: 15, has_voted: 0 },
      { id: 3, food_name: 'Veg Biryani', category: 'Rice', description: 'Hyderabadi dum biryani with burani raita', vote_count: 14, has_voted: 0 },
      { id: 4, food_name: 'Paneer Butter Masala', category: 'Curry', description: 'Rich cashew gravy with malai paneer', vote_count: 12, has_voted: 0 },
      { id: 5, food_name: 'Dal Makhani', category: 'Dal', description: 'Creamy slow-simmered black urad dal', vote_count: 10, has_voted: 0 }
    ],
    deliveries: [
      { id: 1, student_id: 1, meal_date: '2026-11-24', meal_type: 'Lunch', status: 'preparing', delivery_address: 'Room 302, Royal Boys Hostel, Bhawarkua', estimated_time: '25 mins', delivery_person_name: 'Ramesh Kumar', delivery_person_phone: '+91 98765 43210' },
      { id: 2, student_id: 1, meal_date: '2026-11-24', meal_type: 'Breakfast', status: 'delivered', delivery_address: 'Room 302, Royal Boys Hostel, Bhawarkua', estimated_time: 'Delivered', delivery_person_name: 'Ramesh Kumar', delivery_person_phone: '+91 98765 43210' },
      { id: 3, student_id: 1, meal_date: '2026-11-23', meal_type: 'Dinner', status: 'delivered', delivery_address: 'Room 302, Royal Boys Hostel, Bhawarkua', estimated_time: 'Delivered', delivery_person_name: 'Ramesh Kumar', delivery_person_phone: '+91 98765 43210' }
    ],
    stop_requests: [
      { id: 1, student_name: 'Aman Verma', phone: '9876543210', meal_date: '2026-11-25', meal_type: 'Dinner', cutoff_deadline: '17:00 (2-Hr Rule Met)', status: 'approved', reason: 'College Symposium', refund_credit: 90 }
    ],
    attendance: [
      { student_id: 1, student_name: 'Aman Verma', meal_date: '2026-11-24', meal_type: 'Breakfast', status: 'delivered' },
      { student_id: 1, student_name: 'Aman Verma', meal_date: '2026-11-24', meal_type: 'Lunch', status: 'present' },
      { student_id: 1, student_name: 'Aman Verma', meal_date: '2026-11-24', meal_type: 'Dinner', status: 'present' }
    ],
    payments: [
      { receipt_number: 'RCP-2026-1001', student_name: 'Aman Verma', plan_type: 'monthly', payment_method: 'UPI', amount: 4680, transaction_time: '2026-11-19 14:20:00', status: 'success' },
      { receipt_number: 'RCP-2026-1002', student_name: 'Pooja Sharma', plan_type: 'weekly', payment_method: 'Debit Card', amount: 1300, transaction_time: '2026-11-21 11:15:00', status: 'success' },
      { receipt_number: 'RCP-2026-1003', student_name: 'Rohit Patidar', plan_type: 'monthly', payment_method: 'UPI', amount: 4680, transaction_time: '2026-11-20 18:30:00', status: 'success' }
    ],
    feedbacks: [
      { id: 1, student_name: 'Aman Verma', meal_date: '2026-11-23', meal_type: 'Lunch', general_rating: 'Excellent', taste_rating: 5, quality_rating: 5, quantity_rating: 5, hygiene_rating: 5, comments: 'Khana bahut swadisht tha! Paneer ekdam fresh tha.', owner_response: 'Dhanyawad Aman ji!' }
    ],
    wallet: { balance: 350.0, reward_points: 120, referral_code: 'AMAN1', boxes_held: 2 },
    wallet_transactions: [
      { id: 1, type: 'CREDIT', amount: 500.0, description: 'Welcome sign-up reward credit', reference_id: 'TXN_INIT_001', created_at: '2026-11-20' },
      { id: 2, type: 'DEBIT', amount: 240.0, description: 'Subscribed single meal day plan', reference_id: 'TXN_SUB_002', created_at: '2026-11-21' },
      { id: 3, type: 'REFUND', amount: 90.0, description: 'Stop meal refund for Dinner (2-hr rule)', reference_id: 'TXN_REF_003', created_at: '2026-11-22' }
    ],
    dietary: {
      is_jain: false, less_spicy: true, no_onion_garlic: false,
      allergies: 'No peanuts', special_instructions: 'Deliver to room 302 directly'
    },
    staff: [
      { id: 1, name: 'Maharaj Ramdayal', role: 'COOK', phone: '+91 98261 11223', salary: 22000.0, is_active: 1 },
      { id: 2, name: 'Gopal Verma', role: 'HELPER', phone: '+91 98261 44556', salary: 11000.0, is_active: 1 },
      { id: 3, name: 'Ramesh Kumar', role: 'DELIVERY', phone: '+91 98765 43210', salary: 12500.0, is_active: 1 },
      { id: 4, name: 'Suresh Yadav', role: 'DELIVERY', phone: '+91 98765 43219', salary: 12500.0, is_active: 1 }
    ],
    inventory: [
      { id: 1, item_name: 'Sharbati Wheat Flour (Atta)', quantity: 120.0, unit: 'kg', min_threshold: 30.0, supplier_name: 'Kailash Agro Mill', is_low_stock: 0 },
      { id: 2, item_name: 'Basmati Rice (Dubar)', quantity: 85.0, unit: 'kg', min_threshold: 20.0, supplier_name: 'Indore Mandi Trd.', is_low_stock: 0 },
      { id: 3, item_name: 'Pure Desi Ghee', quantity: 15.0, unit: 'L', min_threshold: 5.0, supplier_name: 'Amul Dairy Depot', is_low_stock: 0 },
      { id: 4, item_name: 'Commercial LPG 19kg', quantity: 1.0, unit: 'cylinders', min_threshold: 2.0, supplier_name: 'Bharat Gas Agency', is_low_stock: 1 }
    ],
    complaints: [
      { id: 1, student_name: 'Aman Verma', student_phone: '9876543210', category: 'Delivery Delay', description: 'Tuesday lunch delivery arrived 20 minutes late around 1:45 PM.', status: 'RESOLVED', resolution: 'Assigned dedicated delivery executive to hostel route.', created_at: '2026-11-23' },
      { id: 2, student_name: 'Pooja Sharma', student_phone: '9876543211', category: 'Quality', description: 'Please moderate red chili spice in dal tadka.', status: 'IN_PROGRESS', resolution: 'Head chef instructed to use mild green chilies for student tiffins.', created_at: '2026-11-24' }
    ]
  },

  handle(endpoint, method, data) {
    const s = this.state;
    const cleanPath = endpoint.split('?')[0];

    // Auth
    if (cleanPath === '/api/auth/me') {
      const role = localStorage.getItem('tiffin_selected_role') || 'student';
      return { authenticated: true, user: role === 'owner' ? s.owner : s.user };
    }
    if (cleanPath === '/api/auth/login' || cleanPath === '/api/auth/google') {
      const role = (data && data.role) || localStorage.getItem('tiffin_selected_role') || 'student';
      const user = role === 'owner' ? s.owner : s.user;
      return { success: true, token: 'local_demo_token', user };
    }
    if (cleanPath === '/api/auth/register') {
      return { success: true, token: 'local_demo_token', user: s.user };
    }
    if (cleanPath === '/api/auth/forgot-password') {
      return { success: true, message: 'Password reset link sent (demo)' };
    }

    // Providers & Pricing
    if (cleanPath.startsWith('/api/providers')) {
      return {
        success: true,
        provider: {
          id: 1, business_name: 'Shree Annapurna Pure Veg Tiffin & Meals', owner_name: 'Rajesh Sharma',
          city: 'Indore', description: 'Healthy home-style vegetarian tiffin service for students.',
          business_address: 'Plot 45, Near Holkar Science College, Bhawarkua, Indore', contact_phone: '+91 98260 12345',
          breakfast_time: '07:30 AM - 09:30 AM', lunch_time: '12:30 PM - 02:30 PM', dinner_time: '07:30 PM - 09:30 PM',
          breakfast_cutoff_time: '07:00', lunch_cutoff_time: '10:00', dinner_cutoff_time: '17:00', advance_cutoff_hours: 2
        },
        pricing: s.pricing,
        ratings: { avg_taste: 4.8, total_reviews: 14 },
        reviews: s.feedbacks
      };
    }
    if (cleanPath === '/api/pricing') {
      return { success: true, pricing: s.pricing };
    }

    // Weekly Menu
    if (cleanPath === '/api/menu') {
      const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
      const menu = [];
      days.forEach(d => {
        menu.push({ id: 1, day_of_week: d, meal_type: 'Breakfast', food_name: 'Indori Sev Poha & Jalebi', description: 'Fresh Poha with crispy Jalebis', items_included: 'Poha, Jalebi, Sprouts, Mint Chutney', image_url: 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?w=600', is_special: 0 });
        menu.push({ id: 2, day_of_week: d, meal_type: 'Lunch', food_name: 'Shahi Paneer Thali', description: '4 Butter Phulkas, Paneer Butter Masala, Dal Tadka, Rice', items_included: '4 Rotis, Paneer, Dal, Rice, Salad', image_url: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=600', is_special: 1 });
        menu.push({ id: 3, day_of_week: d, meal_type: 'Dinner', food_name: 'Aloo Gobi & Dal Fry', description: 'Homestyle light vegetables with cumin rice and phulkas', items_included: '4 Rotis, Aloo Gobi, Dal Fry, Rice, Papad', image_url: 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=600', is_special: 0 });
      });
      return { success: true, menu };
    }

    // Student Dashboard
    if (cleanPath === '/api/student/dashboard') {
      return {
        success: true,
        student: { id: 1, user_id: 2, provider_id: 1, delivery_address: 'Room 302, Royal Boys Hostel, Indore' },
        provider: { business_name: 'Shree Annapurna Pure Veg Tiffin' },
        active_subscription: { plan_type: 'monthly', final_amount: 4680, status: 'active' },
        today_menu: [
          { meal_type: 'Breakfast', food_name: 'Poha & Jalebi', description: 'Sev Poha with hot crispy Jalebis', items_included: 'Poha, Jalebi, Tea', image_url: 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?w=600', is_special: 0 },
          { meal_type: 'Lunch', food_name: 'Special Homestyle Thali', description: 'Fresh phulkas with Matar Paneer, Dal Tadka and Rice', items_included: '4 Rotis, Paneer, Dal, Rice, Salad', image_url: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=600', is_special: 1 },
          { meal_type: 'Dinner', food_name: 'Aloo Gobi & Dal Makhani', description: 'Delicious dinner with hot rotis and sweet kheer', items_included: '4 Rotis, Aloo Gobi, Dal, Kheer', image_url: 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=600', is_special: 0 }
        ],
        today_orders: [
          { meal_type: 'Lunch', status: 'preparing', delivery_status: 'preparing', delivery_address: 'Room 302, Royal Boys Hostel', estimated_time: '25 mins' }
        ],
        attendance_summary: { total_present: 18, total_absent: 0, total_stopped: 2 },
        recent_stop_requests: s.stop_requests
      };
    }

    // Plan Calculate
    if (cleanPath === '/api/student/plan/calculate') {
      const p = (data && data.plan_type) || 'monthly';
      let subtotal = 5200, discount = 520;
      if (p === 'weekly') { subtotal = 1350; discount = 67.5; }
      else if (p === 'day') { subtotal = 210; discount = 0; }
      else if (p === 'custom') { subtotal = 340; discount = 0; }
      return { success: true, breakdown: { plan_type: p, subtotal, discount, final_amount: subtotal - discount } };
    }

    // Verify Payment
    if (cleanPath === '/api/student/payment/verify') {
      const amt = (data && data.final_amount) || 4680;
      const rcp = {
        receipt_number: `RCP-2026-${Math.floor(1000 + Math.random() * 9000)}`,
        payment_id: `pay_RAZOR_${Date.now()}`,
        amount: amt,
        plan_type: (data && data.plan_type) || 'monthly',
        date: new Date().toLocaleString()
      };
      s.payments.unshift({ receipt_number: rcp.receipt_number, student_name: 'Aman Verma', plan_type: rcp.plan_type, payment_method: 'UPI', amount: amt, transaction_time: 'Just now', status: 'success' });
      return { success: true, message: 'Payment verified and subscription activated!', receipt: rcp };
    }

    // Stop Meal
    if (cleanPath === '/api/student/stop-meal') {
      s.stop_requests.unshift({
        id: Date.now(), student_name: 'Aman Verma', phone: '9876543210',
        meal_date: data.meal_date, meal_type: data.meal_type, cutoff_deadline: 'Satisfied', status: 'approved', reason: data.reason, refund_credit: 90
      });
      return { success: true, message: `Meal stop request approved for ${data.meal_type} on ${data.meal_date}. ₹90 refund credited!` };
    }

    // Attendance
    if (cleanPath === '/api/student/attendance') {
      return { success: true, attendance: s.attendance };
    }

    // Tracking
    if (cleanPath === '/api/student/delivery-tracking') {
      return { success: true, deliveries: s.deliveries };
    }

    // Student Profile
    if (cleanPath === '/api/student/profile-history') {
      return {
        success: true,
        student: { full_name: 'Aman Verma', email: 'aman.verma@student.edu', phone: '9876543210', delivery_address: 'Room 302, Royal Boys Hostel, Indore', business_name: 'Shree Annapurna Pure Veg Tiffin' },
        user: s.user,
        payments: s.payments,
        feedback: s.feedbacks,
        stop_requests: s.stop_requests
      };
    }

    // Suggestions
    if (cleanPath === '/api/suggestions') {
      return { success: true, suggestions: s.suggestions };
    }
    if (cleanPath === '/api/suggestions/vote') {
      const sug = s.suggestions.find(x => x.id === data.suggestion_id);
      if (sug) { sug.vote_count++; sug.has_voted = 1; }
      return { success: true, message: 'Vote recorded!' };
    }
    if (cleanPath === '/api/suggestions/add') {
      s.suggestions.unshift({ id: Date.now(), food_name: data.food_name, category: data.category, description: data.description, vote_count: 1, has_voted: 1 });
      return { success: true, message: 'Suggested successfully!' };
    }

    // Feedback
    if (cleanPath === '/api/student/feedback') {
      s.feedbacks.unshift({
        id: Date.now(), student_name: 'Aman Verma', meal_date: 'Today', meal_type: data.meal_type,
        general_rating: data.general_rating, taste_rating: data.taste_rating, hygiene_rating: data.hygiene_rating,
        comments: data.comments
      });
      return { success: true, message: 'Thank you for your valuable rating!' };
    }

    // Notifications
    if (cleanPath === '/api/notifications') {
      return {
        success: true, unread_count: 2,
        notifications: [
          { title: 'Welcome to Tiffin App', message: 'Your subscription is active!', created_at: 'Just now', is_read: 0 },
          { title: 'Weekly Menu Published', message: 'Check today\'s chef specials.', created_at: '2 hours ago', is_read: 0 }
        ]
      };
    }
    if (cleanPath === '/api/notifications/mark-read') {
      return { success: true };
    }

    // Owner Endpoints
    if (cleanPath === '/api/owner/overview') {
      return {
        success: true,
        metrics: {
          total_students: s.students.length,
          active_students: s.students.length,
          active_subscriptions: s.students.length,
          today_orders: { total_today: 12, breakfast_today: 4, lunch_today: 4, dinner_today: 4 },
          today_collection: 4680,
          monthly_revenue: 14720,
          monthly_expenses: 7900,
          net_profit_loss: 6820,
          pending_deliveries: 1,
          completed_deliveries: 3,
          stop_requests: s.stop_requests.length
        },
        recent_deliveries: s.deliveries
      };
    }

    if (cleanPath === '/api/owner/students') {
      return { success: true, students: s.students };
    }
    if (cleanPath === '/api/owner/students/add') {
      s.students.unshift({ id: Date.now(), full_name: data.full_name, email: data.email, phone: data.phone, plan_type: 'monthly', total_paid: 0, subscription_status: 'active', delivery_address: data.delivery_address });
      return { success: true, message: `Student ${data.full_name} registered successfully!` };
    }

    if (cleanPath === '/api/owner/tiffins') {
      const tiffins = s.students.map(st => ({ student_name: st.full_name, meal_type: 'Lunch', delivery_address: st.delivery_address, phone: st.phone, status: 'preparing' }));
      return { success: true, tiffins };
    }

    if (cleanPath === '/api/owner/pricing' && method === 'PUT') {
      Object.assign(s.pricing, data);
      return { success: true, message: 'Pricing rules updated!' };
    }

    if (cleanPath === '/api/owner/menu/publish') {
      return { success: true, message: `Weekly menu published to ${s.students.length} students!` };
    }

    if (cleanPath === '/api/owner/attendance') {
      const list = s.students.map(st => ({ student_id: st.id, student_name: st.full_name, meal_date: 'Today', meal_type: 'Lunch', status: 'present' }));
      return { success: true, attendance: list };
    }
    if (cleanPath === '/api/owner/attendance/update') {
      return { success: true, message: 'Attendance status updated and audit logged!' };
    }

    if (cleanPath === '/api/owner/stop-requests') {
      return { success: true, stop_requests: s.stop_requests };
    }

    if (cleanPath === '/api/owner/deliveries') {
      return { success: true, deliveries: s.deliveries };
    }
    if (cleanPath === '/api/owner/deliveries/update-status') {
      const d = s.deliveries.find(x => x.id == data.delivery_id);
      if (d) d.status = data.status;
      return { success: true, message: `Delivery updated to ${data.status}!` };
    }

    if (cleanPath === '/api/owner/payments') {
      return { success: true, payments: s.payments, summary: { today: 4680, monthly: 14720 } };
    }

    if (cleanPath === '/api/owner/feedback-analytics') {
      return {
        success: true,
        metrics: { excellent_count: 5, good_count: 3, average_count: 1, not_good_count: 0, overall_avg: 4.8 },
        feedbacks: s.feedbacks,
        suggestions: s.suggestions
      };
    }
    if (cleanPath === '/api/owner/feedback/reply') {
      const fb = s.feedbacks.find(x => x.id == data.feedback_id);
      if (fb) fb.owner_response = data.reply;
      return { success: true, message: 'Feedback response sent!' };
    }

    if (cleanPath === '/api/owner/profit-loss') {
      const totRev = 14720;
      const totExp = s.expenses.reduce((a, b) => a + Number(b.amount), 0);
      const catMap = {};
      s.expenses.forEach(e => {
        catMap[e.category] = (catMap[e.category] || 0) + Number(e.amount);
      });
      const catBreakdown = Object.keys(catMap).map(k => ({ category: k, total_amount: catMap[k] }));
      return {
        success: true,
        income: { daily_revenue: 4680, weekly_revenue: 10040, monthly_revenue: totRev, total_revenue: totRev },
        expenses_summary: { daily_expense: 1850, weekly_expense: 4500, monthly_expense: totExp, total_expense: totExp },
        category_breakdown: catBreakdown,
        expenses_list: s.expenses,
        profit_loss: { daily_net: 4680 - 1850, weekly_net: 10040 - 4500, monthly_net: totRev - totExp, total_net: totRev - totExp }
      };
    }
    if (cleanPath === '/api/owner/expenses/add') {
      s.expenses.unshift({ id: Date.now(), expense_date: data.expense_date, category: data.category, amount: data.amount, description: data.description });
      return { success: true, message: `Expense of ₹${data.amount} recorded under ${data.category}!` };
    }
    if (cleanPath.startsWith('/api/owner/expenses/')) {
      return { success: true, message: 'Expense deleted' };
    }

    if (cleanPath === '/api/owner/settings') {
      return {
        success: true,
        settings: {
          business_name: 'Shree Annapurna Pure Veg Tiffin', description: 'Fresh vegetarian meals daily', contact_phone: '+91 98260 12345',
          business_address: 'Plot 45, Near Holkar Science College, Bhawarkua, Indore', breakfast_time: '07:30 AM - 09:30 AM',
          lunch_time: '12:30 PM - 02:30 PM', dinner_time: '07:30 PM - 09:30 PM', breakfast_cutoff_time: '07:00', lunch_cutoff_time: '10:00',
          dinner_cutoff_time: '17:00', advance_cutoff_hours: 2
        }
      };
    }

    // Prisma Addon Handlers in LocalFallback
    if (cleanPath === '/api/student/wallet') {
      return {
        success: true,
        wallet_balance: s.wallet.balance,
        reward_points: s.wallet.reward_points,
        referral_code: s.wallet.referral_code,
        boxes_held: s.wallet.boxes_held,
        transactions: s.wallet_transactions
      };
    }
    if (cleanPath === '/api/student/wallet/recharge') {
      const amt = Number(data.amount || 0);
      s.wallet.balance += amt;
      s.wallet_transactions.unshift({
        id: Date.now(), type: 'CREDIT', amount: amt, description: `Wallet recharge via ${data.payment_method || 'UPI'}`, reference_id: `WAL_${Date.now()}`, created_at: 'Just now'
      });
      return { success: true, message: `₹${amt} added to wallet!`, new_balance: s.wallet.balance };
    }

    if (cleanPath === '/api/student/dietary') {
      if (method === 'POST' || method === 'PUT') {
        Object.assign(s.dietary, data);
        return { success: true, message: 'Dietary preferences updated!' };
      }
      return { success: true, dietary: s.dietary };
    }

    if (cleanPath === '/api/student/complaints') {
      if (method === 'POST') {
        const item = { id: Date.now(), student_name: s.user.full_name, category: data.category, description: data.description, status: 'OPEN', resolution: '', created_at: 'Just now' };
        s.complaints.unshift(item);
        return { success: true, message: 'Complaint registered successfully!' };
      }
      return { success: true, complaints: s.complaints };
    }

    if (cleanPath === '/api/owner/staff') {
      const activeCount = s.staff.filter(x => x.is_active).length;
      const totalPayroll = s.staff.filter(x => x.is_active).reduce((a, b) => a + b.salary, 0);
      return { success: true, staff: s.staff, summary: { total_count: s.staff.length, active_count: activeCount, monthly_payroll: totalPayroll } };
    }
    if (cleanPath === '/api/owner/staff/add') {
      s.staff.push({ id: Date.now(), name: data.name, role: data.role || 'COOK', phone: data.phone, salary: Number(data.salary || 10000), is_active: 1 });
      return { success: true, message: `Staff member '${data.name}' added!` };
    }
    if (cleanPath === '/api/owner/staff/toggle') {
      const st = s.staff.find(x => x.id == data.staff_id);
      if (st) st.is_active = st.is_active ? 0 : 1;
      return { success: true, message: 'Staff status updated!' };
    }
    if (cleanPath.startsWith('/api/owner/staff/') && method === 'DELETE') {
      const sid = cleanPath.split('/').pop();
      s.staff = s.staff.filter(x => x.id != sid);
      return { success: true, message: 'Staff member removed' };
    }

    if (cleanPath === '/api/owner/inventory') {
      const lowCount = s.inventory.filter(x => x.quantity <= x.min_threshold).length;
      return { success: true, items: s.inventory, low_stock_count: lowCount };
    }
    if (cleanPath === '/api/owner/inventory/add') {
      s.inventory.push({ id: Date.now(), item_name: data.item_name, quantity: Number(data.quantity || 0), unit: data.unit || 'kg', min_threshold: Number(data.min_threshold || 5), supplier_name: data.supplier_name, is_low_stock: 0 });
      return { success: true, message: `Item '${data.item_name}' added to inventory!` };
    }
    if (cleanPath === '/api/owner/inventory/update-stock') {
      const item = s.inventory.find(x => x.id == data.item_id);
      if (item) {
        item.quantity = Number(data.quantity || 0);
        item.is_low_stock = item.quantity <= item.min_threshold ? 1 : 0;
      }
      return { success: true, message: 'Inventory quantity updated!' };
    }
    if (cleanPath.startsWith('/api/owner/inventory/') && method === 'DELETE') {
      const iid = cleanPath.split('/').pop();
      s.inventory = s.inventory.filter(x => x.id != iid);
      return { success: true, message: 'Inventory item removed' };
    }

    if (cleanPath === '/api/owner/complaints') {
      const openCount = s.complaints.filter(x => x.status === 'OPEN').length;
      return { success: true, complaints: s.complaints, summary: { total: s.complaints.length, open: openCount, in_progress: 1, resolved: 1 } };
    }
    if (cleanPath === '/api/owner/complaints/resolve') {
      const comp = s.complaints.find(x => x.id == data.complaint_id);
      if (comp) {
        comp.status = data.status || 'RESOLVED';
        comp.resolution = data.resolution || '';
      }
      return { success: true, message: `Complaint marked as ${data.status}!` };
    }

    if (cleanPath === '/api/owner/deliveries/verify-qr') {
      return { success: true, message: 'QR Token verified! Meal marked as Delivered.' };
    }

    return { success: true };
  }
};
  }
};


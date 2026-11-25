/**
 * student.js - Student / Customer Dashboard Logic & Features
 */

const Student = {
  currentTab: 'home',
  dashboardData: null,
  selectedPlan: 'monthly',
  customSelections: [], // Array of { date: 'YYYY-MM-DD', meals: ['breakfast', 'lunch'] }
  ratingState: {
    general: 'Excellent',
    taste: 5,
    quality: 5,
    quantity: 5,
    hygiene: 5
  },

  async init() {
    await this.loadHome();
  },

  switchTab(tab) {
    this.currentTab = tab;
    document.querySelectorAll('.student-nav-item').forEach(el => {
      el.classList.toggle('active', el.dataset.tab === tab);
    });
    document.querySelectorAll('.bottom-nav-item').forEach(el => {
      el.classList.toggle('active', el.dataset.tab === tab);
    });

    const titleEl = document.getElementById('student-page-title');
    const titles = {
      'home': "Student Home",
      'provider': "Tiffin Provider Details",
      'plans': "Meal Plans & Subscriptions",
      'menu': "Weekly Food Menu",
      'suggestions': "Food Suggestions & Demand Voting",
      'rating': "Today's Food Rating",
      'attendance': "Attendance & Meal Calendar",
      'stop-meal': "Stop Meal (2-Hour Cutoff)",
      'tracking': "Delivery Tracking",
      'feedback': "Feedback & Complaints",
      'profile': "Profile & Subscription History",
      'wallet': "Wallet, Rewards & Boxes",
      'dietary': "Dietary Preferences & Health",
      'complaints': "Grievances & Service Issues"
    };
    if (titleEl) titleEl.innerText = titles[tab] || "Student Portal";

    // Hide all student subviews and show current
    document.querySelectorAll('.student-view-tab').forEach(el => el.style.display = 'none');
    const target = document.getElementById(`student-tab-${tab}`);
    if (target) target.style.display = 'block';

    // Load data for selected tab
    if (tab === 'home') this.loadHome();
    else if (tab === 'provider') this.loadProviderDetails();
    else if (tab === 'plans') this.loadMealPlans();
    else if (tab === 'menu') this.loadWeeklyMenu();
    else if (tab === 'suggestions') this.loadSuggestions();
    else if (tab === 'rating') this.renderRatingSection();
    else if (tab === 'attendance') this.loadAttendance();
    else if (tab === 'stop-meal') this.loadStopMeal();
    else if (tab === 'tracking') this.loadTracking();
    else if (tab === 'feedback') this.loadFeedbackList();
    else if (tab === 'profile') this.loadProfile();
    else if (tab === 'wallet') this.loadWallet();
    else if (tab === 'dietary') this.loadDietary();
    else if (tab === 'complaints') this.loadComplaints();
  },

  // 1. HOME DASHBOARD
  async loadHome() {
    try {
      App.setLoading(true, "Loading student dashboard...");
      const res = await API.getStudentDashboard();
      this.dashboardData = res;

      // Welcome Banner
      const nameEl = document.getElementById('student-home-name');
      if (nameEl && Auth.currentUser) nameEl.innerText = Auth.currentUser.full_name;

      // Provider badge
      const provEl = document.getElementById('student-home-provider');
      if (provEl && res.provider) {
        provEl.innerText = res.provider.business_name;
      }

      // Subscription badge
      const subBadge = document.getElementById('student-home-sub-badge');
      if (subBadge) {
        if (res.active_subscription) {
          subBadge.className = 'badge badge-success';
          subBadge.innerText = `Active (${res.active_subscription.plan_type.toUpperCase()} PLAN)`;
        } else {
          subBadge.className = 'badge badge-danger';
          subBadge.innerText = 'No Active Plan';
        }
      }

      // Attendance summary cards
      const attP = document.getElementById('stat-student-present');
      const attA = document.getElementById('stat-student-absent');
      const attS = document.getElementById('stat-student-stopped');
      if (attP) attP.innerText = res.attendance_summary.total_present || 0;
      if (attA) attA.innerText = res.attendance_summary.total_absent || 0;
      if (attS) attS.innerText = res.attendance_summary.total_stopped || 0;

      // Today's Meals
      this.renderTodayMeals(res.today_menu, res.today_orders);

      // Today's Delivery quick tracker
      this.renderHomeDeliveryTracker(res.today_orders);

    } catch (err) {
      App.toast(err.message, 'error');
    } finally {
      App.setLoading(false);
    }
  },

  renderTodayMeals(menuList, ordersList) {
    const container = document.getElementById('student-today-meals-grid');
    if (!container) return;

    if (!menuList || menuList.length === 0) {
      container.innerHTML = `<div class="card text-center text-muted" style="grid-column: 1/-1;">Today's menu will be published shortly by your tiffin owner.</div>`;
      return;
    }

    container.innerHTML = menuList.map(m => {
      // Find matching order status
      const matchedOrder = ordersList ? ordersList.find(o => o.meal_type.toLowerCase() === m.meal_type.toLowerCase()) : null;
      let statusBadge = `<span class="badge badge-info">Scheduled</span>`;
      if (matchedOrder) {
        if (matchedOrder.status === 'delivered') statusBadge = `<span class="badge badge-success">✓ Delivered</span>`;
        else if (matchedOrder.status === 'out_for_delivery') statusBadge = `<span class="badge badge-warning">🛵 Out for Delivery</span>`;
        else if (matchedOrder.status === 'preparing') statusBadge = `<span class="badge badge-info">👨‍🍳 Preparing</span>`;
        else if (matchedOrder.status === 'stopped') statusBadge = `<span class="badge badge-danger">🛑 Stopped by You</span>`;
      }

      return `
      <div class="meal-card">
        <div class="meal-card-img-wrap">
          <img src="${m.image_url || 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=600'}" alt="${m.food_name}" class="meal-card-img">
          <span class="meal-type-pill">${m.meal_type}</span>
          ${m.is_special ? '<span class="special-badge">⭐ Today\'s Special</span>' : ''}
        </div>
        <div class="meal-card-body">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <h4>${m.food_name}</h4>
            ${statusBadge}
          </div>
          <p>${m.description || 'Nutritious balanced meal freshly cooked with minimal oil and homemade spices.'}</p>
          <div class="meal-card-items">
            <strong>Includes:</strong> ${m.items_included || '4 Rotis, Main Curry, Dal, Rice, Salad'}
          </div>
        </div>
      </div>
      `;
    }).join('');
  },

  renderHomeDeliveryTracker(orders) {
    const wrap = document.getElementById('student-home-delivery-box');
    if (!wrap) return;

    if (!orders || orders.length === 0) {
      wrap.innerHTML = `<p class="text-muted text-center">No active meal delivery for today yet.</p>`;
      return;
    }

    // Pick latest or ongoing order
    const ongoing = orders.find(o => o.status !== 'stopped') || orders[0];
    const statusMap = { 'order_received': 1, 'preparing': 2, 'out_for_delivery': 3, 'delivered': 4, 'stopped': 0 };
    const currentStep = statusMap[ongoing.delivery_status || ongoing.status] || 1;

    wrap.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
        <div>
          <h4 style="font-size:1.05rem;">Today's ${ongoing.meal_type} Delivery</h4>
          <p class="text-muted" style="font-size:0.8rem;">To: ${ongoing.delivery_address || 'Registered Address'}</p>
        </div>
        <span class="badge badge-${currentStep === 4 ? 'success' : 'warning'}">
          ${(ongoing.delivery_status || ongoing.status).replace('_', ' ').toUpperCase()}
        </span>
      </div>
      <div class="tracker-steps">
        <div class="tracker-step ${currentStep >= 1 ? 'completed active' : ''}">
          <div class="tracker-step-icon">📋</div>
          <div class="tracker-step-title">Order Placed</div>
        </div>
        <div class="tracker-step ${currentStep >= 2 ? 'completed active' : ''}">
          <div class="tracker-step-icon">🍳</div>
          <div class="tracker-step-title">Preparing</div>
        </div>
        <div class="tracker-step ${currentStep >= 3 ? 'completed active' : ''}">
          <div class="tracker-step-icon">🛵</div>
          <div class="tracker-step-title">Out for Delivery</div>
        </div>
        <div class="tracker-step ${currentStep >= 4 ? 'completed active' : ''}">
          <div class="tracker-step-icon">✅</div>
          <div class="tracker-step-title">Delivered</div>
        </div>
      </div>
      <div style="text-align:right; margin-top:8px;">
        <button class="btn btn-sm btn-secondary" onclick="Student.switchTab('tracking')">Full Delivery Tracking →</button>
      </div>
    `;
  },

  // 2. TIFFIN PROVIDER DETAILS
  async loadProviderDetails() {
    try {
      App.setLoading(true, "Fetching tiffin hotel details...");
      const res = await API.getProviderDetails(1);
      const p = res.provider;
      const ratings = res.ratings;

      const container = document.getElementById('provider-details-content');
      if (!container) return;

      container.innerHTML = `
        <div class="card">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:16px;">
            <div>
              <span class="badge badge-success" style="margin-bottom:8px;">Verified Provider</span>
              <h2 style="font-size:1.8rem; font-weight:800; color:var(--text-main);">${p.business_name}</h2>
              <p class="text-muted" style="margin-top:4px;">Managed by: <strong>${p.owner_name}</strong> | City: <strong>${p.city}</strong></p>
              <p style="margin-top:8px; max-width:650px;">${p.description}</p>
            </div>
            <div style="text-align:right;">
              <div style="background:var(--primary-bg); padding:12px 18px; border-radius:var(--radius-lg); border:1px solid var(--primary-border); display:inline-block;">
                <div style="font-size:1.6rem; font-weight:800; color:var(--primary);">★ ${ratings.avg_taste ? Number(ratings.avg_taste).toFixed(1) : '4.8'}</div>
                <div style="font-size:0.75rem; color:var(--text-muted);">${ratings.total_reviews || 12} Verified Student Ratings</div>
              </div>
            </div>
          </div>

          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:16px; margin-top:24px; padding-top:20px; border-top:1px solid var(--surface-border);">
            <div>
              <div class="text-muted" style="font-size:0.75rem; font-weight:700; text-transform:uppercase;">📍 Business Address</div>
              <div style="font-weight:600; font-size:0.9rem; margin-top:4px;">${p.business_address}</div>
            </div>
            <div>
              <div class="text-muted" style="font-size:0.75rem; font-weight:700; text-transform:uppercase;">📞 Contact Hotline</div>
              <div style="font-weight:600; font-size:0.9rem; margin-top:4px;">${p.contact_phone}</div>
            </div>
            <div>
              <div class="text-muted" style="font-size:0.75rem; font-weight:700; text-transform:uppercase;">⏱️ Breakfast Timing</div>
              <div style="font-weight:600; font-size:0.9rem; margin-top:4px;">${p.breakfast_time} (Cutoff: ${p.breakfast_cutoff_time})</div>
            </div>
            <div>
              <div class="text-muted" style="font-size:0.75rem; font-weight:700; text-transform:uppercase;">⏱️ Lunch Timing</div>
              <div style="font-weight:600; font-size:0.9rem; margin-top:4px;">${p.lunch_time} (Cutoff: ${p.lunch_cutoff_time})</div>
            </div>
            <div>
              <div class="text-muted" style="font-size:0.75rem; font-weight:700; text-transform:uppercase;">⏱️ Dinner Timing</div>
              <div style="font-weight:600; font-size:0.9rem; margin-top:4px;">${p.dinner_time} (Cutoff: ${p.dinner_cutoff_time})</div>
            </div>
            <div>
              <div class="text-muted" style="font-size:0.75rem; font-weight:700; text-transform:uppercase;">🛑 Cancellation Cutoff</div>
              <div style="font-weight:600; font-size:0.9rem; margin-top:4px; color:var(--primary);">${p.advance_cutoff_hours}-Hour Mandatory Advance Rule</div>
            </div>
          </div>
        </div>

        <!-- Food Images Gallery -->
        <div class="card">
          <h3 class="card-title" style="margin-bottom:16px;">Kitchen & Thali Gallery</h3>
          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:14px;">
            <img src="https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=600" alt="Homestyle Thali" style="width:100%; height:160px; object-fit:cover; border-radius:var(--radius-md);">
            <img src="https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=600" alt="Dal Makhani & Phulkas" style="width:100%; height:160px; object-fit:cover; border-radius:var(--radius-md);">
            <img src="https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?w=600" alt="Indori Sev Poha" style="width:100%; height:160px; object-fit:cover; border-radius:var(--radius-md);">
            <img src="https://images.unsplash.com/photo-1606491956689-2ea866880c84?w=600" alt="Fresh Parathas" style="width:100%; height:160px; object-fit:cover; border-radius:var(--radius-md);">
          </div>
        </div>

        <!-- Recent Reviews -->
        <div class="card">
          <h3 class="card-title" style="margin-bottom:16px;">Verified Student Reviews</h3>
          <div style="display:flex; flex-direction:column; gap:12px;">
            ${res.reviews.map(r => `
              <div style="padding:14px; background:var(--surface-bg); border-radius:var(--radius-md); border:1px solid var(--surface-border);">
                <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                  <strong style="font-size:0.95rem;">${r.student_name}</strong>
                  <span class="badge badge-success">★ ${r.taste_rating}/5</span>
                </div>
                <p style="font-size:0.85rem; color:var(--text-muted);">${r.comments || 'Very good food, always served on time!'}</p>
                ${r.owner_response ? `<div style="margin-top:8px; padding:8px 12px; background:#fff; border-left:3px solid var(--primary); border-radius:4px; font-size:0.8rem;"><strong>Owner Response:</strong> ${r.owner_response}</div>` : ''}
              </div>
            `).join('')}
          </div>
        </div>
      `;
    } catch (err) {
      App.toast(err.message, 'error');
    } finally {
      App.setLoading(false);
    }
  },

  // 3. MEAL PLANS & DYNAMIC PRICING CALCULATION
  async loadMealPlans() {
    try {
      App.setLoading(true, "Loading live meal plans...");
      const res = await API.getPricing(1);
      const pr = res.pricing || {
        breakfast_price: 50, lunch_price: 90, dinner_price: 90,
        day_plan_price: 210, weekly_plan_price: 1350, monthly_plan_price: 5200,
        monthly_discount_pct: 10, weekly_discount_pct: 5
      };

      // Set pricing attributes
      window.tiffinPricing = pr;
      this.recalculatePlan();
    } catch (err) {
      App.toast(err.message, 'error');
    } finally {
      App.setLoading(false);
    }
  },

  selectPlanType(planType) {
    this.selectedPlan = planType;
    document.querySelectorAll('.plan-select-card').forEach(c => {
      c.classList.toggle('selected', c.dataset.plan === planType);
    });

    const customPanel = document.getElementById('custom-dates-picker-panel');
    const dayPanel = document.getElementById('single-day-picker-panel');
    if (customPanel) customPanel.style.display = planType === 'custom' ? 'block' : 'none';
    if (dayPanel) dayPanel.style.display = planType === 'day' ? 'block' : 'none';

    this.recalculatePlan();
  },

  async recalculatePlan() {
    const pr = window.tiffinPricing || {};
    const planType = this.selectedPlan;

    // Check selected meals for day-wise plan
    const bCheck = document.getElementById('chk-meal-b')?.checked ?? true;
    const lCheck = document.getElementById('chk-meal-l')?.checked ?? true;
    const dCheck = document.getElementById('chk-meal-d')?.checked ?? true;
    const selectedMeals = [];
    if (bCheck) selectedMeals.push('breakfast');
    if (lCheck) selectedMeals.push('lunch');
    if (dCheck) selectedMeals.push('dinner');

    const payload = {
      plan_type: planType,
      provider_id: 1,
      selected_meals: selectedMeals,
      custom_selections: this.customSelections
    };

    try {
      const res = await API.calculatePlanPrice(payload);
      const b = res.breakdown;

      // Update UI elements
      const subtotalEl = document.getElementById('checkout-subtotal-val');
      const discountEl = document.getElementById('checkout-discount-val');
      const totalEl = document.getElementById('checkout-final-val');
      const planNameEl = document.getElementById('checkout-plan-name');

      if (subtotalEl) subtotalEl.innerText = `₹${b.subtotal.toFixed(2)}`;
      if (discountEl) discountEl.innerText = `-₹${b.discount.toFixed(2)}`;
      if (totalEl) totalEl.innerText = `₹${b.final_amount.toFixed(2)}`;
      if (planNameEl) planNameEl.innerText = `${planType.toUpperCase()} MEAL PLAN`;

      // Store in memory for payment checkout
      this.currentCheckoutData = {
        plan_type: planType,
        subtotal: b.subtotal,
        discount: b.discount,
        final_amount: b.final_amount,
        selected_meals: selectedMeals,
        custom_selections: this.customSelections
      };
    } catch (err) {
      console.warn("Recalculation error:", err);
    }
  },

  addCustomDateSlot() {
    const dateInput = document.getElementById('custom-slot-date');
    const mealSelect = document.getElementById('custom-slot-meal');
    if (!dateInput || !dateInput.value) {
      App.toast("Please select a date", "warning");
      return;
    }
    const dVal = dateInput.value;
    const mVal = mealSelect.value; // 'breakfast', 'lunch', 'dinner', or 'all'
    const meals = mVal === 'all' ? ['breakfast', 'lunch', 'dinner'] : [mVal];

    this.customSelections.push({ date: dVal, meals: meals });
    this.renderCustomSlots();
    this.recalculatePlan();
    App.toast(`Added ${meals.join(', ')} for ${dVal}`, "info");
  },

  renderCustomSlots() {
    const list = document.getElementById('custom-slots-list');
    if (!list) return;
    list.innerHTML = this.customSelections.map((slot, idx) => `
      <div style="display:flex; justify-content:space-between; align-items:center; background:#fff; padding:6px 12px; border-radius:6px; border:1px solid var(--surface-border); margin-bottom:6px; font-size:0.85rem;">
        <span>📅 <strong>${slot.date}</strong>: ${slot.meals.join(', ')}</span>
        <button class="btn btn-sm btn-danger" onclick="Student.removeCustomSlot(${idx})">×</button>
      </div>
    `).join('');
  },

  removeCustomSlot(idx) {
    this.customSelections.splice(idx, 1);
    this.renderCustomSlots();
    this.recalculatePlan();
  },

  // 4. PAYMENT & CHECKOUT SCREEN
  openCheckoutModal() {
    if (!this.currentCheckoutData || this.currentCheckoutData.final_amount <= 0) {
      App.toast("Please configure a meal plan with valid selections.", "warning");
      return;
    }

    const modal = document.getElementById('payment-checkout-modal');
    const amtEl = document.getElementById('modal-pay-amount');
    const planEl = document.getElementById('modal-pay-plan');

    if (amtEl) amtEl.innerText = `₹${this.currentCheckoutData.final_amount.toFixed(2)}`;
    if (planEl) planEl.innerText = `${this.currentCheckoutData.plan_type.toUpperCase()} SUBSCRIPTION`;

    if (modal) modal.classList.add('active');
  },

  closeCheckoutModal() {
    const modal = document.getElementById('payment-checkout-modal');
    if (modal) modal.classList.remove('active');
  },

  async processTestPayment(method = 'UPI') {
    const data = this.currentCheckoutData;
    if (!data) return;

    try {
      App.setLoading(true, `Processing ${method} payment via Razorpay test mode...`);
      const payload = {
        provider_id: 1,
        plan_type: data.plan_type,
        total_amount: data.subtotal,
        discount_amount: data.discount,
        final_amount: data.final_amount,
        payment_method: method,
        selected_meals: data.selected_meals
      };

      const res = await API.verifyPayment(payload);
      this.closeCheckoutModal();

      // Show Success Receipt Modal
      this.showPaymentReceipt(res.receipt);
      App.toast("Payment verified and subscription activated!", "success");
      this.loadHome(); // refresh home metrics
    } catch (err) {
      App.toast(err.message || "Payment verification failed", "error");
    } finally {
      App.setLoading(false);
    }
  },

  showPaymentReceipt(rcp) {
    const modal = document.getElementById('payment-receipt-modal');
    const body = document.getElementById('payment-receipt-body');
    if (!modal || !body) return;

    body.innerHTML = `
      <div style="text-align:center; padding:10px 0 20px;">
        <div style="font-size:3rem; margin-bottom:8px;">✅</div>
        <h3 style="color:var(--primary); font-weight:800;">PAYMENT SUCCESSFUL</h3>
        <p class="text-muted" style="font-size:0.85rem;">Official Tax Invoice & Subscription Receipt</p>
      </div>

      <div style="background:var(--surface-bg); padding:16px; border-radius:var(--radius-md); border:1px dashed var(--surface-border); margin-bottom:20px; font-size:0.9rem;">
        <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
          <span class="text-muted">Receipt Number:</span>
          <strong>${rcp.receipt_number}</strong>
        </div>
        <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
          <span class="text-muted">Razorpay Payment ID:</span>
          <strong>${rcp.payment_id}</strong>
        </div>
        <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
          <span class="text-muted">Subscription Plan:</span>
          <strong>${rcp.plan_type.toUpperCase()}</strong>
        </div>
        <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
          <span class="text-muted">Transaction Timestamp:</span>
          <span>${rcp.date}</span>
        </div>
        <div style="display:flex; justify-content:space-between; margin-top:12px; padding-top:10px; border-top:1px solid var(--surface-border); font-size:1.1rem; font-weight:800; color:var(--primary-dark);">
          <span>Total Paid:</span>
          <span>₹${Number(rcp.amount).toFixed(2)}</span>
        </div>
      </div>

      <div style="display:flex; gap:10px;">
        <button class="btn btn-primary btn-block" onclick="window.print()">🖨️ Print Receipt</button>
        <button class="btn btn-secondary btn-block" onclick="document.getElementById('payment-receipt-modal').classList.remove('active')">Close</button>
      </div>
    `;
    modal.classList.add('active');
  },

  // 5. WEEKLY MENU
  async loadWeeklyMenu(day = 'Monday') {
    try {
      App.setLoading(true, "Fetching weekly menu...");
      const res = await API.getMenu(1);
      const allMenus = res.menu;

      // Render Day Tabs
      const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
      const tabsWrap = document.getElementById('weekly-menu-day-tabs');
      if (tabsWrap) {
        tabsWrap.innerHTML = days.map(d => `
          <button class="btn btn-sm ${d === day ? 'btn-primary' : 'btn-secondary'}" onclick="Student.loadWeeklyMenu('${d}')">${d}</button>
        `).join('');
      }

      // Filter for active day
      const dayMeals = allMenus.filter(m => m.day_of_week === day);
      const container = document.getElementById('student-weekly-menu-cards');
      if (container) {
        container.innerHTML = dayMeals.map(m => `
          <div class="meal-card">
            <div class="meal-card-img-wrap">
              <img src="${m.image_url}" alt="${m.food_name}" class="meal-card-img">
              <span class="meal-type-pill">${m.meal_type}</span>
              ${m.is_special ? '<span class="special-badge">⭐ Special Dish</span>' : ''}
            </div>
            <div class="meal-card-body">
              <h4>${m.food_name}</h4>
              <p>${m.description || 'Authentic taste with balanced nutrition.'}</p>
              <div class="meal-card-items">
                <strong>Includes:</strong> ${m.items_included || 'Hot Phulkas, Sabzi, Rice, Dal'}
              </div>
            </div>
          </div>
        `).join('');
      }
    } catch (err) {
      App.toast(err.message, 'error');
    } finally {
      App.setLoading(false);
    }
  },

  // 6. FOOD SUGGESTIONS & HIGH DEMAND VOTING
  async loadSuggestions() {
    try {
      App.setLoading(true, "Fetching food suggestions...");
      const res = await API.getSuggestions(1);
      const list = res.suggestions;

      const container = document.getElementById('suggestions-grid');
      if (!container) return;

      container.innerHTML = list.map((s, idx) => `
        <div class="card" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; padding:18px;">
          <div>
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
              <span class="badge ${idx < 3 ? 'badge-success' : 'badge-secondary'}">#${idx + 1} High Demand</span>
              <span class="badge badge-info">${s.category}</span>
            </div>
            <h4 style="font-size:1.1rem; font-weight:700;">${s.food_name}</h4>
            <p class="text-muted" style="font-size:0.85rem;">${s.description || 'Proposed student favourite dish'}</p>
          </div>
          <div style="text-align:right;">
            <div style="font-size:1.4rem; font-weight:800; color:var(--primary); margin-bottom:6px;">${s.vote_count} Votes</div>
            <button class="btn btn-sm ${s.has_voted ? 'btn-secondary' : 'btn-primary'}" ${s.has_voted ? 'disabled' : ''} onclick="Student.voteDish(${s.id})">
              ${s.has_voted ? '✓ Voted' : '👍 Upvote'}
            </button>
          </div>
        </div>
      `).join('');
    } catch (err) {
      App.toast(err.message, 'error');
    } finally {
      App.setLoading(false);
    }
  },

  async voteDish(sugId) {
    try {
      await API.voteSuggestion(sugId);
      App.toast("Thank you! Your vote has been recorded.", "success");
      this.loadSuggestions();
    } catch (err) {
      App.toast(err.message || "Failed to record vote", "warning");
    }
  },

  async submitNewSuggestion() {
    const name = document.getElementById('new-sug-name')?.value.trim();
    const cat = document.getElementById('new-sug-cat')?.value || 'Main Course';
    const desc = document.getElementById('new-sug-desc')?.value.trim();

    if (!name) {
      App.toast("Please enter dish name", "warning");
      return;
    }

    try {
      App.setLoading(true, "Submitting suggestion...");
      await API.addSuggestion(name, cat, desc);
      App.toast(`Suggested '${name}' successfully!`, "success");
      document.getElementById('new-sug-name').value = '';
      document.getElementById('new-sug-desc').value = '';
      this.loadSuggestions();
    } catch (err) {
      App.toast(err.message, "error");
    } finally {
      App.setLoading(false);
    }
  },

  // 7. TODAY'S FOOD RATING ("KHANA ACHHA THA AAJ KA?")
  renderRatingSection() {
    // Select reaction buttons
    const btns = document.querySelectorAll('.reaction-btn');
    btns.forEach(b => {
      b.onclick = () => {
        btns.forEach(x => x.classList.remove('selected'));
        b.classList.add('selected');
        this.ratingState.general = b.dataset.rating;
      };
    });
  },

  setStarRating(category, starCount) {
    this.ratingState[category] = starCount;
    const row = document.getElementById(`stars-${category}`);
    if (!row) return;
    const stars = row.querySelectorAll('.star');
    stars.forEach((s, i) => {
      s.classList.toggle('filled', i < starCount);
    });
  },

  async submitRatingForm() {
    const comments = document.getElementById('rating-comments')?.value.trim();
    const isAnon = document.getElementById('chk-rating-anon')?.checked || false;
    const mealType = document.getElementById('rating-meal-type')?.value || 'Lunch';

    const payload = {
      meal_type: mealType,
      general_rating: this.ratingState.general,
      taste_rating: this.ratingState.taste,
      quality_rating: this.ratingState.quality,
      quantity_rating: this.ratingState.quantity,
      hygiene_rating: this.ratingState.hygiene,
      comments: comments,
      is_anonymous: isAnon
    };

    try {
      App.setLoading(true, "Submitting feedback...");
      const res = await API.submitFeedback(payload);
      App.toast(res.message, "success");
      document.getElementById('rating-comments').value = '';
      this.switchTab('home');
    } catch (err) {
      App.toast(err.message, "error");
    } finally {
      App.setLoading(false);
    }
  },

  // 8. ATTENDANCE MANAGEMENT
  async loadAttendance() {
    try {
      App.setLoading(true, "Loading monthly attendance...");
      const res = await API.getStudentAttendance();
      const records = res.attendance;

      const container = document.getElementById('attendance-calendar-view');
      if (!container) return;

      // Group records by date
      const dateMap = {};
      records.forEach(r => {
        if (!dateMap[r.meal_date]) dateMap[r.meal_date] = [];
        dateMap[r.meal_date].push(r);
      });

      // Render calendar for current month (last 14 days to next 14 days)
      const now = new Date();
      const todayStr = now.toISOString().split('T')[0];

      let cellsHtml = '';
      for (let offset = -14; offset <= 14; offset++) {
        const d = new Date();
        d.setDate(now.getDate() + offset);
        const dStr = d.toISOString().split('T')[0];
        const isToday = dStr === todayStr;
        const dayMeals = dateMap[dStr] || [];

        const mealTags = dayMeals.map(m => {
          let cName = 'tag-present';
          if (m.status === 'delivered') cName = 'tag-delivered';
          else if (m.status === 'absent') cName = 'tag-absent';
          else if (m.status === 'meal_stopped') cName = 'tag-stopped';
          return `<span class="meal-dot-tag ${cName}">${m.meal_type[0]}: ${m.status}</span>`;
        }).join('');

        cellsHtml += `
          <div class="calendar-day-cell ${isToday ? 'today' : ''}">
            <div class="day-num">${d.getDate()} ${d.toLocaleString('default', { month: 'short' })}</div>
            <div class="day-meals-status">
              ${mealTags || '<span class="text-muted" style="font-size:0.65rem;">No meal</span>'}
            </div>
          </div>
        `;
      }

      container.innerHTML = `
        <div class="calendar-grid">
          ${cellsHtml}
        </div>
      `;
    } catch (err) {
      App.toast(err.message, 'error');
    } finally {
      App.setLoading(false);
    }
  },

  // 9. STOP MEAL (2-Hour Cutoff Rule)
  async loadStopMeal() {
    // Set default date to tomorrow
    const dInput = document.getElementById('stop-meal-date');
    if (dInput) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      dInput.value = tomorrow.toISOString().split('T')[0];
    }
    this.loadStopMealHistory();
  },

  async loadStopMealHistory() {
    try {
      const res = await API.request('/api/student/stop-requests');
      const list = res.stop_requests;
      const wrap = document.getElementById('stop-meal-history-list');
      if (wrap) {
        wrap.innerHTML = list.map(r => `
          <div style="padding:12px; background:var(--surface-bg); border-radius:var(--radius-md); border:1px solid var(--surface-border); margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;">
            <div>
              <strong>${r.meal_date} (${r.meal_type})</strong>
              <div class="text-muted" style="font-size:0.8rem;">Reason: ${r.reason || 'Personal'} | Deadline: ${r.cutoff_deadline}</div>
            </div>
            <div style="text-align:right;">
              <span class="badge badge-success">✓ Confirmed</span>
              <div style="font-size:0.75rem; color:var(--primary); font-weight:700; margin-top:4px;">₹${r.refund_credit} Refund Applied</div>
            </div>
          </div>
        `).join('') || '<p class="text-muted">No stop requests submitted yet.</p>';
      }
    } catch (e) {
      console.warn(e);
    }
  },

  async submitStopMealRequest() {
    const mealDate = document.getElementById('stop-meal-date')?.value;
    const mealType = document.getElementById('stop-meal-type')?.value;
    const reason = document.getElementById('stop-meal-reason')?.value.trim() || 'Personal schedule';

    if (!mealDate) {
      App.toast("Please select a date", "warning");
      return;
    }

    try {
      App.setLoading(true, "Validating 2-Hour cutoff deadline...");
      const res = await API.stopMeal(mealDate, mealType, reason);
      App.toast(res.message, "success");
      this.loadStopMealHistory();
      this.loadHome();
    } catch (err) {
      App.toast(err.message, "error");
    } finally {
      App.setLoading(false);
    }
  },

  // 10. DELIVERY TRACKING
  async loadTracking() {
    try {
      App.setLoading(true, "Tracking live deliveries...");
      const res = await API.getStudentDeliveries();
      const list = res.deliveries;

      const wrap = document.getElementById('delivery-tracking-list');
      if (!wrap) return;

      if (!list || list.length === 0) {
        wrap.innerHTML = `<div class="card text-center text-muted">No recent deliveries to track.</div>`;
        return;
      }

      wrap.innerHTML = list.map(d => {
        const statusMap = { 'order_received': 1, 'preparing': 2, 'out_for_delivery': 3, 'delivered': 4 };
        const step = statusMap[d.status] || 1;

        return `
          <div class="card" style="margin-bottom:20px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
              <div>
                <h4 style="font-size:1.15rem; font-weight:700;">${d.meal_date} - ${d.meal_type} Delivery</h4>
                <p class="text-muted" style="font-size:0.85rem;">Address: ${d.delivery_address}</p>
              </div>
              <span class="badge badge-${step === 4 ? 'success' : 'warning'}">
                ${d.status.replace('_', ' ').toUpperCase()}
              </span>
            </div>

            <div class="tracker-steps">
              <div class="tracker-step ${step >= 1 ? 'completed active' : ''}">
                <div class="tracker-step-icon">📋</div>
                <div class="tracker-step-title">Order Received</div>
              </div>
              <div class="tracker-step ${step >= 2 ? 'completed active' : ''}">
                <div class="tracker-step-icon">👨‍🍳</div>
                <div class="tracker-step-title">Preparing</div>
              </div>
              <div class="tracker-step ${step >= 3 ? 'completed active' : ''}">
                <div class="tracker-step-icon">🛵</div>
                <div class="tracker-step-title">Out for Delivery</div>
              </div>
              <div class="tracker-step ${step >= 4 ? 'completed active' : ''}">
                <div class="tracker-step-icon">✅</div>
                <div class="tracker-step-title">Delivered</div>
              </div>
            </div>

            <div style="display:flex; justify-content:space-between; align-items:center; background:var(--surface-bg); padding:12px; border-radius:var(--radius-md); margin-top:16px; font-size:0.85rem;">
              <div>
                <div>Delivery Executive: <strong>${d.delivery_person_name || 'Ramesh Kumar'}</strong></div>
                <div class="text-muted">Contact: ${d.delivery_person_phone || '+91 98765 43210'}</div>
              </div>
              <div style="text-align:right;">
                <div>Estimated Arrival: <strong>${d.estimated_time || '30 mins'}</strong></div>
                <div class="text-muted">Updated: ${d.updated_at || 'Just now'}</div>
              </div>
            </div>

            ${d.qr_token ? `
            <div style="margin-top:14px; padding:12px 16px; background:var(--primary-bg); border:1px dashed var(--primary-border); border-radius:var(--radius-md); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
              <div>
                <div style="font-weight:700; color:var(--primary-dark); font-size:0.9rem;">📱 Contactless Delivery QR Token</div>
                <div style="font-size:0.8rem; color:var(--text-muted);">Share this verification token with your delivery executive upon arrival:</div>
              </div>
              <div style="background:#fff; border:1px solid var(--primary-border); padding:6px 14px; border-radius:8px; font-family:monospace; font-weight:800; font-size:1.1rem; color:var(--primary-dark); letter-spacing:1px; box-shadow:0 1px 3px rgba(0,0,0,0.05);">
                ${d.qr_token}
              </div>
            </div>
            ` : ''}
          </div>
        `;
      }).join('');
    } catch (err) {
      App.toast(err.message, 'error');
    } finally {
      App.setLoading(false);
    }
  },

  // 11. FEEDBACK & COMPLAINTS
  async loadFeedbackList() {
    try {
      const res = await API.getStudentProfile();
      const feedbacks = res.feedback;
      const wrap = document.getElementById('student-previous-feedback-list');
      if (wrap) {
        wrap.innerHTML = feedbacks.map(f => `
          <div style="padding:14px; background:var(--surface-bg); border-radius:var(--radius-md); border:1px solid var(--surface-border); margin-bottom:10px;">
            <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
              <strong>${f.meal_date} - ${f.meal_type} (${f.general_rating})</strong>
              <span class="badge badge-success">★ ${f.taste_rating}/5</span>
            </div>
            <p style="font-size:0.85rem; color:var(--text-muted);">${f.comments || 'No written comment'}</p>
            ${f.owner_response ? `<div style="margin-top:8px; padding:8px 12px; background:#fff; border-left:3px solid var(--primary); font-size:0.8rem;"><strong>Owner Response:</strong> ${f.owner_response}</div>` : ''}
          </div>
        `).join('') || '<p class="text-muted">No feedbacks submitted yet.</p>';
      }
    } catch (e) {
      console.warn(e);
    }
  },

  // 12. PROFILE & HISTORY
  async loadProfile() {
    try {
      App.setLoading(true, "Loading profile & history...");
      const res = await API.getStudentProfile();
      const s = res.student;
      const u = res.user;

      const wrap = document.getElementById('student-profile-details');
      if (wrap) {
        wrap.innerHTML = `
          <div class="card" style="display:flex; gap:20px; align-items:center;">
            <div class="avatar" style="width:72px; height:72px; font-size:1.8rem;">${u.full_name[0]}</div>
            <div style="flex-grow:1;">
              <h3 style="font-size:1.4rem; font-weight:800;">${u.full_name}</h3>
              <p class="text-muted">${u.email} | ${u.phone || 'No phone set'}</p>
              <p style="margin-top:4px;"><strong>Delivery Address:</strong> ${s.delivery_address}</p>
              <p style="margin-top:2px;"><strong>Current Tiffin Center:</strong> ${s.business_name || 'Shree Annapurna Pure Veg Tiffin'}</p>
            </div>
            <button class="btn btn-danger" onclick="Auth.logout()">Log Out</button>
          </div>
        `;
      }

      // Payments Table
      const payWrap = document.getElementById('profile-payments-table-body');
      if (payWrap) {
        payWrap.innerHTML = res.payments.map(p => `
          <tr>
            <td><strong>${p.receipt_number}</strong></td>
            <td>${p.transaction_time}</td>
            <td>${p.payment_method}</td>
            <td><strong>₹${Number(p.amount).toFixed(2)}</strong></td>
            <td><span class="badge badge-success">Success</span></td>
          </tr>
        `).join('') || '<tr><td colspan="5" class="text-center text-muted">No payments recorded</td></tr>';
      }
    } catch (err) {
      App.toast(err.message, 'error');
    } finally {
      App.setLoading(false);
    }
  },

  // 13. PRISMA MODEL: WALLET & REWARDS
  async loadWallet() {
    try {
      App.setLoading(true, "Loading wallet & containers data...");
      const res = await API.getWallet();

      const balEl = document.getElementById('student-wallet-bal-val');
      const ptsEl = document.getElementById('student-reward-pts-val');
      const boxEl = document.getElementById('student-boxes-held-val');
      const refEl = document.getElementById('student-referral-code-val');

      if (balEl) balEl.innerText = `₹${Number(res.wallet_balance || 0).toFixed(2)}`;
      if (ptsEl) ptsEl.innerText = `${res.reward_points || 0} pts`;
      if (boxEl) boxEl.innerText = `${res.boxes_held || 0} containers`;
      if (refEl) refEl.innerText = res.referral_code || 'AMAN1';

      const tableBody = document.getElementById('student-wallet-tx-table');
      if (tableBody) {
        if (!res.transactions || res.transactions.length === 0) {
          tableBody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">No transactions found</td></tr>';
        } else {
          tableBody.innerHTML = res.transactions.map(t => {
            const isCredit = t.type === 'CREDIT' || t.type === 'REFUND';
            const badgeClass = t.type === 'REFUND' ? 'badge-info' : (isCredit ? 'badge-success' : 'badge-danger');
            return `
              <tr>
                <td><code>${t.reference_id || `TXN_${t.id}`}</code></td>
                <td><span class="badge ${badgeClass}">${t.type}</span></td>
                <td>${t.description}</td>
                <td><strong style="color:${isCredit ? 'var(--primary)' : 'var(--danger)'}">${isCredit ? '+' : '-'}₹${Number(t.amount).toFixed(2)}</strong></td>
                <td>${t.created_at}</td>
              </tr>
            `;
          }).join('');
        }
      }
    } catch (err) {
      App.toast(err.message, 'error');
    } finally {
      App.setLoading(false);
    }
  },

  openRechargeModal() {
    const modal = document.getElementById('student-recharge-modal');
    if (modal) modal.classList.add('active');
  },

  closeRechargeModal() {
    const modal = document.getElementById('student-recharge-modal');
    if (modal) modal.classList.remove('active');
  },

  async handleRechargeSubmit(e) {
    e.preventDefault();
    const amount = Number(document.getElementById('wallet-recharge-amount').value || 0);
    const method = document.getElementById('wallet-recharge-method').value || 'UPI';

    if (amount <= 0) {
      App.toast("Please enter a valid recharge amount", 'error');
      return;
    }

    try {
      App.setLoading(true, "Processing wallet recharge...");
      const res = await API.rechargeWallet(amount, method);
      App.toast(res.message || `₹${amount} credited to wallet!`, 'success');
      this.closeRechargeModal();
      await this.loadWallet();
    } catch (err) {
      App.toast(err.message, 'error');
    } finally {
      App.setLoading(false);
    }
  },

  // 14. PRISMA MODEL: DIETARY PREFERENCES
  async loadDietary() {
    try {
      App.setLoading(true, "Loading dietary preferences...");
      const res = await API.getDietary();
      const d = res.dietary || {};

      const jainEl = document.getElementById('diet-is-jain');
      const spicyEl = document.getElementById('diet-less-spicy');
      const ogEl = document.getElementById('diet-no-onion-garlic');
      const allerEl = document.getElementById('diet-allergies');
      const instrEl = document.getElementById('diet-instructions');

      if (jainEl) jainEl.checked = !!d.is_jain;
      if (spicyEl) spicyEl.checked = !!d.less_spicy;
      if (ogEl) ogEl.checked = !!d.no_onion_garlic;
      if (allerEl) allerEl.value = d.allergies || '';
      if (instrEl) instrEl.value = d.special_instructions || '';
    } catch (err) {
      App.toast(err.message, 'error');
    } finally {
      App.setLoading(false);
    }
  },

  async saveDietaryPreferences(e) {
    e.preventDefault();
    const payload = {
      is_jain: document.getElementById('diet-is-jain').checked ? 1 : 0,
      less_spicy: document.getElementById('diet-less-spicy').checked ? 1 : 0,
      no_onion_garlic: document.getElementById('diet-no-onion-garlic').checked ? 1 : 0,
      allergies: (document.getElementById('diet-allergies').value || '').trim(),
      special_instructions: (document.getElementById('diet-instructions').value || '').trim()
    };

    try {
      App.setLoading(true, "Saving dietary settings...");
      const res = await API.updateDietary(payload);
      App.toast(res.message || "Dietary preferences saved!", 'success');
    } catch (err) {
      App.toast(err.message, 'error');
    } finally {
      App.setLoading(false);
    }
  },

  // 15. PRISMA MODEL: COMPLAINTS & GRIEVANCES
  async loadComplaints() {
    try {
      App.setLoading(true, "Loading complaints...");
      const res = await API.getStudentComplaints();
      const listEl = document.getElementById('student-complaints-list');

      if (listEl) {
        if (!res.complaints || res.complaints.length === 0) {
          listEl.innerHTML = '<p class="text-muted">No grievances submitted yet. Everything looks good!</p>';
        } else {
          listEl.innerHTML = res.complaints.map(c => {
            const statusClass = c.status === 'RESOLVED' ? 'badge-success' : (c.status === 'IN_PROGRESS' ? 'badge-info' : 'badge-warning');
            return `
              <div style="background:var(--surface-bg); border:1px solid var(--surface-border); border-radius:var(--radius-md); padding:16px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                  <strong>${c.category}</strong>
                  <span class="badge ${statusClass}">${c.status}</span>
                </div>
                <p style="font-size:0.9rem; margin-bottom:8px;">${c.description}</p>
                <div style="font-size:0.8rem; color:var(--text-muted); display:flex; justify-content:space-between;">
                  <span>Filed on: ${c.created_at}</span>
                  <span>Center: ${c.business_name || 'Annapurna Tiffin'}</span>
                </div>
                ${c.resolution ? `
                  <div style="margin-top:10px; padding:10px 14px; background:#fff; border-left:3px solid var(--primary); border-radius:4px; font-size:0.85rem;">
                    <strong style="color:var(--primary-dark);">Resolution from Kitchen:</strong> ${c.resolution}
                  </div>
                ` : ''}
              </div>
            `;
          }).join('');
        }
      }
    } catch (err) {
      App.toast(err.message, 'error');
    } finally {
      App.setLoading(false);
    }
  },

  async handleLodgeComplaint(e) {
    e.preventDefault();
    const category = document.getElementById('complaint-category').value;
    const description = (document.getElementById('complaint-desc').value || '').trim();

    if (!description) {
      App.toast("Please describe the issue", 'error');
      return;
    }

    try {
      App.setLoading(true, "Submitting grievance...");
      const res = await API.lodgeComplaint(category, description);
      App.toast(res.message || "Grievance submitted!", 'success');
      document.getElementById('complaint-desc').value = '';
      await this.loadComplaints();
    } catch (err) {
      App.toast(err.message, 'error');
    } finally {
      App.setLoading(false);
    }
  }
};

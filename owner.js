/**
 * owner.js - Tiffin Owner Business Management Dashboard & Logic
 */

const Owner = {
  currentTab: 'overview',
  overviewData: null,

  async init() {
    await this.loadOverview();
  },

  switchTab(tab) {
    this.currentTab = tab;
    document.querySelectorAll('.owner-nav-item').forEach(el => {
      el.classList.toggle('active', el.dataset.tab === tab);
    });

    const titleEl = document.getElementById('owner-page-title');
    const titles = {
      'overview': "Owner Business Overview",
      'students': "Student Management",
      'tiffins': "Active Tiffin Management",
      'menu': "Weekly Menu Management",
      'pricing': "Pricing & Subscription Plans",
      'attendance': "Student Attendance Management",
      'stop-requests': "Stop Tiffin Requests",
      'deliveries': "Delivery Dispatch & Management",
      'payments': "Payments & Money Collection",
      'feedback': "Feedback, Ratings & Demand Analytics",
      'profit-loss': "Profit & Loss Management",
      'settings': "Business Settings & Policies",
      'staff': "Staff Directory & Payroll",
      'inventory': "Kitchen Raw Material Inventory",
      'complaints': "Student Grievance Resolutions"
    };
    if (titleEl) titleEl.innerText = titles[tab] || "Owner Portal";

    // Hide all owner views and show active
    document.querySelectorAll('.owner-view-tab').forEach(el => el.style.display = 'none');
    const target = document.getElementById(`owner-tab-${tab}`);
    if (target) target.style.display = 'block';

    if (tab === 'overview') this.loadOverview();
    else if (tab === 'students') this.loadStudents();
    else if (tab === 'tiffins') this.loadTiffins();
    else if (tab === 'menu') this.loadMenu();
    else if (tab === 'pricing') this.loadPricing();
    else if (tab === 'attendance') this.loadAttendance();
    else if (tab === 'stop-requests') this.loadStopRequests();
    else if (tab === 'deliveries') this.loadDeliveries();
    else if (tab === 'payments') this.loadPayments();
    else if (tab === 'feedback') this.loadFeedbackAnalytics();
    else if (tab === 'profit-loss') this.loadProfitLoss();
    else if (tab === 'settings') this.loadSettings();
    else if (tab === 'staff') this.loadStaff();
    else if (tab === 'inventory') this.loadInventory();
    else if (tab === 'complaints') this.loadComplaints();
  },

  // 1. OWNER OVERVIEW DASHBOARD
  async loadOverview() {
    try {
      App.setLoading(true, "Loading business metrics...");
      const res = await API.getOwnerOverview();
      this.overviewData = res;
      const m = res.metrics;

      // Update stat cards
      const elMap = {
        'stat-owner-total-students': m.total_students,
        'stat-owner-active-subs': m.active_subscriptions,
        'stat-owner-today-orders': m.today_orders.total_today || 0,
        'stat-owner-b-orders': m.today_orders.breakfast_today || 0,
        'stat-owner-l-orders': m.today_orders.lunch_today || 0,
        'stat-owner-d-orders': m.today_orders.dinner_today || 0,
        'stat-owner-today-col': `₹${Number(m.today_collection).toFixed(2)}`,
        'stat-owner-pending-del': m.pending_deliveries,
        'stat-owner-completed-del': m.completed_deliveries,
        'stat-owner-stop-reqs': m.stop_requests,
        'stat-owner-revenue': `₹${Number(m.monthly_revenue).toFixed(2)}`,
        'stat-owner-expenses': `₹${Number(m.monthly_expenses).toFixed(2)}`,
        'stat-owner-net-pl': `₹${Number(m.net_profit_loss).toFixed(2)}`
      };

      for (let k in elMap) {
        const el = document.getElementById(k);
        if (el) el.innerText = elMap[k];
      }

      // Net P/L color
      const plEl = document.getElementById('stat-owner-net-pl');
      if (plEl) {
        plEl.style.color = m.net_profit_loss >= 0 ? 'var(--primary)' : 'var(--danger)';
      }

      // Recent deliveries table
      const tableBody = document.getElementById('owner-recent-deliveries-table');
      if (tableBody) {
        tableBody.innerHTML = res.recent_deliveries.map(d => `
          <tr>
            <td><strong>${d.student_name}</strong></td>
            <td><span class="badge badge-info">${d.meal_type}</span></td>
            <td>${d.delivery_address}</td>
            <td><span class="badge badge-${d.status === 'delivered' ? 'success' : 'warning'}">${d.status.replace('_', ' ')}</span></td>
            <td>
              <button class="btn btn-sm btn-outline-primary" onclick="Owner.switchTab('deliveries')">Manage →</button>
            </td>
          </tr>
        `).join('') || '<tr><td colspan="5" class="text-center text-muted">No recent delivery records</td></tr>';
      }

    } catch (err) {
      App.toast(err.message, 'error');
    } finally {
      App.setLoading(false);
    }
  },

  // 2. STUDENT MANAGEMENT
  async loadStudents() {
    try {
      App.setLoading(true, "Loading student records...");
      const res = await API.getOwnerStudents();
      const students = res.students;

      const countEl = document.getElementById('owner-total-students-count');
      if (countEl) countEl.innerText = `${students.length} Total Registered Students`;

      const tbody = document.getElementById('owner-students-table-body');
      if (tbody) {
        tbody.innerHTML = students.map(s => `
          <tr>
            <td>
              <div style="font-weight:700;">${s.full_name}</div>
              <div class="text-muted" style="font-size:0.75rem;">${s.delivery_address}</div>
            </td>
            <td>
              <div>${s.email}</div>
              <div class="text-muted" style="font-size:0.8rem;">${s.phone || 'No phone'}</div>
            </td>
            <td>
              <span class="badge ${s.plan_type ? 'badge-success' : 'badge-secondary'}">
                ${(s.plan_type || 'No Plan').toUpperCase()}
              </span>
            </td>
            <td><strong>₹${Number(s.total_paid).toFixed(2)}</strong></td>
            <td>
              <span class="badge badge-${s.subscription_status === 'active' ? 'success' : 'danger'}">
                ${s.subscription_status}
              </span>
            </td>
            <td>
              <button class="btn btn-sm btn-secondary" onclick="alert('Student: ${s.full_name}\\nAddress: ${s.delivery_address}\\nPhone: ${s.phone}\\nTotal Paid: ₹${s.total_paid}')">View</button>
            </td>
          </tr>
        `).join('') || '<tr><td colspan="6" class="text-center text-muted">No students found.</td></tr>';
      }
    } catch (err) {
      App.toast(err.message, 'error');
    } finally {
      App.setLoading(false);
    }
  },

  openAddStudentModal() {
    const modal = document.getElementById('owner-add-student-modal');
    if (modal) modal.classList.add('active');
  },

  closeAddStudentModal() {
    const modal = document.getElementById('owner-add-student-modal');
    if (modal) modal.classList.remove('active');
  },

  async handleAddStudentSubmit(e) {
    if (e) e.preventDefault();
    const name = document.getElementById('add-student-name').value.trim();
    const email = document.getElementById('add-student-email').value.trim();
    const phone = document.getElementById('add-student-phone').value.trim();
    const addr = document.getElementById('add-student-address').value.trim();

    if (!name || !email) {
      App.toast("Please fill student name and email", "warning");
      return;
    }

    try {
      App.setLoading(true, "Registering student...");
      const res = await API.addOwnerStudent({ full_name: name, email, phone, delivery_address: addr });
      App.toast(res.message, "success");
      this.closeAddStudentModal();
      this.loadStudents();
    } catch (err) {
      App.toast(err.message, "error");
    } finally {
      App.setLoading(false);
    }
  },

  // 3. TIFFIN MANAGEMENT
  async loadTiffins() {
    try {
      App.setLoading(true, "Loading active tiffins...");
      const res = await API.getOwnerTiffins();
      const tiffins = res.tiffins;

      const tbody = document.getElementById('owner-tiffins-table-body');
      if (tbody) {
        tbody.innerHTML = tiffins.map(t => `
          <tr>
            <td><strong>${t.student_name}</strong></td>
            <td><span class="badge badge-info">${t.meal_type}</span></td>
            <td>${t.delivery_address}</td>
            <td>${t.phone || 'N/A'}</td>
            <td><span class="badge badge-${t.status === 'delivered' ? 'success' : (t.status === 'stopped' ? 'danger' : 'warning')}">${t.status}</span></td>
          </tr>
        `).join('') || '<tr><td colspan="5" class="text-center text-muted">No tiffins scheduled for today.</td></tr>';
      }
    } catch (err) {
      App.toast(err.message, 'error');
    } finally {
      App.setLoading(false);
    }
  },

  // 4. MENU MANAGEMENT
  async loadMenu(day = 'Monday') {
    try {
      App.setLoading(true, "Loading menu items...");
      const res = await API.getMenu(1);
      const menus = res.menu;

      // Render Day Tabs
      const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
      const tabsWrap = document.getElementById('owner-menu-day-tabs');
      if (tabsWrap) {
        tabsWrap.innerHTML = days.map(d => `
          <button class="btn btn-sm ${d === day ? 'btn-primary' : 'btn-secondary'}" onclick="Owner.loadMenu('${d}')">${d}</button>
        `).join('');
      }

      const dayMeals = menus.filter(m => m.day_of_week === day);
      const container = document.getElementById('owner-menu-cards-grid');
      if (container) {
        container.innerHTML = ['Breakfast', 'Lunch', 'Dinner'].map(mType => {
          const item = dayMeals.find(m => m.meal_type === mType);
          if (item) {
            return `
              <div class="meal-card">
                <div class="meal-card-img-wrap">
                  <img src="${item.image_url}" alt="${item.food_name}" class="meal-card-img">
                  <span class="meal-type-pill">${item.meal_type}</span>
                  ${item.is_special ? '<span class="special-badge">⭐ Special</span>' : ''}
                </div>
                <div class="meal-card-body">
                  <h4>${item.food_name}</h4>
                  <p>${item.description}</p>
                  <div class="meal-card-items"><strong>Includes:</strong> ${item.items_included || 'Fresh Rotis, Dal, Sabzi'}</div>
                  <div style="display:flex; gap:8px; margin-top:auto;">
                    <button class="btn btn-sm btn-outline-primary btn-block" onclick="Owner.openEditMenuModal('${day}', '${mType}', '${item.food_name}', '${item.description}', '${item.items_included}', '${item.image_url}', ${item.is_special})">✏️ Edit</button>
                    <button class="btn btn-sm btn-danger" onclick="Owner.deleteMenuItem(${item.id})">🗑️</button>
                  </div>
                </div>
              </div>
            `;
          } else {
            return `
              <div class="card text-center" style="display:flex; flex-direction:column; justify-content:center; align-items:center; min-height:220px;">
                <h4>${mType} Not Added</h4>
                <p class="text-muted" style="font-size:0.85rem; margin-bottom:12px;">Add dishes for ${day} ${mType}</p>
                <button class="btn btn-sm btn-primary" onclick="Owner.openEditMenuModal('${day}', '${mType}')">+ Add ${mType}</button>
              </div>
            `;
          }
        }).join('');
      }
    } catch (err) {
      App.toast(err.message, 'error');
    } finally {
      App.setLoading(false);
    }
  },

  openEditMenuModal(day, mealType, name = '', desc = '', items = '', img = '', isSpecial = 0) {
    const modal = document.getElementById('owner-edit-menu-modal');
    document.getElementById('edit-menu-day').value = day;
    document.getElementById('edit-menu-type').value = mealType;
    document.getElementById('edit-menu-food-name').value = name;
    document.getElementById('edit-menu-desc').value = desc;
    document.getElementById('edit-menu-items').value = items;
    document.getElementById('edit-menu-img').value = img || 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=600';
    document.getElementById('edit-menu-special').checked = !!isSpecial;

    if (modal) modal.classList.add('active');
  },

  closeEditMenuModal() {
    const modal = document.getElementById('owner-edit-menu-modal');
    if (modal) modal.classList.remove('active');
  },

  async saveMenuItem(e) {
    if (e) e.preventDefault();
    const payload = {
      day_of_week: document.getElementById('edit-menu-day').value,
      meal_type: document.getElementById('edit-menu-type').value,
      food_name: document.getElementById('edit-menu-food-name').value.trim(),
      description: document.getElementById('edit-menu-desc').value.trim(),
      items_included: document.getElementById('edit-menu-items').value.trim(),
      image_url: document.getElementById('edit-menu-img').value.trim(),
      is_special: document.getElementById('edit-menu-special').checked
    };

    if (!payload.food_name) {
      App.toast("Please enter food dish name", "warning");
      return;
    }

    try {
      App.setLoading(true, "Updating menu...");
      const res = await API.updateOwnerMenu(payload);
      App.toast(res.message, "success");
      this.closeEditMenuModal();
      this.loadMenu(payload.day_of_week);
    } catch (err) {
      App.toast(err.message, "error");
    } finally {
      App.setLoading(false);
    }
  },

  async deleteMenuItem(id) {
    if (!confirm("Are you sure you want to remove this dish from the menu?")) return;
    try {
      App.setLoading(true, "Deleting menu item...");
      await API.deleteOwnerMenu(id);
      App.toast("Dish deleted successfully", "info");
      this.loadMenu();
    } catch (err) {
      App.toast(err.message, "error");
    } finally {
      App.setLoading(false);
    }
  },

  async publishWeeklyMenu() {
    try {
      App.setLoading(true, "Publishing weekly menu to all students...");
      const res = await API.publishOwnerMenu();
      App.toast(res.message, "success");
    } catch (err) {
      App.toast(err.message, "error");
    } finally {
      App.setLoading(false);
    }
  },

  // 5. PRICING MANAGEMENT
  async loadPricing() {
    try {
      App.setLoading(true, "Loading pricing rules...");
      const res = await API.getPricing(1);
      const pr = res.pricing;
      if (!pr) return;

      document.getElementById('owner-price-breakfast').value = pr.breakfast_price;
      document.getElementById('owner-price-lunch').value = pr.lunch_price;
      document.getElementById('owner-price-dinner').value = pr.dinner_price;
      document.getElementById('owner-price-day').value = pr.day_plan_price;
      document.getElementById('owner-price-weekly').value = pr.weekly_plan_price;
      document.getElementById('owner-price-monthly').value = pr.monthly_plan_price;
      document.getElementById('owner-price-monthly-disc').value = pr.monthly_discount_pct;
      document.getElementById('owner-price-weekly-disc').value = pr.weekly_discount_pct;
    } catch (err) {
      App.toast(err.message, 'error');
    } finally {
      App.setLoading(false);
    }
  },

  async savePricing(e) {
    if (e) e.preventDefault();
    const payload = {
      breakfast_price: document.getElementById('owner-price-breakfast').value,
      lunch_price: document.getElementById('owner-price-lunch').value,
      dinner_price: document.getElementById('owner-price-dinner').value,
      day_plan_price: document.getElementById('owner-price-day').value,
      weekly_plan_price: document.getElementById('owner-price-weekly').value,
      monthly_plan_price: document.getElementById('owner-price-monthly').value,
      monthly_discount_pct: document.getElementById('owner-price-monthly-disc').value,
      weekly_discount_pct: document.getElementById('owner-price-weekly-disc').value
    };

    try {
      App.setLoading(true, "Saving pricing...");
      const res = await API.updateOwnerPricing(payload);
      App.toast(res.message, "success");
    } catch (err) {
      App.toast(err.message, "error");
    } finally {
      App.setLoading(false);
    }
  },

  // 6. ATTENDANCE MANAGEMENT
  async loadAttendance(date) {
    const filterDate = date || document.getElementById('owner-attendance-date-filter')?.value || new Date().toISOString().split('T')[0];
    const dInput = document.getElementById('owner-attendance-date-filter');
    if (dInput) dInput.value = filterDate;

    try {
      App.setLoading(true, "Fetching attendance records...");
      const res = await API.getOwnerAttendance(filterDate);
      const list = res.attendance;

      const tbody = document.getElementById('owner-attendance-table-body');
      if (tbody) {
        tbody.innerHTML = list.map(a => `
          <tr>
            <td><strong>${a.student_name}</strong></td>
            <td><span class="badge badge-info">${a.meal_type}</span></td>
            <td>
              <span class="badge badge-${a.status === 'delivered' ? 'success' : (a.status === 'meal_stopped' ? 'warning' : (a.status === 'present' ? 'info' : 'danger'))}">
                ${a.status.replace('_', ' ')}
              </span>
            </td>
            <td>${a.correction_reason || 'System Verified'}</td>
            <td>
              <button class="btn btn-sm btn-outline-primary" onclick="Owner.openAttendanceCorrectionModal(${a.student_id}, '${a.student_name}', '${filterDate}', '${a.meal_type}', '${a.status}')">Correct Status</button>
            </td>
          </tr>
        `).join('') || '<tr><td colspan="5" class="text-center text-muted">No attendance marked for this date.</td></tr>';
      }
    } catch (err) {
      App.toast(err.message, 'error');
    } finally {
      App.setLoading(false);
    }
  },

  openAttendanceCorrectionModal(studentId, name, date, meal, currentStatus) {
    const modal = document.getElementById('owner-attendance-modal');
    document.getElementById('att-correct-student-id').value = studentId;
    document.getElementById('att-correct-student-name').innerText = name;
    document.getElementById('att-correct-date').value = date;
    document.getElementById('att-correct-meal').value = meal;
    document.getElementById('att-correct-status').value = currentStatus;
    document.getElementById('att-correct-reason').value = '';

    if (modal) modal.classList.add('active');
  },

  closeAttendanceCorrectionModal() {
    const modal = document.getElementById('owner-attendance-modal');
    if (modal) modal.classList.remove('active');
  },

  async saveAttendanceCorrection(e) {
    if (e) e.preventDefault();
    const payload = {
      student_id: document.getElementById('att-correct-student-id').value,
      meal_date: document.getElementById('att-correct-date').value,
      meal_type: document.getElementById('att-correct-meal').value,
      status: document.getElementById('att-correct-status').value,
      reason: document.getElementById('att-correct-reason').value.trim()
    };

    if (!payload.reason) {
      App.toast("Please state the reason for authorized correction", "warning");
      return;
    }

    try {
      App.setLoading(true, "Updating attendance record...");
      const res = await API.updateOwnerAttendance(payload);
      App.toast(res.message, "success");
      this.closeAttendanceCorrectionModal();
      this.loadAttendance(payload.meal_date);
    } catch (err) {
      App.toast(err.message, "error");
    } finally {
      App.setLoading(false);
    }
  },

  // 7. STOP REQUESTS MANAGEMENT
  async loadStopRequests() {
    try {
      App.setLoading(true, "Loading stop requests...");
      const res = await API.getOwnerStopRequests();
      const list = res.stop_requests;

      const tbody = document.getElementById('owner-stop-requests-table-body');
      if (tbody) {
        tbody.innerHTML = list.map(r => `
          <tr>
            <td>
              <strong>${r.student_name}</strong>
              <div class="text-muted" style="font-size:0.75rem;">${r.phone}</div>
            </td>
            <td><strong>${r.meal_date}</strong> (${r.meal_type})</td>
            <td>${r.reason || 'Personal'}</td>
            <td><span class="badge badge-info">${r.cutoff_deadline}</span></td>
            <td><span class="badge badge-success">✓ ${r.status.toUpperCase()}</span></td>
            <td><strong style="color:var(--primary);">₹${r.refund_credit}</strong></td>
          </tr>
        `).join('') || '<tr><td colspan="6" class="text-center text-muted">No stop requests received.</td></tr>';
      }
    } catch (err) {
      App.toast(err.message, 'error');
    } finally {
      App.setLoading(false);
    }
  },

  // 8. DELIVERY MANAGEMENT
  async loadDeliveries() {
    try {
      App.setLoading(true, "Loading deliveries...");
      const res = await API.getOwnerDeliveries();
      const list = res.deliveries;

      const tbody = document.getElementById('owner-deliveries-table-body');
      if (tbody) {
        tbody.innerHTML = list.map(d => `
          <tr>
            <td>
              <strong>${d.student_name}</strong>
              <div class="text-muted" style="font-size:0.75rem;">${d.phone}</div>
            </td>
            <td><span class="badge badge-info">${d.meal_type}</span></td>
            <td>${d.delivery_address}</td>
            <td>
              <span class="badge badge-${d.status === 'delivered' ? 'success' : (d.status === 'out_for_delivery' ? 'warning' : 'info')}">
                ${d.status.replace('_', ' ').toUpperCase()}
              </span>
            </td>
            <td>
              <div style="display:flex; gap:6px;">
                <button class="btn btn-sm btn-secondary" onclick="Owner.updateDeliveryStatus(${d.id}, 'preparing')">👨‍🍳 Prepare</button>
                <button class="btn btn-sm btn-outline-primary" onclick="Owner.updateDeliveryStatus(${d.id}, 'out_for_delivery')">🛵 Dispatch</button>
                <button class="btn btn-sm btn-primary" onclick="Owner.updateDeliveryStatus(${d.id}, 'delivered')">✅ Deliver</button>
              </div>
            </td>
          </tr>
        `).join('') || '<tr><td colspan="5" class="text-center text-muted">No delivery orders active today.</td></tr>';
      }
    } catch (err) {
      App.toast(err.message, 'error');
    } finally {
      App.setLoading(false);
    }
  },

  async updateDeliveryStatus(deliveryId, status) {
    try {
      App.setLoading(true, `Updating delivery status to ${status}...`);
      const res = await API.updateDeliveryStatus(deliveryId, status);
      App.toast(res.message, "success");
      this.loadDeliveries();
    } catch (err) {
      App.toast(err.message, "error");
    } finally {
      App.setLoading(false);
    }
  },

  // 9. PAYMENTS & COLLECTIONS
  async loadPayments() {
    try {
      App.setLoading(true, "Fetching payments...");
      const res = await API.getOwnerPayments();
      const list = res.payments;
      const s = res.summary;

      const tCol = document.getElementById('owner-pay-today-col');
      const mCol = document.getElementById('owner-pay-monthly-col');
      if (tCol) tCol.innerText = `₹${Number(s.today).toFixed(2)}`;
      if (mCol) mCol.innerText = `₹${Number(s.monthly).toFixed(2)}`;

      const tbody = document.getElementById('owner-payments-table-body');
      if (tbody) {
        tbody.innerHTML = list.map(p => `
          <tr>
            <td><strong>${p.receipt_number}</strong></td>
            <td>
              <strong>${p.student_name}</strong>
              <div class="text-muted" style="font-size:0.75rem;">${p.phone}</div>
            </td>
            <td>${p.plan_type ? p.plan_type.toUpperCase() : 'SUBSCRIPTION'}</td>
            <td>${p.payment_method}</td>
            <td><strong style="color:var(--primary);">₹${Number(p.amount).toFixed(2)}</strong></td>
            <td>${p.transaction_time}</td>
            <td><span class="badge badge-success">✓ Verified</span></td>
          </tr>
        `).join('') || '<tr><td colspan="7" class="text-center text-muted">No transactions found.</td></tr>';
      }
    } catch (err) {
      App.toast(err.message, 'error');
    } finally {
      App.setLoading(false);
    }
  },

  // 10. FEEDBACK & FOOD ANALYTICS
  async loadFeedbackAnalytics() {
    try {
      App.setLoading(true, "Loading feedback & demand analytics...");
      const res = await API.getOwnerFeedbackAnalytics();
      const m = res.metrics;

      // Update stat cards
      const avgEl = document.getElementById('owner-feedback-avg-score');
      if (avgEl) avgEl.innerText = `${m.overall_avg || 4.7} / 5.0`;

      // Render chart
      MiniChart.renderDoughnut(
        'chart-feedback-ratings',
        [m.excellent_count, m.good_count, m.average_count, m.not_good_count],
        ['Excellent', 'Good', 'Average', 'Not Good'],
        ['#10b981', '#3b82f6', '#f59e0b', '#ef4444']
      );

      // Render Suggestions ranking
      const sugWrap = document.getElementById('owner-analytics-suggestions-list');
      if (sugWrap) {
        sugWrap.innerHTML = res.suggestions.map((s, idx) => `
          <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 14px; background:var(--surface-bg); border-radius:var(--radius-md); margin-bottom:8px;">
            <div>
              <span class="badge ${idx < 3 ? 'badge-success' : 'badge-secondary'}">Rank #${idx + 1}</span>
              <strong style="margin-left:8px;">${s.food_name}</strong> (${s.category})
            </div>
            <strong style="color:var(--primary); font-size:1.1rem;">${s.vote_count} Votes</strong>
          </div>
        `).join('');
      }

      // Render Feedbacks
      const fbWrap = document.getElementById('owner-feedbacks-table-body');
      if (fbWrap) {
        fbWrap.innerHTML = res.feedbacks.map(f => `
          <tr>
            <td><strong>${f.student_name}</strong></td>
            <td>${f.meal_date} (${f.meal_type})</td>
            <td><span class="badge badge-success">${f.general_rating}</span></td>
            <td>Taste: ${f.taste_rating}★ | Hygiene: ${f.hygiene_rating}★</td>
            <td>
              <div>${f.comments || 'No comment'}</div>
              ${f.owner_response ? `<div style="font-size:0.75rem; color:var(--primary); margin-top:4px;"><strong>Your Reply:</strong> ${f.owner_response}</div>` : ''}
            </td>
            <td>
              <button class="btn btn-sm btn-outline-primary" onclick="Owner.openReplyFeedbackModal(${f.id}, '${f.student_name}', '${f.comments}')">Reply</button>
            </td>
          </tr>
        `).join('');
      }

    } catch (err) {
      App.toast(err.message, 'error');
    } finally {
      App.setLoading(false);
    }
  },

  openReplyFeedbackModal(id, studentName, comment) {
    const modal = document.getElementById('owner-reply-feedback-modal');
    document.getElementById('reply-feedback-id').value = id;
    document.getElementById('reply-student-name').innerText = studentName;
    document.getElementById('reply-student-comment').innerText = `"${comment || 'Good food'}"`;
    document.getElementById('reply-text').value = '';

    if (modal) modal.classList.add('active');
  },

  closeReplyFeedbackModal() {
    const modal = document.getElementById('owner-reply-feedback-modal');
    if (modal) modal.classList.remove('active');
  },

  async submitFeedbackReply(e) {
    if (e) e.preventDefault();
    const id = document.getElementById('reply-feedback-id').value;
    const reply = document.getElementById('reply-text').value.trim();

    if (!reply) {
      App.toast("Please type your response", "warning");
      return;
    }

    try {
      App.setLoading(true, "Sending reply...");
      const res = await API.replyFeedback(id, reply);
      App.toast(res.message, "success");
      this.closeReplyFeedbackModal();
      this.loadFeedbackAnalytics();
    } catch (err) {
      App.toast(err.message, "error");
    } finally {
      App.setLoading(false);
    }
  },

  // 11. PROFIT & LOSS MANAGEMENT
  async loadProfitLoss() {
    try {
      App.setLoading(true, "Calculating profit & loss...");
      const res = await API.getOwnerProfitLoss();
      const inc = res.income;
      const exp = res.expenses_summary;
      const pl = res.profit_loss;

      // Update stat cards
      const revEl = document.getElementById('pl-total-revenue');
      const expEl = document.getElementById('pl-total-expenses');
      const netEl = document.getElementById('pl-net-profit');

      if (revEl) revEl.innerText = `₹${Number(inc.total_revenue).toFixed(2)}`;
      if (expEl) expEl.innerText = `₹${Number(exp.total_expense).toFixed(2)}`;
      if (netEl) {
        netEl.innerText = `₹${Number(pl.total_net).toFixed(2)}`;
        netEl.style.color = pl.total_net >= 0 ? 'var(--primary)' : 'var(--danger)';
      }

      // Render Bar Chart: Revenue vs Expenses
      MiniChart.renderBar(
        'chart-pl-summary',
        [inc.daily_revenue, exp.daily_expense, inc.weekly_revenue, exp.weekly_expense, inc.monthly_revenue, exp.monthly_expense],
        ['Daily Rev', 'Daily Exp', 'Wk Rev', 'Wk Exp', 'Mo Rev', 'Mo Exp'],
        '#059669'
      );

      // Render Doughnut Chart: Expenses breakdown
      const catLabels = res.category_breakdown.map(c => c.category);
      const catVals = res.category_breakdown.map(c => c.total_amount);
      MiniChart.renderDoughnut(
        'chart-expenses-breakdown',
        catVals,
        catLabels,
        ['#ef4444', '#f59e0b', '#3b82f6', '#10b981', '#8b5cf6', '#ec4899', '#6366f1']
      );

      // Expenses List Table
      const tbody = document.getElementById('owner-expenses-table-body');
      if (tbody) {
        tbody.innerHTML = res.expenses_list.map(e => `
          <tr>
            <td><strong>${e.expense_date}</strong></td>
            <td><span class="badge badge-warning">${e.category}</span></td>
            <td>${e.description || 'N/A'}</td>
            <td><strong style="color:var(--danger);">₹${Number(e.amount).toFixed(2)}</strong></td>
            <td>
              <button class="btn btn-sm btn-danger" onclick="Owner.deleteExpense(${e.id})">🗑️ Delete</button>
            </td>
          </tr>
        `).join('') || '<tr><td colspan="5" class="text-center text-muted">No expenses recorded yet.</td></tr>';
      }

    } catch (err) {
      App.toast(err.message, 'error');
    } finally {
      App.setLoading(false);
    }
  },

  openAddExpenseModal() {
    const modal = document.getElementById('owner-add-expense-modal');
    document.getElementById('expense-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('expense-amount').value = '';
    document.getElementById('expense-desc').value = '';

    if (modal) modal.classList.add('active');
  },

  closeAddExpenseModal() {
    const modal = document.getElementById('owner-add-expense-modal');
    if (modal) modal.classList.remove('active');
  },

  async handleAddExpenseSubmit(e) {
    if (e) e.preventDefault();
    const payload = {
      expense_date: document.getElementById('expense-date').value,
      category: document.getElementById('expense-category').value,
      amount: parseFloat(document.getElementById('expense-amount').value),
      description: document.getElementById('expense-desc').value.trim()
    };

    if (isNaN(payload.amount) || payload.amount <= 0) {
      App.toast("Please enter a valid expense amount", "warning");
      return;
    }

    try {
      App.setLoading(true, "Recording business expense...");
      const res = await API.addOwnerExpense(payload);
      App.toast(res.message, "success");
      this.closeAddExpenseModal();
      this.loadProfitLoss();
    } catch (err) {
      App.toast(err.message, "error");
    } finally {
      App.setLoading(false);
    }
  },

  async deleteExpense(id) {
    if (!confirm("Are you sure you want to delete this expense record?")) return;
    try {
      App.setLoading(true, "Deleting expense...");
      await API.deleteOwnerExpense(id);
      App.toast("Expense removed", "info");
      this.loadProfitLoss();
    } catch (err) {
      App.toast(err.message, "error");
    } finally {
      App.setLoading(false);
    }
  },

  // 12. BUSINESS SETTINGS
  async loadSettings() {
    try {
      App.setLoading(true, "Loading settings...");
      const res = await API.getOwnerSettings();
      const s = res.settings;
      if (!s) return;

      document.getElementById('setting-biz-name').value = s.business_name;
      document.getElementById('setting-biz-desc').value = s.description;
      document.getElementById('setting-biz-phone').value = s.contact_phone;
      document.getElementById('setting-biz-address').value = s.business_address;
      document.getElementById('setting-time-b').value = s.breakfast_time;
      document.getElementById('setting-time-l').value = s.lunch_time;
      document.getElementById('setting-time-d').value = s.dinner_time;
      document.getElementById('setting-cutoff-b').value = s.breakfast_cutoff_time;
      document.getElementById('setting-cutoff-l').value = s.lunch_cutoff_time;
      document.getElementById('setting-cutoff-d').value = s.dinner_cutoff_time;
      document.getElementById('setting-adv-hours').value = s.advance_cutoff_hours;
    } catch (err) {
      App.toast(err.message, 'error');
    } finally {
      App.setLoading(false);
    }
  },

  async saveSettings(e) {
    if (e) e.preventDefault();
    const payload = {
      business_name: document.getElementById('setting-biz-name').value.trim(),
      description: document.getElementById('setting-biz-desc').value.trim(),
      contact_phone: document.getElementById('setting-biz-phone').value.trim(),
      business_address: document.getElementById('setting-biz-address').value.trim(),
      breakfast_time: document.getElementById('setting-time-b').value,
      lunch_time: document.getElementById('setting-time-l').value,
      dinner_time: document.getElementById('setting-time-d').value,
      breakfast_cutoff_time: document.getElementById('setting-cutoff-b').value,
      lunch_cutoff_time: document.getElementById('setting-cutoff-l').value,
      dinner_cutoff_time: document.getElementById('setting-cutoff-d').value,
      advance_cutoff_hours: parseInt(document.getElementById('setting-adv-hours').value)
    };

    try {
      App.setLoading(true, "Saving business settings...");
      const res = await API.updateOwnerSettings(payload);
      App.toast(res.message, "success");
    } catch (err) {
      App.toast(err.message, "error");
    } finally {
      App.setLoading(false);
    }
  },

  // 13. PRISMA MODEL: STAFF DIRECTORY & PAYROLL
  async loadStaff() {
    try {
      App.setLoading(true, "Loading staff members...");
      const res = await API.getOwnerStaff();
      const staff = res.staff || [];
      const sum = res.summary || {};

      const totEl = document.getElementById('owner-staff-total-count');
      const actEl = document.getElementById('owner-staff-active-count');
      const payEl = document.getElementById('owner-staff-payroll-val');

      if (totEl) totEl.innerText = sum.total_count || staff.length;
      if (actEl) actEl.innerText = sum.active_count || 0;
      if (payEl) payEl.innerText = `₹${Number(sum.monthly_payroll || 0).toFixed(2)}`;

      const tableBody = document.getElementById('owner-staff-table-body');
      if (tableBody) {
        if (staff.length === 0) {
          tableBody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No staff members added yet</td></tr>';
        } else {
          tableBody.innerHTML = staff.map(s => {
            const roleBadge = s.role === 'COOK' ? 'badge-primary' : (s.role === 'DELIVERY' ? 'badge-info' : 'badge-secondary');
            return `
              <tr>
                <td><strong>${s.name}</strong></td>
                <td><span class="badge ${roleBadge}">${s.role}</span></td>
                <td>${s.phone}</td>
                <td><strong>₹${Number(s.salary).toFixed(2)}</strong></td>
                <td>
                  <button class="badge ${s.is_active ? 'badge-success' : 'badge-danger'}" style="cursor:pointer;" onclick="Owner.toggleStaff(${s.id})">
                    ${s.is_active ? '● Active' : '○ Inactive'}
                  </button>
                </td>
                <td>
                  <button class="btn btn-sm btn-danger" onclick="Owner.deleteStaff(${s.id})">Remove</button>
                </td>
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

  openAddStaffModal() {
    const m = document.getElementById('owner-add-staff-modal');
    if (m) m.classList.add('active');
  },

  closeAddStaffModal() {
    const m = document.getElementById('owner-add-staff-modal');
    if (m) m.classList.remove('active');
  },

  async handleAddStaffSubmit(e) {
    e.preventDefault();
    const payload = {
      name: document.getElementById('staff-name-input').value.trim(),
      role: document.getElementById('staff-role-input').value,
      phone: document.getElementById('staff-phone-input').value.trim(),
      salary: parseFloat(document.getElementById('staff-salary-input').value)
    };

    try {
      App.setLoading(true, "Adding staff member...");
      const res = await API.addOwnerStaff(payload);
      App.toast(res.message || "Staff member added!", 'success');
      this.closeAddStaffModal();
      document.getElementById('staff-name-input').value = '';
      document.getElementById('staff-phone-input').value = '';
      await this.loadStaff();
    } catch (err) {
      App.toast(err.message, 'error');
    } finally {
      App.setLoading(false);
    }
  },

  async toggleStaff(id) {
    try {
      App.setLoading(true, "Updating staff status...");
      const res = await API.toggleOwnerStaff(id);
      App.toast(res.message || "Status updated", 'success');
      await this.loadStaff();
    } catch (err) {
      App.toast(err.message, 'error');
    } finally {
      App.setLoading(false);
    }
  },

  async deleteStaff(id) {
    if (!confirm("Are you sure you want to remove this staff member?")) return;
    try {
      App.setLoading(true, "Removing staff member...");
      const res = await API.deleteOwnerStaff(id);
      App.toast(res.message || "Staff removed", 'success');
      await this.loadStaff();
    } catch (err) {
      App.toast(err.message, 'error');
    } finally {
      App.setLoading(false);
    }
  },

  // 14. PRISMA MODEL: KITCHEN INVENTORY
  async loadInventory() {
    try {
      App.setLoading(true, "Loading kitchen inventory...");
      const res = await API.getOwnerInventory();
      const items = res.items || [];

      const tableBody = document.getElementById('owner-inventory-table-body');
      if (tableBody) {
        if (items.length === 0) {
          tableBody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No inventory items tracked yet</td></tr>';
        } else {
          tableBody.innerHTML = items.map(i => {
            const isLow = i.quantity <= i.min_threshold;
            return `
              <tr>
                <td><strong>${i.item_name}</strong></td>
                <td><span style="font-size:1.05rem; font-weight:800; color:${isLow ? 'var(--danger)' : 'var(--primary)'};">${i.quantity} ${i.unit}</span></td>
                <td>${i.min_threshold} ${i.unit}</td>
                <td>${i.supplier_name || 'Mandi Trader'}</td>
                <td>
                  ${isLow ? '<span class="badge badge-danger">⚠️ LOW STOCK ALERT</span>' : '<span class="badge badge-success">✓ In Stock</span>'}
                </td>
                <td>
                  <div style="display:flex; gap:6px; align-items:center;">
                    <input type="number" id="inv-update-input-${i.id}" value="${i.quantity}" step="0.5" style="width:75px; padding:4px 8px; border:1px solid var(--surface-border); border-radius:4px;">
                    <button class="btn btn-sm btn-primary" onclick="Owner.updateInventoryStock(${i.id})">Save</button>
                    <button class="btn btn-sm btn-danger" onclick="Owner.deleteInventory(${i.id})">✕</button>
                  </div>
                </td>
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

  openAddInventoryModal() {
    const m = document.getElementById('owner-add-inventory-modal');
    if (m) m.classList.add('active');
  },

  closeAddInventoryModal() {
    const m = document.getElementById('owner-add-inventory-modal');
    if (m) m.classList.remove('active');
  },

  async handleAddInventorySubmit(e) {
    e.preventDefault();
    const payload = {
      item_name: document.getElementById('inv-name-input').value.trim(),
      quantity: parseFloat(document.getElementById('inv-qty-input').value),
      unit: document.getElementById('inv-unit-input').value.trim(),
      min_threshold: parseFloat(document.getElementById('inv-min-input').value),
      supplier_name: document.getElementById('inv-supplier-input').value.trim()
    };

    try {
      App.setLoading(true, "Adding inventory item...");
      const res = await API.addOwnerInventory(payload);
      App.toast(res.message || "Inventory item added!", 'success');
      this.closeAddInventoryModal();
      document.getElementById('inv-name-input').value = '';
      document.getElementById('inv-qty-input').value = '';
      await this.loadInventory();
    } catch (err) {
      App.toast(err.message, 'error');
    } finally {
      App.setLoading(false);
    }
  },

  async updateInventoryStock(id) {
    const input = document.getElementById(`inv-update-input-${id}`);
    if (!input) return;
    const qty = parseFloat(input.value);

    try {
      App.setLoading(true, "Updating stock quantity...");
      const res = await API.updateOwnerInventoryStock(id, qty);
      App.toast(res.message || "Quantity updated", 'success');
      await this.loadInventory();
    } catch (err) {
      App.toast(err.message, 'error');
    } finally {
      App.setLoading(false);
    }
  },

  async deleteInventory(id) {
    if (!confirm("Are you sure you want to remove this inventory item?")) return;
    try {
      App.setLoading(true, "Removing item...");
      const res = await API.deleteOwnerInventory(id);
      App.toast(res.message || "Item removed", 'success');
      await this.loadInventory();
    } catch (err) {
      App.toast(err.message, 'error');
    } finally {
      App.setLoading(false);
    }
  },

  // 15. PRISMA MODEL: COMPLAINTS & GRIEVANCES
  async loadComplaints() {
    try {
      App.setLoading(true, "Loading grievances...");
      const res = await API.getOwnerComplaints();
      const complaints = res.complaints || [];
      const sum = res.summary || {};

      const opEl = document.getElementById('owner-complaints-open-count');
      const prEl = document.getElementById('owner-complaints-prog-count');
      const reEl = document.getElementById('owner-complaints-res-count');

      if (opEl) opEl.innerText = sum.open || 0;
      if (prEl) prEl.innerText = sum.in_progress || 0;
      if (reEl) reEl.innerText = sum.resolved || 0;

      const tableBody = document.getElementById('owner-complaints-table-body');
      if (tableBody) {
        if (complaints.length === 0) {
          tableBody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No student complaints filed</td></tr>';
        } else {
          tableBody.innerHTML = complaints.map(c => {
            const statusClass = c.status === 'RESOLVED' ? 'badge-success' : (c.status === 'IN_PROGRESS' ? 'badge-info' : 'badge-warning');
            const safeStudent = (c.student_name || 'Student').replace(/'/g, "\\'");
            const safeCategory = (c.category || '').replace(/'/g, "\\'");
            const safeDesc = (c.description || '').replace(/'/g, "\\'").replace(/\n/g, ' ');

            return `
              <tr>
                <td>
                  <strong>${c.student_name}</strong>
                  <div class="text-muted" style="font-size:0.8rem;">${c.student_phone || ''}</div>
                </td>
                <td><span class="badge badge-secondary">${c.category}</span></td>
                <td><p style="font-size:0.85rem; max-width:280px; margin:0;">${c.description}</p></td>
                <td><span class="badge ${statusClass}">${c.status}</span></td>
                <td><p style="font-size:0.85rem; color:var(--text-muted); margin:0;">${c.resolution || 'Pending action'}</p></td>
                <td>
                  <button class="btn btn-sm btn-outline-primary" onclick="Owner.openResolveComplaintModal(${c.id}, '${safeStudent}', '${safeCategory}', '${safeDesc}')">
                    Resolve →
                  </button>
                </td>
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

  openResolveComplaintModal(id, studentName, category, desc) {
    document.getElementById('resolve-complaint-id').value = id;
    document.getElementById('resolve-student-name').innerText = studentName;
    document.getElementById('resolve-category-badge').innerText = category;
    document.getElementById('resolve-complaint-text').innerText = desc;
    document.getElementById('resolve-notes-input').value = '';

    const modal = document.getElementById('owner-resolve-complaint-modal');
    if (modal) modal.classList.add('active');
  },

  closeResolveComplaintModal() {
    const modal = document.getElementById('owner-resolve-complaint-modal');
    if (modal) modal.classList.remove('active');
  },

  async handleResolveComplaintSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('resolve-complaint-id').value;
    const status = document.getElementById('resolve-status-select').value;
    const resolution = document.getElementById('resolve-notes-input').value.trim();

    if (!resolution) {
      App.toast("Please enter resolution notes", 'error');
      return;
    }

    try {
      App.setLoading(true, "Updating grievance status...");
      const res = await API.resolveOwnerComplaint(id, status, resolution);
      App.toast(res.message || "Grievance updated!", 'success');
      this.closeResolveComplaintModal();
      await this.loadComplaints();
    } catch (err) {
      App.toast(err.message, 'error');
    } finally {
      App.setLoading(false);
    }
  },

  // 16. PRISMA MODEL: VERIFY DELIVERY BY QR CODE TOKEN
  async verifyDeliveryQr() {
    const input = document.getElementById('owner-qr-verify-input');
    if (!input) return;
    const token = input.value.trim();

    if (!token) {
      App.toast("Please enter or paste the QR verification token", 'error');
      return;
    }

    try {
      App.setLoading(true, "Verifying QR token with backend...");
      const res = await API.verifyQrDelivery(token);
      App.toast(res.message || "Delivery verified successfully!", 'success');
      input.value = '';
      await this.loadDeliveries();
    } catch (err) {
      App.toast(err.message, 'error');
    } finally {
      App.setLoading(false);
    }
  }
};

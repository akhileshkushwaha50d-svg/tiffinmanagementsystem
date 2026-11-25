/**
 * app.js - Main Application Orchestration, Routing, and Global Services
 */

const App = {
  currentView: 'role-selection-view',

  async init() {
    Auth.init();

    // Check if user has an active session
    if (API.getToken()) {
      try {
        const me = await API.getMe();
        if (me && me.authenticated) {
          Auth.currentUser = me.user;
          if (me.user.role === 'owner') {
            this.loadOwnerDashboard();
            return;
          } else if (me.user.role === 'student') {
            this.loadStudentDashboard();
            return;
          }
        }
      } catch (e) {
        console.warn("Session restore failed, defaulting to role selection.");
        API.setToken(null);
      }
    }

    // Default to Screen 1: Role Selection
    this.switchView('role-selection-view');
  },

  switchView(viewId) {
    this.currentView = viewId;
    document.querySelectorAll('.view-container').forEach(v => {
      v.classList.remove('active');
    });
    const target = document.getElementById(viewId);
    if (target) {
      target.classList.add('active');
      window.scrollTo(0, 0);
    }
  },

  loadStudentDashboard() {
    this.switchView('student-dashboard-view');
    // Update user profile badges
    if (Auth.currentUser) {
      const nameEls = document.querySelectorAll('.user-name-display');
      nameEls.forEach(el => el.innerText = Auth.currentUser.full_name);
      const emailEls = document.querySelectorAll('.user-email-display');
      emailEls.forEach(el => el.innerText = Auth.currentUser.email);
      const initialEls = document.querySelectorAll('.user-avatar-initial');
      initialEls.forEach(el => el.innerText = Auth.currentUser.full_name[0]);
    }
    Student.init();
    this.refreshNotifications();
  },

  loadOwnerDashboard() {
    this.switchView('owner-dashboard-view');
    if (Auth.currentUser) {
      const nameEls = document.querySelectorAll('.user-name-display');
      nameEls.forEach(el => el.innerText = Auth.currentUser.full_name);
      const emailEls = document.querySelectorAll('.user-email-display');
      emailEls.forEach(el => el.innerText = Auth.currentUser.email);
      const initialEls = document.querySelectorAll('.user-avatar-initial');
      initialEls.forEach(el => el.innerText = Auth.currentUser.full_name[0]);
    }
    Owner.init();
    this.refreshNotifications();
  },

  // Toast Notifications
  toast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toastEl = document.createElement('div');
    toastEl.className = `toast ${type}`;
    const iconMap = { 'success': '✅', 'error': '❌', 'warning': '⚠️', 'info': 'ℹ️' };
    toastEl.innerHTML = `<span>${iconMap[type] || 'ℹ️'}</span> <span>${message}</span>`;
    container.appendChild(toastEl);

    setTimeout(() => {
      toastEl.style.transition = 'opacity 0.4s';
      toastEl.style.opacity = '0';
      setTimeout(() => toastEl.remove(), 400);
    }, 3500);
  },

  // Loading Overlay
  setLoading(isLoading, message = 'Loading...') {
    const overlay = document.getElementById('global-loading-overlay');
    const msgEl = document.getElementById('loading-overlay-msg');
    if (msgEl) msgEl.innerText = message;
    if (overlay) {
      overlay.style.display = isLoading ? 'flex' : 'none';
    }
  },

  // Notifications Drawer
  toggleNotifications() {
    const drawer = document.getElementById('notifications-drawer');
    if (!drawer) return;
    drawer.classList.toggle('open');
    if (drawer.classList.contains('open')) {
      this.refreshNotifications();
      API.markNotificationsRead();
      const badge = document.getElementById('global-notif-count');
      if (badge) badge.style.display = 'none';
    }
  },

  async refreshNotifications() {
    if (!API.getToken()) return;
    try {
      const res = await API.getNotifications();
      const badge = document.getElementById('global-notif-count');
      if (badge) {
        if (res.unread_count > 0) {
          badge.innerText = res.unread_count;
          badge.style.display = 'flex';
        } else {
          badge.style.display = 'none';
        }
      }

      const list = document.getElementById('notifications-list-container');
      if (list) {
        list.innerHTML = res.notifications.map(n => `
          <div class="notif-item ${n.is_read ? '' : 'unread'}">
            <h5>${n.title}</h5>
            <p>${n.message}</p>
            <time>${n.created_at}</time>
          </div>
        `).join('') || '<p class="text-muted text-center" style="padding:20px;">No notifications yet.</p>';
      }
    } catch (e) {
      console.warn("Could not fetch notifications", e);
    }
  },

  toggleMobileSidebar() {
    const s = document.querySelector('.sidebar');
    if (s) s.classList.toggle('mobile-open');
  }
};

// Start application on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});

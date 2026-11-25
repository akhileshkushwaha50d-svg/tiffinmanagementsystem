/**
 * auth.js - Authentication, Role Selection, and Session Management
 */

const Auth = {
  currentRole: 'student', // 'student' or 'owner'
  currentUser: null,

  init() {
    // Check saved role or session
    const savedRole = localStorage.getItem('tiffin_selected_role') || 'student';
    this.currentRole = savedRole;
  },

  selectRole(role) {
    this.currentRole = role;
    localStorage.setItem('tiffin_selected_role', role);
    this.showAuthScreen(role);
  },

  showRoleSelection() {
    App.switchView('role-selection-view');
  },

  showAuthScreen(role = this.currentRole) {
    this.currentRole = role;
    localStorage.setItem('tiffin_selected_role', role);

    const titleEl = document.getElementById('auth-role-title');
    const badgeEl = document.getElementById('auth-role-badge');
    const studentFields = document.getElementById('student-reg-fields');
    const ownerFields = document.getElementById('owner-reg-fields');

    if (role === 'owner') {
      if (titleEl) titleEl.innerText = "Tiffin Owner Portal";
      if (badgeEl) badgeEl.innerText = "Owner Access";
      if (studentFields) studentFields.style.display = 'none';
      if (ownerFields) ownerFields.style.display = 'block';
    } else {
      if (titleEl) titleEl.innerText = "Student / Customer Portal";
      if (badgeEl) badgeEl.innerText = "Student Access";
      if (studentFields) studentFields.style.display = 'block';
      if (ownerFields) ownerFields.style.display = 'none';
    }

    // Default to login tab
    this.switchAuthTab('login');
    App.switchView('auth-view');
  },

  switchAuthTab(tab) {
    const loginForm = document.getElementById('login-form-section');
    const regForm = document.getElementById('register-form-section');
    const tabLogin = document.getElementById('tab-btn-login');
    const tabReg = document.getElementById('tab-btn-register');

    if (tab === 'register') {
      if (loginForm) loginForm.style.display = 'none';
      if (regForm) regForm.style.display = 'block';
      if (tabLogin) tabLogin.classList.remove('active');
      if (tabReg) tabReg.classList.add('active');
    } else {
      if (loginForm) loginForm.style.display = 'block';
      if (regForm) regForm.style.display = 'none';
      if (tabLogin) tabLogin.classList.add('active');
      if (tabReg) tabReg.classList.remove('active');
    }
    this.clearAuthError();
  },

  togglePasswordVisibility(inputId, btn) {
    const input = document.getElementById(inputId);
    if (!input) return;
    if (input.type === 'password') {
      input.type = 'text';
      btn.innerHTML = '👁️';
    } else {
      input.type = 'password';
      btn.innerHTML = '🔒';
    }
  },

  showAuthError(msg) {
    const errBox = document.getElementById('auth-error-alert');
    if (errBox) {
      errBox.innerText = msg;
      errBox.style.display = 'block';
    } else {
      App.toast(msg, 'error');
    }
  },

  clearAuthError() {
    const errBox = document.getElementById('auth-error-alert');
    if (errBox) {
      errBox.innerText = '';
      errBox.style.display = 'none';
    }
  },

  async handleLogin(e) {
    if (e) e.preventDefault();
    this.clearAuthError();

    const identifier = document.getElementById('login-identifier').value.trim();
    const password = document.getElementById('login-password').value;

    if (!identifier || !password) {
      this.showAuthError("Please enter your registered Email or Mobile and password.");
      return;
    }

    try {
      App.setLoading(true, "Authenticating...");
      const res = await API.login(identifier, password, this.currentRole);
      API.setToken(res.token);
      this.currentUser = res.user;

      App.toast(`Welcome back, ${res.user.full_name}!`, 'success');

      if (res.user.role === 'owner') {
        App.loadOwnerDashboard();
      } else {
        App.loadStudentDashboard();
      }
    } catch (err) {
      this.showAuthError(err.message || "Login failed. Please check credentials.");
    } finally {
      App.setLoading(false);
    }
  },

  async handleRegister(e) {
    if (e) e.preventDefault();
    this.clearAuthError();

    const role = this.currentRole;
    let payload = { role };

    if (role === 'owner') {
      const ownerName = document.getElementById('owner-reg-name').value.trim();
      const bizName = document.getElementById('owner-reg-bizname').value.trim();
      const email = document.getElementById('owner-reg-email').value.trim();
      const phone = document.getElementById('owner-reg-phone').value.trim();
      const address = document.getElementById('owner-reg-address').value.trim();
      const password = document.getElementById('owner-reg-password').value;

      if (!ownerName || !bizName || !email || !password || !address) {
        this.showAuthError("Please fill out all Owner registration fields.");
        return;
      }
      payload = { role, full_name: ownerName, business_name: bizName, email, phone, business_address: address, password };
    } else {
      const studentName = document.getElementById('student-reg-name').value.trim();
      const email = document.getElementById('student-reg-email').value.trim();
      const phone = document.getElementById('student-reg-phone').value.trim();
      const address = document.getElementById('student-reg-address').value.trim();
      const password = document.getElementById('student-reg-password').value;

      if (!studentName || !email || !password || !address) {
        this.showAuthError("Please fill out all Student registration fields.");
        return;
      }
      payload = { role, full_name: studentName, email, phone, delivery_address: address, password };
    }

    try {
      App.setLoading(true, "Creating account...");
      const res = await API.register(payload);
      API.setToken(res.token);
      this.currentUser = res.user;

      App.toast("Account created successfully!", "success");
      if (res.user.role === 'owner') {
        App.loadOwnerDashboard();
      } else {
        App.loadStudentDashboard();
      }
    } catch (err) {
      this.showAuthError(err.message || "Registration failed.");
    } finally {
      App.setLoading(false);
    }
  },

  async handleGoogleLogin() {
    try {
      App.setLoading(true, "Connecting with Google...");
      const email = this.currentRole === 'owner' ? "rajesh.google.owner@tiffin.in" : "aman.google.student@univ.edu";
      const name = this.currentRole === 'owner' ? "Rajesh Sharma (Google)" : "Aman Verma (Google)";
      const res = await API.googleAuth(email, name, this.currentRole);
      API.setToken(res.token);
      this.currentUser = res.user;

      App.toast(`Authenticated with Google as ${res.user.full_name}`, "success");
      if (res.user.role === 'owner') {
        App.loadOwnerDashboard();
      } else {
        App.loadStudentDashboard();
      }
    } catch (err) {
      this.showAuthError("Google authentication failed.");
    } finally {
      App.setLoading(false);
    }
  },

  async handleForgotPassword() {
    const email = prompt("Enter your registered email address to receive password reset link:");
    if (!email) return;

    try {
      App.setLoading(true, "Sending instructions...");
      const res = await API.forgotPassword(email);
      alert(res.message);
    } catch (err) {
      alert(err.message || "Failed to reset password.");
    } finally {
      App.setLoading(false);
    }
  },

  fillDemo(userType) {
    if (userType === 'student') {
      this.selectRole('student');
      document.getElementById('login-identifier').value = 'aman.verma@student.edu';
      document.getElementById('login-password').value = 'student123';
      App.toast("Filled demo student credentials (Aman Verma)", "info");
    } else if (userType === 'owner') {
      this.selectRole('owner');
      document.getElementById('login-identifier').value = 'owner@annapurnatiffin.com';
      document.getElementById('login-password').value = 'owner123';
      App.toast("Filled demo owner credentials (Rajesh Sharma)", "info");
    }
  },

  logout() {
    API.setToken(null);
    this.currentUser = null;
    App.toast("Logged out successfully", "info");
    this.showRoleSelection();
  }
};

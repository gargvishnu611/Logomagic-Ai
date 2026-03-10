const state = {
  token: localStorage.getItem('token') || '',
  role: localStorage.getItem('role') || 'user',
  theme: localStorage.getItem('theme') || 'futuristic'
};

document.documentElement.setAttribute('data-theme', state.theme);

async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (state.token) headers.Authorization = `Bearer ${state.token}`;
  const res = await fetch(path, { ...options, headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

function bindTheme() {const state = {

  token: localStorage.getItem('token') || '',

  role: localStorage.getItem('role') || 'user',

  theme: localStorage.getItem('theme') || 'futuristic'

};

document.documentElement.setAttribute('data-theme', state.theme);

const authStatus = document.getElementById('authStatus');

const logoResult = document.getElementById('logoResult');

const myData = document.getElementById('myData');

const adminData = document.getElementById('adminData');

function setSession(token, role) {
const state = {

  token: localStorage.getItem('token') || '',

  role: localStorage.getItem('role') || 'user',

  theme: localStorage.getItem('theme') || 'futuristic'

};

document.documentElement.setAttribute('data-theme', state.theme);

const authStatus = document.getElementById('authStatus');

const logoResult = document.getElementById('logoResult');

const myData = document.getElementById('myData');

const adminData = document.getElementById('adminData');

function setSession(token, role) {

  state.token = token;

  state.role = role;

  localStorage.setItem('token', token);

  localStorage.setItem('role', role);

  if (authStatus) {

    authStatus.textContent = `Logged in as ${role}`;

  }

}

async function api(path, options = {}) {

  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };

  if (state.token) {

    headers.Authorization = `Bearer ${state.token}`;

  }

  const res = await fetch(path, {

    ...options,

    headers

  });

  return res.json();

}
  state.token = token;

  state.role = role;

  localStorage.setItem('token', token);

  localStorage.setItem('role', role);

  if (authStatus) {

    authStatus.textContent = `Logged in as ${role}`;

  }

}

async function api(path, options = {}) {

  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };

  if (state.token) {

    headers.Authorization = `Bearer ${state.token}`;

  }

  const res = await fetch(path, {

    ...options,

    headers

  });

  return res.json();

}
  const picker = document.getElementById('themePicker');
  if (!picker) return;
  picker.value = state.theme;
  picker.addEventListener('change', (e) => {
    state.theme = e.target.value;
    localStorage.setItem('theme', state.theme);
    document.documentElement.setAttribute('data-theme', state.theme);
  });
}

function bindAuth() {
  const status = document.getElementById('authStatus');
  const registerForm = document.getElementById('registerForm');
  const loginForm = document.getElementById('loginForm');
  if (status && state.token) status.textContent = `Session active (${state.role})`;

  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const data = await api('/api/auth/register', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(registerForm).entries())) });
        state.token = data.token;
        state.role = data.role;
        localStorage.setItem('token', state.token);
        localStorage.setItem('role', state.role);
        status.textContent = `Registered & logged in (${data.role})`;
      } catch (err) {
        status.textContent = err.message;
      }
    });
  }

  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const data = await api('/api/auth/login', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(loginForm).entries())) });
        state.token = data.token;
        state.role = data.role;
        localStorage.setItem('token', state.token);
        localStorage.setItem('role', state.role);
        status.textContent = `Logged in (${data.role})`;
      } catch (err) {
        status.textContent = err.message;
      }
    });
  }
}

function bindGenerator() {
  const form = document.getElementById('logoForm');
  const output = document.getElementById('logoResult');
  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const payload = Object.fromEntries(new FormData(form).entries());
      const data = await api('/api/logo/generate', { method: 'POST', body: JSON.stringify(payload) });
      output.textContent = JSON.stringify(data, null, 2);
    } catch (err) {
      output.textContent = err.message;
    }
  });
}

function bindDashboards() {
  const myBtn = document.getElementById('loadMyData');
  const myOut = document.getElementById('myData');
  if (myBtn) {
    myBtn.addEventListener('click', async () => {
      try { myOut.textContent = JSON.stringify(await api('/api/dashboard/me'), null, 2); }
      catch (err) { myOut.textContent = err.message; }
    });
  }

  const adminBtn = document.getElementById('loadAdminData');
  const adminOut = document.getElementById('adminData');
  if (adminBtn) {
    adminBtn.addEventListener('click', async () => {
      try { adminOut.textContent = JSON.stringify(await api('/api/admin/overview'), null, 2); }
      catch (err) { adminOut.textContent = err.message; }
    });
  }

  const publicStats = document.getElementById('publicStats');
  if (publicStats) {
    api('/api/public/stats').then((d) => {
      publicStats.textContent = `${d.totalUsers} users • ${d.totalLogos} logos generated`;
    }).catch(() => {
      publicStats.textContent = 'Live stats unavailable';
    });
  }
}

bindTheme();
bindAuth();
bindGenerator();
bindDashboards();

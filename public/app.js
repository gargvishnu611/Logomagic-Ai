const state = {
  token: localStorage.getItem('token') || '',
  role: localStorage.getItem('role') || 'user'
};

const authStatus = document.getElementById('authStatus');
const logoResult = document.getElementById('logoResult');
const myData = document.getElementById('myData');
const adminData = document.getElementById('adminData');

function setSession(token, role) {
  state.token = token;
  state.role = role;
  localStorage.setItem('token', token);
  localStorage.setItem('role', role);
  authStatus.textContent = `Logged in as ${role}`;
}

async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (state.token) {
    headers.Authorization = `Bearer ${state.token}`;
  }
  const res = await fetch(path, { ...options, headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

document.getElementById('registerForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = new FormData(e.target);
  try {
    const data = await api('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(Object.fromEntries(form.entries()))
    });
    setSession(data.token, data.role);
  } catch (err) {
    authStatus.textContent = err.message;
  }
});

document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = new FormData(e.target);
  try {
    const data = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(Object.fromEntries(form.entries()))
    });
    setSession(data.token, data.role);
  } catch (err) {
    authStatus.textContent = err.message;
  }
});

document.getElementById('logoForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = new FormData(e.target);
  try {
    const data = await api('/api/logo/generate', {
      method: 'POST',
      body: JSON.stringify(Object.fromEntries(form.entries()))
    });
    logoResult.textContent = JSON.stringify(data, null, 2);
  } catch (err) {
    logoResult.textContent = err.message;
  }
});

document.getElementById('loadMyData').addEventListener('click', async () => {
  try {
    const data = await api('/api/dashboard/me');
    myData.textContent = JSON.stringify(data, null, 2);
  } catch (err) {
    myData.textContent = err.message;
  }
});

document.getElementById('loadAdminData').addEventListener('click', async () => {
  try {
    const data = await api('/api/dashboard/admin');
    adminData.textContent = JSON.stringify(data, null, 2);
  } catch (err) {
    adminData.textContent = err.message;
  }
});

if (state.token) {
  authStatus.textContent = `Session restored (${state.role})`;
}

const SUPABASE_URL = 'https://pcbalykoyeapjbagkqnw.supabase.co';
const SUPABASE_KEY = 'sb_publishable_pgSwX1KmACGelrgQzbW08g_czPIvOxB...';
const supabase = supabasejs.createClient(SUPABASE_URL, SUPABASE_KEY);

const state = {
  employees: [],
  editingId: null,
  currentPreview: null,
};

const elements = {
  totalEmployees: document.getElementById('total-employees'),
  activeCards: document.getElementById('active-cards'),
  expiredCards: document.getElementById('expired-cards'),
  showRegisterBtn: document.getElementById('show-register-btn'),
  registerModal: document.getElementById('employee-modal'),
  detailsModal: document.getElementById('details-modal'),
  form: document.getElementById('employee-form'),
  searchInput: document.getElementById('search-input'),
  directoryList: document.getElementById('directory-list'),
  previewPane: document.getElementById('id-card-preview'),
  toast: document.getElementById('toast'),
  employeeIdField: document.getElementById('employee-id'),
  fullNameField: document.getElementById('full-name'),
  positionField: document.getElementById('position'),
  departmentField: document.getElementById('department'),
  phoneField: document.getElementById('phone-number'),
  issuedField: document.getElementById('date-issued'),
  expiryField: document.getElementById('expiry-date'),
  photoField: document.getElementById('passport-photo'),
  modalTitle: document.getElementById('modal-title'),
  detailsContent: document.getElementById('details-content'),
  detailsQrCanvas: document.getElementById('details-qr'),
  detailsTitle: document.getElementById('details-title'),
  appStatus: document.getElementById('app-status'),
};

function showToast(message, type = 'success') {
  elements.toast.textContent = message;
  elements.toast.className = `toast ${type}`;
  elements.toast.classList.remove('hidden');
  setTimeout(() => elements.toast.classList.add('hidden'), 3200);
}

function formatDate(value) {
  if (!value) return '--';
  const date = new Date(value);
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatInputDate(value) {
  if (!value) return '';
  const date = new Date(value);
  return date.toISOString().slice(0, 10);
}

function isExpired(expiryDate) {
  const expiry = new Date(expiryDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return expiry < today;
}

function buildEmployeeId(sequence = 1) {
  return `AMS-2026-${String(sequence).padStart(4, '0')}`;
}

function parseEmployeeSequence(code) {
  const match = code?.match(/AMS-2026-(\d{4})/i);
  return match ? Number(match[1]) : 0;
}

function slugify(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

async function uploadPhoto(file) {
  if (!file) return null;
  const extension = file.name.split('.').pop();
  const filename = `${Date.now()}-${slugify(file.name)}.${extension}`;
  const path = filename;

  const { data, error } = await supabase.storage
    .from('employee-photos')
    .upload(path, file, { cacheControl: '3600', upsert: true });

  if (error) {
    console.error('Upload error', error);
    showToast('Photo upload failed. Please try again.', 'error');
    throw error;
  }

  const { data: publicData } = supabase.storage.from('employee-photos').getPublicUrl(path);
  return { url: publicData.publicUrl, path };
}

async function getNextEmployeeId() {
  const { data, error } = await supabase
    .from('employees')
    .select('employee_id')
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) {
    console.error('Employee ID lookup failed', error);
    return buildEmployeeId(1);
  }

  if (!data || data.length === 0) return buildEmployeeId(1);

  const lastSequence = parseEmployeeSequence(data[0].employee_id);
  return buildEmployeeId(lastSequence + 1);
}

async function refreshDashboard() {
  const { data, error } = await supabase.from('employees').select('*');
  if (error) {
    elements.appStatus.textContent = 'Unable to load employees. Check Supabase settings.';
    console.error(error);
    return;
  }

  state.employees = data || [];
  const total = state.employees.length;
  const expired = state.employees.filter((emp) => isExpired(emp.expiry_date)).length;
  const active = total - expired;

  elements.totalEmployees.textContent = total;
  elements.activeCards.textContent = active;
  elements.expiredCards.textContent = expired;

  renderDirectory(state.employees);
  renderPreview(null);
}

function renderDirectory(employees) {
  const searchValue = elements.searchInput.value.trim().toLowerCase();
  const filtered = employees.filter((employee) => {
    const text = `${employee.full_name} ${employee.employee_id} ${employee.position} ${employee.department}`.toLowerCase();
    return text.includes(searchValue);
  });

  if (filtered.length === 0) {
    elements.directoryList.innerHTML = '<p class="empty-list">No employees found. Register a new employee to begin.</p>';
    return;
  }

  elements.directoryList.innerHTML = filtered
    .map((employee) => {
      const status = isExpired(employee.expiry_date) ? 'Expired' : 'Active';
      return `
        <article class="employee-card">
          <div class="employee-card-meta">
            <strong>${employee.full_name}</strong>
            <span>${employee.position} • ${employee.department}</span>
            <span class="muted">${employee.employee_id}</span>
          </div>
          <div class="status-pill ${status.toLowerCase()}">${status}</div>
          <div class="employee-card-actions">
            <button type="button" class="secondary-btn" data-action="view" data-id="${employee.id}">View</button>
            <button type="button" class="secondary-btn" data-action="edit" data-id="${employee.id}">Edit</button>
            <button type="button" class="danger-btn" data-action="delete" data-id="${employee.id}">Delete</button>
          </div>
        </article>`;
    })
    .join('');
}

function renderPreview(employee) {
  const profile = employee || {
    full_name: 'Jane Doe',
    position: 'Electrical Technician',
    employee_id: 'AMS-2026-0001',
    photo_url: 'https://images.unsplash.com/photo-1552058544-f2b08422138a?auto=format&fit=crop&w=400&q=80',
    date_issued: new Date().toISOString().slice(0, 10),
    expiry_date: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().slice(0, 10),
  };

  elements.currentPreview = profile;
  elements.previewPane.innerHTML = `
    <div class="id-card id-card-front">
      <div class="brand-block">
        <div class="brand-mark">AMS</div>
        <div>
          <p class="card-company">A.M SANUSI GENERAL ELECTRICALS</p>
          <p class="card-subtitle">Employee Identity</p>
        </div>
      </div>
      <div class="photo-frame">
        <img src="${profile.photo_url || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=400&q=80'}" alt="Employee photo">
      </div>
      <div class="card-body">
        <h3>${profile.full_name}</h3>
        <p>${profile.position}</p>
        <p class="card-id">${profile.employee_id}</p>
      </div>
      <div class="qr-block" id="preview-qr"></div>
    </div>
    <div class="id-card id-card-back">
      <div class="back-title">A.M SANUSI GENERAL ELECTRICALS</div>
      <p>P.O. BOX 1205 TAMALE</p>
      <p>TEL: 0505959180 / 0596477484</p>
      <div class="back-grid">
        <div>
          <span>Issue Date</span>
          <strong>${formatDate(profile.date_issued)}</strong>
        </div>
        <div>
          <span>Expiry Date</span>
          <strong>${formatDate(profile.expiry_date)}</strong>
        </div>
      </div>
      <div class="signature-line">
        <span>Authorized Signature</span>
      </div>
    </div>
  `;

  const qrTarget = document.getElementById('preview-qr');
  const qrValue = `${window.location.origin}/qr.html?employeeId=${encodeURIComponent(profile.employee_id)}`;
  if (qrTarget) {
    qrTarget.innerHTML = '';
    QRCode.toCanvas(qrTarget, qrValue, { width: 110, margin: 0 }, (error) => {
      if (error) console.error(error);
    });
  }
}

function openModal(modal) {
  modal.classList.remove('hidden');
  document.body.classList.add('modal-open');
}

function closeModal(modal) {
  modal.classList.add('hidden');
  document.body.classList.remove('modal-open');
}

async function openEmployeeForm(employee = null) {
  state.editingId = employee?.id || null;
  elements.modalTitle.textContent = employee ? 'Update Employee Profile' : 'Register New Employee';
  elements.fullNameField.value = employee?.full_name || '';
  elements.positionField.value = employee?.position || '';
  elements.departmentField.value = employee?.department || '';
  elements.phoneField.value = employee?.phone_number || '';
  elements.issuedField.value = formatInputDate(employee?.date_issued) || formatInputDate(new Date().toISOString());
  elements.expiryField.value = formatInputDate(employee?.expiry_date) || formatInputDate(new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString());
  elements.employeeIdField.value = employee?.employee_id || await getNextEmployeeId();
  elements.photoField.value = '';
  openModal(elements.registerModal);
}

function resetForm() {
  state.editingId = null;
  elements.form.reset();
}

async function submitForm(event) {
  event.preventDefault();
  const fullName = elements.fullNameField.value.trim();
  const position = elements.positionField.value.trim();
  const department = elements.departmentField.value.trim();
  const phoneNumber = elements.phoneField.value.trim();
  const dateIssued = elements.issuedField.value;
  const expiryDate = elements.expiryField.value;
  const employeeId = elements.employeeIdField.value;
  const photoFile = elements.photoField.files[0];

  if (!fullName || !position || !department || !phoneNumber || !dateIssued || !expiryDate || !employeeId) {
    showToast('Please complete every field before submitting.', 'error');
    return;
  }

  let photoData = null;
  if (photoFile) {
    photoData = await uploadPhoto(photoFile);
  }

  const payload = {
    full_name: fullName,
    position,
    department,
    phone_number: phoneNumber,
    date_issued: dateIssued,
    expiry_date: expiryDate,
    employee_id: employeeId,
  };

  if (photoData) {
    payload.photo_url = photoData.url;
    payload.photo_path = photoData.path;
  }

  if (state.editingId) {
    const { data, error } = await supabase
      .from('employees')
      .update(payload)
      .eq('id', state.editingId);

    if (error) {
      console.error('Update failed', error);
      showToast('Failed to update employee.', 'error');
      return;
    }
    showToast('Employee updated successfully');
  } else {
    const { data, error } = await supabase.from('employees').insert([payload]);
    if (error) {
      console.error('Insert failed', error);
      showToast('Failed to register employee.', 'error');
      return;
    }
    showToast('Employee registered successfully');
  }

  closeModal(elements.registerModal);
  await refreshDashboard();
}

async function removeEmployee(employeeId) {
  const confirmDelete = confirm('Delete this employee record? This cannot be undone.');
  if (!confirmDelete) return;

  const employee = state.employees.find((item) => String(item.id) === String(employeeId));
  if (!employee) return;

  if (employee.photo_path) {
    await supabase.storage.from('employee-photos').remove([employee.photo_path]).catch(() => {});
  }

  const { error } = await supabase.from('employees').delete().eq('id', employeeId);
  if (error) {
    console.error('Delete failed', error);
    showToast('Could not delete employee.', 'error');
    return;
  }

  showToast('Employee record deleted');
  await refreshDashboard();
}

function buildDetailsPanel(employee) {
  const statusLabel = isExpired(employee.expiry_date) ? 'Expired' : 'Active';
  const statusClass = isExpired(employee.expiry_date) ? 'expired' : 'active';
  const photo = employee.photo_url || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=400&q=80';

  elements.detailsContent.innerHTML = `
    <div class="details-card">
      <div class="details-hero">
        <div class="details-avatar">
          <img src="${photo}" alt="${employee.full_name}">
        </div>
        <div>
          <h3>${employee.full_name}</h3>
          <span>${employee.position}</span>
          <span class="muted">${employee.department}</span>
        </div>
      </div>
      <div class="details-grid">
        <div><span>Employee ID</span><strong>${employee.employee_id}</strong></div>
        <div><span>Phone</span><strong>${employee.phone_number}</strong></div>
        <div><span>Issue Date</span><strong>${formatDate(employee.date_issued)}</strong></div>
        <div><span>Expiry Date</span><strong>${formatDate(employee.expiry_date)}</strong></div>
      </div>
      <div class="status-pill ${statusClass}">${statusLabel}</div>
    </div>
  `;

  elements.detailsTitle.textContent = `${employee.full_name}`;
  elements.detailsQrCanvas.innerHTML = '';
  const qrValue = `${window.location.origin}/qr.html?employeeId=${encodeURIComponent(employee.employee_id)}`;
  QRCode.toCanvas(elements.detailsQrCanvas, qrValue, { width: 140, margin: 0 }, (error) => {
    if (error) console.error(error);
  });
}

async function openDetails(employeeId) {
  const employee = state.employees.find((item) => String(item.id) === String(employeeId));
  if (!employee) return;
  buildDetailsPanel(employee);
  openModal(elements.detailsModal);
}

function handleDirectoryAction(event) {
  const button = event.target.closest('button');
  if (!button) return;
  const action = button.dataset.action;
  const employeeId = button.dataset.id;
  const employee = state.employees.find((item) => item.id === employeeId);
  if (!employee) return;

  if (action === 'view') {
    openDetails(employeeId);
  }
  if (action === 'edit') {
    openEmployeeForm(employee);
  }
  if (action === 'delete') {
    removeEmployee(employeeId);
  }
}

function attachListeners() {
  elements.showRegisterBtn.addEventListener('click', () => openEmployeeForm());
  elements.form.addEventListener('submit', submitForm);
  elements.searchInput.addEventListener('input', () => renderDirectory(state.employees));
  document.querySelectorAll('[data-modal-close]').forEach((button) => {
    button.addEventListener('click', () => closeModal(button.closest('.modal')));
  });
  elements.directoryList.addEventListener('click', handleDirectoryAction);
}

async function init() {
  if (SUPABASE_URL.includes('your-project') || SUPABASE_KEY.includes('YOUR_ANON_KEY')) {
    elements.appStatus.textContent = 'Configure Supabase credentials in script.js before using the system.';
  }
  attachListeners();
  await refreshDashboard();
}

window.addEventListener('DOMContentLoaded', init);

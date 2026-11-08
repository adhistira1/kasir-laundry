/**
 * Maha Laundry POS - Frontend Application Logic
 * Modern, Accessible, Responsive, Production Ready
 */

// DOM Helper
const $ = (id) => document.getElementById(id);

// Application State
let currentUser = null;
let services = [];
let orders = [];
let activeOrderForReceipt = null;

// Filter State for Transactions Page
const filterState = {
  period: "all", // 'all' | 'daily' | 'monthly' | 'yearly'
  date: new Date().toISOString().slice(0, 10),
  month: new Date().toISOString().slice(0, 7),
  year: String(new Date().getFullYear()),
  paymentMethod: "",
  paymentStatus: "",
  status: "",
  search: "",
};

// Formatting Utilities
const money = (n) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(n) || 0);

const dateToday = () => new Date().toISOString().slice(0, 10);
const monthCurrent = () => new Date().toISOString().slice(0, 7);
const yearCurrent = () => String(new Date().getFullYear());

const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      }[c])
  );

// Toast Notification
function notify(msg, isSuccess = true) {
  const toast = $("toast");
  const msgEl = $("toast-message");
  if (!toast || !msgEl) return;
  msgEl.textContent = msg;
  toast.classList.add("show");
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove("show"), 3500);
}

// Fetch API Wrapper
async function api(url, options = {}) {
  const res = await fetch(url, {
    credentials: "same-origin",
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Permintaan gagal diproses.");
  return data;
}

// ==========================================================================
// AUTHENTICATION & SESSION HANDLING
// ==========================================================================

function showLogin() {
  $("login-view").classList.remove("hidden");
  $("app-view").classList.add("hidden");
  $("username")?.focus();
}

function showApp(user) {
  currentUser = user;
  $("login-view").classList.add("hidden");
  $("app-view").classList.remove("hidden");

  $("user-name").textContent = user.name || "Staf Laundry";
  $("user-role").textContent = (user.role || "kasir").toUpperCase();

  // Role based visibility
  document.querySelectorAll(".admin-only").forEach((el) => {
    el.classList.toggle("hidden", user.role !== "admin");
  });

  // Display formatted today's date
  $("today").textContent = new Date().toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  go("dashboard");
  loadAll();
}

// Password toggle helper
const togglePwBtn = $("toggle-password");
if (togglePwBtn) {
  togglePwBtn.addEventListener("click", () => {
    const pwInput = $("password");
    const icon = $("toggle-password-icon");
    if (!pwInput || !icon) return;
    if (pwInput.type === "password") {
      pwInput.type = "text";
      icon.className = "fa-regular fa-eye-slash";
    } else {
      pwInput.type = "password";
      icon.className = "fa-regular fa-eye";
    }
  });
}

$("login-form")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  $("login-error").textContent = "";
  const submitBtn = $("btn-login-submit");
  if (submitBtn) submitBtn.disabled = true;

  try {
    const result = await api("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({
        username: $("username").value.trim(),
        password: $("password").value,
      }),
    });
    showApp(result.user);
    notify(`Selamat datang, ${result.user.name}!`);
  } catch (err) {
    $("login-error").textContent = err.message;
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
});

$("logout")?.addEventListener("click", async () => {
  try {
    await api("/api/auth/logout", { method: "POST" });
  } finally {
    currentUser = null;
    showLogin();
    notify("Anda telah berhasil keluar dari sistem.");
  }
});

// ==========================================================================
// MOBILE DRAWER & SIDEBAR TOGGLE
// ==========================================================================
const sidebar = $("sidebar");
const mobileMenuBtn = $("mobile-menu-btn");
const sidebarCloseBtn = $("sidebar-close-btn");
const sidebarBackdrop = $("sidebar-backdrop");

function openSidebar() {
  sidebar?.classList.add("open");
  sidebarBackdrop?.classList.add("show");
  mobileMenuBtn?.setAttribute("aria-expanded", "true");
}

function closeSidebar() {
  sidebar?.classList.remove("open");
  sidebarBackdrop?.classList.remove("show");
  mobileMenuBtn?.setAttribute("aria-expanded", "false");
}

mobileMenuBtn?.addEventListener("click", openSidebar);
sidebarCloseBtn?.addEventListener("click", closeSidebar);
sidebarBackdrop?.addEventListener("click", closeSidebar);

// Close sidebar on navigation on mobile
function handleNavClick(page) {
  go(page);
  if (window.innerWidth <= 860) {
    closeSidebar();
  }
}

// ==========================================================================
// NAVIGATION SYSTEM
// ==========================================================================
function go(page) {
  document.querySelectorAll(".page").forEach((p) => p.classList.add("hidden"));
  const targetPage = $("page-" + page);
  if (targetPage) targetPage.classList.remove("hidden");

  document.querySelectorAll(".nav-item").forEach((n) => {
    n.classList.toggle("active", n.dataset.page === page);
  });

  const titles = {
    dashboard: "Dashboard",
    kasir: "Kasir Baru",
    transaksi: "Data Transaksi",
    harga: "Pengaturan Layanan",
    laporan: "Laporan Pendapatan",
    pengguna: "Manajemen Pengguna",
  };
  if ($("page-title")) $("page-title").textContent = titles[page] || "Dashboard";

  // Trigger page specific loader
  if (page === "laporan") loadReport();
  if (page === "harga") renderServices();
  if (page === "pengguna") loadUsers();
  if (page === "transaksi") renderOrders();
  if (page === "dashboard") loadDashboard();
}

document.querySelectorAll("[data-page]").forEach((b) => {
  b.addEventListener("click", () => handleNavClick(b.dataset.page));
});

document.querySelectorAll("[data-go]").forEach((b) => {
  b.addEventListener("click", () => handleNavClick(b.dataset.go));
});

// ==========================================================================
// DATA LOADING & RUNNING TICKER
// ==========================================================================
async function loadAll() {
  await Promise.all([loadServices(), loadOrders()]);
  loadDashboard();
}

async function loadServices() {
  try {
    services = await api("/api/services");
    renderServices();
    renderItemRows();
  } catch (err) {
    notify("Gagal memuat layanan: " + err.message);
  }
}

async function loadOrders() {
  try {
    orders = await api("/api/orders");
    populateYearFilterOptions();
    renderOrders();
    updateTickerDynamic();
  } catch (err) {
    notify("Gagal memuat transaksi: " + err.message);
  }
}

function updateTickerDynamic() {
  const today = dateToday();
  const todays = orders.filter((o) => String(o.created_at).slice(0, 10) === today);
  const totalRev = todays.reduce((acc, o) => acc + Number(o.total || 0), 0);
  const tickerEl = $("ticker-dynamic-stat");
  if (tickerEl) {
    tickerEl.innerHTML = `<i class="fa-solid fa-chart-line text-accent"></i> Transaksi Hari Ini: <b>${todays.length}</b> Pesanan | Omset: <b>${money(totalRev)}</b>`;
  }
}

async function loadDashboard() {
  const today = dateToday();
  const todays = orders.filter((o) => String(o.created_at).slice(0, 10) === today);
  const todayRevenue = todays.reduce((a, o) => a + Number(o.total || 0), 0);

  if ($("dash-orders")) $("dash-orders").textContent = todays.length;
  if ($("dash-revenue")) $("dash-revenue").textContent = money(todayRevenue);
  if ($("dash-process")) {
    $("dash-process").textContent = orders.filter((o) =>
      ["Diterima", "Diproses"].includes(o.status)
    ).length;
  }
  if ($("dash-done")) {
    $("dash-done").textContent = orders.filter((o) =>
      ["Selesai", "Sudah Diambil"].includes(o.status)
    ).length;
  }

  // Recent transactions table (limit 6)
  const recentTable = $("recent-table");
  if (recentTable) {
    if (!orders.length) {
      recentTable.innerHTML = `<tr><td colspan="4" class="text-center muted">Belum ada transaksi. Silakan input kasir baru.</td></tr>`;
    } else {
      recentTable.innerHTML = orders
        .slice(0, 6)
        .map(
          (o) => `
          <tr>
            <td>
              <b>${esc(o.invoice)}</b>
              <br><small class="muted"><i class="fa-regular fa-clock"></i> ${formatDateTime(o.created_at)}</small>
            </td>
            <td>
              <span class="font-weight-600">${esc(o.customer_name)}</span>
              <br><small class="muted"><i class="fa-brands fa-whatsapp text-success"></i> ${esc(o.customer_phone)}</small>
            </td>
            <td>
              <b>${money(o.total)}</b>
              <br>${payMethodBadge(o.payment_method)} ${payStatusBadge(o.payment_status)}
            </td>
            <td>${laundryStatusBadge(o.status)}</td>
          </tr>`
        )
        .join("");
    }
  }
}

function formatDateTime(dtStr) {
  if (!dtStr) return "-";
  const d = new Date(dtStr);
  return d.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function laundryStatusBadge(status) {
  const icons = {
    Diterima: "fa-inbox",
    Diproses: "fa-arrows-rotate",
    Selesai: "fa-circle-check",
    "Sudah Diambil": "fa-handshake",
  };
  const icon = icons[status] || "fa-circle";
  const slug = String(status || "").replaceAll(" ", "-");
  return `<span class="badge ${slug}"><i class="fa-solid ${icon}"></i> ${esc(status)}</span>`;
}

function payMethodBadge(method) {
  const icons = {
    Tunai: "fa-money-bill-wave",
    QRIS: "fa-qrcode",
    "Belum Dibayar": "fa-hourglass-half",
  };
  const icon = icons[method] || "fa-wallet";
  const slug = String(method || "Belum-Dibayar").replaceAll(" ", "-");
  return `<span class="badge-pay ${slug}"><i class="fa-solid ${icon}"></i> ${esc(method || "Belum Dibayar")}</span>`;
}

function payStatusBadge(status) {
  const isLunas = status === "Lunas";
  const cls = isLunas ? "badge-status-lunas" : "badge-status-belum";
  const icon = isLunas ? "fa-check" : "fa-clock";
  return `<span class="badge-pay ${cls}"><i class="fa-solid ${icon}"></i> ${esc(status || "Belum Lunas")}</span>`;
}

// ==========================================================================
// KASIR TRANSAKSI BARU (ITEM ROWS & GRAND TOTAL)
// ==========================================================================
function renderItemRows() {
  const container = $("items-list");
  if (!container) return;
  const activeServices = services.filter((s) => s.active);
  if (!activeServices.length) {
    container.innerHTML =
      '<p class="muted"><i class="fa-solid fa-triangle-exclamation"></i> Belum ada layanan aktif. Hubungi admin untuk mengaktifkan tarif layanan.</p>';
    return;
  }
  if (!container.children.length) {
    addItemRow();
  }
}

function addItemRow() {
  const activeServices = services.filter((s) => s.active);
  if (!activeServices.length) return;

  const container = $("items-list");
  if (!container) return;

  const row = document.createElement("div");
  row.className = "item-row";

  row.innerHTML = `
    <div class="input-group">
      <label><i class="fa-solid fa-shirt"></i> Layanan</label>
      <select class="item-service">
        ${activeServices
          .map(
            (s) =>
              `<option value="${s.id}">${esc(s.name)} — ${money(s.price)} / ${s.unit}</option>`
          )
          .join("")}
      </select>
    </div>
    <div class="input-group">
      <label><i class="fa-solid fa-scale-balanced"></i> Jumlah</label>
      <input class="item-qty" type="number" min="0.1" step="0.1" value="1">
    </div>
    <div class="input-group">
      <label><i class="fa-solid fa-receipt"></i> Subtotal</label>
      <input class="item-subtotal" readonly>
    </div>
    <button type="button" class="btn-remove-item" title="Hapus item ini" aria-label="Hapus item">
      <i class="fa-solid fa-trash-can"></i>
    </button>
  `;

  container.appendChild(row);

  row.querySelectorAll("select, input").forEach((el) =>
    el.addEventListener("input", () => {
      updateItemRowSubtotal(row);
      updateGrandTotal();
    })
  );

  row.querySelector(".btn-remove-item").addEventListener("click", () => {
    if (container.children.length > 1) {
      row.remove();
      updateGrandTotal();
    } else {
      notify("Minimal harus ada satu item layanan dalam nota.");
    }
  });

  updateItemRowSubtotal(row);
  updateGrandTotal();
}

function updateItemRowSubtotal(row) {
  const serviceId = Number(row.querySelector(".item-service").value);
  const qty = Number(row.querySelector(".item-qty").value) || 0;
  const service = services.find((s) => s.id === serviceId);
  const subtotal = (service?.price || 0) * qty;
  row.querySelector(".item-subtotal").value = money(subtotal);
}

function updateGrandTotal() {
  let subtotal = 0;
  document.querySelectorAll(".item-row").forEach((row) => {
    const serviceId = Number(row.querySelector(".item-service")?.value);
    const qty = Number(row.querySelector(".item-qty")?.value) || 0;
    const service = services.find((s) => s.id === serviceId);
    subtotal += (service?.price || 0) * qty;
  });

  const discountVal = Number($("discount")?.value) || 0;
  const grandTotal = Math.max(0, subtotal - discountVal);
  if ($("order-total")) $("order-total").textContent = money(grandTotal);
}

$("add-item")?.addEventListener("click", addItemRow);
$("discount")?.addEventListener("input", updateGrandTotal);
if ($("due-date")) $("due-date").value = dateToday();

// Submit Order
$("order-form")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = $("btn-save-order");
  if (btn) btn.disabled = true;

  const items = [...document.querySelectorAll(".item-row")].map((row) => ({
    serviceId: Number(row.querySelector(".item-service").value),
    quantity: Number(row.querySelector(".item-qty").value),
  }));

  const selectedPayment =
    document.querySelector('input[name="order-payment"]:checked')?.value || "Tunai";

  const payload = {
    customerName: $("cust-name").value.trim(),
    phone: $("cust-phone").value.trim(),
    dueDate: $("due-date").value || null,
    paymentMethod: selectedPayment,
    items,
    discount: Number($("discount").value) || 0,
    notes: $("notes").value.trim(),
  };

  try {
    const result = await api("/api/orders", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    notify(`Nota ${result.invoice} berhasil disimpan!`);

    // Reset Kasir Form
    $("order-form").reset();
    $("items-list").innerHTML = "";
    if ($("due-date")) $("due-date").value = dateToday();
    const defaultRadio = document.querySelector('input[name="order-payment"][value="Tunai"]');
    if (defaultRadio) defaultRadio.checked = true;
    addItemRow();
    updateGrandTotal();

    // Reload orders and dashboard
    await loadOrders();
    await loadDashboard();

    // Open receipt modal for printing right away!
    openReceiptModal(result.id);
  } catch (err) {
    notify(err.message);
  } finally {
    if (btn) btn.disabled = false;
  }
});

// ==========================================================================
// MENU TRANSAKSI: PEMISAHAN PER TANGGAL, PER BULAN, PER TAHUN & PEMBAYARAN
// ==========================================================================

// Populate year dropdown (5 years range)
function populateYearFilterOptions() {
  const yearSelect = $("filter-year");
  if (!yearSelect) return;
  const currentY = new Date().getFullYear();
  const years = [];
  for (let y = currentY; y >= currentY - 4; y--) {
    years.push(y);
  }
  // Include years from existing orders if older
  orders.forEach((o) => {
    const orderYear = new Date(o.created_at).getFullYear();
    if (!years.includes(orderYear) && !isNaN(orderYear)) {
      years.push(orderYear);
    }
  });
  years.sort((a, b) => b - a);
  yearSelect.innerHTML = years.map((y) => `<option value="${y}">${y}</option>`).join("");
  yearSelect.value = filterState.year;
}

// Period Tabs Handlers
document.querySelectorAll(".period-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".period-tab").forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    filterState.period = tab.dataset.period;
    updatePeriodControlsVisibility();
    renderOrders();
  });
});

function updatePeriodControlsVisibility() {
  const dateBox = $("filter-date-container");
  const monthBox = $("filter-month-container");
  const yearBox = $("filter-year-container");

  dateBox?.classList.toggle("hidden", filterState.period !== "daily");
  monthBox?.classList.toggle("hidden", filterState.period !== "monthly");
  yearBox?.classList.toggle("hidden", filterState.period !== "yearly");
}

// Quick Chip Buttons
$("btn-quick-today")?.addEventListener("click", () => {
  filterState.date = dateToday();
  if ($("filter-date")) $("filter-date").value = filterState.date;
  renderOrders();
});

$("btn-quick-yesterday")?.addEventListener("click", () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  filterState.date = d.toISOString().slice(0, 10);
  if ($("filter-date")) $("filter-date").value = filterState.date;
  renderOrders();
});

$("btn-quick-this-month")?.addEventListener("click", () => {
  filterState.month = monthCurrent();
  if ($("filter-month")) $("filter-month").value = filterState.month;
  renderOrders();
});

$("btn-quick-this-year")?.addEventListener("click", () => {
  filterState.year = yearCurrent();
  if ($("filter-year")) $("filter-year").value = filterState.year;
  renderOrders();
});

// Bind Period Control Inputs
$("filter-date")?.addEventListener("change", (e) => {
  filterState.date = e.target.value;
  renderOrders();
});

$("filter-month")?.addEventListener("change", (e) => {
  filterState.month = e.target.value;
  renderOrders();
});

$("filter-year")?.addEventListener("change", (e) => {
  filterState.year = e.target.value;
  renderOrders();
});

// Bind Dropdown Filters
$("filter-payment-method")?.addEventListener("change", (e) => {
  filterState.paymentMethod = e.target.value;
  renderOrders();
});

$("filter-payment-status")?.addEventListener("change", (e) => {
  filterState.paymentStatus = e.target.value;
  renderOrders();
});

$("filter-status")?.addEventListener("change", (e) => {
  filterState.status = e.target.value;
  renderOrders();
});

// Search Filter & Clear Search
const searchInput = $("order-search");
const clearSearchBtn = $("btn-clear-search");

searchInput?.addEventListener("input", (e) => {
  filterState.search = e.target.value.toLowerCase().trim();
  clearSearchBtn?.classList.toggle("hidden", !filterState.search);
  renderOrders();
});

clearSearchBtn?.addEventListener("click", () => {
  if (searchInput) searchInput.value = "";
  filterState.search = "";
  clearSearchBtn.classList.add("hidden");
  renderOrders();
});

// Reset All Filters
$("btn-reset-filters")?.addEventListener("click", () => {
  filterState.period = "all";
  filterState.date = dateToday();
  filterState.month = monthCurrent();
  filterState.year = yearCurrent();
  filterState.paymentMethod = "";
  filterState.paymentStatus = "";
  filterState.status = "";
  filterState.search = "";

  document.querySelectorAll(".period-tab").forEach((t) => {
    t.classList.toggle("active", t.dataset.period === "all");
  });
  updatePeriodControlsVisibility();

  if ($("filter-date")) $("filter-date").value = filterState.date;
  if ($("filter-month")) $("filter-month").value = filterState.month;
  if ($("filter-year")) $("filter-year").value = filterState.year;
  if ($("filter-payment-method")) $("filter-payment-method").value = "";
  if ($("filter-payment-status")) $("filter-payment-status").value = "";
  if ($("filter-status")) $("filter-status").value = "";
  if (searchInput) searchInput.value = "";
  clearSearchBtn?.classList.add("hidden");

  renderOrders();
  notify("Filter transaksi berhasil direset.");
});

// Core Filtering Logic
function getFilteredOrders() {
  return orders.filter((o) => {
    const dt = String(o.created_at || "");
    const datePart = dt.slice(0, 10); // YYYY-MM-DD
    const monthPart = dt.slice(0, 7); // YYYY-MM
    const yearPart = dt.slice(0, 4); // YYYY

    // 1. Period filter (pertanggal, perbulan, pertahun)
    if (filterState.period === "daily") {
      if (filterState.date && datePart !== filterState.date) return false;
    } else if (filterState.period === "monthly") {
      if (filterState.month && monthPart !== filterState.month) return false;
    } else if (filterState.period === "yearly") {
      if (filterState.year && yearPart !== filterState.year) return false;
    }

    // 2. Payment Method filter
    if (filterState.paymentMethod && o.payment_method !== filterState.paymentMethod) {
      return false;
    }

    // 3. Payment Status filter
    if (filterState.paymentStatus && o.payment_status !== filterState.paymentStatus) {
      return false;
    }

    // 4. Laundry Status filter
    if (filterState.status && o.status !== filterState.status) {
      return false;
    }

    // 5. Search keyword
    if (filterState.search) {
      const matchSearch = [
        o.invoice,
        o.customer_name,
        o.customer_phone,
        o.cashier_name,
      ].some((val) => String(val || "").toLowerCase().includes(filterState.search));
      if (!matchSearch) return false;
    }

    return true;
  });
}

// Render Orders Table & Live Filter Summary
function renderOrders() {
  const table = $("orders-table");
  if (!table) return;

  const filtered = getFilteredOrders();

  // Update Live Filter Summary Badges
  let totalRev = 0;
  let paidRev = 0;
  let unpaidRev = 0;

  filtered.forEach((o) => {
    const total = Number(o.total || 0);
    totalRev += total;
    if (o.payment_status === "Lunas") {
      paidRev += total;
    } else {
      unpaidRev += total;
    }
  });

  if ($("summary-total-orders")) $("summary-total-orders").textContent = `${filtered.length} Transaksi`;
  if ($("summary-total-revenue")) $("summary-total-revenue").textContent = money(totalRev);
  if ($("summary-total-paid")) $("summary-total-paid").textContent = money(paidRev);
  if ($("summary-total-unpaid")) $("summary-total-unpaid").textContent = money(unpaidRev);

  // Render Rows
  if (!filtered.length) {
    table.innerHTML = `
      <tr>
        <td colspan="6" class="text-center muted" style="padding: 2.5rem 1rem;">
          <i class="fa-solid fa-magnifying-glass" style="font-size: 2rem; margin-bottom: 0.75rem; display: block; opacity: 0.5;"></i>
          Tidak ditemukan transaksi yang sesuai dengan filter atau pencarian saat ini.
        </td>
      </tr>`;
    return;
  }

  table.innerHTML = filtered
    .map((o) => {
      const isUnpaid = o.payment_status !== "Lunas";
      return `
      <tr>
        <td>
          <b class="text-accent">${esc(o.invoice)}</b>
          <br><small class="muted"><i class="fa-regular fa-clock"></i> ${formatDateTime(o.created_at)}</small>
        </td>
        <td>
          <span class="font-weight-600">${esc(o.customer_name)}</span>
          <br>
          <a href="https://wa.me/${esc(o.customer_phone)}" target="_blank" rel="noopener noreferrer" class="link-btn font-xs" title="Chat WhatsApp Pelanggan">
            <i class="fa-brands fa-whatsapp text-success"></i> ${esc(o.customer_phone)}
          </a>
        </td>
        <td>
          <strong style="font-size: 1rem;">${money(o.total)}</strong>
          ${
            Number(o.discount) > 0
              ? `<br><small class="muted">Diskon: ${money(o.discount)}</small>`
              : ""
          }
        </td>
        <td>
          <div style="display: flex; flex-direction: column; gap: 4px; align-items: flex-start;">
            ${payMethodBadge(o.payment_method)}
            ${payStatusBadge(o.payment_status)}
          </div>
        </td>
        <td>
          <select class="status-select" data-id="${o.id}" aria-label="Ubah Status Cucian">
            ${["Diterima", "Diproses", "Selesai", "Sudah Diambil"]
              .map(
                (s) => `<option value="${s}" ${o.status === s ? "selected" : ""}>${s}</option>`
              )
              .join("")}
          </select>
        </td>
        <td class="text-right">
          <div style="display: inline-flex; gap: 6px; align-items: center; justify-content: flex-end;">
            <button class="btn btn-secondary btn-sm" data-detail="${o.id}" title="Lihat & Cetak Nota Struk">
              <i class="fa-solid fa-file-invoice"></i> Nota
            </button>
            ${
              isUnpaid
                ? `<button class="btn btn-success btn-sm" data-pay-order="${o.id}" data-invoice="${esc(o.invoice)}" data-customer="${esc(o.customer_name)}" data-amount="${money(o.total)}" title="Tandai Sudah Bayar">
                    <i class="fa-solid fa-wallet"></i> Bayar
                   </button>`
                : ""
            }
            ${
              currentUser?.role === "admin"
                ? `<button class="btn btn-danger btn-sm" data-delete-order="${o.id}" data-invoice="${esc(o.invoice)}" title="Hapus transaksi ini">
                    <i class="fa-solid fa-trash-can"></i>
                   </button>`
                : ""
            }
          </div>
        </td>
      </tr>`;
    })
    .join("");
}

// Status select change
$("orders-table")?.addEventListener("change", async (e) => {
  if (!e.target.matches(".status-select")) return;
  const select = e.target;
  const orderId = select.dataset.id;
  const newStatus = select.value;
  select.disabled = true;

  try {
    const result = await api(`/api/orders/${orderId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status: newStatus }),
    });

    let msg = `Status transaksi berhasil diubah ke "${newStatus}".`;
    if (result.whatsapp?.sent) {
      msg += " Notifikasi WhatsApp otomatis telah dikirim ke pelanggan.";
    } else if (result.whatsapp?.reason) {
      msg += ` (${result.whatsapp.reason})`;
    }
    notify(msg);

    await loadOrders();
    await loadDashboard();
  } catch (err) {
    notify(err.message);
    await loadOrders();
  } finally {
    select.disabled = false;
  }
});

// Orders Table Actions: Detail, Quick Pay, and Delete
$("orders-table")?.addEventListener("click", async (e) => {
  // 1. Delete Order (Admin only)
  const deleteBtn = e.target.closest("[data-delete-order]");
  if (deleteBtn) {
    if (currentUser?.role !== "admin") {
      notify("Hanya admin yang memiliki izin untuk menghapus transaksi.");
      return;
    }
    const orderId = deleteBtn.dataset.deleteOrder;
    const invoice = deleteBtn.dataset.invoice;
    if (
      !confirm(
        `PERINGATAN: Hapus transaksi ${invoice} secara permanen?\n\nData transaksi beserta item cucian akan dihapus dari database.`
      )
    ) {
      return;
    }

    deleteBtn.disabled = true;
    try {
      await api(`/api/orders/${orderId}`, { method: "DELETE" });
      notify(`Transaksi ${invoice} berhasil dihapus.`);
      await loadOrders();
      await loadDashboard();
      if (
        currentUser?.role === "admin" &&
        !$("page-laporan")?.classList.contains("hidden")
      ) {
        await loadReport();
      }
    } catch (err) {
      notify(err.message);
      deleteBtn.disabled = false;
    }
    return;
  }

  // 2. Quick Pay Button
  const payBtn = e.target.closest("[data-pay-order]");
  if (payBtn) {
    openPaymentModal({
      id: payBtn.dataset.payOrder,
      invoice: payBtn.dataset.invoice,
      customer: payBtn.dataset.customer,
      amount: payBtn.dataset.amount,
    });
    return;
  }

  // 3. Detail & Print Receipt Button
  const detailBtn = e.target.closest("[data-detail]");
  if (detailBtn) {
    openReceiptModal(detailBtn.dataset.detail);
  }
});

// ==========================================================================
// MODAL: QUICK PAYMENT UPDATE
// ==========================================================================
const paymentModal = $("payment-modal");

function openPaymentModal(orderData) {
  if (!paymentModal) return;
  $("pay-order-id").value = orderData.id;
  $("pay-modal-invoice").textContent = orderData.invoice;
  $("pay-modal-customer").textContent = orderData.customer;
  $("pay-modal-amount").textContent = orderData.amount;
  $("pay-modal-method").value = "Tunai";
  $("pay-modal-status").value = "Lunas";
  paymentModal.classList.remove("hidden");
}

function closePaymentModal() {
  paymentModal?.classList.add("hidden");
}

$("close-payment-modal")?.addEventListener("click", closePaymentModal);
$("btn-cancel-pay")?.addEventListener("click", closePaymentModal);

$("payment-form")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const orderId = $("pay-order-id").value;
  const paymentMethod = $("pay-modal-method").value;
  const paymentStatus = $("pay-modal-status").value;

  try {
    await api(`/api/orders/${orderId}/payment`, {
      method: "PATCH",
      body: JSON.stringify({ paymentMethod, paymentStatus }),
    });

    notify(`Pembayaran diperbarui: ${paymentMethod} (${paymentStatus}).`);
    closePaymentModal();
    await loadOrders();
    await loadDashboard();
  } catch (err) {
    notify(err.message);
  }
});

// ==========================================================================
// MODAL: THERMAL RECEIPT & PRINTING / WHATSAPP SHARE
// ==========================================================================
const receiptModal = $("receipt-modal");

async function openReceiptModal(orderId) {
  if (!receiptModal) return;
  try {
    const o = await api(`/api/orders/${orderId}`);
    activeOrderForReceipt = o;

    $("rc-invoice").textContent = o.invoice;
    $("rc-date").textContent = formatDateTime(o.created_at);
    $("rc-cashier").textContent = o.cashier_name || "Staf";
    $("rc-customer").textContent = o.customer_name;
    $("rc-phone").textContent = o.customer_phone;
    $("rc-due").textContent = o.due_date ? formatDateTime(o.due_date).slice(0, 11) : "-";

    const itemsContainer = $("rc-items");
    if (itemsContainer) {
      itemsContainer.innerHTML = (o.items || [])
        .map(
          (i) => `
        <div class="receipt-item-row" style="margin-bottom: 6px;">
          <div>
            <div style="font-weight: 700;">${esc(i.service_name)}</div>
            <small style="color: #64748b; font-size: 0.76rem;">${i.quantity} ${i.unit} × ${money(i.unit_price)}/${i.unit}</small>
          </div>
          <span style="font-weight: 700;">${money(i.line_total)}</span>
        </div>`
        )
        .join("");
    }

    $("rc-subtotal").textContent = money(o.subtotal);
    $("rc-discount").textContent = money(o.discount);
    $("rc-total").textContent = money(o.total);
    $("rc-payment-method").textContent = o.payment_method || "Belum Dibayar";
    $("rc-payment-status").textContent = o.payment_status || "Belum Lunas";
    $("rc-status").textContent = o.status || "Diterima";

    if (o.notes) {
      $("rc-notes-box").style.display = "block";
      $("rc-notes-divider").style.display = "block";
      $("rc-notes").textContent = o.notes;
    } else {
      $("rc-notes-box").style.display = "none";
      $("rc-notes-divider").style.display = "none";
    }

    receiptModal.classList.remove("hidden");
  } catch (err) {
    notify("Gagal memuat detail nota: " + err.message);
  }
}

function closeReceiptModal() {
  receiptModal?.classList.add("hidden");
  activeOrderForReceipt = null;
}

$("close-receipt-modal")?.addEventListener("click", closeReceiptModal);
$("btn-close-receipt")?.addEventListener("click", closeReceiptModal);

// Print Thermal Receipt
$("btn-print-receipt")?.addEventListener("click", () => {
  window.print();
});

// Send WhatsApp Struk
$("btn-wa-share")?.addEventListener("click", () => {
  if (!activeOrderForReceipt) return;
  const o = activeOrderForReceipt;
  let cleanPhone = String(o.customer_phone || "").replace(/\D/g, "");
  if (cleanPhone.startsWith("0")) cleanPhone = "62" + cleanPhone.slice(1);

  // Format rincian item dengan jumlah, harga satuan/kiloan, dan subtotal
  const itemsText = (o.items || [])
    .map(
      (i) =>
        `• *${i.service_name}*\n   ${i.quantity} ${i.unit} × ${money(i.unit_price)}/${i.unit} = *${money(i.line_total)}*`
    )
    .join("\n\n");

  const dueDateText = o.due_date ? `Est. Selesai: *${formatDateTime(o.due_date).slice(0, 11)}*\n` : "";
  const notesText = o.notes ? `Catatan: _${o.notes}_\n` : "";

  const text = `*MAHA LAUNDRY - NOTA TRANSAKSI*\n===========================\nNo. Nota: *${o.invoice}*\nPelanggan: *${o.customer_name}*\nTanggal: ${formatDateTime(o.created_at)}\n${dueDateText}---------------------------\n*RINCIAN LAYANAN:*\n${itemsText}\n---------------------------\nSubtotal: ${money(o.subtotal)}\nDiskon: ${money(o.discount)}\n*TOTAL BAYAR: ${money(o.total)}*\n\nMetode Bayar: *${o.payment_method}* (${o.payment_status})\nStatus Cucian: *${o.status}*\n${notesText}===========================\nTerima kasih atas kepercayaan Anda di Maha Laundry!\n_Harap tunjukkan nota ini saat pengambilan cucian._`;

  const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
  window.open(waUrl, "_blank");
});

// Close modals on Escape key
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeReceiptModal();
    closePaymentModal();
  }
});

// ==========================================================================
// MASTER PENGATURAN HARGA LAYANAN
// ==========================================================================
let editingServiceId = null;

function resetServiceForm() {
  editingServiceId = null;
  $("service-form")?.reset();
  if ($("service-active")) $("service-active").value = "1";
  if ($("service-form-title")) $("service-form-title").textContent = "Tambah Layanan Baru";
  if ($("service-submit")) {
    $("service-submit").innerHTML = `<i class="fa-solid fa-plus"></i> Tambah Layanan`;
  }
  $("service-cancel")?.classList.add("hidden");
}

$("service-form")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const payload = {
    name: $("service-name").value.trim(),
    category: $("service-category").value,
    unit: $("service-unit").value,
    price: Number($("service-price").value),
    active: $("service-active").value === "1",
  };

  try {
    if (editingServiceId) {
      await api(`/api/services/${editingServiceId}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      notify("Perubahan layanan berhasil disimpan.");
    } else {
      await api("/api/services", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      notify("Layanan baru berhasil ditambahkan.");
    }
    resetServiceForm();
    await loadServices();
  } catch (err) {
    notify(err.message);
  }
});

function renderServices() {
  const table = $("services-table");
  if (!table) return;

  if (!services.length) {
    table.innerHTML = `<tr><td colspan="6" class="text-center muted">Belum ada layanan yang tersimpan.</td></tr>`;
    return;
  }

  table.innerHTML = services
    .map(
      (s) => `
    <tr>
      <td><b>${esc(s.name)}</b></td>
      <td><span class="badge ${s.category === "kiloan" ? "badge-pay QRIS" : "badge-pay Tunai"}">${esc(s.category.toUpperCase())}</span></td>
      <td>${esc(s.unit)}</td>
      <td><b>${money(s.price)}</b></td>
      <td>${
        s.active
          ? '<span class="badge-pay badge-status-lunas"><i class="fa-solid fa-check"></i> Aktif</span>'
          : '<span class="badge-pay badge-status-belum"><i class="fa-solid fa-xmark"></i> Nonaktif</span>'
      }</td>
      <td class="text-right">
        <div style="display: inline-flex; gap: 6px;">
          <button type="button" class="btn btn-secondary btn-sm" data-edit-service="${s.id}" title="Ubah tarif layanan">
            <i class="fa-solid fa-pen-to-square"></i> Ubah
          </button>
          <button type="button" class="btn btn-danger btn-sm" data-delete-service="${s.id}" title="Hapus layanan ini">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </div>
      </td>
    </tr>`
    )
    .join("");
}

$("service-cancel")?.addEventListener("click", resetServiceForm);

$("services-table")?.addEventListener("click", async (e) => {
  // Delete Service
  const delBtn = e.target.closest("[data-delete-service]");
  if (delBtn) {
    if (currentUser?.role !== "admin") return;
    const serviceId = Number(delBtn.dataset.deleteService);
    const service = services.find((s) => s.id === serviceId);
    if (!service) return;

    if (
      !confirm(
        `Hapus layanan "${service.name}"?\nLayanan tidak akan muncul lagi di kasir. Riwayat transaksi sebelumnya tetap aman.`
      )
    ) {
      return;
    }

    delBtn.disabled = true;
    try {
      await api(`/api/services/${service.id}`, { method: "DELETE" });
      if (editingServiceId === service.id) resetServiceForm();
      notify(`Layanan "${service.name}" berhasil dihapus.`);
      await loadServices();
    } catch (err) {
      notify(err.message);
      delBtn.disabled = false;
    }
    return;
  }

  // Edit Service
  const editBtn = e.target.closest("[data-edit-service]");
  if (editBtn) {
    if (currentUser?.role !== "admin") return;
    const serviceId = Number(editBtn.dataset.editService);
    const service = services.find((s) => s.id === serviceId);
    if (!service) return;

    editingServiceId = service.id;
    $("service-name").value = service.name;
    $("service-category").value = service.category;
    $("service-unit").value = service.unit;
    $("service-price").value = service.price;
    $("service-active").value = service.active ? "1" : "0";

    $("service-form-title").textContent = `Ubah Layanan: ${service.name}`;
    $("service-submit").innerHTML = `<i class="fa-solid fa-floppy-disk"></i> Simpan Perubahan`;
    $("service-cancel").classList.remove("hidden");

    $("service-form")?.scrollIntoView({ behavior: "smooth", block: "center" });
    $("service-name")?.focus();
  }
});

// ==========================================================================
// LAPORAN PENDAPATAN
// ==========================================================================
async function loadReport() {
  if (currentUser?.role !== "admin") return;
  const dateInput = $("report-date");
  if (dateInput && !dateInput.value) {
    dateInput.value = dateToday();
  }

  const period = $("report-period")?.value || "daily";
  const refDate = $("report-date")?.value || dateToday();

  try {
    const data = await api(`/api/reports?period=${period}&date=${refDate}`);
    if ($("report-orders")) $("report-orders").textContent = data.summary.total_orders;
    if ($("report-revenue")) $("report-revenue").textContent = money(data.summary.revenue);
    if ($("report-paid")) $("report-paid").textContent = money(data.summary.paid_revenue);

    const reportTable = $("report-table");
    if (reportTable) {
      if (!data.rows?.length) {
        reportTable.innerHTML = `<tr><td colspan="3" class="text-center muted">Tidak ada transaksi pada periode ini.</td></tr>`;
      } else {
        reportTable.innerHTML = data.rows
          .map(
            (r) => `
          <tr>
            <td><b><i class="fa-regular fa-calendar"></i> ${new Date(r.report_date).toLocaleDateString("id-ID", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}</b></td>
            <td>${r.total_orders} Transaksi</td>
            <td><strong class="text-success">${money(r.revenue)}</strong></td>
          </tr>`
          )
          .join("");
      }
    }
  } catch (err) {
    notify(err.message);
  }
}

$("load-report")?.addEventListener("click", loadReport);
$("report-period")?.addEventListener("change", loadReport);

// ==========================================================================
// MANAJEMEN PENGGUNA (ADMIN ONLY)
// ==========================================================================
async function loadUsers() {
  if (currentUser?.role !== "admin") return;
  try {
    const users = await api("/api/users");
    const table = $("users-table");
    if (!table) return;

    if (!users.length) {
      table.innerHTML = `<tr><td colspan="5" class="text-center muted">Belum ada akun pengguna.</td></tr>`;
      return;
    }

    table.innerHTML = users
      .map(
        (u) => `
      <tr>
        <td><b>${esc(u.name)}</b></td>
        <td><code>@${esc(u.username)}</code></td>
        <td><span class="badge ${u.role === "admin" ? "Diterima" : "Diproses"}">${esc(u.role.toUpperCase())}</span></td>
        <td>${
          u.active
            ? '<span class="badge-pay badge-status-lunas"><i class="fa-solid fa-circle-check"></i> Aktif</span>'
            : '<span class="badge-pay badge-status-belum"><i class="fa-solid fa-circle-xmark"></i> Nonaktif</span>'
        }</td>
        <td class="text-right">
          ${
            Number(u.id) === Number(currentUser.id)
              ? '<span class="muted font-xs"><i class="fa-solid fa-user-check"></i> Akun Anda</span>'
              : `<button type="button" class="btn ${u.active ? "btn-danger" : "btn-secondary"} btn-sm" data-user-status="${u.id}" data-active="${u.active ? "0" : "1"}">
                  <i class="fa-solid ${u.active ? "fa-user-slash" : "fa-user-check"}"></i> ${u.active ? "Nonaktifkan" : "Aktifkan"}
                </button>`
          }
        </td>
      </tr>`
      )
      .join("");
  } catch (err) {
    notify(err.message);
  }
}

$("users-table")?.addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-user-status]");
  if (!btn || currentUser?.role !== "admin") return;

  const targetActive = btn.dataset.active === "1";
  const actionText = targetActive ? "mengaktifkan" : "menonaktifkan";

  if (!confirm(`Yakin ingin ${actionText} akun staf ini?`)) return;

  btn.disabled = true;
  try {
    await api(`/api/users/${btn.dataset.userStatus}/status`, {
      method: "PATCH",
      body: JSON.stringify({ active: targetActive }),
    });
    await loadUsers();
    notify(
      targetActive
        ? "Akun pengguna berhasil diaktifkan."
        : "Akun pengguna berhasil dinonaktifkan."
    );
  } catch (err) {
    notify(err.message);
  } finally {
    btn.disabled = false;
  }
});

$("user-form")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    await api("/api/users", {
      method: "POST",
      body: JSON.stringify({
        name: $("new-name").value.trim(),
        username: $("new-username").value.trim(),
        password: $("new-password").value,
        role: $("new-role").value,
      }),
    });
    $("user-form").reset();
    await loadUsers();
    notify("Akun pengguna baru berhasil dibuat!");
  } catch (err) {
    notify(err.message);
  }
});

// ==========================================================================
// INITIAL APPLICATION BOOTSTRAP
// ==========================================================================
(async () => {
  // Set initial filter controls
  if ($("filter-date")) $("filter-date").value = filterState.date;
  if ($("filter-month")) $("filter-month").value = filterState.month;
  if ($("filter-year")) $("filter-year").value = filterState.year;

  try {
    const data = await api("/api/auth/me");
    showApp(data.user);
  } catch {
    showLogin();
  }
})();

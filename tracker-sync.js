/**
 * tracker-sync.js
 * Synchronizes the KWML iOS 4-Tab Dashboard dynamically with the Google Sheet.
 */

// Replace with your Web App deployment URL from Google Apps Script
const GOOGLE_SCRIPT_API_URL = "https://script.google.com/macros/s/AKfycbyt9Ai5-FBS23G1_OSbg30a2sCyXjuY9dWuPfqo2YHR2Umbunn2uIXnlozAEGOpigkquA/exec";

// Fallback data for immediate load / offline iOS experience
const FALLBACK_DATA = {
  employee: {
    name: "Basil Cherian",
    empId: "WM-10246",
    designation: "Terminal Controller (Operations)",
    doj: "15-07-2026"
  },
  statistics: {
    daysWorked: 93,
    totalOffs: 15,
    coffsAvailed: 0,
    otherLeavesAvailed: 0,
    emergencyLeavesAvailed: 0
  },
  leaveBalances: [
    { type: "Paid Leave (PL)", accrued: 5.0, net: 5.5 },
    { type: "Casual Leave (CL)", accrued: 3.0, net: 4.0 },
    { type: "Compensatory Off (C-Off)", accrued: 4.0, net: 4.0 },
    { type: "Restricted Holiday (RH)", accrued: 0.0, net: 1.0 }
  ],
  coffs: [
    { id: "CO-01", holiday: "Thiruvonam", dutyDate: "2026-08-26", shift: "A - Kakkanad (07:00 - 15:00)", expiryDate: "2026-11-24", daysRemaining: 25, status: "Available" },
    { id: "CO-02", holiday: "Sreekrishna Jayanthi", dutyDate: "2026-09-04", shift: "B - Cheranallor (13:00 - 21:00)", expiryDate: "2026-12-03", daysRemaining: 34, status: "Available" },
    { id: "CO-03", holiday: "Mahanavami", dutyDate: "2026-10-20", shift: "A - S. Chittor (06:50 - 15:00)", expiryDate: "2027-01-18", daysRemaining: 80, status: "Available" },
    { id: "CO-04", holiday: "Vijayadashami", dutyDate: "2026-10-21", shift: "B - Cheranallor (12:50 - 21:00)", expiryDate: "2027-01-19", daysRemaining: 81, status: "Available" }
  ],
  recentShifts: [
    { code: "B", terminal: "Fort Kochi", date: "24-10-2026", day: "Saturday", startTime: "13:10", endTime: "21:30", status: "Completed" },
    { code: "B", terminal: "High Court", date: "25-10-2026", day: "Sunday", startTime: "13:15", endTime: "21:15", status: "Completed" },
    { code: "B", terminal: "South Chittoor", date: "26-10-2026", day: "Monday", startTime: "13:30", endTime: "21:30", status: "Completed" },
    { code: "B", terminal: "Cheranalloor", date: "28-10-2026", day: "Wednesday", startTime: "12:50", endTime: "21:00", status: "Completed" },
    { code: "B", terminal: "South Chittoor", date: "29-10-2026", day: "Thursday", startTime: "13:30", endTime: "21:30", status: "Completed" },
    { code: "A", terminal: "South Chittoor", date: "30-10-2026", day: "Friday", startTime: "06:50", endTime: "15:00", status: "Completed" },
    { code: "A", terminal: "High Court", date: "31-10-2026", day: "Saturday", startTime: "06:50", endTime: "15:00", status: "Upcoming / Scheduled" },
    { code: "B", terminal: "High Court", date: "01-11-2026", day: "Sunday", startTime: "13:15", endTime: "21:25", status: "Upcoming / Scheduled" }
  ]
};

document.addEventListener("DOMContentLoaded", () => {
  // Load cached or fallback data immediately so UI isn't empty
  loadCachedOrFallbackData();
  
  // Set up manual sync button
  const syncBtn = document.getElementById("btn-manual-sync");
  if (syncBtn) {
    syncBtn.addEventListener("click", () => fetchLiveSheetData(true));
  }

  // Fetch live update if URL configured
  fetchLiveSheetData();
});

/**
 * 4-Tab Navigation Switcher
 */
function switchTab(tabKey) {
  const tabs = ["summary", "coff", "roster", "profile"];
  const titles = {
    summary: "Shift & Leave Tracker",
    coff: "C-Off Expiry Hub",
    roster: "Duty Roster Log",
    profile: "Employee Profile"
  };

  tabs.forEach(t => {
    const pageEl = document.getElementById(`tab-${t}`);
    const navEl = document.getElementById(`tab-nav-${t}`);
    if (pageEl) pageEl.classList.remove("active-page");
    if (navEl) navEl.classList.remove("active");
  });

  const activePage = document.getElementById(`tab-${tabKey}`);
  const activeNav = document.getElementById(`tab-nav-${tabKey}`);
  const headerTitle = document.getElementById("page-header-title");

  if (activePage) activePage.classList.add("active-page");
  if (activeNav) activeNav.classList.add("active");
  if (headerTitle && titles[tabKey]) headerTitle.textContent = titles[tabKey];

  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function fetchLiveSheetData(isManual = false) {
  const statusText = document.getElementById("sync-status-text");
  
  if (!GOOGLE_SCRIPT_API_URL || GOOGLE_SCRIPT_API_URL.includes("REPLACE_WITH_YOUR_DEPLOYMENT_ID")) {
    if (statusText) statusText.textContent = "ℹ️ Offline demo mode (API URL pending)";
    return;
  }

  if (statusText) statusText.textContent = "⏳ Syncing with Google Sheet...";

  try {
    const response = await fetch(GOOGLE_SCRIPT_API_URL);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    
    const data = await response.json();
    if (data.status !== "success") throw new Error(data.message || "Failed to fetch");

    updateDashboardUI(data);

    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    if (statusText) statusText.textContent = `✓ Synced at ${timeStr}`;
    
    localStorage.setItem("kwml_cached_data", JSON.stringify(data));
  } catch (err) {
    console.warn("Live sync error:", err);
    if (statusText) statusText.textContent = "⚠️ Offline: Using cached records";
    loadCachedOrFallbackData();
  }
}

function updateDashboardUI(data) {
  if (!data) return;

  // 1. Employee Metadata
  if (data.employee) {
    safeSetText("#emp-name", data.employee.name);
    safeSetText("#emp-id", data.employee.empId);
    safeSetText("#emp-designation", data.employee.designation);
    safeSetText("#emp-doj", data.employee.doj);
  }

  // 2. Statistics
  if (data.statistics) {
    safeSetText("#stat-days-worked", data.statistics.daysWorked);
    safeSetText("#stat-offs-availed", data.statistics.totalOffs);
    safeSetText("#stat-coffs-availed", data.statistics.coffsAvailed);
    safeSetText("#stat-el-availed", data.statistics.emergencyLeavesAvailed);
  }

  // 3. Leave Balances
  if (data.leaveBalances && Array.isArray(data.leaveBalances)) {
    data.leaveBalances.forEach(item => {
      const typeLower = (item.type || "").toLowerCase();
      if (typeLower.includes("paid leave") || typeLower.includes("(pl)")) {
        safeSetText("#balance-pl-net", item.net);
        safeSetText("#balance-pl-accrued", `Accrued: ${item.accrued} (1 PL / 20 days)`);
      } else if (typeLower.includes("casual leave") || typeLower.includes("(cl)")) {
        safeSetText("#balance-cl-net", item.net);
        safeSetText("#balance-cl-accrued", `Accrued: ${item.accrued} (1 Work-Year)`);
      } else if (typeLower.includes("compensatory off") || typeLower.includes("(c-off)")) {
        safeSetText("#balance-coff-net", item.net);
      } else if (typeLower.includes("restricted holiday") || typeLower.includes("(rh)")) {
        safeSetText("#balance-rh-net", item.net);
      }
    });
  }

  // 4. C-Off List
  if (data.coffs && Array.isArray(data.coffs)) {
    renderCOffList(data.coffs);
  }

  // 5. Recent Shifts
  if (data.recentShifts && Array.isArray(data.recentShifts)) {
    renderShiftsRoster(data.recentShifts);
  }
}

function renderCOffList(coffs) {
  const container = document.getElementById("coff-items-container");
  if (!container) return;

  container.innerHTML = "";
  coffs.forEach(item => {
    const isAvailed = (item.status || "").toLowerCase().includes("availed");
    const days = parseInt(item.daysRemaining, 10);
    let badgeClass = "badge-safe";
    if (isAvailed) badgeClass = "badge-availed";
    else if (days <= 30) badgeClass = "badge-urgent";

    const card = document.createElement("div");
    card.className = "ios-list-cell";
    card.innerHTML = `
      <div>
        <div style="font-weight:600; font-size:14px; color: var(--text-primary);">${item.holiday}</div>
        <div style="font-size:11px; color: var(--text-muted); margin-top:2px;">Worked: ${item.dutyDate} • ${item.shift}</div>
        <div style="font-size:11px; color: var(--ios-orange); margin-top:2px;">Expires: ${item.expiryDate}</div>
      </div>
      <div style="text-align:right;">
        <span class="status-pill ${badgeClass}">
          ${isAvailed ? "Availed" : `${days}d left`}
        </span>
      </div>
    `;
    container.appendChild(card);
  });
}

function renderShiftsRoster(shifts) {
  const container = document.getElementById("roster-items-container");
  if (!container) return;

  container.innerHTML = "";
  shifts.forEach(shift => {
    const isCompleted = (shift.status || "").includes("Completed");
    const row = document.createElement("div");
    row.className = "ios-list-cell";
    row.innerHTML = `
      <div style="display:flex; align-items:center; gap:10px;">
        <span class="shift-tag shift-${(shift.code || "a").toLowerCase()}">${shift.code}</span>
        <div>
          <strong style="font-size:13px; color: var(--text-primary);">${shift.terminal}</strong>
          <div style="font-size:11px; color: var(--text-muted); margin-top:2px;">
            ${shift.date} (${shift.day}) • ${shift.startTime} - ${shift.endTime}
          </div>
        </div>
      </div>
      <div style="font-size:11px; color:${isCompleted ? "var(--ios-green)" : "var(--ios-blue)"}; font-weight:600;">
        ${shift.status}
      </div>
    `;
    container.appendChild(row);
  });
}

function loadCachedOrFallbackData() {
  const cached = localStorage.getItem("kwml_cached_data");
  if (cached) {
    try {
      updateDashboardUI(JSON.parse(cached));
      return;
    } catch (e) {
      console.warn("Could not parse cached data, using fallback.");
    }
  }
  updateDashboardUI(FALLBACK_DATA);
}

function safeSetText(selector, text) {
  const el = document.querySelector(selector);
  if (el && text !== undefined && text !== null) {
    el.textContent = text;
  }
}

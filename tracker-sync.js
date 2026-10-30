/**
 * tracker-sync.js
 * Synchronizes the KWML iOS 4-Tab Dashboard dynamically with the Google Sheet.
 * Features an Interactive iOS-style Calendar View for the Roster tab.
 */

const GOOGLE_SCRIPT_API_URL = "https://script.google.com/macros/s/AKfycbyt9Ai5-FBS23G1_OSbg30a2sCyXjuY9dWuPfqo2YHR2Umbunn2uIXnlozAEGOpigkquA/exec";

// Fallback data for immediate load & offline use
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
    { code: "B", terminal: "Fort Kochi", date: "24-10-2026", day: "Saturday", startTime: "13:10", endTime: "21:30", status: "Completed", summary: "B - Fort Kochi" },
    { code: "B", terminal: "High Court", date: "25-10-2026", day: "Sunday", startTime: "13:15", endTime: "21:15", status: "Completed", summary: "B - High Court" },
    { code: "B", terminal: "South Chittoor", date: "26-10-2026", day: "Monday", startTime: "13:30", endTime: "21:30", status: "Completed", summary: "B - S. Chittor" },
    { code: "B", terminal: "Cheranalloor", date: "28-10-2026", day: "Wednesday", startTime: "12:50", endTime: "21:00", status: "Completed", summary: "B - Cheranallor" },
    { code: "B", terminal: "South Chittoor", date: "29-10-2026", day: "Thursday", startTime: "13:30", endTime: "21:30", status: "Completed", summary: "B - S. Chittor" },
    { code: "A", terminal: "South Chittoor", date: "30-10-2026", day: "Friday", startTime: "06:50", endTime: "15:00", status: "Completed", summary: "A - S. Chittor" },
    { code: "A", terminal: "High Court", date: "31-10-2026", day: "Saturday", startTime: "06:50", endTime: "15:00", status: "Upcoming / Scheduled", summary: "A - High Court" },
    { code: "B", terminal: "High Court", date: "01-11-2026", day: "Sunday", startTime: "13:15", endTime: "21:25", status: "Upcoming / Scheduled", summary: "B - High Court" }
  ]
};

// In-memory shift map indexed by YYYY-MM-DD
const gShiftMap = new Map();

// Calendar Navigation State (Default to current active context: October 2026)
let gCalCurrentDate = new Date(2026, 9, 30); // Month 9 = October
let gSelectedDateStr = "2026-10-30";

document.addEventListener("DOMContentLoaded", () => {
  initCalendarControls();
  loadCachedOrFallbackData();

  const syncBtn = document.getElementById("btn-manual-sync");
  if (syncBtn) {
    syncBtn.addEventListener("click", () => fetchLiveSheetData(true));
  }

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
    roster: "Duty Roster Calendar",
    profile: "Employee Profile"
  };

  tabs.forEach(t => {
    const pageEl = document.getElementById("tab-" + t);
    const navEl = document.getElementById("tab-nav-" + t);
    if (pageEl) pageEl.classList.remove("active-page");
    if (navEl) navEl.classList.remove("active");
  });

  const activePage = document.getElementById("tab-" + tabKey);
  const activeNav = document.getElementById("tab-nav-" + tabKey);
  const headerTitle = document.getElementById("page-header-title");

  if (activePage) activePage.classList.add("active-page");
  if (activeNav) activeNav.classList.add("active");
  if (headerTitle && titles[tabKey]) headerTitle.textContent = titles[tabKey];

  if (tabKey === "roster") {
    renderCalendarMonth();
  }

  window.scrollTo({ top: 0, behavior: "smooth" });
}

/**
 * Setup Calendar Prev / Next / Today Buttons
 */
function initCalendarControls() {
  const prevBtn = document.getElementById("cal-prev-btn");
  const nextBtn = document.getElementById("cal-next-btn");
  const todayBtn = document.getElementById("cal-today-btn");

  if (prevBtn) {
    prevBtn.addEventListener("click", () => {
      gCalCurrentDate.setMonth(gCalCurrentDate.getMonth() - 1);
      renderCalendarMonth();
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener("click", () => {
      gCalCurrentDate.setMonth(gCalCurrentDate.getMonth() + 1);
      renderCalendarMonth();
    });
  }

  if (todayBtn) {
    todayBtn.addEventListener("click", () => {
      gCalCurrentDate = new Date(2026, 9, 30);
      gSelectedDateStr = "2026-10-30";
      renderCalendarMonth();
      inspectDate(gSelectedDateStr);
    });
  }
}

/**
 * Indexes shift array into Map by ISO date (YYYY-MM-DD)
 */
function buildShiftIndex(shifts) {
  gShiftMap.clear();
  if (!Array.isArray(shifts)) return;

  shifts.forEach(shift => {
    let iso = shift.isoDate;
    if (!iso && shift.date) {
      const p = shift.date.split("-");
      if (p.length === 3) {
        iso = p[0].length === 4 ? p[0] + "-" + p[1] + "-" + p[2] : p[2] + "-" + p[1] + "-" + p[0];
      }
    }
    if (iso) {
      gShiftMap.set(iso, shift);
    }
  });
}

/**
 * Renders the iOS Monthly Calendar Grid
 */
function renderCalendarMonth() {
  const grid = document.getElementById("cal-days-grid");
  const titleEl = document.getElementById("cal-current-month-year");
  if (!grid || !titleEl) return;

  grid.innerHTML = "";

  const year = gCalCurrentDate.getFullYear();
  const month = gCalCurrentDate.getMonth();

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  titleEl.textContent = monthNames[month] + " " + year;

  const firstDayIndex = new Date(year, month, 1).getDay(); // 0 = Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevMonthLastDate = new Date(year, month, 0).getDate();

  // 1. Previous month trailing days
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    const prevDateNum = prevMonthLastDate - i;
    const cell = document.createElement("div");
    cell.className = "cal-day-cell other-month";
    cell.innerHTML = '<span class="cal-day-number">' + prevDateNum + '</span>';
    grid.appendChild(cell);
  }

  const todayIso = "2026-10-30";

  // 2. Current Month Days
  for (let day = 1; day <= daysInMonth; day++) {
    const mStr = String(month + 1).padStart(2, "0");
    const dStr = String(day).padStart(2, "0");
    const isoDate = year + "-" + mStr + "-" + dStr;

    const cell = document.createElement("div");
    cell.className = "cal-day-cell";
    cell.dataset.date = isoDate;

    if (isoDate === todayIso) {
      cell.classList.add("is-today");
    }
    if (isoDate === gSelectedDateStr) {
      cell.classList.add("is-selected");
    }

    const shift = gShiftMap.get(isoDate);
    let badgeHtml = "";

    if (shift) {
      const code = (shift.code || "").toUpperCase();
      const status = shift.status || "";
      const termFirst = (shift.terminal || "").split(" ")[0];

      if (status.includes("Holiday Worked")) {
        badgeHtml = '<span class="cal-badge badge-holiday-worked">H+C</span>';
      } else if (code === "A") {
        badgeHtml = '<span class="cal-badge badge-shift-a">A • ' + termFirst + '</span>';
      } else if (code === "B") {
        badgeHtml = '<span class="cal-badge badge-shift-b">B • ' + termFirst + '</span>';
      } else if (code === "G") {
        badgeHtml = '<span class="cal-badge badge-shift-g">G • OCC</span>';
      } else if (code === "-" || status.includes("Leave") || status.includes("Off")) {
        badgeHtml = '<span class="cal-badge badge-off-day">Off</span>';
      } else {
        badgeHtml = '<span class="cal-badge badge-shift-a">' + code + '</span>';
      }
    }

    cell.innerHTML = '<span class="cal-day-number">' + day + '</span>' + badgeHtml;

    cell.addEventListener("click", () => {
      document.querySelectorAll(".cal-day-cell").forEach(c => c.classList.remove("is-selected"));
      cell.classList.add("is-selected");
      gSelectedDateStr = isoDate;
      inspectDate(isoDate);
    });

    grid.appendChild(cell);
  }

  // 3. Next month leading days (for a uniform 7-column grid)
  const totalRendered = firstDayIndex + daysInMonth;
  const trailingCount = (7 - (totalRendered % 7)) % 7;
  for (let nextDay = 1; nextDay <= trailingCount; nextDay++) {
    const cell = document.createElement("div");
    cell.className = "cal-day-cell other-month";
    cell.innerHTML = '<span class="cal-day-number">' + nextDay + '</span>';
    grid.appendChild(cell);
  }

  inspectDate(gSelectedDateStr);
}

/**
 * Shows details for the tapped date
 */
function inspectDate(isoDate) {
  const dateEl = document.getElementById("sel-day-date");
  const dayNameEl = document.getElementById("sel-day-dayname");
  const badgeEl = document.getElementById("sel-day-badge");
  const bodyEl = document.getElementById("sel-day-body");
  if (!dateEl || !bodyEl) return;

  const parts = isoDate.split("-");
  if (parts.length !== 3) return;
  const dObj = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
  const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  dateEl.textContent = dObj.getDate() + " " + months[dObj.getMonth()] + " " + dObj.getFullYear();
  dayNameEl.textContent = daysOfWeek[dObj.getDay()];

  const shift = gShiftMap.get(isoDate);

  if (!shift) {
    badgeEl.textContent = "Off / Rest";
    badgeEl.style.background = "rgba(148, 163, 184, 0.15)";
    badgeEl.style.color = "var(--text-muted)";
    badgeEl.style.borderColor = "rgba(148, 163, 184, 0.3)";

    bodyEl.innerHTML = `
      <div style="padding: 8px 0;">
        <div style="font-size: 14px; font-weight: 600; color: var(--text-primary);">Rostered Weekly Off / Rest Day</div>
        <div style="font-size: 12px; color: var(--text-muted); margin-top: 3px;">
          No rostered terminal duty scheduled for this date.
        </div>
      </div>
    `;
    return;
  }

  const code = (shift.code || "").toUpperCase();
  const status = shift.status || "Completed";
  const isCompleted = status.includes("Completed");
  const isHolidayWorked = status.includes("Holiday Worked");

  let badgeColor = "var(--ios-blue)";
  let badgeBg = "rgba(10, 132, 255, 0.15)";

  if (isHolidayWorked) {
    badgeColor = "var(--ios-purple)";
    badgeBg = "rgba(191, 90, 242, 0.2)";
  } else if (code === "B") {
    badgeColor = "var(--ios-orange)";
    badgeBg = "rgba(255, 159, 10, 0.2)";
  } else if (code === "G") {
    badgeColor = "var(--ios-green)";
    badgeBg = "rgba(48, 209, 88, 0.2)";
  }

  badgeEl.textContent = isHolidayWorked ? "Holiday Worked" : "Shift " + code;
  badgeEl.style.color = badgeColor;
  badgeEl.style.background = badgeBg;
  badgeEl.style.borderColor = badgeColor;

  bodyEl.innerHTML = `
    <div style="display:flex; flex-direction:column; gap:12px; margin-top:4px;">
      <div class="detail-metric-row">
        <span style="font-size:12px; color:var(--text-muted); font-weight:500;">Terminal Location</span>
        <strong style="font-size:14px; color:var(--text-primary);">${shift.terminal}</strong>
      </div>
      <div class="detail-metric-row">
        <span style="font-size:12px; color:var(--text-muted); font-weight:500;">Duty Hours</span>
        <strong style="font-size:13px; color:var(--text-primary); font-family:monospace;">${shift.startTime || "07:00"} — ${shift.endTime || "15:00"}</strong>
      </div>
      <div class="detail-metric-row">
        <span style="font-size:12px; color:var(--text-muted); font-weight:500;">Roster Summary</span>
        <span style="font-size:13px; color:var(--text-secondary);">${shift.summary}</span>
      </div>
      <div class="detail-metric-row">
        <span style="font-size:12px; color:var(--text-muted); font-weight:500;">Operational Status</span>
        <span class="status-pill ${isCompleted ? 'badge-safe' : 'badge-urgent'}">
          ${isHolidayWorked ? 'Holiday Worked (+1 C-Off)' : status}
        </span>
      </div>
    </div>
  `;
}

async function fetchLiveSheetData(isManual = false) {
  const statusText = document.getElementById("sync-status-text");

  if (!GOOGLE_SCRIPT_API_URL || GOOGLE_SCRIPT_API_URL.includes("REPLACE_WITH_YOUR_DEPLOYMENT_ID")) {
    if (statusText) statusText.textContent = "ℹ️ Offline demo mode (Calendar loaded)";
    return;
  }

  if (statusText) statusText.textContent = "⏳ Syncing with Google Sheet...";

  try {
    const response = await fetch(GOOGLE_SCRIPT_API_URL);
    if (!response.ok) throw new Error("HTTP error: " + response.status);

    const data = await response.json();
    if (data.status !== "success") throw new Error(data.message || "Failed to fetch");

    updateDashboardUI(data);

    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    if (statusText) statusText.textContent = "✓ Synced at " + timeStr;

    localStorage.setItem("kwml_cached_data", JSON.stringify(data));
  } catch (err) {
    console.warn("Live sync error:", err);
    if (statusText) statusText.textContent = "⚠️ Offline: Using cached records";
    loadCachedOrFallbackData();
  }
}

function updateDashboardUI(data) {
  if (!data) return;

  if (data.employee) {
    safeSetText("#emp-name", data.employee.name);
    safeSetText("#emp-id", data.employee.empId);
    safeSetText("#emp-designation", data.employee.designation);
    safeSetText("#emp-doj", data.employee.doj);
  }

  if (data.statistics) {
    safeSetText("#stat-days-worked", data.statistics.daysWorked);
    safeSetText("#stat-offs-availed", data.statistics.totalOffs);
    safeSetText("#stat-coffs-availed", data.statistics.coffsAvailed);
    safeSetText("#stat-el-availed", data.statistics.emergencyLeavesAvailed);
  }

  if (data.leaveBalances && Array.isArray(data.leaveBalances)) {
    data.leaveBalances.forEach(item => {
      const typeLower = (item.type || "").toLowerCase();
      if (typeLower.includes("paid leave") || typeLower.includes("(pl)")) {
        safeSetText("#balance-pl-net", item.net);
        safeSetText("#balance-pl-accrued", "Accrued: " + item.accrued + " (1 PL / 20 days)");
      } else if (typeLower.includes("casual leave") || typeLower.includes("(cl)")) {
        safeSetText("#balance-cl-net", item.net);
        safeSetText("#balance-cl-accrued", "Accrued: " + item.accrued + " (1 Work-Year)");
      } else if (typeLower.includes("compensatory off") || typeLower.includes("(c-off)")) {
        safeSetText("#balance-coff-net", item.net);
      } else if (typeLower.includes("restricted holiday") || typeLower.includes("(rh)")) {
        safeSetText("#balance-rh-net", item.net);
      }
    });
  }

  if (data.coffs && Array.isArray(data.coffs)) {
    renderCOffList(data.coffs);
  }

  // Load shifts into calendar index
  const shiftsToLoad = (data.recentShifts && data.recentShifts.length > 0) ? data.recentShifts : FALLBACK_DATA.recentShifts;
  buildShiftIndex(shiftsToLoad);
  renderCalendarMonth();
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
          ${isAvailed ? "Availed" : days + "d left"}
        </span>
      </div>
    `;
    container.appendChild(card);
  });
}

function loadCachedOrFallbackData() {
  const cached = localStorage.getItem("kwml_cached_data");
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      updateDashboardUI(parsed);
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

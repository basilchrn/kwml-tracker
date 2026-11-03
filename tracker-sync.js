/**
 * ==============================================================================
 * tracker-sync.js
 * Synchronizes the KWML iOS 4-Tab Dashboard dynamically with Google Sheet.
 * 
 * STRICT REAL-TIME DATA ARCHITECTURE:
 * - Direct live feed from Google Apps Script Web App endpoint.
 * - Zero hardcoded offline shift or employee datasets.
 * - Dynamic 2-Line Calendar View:
 *   * Line 1: Shift Code / Leave Type
 *   * Line 2: Standardized Terminal Abbreviation (HCT, VYP, FOK, WIL, SCT, CHR, KAK, MAT, VYT, OCC)
 * - Dates with no data in Google Sheet are non-interactive (no link/pointer events).
 * - Dedicated color scheme:
 *   * RED for Emergency Leave / Loss of Pay (EL / LOP)
 *   * MAROON for Other Leaves & C-Offs Availed (C-OFF, CL, PL, RH, Holiday Off)
 * - Live C-Off Expiry Countdown & Alert system.
 * - Dynamic Annual Official Holidays Register for active working year.
 * ==============================================================================
 */

// REPLACE with your deployed Google Apps Script Web App URL (Exec endpoint)
const GOOGLE_SCRIPT_API_URL = "https://script.google.com/macros/s/AKfycbz_REPLACE_WITH_YOUR_DEPLOYMENT_ID/exec";

// Standard Terminal Name to Abbreviation Converter
function getTerminalAbbr(name) {
  if (!name) return "";
  const n = String(name).trim().toLowerCase();
  if (n.includes("high court") || n.includes("highcourt") || n === "hct") return "HCT";
  if (n.includes("vypin") || n === "vyp") return "VYP";
  if (n.includes("fort kochi") || n.includes("fortkochi") || n === "fok") return "FOK";
  if (n.includes("willingdon") || n.includes("w.island") || n.includes("w. island") || n === "wil") return "WIL";
  if (n.includes("south chittoor") || n.includes("s. chittor") || n.includes("s.chittor") || n.includes("chittoor") || n === "sct") return "SCT";
  if (n.includes("cheranalloor") || n.includes("cheranallor") || n === "chr") return "CHR";
  if (n.includes("kakkanad") || n === "kak") return "KAK";
  if (n.includes("mattancherry") || n.includes("mattanchery") || n === "mat") return "MAT";
  if (n.includes("vyttila") || n.includes("vytilla") || n === "vyt") return "VYT";
  if (n.includes("occ")) return "OCC";
  return name.split(" ")[0].toUpperCase().slice(0, 4);
}

// In-memory shift map indexed by YYYY-MM-DD
const gShiftMap = new Map();

// Calendar Navigation State
let gCalCurrentDate = new Date();
let gSelectedDateStr = "";

document.addEventListener("DOMContentLoaded", () => {
  initCalendarControls();
  
  // Set current selected date formatted as YYYY-MM-DD
  const y = gCalCurrentDate.getFullYear();
  const m = String(gCalCurrentDate.getMonth() + 1).padStart(2, "0");
  const d = String(gCalCurrentDate.getDate()).padStart(2, "0");
  gSelectedDateStr = `${y}-${m}-${d}`;

  const syncBtn = document.getElementById("btn-manual-sync");
  if (syncBtn) {
    syncBtn.addEventListener("click", () => fetchLiveSheetData(true));
  }

  // Load previous session cache if available to prevent blank screen during initial load
  loadPreviousSessionCache();

  // Fetch live Google Sheet data
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
      gCalCurrentDate = new Date();
      const y = gCalCurrentDate.getFullYear();
      const m = String(gCalCurrentDate.getMonth() + 1).padStart(2, "0");
      const d = String(gCalCurrentDate.getDate()).padStart(2, "0");
      gSelectedDateStr = `${y}-${m}-${d}`;
      renderCalendarMonth();
      if (gShiftMap.has(gSelectedDateStr)) {
        inspectDate(gSelectedDateStr);
      }
    });
  }
}

/**
 * Fetches Live JSON directly from Google Apps Script Web App
 */
async function fetchLiveSheetData(isManual = false) {
  const statusText = document.getElementById("sync-status-text");

  if (!GOOGLE_SCRIPT_API_URL || GOOGLE_SCRIPT_API_URL.includes("REPLACE_WITH_YOUR_DEPLOYMENT_ID")) {
    if (statusText) statusText.textContent = "⚠️ Please configure your Apps Script URL in tracker-sync.js";
    return;
  }

  if (statusText) statusText.textContent = "⏳ Fetching live data from Google Sheet...";

  try {
    const response = await fetch(GOOGLE_SCRIPT_API_URL);
    if (!response.ok) throw new Error("HTTP error: " + response.status);

    const data = await response.json();
    if (data.status !== "success") throw new Error(data.message || "Failed to parse Google Sheet payload");

    // Populate all views with live Sheet data
    updateDashboardUI(data);

    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    if (statusText) statusText.textContent = `✓ Synced with Sheet at ${timeStr}`;

    // Cache verified live data to handle brief offline moments seamlessly
    localStorage.setItem("kwml_sheet_live_cache", JSON.stringify(data));
  } catch (err) {
    console.error("Sheet synchronization error:", err);
    if (statusText) statusText.textContent = "❌ Sync failed: Check script deployment or connection";
  }
}

/**
 * Populates all DOM elements directly from the Google Sheet payload
 */
function updateDashboardUI(data) {
  if (!data) return;

  // 1. Employee Details
  if (data.employee) {
    const emp = data.employee;
    safeSetText("#emp-name", emp.name || "--");
    safeSetText("#profile-name", emp.name || "--");
    safeSetText("#emp-id", emp.empId || "--");
    safeSetText("#profile-empid", emp.empId || "--");
    safeSetText("#emp-designation", emp.designation || "--");
    safeSetText("#profile-designation", emp.designation || "--");
    safeSetText("#profile-desig-row", emp.designation || "--");
    safeSetText("#emp-doj", emp.doj || "--");
    safeSetText("#profile-doj", emp.doj || "--");

    if (emp.doj) {
      safeSetText("#profile-workyear", `${emp.doj} – 1 Work-Year cycle`);
    }
  }

  // 2. Duty & Attendance Statistics
  if (data.statistics) {
    const s = data.statistics;
    safeSetText("#stat-days-worked", s.daysWorked !== null && s.daysWorked !== undefined ? s.daysWorked : "--");
    safeSetText("#stat-offs-availed", s.totalOffs !== null && s.totalOffs !== undefined ? s.totalOffs : "--");
    safeSetText("#stat-coffs-availed", s.coffsAvailed !== null && s.coffsAvailed !== undefined ? s.coffsAvailed : "--");
    safeSetText("#stat-el-availed", s.emergencyLeavesAvailed !== null && s.emergencyLeavesAvailed !== undefined ? s.emergencyLeavesAvailed : "--");

    const coffsAvailed = Number(s.coffsAvailed || 0);
    safeSetText("#stat-coffs-sub", `${coffsAvailed} Availed`);
  }

  // 3. Leave Balances Summary
  let activePoolTotal = 0.0;
  if (data.leaveBalances && Array.isArray(data.leaveBalances)) {
    data.leaveBalances.forEach(item => {
      const typeLower = String(item.type || "").toLowerCase();
      const netVal = item.net === "-" ? "-" : Number(item.net || 0);

      if (typeof netVal === "number" && !isNaN(netVal)) {
        activePoolTotal += netVal;
      }

      if (typeLower.includes("(pl)") || typeLower.includes("paid leave")) {
        safeSetText("#balance-pl-net", item.net !== undefined ? item.net : "--");
        safeSetText("#balance-pl-accrued", item.rule || `Accrued: ${item.accrued || 0} (1 PL / 20 days)`);
        safeSetText("#profile-rule-pl", item.rule || "1 PL / 20 Qualifying Days");
      } else if (typeLower.includes("(cl)") || typeLower.includes("casual leave")) {
        safeSetText("#balance-cl-net", item.net !== undefined ? item.net : "--");
        safeSetText("#balance-cl-accrued", item.rule || `Accrued: ${item.accrued || 0} (1 Work-Year)`);
        safeSetText("#profile-rule-cl", item.rule || "1 Day / Month (1 Work-Yr Validity)");
      } else if (typeLower.includes("(c-off)") || typeLower.includes("compensatory off")) {
        safeSetText("#balance-coff-net", item.net !== undefined ? item.net : "--");
        safeSetText("#balance-coff-accrued", item.rule || "90-Day validity from duty date");
        safeSetText("#profile-rule-coff", item.rule || "1:1 on Holiday Duty (90-Day Validity)");
      } else if (typeLower.includes("(rh)") || typeLower.includes("restricted holiday")) {
        safeSetText("#balance-rh-net", item.net !== undefined ? item.net : "--");
        safeSetText("#balance-rh-accrued", item.rule || "Expires 31-Dec • Resets Jan 1");
        safeSetText("#profile-rule-rh", item.rule || "2 Days / Calendar Year");
      } else if (typeLower.includes("(el") || typeLower.includes("emergency leave")) {
        safeSetText("#profile-rule-el", item.rule || "Max 15 Days / Year (Unpaid / LOP)");
      }
    });

    safeSetText("#emp-pool", `${activePoolTotal.toFixed(1)} Days Active`);
  }

  // 4. C-Off List & Nearest Expiry Alert
  if (data.coffs && Array.isArray(data.coffs)) {
    renderCOffList(data.coffs);
  }

  // 5. Annual Calendar Holidays (Pulled dynamically from Sheet)
  if (data.holidays && Array.isArray(data.holidays)) {
    renderAnnualHolidays(data.holidays);
  }

  // 6. Shift Roster Calendar Indexing
  const shiftsToLoad = data.shifts || data.recentShifts || [];
  buildShiftIndex(shiftsToLoad);

  // If shifts exist, and current navigation month has no recorded data, center around the latest active date
  if (shiftsToLoad.length > 0 && gShiftMap.size > 0) {
    const dates = Array.from(gShiftMap.keys()).sort();
    const latestDateStr = dates[dates.length - 1];
    const todayY = gCalCurrentDate.getFullYear();
    const todayM = String(gCalCurrentDate.getMonth() + 1).padStart(2, "0");
    const currentPrefix = `${todayY}-${todayM}`;

    const hasShiftsInCurrentMonth = dates.some(d => d.startsWith(currentPrefix));
    if (!hasShiftsInCurrentMonth && latestDateStr) {
      const p = latestDateStr.split("-");
      if (p.length === 3) {
        gCalCurrentDate = new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10));
        gSelectedDateStr = latestDateStr;
      }
    }
  }

  renderCalendarMonth();
}

/**
 * Renders C-Off register from Google Sheet and determines nearest expiry
 */
function renderCOffList(coffs) {
  const container = document.getElementById("coff-items-container");
  if (!container) return;

  container.innerHTML = "";

  let earnedCount = 0;
  let activeCount = 0;
  let availedCount = 0;
  let nearestExpiringItem = null;
  let lowestDaysRemaining = 99999;

  coffs.forEach(item => {
    earnedCount++;
    const isAvailed = String(item.status || "").toLowerCase().includes("availed");
    const days = parseInt(item.daysRemaining, 10);

    if (isAvailed) {
      availedCount++;
    } else {
      activeCount++;
      if (!isNaN(days) && days < lowestDaysRemaining) {
        lowestDaysRemaining = days;
        nearestExpiringItem = item;
      }
    }

    let badgeClass = "badge-safe";
    if (isAvailed) badgeClass = "badge-availed";
    else if (days <= 30) badgeClass = "badge-urgent";

    const card = document.createElement("div");
    card.className = "ios-list-cell";
    card.innerHTML = `
      <div>
        <div style="font-weight:600; font-size:14px; color: var(--text-primary);">${item.holiday || "Holiday"}</div>
        <div style="font-size:11px; color: var(--text-muted); margin-top:2px;">Worked: ${item.dutyDate || "--"} • ${item.shift || "--"}</div>
        <div style="font-size:11px; color: var(--ios-orange); margin-top:2px;">Expires: ${item.expiryDate || "--"}</div>
      </div>
      <div style="text-align:right;">
        <span class="status-pill ${badgeClass}">
          ${isAvailed ? "Availed" : (isNaN(days) ? (item.status || "Active") : `${days}d left`)}
        </span>
      </div>
    `;
    container.appendChild(card);
  });

  safeSetText("#coff-stat-earned", earnedCount);
  safeSetText("#coff-stat-active", activeCount);
  safeSetText("#coff-stat-sub", `${availedCount} Availed`);

  // Update Quick Action Alert in Tab 1
  const alertCard = document.getElementById("quick-alert-card");
  const alertTitle = document.getElementById("quick-alert-title");
  const alertText = document.getElementById("quick-alert-text");

  if (alertCard && alertTitle && alertText) {
    if (nearestExpiringItem && lowestDaysRemaining <= 30) {
      alertTitle.textContent = "⏳ Urgent C-Off Expiry Alert";
      alertText.textContent = `${nearestExpiringItem.holiday} C-Off expires ${nearestExpiringItem.expiryDate} (${lowestDaysRemaining}d left)`;
      alertCard.style.borderLeftColor = "var(--ios-red)";
    } else if (nearestExpiringItem) {
      alertTitle.textContent = "⏳ Next C-Off Expiry";
      alertText.textContent = `${nearestExpiringItem.holiday} C-Off expires ${nearestExpiringItem.expiryDate} (${lowestDaysRemaining}d left)`;
      alertCard.style.borderLeftColor = "var(--ios-orange)";
    } else {
      alertTitle.textContent = "✓ All C-Offs Settled";
      alertText.textContent = "No active C-Off pending expiry.";
      alertCard.style.borderLeftColor = "var(--ios-green)";
    }
  }
}

/**
 * Renders the Annual Calendar Holidays dynamically for the active work/calendar year.
 */
function renderAnnualHolidays(holidays) {
  const container = document.getElementById("holiday-items-container") || document.getElementById("holidays-items-container");
  const yearLabel = document.getElementById("holidays-year-label");
  const countBadge = document.getElementById("holidays-count-badge");
  if (!container) return;

  const currentYear = new Date().getFullYear();
  if (yearLabel) {
    yearLabel.textContent = String(currentYear);
  }

  container.innerHTML = "";

  // Filter holidays belonging to the active calendar year
  const activeYearHolidays = holidays.filter(h => {
    if (!h.date) return false;
    const parts = h.date.split("-");
    const yr = parts.length === 3 ? (parts[0].length === 4 ? parts[0] : parts[2]) : "";
    return yr === String(currentYear);
  });

  const listToRender = activeYearHolidays.length > 0 ? activeYearHolidays : holidays;

  if (countBadge) {
    countBadge.textContent = `${listToRender.length} Holidays`;
  }

  listToRender.forEach(h => {
    const isWorked = h.dutyStatus && h.dutyStatus.toLowerCase().includes("worked");
    const isPrior = h.dutyStatus && h.dutyStatus.toLowerCase().includes("prior");
    const isAvailed = h.dutyStatus && (h.dutyStatus.toLowerCase().includes("availed") || h.dutyStatus.toLowerCase().includes("off"));

    let badgeClass = "badge-safe";
    let badgeText = "Upcoming";

    if (isWorked) {
      badgeClass = "badge-holiday-worked";
      badgeText = "+1 C-Off Earned";
    } else if (isPrior) {
      badgeClass = "badge-availed";
      badgeText = "Prior to Joining";
    } else if (isAvailed) {
      badgeClass = "badge-leave-maroon";
      badgeText = "Availed / Off";
    }

    const card = document.createElement("div");
    card.className = "ios-list-cell";
    card.innerHTML = `
      <div>
        <div style="font-weight:600; font-size:14px; color: var(--text-primary);">${h.name}</div>
        <div style="font-size:11px; color: var(--text-muted); margin-top:2px;">
          ${h.date} (${h.day || ""}) • ${h.type || "KWML List"}
        </div>
        <div style="font-size:11px; color: var(--text-secondary); margin-top:2px;">
          ${h.dutyStatus || "Scheduled Holiday"}
        </div>
      </div>
      <div style="text-align:right;">
        <span class="status-pill ${badgeClass}">
          ${badgeText}
        </span>
      </div>
    `;
    container.appendChild(card);
  });
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
      const p = String(shift.date).split("-");
      if (p.length === 3) {
        iso = p[0].length === 4 ? `${p[0]}-${p[1]}-${p[2]}` : `${p[2]}-${p[1]}-${p[0]}`;
      }
    }
    if (iso) {
      gShiftMap.set(iso, shift);
    }
  });
}

/**
 * Renders the iOS Monthly Calendar Grid:
 * - 2-line display: Shift Code on Line 1, Terminal on Line 2
 * - Red for LOP / EL
 * - Maroon for Other Leaves & C-Offs
 * - Dates with no data in Google Sheet are non-interactive (no link/pointer action)
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
  titleEl.textContent = `${monthNames[month]} ${year}`;

  const firstDayIndex = new Date(year, month, 1).getDay(); // 0 = Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevMonthLastDate = new Date(year, month, 0).getDate();

  // 1. Previous month trailing days
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    const prevDateNum = prevMonthLastDate - i;
    const cell = document.createElement("div");
    cell.className = "cal-day-cell other-month";
    cell.innerHTML = `<span class="cal-day-number">${prevDateNum}</span>`;
    grid.appendChild(cell);
  }

  const today = new Date();
  const todayY = today.getFullYear();
  const todayM = String(today.getMonth() + 1).padStart(2, "0");
  const todayD = String(today.getDate()).padStart(2, "0");
  const todayIso = `${todayY}-${todayM}-${todayD}`;

  // 2. Current Month Days
  for (let day = 1; day <= daysInMonth; day++) {
    const mStr = String(month + 1).padStart(2, "0");
    const dStr = String(day).padStart(2, "0");
    const isoDate = `${year}-${mStr}-${dStr}`;

    const cell = document.createElement("div");
    cell.className = "cal-day-cell";
    cell.dataset.date = isoDate;

    if (isoDate === todayIso) {
      cell.classList.add("is-today");
    }

    const shift = gShiftMap.get(isoDate);

    // Only dates with recorded shifts or leaves in Google Sheet are interactive
    const hasData = Boolean(
      shift && 
      shift.code && 
      shift.code !== "-" && 
      shift.code !== "WO"
    );

    let badgeHtml = "";

    if (shift) {
      const code = String(shift.code || "").toUpperCase();
      const status = String(shift.status || "");
      const abbr = getTerminalAbbr(shift.terminal);

      if (status.includes("Holiday Worked")) {
        // Line 1: H+C (Code), Line 2: Terminal
        badgeHtml = `
          <div class="cal-badge-2line badge-holiday-worked">
            <span class="badge-line-shift">H+C (${code})</span>
            <span class="badge-line-term">${abbr}</span>
          </div>`;
      } else if (code === "A") {
        // Line 1: Shift A, Line 2: Terminal
        badgeHtml = `
          <div class="cal-badge-2line badge-shift-a">
            <span class="badge-line-shift">Shift A</span>
            <span class="badge-line-term">${abbr}</span>
          </div>`;
      } else if (code === "B") {
        // Line 1: Shift B, Line 2: Terminal
        badgeHtml = `
          <div class="cal-badge-2line badge-shift-b">
            <span class="badge-line-shift">Shift B</span>
            <span class="badge-line-term">${abbr}</span>
          </div>`;
      } else if (code === "G") {
        // Line 1: Shift G, Line 2: Terminal
        badgeHtml = `
          <div class="cal-badge-2line badge-shift-g">
            <span class="badge-line-shift">Shift G</span>
            <span class="badge-line-term">${abbr}</span>
          </div>`;
      } else if (code === "EL" || status.includes("LOP") || status.includes("Emergency")) {
        // RED: Line 1: EL, Line 2: LOP
        badgeHtml = `
          <div class="cal-badge-2line badge-leave-el">
            <span class="badge-line-shift">EL</span>
            <span class="badge-line-term">LOP</span>
          </div>`;
      } else if (code === "C-OFF" || status.includes("C-Off")) {
        // MAROON: Line 1: C-Off, Line 2: Availed
        badgeHtml = `
          <div class="cal-badge-2line badge-leave-maroon">
            <span class="badge-line-shift">C-Off</span>
            <span class="badge-line-term">Availed</span>
          </div>`;
      } else if (code === "CL" || code === "PL" || code === "RH") {
        // MAROON: Line 1: Leave Code, Line 2: Leave
        badgeHtml = `
          <div class="cal-badge-2line badge-leave-maroon">
            <span class="badge-line-shift">${code}</span>
            <span class="badge-line-term">Leave</span>
          </div>`;
      } else if (code === "HOLIDAY" || status.includes("Official Holiday")) {
        // MAROON: Line 1: Holiday, Line 2: Off
        badgeHtml = `
          <div class="cal-badge-2line badge-leave-maroon">
            <span class="badge-line-shift">Holiday</span>
            <span class="badge-line-term">Off</span>
          </div>`;
      } else if (code === "WO" || status.includes("Off")) {
        badgeHtml = `<span class="cal-badge badge-off-day">Off</span>`;
      } else {
        badgeHtml = `
          <div class="cal-badge-2line badge-shift-a">
            <span class="badge-line-shift">${code}</span>
            <span class="badge-line-term">${abbr}</span>
          </div>`;
      }
    }

    cell.innerHTML = `<span class="cal-day-number">${day}</span>${badgeHtml}`;

    // Interaction handling: only dates with real data get click listeners
    if (hasData) {
      cell.classList.add("has-data");
      if (isoDate === gSelectedDateStr) {
        cell.classList.add("is-selected");
      }
      cell.addEventListener("click", () => {
        document.querySelectorAll(".cal-day-cell").forEach(c => c.classList.remove("is-selected"));
        cell.classList.add("is-selected");
        gSelectedDateStr = isoDate;
        inspectDate(isoDate);
      });
    } else {
      cell.classList.add("no-data");
    }

    grid.appendChild(cell);
  }

  // 3. Next month leading days
  const totalRendered = firstDayIndex + daysInMonth;
  const trailingCount = (7 - (totalRendered % 7)) % 7;
  for (let nextDay = 1; nextDay <= trailingCount; nextDay++) {
    const cell = document.createElement("div");
    cell.className = "cal-day-cell other-month";
    cell.innerHTML = `<span class="cal-day-number">${nextDay}</span>`;
    grid.appendChild(cell);
  }

  if (gSelectedDateStr && gShiftMap.has(gSelectedDateStr)) {
    inspectDate(gSelectedDateStr);
  }
}

/**
 * Shows duty / leave details for the tapped date
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

  dateEl.textContent = `${dObj.getDate()} ${months[dObj.getMonth()]} ${dObj.getFullYear()}`;
  dayNameEl.textContent = daysOfWeek[dObj.getDay()];

  const shift = gShiftMap.get(isoDate);
  if (!shift) return;

  const code = (shift.code || "").toUpperCase();
  const status = shift.status || "Completed";
  const isCompleted = status.includes("Completed");
  const isHolidayWorked = status.includes("Holiday Worked");
  const isLOP = code === "EL" || status.includes("LOP") || status.includes("Emergency");
  const isOtherLeave = ["CL", "PL", "RH", "C-OFF", "HOLIDAY"].includes(code) || status.includes("Leave") || status.includes("Holiday");
  const abbr = getTerminalAbbr(shift.terminal);

  // 1. RED for Emergency Leave / Loss of Pay
  if (isLOP) {
    badgeEl.textContent = "EL (Loss of Pay)";
    badgeEl.style.color = "#FF453A";
    badgeEl.style.background = "rgba(255, 69, 58, 0.2)";
    badgeEl.style.borderColor = "rgba(255, 69, 58, 0.5)";

    bodyEl.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:12px; margin-top:4px;">
        <div class="detail-metric-row">
          <span style="font-size:12px; color:var(--text-muted); font-weight:500;">Leave Type</span>
          <strong style="font-size:14px; color:#FF453A;">Emergency Leave (EL / LOP)</strong>
        </div>
        <div class="detail-metric-row">
          <span style="font-size:12px; color:var(--text-muted); font-weight:500;">Deduction Rule</span>
          <span style="font-size:13px; color:var(--text-secondary);">Unpaid / Loss of Pay (Non-qualifying for PL)</span>
        </div>
        <div class="detail-metric-row">
          <span style="font-size:12px; color:var(--text-muted); font-weight:500;">Duty Summary</span>
          <span style="font-size:13px; color:var(--text-primary);">${shift.summary || "Emergency Leave"}</span>
        </div>
        <div class="detail-metric-row">
          <span style="font-size:12px; color:var(--text-muted); font-weight:500;">Approval Status</span>
          <span class="status-pill badge-leave-el">Leave Availed (LOP)</span>
        </div>
      </div>
    `;
    return;
  }

  // 2. MAROON for Other Leaves & C-Offs
  if (isOtherLeave) {
    badgeEl.textContent = code === "C-OFF" ? "C-Off Availed" : (code === "HOLIDAY" ? "Holiday Off" : `Leave (${code})`);
    badgeEl.style.color = "#F07187";
    badgeEl.style.background = "rgba(144, 28, 54, 0.35)";
    badgeEl.style.borderColor = "rgba(216, 74, 101, 0.55)";

    bodyEl.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:12px; margin-top:4px;">
        <div class="detail-metric-row">
          <span style="font-size:12px; color:var(--text-muted); font-weight:500;">Leave Classification</span>
          <strong style="font-size:14px; color:#F07187;">${code === 'C-OFF' ? 'Compensatory Off' : (code === 'HOLIDAY' ? 'Official Holiday Off' : shift.summary)}</strong>
        </div>
        <div class="detail-metric-row">
          <span style="font-size:12px; color:var(--text-muted); font-weight:500;">Duty Hours</span>
          <span style="font-size:13px; color:var(--text-secondary);">Off Duty (Leave Consumed)</span>
        </div>
        <div class="detail-metric-row">
          <span style="font-size:12px; color:var(--text-muted); font-weight:500;">Roster Record</span>
          <span style="font-size:13px; color:var(--text-primary);">${shift.summary || code}</span>
        </div>
        <div class="detail-metric-row">
          <span style="font-size:12px; color:var(--text-muted); font-weight:500;">Status</span>
          <span class="status-pill badge-leave-maroon">${status}</span>
        </div>
      </div>
    `;
    return;
  }

  // 3. Work Shifts (A, B, G)
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

  badgeEl.textContent = isHolidayWorked ? "Holiday Worked (+1 C-Off)" : `Shift ${code}`;
  badgeEl.style.color = badgeColor;
  badgeEl.style.background = badgeBg;
  badgeEl.style.borderColor = badgeColor;

  bodyEl.innerHTML = `
    <div style="display:flex; flex-direction:column; gap:12px; margin-top:4px;">
      <div class="detail-metric-row">
        <span style="font-size:12px; color:var(--text-muted); font-weight:500;">Terminal Location</span>
        <strong style="font-size:14px; color:var(--text-primary);">${shift.terminal} (${abbr})</strong>
      </div>
      <div class="detail-metric-row">
        <span style="font-size:12px; color:var(--text-muted); font-weight:500;">Duty Hours</span>
        <strong style="font-size:13px; color:var(--text-primary); font-family:monospace;">${shift.startTime || "07:00"} — ${shift.endTime || "15:00"}</strong>
      </div>
      <div class="detail-metric-row">
        <span style="font-size:12px; color:var(--text-muted); font-weight:500;">Roster Summary</span>
        <span style="font-size:13px; color:var(--text-secondary);">${shift.summary || "-"}</span>
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

function loadPreviousSessionCache() {
  const cached = localStorage.getItem("kwml_sheet_live_cache");
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      updateDashboardUI(parsed);
    } catch (e) {
      console.warn("Could not parse previous session cache:", e);
    }
  }
}

function safeSetText(selector, text) {
  const el = document.querySelector(selector);
  if (el && text !== undefined && text !== null) {
    el.textContent = text;
  }
}

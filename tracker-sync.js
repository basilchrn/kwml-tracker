/**
 * tracker-sync.js
 * Synchronizes the KWML iOS 4-Tab Dashboard dynamically with the Google Sheet.
 * Features:
 * - Interactive iOS-style Calendar View for Roster tab
 * - Standardized Terminal Abbreviations (HCT, VYP, FOK, WIL, SCT, CHR, KAK, MAT, VYT, OCC)
 * - Month navigation (Prev, Next, Today)
 * - Shift badge indicators & detailed day duty inspector
 * - Dynamic data sync from Google Apps Script Web App
 */

// Replace with your Web App deployment URL from Google Apps Script
const GOOGLE_SCRIPT_API_URL = "https://script.google.com/macros/s/AKfycbyt9Ai5-FBS23G1_OSbg30a2sCyXjuY9dWuPfqo2YHR2Umbunn2uIXnlozAEGOpigkquA/exec";

// Standard Terminal Name to Abbreviation Converter
function getTerminalAbbr(name) {
  if (!name) return "";
  const n = name.trim().toLowerCase();
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

// All 97 Shifts from joining date onwards for full offline calendar experience
const ALL_FALLBACK_SHIFTS = [
  {
    "date": "22-07-2026",
    "isoDate": "2026-07-22",
    "day": "Wednesday",
    "code": "B",
    "terminal": "High Court",
    "startTime": "13:30",
    "endTime": "21:30",
    "summary": "B - HighCourt",
    "status": "Completed"
  },
  {
    "date": "23-07-2026",
    "isoDate": "2026-07-23",
    "day": "Thursday",
    "code": "G",
    "terminal": "OCC Office",
    "startTime": "09:30",
    "endTime": "17:30",
    "summary": "G - OCC",
    "status": "Completed"
  },
  {
    "date": "24-07-2026",
    "isoDate": "2026-07-24",
    "day": "Friday",
    "code": "B",
    "terminal": "Vypin",
    "startTime": "13:00",
    "endTime": "21:00",
    "summary": "B - Vypin",
    "status": "Completed"
  },
  {
    "date": "25-07-2026",
    "isoDate": "2026-07-25",
    "day": "Saturday",
    "code": "A",
    "terminal": "Mattancherry",
    "startTime": "07:00",
    "endTime": "15:00",
    "summary": "A - Mattanchery",
    "status": "Completed"
  },
  {
    "date": "27-07-2026",
    "isoDate": "2026-07-27",
    "day": "Monday",
    "code": "A",
    "terminal": "Kakkanad",
    "startTime": "07:00",
    "endTime": "15:00",
    "summary": "A - Kakkanad",
    "status": "Completed"
  },
  {
    "date": "28-07-2026",
    "isoDate": "2026-07-28",
    "day": "Tuesday",
    "code": "A",
    "terminal": "South Chittoor",
    "startTime": "07:00",
    "endTime": "15:00",
    "summary": "A - S. Chittor",
    "status": "Completed"
  },
  {
    "date": "30-07-2026",
    "isoDate": "2026-07-30",
    "day": "Thursday",
    "code": "B",
    "terminal": "Willingdon Island",
    "startTime": "13:00",
    "endTime": "21:00",
    "summary": "B - W.Island",
    "status": "Completed"
  },
  {
    "date": "31-07-2026",
    "isoDate": "2026-07-31",
    "day": "Friday",
    "code": "A",
    "terminal": "South Chittoor",
    "startTime": "07:00",
    "endTime": "15:00",
    "summary": "A - S. Chittor",
    "status": "Completed"
  },
  {
    "date": "01-08-2026",
    "isoDate": "2026-08-01",
    "day": "Saturday",
    "code": "B",
    "terminal": "Fort Kochi",
    "startTime": "13:30",
    "endTime": "21:30",
    "summary": "B - Fort Kochi",
    "status": "Completed"
  },
  {
    "date": "02-08-2026",
    "isoDate": "2026-08-02",
    "day": "Sunday",
    "code": "B",
    "terminal": "Mattancherry",
    "startTime": "13:30",
    "endTime": "21:30",
    "summary": "B - Mattanchery",
    "status": "Completed"
  },
  {
    "date": "03-08-2026",
    "isoDate": "2026-08-03",
    "day": "Monday",
    "code": "B",
    "terminal": "Mattancherry",
    "startTime": "13:30",
    "endTime": "21:30",
    "summary": "B - Mattanchery",
    "status": "Completed"
  },
  {
    "date": "04-08-2026",
    "isoDate": "2026-08-04",
    "day": "Tuesday",
    "code": "B",
    "terminal": "Kakkanad",
    "startTime": "13:00",
    "endTime": "21:00",
    "summary": "B - Kakkanad",
    "status": "Completed"
  },
  {
    "date": "05-08-2026",
    "isoDate": "2026-08-05",
    "day": "Wednesday",
    "code": "B",
    "terminal": "Kakkanad",
    "startTime": "13:00",
    "endTime": "21:00",
    "summary": "B - Kakkanad",
    "status": "Completed"
  },
  {
    "date": "06-08-2026",
    "isoDate": "2026-08-06",
    "day": "Thursday",
    "code": "A",
    "terminal": "Kakkanad",
    "startTime": "07:00",
    "endTime": "15:00",
    "summary": "A - Kakkanad",
    "status": "Completed"
  },
  {
    "date": "08-08-2026",
    "isoDate": "2026-08-08",
    "day": "Saturday",
    "code": "A",
    "terminal": "Cheranalloor",
    "startTime": "07:00",
    "endTime": "15:00",
    "summary": "A - Cheranallor",
    "status": "Completed"
  },
  {
    "date": "09-08-2026",
    "isoDate": "2026-08-09",
    "day": "Sunday",
    "code": "B",
    "terminal": "Fort Kochi",
    "startTime": "13:30",
    "endTime": "21:30",
    "summary": "B - Fort Kochi",
    "status": "Completed"
  },
  {
    "date": "10-08-2026",
    "isoDate": "2026-08-10",
    "day": "Monday",
    "code": "A",
    "terminal": "Kakkanad",
    "startTime": "07:00",
    "endTime": "15:00",
    "summary": "A - Kakkanad",
    "status": "Completed"
  },
  {
    "date": "11-08-2026",
    "isoDate": "2026-08-11",
    "day": "Tuesday",
    "code": "A",
    "terminal": "Mattancherry",
    "startTime": "07:00",
    "endTime": "15:00",
    "summary": "A - Mattanchery",
    "status": "Completed"
  },
  {
    "date": "13-08-2026",
    "isoDate": "2026-08-13",
    "day": "Thursday",
    "code": "B",
    "terminal": "Willingdon Island",
    "startTime": "13:00",
    "endTime": "21:00",
    "summary": "B - W.Island",
    "status": "Completed"
  },
  {
    "date": "14-08-2026",
    "isoDate": "2026-08-14",
    "day": "Friday",
    "code": "A",
    "terminal": "Cheranalloor",
    "startTime": "07:00",
    "endTime": "15:00",
    "summary": "A - Cheranallor",
    "status": "Completed"
  },
  {
    "date": "15-08-2026",
    "isoDate": "2026-08-15",
    "day": "Saturday",
    "code": "-",
    "terminal": "-",
    "startTime": "-",
    "endTime": "-",
    "summary": "Independence Day",
    "status": "Availed Holiday Leave"
  },
  {
    "date": "16-08-2026",
    "isoDate": "2026-08-16",
    "day": "Sunday",
    "code": "B",
    "terminal": "South Chittoor",
    "startTime": "13:30",
    "endTime": "21:30",
    "summary": "B - S. Chittor",
    "status": "Completed"
  },
  {
    "date": "17-08-2026",
    "isoDate": "2026-08-17",
    "day": "Monday",
    "code": "B",
    "terminal": "Vyttila",
    "startTime": "13:30",
    "endTime": "21:30",
    "summary": "B - Vyttila",
    "status": "Completed"
  },
  {
    "date": "17-08-2026",
    "isoDate": "2026-08-17",
    "day": "Monday",
    "code": "B",
    "terminal": "Vytilla",
    "startTime": "13:30",
    "endTime": "21:30",
    "summary": "B - Vytilla",
    "status": "Completed"
  },
  {
    "date": "18-08-2026",
    "isoDate": "2026-08-18",
    "day": "Tuesday",
    "code": "B",
    "terminal": "Kakkanad",
    "startTime": "13:00",
    "endTime": "21:00",
    "summary": "B - Kakkanad",
    "status": "Completed"
  },
  {
    "date": "19-08-2026",
    "isoDate": "2026-08-19",
    "day": "Wednesday",
    "code": "B",
    "terminal": "South Chittoor",
    "startTime": "13:30",
    "endTime": "21:30",
    "summary": "B - S. Chittor (KWML Onam celebration)",
    "status": "Completed"
  },
  {
    "date": "19-08-2026",
    "isoDate": "2026-08-19",
    "day": "Wednesday",
    "code": "B",
    "terminal": "S. Chittor",
    "startTime": "13:30",
    "endTime": "21:30",
    "summary": "B - S. Chittor",
    "status": "Completed"
  },
  {
    "date": "21-08-2026",
    "isoDate": "2026-08-21",
    "day": "Friday",
    "code": "A",
    "terminal": "Kakkanad",
    "startTime": "07:00",
    "endTime": "15:00",
    "summary": "A - Kakkanad",
    "status": "Completed"
  },
  {
    "date": "22-08-2026",
    "isoDate": "2026-08-22",
    "day": "Saturday",
    "code": "B",
    "terminal": "South Chittoor",
    "startTime": "13:30",
    "endTime": "21:30",
    "summary": "B - S. Chittor",
    "status": "Completed"
  },
  {
    "date": "23-08-2026",
    "isoDate": "2026-08-23",
    "day": "Sunday",
    "code": "B",
    "terminal": "Kakkanad",
    "startTime": "13:00",
    "endTime": "21:00",
    "summary": "B - Kakkanad",
    "status": "Completed"
  },
  {
    "date": "24-08-2026",
    "isoDate": "2026-08-24",
    "day": "Monday",
    "code": "B",
    "terminal": "Fort Kochi",
    "startTime": "13:30",
    "endTime": "21:30",
    "summary": "B - Fort Kochi",
    "status": "Completed"
  },
  {
    "date": "25-08-2026",
    "isoDate": "2026-08-25",
    "day": "Tuesday",
    "code": "B",
    "terminal": "South Chittoor",
    "startTime": "13:30",
    "endTime": "21:30",
    "summary": "B - S. Chittor",
    "status": "Completed"
  },
  {
    "date": "26-08-2026",
    "isoDate": "2026-08-26",
    "day": "Wednesday",
    "code": "A",
    "terminal": "Kakkanad",
    "startTime": "07:00",
    "endTime": "15:00",
    "summary": "A - Kakkanad (Thiruvonam)",
    "status": "Holiday Worked (+1 C-Off)"
  },
  {
    "date": "26-08-2026",
    "isoDate": "2026-08-26",
    "day": "Wednesday",
    "code": "A",
    "terminal": "Kakkanad",
    "startTime": "07:00",
    "endTime": "15:00",
    "summary": "A - Kakkanad",
    "status": "Completed"
  },
  {
    "date": "28-08-2026",
    "isoDate": "2026-08-28",
    "day": "Friday",
    "code": "G",
    "terminal": "Willingdon Island",
    "startTime": "09:30",
    "endTime": "17:30",
    "summary": "G - W.Island",
    "status": "Completed"
  },
  {
    "date": "29-08-2026",
    "isoDate": "2026-08-29",
    "day": "Saturday",
    "code": "B",
    "terminal": "Kakkanad",
    "startTime": "13:30",
    "endTime": "21:30",
    "summary": "B - Kakkanad",
    "status": "Completed"
  },
  {
    "date": "30-08-2026",
    "isoDate": "2026-08-30",
    "day": "Sunday",
    "code": "B",
    "terminal": "Kakkanad",
    "startTime": "13:30",
    "endTime": "21:30",
    "summary": "B - Kakkanad",
    "status": "Completed"
  },
  {
    "date": "31-08-2026",
    "isoDate": "2026-08-31",
    "day": "Monday",
    "code": "B",
    "terminal": "South Chittoor",
    "startTime": "13:30",
    "endTime": "21:30",
    "summary": "B - S. Chittor",
    "status": "Completed"
  },
  {
    "date": "01-09-2026",
    "isoDate": "2026-09-01",
    "day": "Tuesday",
    "code": "B",
    "terminal": "Vypin",
    "startTime": "13:00",
    "endTime": "21:00",
    "summary": "B - Vypin",
    "status": "Completed"
  },
  {
    "date": "02-09-2026",
    "isoDate": "2026-09-02",
    "day": "Wednesday",
    "code": "B",
    "terminal": "Kakkanad",
    "startTime": "13:30",
    "endTime": "21:30",
    "summary": "B - Kakkanad",
    "status": "Completed"
  },
  {
    "date": "03-09-2026",
    "isoDate": "2026-09-03",
    "day": "Thursday",
    "code": "B",
    "terminal": "South Chittoor",
    "startTime": "13:30",
    "endTime": "21:30",
    "summary": "B - S. Chittor",
    "status": "Completed"
  },
  {
    "date": "04-09-2026",
    "isoDate": "2026-09-04",
    "day": "Friday",
    "code": "B",
    "terminal": "Cheranalloor",
    "startTime": "13:00",
    "endTime": "21:00",
    "summary": "B - Cheranallor (Sreekrishna Jayanthi)",
    "status": "Holiday Worked (+1 C-Off)"
  },
  {
    "date": "04-09-2026",
    "isoDate": "2026-09-04",
    "day": "Friday",
    "code": "B",
    "terminal": "Cheranallor",
    "startTime": "13:00",
    "endTime": "21:00",
    "summary": "B - Cheranallor",
    "status": "Completed"
  },
  {
    "date": "06-09-2026",
    "isoDate": "2026-09-06",
    "day": "Sunday",
    "code": "A",
    "terminal": "Mattancherry",
    "startTime": "07:00",
    "endTime": "15:00",
    "summary": "A - Mattanchery",
    "status": "Completed"
  },
  {
    "date": "07-09-2026",
    "isoDate": "2026-09-07",
    "day": "Monday",
    "code": "A",
    "terminal": "High Court",
    "startTime": "07:00",
    "endTime": "15:00",
    "summary": "A - High Court",
    "status": "Completed"
  },
  {
    "date": "08-09-2026",
    "isoDate": "2026-09-08",
    "day": "Tuesday",
    "code": "G",
    "terminal": "Willingdon Island",
    "startTime": "09:20",
    "endTime": "17:30",
    "summary": "G - W.Island",
    "status": "Completed"
  },
  {
    "date": "09-09-2026",
    "isoDate": "2026-09-09",
    "day": "Wednesday",
    "code": "A",
    "terminal": "South Chittoor",
    "startTime": "06:50",
    "endTime": "15:00",
    "summary": "A - South Chittor",
    "status": "Completed"
  },
  {
    "date": "11-09-2026",
    "isoDate": "2026-09-11",
    "day": "Friday",
    "code": "B",
    "terminal": "Vyttila",
    "startTime": "13:20",
    "endTime": "21:30",
    "summary": "B - Vyttila",
    "status": "Completed"
  },
  {
    "date": "11-09-2026",
    "isoDate": "2026-09-11",
    "day": "Friday",
    "code": "B",
    "terminal": "Vytilla",
    "startTime": "13:20",
    "endTime": "21:30",
    "summary": "B - Vytilla",
    "status": "Completed"
  },
  {
    "date": "12-09-2026",
    "isoDate": "2026-09-12",
    "day": "Saturday",
    "code": "A",
    "terminal": "Cheranalloor",
    "startTime": "06:50",
    "endTime": "15:00",
    "summary": "A - Cheranallor",
    "status": "Completed"
  },
  {
    "date": "13-09-2026",
    "isoDate": "2026-09-13",
    "day": "Sunday",
    "code": "B",
    "terminal": "Cheranalloor",
    "startTime": "12:50",
    "endTime": "21:00",
    "summary": "B - Cheranallor",
    "status": "Completed"
  },
  {
    "date": "14-09-2026",
    "isoDate": "2026-09-14",
    "day": "Monday",
    "code": "B",
    "terminal": "Kakkanad",
    "startTime": "12:50",
    "endTime": "21:00",
    "summary": "B - Kakkanad",
    "status": "Completed"
  },
  {
    "date": "15-09-2026",
    "isoDate": "2026-09-15",
    "day": "Tuesday",
    "code": "B",
    "terminal": "High Court",
    "startTime": "13:15",
    "endTime": "21:15",
    "summary": "B - High Court",
    "status": "Completed"
  },
  {
    "date": "16-09-2026",
    "isoDate": "2026-09-16",
    "day": "Wednesday",
    "code": "B",
    "terminal": "Fort Kochi",
    "startTime": "13:10",
    "endTime": "21:30",
    "summary": "B - Fort Kochi",
    "status": "Completed"
  },
  {
    "date": "18-09-2026",
    "isoDate": "2026-09-18",
    "day": "Friday",
    "code": "A",
    "terminal": "Kakkanad",
    "startTime": "06:50",
    "endTime": "15:00",
    "summary": "A - Kakkanad",
    "status": "Completed"
  },
  {
    "date": "19-09-2026",
    "isoDate": "2026-09-19",
    "day": "Saturday",
    "code": "A",
    "terminal": "South Chittoor",
    "startTime": "06:50",
    "endTime": "15:00",
    "summary": "A - South Chittor",
    "status": "Completed"
  },
  {
    "date": "20-09-2026",
    "isoDate": "2026-09-20",
    "day": "Sunday",
    "code": "A",
    "terminal": "High Court",
    "startTime": "06:50",
    "endTime": "15:00",
    "summary": "A - High Court",
    "status": "Completed"
  },
  {
    "date": "21-09-2026",
    "isoDate": "2026-09-21",
    "day": "Monday",
    "code": "B",
    "terminal": "Kakkanad",
    "startTime": "12:50",
    "endTime": "21:00",
    "summary": "B - Kakkanad",
    "status": "Completed"
  },
  {
    "date": "22-09-2026",
    "isoDate": "2026-09-22",
    "day": "Tuesday",
    "code": "B",
    "terminal": "High Court",
    "startTime": "13:15",
    "endTime": "21:25",
    "summary": "B - High Court",
    "status": "Completed"
  },
  {
    "date": "23-09-2026",
    "isoDate": "2026-09-23",
    "day": "Wednesday",
    "code": "B",
    "terminal": "Mattancherry",
    "startTime": "13:20",
    "endTime": "21:30",
    "summary": "B - Mattancherry",
    "status": "Completed"
  },
  {
    "date": "25-09-2026",
    "isoDate": "2026-09-25",
    "day": "Friday",
    "code": "A",
    "terminal": "Mattancherry",
    "startTime": "06:50",
    "endTime": "15:00",
    "summary": "A - Mattanchery",
    "status": "Completed"
  },
  {
    "date": "26-09-2026",
    "isoDate": "2026-09-26",
    "day": "Saturday",
    "code": "B",
    "terminal": "Mattancherry",
    "startTime": "13:20",
    "endTime": "21:30",
    "summary": "B - Mattanchery",
    "status": "Completed"
  },
  {
    "date": "27-09-2026",
    "isoDate": "2026-09-27",
    "day": "Sunday",
    "code": "B",
    "terminal": "Vyttila",
    "startTime": "13:20",
    "endTime": "21:30",
    "summary": "B - Vyttila",
    "status": "Completed"
  },
  {
    "date": "27-09-2026",
    "isoDate": "2026-09-27",
    "day": "Sunday",
    "code": "B",
    "terminal": "Vytilla",
    "startTime": "13:20",
    "endTime": "21:30",
    "summary": "B - Vytilla",
    "status": "Completed"
  },
  {
    "date": "28-09-2026",
    "isoDate": "2026-09-28",
    "day": "Monday",
    "code": "B",
    "terminal": "Vyttila",
    "startTime": "13:20",
    "endTime": "21:30",
    "summary": "B - Vyttila",
    "status": "Completed"
  },
  {
    "date": "28-09-2026",
    "isoDate": "2026-09-28",
    "day": "Monday",
    "code": "B",
    "terminal": "Vytilla",
    "startTime": "13:20",
    "endTime": "21:30",
    "summary": "B - Vytilla",
    "status": "Completed"
  },
  {
    "date": "29-09-2026",
    "isoDate": "2026-09-29",
    "day": "Tuesday",
    "code": "B",
    "terminal": "Vypin",
    "startTime": "12:50",
    "endTime": "21:00",
    "summary": "B - Vypin",
    "status": "Completed"
  },
  {
    "date": "30-09-2026",
    "isoDate": "2026-09-30",
    "day": "Wednesday",
    "code": "B",
    "terminal": "Kakkanad",
    "startTime": "12:50",
    "endTime": "21:00",
    "summary": "B - Kakkanad",
    "status": "Completed"
  },
  {
    "date": "01-10-2026",
    "isoDate": "2026-10-01",
    "day": "Thursday",
    "code": "B",
    "terminal": "Kakkanad",
    "startTime": "13:20",
    "endTime": "21:30",
    "summary": "B - Kakkanad",
    "status": "Completed"
  },
  {
    "date": "03-10-2026",
    "isoDate": "2026-10-03",
    "day": "Saturday",
    "code": "B",
    "terminal": "Kakkanad",
    "startTime": "13:20",
    "endTime": "21:30",
    "summary": "B - Kakkanad",
    "status": "Completed"
  },
  {
    "date": "04-10-2026",
    "isoDate": "2026-10-04",
    "day": "Sunday",
    "code": "B",
    "terminal": "Willingdon Island",
    "startTime": "12:50",
    "endTime": "21:00",
    "summary": "B - W. Island",
    "status": "Completed"
  },
  {
    "date": "05-10-2026",
    "isoDate": "2026-10-05",
    "day": "Monday",
    "code": "A",
    "terminal": "South Chittoor",
    "startTime": "06:50",
    "endTime": "15:00",
    "summary": "A - South Chittor",
    "status": "Completed"
  },
  {
    "date": "06-10-2026",
    "isoDate": "2026-10-06",
    "day": "Tuesday",
    "code": "A",
    "terminal": "Mattancherry",
    "startTime": "06:50",
    "endTime": "15:00",
    "summary": "A - Mattanchery",
    "status": "Completed"
  },
  {
    "date": "07-10-2026",
    "isoDate": "2026-10-07",
    "day": "Wednesday",
    "code": "A",
    "terminal": "Kakkanad",
    "startTime": "06:50",
    "endTime": "15:00",
    "summary": "A - Kakkanad",
    "status": "Completed"
  },
  {
    "date": "09-10-2026",
    "isoDate": "2026-10-09",
    "day": "Friday",
    "code": "B",
    "terminal": "Fort Kochi",
    "startTime": "13:10",
    "endTime": "21:30",
    "summary": "B - Fort Kochi",
    "status": "Completed"
  },
  {
    "date": "10-10-2026",
    "isoDate": "2026-10-10",
    "day": "Saturday",
    "code": "B",
    "terminal": "High Court",
    "startTime": "13:15",
    "endTime": "21:15",
    "summary": "B - High Court",
    "status": "Completed"
  },
  {
    "date": "11-10-2026",
    "isoDate": "2026-10-11",
    "day": "Sunday",
    "code": "B",
    "terminal": "Fort Kochi",
    "startTime": "13:10",
    "endTime": "21:30",
    "summary": "B - Fort Kochi",
    "status": "Completed"
  },
  {
    "date": "12-10-2026",
    "isoDate": "2026-10-12",
    "day": "Monday",
    "code": "B",
    "terminal": "Vypin",
    "startTime": "12:20",
    "endTime": "21:00",
    "summary": "B - Vypin",
    "status": "Completed"
  },
  {
    "date": "13-10-2026",
    "isoDate": "2026-10-13",
    "day": "Tuesday",
    "code": "B",
    "terminal": "Fort Kochi",
    "startTime": "13:10",
    "endTime": "21:30",
    "summary": "B - Fort Kochi",
    "status": "Completed"
  },
  {
    "date": "14-10-2026",
    "isoDate": "2026-10-14",
    "day": "Wednesday",
    "code": "B",
    "terminal": "Kakkanad",
    "startTime": "12:50",
    "endTime": "21:00",
    "summary": "B - Kakkanad",
    "status": "Completed"
  },
  {
    "date": "16-10-2026",
    "isoDate": "2026-10-16",
    "day": "Friday",
    "code": "A",
    "terminal": "South Chittoor",
    "startTime": "06:50",
    "endTime": "15:00",
    "summary": "A - S. Chittor",
    "status": "Completed"
  },
  {
    "date": "17-10-2026",
    "isoDate": "2026-10-17",
    "day": "Saturday",
    "code": "A",
    "terminal": "Vypin",
    "startTime": "06:50",
    "endTime": "15:00",
    "summary": "A - Vypin",
    "status": "Completed"
  },
  {
    "date": "18-10-2026",
    "isoDate": "2026-10-18",
    "day": "Sunday",
    "code": "B",
    "terminal": "Cheranalloor",
    "startTime": "12:50",
    "endTime": "21:00",
    "summary": "B - Cheranallor",
    "status": "Completed"
  },
  {
    "date": "19-10-2026",
    "isoDate": "2026-10-19",
    "day": "Monday",
    "code": "B",
    "terminal": "Fort Kochi",
    "startTime": "13:10",
    "endTime": "21:30",
    "summary": "B - Fort Kochi",
    "status": "Completed"
  },
  {
    "date": "20-10-2026",
    "isoDate": "2026-10-20",
    "day": "Tuesday",
    "code": "A",
    "terminal": "South Chittoor",
    "startTime": "06:50",
    "endTime": "15:00",
    "summary": "A - S. Chittor (Mahanavami)",
    "status": "Holiday Worked (+1 C-Off)"
  },
  {
    "date": "20-10-2026",
    "isoDate": "2026-10-20",
    "day": "Tuesday",
    "code": "A",
    "terminal": "S. Chittor",
    "startTime": "06:50",
    "endTime": "15:00",
    "summary": "A - S. Chittor",
    "status": "Completed"
  },
  {
    "date": "21-10-2026",
    "isoDate": "2026-10-21",
    "day": "Wednesday",
    "code": "B",
    "terminal": "Cheranalloor",
    "startTime": "12:50",
    "endTime": "21:00",
    "summary": "B - Cheranallor (Vijayadashami)",
    "status": "Holiday Worked (+1 C-Off)"
  },
  {
    "date": "21-10-2026",
    "isoDate": "2026-10-21",
    "day": "Wednesday",
    "code": "B",
    "terminal": "Cheranallor",
    "startTime": "12:50",
    "endTime": "21:00",
    "summary": "B - Cheranallor",
    "status": "Completed"
  },
  {
    "date": "23-10-2026",
    "isoDate": "2026-10-23",
    "day": "Friday",
    "code": "B",
    "terminal": "High Court",
    "startTime": "13:15",
    "endTime": "21:15",
    "summary": "B - High Court",
    "status": "Completed"
  },
  {
    "date": "24-10-2026",
    "isoDate": "2026-10-24",
    "day": "Saturday",
    "code": "B",
    "terminal": "Fort Kochi",
    "startTime": "13:10",
    "endTime": "21:30",
    "summary": "B - Fort Kochi",
    "status": "Completed"
  },
  {
    "date": "25-10-2026",
    "isoDate": "2026-10-25",
    "day": "Sunday",
    "code": "B",
    "terminal": "High Court",
    "startTime": "13:15",
    "endTime": "21:15",
    "summary": "B - High Court",
    "status": "Completed"
  },
  {
    "date": "26-10-2026",
    "isoDate": "2026-10-26",
    "day": "Monday",
    "code": "B",
    "terminal": "South Chittoor",
    "startTime": "13:30",
    "endTime": "21:30",
    "summary": "B - S. Chittor",
    "status": "Completed"
  },
  {
    "date": "28-10-2026",
    "isoDate": "2026-10-28",
    "day": "Wednesday",
    "code": "B",
    "terminal": "Cheranalloor",
    "startTime": "12:50",
    "endTime": "21:00",
    "summary": "B - Cheranallor",
    "status": "Completed"
  },
  {
    "date": "29-10-2026",
    "isoDate": "2026-10-29",
    "day": "Thursday",
    "code": "B",
    "terminal": "South Chittoor",
    "startTime": "13:30",
    "endTime": "21:30",
    "summary": "B - S. Chittor",
    "status": "Completed"
  },
  {
    "date": "30-10-2026",
    "isoDate": "2026-10-30",
    "day": "Friday",
    "code": "A",
    "terminal": "South Chittoor",
    "startTime": "06:50",
    "endTime": "15:00",
    "summary": "A - S. Chittor",
    "status": "Upcoming / Scheduled"
  },
  {
    "date": "31-10-2026",
    "isoDate": "2026-10-31",
    "day": "Saturday",
    "code": "A",
    "terminal": "High Court",
    "startTime": "06:50",
    "endTime": "15:00",
    "summary": "A - High Court",
    "status": "Upcoming / Scheduled"
  },
  {
    "date": "01-11-2026",
    "isoDate": "2026-11-01",
    "day": "Sunday",
    "code": "B",
    "terminal": "High Court",
    "startTime": "13:15",
    "endTime": "21:25",
    "summary": "B - High Court",
    "status": "Upcoming / Scheduled"
  }
];

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
  recentShifts: ALL_FALLBACK_SHIFTS
};

// In-memory shift map indexed by YYYY-MM-DD
const gShiftMap = new Map();

// Calendar Navigation State (Default to active context: October 2026)
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

  // 1. Previous month trailing days (padding)
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
      const abbr = getTerminalAbbr(shift.terminal);

      if (status.includes("Holiday Worked")) {
        badgeHtml = '<span class="cal-badge badge-holiday-worked">H+C</span>';
      } else if (code === "A") {
        badgeHtml = '<span class="cal-badge badge-shift-a">A • ' + abbr + '</span>';
      } else if (code === "B") {
        badgeHtml = '<span class="cal-badge badge-shift-b">B • ' + abbr + '</span>';
      } else if (code === "G") {
        badgeHtml = '<span class="cal-badge badge-shift-g">G • ' + abbr + '</span>';
      } else if (code === "-" || status.includes("Leave") || status.includes("Off")) {
        badgeHtml = '<span class="cal-badge badge-off-day">Off</span>';
      } else {
        badgeHtml = '<span class="cal-badge badge-shift-a">' + code + ' • ' + abbr + '</span>';
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

  // 3. Next month leading days (uniform 7-column grid)
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
  const abbr = getTerminalAbbr(shift.terminal);

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
        <strong style="font-size:14px; color:var(--text-primary);">${shift.terminal} (${abbr})</strong>
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
    if (statusText) statusText.textContent = "ℹ️ Offline demo mode (All 97 shifts indexed)";
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

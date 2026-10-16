/**
 * Google Apps Script for the sign-up sheet behind the landing pages (/for/<market>) and /preorder.
 * It lives in the Google Sheet, not in the app: paste it into the sheet's Apps Script editor
 * (Extensions → Apps Script) and deploy it as a web app. README.md, "Landing pages", has the steps.
 * The app posts each sign-up to the web app's address (SIGNUPS_SHEET_URL), and this adds it as a
 * row on the tab for the landing page it came from.
 */

// One tab per landing page, keyed by the page's address (/for/<key>).
const TABS = {
  speaking: "Speaking",
  sales: "Sales",
  schools: "Schools",
  english: "English learners",
  interviews: "Interviews",
  // Not a /for page: reservations left by email on /preorder while deposits can't be taken yet.
  preorder: "Preorder",
};
// A sign-up from a page this script doesn't know yet lands here, so nothing is lost.
const OTHER_TAB = "Other";

const COLUMNS = [
  "at",
  "email",
  "organization",
  "role",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "market",
  "colorway",
];

// Text that starts like a formula is stored as plain text, so a sign-up can't run one in the sheet.
function plain(value) {
  const text = value == null ? "" : String(value);
  return /^[=+\-@]/.test(text) ? "'" + text : text;
}

// The tab for a landing page, created with its header row the first time it's needed.
function tabFor(market) {
  const book = SpreadsheetApp.getActiveSpreadsheet();
  const name = TABS[market] || OTHER_TAB;
  let sheet = book.getSheetByName(name);
  if (!sheet) sheet = book.insertSheet(name, book.getNumSheets());
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(COLUMNS);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

/**
 * Optional: run this once from the editor (choose "setup", then Run) to create all five tabs
 * straight away. Without it, each tab appears when its page gets its first sign-up.
 * It also removes the empty "Sheet1" a new spreadsheet starts with.
 */
function setup() {
  Object.keys(TABS).forEach(tabFor);
  const book = SpreadsheetApp.getActiveSpreadsheet();
  const blank = book.getSheetByName("Sheet1");
  if (blank && blank.getLastRow() === 0 && book.getNumSheets() > 1) book.deleteSheet(blank);
}

function doPost(e) {
  const signup = JSON.parse(e.postData.contents);
  const utm = signup.utm || {};
  // One sign-up at a time, so two arriving together can't both try to create the same tab.
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    tabFor(signup.market).appendRow(
      COLUMNS.map((column) => plain(column.indexOf("utm_") === 0 ? utm[column] : signup[column])),
    );
  } finally {
    lock.releaseLock();
  }
  return ContentService.createTextOutput(JSON.stringify({ ok: true })).setMimeType(ContentService.MimeType.JSON);
}

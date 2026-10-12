/**
 * Google Apps Script for the sign-up sheet behind the landing pages (/for/<market>).
 * It lives in the Google Sheet, not in the app: paste it into the sheet's Apps Script editor
 * (Extensions → Apps Script) and deploy it as a web app. README.md, "Landing pages", has the steps.
 * The app posts each sign-up to the web app's address (SIGNUPS_SHEET_URL) and this adds a row.
 */
const COLUMNS = [
  "at",
  "market",
  "kind",
  "email",
  "organization",
  "role",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
];

// Text that starts like a formula is stored as plain text, so a sign-up can't run one in the sheet.
function plain(value) {
  const text = value == null ? "" : String(value);
  return /^[=+\-@]/.test(text) ? "'" + text : text;
}

function doPost(e) {
  const signup = JSON.parse(e.postData.contents);
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  if (sheet.getLastRow() === 0) sheet.appendRow(COLUMNS);
  const utm = signup.utm || {};
  sheet.appendRow(COLUMNS.map((column) => plain(column.indexOf("utm_") === 0 ? utm[column] : signup[column])));
  return ContentService.createTextOutput(JSON.stringify({ ok: true })).setMimeType(ContentService.MimeType.JSON);
}

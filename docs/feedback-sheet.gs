// Paste into Extensions > Apps Script on a new Google Sheet, then
// Deploy > New deployment > Web app, Execute as: Me, Who has access: Anyone.
// Put the /exec URL in Vercel as SHEET_WEBHOOK_URL.
const COLUMNS = [
  "at",
  "tester",
  "outcome",
  "query_index",
  "query",
  "miss_reason",
  "tried_before",
  "setting_change",
  "took_backup_action",
  "helpful",
  "want_native",
  "comment",
  "query_count",
  "top_diagnostic",
  "description",
  "seconds_to_feedback",
];

function doPost(e) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  if (sheet.getLastRow() === 0) sheet.appendRow(COLUMNS);
  const event = JSON.parse(e.postData.contents);
  sheet.appendRow(COLUMNS.map((name) => event[name] ?? ""));
  return ContentService.createTextOutput("ok");
}

// Mirror of downloadTemplate() from AdminPremiereLists.tsx — write to disk for inspection
import * as XLSX from "xlsx";
import { writeFileSync } from "fs";

const headers = ["College Name", "Country", "City", "Notes"];
const examples = [
  ["Harvard University", "United States", "Cambridge", "Example row — replace with your data"],
  ["University of Oxford", "United Kingdom", "Oxford", "Example row — replace with your data"],
  ["National University of Singapore (NUS)", "Singapore", "Singapore", "Example row — replace with your data"],
];
const sheet1 = XLSX.utils.aoa_to_sheet([headers, ...examples]);
sheet1["!cols"] = [{ wch: 50 }, { wch: 20 }, { wch: 20 }, { wch: 50 }];
const headerStyle = { font: { bold: true }, fill: { patternType: "solid", fgColor: { rgb: "FFF2CC" } } };
["A1","B1","C1","D1"].forEach(a => { if (sheet1[a]) sheet1[a].s = headerStyle; });

const instructions = [
  ["Premiere College List — Upload Instructions"],
  [""],
  ["• College Name and Country are required. City and Notes can be left blank."],
  ["• Country must be a recognised country name. Common aliases (USA, UK, UAE, HK, ROK) will be auto-resolved."],
  ["• Maximum 10,000 rows per file. Maximum file size 5 MB."],
  ["• Duplicates within the same file are de-duped (first occurrence kept)."],
  ["• The system supports .xlsx and .csv only."],
  ["• To replace a lender's list, upload a new file using the Replace action — the previous version is archived and the new file becomes current."],
];
const sheet2 = XLSX.utils.aoa_to_sheet(instructions);
sheet2["!cols"] = [{ wch: 110 }];

const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, sheet1, "Premiere List");
XLSX.utils.book_append_sheet(wb, sheet2, "Instructions");
const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
writeFileSync("/tmp/premiere-list-template.xlsx", buf);

// Read it back and verify
const wb2 = XLSX.readFile("/tmp/premiere-list-template.xlsx");
console.log("Sheet names:", wb2.SheetNames);
const s1 = wb2.Sheets[wb2.SheetNames[0]];
console.log("Sheet 1 rows:");
console.log(JSON.stringify(XLSX.utils.sheet_to_json(s1, { header: 1 }), null, 2));
const s2 = wb2.Sheets[wb2.SheetNames[1]];
console.log("Sheet 2 first 3 rows:");
console.log(JSON.stringify(XLSX.utils.sheet_to_json(s2, { header: 1 }).slice(0, 3), null, 2));
console.log("File size (bytes):", buf.length);

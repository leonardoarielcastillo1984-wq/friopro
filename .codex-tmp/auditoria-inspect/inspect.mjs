import fs from "node:fs/promises";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const inputPath = "/Users/leonardocastillo/Downloads/Auditoria en Seguridad del Transporte DADA 2026 AUTOEVALUACIÓN.XLSX";
const input = await FileBlob.load(inputPath);
const workbook = await SpreadsheetFile.importXlsx(input);

const sheets = await workbook.inspect({ kind: "sheet", include: "id,name", maxChars: 10000 });
console.log("SHEETS");
console.log(sheets.ndjson);

const overview = await workbook.inspect({
  kind: "workbook,sheet,table,definedName,drawing",
  maxChars: 20000,
  tableMaxRows: 12,
  tableMaxCols: 14,
  tableMaxCellChars: 180,
});
console.log("OVERVIEW");
console.log(overview.ndjson);

const outDir = "/Users/leonardocastillo/Desktop/APP/SGI respaldo 360/.codex-tmp/auditoria-inspect/renders";
await fs.mkdir(outDir, { recursive: true });
for (let i = 0; i < workbook.worksheets.items.length; i++) {
  const sheet = workbook.worksheets.getItemAt(i);
  const used = sheet.getUsedRange();
  console.log(`USED ${i} ${sheet.name}`, used?.address ?? "none");
  if (used) {
    const region = await workbook.inspect({ kind: "region", sheetId: sheet.name, range: used.address, maxChars: 22000, tableMaxRows: 80, tableMaxCols: 20, tableMaxCellChars: 240 });
    console.log(`REGION ${sheet.name}`);
    console.log(region.ndjson);
    const preview = await workbook.render({ sheetName: sheet.name, autoCrop: "all", scale: 1, format: "png" });
    await fs.writeFile(`${outDir}/${String(i + 1).padStart(2, "0")}-${sheet.name.replace(/[^a-z0-9_-]+/gi, "_")}.png`, new Uint8Array(await preview.arrayBuffer()));
  }
}

for (const target of [
  ["1° AUDITORIA", "A1:T108"],
  ["2° REPORTE", "A1:K26"],
  ["3° OBIRA-ACCION PLAN", "A1:J72"],
  ["4° YOKOTEN", "A1:F43"],
]) {
  const [sheetId, range] = target;
  const table = await workbook.inspect({ kind: "table", sheetId, range, include: "values,formulas", maxChars: 50000, tableMaxRows: 150, tableMaxCols: 80, tableMaxCellChars: 500 });
  await fs.writeFile(`${outDir}/${sheetId.replace(/[^a-z0-9_-]+/gi, "_")}.ndjson`, table.ndjson, "utf8");
}

const errors = await workbook.inspect({ kind: "match", searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A", options: { useRegex: true, maxResults: 300 }, maxChars: 30000 });
await fs.writeFile(`${outDir}/formula-errors.ndjson`, errors.ndjson, "utf8");

for (const [sheetName, rangeAddress] of [["1° AUDITORIA", "A1:T108"], ["2° REPORTE", "A1:K26"]]) {
  const range = workbook.worksheets.getItem(sheetName).getRange(rangeAddress);
  await fs.writeFile(`${outDir}/${sheetName.replace(/[^a-z0-9_-]+/gi, "_")}-raw.json`, JSON.stringify({ values: range.values, formulas: range.formulas }, null, 2), "utf8");
}

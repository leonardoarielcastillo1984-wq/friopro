import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const source = "/Users/leonardocastillo/Downloads/Auditoria en Seguridad del Transporte DADA 2026 AUTOEVALUACIÓN.XLSX";
const input = await FileBlob.load(source);
const workbook = await SpreadsheetFile.importXlsx(input);

const sheets = await workbook.inspect({
  kind: "sheet",
  include: "id,name",
  maxChars: 10000,
});
console.log("SHEETS");
console.log(sheets.ndjson);

const overview = await workbook.inspect({
  kind: "workbook,sheet,table,region",
  maxChars: 30000,
  tableMaxRows: 80,
  tableMaxCols: 20,
  tableMaxCellChars: 400,
});
console.log("OVERVIEW");
console.log(overview.ndjson);

for (const [sheetId, name, range] of [
  ["ws/36a9kw", "1° AUDITORIA", "A1:T108"],
  ["ws/rmjfq0", "2° REPORTE", "A1:K26"],
  ["ws/gizyc8", "3°bis Criterio Accion Plan", "A1:D42"],
  ["ws/oboovd", "3° OBIRA-ACCION PLAN", "A1:BZ72"],
  ["ws/gdtrbb", "4° YOKOTEN", "A1:E35"],
  ["ws/vduulc", "CRITERIO DE AUDITORIA", "A1:P21"],
  ["ws/muv30a", "Anotaciones", "A1:D13"],
]) {
  const detail = await workbook.inspect({
    kind: "table",
    sheetId,
    range,
    include: "values,formulas",
    maxChars: 60000,
    tableMaxRows: 150,
    tableMaxCols: 80,
    tableMaxCellChars: 600,
  });
  console.log(`DETAIL ${name}`);
  console.log(detail.ndjson);
}

const auditSheet = workbook.worksheets.getItem("1° AUDITORIA");
const auditValues = auditSheet.getRange("A1:T108").values;
console.log("AUDIT_NONEMPTY_ROWS");
for (let i = 0; i < auditValues.length; i++) {
  const compact = auditValues[i].map((v, j) => [String.fromCharCode(65 + j), v]).filter(([, v]) => v !== null && v !== "");
  if (compact.length) console.log(JSON.stringify({ row: i + 1, cells: compact }));
}

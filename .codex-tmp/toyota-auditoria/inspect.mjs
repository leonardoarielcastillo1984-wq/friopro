import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const source = "/Users/leonardocastillo/Downloads/Auditoria en Seguridad del Transporte DADA 2026 AUTOEVALUACIÓN.XLSX";
const input = await FileBlob.load(source);
const workbook = await SpreadsheetFile.importXlsx(input);
const sheet = workbook.worksheets.getItem("1° AUDITORIA");
const values = sheet.getRange("A6:E98").values;
const items = values
  .map((row, index) => ({
    excelRow: index + 6,
    categoria: row[0],
    item: row[1],
    aspecto: row[2],
    pregunta: row[3],
    evidenciaRecomendada: row[4],
  }))
  .filter((row) => row.item);
const start = Number(process.argv[2] ?? 0);
const end = Number(process.argv[3] ?? 999);
for (const row of items.filter((row) => row.excelRow >= start && row.excelRow <= end)) {
  const clean = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
  console.log([row.excelRow, clean(row.categoria), clean(row.item), clean(row.aspecto), clean(row.pregunta), clean(row.evidenciaRecomendada)].join("\t"));
}

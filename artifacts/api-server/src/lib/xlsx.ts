/**
 * Minimal, dependency-light .xlsx writer (Office Open XML + zip via fflate).
 *
 * Produces one styled sheet: a title row, a subtitle row, a green header row
 * with filters, frozen panes and real Excel types (numbers, dates, percents),
 * so the file opens cleanly in Excel, LibreOffice and Google Sheets.
 */
import { zipSync, strToU8 } from "fflate";

export type XlsxColumnType = "text" | "number" | "integer" | "decimal" | "percent" | "datetime" | "date";

export interface XlsxColumn {
  key: string;
  label: string;
  type?: XlsxColumnType;
  width?: number;
}

export interface XlsxSheet {
  sheetName: string;
  title: string;
  subtitle?: string;
  columns: XlsxColumn[];
  rows: Record<string, unknown>[];
  /** Minutes east of UTC used to show timestamps in the viewer's local time. */
  tzOffsetMinutes?: number;
}

// Style indexes into cellXfs (see STYLES below).
const S = {
  default: 0,
  header: 1,
  datetime: 2,
  decimal: 3,
  percent: 4,
  title: 5,
  subtitle: 6,
  integer: 7,
  date: 8,
  text: 9,
} as const;

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="4">
<numFmt numFmtId="164" formatCode="yyyy-mm-dd hh:mm"/>
<numFmt numFmtId="165" formatCode="#,##0.0"/>
<numFmt numFmtId="166" formatCode="yyyy-mm-dd"/>
<numFmt numFmtId="167" formatCode="0.0%"/>
</numFmts>
<fonts count="4">
<font><sz val="11"/><name val="Calibri"/><family val="2"/></font>
<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/><family val="2"/></font>
<font><b/><sz val="15"/><color rgb="FF0B3B33"/><name val="Calibri"/><family val="2"/></font>
<font><i/><sz val="10"/><color rgb="FF5B6B67"/><name val="Calibri"/><family val="2"/></font>
</fonts>
<fills count="3">
<fill><patternFill patternType="none"/></fill>
<fill><patternFill patternType="gray125"/></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FF0F8A6E"/><bgColor indexed="64"/></patternFill></fill>
</fills>
<borders count="2">
<border><left/><right/><top/><bottom/><diagonal/></border>
<border><left/><right/><top/><bottom style="thin"><color rgb="FFD5E3DF"/></bottom><diagonal/></border>
</borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="10">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
<xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left"/></xf>
<xf numFmtId="165" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>
<xf numFmtId="167" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>
<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="3" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>
<xf numFmtId="166" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left"/></xf>
<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="top"/></xf>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

const MAX_CELL_CHARS = 32_000;

function colName(i: number): string {
  let n = i + 1;
  let s = "";
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function esc(v: string): string {
  return v
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function textValue(v: unknown): string {
  if (v == null) return "";
  if (Array.isArray(v)) return v.filter((x) => x != null && x !== "").join(", ");
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function toDate(v: unknown): Date | null {
  if (v == null || v === "") return null;
  const d = v instanceof Date ? v : new Date(String(v));
  return isNaN(d.getTime()) ? null : d;
}

function inlineStr(ref: string, value: string, style: number): string {
  const t = value.length > MAX_CELL_CHARS ? value.slice(0, MAX_CELL_CHARS) + "…" : value;
  return `<c r="${ref}" t="inlineStr" s="${style}"><is><t xml:space="preserve">${esc(t)}</t></is></c>`;
}

function cell(ref: string, raw: unknown, type: XlsxColumnType, tzMin: number): string {
  if (raw == null || raw === "") return `<c r="${ref}" s="${S.text}"/>`;
  switch (type) {
    case "number":
    case "integer":
    case "decimal":
    case "percent": {
      const n = typeof raw === "number" ? raw : Number(raw);
      if (!Number.isFinite(n)) return inlineStr(ref, textValue(raw), S.text);
      const style = type === "percent" ? S.percent : type === "decimal" ? S.decimal : S.integer;
      const val = type === "percent" ? n / 100 : n;
      return `<c r="${ref}" s="${style}"><v>${val}</v></c>`;
    }
    case "datetime":
    case "date": {
      const d = toDate(raw);
      if (!d) return inlineStr(ref, textValue(raw), S.text);
      // Plain dates ("2026-11-17") are calendar days already; only timestamps shift to local time.
      const shift = type === "date" ? 0 : tzMin * 60_000;
      const serial = (d.getTime() + shift) / 86_400_000 + 25_569;
      return `<c r="${ref}" s="${type === "date" ? S.date : S.datetime}"><v>${serial}</v></c>`;
    }
    default:
      return inlineStr(ref, textValue(raw), S.text);
  }
}

function columnWidth(col: XlsxColumn, rows: Record<string, unknown>[]): number {
  if (col.width) return col.width;
  const type = col.type ?? "text";
  if (type === "datetime") return 18;
  if (type === "date") return 12;
  let max = col.label.length;
  const sample = rows.length > 500 ? rows.slice(0, 500) : rows;
  for (const r of sample) {
    const len = textValue(r[col.key]).length;
    if (len > max) max = len;
  }
  return Math.min(Math.max(max + 2, 10), 60);
}

export function buildXlsx(sheet: XlsxSheet): Uint8Array {
  const { columns, rows } = sheet;
  const tzMin = sheet.tzOffsetMinutes ?? 0;
  const lastCol = colName(Math.max(columns.length - 1, 0));
  const HEADER_ROW = 4;
  const lastRow = HEADER_ROW + rows.length;
  const sheetName = sheet.sheetName.replace(/[\\/?*[\]:]/g, " ").slice(0, 31) || "Report";

  const out: string[] = [];
  out.push(`<row r="1" ht="22" customHeight="1">${inlineStr("A1", sheet.title, S.title)}</row>`);
  if (sheet.subtitle) out.push(`<row r="2">${inlineStr("A2", sheet.subtitle, S.subtitle)}</row>`);
  out.push(
    `<row r="${HEADER_ROW}" ht="20" customHeight="1">${columns
      .map((c, i) => inlineStr(`${colName(i)}${HEADER_ROW}`, c.label, S.header))
      .join("")}</row>`,
  );
  rows.forEach((r, ri) => {
    const rn = HEADER_ROW + 1 + ri;
    out.push(
      `<row r="${rn}">${columns
        .map((c, ci) => cell(`${colName(ci)}${rn}`, r[c.key], c.type ?? "text", tzMin))
        .join("")}</row>`,
    );
  });

  const cols = columns
    .map((c, i) => `<col min="${i + 1}" max="${i + 1}" width="${columnWidth(c, rows)}" customWidth="1"/>`)
    .join("");
  const filterRef = `A${HEADER_ROW}:${lastCol}${Math.max(lastRow, HEADER_ROW)}`;

  const sheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<dimension ref="A1:${lastCol}${Math.max(lastRow, HEADER_ROW)}"/>
<sheetViews><sheetView workbookViewId="0" tabSelected="1"><pane ySplit="${HEADER_ROW}" topLeftCell="A${HEADER_ROW + 1}" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A${HEADER_ROW + 1}" sqref="A${HEADER_ROW + 1}"/></sheetView></sheetViews>
<sheetFormatPr defaultRowHeight="15"/>
${cols ? `<cols>${cols}</cols>` : ""}
<sheetData>${out.join("")}</sheetData>
${columns.length ? `<autoFilter ref="${filterRef}"/>` : ""}
<pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.3" footer="0.3"/>
<pageSetup orientation="landscape" fitToWidth="1" fitToHeight="0"/>
</worksheet>`;

  const quoted = `'${sheetName.replace(/'/g, "''")}'`;
  const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<bookViews><workbookView/></bookViews>
<sheets><sheet name="${esc(sheetName)}" sheetId="1" r:id="rId1"/></sheets>
${columns.length ? `<definedNames><definedName name="_xlnm._FilterDatabase" localSheetId="0" hidden="1">${esc(quoted)}!$A$${HEADER_ROW}:$${lastCol}$${Math.max(lastRow, HEADER_ROW)}</definedName></definedNames>` : ""}
</workbook>`;

  const files: Record<string, Uint8Array> = {
    "[Content_Types].xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`),
    "_rels/.rels": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`),
    "docProps/core.xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
<dc:title>${esc(sheet.title)}</dc:title>
<dc:creator>Lotus Pharmacies Chat System</dc:creator>
<dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString().replace(/\.\d+Z$/, "Z")}</dcterms:created>
</cp:coreProperties>`),
    "docProps/app.xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Lotus Pharmacies Chat System</Application></Properties>`),
    "xl/_rels/workbook.xml.rels": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`),
    "xl/workbook.xml": strToU8(workbookXml),
    "xl/styles.xml": strToU8(STYLES),
    "xl/worksheets/sheet1.xml": strToU8(sheetXml),
  };
  return zipSync(files, { level: 6 });
}

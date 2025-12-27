
import {
  Document,
  Packer,
  Paragraph,
  Table,
  TableRow,
  TableCell,
  TextRun,
  AlignmentType,
  WidthType,
  BorderStyle,
  ImageRun,
  ShadingType,
} from "docx";
import { saveAs } from "file-saver";

export async function generateSalarySlipDoc(data: {
  companyName: string;
  payslipNo: string;
  employeeName: string;
  employeeId: string;
  designation: string;
  payPeriod: string;
  totalHours: number;
  baseSalary: number;
  pf: number;
  esi: number;
  netPay: number;
  logoUrl: string;       // company logo
  signatureUrl: string;  // signature image
}) {
  const border = {
    top: { style: BorderStyle.SINGLE, size: 1 },
    bottom: { style: BorderStyle.SINGLE, size: 1 },
    left: { style: BorderStyle.SINGLE, size: 1 },
    right: { style: BorderStyle.SINGLE, size: 1 },
  };

  const fetchImage = async (url: string) =>
    fetch(url).then(res => res.arrayBuffer());

  const logo = await fetchImage(data.logoUrl);
  const sign = await fetchImage(data.signatureUrl);

  const doc = new Document({
    sections: [
      {
        properties: {
          background: {
            color: "1F2933", // dark watermark background
          },
        },
        children: [
          // ===== LOGO =====
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new ImageRun({
                data: logo,
                transformation: { width: 120, height: 60 },
              }),
            ],
          }),

          // ===== COMPANY NAME =====
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: data.companyName,
                bold: true,
                size: 28,
                color: "FFFFFF",
              }),
            ],
          }),

          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
            children: [
              new TextRun({
                text: "SALARY SLIP",
                bold: true,
                size: 24,
                color: "E5E7EB",
              }),
            ],
          }),

          // ===== SLIP META =====
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [
              new TextRun({
                text: `Payslip No: ${data.payslipNo}`,
                color: "D1D5DB",
              }),
            ],
          }),

          // ===== EMPLOYEE INFO =====
          infoTable(border, data),

          new Paragraph({ text: "", spacing: { after: 300 } }),

          // ===== SALARY TABLE =====
          salaryTable(border, data),

          new Paragraph({ text: "", spacing: { before: 400 } }),

          // ===== SIGNATURE =====
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [
              new ImageRun({
                data: sign,
                transformation: { width: 100, height: 50 },
              }),
              new TextRun({
                text: "\nAuthorized Signature",
                color: "E5E7EB",
              }),
            ],
          }),

          // ===== FOOTER =====
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 300 },
            children: [
              new TextRun({
                text: "This is a system generated payslip and does not require a physical signature.",
                color: "9CA3AF",
                italics: true,
              }),
            ],
          }),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `Salary_Slip_${data.employeeId}_${data.payPeriod}.docx`);
}

/* ================= HELPERS ================= */

function infoTable(border: any, d: any) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      row("Employee Name", d.employeeName, "Employee ID", d.employeeId, border),
      row("Designation", d.designation, "Pay Period", d.payPeriod, border),
      row("Total Hours", d.totalHours.toString(), "", "", border),
    ],
  });
}

function salaryTable(border: any, d: any) {
  const deductions = d.pf + d.esi;

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      header(border),
      salaryRow("Basic Salary", d.baseSalary, "PF", d.pf, border),
      salaryRow("", "", "ESI", d.esi, border),
      total(border, "NET PAY", d.netPay),
    ],
  });
}

function header(border: any) {
  return new TableRow({
    children: [
      darkCell("EARNINGS", border),
      darkCell("AMOUNT (₹)", border),
      darkCell("DEDUCTIONS", border),
      darkCell("AMOUNT (₹)", border),
    ],
  });
}

function salaryRow(e: string, ea: any, d: string, da: any, border: any) {
  return new TableRow({
    children: [
      cell(e || "-", border),
      cell(ea ? `₹${ea}` : "-", border),
      cell(d || "-", border),
      cell(da ? `₹${da}` : "-", border),
    ],
  });
}

function total(border: any, label: string, val: number) {
  return new TableRow({
    children: [
      darkCell(label, border, 3),
      darkCell(`₹${val}`, border),
    ],
  });
}

function row(l1: string, v1: string, l2: string, v2: string, border: any) {
  return new TableRow({
    children: [
      cell(`${l1}: ${v1}`, border),
      cell(`${l2 ? `${l2}: ${v2}` : ""}`, border),
    ],
  });
}

function cell(text: string, border: any) {
  return new TableCell({
    borders: border,
    children: [new Paragraph({ text })],
  });
}

function darkCell(text: string, border: any, span = 1) {
  return new TableCell({
    columnSpan: span,
    borders: border,
    shading: { type: ShadingType.SOLID, fill: "111827" },
    children: [
      new Paragraph({
        children: [
          new TextRun({
            text,
            bold: true,
            color: "FFFFFF",
          }),
        ],
      }),
    ],
  });
}

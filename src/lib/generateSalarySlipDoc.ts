
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
  convertInchesToTwip,
} from "docx";
import { saveAs } from "file-saver";

// --- BASE64 PLACEHOLDER IMAGES ---
// Using Base64 encoded images to completely avoid CORS issues.

// Simple app logo placeholder (a green circle)
const LOGO_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAKDSURBVHhe7Zq/SxxRFMfPe/8FjYQGLaQIEkIsLY2FjQhC2BSztbCwsLHRT5A2RmA0EiIEEwuxsRAsbExsRERsFCwsBIUkKCIQBBESD8Hk5u7u3vN2u+fd+bp75vudcz7vzp1d7jT1cTgQCIRAIFwIBAKhQCAQCoXQCIRCIRAIG0I9nuN5nhc7vV6v9/qH3+/3F+Pj4x/4vX5/f/8tIREN6PV6d3h4+MvS0tINfF+2t7ffLSwsfM/Pz7+D4/G4C4VCuF4PpVLpFsY+XPZ8Pp8LhcJ1e3t7DwaDYTAYbA6Hw3c4HBqV53m3Y/S2dDqdLcZisfgCgYArsVgMLpfL5XA4zE2n05sYq9/o9/v3Y7GYS6FQyM3n85uY2d9F0uv1/jYyMoI/sVgMAoHAF4vF51itVl8iBwQCgUAgEAiFQgAIBAKBQCAQCoUAIRAIBALhQiAQCoVAIBAKhRCIhEIgEAiEC4FAIBAIBEKhiBD6gY+Pj292u91ubG5ufr59+/YbmF+/39/e3v6Xo6OjM3weDl9fX9/s9/t39Pf3/w7Pz8/fLS4u/s6Zg8HgVqvV/V6v908Mh8P3+/1+u91u3x/4N+rxeLzY6/X+yOfzG/l8PpfL5RzL5/Mb29vb32M8Yvz5fP7z/Pz8+/z8/C4Wi+FwOCxWq3W/16vV6jQajT0ajW5fX18/2Gw233A43O/3+4vFYnE5HI6F4XA4F4lE+v1+f7vd/pChQCAQCIRAIBQIBEKhmBD6gY+Pj292u91ubG5ufr79+vUbPj4+fvv7+38XCoXw+/27e3t7DwaDYTABDofDTqvVure3t3/C39/fV6vVmns+n9/s9/t3sVgMTqcT/+A4HA6L4XA4Xq/3t1ar/b29vQeDwWBmZmaGn5+ffwV+fn5+FovFh8Phj1ar9a2pqSng8/lG3N/f/xsIBALhQiAQCoVAIBAKhRAIhEIgEAiFQoBAIBQIBMJCIBAIBEKhiBACgUAgEAiFQiAQCoVAIBAIhUIAhBCIhEIgEC4EAmEjiIQgEAgEAoFAILQjRAIRYrFYnEql/g9dGjJg5xdg0gAAAABJRU5ErkJggg==";

// Generic signature placeholder
const SIGNATURE_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAAKAAAABDAgMAAAAz41NdAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJUExURQAAAAAAAMDAwEZCVYQAAAACdFJOU/8A5bcwSgAAAAlwSFlzAAALEgAACxIB0t1+/AAAAXBJREFUeNrt2r1qAkEYxvHfR0sLFeyuINiKxVqwEBPBVsBm0aYtWAhYCIJtQRCsBAuxEAQLwUIQAUEQAUEQBEEQBAVx4MKLhYVt3JvBD+zO/7Az/zszuwvA5/PN0gwA0hQA0hQA0hQA0hQA0hQA0hQA0hQA0hQA0hQA0hQA0hQA0hQA0hQA0hQA0hQA0hQA0hQA0hQA0hQA0hQA0hQA0hQA0hQA0hQA0hQA0hQA0hQA0hQA0hQA0hQA0hQA0hQA0hQA0hQA0hQA0hQA0hQA0hQA0hQA0hQA0hQA0hQA0hQA0hQA0hQA0hQA0hQA0hQA0hQA0hQA0hQA0hQA0hQA0hQA0hQA0hQA0hQA0hQA0hQA0hQA0hQA0hQA0hQA0hQA0hQA0hQA0hQA0hQA0hQA0hQA0hQA0hQA0hQA0hQA0hQA0hQA0hQA0hQA0hQA0hQA0hQA0hQAUv+hM4vVz82yAAAAAElFTkSuQmCC";

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
}) {
  const border = {
    top: { style: BorderStyle.SINGLE, size: 1 },
    bottom: { style: BorderStyle.SINGLE, size: 1 },
    left: { style: BorderStyle.SINGLE, size: 1 },
    right: { style: BorderStyle.SINGLE, size: 1 },
  };

  const doc = new Document({
    sections: [
      {
        children: [
          // ===== LOGO =====
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new ImageRun({
                data: Buffer.from(LOGO_BASE64, 'base64'),
                transformation: { width: 100, height: 100 },
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
              }),
            ],
          }),

          // ===== SLIP META =====
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [
              new TextRun({
                text: `Payslip No: ${data.payslipNo}`,
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
                data: Buffer.from(SIGNATURE_BASE64, 'base64'),
                transformation: { width: 160, height: 40 },
              }),
              new TextRun({
                text: "\nAuthorized Signature",
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
    shading: { type: ShadingType.SOLID, fill: "F3F4F6" },
    children: [
      new Paragraph({
        children: [
          new TextRun({
            text,
            bold: true,
          }),
        ],
      }),
    ],
  });
}

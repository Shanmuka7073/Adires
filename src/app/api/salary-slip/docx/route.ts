
import { NextResponse } from 'next/server';
import { Document, Packer, Paragraph, TextRun } from 'docx';

export async function POST(req: Request) {
  const data = await req.json();

  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            children: [
              new TextRun({ text: 'SALARY SLIP', bold: true, size: 32 }),
            ],
          }),
          new Paragraph(''),
          new Paragraph(`Employee: ${data.employeeName}`),
          new Paragraph(`Employee ID: ${data.employeeId}`),
          new Paragraph(`Period: ${data.period}`),
          new Paragraph(''),
          new Paragraph(`Total Hours: ${data.totalHours}`),
          new Paragraph(`Base Salary: ₹${data.baseSalary}`),
          new Paragraph(`Net Pay: ₹${data.netPay}`),
        ],
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);

  return new NextResponse(buffer, {
    headers: {
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename=salary-slip-${data.period}.docx`,
    },
  });
}

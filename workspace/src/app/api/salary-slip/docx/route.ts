import { NextRequest, NextResponse } from "next/server";
import { getAdminServices } from "@/firebase/admin-init";
import { Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun, AlignmentType, WidthType, BorderStyle, ImageRun, ShadingType } from "docx";
import { format } from "date-fns";

// Base64 assets moved to server-only logic
const LOGO_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAKDSURBVHhe7Zq/SxxRFMfPe/8FjYQGLaQIEkIsLY2FjQhC2BSztbCwsLHRT5A2RmA0EiIEEwuxsRAsbExsRERsFCwsBIUkKCIQBBESD8Hk5u7u3vN2u+fd+bp75vudcz7vzp1d7jT1cTgQCIRAIFwIBAKhQCAQCoXQCIRCIRAIG0I9nuN5nhc7vV6v9/qH3+/3F+Pj4x/4vX5/f/8tIREN6PV6d3h4+MvS0tINfF+2t7ffLSwsfM/Pz7+D4/G4C4VCuF4PpVLpFsY+XPZ8Pp8LhcJ1e3t7DwaDYTAYbA6Hw3c4HBqV53m3Y/S2dDqdLcZisfgCgYArsVgMLpfL5XA4zE2n05sYq9/o9/v3Y7GYS6FQyM3n85uY2d9F0uv1/jYyMoI/sVgMAoHAF4vF51itVl8iBwQCgUAgEAiFQgAIBAKBQCAQCoUAIRAIBALhQiAQCoVAIBAKhRCIhEIgEAiEC4FAIBAIBEKhiBD6gY+Pj292u91ubG5ufr59+/YbmF+/39/e3v6Xo6OjM3weDl9fX9/s9/t39Pf3/w7Pz8/fLS4u/s6Zg8HgVqvV/V6v908Mh8P3+/1+u91u3x/4N+rxeLzY6/X+yOfzG/l8PpfL5RzL5/Mb29vb32M8Yvz5fP7z/Pz8+/z8/C4Wi+FwOCxWq3W/16vV6jQajT0ajW5fX18/2Gw233A43O/3+4vFYnE5HI6F4XA4F4lE+v1+f7vd/pChQCAQCIRAIBQIBEKhmBD6gY+Pj292u91ubG5ufr79+vUbPj4+fvv7+38XCoXw+/27e3t7DwaDYTABDofDTqvVure3t3/C39/fV6vVmns+n9/s9/t3sVgMTqcT/+A4HA6L4XA4Xq/3t1ar/b29vQeDwWBmZmaGn5+ffwV+fn5+FovFh8Phj1ar9a2pqSng8/lG3N/f/xsIBALhQiAQCoVAIBAKhRAIhEIgEAiFQoBAIBQIBMJCIBAIBEKhiBACgUAgEAiFQiAQCoVAIBAIhUIAhBCIhEIgEC4EAmEjiIQgEAgEAoFAILQjRAIRYrFYnEql/g9dGjJg5xdg0gAAAABJRU5ErkJggg==";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const slipId = searchParams.get("slipId");
  const storeId = searchParams.get("storeId");

  if (!slipId || !storeId) {
    return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
  }

  try {
    const { db } = await getAdminServices();
    const slipDoc = await db.collection("stores").doc(storeId).collection("salarySlips").doc(slipId).get();
    
    if (!slipDoc.exists) {
      return NextResponse.json({ error: "Slip not found" }, { status: 404 });
    }

    const slip = slipDoc.data()!;
    const empDoc = await db.collection("users").doc(slip.employeeId).get();
    const empProfileDoc = await db.collection("employeeProfiles").doc(slip.employeeId).get();
    const storeDoc = await db.collection("stores").doc(storeId).get();

    const empData = empDoc.data()!;
    const profileData = empProfileDoc.data()!;
    const storeData = storeDoc.data()!;

    const doc = new Document({
      sections: [{
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new ImageRun({ data: Buffer.from(LOGO_BASE64, 'base64'), transformation: { width: 80, height: 80 } })],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: storeData.name, bold: true, size: 28 })],
          }),
          new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "SALARY SLIP", bold: true, size: 24 })] }),
          new Paragraph({ text: `Payslip No: PSL-${slipId.slice(0, 8)}`, alignment: AlignmentType.RIGHT }),
          new Paragraph({ text: `Employee: ${empData.firstName} ${empData.lastName}` }),
          new Paragraph({ text: `Designation: ${profileData.role}` }),
          new Paragraph({ text: `Period: ${format(new Date(slip.periodStart), 'MMMM yyyy')}` }),
          new Paragraph({ text: `Net Pay: ₹${slip.netPay.toFixed(2)}`, spacing: { before: 200 } }),
        ],
      }],
    });

    const buffer = await Packer.toBuffer(doc);

    // Convert Buffer to Uint8Array to satisfy BodyInit type requirements in Next.js environment
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename=Salary_Slip_${slipId}.docx`,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

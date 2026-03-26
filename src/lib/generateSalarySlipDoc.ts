
/**
 * @fileOverview This utility has been moved to the Server API Route to reduce client bundle weight.
 * Refer to src/app/api/salary-slip/docx/route.ts for the implementation.
 * Client-side generation is no longer supported.
 */
export async function generateSalarySlipDoc(data: any) {
    console.error("Client-side generation decommissioned. Use API route.");
    window.open(`/api/salary-slip/docx?slipId=${data.slipId}&storeId=${data.storeId}`, '_blank');
}

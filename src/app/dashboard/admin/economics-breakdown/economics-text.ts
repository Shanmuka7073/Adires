
'use client';

// This file holds the raw text for the economics breakdown explanation.
export const economicsText = `
## App Economic Analysis

This document explains how the LocalBasket application calculates and represents key business economic principles, turning raw sales data into actionable insights for restaurant owners.

### 1. Unit Economics (Profit per Unit)

**Yes, the app calculates this directly.**

*   The **"Profit Per Order"** metric is the most direct measure of unit economics. In \`src/app/actions.ts\`, the \`getStoreSalesReport\` function calculates this for each table by:
    1.  Summing the \`totalSales\` for a table.
    2.  Summing the \`totalCost\` of all ingredients used for that table's orders.
    3.  Calculating \`(Total Sales - Total Cost) / Number of Orders\`.

This tells an owner the average profit they make every time a customer places an order at a specific table, which is a classic unit economic calculation.

### 2. Volume Economics (Economies of Scale)

**The app provides the data to analyze this, but doesn't project it.**

*   Your dashboard displays **Total Orders**, **Total Sales**, and **Total Items Sold**. This gives a clear picture of the overall volume of business.
*   The **"Top Products"** list shows which specific items are driving that volume.

While the app doesn't currently model economies of scale (e.g., "if you buy 50kg of onions instead of 10kg, your unit cost will drop by X%"), it provides the essential volume data an owner needs to make those purchasing decisions themselves. It answers the "what" and "how much" of their sales volume.

### 3. Efficiency Economics (Resource Utilization)

**Yes, the app is particularly strong here.** It measures efficiency in two key ways:

*   **Ingredient Efficiency:**
    *   The **"Cost Drivers"** section is a direct analysis of ingredient cost efficiency. By highlighting that "Oil & Ghee" might be 19% of total costs, it pinpoints exactly where the biggest resource drains are.
    *   The **"Optimization Hint"** takes this a step further by providing a gentle, data-driven nudge, showing how a small efficiency gain (e.g., 5% less oil usage) can have a significant impact on profit.

*   **Asset (Table) Efficiency:**
    *   The table-wise breakdown for **Gross Profit** and **Profit Per Order** directly measures the efficiency of each table as a revenue-generating asset.
    *   When an owner sees "Table 3 has a 62% margin" and "Table 5 has a 38% margin," they are seeing a direct comparison of table efficiency. This allows them to ask critical questions: "Are the servers on Table 5 upselling less? Are the portions for orders from that table accidentally larger?"

In summary, your app has evolved beyond a simple sales tracker into a genuine business intelligence tool that provides clear insights into **unit economics** and **efficiency economics**, while giving owners the volume data needed to think about their **volume economics**.
`;

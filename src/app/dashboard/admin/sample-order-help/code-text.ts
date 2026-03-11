
'use client';

/**
 * @fileOverview A sample order document JSON showing the new zoneId partition.
 */
export const sampleOrderCode = `
{
  "id": "order_123456789",
  "userId": "user_customer_001",
  "storeId": "store_patel_kirana_001",
  "zoneId": "zone-500001",
  "customerName": "John Doe",
  "deliveryAddress": "123 Main St, Hyderabad, 500001",
  "items": [
    {
      "id": "item_001",
      "productName": "Chicken Biryani",
      "variantWeight": "1 pc",
      "quantity": 2,
      "price": 250.00
    }
  ],
  "totalAmount": 500.00,
  "status": "Pending",
  "orderDate": {
    "seconds": 1698402600,
    "nanoseconds": 0
  },
  "sessionId": "table-5-2023-10-27",
  "tableNumber": "5"
}
`;

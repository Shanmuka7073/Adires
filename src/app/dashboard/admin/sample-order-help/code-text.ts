
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
      "productName": "Potatoes",
      "variantWeight": "1kg",
      "quantity": 2,
      "price": 45.00
    }
  ],
  "totalAmount": 120.00,
  "status": "Pending",
  "orderDate": {
    "seconds": 1698402600,
    "nanoseconds": 0
  }
}
`;

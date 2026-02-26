
'use client';

/**
 * @fileOverview A sample order document JSON string for the admin dashboard.
 */
export const sampleOrderCode = `
{
  "id": "order_123456789",
  "userId": "user_customer_001",
  "storeId": "store_patel_kirana_001",
  "customerName": "John Doe",
  "deliveryAddress": "123 Main St, Apartment 4B, Mumbai, 400001",
  "deliveryLat": 19.0760,
  "deliveryLng": 72.8777,
  "items": [
    {
      "id": "item_uuid_001",
      "orderId": "order_123456789",
      "productId": "prod-potatoes",
      "productName": "Potatoes",
      "variantSku": "potatoes-1kg-0",
      "variantWeight": "1kg",
      "quantity": 2,
      "price": 45.00
    },
    {
      "id": "item_uuid_002",
      "orderId": "order_123456789",
      "productId": "prod-onions",
      "productName": "Onions",
      "variantSku": "onions-500gm-0",
      "variantWeight": "500gm",
      "quantity": 1,
      "price": 30.00
    }
  ],
  "totalAmount": 150.00,
  "status": "Pending",
  "orderDate": {
    "seconds": 1698402600,
    "nanoseconds": 0
  },
  "phone": "9876543210",
  "email": "john.doe@example.com",
  "deliveryPartnerId": null,
  "tableNumber": null,
  "sessionId": "session_table_5_20231027",
  "updatedAt": {
    "seconds": 1698402605,
    "nanoseconds": 0
  }
}
`;

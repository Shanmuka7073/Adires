
'use client';

export const deliveryPartnerSchemaCode = [
    {
        path: 'Firestore Path: /deliveryPartners/{partnerId}',
        content: `
{
  "entityName": "DeliveryPartner",
  "description": "Stores earnings, payout info, and service area for partners.",
  "schema": {
    "title": "DeliveryPartner",
    "type": "object",
    "properties": {
      "userId": { "type": "string" },
      "totalEarnings": { "type": "number" },
      "payoutsEnabled": { "type": "boolean" },
      "payoutMethod": { "type": "string", "enum": ["bank", "upi"] },
      "zoneId": {
        "type": "string",
        "description": "The service zone (e.g. 'zone-500001') used to filter available jobs."
      },
      "bankDetails": {
        "type": "object",
        "properties": {
          "accountHolderName": { "type": "string" },
          "accountNumber": { "type": "string" },
          "ifscCode": { "type": "string" }
        }
      },
      "upiId": { "type": "string" }
    },
    "required": ["userId", "totalEarnings", "payoutsEnabled"]
  }
}
`,
    },
];

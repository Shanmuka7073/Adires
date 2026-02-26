
'use client';

export const deliveryPartnerSchemaCode = [
    {
        path: 'Firestore Path: /deliveryPartners/{partnerId}',
        content: `
{
  "entityName": "DeliveryPartner",
  "description": "Stores earnings and payout information for delivery partners. The document ID is the partner's user ID.",
  "schema": {
    "title": "DeliveryPartner",
    "type": "object",
    "properties": {
      "userId": {
        "type": "string",
        "description": "The UID of the user who is the delivery partner. This is the document ID."
      },
      "totalEarnings": {
        "type": "number",
        "description": "The total accumulated earnings since the last payout."
      },
      "lastPayoutDate": {
        "type": "string",
        "format": "date-time",
        "description": "The date of the last successful payout."
      },
      "payoutsEnabled": {
        "type": "boolean",
        "description": "Whether the partner is eligible for payouts."
      },
      "payoutMethod": {
        "type": "string",
        "enum": ["bank", "upi"],
        "description": "The preferred method for receiving payouts."
      },
      "upiId": {
        "type": "string",
        "description": "The partner's UPI ID for payments."
      },
      "bankDetails": {
        "type": "object",
        "description": "The partner's bank account details.",
        "properties": {
          "accountHolderName": { "type": "string" },
          "accountNumber": { "type": "string" },
          "ifscCode": { "type": "string" }
        }
      }
    },
    "required": ["userId", "totalEarnings", "payoutsEnabled"]
  }
}
`,
    },
];

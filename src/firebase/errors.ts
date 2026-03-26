
'use client';
import { getAuth } from 'firebase/auth';

export type SecurityRuleContext = {
  path: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete' | 'write';
  requestResourceData?: any;
};

interface SecurityRuleRequest {
  auth: {
    uid: string;
    token: {
        email: string | null;
        email_verified: boolean;
    }
  } | null;
  method: string;
  path: string;
  resource?: {
    data: any;
  };
}

/**
 * Builds the complete, simulated request object for the error message.
 */
function buildRequestObject(context: SecurityRuleContext): SecurityRuleRequest {
  let authData = null;
  
  // Safe client-side auth check
  if (typeof window !== 'undefined') {
      try {
          const auth = getAuth();
          if (auth.currentUser) {
              authData = {
                  uid: auth.currentUser.uid,
                  token: {
                      email: auth.currentUser.email,
                      email_verified: auth.currentUser.emailVerified
                  }
              };
          }
      } catch (e) {}
  }

  return {
    auth: authData,
    method: context.operation,
    path: `/databases/(default)/documents/${context.path}`,
    resource: context.requestResourceData ? { data: context.requestResourceData } : undefined,
  };
}

/**
 * Builds the final, formatted error message.
 */
function buildErrorMessage(requestObject: SecurityRuleRequest): string {
  return `FirestoreError: Missing or insufficient permissions: The following request was denied by Firestore Security Rules:
${JSON.stringify(requestObject, null, 2)}`;
}

/**
 * A custom error class designed to surface security rule issues contextually.
 */
export class FirestorePermissionError extends Error {
  public readonly request: SecurityRuleRequest;

  constructor(context: SecurityRuleContext) {
    const requestObject = buildRequestObject(context);
    super(buildErrorMessage(requestObject));
    this.name = 'FirebaseError';
    this.request = requestObject;
  }
}

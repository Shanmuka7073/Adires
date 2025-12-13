// This file will now dynamically fetch the config, so hardcoded values are removed.
import { getFirebaseConfig } from '@/app/actions';

// This function is now async to fetch the config from the server.
export async function getClientFirebaseConfig() {
  const config = await getFirebaseConfig();
  if (!config) {
    throw new Error("Could not fetch Firebase configuration from the server.");
  }
  return config;
}

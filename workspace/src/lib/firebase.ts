
import { getAdminServices } from '@/firebase/admin-init';

const { db } = await getAdminServices();

export { db };

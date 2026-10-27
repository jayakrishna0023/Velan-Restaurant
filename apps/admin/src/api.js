import { createApi } from '@velan/shared/api.js';

// The admin console keeps its own login, separate from the customer site and rider app.
export const api = createApi('velan.admin.token');

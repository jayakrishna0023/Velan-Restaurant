import { createApi } from '@velan/shared/api.js';

// The rider's own login (separate from the customer and admin logins on the same phone).
export const api = createApi('velan.rider.token');

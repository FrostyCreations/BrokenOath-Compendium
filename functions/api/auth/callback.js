import { adapt } from '../../../lib/adapt.js';
import handler from '../../../lib/auth.js';
// Discord sends people back to /api/auth/callback
export const onRequest = adapt(handler, { a: 'cb' });

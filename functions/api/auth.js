import { adapt } from '../../lib/adapt.js';
import handler from '../../lib/auth.js';
export const onRequest = adapt(handler);

import { adapt } from '../../lib/adapt.js';
import handler from '../../lib/s.js';
export const onRequest = adapt(handler);

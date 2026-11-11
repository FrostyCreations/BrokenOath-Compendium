import { adapt } from '../../lib/adapt.js';
import handler from '../../lib/bo.js';
export const onRequest = adapt(handler);

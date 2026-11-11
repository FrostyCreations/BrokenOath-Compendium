import { adapt } from '../../lib/adapt.js';
import handler from '../../lib/filters.js';
export const onRequest = adapt(handler);

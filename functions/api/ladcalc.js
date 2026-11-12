import { adapt } from '../../lib/adapt.js';
import handler from '../../lib/ladcalc.js';
export const onRequest = adapt(handler);

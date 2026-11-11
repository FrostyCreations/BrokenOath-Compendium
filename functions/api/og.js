import { adapt } from '../../lib/adapt.js';
import handler from '../../lib/og.js';
export const onRequest = adapt(handler);

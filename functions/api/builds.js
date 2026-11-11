import { adapt } from '../../lib/adapt.js';
import handler from '../../lib/builds.js';
export const onRequest = adapt(handler);

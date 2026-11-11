import { adapt } from '../../lib/adapt.js';
import handler from '../../lib/pb.js';
export const onRequest = adapt(handler);

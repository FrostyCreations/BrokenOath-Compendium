import { adapt } from '../../lib/adapt.js';
import handler from '../../lib/b.js';
// short build links: /b/<id>
export const onRequest = adapt(handler);

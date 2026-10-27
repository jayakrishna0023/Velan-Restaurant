// Services announce changes here; the real-time layer forwards them to the
// right Socket.IO rooms. Keeps the services free of transport concerns.
import { EventEmitter } from 'node:events';

export const bus = new EventEmitter();
bus.setMaxListeners(50);

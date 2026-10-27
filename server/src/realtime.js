// Socket.IO: pushes every change to the people who should see it.
// Rooms: 'admin' (all staff screens), 'user:<id>' (one customer or rider).
import { Server } from 'socket.io';
import { bus } from './lib/bus.js';
import { db } from './db/database.js';
import { userForToken } from './services/auth.js';
import { viewOrder } from './services/orders.js';
import { updateLocation } from './services/riders.js';

export function attachRealtime(httpServer) {
  const io = new Server(httpServer, { cors: { origin: true }, pingInterval: 20_000 });
  const connected = new Map(); // riderId -> open socket count

  io.use((socket, next) => {
    socket.data.user = userForToken(socket.handshake.auth?.token) || null;
    next();
  });

  io.on('connection', (socket) => {
    const u = socket.data.user;
    if (!u) return;
    socket.join(`user:${u.id}`);
    if (u.role === 'admin') {
      socket.join('admin');
      socket.emit('rider:presence', Object.fromEntries(connected));
    }
    if (u.role === 'rider') {
      connected.set(u.id, (connected.get(u.id) || 0) + 1);
      io.to('admin').emit('rider:presence', { [u.id]: connected.get(u.id) });
      socket.on('disconnect', () => {
        const n = (connected.get(u.id) || 1) - 1;
        if (n <= 0) connected.delete(u.id); else connected.set(u.id, n);
        io.to('admin').emit('rider:presence', { [u.id]: Math.max(0, n) });
      });
      socket.on('rider:location', (loc) => {
        if (!db.users.get(u.id)?.active) return;
        const point = updateLocation(u, loc);
        if (!point) return;
        const payload = { riderId: u.id, ...point };
        io.to('admin').emit('rider:location', payload);
        for (const o of db.orders.find("riderId = ? AND status = 'out_for_delivery'", [u.id])) {
          if (o.customerId) io.to(`user:${o.customerId}`).emit('rider:location', { ...payload, orderId: o.id });
        }
      });
    }
  });

  bus.on('order', (o, { prevRiderId } = {}) => {
    io.to('admin').emit('order:update', viewOrder(o, { role: 'admin' }));
    if (o.customerId) io.to(`user:${o.customerId}`).emit('order:update', viewOrder(o, { role: 'customer' }));
    if (o.riderId) io.to(`user:${o.riderId}`).emit('order:update', viewOrder(o, { role: 'rider' }));
    if (prevRiderId && prevRiderId !== o.riderId) io.to(`user:${prevRiderId}`).emit('order:removed', { id: o.id });
  });
  bus.on('menu', (payload) => io.emit('menu:update', payload));
  bus.on('settings', (s) => io.emit('settings:update', s));
  bus.on('offers', (offers) => io.emit('offers:update', offers));
  bus.on('rider', (r) => io.to('admin').emit('rider:update', r));
  bus.on('activity', (a) => io.to('admin').emit('activity', a));
  return io;
}

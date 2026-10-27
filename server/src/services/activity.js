// Audit trail shown in the admin console ("who did what, when").
import { db, newId, nowIso } from '../db/database.js';
import { bus } from '../lib/bus.js';

/**
 * @param {object|null} actor user doing the action (null = system / customer flow)
 * @param {string} kind e.g. 'order.accepted', 'menu.update'
 * @param {object} data small payload rendered by the admin app
 */
export function logActivity(actor, kind, data = {}, at = nowIso()) {
  const entry = {
    id: newId('act'),
    at,
    kind,
    actor: actor ? { id: actor.id, name: actor.name, role: actor.role } : null,
    data,
  };
  db.activity.insert(entry);
  bus.emit('activity', entry);
  return entry;
}

export function listActivity({ limit = 60, before } = {}) {
  return before
    ? db.activity.find('at < ?', [before], { order: 'at DESC', limit })
    : db.activity.find('1=1', [], { order: 'at DESC', limit });
}

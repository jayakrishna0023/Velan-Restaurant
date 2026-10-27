// One Socket.IO connection per app, re-created when the login token changes.
import { io } from 'socket.io-client';
import { useEffect, useRef, useState } from 'react';

let socket = null;
let currentToken;
const instanceListeners = new Set();
const statusListeners = new Set();

export function connect(token) {
  if (socket && currentToken === (token || null)) return socket;
  socket?.disconnect();
  currentToken = token || null;
  const apiBase = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL ? import.meta.env.VITE_API_URL : '').replace(/\/$/, '') || undefined;
  socket = io(apiBase, { auth: { token: currentToken }, transports: ['websocket', 'polling'] });
  const notify = () => statusListeners.forEach((fn) => fn(socket.connected));
  socket.on('connect', notify);
  socket.on('disconnect', notify);
  instanceListeners.forEach((fn) => fn(socket));
  return socket;
}

export const getSocket = () => socket;

function useSocketInstance() {
  const [s, setS] = useState(socket);
  useEffect(() => {
    const fn = (next) => setS(next);
    instanceListeners.add(fn);
    setS(socket);
    return () => instanceListeners.delete(fn);
  }, []);
  return s;
}

/** Subscribe to a server event for the lifetime of a component. */
export function useSocketEvent(event, handler) {
  const ref = useRef(handler);
  ref.current = handler;
  const s = useSocketInstance();
  useEffect(() => {
    if (!s) return undefined;
    const fn = (...args) => ref.current(...args);
    s.on(event, fn);
    return () => s.off(event, fn);
  }, [event, s]);
}

/** Whether the live connection or network is up (shows the "reconnecting" banner only if truly offline or lost active socket). */
export function useConnected() {
  const s = useSocketInstance();
  const [ok, setOk] = useState(true);

  useEffect(() => {
    const handleOnline = () => setOk(true);
    const handleOffline = () => setOk(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    let hadSocketConnection = false;
    const onConnect = () => {
      hadSocketConnection = true;
      setOk(true);
    };
    const onDisconnect = () => {
      // If we previously had a working live socket and lost it, or browser is offline
      if (hadSocketConnection || (typeof navigator !== 'undefined' && !navigator.onLine)) {
        setOk(false);
      }
    };

    if (s) {
      s.on('connect', onConnect);
      s.on('disconnect', onDisconnect);
      if (s.connected) onConnect();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (s) {
        s.off('connect', onConnect);
        s.off('disconnect', onDisconnect);
      }
    };
  }, [s]);

  return ok;
}

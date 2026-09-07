import { io } from 'socket.io-client';

export const socket = io('/', {
  autoConnect: false
});

// Connect with the current JWT so the server can authorize workspace rooms.
// Safe to call multiple times; join-workspace is idempotent server-side.
export function connectSocket(workspaceId?: string) {
  socket.auth = { token: localStorage.getItem('token') || '' };
  if (!socket.connected) socket.connect();
  if (workspaceId) socket.emit('join-workspace', workspaceId);
}

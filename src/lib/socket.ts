import { io } from 'socket.io-client';

export const socket = io('/', {
  autoConnect: false
});

// Sunucu tarafinda odalar baglantiya baglidir: baglanti koparsa (ag degisimi,
// sunucu yeniden baslatma) yeni baglanti hicbir odada olmaz ve canli
// guncellemeler sessizce durur. Son katilinan workspace'i hatirlayip her
// (yeniden) baglanmada tekrar katiliyoruz.
let currentWorkspaceId: string | undefined;
socket.on('connect', () => {
  if (currentWorkspaceId) socket.emit('join-workspace', currentWorkspaceId);
});

// Connect with the current JWT so the server can authorize workspace rooms.
// Safe to call multiple times; join-workspace is idempotent server-side.
export function connectSocket(workspaceId?: string) {
  socket.auth = { token: localStorage.getItem('token') || '' };
  if (workspaceId) currentWorkspaceId = workspaceId;
  if (!socket.connected) socket.connect();
  else if (workspaceId) socket.emit('join-workspace', workspaceId);
}

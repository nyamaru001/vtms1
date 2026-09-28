import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

let sharedSocket = null;
let sharedToken = null;

export function useSocket() {
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('vtms_token');

    if (!token) {
      setSocket(null);
      return undefined;
    }

    if (!sharedSocket || sharedToken !== token) {
      if (sharedSocket) {
        sharedSocket.disconnect();
      }

      const newSocket = io(
        import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000',
        {
          auth: {
            token,
          },
        }
      );

      sharedSocket = newSocket;
      sharedToken = token;

      newSocket.on('connect_error', (error) => {
        console.error(
          'VTMS Socket connection error:',
          error?.message || error
        );
      });
    }

    setSocket(sharedSocket);

    return undefined;
  }, []);

  return socket;
}
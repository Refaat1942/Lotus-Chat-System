import { useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";

let sharedSocket: Socket | null = null;

function getSocket(): Socket {
  if (!sharedSocket || !sharedSocket.connected) {
    sharedSocket = io({
      path: "/api/socket.io",
      auth: {
        token: localStorage.getItem("lotus_token"),
      },
      transports: ["websocket", "polling"],
    });
  }
  return sharedSocket;
}

export function useSocket() {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const socket = getSocket();
    socketRef.current = socket;

    return () => {
      // Do not disconnect on unmount — keep the shared connection alive
    };
  }, []);

  return socketRef;
}

export function useConversationSocket(
  conversationId: number | null,
  onNewMessage: (msg: unknown) => void,
) {
  const socketRef = useSocket();

  useEffect(() => {
    if (!conversationId) return;

    const socket = socketRef.current;
    if (!socket) return;

    socket.emit("join_conversation", conversationId);

    const handleNewMessage = (msg: unknown) => {
      onNewMessage(msg);
    };

    socket.on("new_message", handleNewMessage);

    return () => {
      socket.emit("leave_conversation", conversationId);
      socket.off("new_message", handleNewMessage);
    };
  }, [conversationId, onNewMessage]);

  return socketRef;
}

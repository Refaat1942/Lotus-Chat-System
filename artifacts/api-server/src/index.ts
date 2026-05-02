import { createServer } from "http";
import { Server as IOServer } from "socket.io";
import app from "./app";
import { logger } from "./lib/logger";
import { bootstrapSeed } from "./lib/bootstrap-seed";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const httpServer = createServer(app);

const io = new IOServer(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
  path: "/api/socket.io",
});

// Store io on app so routes can access it
app.set("io", io);

io.on("connection", (socket) => {
  logger.info({ socketId: socket.id }, "Socket connected");

  socket.on("join_conversation", (conversationId: number) => {
    socket.join(`conv:${conversationId}`);
    logger.info({ socketId: socket.id, conversationId }, "Joined conversation");
  });

  socket.on("leave_conversation", (conversationId: number) => {
    socket.leave(`conv:${conversationId}`);
  });

  socket.on("typing", ({ conversationId, agentName }: { conversationId: number; agentName: string }) => {
    socket.to(`conv:${conversationId}`).emit("typing", { conversationId, agentName });
  });

  socket.on("message_status", ({ messageId, status }: { messageId: number; status: string }) => {
    io.emit("message_status", { messageId, status });
  });

  socket.on("disconnect", () => {
    logger.info({ socketId: socket.id }, "Socket disconnected");
  });
});

httpServer.listen(port, async () => {
  logger.info({ port }, "Server listening");
  await bootstrapSeed();
});

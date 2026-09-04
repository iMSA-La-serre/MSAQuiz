import type { Server } from "@razzia/common/types/game/socket"
import { runMigrations } from "@razzia/socket/db/client"
import { seedDatabase } from "@razzia/socket/db/seed"
import { gameSocketHandlers } from "@razzia/socket/handlers/game"
import { managerSocketHandlers } from "@razzia/socket/handlers/manager"
import { quizzSocketHandlers } from "@razzia/socket/handlers/quizz"
import { resultsSocketHandlers } from "@razzia/socket/handlers/results"
import { statsSocketHandlers } from "@razzia/socket/handlers/stats"
import type { SocketHandler } from "@razzia/socket/handlers/types"
import { initConfig } from "@razzia/socket/services/config"
import Registry from "@razzia/socket/services/registry"
import { Server as ServerIO } from "socket.io"

const WS_PORT = 3001

const io: Server = new ServerIO({
  path: "/ws",
  // Default is 1 MB, which would kill the connection on xlsx quiz imports.
  maxHttpBufferSize: 5e6,
})
initConfig()
runMigrations()
seedDatabase()

console.log(`Socket server running on port ${WS_PORT}`)
io.listen(WS_PORT)

const socketHandlers: SocketHandler[] = [
  managerSocketHandlers,
  quizzSocketHandlers,
  gameSocketHandlers,
  resultsSocketHandlers,
  statsSocketHandlers,
]

io.on("connection", (socket) => {
  console.log(
    `A user connected: socketId: ${socket.id}, clientId: ${socket.handshake.auth.clientId}`,
  )

  socketHandlers.forEach((handler) => {
    handler({ io, socket })
  })
})

process.on("SIGINT", () => {
  Registry.getInstance().cleanup()
  process.exit(0)
})

process.on("SIGTERM", () => {
  Registry.getInstance().cleanup()
  process.exit(0)
})

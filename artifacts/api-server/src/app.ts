import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import path from "path";
import fs from "fs";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

// In production, serve the built lotus-crm SPA from the same process so the
// deployment exposes a single port. The build copies dist/public into the
// api-server's working tree at deploy time via the build pipeline.
const spaDir = path.resolve(process.cwd(), "artifacts/lotus-crm/dist/public");
if (fs.existsSync(spaDir)) {
  app.use(express.static(spaDir));
  app.get(/^\/(?!api\/).*/, (_req, res) => {
    res.sendFile(path.join(spaDir, "index.html"));
  });
}

export default app;

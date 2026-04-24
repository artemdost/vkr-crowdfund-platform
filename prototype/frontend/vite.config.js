import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import fs from "fs";
import path from "path";

// Serve deployed/addresses.json from parent directory
function serveDeployed() {
  return {
    name: "serve-deployed",
    configureServer(server) {
      server.middlewares.use("/deployed", (req, res, next) => {
        const relative = (req.url || "").replace(/^\/+/, "");
        const filePath = path.resolve(__dirname, "..", "deployed", relative);
        if (fs.existsSync(filePath)) {
          res.setHeader("Content-Type", "application/json");
          res.end(fs.readFileSync(filePath, "utf-8"));
        } else {
          next();
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), serveDeployed()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
        secure: false,
      },
    },
  },
});

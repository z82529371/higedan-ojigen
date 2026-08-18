import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

import fs from "node:fs";
import path from "node:path";

export default defineConfig({
  base: "./",
  server: {
    watch: {
      ignored: ["**/public/data/**"],
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    {
      name: "save-song-data-api",
      configureServer(server) {
        server.middlewares.use("/api/save-song-data", (req, res) => {
          if (req.method === "POST") {
            let body = "";
            req.on("data", (chunk) => {
              body += chunk;
            });
            req.on("end", () => {
              try {
                const { songId, lyrics, lockedLines } = JSON.parse(body);
                if (!songId || !Array.isArray(lyrics)) {
                  res.statusCode = 400;
                  res.end(JSON.stringify({ error: "Invalid payload" }));
                  return;
                }
                const filePath = path.resolve(__dirname, `public/data/${songId}.json`);
                if (!fs.existsSync(filePath)) {
                  res.statusCode = 444;
                  res.end(JSON.stringify({ error: "File not found" }));
                  return;
                }
                const content = JSON.parse(fs.readFileSync(filePath, "utf-8"));
                content.lyrics = lyrics;
                if (Array.isArray(lockedLines)) {
                  content.lockedLines = lockedLines;
                }
                fs.writeFileSync(filePath, JSON.stringify(content, null, 2), "utf-8");
                res.statusCode = 200;
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ success: true }));
              } catch (err) {
                res.statusCode = 500;
                res.end(JSON.stringify({ error: String(err) }));
              }
            });
          } else {
            res.statusCode = 405;
            res.end();
          }
        });
      },
    },
  ],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
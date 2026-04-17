/**
 * Custom Next.js Server for Render
 *
 * Runs Next.js as a persistent Node.js server (not serverless).
 * Includes node-cron for scheduled agent tasks — no external cron service needed.
 *
 * Schedules:
 *   - Daily 8:00 AM CT (14:00 UTC): Execute all due tasks
 *   - Can add more schedules per agent as needed
 */

const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");
const cron = require("node-cron");

const dev = process.env.NODE_ENV !== "production";
const hostname = "0.0.0.0";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error("Server error:", err);
      res.statusCode = 500;
      res.end("Internal server error");
    }
  });

  server.listen(port, hostname, () => {
    console.log(`> Evergrow Agent Platform running on http://${hostname}:${port}`);
    console.log(`> Environment: ${dev ? "development" : "production"}`);
    console.log(`> Scheduling cron jobs...`);
    setupCronJobs();
  });
});

/**
 * Set up all scheduled agent tasks.
 * These run inside the same process — no timeouts, full file access.
 */
function setupCronJobs() {
  // ──────────────────────────────────────────────
  // Daily at 8:00 AM Central (14:00 UTC)
  // Execute all due/overdue tasks
  // ──────────────────────────────────────────────
  cron.schedule("0 14 * * *", async () => {
    console.log(`[CRON] ${new Date().toISOString()} — Running daily task execution...`);
    try {
      const res = await fetch(`http://localhost:${port}/api/cron/execute-tasks`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${process.env.CRON_SECRET || ""}`,
        },
      });
      const data = await res.json();
      console.log(`[CRON] Daily tasks complete:`, data);
    } catch (err) {
      console.error(`[CRON] Daily task execution failed:`, err.message);
    }
  }, {
    timezone: "America/Chicago",
  });

  // ──────────────────────────────────────────────
  // Every 15 minutes: Check for tasks that have
  // become due since the last check (for same-day
  // tasks created after the 8 AM run)
  // ──────────────────────────────────────────────
  cron.schedule("*/15 * * * *", async () => {
    try {
      const res = await fetch(`http://localhost:${port}/api/cron/execute-tasks`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${process.env.CRON_SECRET || ""}`,
        },
      });
      const data = await res.json();
      if (data.executed > 0) {
        console.log(`[CRON] ${new Date().toISOString()} — Picked up ${data.executed} newly due task(s)`);
      }
    } catch (err) {
      // Silent — this is a background sweep
    }
  }, {
    timezone: "America/Chicago",
  });

  console.log(`> ✅ Cron: Daily task execution at 8:00 AM CT`);
  console.log(`> ✅ Cron: Task sweep every 15 minutes`);
}

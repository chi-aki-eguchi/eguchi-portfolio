// PM2 process configuration only. Build and database commands must not run
// while PM2 reads this file. src/server.ts retains its startup migrations.
const path = require("node:path");

module.exports = {
  apps: [
    {
      name: "web-app",
      cwd: path.join(__dirname, "packages/web"),
      script: "src/server.ts",
      interpreter: "bun",
      exec_mode: "fork",
      instances: 1,
      autorestart: true,
      restart_delay: 1000,
      env: {
        PORT: process.env.PORT || 4200,
      },
    },
  ],
};

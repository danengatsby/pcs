module.exports = {
  apps: [
    {
      name: "pcp-server",
      cwd: __dirname,
      script: "server/dist/index.js",
      interpreter: "node",
      exec_mode: "fork",
      instances: 1,
      autorestart: true,
      restart_delay: 5000,
      min_uptime: "10s",
      kill_timeout: 20000,
      max_memory_restart: "512M",
      time: true,
      env: {
        NODE_ENV: "production",
        AUTH_REFRESH_ENABLED: "true",
      },
    },
  ],
};

module.exports = {
  apps: [
    {
      name: "xfx-api",
      script: "dist/server/server.js",
      instances: "max",
      exec_mode: "cluster",
      node_args: "--experimental-websocket",
      env: {
        NODE_ENV: "production",
        RUN_ENGINE: "false"
      }
    },
    {
      name: "xfx-engine-daemon",
      script: "dist/server/engine_daemon.js",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
        RUN_ENGINE: "true"
      }
    }
  ]
};

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const http = require("http");
const { Server } = require("socket.io");

const sequelize = require("./config/database");
require("./models"); // registers associations

const initSockets = require("./sockets");
const { setSocketIO } = require("./services/notificationService");
const {
  notFound,
  errorHandler,
} = require("./middleware/errorHandler");

const app = express();
const server = http.createServer(app);

/* =========================================================
   CORS CONFIGURATION
   Allow both Vite development ports
========================================================= */

const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",
];

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests without an Origin header
    // e.g. Postman/server-to-server requests
    if (!origin) {
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    console.log(`CORS blocked origin: ${origin}`);

    return callback(
      new Error(`CORS blocked origin: ${origin}`)
    );
  },

  credentials: true,

  methods: [
    "GET",
    "POST",
    "PUT",
    "PATCH",
    "DELETE",
    "OPTIONS",
  ],

  allowedHeaders: [
    "Content-Type",
    "Authorization",
    // Administrator training context (see middleware/auth.js).
    // Without this header the browser preflight fails and training
    // mode can never start.
    "X-Training-Token",
    "x-training-token",
  ],
};

/* =========================================================
   SOCKET.IO
========================================================= */

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
    methods: [
      "GET",
      "POST",
    ],
  },
});

app.set("io", io);

setSocketIO(io);
initSockets(io);

/* =========================================================
   EXPRESS MIDDLEWARE
========================================================= */

app.use(cors(corsOptions));

app.use(express.json());

app.use(morgan("dev"));

/* =========================================================
   HEALTH CHECK
========================================================= */

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    time: new Date().toISOString(),
  });
});

/* =========================================================
   ROUTES
========================================================= */

app.use(
  "/api/auth",
  require("./routes/auth")
);

app.use(
  "/api/admin",
  require("./routes/admin")
);

app.use(
  "/api/users",
  require("./routes/users")
);

app.use(
  "/api/vehicles",
  require("./routes/vehicles")
);

app.use(
  "/api/drivers",
  require("./routes/drivers")
);

app.use(
  "/api/requests",
  require("./routes/requests")
);

app.use(
  "/api/hpmu",
  require("./routes/hpmu")
);

app.use(
  "/api/r3",
  require("./routes/r3")
);

app.use(
  "/api/trips",
  require("./routes/trips")
);

app.use(
  "/api/fuel",
  require("./routes/fuel")
);

app.use(
  "/api/logbooks",
  require("./routes/logbooks")
);

app.use(
  "/api/driver/reports",
  require("./routes/driverReports")
);

app.use(
  "/api/notifications",
  require("./routes/notifications")
);

app.use(
  "/api/reports",
  require("./routes/reports")
);

app.use(
  "/api/stats",
  require("./routes/stats")
);

app.use(
  "/api/audit",
  require("./routes/audit")
);

app.use(
  "/api/driver-fuel",
  require("./routes/driverFuel")
);

app.use(
  "/uploads",
  require("express").static(require("path").join(__dirname, "uploads"))
);

/* =========================================================
   ERROR HANDLERS
========================================================= */

app.use(notFound);
app.use(errorHandler);

/* =========================================================
   SERVER START
========================================================= */

const PORT = process.env.PORT || 5000;

async function start() {
  try {
    await sequelize.authenticate();

    console.log(
      `Connected to MySQL database: ${sequelize.getDatabaseName()}`
    );

    await sequelize.sync();

    console.log("Database models synced.");

    // Safe idempotent migrations for feature work (enums + new tables)
    try {
      require("child_process").execFileSync(
        process.execPath,
        [require("path").join(__dirname, "scripts", "migrateFeatureWork.js")],
        { stdio: "inherit" }
      );
    } catch (migErr) {
      console.warn("Feature migration warning:", migErr.message);
    }

    server.listen(PORT, () => {
      console.log(
        `VTMS backend running on http://localhost:${PORT}`
      );

      console.log(
        "Allowed frontend origins:",
        allowedOrigins.join(", ")
      );
    });
  } catch (err) {
    console.error(
      "Failed to start server:",
      err.message
    );

    process.exit(1);
  }
}

start();

module.exports = {
  app,
  server,
  io,
};
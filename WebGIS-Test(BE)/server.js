require("dotenv").config({
  path: process.env.ENV_FILE || ".env.local"
});

const express = require("express");
const cors = require("cors");
const multer = require("multer");

const app = express();

const BACKEND_HOST = process.env.BACKEND_HOST;
const BACKEND_PORT = process.env.BACKEND_PORT;

const allowedOrigins = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map(origin => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) {
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error(`CORS blocked: ${origin}`));
  }
}));

const upload = multer({
  storage: multer.memoryStorage()
});

app.get("/", (req, res) => {
  res.send("WebGIS backend is running");
});

app.get("/api/test", (req, res) => {
  res.json({
    message: "Backend API is connected successfully"
  });
});

app.post("/api/upload-shapefile", upload.single("shapefile"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No shapefile uploaded" });
    }

    if (!req.file.originalname.toLowerCase().endsWith(".zip")) {
      return res.status(400).json({
        message: "Please upload a zipped shapefile (.zip)"
      });
    }

    const shpModule = await import("shpjs");
    const shp = shpModule.default;

    const buffer = req.file.buffer;
    const arrayBuffer = buffer.buffer.slice(
      buffer.byteOffset,
      buffer.byteOffset + buffer.byteLength
    );

    const geojson = await shp(arrayBuffer);

    res.json({
      message: "Shapefile converted successfully",
      fileName: req.file.originalname,
      geojson: geojson
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Error converting shapefile",
      error: error.message
    });
  }
});

app.listen(BACKEND_PORT, BACKEND_HOST, () => {
  console.log(`WebGIS backend running at http://${BACKEND_HOST}:${BACKEND_PORT}`);
});
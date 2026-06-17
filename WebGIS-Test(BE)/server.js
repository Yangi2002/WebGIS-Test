const express = require("express");
const cors = require("cors");
const multer = require("multer");

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

app.use(cors({
  origin: [
    "http://localhost:4200",
    "http://localhost:8080"
  ]
}));

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

const PORT = 3000;

app.listen(PORT, () => {
  console.log(`WebGIS backend running at http://localhost:${PORT}`);
});
// server.js
import { GoogleGenerativeAI } from "@google/generative-ai";
import "dotenv/config";
import express from "express";
import multer from "multer";
import cors from "cors";

const app = express();
const upload = multer();

// inisialisasi Gemini API dengan API Key dari .env
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// daftar model Gemini
const geminiModels = {
  text: "gemini-1.5-flash", // untuk teks
  image: "gemini-1.5-flash", // multimodal (gambar + teks)
  audio: "gemini-1.5-flash", // sementara untuk audio
  pdf: "gemini-1.5-flash", // untuk dokumen PDF
};

// middleware
app.use(cors());
app.use(express.json());

// helper: ambil teks aman dari response
function getReply(result) {
  return (
    result.response?.candidates?.[0]?.content?.parts
      ?.map((p) => p.text || "")
      .join(" ")
      .trim() || "Tidak ada jawaban."
  );
}

// ================= ROUTE =================

// generate teks dari prompt
app.post("/generate-text", async (req, res) => {
  try {
    const { message } = req.body || {};
    if (!message || typeof message !== "string") {
      return res
        .status(400)
        .json({ message: "Pesan tidak ada atau format-nya tidak sesuai." });
    }

    const model = genAI.getGenerativeModel({ model: geminiModels.text });
    const result = await model.generateContent(
      `${message}\n\nJawab dengan singkat, jelas, dan rapi.`
    );

    res.json({ reply: getReply(result) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Terjadi error", error: err.message });
  }
});

// analisis isi gambar (upload file)
app.post("/generate-image", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Tidak ada file yang diupload" });
    }

    const model = genAI.getGenerativeModel({ model: geminiModels.image });

    // tahap 1: deskripsi mentah
    const raw = await model.generateContent({
      contents: [
        {
          parts: [
            {
              text: "Analisis gambar ini dan jelaskan isinya secara singkat.",
            },
            {
              inlineData: {
                mimeType: req.file.mimetype,
                data: req.file.buffer.toString("base64"),
              },
            },
          ],
        },
      ],
    });

    const rawText = getReply(raw);

    // tahap 2: perapihan
    const refineModel = genAI.getGenerativeModel({ model: geminiModels.text });
    const refined = await refineModel.generateContent(
      `Rapikan deskripsi berikut agar jelas, rapi, dan mudah dibaca:\n\n${rawText}`
    );

    res.json({ reply: getReply(refined) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Terjadi error", error: err.message });
  }
});

// analisis isi audio (upload file)
app.post("/generate-audio", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Tidak ada file yang diupload" });
    }

    const model = genAI.getGenerativeModel({ model: geminiModels.audio });

    // tahap 1: transkrip mentah
    const raw = await model.generateContent({
      contents: [
        {
          parts: [
            {
              text: "Transkrip audio ini ke dalam teks bahasa Indonesia.",
            },
            {
              inlineData: {
                mimeType: req.file.mimetype,
                data: req.file.buffer.toString("base64"),
              },
            },
          ],
        },
      ],
    });

    const rawText = getReply(raw);

    // tahap 2: perapihan
    const refineModel = genAI.getGenerativeModel({ model: geminiModels.text });
    const refined = await refineModel.generateContent(
      `Rapikan teks transkrip berikut agar jelas, rapi, dengan tanda baca yang benar:\n\n${rawText}`
    );

    res.json({ reply: getReply(refined) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Terjadi error", error: err.message });
  }
});

// analisis isi dokumen PDF
app.post("/generate-pdf", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Tidak ada file yang diupload" });
    }

    const model = genAI.getGenerativeModel({ model: geminiModels.pdf });
    const prompt =
      "Ringkas isi dokumen PDF ini agar jelas, rapi, dan mudah dipahami.";

    const result = await model.generateContent({
      contents: [
        {
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: req.file.mimetype, // application/pdf
                data: req.file.buffer.toString("base64"),
              },
            },
          ],
        },
      ],
    });

    res.json({ reply: getReply(result) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Terjadi error", error: error.message });
  }
});

// jalankan server
const port = 3000;
app.listen(port, () => {
  console.log(`🚀 Server jalan di http://localhost:${port}`);
});

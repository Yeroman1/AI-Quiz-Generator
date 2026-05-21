const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json());

// serve frontend
app.use(express.static("public"));

const { OpenAI } = require("openai");

const apiKey = process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY;
if (!apiKey || apiKey.includes("REPLACE_WITH_YOUR_KEY")) {
  console.error("Missing valid API key. Set OPENROUTER_API_KEY or OPENAI_API_KEY in .env");
  process.exit(1);
}

const openai = new OpenAI({
  apiKey,
  baseURL: process.env.OPENAI_BASE_URL || "https://openrouter.ai/api/v1",
  defaultHeaders: {
    "HTTP-Referer": process.env.OPENROUTER_SITE_URL || "http://localhost:3000",
    "X-Title": process.env.OPENROUTER_APP_NAME || "AI Quiz Generator"
  }
});

// homepage fix (important)
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/public/index.html");
});

// quiz generator
app.post("/generate", async (req, res) => {
  const { topic, count, description, difficulty } = req.body;
  const safeCount = Math.max(1, Number(count) || 1);
  const safeDifficulty = ["easy", "medium", "hard"].includes(String(difficulty).toLowerCase())
    ? String(difficulty).toLowerCase()
    : "medium";
  const safeDescription = description ? String(description).trim() : "";
  const mustUseDescription = safeDescription.length > 0;

  const prompt = `
Create a multiple choice quiz.

Topic: ${topic}
Number of questions: ${safeCount}
Difficulty: ${safeDifficulty}
Description: ${safeDescription || "No extra description provided."}

Rules you MUST follow:
1) ${mustUseDescription ? "Every question MUST be directly based on the Description text. Do not use outside topics." : "Use the Topic directly."}
2) Keep questions aligned to the requested difficulty only.
3) Do not introduce unrelated facts or themes.
4) Return JSON only.

Return ONLY valid JSON:
{
  "title": "${topic} Quiz (${safeDifficulty})",
  "topic": "${topic}",
  "description": "${safeDescription || "No extra description provided."}",
  "difficulty": "${safeDifficulty}",
  "questions": [
    {
      "question": "",
      "options": ["", "", "", ""],
      "answer": ""
    }
  ]
}
`;

  try {
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "openai/gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: "You are a strict quiz generator. Follow user constraints exactly. If description is provided, questions must stay within it."
        },
        { role: "user", content: prompt }
      ]
    });

    const content = response.choices?.[0]?.message?.content;
    if (!content) {
      return res.status(500).json({ error: "No content returned from model." });
    }

    const quiz = JSON.parse(content);
    quiz.topic = topic;
    quiz.description = safeDescription || "No extra description provided.";
    quiz.difficulty = safeDifficulty;
    if (!quiz.title) {
      quiz.title = `${topic} Quiz (${safeDifficulty})`;
    }

    // Basic guard: when description exists, reject clearly unrelated output.
    if (mustUseDescription) {
      const descWords = safeDescription
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length >= 5);
      const topWords = Array.from(new Set(descWords)).slice(0, 12);
      const questionText = (quiz.questions || []).map((q) => q.question || "").join(" ").toLowerCase();
      const matches = topWords.filter((w) => questionText.includes(w)).length;
      if (topWords.length > 0 && matches === 0) {
        return res.status(422).json({
          error: "Generated quiz did not follow your description closely. Please try again with a more specific description."
        });
      }
    }
    res.json(quiz);

  } catch (err) {
    console.error("Generate quiz error:", err?.status, err?.message, err?.error || "");
    res.status(500).json({
      error: `Failed to generate quiz: ${err?.message || "Unknown error"}`
    });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

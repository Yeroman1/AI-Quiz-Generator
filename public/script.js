async function generateQuiz() {
  const topic = document.getElementById("topic").value;
  const countInput = document.getElementById("count");
  const count = Math.max(1, Number(countInput.value) || 1);
  const description = document.getElementById("description").value.trim();
  const difficulty = document.getElementById("difficulty").value;
  const quizDiv = document.getElementById("quiz");

  countInput.value = count;
  quizDiv.innerHTML = renderLoadingCard("Generating your quiz");

  try {
    const res = await fetch("/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic, count, description, difficulty })
    });

    const data = await res.json();
    if (!res.ok) {
      quizDiv.innerHTML = `<div class="glass-card"><p>${data.error || "Failed to generate quiz."}</p></div>`;
      return;
    }
    startQuizFlow(data);
  } catch (_error) {
    quizDiv.innerHTML = `<div class="glass-card"><p>Network error. Please try again.</p></div>`;
  }
}

function initDifficultyDropdown() {
  const root = document.getElementById("difficultyDropdown");
  const btn = document.getElementById("difficultyBtn");
  const input = document.getElementById("difficulty");
  if (!root || !btn || !input) return;
  btn.addEventListener("click", () => root.classList.toggle("open"));
  root.querySelectorAll(".dropdown-item").forEach((item) => {
    item.addEventListener("click", () => {
      input.value = item.dataset.value;
      btn.textContent = item.textContent;
      root.classList.remove("open");
    });
  });
  document.addEventListener("click", (e) => { if (!root.contains(e.target)) root.classList.remove("open"); });
}

function renderLoadingCard(text) {
  return `<div class="glass-card loader-card"><p>${text}</p><div class="ai-dots"><span></span><span></span><span></span></div></div>`;
}

function startQuizFlow(data) {
  const quizDiv = document.getElementById("quiz");
  if (!data || !Array.isArray(data.questions) || data.questions.length === 0) {
    quizDiv.innerHTML = `<div class="glass-card"><p>Invalid quiz format received.</p></div>`;
    return;
  }
  const state = { data, index: 0, selectedAnswers: Array(data.questions.length).fill(null), submitted: false, score: 0 };
  renderQuestion(state);
}

function keepQuizInView() {
  const el = document.querySelector(".question-card") || document.getElementById("quiz");
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderQuestion(state) {
  const quizDiv = document.getElementById("quiz");
  const total = state.data.questions.length;
  const q = state.data.questions[state.index];
  const progressPercent = Math.round((state.index / total) * 100);
  const selected = state.selectedAnswers[state.index];
  const isLast = state.index === total - 1;
  const feedback = state.submitted ? buildReviewFeedback(q, selected) : "";

  quizDiv.innerHTML = `${state.submitted ? renderScoreboard(state) : ""}
    <div class="progress-card glass-card"><div class="progress-top"><span>Question ${state.index + 1} of ${total}</span><span>${progressPercent}%</span></div><div class="progress-track"><div class="progress-fill" style="width:${progressPercent}%"><span class="progress-dot"></span></div></div></div>
    <div class="quiz-header glass-card"><h2>${state.data.title}</h2><div class="score-badge">${state.submitted ? `Final: ${state.score}/${total}` : `Answered: ${state.selectedAnswers.filter(Boolean).length}/${total}`}</div><div class="quiz-meta"><span class="meta-pill">${(state.data.difficulty || "medium").toUpperCase()}</span><span class="meta-pill">${state.data.topic || "General"}</span></div><p class="quiz-description">${state.data.description || "No description provided."}</p></div>
    <div class="question-card glass-card"><h3>${state.index + 1}. ${q.question}</h3><div class="options">${q.options.map((opt) => { const reviewClass = state.submitted ? getOptionReviewClass(opt, q.answer, selected) : ""; return `<label class="option-row ${reviewClass}"><input type="radio" name="currentQuestion" value="${opt}" ${selected === opt ? "checked" : ""} ${state.submitted ? "disabled" : ""}/><span class="option-dot"></span><span class="option-text">${opt}</span></label>`; }).join("")}</div>${feedback}<div class="controls controls-row"><button id="prevBtn" class="nav-btn" ${state.index === 0 ? "disabled" : ""}>Previous</button>${state.submitted ? `<button id="nextBtn" class="next-btn" ${isLast ? "disabled" : ""}>Next</button>` : (isLast ? `<button id="submitBtn" class="next-btn" ${selected ? "" : "disabled"}>Submit Quiz</button>` : `<button id="nextBtn" class="next-btn" ${selected ? "" : "disabled"}>Next Question</button>`)}</div></div>`;

  if (!state.submitted) {
    document.querySelectorAll('input[name="currentQuestion"]').forEach((input) => {
      input.addEventListener("change", () => { state.selectedAnswers[state.index] = input.value; renderQuestion(state); });
    });
  }

  const prevBtn = document.getElementById("prevBtn");
  if (prevBtn) prevBtn.addEventListener("click", () => { if (state.index > 0) { state.index -= 1; renderQuestion(state); } });
  const nextBtn = document.getElementById("nextBtn");
  if (nextBtn) nextBtn.addEventListener("click", () => { if (state.index < total - 1) { state.index += 1; renderQuestion(state); } });
  const submitBtn = document.getElementById("submitBtn");
  if (submitBtn) submitBtn.addEventListener("click", () => {
    state.score = state.data.questions.reduce((acc, question, i) => acc + (state.selectedAnswers[i] === question.answer ? 1 : 0), 0);
    state.submitted = true;
    state.index = 0;
    renderQuestion(state);
  });

  keepQuizInView();
}

function getOptionReviewClass(opt, answer, selected) {
  if (opt === answer) return "is-correct-answer";
  if (selected === opt && selected !== answer) return "is-incorrect-answer";
  return "";
}

function buildReviewFeedback(q, selected) {
  if (selected === q.answer) return `<div class="review-feedback review-ok">Correct</div>`;
  return `<div class="review-feedback review-bad">Correct answer: ${q.answer}</div>`;
}

function renderScoreboard(state) {
  const total = state.data.questions.length;
  const correct = state.score;
  const wrong = total - correct;
  const pct = total ? Math.round((correct / total) * 100) : 0;
  return `<div class="scoreboard-card glass-card"><div class="scoreboard-header"><h2>Quiz Complete</h2><div class="big-score">${pct}%</div></div><div class="score-grid"><div class="score-card score-correct"><div class="score-label">Correct</div><div class="score-value">${correct}</div></div><div class="score-card score-wrong"><div class="score-label">Wrong</div><div class="score-value">${wrong}</div></div><div class="score-card score-total"><div class="score-label">Total</div><div class="score-value">${total}</div></div></div><div class="progress-track"><div class="progress-fill" style="width:${pct}%"><span class="progress-dot"></span></div></div></div>`;
}

initDifficultyDropdown();

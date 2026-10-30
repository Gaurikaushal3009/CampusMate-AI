
const taskForm = document.getElementById("taskForm");
const taskList = document.getElementById("taskList");
const taskCount = document.getElementById("taskCount");
const statusText = document.getElementById("status");

const sessionForm = document.getElementById("sessionForm");
const sessionList = document.getElementById("sessionList");
const plannerStatus = document.getElementById("plannerStatus");
const sessionFilter = document.getElementById("sessionFilter");

const chatForm = document.getElementById("chatForm");
const chatInput = document.getElementById("chatInput");
const chatMessages = document.getElementById("chatMessages");
const chatStatus = document.getElementById("chatStatus");
const chatSend = document.getElementById("chatSend");

let allSessions = [];

function todayString() {
    const today = new Date();
    return [
        today.getFullYear(),
        String(today.getMonth() + 1).padStart(2, "0"),
        String(today.getDate()).padStart(2, "0")
    ].join("-");
}

function deadlineStatus(task) {
    if (Boolean(task.completed)) {
        return { text: "Completed", className: "deadline-completed" };
    }

    if (!task.due_date) {
        return { text: "No deadline", className: "deadline-none" };
    }

    const difference = Math.round(
        (new Date(task.due_date + "T00:00:00") -
         new Date(todayString() + "T00:00:00")) / 86400000
    );

    if (difference < 0) {
        return { text: "Overdue", className: "deadline-overdue" };
    }

    if (difference === 0) {
        return { text: "Due today", className: "deadline-today" };
    }

    if (difference <= 3) {
        return {
            text: `Due in ${difference} day(s)`,
            className: "deadline-soon"
        };
    }

    return {
        text: `Upcoming: ${task.due_date}`,
        className: "deadline-upcoming"
    };
}

function makeBadge(text, className) {
    const badge = document.createElement("span");
    badge.className = className;
    badge.textContent = text;
    return badge;
}

// ---------------- TASK MANAGER ----------------

async function loadTasks() {
    try {
        const response = await fetch("/api/tasks");

        if (!response.ok) {
            throw new Error("Could not load tasks.");
        }

        const tasks = await response.json();

        document.getElementById("totalTasks").textContent = tasks.length;
        document.getElementById("pendingTasks").textContent =
            tasks.filter(task => !Boolean(task.completed)).length;
        document.getElementById("completedTasks").textContent =
            tasks.filter(task => Boolean(task.completed)).length;
        document.getElementById("highPriorityTasks").textContent =
            tasks.filter(task =>
                task.priority === "High" && !Boolean(task.completed)
            ).length;

        const overdueCount = tasks.filter(task =>
            !Boolean(task.completed) &&
            task.due_date &&
            task.due_date < todayString()
        ).length;

        taskList.replaceChildren();
        taskCount.textContent =
            `${tasks.length} task(s) found. ${overdueCount} overdue.`;

        if (tasks.length === 0) {
            const empty = document.createElement("li");
            empty.textContent = "No tasks yet. Add your first task!";
            taskList.appendChild(empty);
            return;
        }

        tasks.forEach(task => {
            const item = document.createElement("li");
            item.className = "task-item";

            if (Boolean(task.completed)) {
                item.classList.add("completed");
            }

            const info = document.createElement("div");
            info.className = "task-info";

            const title = document.createElement("strong");
            title.className = "task-title";
            title.textContent = task.title;

            const details = document.createElement("p");
            details.textContent =
                `Priority: ${task.priority || "Medium"} | Due: ${task.due_date || "No date"}`;

            const deadline = deadlineStatus(task);
            const badges = document.createElement("div");
            badges.appendChild(
                makeBadge(deadline.text,
                    `deadline-badge ${deadline.className}`)
            );

            const priority = task.priority || "Medium";
            badges.appendChild(
                makeBadge(priority,
                    `priority-badge priority-${priority.toLowerCase()}`)
            );

            info.append(title, details, badges);

            const completeButton = document.createElement("button");
            completeButton.textContent =
                task.completed ? "Undo" : "Complete";

            completeButton.addEventListener("click", async () => {
                try {
                    const result = await fetch(`/api/tasks/${task.id}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            completed: !Boolean(task.completed)
                        })
                    });

                    if (!result.ok) {
                        throw new Error("Could not update task.");
                    }

                    statusText.textContent = "Task updated successfully!";
                    await loadTasks();
                } catch (error) {
                    statusText.textContent = error.message;
                }
            });

            const deleteButton = document.createElement("button");
            deleteButton.textContent = "Delete";
            deleteButton.className = "delete-button";

            deleteButton.addEventListener("click", async () => {
                if (!confirm(`Delete "${task.title}"?`)) return;

                try {
                    const result = await fetch(`/api/tasks/${task.id}`, {
                        method: "DELETE"
                    });

                    if (!result.ok) {
                        throw new Error("Could not delete task.");
                    }

                    statusText.textContent = "Task deleted successfully!";
                    await loadTasks();
                } catch (error) {
                    statusText.textContent = error.message;
                }
            });

            item.append(info, completeButton, deleteButton);
            taskList.appendChild(item);
        });
    } catch (error) {
        taskCount.textContent = "Could not load tasks.";
        statusText.textContent =
            "Task loading failed. Check the Flask terminal.";
    }
}

taskForm.addEventListener("submit", async event => {
    event.preventDefault();

    const title = document.getElementById("title").value.trim();
    const dueDate = document.getElementById("dueDate").value;
    const priority = document.getElementById("priority").value;

    if (!title) {
        statusText.textContent = "Please enter a task name.";
        return;
    }

    statusText.textContent = "Adding task...";

    try {
        const response = await fetch("/api/tasks", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                title,
                due_date: dueDate,
                priority
            })
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || "Could not add task.");
        }

        taskForm.reset();
        document.getElementById("priority").value = "Medium";
        statusText.textContent = "Task added successfully!";
        await loadTasks();
    } catch (error) {
        statusText.textContent = error.message;
    }
});

// ---------------- DAILY STUDY PLANNER ----------------

async function loadSessions() {
    try {
        const response = await fetch("/api/sessions");

        if (!response.ok) {
            throw new Error("Could not load study sessions.");
        }

        allSessions = await response.json();

        document.getElementById("sessionTotal").textContent =
            allSessions.length;

        document.getElementById("sessionCompleted").textContent =
            allSessions.filter(session => Boolean(session.completed)).length;

        const totalMinutes = allSessions.reduce(
            (sum, session) => sum + Number(session.duration_minutes), 0
        );

        document.getElementById("studyMinutes").textContent =
            totalMinutes >= 60
                ? `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m`
                : `${totalMinutes} min`;

        renderSessions();
    } catch (error) {
        sessionList.replaceChildren();
        const item = document.createElement("li");
        item.textContent = error.message;
        sessionList.appendChild(item);
    }
}

function renderSessions() {
    sessionList.replaceChildren();

    const filter = sessionFilter.value;

    const sessions = allSessions.filter(session => {
        if (filter === "pending") return !Boolean(session.completed);
        if (filter === "completed") return Boolean(session.completed);
        return true;
    });

    if (sessions.length === 0) {
        const item = document.createElement("li");
        item.textContent = "No study sessions in this view. Add a session above!";
        sessionList.appendChild(item);
        return;
    }

    sessions.forEach(session => {
        const item = document.createElement("li");
        item.className = "session-item";

        if (Boolean(session.completed)) {
            item.classList.add("completed");
        }

        const info = document.createElement("div");
        info.className = "session-info";

        const title = document.createElement("strong");
        title.className = "session-title";
        title.textContent = session.subject;

        const details = document.createElement("p");
        details.textContent =
            `${session.study_date} at ${session.start_time} · ${session.duration_minutes} minutes`;

        info.append(title, details);

        if (session.notes) {
            const notes = document.createElement("p");
            notes.textContent = `Notes: ${session.notes}`;
            info.appendChild(notes);
        }

        const status = makeBadge(
            session.completed ? "Completed" : "Planned",
            `deadline-badge ${session.completed ? "deadline-completed" : "deadline-upcoming"}`
        );
        info.appendChild(status);

        const completeButton = document.createElement("button");
        completeButton.textContent = session.completed ? "Undo" : "Complete";

        completeButton.addEventListener("click", async () => {
            try {
                const response = await fetch(`/api/sessions/${session.id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        completed: !Boolean(session.completed)
                    })
                });

                if (!response.ok) {
                    throw new Error("Could not update the session.");
                }

                plannerStatus.textContent = "Study session updated!";
                await loadSessions();
            } catch (error) {
                plannerStatus.textContent = error.message;
            }
        });

        const deleteButton = document.createElement("button");
        deleteButton.textContent = "Delete";
        deleteButton.className = "delete-button";

        deleteButton.addEventListener("click", async () => {
            if (!confirm(`Delete study session "${session.subject}"?`)) return;

            try {
                const response = await fetch(`/api/sessions/${session.id}`, {
                    method: "DELETE"
                });

                if (!response.ok) {
                    throw new Error("Could not delete the session.");
                }

                plannerStatus.textContent = "Study session deleted.";
                await loadSessions();
            } catch (error) {
                plannerStatus.textContent = error.message;
            }
        });

        item.append(info, completeButton, deleteButton);
        sessionList.appendChild(item);
    });
}

sessionForm.addEventListener("submit", async event => {
    event.preventDefault();

    const session = {
        subject: document.getElementById("subject").value.trim(),
        study_date: document.getElementById("studyDate").value,
        start_time: document.getElementById("startTime").value,
        duration_minutes: Number(document.getElementById("duration").value),
        notes: document.getElementById("notes").value.trim()
    };

    plannerStatus.textContent = "Saving study session...";

    try {
        const response = await fetch("/api/sessions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(session)
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || "Could not save session.");
        }

        sessionForm.reset();
        document.getElementById("studyDate").value = todayString();
        document.getElementById("duration").value = 60;

        plannerStatus.textContent = "Study session added successfully!";
        await loadSessions();
    } catch (error) {
        plannerStatus.textContent = error.message;
    }
});

sessionFilter.addEventListener("change", renderSessions);

// ---------------- AI CHATBOT ----------------

function addChatMessage(text, sender) {
    const bubble = document.createElement("div");
    bubble.className = `chat-bubble ${sender}-bubble`;
    bubble.textContent = text;
    chatMessages.appendChild(bubble);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return bubble;
}

chatForm.addEventListener("submit", async event => {
    event.preventDefault();

    const message = chatInput.value.trim();

    if (!message) return;

    addChatMessage(message, "user");
    chatInput.value = "";
    chatSend.disabled = true;
    chatStatus.textContent = "CampusMate AI is thinking...";

    const waitingBubble = addChatMessage("Thinking...", "assistant");

    try {
        const response = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message })
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || "The chatbot request failed.");
        }

        waitingBubble.textContent = result.reply;
        chatStatus.textContent = "Response received.";
    } catch (error) {
        waitingBubble.textContent = error.message;
        chatStatus.textContent = "Chatbot could not complete the request.";
    } finally {
        chatSend.disabled = false;
        chatInput.focus();
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
});

// ---------------- INITIALIZE PAGE ----------------

document.getElementById("studyDate").value = todayString();

loadTasks();
loadSessions();

/* ==========================================
   CAMPUSMATE AI: QUIZ + PROGRESS + FOCUS TIMER
   ========================================== */

(() => {
  "use strict";

  // ---------- QUIZ QUESTIONS ----------

  const cmQuestions = {
    Python: [
      {
        q: "Which keyword defines a function in Python?",
        options: ["function", "def", "fun", "define"],
        answer: 1,
        explanation: "Python uses the def keyword to define a function."
      },
      {
        q: "What is the output of print(2 + 3)?",
        options: ["23", "5", "2 + 3", "Error"],
        answer: 1,
        explanation: "The + operator adds the two numbers, producing 5."
      },
      {
        q: "Which data type stores True or False?",
        options: ["String", "Integer", "Boolean", "List"],
        answer: 2,
        explanation: "The bool type represents True or False."
      },
      {
        q: "Which symbol starts a comment in Python?",
        options: ["//", "<!--", "#", "/*"],
        answer: 2,
        explanation: "A Python single-line comment starts with #."
      },
      {
        q: "Which structure stores multiple items in an ordered collection?",
        options: ["list", "if", "def", "return"],
        answer: 0,
        explanation: "A list stores multiple items in an ordered collection."
      }
    ],

    HTML: [
      {
        q: "What is HTML mainly used for?",
        options: [
          "Styling a webpage",
          "Structuring a webpage",
          "Storing passwords",
          "Running SQL queries"
        ],
        answer: 1,
        explanation: "HTML defines the structure and content of webpages."
      },
      {
        q: "Which tag creates the largest standard heading?",
        options: ["<head>", "<h6>", "<h1>", "<header>"],
        answer: 2,
        explanation: "The h1 element is the highest-level heading."
      },
      {
        q: "Which tag creates a hyperlink?",
        options: ["<linkto>", "<a>", "<href>", "<url>"],
        answer: 1,
        explanation: "The a element creates a hyperlink using its href attribute."
      },
      {
        q: "Which tag inserts an image?",
        options: ["<picturefile>", "<image>", "<img>", "<src>"],
        answer: 2,
        explanation: "The img element embeds an image."
      },
      {
        q: "Which tag creates a paragraph?",
        options: ["<p>", "<para>", "<text>", "<pg>"],
        answer: 0,
        explanation: "The p element represents a paragraph."
      }
    ],

    CSS: [
      {
        q: "What is CSS mainly used for?",
        options: [
          "Styling webpages",
          "Creating databases",
          "Writing Python programs",
          "Sending emails"
        ],
        answer: 0,
        explanation: "CSS controls the presentation and layout of webpages."
      },
      {
        q: "Which property changes text colour?",
        options: ["font-style", "background", "color", "text-font"],
        answer: 2,
        explanation: "The color property sets text colour."
      },
      {
        q: "Which selector targets an element with id='header'?",
        options: [".header", "#header", "*header", "header#"],
        answer: 1,
        explanation: "The # symbol selects an element by its ID."
      },
      {
        q: "Which property adds space inside an element's border?",
        options: ["margin", "padding", "outline", "gap-only"],
        answer: 1,
        explanation: "Padding is the space between content and its border."
      },
      {
        q: "Which CSS layout system is useful for one-dimensional layouts?",
        options: ["Flexbox", "SQL", "SQLite", "Flask"],
        answer: 0,
        explanation: "Flexbox is designed primarily for one-dimensional layouts."
      }
    ],

    JavaScript: [
      {
        q: "Which keyword declares a block-scoped variable that can be reassigned?",
        options: ["const", "let", "fixed", "define"],
        answer: 1,
        explanation: "let declares a block-scoped variable that can be reassigned."
      },
      {
        q: "Which method writes a message to the browser console?",
        options: ["console.log()", "print.page()", "echo.html()", "write.file()"],
        answer: 0,
        explanation: "console.log() writes output to the developer console."
      },
      {
        q: "Which method selects an element by its ID?",
        options: [
          "document.getElementById()",
          "document.getClass()",
          "window.selectID()",
          "html.findID()"
        ],
        answer: 0,
        explanation: "document.getElementById() selects an element by its ID."
      },
      {
        q: "Which operator checks strict equality?",
        options: ["=", "==", "===", "!="],
        answer: 2,
        explanation: "=== checks equality without converting operand types."
      },
      {
        q: "Which keyword declares a function?",
        options: ["method", "def", "function", "func"],
        answer: 2,
        explanation: "The function keyword can declare a JavaScript function."
      }
    ],

    SQL: [
      {
        q: "Which SQL command retrieves data?",
        options: ["GET", "SELECT", "FETCH ALL ONLY", "OPEN"],
        answer: 1,
        explanation: "SELECT retrieves rows from a database."
      },
      {
        q: "Which command adds a new row?",
        options: ["INSERT", "UPDATE", "CHANGE", "APPEND TABLE"],
        answer: 0,
        explanation: "INSERT INTO adds new rows to a table."
      },
      {
        q: "Which clause filters rows?",
        options: ["ORDER BY", "WHERE", "GROUP NAME", "FILTER TABLE"],
        answer: 1,
        explanation: "WHERE selects rows that meet a condition."
      },
      {
        q: "Which command changes existing rows?",
        options: ["MODIFY DATABASE", "REPLACE ALL", "UPDATE", "ALTER ROW"],
        answer: 2,
        explanation: "UPDATE changes values in existing rows."
      },
      {
        q: "Which SQL keyword sorts results?",
        options: ["SORT", "ORDER BY", "ARRANGE", "SEQUENCE"],
        answer: 1,
        explanation: "ORDER BY sorts query results."
      }
    ]
  };

  // ---------- SAFE LOCAL STORAGE ----------

  function cmReadStorage(key, fallback) {
    try {
      const value = localStorage.getItem(key);
      return value === null ? fallback : JSON.parse(value);
    } catch (error) {
      return fallback;
    }
  }

  function cmWriteStorage(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      return false;
    }
  }

  // ---------- STUDY PROGRESS ----------

  const cmProgressKey = "campusmateQuizProgressV1";

  let cmProgress = cmReadStorage(cmProgressKey, {
    total: 0,
    best: 0,
    last: null,
    history: []
  });

  if (
    !cmProgress ||
    typeof cmProgress !== "object" ||
    !Array.isArray(cmProgress.history)
  ) {
    cmProgress = {
      total: 0,
      best: 0,
      last: null,
      history: []
    };
  }

  const cmTotalEl = document.getElementById("cm-total-quizzes");
  const cmBestEl = document.getElementById("cm-best-score");
  const cmLastEl = document.getElementById("cm-last-score");
  const cmProgressFill = document.getElementById("cm-progress-fill");
  const cmProgressMessage = document.getElementById("cm-progress-message");

  function cmRenderProgress() {
    if (!cmTotalEl) return;

    cmTotalEl.textContent = cmProgress.total;
    cmBestEl.textContent = cmProgress.best + "%";
    cmLastEl.textContent =
      cmProgress.last === null ? "—" : cmProgress.last + "%";

    // The bar represents the best quiz percentage.
    if (cmProgressFill) {
      cmProgressFill.style.width = cmProgress.best + "%";
    }

    if (cmProgressMessage) {
      if (cmProgress.total === 0) {
        cmProgressMessage.textContent =
          "Complete your first quiz to start tracking your progress.";
      } else {
        cmProgressMessage.textContent =
          "You've completed " + cmProgress.total +
          " quiz(es). Keep practising to improve your best score!";
      }
    }
  }

  function cmSaveQuizScore(score, subject) {
    cmProgress.total += 1;
    cmProgress.last = score;
    cmProgress.best = Math.max(cmProgress.best, score);

    cmProgress.history.push({
      subject: subject,
      score: score,
      date: new Date().toISOString()
    });

    // Keep the latest 100 results.
    cmProgress.history = cmProgress.history.slice(-100);

    const saved = cmWriteStorage(cmProgressKey, cmProgress);
    cmRenderProgress();

    if (!saved && cmProgressMessage) {
      cmProgressMessage.textContent =
        "Your score is shown, but browser storage is unavailable. " +
        "It may not be saved after you leave this page.";
    }
  }

  const cmResetProgressButton =
    document.getElementById("cm-reset-progress");

  if (cmResetProgressButton) {
    cmResetProgressButton.addEventListener("click", () => {
      const confirmed = window.confirm(
        "Reset all saved quiz progress in this browser?"
      );

      if (!confirmed) return;

      cmProgress = {
        total: 0,
        best: 0,
        last: null,
        history: []
      };

      cmWriteStorage(cmProgressKey, cmProgress);
      cmRenderProgress();
    });
  }

  cmRenderProgress();

  // ---------- QUIZ GAME ----------

  const cmTopicSelect = document.getElementById("cm-quiz-topic");
  const cmQuizStart = document.getElementById("cm-quiz-start");
  const cmQuizArea = document.getElementById("cm-quiz-area");
  const cmQuizResult = document.getElementById("cm-quiz-result");
  const cmQuestionCount = document.getElementById("cm-question-count");
  const cmQuizScore = document.getElementById("cm-quiz-score");
  const cmQuestionText = document.getElementById("cm-question-text");
  const cmAnswerOptions = document.getElementById("cm-answer-options");
  const cmAnswerFeedback = document.getElementById("cm-answer-feedback");
  const cmQuizNext = document.getElementById("cm-quiz-next");
  const cmQuizFill = document.getElementById("cm-quiz-fill");
  const cmQuizAgain = document.getElementById("cm-quiz-again");

  let cmCurrentQuestions = [];
  let cmCurrentQuestion = 0;
  let cmCurrentScore = 0;
  let cmHasAnswered = false;
  let cmSelectedSubject = "Python";

  function cmStartQuiz() {
    cmSelectedSubject = cmTopicSelect.value;
    cmCurrentQuestions = cmQuestions[cmSelectedSubject] || [];
    cmCurrentQuestion = 0;
    cmCurrentScore = 0;
    cmHasAnswered = false;

    if (cmCurrentQuestions.length === 0) {
      cmQuestionText.textContent = "No questions are available.";
      return;
    }

    cmQuizResult.hidden = true;
    cmQuizArea.hidden = false;
    cmRenderQuestion();
  }

  function cmRenderQuestion() {
    const question = cmCurrentQuestions[cmCurrentQuestion];

    cmHasAnswered = false;
    cmQuestionCount.textContent =
      "Question " + (cmCurrentQuestion + 1) +
      " of " + cmCurrentQuestions.length;

    cmQuizScore.textContent = "Score: " + cmCurrentScore;
    cmQuestionText.textContent = question.q;
    cmAnswerFeedback.textContent = "";
    cmAnswerOptions.replaceChildren();
    cmQuizNext.disabled = true;

    cmQuizNext.textContent =
      cmCurrentQuestion === cmCurrentQuestions.length - 1
        ? "View results"
        : "Next question";

    cmQuizFill.style.width =
      (cmCurrentQuestion / cmCurrentQuestions.length * 100) + "%";

    question.options.forEach((option, index) => {
      const button = document.createElement("button");

      button.type = "button";
      button.className = "cm-answer-option";
      button.textContent =
        String.fromCharCode(65 + index) + ". " + option;

      button.addEventListener("click", () => {
        cmChooseAnswer(index);
      });

      cmAnswerOptions.appendChild(button);
    });
  }

  function cmChooseAnswer(selectedIndex) {
    if (cmHasAnswered) return;

    cmHasAnswered = true;

    const question = cmCurrentQuestions[cmCurrentQuestion];
    const buttons = cmAnswerOptions.querySelectorAll("button");
    const isCorrect = selectedIndex === question.answer;

    if (isCorrect) {
      cmCurrentScore += 1;
      cmAnswerFeedback.textContent =
        "Correct! " + question.explanation;
    } else {
      cmAnswerFeedback.textContent =
        "Not quite. Correct answer: " +
        question.options[question.answer] + ". " +
        question.explanation;
    }

    buttons.forEach((button, index) => {
      button.disabled = true;

      if (index === question.answer) {
        button.classList.add("correct");
      } else if (index === selectedIndex) {
        button.classList.add("incorrect");
      }
    });

    cmQuizScore.textContent = "Score: " + cmCurrentScore;
    cmQuizNext.disabled = false;
  }

  function cmShowResults() {
    const total = cmCurrentQuestions.length;
    const percentage = Math.round((cmCurrentScore / total) * 100);

    cmQuizArea.hidden = true;
    cmQuizResult.hidden = false;

    document.getElementById("cm-result-title").textContent =
      "Quiz completed!";

    document.getElementById("cm-result-score").textContent =
      "You scored " + cmCurrentScore + " out of " + total +
      " (" + percentage + "%).";

    let resultMessage;

    if (percentage === 100) {
      resultMessage = "Perfect score! Excellent work.";
    } else if (percentage >= 60) {
      resultMessage = "Good job! Review the questions you missed.";
    } else {
      resultMessage = "Keep practising. Every attempt helps you learn.";
    }

    document.getElementById("cm-result-message").textContent =
      resultMessage;

    cmQuizFill.style.width = "100%";
    cmSaveQuizScore(percentage, cmSelectedSubject);
  }

  if (cmQuizStart) {
    cmQuizStart.addEventListener("click", cmStartQuiz);
  }

  if (cmQuizNext) {
    cmQuizNext.addEventListener("click", () => {
      if (!cmHasAnswered) return;

      if (cmCurrentQuestion >= cmCurrentQuestions.length - 1) {
        cmShowResults();
      } else {
        cmCurrentQuestion += 1;
        cmRenderQuestion();
      }
    });
  }

  if (cmQuizAgain) {
    cmQuizAgain.addEventListener("click", cmStartQuiz);
  }

  // ---------- FOCUS TIMER ----------

  const cmTimerDisplay = document.getElementById("cm-timer-display");
  const cmTimerLabel = document.getElementById("cm-timer-label");
  const cmTimerStart = document.getElementById("cm-timer-start");
  const cmTimerReset = document.getElementById("cm-timer-reset");
  const cmTimerMessage = document.getElementById("cm-timer-message");
  const cmFocusCountEl = document.getElementById("cm-focus-count");
  const cmModeButtons = document.querySelectorAll(".cm-mode");

  const cmFocusCountKey = "campusmateFocusSessionsV1";

  let cmFocusCount = Number(
    cmReadStorage(cmFocusCountKey, 0)
  );

  if (!Number.isFinite(cmFocusCount) || cmFocusCount < 0) {
    cmFocusCount = 0;
  }

  let cmTimerMode = "focus";
  let cmTimerDuration = 25 * 60;
  let cmTimerRemaining = cmTimerDuration;
  let cmTimerInterval = null;
  let cmTimerEndAt = null;

  function cmFormatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    return String(minutes).padStart(2, "0") + ":" +
      String(remainingSeconds).padStart(2, "0");
  }

  function cmRenderTimer() {
    if (!cmTimerDisplay) return;

    cmTimerDisplay.textContent = cmFormatTime(cmTimerRemaining);

    if (cmFocusCountEl) {
      cmFocusCountEl.textContent = cmFocusCount;
    }

    if (cmTimerStart) {
      cmTimerStart.textContent =
        cmTimerInterval ? "Pause" : "Start";
    }

    if (cmTimerLabel && !cmTimerInterval) {
      cmTimerLabel.textContent =
        cmTimerRemaining === 0 ? "Time's up!" : "Ready to begin";
    }
  }

  function cmStopTimer() {
    if (cmTimerInterval !== null) {
      clearInterval(cmTimerInterval);
      cmTimerInterval = null;
    }

    cmTimerEndAt = null;
  }

  function cmFinishTimer() {
    cmStopTimer();
    cmTimerRemaining = 0;

    if (cmTimerMode === "focus") {
      cmFocusCount += 1;
      cmWriteStorage(cmFocusCountKey, cmFocusCount);

      cmTimerMessage.textContent =
        "Focus session complete! Take a break when you're ready.";
    } else {
      cmTimerMessage.textContent =
        "Break complete! You're ready to focus again.";
    }

    cmRenderTimer();
  }

  function cmTimerTick() {
    if (!cmTimerEndAt) return;

    cmTimerRemaining = Math.max(
      0,
      Math.ceil((cmTimerEndAt - Date.now()) / 1000)
    );

    if (cmTimerRemaining <= 0) {
      cmFinishTimer();
    } else {
      cmRenderTimer();
    }
  }

  function cmStartOrPauseTimer() {
    if (cmTimerInterval !== null) {
      cmStopTimer();
      cmTimerMessage.textContent = "Timer paused.";
      cmRenderTimer();
      return;
    }

    if (cmTimerRemaining <= 0) {
      cmTimerRemaining = cmTimerDuration;
    }

    cmTimerEndAt = Date.now() + cmTimerRemaining * 1000;

    cmTimerInterval = setInterval(cmTimerTick, 250);
    cmTimerMessage.textContent =
      cmTimerMode === "focus"
        ? "Stay focused. You've got this!"
        : "Relax and recharge.";

    cmRenderTimer();
  }

  function cmResetTimer() {
    cmStopTimer();
    cmTimerRemaining = cmTimerDuration;
    cmTimerMessage.textContent = "Timer reset.";
    cmRenderTimer();
  }

  function cmSetTimerMode(mode, button) {
    cmStopTimer();

    cmTimerMode = mode;
    cmTimerDuration = Number(button.dataset.minutes) * 60;
    cmTimerRemaining = cmTimerDuration;

    cmModeButtons.forEach((item) => {
      item.classList.toggle("active", item === button);
    });

    cmTimerMessage.textContent =
      mode === "focus"
        ? "Ready for a 25-minute focus session."
        : "Ready for a 5-minute break.";

    cmRenderTimer();
  }

  cmModeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      cmSetTimerMode(button.dataset.mode, button);
    });
  });

  if (cmTimerStart) {
    cmTimerStart.addEventListener("click", cmStartOrPauseTimer);
  }

  if (cmTimerReset) {
    cmTimerReset.addEventListener("click", cmResetTimer);
  }

  cmRenderTimer();

})();

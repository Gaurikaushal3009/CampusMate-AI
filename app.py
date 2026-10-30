
import os
import sqlite3
from pathlib import Path
from functools import wraps

from flask import (
    Flask, render_template, jsonify, request,
    redirect, url_for, session
)
from werkzeug.security import generate_password_hash, check_password_hash


app = Flask(__name__,
            static_folder="static",
            static_url_path="/static"
            )

app.secret_key = os.environ.get(
    "SECRET_KEY",
    "campusmate-local-development-secret-change-before-deployment"
)

DATABASE = Path(__file__).resolve().parent / "campusmate.db"


# ---------------- DATABASE ----------------

def get_db_connection():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn


def initialize_database():
    with get_db_connection() as conn:

        # User accounts
        conn.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT NOT NULL UNIQUE,
                password TEXT NOT NULL
            )
        """)

        # Tasks
        conn.execute("""
            CREATE TABLE IF NOT EXISTS tasks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                due_date TEXT,
                priority TEXT DEFAULT 'Medium',
                completed INTEGER DEFAULT 0
            )
        """)

        # Study sessions
        conn.execute("""
            CREATE TABLE IF NOT EXISTS study_sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                subject TEXT NOT NULL,
                study_date TEXT NOT NULL,
                start_time TEXT NOT NULL,
                duration_minutes INTEGER NOT NULL,
                notes TEXT DEFAULT '',
                completed INTEGER DEFAULT 0
            )
        """)

        # Add user_id to existing tables without deleting old data
        for table in ("tasks", "study_sessions"):
            columns = [
                row["name"]
                for row in conn.execute(
                    f"PRAGMA table_info({table})"
                ).fetchall()
            ]

            if "user_id" not in columns:
                conn.execute(
                    f"ALTER TABLE {table} ADD COLUMN user_id INTEGER"
                )

        # Give existing records to the first registered user.
        # This preserves data from your earlier single-user project.
        first_user = conn.execute(
            "SELECT id FROM users ORDER BY id LIMIT 1"
        ).fetchone()

        if first_user:
            conn.execute(
                "UPDATE tasks SET user_id = ? WHERE user_id IS NULL",
                (first_user["id"],)
            )
            conn.execute(
                "UPDATE study_sessions SET user_id = ? WHERE user_id IS NULL",
                (first_user["id"],)
            )


# ---------------- LOGIN PROTECTION ----------------

def login_required(function):
    @wraps(function)
    def wrapper(*args, **kwargs):
        if "user_id" not in session:
            if request.path.startswith("/api/"):
                return jsonify({"error": "Please log in first."}), 401

            return redirect(url_for("login"))

        return function(*args, **kwargs)

    return wrapper


# ---------------- HOME PAGE ----------------

@app.route("/")
def home():
    return render_template("landing.html")


# ---------------- SIGNUP ----------------

@app.route("/signup", methods=["GET", "POST"])
def signup():

    if session.get("user_id"):
        return redirect(url_for("dashboard"))

    error = None

    if request.method == "POST":

        name = request.form.get("name", "").strip()
        email = request.form.get("email", "").strip().lower()
        password = request.form.get("password", "")
        confirm_password = request.form.get("confirm_password", "")

        if len(name) < 2 or len(name) > 80:
            error = "Please enter a name between 2 and 80 characters."

        elif len(email) > 254 or "@" not in email:
            error = "Please enter a valid email address."

        elif len(password) < 8:
            error = "Password must contain at least 8 characters."

        elif password != confirm_password:
            error = "Passwords do not match."

        else:
            hashed_password = generate_password_hash(password)

            try:
                with get_db_connection() as conn:

                    cursor = conn.execute("""
                        INSERT INTO users (name, email, password)
                        VALUES (?, ?, ?)
                    """, (name, email, hashed_password))

                    user_id = cursor.lastrowid

                    # Assign older project records to the first account.
                    user_count = conn.execute(
                        "SELECT COUNT(*) FROM users"
                    ).fetchone()[0]

                    if user_count == 1:
                        conn.execute(
                            "UPDATE tasks SET user_id = ? WHERE user_id IS NULL",
                            (user_id,)
                        )
                        conn.execute(
                            "UPDATE study_sessions SET user_id = ? WHERE user_id IS NULL",
                            (user_id,)
                        )

                session.clear()
                session["user_id"] = user_id
                session["user_name"] = name

                return redirect(url_for("dashboard"))

            except sqlite3.IntegrityError:
                error = "An account with this email already exists."

    return render_template(
        "auth.html",
        mode="signup",
        error=error
    )


# ---------------- LOGIN ----------------

@app.route("/login", methods=["GET", "POST"])
def login():

    if session.get("user_id"):
        return redirect(url_for("dashboard"))

    error = None

    if request.method == "POST":

        email = request.form.get("email", "").strip().lower()
        password = request.form.get("password", "")

        with get_db_connection() as conn:
            user = conn.execute("""
                SELECT * FROM users WHERE email = ?
            """, (email,)).fetchone()

        if user and check_password_hash(user["password"], password):

            session.clear()
            session["user_id"] = user["id"]
            session["user_name"] = user["name"]

            return redirect(url_for("dashboard"))

        error = "Incorrect email or password. Please try again."

    return render_template(
        "auth.html",
        mode="login",
        error=error
    )


# ---------------- DASHBOARD ----------------

@app.route("/dashboard")
@login_required
def dashboard():
    return render_template(
        "index.html",
        user_name=session.get("user_name", "Student")
    )


# ---------------- LOGOUT ----------------

@app.route("/logout", methods=["POST"])
@login_required
def logout():
    session.clear()
    return redirect(url_for("home"))


# ---------------- TASK MANAGER ----------------

@app.route("/api/tasks", methods=["GET"])
@login_required
def get_tasks():

    user_id = session["user_id"]

    with get_db_connection() as conn:
        tasks = conn.execute("""
            SELECT * FROM tasks
            WHERE user_id = ?
            ORDER BY completed ASC, id DESC
        """, (user_id,)).fetchall()

    return jsonify([dict(task) for task in tasks])


@app.route("/api/tasks", methods=["POST"])
@login_required
def add_task():

    data = request.get_json(silent=True) or {}

    title = data.get("title", "").strip()
    due_date = data.get("due_date") or None
    priority = data.get("priority", "Medium")

    if not title:
        return jsonify({"error": "Task name is required."}), 400

    if priority not in ["Low", "Medium", "High"]:
        return jsonify({"error": "Invalid priority."}), 400

    with get_db_connection() as conn:
        cursor = conn.execute("""
            INSERT INTO tasks (title, due_date, priority, user_id)
            VALUES (?, ?, ?, ?)
        """, (title, due_date, priority, session["user_id"]))

        task_id = cursor.lastrowid

    return jsonify({
        "message": "Task added successfully!",
        "id": task_id
    }), 201


@app.route("/api/tasks/<int:task_id>", methods=["PATCH"])
@login_required
def update_task(task_id):

    data = request.get_json(silent=True) or {}
    completed = data.get("completed")

    if completed not in [True, False, 0, 1]:
        return jsonify({"error": "Invalid completion status."}), 400

    with get_db_connection() as conn:
        cursor = conn.execute("""
            UPDATE tasks
            SET completed = ?
            WHERE id = ? AND user_id = ?
        """, (int(completed), task_id, session["user_id"]))

    if cursor.rowcount == 0:
        return jsonify({"error": "Task not found."}), 404

    return jsonify({"message": "Task updated successfully!"})


@app.route("/api/tasks/<int:task_id>", methods=["DELETE"])
@login_required
def delete_task(task_id):

    with get_db_connection() as conn:
        cursor = conn.execute("""
            DELETE FROM tasks
            WHERE id = ? AND user_id = ?
        """, (task_id, session["user_id"]))

    if cursor.rowcount == 0:
        return jsonify({"error": "Task not found."}), 404

    return jsonify({"message": "Task deleted successfully!"})


# ---------------- DAILY STUDY PLANNER ----------------

@app.route("/api/sessions", methods=["GET"])
@login_required
def get_sessions():

    with get_db_connection() as conn:
        sessions = conn.execute("""
            SELECT * FROM study_sessions
            WHERE user_id = ?
            ORDER BY study_date ASC, start_time ASC, id ASC
        """, (session["user_id"],)).fetchall()

    return jsonify([dict(item) for item in sessions])


@app.route("/api/sessions", methods=["POST"])
@login_required
def add_session():

    data = request.get_json(silent=True) or {}

    subject = data.get("subject", "").strip()
    study_date = data.get("study_date", "")
    start_time = data.get("start_time", "")
    notes = data.get("notes", "").strip()

    try:
        duration = int(data.get("duration_minutes", 0))
    except (TypeError, ValueError):
        return jsonify({"error": "Duration must be a number."}), 400

    if not subject or not study_date or not start_time:
        return jsonify({
            "error": "Subject, date, and start time are required."
        }), 400

    if duration < 5 or duration > 720:
        return jsonify({
            "error": "Duration must be between 5 and 720 minutes."
        }), 400

    with get_db_connection() as conn:
        cursor = conn.execute("""
            INSERT INTO study_sessions
                (subject, study_date, start_time,
                 duration_minutes, notes, user_id)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (
            subject,
            study_date,
            start_time,
            duration,
            notes,
            session["user_id"]
        ))

        session_id = cursor.lastrowid

    return jsonify({
        "message": "Study session added!",
        "id": session_id
    }), 201


@app.route("/api/sessions/<int:session_id>", methods=["PATCH"])
@login_required
def update_session(session_id):

    data = request.get_json(silent=True) or {}
    completed = data.get("completed")

    if completed not in [True, False, 0, 1]:
        return jsonify({"error": "Invalid completion status."}), 400

    with get_db_connection() as conn:
        cursor = conn.execute("""
            UPDATE study_sessions
            SET completed = ?
            WHERE id = ? AND user_id = ?
        """, (int(completed), session_id, session["user_id"]))

    if cursor.rowcount == 0:
        return jsonify({"error": "Study session not found."}), 404

    return jsonify({"message": "Study session updated!"})


@app.route("/api/sessions/<int:session_id>", methods=["DELETE"])
@login_required
def delete_session(session_id):

    with get_db_connection() as conn:
        cursor = conn.execute("""
            DELETE FROM study_sessions
            WHERE id = ? AND user_id = ?
        """, (session_id, session["user_id"]))

    if cursor.rowcount == 0:
        return jsonify({"error": "Study session not found."}), 404

    return jsonify({"message": "Study session deleted!"})


# ---------------- FREE STUDENT CHATBOT ----------------

@app.route("/api/chat", methods=["POST"])
@login_required
def chat():

    data = request.get_json(silent=True) or {}
    message = data.get("message", "").strip()

    if not message:
        return jsonify({"error": "Please enter a message."}), 400

    if len(message) > 4000:
        return jsonify({
            "error": "Please keep your message under 4000 characters."
        }), 400

    text = message.lower()

    if any(word in text.split() for word in ["hello", "hi", "hey"]):
        reply = (
            "Hello! Welcome to CampusMate AI! 🎓\n\n"
            "I'm your student study assistant. I can help you "
            "with Python, HTML, CSS, JavaScript, SQL, exam revision, "
            "and study planning.\n\n"
            "Try asking: Explain Python variables."
        )

    elif "variable" in text and "python" in text:
        reply = (
            "PYTHON VARIABLES\n\n"
            "A variable is a name used to store a value.\n\n"
            "Example:\n"
            "name = 'Gauri'\n"
            "age = 20\n\n"
            "Here, name stores text and age stores a number.\n\n"
            "You can display a variable using print():\n"
            "print(name)"
        )

    elif "python" in text:
        reply = (
            "PYTHON PROGRAMMING\n\n"
            "Python is a beginner-friendly programming language.\n\n"
            "Example:\n"
            "print('Hello, World!')\n\n"
            "Important topics to learn:\n"
            "1. Variables and data types\n"
            "2. Operators and conditions\n"
            "3. Loops\n"
            "4. Functions\n"
            "5. Lists and dictionaries\n"
            "6. Object-oriented programming\n\n"
            "Ask me about any of these topics."
        )

    elif "html" in text:
        reply = (
            "HTML BASICS\n\n"
            "HTML creates the structure of a webpage.\n\n"
            "Example:\n"
            "<h1>Welcome</h1>\n"
            "<p>This is my webpage.</p>\n"
            "<a href='https://example.com'>Visit website</a>\n\n"
            "Common HTML elements include headings, paragraphs, "
            "links, images, tables, and forms."
        )

    elif "css" in text:
        reply = (
            "CSS BASICS\n\n"
            "CSS controls how a webpage looks.\n\n"
            "Example:\n"
            "h1 {\n"
            "    color: purple;\n"
            "    text-align: center;\n"
            "}\n\n"
            "CSS is used for colors, fonts, spacing, layouts, "
            "animations, and responsive design."
        )

    elif "javascript" in text or " js " in f" {text} ":
        reply = (
            "JAVASCRIPT BASICS\n\n"
            "JavaScript makes webpages interactive.\n\n"
            "Example:\n"
            "let marks = 85;\n"
            "if (marks >= 40) {\n"
            "    console.log('Pass');\n"
            "}\n\n"
            "JavaScript can handle button clicks, form validation, "
            "and dynamic webpage content."
        )

    elif any(word in text for word in ["database", "sqlite", "sql"]):
        reply = (
            "DATABASE BASICS\n\n"
            "A database stores and organizes information.\n\n"
            "Your CampusMate AI project uses SQLite to store tasks "
            "and study sessions.\n\n"
            "Important SQL commands:\n"
            "SELECT - retrieve data\n"
            "INSERT - add data\n"
            "UPDATE - change data\n"
            "DELETE - remove data\n\n"
            "Example:\n"
            "SELECT * FROM tasks;"
        )

    elif "difference" in text and any(
        word in text for word in ["html", "css", "javascript"]
    ):
        reply = (
            "HTML vs CSS vs JavaScript\n\n"
            "HTML: Provides the structure of a webpage.\n"
            "CSS: Controls its appearance and layout.\n"
            "JavaScript: Adds behavior and interactivity.\n\n"
            "Think of a webpage as a house:\n"
            "HTML is the structure, CSS is the decoration, "
            "and JavaScript makes things work."
        )

    elif any(word in text for word in ["exam", "revision", "quiz"]):
        reply = (
            "EXAM PREPARATION PLAN\n\n"
            "1. List the topics in your syllabus.\n"
            "2. Study one topic for 25 minutes.\n"
            "3. Take a 5-minute break.\n"
            "4. Practise questions without looking at notes.\n"
            "5. Review mistakes and revise difficult topics.\n\n"
            "Tip: Test yourself regularly instead of only rereading "
            "your notes."
        )

    elif any(word in text for word in ["study", "timetable", "schedule"]):
        reply = (
            "STUDY PLANNING\n\n"
            "Try this simple routine:\n\n"
            "25 minutes: Learn a topic\n"
            "5 minutes: Take a break\n"
            "25 minutes: Practise questions\n"
            "10 minutes: Review what you learned\n\n"
            "Use the CampusMate AI study planner to save your "
            "subjects, dates, and study sessions."
        )

    elif any(word in text for word in ["motivate", "motivation", "tired"]):
        reply = (
            "YOU CAN DO THIS! 🌟\n\n"
            "You don't have to finish everything at once. "
            "Choose one small task and work on it for 10 minutes.\n\n"
            "Small, consistent progress is better than waiting "
            "for the perfect moment to begin."
        )

    elif "help" in text or "what can you do" in text:
        reply = (
            "CAMPUSMATE AI - HOW I CAN HELP\n\n"
            "• Python programming\n"
            "• HTML and CSS\n"
            "• JavaScript basics\n"
            "• SQL and SQLite\n"
            "• Exam revision strategies\n"
            "• Study planning and motivation\n\n"
            "Try: Explain Python variables."
        )

    else:
        reply = (
            "Thanks for your question!\n\n"
            "I'm currently using the free rule-based version "
            "of CampusMate AI. I can answer common questions about "
            "Python, HTML, CSS, JavaScript, SQL, exams, and studying.\n\n"
            "Try asking:\n"
            "• Explain Python variables\n"
            "• What is HTML?\n"
            "• Explain SQL databases\n"
            "• Give me an exam revision plan"
        )

    return jsonify({"reply": reply})


# ---------------- HEALTH CHECK ----------------

@app.route("/health")
def health():

    with get_db_connection() as conn:
        conn.execute("SELECT 1")

    return jsonify({
        "status": "running",
        "database": "connected"
    })


# ---------------- START APPLICATION ----------------

if __name__ == "__main__":

    initialize_database()

    print("CampusMate AI is starting...")
    print(f"Database location: {DATABASE}")
    print("Chatbot mode: Free rule-based assistant")
    print("Open http://127.0.0.1:5000 in your browser")

    app.run(debug=True)

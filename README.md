# CampusMate AI – A Smart Student Life Assistant

CampusMate AI is a web-based student productivity application developed using Python, Flask, SQLite, HTML, CSS and JavaScript.

It provides a centralized platform that helps students organize academic tasks, plan study sessions, manage focus periods, attempt quizzes and monitor their learning progress.

## Features

- **User Authentication:** Student registration, login and logout.
- **Dashboard:** Centralized overview of academic activities.
- **Task Management:** Create, view, update and delete study tasks.
- **Study Planner:** Schedule study sessions with dates, times and durations.
- **Focus Timer:** Structured 25-minute focus and 5-minute break sessions.
- **Knowledge Check:** Subject-based quizzes covering Python, HTML, CSS, JavaScript and SQL.
- **Progress Tracking:** Monitor quiz results and task completion.
- **Study Analytics:** Visualize weekly study activity and quiz performance.
- **Daily Summary:** View pending tasks and upcoming study sessions.
- **Student Assistant:** Rule-based chatbot for basic academic guidance.

## Technology Stack

| Technology | Purpose |
|---|---|
| Python | Backend programming |
| Flask | Web application framework |
| SQLite | Database management |
| HTML5 | Webpage structure |
| CSS3 | Styling and layout |
| JavaScript | Frontend interactivity |
| Werkzeug | Password hashing and security utilities |
| Visual Studio Code | Development environment |
| Git and GitHub | Version control and project hosting |

## Project Structure

```text
CampusMateAI/
│
├── app.py
├── requirements.txt
├── README.md
├── README.txt
├── .gitignore
│
├── templates/
│   ├── index.html
│   ├── landing.html
│   └── auth.html
│
└── static/
    ├── style.css
    ├── auth.css
    └── script.js
```

## Installation and Setup

### 1. Clone the repository

```bash
git clone YOUR_GITHUB_REPOSITORY_URL
```

### 2. Open the project folder

```bash
cd CampusMateAI
```

### 3. Create a virtual environment

```bash
python -m venv venv
```

### 4. Activate the virtual environment (Windows PowerShell)

```powershell
.\venv\Scripts\Activate.ps1
```

### 5. Install dependencies

```bash
pip install -r requirements.txt
```

### 6. Run the application

```bash
python app.py
```

Open your browser and visit:

http://127.0.0.1:5000

## Database

CampusMate AI uses SQLite to store user accounts, study tasks, study sessions, quiz results and focus-session records.

The database is initialized by the application when required. Local database files are excluded from the GitHub repository.

## Security

- Password hashing using Werkzeug.
- Flask session-based authentication.
- Authentication-protected API endpoints.
- Parameterized SQL queries.
- User-specific academic records.

## Future Enhancements

- Generative AI-powered student assistant.
- Personalized study recommendations.
- Email and push notifications.
- Calendar integration.
- PostgreSQL database support.
- Advanced learning analytics.

## Author

Developed as an academic full-stack web development project.

## License

This project is available for educational and learning purposes.
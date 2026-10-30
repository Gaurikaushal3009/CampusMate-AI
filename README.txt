CAMPUSMATE AI — UPDATED PROJECT

Included features:
- Landing page and student signup/login/logout
- Password hashing with Werkzeug and account-specific Flask sessions
- Account-scoped task manager and study planner
- SQLite-backed quiz results and completed focus sessions
- Weekly activity and quiz performance charts (drawn locally; no chart API required)
- Daily summary and upcoming task/study reminders
- Existing knowledge quizzes and rule-based student assistant

RUN ON WINDOWS
1. Open this folder in VS Code.
2. In the VS Code terminal run: python -m pip install -r requirements.txt
3. Run: python app.py
4. Open http://127.0.0.1:5000
5. Create an account. Existing unassigned tasks/sessions in an older database are assigned to the first account created.

DATABASE
The app creates campusmate.db beside app.py and migrates the older tasks/study_sessions tables automatically. Keep a backup of your original database before replacing files.

SECURITY NOTE
The included secret key is for local development only. Before public deployment, set CAMPUSMATE_SECRET_KEY to a long random secret and use HTTPS.

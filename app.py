# app.py
from dotenv import load_dotenv
import os

# Load .env file manually
load_dotenv()

import sqlite3, io
from flask import Flask, request, render_template, redirect, url_for, session, send_file, flash
from werkzeug.security import generate_password_hash, check_password_hash
import boto3
from google import genai
from PyPDF2 import PdfReader
from pptx import Presentation
from docx import Document

app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY", "dev-key")

# SQLite setup
def get_db():
    conn = sqlite3.connect("studymate.db")
    conn.execute("""CREATE TABLE IF NOT EXISTS users(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE,
        password_hash TEXT
    )""")
    conn.execute("""CREATE TABLE IF NOT EXISTS jobs(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        title TEXT,
        s3_input_key TEXT,
        s3_output_key TEXT,
        kind TEXT
    )""")
    return conn

# AWS S3
S3_BUCKET = os.environ["S3_BUCKET"]
AWS_REGION = os.environ.get("AWS_REGION", "us-east-1")
s3 = boto3.client("s3", region_name=AWS_REGION)

# Gemini client
ai = genai.Client(api_key=os.environ["GEMINI_API_KEY"])

@app.route("/")
def index():
    return redirect(url_for("signin"))

@app.route("/signup", methods=["GET", "POST"])
def signup():
    if request.method == "POST":
        email = request.form["email"].strip().lower()
        pw = request.form["password"]
        pw_hash = generate_password_hash(pw)
        db = get_db()
        try:
            db.execute("INSERT INTO users(email,password_hash) VALUES(?,?)", (email, pw_hash))
            db.commit()
            flash("Account created, please sign in.")
            return redirect(url_for("signin"))
        except sqlite3.IntegrityError:
            flash("Email already registered.")
    return render_template("signup.html", title="Sign up")

@app.route("/signin", methods=["GET", "POST"])
def signin():
    if request.method == "POST":
        email = request.form["email"].strip().lower()
        pw = request.form["password"]
        db = get_db()
        row = db.execute("SELECT id,password_hash FROM users WHERE email=?", (email,)).fetchone()
        if row and check_password_hash(row[1], pw):
            session["user_id"] = row[0]
            return redirect(url_for("dashboard"))
        flash("Invalid credentials.")
    return render_template("signin.html", title="Sign in")

@app.route("/dashboard")
def dashboard():
    if "user_id" not in session:
        return redirect(url_for("signin"))
    db = get_db()
    items = db.execute(
        "SELECT id,title,kind,s3_output_key,s3_input_key FROM jobs WHERE user_id=? ORDER BY id DESC",
        (session["user_id"],)
    ).fetchall()
    
    # Extract original filenames for display
    items_with_filenames = []
    for item in items:
        # Extract original filename from input key (inputs/user_id/filename.ext)
        original_filename = item[4].split('/')[-1] if item[4] else "Unknown File"
        items_with_filenames.append({
            'id': item[0],
            'title': item[1], 
            'kind': item[2],
            's3_output_key': item[3],
            'original_filename': original_filename
        })
    
    return render_template("dashboard.html", title="Dashboard", items=items_with_filenames)

@app.route("/signout")
def signout():
    session.clear()
    flash("Successfully signed out.")
    return redirect(url_for("signin"))

def s3_put_fileobj(fileobj, key, content_type):
    s3.upload_fileobj(fileobj, S3_BUCKET, key, ExtraArgs={"ContentType": content_type or "application/octet-stream"})

def extract_text_from_pdf(file_stream):
    file_stream.seek(0)
    reader = PdfReader(file_stream)
    texts = []
    for p in reader.pages:
        texts.append(p.extract_text() or "")
    return "\n".join(texts)

def extract_text_from_pptx(file_stream):
    file_stream.seek(0)
    prs = Presentation(file_stream)
    out = []
    for slide in prs.slides:
        for shape in slide.shapes:
            if hasattr(shape, "text"):
                out.append(shape.text)
    return "\n".join(out)

def extract_text_from_docx(file_stream):
    file_stream.seek(0)
    doc = Document(file_stream)
    return "\n".join(p.text for p in doc.paragraphs)

# Gemini helpers
MODEL_ID = "gemini-2.0-flash"

def summarize_text(text):
    prompt = "Summarize into concise bullet points with clear headings:\n\n" + text[:20000]
    resp = ai.models.generate_content(model=MODEL_ID, contents=prompt)
    return resp.text

def generate_mcqs(text):
    prompt = (
        "Create 10 MCQs with 4 options each and an answer key at the end; target undergraduate level:\n\n"
        + text[:20000]
    )
    resp = ai.models.generate_content(model=MODEL_ID, contents=prompt)
    return resp.text

def make_notes(text):
    prompt = (
        "Convert into well-structured study notes with sections, subheadings, terms, and brief definitions:\n\n"
        + text[:20000]
    )
    resp = ai.models.generate_content(model=MODEL_ID, contents=prompt)
    return resp.text

def generate_flashcards(text):
    prompt = (
        "Create 15-20 flashcards from the following content. Format each flashcard as:\n"
        "FRONT: [Question/Term/Concept]\n"
        "BACK: [Answer/Definition/Explanation]\n\n"
        "Make the flashcards concise, clear, and focused on key concepts. Include important terms, definitions, formulas, and key facts.\n\n"
        + text[:20000]
    )
    resp = ai.models.generate_content(model=MODEL_ID, contents=prompt)
    return resp.text

@app.route("/upload", methods=["POST"])
def upload():
    if "user_id" not in session:
        return redirect(url_for("signin"))

    f = request.files.get("file")
    kind = request.form.get("kind")  # summarize | mcq | notes | flashcards
    if not f or kind not in {"summarize", "mcq", "notes", "flashcards"}:
        flash("Please choose a file and a tool.")
        return redirect(url_for("dashboard"))

    # Read file data once into memory
    f.stream.seek(0)
    data = f.read()
    
    # Save input to S3 using BytesIO from the data
    key_in = f"inputs/{session['user_id']}/{f.filename}"
    s3_put_fileobj(io.BytesIO(data), key_in, f.mimetype)

    # Extract text from the same data
    ext = (f.filename.rsplit(".", 1)[-1] or "").lower()
    text = ""
    
    if ext == "pdf":
        text = extract_text_from_pdf(io.BytesIO(data))
    elif ext in {"ppt", "pptx"}:
        text = extract_text_from_pptx(io.BytesIO(data))
    elif ext in {"doc", "docx"}:
        text = extract_text_from_docx(io.BytesIO(data))
    else:
        # Fallback: treat as text
        try:
            text = data.decode('utf-8')
        except Exception:
            text = ""

    if not text.strip():
        flash("Could not extract text from file. Please try a different file.")
        return redirect(url_for("dashboard"))

    # Call Gemini
    try:
        if kind == "summarize":
            result = summarize_text(text)
            title = "Summary"
        elif kind == "mcq":
            result = generate_mcqs(text)
            title = "MCQ Quiz"
        elif kind == "flashcards":
            result = generate_flashcards(text)
            title = "Flash Cards"
        else:
            result = make_notes(text)
            title = "Notes"
    except Exception as e:
        flash(f"AI generation failed: {str(e)}")
        return redirect(url_for("dashboard"))

    # Save output to S3
    out_key = f"outputs/{session['user_id']}/{title}-{f.filename}.txt"
    s3.put_object(
        Bucket=S3_BUCKET,
        Key=out_key,
        Body=result.encode("utf-8"),
        ContentType="text/plain",
    )

    # Record job
    db = get_db()
    db.execute(
        "INSERT INTO jobs(user_id,title,s3_input_key,s3_output_key,kind) VALUES(?,?,?,?,?)",
        (session["user_id"], title, key_in, out_key, kind),
    )
    db.commit()

    flash(f"{title} ready to download.")
    return redirect(url_for("dashboard"))

@app.route("/download/<int:job_id>")
def download(job_id):
    if "user_id" not in session:
        return redirect(url_for("signin"))
    db = get_db()
    row = db.execute(
        "SELECT s3_output_key FROM jobs WHERE id=? AND user_id=?",
        (job_id, session["user_id"]),
    ).fetchone()
    if not row:
        return "Not found", 404
    key = row[0]
    obj = s3.get_object(Bucket=S3_BUCKET, Key=key)
    return send_file(
        io.BytesIO(obj["Body"].read()),
        as_attachment=True,
        download_name=os.path.basename(key),
        mimetype="text/plain",
    )

if __name__ == "__main__":
    app.run(debug=True)

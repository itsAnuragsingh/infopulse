# InfoPulse FastAPI Backend Deployment Guide

This guide provides step-by-step instructions on how to deploy the Python FastAPI backend of the AI Data Cleaner application for **free** on **Render.com**. 

We have chosen **Render** because it provides a fully free tier for Python web services, automatically handles SSL/HTTPS, builds directly from your GitHub repository on every push, and natively manages environment variables.

---

## Prerequisites

Before starting, make sure you have:
1. A **GitHub** account.
2. Your project repository pushed to GitHub.
3. A **Render** account (you can sign up for free using your GitHub account at [render.com](https://render.com)).

---

## 🛠️ Step 1: Prepare Code for Production

FastAPI uses **Uvicorn** to run locally. On a production server, it needs to bind to host `0.0.0.0` and dynamic port `$PORT` provided by Render.

### 1. Requirements Check
Ensure the `backend/requirements.txt` file is in the project repository. Render will read this file to install dependencies. Your current dependencies include:
* `fastapi`
* `uvicorn[standard]`
* `pandas`
* `numpy`
* `scikit-learn`
* `python-multipart`
* `google-genai`
* `groq`

### 2. CORS (Cross-Origin Resource Sharing) Configuration
In [backend/main.py](file:///d:/Final%20Year%20project/ai-data-cleaner/backend/main.py#L42-L58), the CORS middleware is currently configured to allow `localhost`. Once you deploy your frontend (e.g., to Vercel or Netlify), you can update the origins array or leave it as `*` (allow all) for testing:
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Set this to your frontend URL in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

---

## 🚀 Step 2: Deploying to Render

1. Log in to the [Render Dashboard](https://dashboard.render.com).
2. Click the **New +** button on the top right and select **Web Service**.
3. Choose **Build and deploy from a Git repository** and connect your connected GitHub repository.
4. Fill in the configuration details exactly as follows:

| Field | Configuration Value |
| :--- | :--- |
| **Name** | `infopulse-backend` (or any name you prefer) |
| **Region** | Select the region closest to you (e.g., `Singapore` or `Oregon`) |
| **Branch** | `main` (or your active production branch) |
| **Root Directory** | *Leave empty* (or enter `backend` if you want to deploy only the backend subdirectory) |
| **Runtime** | `Python` |
| **Build Command** | `pip install -r backend/requirements.txt` |
| **Start Command** | `uvicorn backend.main:app --host 0.0.0.0 --port $PORT` |
| **Instance Type** | **Free** |

### 5. Add Environment Variables
Before clicking deploy, scroll down and click **Advanced** -> **Add Environment Variable**. Add the following:

| Key | Value | Description |
| :--- | :--- | :--- |
| `PYTHON_VERSION` | `3.10.0` (or your Python version) | Tells Render which Python runtime version to build. |
| `GEMINI_API_KEY` | `your_gemini_api_key_here` | Your actual Gemini API key (optional if using Groq). |
| `GROQ_API_KEY` | `your_groq_api_key_here` | Your actual Groq API key (optional if using Gemini). |

6. Click **Create Web Service**.

---

## ⚡ Step 3: Connect Frontend to Deployed Backend

Once Render finishes building, it will display a live URL at the top left of the dashboard (e.g., `https://infopulse-backend.onrender.com`).

To point your frontend to this new API:
1. Open your React frontend configuration (or where Axios calls are made).
2. In [frontend/src/App.jsx](file:///d:/Final%20Year%20project/ai-data-cleaner/frontend/src/App.jsx), locate the `axios` requests.
3. Change the base URL:
   * **From:** `http://localhost:8000/chat`
   * **To:** `https://your-render-app-url.onrender.com/chat` (use your actual Render web service URL).

---

## ⚠️ Important Details About Render's Free Tier

* **Cold Starts (Spin Down):** On the Free tier, Render automatically spins down your web service after **15 minutes of inactivity**. When a new request arrives, Render will reboot the container, causing a **50-second delay** on the first API request. This is completely normal for free hosting.
* **Ephemeral Storage:** Render's free filesystem is temporary. Uploaded files or generated reports will disappear when the container restarts. Since InfoPulse processes data in memory and allows users to download CSV/PDF/SQL directly, this will not affect functionality.

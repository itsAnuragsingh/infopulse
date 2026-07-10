import pandas as pd
import numpy as np
from fastapi import FastAPI, UploadFile, File, HTTPException, Form, Body
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import io
import os
import json
import hashlib
import re
from typing import List, Dict, Any, Optional
from datetime import datetime
from contextlib import asynccontextmanager
from google import genai
from google.genai import types

from data_processor import process_dataset, get_correlation_matrix, get_column_stats, generate_pdf_report

# --- Configuration ---
UPLOAD_DIR = "uploaded_files"
CLEANED_DIR = "cleaned_files"
HASH_DB_FILE = "cleaned_file_hashes.json"

# --- Helper: Hash Functions ---
def load_known_hashes():
    if os.path.exists(HASH_DB_FILE):
        try:
            with open(HASH_DB_FILE, "r", encoding="utf-8") as f: return set(json.load(f))
        except: return set()
    return set()

def save_new_hash(file_hash):
    hashes = load_known_hashes()
    hashes.add(file_hash)
    with open(HASH_DB_FILE, "w", encoding="utf-8") as f: json.dump(list(hashes), f)

def calculate_hash(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()

def interpret_natural_language(query: str, columns: List[str]) -> str:
    query = query.lower()
    target_col = None
    columns_sorted = sorted(columns, key=len, reverse=True)
    for col in columns_sorted:
        if col.lower() in query:
            target_col = col
            break
    if not target_col: return ""
    operator = "="
    if any(w in query for w in ["greater", "more", "above", "over", "higher", ">"]): operator = ">"
    elif any(w in query for w in ["less", "lower", "under", "below", "<"]): operator = "<"
    elif any(w in query for w in ["equal", "is", "match", "same", "="]): operator = "="
    numbers = re.findall(r"[-+]?\d*\.\d+|\d+", query)
    value = numbers[-1] if numbers else (query.split()[-1] if len(query.split()) > 1 else None)
    if not value: return ""
    return f"{target_col} {operator} {value}"

@asynccontextmanager
async def lifespan(app: FastAPI):
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    os.makedirs(CLEANED_DIR, exist_ok=True)
    print("InfoPulse AI Backend is running...")
    yield

app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class Insights(BaseModel):
    request_id: str
    rows_original: int
    rows_cleaned: int
    anomalies_detected: int
    duplicates_removed: int
    pii_masked: int
    quality_score: float
    summary: str
    logs: List[str]
    numeric_columns: List[str]
    generated_sql: str
    column_stats: List[Dict[str, Any]]
    correlation_matrix: List[Dict[str, Any]]
    anomaly_list: Optional[List[Dict[str, Any]]] = []

class DataResponse(BaseModel):
    request_id: str
    insights: Insights
    preview_original: List[Dict[str, Any]]
    preview_cleaned: List[Dict[str, Any]]

class AskRequest(BaseModel):
    query: str
    columns: List[str]

class AskResponse(BaseModel):
    filter_string: str
    explanation: str

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    message: str
    history: List[ChatMessage]
    insights: Dict[str, Any]
    filename: Optional[str] = "dataset.csv"

class ChatResponse(BaseModel):
    response: str

# --- Helper: Gemini API Call ---
def get_gemini_api_key():
    # 1. Check environment variables
    key = os.environ.get("GEMINI_API_KEY")
    if key:
        return key.strip()
    
    # 2. Check for a .env file in common locations relative to this script
    script_dir = os.path.dirname(os.path.abspath(__file__))
    env_paths = [
        os.path.join(script_dir, ".env"),
        os.path.join(script_dir, "..", ".env"),
        ".env",
        "backend/.env",
        "../.env"
    ]
    for path in env_paths:
        if os.path.exists(path):
            try:
                with open(path, "r", encoding="utf-8") as f:
                    for line in f:
                        line = line.strip()
                        if "=" in line and not line.startswith("#"):
                            k, v = line.split("=", 1)
                            if k.strip() == "GEMINI_API_KEY":
                                return v.strip().strip("'").strip('"')
            except:
                pass
    return None

def call_gemini_api(prompt: str, api_key: str, history: List[ChatMessage] = None, system_prompt: str = "") -> str:
    try:
        client = genai.Client(api_key=api_key)
        
        # Build contents structure from history
        contents = []
        if history:
            for msg in history:
                role = "user" if msg.role == "user" else "model"
                contents.append({
                    "role": role,
                    "parts": [{"text": msg.content}]
                })
        
        # Append latest message if not in history
        if not history or history[-1].content != prompt:
            contents.append({
                "role": "user",
                "parts": [{"text": prompt}]
            })
            
        config = types.GenerateContentConfig(
            system_instruction=system_prompt
        )
        
        models_to_try = ['gemini-3.5-flash', 'gemini-2.5-flash', 'gemini-1.5-flash']
        last_error = None
        
        for model_name in models_to_try:
            try:
                response = client.models.generate_content(
                    model=model_name,
                    contents=contents,
                    config=config
                )
                return response.text
            except Exception as e:
                last_error = str(e)
                print(f"Model {model_name} failed: {last_error}")
                continue
                
        return f"Error from Google GenAI SDK (Tried {', '.join(models_to_try)}): {last_error}"
    except Exception as e:
        return f"Failed to initialize Google GenAI SDK: {str(e)}"

# --- Helper: Groq API Call ---
def get_groq_api_key():
    # 1. Check environment variables
    key = os.environ.get("GROQ_API_KEY")
    if key:
        return key.strip()
    
    # 2. Check for a .env file in common locations relative to this script
    script_dir = os.path.dirname(os.path.abspath(__file__))
    env_paths = [
        os.path.join(script_dir, ".env"),
        os.path.join(script_dir, "..", ".env"),
        ".env",
        "backend/.env",
        "../.env"
    ]
    for path in env_paths:
        if os.path.exists(path):
            try:
                with open(path, "r", encoding="utf-8") as f:
                    for line in f:
                        line = line.strip()
                        if "=" in line and not line.startswith("#"):
                            k, v = line.split("=", 1)
                            if k.strip() == "GROQ_API_KEY":
                                return v.strip().strip("'").strip('"')
            except:
                pass
    return None

def call_groq_api(prompt: str, api_key: str, history: List[ChatMessage] = None, system_prompt: str = "") -> str:
    try:
        from groq import Groq
        client = Groq(api_key=api_key)
        
        messages = []
        if system_prompt:
            messages.append({
                "role": "system",
                "content": system_prompt
            })
        if history:
            for msg in history:
                role = "user" if msg.role == "user" else "assistant"
                messages.append({
                    "role": role,
                    "content": msg.content
                })
        if not history or history[-1].content != prompt:
            messages.append({
                "role": "user",
                "content": prompt
            })

        chat_completion = client.chat.completions.create(
            messages=messages,
            model="llama-3.3-70b-versatile"
        )
        return chat_completion.choices[0].message.content
    except Exception as e:
        return f"Error from Groq SDK: {str(e)}"


# --- Endpoints ---

@app.post("/upload", response_model=DataResponse)
async def upload_file(
    file: UploadFile = File(...),
    mask_pii: bool = Form(True),
    impute_numeric: str = Form("median"),
    anomaly_contamination: float = Form(0.05),
    run_typo_correction: bool = Form(True),
    typo_threshold: float = Form(0.75),
    run_date_formatting: bool = Form(True),
    run_numeric_parsing: bool = Form(True)
):
    request_id = datetime.now().strftime("%Y%m%d%H%M%S") + "_" + str(np.random.randint(1000, 9999))
    
    try: file_content = await file.read()
    except Exception as e: raise HTTPException(status_code=500, detail=f"Failed to read file: {e}")

    incoming_hash = calculate_hash(file_content)
    known_hashes = load_known_hashes()
    is_already_clean = incoming_hash in known_hashes

    if is_already_clean:
        print(f"File {file.filename} identified as already clean.")
        try:
            if file.filename.endswith('.csv'): df = pd.read_csv(io.BytesIO(file_content))
            else: df = pd.read_excel(io.BytesIO(file_content))
        except: df = pd.read_csv(io.BytesIO(file_content), encoding='latin1')

        rows_count = len(df)
        numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
        preview = df.head(50).replace({np.nan: None}).to_dict(orient='records')
        
        insights = Insights(
            request_id=request_id,
            rows_original=rows_count,
            rows_cleaned=rows_count,
            anomalies_detected=0,
            duplicates_removed=0,
            pii_masked=0,
            quality_score=100.0,
            summary="✨ This file has already been processed by InfoPulse AI. No further cleaning was required.",
            logs=["File fingerprint matched known clean dataset.", "Skipped anomaly detection pipeline.", "Data loaded directly for visualization."],
            numeric_columns=numeric_cols,
            generated_sql="-- File was already clean; no transformation SQL generated.",
            column_stats=get_column_stats(df),
            correlation_matrix=get_correlation_matrix(df)
        )
        
        with open(os.path.join(CLEANED_DIR, f"{request_id}_insights.json"), "w", encoding="utf-8") as f:
            f.write(insights.model_dump_json())

        uploaded_filepath = os.path.join(UPLOAD_DIR, f"{request_id}{os.path.splitext(file.filename)[1]}")
        cleaned_filepath = os.path.join(CLEANED_DIR, f"{request_id}_cleaned.csv")
        with open(uploaded_filepath, "wb") as f: f.write(file_content)
        df.to_csv(cleaned_filepath, index=False)
        
        return DataResponse(request_id=request_id, insights=insights, preview_original=preview, preview_cleaned=preview)

    # Normal Processing
    file_extension = os.path.splitext(file.filename)[1].lower()
    uploaded_filepath = os.path.join(UPLOAD_DIR, f"{request_id}{file_extension}")
    try:
        with open(uploaded_filepath, "wb") as buffer: buffer.write(file_content)
        df_cleaned, insights_dict, preview_original, preview_cleaned = process_dataset(
            file_content=file_content,
            filename=file.filename,
            mask_pii=mask_pii,
            impute_numeric=impute_numeric,
            anomaly_contamination=anomaly_contamination,
            run_typo_correction=run_typo_correction,
            typo_threshold=typo_threshold,
            run_date_formatting=run_date_formatting,
            run_numeric_parsing=run_numeric_parsing
        )
        
        cleaned_csv_str = df_cleaned.to_csv(index=False)
        cleaned_hash = calculate_hash(cleaned_csv_str.encode('utf-8'))
        save_new_hash(cleaned_hash)
        
        insights = Insights(request_id=request_id, **insights_dict)
        
        with open(os.path.join(CLEANED_DIR, f"{request_id}_insights.json"), "w", encoding="utf-8") as f:
            f.write(insights.model_dump_json())

    except ValueError as e:
        import traceback
        traceback.print_exc()
        if os.path.exists(uploaded_filepath): os.remove(uploaded_filepath)
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        import traceback
        traceback.print_exc()
        if os.path.exists(uploaded_filepath): os.remove(uploaded_filepath)
        raise HTTPException(status_code=500, detail=f"Server Error: {e}")

    cleaned_filepath = os.path.join(CLEANED_DIR, f"{request_id}_cleaned.csv")
    df_cleaned.to_csv(cleaned_filepath, index=False)

    return DataResponse(request_id=request_id, insights=insights, preview_original=preview_original, preview_cleaned=preview_cleaned)

@app.post("/ask", response_model=AskResponse)
async def ask_ai(request: AskRequest):
    try:
        filter_str = interpret_natural_language(request.query, request.columns)
        if not filter_str: return AskResponse(filter_string="", explanation="I couldn't quite understand that. Try 'Age > 30'.")
        return AskResponse(filter_string=filter_str, explanation=f"Applying filter: {filter_str}")
    except Exception as e: raise HTTPException(status_code=500, detail=str(e))

@app.post("/chat", response_model=ChatResponse)
async def chat_with_dataset(request: ChatRequest):
    gemini_key = get_gemini_api_key()
    groq_key = get_groq_api_key()
    
    if not gemini_key and not groq_key:
        return ChatResponse(
            response="⚠️ **API Keys are missing!**\n\nPlease add a `.env` file in the project directory containing either `GEMINI_API_KEY=your_key` or `GROQ_API_KEY=your_key`, and restart your server."
        )
        
    insights = request.insights
    cols = insights.get("column_stats", [])
    summary_text = insights.get("summary", "No summary available.")
    
    col_breakdown = []
    for c in cols:
        col_breakdown.append(
            f"- {c.get('name')} (Type: {c.get('type')}, Missing: {c.get('missing')}, Unique: {c.get('unique')}, Sample: {c.get('sample')})"
        )
    col_breakdown_str = "\n".join(col_breakdown)
    
    system_prompt = f"""You are the InfoPulse AI Data Assistant, a highly capable data scientist and general AI assistant.
You are helping the user with data cleaning, analysis, general data science topics, coding, and general conversational queries.

The user has uploaded a dataset named '{request.filename}'. Here is the metadata profiling generated by our pipeline:
- Original Rows: {insights.get('rows_original')}
- Cleaned Rows: {insights.get('rows_cleaned')}
- Duplicate Rows Removed: {insights.get('duplicates_removed')}
- Outlier Anomalies Detected: {insights.get('anomalies_detected')}
- PII Masked Instances: {insights.get('pii_masked')}
- Data Quality Index (Health Score): {insights.get('quality_score')}%
- Cleaning Summary: {summary_text}

Dataset Column Schema & Profiling Stats:
{col_breakdown_str}

Guidelines for your responses:
1. You can answer general conversation, greetings, and generic coding/data science/machine learning questions naturally.
2. When the user asks about the loaded dataset, refer to the provided insights and schema details.
3. If the user asks about the schema, column stats, or tabular data, always present it in a clean markdown table (e.g., | Column Name | Type | Missing | Unique |) for optimal presentation.
4. If the user asks about anomalies, duplicates, or PII masking, explain how they were handled by the pipeline.
5. Offer Python/pandas code snippets or SQL queries to help them further analyze or visualize their data when appropriate.
6. Keep formatting clean, using standard bold tags and bullet points for readability. Use standard text weight for responses.
"""

    response_text = ""
    used_gemini = False
    
    # 1. Try Gemini first if key is present
    if gemini_key:
        used_gemini = True
        response_text = call_gemini_api(
            prompt=request.message,
            api_key=gemini_key,
            history=request.history,
            system_prompt=system_prompt
        )
        
        # If Gemini succeeded, return it
        if not response_text.startswith("Error from Google GenAI SDK") and not response_text.startswith("Failed to initialize Google GenAI SDK"):
            return ChatResponse(response=response_text)
            
    # 2. Try Groq if Gemini key was missing OR if Gemini call failed
    if groq_key:
        fallback_msg = "*(System: Gemini failed; fell back to Groq Llama 3.3)*\n\n" if used_gemini else ""
        groq_response = call_groq_api(
            prompt=request.message,
            api_key=groq_key,
            history=request.history,
            system_prompt=system_prompt
        )
        if not groq_response.startswith("Error from Groq SDK"):
            return ChatResponse(response=fallback_msg + groq_response)
        else:
            if used_gemini:
                return ChatResponse(response=f"⚠️ **Both API providers failed to respond.**\n\n**Gemini Error:** {response_text}\n\n**Groq Error:** {groq_response}")
            return ChatResponse(response=f"⚠️ **Groq API failed:** {groq_response}")
        
    # If we tried Gemini and failed, and had no Groq key, return the Gemini error
    if used_gemini:
        return ChatResponse(response=response_text)
        
    return ChatResponse(response="⚠️ Unexpected error resolving API calls. Please verify your keys in the .env file.")

@app.get("/download/{request_id}")
async def download_file(request_id: str, format: str = "csv"):
    cleaned_filepath = os.path.join(CLEANED_DIR, f"{request_id}_cleaned.csv")
    if not os.path.exists(cleaned_filepath): raise HTTPException(status_code=404, detail="Cleaned file not found.")
    
    if format == "csv":
        return FileResponse(path=cleaned_filepath, filename=f"InfoPulse_{request_id}.csv", media_type='text/csv')
    
    if format == "pdf":
        insights_path = os.path.join(CLEANED_DIR, f"{request_id}_insights.json")
        pdf_path = os.path.join(CLEANED_DIR, f"{request_id}_report.pdf")
        
        if not os.path.exists(insights_path):
             raise HTTPException(status_code=404, detail="Insights data for report not found.")
             
        if not os.path.exists(pdf_path):
            with open(insights_path, 'r', encoding='utf-8') as f: insights = json.load(f)
            df = pd.read_csv(cleaned_filepath)
            generate_pdf_report(df, insights, pdf_path)
            
        return FileResponse(path=pdf_path, filename=f"InfoPulse_Report_{request_id}.pdf", media_type='application/pdf')

    df = pd.read_csv(cleaned_filepath)

    if format == "json":
        json_str = df.to_json(orient="records", indent=2)
        return StreamingResponse(io.StringIO(json_str), media_type="application/json", headers={"Content-Disposition": f"attachment; filename=InfoPulse_{request_id}.json"})

    elif format == "sql":
        table_name = "cleaned_data"
        sql_buffer = io.StringIO()
        sql_buffer.write(f"CREATE TABLE {table_name} (\n")
        cols = []
        for col, dtype in df.dtypes.items():
            col_name = str(col).replace(' ', '_').replace('-', '_')
            sql_type = "TEXT"
            if pd.api.types.is_integer_dtype(dtype): sql_type = "INT"
            elif pd.api.types.is_float_dtype(dtype): sql_type = "FLOAT"
            cols.append(f"    {col_name} {sql_type}")
        sql_buffer.write(",\n".join(cols))
        sql_buffer.write("\n);\n\n")
        for _, row in df.iterrows():
            vals = []
            for v in row:
                if pd.isna(v): 
                    vals.append("NULL")
                elif isinstance(v, str): 
                    # Fixed quote escaping issue
                    safe_v = str(v).replace("'", "''")
                    vals.append(f"'{safe_v}'")
                else: 
                    vals.append(str(v))
            sql_buffer.write(f"INSERT INTO {table_name} VALUES ({', '.join(vals)});\n")
        sql_buffer.seek(0)
        return StreamingResponse(sql_buffer, media_type="text/plain", headers={"Content-Disposition": f"attachment; filename=InfoPulse_{request_id}.sql"})
        
    else: raise HTTPException(status_code=400, detail="Invalid format specified.")
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
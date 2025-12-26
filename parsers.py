# app/parsers.py
from pdfminer.high_level import extract_text as pdf_extract_text
import docx
import tempfile
import os
from typing import Tuple

def extract_text_from_pdf(path: str) -> str:
    try:
        return pdf_extract_text(path)
    except Exception as e:
        print("pdf extraction error:", e)
        return ""

def extract_text_from_docx(path: str) -> str:
    try:
        doc = docx.Document(path)
        full_text = []
        for para in doc.paragraphs:
            full_text.append(para.text)
        return "\n".join(full_text)
    except Exception as e:
        print("docx extraction error:", e)
        return ""

def extract_text_from_txt(path: str) -> str:
    try:
        with open(path, "r", encoding="utf-8", errors="ignore") as f:
            return f.read()
    except Exception as e:
        print("txt extraction error:", e)
        return ""

def extract_text_from_upload(upload_file) -> Tuple[str, str]:
    """
    upload_file is Starlette UploadFile; return (text, temp_path)
    Caller should NOT delete file immediately if needed.
    """
    suffix = os.path.splitext(upload_file.filename)[1].lower()
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    contents = upload_file.file.read()
    tmp.write(contents)
    tmp.flush()
    tmp.close()
    path = tmp.name

    text = ""
    if suffix in [".pdf"]:
        text = extract_text_from_pdf(path)
    elif suffix in [".docx", ".doc"]:
        text = extract_text_from_docx(path)
    elif suffix in [".txt"]:
        text = extract_text_from_txt(path)
    else:
        # try pdf fallback
        text = extract_text_from_pdf(path)

    return text, path

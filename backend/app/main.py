import os
from dotenv import load_dotenv
from fastapi import FastAPI


load_dotenv(dotenv_path="../.env")  # relative to the "backend" dir

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")

app = FastAPI(
    title="DocQuery",
    description="AI-Powered Document Q&A with RAG",
    version="1.0.0",
)


# TODO: implement
@app.get("/")
async def root():
    return {"status": "ok", "message": "DocQuery API is running"}


# TODO: implement
@app.get("/documents")
async def list_documents():
    """List all uploaded documents."""
    return {"status": "ok", "message": "List all uploaded documents."}


# TODO: implement
@app.post("/upload")
async def upload_document():
    """
    Upload a PDF document.
    """
    return {"status": "ok", "message": "Upload a PDF document."}


# TODO: implement
@app.post("/chat")
async def ask_question():
    """
    Ask a question about an uploaded document.
    """
    return {"status": "ok", "message": "Ask a question about an uploaded document."}


# TODO: implement
@app.delete("/documents/{document_id}")
async def delete_document(document_id: str):
    """Delete a document."""
    return {"status": "deleted", "document_id": document_id}

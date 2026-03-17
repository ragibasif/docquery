import os
from dotenv import load_dotenv
import uuid
from typing import List, Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import chromadb
from chromadb.config import Settings

import fitz  # PyMuPDF
import openai


load_dotenv(dotenv_path="../.env")  # relative to the "backend" dir


OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
CHUNK_SIZE = 400  # words per chunk
CHUNK_OVERLAP = 50  # overlapping words between chunks
TOP_K = 5  # number of chunks to retrieve per query
CHROMA_PERSIST_DIR = "./chroma_data"


chroma_client = None
collection = None
llm_client = None
documents_store = {}  # In-memory doc metadata: {doc_id: {name, chunk_count, ...}}


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize ChromaDB and OpenAI client on startup."""
    global chroma_client, collection, llm_client

    # ChromaDB - persistent local storage
    chroma_client = chromadb.Client(
        Settings(
            persist_directory=CHROMA_PERSIST_DIR,
            anonymized_telemetry=False,
        )
    )
    collection = chroma_client.get_or_create_collection(
        name="documents",
        metadata={"hnsw:space": "cosine"},
    )

    # OpenRouter client (OpenAI-compatible)
    if OPENROUTER_API_KEY:
        llm_client = openai.OpenAI(
            api_key=OPENROUTER_API_KEY,
            base_url="https://openrouter.ai/api/v1",
        )
    else:
        print("WARNING: OPENROUTER_API_KEY not set. LLM features will not work.")

    yield  # App runs here

    # Cleanup (if needed)
    print("Shutting down...")


app = FastAPI(
    title="DocQuery API",
    description="AI-Powered Document Q&A with RAG",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Next.js dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class AskRequest(BaseModel):
    document_id: str
    question: str
    conversation_history: Optional[List[dict]] = []


class AskResponse(BaseModel):
    answer: str
    citations: List[dict]  # [{chunk_index, text, page}]


class DocumentInfo(BaseModel):
    id: str
    name: str
    chunk_count: int


def extract_text_from_pdf(file_bytes: bytes) -> List[dict]:
    """
    Extract text from a PDF, returning a list of {page, text} dicts.
    """
    doc = fitz.open(stream=file_bytes, filetype="pdf")
    pages = []
    for page_num in range(len(doc)):
        page = doc.load_page(page_num)
        text = page.get_text("text")
        if text.strip():
            pages.append({"page": page_num + 1, "text": text.strip()})
    doc.close()
    return pages


def chunk_text(
    pages: List[dict], chunk_size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP
) -> List[dict]:
    """
    Split extracted pages into overlapping word-based chunks.
    Each chunk retains its source page number.

    Returns: [{text, page, chunk_index}]
    """
    # Combine all text with page markers
    all_words = []
    word_to_page = []

    for page_info in pages:
        words = page_info["text"].split()
        all_words.extend(words)
        word_to_page.extend([page_info["page"]] * len(words))

    chunks = []
    chunk_index = 0
    i = 0

    while i < len(all_words):
        end = min(i + chunk_size, len(all_words))
        chunk_words = all_words[i:end]
        chunk_text = " ".join(chunk_words)

        # Determine the primary page for this chunk
        chunk_pages = word_to_page[i:end]
        # Use the most common page number in the chunk
        primary_page = max(set(chunk_pages), key=chunk_pages.count)

        chunks.append(
            {
                "text": chunk_text,
                "page": primary_page,
                "chunk_index": chunk_index,
            }
        )

        chunk_index += 1
        i += chunk_size - overlap

        # Avoid creating a tiny final chunk
        if i < len(all_words) and (len(all_words) - i) < overlap:
            break

    return chunks


def build_rag_prompt(
    question: str, context_chunks: List[dict], conversation_history: List[dict] = []
) -> list:
    """
    Build the messages array for the OpenAI Chat Completions API call.
    Includes retrieved context chunks and conversation history.
    """
    # Format context chunks with citation numbers
    context_parts = []
    for i, chunk in enumerate(context_chunks):
        context_parts.append(f"[{i + 1}] (Page {chunk['page']})\n{chunk['text']}")

    context_str = "\n\n---\n\n".join(context_parts)

    system_prompt = f"""You are a helpful assistant that answers questions based on the provided document context.

RULES:
1. Only answer based on the context provided below. Do not use outside knowledge.
2. If the answer is not in the context, say "I couldn't find the answer to that in the document."
3. Cite your sources using [1], [2], etc. corresponding to the context chunks below.
4. Be concise and direct.
5. If multiple chunks support your answer, cite all relevant ones.

DOCUMENT CONTEXT:
{context_str}"""

    messages = []

    # Add conversation history (for multi-turn)
    for entry in conversation_history[-6:]:  # Keep last 3 exchanges
        messages.append({"role": entry["role"], "content": entry["content"]})

    # Add current question
    messages.append({"role": "user", "content": question})

    return system_prompt, messages


# ============================================================
# API Endpoints
# ============================================================


@app.get("/documents", response_model=List[DocumentInfo])
async def list_documents():
    """List all uploaded documents."""
    return [
        DocumentInfo(id=doc_id, name=info["name"], chunk_count=info["chunk_count"])
        for doc_id, info in documents_store.items()
    ]


@app.post("/upload", response_model=DocumentInfo)
async def upload_document(file: UploadFile = File(...)):
    """
    Upload a PDF document. Extracts text, chunks it, generates embeddings,
    and stores in ChromaDB.
    """
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")

    # Read file
    file_bytes = await file.read()
    if len(file_bytes) == 0:
        raise HTTPException(status_code=400, detail="Empty file")

    # Extract text
    pages = extract_text_from_pdf(file_bytes)
    if not pages:
        raise HTTPException(
            status_code=400,
            detail="Could not extract text from PDF. It may be scanned/image-based.",
        )

    # Chunk
    chunks = chunk_text(pages)
    if not chunks:
        raise HTTPException(status_code=400, detail="Document produced no text chunks")

    # Generate document ID
    doc_id = str(uuid.uuid4())[:8]

    # Store in ChromaDB
    # ChromaDB will generate embeddings automatically using its default embedding function
    ids = [f"{doc_id}_chunk_{c['chunk_index']}" for c in chunks]
    texts = [c["text"] for c in chunks]
    metadatas = [
        {"document_id": doc_id, "page": c["page"], "chunk_index": c["chunk_index"]}
        for c in chunks
    ]

    collection.add(
        ids=ids,
        documents=texts,
        metadatas=metadatas,
    )

    # Store document metadata
    documents_store[doc_id] = {
        "name": file.filename,
        "chunk_count": len(chunks),
        "chunks": chunks,  # Keep for citation display
    }

    return DocumentInfo(id=doc_id, name=file.filename, chunk_count=len(chunks))


@app.post("/ask", response_model=AskResponse)
async def ask_question(request: AskRequest):
    """
    Ask a question about an uploaded document.
    Retrieves relevant chunks via vector search, sends to LLM, returns cited answer.
    """
    if not llm_client:
        raise HTTPException(status_code=500, detail="OpenRouter API key not configured")

    if request.document_id not in documents_store:
        raise HTTPException(status_code=404, detail="Document not found")

    # Query ChromaDB for relevant chunks
    results = collection.query(
        query_texts=[request.question],
        n_results=TOP_K,
        where={"document_id": request.document_id},
    )

    if not results["documents"] or not results["documents"][0]:
        raise HTTPException(
            status_code=404, detail="No relevant content found in document"
        )

    # Build context chunks for the prompt
    context_chunks = []
    for i, (doc_text, metadata) in enumerate(
        zip(results["documents"][0], results["metadatas"][0])
    ):
        context_chunks.append(
            {
                "text": doc_text,
                "page": metadata["page"],
                "chunk_index": metadata["chunk_index"],
                "distance": results["distances"][0][i]
                if results["distances"]
                else None,
            }
        )

    # Build RAG prompt
    system_prompt, messages = build_rag_prompt(
        question=request.question,
        context_chunks=context_chunks,
        conversation_history=request.conversation_history or [],
    )

    # Call OpenAI
    try:
        response = llm_client.chat.completions.create(
            model="openai/gpt-4o-mini",
            max_tokens=1024,
            messages=[{"role": "system", "content": system_prompt}, *messages],
        )
        answer = response.choices[0].message.content
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"LLM error: {str(e)}")

    # Build citations
    citations = [
        {
            "chunk_index": c["chunk_index"],
            "text": c["text"][:200] + "..." if len(c["text"]) > 200 else c["text"],
            "page": c["page"],
        }
        for c in context_chunks
    ]

    return AskResponse(answer=answer, citations=citations)


@app.delete("/documents/{document_id}")
async def delete_document(document_id: str):
    """Delete a document and its chunks from ChromaDB."""
    if document_id not in documents_store:
        raise HTTPException(status_code=404, detail="Document not found")

    # Delete from ChromaDB
    chunk_count = documents_store[document_id]["chunk_count"]
    ids_to_delete = [f"{document_id}_chunk_{i}" for i in range(chunk_count)]

    try:
        collection.delete(ids=ids_to_delete)
    except Exception:
        pass  # ChromaDB may throw if IDs don't exist

    # Delete metadata
    del documents_store[document_id]

    return {"status": "deleted", "document_id": document_id}

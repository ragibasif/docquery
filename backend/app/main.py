import os
from dotenv import load_dotenv
from fastapi import FastAPI


load_dotenv(dotenv_path="../.env")  # relative to the "backend" dir

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")

app = FastAPI(title="DocQuery")


@app.get("/")
async def root():
    return {"status": "ok", "message": "DocQuery API is running"}

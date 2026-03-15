import os

# import anthropic
from dotenv import load_dotenv

load_dotenv(dotenv_path="../.env")  # relative to the file


ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")


def main():
    print(ANTHROPIC_API_KEY)


if __name__ == "__main__":
    main()

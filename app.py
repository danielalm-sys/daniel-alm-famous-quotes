from collections import Counter
import json
from pathlib import Path
import random
from typing import Any

from flask import Flask, jsonify, render_template, request

BASE_DIR = Path(__file__).resolve().parent
QUOTES_PATH = BASE_DIR / "quotes.json"


def load_quotes(path: Path = QUOTES_PATH) -> list[dict[str, Any]]:
    """Load the 100 quotes dataset from JSON."""
    with path.open("r", encoding="utf-8") as file:
        return json.load(file)


QUOTES: list[dict[str, Any]] = load_quotes()


def filter_quotes(
    quotes: list[dict[str, Any]],
    author: str = "",
    category: str = "",
) -> list[dict[str, Any]]:
    """Filter quotes by case-insensitive author substring and/or exact category match."""
    author_query = author.strip().lower()
    category_query = category.strip().lower()

    results = quotes
    if author_query:
        results = [
            quote for quote in results if author_query in quote["author"].lower()
        ]
    if category_query:
        results = [
            quote
            for quote in results
            if any(cat.lower() == category_query for cat in quote["categories"])
        ]
    return results


def create_app() -> Flask:
    """Create and configure the Flask application."""
    app = Flask(__name__)

    @app.route("/", methods=["GET"])
    def index():
        return render_template("index.html")

    @app.route("/api/metadata", methods=["GET"])
    def get_metadata():
        authors = sorted({quote["author"] for quote in QUOTES})
        category_counts: Counter[str] = Counter()
        for quote in QUOTES:
            for category in quote["categories"]:
                category_counts[category] += 1

        categories = [
            {"name": name, "count": count}
            for name, count in sorted(category_counts.items())
        ]
        return jsonify(
            {
                "total_quotes": len(QUOTES),
                "authors": authors,
                "categories": categories,
            }
        )

    @app.route("/api/quotes", methods=["GET"])
    def get_quotes():
        author = request.args.get("author", "")
        category = request.args.get("category", "")
        filtered = filter_quotes(QUOTES, author=author, category=category)
        return jsonify({"count": len(filtered), "quotes": filtered})

    @app.route("/api/quotes/random", methods=["GET"])
    def get_random_quote():
        author = request.args.get("author", "")
        category = request.args.get("category", "")
        exclude_id = request.args.get("exclude_id", type=int)

        filtered = filter_quotes(QUOTES, author=author, category=category)
        if not filtered:
            return jsonify({"quote": None, "total_matching": 0}), 404

        candidates = (
            [quote for quote in filtered if quote["id"] != exclude_id]
            if exclude_id is not None and len(filtered) > 1
            else filtered
        )
        chosen = random.choice(candidates)
        return jsonify({"quote": chosen, "total_matching": len(filtered)})

    return app


app = create_app()

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)

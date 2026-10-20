import pytest

from app import QUOTES, create_app


@pytest.fixture()
def client():
    app = create_app()
    app.config.update({"TESTING": True})
    with app.test_client() as test_client:
        yield test_client


def test_quotes_dataset_has_100_valid_quotes():
    assert len(QUOTES) == 100
    ids = [q["id"] for q in QUOTES]
    assert len(set(ids)) == 100
    for quote in QUOTES:
        assert isinstance(quote["text"], str) and quote["text"].strip()
        assert isinstance(quote["author"], str) and quote["author"].strip()
        assert isinstance(quote["categories"], list) and len(quote["categories"]) >= 1


def test_index_route_renders_html(client):
    response = client.get("/")
    assert response.status_code == 200
    html = response.get_data(as_text=True)
    assert "Quote Explorer" in html
    assert "Random Quote Spotlight" in html
    assert "static/js/app.js" in html


def test_metadata_endpoint(client):
    response = client.get("/api/metadata")
    assert response.status_code == 200
    data = response.get_json()
    assert data["total_quotes"] == 100
    assert "Albert Einstein" in data["authors"]
    category_names = [cat["name"] for cat in data["categories"]]
    assert "Wisdom" in category_names
    assert "Science" in category_names


def test_get_quotes_all_and_filtered(client):
    # All quotes
    res_all = client.get("/api/quotes")
    assert res_all.status_code == 200
    data_all = res_all.get_json()
    assert data_all["count"] == 100
    assert len(data_all["quotes"]) == 100

    # Filter by author (case-insensitive substring)
    res_author = client.get("/api/quotes?author=einstein")
    assert res_author.status_code == 200
    data_author = res_author.get_json()
    assert data_author["count"] == 3
    assert all("Einstein" in q["author"] for q in data_author["quotes"])

    # Filter by category (case-insensitive)
    res_category = client.get("/api/quotes?category=science")
    assert res_category.status_code == 200
    data_category = res_category.get_json()
    assert data_category["count"] > 0
    assert all("Science" in q["categories"] for q in data_category["quotes"])

    # Combined author + category filter
    res_combined = client.get("/api/quotes?author=einstein&category=science")
    assert res_combined.status_code == 200
    data_combined = res_combined.get_json()
    assert data_combined["count"] == 2
    for quote in data_combined["quotes"]:
        assert "Einstein" in quote["author"]
        assert "Science" in quote["categories"]


def test_random_quote_endpoint_and_exclusion(client):
    res = client.get("/api/quotes/random")
    assert res.status_code == 200
    data = res.get_json()
    assert data["total_matching"] == 100
    assert data["quote"] is not None
    assert "text" in data["quote"]
    assert "author" in data["quote"]

    # Filtered random with exclude_id
    res_filtered = client.get("/api/quotes/random?author=einstein&category=science")
    first_id = res_filtered.get_json()["quote"]["id"]

    res_next = client.get(
        f"/api/quotes/random?author=einstein&category=science&exclude_id={first_id}"
    )
    assert res_next.status_code == 200
    second_id = res_next.get_json()["quote"]["id"]
    assert second_id != first_id

    # Non-existent filter returns 404
    res_none = client.get("/api/quotes/random?author=nonexistent_author_xyz")
    assert res_none.status_code == 404
    assert res_none.get_json()["quote"] is None

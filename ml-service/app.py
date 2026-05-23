"""
Flask API for the news ranking microservice.

POST /rank — score and sort article feature vectors.

Run: python app.py
Requires: ranking_model.h5 (create with train.py first)
"""

import os

import numpy as np
import tensorflow as tf
from flask import Flask, jsonify, request

FEATURE_NAMES = [
    "categoryMatch",
    "dwellTime",
    "timeContextMatch",
    "locationMatch",
    "recencyScore",
]

MODEL_PATH = "ranking_model.h5"
MAX_DWELL_SECONDS = 600.0

app = Flask(__name__)
model: tf.keras.Model | None = None


def normalize_dwell_time(seconds: float) -> float:
    return min(float(seconds) / MAX_DWELL_SECONDS, 1.0)


def vectorize_features(features: dict) -> list[float]:
    missing = [name for name in FEATURE_NAMES if name not in features]
    if missing:
        raise ValueError(f"Missing features: {', '.join(missing)}")

    return [
        float(features["categoryMatch"]),
        normalize_dwell_time(features["dwellTime"]),
        float(features["timeContextMatch"]),
        float(features["locationMatch"]),
        float(features["recencyScore"]),
    ]


def load_model() -> tf.keras.Model:
    if not os.path.exists(MODEL_PATH):
        raise FileNotFoundError(
            f"{MODEL_PATH} not found. Run: python train.py"
        )
    return tf.keras.models.load_model(MODEL_PATH)


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "modelLoaded": model is not None})


@app.route("/rank", methods=["POST"])
def rank():
    """
    Request body example:
    {
      "articles": [
        {
          "id": "article-1",
          "features": {
            "categoryMatch": 0.9,
            "dwellTime": 120,
            "timeContextMatch": 0.7,
            "locationMatch": 0.5,
            "recencyScore": 0.8
          }
        }
      ]
    }
    """
    global model

    if model is None:
        return jsonify({"error": "Model not loaded"}), 503

    body = request.get_json(silent=True)
    if not body or "articles" not in body:
        return jsonify({"error": "Expected JSON with an 'articles' array"}), 400

    articles = body["articles"]
    if not isinstance(articles, list) or len(articles) == 0:
        return jsonify({"error": "'articles' must be a non-empty array"}), 400

    scored = []

    for index, article in enumerate(articles):
        article_id = article.get("id", f"article-{index}")
        features = article.get("features")

        if not isinstance(features, dict):
            return jsonify(
                {"error": f"Article '{article_id}' must include a 'features' object"}
            ), 400

        try:
            vector = vectorize_features(features)
        except ValueError as exc:
            return jsonify({"error": str(exc), "articleId": article_id}), 400

        batch = np.array([vector], dtype=np.float32)
        score = float(model.predict(batch, verbose=0)[0][0])

        scored.append(
            {
                "id": article_id,
                "score": round(score, 4),
                "features": features,
            }
        )

    scored.sort(key=lambda item: item["score"], reverse=True)

    ranked = [
        {
            "id": item["id"],
            "score": item["score"],
            "rank": rank_position,
            "features": item["features"],
        }
        for rank_position, item in enumerate(scored, start=1)
    ]

    return jsonify({"count": len(ranked), "ranked": ranked})


if __name__ == "__main__":
    print(f"Loading model from {MODEL_PATH}...")
    model = load_model()
    port = int(os.environ.get("PORT", 5001))
    app.run(host="0.0.0.0", port=port, debug=False)

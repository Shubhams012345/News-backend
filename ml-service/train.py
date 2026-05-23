"""
Train a lightweight neural ranker for news articles.

Features (fixed order):
  categoryMatch, dwellTime, timeContextMatch, locationMatch, recencyScore

Run: python train.py
Output: ranking_model.h5
"""

import os

import numpy as np
import tensorflow as tf
import pandas as pd
from sklearn.model_selection import train_test_split

FEATURE_NAMES = [
    "categoryMatch",
    "dwellTime",
    "timeContextMatch",
    "locationMatch",
    "recencyScore",
]

MODEL_PATH = "ranking_model.h5"
NUM_SAMPLES = 2000
EPOCHS = 30
BATCH_SIZE = 32
MAX_DWELL_SECONDS = 600.0


def normalize_dwell_time(seconds: float) -> float:
    """Scale dwell time to 0–1 for the model."""
    return min(float(seconds) / MAX_DWELL_SECONDS, 1.0)


def vectorize_row(row: dict) -> list[float]:
    return [
        float(row["categoryMatch"]),
        normalize_dwell_time(row["dwellTime"]),
        float(row["timeContextMatch"]),
        float(row["locationMatch"]),
        float(row["recencyScore"]),
    ]


def build_model() -> tf.keras.Model:
    """Small feed-forward network — easy to read and tweak."""
    model = tf.keras.Sequential(
        [
            tf.keras.layers.Input(shape=(len(FEATURE_NAMES),)),
            tf.keras.layers.Dense(16, activation="relu"),
            tf.keras.layers.Dense(8, activation="relu"),
            tf.keras.layers.Dense(1, activation="sigmoid"),
        ],
        name="news_ranker",
    )
    model.compile(
        optimizer="adam",
        loss="binary_crossentropy",
        metrics=["accuracy"],
    )
    return model





def main() -> None:
    print("Building model...")
    model = build_model()
    model.summary()

    print("Loading real training data...")

    df = pd.read_csv("training_data.csv")

    df["dwellTime"] = (
        df["dwellTime"] / MAX_DWELL_SECONDS
    ).clip(0, 1)

    X = df[
        [
            "categoryMatch",
            "dwellTime",
            "timeContextMatch",
            "locationMatch",
            "recencyScore",
        ]
    ].values.astype(np.float32)

    y = df["liked"].values.astype(np.float32)

    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=0.2,
        random_state=42,
    )

    print("Training...")

    history = model.fit(
        X_train,
        y_train,
        epochs=EPOCHS,
        batch_size=BATCH_SIZE,
        validation_data=(X_test, y_test),
        verbose=1,
    )

    loss, accuracy = model.evaluate(
        X_test,
        y_test,
        verbose=0,
    )

    print(f"Validation Accuracy: {accuracy:.4f}")

    model.save(MODEL_PATH)

    print(f"Saved model to {os.path.abspath(MODEL_PATH)}")


if __name__ == "__main__":
    main()

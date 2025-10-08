import re
from sklearn.base import BaseEstimator, TransformerMixin
import os

class TextPreprocessor(BaseEstimator, TransformerMixin):
    def __init__(self, stopwords_path=None):
        """
        stopwords_path: str or None
            Path to a file containing stopwords (one per line). If None, no stopwords are used.
        """
        self.stopwords_path = stopwords_path  # ✅ store the parameter
        if stopwords_path and os.path.isfile(stopwords_path):
            with open(stopwords_path, "r", encoding="utf-8") as f:
                self.stopwords = set(line.strip() for line in f if line.strip())
        else:
            self.stopwords = set()

    def fit(self, X, y=None):
        return self

    def transform(self, X, y=None):
        """
        Preprocess a list of texts: lowercase, remove non-letters, remove stopwords.
        """
        cleaned = []
        for text in X:
            text = str(text).lower()
            text = re.sub(r"[^a-zA-Z\s]", " ", text)
            tokens = [w for w in text.split() if w not in self.stopwords]
            cleaned.append(" ".join(tokens))
        return cleaned





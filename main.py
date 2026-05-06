from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
from transformers import MarianMTModel, MarianTokenizer
import os
import torch
import re
import logging
import json
import base64
import sqlite3
import io
import requests
from vosk import Model, KaldiRecognizer
from rapidfuzz import fuzz
from datetime import datetime
from pydub import AudioSegment

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__, template_folder='templates')
CORS(app, resources={r"/translate": {"origins": "*"}})

# --- CONFIGURATION ---
MODEL_NAME = "Helsinki-NLP/opus-mt-en-ceb"
SAVE_PATH = "./cebuano_ai_model"
device = "cuda" if torch.cuda.is_available() else "cpu"

logger.info(f"Using device: {device}")

# Vosk & DB Configuration
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, "model")
DB_PATH = os.path.join(BASE_DIR, "Cebuano.db")
SAMPLE_RATE = 16000


# --- 1. PRE-PROCESSING UTILS ---
def expand_contractions(text):
    """Normalization: MarianMT performs better with formal English."""
    contractions = {
        "can't": "cannot", "don't": "do not", "it's": "it is", "i'm": "i am", "won't": "will not",
        "isn't": "is not", "aren't": "are not", "was not": "was not", "weren't": "were not",
        "hasn't": "has not", "haven't": "have not", "hadn't": "had not", "doesn't": "does not",
        "didn't": "did not", "couldn't": "could not", "shouldn't": "should not", "wouldn't": "would not",
        "mightn't": "might not", "mustn't": "must not", "that's": "that is", "what's": "what is",
        "who's": "who is", "where's": "where is", "when's": "when is", "why's": "why is",
        "how's": "how is", "let's": "let us", "you're": "you are", "we're": "we are",
        "they're": "they are", "i've": "i have", "you've": "you have", "we've": "we have",
        "they've": "they have", "i'll": "i will", "you'll": "you will", "he'll": "he will",
        "she'll": "she will", "it'll": "it will", "we'll": "we will", "they'll": "they will",
        "i'd": "i would", "you'd": "you would", "he'd": "he would", "she'd": "she would",
        "we'd": "we would", "they'd": "they would"
    }
    for word, replacement in contractions.items():
        text = text.replace(word, replacement)
    return text


# --- 2. API CALL FUNCTION ---
def fetch_word_details(word):
    """Fetches meaning, type, synonyms, and examples from the Free Dictionary API."""
    details = {
        "type": "Neural Translation",
        "synonyms": "N/A",
        "meaning": "Meaning not found on external API",
        "example": "N/A",
        "source": "AI Engine"
    }
    try:
        url = f"https://api.dictionaryapi.dev/api/v2/entries/en/{word}"
        response = requests.get(url, timeout=5)

        if response.status_code == 200:
            data = response.json()
            if data and isinstance(data, list):
                item = data[0]
                meanings = item.get("meanings", [])

                if meanings:
                    meaning_data = meanings[0]
                    details["type"] = meaning_data.get("partOfSpeech", "Unknown").capitalize()
                    definitions = meaning_data.get("definitions", [])

                    if definitions:
                        details["meaning"] = definitions[0].get("definition", "N/A")
                        details["example"] = definitions[0].get("example", "N/A")
                        details["synonyms"] = ", ".join(meaning_data.get("synonyms", [])[:3]) or "N/A"
                        details["source"] = "Free Dictionary API"
    except Exception as e:
        logger.warning(f"Could not reach external dictionary API: {e}")

    return details


# --- 3. MODEL INITIALIZATION ---

# Vosk Model Initialization
if os.path.exists(MODEL_PATH):
    logger.info("🚀 Loading Speech Model...")
    vosk_model = Model(MODEL_PATH)
else:
    vosk_model = None
    logger.warning(f"Vosk model not found at {MODEL_PATH}. Speech features may be disabled.")


# Database Initialization
def init_db():
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute('''
                     CREATE TABLE IF NOT EXISTS test_results
                     (
                         id
                         INTEGER
                         PRIMARY
                         KEY
                         AUTOINCREMENT,
                         user_name
                         TEXT,
                         target_word
                         TEXT,
                         spoken_text
                         TEXT,
                         accuracy
                         REAL,
                         passed
                         INTEGER,
                         timestamp
                         DATETIME
                     );
                     ''')


init_db()

# Neural Translation Model Initialization
try:
    if not os.path.exists(SAVE_PATH):
        logger.info(f"Loading model from {MODEL_NAME}...")
        tokenizer = MarianTokenizer.from_pretrained(MODEL_NAME)
        translation_model = MarianMTModel.from_pretrained(MODEL_NAME).to(device)
        tokenizer.save_pretrained(SAVE_PATH)
        translation_model.save_pretrained(SAVE_PATH)
        logger.info("Model saved successfully")
    else:
        logger.info(f"Loading model from {SAVE_PATH}...")
        tokenizer = MarianTokenizer.from_pretrained(SAVE_PATH)
        translation_model = MarianMTModel.from_pretrained(SAVE_PATH).to(device)
        logger.info("Model loaded successfully")
except Exception as e:
    logger.error(f"Error loading model: {e}")
    raise


# --- 4. CORE ENGINE UTILS ---
def neural_translate(text):
    """Improved Decoding Strategy"""
    try:
        inputs = tokenizer(text, return_tensors="pt", padding=True).to(device)
        translated_tokens = translation_model.generate(
            **inputs,
            num_beams=8,
            repetition_penalty=1.5,
            length_penalty=1.0,
            no_repeat_ngram_size=2,
            early_stopping=True,
            max_length=128
        )
        result = tokenizer.decode(translated_tokens[0], skip_special_tokens=True)
        logger.info(f"Translation result: {text} -> {result}")
        return result
    except Exception as e:
        logger.error(f"Translation error: {e}")
        raise


def process_audio(audio_b64):
    """Converts base64 audio (any format) to Vosk-compatible WAV."""
    try:
        if "," in audio_b64:
            audio_b64 = audio_b64.split(",")[1]
        audio_data = base64.b64decode(audio_b64)
        audio_file = io.BytesIO(audio_data)
        audio = AudioSegment.from_file(audio_file)
        audio = audio.set_frame_rate(SAMPLE_RATE).set_channels(1)
        return audio.raw_data
    except Exception as e:
        logger.error(f"Audio processing error: {e}")
        return None


# --- 5. ROUTES ---
@app.route('/')
def home():
    return render_template('index.html')


@app.route('/translate', methods=['POST', 'OPTIONS'])
def translate_text():
    """Main translation endpoint with dynamic API retrieval"""
    if request.method == 'OPTIONS':
        return '', 204

    try:
        if not request.is_json:
            return jsonify({"error": "Request must be JSON", "translated": "", "details": None}), 400

        data = request.get_json()
        raw_text = data.get("text", "").strip().lower()

        if not raw_text:
            return jsonify({"translated": "", "details": None})

        # --- STEP A: PRE-PROCESSING ---
        clean_text = expand_contractions(raw_text)

        # --- STEP B: FETCH TRANSLATION & DEFINITION ---
        details = fetch_word_details(raw_text)
        translation = neural_translate(clean_text)

        details["trans"] = translation

        final_output = translation.strip().capitalize()

        return jsonify({
            "translated": final_output,
            "details": details,
            "metadata": {
                "engine": "MarianMT-Cebuano-v2.1",
                "device": device,
                "model": MODEL_NAME
            }
        }), 200

    except Exception as e:
        logger.error(f"Error in translation: {str(e)}", exc_info=True)
        return jsonify({"error": str(e), "translated": "", "details": None}), 500


@app.route('/rate_pronunciation', methods=['POST'])
def rate_pronunciation():
    try:
        if vosk_model is None:
            return jsonify({"error": "Vosk speech model is not loaded on the server"}), 503

        data = request.json or {}
        target = data.get('target_word', '').lower().strip()
        audio_b64 = data.get('audio_base64', '')
        user = data.get('user_name', 'Student')

        if not audio_b64:
            return jsonify({"error": "No audio data provided"}), 400

        raw_audio = process_audio(audio_b64)
        if not raw_audio:
            return jsonify({"error": "Invalid audio format"}), 400

        # Run Speech-to-Text with Vosk
        rec = KaldiRecognizer(vosk_model, SAMPLE_RATE)
        rec.AcceptWaveform(raw_audio)
        result = json.loads(rec.FinalResult())
        spoken = result.get('text', '').lower().strip()

        if not spoken:
            return jsonify({
                "score": 0,
                "spoken": "[No speech detected]",
                "passed": False,
                "message": "We couldn't hear you. Please try again!"
            })

        # Calculate accuracy/score
        accuracy = fuzz.ratio(spoken, target)
        passed = 1 if accuracy >= 75 else 0

        # Save result to DB
        with sqlite3.connect(DB_PATH) as conn:
            conn.execute(
                "INSERT INTO test_results (user_name, target_word, spoken_text, accuracy, passed, timestamp) VALUES (?,?,?,?,?,?)",
                (user, target, spoken, accuracy, passed, datetime.now())
            )

        return jsonify({
            "score": round(accuracy, 2),
            "spoken": spoken,
            "passed": bool(passed),
            "message": "Excellent pronunciation!" if accuracy > 90 else "Good, keep practicing!" if passed else "Keep trying!"
        })

    except Exception as e:
        logger.error(f"Pronunciation engine error: {e}", exc_info=True)
        return jsonify({"error": "Internal server error"}), 500


@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        "status": "healthy",
        "device": device,
        "model_loaded": True
    }), 200


# Error handlers
@app.errorhandler(404)
def not_found(error):
    return jsonify({"error": "Not found"}), 404


@app.errorhandler(500)
def internal_error(error):
    logger.error(f"Internal error: {error}")
    return jsonify({"error": "Internal server error"}), 500


if __name__ == '__main__':
    logger.info("Starting Flask app...")
    app.run(host='0.0.0.0', port=5000, debug=False, threaded=True)
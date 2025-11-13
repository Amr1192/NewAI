from flask import Flask, request, jsonify
from faster_whisper import WhisperModel
import tempfile
import os
import time

app = Flask(__name__)

# Load model once (this may take 20–30 seconds the first time)
print("🔄 Loading Faster-Whisper model...")
model = WhisperModel("base")
print("✅ Model loaded and ready!")

@app.route("/transcribe", methods=["POST"])
def transcribe():
    if "file" not in request.files:
        return jsonify({"error": "no file"}), 400

    f = request.files["file"]

    # Save uploaded file to a temporary path
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".wav")
    tmp_path = tmp.name
    f.save(tmp_path)
    tmp.close()

    try:
        # Run transcription
        print(f"🎧 Received audio: {os.path.basename(tmp_path)}")
        segments, _ = model.transcribe(tmp_path, language="en")
        text = " ".join([s.text for s in segments])
        print("🗣️ Text:", text.strip() or "(no speech detected)")

        # Small delay before deleting file (Windows fix)
        time.sleep(0.2)
        try:
            os.remove(tmp_path)
        except PermissionError:
            print(f"⚠️ Could not delete {tmp_path}, will skip cleanup.")

        return jsonify({"text": text.strip()})
    except Exception as e:
        print("❌ Transcription error:", str(e))
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    print("🚀 Whisper server running at http://127.0.0.1:5000/transcribe")
    app.run(host="0.0.0.0", port=5000, debug=False)

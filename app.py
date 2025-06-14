from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from youtube_transcript_api import YouTubeTranscriptApi

app = Flask(__name__, static_folder="frontend", static_url_path="")
CORS(app, origins=["*"])

def extract_video_id(url):
    if "shorts/" in url:
        url = url.replace("shorts/", "watch?v=")
    if "v=" in url:
        return url.split("v=")[1].split("&")[0]
    return url

@app.route("/")
def index():
    return send_from_directory("frontend", "index.html")

@app.route("/transcript", methods=["POST"])
def get_transcript():
    try:
        data = request.get_json()
        video_url = data.get("url", "")
        video_id = extract_video_id(video_url)
        transcript = YouTubeTranscriptApi.get_transcript(video_id, languages=["ko", "en"])
        lines = [{"start": item["start"], "text": item["text"]} for item in transcript]
        text = "\n".join([line["text"] for line in lines])
        return jsonify({"transcript": text})
    except Exception as e:
        return jsonify({"error": str(e)}), 400

if __name__ == "__main__":
    app.run(debug=True)


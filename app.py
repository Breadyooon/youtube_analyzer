from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from youtube_transcript_api import YouTubeTranscriptApi
import requests  # ✅ 추가: 외부 요청용
import os

app = Flask(__name__, static_folder="frontend", static_url_path="")
CORS(app, origins=["*"])

# 유튜브 영상 URL에서 ID 추출
def extract_video_id(url):
    if "shorts/" in url:
        url = url.replace("shorts/", "watch?v=")
    if "v=" in url:
        return url.split("v=")[1].split("&")[0]
    return url

# 기본 루트 (index.html 반환)
@app.route("/")
def index():
    return send_from_directory("frontend", "index.html")

# 자막 추출 API (youtube_transcript_api 사용)
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

# ✅ 추가: 외부 프록시 서버 중계
@app.route("/proxy-subtitle/<video_id>")
def proxy_subtitle(video_id):
    try:
        url = f"https://yt-subtitle.akashdeep.workers.dev/?id={video_id}"
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/114.0.0.0 Safari/537.36"
        }
        resp = requests.get(url, headers=headers)
        json_data = resp.json()
        return jsonify(json_data)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ✅ Render 포트에 맞춰서 실행
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)

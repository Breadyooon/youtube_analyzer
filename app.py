from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
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
# 자막 XML까지 파싱해서 텍스트 반환
@app.route("/proxy-subtitle/<video_id>")
def proxy_subtitle(video_id):
    try:
        print(f"[프록시 요청 시작] video_id: {video_id}")
        url = f"https://yt-subtitle.akashdeep.workers.dev/?id={video_id}"
        print(f"[외부 요청] {url}")
        json_resp = requests.get(url, headers={"User-Agent": "Mozilla/5.0"}, timeout=5)
        print(f"[응답 상태] {json_resp.status_code}")
        json_data = json_resp.json()

        if "data" not in json_data or not json_data["data"]:
            raise ValueError("자막 데이터가 비어있습니다.")

        base_url = json_data["data"][0].get("base_url")
        if not base_url:
            raise ValueError("base_url을 찾지 못했습니다.")

        print(f"[base_url 추출] {base_url}")
        xml_resp = requests.get(base_url, headers={"User-Agent": "Mozilla/5.0"}, timeout=5)
        xml_text = xml_resp.text

        import xml.etree.ElementTree as ET
        root = ET.fromstring(xml_text)
        lines = [el.text for el in root.findall("text") if el.text]
        text = "\n".join(lines)

        return jsonify({"transcript": text})
    except Exception as e:
        print(f"[에러 발생] {repr(e)}")  # ❗이 로그 반드시 콘솔에 떠야 합니다
        return jsonify({"error": str(e)}), 500

# ✅ Render 포트에 맞춰서 실행
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=True)  # debug 꼭 넣어주세요

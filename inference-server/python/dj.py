import sys
import json
import random
import subprocess
import os

# Default Playlist: Lofi Girl - beats to relax/study to (Static uploads playlist)
DEFAULT_PLAYLIST = "https://www.youtube.com/playlist?list=PLofht4PTcKYnaH8w5OlUYcVF9loffXMTE"

def get_audio_stream(playlist_url=None):
    if not playlist_url:
        playlist_url = DEFAULT_PLAYLIST

    # Determine yt-dlp path
    local_binary = os.path.join(os.path.dirname(__file__), 'yt-dlp')
    yt_dlp_cmd = local_binary if os.path.exists(local_binary) else "yt-dlp"

    try:
        # 1. Get Playlist Entries (Fast, flat)
        cmd_list = [
            yt_dlp_cmd,
            "--flat-playlist",
            "--dump-single-json",
            "--no-warnings",
            playlist_url
        ]
        
        result = subprocess.run(cmd_list, capture_output=True, text=True, check=True)
        data = json.loads(result.stdout)
        
        entries = data.get('entries', [])
        if not entries:
            return {"error": "No entries found in playlist"}

        # 2. Pick Random Video
        video = random.choice(entries)
        video_url = f"https://www.youtube.com/watch?v={video['id']}"
        title = video.get('title', 'Unknown Track')

        # 3. Get Direct Audio URL (Best audio)
        cmd_url = [
            yt_dlp_cmd,
            "-g",                 # Get URL
            "-f", "bestaudio",    # Best audio quality
            "--no-warnings",
            video_url
        ]
        
        url_result = subprocess.run(cmd_url, capture_output=True, text=True, check=True)
        audio_url = url_result.stdout.strip()

        return {
            "status": "success",
            "url": audio_url,
            "title": title,
            "original_url": video_url
        }

    except subprocess.CalledProcessError as e:
        return {"status": "error", "error": f"yt-dlp failed: {e.stderr}"}
    except Exception as e:
        return {"status": "error", "error": str(e)}

if __name__ == "__main__":
    # Read input from stdin if available (for future playlist customization)
    playlist = None
    try:
        if not sys.stdin.isatty():
             input_data = json.load(sys.stdin)
             playlist = input_data.get('playlist')
    except:
        pass

    result = get_audio_stream(playlist)
    print(json.dumps(result))

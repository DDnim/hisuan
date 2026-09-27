#!/bin/sh
# record-ex.js の録画と録音を合わせて rec/hisuan_ex.mp4（1080x1920・30fps）にする。
# 目印: 画面の横幅バナー（EX 1 … 结束！）が出た瞬間。最初のバナー＝EX 開始＝開始ファンファーレ、
# 最後のバナー＝「结束！」で、ゲーム内ではちょうど 20 秒（+判定の遅れ 0.05 秒）離れている。
set -e
cd "$(dirname "$0")/../rec"
banners=$(ffmpeg -v error -i ex_video.webm -vf "crop=200:60:40:640,signalstats,metadata=print:key=lavfi.signalstats.YAVG:file=-" -f null - \
  | paste - - | sed -E 's/.*pts_time:([0-9.]+).*YAVG=([0-9.]+)/\1 \2/' \
  | awk '{d=($2<110); if(d && !p) print $1; p=d}')
first=$(echo "$banners" | head -1); last=$(echo "$banners" | tail -1)
onset=$(ffmpeg -i ex_audio.webm -af silencedetect=n=-45dB:d=0.3 -f null - 2>&1 | grep -o 'silence_end: [0-9.]*' | head -1 | cut -d' ' -f2)
read scale pad <<EOT
$(python3 -c "s=20.05/($last-$first); print(s, max(0.0, $onset+0.05-$first*s))")
EOT
echo "banner $first → $last, audio onset $onset, scale $scale, pad $pad"
ffmpeg -v error -y -i ex_video.webm -i ex_audio.webm -filter_complex \
  "[0:v]setpts=PTS*$scale,tpad=start_duration=$pad:start_mode=clone,fps=30[v];[1:a]highpass=f=20[a]" \
  -map "[v]" -map "[a]" -c:v libx264 -crf 18 -pix_fmt yuv420p -c:a aac -b:a 192k -shortest hisuan_ex.mp4
echo "→ rec/hisuan_ex.mp4"

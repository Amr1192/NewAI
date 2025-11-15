<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

class TranscribeChunk extends Command
{
    protected $signature = 'transcribe:chunk {id} {sid} {path}';
    protected $description = 'Convert a recorded audio chunk to text using Whisper and cache partial feedback.';

    public function handle()
    {
        $id   = $this->argument('id');
        $sid  = $this->argument('sid');
        $path = $this->argument('path');

        if (!file_exists($path)) {
            Log::warning("TranscribeChunk: file not found → $path");
            return;
        }

        Log::info("🎧 Starting transcription for interview #$id, session $sid, file $path");

        try {
            // Detect whether it's webm or ogg based on the file header
            $header = file_get_contents($path, false, null, 0, 16);
            $fmt = (strpos($header, 'webm') !== false) ? 'webm' : 'ogg';

            $ffmpeg = env('FFMPEG_PATH', 'ffmpeg');
            $python = env('PYTHON_PATH', 'python');

            $wavPath = preg_replace('/\.(webm|ogg)$/i', '.wav', $path);

            // Force ffmpeg to handle very small files properly
            $cmd = implode(' ', [
                escapeshellarg($ffmpeg),
                '-hide_banner -loglevel error -y',
                '-f', $fmt,
                '-acodec', 'libopus',
                '-i', escapeshellarg($path),
                '-vn',
                '-ac', '1',
                '-ar', '16000',
                '-c:a', 'pcm_s16le',
                escapeshellarg($wavPath),
            ]);

            exec($cmd, $out, $code);
            if ($code !== 0 || !file_exists($wavPath) || filesize($wavPath) < 2000) {
                Log::error("FFmpeg failed for $path → code $code");
                @unlink($path);
                return;
            }

            // Transcribe via local Whisper (Python)
            $txtPath = preg_replace('/\.wav$/', '.txt', $wavPath);
            $wCmd = implode(' ', [
                escapeshellarg($python),
                '-m whisper',
                escapeshellarg($wavPath),
                '--model base',
                '--language en',
                '--output_format txt',
                '--verbose False',
                '--output_dir ' . escapeshellarg(dirname($wavPath)),
            ]);

            exec($wCmd, $wOut, $wCode);
            if ($wCode !== 0) {
                Log::error("Whisper failed ($wCode) for $wavPath");
                @unlink($wavPath);
                @unlink($path);
                return;
            }

            $text = file_exists($txtPath) ? trim(file_get_contents($txtPath)) : '';

            if ($text === '') {
                Log::warning("Empty transcription for $path");
            } else {
                Log::info("Transcribed chunk ($fmt) → " . Str($text)->limit(80));

                // Append to full transcript
                $joined = trim((Cache::get("rt:$id:$sid:transcript", '') . ' ' . $text));
                Cache::put("rt:$id:$sid:transcript", $joined, 1800);

                // Quick feedback
                $fillerWords = preg_match_all('/\b(um|uh|like|you know)\b/i', $text) ?: 0;
                $pace = str_word_count($text) < 8 ? 'slow' : 'good';
                $analysis = [
                    'note' => mb_substr($text, 0, 80),
                    'fillerWords' => $fillerWords,
                    'pace' => $pace,
                ];

                // Append partial event to the SSE queue
                $key = "rt:$id:$sid:queue";
                $queue = Cache::get($key, []);
                $queue[] = ['type' => 'partial', 'text' => $text, 'analysis' => $analysis];
                Cache::put($key, $queue, 1800);
            }

            // Cleanup
            @unlink($txtPath);
            @unlink($wavPath);
            @unlink($path);
        } catch (\Throwable $e) {
            Log::error("TranscribeChunk exception: " . $e->getMessage());
        }
    }
}

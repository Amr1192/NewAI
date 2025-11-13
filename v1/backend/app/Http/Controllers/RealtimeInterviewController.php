<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class RealtimeInterviewController extends Controller
{
    public function start(int $id)
    {
        if (!DB::table('interviews')->where('id', $id)->exists()) {
            return response()->json(['error' => 'Interview not found'], 404);
        }

        $sid = (string) Str::uuid();
        Cache::put("rt:$id:$sid:open", true, 3600);
        Cache::put("rt:$id:$sid:transcript", '', 3600);
        Cache::put("rt:$id:$sid:queue", [], 3600);

        return response()->json(['sessionId' => $sid]);
    }

    public function chunk(int $id, Request $req)
    {
        $req->validate(['sessionId' => 'required', 'file' => 'required|file']);
        $sid = $req->input('sessionId');
        $file = $req->file('file');

        if (!Cache::get("rt:$id:$sid:open")) {
            return response()->json(['ok' => false, 'error' => 'session_closed']);
        }

        $chunkDir = storage_path('app/chunks');
        if (!file_exists($chunkDir)) mkdir($chunkDir, 0777, true);

        $filename = uniqid('chunk_', true) . '.webm';
        $chunkPath = "$chunkDir/$filename";
        $file->move($chunkDir, $filename);

        $text = $this->transcribeChunk($chunkPath);
        if ($text !== '') {
            $joined = trim((Cache::get("rt:$id:$sid:transcript", '') . ' ' . $text));
            Cache::put("rt:$id:$sid:transcript", $joined, 3600);

            $analysis = $this->quickFeedback($text);
            $queue = Cache::get("rt:$id:$sid:queue", []);
            $queue[] = ['type' => 'partial', 'text' => $text, 'analysis' => $analysis];
            Cache::put("rt:$id:$sid:queue", $queue, 3600);
        }

        @unlink($chunkPath);
        return response()->json(['ok' => true, 'text' => $text]);
    }

    public function stop(int $id, Request $req)
    {
        $req->validate(['sessionId' => 'required']);
        $sid = $req->input('sessionId');
        Cache::put("rt:$id:$sid:open", false, 3600);

        $row = DB::table('interviews')->find($id);
        if (!$row) return response()->json(['ok' => false, 'error' => 'interview_not_found']);

        $transcript = Cache::get("rt:$id:$sid:transcript", '');
        $idxAnswered = max(0, ((int)$row->current_question) - 1);
        $set = json_decode($row->question_set ?? '[]', true);
        $questionText = $set[$idxAnswered] ?? ($row->question ?? 'General question');

        $final = $this->finalFeedback($questionText, $transcript);

        DB::table('interview_answers')->updateOrInsert(
            ['interview_id' => $id, 'question_index' => $idxAnswered],
            [
                'question_text' => $questionText,
                'answer_text'   => $transcript,
                'feedback'      => json_encode($final),
                'created_at'    => now(),
                'updated_at'    => now(),
            ]
        );

        $queue = Cache::get("rt:$id:$sid:queue", []);
        $queue[] = ['type' => 'final', 'transcript' => $transcript, 'analysis' => $final];
        Cache::put("rt:$id:$sid:queue", $queue, 3600);

        Cache::put("rt:$id:$sid:transcript", '', 3600);
        return response()->json(['ok' => true]);
    }

    public function stream(int $id, string $sid)
    {
        set_time_limit(0);

        return response()->stream(function () use ($id, $sid) {
            $start = microtime(true);
            echo ": stream-start\n\n";
            @ob_flush(); @flush();

            while (microtime(true) - $start < 30) {
                $queue = Cache::pull("rt:$id:$sid:queue", []);
                foreach ($queue as $event) {
                    echo "event: {$event['type']}\n";
                    echo "data: " . json_encode($event) . "\n\n";
                    @ob_flush(); @flush();
                }
                usleep(200000);
            }

            echo "event: end\ndata: {}\n\n";
            @ob_flush(); @flush();
        }, 200, [
            'Content-Type'      => 'text/event-stream',
            'Cache-Control'     => 'no-cache',
            'Connection'        => 'keep-alive',
            'X-Accel-Buffering' => 'no',
        ]);
    }

    // ------------------------------------------------
    // Helpers
    // ------------------------------------------------

private function transcribeChunk(string $webmPath): string
{
    try {
        $ffmpeg = env('FFMPEG_PATH', 'ffmpeg');
        $serverUrl = rtrim(env('WHISPER_SERVER_URL', 'http://127.0.0.1:5000/transcribe'), '/');

        if (!file_exists($webmPath) || filesize($webmPath) < 1024) {
            Log::warning("transcribeChunk: input file missing or too small: $webmPath");
            return '';
        }

        // Convert incoming .webm to 16kHz mono WAV (whisper-friendly)
        $wavPath = storage_path('app/tmp_' . uniqid() . '.wav');
        $cmd = "\"{$ffmpeg}\" -hide_banner -loglevel error -y -i "
            . escapeshellarg($webmPath)
            . " -vn -acodec pcm_s16le -ar 16000 -ac 1 "
            . escapeshellarg($wavPath);

        exec($cmd, $ffOut, $ffCode);

        if ($ffCode !== 0 || !file_exists($wavPath) || filesize($wavPath) < 2000) {
            Log::error("transcribeChunk: FFmpeg failed (code=$ffCode) for $webmPath");
            @unlink($wavPath);
            return '';
        }

        // Send to local Faster-Whisper server
        $response = Http::timeout(25)
            ->retry(2, 200)
            ->attach('file', file_get_contents($wavPath), 'chunk.wav')
            ->post($serverUrl);

        @unlink($wavPath);

        if (!$response->ok()) {
            Log::error("transcribeChunk: Whisper server HTTP {$response->status()} - {$response->body()}");
            return '';
        }

        $text = trim((string) data_get($response->json(), 'text', ''));

        // 🧠 Apply safety filters for silence / hallucinations
        if ($text === '' || mb_strlen($text) < 5) {
            Log::info("🔇 Ignored empty or very short text");
            return '';
        }

        // Block known fake “silent” hallucinations or generic auto-speech
        $fakePatterns = [
            '/^(yeah|yes|okay|alright|sure|maybe|i think|uh huh|right)/i',
            '/(thank you|good question|no problem|that\'s (true|right))/i',
            '/^(hmm|huh|oh|ah)/i',
        ];

        foreach ($fakePatterns as $p) {
            if (preg_match($p, $text)) {
                Log::info("🛑 Blocked likely hallucinated Whisper text: '$text'");
                return '';
            }
        }

        return $text;
    } catch (\Throwable $e) {
        Log::error("transcribeChunk error: " . $e->getMessage());
        return '';
    }
}


    private function quickFeedback(string $text): array
{
    $clean = trim($text);

    // 🔇 If no speech, return silence feedback
    if ($clean === '' || mb_strlen($clean) < 5) {
        return [
            'note' => '…',
            'fillerWords' => 0,
            'pace' => 'silent',
        ];
    }

    // 🧠 Count filler words and estimate pace
    $fillerWords = preg_match_all('/\b(um|uh|like|you know)\b/i', $clean);
    $pace = str_word_count($clean) < 8 ? 'slow' : 'good';

    return [
        'note' => Str::limit($clean, 80),
        'fillerWords' => $fillerWords,
        'pace' => $pace,
    ];
}


    private function finalFeedback(string $question, string $answer): array
    {
        $prompt = <<<TXT
Analyze the following interview answer and output ONLY JSON:
Question: "$question"
Answer: "$answer"

JSON: {"clarity":0-100,"confidence":0-100,"structure":0-100,"summary":"short summary","tips":["tip1","tip2"]}
TXT;

        try {
            $res = Http::withHeaders([
                'Authorization' => 'Bearer ' . env('OPENAI_API_KEY'),
                'Content-Type' => 'application/json',
            ])->post('https://api.openai.com/v1/chat/completions', [
                'model' => 'gpt-4o-mini',
                'messages' => [
                    ['role' => 'system', 'content' => 'Return JSON only.'],
                    ['role' => 'user', 'content' => $prompt],
                ],
                'temperature' => 0.3,
            ]);

            $content = $res->json('choices.0.message.content') ?? '{}';
            $json = json_decode($content, true);
            return is_array($json)
                ? $json
                : ['clarity'=>70,'confidence'=>70,'structure'=>70,'summary'=>'Parse error','tips'=>[]];
        } catch (\Throwable $e) {
            Log::error("Feedback error: " . $e->getMessage());
            return ['clarity'=>60,'confidence'=>60,'structure'=>60,'summary'=>'Error','tips'=>[]];
        }
    }
}
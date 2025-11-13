<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

class RealtimeInterviewController extends Controller
{
    /**
     * POST /api/interviews/{id}/rt/start
     * Called when a question starts. Creates a new realtime session ID.
     */
    public function start(int $id)
    {
        if (!DB::table('interviews')->where('id', $id)->exists()) {
            return response()->json(['error' => 'Interview not found'], 404);
        }

        $sid = (string) Str::uuid();
        Cache::put("rt:$id:$sid:open", true, 3600);
        Cache::put("rt:$id:$sid:transcript", '', 3600);
        Cache::put("rt:$id:$sid:queue", [], 3600);

        // The frontend now connects to your Node WebSocket directly
        return response()->json([
            'sessionId' => $sid,
            'node_ws_url' => env('NODE_REALTIME_URL', 'ws://127.0.0.1:8081')
        ]);
    }

    /**
     * POST /api/interviews/{id}/rt/stop
     * Called when the user finishes speaking.
     * The frontend sends the full transcript.
     */
    public function stop(int $id, Request $req)
    {
        $req->validate([
            'sessionId' => 'required|string',
            'transcript' => 'nullable|string'
        ]);
        $sid = $req->input('sessionId');
        $text = trim($req->input('transcript', ''));

        Cache::put("rt:$id:$sid:open", false, 3600);

        $row = DB::table('interviews')->find($id);
        if (!$row) return response()->json(['ok' => false, 'error' => 'interview_not_found']);

        $idxAnswered = max(0, ((int) $row->current_question) - 1);
        $set = json_decode($row->question_set ?? '[]', true);
        $question = $set[$idxAnswered] ?? 'Unknown question';

        $feedback = $this->finalFeedback($question, $text);

        DB::table('interview_answers')->updateOrInsert(
            ['interview_id' => $id, 'question_index' => $idxAnswered],
            [
                'question_text' => $question,
                'answer_text' => $text,
                'feedback' => json_encode($feedback),
                'created_at' => now(),
                'updated_at' => now(),
            ]
        );

        return response()->json([
            'ok' => true,
            'analysis' => $feedback,
            'transcript' => $text,
        ]);
    }

    /**
     * POST /api/interviews/{id}/rt/save-chunk (optional future use)
     * Not used now since gpt-realtime handles continuous streaming.
     */
    public function chunk(int $id)
    {
        return response()->json(['ok' => true, 'note' => 'realtime handled via Node']);
    }

    // ----------------- Feedback helper -----------------

    private function finalFeedback(string $question, string $answer): array
    {
        $prompt = <<<PROMPT
Evaluate this interview answer and output ONLY JSON:
Question: "$question"
Answer: "$answer"

JSON: {"clarity":0-100,"confidence":0-100,"structure":0-100,"summary":"short summary","tips":["tip1","tip2"]}
PROMPT;

        try {
            $res = Http::withToken(env('OPENAI_API_KEY'))
                ->post('https://api.openai.com/v1/chat/completions', [
                    'model' => env('FEEDBACK_MODEL', 'gpt-5-mini'),
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
                : ['clarity'=>70,'confidence'=>70,'structure'=>70,'summary'=>'parse error','tips'=>[]];
        } catch (\Throwable $e) {
            Log::error('Feedback error: '.$e->getMessage());
            return ['clarity'=>60,'confidence'=>60,'structure'=>60,'summary'=>'error','tips'=>[]];
        }
    }
}

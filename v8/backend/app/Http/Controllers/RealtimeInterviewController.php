<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

class RealtimeInterviewController extends Controller
{
    /**
     * POST /api/interviews/{id}/rt/start
     * Called when a question starts. Returns Node.js WebSocket URL.
     */
    public function start(int $id)
    {
        $interview = DB::table('interviews')->where('id', $id)->first();
        
        if (!$interview) {
            return response()->json(['error' => 'Interview not found'], 404);
        }

        $sid = (string) Str::uuid();

        return response()->json([
            'sessionId' => $sid,
            'node_ws_url' => env('NODE_REALTIME_URL', 'ws://127.0.0.1:8081'),
            'interview_id' => $id
        ]);
    }

    /**
     * POST /api/interviews/{id}/rt/submit-answer
     * Called when the user finishes speaking and submits their answer.
     * Analyzes the answer and provides detailed feedback.
     */
    public function submitAnswer(int $id, Request $req)
    {
        $req->validate([
            'sessionId' => 'required|string',
            'transcript' => 'required|string',
            'question_index' => 'required|integer'
        ]);

        $sid = $req->input('sessionId');
        $transcript = trim($req->input('transcript'));
        $questionIndex = $req->input('question_index');

        $interview = DB::table('interviews')->find($id);
        if (!$interview) {
            return response()->json(['error' => 'Interview not found'], 404);
        }

        // Get the question from the interview
        $questionSet = json_decode($interview->question_set ?? '[]', true);
        if (!isset($questionSet[$questionIndex])) {
            return response()->json(['error' => 'Invalid question index'], 400);
        }

        $question = $questionSet[$questionIndex];

        // Analyze the answer using AI
        $feedback = $this->analyzeAnswer($question, $transcript);

        // Save to database
        DB::table('interview_answers')->updateOrInsert(
            [
                'interview_id' => $id,
                'question_index' => $questionIndex
            ],
            [
                'question_text' => $question,
                'answer_text' => $transcript,
                'feedback' => json_encode($feedback),
                'created_at' => now(),
                'updated_at' => now(),
            ]
        );

        return response()->json([
            'ok' => true,
            'feedback' => $feedback,
            'transcript' => $transcript,
            'question_index' => $questionIndex
        ]);
    }

    /**
     * Analyze interview answer using AI and provide detailed feedback
     */
    private function analyzeAnswer(string $question, string $answer): array
    {
        // Handle empty or very short answers
        if (strlen($answer) < 10) {
            return [
                'clarity' => 20,
                'confidence' => 20,
                'structure' => 20,
                'relevance' => 20,
                'summary' => 'Answer too short. Please provide more detail.',
                'tips' => ['Provide a more detailed response', 'Aim for at least 50 words']
            ];
        }

        $prompt = <<<PROMPT
You are an expert interview coach analyzing a candidate's answer. Evaluate the following interview response:

**Question:** "$question"

**Candidate's Answer:** "$answer"

Provide a detailed analysis with scores (0-100) for:
1. **Clarity**: How clear and easy to understand is the answer?
2. **Confidence**: Does the candidate sound confident and knowledgeable?
3. **Structure**: Is the answer well-organized with a clear beginning, middle, and end?
4. **Relevance**: How well does the answer address the question?

Also provide:
- A brief summary (1-2 sentences) of the overall performance
- 2-3 actionable tips for improvement

OUTPUT ONLY VALID JSON in this exact format:
{
  "clarity": 0-100,
  "confidence": 0-100,
  "structure": 0-100,
  "relevance": 0-100,
  "summary": "brief summary here",
  "tips": ["tip 1", "tip 2", "tip 3"]
}

DO NOT include any markdown formatting or code blocks. ONLY OUTPUT THE JSON OBJECT.
PROMPT;

        try {
            $apiKey = env('OPENAI_API_KEY');
            
            // ✅ FIXED: Use actual OpenAI model
            $model = 'gpt-4o-mini';

            Log::info('Analyzing answer with AI', [
                'model' => $model,
                'question_length' => strlen($question),
                'answer_length' => strlen($answer)
            ]);

            $headers = ['Authorization' => 'Bearer ' . $apiKey];

            $res = Http::withHeaders($headers)
                ->timeout(20)
                ->post('https://api.openai.com/v1/chat/completions', [
                    'model' => $model,
                    'messages' => [
                        [
                            'role' => 'system',
                            'content' => 'You are an interview coach. Return ONLY valid JSON without markdown formatting.'
                        ],
                        ['role' => 'user', 'content' => $prompt],
                    ],
                    'temperature' => 0.3,
                    'max_tokens' => 800,
                ]);

            if (!$res->successful()) {
                Log::error('Feedback API error', [
                    'status' => $res->status(),
                    'body' => $res->body()
                ]);
                return $this->getFallbackFeedback($answer);
            }

            $content = $res->json('choices.0.message.content') ?? '{}';
            
            Log::info('AI feedback received', [
                'content_length' => strlen($content),
                'preview' => substr($content, 0, 100)
            ]);
            
            // Clean response
            $content = preg_replace('/```json\s*|\s*```/', '', $content);
            $content = trim($content);
            
            $feedback = json_decode($content, true);

            if (!is_array($feedback) || !isset($feedback['clarity'])) {
                Log::warning('Invalid feedback format from AI', ['content' => $content]);
                return $this->getFallbackFeedback($answer);
            }

            Log::info('AI feedback successfully parsed', [
                'clarity' => $feedback['clarity'] ?? 0,
                'confidence' => $feedback['confidence'] ?? 0,
                'structure' => $feedback['structure'] ?? 0,
                'relevance' => $feedback['relevance'] ?? 0
            ]);

            // Ensure all required fields exist
            return [
                'clarity' => (int) ($feedback['clarity'] ?? 70),
                'confidence' => (int) ($feedback['confidence'] ?? 70),
                'structure' => (int) ($feedback['structure'] ?? 70),
                'relevance' => (int) ($feedback['relevance'] ?? 70),
                'summary' => $feedback['summary'] ?? 'Good effort on this answer.',
                'tips' => $feedback['tips'] ?? ['Keep practicing']
            ];

        } catch (\Throwable $e) {
            Log::error('Feedback analysis error: ' . $e->getMessage());
            return $this->getFallbackFeedback($answer);
        }
    }

    /**
     * Generate fallback feedback based on basic metrics
     * This is only used when AI analysis fails
     */
    private function getFallbackFeedback(string $answer): array
    {
        Log::warning('Using FALLBACK feedback (AI analysis failed)');
        
        $wordCount = str_word_count($answer);
        $sentences = preg_split('/[.!?]+/', $answer, -1, PREG_SPLIT_NO_EMPTY);
        $sentenceCount = count($sentences);

        // Basic scoring based on length and structure
        $clarityScore = min(100, max(40, $wordCount * 2));
        $confidenceScore = 65;
        $structureScore = min(100, max(50, $sentenceCount * 15));
        $relevanceScore = 70;

        $tips = [];
        if ($wordCount < 30) {
            $tips[] = "Try to provide more detailed responses (aim for 50+ words)";
        }
        if ($sentenceCount < 3) {
            $tips[] = "Structure your answer into multiple clear points";
        }
        $tips[] = "Use specific examples to support your points";

        return [
            'clarity' => (int) $clarityScore,
            'confidence' => (int) $confidenceScore,
            'structure' => (int) $structureScore,
            'relevance' => (int) $relevanceScore,
            'summary' => "⚠️ Basic analysis (AI unavailable). Word count: {$wordCount}. Consider adding more detail and structure.",
            'tips' => $tips
        ];
    }
}
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

        // ✅ FIX: Remove duplicate sentences
        $transcript = $this->deduplicateText($transcript);

        $interview = DB::table('interviews')->find($id);
        if (!$interview) {
            return response()->json(['error' => 'Interview not found'], 404);
        }

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
     * ✅ NEW: Remove duplicate sentences from transcription
     */
    private function deduplicateText(string $text): string
    {
        // Split into sentences
        $sentences = preg_split('/([.!?]+)/', $text, -1, PREG_SPLIT_DELIM_CAPTURE | PREG_SPLIT_NO_EMPTY);
        
        $result = [];
        $seen = [];
        
        for ($i = 0; $i < count($sentences); $i++) {
            $sentence = trim($sentences[$i]);
            
            // Skip empty
            if (empty($sentence)) continue;
            
            // Keep punctuation
            if (preg_match('/^[.!?]+$/', $sentence)) {
                $result[] = $sentence;
                continue;
            }
            
            // Normalize for comparison
            $normalized = strtolower(preg_replace('/\s+/', ' ', $sentence));
            
            // Check if we've seen this sentence
            if (!in_array($normalized, $seen)) {
                $seen[] = $normalized;
                $result[] = $sentence;
            } else {
                Log::info('Removed duplicate sentence', ['sentence' => $sentence]);
            }
        }
        
        return implode(' ', $result);
    }

    /**
     * ✅ IMPROVED: Better AI analysis with more helpful feedback
     */
    private function analyzeAnswer(string $question, string $answer): array
    {
        // Handle empty or very short answers
        if (strlen($answer) < 10) {
            return [
                'clarity' => 30,
                'confidence' => 30,
                'structure' => 30,
                'relevance' => 30,
                'summary' => 'Your answer is too brief. Interview answers should be at least 50-100 words to properly demonstrate your knowledge.',
                'tips' => [
                    'Expand your answer with specific examples',
                    'Use the STAR method: Situation, Task, Action, Result',
                    'Aim for 1-2 minutes of speaking (100-150 words)'
                ]
            ];
        }

        $wordCount = str_word_count($answer);

        $prompt = <<<PROMPT
You are an expert technical interviewer evaluating a candidate's answer. Be CONSTRUCTIVE and ENCOURAGING while being honest.

**Interview Question:**
"$question"

**Candidate's Answer (${wordCount} words):**
"$answer"

**Your Task:**
Evaluate this answer professionally. Consider:
- Did they answer the question directly?
- Did they provide specific examples or just generalities?
- Was the explanation clear and well-structured?
- Did they demonstrate actual knowledge/experience?

**Scoring Guide:**
- 80-100: Excellent answer with specific examples and clear explanation
- 65-79: Good answer that addresses the question well
- 50-64: Adequate answer but lacks detail or clarity
- 35-49: Incomplete or unclear answer
- Below 35: Does not address the question

**Important:**
- Be FAIR and REALISTIC
- Give credit for good points even if answer isn't perfect
- Provide SPECIFIC, ACTIONABLE tips
- Be encouraging - this is a learning experience

Return ONLY valid JSON (no markdown, no code blocks):
{
  "clarity": [score 0-100],
  "confidence": [score 0-100],
  "structure": [score 0-100],
  "relevance": [score 0-100],
  "summary": "1-2 sentences explaining the score. Start with something positive if possible.",
  "tips": [
    "Specific actionable tip 1",
    "Specific actionable tip 2",
    "Specific actionable tip 3"
  ]
}
PROMPT;

        try {
            $apiKey = env('OPENAI_API_KEY');
            $model = 'gpt-4o-mini';

            Log::info('Analyzing answer with AI', [
                'model' => $model,
                'question_length' => strlen($question),
                'answer_length' => strlen($answer),
                'word_count' => $wordCount
            ]);

            $res = Http::withHeaders(['Authorization' => 'Bearer ' . $apiKey])
                ->timeout(30)
                ->post('https://api.openai.com/v1/chat/completions', [
                    'model' => $model,
                    'messages' => [
                        [
                            'role' => 'system',
                            'content' => 'You are a professional interview coach who provides constructive, specific feedback. Always return valid JSON only.'
                        ],
                        ['role' => 'user', 'content' => $prompt],
                    ],
                    'temperature' => 0.4, // Lower for more consistent scoring
                    'max_tokens' => 800,
                ]);

            if (!$res->successful()) {
                Log::error('AI Analysis API error', [
                    'status' => $res->status(),
                    'body' => $res->body()
                ]);
                return $this->getFallbackFeedback($answer, $wordCount);
            }

            $content = $res->json('choices.0.message.content') ?? '{}';
            
            Log::info('AI feedback received', [
                'content_length' => strlen($content),
                'preview' => substr($content, 0, 100)
            ]);
            
            // Clean response - remove markdown
            $content = preg_replace('/```json\s*|\s*```/', '', $content);
            $content = trim($content);
            
            $feedback = json_decode($content, true);

            if (!is_array($feedback) || !isset($feedback['clarity'])) {
                Log::warning('Invalid feedback format from AI', ['content' => $content]);
                return $this->getFallbackFeedback($answer, $wordCount);
            }

            // Ensure scores are reasonable (not too harsh)
            $feedback['clarity'] = max(35, min(100, (int) $feedback['clarity']));
            $feedback['confidence'] = max(35, min(100, (int) $feedback['confidence']));
            $feedback['structure'] = max(35, min(100, (int) $feedback['structure']));
            $feedback['relevance'] = max(35, min(100, (int) $feedback['relevance']));

            Log::info('✅ AI feedback successfully parsed', [
                'clarity' => $feedback['clarity'],
                'confidence' => $feedback['confidence'],
                'structure' => $feedback['structure'],
                'relevance' => $feedback['relevance']
            ]);

            return [
                'clarity' => $feedback['clarity'],
                'confidence' => $feedback['confidence'],
                'structure' => $feedback['structure'],
                'relevance' => $feedback['relevance'],
                'summary' => $feedback['summary'] ?? 'Good effort on this answer.',
                'tips' => $feedback['tips'] ?? ['Keep practicing', 'Be more specific', 'Use examples']
            ];

        } catch (\Throwable $e) {
            Log::error('Feedback analysis error: ' . $e->getMessage());
            return $this->getFallbackFeedback($answer, $wordCount);
        }
    }

    /**
     * ✅ IMPROVED: Smarter fallback feedback
     */
    private function getFallbackFeedback(string $answer, int $wordCount): array
    {
        Log::warning('⚠️ Using FALLBACK feedback (AI analysis unavailable)');
        
        if ($wordCount === null) {
            $wordCount = str_word_count($answer);
        }

        $sentences = preg_split('/[.!?]+/', $answer, -1, PREG_SPLIT_NO_EMPTY);
        $sentenceCount = count($sentences);

        // Smart scoring based on answer quality indicators
        $clarityScore = 50;
        $confidenceScore = 55;
        $structureScore = 50;
        $relevanceScore = 60;

        // Reward longer, more detailed answers
        if ($wordCount > 50) $clarityScore += 10;
        if ($wordCount > 100) {
            $clarityScore += 10;
            $relevanceScore += 10;
        }

        // Reward good structure
        if ($sentenceCount >= 3) $structureScore += 15;
        if ($sentenceCount >= 5) $structureScore += 10;

        // Check for technical terms (indicates knowledge)
        $technicalTerms = ['component', 'function', 'method', 'lifecycle', 'state', 'props', 'hook', 'render'];
        $lowerAnswer = strtolower($answer);
        $techCount = 0;
        foreach ($technicalTerms as $term) {
            if (strpos($lowerAnswer, $term) !== false) $techCount++;
        }
        if ($techCount >= 3) {
            $confidenceScore += 15;
            $relevanceScore += 10;
        }

        // Cap scores
        $clarityScore = min(75, $clarityScore);
        $confidenceScore = min(75, $confidenceScore);
        $structureScore = min(75, $structureScore);
        $relevanceScore = min(80, $relevanceScore);

        $tips = [];
        if ($wordCount < 50) {
            $tips[] = "Expand your answers to 100-150 words for better depth";
        }
        if ($sentenceCount < 3) {
            $tips[] = "Break your answer into multiple clear points";
        }
        if ($techCount < 2) {
            $tips[] = "Include specific technical terms and examples";
        }
        if (empty($tips)) {
            $tips = [
                "Good foundation - add specific real-world examples",
                "Practice the STAR method for structured answers",
                "Aim to speak for 1-2 minutes per question"
            ];
        }

        $average = ($clarityScore + $confidenceScore + $structureScore + $relevanceScore) / 4;
        $summary = $average >= 65
            ? "Solid answer with {$wordCount} words. You're on the right track - keep building on this foundation."
            : "Your answer shows effort ({$wordCount} words). Focus on adding more specific examples and structure to strengthen your response.";

        return [
            'clarity' => (int) $clarityScore,
            'confidence' => (int) $confidenceScore,
            'structure' => (int) $structureScore,
            'relevance' => (int) $relevanceScore,
            'summary' => $summary,
            'tips' => $tips
        ];
    }
}
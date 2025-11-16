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
     * ✅ ENHANCED: Now includes emotion detection, body language, and conversation analysis
     */
    public function submitAnswer(int $id, Request $req)
    {
        $req->validate([
            'sessionId' => 'required|string',
            'transcript' => 'required|string',
            'question_index' => 'required|integer',
            'ai_followups' => 'nullable|array',  // ✅ NEW: Track AI follow-up questions
            'video_frame' => 'nullable|string',   // ✅ NEW: Base64 video frame for body language
            'emotional_metrics' => 'nullable|array' // ✅ NEW: Real-time emotion data from frontend
        ]);

        $sid = $req->input('sessionId');
        $transcript = trim($req->input('transcript'));
        $questionIndex = $req->input('question_index');
        $aiFollowups = $req->input('ai_followups', []);
        $videoFrame = $req->input('video_frame');
        $emotionalMetrics = $req->input('emotional_metrics', []);

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

        // ✅ NEXT LEVEL: Multi-dimensional analysis
        Log::info('🚀 Next-level analysis starting', [
            'interview_id' => $id,
            'has_video' => !empty($videoFrame),
            'ai_followups_count' => count($aiFollowups),
            'transcript_length' => strlen($transcript)
        ]);

        // 1. Standard feedback (existing)
        $standardFeedback = $this->analyzeAnswer($question, $transcript);

        // 2. ✅ NEW: Emotion detection from transcript
        $emotionAnalysis = $this->analyzeEmotionFromText($transcript);

        // 3. ✅ NEW: Body language analysis (if video available)
        $bodyLanguage = null;
        if (!empty($videoFrame)) {
            $bodyLanguage = $this->analyzeBodyLanguage($videoFrame);
        }

        // 4. ✅ NEW: Conversation quality (AI engagement)
        $conversationQuality = $this->analyzeConversationFlow($aiFollowups, $transcript);

        // Combine all feedback
        $enhancedFeedback = array_merge($standardFeedback, [
            'emotional_analysis' => $emotionAnalysis,
            'body_language' => $bodyLanguage,
            'conversation_quality' => $conversationQuality,
            'ai_engagement_score' => count($aiFollowups) * 15, // More followups = better engagement
            'next_level_enabled' => true
        ]);

        Log::info('✅ Next-level analysis complete', [
            'emotion_confidence' => $emotionAnalysis['confidence_level'] ?? 'unknown',
            'body_language_score' => $bodyLanguage['overall_score'] ?? 'N/A',
            'conversation_depth' => count($aiFollowups)
        ]);

        // Save to database with enhanced feedback
        DB::table('interview_answers')->updateOrInsert(
            [
                'interview_id' => $id,
                'question_index' => $questionIndex
            ],
            [
                'question_text' => $question,
                'answer_text' => $transcript,
                'feedback' => json_encode($enhancedFeedback),
                'ai_followups' => json_encode($aiFollowups),
                'created_at' => now(),
                'updated_at' => now(),
            ]
        );

        return response()->json([
            'ok' => true,
            'feedback' => $enhancedFeedback,
            'transcript' => $transcript,
            'question_index' => $questionIndex
        ]);
    }

    /**
     * ✅ NEW: Analyze emotional state from transcript using GPT-4o
     */
    private function analyzeEmotionFromText(string $transcript): array
    {
        if (strlen($transcript) < 20) {
            return [
                'confidence_level' => 'unknown',
                'tone' => 'brief response',
                'filler_words' => 0,
                'speaking_pace' => 'too short to analyze'
            ];
        }

        $prompt = <<<PROMPT
You are an expert at analyzing emotional state and confidence from interview responses.

Analyze this candidate's answer for emotional indicators:
"$transcript"

Evaluate:
1. Confidence level (high/medium/low) based on word choice and phrasing
2. Tone (professional/nervous/enthusiastic/defensive/uncertain)
3. Count of filler words (um, uh, like, you know, kind of, sort of)
4. Speaking pace indicators (too fast if rushed/repetitive, good if flowing, too slow if hesitant)

Return ONLY valid JSON:
{
  "confidence_level": "high/medium/low",
  "tone": "description",
  "filler_words": number,
  "speaking_pace": "too fast/good/too slow",
  "key_strengths": ["strength1", "strength2"],
  "areas_to_improve": ["area1", "area2"]
}

NO markdown formatting. ONLY JSON.
PROMPT;

        try {
            $apiKey = env('OPENAI_API_KEY');
            $model = 'gpt-4o-mini'; // Using your available model

            $res = Http::withHeaders(['Authorization' => 'Bearer ' . $apiKey])
                ->timeout(15)
                ->post('https://api.openai.com/v1/chat/completions', [
                    'model' => $model,
                    'messages' => [
                        ['role' => 'system', 'content' => 'You are an emotional intelligence expert. Return ONLY valid JSON.'],
                        ['role' => 'user', 'content' => $prompt],
                    ],
                    'temperature' => 0.3,
                    'max_tokens' => 500,
                ]);

            if (!$res->successful()) {
                Log::warning('Emotion analysis API failed', ['status' => $res->status()]);
                return $this->getFallbackEmotionAnalysis($transcript);
            }

            $content = trim(preg_replace('/```json\s*|\s*```/', '', $res->json('choices.0.message.content') ?? '{}'));
            $emotion = json_decode($content, true);

            if (!is_array($emotion)) {
                return $this->getFallbackEmotionAnalysis($transcript);
            }

            return [
                'confidence_level' => $emotion['confidence_level'] ?? 'medium',
                'tone' => $emotion['tone'] ?? 'professional',
                'filler_words' => (int) ($emotion['filler_words'] ?? 0),
                'speaking_pace' => $emotion['speaking_pace'] ?? 'good',
                'key_strengths' => $emotion['key_strengths'] ?? [],
                'areas_to_improve' => $emotion['areas_to_improve'] ?? []
            ];

        } catch (\Throwable $e) {
            Log::error('Emotion analysis exception: ' . $e->getMessage());
            return $this->getFallbackEmotionAnalysis($transcript);
        }
    }

    /**
     * ✅ NEW: Analyze body language from video frame using GPT-4o Vision
     */
    private function analyzeBodyLanguage(string $videoFrameBase64): ?array
    {
        try {
            // Remove data URL prefix if present
            if (strpos($videoFrameBase64, ',') !== false) {
                $videoFrameBase64 = explode(',', $videoFrameBase64)[1];
            }

            $apiKey = env('OPENAI_API_KEY');
            $model = 'gpt-4o'; // ✅ You have this model with vision!

            Log::info('Analyzing body language with GPT-4o Vision');

            $res = Http::withHeaders(['Authorization' => 'Bearer ' . $apiKey])
                ->timeout(20)
                ->post('https://api.openai.com/v1/chat/completions', [
                    'model' => $model,
                    'messages' => [
                        [
                            'role' => 'system',
                            'content' => 'You are an expert at analyzing body language during interviews. Return ONLY valid JSON.'
                        ],
                        [
                            'role' => 'user',
                            'content' => [
                                [
                                    'type' => 'text',
                                    'text' => <<<PROMPT
Analyze this candidate's body language during an interview.

Evaluate:
- Eye contact (direct/avoiding/natural)
- Posture (confident/slouched/tense/relaxed)
- Facial expressions (engaged/nervous/confident/neutral)
- Overall professionalism score (0-100)

Return ONLY valid JSON:
{
  "eye_contact": "description",
  "posture": "description",
  "facial_expressions": "description",
  "overall_score": 0-100,
  "recommendations": ["tip1", "tip2"]
}
PROMPT
                                ],
                                [
                                    'type' => 'image_url',
                                    'image_url' => [
                                        'url' => "data:image/jpeg;base64,{$videoFrameBase64}",
                                        'detail' => 'low' // Faster and cheaper
                                    ]
                                ]
                            ]
                        ]
                    ],
                    'temperature' => 0.3,
                    'max_tokens' => 400,
                ]);

            if (!$res->successful()) {
                Log::warning('Body language API failed', ['status' => $res->status()]);
                return null;
            }

            $content = trim(preg_replace('/```json\s*|\s*```/', '', $res->json('choices.0.message.content') ?? '{}'));
            $bodyLanguage = json_decode($content, true);

            if (!is_array($bodyLanguage)) {
                return null;
            }

            Log::info('✅ Body language analyzed', [
                'overall_score' => $bodyLanguage['overall_score'] ?? 'N/A'
            ]);

            return [
                'eye_contact' => $bodyLanguage['eye_contact'] ?? 'Unable to determine',
                'posture' => $bodyLanguage['posture'] ?? 'Unable to determine',
                'facial_expressions' => $bodyLanguage['facial_expressions'] ?? 'Unable to determine',
                'overall_score' => (int) ($bodyLanguage['overall_score'] ?? 75),
                'recommendations' => $bodyLanguage['recommendations'] ?? []
            ];

        } catch (\Throwable $e) {
            Log::error('Body language analysis exception: ' . $e->getMessage());
            return null;
        }
    }

    /**
     * ✅ NEW: Analyze conversation quality based on AI follow-ups
     */
    private function analyzeConversationFlow(array $aiFollowups, string $transcript): array
    {
        $followupCount = count($aiFollowups);
        $wordCount = str_word_count($transcript);

        // More follow-ups = deeper engagement
        $engagementQuality = $followupCount >= 3 ? 'high' : ($followupCount >= 1 ? 'medium' : 'low');
        
        $naturalnessScore = min(100, 60 + ($followupCount * 10) + ($wordCount > 50 ? 10 : 0));

        return [
            'total_followups' => $followupCount,
            'engagement_quality' => $engagementQuality,
            'conversation_depth' => "The AI asked {$followupCount} follow-up question(s), indicating " . 
                                   ($followupCount > 2 ? 'excellent' : ($followupCount > 0 ? 'good' : 'basic')) . 
                                   ' engagement',
            'naturalness_score' => $naturalnessScore,
            'word_count' => $wordCount
        ];
    }

    /**
     * Fallback emotion analysis when AI is unavailable
     */
    private function getFallbackEmotionAnalysis(string $transcript): array
    {
        $text = strtolower($transcript);
        
        // Simple keyword detection
        $confidentWords = ['definitely', 'absolutely', 'certainly', 'clearly', 'successfully', 'achieved'];
        $hesitantWords = ['maybe', 'perhaps', 'um', 'uh', 'like', 'you know', 'kind of', 'sort of'];
        
        $confidentCount = 0;
        $hesitantCount = 0;
        
        foreach ($confidentWords as $word) {
            $confidentCount += substr_count($text, $word);
        }
        foreach ($hesitantWords as $word) {
            $hesitantCount += substr_count($text, $word);
        }
        
        $confidenceLevel = $hesitantCount > $confidentCount ? 'low' : 
                          ($confidentCount > $hesitantCount ? 'high' : 'medium');

        return [
            'confidence_level' => $confidenceLevel,
            'tone' => 'professional',
            'filler_words' => $hesitantCount,
            'speaking_pace' => 'good',
            'key_strengths' => $confidentCount > 0 ? ['Uses confident language'] : [],
            'areas_to_improve' => $hesitantCount > 3 ? ['Reduce filler words'] : []
        ];
    }

    /**
     * Standard answer analysis (your existing method, kept as-is)
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
            
            // Clean response
            $content = preg_replace('/```json\s*|\s*```/', '', $content);
            $content = trim($content);
            
            $feedback = json_decode($content, true);

            if (!is_array($feedback) || !isset($feedback['clarity'])) {
                Log::warning('Invalid feedback format from AI', ['content' => $content]);
                return $this->getFallbackFeedback($answer);
            }

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
     */
    private function getFallbackFeedback(string $answer): array
    {
        Log::warning('Using FALLBACK feedback (AI analysis failed)');
        
        $wordCount = str_word_count($answer);
        $sentences = preg_split('/[.!?]+/', $answer, -1, PREG_SPLIT_NO_EMPTY);
        $sentenceCount = count($sentences);

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
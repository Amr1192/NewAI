<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class InterviewController extends Controller
{
    /**
     * POST /api/interviews/start
     * Creates an interview with AI-generated questions based on user skills.
     */
    public function start(Request $request)
    {
        $request->validate([
            'user_id' => 'required|integer',
            'skill_ids' => 'nullable|array',
            'num_questions' => 'nullable|integer|min:3|max:10',
        ]);

        $userId = $request->input('user_id');
        $skillIds = $request->input('skill_ids', []);
        $numQuestions = $request->input('num_questions', 5);

        // Fetch user skills
        $skills = [];
        if (!empty($skillIds)) {
            $skills = DB::table('user_skills')
                ->whereIn('id', $skillIds)
                ->where('user_id', $userId)
                ->get(['title', 'years_of_experience', 'proficiency_level'])
                ->toArray();
        } else {
            $skills = DB::table('user_skills')
                ->where('user_id', $userId)
                ->get(['title', 'years_of_experience', 'proficiency_level'])
                ->toArray();
        }

        if (empty($skills)) {
            return response()->json(['error' => 'No skills found for this user'], 400);
        }

        // Generate questions using OpenAI
        $questions = $this->generateQuestions($skills, $numQuestions);

        if (empty($questions)) {
            return response()->json(['error' => 'Failed to generate questions'], 500);
        }

        $id = DB::table('interviews')->insertGetId([
            'user_id' => $userId,
            'question_set' => json_encode(array_values($questions)),
            'current_question' => 0,
            'status' => 'created',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return response()->json([
            'id' => $id,
            'status' => 'created',
            'questions' => $questions,
            'skills_used' => $skills
        ]);
    }

    /**
     * Generate interview questions using OpenAI based on user skills
     */
    private function generateQuestions(array $skills, int $count): array
    {
        $skillContext = collect($skills)->map(function ($skill) {
            return "- {$skill->title} ({$skill->proficiency_level} level, {$skill->years_of_experience} years experience)";
        })->implode("\n");

        $prompt = <<<PROMPT
You are an expert technical interviewer. Generate exactly {$count} interview questions for a candidate with the following skills:

{$skillContext}

Requirements:
- Questions should match the candidate's proficiency level for each skill
- Mix technical, behavioral, and situational questions appropriately
- Questions should be realistic and relevant to actual job interviews
- Each question should be clear, specific, and answerable in 1-3 minutes
- Return ONLY a valid JSON array of strings (the questions), no other text
- Format: ["Question 1", "Question 2", ...]

DO NOT include markdown code blocks or any other formatting. OUTPUT ONLY THE JSON ARRAY.
PROMPT;

        try {
            $apiKey = env('OPENAI_API_KEY');
            
            if (!$apiKey) {
                Log::error('OPENAI_API_KEY is not set in .env file');
                return $this->getFallbackQuestions($skills);
            }

            $model = 'gpt-5-mini';

            Log::info('Attempting to generate questions', [
                'model' => $model,
                'skill_count' => count($skills),
                'num_questions' => $count
            ]);

            $response = Http::withHeaders([
                'Authorization' => 'Bearer ' . $apiKey,
                'Content-Type' => 'application/json'
            ])
            ->timeout(60)
            ->post('https://api.openai.com/v1/chat/completions', [
                'model' => $model,
                'messages' => [
                    [
                        'role' => 'system',
                        'content' => 'You are a technical interviewer. Always return ONLY valid JSON arrays with no markdown formatting.'
                    ],
                    ['role' => 'user', 'content' => $prompt],
                ],
                'temperature' => 0.7,
                'max_tokens' => 2000,
            ]);

            // Log the response status and body
            Log::info('OpenAI Response', [
                'status' => $response->status(),
                'successful' => $response->successful(),
                'body_preview' => substr($response->body(), 0, 500)
            ]);

            if (!$response->successful()) {
                Log::error('OpenAI API error', [
                    'status' => $response->status(),
                    'body' => $response->body(),
                    'headers' => $response->headers()
                ]);
                return $this->getFallbackQuestions($skills);
            }

            $responseData = $response->json();
            
            // Check for errors in response
            if (isset($responseData['error'])) {
                Log::error('OpenAI returned error', [
                    'error' => $responseData['error']
                ]);
                return $this->getFallbackQuestions($skills);
            }

            $content = $responseData['choices'][0]['message']['content'] ?? '[]';
            
            Log::info('OpenAI content received', [
                'content_length' => strlen($content),
                'content_preview' => substr($content, 0, 200)
            ]);
            
            // Clean up the response - remove markdown code blocks if present
            $content = preg_replace('/```json\s*/', '', $content);
            $content = preg_replace('/```\s*/', '', $content);
            $content = trim($content);
            
            $questions = json_decode($content, true);

            if (json_last_error() !== JSON_ERROR_NONE) {
                Log::error('JSON decode error', [
                    'error' => json_last_error_msg(),
                    'content' => $content
                ]);
                return $this->getFallbackQuestions($skills);
            }

            if (!is_array($questions) || empty($questions)) {
                Log::warning('Invalid questions format from OpenAI', [
                    'content' => $content,
                    'model' => $model,
                    'decoded' => $questions
                ]);
                return $this->getFallbackQuestions($skills);
            }

            Log::info('Successfully generated questions', [
                'count' => count($questions),
                'questions' => $questions
            ]);

            // Ensure we return exactly $count questions
            return array_slice($questions, 0, $count);

        } catch (\Throwable $e) {
            Log::error('Question generation exception', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            return $this->getFallbackQuestions($skills);
        }
    }

    /**
     * Fallback questions if OpenAI fails
     */
    private function getFallbackQuestions(array $skills): array
    {
        Log::warning('Using fallback questions');
        
        $skillTitles = collect($skills)->pluck('title')->take(3)->implode(', ');
        
        return [
            "Tell me about your experience with {$skillTitles}.",
            "What are your greatest strengths in your technical skillset?",
            "Describe a challenging project you worked on and how you handled it.",
            "How do you stay updated with the latest developments in your field?",
            "Where do you see yourself in the next 2-3 years?"
        ];
    }

    /**
     * GET /api/interviews/{id}/next-question
     */
    public function nextQuestion(int $id)
    {
        $row = DB::table('interviews')->find($id);
        if (!$row) return response()->json(['error' => 'Interview not found'], 404);

        $set = json_decode($row->question_set ?? '[]', true);
        $idx = (int) ($row->current_question ?? 0);

        if ($idx >= count($set)) {
            return response()->json(['done' => true]);
        }

        $question = $set[$idx];
        
        // Update current_question to next index
        DB::table('interviews')->where('id', $id)->update([
            'current_question' => $idx + 1,
            'updated_at' => now(),
        ]);

        return response()->json([
            'done' => false,
            'index' => $idx,
            'question' => $question,
            'remaining' => count($set) - ($idx + 1),
            'total' => count($set)
        ]);
    }

    /**
     * POST /api/interviews/{id}/finalize
     */
    public function finalize(int $id)
    {
        $row = DB::table('interviews')->find($id);
        if (!$row) return response()->json(['error' => 'Not found'], 404);

        $answers = DB::table('interview_answers')
            ->where('interview_id', $id)
            ->orderBy('question_index')
            ->get();

        $scores = ['clarity' => 0, 'confidence' => 0, 'structure' => 0, 'relevance' => 0];
        $n = max(1, $answers->count());

        foreach ($answers as $a) {
            $fx = json_decode($a->feedback ?? '{}', true) ?: [];
            $scores['clarity'] += $fx['clarity'] ?? 0;
            $scores['confidence'] += $fx['confidence'] ?? 0;
            $scores['structure'] += $fx['structure'] ?? 0;
            $scores['relevance'] += $fx['relevance'] ?? 0;
        }

        $overall = [
            'clarity' => (int) round($scores['clarity'] / $n),
            'confidence' => (int) round($scores['confidence'] / $n),
            'structure' => (int) round($scores['structure'] / $n),
            'relevance' => (int) round($scores['relevance'] / $n),
            'average' => (int) round(array_sum($scores) / (4 * $n)),
            'summary' => 'Overall performance based on all answers.',
            'tips' => $this->generateOverallTips($scores, $n)
        ];

        DB::table('interviews')->where('id', $id)->update([
            'status' => 'complete',
            'feedback_json' => json_encode($overall),
            'updated_at' => now()
        ]);

        return response()->json([
            'id' => $id,
            'summary' => $overall,
            'answers' => $answers
        ]);
    }

    /**
     * Generate overall tips based on scores
     */
    private function generateOverallTips(array $scores, int $count): array
    {
        $tips = [];
        
        $avgClarity = $scores['clarity'] / $count;
        $avgConfidence = $scores['confidence'] / $count;
        $avgStructure = $scores['structure'] / $count;
        $avgRelevance = $scores['relevance'] / $count;

        if ($avgClarity < 70) {
            $tips[] = "Work on expressing your thoughts more clearly and concisely.";
        }
        if ($avgConfidence < 70) {
            $tips[] = "Practice speaking more confidently and avoid filler words.";
        }
        if ($avgStructure < 70) {
            $tips[] = "Use frameworks like STAR (Situation, Task, Action, Result) to structure your answers.";
        }
        if ($avgRelevance < 70) {
            $tips[] = "Focus on staying relevant to the question and providing specific examples.";
        }

        if (empty($tips)) {
            $tips[] = "Great job! Keep practicing to maintain your skills.";
        }

        return $tips;
    }

    /**
     * GET /api/interviews/{id}
     */
    public function show(int $id)
    {
        $row = DB::table('interviews')->find($id);
        if (!$row) return response()->json(['error' => 'Not found'], 404);

        $answers = DB::table('interview_answers')
            ->where('interview_id', $id)
            ->orderBy('question_index')
            ->get();

        return response()->json([
            'id' => $row->id,
            'status' => $row->status,
            'question_set' => json_decode($row->question_set ?? '[]', true),
            'current_question' => (int) $row->current_question,
            'overall' => $row->feedback_json ? json_decode($row->feedback_json, true) : null,
            'answers' => $answers,
        ]);
    }
}
<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class InterviewController extends Controller
{
    /**
     * POST /api/interviews/start
     * Creates an interview with pre-defined questions.
     */
    public function start(Request $request)
    {
        $request->validate([
            'user_id'   => 'nullable|integer',
            'questions' => 'nullable|array',
        ]);

        $questions = $request->input('questions') ?: [
            "Tell me about yourself.",
            "What are your biggest strengths?",
            "Describe a difficult colleague situation and how you handled it.",
            "Why do you want to join our company?",
            "Where do you see yourself in 5 years?"
        ];

        $id = DB::table('interviews')->insertGetId([
            'user_id'          => $request->input('user_id'),
            'question_set'     => json_encode(array_values($questions)),
            'current_question' => 0,
            'status'           => 'created',
            'created_at'       => now(),
            'updated_at'       => now(),
        ]);

        return response()->json(['id' => $id, 'status' => 'created']);
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

        $scores = ['clarity' => 0, 'confidence' => 0, 'structure' => 0];
        $n = max(1, $answers->count());

        foreach ($answers as $a) {
            $fx = json_decode($a->feedback ?? '{}', true) ?: [];
            $scores['clarity'] += $fx['clarity'] ?? 0;
            $scores['confidence'] += $fx['confidence'] ?? 0;
            $scores['structure'] += $fx['structure'] ?? 0;
        }

        $overall = [
            'clarity'    => (int) round($scores['clarity'] / $n),
            'confidence' => (int) round($scores['confidence'] / $n),
            'structure'  => (int) round($scores['structure'] / $n),
            'summary'    => 'Overall average of all answers.',
            'tips'       => ['Keep practicing and refine your structure.']
        ];

        DB::table('interviews')->where('id', $id)->update([
            'status' => 'complete',
            'feedback_json' => json_encode($overall),
            'updated_at' => now()
        ]);

        return response()->json(['id' => $id, 'summary' => $overall, 'answers' => $answers]);
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
<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;


class InterviewQuestionsSeeder extends Seeder
{
    public function run(): void
    {
        $defaultQuestions = [
            "Tell me about yourself.",
            "What are your biggest strengths?",
            "Describe a challenge you faced at work and how you overcame it.",
            "Why do you want to join our company?",
            "Where do you see yourself in five years?",
        ];

        // Create one demo interview record with the questions pre-seeded
        $id = DB::table('interviews')->insertGetId([
            'user_id' => 1,
            'question' => null,
            'question_set' => json_encode($defaultQuestions),
            'current_question' => 0,
            'status' => 'created',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        echo "✅ Interview seed created with ID: {$id}\n";

        // Optional: Insert questions individually if you have a separate table
        if (Schema::hasTable('interview_questions')) {
            foreach ($defaultQuestions as $i => $q) {
                DB::table('interview_questions')->insert([
                    'text' => $q,
                    'order_index' => $i,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
            echo "✅ Interview questions table seeded.\n";
        }
    }
}

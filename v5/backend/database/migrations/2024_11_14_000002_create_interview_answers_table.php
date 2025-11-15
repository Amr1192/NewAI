<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('interview_answers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('interview_id')->constrained()->onDelete('cascade');
            $table->integer('question_index'); // Which question (0, 1, 2, etc.)
            $table->text('question_text'); // Store the actual question
            $table->text('answer_text'); // User's transcribed answer
            $table->json('feedback')->nullable(); // AI feedback with scores
            $table->timestamps();

            // Ensure one answer per question per interview
            $table->unique(['interview_id', 'question_index']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('interview_answers');
    }
};

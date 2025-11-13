<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('interview_answers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('interview_id')->constrained('interviews')->onDelete('cascade');
            $table->integer('question_index'); // Which question this answer belongs to
            $table->text('question_text')->nullable();
            $table->longText('answer_text')->nullable();
            $table->json('feedback')->nullable(); // store AI feedback (clarity, confidence, tips)
            $table->timestamps();

            $table->unique(['interview_id', 'question_index']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('interview_answers');
    }
};

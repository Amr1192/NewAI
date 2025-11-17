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
        // Add new column to interview_answers table for AI follow-ups
        if (Schema::hasTable('interview_answers')) {
            Schema::table('interview_answers', function (Blueprint $table) {
                if (!Schema::hasColumn('interview_answers', 'ai_followups')) {
                    $table->json('ai_followups')->nullable()->after('feedback');
                }
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasTable('interview_answers')) {
            Schema::table('interview_answers', function (Blueprint $table) {
                if (Schema::hasColumn('interview_answers', 'ai_followups')) {
                    $table->dropColumn('ai_followups');
                }
            });
        }
    }
};
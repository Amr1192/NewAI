<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('user_skills', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            // $table->foreignId('skill_id')->constrained()->onDelete('cascade');
            $table->string('title');
            $table->integer('years_of_experience')->default(0);
            $table->string('proficiency_level')->default('beginner'); // beginner, intermediate, expert
            $table->timestamps();

            // $table->unique(['user_id', 'skill_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_skills');
    }
};

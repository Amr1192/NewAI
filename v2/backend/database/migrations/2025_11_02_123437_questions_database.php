<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
   public function up(): void
{
    Schema::create('interviews', function (Blueprint $table) {
        $table->id();
        $table->unsignedBigInteger('user_id')->nullable();
        $table->text('question')->nullable(); // current question being asked
        $table->json('question_set')->nullable(); // store full set of questions
        $table->integer('current_question')->default(0);
        $table->string('status')->default('created'); // created, ongoing, finished
        $table->timestamps();

        $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade');
    });
}

};

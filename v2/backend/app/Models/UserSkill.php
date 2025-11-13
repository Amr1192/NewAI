<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class UserSkill extends Model
{
    use HasFactory;


    // protected $fillable = [
    //     'name',
    //     'category',
    // ];
        protected $fillable = [
        'title',
        'years_of_experience',
        'proficiency_level',
    ];

    // public function users()
    // {
    //     return $this->belongsToMany(User::class, 'user_skills')
    //         ->withPivot('years_of_experience', 'proficiency_level')
    //         ->withTimestamps();
    // }
}

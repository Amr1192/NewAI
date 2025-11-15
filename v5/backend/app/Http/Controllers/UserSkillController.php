<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class UserSkillController extends Controller
{
    /**
     * GET /api/users/{userId}/skills
     * Get all skills for a user
     */
    public function index(int $userId)
    {
        $skills = DB::table('user_skills')
            ->where('user_id', $userId)
            ->orderBy('proficiency_level', 'desc')
            ->orderBy('years_of_experience', 'desc')
            ->get();

        return response()->json(['skills' => $skills]);
    }

    /**
     * POST /api/profile/skills
     * Add a new skill for the authenticated user
     */
    public function store(Request $request)
    {
        $request->validate([
            'user_id' => 'required|integer',
            'title' => 'required|string|max:255',
            'years_of_experience' => 'required|integer|min:0|max:50',
            'proficiency_level' => 'required|string|in:beginner,intermediate,advanced,expert',
        ]);

        $skillId = DB::table('user_skills')->insertGetId([
            'user_id' => $request->input('user_id'),
            'title' => $request->input('title'),
            'years_of_experience' => $request->input('years_of_experience'),
            'proficiency_level' => $request->input('proficiency_level'),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $skill = DB::table('user_skills')->find($skillId);

        return response()->json([
            'message' => 'Skill added successfully',
            'skill' => $skill
        ], 201);
    }

    /**
     * PUT /api/profile/skills/{id}
     * Update an existing skill
     */
    public function update(int $id, Request $request)
    {
        $request->validate([
            'title' => 'sometimes|required|string|max:255',
            'years_of_experience' => 'sometimes|required|integer|min:0|max:50',
            'proficiency_level' => 'sometimes|required|string|in:beginner,intermediate,advanced,expert',
        ]);

        $skill = DB::table('user_skills')->find($id);
        if (!$skill) {
            return response()->json(['error' => 'Skill not found'], 404);
        }

        $updateData = [];
        if ($request->has('title')) {
            $updateData['title'] = $request->input('title');
        }
        if ($request->has('years_of_experience')) {
            $updateData['years_of_experience'] = $request->input('years_of_experience');
        }
        if ($request->has('proficiency_level')) {
            $updateData['proficiency_level'] = $request->input('proficiency_level');
        }
        $updateData['updated_at'] = now();

        DB::table('user_skills')->where('id', $id)->update($updateData);

        $updatedSkill = DB::table('user_skills')->find($id);

        return response()->json([
            'message' => 'Skill updated successfully',
            'skill' => $updatedSkill
        ]);
    }

    /**
     * DELETE /api/profile/skills/{id}
     * Delete a skill
     */
    public function destroy(int $id)
    {
        $skill = DB::table('user_skills')->find($id);
        if (!$skill) {
            return response()->json(['error' => 'Skill not found'], 404);
        }

        DB::table('user_skills')->where('id', $id)->delete();

        return response()->json([
            'message' => 'Skill deleted successfully'
        ]);
    }
}
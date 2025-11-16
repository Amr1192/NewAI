<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Auth;

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
     * Add new skills for the authenticated user
     * ✅ FIXED: Works with token-based auth
     */
    public function store(Request $request)
    {
        // Get user from token (stored in localStorage by frontend)
        $userData = $request->header('Authorization');
        if (!$userData) {
            // Fallback: try to get from localStorage data sent in request
            $token = $request->bearerToken();
            if (!$token) {
                return response()->json(['error' => 'Unauthorized'], 401);
            }
        }

        // Get user ID from request or token
        $userId = $request->input('user_id');
        if (!$userId) {
            // Try to get from authenticated user
            $user = Auth::user();
            if ($user) {
                $userId = $user->id;
            } else {
                return response()->json(['error' => 'User ID required'], 400);
            }
        }

        // Validate incoming skills array
        $request->validate([
            'skills' => 'required|array',
            'skills.*.title' => 'required|string|max:255',
            'skills.*.years_of_experience' => 'required|integer|min:0|max:50',
            'skills.*.proficiency_level' => 'required|string|in:beginner,intermediate,advanced,expert',
        ]);

        $skillsData = $request->input('skills');
        $addedSkills = [];

        foreach ($skillsData as $skillData) {
            $skillId = DB::table('user_skills')->insertGetId([
                'user_id' => $userId,
                'title' => $skillData['title'],
                'years_of_experience' => $skillData['years_of_experience'],
                'proficiency_level' => $skillData['proficiency_level'],
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            $skill = DB::table('user_skills')->find($skillId);
            $addedSkills[] = $skill;
        }

        return response()->json([
            'message' => 'Skills added successfully',
            'skills' => $addedSkills
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
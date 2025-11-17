<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\Job;
use App\Models\JobApplication;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class JobController extends Controller
{
    public function index(Request $request)
    {
        $jobs = Job::with('company')
            ->when($request->search, function ($query, $search) {
                $query->where(function ($q) use ($search) {
                    $q->where('title', 'like', "%{$search}%")
                        ->orWhere('description', 'like', "%{$search}%")
                        ->orWhere('location', 'like', "%{$search}%");
                });
            })
            ->when($request->location, function ($query, $location) {
                $query->where('location', 'like', "%{$location}%");
            })
            ->when($request->type, function ($query, $type) {
                $query->where('type', $type);
            })
            ->when($request->salary_from, function ($query, $salaryFrom) {
                $query->where('salary_from', '>=', $salaryFrom);
            })
            ->when($request->salary_to, function ($query, $salaryTo) {
                $query->where('salary_to', '<=', $salaryTo);
            })
            ->where('is_active', true)
            ->paginate(10);

        return response()->json($jobs);
    }

    public function show(Job $job)
    {
        return response()->json([
            'job' => $job->load('company'),
        ]);
    }

    public function apply(Request $request, Job $job)
    {
        $validator = Validator::make($request->all(), [
            'cover_letter' => 'required|string',
        ]);

        if ($validator->fails()) {
            return response()->json($validator->errors(), 422);
        }

        // Check if user already applied
        if ($job->applications()->where('user_id', $request->user()->id)->exists()) {
            return response()->json([
                'message' => 'You have already applied for this job',
            ], 422);
        }

        $application = JobApplication::create([
            'user_id' => $request->user()->id,
            'job_id' => $job->id,
            'cover_letter' => $request->cover_letter,
            'status' => 'pending',
        ]);

        return response()->json([
            'message' => 'Application submitted successfully',
            'application' => $application,
        ], 201);
    }

    public function myApplications(Request $request)
    {
        $applications = $request->user()
            ->jobApplications()
            ->with(['job.company'])
            ->latest()
            ->paginate(10);

        return response()->json($applications);
    }

    public function recommendedJobs(Request $request)
    {
        // Get user's skills
        $userSkills = $request->user()->skills->pluck('name')->toArray();

        // Find jobs that match user's skills
        $jobs = Job::with('company')
            ->where('is_active', true)
            ->where(function ($query) use ($userSkills) {
                foreach ($userSkills as $skill) {
                    $query->orWhere('requirements', 'like', "%{$skill}%")
                        ->orWhere('description', 'like', "%{$skill}%");
                }
            })
            ->whereDoesntHave('applications', function ($query) use ($request) {
                $query->where('user_id', $request->user()->id);
            })
            ->latest()
            ->paginate(10);

        return response()->json($jobs);
    }
}

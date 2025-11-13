<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\Company;
use App\Models\Job;
use App\Models\JobApplication;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class AdminController extends Controller
{
    // Authorization for admin routes is handled via route middleware in `routes/api.php`.
    // Removed inline constructor middleware to avoid depending on controller base implementation.

    public function users()
    {
        $users = User::with('profile')->where('role', '!=', 'admin')->paginate(10);
        return response()->json($users);
    }

    public function jobs()
    {
        $jobs = Job::with(['company', 'applications'])->paginate(10);
        return response()->json($jobs);
    }

    public function createJob(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'company_id' => 'required|exists:companies,id',
            'title' => 'required|string|max:255',
            'description' => 'required|string',
            'requirements' => 'required|string',
            'location' => 'required|string|max:255',
            'type' => 'required|in:full-time,part-time,contract',
            'salary_from' => 'nullable|numeric|min:0',
            'salary_to' => 'nullable|numeric|gt:salary_from',
            'deadline' => 'nullable|date|after:today',
        ]);

        if ($validator->fails()) {
            return response()->json($validator->errors(), 422);
        }

        $job = Job::create($request->all());

        return response()->json([
            'message' => 'Job created successfully',
            'job' => $job->load('company'),
        ], 201);
    }

    public function createCompany(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:255',
            'location' => 'required|string|max:255',
            'description' => 'nullable|string',
            'website' => 'nullable|url',
            'logo' => 'nullable|image|mimes:jpeg,png,jpg|max:2048',
        ]);

        if ($validator->fails()) {
            return response()->json($validator->errors(), 422);
        }

        $company = new Company($request->except('logo'));

        if ($request->hasFile('logo')) {
            $path = $request->file('logo')->store('company-logos', 'public');
            $company->logo = $path;
        }

        $company->save();

        return response()->json([
            'message' => 'Company created successfully',
            'company' => $company,
        ], 201);
    }

    public function updateJobStatus(Request $request, Job $job)
    {
        $validator = Validator::make($request->all(), [
            'is_active' => 'required|boolean',
        ]);

        if ($validator->fails()) {
            return response()->json($validator->errors(), 422);
        }

        $job->update(['is_active' => $request->is_active]);

        return response()->json([
            'message' => 'Job status updated successfully',
            'job' => $job,
        ]);
    }

    public function updateApplicationStatus(Request $request, $applicationId)
    {
        $validator = Validator::make($request->all(), [
            'status' => 'required|in:pending,reviewed,shortlisted,rejected,accepted',
        ]);

        if ($validator->fails()) {
            return response()->json($validator->errors(), 422);
        }

        $application = JobApplication::findOrFail($applicationId);
        $application->update(['status' => $request->status]);

        return response()->json([
            'message' => 'Application status updated successfully',
            'application' => $application->load(['user', 'job']),
        ]);
    }
}

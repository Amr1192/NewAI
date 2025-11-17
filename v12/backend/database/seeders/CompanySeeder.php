<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Company;

class CompanySeeder extends Seeder
{
    public function run(): void
    {
        $companies = [
            [
                'name' => 'Tech Solutions Inc',
                'location' => 'New York, USA',
                'description' => 'A leading technology solutions provider specializing in enterprise software.',
                'website' => 'https://techsolutions.example.com',
            ],
            [
                'name' => 'Digital Innovations Ltd',
                'location' => 'London, UK',
                'description' => 'Digital transformation and consulting company helping businesses innovate.',
                'website' => 'https://digitalinnovations.example.com',
            ],
            [
                'name' => 'Future Systems Corp',
                'location' => 'San Francisco, USA',
                'description' => 'AI and machine learning focused technology company.',
                'website' => 'https://futuresystems.example.com',
            ],
            [
                'name' => 'WebTech Solutions',
                'location' => 'Berlin, Germany',
                'description' => 'Web development and design agency creating cutting-edge websites.',
                'website' => 'https://webtech.example.com',
            ],
        ];

        foreach ($companies as $company) {
            Company::create($company);
        }
    }
}

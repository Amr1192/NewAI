"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import DashboardNav from "@/components/dashboard-nav"
import { Button } from "@/components/ui/button"
import { cvAnalysisService, type CVAnalysisResult } from "@/lib/cv-analysis-service"

interface User {
  id: string
  name: string
  email: string
  createdAt: string
}

interface Suggestion {
  id: string
  title: string
  description: string
  category: "keywords" | "formatting" | "verbs" | "gaps"
  severity: "info" | "warning"
  actionText: string
}

interface AnalysisResult {
  overallScore: number
  sections: {
    name: string
    score: number
    feedback: string
  }[]
  strengths: string[]
  improvements: string[]
  suggestions: Suggestion[]
}

export default function CVAnalysisProPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [file, setFile] = useState<File | null>(null)
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [activeTab, setActiveTab] = useState<"keywords" | "formatting" | "verbs" | "gaps">("keywords")
  const [dragActive, setDragActive] = useState(false)

  useEffect(() => {
    const userData = localStorage.getItem("cvmaster_user")
    if (!userData) {
      router.push("/login")
      return
    }
    setUser(JSON.parse(userData))
    setLoading(false)
  }, [router])

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0]
      if (
        droppedFile.type === "application/pdf" ||
        droppedFile.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      ) {
        setFile(droppedFile)
      } else {
        alert("Please upload a PDF or DOCX file")
      }
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0])
    }
  }

  const handleAnalyze = async () => {
    if (!file) {
      alert("Please upload a CV file")
      return
    }

    setAnalyzing(true)
    try {
      const result: CVAnalysisResult = await cvAnalysisService.analyzeCV(file)
      const mapped: AnalysisResult = {
        overallScore: result.analysis.overallScore,
        sections: [
          {
            name: "Contact Information (Pro)",
            score: [result.extractedInfo.email, result.extractedInfo.phone, result.extractedInfo.name].filter(Boolean)
              .length >= 2
              ? 90
              : 60,
            feedback:
              !result.extractedInfo.email || !result.extractedInfo.phone
                ? "Add a professional email and phone number"
                : "Excellent - All necessary contact details are present",
          },
          {
            name: "Professional Summary (Pro)",
            score: Math.min(95, Math.max(50, Math.round(result.summary.split(" ").length / 2))),
            feedback:
              result.summary.length > 20
                ? "Good - Consider adding more specific achievements"
                : "Add a concise professional summary",
          },
          {
            name: "Work Experience (Pro)",
            score: Math.min(95, Math.max(50, result.extractedInfo.experience.length * 20)),
            feedback:
              result.extractedInfo.experience.length > 1
                ? "Strong - Good breadth of experience"
                : "Add more detail and quantified achievements",
          },
          {
            name: "Education (Pro)",
            score: Math.min(95, Math.max(50, result.extractedInfo.education.length * 30)),
            feedback:
              result.extractedInfo.education.length > 0
                ? "Educational background clearly stated"
                : "Add degree, institution, and graduation year",
          },
          {
            name: "Skills (Pro)",
            score: Math.min(95, Math.max(40, result.extractedInfo.skills.length * 5)),
            feedback:
              result.extractedInfo.skills.length > 8
                ? "Comprehensive technical skill set"
                : "Add more relevant technical skills and tools",
          },
        ],
        strengths: result.analysis.strengths,
        improvements: result.analysis.weaknesses,
        suggestions: (result.analysis.suggestions || []).slice(0, 5).map((s, idx) => ({
          id: String(idx + 1),
          title: s,
          description: s,
          category: (idx % 4 === 0 ? "keywords" : idx % 4 === 1 ? "formatting" : idx % 4 === 2 ? "verbs" : "gaps"),
          severity: idx % 3 === 0 ? "warning" : "info",
          actionText: "Apply",
        })),
      }
      setAnalysis(mapped)
    } catch (e: any) {
      alert(e?.message || "Failed to analyze CV. Please try again.")
    } finally {
      setAnalyzing(false)
    }
  }

  if (loading || !user) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>
  }

  const filteredSuggestions = analysis?.suggestions.filter((s) => s.category === activeTab) || []

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <DashboardNav user={user} />

      <main className="px-10 py-8">
        {/* Header Section */}
        <div className="flex flex-wrap justify-between gap-3 mb-8">
          <div className="flex flex-col gap-3">
            <h1 className="text-4xl font-black text-gray-900 dark:text-white">CV Analysis Pro</h1>
            <p className="text-purple-600 dark:text-purple-400 text-base font-normal">
              Upload your CV to get started. Supported file types: PDF, DOCX.
            </p>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Upload Section */}
          <div className="lg:col-span-2">
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6 h-full">
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                className={`flex flex-col items-center justify-center h-full border-2 border-dashed rounded-lg p-10 transition-colors ${
                  dragActive
                    ? "border-purple-500 bg-purple-50 dark:bg-purple-950/20"
                    : "border-purple-300/30 dark:border-purple-700/30"
                }`}
              >
                <svg
                  className="w-16 h-16 text-purple-400/50 mb-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                  />
                </svg>
                <p className="text-lg font-bold text-gray-900 dark:text-white text-center mt-4">
                  {file ? file.name : "Upload your CV to get started"}
                </p>
                <p className="text-sm font-normal text-center text-gray-600 dark:text-gray-400 mt-2">
                  Drag and drop your file here or click to select a file.
                </p>
                <label className="mt-6 flex min-w-[84px] max-w-[480px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-10 px-4 bg-purple-500/20 dark:bg-purple-500/40 text-purple-600 dark:text-purple-300 text-sm font-bold leading-normal tracking-[0.015em] hover:bg-purple-500/30 transition-colors">
                  <span className="truncate">Upload CV</span>
                  <input type="file" accept=".pdf,.docx" onChange={handleFileChange} className="hidden" />
                </label>
              </div>
            </div>
          </div>

          {/* Score Section */}
          <div className="flex flex-col gap-8">
            {/* CV Strength Score */}
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6">
              <p className="text-lg font-bold mb-4 text-gray-900 dark:text-white">CV Strength Score (Pro)</p>
              <div className="relative w-40 h-40 mx-auto">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                  <circle
                    cx="18"
                    cy="18"
                    r="15.9155"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    className="text-purple-200 dark:text-purple-900"
                  />
                  <circle
                    cx="18"
                    cy="18"
                    r="15.9155"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeDasharray={`${analysis ? (analysis.overallScore / 100) * 100 : 0}, 100`}
                    strokeLinecap="round"
                    className="text-purple-600 dark:text-purple-400 transition-all duration-500"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-4xl font-bold text-gray-900 dark:text-white">
                    {analysis?.overallScore || 0}
                  </span>
                </div>
              </div>
              <div className="mt-4">
                <div className="flex gap-6 justify-between">
                  <p className="text-gray-800 dark:text-gray-200 text-base font-medium">Overall Score</p>
                  <p className="text-gray-600 dark:text-gray-400 text-sm font-normal">{analysis?.overallScore || 0}%</p>
                </div>
                <div className="rounded bg-purple-200 dark:bg-purple-900/30 mt-2">
                  <div
                    className="h-2 rounded bg-purple-600 dark:bg-purple-400 transition-all duration-500"
                    style={{ width: `${analysis?.overallScore || 0}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Analyze Button */}
            <Button
              onClick={handleAnalyze}
              disabled={analyzing || !file}
              className="w-full bg-purple-600 hover:bg-purple-700 dark:bg-purple-500 dark:hover:bg-purple-600 text-white font-bold h-10"
            >
              {analyzing ? "Analyzing..." : "Analyze CV (Pro)"}
            </Button>
          </div>
        </div>

        {/* AI Suggestions Section */}
        {analysis && (
          <div className="mt-8">
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">AI Suggestions</h3>
                <button className="text-sm font-bold text-purple-600 dark:text-purple-400 hover:text-purple-700">
                  Apply All
                </button>
              </div>

              {/* Tab Buttons */}
              <div className="flex h-10 w-full items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900/30 p-1 mb-6 gap-1">
                {(["keywords", "formatting", "verbs", "gaps"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`flex-1 h-full rounded-lg px-2 text-sm font-medium transition-all ${
                      activeTab === tab
                        ? "bg-white dark:bg-slate-800 shadow-sm text-purple-600 dark:text-purple-400"
                        : "text-purple-600/70 dark:text-purple-400/70 hover:text-purple-600 dark:hover:text-purple-400"
                    }`}
                  >
                    {tab === "keywords" && "Keywords"}
                    {tab === "formatting" && "Formatting"}
                    {tab === "verbs" && "Verbs"}
                    {tab === "gaps" && "Gaps"}
                  </button>
                ))}
              </div>

              {/* Suggestions List */}
              <div className="space-y-4">
                {filteredSuggestions.length > 0 ? (
                  filteredSuggestions.map((suggestion) => (
                    <div
                      key={suggestion.id}
                      className={`p-4 rounded-lg ${
                        suggestion.severity === "warning"
                          ? "bg-orange-500/10 dark:bg-orange-500/20"
                          : "bg-purple-500/5 dark:bg-purple-500/10"
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-bold text-gray-900 dark:text-white">{suggestion.title}</h4>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{suggestion.description}</p>
                        </div>
                        <button className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                            <path
                              fillRule="evenodd"
                              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </button>
                      </div>
                      <div className="mt-3 flex gap-2">
                        <button className="text-xs font-semibold bg-purple-600 dark:bg-purple-500 text-white px-3 py-1 rounded-md hover:bg-purple-700 dark:hover:bg-purple-600 transition-colors">
                          {suggestion.actionText}
                        </button>
                        <button className="text-xs font-semibold text-gray-600 dark:text-gray-400 px-3 py-1 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                          Ignore
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-center text-gray-600 dark:text-gray-400 py-8">No suggestions in this category</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Strengths and Improvements */}
        {analysis && (
          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Strengths */}
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Strengths</h3>
              <div className="space-y-3">
                {analysis.strengths.map((strength, idx) => (
                  <div key={idx} className="flex gap-3">
                    <span className="text-green-500 font-bold text-lg">✓</span>
                    <p className="text-gray-700 dark:text-gray-300">{strength}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Improvements */}
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Areas for Improvement</h3>
              <div className="space-y-3">
                {analysis.improvements.map((improvement, idx) => (
                  <div key={idx} className="flex gap-3">
                    <span className="text-orange-500 font-bold text-lg">→</span>
                    <p className="text-gray-700 dark:text-gray-300">{improvement}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-4 mt-8">
          <Button
            onClick={() => router.push("/enhance-cv")}
            className="flex-1 bg-purple-600 hover:bg-purple-700 dark:bg-purple-500 dark:hover:bg-purple-600 text-white font-bold"
          >
            Enhance CV
          </Button>
          <Button
            onClick={() => router.push("/dashboard")}
            variant="outline"
            className="flex-1 border-purple-300 dark:border-purple-700 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/20"
          >
            Back to Dashboard
          </Button>
        </div>
      </main>
    </div>
  )
}

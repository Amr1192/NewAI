"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import DashboardNav from "@/components/dashboard-nav"
import { Button } from "@/components/ui/button"
import { cvEnhanceService } from "@/lib/cv-enhance-service"

interface User {
  id: string
  name: string
  email: string
  createdAt: string
}

export default function EnhanceCVProPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [cvText, setCVText] = useState("")
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [enhancedCV, setEnhancedCV] = useState("")
  const [loading, setLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)

  useEffect(() => {
    const userData = localStorage.getItem("cvmaster_user")
    if (!userData) {
      router.push("/login")
      return
    }
    setUser(JSON.parse(userData))
    setLoading(false)
  }, [router])

  const handleAnalyze = async () => {
    if (!cvText.trim()) {
      alert("Please paste your CV text")
      return
    }

    setAnalyzing(true)
    try {
      const res = await cvEnhanceService.enhance(cvText)
      setSuggestions(res.suggestions || [])
      setEnhancedCV(res.enhanced || "")
    } catch (e: any) {
      alert(e?.message || "Failed to enhance CV. Please try again.")
    } finally {
      setAnalyzing(false)
    }
  }

  const handleDownload = () => {
    const element = document.createElement("a")
    const file = new Blob([enhancedCV], { type: "text/plain" })
    element.href = URL.createObjectURL(file)
    element.download = "enhanced-cv-pro.txt"
    document.body.appendChild(element)
    element.click()
    document.body.removeChild(element)
  }

  if (loading || !user) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>
  }

  return (
    <div className="min-h-screen bg-background">
      <DashboardNav user={user} />

      <main className="max-w-6xl mx-auto px-4 py-12">
        <div className="bg-white rounded-lg shadow-md p-8">
          <h1 className="text-3xl font-bold text-primary mb-2">Enhance Your CV (AI Pro)</h1>
          <p className="text-muted-foreground mb-8">
            AI-powered enhancement: paste your CV text to get tailored suggestions and an improved draft.
          </p>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Input Section */}
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-primary">Your CV</h2>
              <textarea
                value={cvText}
                onChange={(e) => setCVText(e.target.value)}
                className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent h-96"
                placeholder="Paste your CV text here..."
              />
              <Button onClick={handleAnalyze} disabled={analyzing} className="w-full bg-accent hover:bg-accent/90">
                {analyzing ? "Analyzing..." : "Analyze & Enhance (AI)"}
              </Button>
            </div>

            {/* Suggestions Section */}
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-primary">AI Suggestions (Pro)</h2>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3 h-96 overflow-y-auto">
                {suggestions.length > 0 ? (
                  suggestions.map((suggestion, idx) => (
                    <div key={idx} className="flex gap-3">
                      <span className="text-accent font-bold">💡</span>
                      <p className="text-sm text-foreground">{suggestion}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-muted-foreground text-center py-12">
                    Paste your CV and click "Analyze & Enhance (AI)" to get suggestions
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Enhanced CV Preview */}
          {enhancedCV && (
            <div className="mt-8 pt-8 border-t border-border">
              <h2 className="text-xl font-semibold text-primary mb-4">Enhanced CV Preview (AI)</h2>
              <div className="bg-gray-50 border border-border rounded-lg p-4 h-64 overflow-y-auto whitespace-pre-wrap font-mono text-sm">
                {enhancedCV}
              </div>
              <div className="flex gap-4 mt-4">
                <Button onClick={handleDownload} className="flex-1 bg-accent hover:bg-accent/90">
                  Download Enhanced CV
                </Button>
                <Button onClick={() => router.push("/dashboard")} variant="outline" className="flex-1">
                  Back to Dashboard
                </Button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

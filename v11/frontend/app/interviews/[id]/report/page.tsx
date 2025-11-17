"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Download, 
  Home, 
  TrendingUp, 
  CheckCircle, 
  AlertCircle,
  Award,
  Target,
  MessageSquare,
  RotateCcw
} from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";

interface Feedback {
  clarity: number;
  confidence: number;
  structure: number;
  relevance: number;
  summary: string;
  tips: string[];
}

interface Answer {
  id: number;
  question_text: string;
  answer_text: string;
  feedback: string;
  created_at: string;
}

interface OverallFeedback {
  clarity: number;
  confidence: number;
  structure: number;
  relevance: number;
  average: number;
  summary: string;
  tips: string[];
}

interface InterviewData {
  id: number;
  status: string;
  question_set: string[];
  current_question: number;
  overall: OverallFeedback | null;
  answers: Answer[];
}

export default function InterviewReportPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [data, setData] = useState<InterviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setError("No interview ID provided");
      setLoading(false);
      return;
    }

    fetchReport();
  }, [id]);

  const fetchReport = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/interviews/${id}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      const json = await res.json();
      setData(json);
    } catch (e: any) {
      setError(e.message || "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600 dark:text-green-400";
    if (score >= 60) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-600 dark:text-red-400";
  };

  const getScoreBgColor = (score: number) => {
    if (score >= 80) return "bg-green-100 dark:bg-green-900/20";
    if (score >= 60) return "bg-yellow-100 dark:bg-yellow-900/20";
    return "bg-red-100 dark:bg-red-900/20";
  };

  const getGrade = (score: number) => {
    if (score >= 90) return "A+";
    if (score >= 80) return "A";
    if (score >= 70) return "B";
    if (score >= 60) return "C";
    if (score >= 50) return "D";
    return "F";
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading your report...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-4xl mx-auto p-8">
          <Card className="p-8 bg-red-50 dark:bg-red-900/10 border-red-200">
            <div className="flex items-center gap-3 mb-4">
              <AlertCircle className="h-6 w-6 text-red-600" />
              <h2 className="text-xl font-bold text-red-600">Error Loading Report</h2>
            </div>
            <p className="text-red-600 mb-4">{error}</p>
            <Button onClick={() => router.push("/interview-setup")} variant="outline">
              Start New Interview
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-4xl mx-auto p-8">
          <Card className="p-8">
            <p className="text-muted-foreground">No data found</p>
          </Card>
        </div>
      </div>
    );
  }

  const overall = data.overall;
  const answers = data.answers || [];
  const isComplete = data.status === 'complete';
  const answeredCount = answers.length;
  const totalQuestions = data.question_set?.length || 0;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">Interview Report</h1>
            <p className="text-muted-foreground">
              Interview #{data.id} • {answeredCount} of {totalQuestions} questions answered
              {!isComplete && <span className="text-yellow-600"> (In Progress)</span>}
            </p>
          </div>
          <div className="flex gap-3">
            {!isComplete && (
              <Button 
                variant="outline"
                onClick={() => router.push(`/shadow-interview/${id}`)}
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                Continue Interview
              </Button>
            )}
            <Button variant="outline" onClick={() => window.print()}>
              <Download className="mr-2 h-4 w-4" />
              Download
            </Button>
            <Button onClick={() => router.push("/interview-setup")}>
              <Home className="mr-2 h-4 w-4" />
              New Interview
            </Button>
          </div>
        </div>

        {/* Overall Summary */}
        {overall ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            {/* Overall Score Card */}
            <Card className="p-6 col-span-1 lg:col-span-1">
              <div className="text-center">
                <Award className="h-12 w-12 mx-auto mb-4 text-primary" />
                <h3 className="text-lg font-semibold mb-2">Overall Score</h3>
                <div className="flex items-center justify-center gap-3 mb-4">
                  <span className={`text-6xl font-bold ${getScoreColor(overall.average)}`}>
                    {overall.average}
                  </span>
                  <div className="text-left">
                    <div className="text-2xl font-bold text-muted-foreground">/ 100</div>
                    <div className={`text-lg font-bold ${getScoreColor(overall.average)}`}>
                      Grade: {getGrade(overall.average)}
                    </div>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">{overall.summary}</p>
              </div>
            </Card>

            {/* Detailed Scores */}
            <Card className="p-6 col-span-1 lg:col-span-2">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Target className="h-5 w-5" />
                Performance Breakdown
              </h3>
              <div className="space-y-4">
                {[
                  { label: "Clarity", value: overall.clarity },
                  { label: "Confidence", value: overall.confidence },
                  { label: "Structure", value: overall.structure },
                  { label: "Relevance", value: overall.relevance },
                ].map((item) => (
                  <div key={item.label}>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium">{item.label}</span>
                      <span className={`text-lg font-bold ${getScoreColor(item.value)}`}>
                        {item.value}%
                      </span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-3">
                      <div
                        className={`h-3 rounded-full transition-all ${getScoreBgColor(item.value)}`}
                        style={{ width: `${item.value}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        ) : (
          <Card className="p-6 mb-8 bg-yellow-50 dark:bg-yellow-900/10 border-yellow-200">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-yellow-600" />
              <div>
                <p className="text-sm font-semibold text-yellow-800 dark:text-yellow-300 mb-1">
                  Partial Results
                </p>
                <p className="text-xs text-yellow-700 dark:text-yellow-400">
                  You've answered {answeredCount} of {totalQuestions} questions. 
                  {answeredCount < totalQuestions && " Continue the interview to see your final score."}
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* Improvement Tips */}
        {overall && overall.tips && overall.tips.length > 0 && (
          <Card className="p-6 mb-8 bg-blue-50 dark:bg-blue-900/10 border-blue-200">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-blue-900 dark:text-blue-300">
              <TrendingUp className="h-5 w-5" />
              Recommendations for Improvement
            </h3>
            <ul className="space-y-2">
              {overall.tips.map((tip, idx) => (
                <li key={idx} className="flex items-start gap-3 text-sm text-blue-800 dark:text-blue-300">
                  <CheckCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </Card>
        )}

        {/* Per-Question Analysis */}
        <Card className="p-6">
          <h3 className="text-xl font-semibold mb-6 flex items-center gap-2">
            <MessageSquare className="h-6 w-6" />
            Detailed Question Analysis
          </h3>
          
          {answers.length > 0 ? (
            <div className="space-y-6">
              {answers.map((answer, idx) => {
                let feedback: Feedback | null = null;
                try {
                  feedback = answer.feedback ? JSON.parse(answer.feedback) : null;
                } catch {
                  feedback = null;
                }

                return (
                  <div
                    key={answer.id}
                    className="border border-border rounded-lg p-6 bg-card hover:shadow-md transition-shadow"
                  >
                    {/* Question */}
                    <div className="mb-4">
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="font-semibold text-lg flex items-center gap-2">
                          <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary text-sm font-bold">
                            {idx + 1}
                          </span>
                          Question {idx + 1}
                        </h4>
                        {feedback && (
                          <span className={`text-2xl font-bold ${getScoreColor(
                            Math.round((feedback.clarity + feedback.confidence + feedback.structure + feedback.relevance) / 4)
                          )}`}>
                            {Math.round((feedback.clarity + feedback.confidence + feedback.structure + feedback.relevance) / 4)}%
                          </span>
                        )}
                      </div>
                      <p className="text-foreground font-medium bg-muted p-4 rounded-lg">
                        {answer.question_text}
                      </p>
                    </div>

                    {/* Your Answer */}
                    <div className="mb-4">
                      <h5 className="font-semibold mb-2 text-sm text-muted-foreground uppercase tracking-wide">
                        Your Answer
                      </h5>
                      <div className="bg-background p-4 rounded-lg border border-border">
                        <p className="text-foreground whitespace-pre-wrap leading-relaxed">
                          {answer.answer_text || "No answer recorded."}
                        </p>
                        <p className="text-xs text-muted-foreground mt-2">
                          {answer.answer_text ? `${answer.answer_text.split(/\s+/).length} words` : "0 words"}
                        </p>
                      </div>
                    </div>

                    {/* AI Feedback */}
                    {feedback && (
                      <div>
                        <h5 className="font-semibold mb-3 text-sm text-muted-foreground uppercase tracking-wide">
                          AI Analysis
                        </h5>
                        
                        {/* Score Grid */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                          <div className={`p-3 rounded-lg ${getScoreBgColor(feedback.clarity)}`}>
                            <p className="text-xs font-medium text-muted-foreground mb-1">Clarity</p>
                            <p className={`text-2xl font-bold ${getScoreColor(feedback.clarity)}`}>
                              {feedback.clarity}%
                            </p>
                          </div>
                          <div className={`p-3 rounded-lg ${getScoreBgColor(feedback.confidence)}`}>
                            <p className="text-xs font-medium text-muted-foreground mb-1">Confidence</p>
                            <p className={`text-2xl font-bold ${getScoreColor(feedback.confidence)}`}>
                              {feedback.confidence}%
                            </p>
                          </div>
                          <div className={`p-3 rounded-lg ${getScoreBgColor(feedback.structure)}`}>
                            <p className="text-xs font-medium text-muted-foreground mb-1">Structure</p>
                            <p className={`text-2xl font-bold ${getScoreColor(feedback.structure)}`}>
                              {feedback.structure}%
                            </p>
                          </div>
                          <div className={`p-3 rounded-lg ${getScoreBgColor(feedback.relevance)}`}>
                            <p className="text-xs font-medium text-muted-foreground mb-1">Relevance</p>
                            <p className={`text-2xl font-bold ${getScoreColor(feedback.relevance)}`}>
                              {feedback.relevance}%
                            </p>
                          </div>
                        </div>

                        {/* Summary & Tips */}
                        <div className="bg-muted p-4 rounded-lg">
                          <p className="text-sm mb-3 font-medium">{feedback.summary}</p>
                          {feedback.tips && feedback.tips.length > 0 && (
                            <div>
                              <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
                                Improvement Tips:
                              </p>
                              <ul className="space-y-1">
                                {feedback.tips.map((tip, tipIdx) => (
                                  <li key={tipIdx} className="flex items-start gap-2 text-sm">
                                    <span className="text-primary mt-0.5">•</span>
                                    <span>{tip}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No answers recorded yet</p>
              <Button 
                onClick={() => router.push(`/shadow-interview/${id}`)}
                className="mt-4"
              >
                Start Interview
              </Button>
            </div>
          )}
        </Card>

        {/* Action Buttons */}
        <div className="flex gap-4 mt-8">
          {!isComplete && answeredCount < totalQuestions ? (
            <Button 
              onClick={() => router.push(`/shadow-interview/${id}`)} 
              size="lg" 
              className="flex-1"
            >
              <RotateCcw className="mr-2 h-5 w-5" />
              Continue Interview
            </Button>
          ) : (
            <Button onClick={() => router.push("/interview-setup")} size="lg" className="flex-1">
              Practice Another Interview
            </Button>
          )}
          <Button onClick={() => router.push("/profile")} variant="outline" size="lg" className="flex-1">
            Update My Skills
          </Button>
        </div>
      </div>
    </div>
  );
}
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Sparkles, AlertCircle, Plus } from "lucide-react";
import Header from "@/components/header";
import axios from "axios";
import toast from "react-hot-toast";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";

interface UserSkill {
  id: number;
  title: string;
  years_of_experience: number;
  proficiency_level: string;
}

interface NewSkill {
  title: string;
  years_of_experience: number;
  proficiency_level: string;
}

export default function InterviewSetupPage() {
  const router = useRouter();
  const [skills, setSkills] = useState<UserSkill[]>([]);
  const [selectedSkills, setSelectedSkills] = useState<number[]>([]);
  const [numQuestions, setNumQuestions] = useState(5);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingSkills, setLoadingSkills] = useState(false);
  const [userId, setUserId] = useState<number | null>(null);
  const [showNoSkillsModal, setShowNoSkillsModal] = useState(false);
  const [showQuickAddModal, setShowQuickAddModal] = useState(false);
  
  const [newSkill, setNewSkill] = useState<NewSkill>({
    title: "",
    years_of_experience: 0,
    proficiency_level: "beginner",
  });

  useEffect(() => {
    // Get user ID from localStorage
    const userData = localStorage.getItem("cvmaster_user");
    if (userData) {
      const parsed = JSON.parse(userData);
      setUserId(parsed.id);
    } else {
      router.push("/login");
    }
  }, [router]);

  useEffect(() => {
    if (userId) {
      loadSkills();
    }
  }, [userId]);

  const loadSkills = async () => {
    if (!userId) return;
    
    setLoadingSkills(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/users/${userId}/skills`);
      if (!res.ok) throw new Error("Failed to load skills");
      const data = await res.json();
      setSkills(data.skills || []);
      
      // If no skills exist, show modal
      if (!data.skills || data.skills.length === 0) {
        setShowNoSkillsModal(true);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoadingSkills(false);
    }
  };

  const handleQuickAddSkill = async () => {
    if (!newSkill.title.trim()) {
      toast.error("Skill title is required");
      return;
    }

    setLoading(true);

    try {
      const token = localStorage.getItem("token");
      const res = await axios.post(
        `${API_BASE}/api/profile/skills`,
        { skills: [newSkill] },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      const addedSkills: UserSkill[] = res.data.skills || [];
      setSkills((prev) => [...prev, ...addedSkills]);
      
      setNewSkill({
        title: "",
        years_of_experience: 0,
        proficiency_level: "beginner",
      });
      
      toast.success("Skill added! Add more or start your interview.");
      
      // Close modal if we have at least 3 skills now
      if (skills.length + addedSkills.length >= 3) {
        setShowQuickAddModal(false);
        setShowNoSkillsModal(false);
      }
    } catch (e: any) {
      toast.error("Failed to add skill");
    } finally {
      setLoading(false);
    }
  };

  const startInterview = async () => {
    if (selectedSkills.length === 0) {
      setError("Please select at least one skill");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/api/interviews/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          skill_ids: selectedSkills,
          num_questions: numQuestions,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to start interview");
      }

      const data = await res.json();
      console.log("✅ Interview created:", data);

      // Navigate to the interview page
      router.push(`/shadow-interview/${data.id}`);
    } catch (e: any) {
      console.error("❌ Error:", e);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleSkill = (skillId: number) => {
    setSelectedSkills((prev) =>
      prev.includes(skillId)
        ? prev.filter((id) => id !== skillId)
        : [...prev, skillId]
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="max-w-4xl mx-auto p-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold mb-2">Start Your AI Interview</h2>
          <p className="text-muted-foreground">
            Select your skills and let AI generate personalized interview questions
          </p>
        </div>

        {/* Error Display */}
        {error && (
          <Card className="mb-6 p-4 bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800">
            <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
          </Card>
        )}

        {/* Load Skills Section */}
        <Card className="p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold">Your Skills</h3>
            <div className="flex gap-2">
              <Button
                onClick={loadSkills}
                disabled={loadingSkills}
                variant="outline"
              >
                {loadingSkills ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Loading...
                  </>
                ) : (
                  "Reload Skills"
                )}
              </Button>
              <Button
                onClick={() => setShowQuickAddModal(true)}
                variant="outline"
              >
                <Plus className="mr-2 h-4 w-4" />
                Quick Add
              </Button>
            </div>
          </div>

          {skills.length > 0 ? (
            <div className="space-y-3">
              {skills.map((skill) => (
                <div
                  key={skill.id}
                  className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition"
                >
                  <Checkbox
                    id={`skill-${skill.id}`}
                    checked={selectedSkills.includes(skill.id)}
                    onCheckedChange={() => toggleSkill(skill.id)}
                  />
                  <Label
                    htmlFor={`skill-${skill.id}`}
                    className="flex-1 cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{skill.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {skill.proficiency_level} • {skill.years_of_experience}{" "}
                          years experience
                        </p>
                      </div>
                    </div>
                  </Label>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No skills found</p>
              <Button 
                onClick={() => setShowNoSkillsModal(true)} 
                className="mt-4"
                variant="outline"
              >
                Add Skills Now
              </Button>
            </div>
          )}
        </Card>

        {/* Interview Settings */}
        <Card className="p-6 mb-6">
          <h3 className="text-xl font-semibold mb-4">Interview Settings</h3>
          <div className="space-y-4">
            <div>
              <Label htmlFor="num-questions">Number of Questions</Label>
              <Input
                id="num-questions"
                type="number"
                min={3}
                max={10}
                value={numQuestions}
                onChange={(e) => setNumQuestions(parseInt(e.target.value) || 5)}
                className="mt-2 w-32"
              />
              <p className="text-sm text-muted-foreground mt-1">
                Choose between 3-10 questions
              </p>
            </div>
          </div>
        </Card>

        {/* Selected Skills Summary */}
        {selectedSkills.length > 0 && (
          <Card className="p-6 mb-6 bg-accent/5 border-accent/20">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-5 w-5 text-accent" />
              <h3 className="font-semibold">Ready to Generate</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              AI will generate {numQuestions} personalized questions based on:{" "}
              {skills
                .filter((s) => selectedSkills.includes(s.id))
                .map((s) => s.title)
                .join(", ")}
            </p>
          </Card>
        )}

        {/* Start Button */}
        <Button
          onClick={startInterview}
          disabled={loading || selectedSkills.length === 0}
          size="lg"
          className="w-full"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Generating Interview Questions...
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-5 w-5" />
              Start AI Interview
            </>
          )}
        </Button>
      </div>

      {/* No Skills Modal */}
      <Dialog open={showNoSkillsModal} onOpenChange={setShowNoSkillsModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>No Skills Found</DialogTitle>
            <DialogDescription>
              You need to add at least 3 skills to generate personalized interview questions.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <p className="text-sm text-muted-foreground">
              Choose an option:
            </p>
            <div className="flex flex-col gap-2">
              <Button onClick={() => {
                setShowNoSkillsModal(false);
                setShowQuickAddModal(true);
              }}>
                <Plus className="mr-2 h-4 w-4" />
                Quick Add Skills Here
              </Button>
              <Button 
                variant="outline"
                onClick={() => router.push("/profile?tab=skills")}
              >
                Go to Profile to Add Skills
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Quick Add Skill Modal */}
      <Dialog open={showQuickAddModal} onOpenChange={setShowQuickAddModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Quick Add Skill</DialogTitle>
            <DialogDescription>
              Add skills quickly without leaving this page. You need at least 3 skills.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label>Skill Name</Label>
              <Input
                placeholder="e.g., React, Python"
                value={newSkill.title}
                onChange={(e) => setNewSkill({ ...newSkill, title: e.target.value })}
                className="mt-2"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Years</Label>
                <Input
                  type="number"
                  min="0"
                  max="50"
                  value={newSkill.years_of_experience}
                  onChange={(e) =>
                    setNewSkill({ ...newSkill, years_of_experience: parseInt(e.target.value) || 0 })
                  }
                  className="mt-2"
                />
              </div>
              <div>
                <Label>Level</Label>
                <Select
                  value={newSkill.proficiency_level}
                  onValueChange={(value) => setNewSkill({ ...newSkill, proficiency_level: value })}
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="beginner">Beginner</SelectItem>
                    <SelectItem value="intermediate">Intermediate</SelectItem>
                    <SelectItem value="advanced">Advanced</SelectItem>
                    <SelectItem value="expert">Expert</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button 
              onClick={handleQuickAddSkill} 
              disabled={loading || !newSkill.title.trim()}
              className="w-full"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Skill
                </>
              )}
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              Skills added: {skills.length} (need at least 3)
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
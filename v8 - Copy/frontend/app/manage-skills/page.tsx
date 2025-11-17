"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2, Plus, Save, Pencil, X } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";

// Mock user ID - replace with actual auth
const MOCK_USER_ID = 1;

interface Skill {
  id?: number;
  title: string;
  years_of_experience: number;
  proficiency_level: string;
}

export default function ManageSkillsPage() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  
  // New skill form
  const [newSkill, setNewSkill] = useState<Skill>({
    title: "",
    years_of_experience: 0,
    proficiency_level: "beginner",
  });

  useEffect(() => {
    loadSkills();
  }, []);

  const loadSkills = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/users/${MOCK_USER_ID}/skills`);
      if (!res.ok) throw new Error("Failed to load skills");
      const data = await res.json();
      setSkills(data.skills || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const addSkill = async () => {
    if (!newSkill.title.trim()) {
      setError("Skill title is required");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/api/profile/skills`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: MOCK_USER_ID,
          title: newSkill.title,
          years_of_experience: newSkill.years_of_experience,
          proficiency_level: newSkill.proficiency_level,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Failed to add skill");
      }

      // Reset form and reload skills
      setNewSkill({
        title: "",
        years_of_experience: 0,
        proficiency_level: "beginner",
      });
      await loadSkills();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const deleteSkill = async (skillId: number) => {
    if (!confirm("Are you sure you want to delete this skill?")) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/api/profile/skills/${skillId}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Failed to delete skill");
      await loadSkills();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const updateSkill = async (skillId: number, updatedSkill: Skill) => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/api/profile/skills/${skillId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedSkill),
      });

      if (!res.ok) throw new Error("Failed to update skill");
      setEditingId(null);
      await loadSkills();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card px-6 py-4">
        <div className="flex items-center justify-between max-w-6xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="text-primary size-7">
              <svg fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                <g clipPath="url(#clip0_6_319)">
                  <path
                    d="M8.57829 8.57829C5.52816 11.6284 3.451 15.5145 2.60947 19.7452C1.76794 23.9758 2.19984 28.361 3.85056 32.3462C5.50128 36.3314 8.29667 39.7376 11.8832 42.134C15.4698 44.5305 19.6865 45.8096 24 45.8096C28.3135 45.8096 32.5302 44.5305 36.1168 42.134C39.7033 39.7375 42.4987 36.3314 44.1494 32.3462C45.8002 28.361 46.2321 23.9758 45.3905 19.7452C44.549 15.5145 42.4718 11.6284 39.4217 8.57829L24 24L8.57829 8.57829Z"
                    fill="currentColor"
                  />
                </g>
                <defs>
                  <clipPath id="clip0_6_319">
                    <rect fill="white" height="48" width="48" />
                  </clipPath>
                </defs>
              </svg>
            </div>
            <h1 className="text-lg font-bold tracking-tight">Manage Your Skills</h1>
          </div>
          <Button variant="outline" onClick={() => window.location.href = "/interview-setup"}>
            Start Interview
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto p-8">
        {/* Error Display */}
        {error && (
          <Card className="mb-6 p-4 bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800">
            <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
          </Card>
        )}

        {/* Add New Skill */}
        <Card className="p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Add New Skill</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <Label htmlFor="skill-title">Skill Name</Label>
              <Input
                id="skill-title"
                placeholder="e.g., React, Python, Project Management"
                value={newSkill.title}
                onChange={(e) =>
                  setNewSkill({ ...newSkill, title: e.target.value })
                }
                className="mt-2"
              />
            </div>

            <div>
              <Label htmlFor="years">Years of Experience</Label>
              <Input
                id="years"
                type="number"
                min="0"
                max="50"
                value={newSkill.years_of_experience}
                onChange={(e) =>
                  setNewSkill({
                    ...newSkill,
                    years_of_experience: parseInt(e.target.value) || 0,
                  })
                }
                className="mt-2"
              />
            </div>

            <div>
              <Label htmlFor="proficiency">Proficiency Level</Label>
              <Select
                value={newSkill.proficiency_level}
                onValueChange={(value) =>
                  setNewSkill({ ...newSkill, proficiency_level: value })
                }
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
            onClick={addSkill}
            disabled={loading || !newSkill.title.trim()}
            className="mt-4"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Skill
          </Button>
        </Card>

        {/* Skills List */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">
            Your Skills ({skills.length})
          </h2>

          {loading && skills.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading skills...
            </div>
          ) : skills.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No skills added yet.</p>
              <p className="text-sm mt-2">Add your first skill above to get started!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {skills.map((skill) => (
                <SkillCard
                  key={skill.id}
                  skill={skill}
                  isEditing={editingId === skill.id}
                  onEdit={() => setEditingId(skill.id!)}
                  onCancelEdit={() => setEditingId(null)}
                  onSave={(updated) => updateSkill(skill.id!, updated)}
                  onDelete={() => deleteSkill(skill.id!)}
                  disabled={loading}
                />
              ))}
            </div>
          )}
        </Card>

        {/* Quick Tips */}
        <Card className="p-6 mt-6 bg-accent/5 border-accent/20">
          <h3 className="font-semibold mb-2">💡 Tips for Adding Skills</h3>
          <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
            <li>Add technical skills (programming languages, frameworks, tools)</li>
            <li>Include soft skills (leadership, communication, problem-solving)</li>
            <li>Be honest about your experience level</li>
            <li>More skills = more diverse interview questions!</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}

// Skill Card Component
interface SkillCardProps {
  skill: Skill;
  isEditing: boolean;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSave: (skill: Skill) => void;
  onDelete: () => void;
  disabled: boolean;
}

function SkillCard({
  skill,
  isEditing,
  onEdit,
  onCancelEdit,
  onSave,
  onDelete,
  disabled,
}: SkillCardProps) {
  const [editedSkill, setEditedSkill] = useState<Skill>(skill);

  useEffect(() => {
    setEditedSkill(skill);
  }, [skill]);

  const getProficiencyColor = (level: string) => {
    switch (level) {
      case "beginner":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
      case "intermediate":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
      case "advanced":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300";
      case "expert":
        return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300";
    }
  };

  if (isEditing) {
    return (
      <Card className="p-4 bg-muted/50">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="md:col-span-2">
            <Input
              value={editedSkill.title}
              onChange={(e) =>
                setEditedSkill({ ...editedSkill, title: e.target.value })
              }
              placeholder="Skill name"
            />
          </div>
          <div>
            <Input
              type="number"
              min="0"
              max="50"
              value={editedSkill.years_of_experience}
              onChange={(e) =>
                setEditedSkill({
                  ...editedSkill,
                  years_of_experience: parseInt(e.target.value) || 0,
                })
              }
            />
          </div>
          <div>
            <Select
              value={editedSkill.proficiency_level}
              onValueChange={(value) =>
                setEditedSkill({ ...editedSkill, proficiency_level: value })
              }
            >
              <SelectTrigger>
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
        <div className="flex gap-2 mt-3">
          <Button
            size="sm"
            onClick={() => onSave(editedSkill)}
            disabled={disabled || !editedSkill.title.trim()}
          >
            <Save className="h-3 w-3 mr-1" />
            Save
          </Button>
          <Button size="sm" variant="outline" onClick={onCancelEdit}>
            <X className="h-3 w-3 mr-1" />
            Cancel
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4 hover:bg-muted/50 transition">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h3 className="font-semibold text-lg">{skill.title}</h3>
            <span
              className={`px-2 py-1 rounded-full text-xs font-medium ${getProficiencyColor(
                skill.proficiency_level
              )}`}
            >
              {skill.proficiency_level}
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {skill.years_of_experience} {skill.years_of_experience === 1 ? "year" : "years"} of
            experience
          </p>
        </div>

        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={onEdit} disabled={disabled}>
            <Pencil className="h-3 w-3" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onDelete}
            disabled={disabled}
            className="text-red-500 hover:text-red-700"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
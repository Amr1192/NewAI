"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { User, Briefcase, GraduationCap, Settings, Plus, Trash2, Pencil, Save, X, Sparkles } from "lucide-react";
import Header from "@/components/header";
import { authService } from "@/lib/authService";
import axios from "axios";
import toast from "react-hot-toast";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";

interface Skill {
  id?: number;
  title: string;
  years_of_experience: number;
  proficiency_level: string;
}

interface Profile {
  id?: number;
  name?: string;
  email?: string;
  role?: string;
  phone_number?: string | null;
  location?: string | null;
  professional_bio?: string | null;
  years_of_experience?: number;
  skills?: Skill[];
}

export default function ProfilePage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("personal");
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingProfile, setEditingProfile] = useState(false);
  
  const [newSkill, setNewSkill] = useState<Skill>({
    title: "",
    years_of_experience: 0,
    proficiency_level: "beginner",
  });

  useEffect(() => {
    fetchProfile();
    
    // Check for ?tab=skills in URL
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab');
    if (tab) {
      setActiveTab(tab);
    }
  }, []);

  const fetchProfile = async () => {
    const userData = localStorage.getItem("cvmaster_user");
    if (!userData) {
      router.push("/login");
      return;
    }
    
    const parsedUser = JSON.parse(userData);
    setUser(parsedUser);

    try {
      const profileData = await authService.getProfile();
      setProfile(profileData);
      setSkills(profileData.skills || []);
    } catch (error) {
      console.error("Error fetching profile:", error);
      setError("Failed to load profile");
    } finally {
      setLoading(false);
    }
  };

  const addSkill = async () => {
    if (!newSkill.title.trim()) {
      toast.error("Skill title is required");
      return;
    }

    setLoading(true);
    setError(null);

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

      const addedSkills: Skill[] = res.data.skills || [];
      
      // Remove duplicates
      setSkills((prev) => {
        const allSkills = [...prev, ...addedSkills];
        const uniqueSkills = allSkills.filter(
          (s, index, self) => index === self.findIndex((t) => t.id === s.id)
        );
        return uniqueSkills;
      });

      setProfile((prev) =>
        prev
          ? {
              ...prev,
              skills: [
                ...(prev.skills || []).filter(
                  (s) => !addedSkills.some((a) => a.id === s.id)
                ),
                ...addedSkills,
              ],
            }
          : prev
      );

      setNewSkill({
        title: "",
        years_of_experience: 0,
        proficiency_level: "beginner",
      });
      
      toast.success("Skill added successfully!");
    } catch (e: any) {
      console.error("Error adding skill:", e.response?.data || e.message);
      toast.error("Failed to add skill");
    } finally {
      setLoading(false);
    }
  };

  const deleteSkill = async (skillId: number) => {
    if (!confirm("Are you sure you want to delete this skill?")) return;

    setLoading(true);

    try {
      const token = localStorage.getItem("token");
      await axios.delete(`${API_BASE}/api/profile/skills/${skillId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      });

      setSkills((prev) => prev.filter((skill) => skill.id !== skillId));
      setProfile((prev) =>
        prev
          ? { ...prev, skills: (prev.skills || []).filter((s) => s.id !== skillId) }
          : prev
      );
      
      toast.success("Skill deleted successfully!");
    } catch (e: any) {
      console.error("Error deleting skill:", e.response?.data || e.message);
      toast.error("Failed to delete skill");
    } finally {
      setLoading(false);
    }
  };

  const updateSkill = async (skillId: number, updatedSkill: Skill) => {
    setLoading(true);

    try {
      const token = localStorage.getItem("token");
      const res = await axios.put(
        `${API_BASE}/api/profile/skills/${skillId}`,
        updatedSkill,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      setSkills((prev) =>
        prev.map((s) => (s.id === skillId ? res.data.skill : s))
      );
      
      setEditingId(null);
      toast.success("Skill updated successfully!");
    } catch (e: any) {
      console.error("Error updating skill:", e.response?.data || e.message);
      toast.error("Failed to update skill");
    } finally {
      setLoading(false);
    }
  };

  const saveProfile = async () => {
    if (!profile) return;
    
    try {
      setLoading(true);
      const updated = await authService.updateProfile({
        phone_number: profile.phone_number,
        location: profile.location,
        professional_bio: profile.professional_bio,
        years_of_experience: profile.years_of_experience,
      });

      setProfile(updated);
      localStorage.setItem("cvmaster_profile", JSON.stringify(updated));
      toast.success("Profile updated successfully!");
      setEditingProfile(false);
    } catch (error) {
      console.error("Error updating profile:", error);
      toast.error("Failed to update profile");
    } finally {
      setLoading(false);
    }
  };

  const getProficiencyColor = (level: string) => {
    switch (level) {
      case "beginner": return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
      case "intermediate": return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
      case "advanced": return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300";
      case "expert": return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  if (loading && !profile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="max-w-6xl mx-auto p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Profile</h1>
          <p className="text-muted-foreground">
            Manage your personal information, skills, and preferences
          </p>
        </div>

        {error && (
          <Card className="mb-6 p-4 bg-red-50 dark:bg-red-900/10 border-red-200">
            <p className="text-red-600 text-sm">{error}</p>
          </Card>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4 lg:w-[600px]">
            <TabsTrigger value="personal">
              <User className="w-4 h-4 mr-2" />
              Personal
            </TabsTrigger>
            <TabsTrigger value="skills">
              <Briefcase className="w-4 h-4 mr-2" />
              Skills
            </TabsTrigger>
            <TabsTrigger value="experience">
              <GraduationCap className="w-4 h-4 mr-2" />
              Experience
            </TabsTrigger>
            <TabsTrigger value="settings">
              <Settings className="w-4 h-4 mr-2" />
              Settings
            </TabsTrigger>
          </TabsList>

          {/* Personal Info Tab */}
          <TabsContent value="personal">
            <Card className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold">Personal Information</h3>
                {!editingProfile ? (
                  <Button onClick={() => setEditingProfile(true)} variant="outline">
                    <Pencil className="w-4 h-4 mr-2" />
                    Edit
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button onClick={saveProfile} disabled={loading}>
                      <Save className="w-4 h-4 mr-2" />
                      Save
                    </Button>
                    <Button onClick={() => setEditingProfile(false)} variant="outline">
                      <X className="w-4 h-4 mr-2" />
                      Cancel
                    </Button>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div>
                  <Label>Name</Label>
                  <Input 
                    value={profile?.name || ""} 
                    disabled={!editingProfile}
                    onChange={(e) => setProfile(prev => prev ? {...prev, name: e.target.value} : null)}
                    className="mt-2" 
                  />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input value={profile?.email || ""} className="mt-2" disabled />
                  <p className="text-xs text-muted-foreground mt-1">Email cannot be changed</p>
                </div>
                <div>
                  <Label>Phone</Label>
                  <Input 
                    placeholder="(123) 456-7890" 
                    value={profile?.phone_number || ""}
                    disabled={!editingProfile}
                    onChange={(e) => setProfile(prev => prev ? {...prev, phone_number: e.target.value} : null)}
                    className="mt-2" 
                  />
                </div>
                <div>
                  <Label>Location</Label>
                  <Input 
                    placeholder="City, Country" 
                    value={profile?.location || ""}
                    disabled={!editingProfile}
                    onChange={(e) => setProfile(prev => prev ? {...prev, location: e.target.value} : null)}
                    className="mt-2" 
                  />
                </div>
                <div>
                  <Label>Professional Bio</Label>
                  <Textarea 
                    placeholder="Tell us about yourself..."
                    value={profile?.professional_bio || ""}
                    disabled={!editingProfile}
                    onChange={(e) => setProfile(prev => prev ? {...prev, professional_bio: e.target.value} : null)}
                    className="mt-2 min-h-[120px]" 
                  />
                </div>
                <div>
                  <Label>Years of Experience</Label>
                  <Input 
                    type="number"
                    min="0"
                    max="50"
                    value={profile?.years_of_experience || 0}
                    disabled={!editingProfile}
                    onChange={(e) => setProfile(prev => prev ? {...prev, years_of_experience: parseInt(e.target.value) || 0} : null)}
                    className="mt-2" 
                  />
                </div>
              </div>
            </Card>
          </TabsContent>

          {/* Skills Tab */}
          <TabsContent value="skills">
            <div className="space-y-6">
              {/* Add New Skill */}
              <Card className="p-6">
                <h3 className="text-xl font-semibold mb-4">Add New Skill</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="md:col-span-2">
                    <Label>Skill Name</Label>
                    <Input
                      placeholder="e.g., React, Python"
                      value={newSkill.title}
                      onChange={(e) => setNewSkill({ ...newSkill, title: e.target.value })}
                      className="mt-2"
                    />
                  </div>
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
                <Button onClick={addSkill} disabled={loading || !newSkill.title.trim()} className="mt-4">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Skill
                </Button>
              </Card>

              {/* Skills List */}
              <Card className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-semibold">Your Skills ({skills.length})</h3>
                  {skills.length >= 3 && (
                    <Button onClick={() => router.push("/interview-setup")}>
                      <Sparkles className="mr-2 h-4 w-4" />
                      Start Interview Practice
                    </Button>
                  )}
                </div>

                {loading && skills.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">Loading...</div>
                ) : skills.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Briefcase className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p className="text-lg mb-2">No skills added yet</p>
                    <p className="text-sm">Add your first skill above to get started!</p>
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
                        getProficiencyColor={getProficiencyColor}
                      />
                    ))}
                  </div>
                )}
              </Card>

              {skills.length > 0 && skills.length < 3 && (
                <Card className="p-4 bg-blue-50 dark:bg-blue-900/10 border-blue-200">
                  <p className="text-sm text-blue-800 dark:text-blue-300">
                    💡 Add at least 3 skills to get personalized interview questions!
                  </p>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* Experience Tab */}
          <TabsContent value="experience">
            <Card className="p-6">
              <h3 className="text-xl font-semibold mb-4">Work Experience & Education</h3>
              <p className="text-muted-foreground">Coming soon...</p>
            </Card>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings">
            <Card className="p-6">
              <h3 className="text-xl font-semibold mb-4">Settings</h3>
              <p className="text-muted-foreground">Account settings coming soon...</p>
            </Card>
          </TabsContent>
        </Tabs>
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
  getProficiencyColor: (level: string) => string;
}

function SkillCard({
  skill,
  isEditing,
  onEdit,
  onCancelEdit,
  onSave,
  onDelete,
  disabled,
  getProficiencyColor,
}: SkillCardProps) {
  const [editedSkill, setEditedSkill] = useState<Skill>(skill);

  useEffect(() => {
    setEditedSkill(skill);
  }, [skill]);

  if (isEditing) {
    return (
      <Card className="p-4 bg-muted/50">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="md:col-span-2">
            <Input
              value={editedSkill.title}
              onChange={(e) => setEditedSkill({ ...editedSkill, title: e.target.value })}
            />
          </div>
          <div>
            <Input
              type="number"
              min="0"
              max="50"
              value={editedSkill.years_of_experience}
              onChange={(e) =>
                setEditedSkill({ ...editedSkill, years_of_experience: parseInt(e.target.value) || 0 })
              }
            />
          </div>
          <div>
            <Select
              value={editedSkill.proficiency_level}
              onValueChange={(value) => setEditedSkill({ ...editedSkill, proficiency_level: value })}
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
          <Button size="sm" onClick={() => onSave(editedSkill)} disabled={disabled || !editedSkill.title.trim()}>
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
            <h4 className="font-semibold text-lg">{skill.title}</h4>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getProficiencyColor(skill.proficiency_level)}`}>
              {skill.proficiency_level}
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {skill.years_of_experience} {skill.years_of_experience === 1 ? "year" : "years"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={onEdit} disabled={disabled}>
            <Pencil className="h-3 w-3" />
          </Button>
          <Button size="sm" variant="outline" onClick={onDelete} disabled={disabled} className="text-red-500 hover:text-red-700">
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
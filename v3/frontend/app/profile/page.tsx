"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DashboardNav from "@/components/dashboard-nav";
import { Button } from "@/components/ui/button";
import { authService } from "@/lib/authService";
import axios from "axios";
import toast from "react-hot-toast";
import {
  Mail,
  MapPin,
  Briefcase,
  Award,
  Edit2,
  Save,
  X,
  Plus,
} from "lucide-react";

// -------- Interfaces ----------
interface User {
  id?: number;
  name?: string;
  email?: string;
}

interface Skill {
  id?: number;
  title?: string;
  years_of_experience?: number;
  proficiency_level?: string;
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
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [newSkill, setNewSkill] = useState<Skill>({
    title: "",
    years_of_experience: 0,
    proficiency_level: "beginner",
  });

  // ---------- Fetch profile ----------
  useEffect(() => {
    const fetchData = async () => {
      const userData = localStorage.getItem("cvmaster_user");
      if (!userData) {
        router.push("/login");
        return;
      }
      setUser(JSON.parse(userData));

      try {
        const profileData = await authService.getProfile();
        setProfile(profileData);
        setSkills(profileData.skills || []);
      } catch (error) {
        console.error("Error fetching profile:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [router]);

  // ---------- Add Skill ----------
  // const handleAddSkill = async (e: React.FormEvent<HTMLFormElement>) => {
  //   e.preventDefault();
  //   setLoading(true);
  //   try {
  //     const token = localStorage.getItem("token");
  //     const res = await axios.post(
  //       "http://127.0.0.1:8000/api/profile/skills",
  //       { skills: [newSkill] },
  //       {
  //         headers: {
  //           Authorization: `Bearer ${token}`,
  //           "Content-Type": "application/json",
  //         },
  //       }
  //     );

  //     const addedSkills: Skill[] = res.data.skills || [newSkill];
  //     setSkills((prev) => [...prev, ...addedSkills]);
  //     setProfile((prev) =>
  //       prev ? { ...prev, skills: [...(prev.skills || []), ...addedSkills] } : prev
  //     );

  //     setNewSkill({ title: "", years_of_experience: 0, proficiency_level: "beginner" });
  //     setShowForm(false);
  //     toast.success("Skill added successfully!");
  //   } catch (error: any) {
  //     console.error("Error adding skill:", error.response?.data || error.message);
  //     toast.error("Failed to add skill");
  //   } finally {
  //     setLoading(false);
  //   }
  // };
  // ---------- Add Skill ----------
const handleAddSkill = async (e: React.FormEvent<HTMLFormElement>) => {
  e.preventDefault();
  setLoading(true);
  try {
    const token = localStorage.getItem("token");

    const res = await axios.post(
      "http://127.0.0.1:8000/api/profile/skills",
      { skills: [newSkill] },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    // ✅ استخدمي المهارات اللي رجعت من السيرفر
    const addedSkills: Skill[] = res.data.skills || [];

    // ✅ احذفي أي عناصر مكررة (بنفس الـ id)
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
    setShowForm(false);
    toast.success("Skill added successfully!");
  } catch (error: any) {
    console.error("Error adding skill:", error.response?.data || error.message);
    toast.error("Failed to add skill");
  } finally {
    setLoading(false);
  }
};


  // ---------- Remove Skill ----------
  const handleRemoveSkill = async (skillId: number) => {
    if (!confirm("Are you sure you want to remove this skill?")) return;
    try {
      const token = localStorage.getItem("token");
      await axios.delete(`http://127.0.0.1:8000/api/profile/skills/${skillId}`, {
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
      toast.success("Skill removed");
    } catch (error: any) {
      console.error("Error removing skill:", error.response?.data || error.message);
      toast.error("Failed to remove skill");
    }
  };

  // ---------- Save Profile ----------
  const handleSaveProfile = async () => {
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
      setEditing(false);
    } catch (error) {
      console.error("Error updating profile:", error);
      toast.error("Failed to update profile");
    } finally {
      setLoading(false);
    }
  };

  // ---------- UI ----------
  if (loading || !user || !profile) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-900">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-900">
      <DashboardNav user={user} />
      <main className="max-w-6xl mx-auto px-4 py-12 text-white">
        {/* Header */}
        <div className="mb-8 bg-white/10 rounded-2xl p-8 border border-white/20">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold">{profile.name}</h1>
              <p className="text-purple-200">{profile.role || "Professional"}</p>
            </div>
            <Button
              onClick={() => setEditing(!editing)}
              className={`flex gap-2 ${editing ? "bg-red-600" : "bg-purple-600"} text-white`}
            >
              {editing ? <X size={18} /> : <Edit2 size={18} />}
              {editing ? "Cancel" : "Edit Profile"}
            </Button>
          </div>
        </div>

        {/* Info sections */}
        <div className="grid gap-6">
          {/* Email + Phone */}
          <div className="bg-white/10 rounded-2xl p-6">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Mail size={20} className="text-purple-400" /> Basic Info
            </h2>
            <div className="mt-4 space-y-4">
              <input
                type="email"
                value={profile.email}
                disabled
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg"
              />
              <input
                type="tel"
                value={profile.phone_number || ""}
                onChange={(e) =>
                  setProfile({ ...profile, phone_number: e.target.value })
                }
                disabled={!editing}
                placeholder="+20..."
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg"
              />
            </div>
          </div>

          {/* Bio */}
          <div className="bg-white/10 rounded-2xl p-6">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Briefcase size={20} className="text-purple-400" /> Professional Bio
            </h2>
            <textarea
              value={profile.professional_bio || ""}
              onChange={(e) =>
                setProfile({ ...profile, professional_bio: e.target.value })
              }
              disabled={!editing}
              className="w-full h-32 px-4 py-3 bg-white/5 border border-white/10 rounded-lg mt-4"
            />
          </div>

          {/* Skills */}
          <div className="bg-white/10 rounded-2xl p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">Skills</h2>
              <Button
                onClick={() => setShowForm(!showForm)}
                className="bg-purple-600 hover:bg-purple-700 flex items-center gap-2"
              >
                <Plus size={18} /> {showForm ? "Cancel" : "Add Skill"}
              </Button>
            </div>

            <div className="flex flex-wrap gap-3 mb-6">
              {skills.length > 0 ? (
                skills.map((skill) => (
                  <div
                    key={skill.id}
                    className="bg-gradient-to-r from-purple-500 to-purple-600 px-4 py-2 rounded-full flex items-center gap-2"
                  >
                    {`${skill.title} (${skill.proficiency_level})`}
                    <button
                      onClick={() => handleRemoveSkill(skill.id!)}
                      className="bg-white/20 hover:bg-white/30 p-1 rounded-full"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))
              ) : (
                <p className="text-white/50">No skills added yet</p>
              )}
            </div>

            {showForm && (
              <form onSubmit={handleAddSkill} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <input
                    type="text"
                    name="title"
                    value={newSkill.title}
                    onChange={(e) =>
                      setNewSkill({ ...newSkill, title: e.target.value })
                    }
                    placeholder="Skill Title"
                    className="px-4 py-3 bg-white/5 border border-white/10 rounded-lg"
                    required
                  />
                  <input
                    type="number"
                    name="years_of_experience"
                    value={newSkill.years_of_experience}
                    onChange={(e) =>
                      setNewSkill({
                        ...newSkill,
                        years_of_experience: Number(e.target.value),
                      })
                    }
                    placeholder="Years"
                    className="px-4 py-3 bg-white/5 border border-white/10 rounded-lg"
                    required
                  />
                  <select
                    name="proficiency_level"
                    value={newSkill.proficiency_level}
                    onChange={(e) =>
                      setNewSkill({
                        ...newSkill,
                        proficiency_level: e.target.value,
                      })
                    }
                    className="px-4 py-3 bg-white/5 border border-white/10 rounded-lg"
                  >
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="expert">Expert</option>
                  </select>
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="bg-gradient-to-r from-purple-500 to-purple-600 text-white"
                >
                  {loading ? "Saving..." : "Save Skill"}
                </Button>
              </form>
            )}
          </div>

          {editing && (
            <div className="flex justify-end gap-4">
              <Button
                onClick={handleSaveProfile}
                className="bg-gradient-to-r from-purple-500 to-purple-600"
              >
                <Save size={18} /> Save Changes
              </Button>
              <Button
                onClick={() => setEditing(false)}
                variant="outline"
                className="border border-white/30"
              >
                Cancel
              </Button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

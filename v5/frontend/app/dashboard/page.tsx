"use client";
import React, { useEffect, useState } from "react";
import axios from "axios";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Edit, Trash2, Briefcase, Users } from "lucide-react";
import toast from "react-hot-toast";

const AdminDashboard: React.FC = () => {
  const [jobs, setJobs] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const token = localStorage.getItem("token");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [jobRes, userRes] = await Promise.all([
          axios.get("http://127.0.0.1:8000/api/jobs", {
            headers: { Authorization: `Bearer ${token}` },
          }),
          axios.get("http://127.0.0.1:8000/api/admin/users", {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        setJobs(jobRes.data || []);
        setUsers(userRes.data || []);
      } catch (error: any) {
        console.error(error);
        toast.error("Failed to load dashboard data");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [token]);

  if (loading) return <p className="text-center mt-10">Loading...</p>;

  return (
    <div className="p-6 space-y-6">
      {/* ======= Header ======= */}
      <h1 className="text-3xl font-bold text-gray-800 text-center ">Admin Dashboard</h1>

      {/* ======= Stats Cards ======= */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 text-center">
        <Card className="flex items-center justify-between p-4 shadow-m">
          <div>
            <div className="flex items-center gap-2">

          <Briefcase className="text-blue-500 w-8 h-8" />
            <p className="text-sm text-gray-500">Total Jobs</p>
            </div>
            <h2 className="text-2xl font-bold text-gray-800">{jobs.length}</h2>
          </div>
        </Card>

        <Card className="flex items-center justify-between p-4 shadow-md">
          <div>
          <div className="flex items-center gap-2">
          <Users className="text-green-500 w-8 h-8" />
              <p className="text-sm text-gray-500">Total Users</p>
          </div>
            <h2 className="text-2xl font-bold text-gray-800">{users.length}</h2>
          </div>
        </Card>
      </div>

      {/* ======= Jobs Table ======= */}
      <Card>
        <CardContent className="p-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Jobs</h2>
            <Button className="flex items-center gap-2">
              <Plus size={16} /> Add Job
            </Button>
          </div>
          <table className="min-w-full border border-gray-200 text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-2 border">Title</th>
                <th className="p-2 border">Company</th>
                <th className="p-2 border">Location</th>
                <th className="p-2 border">Type</th>
                <th className="p-2 border text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job.id} className="hover:bg-gray-50">
                  <td className="p-2 border">{job.title}</td>
                  <td className="p-2 border">{job.company?.name}</td>
                  <td className="p-2 border">{job.location}</td>
                  <td className="p-2 border">{job.type}</td>
                  <td className="p-2 border text-center space-x-2">
                    <Button size="sm" variant="outline">
                      <Edit size={14} />
                    </Button>
                    <Button size="sm" variant="destructive">
                      <Trash2 size={14} />
                    </Button>
                  </td>
                </tr>
              ))}
              {jobs.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center p-4 text-gray-500">
                    No jobs yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* ======= Users Table ======= */}
      <Card>
        <CardContent className="p-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Users</h2>
            <Button className="flex items-center gap-2">
              <Plus size={16} /> Add User
            </Button>
          </div>
          <table className="min-w-full border border-gray-200 text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-2 border">Name</th>
                <th className="p-2 border">Email</th>
                <th className="p-2 border">Role</th>
                <th className="p-2 border text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="p-2 border">{user.name}</td>
                  <td className="p-2 border">{user.email}</td>
                  <td className="p-2 border capitalize">{user.role}</td>
                  <td className="p-2 border text-center space-x-2">
                    <Button size="sm" variant="outline">
                      <Edit size={14} />
                    </Button>
                    <Button size="sm" variant="destructive">
                      <Trash2 size={14} />
                    </Button>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-center p-4 text-gray-500">
                    No users found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminDashboard;

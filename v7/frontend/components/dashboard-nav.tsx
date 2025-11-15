"use client"

import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"

interface User {
  id?: number
  name?: string
  email?: string
  created_at?: string
}

export default function DashboardNav({ user }: { user: User }) {
  const router = useRouter()

  const handleLogout = () => {
    localStorage.removeItem("cvmaster_user")
    router.push("/login")
  }

  return (
    <nav className="bg-primary text-white shadow-md">
      <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
        <Link href="/dashboard" className="text-2xl font-bold">
          CV Master AI
        </Link>

        <div className="flex items-center gap-6">
          <div className="hidden md:flex gap-4">
            <Link href="/dashboard" className="hover:text-accent transition">
              Dashboard
            </Link>
            <Link href="/profile" className="hover:text-accent transition">
              Profile
            </Link>
            <Link href="/create-cv" className="hover:text-accent transition">
              Create CV
            </Link>
            <Link href="/job-search" className="hover:text-accent transition">
              Jobs
            </Link>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-sm">{user.name}</span>
            <Button onClick={handleLogout} className="bg-accent hover:bg-accent/90">
              Logout
            </Button>
          </div>
        </div>
      </div>
    </nav>
  )
}

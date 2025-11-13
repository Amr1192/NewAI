"use client"

import { useEffect, useState } from "react"
import { Menu, User, LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
// import { ThemeToggle } from "@/components/theme-toggle"
import Link from "next/link"

interface User {
  id: string
  name: string
  email: string
  createdAt: string
}

export default function Header() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    const checkUser = () => {
      const userData = localStorage.getItem("cvmaster_user")
      if (userData) {
        setUser(JSON.parse(userData))
        setIsLoggedIn(true)
      } else {
        setUser(null)
        setIsLoggedIn(false)
      }
    }

    // Check on mount
    checkUser()

    // Listen for storage changes (when user logs in/out from another tab)
    window.addEventListener('storage', checkUser)

    // Listen for custom login event
    window.addEventListener('userLogin', checkUser)
    window.addEventListener('userLogout', checkUser)

    return () => {
      window.removeEventListener('storage', checkUser)
      window.removeEventListener('userLogin', checkUser)
      window.removeEventListener('userLogout', checkUser)
    }
  }, [])

  const handleLogout = () => {
    localStorage.removeItem("cvmaster_user")
    setIsLoggedIn(false)
    setUser(null)
    // Dispatch custom event to notify other components
    window.dispatchEvent(new CustomEvent('userLogout'))
    window.location.href = "/"
  }
  return (
    <header className="bg-background dark:bg-background border-b border-border sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center font-bold text-primary-foreground">
            CV
          </div>
          <span className="font-bold text-lg text-foreground">CV Master AI</span>
        </div>

        <nav className="hidden md:flex items-center gap-8">
          {isLoggedIn ? (
            <>
              <Link href="/create-cv" className="text-foreground hover:text-primary transition">
                Create CV
              </Link>
              <Link href="/enhance-cv" className="text-foreground hover:text-primary transition">
                Enhance CV
              </Link>
              <Link href="/shadow-interviews" className="text-foreground hover:text-primary transition">
                Interviews
              </Link>
              <Link href="/job-search" className="text-foreground hover:text-primary transition">
                Job Search
              </Link>
              <Link href="/cv-analysis-pro" className="text-foreground hover:text-primary transition">
                CV Analysis
              </Link>
            </>
          ) : (
            <>
              <a href="#features" className="text-foreground hover:text-primary transition">
                Features
              </a>
              <a href="#pricing" className="text-foreground hover:text-primary transition">
                Pricing
              </a>
              <a href="#about" className="text-foreground hover:text-primary transition">
                About
              </a>
              <a href="#contact" className="text-foreground hover:text-primary transition">
                Contact
              </a>
            </>
          )}
        </nav>

        <div className="flex items-center gap-4">
          {/* <ThemeToggle />/ */}
          {isLoggedIn ? (
            <>
              <Link href="/profile">
                <Button variant="outline" className="hidden sm:inline-flex bg-transparent">
                  <User className="w-4 h-4 mr-2" />
                  {user?.name || "Profile"}
                </Button>
              </Link>
              <Button 
                variant="outline" 
                onClick={handleLogout}
                className="bg-transparent hover:bg-red-50 hover:text-red-600"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            </>
          ) : (
            <>
              <Link href="/login">
                <Button variant="outline" className="hidden sm:inline-flex bg-transparent">
                  Sign In
                </Button>
              </Link>
              <Link href="/register">
                <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">Get Started</Button>
              </Link>
            </>
          )}
          <Menu className="md:hidden w-6 h-6 text-foreground" />
        </div>
      </div>
    </header>
  )
}

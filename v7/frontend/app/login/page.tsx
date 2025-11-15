"use client"

import type React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Eye, EyeOff, Loader2 } from "lucide-react"
import { authService } from '@/lib/authService';

export default function AuthPage() {
  const router = useRouter()
  const [mode, setMode] = useState<"login" | "signup">("login")
  const [loading, setLoading] = useState(false)
  const [socialLoading, setSocialLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [error, setError] = useState("")

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      if (mode === "login") {
        // --- LOGIN LOGIC ---
        if (!formData.email || !formData.password) {
          setError("Please fill in all fields")
          setLoading(false)
          return
        }

        const response = await authService.login({
          email: formData.email,
          password: formData.password
        });
          console.log(response);
          
        // Check for the 'user' object from the Laravel session response
        if (response && response.user) {
          // Dispatch custom event to notify header
           window.dispatchEvent(new CustomEvent('userLogin'))
        // Force page refresh to update header
        window.location.href = "/"
        } else {
          // Fallback error handling for non-thrown errors
          setError("Invalid credentials or server error. Please check your email and password.")
        }
      } else {
        // --- SIGNUP LOGIC ---
        if (!formData.name || !formData.email || !formData.password) {
          setError("Please fill in all fields")
          setLoading(false)
          return
        }

        if (formData.password !== formData.confirmPassword) {
          setError("Passwords do not match")
          setLoading(false)
          return
        }

        // Client-side password length check
        if (formData.password.length < 8) {
          setError("Password must be at least 8 characters (matches backend rule)")
          setLoading(false)
          return
        }

        const response = await authService.register({
          name: formData.name,
          email: formData.email,
          password: formData.password,
          password_confirmation: formData.confirmPassword
        });

        // If registration was successful, the user is automatically logged in.
        if (response && response.user) {
          window.dispatchEvent(new CustomEvent('userLogin'))
            window.location.href = "/"
        } else {
          // If the service succeeded but didn't return a user (shouldn't happen in the mock, but for safety)
         
        
          setError("Error! Please check your fields.");
        }
      }
    } catch (err) {
      // Handle the error thrown by the mock service or network
           setError("Authentication failed. Please try again.")

    } finally {
      setLoading(false)
    }
  }

  const handleSocialAuth = async (provider: string) => {
    setSocialLoading(true)
    try {
      // NOTE: Using localStorage here is temporary and should be replaced 
      // with a proper API call to your Laravel backend for OAuth.
      const user = {
        id: Math.random().toString(36).substr(2, 9),
        email: `user@${provider}.com`,
        name: `${provider} User`,
        provider,
        createdAt: new Date().toISOString(),
      }

      // WARNING: localStorage is not recommended for production state management.
      localStorage.setItem("cvmaster_user", JSON.stringify(user))
      // Dispatch custom event to notify header
      window.dispatchEvent(new CustomEvent('userLogin'))
      // Force page refresh to update header
   window.location.href = "/"
    } catch (err) {
      setError(`${provider} authentication failed. Please try again.`)
    } finally {
      setSocialLoading(false)
    }
  }

  return (
    <div className="relative flex h-auto min-h-screen w-full flex-col overflow-x-hidden bg-background dark:bg-background">
      <div className="flex flex-1 justify-center">
        <div className="flex flex-col md:flex-row w-full ">
          <div className="w-full md:w-1/2 bg-primary/20 dark:bg-background flex flex-col justify-center items-center pl-0 pr-8 lg:pr-12 py-8 lg:py-12 text-center relative overflow-hidden">
            <div
              className="absolute top-0 left-0 w-full h-full opacity-10"
              style={{
                backgroundImage: "radial-gradient(#1193d4 1px, transparent 1px)",
                backgroundSize: "20px 20px",
              }}
            />
            <div className="relative z-10">
              <svg className="w-16 h-16 text-primary mx-auto mb-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-12h2v4h-2zm0 6h2v2h-2z" />
              </svg>
              <h1 className="text-foreground dark:text-slate-50 tracking-tight text-4xl font-bold leading-tight">
                Your Career, Supercharged.
              </h1>
              <p className="text-muted-foreground dark:text-slate-400 mt-4 text-lg">
                Build the future of your career with AI-powered tools and insights.
              </p>
            </div>
          </div>

          <div className="w-full md:w-1/2 bg-background dark:bg-gray-900 flex flex-col justify-center items-center p-8 lg:p-16">
            <div className="flex flex-col max-w-[480px] flex-1 w-full">
              <div className="flex px-4 py-3 mb-6">
                <div className="flex h-12 flex-1 items-center justify-center rounded-lg bg-secondary dark:bg-gray-800 p-1">
                  <label className="flex cursor-pointer h-full grow items-center justify-center overflow-hidden rounded-lg px-2 has-[:checked]:bg-white has-[:checked]:dark:bg-gray-700 has-[:checked]:shadow-[0_0_4px_rgba(0,0,0,0.1)] has-[:checked]:text-foreground has-[:checked]:dark:text-white text-muted-foreground dark:text-slate-400 text-sm font-medium leading-normal transition-all">
                    <span className="truncate">Login</span>
                    <input
                      checked={mode === "login"}
                      onChange={() => {
                        setMode("login")
                        setError("")
                      }}
                      className="invisible w-0"
                      name="auth-toggle"
                      type="radio"
                      value="login"
                    />
                  </label>
                  <label className="flex cursor-pointer h-full grow items-center justify-center overflow-hidden rounded-lg px-2 has-[:checked]:bg-white has-[:checked]:dark:bg-gray-700 has-[:checked]:shadow-[0_0_4px_rgba(0,0,0,0.1)] has-[:checked]:text-foreground has-[:checked]:dark:text-white text-muted-foreground dark:text-slate-400 text-sm font-medium leading-normal transition-all">
                    <span className="truncate">Sign Up</span>
                    <input
                      checked={mode === "signup"}
                      onChange={() => {
                        setMode("signup")
                        setError("")
                      }}
                      className="invisible w-0"
                      name="auth-toggle"
                      type="radio"
                      value="signup"
                    />
                  </label>
                </div>
              </div>

              <h1 className="text-foreground dark:text-slate-50 tracking-light text-[32px] font-bold leading-tight px-4 text-left pb-3 pt-6">
                {mode === "login" ? "Welcome Back" : "Create Account"}
              </h1>

              {error && (
                <div className="mx-4 mb-4 bg-red-500/20 border border-red-500/50 text-red-700 dark:text-red-200 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="flex max-w-[480px] flex-col gap-4 px-4 py-3">
                {mode === "signup" && (
                  <label className="flex flex-col min-w-40 flex-1">
                    <p className="text-foreground dark:text-slate-300 text-base font-medium leading-normal pb-2">
                      Full Name
                    </p>
                    <div className="flex w-full flex-1 items-stretch rounded-lg border border-border dark:border-gray-600 bg-input dark:bg-gray-800 form-input-container">
                      <input
                        className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-foreground dark:text-slate-50 focus:outline-0 focus:ring-0 border-0 bg-transparent h-14 placeholder:text-muted-foreground dark:placeholder-gray-500 p-[15px] text-base font-normal leading-normal"
                        placeholder="Enter your full name"
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                      />
                    </div>
                  </label>
                )}

                <label className="flex flex-col min-w-40 flex-1">
                  <p className="text-foreground dark:text-slate-300 text-base font-medium leading-normal pb-2">Email</p>
                  <div className="flex w-full flex-1 items-stretch rounded-lg border border-border dark:border-gray-600 bg-input dark:bg-gray-800 form-input-container">
                    <input
                      className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-foreground dark:text-slate-50 focus:outline-0 focus:ring-0 border-0 bg-transparent h-14 placeholder:text-muted-foreground dark:placeholder-gray-500 p-[15px] text-base font-normal leading-normal"
                      placeholder="Enter your email"
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                    />
                  </div>
                </label>

                <label className="flex flex-col min-w-40 flex-1">
                  <p className="text-foreground dark:text-slate-300 text-base font-medium leading-normal pb-2">
                    Password
                  </p>
                  <div className="flex w-full flex-1 items-stretch rounded-lg border border-border dark:border-gray-600 bg-input dark:bg-gray-800 form-input-container">
                    <input
                      className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-foreground dark:text-slate-50 focus:outline-0 focus:ring-0 border-0 bg-transparent h-14 placeholder:text-muted-foreground dark:placeholder-gray-500 p-[15px] pr-2 text-base font-normal leading-normal"
                      placeholder="Enter your password"
                      type={showPassword ? "text" : "password"}
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="text-muted-foreground dark:text-gray-400 flex items-center justify-center pr-[15px] cursor-pointer hover:text-foreground transition"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </label>

                {mode === "signup" && (
                  <label className="flex flex-col min-w-40 flex-1">
                    <p className="text-foreground dark:text-slate-300 text-base font-medium leading-normal pb-2">
                      Confirm Password
                    </p>
                    <div className="flex w-full flex-1 items-stretch rounded-lg border border-border dark:border-gray-600 bg-input dark:bg-gray-800 form-input-container">
                      <input
                        className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-foreground dark:text-slate-50 focus:outline-0 focus:ring-0 border-0 bg-transparent h-14 placeholder:text-muted-foreground dark:placeholder-gray-500 p-[15px] pr-2 text-base font-normal leading-normal"
                        placeholder="Confirm your password"
                        type={showConfirmPassword ? "text" : "password"}
                        name="confirmPassword"
                        value={formData.confirmPassword}
                        onChange={handleChange}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="text-muted-foreground dark:text-gray-400 flex items-center justify-center pr-[15px] cursor-pointer hover:text-foreground transition"
                      >
                        {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </label>
                )}

                {mode === "login" && (
                  <a className="text-primary text-sm font-medium text-right hover:underline" href="/forgot-password">
                    Forgot Password?
                  </a>
                )}

                <button
                  type="submit"
                  disabled={loading || socialLoading}
                  className="primary-button flex min-w-[84px] w-full cursor-pointer items-center justify-center overflow-hidden rounded-lg h-12 px-5 bg-primary text-white text-base font-bold leading-normal tracking-[0.015em] disabled:opacity-50 disabled:cursor-not-allowed mt-4"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {mode === "login" ? "Signing in..." : "Creating account..."}
                    </>
                  ) : mode === "login" ? (
                    "Login"
                  ) : (
                    "Sign Up"
                  )}
                </button>
              </form>

              <div className="flex items-center px-4 py-3">
                <hr className="flex-grow border-t border-border dark:border-gray-600" />
                <span className="px-3 text-sm text-muted-foreground dark:text-gray-400">Or continue with</span>
                <hr className="flex-grow border-t border-border dark:border-gray-600" />
              </div>

              <div className="flex flex-col sm:flex-row gap-4 px-4 py-3">
                <button
                  onClick={() => handleSocialAuth("google")}
                  disabled={loading || socialLoading}
                  className="social-button flex-1 flex items-center justify-center gap-2 h-12 px-5 rounded-lg border border-border dark:border-gray-600 bg-white dark:bg-gray-800 text-foreground dark:text-slate-50 font-medium transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {socialLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <svg className="h-5 w-5" viewBox="0 0 24 24">
                        <path
                          fill="currentColor"
                          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        />
                        <path
                          fill="currentColor"
                          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        />
                        <path
                          fill="currentColor"
                          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                        />
                        <path
                          fill="currentColor"
                          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                        />
                      </svg>
                      <span>Google</span>
                    </>
                  )}
                </button>
                <button
                  onClick={() => handleSocialAuth("linkedin")}
                  disabled={loading || socialLoading}
                  className="social-button flex-1 flex items-center justify-center gap-2 h-12 px-5 rounded-lg border border-border dark:border-gray-600 bg-white dark:bg-gray-800 text-foreground dark:text-slate-50 font-medium transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {socialLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <svg className="h-5 w-5" viewBox="0 0 24 24">
                        <path
                          fill="currentColor"
                          d="M20.447 20.452h-3.554v-5.569c0-1.328-.475-2.236-1.986-2.236-1.081 0-1.722.722-2.004 1.418-.103.249-.129.597-.129.946v5.441h-3.554s.05-8.736 0-9.646h3.554v1.348c.42-.648 1.36-1.573 3.322-1.573 2.429 0 4.251 1.574 4.251 4.963v5.908zM5.337 8.855c-1.144 0-1.915-.762-1.915-1.715 0-.957.77-1.715 1.958-1.715 1.187 0 1.927.758 1.927 1.715 0 .953-.74 1.715-1.97 1.715zm1.946 11.597H3.392V9.806h3.891v10.646zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.225 0z"
                        />
                      </svg>
                      <span>LinkedIn</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

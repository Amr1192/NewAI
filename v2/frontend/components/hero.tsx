import { Button } from "@/components/ui/button"
import { ArrowRight } from "lucide-react"
import Link from "next/link"

export default function Hero() {
  return (
    <section id="home" className="bg-white py-16 md:py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div>
            <div className="inline-block bg-purple-100 text-purple-700 px-4 py-2 rounded-full text-sm font-semibold mb-6">
              ✨ Powered by AI
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-[#1a1a3e] mb-6 leading-tight">
              Unlock Your Career Potential with AI-Powered Solutions
            </h1>
            <p className="text-gray-600 text-lg mb-8 leading-relaxed">
              CV Master AI provides comprehensive tools to help you create a standout CV, ace interviews, and land your
              dream job with confidence.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link href="/register">
                <Button className="bg-[#1a1a3e] hover:bg-[#0f0f2e] text-white px-8 py-6 text-lg">Get Started</Button>
              </Link>
              <Link href="#features">
                <Button variant="outline" className="border-gray-300 text-[#1a1a3e] px-8 py-6 text-lg bg-transparent">
                  Learn More <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </Link>
            </div>
          </div>

          <div className="relative">
            <div className="bg-gradient-to-br from-purple-100 to-purple-50 rounded-2xl p-8 relative z-10">
              <img src="/professional-team-working-on-cv.jpg" alt="Team working on CV" className="rounded-lg w-full" />
              <div className="absolute -bottom-4 -right-4 bg-purple-500 text-white px-6 py-3 rounded-lg font-semibold shadow-lg">
                ⭐ 4.9/5
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

import { Button } from "@/components/ui/button"
import Link from "next/link"

export default function Features() {
  const features = [
    {
      title: "Build a Professional CV with AI Assistance Instantly",
      description:
        "Create a standout CV in minutes with our AI-powered CV builder. Get personalized suggestions, formatting tips, and content recommendations tailored to your industry.",
      image: "/professional-cv-building-interface.jpg",
      reverse: false,
    },
    {
      title: "Test Your CV with AI-Powered Analysis",
      description:
        "Get detailed feedback on your CV with our advanced AI analysis. Identify strengths, weaknesses, and opportunities for improvement to maximize your chances.",
      image: "/cv-analysis-dashboard.jpg",
      reverse: true,
    },
    {
      title: "Ace Your Interview with Realistic Shadow Interviews",
      description:
        "Practice with our AI-powered mock interviews that simulate real scenarios. Get instant feedback on your responses, body language, and overall performance.",
      image: "/interview-preparation-concept.png",
      reverse: false,
    },
  ]

  return (
    <section id="features" className="bg-white py-16 md:py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-20">
        {features.map((feature, idx) => (
          <div
            key={idx}
            className={`grid md:grid-cols-2 gap-12 items-center ${feature.reverse ? "md:grid-flow-dense" : ""}`}
          >
            <div className={feature.reverse ? "md:col-start-2" : ""}>
              <h3 className="text-3xl font-bold text-[#1a1a3e] mb-6">{feature.title}</h3>
              <p className="text-gray-600 text-lg mb-8 leading-relaxed">{feature.description}</p>
              <Link href="/register">
                <Button className="bg-[#1a1a3e] hover:bg-[#0f0f2e] text-white px-8 py-6">Learn More</Button>
              </Link>
            </div>
            <div className={feature.reverse ? "md:col-start-1" : ""}>
              <div className="bg-gradient-to-br from-purple-100 to-purple-50 rounded-2xl overflow-hidden">
                <img
                  src={feature.image || "/placeholder.svg"}
                  alt={feature.title}
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

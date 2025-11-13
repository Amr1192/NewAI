export default function Supercharger() {
  const features = [
    {
      icon: "🎯",
      title: "AI-Powered CV Builder",
      description: "Create professional CVs with AI suggestions and formatting",
    },
    {
      icon: "📊",
      title: "CV Analysis & Feedback",
      description: "Get detailed insights on your CV's effectiveness and ATS compatibility",
    },
    {
      icon: "💼",
      title: "Job Search",
      description: "Find opportunities tailored to your skills and experience",
    },
    {
      icon: "🎤",
      title: "Interview Prep",
      description: "Practice with AI-powered mock interviews and get real-time feedback",
    },
    {
      icon: "📈",
      title: "Career Coaching",
      description: "Receive personalized guidance from AI career experts",
    },
    {
      icon: "🔍",
      title: "ATS Optimization",
      description: "Ensure your CV passes Applicant Tracking Systems",
    },
  ]

  return (
    <section id="pricing" className="bg-gray-50 py-16 md:py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-[#1a1a3e] mb-4">CV Master AI: Your Career Supercharger</h2>
          <p className="text-gray-600 text-lg max-w-2xl mx-auto">
            Everything you need to transform your career journey and land your dream job
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {features.map((feature, idx) => (
            <div key={idx} className="bg-white p-8 rounded-xl border border-gray-200 hover:shadow-lg transition">
              <div className="text-4xl mb-4">{feature.icon}</div>
              <h3 className="text-xl font-bold text-[#1a1a3e] mb-3">{feature.title}</h3>
              <p className="text-gray-600">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

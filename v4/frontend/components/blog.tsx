import { Button } from "@/components/ui/button"
import { ArrowRight } from "lucide-react"
import Link from "next/link"

export default function Blog() {
  const articles = [
    {
      title: "The Ultimate Guide to Writing a Killer CV",
      description:
        "Learn the essential tips and tricks to create a CV that stands out from the competition and gets you noticed by recruiters.",
      image: "/cv-writing-guide.jpg",
    },
    {
      title: "How to Optimize Your CV for ATS",
      description:
        "Discover how to format your CV to pass Applicant Tracking Systems and increase your chances of getting an interview.",
      image: "/ats-optimization.jpg",
    },
    {
      title: "Mastering the Art of the Shadow Interview",
      description: "Get expert tips on how to prepare for and ace your interviews with confidence and professionalism.",
      image: "/interview-preparation.png",
    },
  ]

  return (
    <section id="blog" className="bg-white py-16 md:py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-[#1a1a3e] mb-4">Stay Ahead with Career Insights</h2>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {articles.map((article, idx) => (
            <div
              key={idx}
              className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-lg transition"
            >
              <img src={article.image || "/placeholder.svg"} alt={article.title} className="w-full h-48 object-cover" />
              <div className="p-6">
                <h3 className="text-xl font-bold text-[#1a1a3e] mb-3">{article.title}</h3>
                <p className="text-gray-600 mb-4">{article.description}</p>
                <Link href="#blog">
                  <Button variant="link" className="text-purple-500 hover:text-purple-600 p-0">
                    Read More <ArrowRight className="ml-2 w-4 h-4" />
                  </Button>
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

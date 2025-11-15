export default function Testimonials() {
  const testimonials = [
    {
      quote: "Effective, Fast, and Reliable",
      description:
        "CV Master AI helped me create a professional CV in just 30 minutes. The AI suggestions were spot-on and helped me highlight my key achievements.",
      rating: 5,
    },
    {
      quote: "Prepared and Confident",
      description:
        "The mock interview feature gave me the confidence I needed. I felt well-prepared and landed the job I wanted.",
      rating: 5,
    },
    {
      quote: "Easy and Effective",
      description:
        "The platform is intuitive and user-friendly. I was able to optimize my CV and get valuable feedback without any hassle.",
      rating: 5,
    },
  ]

  return (
    <section id="testimonials" className="bg-white py-16 md:py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-[#1a1a3e] mb-4">What Our Clients Say</h2>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {testimonials.map((testimonial, idx) => (
            <div key={idx} className="bg-gray-50 p-8 rounded-xl border border-gray-200">
              <div className="flex items-center gap-1 mb-4">
                {[...Array(testimonial.rating)].map((_, i) => (
                  <span key={i} className="text-yellow-400">
                    ★
                  </span>
                ))}
              </div>
              <p className="text-2xl font-bold text-[#1a1a3e] mb-4">"{testimonial.quote}"</p>
              <p className="text-gray-600">{testimonial.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

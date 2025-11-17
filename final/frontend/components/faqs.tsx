"use client"

import { useState } from "react"
import { ChevronDown } from "lucide-react"

export default function FAQs() {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  const faqs = [
    {
      question: "How does CV Master AI work?",
      answer:
        "CV Master AI uses advanced artificial intelligence to analyze your information and create a professional CV. It provides personalized suggestions based on industry standards and best practices.",
    },
    {
      question: "Is my data secure?",
      answer:
        "Yes, we use industry-leading encryption and security measures to protect your personal information. Your data is never shared with third parties.",
    },
    {
      question: "Can I edit my CV after creation?",
      answer: "You can edit and customize your CV at any time. Our platform allows unlimited revisions and updates.",
    },
    {
      question: "How does the AI interview work?",
      answer:
        "Our AI conducts realistic mock interviews based on your target role. It evaluates your responses, provides feedback, and helps you improve your interview skills.",
    },
  ]

  return (
    <section id="faq" className="bg-gray-50 py-16 md:py-24">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-[#1a1a3e] mb-4">FAQs</h2>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, idx) => (
            <div key={idx} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <button
                onClick={() => setOpenIndex(openIndex === idx ? null : idx)}
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition"
              >
                <span className="font-semibold text-[#1a1a3e] text-left">{faq.question}</span>
                <ChevronDown
                  className={`w-5 h-5 text-gray-600 transition-transform ${openIndex === idx ? "rotate-180" : ""}`}
                />
              </button>
              {openIndex === idx && (
                <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 text-gray-600">{faq.answer}</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

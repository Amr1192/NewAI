import { Button } from "@/components/ui/button"
import Link from "next/link"

export default function CTA() {
  return (
    <section id="contact" className="bg-[#1a1a3e] text-white py-16 md:py-24">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-3xl md:text-4xl font-bold mb-6">Ready to Transform Your Career Path?</h2>
        <p className="text-gray-300 text-lg mb-8 max-w-2xl mx-auto">
          Join thousands of job seekers who have successfully landed their dream jobs with CV Master AI. Start your
          journey today!
        </p>
        <Link href="/register">
          <Button className="bg-purple-500 hover:bg-purple-600 text-white px-8 py-6 text-lg">Get Started Free</Button>
        </Link>
      </div>
    </section>
  )
}

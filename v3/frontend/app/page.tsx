import Header from "@/components/header"
import Hero from "@/components/hero"
import Mission from "@/components/mission"
import Features from "@/components/features"
import Supercharger from "@/components/supercharger"
import Testimonials from "@/components/testimonials"
import FAQs from "@/components/faqs"
import Blog from "@/components/blog"
import CTA from "@/components/cta"
import Footer from "@/components/footer"
import { Toaster } from "react-hot-toast";
export default function Home() {
  return (
    <main className="min-h-screen bg-white">
      <Toaster position="top-right" />
      <Header />
      <Hero />
      <Mission />
      <Features />
      <Supercharger />
      <Testimonials />
      <FAQs />
      <Blog />
      <CTA />
      <Footer />
    </main>
  )
}

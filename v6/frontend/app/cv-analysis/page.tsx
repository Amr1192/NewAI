// "use client"

// import { useEffect, useState } from "react"
// import { useRouter } from "next/navigation"
// import DashboardNav from "@/components/dashboard-nav"
// import { Button } from "@/components/ui/button"

// interface User {
//   id: string
//   name: string
//   email: string
//   createdAt: string
// }

// interface CVData {
//   personalInfo: {
//     fullName: string
//     email: string
//     phone: string
//     location: string
//   }
//   summary: string
//   experience: Array<{
//     id: string
//     company: string
//     position: string
//     startDate: string
//     endDate: string
//     description: string
//   }>
//   education: Array<{
//     id: string
//     school: string
//     degree: string
//     field: string
//     graduationDate: string
//   }>
//   skills: string[]
// }

// export default function CreateCVPage() {
//   const router = useRouter()
//   const [user, setUser] = useState<User | null>(null)
//   const [cv, setCV] = useState<CVData>({
//     personalInfo: {
//       fullName: "",
//       email: "",
//       phone: "",
//       location: "",
//     },
//     summary: "",
//     experience: [],
//     education: [],
//     skills: [],
//   })
//   const [activeTab, setActiveTab] = useState("personal")
//   const [loading, setLoading] = useState(true)

//   useEffect(() => {
//     const userData = localStorage.getItem("cvmaster_user")
//     if (!userData) {
//       router.push("/login")
//       return
//     }
//     setUser(JSON.parse(userData))

//     const cvData = localStorage.getItem("cvmaster_cv")
//     if (cvData) {
//       setCV(JSON.parse(cvData))
//     }
//     setLoading(false)
//   }, [router])

//   const handleSaveCV = () => {
//     localStorage.setItem("cvmaster_cv", JSON.stringify(cv))
//     alert("CV saved successfully!")
//   }

//   const addExperience = () => {
//     setCV({
//       ...cv,
//       experience: [
//         ...cv.experience,
//         {
//           id: Date.now().toString(),
//           company: "",
//           position: "",
//           startDate: "",
//           endDate: "",
//           description: "",
//         },
//       ],
//     })
//   }

//   const removeExperience = (id: string) => {
//     setCV({
//       ...cv,
//       experience: cv.experience.filter((exp) => exp.id !== id),
//     })
//   }

//   const addEducation = () => {
//     setCV({
//       ...cv,
//       education: [
//         ...cv.education,
//         {
//           id: Date.now().toString(),
//           school: "",
//           degree: "",
//           field: "",
//           graduationDate: "",
//         },
//       ],
//     })
//   }

//   const removeEducation = (id: string) => {
//     setCV({
//       ...cv,
//       education: cv.education.filter((edu) => edu.id !== id),
//     })
//   }

//   if (loading || !user) {
//     return <div className="flex items-center justify-center min-h-screen">Loading...</div>
//   }

//   return (
//     <div className="min-h-screen bg-background">
//       <DashboardNav user={user} />

//       <main className="max-w-6xl mx-auto px-4 py-12">
//         <div className="bg-white rounded-lg shadow-md p-8">
//           <h1 className="text-3xl font-bold text-primary mb-8">Create Your CV</h1>

//           {/* Tabs */}
//           <div className="flex gap-4 mb-8 border-b border-border">
//             {["personal", "summary", "experience", "education", "skills"].map((tab) => (
//               <button
//                 key={tab}
//                 onClick={() => setActiveTab(tab)}
//                 className={`px-4 py-2 font-semibold capitalize transition ${
//                   activeTab === tab
//                     ? "text-accent border-b-2 border-accent"
//                     : "text-muted-foreground hover:text-foreground"
//                 }`}
//               >
//                 {tab}
//               </button>
//             ))}
//           </div>

//           {/* Personal Info Tab */}
//           {activeTab === "personal" && (
//             <div className="space-y-4">
//               <h2 className="text-xl font-semibold text-primary mb-4">Personal Information</h2>
//               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
//                 <div>
//                   <label className="block text-sm font-medium text-foreground mb-2">Full Name</label>
//                   <input
//                     type="text"
//                     value={cv.personalInfo.fullName}
//                     onChange={(e) =>
//                       setCV({
//                         ...cv,
//                         personalInfo: { ...cv.personalInfo, fullName: e.target.value },
//                       })
//                     }
//                     className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
//                   />
//                 </div>
//                 <div>
//                   <label className="block text-sm font-medium text-foreground mb-2">Email</label>
//                   <input
//                     type="email"
//                     value={cv.personalInfo.email}
//                     onChange={(e) =>
//                       setCV({
//                         ...cv,
//                         personalInfo: { ...cv.personalInfo, email: e.target.value },
//                       })
//                     }
//                     className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
//                   />
//                 </div>
//                 <div>
//                   <label className="block text-sm font-medium text-foreground mb-2">Phone</label>
//                   <input
//                     type="tel"
//                     value={cv.personalInfo.phone}
//                     onChange={(e) =>
//                       setCV({
//                         ...cv,
//                         personalInfo: { ...cv.personalInfo, phone: e.target.value },
//                       })
//                     }
//                     className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
//                   />
//                 </div>
//                 <div>
//                   <label className="block text-sm font-medium text-foreground mb-2">Location</label>
//                   <input
//                     type="text"
//                     value={cv.personalInfo.location}
//                     onChange={(e) =>
//                       setCV({
//                         ...cv,
//                         personalInfo: { ...cv.personalInfo, location: e.target.value },
//                       })
//                     }
//                     className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
//                   />
//                 </div>
//               </div>
//             </div>
//           )}

//           {/* Summary Tab */}
//           {activeTab === "summary" && (
//             <div className="space-y-4">
//               <h2 className="text-xl font-semibold text-primary mb-4">Professional Summary</h2>
//               <textarea
//                 value={cv.summary}
//                 onChange={(e) => setCV({ ...cv, summary: e.target.value })}
//                 className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent h-40"
//                 placeholder="Write a brief professional summary..."
//               />
//             </div>
//           )}

//           {/* Experience Tab */}
//           {activeTab === "experience" && (
//             <div className="space-y-6">
//               <div className="flex items-center justify-between mb-4">
//                 <h2 className="text-xl font-semibold text-primary">Work Experience</h2>
//                 <Button onClick={addExperience} className="bg-accent hover:bg-accent/90">
//                   Add Experience
//                 </Button>
//               </div>

//               {cv.experience.map((exp, idx) => (
//                 <div key={exp.id} className="border border-border rounded-lg p-4 space-y-4">
//                   <div className="flex items-center justify-between">
//                     <h3 className="font-semibold text-foreground">Experience {idx + 1}</h3>
//                     <button onClick={() => removeExperience(exp.id)} className="text-red-500 hover:text-red-700">
//                       Remove
//                     </button>
//                   </div>

//                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
//                     <input
//                       type="text"
//                       placeholder="Company"
//                       value={exp.company}
//                       onChange={(e) => {
//                         const updated = cv.experience.map((e) =>
//                           e.id === exp.id ? { ...e, company: e.target.value } : e,
//                         )
//                         setCV({ ...cv, experience: updated })
//                       }}
//                       className="px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
//                     />
//                     <input
//                       type="text"
//                       placeholder="Position"
//                       value={exp.position}
//                       onChange={(e) => {
//                         const updated = cv.experience.map((e) =>
//                           e.id === exp.id ? { ...e, position: e.target.value } : e,
//                         )
//                         setCV({ ...cv, experience: updated })
//                       }}
//                       className="px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
//                     />
//                     <input
//                       type="date"
//                       placeholder="Start Date"
//                       value={exp.startDate}
//                       onChange={(e) => {
//                         const updated = cv.experience.map((e) =>
//                           e.id === exp.id ? { ...e, startDate: e.target.value } : e,
//                         )
//                         setCV({ ...cv, experience: updated })
//                       }}
//                       className="px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
//                     />
//                     <input
//                       type="date"
//                       placeholder="End Date"
//                       value={exp.endDate}
//                       onChange={(e) => {
//                         const updated = cv.experience.map((e) =>
//                           e.id === exp.id ? { ...e, endDate: e.target.value } : e,
//                         )
//                         setCV({ ...cv, experience: updated })
//                       }}
//                       className="px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
//                     />
//                   </div>

//                   <textarea
//                     placeholder="Job Description"
//                     value={exp.description}
//                     onChange={(e) => {
//                       const updated = cv.experience.map((e) =>
//                         e.id === exp.id ? { ...e, description: e.target.value } : e,
//                       )
//                       setCV({ ...cv, experience: updated })
//                     }}
//                     className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent h-24"
//                   />
//                 </div>
//               ))}
//             </div>
//           )}

//           {/* Education Tab */}
//           {activeTab === "education" && (
//             <div className="space-y-6">
//               <div className="flex items-center justify-between mb-4">
//                 <h2 className="text-xl font-semibold text-primary">Education</h2>
//                 <Button onClick={addEducation} className="bg-accent hover:bg-accent/90">
//                   Add Education
//                 </Button>
//               </div>

//               {cv.education.map((edu, idx) => (
//                 <div key={edu.id} className="border border-border rounded-lg p-4 space-y-4">
//                   <div className="flex items-center justify-between">
//                     <h3 className="font-semibold text-foreground">Education {idx + 1}</h3>
//                     <button onClick={() => removeEducation(edu.id)} className="text-red-500 hover:text-red-700">
//                       Remove
//                     </button>
//                   </div>

//                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
//                     <input
//                       type="text"
//                       placeholder="School/University"
//                       value={edu.school}
//                       onChange={(e) => {
//                         const updated = cv.education.map((e) =>
//                           e.id === edu.id ? { ...e, school: e.target.value } : e,
//                         )
//                         setCV({ ...cv, education: updated })
//                       }}
//                       className="px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
//                     />
//                     <input
//                       type="text"
//                       placeholder="Degree"
//                       value={edu.degree}
//                       onChange={(e) => {
//                         const updated = cv.education.map((e) =>
//                           e.id === edu.id ? { ...e, degree: e.target.value } : e,
//                         )
//                         setCV({ ...cv, education: updated })
//                       }}
//                       className="px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
//                     />
//                     <input
//                       type="text"
//                       placeholder="Field of Study"
//                       value={edu.field}
//                       onChange={(e) => {
//                         const updated = cv.education.map((e) => (e.id === edu.id ? { ...e, field: e.target.value } : e))
//                         setCV({ ...cv, education: updated })
//                       }}
//                       className="px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
//                     />
//                     <input
//                       type="date"
//                       placeholder="Graduation Date"
//                       value={edu.graduationDate}
//                       onChange={(e) => {
//                         const updated = cv.education.map((e) =>
//                           e.id === edu.id ? { ...e, graduationDate: e.target.value } : e,
//                         )
//                         setCV({ ...cv, education: updated })
//                       }}
//                       className="px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
//                     />
//                   </div>
//                 </div>
//               ))}
//             </div>
//           )}

//           {/* Skills Tab */}
//           {activeTab === "skills" && (
//             <div className="space-y-4">
//               <h2 className="text-xl font-semibold text-primary mb-4">Skills</h2>
//               <textarea
//                 value={cv.skills.join(", ")}
//                 onChange={(e) =>
//                   setCV({
//                     ...cv,
//                     skills: e.target.value.split(",").map((s) => s.trim()),
//                   })
//                 }
//                 className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent h-32"
//                 placeholder="Enter skills separated by commas (e.g., JavaScript, React, Node.js)"
//               />
//             </div>
//           )}

//           {/* Save Button */}
//           <div className="flex gap-4 mt-8 pt-8 border-t border-border">
//             <Button onClick={handleSaveCV} className="flex-1 bg-accent hover:bg-accent/90">
//               Save CV
//             </Button>
//             <Button onClick={() => router.push("/dashboard")} variant="outline" className="flex-1">
//               Back to Dashboard
//             </Button>
//           </div>
//         </div>
//       </main>
//     </div>
//   )
// }



// WITH PROBMLEMS :

// "use client"

// import { useEffect, useState } from "react"
// import { useRouter } from "next/navigation"
// import DashboardNav from "@/components/dashboard-nav"
// import { Button } from "@/components/ui/button"
// import { Download, Sparkles, Save } from "lucide-react"

// interface User {
//   id: string
//   name: string
//   email: string
//   createdAt: string
// }

// interface CVData {
//   template: "modernist" | "classic" | "creative" | "minimalist"
//   personalInfo: {
//     fullName: string
//     email: string
//     phone: string
//     location: string
//   }
//   summary: string
//   experience: Array<{
//     id: string
//     company: string
//     position: string
//     startDate: string
//     endDate: string
//     description: string
//   }>
//   education: Array<{
//     id: string
//     school: string
//     degree: string
//     field: string
//     graduationDate: string
//   }>
//   skills: string[]
// }

// const templates = [
//   {
//     id: "modernist",
//     name: "Modernist",
//     description: "A sleek and contemporary design.",
//     image: "https://images.unsplash.com/photo-1586281573921-ba531ce47b00?w=400&h=500&fit=crop",
//   },
//   {
//     id: "classic",
//     name: "Classic",
//     description: "A timeless and professional layout.",
//     image: "https://images.unsplash.com/photo-1586281573921-ba531ce47b00?w=400&h=500&fit=crop",
//   },
//   {
//     id: "creative",
//     name: "Creative",
//     description: "A bold and artistic approach.",
//     image: "https://images.unsplash.com/photo-1586281573921-ba531ce47b00?w=400&h=500&fit=crop",
//   },
//   {
//     id: "minimalist",
//     name: "Minimalist",
//     description: "Clean and focused on content.",
//     image: "https://images.unsplash.com/photo-1586281573921-ba531ce47b00?w=400&h=500&fit=crop",
//   },
// ]

// export default function CreateCVPage() {
//   const router = useRouter()
//   const [user, setUser] = useState<User | null>(null)
//   const [cv, setCV] = useState<CVData>({
//     template: "modernist",
//     personalInfo: {
//       fullName: "",
//       email: "",
//       phone: "",
//       location: "",
//     },
//     summary: "",
//     experience: [],
//     education: [],
//     skills: [],
//   })
//   const [loading, setLoading] = useState(true)
//   const [expandedSection, setExpandedSection] = useState("personal")

//   useEffect(() => {
//     const userData = localStorage.getItem("cvmaster_user")
//     if (!userData) {
//       router.push("/login")
//       return
//     }
//     setUser(JSON.parse(userData))

//     const cvData = localStorage.getItem("cvmaster_cv")
//     if (cvData) {
//       setCV(JSON.parse(cvData))
//     }
//     setLoading(false)
//   }, [router])

//   const handleSaveCV = () => {
//     localStorage.setItem("cvmaster_cv", JSON.stringify(cv))
//     alert("CV saved successfully!")
//   }

//   const addExperience = () => {
//     setCV({
//       ...cv,
//       experience: [
//         ...cv.experience,
//         {
//           id: Date.now().toString(),
//           company: "",
//           position: "",
//           startDate: "",
//           endDate: "",
//           description: "",
//         },
//       ],
//     })
//   }

//   const removeExperience = (id: string) => {
//     setCV({
//       ...cv,
//       experience: cv.experience.filter((exp) => exp.id !== id),
//     })
//   }

//   const addEducation = () => {
//     setCV({
//       ...cv,
//       education: [
//         ...cv.education,
//         {
//           id: Date.now().toString(),
//           school: "",
//           degree: "",
//           field: "",
//           graduationDate: "",
//         },
//       ],
//     })
//   }

//   const removeEducation = (id: string) => {
//     setCV({
//       ...cv,
//       education: cv.education.filter((edu) => edu.id !== id),
//     })
//   }

//   const updateExperience = (id: string, field: string, value: string) => {
//     setCV({
//       ...cv,
//       experience: cv.experience.map((exp) => (exp.id === id ? { ...exp, [field]: value } : exp)),
//     })
//   }

//   const updateEducation = (id: string, field: string, value: string) => {
//     setCV({
//       ...cv,
//       education: cv.education.map((edu) => (edu.id === id ? { ...edu, [field]: value } : edu)),
//     })
//   }

//   if (loading || !user) {
//     return <div className="flex items-center justify-center min-h-screen">Loading...</div>
//   }

//   return (
//     <div className="min-h-screen bg-background">
//       <DashboardNav user={user} />

//       <header className="border-b border-border bg-card sticky top-0 z-10">
//         <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
//           <div className="flex items-center gap-3">
//             <div className="w-10 h-10 rounded-lg bg-accent/20 flex items-center justify-center">
//               <span className="text-accent text-xl">📄</span>
//             </div>
//             <h1 className="text-2xl font-bold text-foreground">CV Builder</h1>
//           </div>
//           <div className="flex items-center gap-3">
//             <Button variant="outline" className="gap-2 bg-transparent">
//               <Sparkles className="w-4 h-4" />
//               AI CV Review
//             </Button>
//             <Button variant="outline" className="gap-2 bg-transparent">
//               <Download className="w-4 h-4" />
//               Download as PDF
//             </Button>
//             <Button onClick={handleSaveCV} className="gap-2 bg-accent hover:bg-accent/90">
//               <Save className="w-4 h-4" />
//               Save
//             </Button>
//           </div>
//         </div>
//       </header>

//       <main className="grid grid-cols-1 lg:grid-cols-2 min-h-[calc(100vh-80px)]">
//         <div className="bg-card border-r border-border overflow-y-auto">
//           <div className="max-w-2xl mx-auto p-6 space-y-6">
//             <div>
//               <h2 className="text-3xl font-bold text-foreground mb-2">Craft Your Professional Story</h2>
//               <p className="text-muted-foreground">Choose a template and start building your standout CV.</p>
//             </div>

//             {/* Template Carousel */}
//             <div>
//               <h3 className="text-lg font-semibold text-foreground mb-4">Choose a Template</h3>
//               <div className="flex overflow-x-auto gap-4 pb-4 [-ms-scrollbar-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
//                 {templates.map((template) => (
//                   <button
//                     key={template.id}
//                     onClick={() => setCV({ ...cv, template: template.id as any })}
//                     className={`flex-shrink-0 w-60 rounded-lg border-2 transition-all ${
//                       cv.template === template.id
//                         ? "border-accent ring-2 ring-accent/20"
//                         : "border-border hover:border-accent/50"
//                     }`}
//                   >
//                     <div
//                       className="w-full aspect-[4/5] bg-cover rounded-md mb-3"
//                       style={{ backgroundImage: `url(${template.image})` }}
//                     />
//                     <div className="px-3 pb-3">
//                       <p className="font-medium text-foreground">{template.name}</p>
//                       <p className="text-sm text-muted-foreground">{template.description}</p>
//                     </div>
//                   </button>
//                 ))}
//               </div>
//             </div>

//             {/* Accordion Sections */}
//             <div className="space-y-3">
//               {/* Personal Details */}
//               <details
//                 open={expandedSection === "personal"}
//                 onToggle={() => setExpandedSection(expandedSection === "personal" ? "" : "personal")}
//                 className="group border border-border rounded-lg bg-muted/50 overflow-hidden"
//               >
//                 <summary className="flex cursor-pointer items-center justify-between gap-4 p-4 list-none hover:bg-muted/70 transition">
//                   <div className="flex items-center gap-3">
//                     <span className="text-muted-foreground">⋮⋮</span>
//                     <p className="font-medium text-foreground">Personal Details</p>
//                   </div>
//                   <span className="text-muted-foreground group-open:rotate-180 transition-transform">▼</span>
//                 </summary>
//                 <div className="px-4 pb-4 space-y-4 border-t border-border pt-4">
//                   <input
//                     type="text"
//                     placeholder="Full Name"
//                     value={cv.personalInfo.fullName}
//                     onChange={(e) =>
//                       setCV({
//                         ...cv,
//                         personalInfo: { ...cv.personalInfo, fullName: e.target.value },
//                       })
//                     }
//                     className="w-full px-3 py-2 rounded-md bg-background border border-border text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent"
//                   />
//                   <input
//                     type="email"
//                     placeholder="Email Address"
//                     value={cv.personalInfo.email}
//                     onChange={(e) =>
//                       setCV({
//                         ...cv,
//                         personalInfo: { ...cv.personalInfo, email: e.target.value },
//                       })
//                     }
//                     className="w-full px-3 py-2 rounded-md bg-background border border-border text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent"
//                   />
//                   <input
//                     type="tel"
//                     placeholder="Phone Number"
//                     value={cv.personalInfo.phone}
//                     onChange={(e) =>
//                       setCV({
//                         ...cv,
//                         personalInfo: { ...cv.personalInfo, phone: e.target.value },
//                       })
//                     }
//                     className="w-full px-3 py-2 rounded-md bg-background border border-border text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent"
//                   />
//                   <input
//                     type="text"
//                     placeholder="Location"
//                     value={cv.personalInfo.location}
//                     onChange={(e) =>
//                       setCV({
//                         ...cv,
//                         personalInfo: { ...cv.personalInfo, location: e.target.value },
//                       })
//                     }
//                     className="w-full px-3 py-2 rounded-md bg-background border border-border text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent"
//                   />
//                 </div>
//               </details>

//               {/* Professional Summary */}
//               <details
//                 open={expandedSection === "summary"}
//                 onToggle={() => setExpandedSection(expandedSection === "summary" ? "" : "summary")}
//                 className="group border border-border rounded-lg bg-muted/50 overflow-hidden"
//               >
//                 <summary className="flex cursor-pointer items-center justify-between gap-4 p-4 list-none hover:bg-muted/70 transition">
//                   <div className="flex items-center gap-3">
//                     <span className="text-muted-foreground">⋮⋮</span>
//                     <p className="font-medium text-foreground">Professional Summary</p>
//                   </div>
//                   <span className="text-muted-foreground group-open:rotate-180 transition-transform">▼</span>
//                 </summary>
//                 <div className="px-4 pb-4 border-t border-border pt-4">
//                   <textarea
//                     placeholder="Describe your professional background..."
//                     value={cv.summary}
//                     onChange={(e) => setCV({ ...cv, summary: e.target.value })}
//                     className="w-full px-3 py-2 rounded-md bg-background border border-border text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent h-24 resize-none"
//                   />
//                 </div>
//               </details>

//               {/* Work Experience */}
//               <details
//                 open={expandedSection === "experience"}
//                 onToggle={() => setExpandedSection(expandedSection === "experience" ? "" : "experience")}
//                 className="group border border-border rounded-lg bg-muted/50 overflow-hidden"
//               >
//                 <summary className="flex cursor-pointer items-center justify-between gap-4 p-4 list-none hover:bg-muted/70 transition">
//                   <div className="flex items-center gap-3">
//                     <span className="text-muted-foreground">⋮⋮</span>
//                     <p className="font-medium text-foreground">Work Experience</p>
//                   </div>
//                   <span className="text-muted-foreground group-open:rotate-180 transition-transform">▼</span>
//                 </summary>
//                 <div className="px-4 pb-4 space-y-4 border-t border-border pt-4">
//                   {cv.experience.map((exp) => (
//                     <div key={exp.id} className="space-y-3 p-3 bg-background rounded-lg border border-border">
//                       <input
//                         type="text"
//                         placeholder="Company"
//                         value={exp.company}
//                         onChange={(e) => updateExperience(exp.id, "company", e.target.value)}
//                         className="w-full px-3 py-2 rounded-md bg-card border border-border text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent text-sm"
//                       />
//                       <input
//                         type="text"
//                         placeholder="Position"
//                         value={exp.position}
//                         onChange={(e) => updateExperience(exp.id, "position", e.target.value)}
//                         className="w-full px-3 py-2 rounded-md bg-card border border-border text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent text-sm"
//                       />
//                       <div className="grid grid-cols-2 gap-2">
//                         <input
//                           type="date"
//                           value={exp.startDate}
//                           onChange={(e) => updateExperience(exp.id, "startDate", e.target.value)}
//                           className="px-3 py-2 rounded-md bg-card border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-accent text-sm"
//                         />
//                         <input
//                           type="date"
//                           value={exp.endDate}
//                           onChange={(e) => updateExperience(exp.id, "endDate", e.target.value)}
//                           className="px-3 py-2 rounded-md bg-card border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-accent text-sm"
//                         />
//                       </div>
//                       <textarea
//                         placeholder="Job description..."
//                         value={exp.description}
//                         onChange={(e) => updateExperience(exp.id, "description", e.target.value)}
//                         className="w-full px-3 py-2 rounded-md bg-card border border-border text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent text-sm h-16 resize-none"
//                       />
//                       <button
//                         onClick={() => removeExperience(exp.id)}
//                         className="text-sm text-destructive hover:text-destructive/80 font-medium"
//                       >
//                         Remove
//                       </button>
//                     </div>
//                   ))}
//                   <Button onClick={addExperience} variant="outline" className="w-full gap-2 bg-transparent">
//                     <span>+</span> Add Experience
//                   </Button>
//                 </div>
//               </details>

//               {/* Education */}
//               <details
//                 open={expandedSection === "education"}
//                 onToggle={() => setExpandedSection(expandedSection === "education" ? "" : "education")}
//                 className="group border border-border rounded-lg bg-muted/50 overflow-hidden"
//               >
//                 <summary className="flex cursor-pointer items-center justify-between gap-4 p-4 list-none hover:bg-muted/70 transition">
//                   <div className="flex items-center gap-3">
//                     <span className="text-muted-foreground">⋮⋮</span>
//                     <p className="font-medium text-foreground">Education</p>
//                   </div>
//                   <span className="text-muted-foreground group-open:rotate-180 transition-transform">▼</span>
//                 </summary>
//                 <div className="px-4 pb-4 space-y-4 border-t border-border pt-4">
//                   {cv.education.map((edu) => (
//                     <div key={edu.id} className="space-y-3 p-3 bg-background rounded-lg border border-border">
//                       <input
//                         type="text"
//                         placeholder="Degree"
//                         value={edu.degree}
//                         onChange={(e) => updateEducation(edu.id, "degree", e.target.value)}
//                         className="w-full px-3 py-2 rounded-md bg-card border border-border text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent text-sm"
//                       />
//                       <input
//                         type="text"
//                         placeholder="Institution"
//                         value={edu.school}
//                         onChange={(e) => updateEducation(edu.id, "school", e.target.value)}
//                         className="w-full px-3 py-2 rounded-md bg-card border border-border text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent text-sm"
//                       />
//                       <input
//                         type="text"
//                         placeholder="Field of Study"
//                         value={edu.field}
//                         onChange={(e) => updateEducation(edu.id, "field", e.target.value)}
//                         className="w-full px-3 py-2 rounded-md bg-card border border-border text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent text-sm"
//                       />
//                       <input
//                         type="date"
//                         value={edu.graduationDate}
//                         onChange={(e) => updateEducation(edu.id, "graduationDate", e.target.value)}
//                         className="w-full px-3 py-2 rounded-md bg-card border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-accent text-sm"
//                       />
//                       <button
//                         onClick={() => removeEducation(edu.id)}
//                         className="text-sm text-destructive hover:text-destructive/80 font-medium"
//                       >
//                         Remove
//                       </button>
//                     </div>
//                   ))}
//                   <Button onClick={addEducation} variant="outline" className="w-full gap-2 bg-transparent">
//                     <span>+</span> Add Education
//                   </Button>
//                 </div>
//               </details>

//               {/* Skills */}
//               <details
//                 open={expandedSection === "skills"}
//                 onToggle={() => setExpandedSection(expandedSection === "skills" ? "" : "skills")}
//                 className="group border border-border rounded-lg bg-muted/50 overflow-hidden"
//               >
//                 <summary className="flex cursor-pointer items-center justify-between gap-4 p-4 list-none hover:bg-muted/70 transition">
//                   <div className="flex items-center gap-3">
//                     <span className="text-muted-foreground">⋮⋮</span>
//                     <p className="font-medium text-foreground">Skills</p>
//                   </div>
//                   <span className="text-muted-foreground group-open:rotate-180 transition-transform">▼</span>
//                 </summary>
//                 <div className="px-4 pb-4 border-t border-border pt-4">
//                   <textarea
//                     placeholder="e.g., Python, Teamwork, Project Management"
//                     value={cv.skills.join(", ")}
//                     onChange={(e) =>
//                       setCV({
//                         ...cv,
//                         skills: e.target.value.split(",").map((s) => s.trim()),
//                       })
//                     }
//                     className="w-full px-3 py-2 rounded-md bg-background border border-border text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent h-20 resize-none"
//                   />
//                 </div>
//               </details>
//             </div>

//             <Button variant="outline" className="w-full gap-2 bg-transparent">
//               <span>+</span> Add New Section
//             </Button>
//           </div>
//         </div>

//         <div className="hidden lg:flex bg-background p-10 items-center justify-center overflow-y-auto">
//           <div className="w-full max-w-2xl aspect-[1/1.414] bg-card shadow-2xl rounded-lg overflow-hidden">
//             <div className="p-8 md:p-12 h-full text-foreground space-y-6">
//               {/* Header */}
//               <div className="flex justify-between items-start border-b border-border pb-6">
//                 <div>
//                   <h1 className="text-4xl font-bold text-foreground">{cv.personalInfo.fullName || "Your Name"}</h1>
//                   <p className="text-accent text-lg font-medium">Professional Title</p>
//                 </div>
//                 <div className="text-right text-xs">
//                   {cv.personalInfo.email && <p>{cv.personalInfo.email}</p>}
//                   {cv.personalInfo.phone && <p>{cv.personalInfo.phone}</p>}
//                   {cv.personalInfo.location && <p>{cv.personalInfo.location}</p>}
//                 </div>
//               </div>

//               {/* Summary */}
//               {cv.summary && (
//                 <div>
//                   <h2 className="text-xl font-bold text-accent mb-2">Professional Summary</h2>
//                   <p className="text-sm text-muted-foreground">{cv.summary}</p>
//                 </div>
//               )}

//               {/* Experience */}
//               {cv.experience.length > 0 && (
//                 <div>
//                   <h2 className="text-xl font-bold text-accent mb-3">Work Experience</h2>
//                   <div className="space-y-3">
//                     {cv.experience.map((exp) => (
//                       <div key={exp.id}>
//                         <h3 className="font-semibold text-foreground">{exp.position || "Position"}</h3>
//                         <p className="text-xs text-muted-foreground">
//                           {exp.company || "Company"} | {exp.startDate} - {exp.endDate}
//                         </p>
//                         {exp.description && <p className="text-xs text-muted-foreground mt-1">{exp.description}</p>}
//                       </div>
//                     ))}
//                   </div>
//                 </div>
//               )}

//               {/* Education */}
//               {cv.education.length > 0 && (
//                 <div>
//                   <h2 className="text-xl font-bold text-accent mb-3">Education</h2>
//                   <div className="space-y-2">
//                     {cv.education.map((edu) => (
//                       <div key={edu.id}>
//                         <h3 className="font-semibold text-foreground">{edu.degree || "Degree"}</h3>
//                         <p className="text-xs text-muted-foreground">
//                           {edu.school || "Institution"} | {edu.graduationDate}
//                         </p>
//                       </div>
//                     ))}
//                   </div>
//                 </div>
//               )}

//               {/* Skills */}
//               {cv.skills.length > 0 && (
//                 <div>
//                   <h2 className="text-xl font-bold text-accent mb-2">Skills</h2>
//                   <div className="flex flex-wrap gap-2">
//                     {cv.skills.map((skill, idx) => (
//                       <span key={idx} className="text-xs bg-accent/20 text-accent px-2 py-1 rounded">
//                         {skill}
//                       </span>
//                     ))}
//                   </div>
//                 </div>
//               )}
//             </div>
//           </div>
//         </div>
//       </main>
//     </div>
//   )
// }


// without problems  ISA:
"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import DashboardNav from "@/components/dashboard-nav"
import { Button } from "@/components/ui/button"
import { Download, Sparkles, Save } from "lucide-react"

interface User {
  id: string
  name: string
  email: string
  createdAt: string
}

interface CVData {
  template: "modernist" | "classic" | "creative" | "minimalist"
  personalInfo: {
    fullName: string
    email: string
    phone: string
    location: string
  }
  summary: string
  experience: Array<{
    id: string
    company: string
    position: string
    startDate: string
    endDate: string
    description: string
  }>
  education: Array<{
    id: string
    school: string
    degree: string
    field: string
    graduationDate: string
  }>
  skills: string[]
}

const templates = [
  {
    id: "modernist",
    name: "Modernist",
    description: "A sleek and contemporary design.",
    image: "https://images.unsplash.com/photo-1586281573921-ba531ce47b00?w=400&h=500&fit=crop",
  },
  {
    id: "classic",
    name: "Classic",
    description: "A timeless and professional layout.",
    image: "https://images.unsplash.com/photo-1586281573921-ba531ce47b00?w=400&h=500&fit=crop",
  },
  {
    id: "creative",
    name: "Creative",
    description: "A bold and artistic approach.",
    image: "https://images.unsplash.com/photo-1586281573921-ba531ce47b00?w=400&h=500&fit=crop",
  },
  {
    id: "minimalist",
    name: "Minimalist",
    description: "Clean and focused on content.",
    image: "https://images.unsplash.com/photo-1586281573921-ba531ce47b00?w=400&h=500&fit=crop",
  },
]

export default function CreateCVPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [cv, setCV] = useState<CVData>({
    template: "modernist",
    personalInfo: {
      fullName: "",
      email: "",
      phone: "",
      location: "",
    },
    summary: "",
    experience: [],
    education: [],
    skills: [],
  })
  const [loading, setLoading] = useState(true)
  const [expandedSection, setExpandedSection] = useState<string | null>("personal")

  useEffect(() => {
    const userData = localStorage.getItem("cvmaster_user")
    if (!userData) {
      router.push("/login")
      return
    }
    setUser(JSON.parse(userData))

    const cvData = localStorage.getItem("cvmaster_cv")
    if (cvData) {
      setCV(JSON.parse(cvData))
    }
    setLoading(false)
  }, [router])

  const handleSaveCV = () => {
    localStorage.setItem("cvmaster_cv", JSON.stringify(cv))
    alert("CV saved successfully!")
  }

  const addExperience = () => {
    setCV(prev => ({
      ...prev,
      experience: [
        ...prev.experience,
        {
          id: Date.now().toString(),
          company: "",
          position: "",
          startDate: "",
          endDate: "",
          description: "",
        },
      ],
    }))
  }

  const removeExperience = (id: string) => {
    setCV(prev => ({
      ...prev,
      experience: prev.experience.filter((exp) => exp.id !== id),
    }))
  }

  const addEducation = () => {
    setCV(prev => ({
      ...prev,
      education: [
        ...prev.education,
        {
          id: Date.now().toString(),
          school: "",
          degree: "",
          field: "",
          graduationDate: "",
        },
      ],
    }))
  }

  const removeEducation = (id: string) => {
    setCV(prev => ({
      ...prev,
      education: prev.education.filter((edu) => edu.id !== id),
    }))
  }

  const updateExperience = (id: string, field: string, value: string) => {
    setCV(prev => ({
      ...prev,
      experience: prev.experience.map((exp) => 
        exp.id === id ? { ...exp, [field]: value } : exp
      ),
    }))
  }

  const updateEducation = (id: string, field: string, value: string) => {
    setCV(prev => ({
      ...prev,
      education: prev.education.map((edu) => 
        edu.id === id ? { ...edu, [field]: value } : edu
      ),
    }))
  }

  const updatePersonalInfo = (field: string, value: string) => {
    setCV(prev => ({
      ...prev,
      personalInfo: {
        ...prev.personalInfo,
        [field]: value,
      },
    }))
  }

  const toggleSection = (section: string) => {
    setExpandedSection(prev => prev === section ? null : section)
  }

  const isSectionOpen = (section: string) => {
    return expandedSection === section
  }

  if (loading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-foreground">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <DashboardNav user={user} />

      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-accent/20 flex items-center justify-center">
              <span className="text-accent text-xl">📄</span>
            </div>
            <h1 className="text-2xl font-bold text-foreground">CV Builder</h1>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" className="gap-2 bg-transparent border-border">
              <Sparkles className="w-4 h-4" />
              AI CV Review
            </Button>
            <Button variant="outline" className="gap-2 bg-transparent border-border">
              <Download className="w-4 h-4" />
              Download as PDF
            </Button>
            <Button onClick={handleSaveCV} className="gap-2 bg-accent hover:bg-accent/90 text-accent-foreground">
              <Save className="w-4 h-4" />
              Save
            </Button>
          </div>
        </div>
      </header>

      <main className="grid grid-cols-1 lg:grid-cols-2 min-h-[calc(100vh-80px)]">
        {/* Left Panel - Form */}
        <div className="bg-card border-r border-border overflow-y-auto">
          <div className="max-w-2xl mx-auto p-6 space-y-6">
            <div>
              <h2 className="text-3xl font-bold text-foreground mb-2">Craft Your Professional Story</h2>
              <p className="text-muted-foreground">Choose a template and start building your standout CV.</p>
            </div>

            {/* Template Carousel */}
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-4">Choose a Template</h3>
              <div className="flex overflow-x-auto gap-4 pb-4 [-ms-scrollbar-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {templates.map((template) => (
                  <button
                    key={template.id}
                    onClick={() => setCV(prev => ({ ...prev, template: template.id as any }))}
                    className={`flex-shrink-0 w-60 rounded-lg border-2 transition-all ${
                      cv.template === template.id
                        ? "border-accent ring-2 ring-accent/20"
                        : "border-border hover:border-accent/50"
                    }`}
                  >
                    <div
                      className="w-full aspect-[4/5] bg-cover rounded-md mb-3"
                      style={{ backgroundImage: `url(${template.image})` }}
                    />
                    <div className="px-3 pb-3">
                      <p className="font-medium text-foreground">{template.name}</p>
                      <p className="text-sm text-muted-foreground">{template.description}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Accordion Sections */}
            <div className="space-y-3">
              {/* Personal Details */}
              <div className="border border-border rounded-lg bg-muted/50 overflow-hidden">
                <button
                  onClick={() => toggleSection("personal")}
                  className="flex w-full cursor-pointer items-center justify-between gap-4 p-4 hover:bg-muted/70 transition"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-muted-foreground">⋮⋮</span>
                    <p className="font-medium text-foreground">Personal Details</p>
                  </div>
                  <span className={`text-muted-foreground transition-transform ${isSectionOpen("personal") ? "rotate-180" : ""}`}>
                    ▼
                  </span>
                </button>
                {isSectionOpen("personal") && (
                  <div className="px-4 pb-4 space-y-4 border-t border-border pt-4">
                    <input
                      type="text"
                      placeholder="Full Name"
                      value={cv.personalInfo.fullName}
                      onChange={(e) => updatePersonalInfo("fullName", e.target.value)}
                      className="w-full px-3 py-2 rounded-md bg-background border border-border text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent"
                    />
                    <input
                      type="email"
                      placeholder="Email Address"
                      value={cv.personalInfo.email}
                      onChange={(e) => updatePersonalInfo("email", e.target.value)}
                      className="w-full px-3 py-2 rounded-md bg-background border border-border text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent"
                    />
                    <input
                      type="tel"
                      placeholder="Phone Number"
                      value={cv.personalInfo.phone}
                      onChange={(e) => updatePersonalInfo("phone", e.target.value)}
                      className="w-full px-3 py-2 rounded-md bg-background border border-border text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent"
                    />
                    <input
                      type="text"
                      placeholder="Location"
                      value={cv.personalInfo.location}
                      onChange={(e) => updatePersonalInfo("location", e.target.value)}
                      className="w-full px-3 py-2 rounded-md bg-background border border-border text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent"
                    />
                  </div>
                )}
              </div>

              {/* Professional Summary */}
              <div className="border border-border rounded-lg bg-muted/50 overflow-hidden">
                <button
                  onClick={() => toggleSection("summary")}
                  className="flex w-full cursor-pointer items-center justify-between gap-4 p-4 hover:bg-muted/70 transition"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-muted-foreground">⋮⋮</span>
                    <p className="font-medium text-foreground">Professional Summary</p>
                  </div>
                  <span className={`text-muted-foreground transition-transform ${isSectionOpen("summary") ? "rotate-180" : ""}`}>
                    ▼
                  </span>
                </button>
                {isSectionOpen("summary") && (
                  <div className="px-4 pb-4 border-t border-border pt-4">
                    <textarea
                      placeholder="Describe your professional background..."
                      value={cv.summary}
                      onChange={(e) => setCV(prev => ({ ...prev, summary: e.target.value }))}
                      className="w-full px-3 py-2 rounded-md bg-background border border-border text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent h-24 resize-none"
                    />
                  </div>
                )}
              </div>

              {/* Work Experience */}
              <div className="border border-border rounded-lg bg-muted/50 overflow-hidden">
                <button
                  onClick={() => toggleSection("experience")}
                  className="flex w-full cursor-pointer items-center justify-between gap-4 p-4 hover:bg-muted/70 transition"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-muted-foreground">⋮⋮</span>
                    <p className="font-medium text-foreground">Work Experience</p>
                  </div>
                  <span className={`text-muted-foreground transition-transform ${isSectionOpen("experience") ? "rotate-180" : ""}`}>
                    ▼
                  </span>
                </button>
                {isSectionOpen("experience") && (
                  <div className="px-4 pb-4 space-y-4 border-t border-border pt-4">
                    {cv.experience.map((exp) => (
                      <div key={exp.id} className="space-y-3 p-3 bg-background rounded-lg border border-border">
                        <input
                          type="text"
                          placeholder="Company"
                          value={exp.company}
                          onChange={(e) => updateExperience(exp.id, "company", e.target.value)}
                          className="w-full px-3 py-2 rounded-md bg-card border border-border text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent text-sm"
                        />
                        <input
                          type="text"
                          placeholder="Position"
                          value={exp.position}
                          onChange={(e) => updateExperience(exp.id, "position", e.target.value)}
                          className="w-full px-3 py-2 rounded-md bg-card border border-border text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent text-sm"
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="date"
                            value={exp.startDate}
                            onChange={(e) => updateExperience(exp.id, "startDate", e.target.value)}
                            className="px-3 py-2 rounded-md bg-card border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-accent text-sm"
                          />
                          <input
                            type="date"
                            value={exp.endDate}
                            onChange={(e) => updateExperience(exp.id, "endDate", e.target.value)}
                            className="px-3 py-2 rounded-md bg-card border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-accent text-sm"
                          />
                        </div>
                        <textarea
                          placeholder="Job description..."
                          value={exp.description}
                          onChange={(e) => updateExperience(exp.id, "description", e.target.value)}
                          className="w-full px-3 py-2 rounded-md bg-card border border-border text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent text-sm h-16 resize-none"
                        />
                        <button
                          onClick={() => removeExperience(exp.id)}
                          className="text-sm text-destructive hover:text-destructive/80 font-medium"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                    <Button onClick={addExperience} variant="outline" className="w-full gap-2 bg-transparent border-border">
                      <span>+</span> Add Experience
                    </Button>
                  </div>
                )}
              </div>

              {/* Education */}
              <div className="border border-border rounded-lg bg-muted/50 overflow-hidden">
                <button
                  onClick={() => toggleSection("education")}
                  className="flex w-full cursor-pointer items-center justify-between gap-4 p-4 hover:bg-muted/70 transition"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-muted-foreground">⋮⋮</span>
                    <p className="font-medium text-foreground">Education</p>
                  </div>
                  <span className={`text-muted-foreground transition-transform ${isSectionOpen("education") ? "rotate-180" : ""}`}>
                    ▼
                  </span>
                </button>
                {isSectionOpen("education") && (
                  <div className="px-4 pb-4 space-y-4 border-t border-border pt-4">
                    {cv.education.map((edu) => (
                      <div key={edu.id} className="space-y-3 p-3 bg-background rounded-lg border border-border">
                        <input
                          type="text"
                          placeholder="Degree"
                          value={edu.degree}
                          onChange={(e) => updateEducation(edu.id, "degree", e.target.value)}
                          className="w-full px-3 py-2 rounded-md bg-card border border-border text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent text-sm"
                        />
                        <input
                          type="text"
                          placeholder="Institution"
                          value={edu.school}
                          onChange={(e) => updateEducation(edu.id, "school", e.target.value)}
                          className="w-full px-3 py-2 rounded-md bg-card border border-border text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent text-sm"
                        />
                        <input
                          type="text"
                          placeholder="Field of Study"
                          value={edu.field}
                          onChange={(e) => updateEducation(edu.id, "field", e.target.value)}
                          className="w-full px-3 py-2 rounded-md bg-card border border-border text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent text-sm"
                        />
                        <input
                          type="date"
                          value={edu.graduationDate}
                          onChange={(e) => updateEducation(edu.id, "graduationDate", e.target.value)}
                          className="w-full px-3 py-2 rounded-md bg-card border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-accent text-sm"
                        />
                        <button
                          onClick={() => removeEducation(edu.id)}
                          className="text-sm text-destructive hover:text-destructive/80 font-medium"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                    <Button onClick={addEducation} variant="outline" className="w-full gap-2 bg-transparent border-border">
                      <span>+</span> Add Education
                    </Button>
                  </div>
                )}
              </div>

              {/* Skills */}
              <div className="border border-border rounded-lg bg-muted/50 overflow-hidden">
                <button
                  onClick={() => toggleSection("skills")}
                  className="flex w-full cursor-pointer items-center justify-between gap-4 p-4 hover:bg-muted/70 transition"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-muted-foreground">⋮⋮</span>
                    <p className="font-medium text-foreground">Skills</p>
                  </div>
                  <span className={`text-muted-foreground transition-transform ${isSectionOpen("skills") ? "rotate-180" : ""}`}>
                    ▼
                  </span>
                </button>
                {isSectionOpen("skills") && (
                  <div className="px-4 pb-4 border-t border-border pt-4">
                    <textarea
                      placeholder="e.g., Python, Teamwork, Project Management"
                      value={cv.skills.join(", ")}
                      onChange={(e) =>
                        setCV(prev => ({
                          ...prev,
                          skills: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                        }))
                      }
                      className="w-full px-3 py-2 rounded-md bg-background border border-border text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent h-20 resize-none"
                    />
                  </div>
                )}
              </div>
            </div>

            <Button variant="outline" className="w-full gap-2 bg-transparent border-border">
              <span>+</span> Add New Section
            </Button>
          </div>
        </div>

        {/* Right Panel - Preview */}
        <div className="hidden lg:flex bg-background p-10 items-center justify-center overflow-y-auto">
          <div className="w-full max-w-2xl aspect-[1/1.414] bg-card shadow-2xl rounded-lg overflow-hidden border border-border">
            <div className="p-8 md:p-12 h-full text-foreground space-y-6">
              {/* Header */}
              <div className="flex justify-between items-start border-b border-border pb-6">
                <div>
                  <h1 className="text-4xl font-bold text-foreground">
                    {cv.personalInfo.fullName || "Your Name"}
                  </h1>
                  <p className="text-accent text-lg font-medium">Professional Title</p>
                </div>
                <div className="text-right text-sm text-muted-foreground">
                  {cv.personalInfo.email && <p>{cv.personalInfo.email}</p>}
                  {cv.personalInfo.phone && <p>{cv.personalInfo.phone}</p>}
                  {cv.personalInfo.location && <p>{cv.personalInfo.location}</p>}
                </div>
              </div>

              {/* Summary */}
              {cv.summary && (
                <div>
                  <h2 className="text-xl font-bold text-accent mb-2">Professional Summary</h2>
                  <p className="text-sm text-muted-foreground leading-relaxed">{cv.summary}</p>
                </div>
              )}

              {/* Experience */}
              {cv.experience.length > 0 && (
                <div>
                  <h2 className="text-xl font-bold text-accent mb-3">Work Experience</h2>
                  <div className="space-y-4">
                    {cv.experience.map((exp) => (
                      <div key={exp.id}>
                        <div className="flex justify-between items-start">
                          <h3 className="font-semibold text-foreground text-lg">
                            {exp.position || "Position"}
                          </h3>
                          <p className="text-sm text-muted-foreground whitespace-nowrap">
                            {exp.startDate} - {exp.endDate}
                          </p>
                        </div>
                        <p className="text-sm text-accent font-medium mb-1">
                          {exp.company || "Company"}
                        </p>
                        {exp.description && (
                          <p className="text-sm text-muted-foreground leading-relaxed">
                            {exp.description}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Education */}
              {cv.education.length > 0 && (
                <div>
                  <h2 className="text-xl font-bold text-accent mb-3">Education</h2>
                  <div className="space-y-3">
                    {cv.education.map((edu) => (
                      <div key={edu.id}>
                        <div className="flex justify-between items-start">
                          <h3 className="font-semibold text-foreground">
                            {edu.degree || "Degree"}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {edu.graduationDate}
                          </p>
                        </div>
                        <p className="text-sm text-accent font-medium">
                          {edu.school || "Institution"}
                        </p>
                        {edu.field && (
                          <p className="text-sm text-muted-foreground">
                            {edu.field}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Skills */}
              {cv.skills.length > 0 && (
                <div>
                  <h2 className="text-xl font-bold text-accent mb-2">Skills</h2>
                  <div className="flex flex-wrap gap-2">
                    {cv.skills.map((skill, idx) => (
                      <span 
                        key={idx} 
                        className="text-sm bg-accent/20 text-accent px-3 py-1 rounded-full"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
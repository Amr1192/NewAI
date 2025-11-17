interface User {
  id: string
  name: string
  email: string
  createdAt: string
}

export default function DashboardHeader({ user }: { user: User }) {
  return (
    <div className="bg-gradient-to-r from-primary to-primary/80 text-white py-12">
      <div className="max-w-7xl mx-auto px-4">
        <h1 className="text-4xl font-bold mb-2">Welcome back, {user.name}!</h1>
        <p className="text-primary-foreground/80">Let's build and enhance your career today</p>
      </div>
    </div>
  )
}

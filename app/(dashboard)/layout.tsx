import { Sidebar } from "@/components/sidebar"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen">
      <Sidebar />
      <main className="lg:pl-60">
        <div className="p-6 lg:p-8">{children}</div>
      </main>
    </div>
  )
}

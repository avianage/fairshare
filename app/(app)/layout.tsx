import { redirect } from "next/navigation"
import Link from "next/link"
import { auth, signOut } from "@/lib/auth"

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()

  if (!session) {
    redirect("/login")
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="flex w-60 flex-col border-r bg-white">
        <div className="flex h-14 items-center border-b px-5">
          <span className="text-lg font-semibold text-blue-600">Fairshare</span>
        </div>
        <nav className="flex-1 space-y-0.5 p-3 text-sm">
          <Link
            href="/dashboard"
            className="flex items-center rounded-md px-3 py-2 text-gray-700 hover:bg-gray-100"
          >
            Dashboard
          </Link>
          <Link
            href="/groups"
            className="flex items-center rounded-md px-3 py-2 text-gray-700 hover:bg-gray-100"
          >
            Groups
          </Link>
          <Link
            href="/profile"
            className="flex items-center rounded-md px-3 py-2 text-gray-700 hover:bg-gray-100"
          >
            Profile
          </Link>
        </nav>
      </aside>

      {/* Main column */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top nav */}
        <header className="flex h-14 items-center justify-end gap-4 border-b bg-white px-6">
          <span className="text-sm text-gray-600">{session.user.name}</span>
          <form
            action={async () => {
              "use server"
              await signOut({ redirectTo: "/login" })
            }}
          >
            <button
              type="submit"
              className="text-sm text-gray-500 hover:text-gray-800"
            >
              Sign out
            </button>
          </form>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  )
}

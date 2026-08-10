import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, passwordMatches, sessionToken } from "@/lib/auth";

async function login(formData: FormData) {
  "use server";

  if (!passwordMatches(String(formData.get("password") ?? ""))) {
    redirect("/login?error=1");
  }

  const store = await cookies();
  store.set(SESSION_COOKIE, sessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  redirect("/");
}

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { error } = await searchParams;

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <form action={login} className="w-full max-w-xs space-y-4">
        <div className="space-y-1">
          <h1 className="text-lg font-semibold tracking-tight">Offroad Deals</h1>
          <p className="text-sm text-neutral-500">Private. Enter password.</p>
        </div>
        <input
          type="password"
          name="password"
          autoFocus
          required
          className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm outline-none focus:border-neutral-400"
        />
        {error ? (
          <p className="text-sm text-red-400">Wrong password.</p>
        ) : null}
        <button
          type="submit"
          className="w-full rounded-md bg-neutral-100 px-3 py-2 text-sm font-medium text-neutral-900 hover:bg-white"
        >
          Enter
        </button>
      </form>
    </main>
  );
}

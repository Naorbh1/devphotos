import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import LoginForm from "@/components/LoginForm";

export const metadata = { title: "כניסה" };

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/search");

  return (
    <div className="mx-auto max-w-md py-4">
      <h1 className="text-2xl font-extrabold">כניסה לחשבון</h1>
      <p className="mt-1 text-sm text-ink-600">
        אין לכם חשבון עדיין?{" "}
        <Link href="/register" className="font-semibold text-brand-600 hover:underline">
          הרשמה חינם
        </Link>
      </p>
      <div className="card mt-4 p-5">
        <LoginForm />
      </div>
    </div>
  );
}

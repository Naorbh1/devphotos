import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import RegisterForm from "@/components/RegisterForm";

export const metadata = { title: "הרשמה" };

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ city?: string; goal?: string }>;
}) {
  if (await getCurrentUser()) redirect("/search");
  const params = await searchParams;

  return (
    <div className="mx-auto max-w-md py-4">
      <h1 className="text-2xl font-extrabold">יוצרים חשבון</h1>
      <p className="mt-1 text-sm text-ink-600">
        כבר רשומים?{" "}
        <Link href="/login" className="font-semibold text-brand-600 hover:underline">
          כניסה לחשבון
        </Link>
      </p>
      <div className="card mt-4 p-5">
        <RegisterForm defaultCity={params.city} defaultGoal={params.goal} />
      </div>
    </div>
  );
}

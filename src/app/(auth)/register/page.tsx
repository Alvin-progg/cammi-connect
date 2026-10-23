import type { Metadata } from "next";
import Link from "next/link";

import { AuthCard } from "@/components/auth/auth-card";
import { RegisterForm } from "@/components/auth/register-form";

export const instant = false;

export const metadata: Metadata = { title: "Create your account" };

type RegisterSearchParams = {
  next?: string | string[];
};

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<RegisterSearchParams>;
}) {
  const { next } = await searchParams;

  return (
    <main className="flex flex-1 bg-grid">
      <div className="page-container flex flex-1 flex-col items-center justify-center py-12 lg:py-24">
        <Link
          href="/"
          className="mb-6 w-full max-w-md rounded-sm text-sm font-semibold tracking-tight text-ink focus-ring"
        >
          CamiConnect
        </Link>
        <AuthCard
          title="Create your account"
          subtitle="Patient accounts can be created here. Doctor and admin accounts are provisioned by hospital administrators."
        >
          <RegisterForm next={typeof next === "string" ? next : undefined} />
        </AuthCard>
      </div>
    </main>
  );
}

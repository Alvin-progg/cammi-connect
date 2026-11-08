import type { Metadata } from "next";

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
    <main id="main" className="flex flex-1 flex-col">
      <AuthCard
        eyebrow="New patient"
        title="Create your account"
        subtitle="Use your own details so the hospital can reach you about appointments."
        note="Doctor and staff accounts are provided by the hospital and cannot be created here."
      >
        <RegisterForm next={typeof next === "string" ? next : undefined} />
      </AuthCard>
    </main>
  );
}

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
    <main id="main" className="flex flex-1 flex-col bg-canvas">
      <div className="page-container flex flex-1 flex-col items-center justify-center py-12 lg:py-20">
        <AuthCard
          title="Create your account"
          subtitle="Register as a patient to book and follow your appointments."
          note="Doctor and administrator accounts are provided by the hospital and cannot be created here."
        >
          <RegisterForm next={typeof next === "string" ? next : undefined} />
        </AuthCard>
      </div>
    </main>
  );
}

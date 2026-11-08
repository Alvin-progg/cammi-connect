import clsx from "clsx";
import type { Metadata } from "next";
import Link from "next/link";

import { AdminShell } from "@/components/admin/admin-shell";
import { TaskCard } from "@/components/admin/form-parts";
import { AccessDenied } from "@/components/auth/access-denied";
import { PolicyToKnowledgeBase, SettingsForm } from "@/components/settings/settings-form";
import {
  SETTING_GROUPS,
  SETTING_GROUP_LABELS,
  parseSettingsTab,
  type SettingGroup,
} from "@/lib/settings/schema";
import { getAdminSession } from "@/server/auth/dal";
import { supabaseSettingsRepository } from "@/server/settings/repository";
import { getSettings } from "@/server/settings/service";

import { ADMIN_ACCESS_DENIED_MESSAGE } from "../_shared/placeholder-page";

export const instant = false;

export const metadata: Metadata = { title: "Settings" };

const TAB_DESCRIPTIONS: Record<SettingGroup, string> = {
  appointment: "Booking limits and the policies patients are told about.",
  hospital: "Contact details and opening hours.",
  chatbot: "What patients see in the Cami chat and what Cami answers from.",
};

export default async function AdminSettingsPage({ searchParams }: PageProps<"/admin/settings">) {
  const params = await searchParams;
  const session = await getAdminSession("/admin/settings");
  if (!session) {
    return <AccessDenied message={ADMIN_ACCESS_DENIED_MESSAGE} />;
  }

  const tab = parseSettingsTab(params.tab);
  const settings = await getSettings(supabaseSettingsRepository);

  return (
    <AdminShell adminName={session.admin.fullName} active="settings" crumbs={[{ label: "Settings" }]}>
      <div className="flex flex-col gap-6">
        <nav aria-label="Settings sections" className="border-b border-line">
          <ul className="-mb-px flex gap-1 overflow-x-auto">
            {SETTING_GROUPS.map((group) => {
              const current = group === tab;
              return (
                <li key={group}>
                  <Link
                    href={group === "appointment" ? "/admin/settings" : `/admin/settings?tab=${group}`}
                    aria-current={current ? "page" : undefined}
                    className={clsx(
                      "inline-flex min-h-11 items-center border-b-2 px-4 text-sm font-medium focus-ring",
                      current
                        ? "border-primary text-ink"
                        : "border-transparent text-ink-secondary hover:text-ink",
                    )}
                  >
                    {SETTING_GROUP_LABELS[group]}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <TaskCard title={`${SETTING_GROUP_LABELS[tab]} settings`} description={TAB_DESCRIPTIONS[tab]}>
          {/* A new key per tab gives each tab a fresh form and action state. */}
          <SettingsForm key={tab} group={tab} settings={settings} />
        </TaskCard>

        {tab === "appointment" ? (
          <TaskCard
            title="Policies in the knowledge base"
            description="Creates a draft knowledge document from a saved policy. Review and publish it from the knowledge base so Cami can answer from it."
          >
            <PolicyToKnowledgeBase settings={settings} />
          </TaskCard>
        ) : null}
      </div>
    </AdminShell>
  );
}

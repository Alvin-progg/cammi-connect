"use client";

import { useState } from "react";

import { Input, Select } from "@/components/ui/field";

type Choice = "no" | "yes";

/**
 * The optional PWD and HMO sections of the register form. Field names are
 * read on the server (readRegistrationBenefits); a "No" answer sends nothing.
 */
export function RegistrationBenefitsFields({ providers }: { providers: { id: string; name: string }[] }) {
  const [pwdChoice, setPwdChoice] = useState<Choice>("no");
  const [hmoChoice, setHmoChoice] = useState<Choice>("no");

  return (
    <fieldset className="flex flex-col gap-4 rounded-lg border border-line p-4">
      <legend className="px-1 text-sm font-medium text-ink">Benefits (optional)</legend>
      <p className="text-xs text-ink-muted">
        You can skip this and add it later from your account. Benefits apply only after the front desk verifies them.
      </p>

      <ChoiceGroup
        name="pwdChoice"
        label="Are you a Person with Disability (PWD)?"
        value={pwdChoice}
        onChange={setPwdChoice}
      />
      {pwdChoice === "yes" ? (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="pwd-id-number-register" className="text-sm font-medium text-ink">PWD ID number</label>
            <Input id="pwd-id-number-register" name="pwdIdNumber" maxLength={50} autoComplete="off" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="pwd-id-image-register" className="text-sm font-medium text-ink">Photo of your PWD ID</label>
            <Input id="pwd-id-image-register" name="pwdImage" type="file" accept="image/jpeg,image/png,image/webp" />
          </div>
        </div>
      ) : null}

      <ChoiceGroup
        name="hmoChoice"
        label="Do you have an HMO membership?"
        value={hmoChoice}
        onChange={setHmoChoice}
      />
      {hmoChoice === "yes" ? (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="hmo-provider-register" className="text-sm font-medium text-ink">HMO provider</label>
            <Select id="hmo-provider-register" name="hmoProviderId" defaultValue="">
              <option value="" disabled>Choose a provider</option>
              {providers.map((provider) => (
                <option key={provider.id} value={provider.id}>{provider.name}</option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="hmo-membership-register" className="text-sm font-medium text-ink">Membership number</label>
            <Input id="hmo-membership-register" name="hmoMembershipNumber" maxLength={50} autoComplete="off" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="hmo-card-register" className="text-sm font-medium text-ink">HMO card photo (optional)</label>
            <Input id="hmo-card-register" name="hmoCard" type="file" accept="image/jpeg,image/png,image/webp" />
          </div>
        </div>
      ) : null}
    </fieldset>
  );
}

function ChoiceGroup({
  name,
  label,
  value,
  onChange,
}: {
  name: string;
  label: string;
  value: Choice;
  onChange: (choice: Choice) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-col gap-2">
      <span className="text-sm font-medium text-ink">{label}</span>
      <div className="flex gap-4 text-sm">
        {(["no", "yes"] as const).map((choice) => (
          <label key={choice} className="flex items-center gap-2">
            <input
              type="radio"
              name={name}
              value={choice}
              checked={value === choice}
              onChange={() => onChange(choice)}
            />
            {choice === "yes" ? "Yes" : "No"}
          </label>
        ))}
      </div>
    </div>
  );
}

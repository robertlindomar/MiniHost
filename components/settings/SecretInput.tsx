"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { MASKED_SECRET_VALUE } from "@/lib/settings";
import { settingsFieldClass } from "@/components/settings/FormField";

interface SecretInputProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  hasStoredValue?: boolean;
  placeholder?: string;
  helperMessage?: string;
}

export function SecretInput({
  id,
  value,
  onChange,
  disabled = false,
  hasStoredValue = false,
  placeholder = "Informe o token da Cloudflare"
}: SecretInputProps) {
  const [isVisible, setIsVisible] = useState(false);
  const displayPlaceholder = hasStoredValue && !value ? MASKED_SECRET_VALUE : placeholder;

  return (
    <div className="relative">
      <input
        id={id}
        type={isVisible ? "text" : "password"}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        placeholder={displayPlaceholder}
        autoComplete="off"
        className={`${settingsFieldClass} pr-10`}
      />
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsVisible((current) => !current)}
        aria-label={isVisible ? "Ocultar valor" : "Mostrar valor digitado"}
        className="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

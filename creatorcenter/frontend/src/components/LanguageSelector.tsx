import { LANGUAGES } from "../types";

interface Props {
  value: string;
  onChange: (code: string) => void;
  disabled?: boolean;
  className?: string;
}

export default function LanguageSelector({ value, onChange, disabled, className }: Props) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className={`border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:opacity-50 ${className || ""}`}
    >
      <option value="">Select language...</option>
      {LANGUAGES.map((l) => (
        <option key={l.code} value={l.code}>
          {l.name} ({l.code})
        </option>
      ))}
    </select>
  );
}

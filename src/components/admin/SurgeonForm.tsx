import { useCallback, useState } from "react";
import { motion } from "framer-motion";
import { Stethoscope } from "lucide-react";
import { SurgeonInfoForm, type SurgeonDraft } from "./SurgeonInfoForm";
import { cn } from "@/lib/utils";

interface Props {
  onCancel: () => void;
  onSave: (draft: SurgeonDraft) => void;
}

export function SurgeonForm({ onCancel, onSave }: Props) {
  const [draft, setDraft] = useState<SurgeonDraft>({
    firstName: "",
    lastName: "",
    email: "",
    loginEnabled: false,
  });
  const [valid, setValid] = useState(false);

  const handleChange = useCallback((next: SurgeonDraft, isValid: boolean) => {
    setDraft(next);
    setValid(isValid);
  }, []);

  const titleName =
    [draft.firstName, draft.lastName]
      .filter((s) => s.trim().length > 0)
      .join(" ")
      .trim() || "New surgeon";

  return (
    <motion.div
      key="surgeon-form"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
      className="w-full px-10 py-10"
    >
      <header className="mb-8 flex items-start justify-between gap-6">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-border/60 bg-surface-2/60 text-primary">
            <Stethoscope className="h-5 w-5" strokeWidth={1.7} />
          </div>
          <h1 className="text-2xl font-light tracking-tight text-foreground">
            {titleName} <span className="text-muted-foreground">- Settings</span>
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-border/60 bg-surface-2/60 px-5 py-2 text-sm font-light text-foreground transition-colors hover:bg-surface-2"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => valid && onSave(draft)}
            disabled={!valid}
            className={cn(
              "rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition-all",
              valid
                ? "hover:bg-primary/90 hover:shadow-[0_0_18px_-4px_var(--primary)]"
                : "cursor-not-allowed opacity-40",
            )}
          >
            Save
          </button>
        </div>
      </header>

      <div className="border-b border-border/60">
        <div className="inline-block border-b-2 border-primary px-1 pb-3 text-sm font-medium text-primary">
          Info
        </div>
      </div>

      <div className="pt-8">
        <SurgeonInfoForm surgeon={null} onChange={handleChange} />
      </div>
    </motion.div>
  );
}

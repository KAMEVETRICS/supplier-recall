import type { CitedDraft, Comparison, DraftInput } from '@/domain/types';
export function validateDraft(draft: CitedDraft, comparison: Comparison) {
  const evidence = new Set(
    comparison.candidates.flatMap((c) => c.reasons.flatMap((r) => r.evidenceIds)),
  );
  return (
    draft.evidenceIds.every((id) => evidence.has(id)) &&
    draft.memoryIds.every((id) => comparison.recalledMemoryIds.includes(id))
  );
}
export function templateDraft(input: DraftInput): CitedDraft {
  return {
    text: `Hi ${input.supplierName},\n\nWe're reviewing your packaging quote. Could you confirm ${input.comparison.questions.length ? input.comparison.questions.map((q) => q.replace(/^(Confirm |Attach |Review and confirm )/, '').replace(/\.$/, '')).join('; ') : 'the production slot, transit time, and final delivered cost'}?\n\nPlease also let us know if any terms have changed. We'll confirm our decision after reviewing the details.\n\nThank you.`,
    evidenceIds: [...new Set(input.comparison.reasons.flatMap((r) => r.evidenceIds))],
    memoryIds: [...new Set(input.comparison.reasons.flatMap((r) => r.memoryIds))],
  };
}

import { z } from "@blobscan/zod";

export const handleReorgedSlotInputSchema = z.object({
  newHeadSlot: z.coerce.number(),
});

export const handleReorgedSlotOutputSchema = z.void();

export type handleReorgedSlotInput = z.infer<
  typeof handleReorgedSlotInputSchema
>;

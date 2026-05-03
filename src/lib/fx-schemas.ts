// This file was written by GPT 5.5, under human supervision.

import * as z from "zod";

const currencyCode = z
  .string()
  .regex(/^[A-Z]{3}$/, "Must be a three-letter currency code");
const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Must use YYYY-MM-DD format");
const decimalString = z
  .string()
  .regex(/^\d+(?:\.\d+)?$/, "Must be a decimal string");
const isoDateTimeString = z.string().datetime();

export const FxPairResourceSchema = z
  .object({
    object: z.literal("fx_pair"),
    id: z.string(),
    from: currencyCode,
    to: currencyCode,
    last_observation_date: dateString,
  })
  .meta({ title: "FX Pair" });

export const FxRateResourceSchema = z
  .object({
    object: z.literal("fx_rate"),
    id: z.string(),
    from: currencyCode,
    to: currencyCode,
    date: dateString,
    rate: decimalString,
    rate_scale: z.literal("quote_per_base"),
    generated_at: isoDateTimeString,
  })
  .meta({ title: "FX Rate" });

export const ErrorResponseSchema = z
  .object({
    error: z.object({
      type: z.enum(["invalid_request_error", "api_error"]),
      code: z.enum([
        "bad_request",
        "unsupported_pair",
        "not_found",
        "internal_server_error",
      ]),
      message: z.string(),
    }),
  })
  .meta({ title: "Error Response" });

export const ListResponseSchema = z
  .object({
    object: z.literal("list"),
    url: z.string(),
    has_more: z.boolean(),
    data: z.array(z.unknown()),
  })
  .meta({ title: "List Response" });

export const FxPairListResponseSchema = ListResponseSchema.extend({
  data: z.array(FxPairResourceSchema),
}).meta({ title: "FX Pair List Response" });

export const FxRateListResponseSchema = ListResponseSchema.extend({
  data: z.array(FxRateResourceSchema),
}).meta({ title: "FX Rate List Response" });

export type FxPairResource = z.infer<typeof FxPairResourceSchema>;
export type FxRateResource = z.infer<typeof FxRateResourceSchema>;
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
export type ListResponse<Data> = {
  object: "list";
  url: string;
  has_more: false;
  data: Data[];
};

const JSON_SCHEMA_BY_OBJECT = {
  error: ErrorResponseSchema,
  fx_pair: FxPairResourceSchema,
  fx_pair_list: FxPairListResponseSchema,
  fx_rate: FxRateResourceSchema,
  fx_rate_list: FxRateListResponseSchema,
  list: ListResponseSchema,
} as const;

export type JsonSchemaObjectName = keyof typeof JSON_SCHEMA_BY_OBJECT;

export const JSON_SCHEMA_OBJECT_NAMES = Object.keys(
  JSON_SCHEMA_BY_OBJECT,
) as JsonSchemaObjectName[];

export type JsonSchema = Record<string, unknown>;

export function getJsonSchemaForObject(
  objectName: string,
): JsonSchema | undefined {
  const schema = JSON_SCHEMA_BY_OBJECT[objectName as JsonSchemaObjectName];
  if (!schema) {
    return undefined;
  }

  return z.toJSONSchema(schema, {
    target: "draft-7",
  }) as JsonSchema;
}

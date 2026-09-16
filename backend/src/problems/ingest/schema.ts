import { z } from "zod";
import { STRUCTURE_TYPES, type Problem, type StructureType, type ValueKind } from "@nodeflow/shared";
import { buildStarterCodeByLanguage } from "../starterCode.js";

export const VALUE_KINDS = [
  "int",
  "long",
  "double",
  "bool",
  "string",
  "array",
  "long_array",
  "double_array",
  "bool_array",
  "string_array",
  "matrix",
  "graph",
  "char_matrix",
  "string_matrix",
  "linked_list",
  "doubly_linked_list",
  "cyclic_list",
  "y_list",
  "random_list",
  "child_list",
  "tree",
  "list_node_value",
  "tree_node_value",
  "void"
] as const satisfies readonly ValueKind[];

const valueKindSchema = z.enum(VALUE_KINDS);

const problemParameterSchema = z.object({
  name: z.string().min(1),
  kind: valueKindSchema
});

const designSchema = z.object({
  className: z.string().min(1),
  constructorParameters: z.array(problemParameterSchema),
  methods: z
    .array(
      z.object({
        name: z.string().min(1),
        parameters: z.array(problemParameterSchema),
        returnKind: valueKindSchema
      })
    )
    .min(1)
});

const problemExampleSchema = z.object({
  input: z.record(z.string(), z.unknown()),
  output: z.unknown(),
  explanation: z.string().optional()
});

const problemTestCaseSchema = z.object({
  id: z.string().min(1),
  input: z.record(z.string(), z.unknown()),
  expectedOutput: z.unknown(),
  visible: z.boolean()
});

export const reviewedProblemSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  sourceTitle: z.string().min(1),
  topic: z.string().min(1),
  difficulty: z.enum(["Easy", "Medium", "Hard"]),
  structureType: z.enum(STRUCTURE_TYPES as [StructureType, ...StructureType[]]),
  reviewStatus: z.enum(["reviewed", "verified"]),
  reviewedAt: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  constraints: z.array(z.string().min(1)).min(1),
  examples: z.array(problemExampleSchema).min(1),
  signature: z.object({
    functionName: z.string(),
    parameters: z.array(problemParameterSchema),
    returnKind: valueKindSchema,
    compare: z.enum(["exact", "unordered", "unordered_deep", "float"]).optional(),
    sharedTail: z.string().optional(),
    design: designSchema.optional()
  }),
  starterCode: z.string().min(1),
  referenceCode: z.string().min(1),
  defaultInput: z.record(z.string(), z.unknown()),
  testCases: z.array(problemTestCaseSchema).min(2),
  reviewNotes: z.string().optional()
});

export const reviewedProblemListSchema = z.array(reviewedProblemSchema);

export type ReviewedProblemRecord = z.infer<typeof reviewedProblemSchema>;

export const reviewedProblemToProblem = (record: ReviewedProblemRecord): Problem => ({
  id: record.id,
  title: record.title,
  topic: record.topic,
  difficulty: record.difficulty,
  structureType: record.structureType,
  description: record.description,
  constraints: record.constraints,
  examples: record.examples,
  signature: record.signature,
  starterCode: record.starterCode,
  starterCodeByLanguage: buildStarterCodeByLanguage(record.signature, record.starterCode),
  referenceCode: record.referenceCode,
  defaultInput: record.defaultInput,
  testCases: record.testCases,
  visibleTestCases: record.testCases.filter((testCase) => testCase.visible)
});

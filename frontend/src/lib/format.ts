export const pretty = (value: unknown) => JSON.stringify(value, null, 2);

export const shortJson = (value: unknown) => JSON.stringify(value);

export const titleVerdict = (value: string) => value.replaceAll("_", " ");

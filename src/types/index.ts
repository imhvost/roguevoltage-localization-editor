export type Translation = Record<
  string,
  Record<string, Record<string, string>>
>;

export type Limits = {
  rest: string;
  time: string;
};

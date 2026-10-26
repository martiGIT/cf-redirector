/// <reference types="@cloudflare/vitest-plugin/types" />

// Allow importing the schema as a raw string in test setup.
declare module "*.sql?raw" {
  const content: string;
  export default content;
}

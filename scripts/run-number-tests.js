import { register } from "ts-node";

register({
  transpileOnly: true,
  esm: true,
});

await import("./run-number-tests.ts");

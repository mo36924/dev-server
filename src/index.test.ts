import { get, IncomingMessage } from "http";
import { describe, expect, test } from "@jest/globals";
import devServer from "./index";

describe("dev-server", () => {
  test("server", async () => {
    const server = devServer({
      tsconfig: {
        compilerOptions: {
          incremental: true,
          target: "ES2020",
          module: "ES2020",
          moduleResolution: "Node",
          strict: true,
          esModuleInterop: true,
          skipLibCheck: true,
          forceConsistentCasingInFileNames: true,
          tsBuildInfoFile: "tsconfig.tsbuildinfo",
        },
        include: ["src"],
      },
      babel: {
        presets: [["@mo36924/babel-preset-app"]],
      },
    });

    const res = await new Promise<IncomingMessage>((resolve) =>
      get("http://localhost:8080/src/module.test.ts", resolve),
    );

    let data = "";
    res.setEncoding("utf8");

    for await (const chunk of res) {
      data += chunk;
    }

    await new Promise((resolve) => server.close(resolve));

    expect(data).toMatchInlineSnapshot(`
      "import { expect, test } from \\"../node_modules/@jest/globals/build/index.js\\";
      test(\\"test\\", () => {
        expect(true).toBeTruthy();
      });"
    `);
  });
});

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
      });
      //# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1vZHVsZS50ZXN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLFNBQVMsTUFBVCxFQUFpQixJQUFqQjtBQUVBLElBQUksQ0FBQyxNQUFELEVBQVMsTUFBSztBQUNoQixFQUFBLE1BQU0sQ0FBQyxJQUFELENBQU4sQ0FBYSxVQUFiO0FBQ0QsQ0FGRyxDQUFKIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgZXhwZWN0LCB0ZXN0IH0gZnJvbSBcIkBqZXN0L2dsb2JhbHNcIjtcblxudGVzdChcInRlc3RcIiwgKCkgPT4ge1xuICBleHBlY3QodHJ1ZSkudG9CZVRydXRoeSgpO1xufSk7XG4iXSwic291cmNlUm9vdCI6IiJ9"
    `);
  });
});

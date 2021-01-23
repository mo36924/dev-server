import { createHash } from "crypto";
import { createReadStream, readFileSync, writeFileSync } from "fs";
import { readFile } from "fs/promises";
import { createServer, Server } from "http";
import { tmpdir } from "os";
import { extname, join } from "path";
import process from "process";
import { pipeline as _pipeline } from "stream";
import { promisify } from "util";
import { TransformOptions, transformSync } from "@babel/core";
import ts from "typescript";

const pipeline = promisify(_pipeline);
const cwd = ts.sys.getCurrentDirectory();
const cwdWithSlash = cwd + "/";
const cwdWithSlashLength = cwdWithSlash.length;
const tmp = tmpdir();

export type Options = {
  tsconfig?: { [key: string]: any };
  babel?: TransformOptions;
  port?: number;
};

export default (options: Options = {}): Server => {
  const data = `${ts.sys.readFile("package.json")}${JSON.stringify(options)}`;
  const cacheFile = join(tmp, createHash("md5").update(data).digest("hex"));
  const cache: { [key: string]: string } = Object.create(null);

  try {
    const data = readFileSync(cacheFile, "utf-8");
    Object.assign(cache, JSON.parse(data));
  } catch {}

  const formatDiagnosticsHost = {
    getCurrentDirectory: () => cwd,
    getCanonicalFileName: (fileName: string) => fileName,
    getNewLine: () => ts.sys.newLine,
  };

  const tsconfig = options.tsconfig ? JSON.stringify(options.tsconfig) : ts.sys.readFile("tsconfig.json");
  const babel = options.babel;
  const port = options.port || 8080;

  const transform = (path: string, data: string) => {
    const result = transformSync(data, {
      ...babel,
      sourceMaps: "inline",
      filename: path,
    });

    return result?.code ?? "";
  };

  const host = ts.createWatchCompilerHost(
    "tsconfig.json",
    {
      incremental: true,
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      forceConsistentCasingInFileNames: true,
      declaration: false,
      declarationMap: false,
      noEmit: false,
      noEmitOnError: true,
      outDir: undefined,
      rootDir: undefined,
      sourceMap: false,
      inlineSourceMap: true,
      inlineSources: true,
      importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Error,
      tsBuildInfoFile: "tsconfig.tsbuildinfo",
    },
    {
      ...ts.sys,
      readFile(path, encoding) {
        switch (path) {
          case "tsconfig.json":
            return tsconfig;
          case "tsconfig.tsbuildinfo":
            return cache[path];
        }

        return ts.sys.readFile(path, encoding);
      },
      writeFile(path, data) {
        if (path.startsWith(cwdWithSlash)) {
          path = path.slice(cwdWithSlashLength);
        }

        path = path.replace(/\.js(x)?$/, ".ts$1");

        switch (path) {
          case "tsconfig.tsbuildinfo":
            cache[path] = data;
            return;
        }

        cache[path] = transform(path, data);
      },
    },
    ts.createEmitAndSemanticDiagnosticsBuilderProgram,
    (diagnostic) => {
      ts.sys.write(ts.formatDiagnosticsWithColorAndContext([diagnostic], formatDiagnosticsHost) + ts.sys.newLine);
    },
    (diagnostic, newLine, _options, errorCount) => {
      ts.sys.write(ts.formatDiagnosticsWithColorAndContext([diagnostic], formatDiagnosticsHost) + newLine);

      if (errorCount) {
        process.exitCode = 1;
      }
    },
  );

  const watchProgram = ts.createWatchProgram(host);

  if (process.env.NODE_ENV === "production") {
    watchProgram.close();
  }

  const server = createServer(async (req, res) => {
    const path = new URL(req.url || "/", "http://localhost/").pathname.slice(1);
    let isScript = false;

    switch (extname(path)) {
      case ".js":
      case ".jsx":
      case ".mjs":
      case ".ts":
      case ".tsx":
        isScript = true;
        res.setHeader("Content-Type", "application/javascript;charset=UTF-8");
        break;
      case ".json":
        res.setHeader("Content-Type", "application/json;charset=UTF-8");
        break;
      case ".html":
        res.setHeader("Content-Type", "text/html;charset=UTF-8");
        break;
    }

    if (path in cache) {
      res.end(cache[path]);
      return;
    }

    if (isScript) {
      try {
        const data = await readFile(path, "utf-8");
        const code = transform(path, data);
        cache[path] = code;
        res.end(code);
      } catch {
        res.statusCode = 404;
        res.end();
      }

      return;
    }

    try {
      await pipeline(createReadStream(path), res);
    } catch {
      res.statusCode = 404;
      res.end();
    }
  });

  server.once("close", () => {
    watchProgram.close();
  });

  server.listen(port);

  process.on("SIGINT", () => {
    try {
      writeFileSync(cacheFile, JSON.stringify(cache));
    } catch {}

    setTimeout(() => process.exit());
  });

  return server;
};

// SPDX-FileCopyrightHeader: Copyright © 2025 Lenny McLennington <lenny@sneed.church>. All rights reserved.
// SPDX-FileContributor: Lenny McLennington <lenny@sneed.church>
// SPDX-License-Identifier: AGPL-3.0-only

import fetch from "node-fetch";
import fs from "fs/promises";
import { createHash } from "crypto";

function balancedBracesPattern(n) {
  let pattern = "[^{}]";

  for (let i = 0; i < n; i++) {
    pattern = `\\{(?:[^{}]|${pattern})*\\}`;
  }

  return pattern;
}

const behaviorsModuleRegexp =
  /^\([A-Za-z_][A-Za-z0-9]*,[A-Za-z_][A-Za-z0-9]*,[A-Za-z_][A-Za-z0-9]*\)=>\{const [A-Za-z_][A-Za-z0-9]*=\{\};[A-Za-z_][A-Za-z0-9]*\['[^']*'\]=\(\)=>[A-Za-z_][A-Za-z0-9]*,[A-Za-z_][A-Za-z0-9]*\['[^']*'\]\([A-Za-z_][A-Za-z0-9]*,[A-Za-z_][A-Za-z0-9]*\);const [A-Za-z_][A-Za-z0-9]*=\{\};}$/;
function isBehaviorsModule(moduleText) {
  return moduleText.match(behaviorsModuleRegexp) != null;
}

const gameSingletonModuleRegexp =
  /\([A-Za-z_][A-Za-z0-9]*,[A-Za-z_][A-Za-z0-9]*,[A-Za-z_][A-Za-z0-9]*\)=>\{const [A-Za-z_][A-Za-z0-9]*=\{'[^']*':(?:function)?\([A-Za-z_][A-Za-z0-9]*,[A-Za-z_][A-Za-z0-9]*\).+?\},[A-Za-z_][A-Za-z0-9]*=\{\};[A-Za-z_][A-Za-z0-9]*\['[^']*'\]=\(\)=>[A-Za-z_][A-Za-z0-9]*,[A-Za-z_][A-Za-z0-9]*\['[^']*'\]\([A-Za-z_][A-Za-z0-9]*,[A-Za-z_][A-Za-z0-9]*\);(?:const|let|var)? [A-Za-z_][A-Za-z0-9]*=new\([A-Za-z_][A-Za-z0-9]*\['[^']*'\]\([A-Za-z_][A-Za-z0-9]*,0x[0-9A-Fa-f]+\)\)\['[^']*'\]\(\);\}/;
function isGameSingletonModule(moduleText) {
  return moduleText.match(gameSingletonModuleRegexp) != null;
}

const wantModules = {
  behaviors: isBehaviorsModule,
  gameSingleton: isGameSingletonModule,
};

async function main() {
  let cacheJson = {
    indexFileHash: "",
    foundModules: {},
  };
  try {
    cacheJson = (
      await import("./cache.json", {
        with: { type: "json" },
      })
    ).default;
  } catch (e) {}

  let { indexFileHash: oldIndexFileHash, foundModules: oldFoundModules } =
    cacheJson;

  let foundModules = {};

  const baseUrl = "https://1187013846746005515.discordsays.com";

  // Fetch index.html
  const indexHtml = await (await fetch(baseUrl)).text();

  // Get the sha256 sum of the text content of index.html
  const indexFileHash = createHash("sha256")
    .update(indexHtml.replaceAll(/nonce="[^"]+"/g, 'nonce=""'))
    .digest("hex");

  if (indexFileHash == oldIndexFileHash) {
    foundModules = oldFoundModules;
  } else {
    await findFoundModules(indexHtml, baseUrl, foundModules);

    // output foundModule to cache.txt
    await fs.writeFile(
      "./cache.json",
      JSON.stringify({
        indexFileHash,
        foundModules,
      }),
    );
  }

  // load ./README.template.md from local dir as a string
  let readmeTemplate = await fs.readFile("./README.template.md", "utf-8");
  const scriptTemplate = await fs.readFile("./fmv_script.template.js", "utf-8");

  readmeTemplate = readmeTemplate.replaceAll(
    "/* __mainScriptContent__ */",
    scriptTemplate,
  );

  for (const [name, value] of Object.entries(foundModules)) {
    if (value === undefined) {
      console.warn(`Module ${name} not found`);
      continue;
    }
    readmeTemplate = readmeTemplate.replaceAll(`__${name}__`, value);
  }

  // Write the final README.md to the current directory
  await fs.writeFile("./README.md", readmeTemplate);
}

main().catch(console.error);
async function findFoundModules(indexHtml, baseUrl, foundModules) {
  const jsFiles = [...indexHtml.matchAll(/src="([^"]+)"/g)]
    .map((m) => m[1])
    .filter((src) => !src.startsWith("https"))
    .sort();

  // Fetch each JS file content
  const jsFileContents = {};
  for (const fileName of jsFiles) {
    const content = await (await fetch(`${baseUrl}/${fileName}`)).text();
    jsFileContents[fileName] = content;
  }

  const mainFileName = jsFiles.find((file) => file.startsWith("main."));

  const mainFileFunctions = jsFileContents[mainFileName].matchAll(
    `function ([A-Za-z_][A-Za-z0-9]*)\\([A-Za-z_][A-Za-z0-9]*\\)${balancedBracesPattern(15)}`,
  );

  for (const m of mainFileFunctions) {
    const functionName = m[1];
    const offset = m.index + 1;
    if (m[0].includes("'exports':{}")) {
      const lines = jsFileContents[mainFileName].slice(0, offset).split("\n");
      const lineNumber = lines.length;
      const columnNumber = lines[lines.length - 1].length;
      foundModules["importerFunctionName"] = functionName;
      foundModules["importerOffset"] =
        `${mainFileName}:${lineNumber}:${columnNumber}`;
      break;
    }
  }

  // Extract module IDs from all JS files, uniq sorted
  const moduleIdSet = new Set();
  for (const content of Object.values(jsFileContents)) {
    // grep -Po '(?<=_0x[A-Za-z0-9]{6}\[\'[^\']{1,10}\'\]\(_0x[A-Za-z0-9]{6},)0x[A-Za-z0-9]{2,6}(?=\))'
    // => lookbehind for _0xXXXXXX['...'](_0xXXXXXX, then a hex id like 0xXXXXXX
    const regex =
      /(?<=_0x[A-Za-z0-9]{6}\['[^']{1,10}'\]\(_0x[A-Za-z0-9]{6},)0x[A-Za-z0-9]{2,6}(?=\))/g;
    for (const m of content.matchAll(regex)) {
      moduleIdSet.add(m[0]);
    }
  }
  const moduleIds = [...moduleIdSet].sort();

  // For each module id, find matching object literal in js files
  // pattern: (?<=(?:$module_id|$dec):)\([A-Za-z_][A-Za-z0-9_]*,[A-Za-z_][A-Za-z0-9_]*,[A-Za-z_][A-Za-z0-9_]*\)=>(\{(?:[^{}]|(?1))*\})
  // We replace printf '%d' "$module_id" => decimal of hex id
  const moduleMap = {};

  for (const moduleId of moduleIds) {
    const dec = Number(moduleId).toString(10);
    const lookbehind = `(?:${moduleId}|${dec}):`;
    // The tricky pattern to match arrow function with 3 params and returning an object literal
    // We'll use a simpler approximate regex for JS:
    // e.g. look for `${moduleId}:([a-zA-Z_][a-zA-Z0-9_]*,[a-zA-Z_][a-zA-Z0-9_]*,[a-zA-Z_][a-zA-Z0-9_]*)=>({ ... })`
    // We capture from => to matching braces using a balancing approach is tough in JS regex; approximate with a lazy match.
    const pattern = new RegExp(
      `(?<=${lookbehind})\\([a-zA-Z_][a-zA-Z0-9_]*,[a-zA-Z_][a-zA-Z0-9_]*,[a-zA-Z_][a-zA-Z0-9_]*\\)=>\\s*(${balancedBracesPattern(15)})`,
      "m",
    );

    for (const [fileName, content] of Object.entries(jsFileContents)) {
      const match = content.match(pattern);
      if (match) {
        const moduleText = match[0];
        moduleMap[moduleId] = moduleText;

        for (let [name, predicate] of Object.entries(wantModules)) {
          if (foundModules[name] === undefined && predicate(moduleText)) {
            foundModules[name] = moduleId;
          }
        }

        break;
      }
    }
  }
}

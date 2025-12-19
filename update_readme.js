// SPDX-FileCopyrightHeader: Copyright © 2025 Lenny McLennington <lenny@sneed.church>. All rights reserved.
// SPDX-FileContributor: Lenny McLennington <lenny@sneed.church>
// SPDX-License-Identifier: AGPL-3.0-only

import fetch from "node-fetch";
import fs from "fs/promises";
import { createHash } from "crypto";

function getLineAndColFromIndex(text, index) {
  const lines = text.slice(0, index).split("\n");

  return [lines.length, lines[lines.length - 1].length];
}

function balancedBracesPattern(n) {
  let pattern = "[^{}]";

  for (let i = 0; i < n; i++) {
    pattern = `\\{(?:[^{}]|${pattern})*\\}`;
  }

  return pattern;
}

const number = "(?:0x[0-9A-Fa-f]+|\\d+)";
const identifier = "(?:[$A-Za-z_][$A-Za-z0-9_]*)";
const declIntroducer = `(?:(?:const|let|var)\\s+)`;

// (e,t,i)=>{i.d(t,{H:()=>o});const o={}}
const behaviorsModulePattern = `^\\(${identifier},${identifier},(?<importer>${identifier})\\)=>\\{`
+ `(?:\\k<importer>\\.${identifier}\\(.+\\);const ${identifier}={}|` // newest
+ `const ${identifier}=\\{\\};${identifier}\\['[^']*'\\]=\\(\\)=>${identifier},${identifier}\\['[^']*'\\]\\(${identifier},${identifier}\\);const ${identifier}=\\{\\};)}$`;
const behaviorsModuleRegexp =
  new RegExp(behaviorsModulePattern, "m");

function isBehaviorsModule(moduleText) {
  return moduleText.match(behaviorsModuleRegexp) != null;
}

// 71304:(e,_,t)=>{t.d(_,{L:()=>i});const i=new(t(94291).Z)}
const gameSingletonModulePattern = `\\(${identifier},${identifier},(?<importer>${identifier})\\)=>\\{`
 + `(?:\\k<importer>\\.${identifier}\\(.+\\);)?` // newest
 + `${declIntroducer}(?:${identifier}=\\{'[^']*':(?:function)?\\(${identifier},${identifier}\\).+?\\},)?`
 + `${identifier}=`
 + `(?:`
 + `\\{\\};${identifier}\\['[^']*'\\]=\\(\\)=>${identifier},${identifier}\\['[^']*'\\]\\(${identifier},${identifier}\\);(?:${declIntroducer})?\\s*${identifier}=new\\(${identifier}(?:\\['[^']*'\\]\\(${identifier},?|\\()0x[0-9A-Fa-f]+\\)\\)\\['[^']*'\\]\\(\\);`
 + `|new\\(\\k<importer>\\(${number}\\)\\.${identifier}\\)` // newest
 + `)`
 + `\\}`;

const gameSingletonModuleRegexp = new RegExp(
  gameSingletonModulePattern,
  "m"
);

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
      })
    );
  }

  // load ./README.template.md from local dir as a string
  let readmeTemplate = await fs.readFile("./README.template.md", "utf-8");
  const scriptTemplate = await fs.readFile("./fmv_script.template.js", "utf-8");

  readmeTemplate = readmeTemplate.replaceAll(
    "/* __mainScriptContent__ */",
    scriptTemplate
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

// 71304:(e,_,t)=>{t.d(_,{L:()=>i});const i=new(t(94291).Z)}
// 15229:(e,t,i)=>{i.d(t,{d:()=>r});var o=i(12723),s=i(80075)
const importCallPattern = (fnName) => `${fnName}\\((${number})\\)`;
const importRhs = (fnName) =>
  `(?:${importCallPattern(fnName)}|\\(${importCallPattern(
    fnName
  )}(?:,${importCallPattern(fnName)})*\\))`;
const individualImportPattern = (fnName) =>
  `${identifier}=${importRhs(fnName)}`;
const importListPattern = (fnName) =>
  `var ${individualImportPattern(fnName)}(?:,${individualImportPattern(
    fnName
  )})*;`;

const modulePattern = `(?<moduleId>${number}):\\((?<param1>${identifier}),(?<param2>${identifier}),(?<param3>${identifier})\\)=>\\s*(${balancedBracesPattern(
  30
)})`;

main().catch(console.error);
async function findFoundModules(indexHtml, baseUrl, foundModules) {
  const jsFiles = [...indexHtml.matchAll(/src="([^"]+)"/g)]
    .map((m) => m[1])
    .filter((src) => src.startsWith("game.") || src.startsWith("main."));

  // Fetch each JS file content
  const jsFileContents = {};
  for (const fileName of jsFiles) {
    const content = await (await fetch(`${baseUrl}/${fileName}`)).text();
    jsFileContents[fileName] = content;
  }

  const mainFileName = jsFiles.find((file) => file.startsWith("main."));

  const moduleRegex = new RegExp(modulePattern, "g");

  const mainFileFunctions = jsFileContents[mainFileName].matchAll(
    `function ([A-Za-z_][A-Za-z0-9]*)\\([A-Za-z_][A-Za-z0-9]*\\)${balancedBracesPattern(
      15
    )}`
  );

  // Extract module IDs from all JS files, uniq sorted
  const moduleIdSet = new Set();
  let firstFoundImport = null;

  const moduleMap = {};
  for (const fileName of jsFiles) {
    const content = jsFileContents[fileName];
    // grep -Po '(?<=_0x[A-Za-z0-9]{6}\[\'[^\']{1,10}\'\]\(_0x[A-Za-z0-9]{6},)0x[A-Za-z0-9]{2,6}(?=\))'
    // => lookbehind for _0xXXXXXX['...'](_0xXXXXXX, then a hex id like 0xXXXXXX

    // const importRegex =
    //   /(?:var |,)_0x[A-Za-z0-9]{6}=(?:(_0x[A-Za-z0-9]{6})(?:\(|\['[^']{1,10}'\]\((_0x[A-Za-z0-9]{6}),))(0x[A-Za-z0-9]{2,6})(?=\))/g;
    for (const module of content.matchAll(moduleRegex)) {
      const moduleId = module.groups.moduleId;
      const importer = module.groups.param3;
      moduleMap[moduleId] = module[0];
      moduleIdSet.add(moduleId);

      const importCallRegexp = new RegExp(
        importCallPattern(importer),
        "g"
      );

      for (const m of module[0].matchAll(
        new RegExp(importListPattern(importer), "g")
      )) {
        for (const im of m[0].matchAll(importCallRegexp)) {
          const moduleId = m[1];
          if (
            firstFoundImport === null &&
            !m[0].includes('"') &&
            !m[0].includes("'") &&
            importer
          ) {
            const [lineNumber, columnNumber] = getLineAndColFromIndex(
              content,
              m.index + module.index + 1
            );

            firstFoundImport = {
              importer,
              offset: `${fileName}:${lineNumber}:${columnNumber}`,
            };
          }
          moduleIdSet.add(moduleId);
        }
      }
    }
  }
  const moduleIds = [...moduleIdSet].sort();

  if (!firstFoundImport) {
    console.warn("No module imports found in main script.");
    process.exit(1);
  }

  foundModules["importerFunctionName"] = firstFoundImport.importer;
  foundModules["importerOffset"] = firstFoundImport.offset;

  // For each module id, find matching object literal in js files
  // pattern: (?<=(?:$module_id|$dec):)\([A-Za-z_][A-Za-z0-9_]*,[A-Za-z_][A-Za-z0-9_]*,[A-Za-z_][A-Za-z0-9_]*\)=>(\{(?:[^{}]|(?1))*\})
  // We replace printf '%d' "$module_id" => decimal of hex id

  let count = 0;
  for (const moduleId of moduleIds) {
    count += 1;
    if (count == 103) {
      console.log(`Checking module ${count}/${moduleIds.length} (${moduleId})`);
    }
    const dec = Number(moduleId).toString(10);
    const hex = "0x" + Number(moduleId).toString(16);
    const lookbehind = `(?:${hex}|${dec}):`;
    // The tricky pattern to match arrow function with 3 params and returning an object literal
    // We'll use a simpler approximate regex for JS:
    // e.g. look for `${moduleId}:([a-zA-Z_][a-zA-Z0-9_]*,[a-zA-Z_][a-zA-Z0-9_]*,[a-zA-Z_][a-zA-Z0-9_]*)=>({ ... })`
    // We capture from => to matching braces using a balancing approach is tough in JS regex; approximate with a lazy match.
    const pattern = new RegExp(
      `(?<=${lookbehind})\\([a-zA-Z_][a-zA-Z0-9_]*,[a-zA-Z_][a-zA-Z0-9_]*,[a-zA-Z_][a-zA-Z0-9_]*\\)=>\\s*(${balancedBracesPattern(
        30
      )})`,
      "m"
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

      if (
        Object.keys(wantModules).every((x) => foundModules[x] !== undefined)
      ) {
        console.log(
          `Found all required modules: ${Object.keys(wantModules).join(", ")}`
        );
        return;
      }
    }
  }

  if (Object.keys(wantModules).some((x) => foundModules[x] === undefined)) {
    console.warn(
      `Not all required modules found: ${Object.keys(wantModules)
        .filter((x) => foundModules[x] === undefined)
        .join(", ")}`
    );
    process.exit(1);
  }
}

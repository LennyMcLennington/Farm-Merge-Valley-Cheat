<!--
SPDX-FileCopyrightHeader: Copyright © 2025 Lenny McLennington <lenny@sneed.church>. All rights reserved.
SPDX-FileContributor: Lenny McLennington <lenny@sneed.church>
SPDX-License-Identifier: AGPL-3.0-only
-->

# Farm Merge Valley Cheat

## License

This software is licensed under GNU Affero General Public License, version 3

## Method to initialise the cheat

<details>

Steps 1-7 only need to be done once every time the game updates. If you have already set up the breakpoint then you can just initialise the cheat from step 8.

### Set up the injection point

1. Open Farm Merge Valley.
2. Open the console in your browser (F12 or Ctrl+Shift+I). The game will pause on a debugger trap.
3. Copy the code below and paste it into the console.

<details>

```js
Function.prototype.constructor = new Proxy(Function.prototype.constructor, {
  apply(target, thisArg, argumentsList) {
    if (argumentsList.length === 1 && argumentsList[0] === "debugger") {
      return () => {};
    }

    return Reflect.apply(target, thisArg, argumentsList);
  },
});
```

</details>

4. Resume script execution by pressing F8, or by pressing Ctrl+Shift+P and typing "Resume script execution" then pressing enter.
5. Press Ctrl+P and paste `__importerOffset__` then press enter, it should take you to a specific line in the code and highlight it orange so it's easy for you to find the position of the text cursor.
6. Set a breakpoint by clicking the left part of the sidebar in on the same line as the current text cursor position.
7. Close Farm Merge Valley.

### Load the cheat

8. Open Farm Merge Valley and make sure the developer tools are still open because they need to be active as soon as the game begins loading (the game screen will be black until you finish loading the cheat - this is normal).
9. When the game starts loading, it will pause again on a debugger trap, follow both steps **3 and 4** again in order to bypass the debugger trap. After you've followed those steps again, the debugger should break again, this time on the breakpoint that you previously set in step **6**. Now, copy the code below and paste it into the console:

<details>

```js
/* __mainScriptContent__ */
```

</details>

10. Now you can just repeat step **4** to resume the script execution. Wait for the game to load before using the cheat functionality.

</details>

## Functionality

<!-- TODO: parse assets-manifest.json to get the list of items that can be spawned. -->

The current functionality of the cheat is as follows, you can type these into the console in the developer tools after the game has loaded:

### Set your level

E.g. if you want to set your level to 10

```js
cheat.setLevel(10);
```

Or if you want to add 10 levels to your current level:

```js
cheat.addLevels(10);
```

Or add 100000 EXP

```js
cheat.addExp(100000);
```

### Spawn an object

gem_1 is the smallest type of gem, gem_2 is the result of merging gem_1, etc.

This applies to other objects like cow_1, cow_2; chicken_1, chicken_2; etc.

A full list of spawnable items will be provided in a future update.

```js
cheat.spawnObject("gem_1");
```

You can spawn an object in a bubble by doing:

```js
cheat.spawnBubbledObject("gem_1");
```

### TODO

These still need to be documented

- spawnCollectable
- giveInventoryItem
- setLuckyMergeChance
- deleteObstacles
- spawnUpgradeCard
- getValidItemTypes

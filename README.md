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
5. Press Ctrl+P and paste `main.e1beb6272284d6dce88c.js:1:26311` then press enter, it should take you to a specific line in the code and highlight it orange so it's easy for you to find the position of the text cursor.
6. Set a breakpoint by clicking the left part of the sidebar in on the same line as the current text cursor position.
7. Close Farm Merge Valley.

### Load the cheat

8. Open Farm Merge Valley and make sure the developer tools are still open because they need to be active as soon as the game begins loading.
9. When the game starts loading, it will pause again on a debugger trap, follow steps **3-4** in order to bypass the debugger trap. After you complete step 4, the debugger should break again, this time on the breakpoint that you previously set in step **6**. Now, copy the code below and paste it into the console:

<details>

```js
// SPDX-FileCopyrightHeader: Copyright © 2025 Lenny McLennington <lenny@sneed.church>. All rights reserved.
// SPDX-FileContributor: Lenny McLennington <lenny@sneed.church>
// SPDX-License-Identifier: AGPL-3.0-only

function firstValue(obj) {
  return Object.values(obj)[0];
}

class Cheat {
  initialised = false;

  // modules
  game = null;
  behaviors = null;
  gameplayMapScreen = null;

  mergeSystem = null;

  // module importing stuff
  fmvImport = null;
  gameSingletonId = null;
  behaviorsId = null;

  constructor(fmvImport, gameSingletonId, behaviorsId) {
    this.fmvImport = fmvImport;
    this.gameSingletonId = gameSingletonId || gameSingletonId;
    this.behaviorsId = behaviorsId || behaviorsId;
  }

  get backendServices() {
    return this.game.services;
  }

  get worldServices() {
    return this.gameplayMapScreen.services;
  }

  init() {
    if (this.initialised) return;

    this.game = firstValue(this.fmvImport(this.gameSingletonId));
    this.behaviors = firstValue(this.fmvImport(this.behaviorsId));

    this.gameplayMapScreen = this.game.services.canvas.stage.getChildByName(
      "GameplayMapScreen",
      true,
    );

    this.rewardSystem = this.gameplayMapScreen._systems.find(
      (x) => x._processReward,
    );
    this.mergeSystem = this.gameplayMapScreen._systems.find(
      (x) => x._luckyMergeChance,
    );
    this.upgradeCardSystem = this.gameplayMapScreen._systems.find(
      (x) => x._updateUpgradeCardObject,
    );
    this.rankBar = Object.values(
      this.game.services.navigation.hudLayer.hudContainer.getAllUIElements(),
    ).find((x) => x.AnimateRankBar);

    this.initialised = true;
  }

  spawnCollectable(target, amount) {
    const object = this.spawnAtClosestEmptyToCenter(`gem_1`);

    object.getBehavior("collectable")._data.reward = [
      { key: target, amount: amount },
    ];
    this.worldServices.world.addGameObject(object);

    return object;
  }

  spawnAtClosestEmptyToCenter(id) {
    const object = this.backendServices.gameObjectFactory.createById(id);

    object.addBehavior(
      new this.behaviors.gridPosition(
        this.worldServices.visibleCells.getClosestEmptyToTheCenter(),
      ),
    );

    return object;
  }

  spawnBubbledObject(target) {
    return this.worldServices.rewardService.giveObjectReward({
      rewards: [target],
      container: this.gameplayMapScreen,
      animationEndEvent: null,
      bubblePosition: { x: 0, y: -200 },
    });
  }

  spawnObject(target) {
    let object = this.spawnAtClosestEmptyToCenter(target);
    this.worldServices.world.addGameObject(object);
    return object;
  }

  giveInventoryItem(target, amount) {
    return this.worldServices.rewardService.giveInventoryReward({
      reward: { key: target, amount: amount },
      parent: this.gameplayMapScreen,
    });
  }

  // 100 = always lucky merge, 0 = never lucky merge, default is 5
  setLuckyMergeChance(percentage) {
    this.mergeSystem._luckyMergeChance = percentage;
  }

  setLevel(level) {
    this.backendServices.experience._levelInventory.amount = level;
    this.rankBar.AnimateRankBar();
  }

  addLevels(amount) {
    this.backendServices.experience._levelInventory.amount += amount;
    this.rankBar.AnimateRankBar();
  }

  addExp(amount) {
    this.backendServices.experience.addExp(amount);
    this.rankBar.AnimateRankBar();
  }

  deleteObstacles() {
    worldServices.world
      .getAllGameObjects()
      .filter(
        (x) =>
          x.hasBehavior("hitpoints") &&
          !x.hasBehavior("shovelable") &&
          !x.hasBehavior("movable"),
      )
      .forEach((x) => worldServices.world.removeGameObject(x));
  }

  spawnUpgradeCard(target, tier) {
    if (!(1 <= tier && tier <= 3)) return;

    const object = this.spawnAtClosestEmptyToCenter(`upgrade_card_${tier}`);
    const behavior = object.getBehavior("upgradeCard");
    this.upgradeCardSystem._updateUpgradeCardObject(object, behavior, target);

    this.worldServices.world.addGameObject(object);

    return object;
  }

  findBlueprintsWithBehaviour(behaviour) {
    return Array.from(this.backendServices.blueprintCollection._blueprints)
      .map((x) => x[1])
      .filter((x) => Object.keys(x.components).includes(behaviour));
  }

  altFindBlueprintsWithBehaviour(behaviour) {
    return Array.from(this.backendServices.blueprintCollection._blueprints)
      .map((x) => x[1])
      .filter(
        (x) =>
          Object.keys(x.components).includes(behaviour) &&
          !x.id.startsWith("base_"),
      )
      .map((x) => x.id);
  }

  getValidItemTypes() {
    return this.backendServices.inventory._model._inventoryItems
      .keys()
      .toArray();
  }
}

const CheatAutoInit = new Proxy(Cheat, {
  construct(target, args) {
    const instance = new target(...args);
    const proxiedInstance = new Proxy(instance, {
      get: (target, prop) => {
        const orig = target[prop];
        if (typeof orig === "function" && prop !== "init") {
          return (...arguments) => {
            target.init();
            return orig.apply(target, arguments);
          };
        }
        return orig;
      },
    });

    proxiedInstance._inner = instance;

    return proxiedInstance;
  },
});

const fmvImport =
  window.cheat === undefined
    ? _0x28bd45
    : window.cheat.fmvImport;

const cheat = new CheatAutoInit(fmvImport, 0x11688, 0x130f5);

window.cheat = cheat;

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

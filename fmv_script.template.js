// SPDX-FileCopyrightHeader: Copyright © 2025 Lenny McLennington <lenny@sneed.church>. All rights reserved.
// SPDX-FileContributor: Lenny McLennington <lenny@sneed.church>
// SPDX-License-Identifier: AGPL-3.0-only

const firstValue = (obj) => {
  return Object.values(obj)[0];
};

class Cheat {
  initialised = false;

  // modules
  game = null;
  behaviors = null;
  gameplayMapScreen = null;

  mergeSystem = null;
  rewardSystem = null;
  upgradeCardSystem = null;
  rankBar = null;

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
    if (!this.game) {
      throw new Error(
        "Game singleton not found. Please ensure you are using an up-to-date version of the script, and following the instructions.",
      );
    }
    this.behaviors = firstValue(this.fmvImport(this.behaviorsId));
    if (!this.behaviors) {
      throw new Error(
        "Behaviors module not found. Please ensure you are using an up-to-date version of the script, and following the instructions.",
      );
    }

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

  spawnUpgradeCard(target, tier) {
    if (!(1 <= tier && tier <= 3)) return;

    const object = this.spawnAtClosestEmptyToCenter(`upgrade_card_${tier}`);
    const behavior = object.getBehavior("upgradeCard");
    this.upgradeCardSystem._updateUpgradeCardObject(object, behavior, target);

    this.worldServices.world.addGameObject(object);

    return object;
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

  giveInventoryItem(target, amount) {
    // This works for level but it's better to use setLevel because it includes proper animation.
    if (target === "level") {
      return this.setLevel(amount);
    }

    // fallback to non-animated version since the animation (giveInventoryReward) doesn't work for negative or zero
    if (amount < 1) {
      return this._setInventoryAmountDelta(target, amount);
    }

    return this.worldServices.rewardService.giveInventoryReward({
      reward: { key: target, amount: amount },
      parent: this.gameplayMapScreen,
    });
  }

  setInventoryAmount(target, amount) {
    this.backendServices.inventory.setAmount(target, amount);
  }

  _setInventoryAmountDelta(target, delta) {
    this.backendServices.inventory.addAmount(target, delta);
  }

  getValidItemTypes() {
    return this.backendServices.inventory._model._inventoryItems
      .keys()
      .toArray();
  }
}

let CheatAutoInit = new Proxy(Cheat, {
  construct(target, args) {
    const instance = new target(...args);
    const proxiedInstance = new Proxy(instance, {
      get: (target, prop) => {
        const orig = target[prop];
        if (
          typeof orig === "function" &&
          prop !== "init" &&
          prop !== "fmvImport"
        ) {
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
  (() => {
    let fmvImport = undefined;
    try {
      fmvImport = __importerFunctionName__;
    } catch (e) {}
    return fmvImport;
  })() || window.cheat?.fmvImport;

if (!fmvImport) {
  console.warn(
    "No fmvImport function found. Please ensure you are following the instructions correctly.",
  );
} else {
  window.cheat = new CheatAutoInit(fmvImport, __gameSingleton__, __behaviors__);
}

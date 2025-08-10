<!--
SPDX-FileCopyrightHeader: Copyright © 2025 Lenny McLennington <lenny@sneed.church>. All rights reserved.
SPDX-FileContributor: Lenny McLennington <lenny@sneed.church>
SPDX-License-Identifier: AGPL-3.0-only
-->

mapgrid stuff

```js
// get the gameobject at a specific position
worldServices.mapGrid.getContent(54, 54);
```

```js
// get all cells that have the "hitpoints" behavior
[...worldServices.mapGrid._cells]
  .map((x) => x[1])
  .filter((x) => x.hasBehavior("hitpoints"));

// get the parent of the trainstation game object
worldServices.world
  .getAllGameObjects()
  .find((x) => x._blueprintID === "trainstation").parent;
```

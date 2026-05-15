# Farmer Baby — 團隊協作指南

https://github.com/ythsu19/farmer_baby

本指南規範組員在這個 Cocos Creator 專案的協作流程，目的是 **減少 git conflict** 並避免常見的資源／場景錯誤。

請所有組員在開始開發前完整讀一次。

---

## 0. 環境準備（一次性）

1. 安裝 Cocos Creator（與專案要求版本一致，見 `project.json`）。
2. clone repo 後**不要**直接執行 build，先確認 `.gitignore` 已生效：

   ```
   library/  local/  temp/  build/  node_modules/   ← 這些絕對不要 commit
   ```

3. **第一次用 Creator 打開專案**會自動生成 `library/`、`temp/`、`local/`，這些都是本機快取，不會（也不應）進版。
4. 確認 git 使用者名稱與 email 設定正確：

   ```bash
   git config user.name "你的名字"
   git config user.email "你的@email"
   ```

---

## 1. Git 分支策略

```
main                    ← 受保護，只能透過 PR 合併，永遠保持可運行
  └── feature/<你的名字>-<功能>     例: feature/alice-shop-ui
  └── fix/<你的名字>-<bug>          例: fix/bob-save-crash
```

### 鐵則

- **不要直接 push 到 `main`**。
- **一個功能一個分支**，分支生命週期越短越好（建議 2-3 天內合併）。
- 每天上工先 `git pull --rebase origin main`，把自己的分支 rebase 到最新的 main，越早處理衝突越好。
- **不要在 main 上有未 commit 的修改就切分支** — 先 `git status` 確認乾淨。

---

## 2. `.meta` 檔案規則（最常見的踩雷點）

Cocos Creator 對每一個資源檔（`.png`、`.wav`、`.mp3`、`.jpg`、`.fire`、`.prefab`、`.ts`…）都會自動產生一個對應的 `.meta` 檔案，裡面有 **UUID**。

### 規則

| 動作 | 必須同時 commit |
|------|---|
| 新增 `hero.png` | `hero.png` + `hero.png.meta` |
| 刪除 `hero.png` | 同時刪除 `hero.png.meta` |
| 改名 `hero.png` → `player.png` | **連同 `.meta` 一起改名** |

### 禁止事項

- ❌ **絕對不要把 `.meta` 加進 `.gitignore`** — 否則所有資源引用會在組員端壞掉。
- ❌ **不要手動編輯 `.meta` 裡的 UUID** — 改了就斷所有引用。
- ❌ 不要在 Creator 編輯器外（用檔案總管）改名 / 搬資源 — 一定要用 Creator 內建的「資源管理器」操作，否則 `.meta` 不會跟著更新。

### 自我檢查指令

commit 前在 PR 描述附上：

```bash
# 找出 assets/ 下任何缺 .meta 的檔案（PowerShell）
Get-ChildItem -Path assets -Recurse -File |
  Where-Object { $_.Extension -ne ".meta" -and -not (Test-Path "$($_.FullName).meta") } |
  Select-Object FullName
```

---

## 3. 場景（`.fire`）分工 — **最容易衝突的地方**

`.fire` 是巨大的 JSON 檔案，**多人同時編輯幾乎一定衝突且難以 merge**。

### 鐵則：一場景一人

- 專案只有 **一個主場景** `assets/scenes/Main.fire`。
- **同一時段只能一個人開著編輯主場景。**
- 編輯前在團隊群組（Discord/Line）說一聲「我要編 Main.fire」，編完並 push 後再說「Main.fire 釋出」。

### 如何避免去動主場景？→ 把所有東西做成 Prefab（見第 4 節）

主場景應該 **盡量空** — 只放：
- 一個 `Canvas`
- 一個 `MainSceneManager` 節點（掛載組裝腳本）
- 必要的 Camera、Audio Listener

**所有 UI、角色、道具都做成 prefab**，由 `MainSceneManager` 在 runtime 動態組裝。這樣每個人改自己的 prefab，互不打架。

---

## 4. Prefab 拆分規範

### 目錄規劃

```
assets/
├── scenes/
│   └── Main.fire                ← 唯一場景，盡量空
├── prefabs/
│   ├── ui/
│   │   ├── HUD.prefab
│   │   ├── ShopPanel.prefab
│   │   └── SettingsPanel.prefab
│   ├── characters/
│   │   ├── Player.prefab
│   │   └── Enemy.prefab
│   └── items/
│       └── Crop.prefab
├── scripts/
│   ├── managers/
│   │   └── MainSceneManager.ts  ← 場景組裝入口
│   ├── ui/
│   ├── characters/
│   └── utils/
├── textures/
├── audio/
└── animations/
```

### `MainSceneManager` 的責任

在 `onLoad()` 中讀設定，把需要的 prefab 動態 `instantiate` 到場景中：

```typescript
// assets/scripts/managers/MainSceneManager.ts
const { ccclass, property } = cc._decorator;

@ccclass
export default class MainSceneManager extends cc.Component {
    @property(cc.Prefab) hudPrefab: cc.Prefab = null;
    @property(cc.Prefab) playerPrefab: cc.Prefab = null;
    @property(cc.Node)   uiRoot: cc.Node = null;
    @property(cc.Node)   worldRoot: cc.Node = null;

    onLoad() {
        const hud    = cc.instantiate(this.hudPrefab);
        const player = cc.instantiate(this.playerPrefab);
        hud.parent    = this.uiRoot;
        player.parent = this.worldRoot;
    }
}
```

**好處**：組員 A 改 `HUD.prefab`、組員 B 改 `Player.prefab`、組員 C 改 `MainSceneManager.ts`，三個檔案完全不衝突。

### Prefab 分工建議

| 組員 | 負責 prefab | 對應腳本 |
|------|------------|---------|
| A | UI 相關（HUD、ShopPanel…） | `scripts/ui/` |
| B | 角色與互動（Player、Enemy） | `scripts/characters/` |
| C | 道具與系統（Crop、Inventory） | `scripts/managers/`、`scripts/items/` |

各自編輯時打開 prefab 編輯模式（雙擊 prefab），**不要打開主場景**。

---

## 5. 禁用 `cc.find` — 用 `@property` 引用

`cc.find('Canvas/UI/HUD/CoinLabel')` 這種寫法：
- 在 prefab 拆分後**極度脆弱** — 任何人改路徑就壞。
- 跨 prefab 抓節點 → 違反封裝。
- 編譯期不會報錯，**只會在 runtime 噴 null**。

### 正確作法

#### ✅ 同 prefab 內 — 用 `@property` 在編輯器拖引用

```typescript
@ccclass
export default class HUD extends cc.Component {
    @property(cc.Label) coinLabel: cc.Label = null;   // 在編輯器拖進去
    @property(cc.Label) hpLabel:   cc.Label = null;
}
```

#### ✅ 跨 prefab — 用事件匯流排或 Manager 注入

```typescript
// 不要這樣（脆弱）：
const hud = cc.find('Canvas/UI/HUD');
hud.getComponent(HUD).setCoin(100);

// 要這樣（解耦）：
cc.systemEvent.emit('coin-changed', 100);

// HUD 監聽：
onLoad() {
    cc.systemEvent.on('coin-changed', this.setCoin, this);
}
```

或在 `MainSceneManager` 組裝時把引用注入：

```typescript
const hudNode = cc.instantiate(this.hudPrefab);
const hud = hudNode.getComponent(HUD);
this.player.bindHUD(hud);   // 顯式注入，編譯期能檢查
```

### Code Review 檢查項目

PR 中 grep 一下，**任何 `cc.find` 都要在 review 時被質疑**：

```bash
# 在 assets/ 下搜尋 cc.find
git grep -n "cc\.find" -- "assets/*.ts" "assets/*.js"
```

---

## 6. 開發步驟（按順序進行）

### Phase 1：骨架（由 owner 一人完成，**先做完再分工**）

1. 建立 [第 4 節](#4-prefab-拆分規範) 的目錄結構（空資料夾就好，Creator 會自動生 `.meta`）。
2. 建立 `assets/scenes/Main.fire`，裡面放 Canvas + 空的 `MainSceneManager` 節點。
3. 寫一個最小的 `MainSceneManager.ts`，先讓場景能跑起來（什麼都沒有也沒關係）。
4. commit + push + 合進 `main`。

**這一步完成前其他人不要動 `assets/`。**

### Phase 2：分頭開發（並行）

每個組員：

1. `git pull --rebase origin main`
2. `git checkout -b feature/<你的名字>-<功能>`
3. **只編輯自己負責的 prefab 和對應腳本**（在 Creator 中雙擊 prefab 進入編輯模式）。
4. **不要打開 `Main.fire`**。如果一定要動主場景（例如要加新的 prefab slot），在群組喊一聲，等別人讓出。
5. 開發完成 → `git status` 確認沒有 `.meta` 漏掉 → commit → push → 開 PR。

### Phase 3：整合（每天一次）

- 每天傍晚由 owner 把當天合進來的 prefab 透過 `MainSceneManager` 串起來。
- 跑一遍場景，確認新東西都掛上去了。

---

## 7. Commit / PR 規範

### Commit message

```
<type>: <簡短說明>

範例：
feat: 新增 ShopPanel prefab
fix: 修正 Player 移動方向反轉
refactor: 用事件取代 HUD 的 cc.find
chore: 整理 textures/ 目錄
```

### PR 自我檢查清單

開 PR 前，貼這份清單在描述裡並逐項打勾：

- [ ] 我有先 `git pull --rebase origin main`
- [ ] 所有新增資源都有對應 `.meta`
- [ ] 我沒有編輯 `Main.fire`（或我有在群組喊過）
- [ ] 我的腳本沒有用 `cc.find`（或我有寫理由）
- [ ] 本機能跑起來，沒有 console error
- [ ] `library/`、`temp/`、`local/`、`build/` 沒有被 commit

---

## 8. 衝突發生時怎麼辦

### `.fire` 或 `.prefab` 衝突

**不要手動 merge**。這兩種檔案是長 JSON，手動 merge 幾乎一定壞。

正確流程：
1. 在群組通知：「Main.fire 衝突，我要重做」
2. `git checkout --theirs assets/scenes/Main.fire`（接受 main 的版本）
3. 在 Creator 中**重新做一次自己這次的編輯**
4. commit

→ 這就是為什麼 [第 3 節](#3-場景fire分工--最容易衝突的地方) 強調「同時段只能一個人編場景」。

### `.meta` 衝突

通常表示兩人各自新增了同名資源，UUID 衝突。
1. 在群組討論誰保留、誰改名
2. 改名那邊用 Creator 的「資源管理器」改名（會自動更新 `.meta`）

---

## 附錄：快速指令

```bash
# 每天上工
git checkout main && git pull --rebase origin main
git checkout -b feature/myname-task

# commit 前自我檢查
git status
git diff --stat

# 列出所有 cc.find 使用（review 時用）
git grep -n "cc\.find" -- "assets/"

# 列出缺 .meta 的資源（PowerShell）
Get-ChildItem -Path assets -Recurse -File |
  Where-Object { $_.Extension -ne ".meta" -and -not (Test-Path "$($_.FullName).meta") }
```

---

有疑問先問群組，不要先 commit 再說。

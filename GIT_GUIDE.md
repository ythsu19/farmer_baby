# Git 使用指南（組員必讀）

https://github.com/ythsu19/farmer_baby

這份文件告訴你**每天上工到下班、從寫 code 到 PR 合併**的具體 git 指令流程。

搭配 [TEAM_GUIDE.md](TEAM_GUIDE.md) 一起讀。

> 環境：本指南預設 Windows + PowerShell，但 git 指令在 macOS / Linux 也通用。

---

## 0. 一次性設定（只做一次）

### Step 0-1：Clone 專案

```powershell
cd D:\           # 或你想放專案的位置
git clone <repo-url> farmer_baby
cd farmer_baby
```

### Step 0-2：設定你的 git 身份

```powershell
git config user.name "你的名字"
git config user.email "你的@email"
```

> 這只會設定**這個 repo** 的 user，不會影響你其他專案。

### Step 0-3：確認分支與遠端

```powershell
git branch              # 應該看到 * main
git remote -v           # 應該看到 origin 指向 GitHub
```

### Step 0-4：用 Cocos Creator 打開專案

打開 Creator → 選 `D:\farmer_baby` → 等待 import 完成（第一次會慢，會自動生成 `library/`、`temp/`、`local/`）。

確認 `git status` 後 **這些資料夾不應該出現** —— 因為 [.gitignore](.gitignore) 已忽略。

---

## 1. 每日工作流程（牢記這 10 步，每次新功能都照走）

```
 1. 同步 main      → git checkout main
                   → git pull --rebase origin main
 2. 開分支         → git checkout -b feature/myname-task
 3. 寫 code        → 在 Creator + VS Code 編輯
 4. 看狀態         → git status / git diff
 5. 加檔案         → git add <files>
 6. 提交           → git commit -m "feat: ..."
 7. 推到 GitHub    → git push -u origin feature/myname-task
 8. 開 PR          → 用 push 印出的網址，或 pull/new/<branch>
 9. 合併 PR        → 在 GitHub 點 Merge pull request
10. 清理本機分支   → git checkout main
                   → git pull --rebase origin main
                   → git branch -d feature/myname-task
```

> **核心觀念**：`git push` **只是把你的分支備份到 GitHub**，不會自動進 main。
> 要進 main 永遠要走 PR（步驟 8-9）。

### Step 1：同步 main

```powershell
git checkout main
git pull --rebase origin main
```

> **`--rebase`** 把遠端的修改放在你本地修改下面，歷史線比較乾淨。

### Step 2：開自己的分支

**分支命名**：`<類型>/<你的英文名>-<簡短功能>`

```powershell
git checkout -b feature/alice-shop-ui
```

驗證：`git branch` 應該看到 `*` 在你新分支前面：

```
* feature/alice-shop-ui
  main
```

範例：
- `feature/alice-shop-ui`
- `fix/bob-player-stuck`
- `refactor/charlie-event-bus`

> ❌ **不要** 在 `main` 上直接寫 code。
> ❌ **不要** 取像 `test`、`tmp`、`dev` 這種模糊的名字。
> ⚠️ **沒有 `git branch -b` 這個指令** —— 開新分支用 `git checkout -b`。

### Step 3：寫 code（在 Creator 與 VS Code 之間切換）

照 [TEAM_GUIDE 第 6 節](TEAM_GUIDE.md) 的分工，**只動自己負責的 prefab 與腳本**。

### Step 4：看自己改了什麼

```powershell
git status              # 看哪些檔案被改 / 新增 / 刪除
git diff                # 看內容差異
git diff --stat         # 只看「哪些檔案改了幾行」摘要
```

**這一步很重要**，commit 前一定要看，避免：
- 漏掉 `.meta` 檔案
- 不小心 commit 到 `library/`（不應該發生，但要確認）
- 不小心改到別人的檔案

### Step 5：加檔案

```powershell
# 加單個檔案
git add assets/prefabs/ui/ShopPanel.prefab
git add assets/prefabs/ui/ShopPanel.prefab.meta

# 加整個資料夾
git add assets/scripts/ui/

# 一次加所有變更（小心使用，會把所有改動加進來）
git add .
```

> **永遠記得 `.meta` 要跟資源一起 add**，否則組員端會壞。

### Step 6：commit

```powershell
git commit -m "feat: 新增 ShopPanel 介面與購買流程"
```

**Commit 訊息格式**：

```
<type>: <做了什麼>

type 可選：feat / fix / refactor / chore / docs / style / test
```

範例：
- `feat: 新增 Player 跳躍動作`
- `fix: 修正 ShopPanel 點兩次會買兩次的問題`
- `refactor: 用 systemEvent 取代 HUD 的 cc.find`
- `chore: 整理 textures/ 目錄結構`

### Step 7：push 到 GitHub

**第一次推這個分支**：

```powershell
git push -u origin feature/alice-shop-ui
```

> `-u` 是「設定 upstream」，只有第一次需要。之後用 `git push` 就好。

跑完後**仔細看終端機輸出**，你會看到類似這段：

```
remote: Create a pull request for 'feature/alice-shop-ui' on GitHub by visiting:
remote:      https://github.com/ythsu19/farmer_baby/pull/new/feature/alice-shop-ui
```

⭐ **那條 URL 就是你的 PR 入口**，按住 Ctrl + 點它就會跳到開 PR 頁面。

**後續推送**（同一分支再次推）：

```powershell
git push
```

### Step 8：開 PR — 三種方式擇一

#### 方式 A（最快）：用 push 完印出的網址

remote: Create a pull request for 'feature/pkboie-setting' on GitHub by visiting:
remote:      https://github.com/ythsu19/farmer_baby/pull/new/feature/pkboie-setting


#### 方式 B：用固定的網址規律

```
https://github.com/ythsu19/farmer_baby/pull/new/<你的分支名>
```

範例：
👉 https://github.com/ythsu19/farmer_baby/pull/new/feature/alice-shop-ui

**記住這個格式**，換分支只要改最後一段。

#### 方式 C：從 GitHub 網頁找

1. 打開 https://github.com/ythsu19/farmer_baby
2. 上方分頁點 **Pull requests**
3. 點右上角綠色按鈕 **New pull request**
4. 兩個下拉選單選成：
   ```
   base: main   ←   compare: feature/alice-shop-ui
   ```
5. 點 **Create pull request**

> ⚠️ **「找不到 PR」常見原因**：點到 Pull requests 看到 `0 Open` 以為沒功能 →
> 其實要再點右上角綠色的 **New pull request** 才會跳到開 PR 頁面。

#### 進到 PR 頁面後

1. 標題會自動帶 commit message，可以改
2. 內容會自動帶 [.github/pull_request_template.md](.github/pull_request_template.md) 模板
3. **完整填寫每一欄**，勾選清單
4. 右邊指定 reviewer
5. 點綠色 **Create pull request**

### Step 9：合併 PR

PR 建立後，在**同一頁面**拉到下方：

```
┌─────────────────────────────────────────┐
│ ✓ This branch has no conflicts...      │
│                                         │
│  [ Merge pull request ▼ ]              │  ← 點這個綠色按鈕
└─────────────────────────────────────────┘
```

1. 點綠色 **Merge pull request**
2. 確認標題 → 點 **Confirm merge**
3. 看到 **Pull request successfully merged** 就成功了

### Step 10：本機同步 + 清理分支

回到 VS Code 終端機：

```powershell
git checkout main                              # 切回 main
git pull --rebase origin main                  # 把剛合進去的拉下來
git branch -d feature/alice-shop-ui            # 刪掉本機已合併的分支
```

✅ 完成。下次開新功能再回到 Step 1。

---

### branch 跟 main 怎麼互動？

```
時間 →

main:           A───B───────────M1──────────M2
                        \      /     \      /
feature/test:            C────/       \    /
                                       \  /
feature/setting:                        D
```

- **A, B**：main 原本的 commit
- **C**：你在 `feature/pkboie-test` 做的工作
- **M1**：你的 PR 被 merge 進 main
- **D**：你在新分支 `feature/pkboie-setting` 做的工作
- **M2**：下一個要合的 PR

**每開一個 PR = 把一個圓圈接到 main 上。**
push 只是把圓圈備份到 GitHub，merge 才是真正接上去。

---

## 2. 常見情境怎麼處理

### 情境 A：開發到一半，main 有更新，要同步

```powershell
git status              # 確認目前沒有未 commit 的修改
                        # 如果有 → 先 commit 或 stash

git checkout main
git pull --rebase origin main
git checkout feature/alice-shop-ui
git rebase main         # 把你的分支接到最新 main 的後面
```

如果 rebase 過程出現衝突 → 看[情境 D](#情境-d普通檔案衝突)。

如果你的修改還沒 commit，可以暫存起來：

```powershell
git stash               # 暫存所有未 commit 的修改
git pull --rebase origin main
git stash pop           # 把暫存的修改放回來
```

### 情境 B：reviewer 要求修改

```powershell
# 在同一個分支上繼續改
git add <files>
git commit -m "fix: 採納 review 建議，修正 X"
git push                # 直接推上去，PR 會自動更新
```

> 不需要關 PR 再開新的，**同分支繼續 push 就會更新 PR**。

### 情境 C：PR 合併完了，怎麼開下一個功能

```powershell
git checkout main
git pull --rebase origin main           # 把剛合進去的東西拉下來
git branch -d feature/alice-shop-ui     # 刪掉本機已合併的舊分支
git checkout -b feature/alice-inventory # 開新分支
```

### 情境 D：普通檔案衝突（`.ts`、`.json` 等）

`git pull` 或 `git rebase` 後出現：

```
CONFLICT (content): Merge conflict in assets/scripts/managers/GameSceneManager.ts
```

**處理方式**：

1. 用 VS Code 打開衝突檔，會看到：

   ```
   <<<<<<< HEAD
   你的版本
   =======
   別人的版本
   >>>>>>> origin/main
   ```

2. VS Code 上方會有按鈕「Accept Current Change / Accept Incoming / Accept Both」，選對的或手動編輯。
3. 確認沒有 `<<<<<<<`、`=======`、`>>>>>>>` 殘留。
4. 完成後：

   ```powershell
   git add <衝突的檔案>
   git rebase --continue       # 如果在 rebase
   # 或
   git commit                  # 如果在 merge
   ```

### 情境 E：`.fire` 或 `.prefab` 衝突 ⚠️ 最棘手

**不要手動 merge**。這兩種是長 JSON，手動改幾乎一定壞。

```powershell
# 1. 在群組通知：「Main.fire 衝突，我要重做」

# 2. 接受 main 的版本（捨棄自己的）
git checkout --theirs assets/scenes/Main.fire
git checkout --theirs assets/scenes/Main.fire.meta
git add assets/scenes/Main.fire assets/scenes/Main.fire.meta
git rebase --continue

# 3. 打開 Cocos Creator，重新做一次你這次的編輯
# 4. 重新 commit
```

> **預防勝於治療**：遵守 [TEAM_GUIDE 第 3 節](TEAM_GUIDE.md) ——「同時段一人一場景」。

### 情境 F：不小心 commit 到了 `main`

**還沒 push**：

```powershell
git log --oneline -5            # 看你 commit 了什麼
git branch feature/alice-rescue # 把現在的進度存到新分支
git reset --hard origin/main    # ⚠️ main 退回到遠端狀態
git checkout feature/alice-rescue
```

**已經 push**：先**不要再 push**，到群組找 owner 處理。

### 情境 G：撤回最後一個 commit（保留檔案修改）

```powershell
git reset --soft HEAD~1         # 撤回 commit，檔案修改還在
```

撤回最後一個 commit（**連檔案修改一起丟掉**，⚠️ 不可逆）：

```powershell
git reset --hard HEAD~1
```

### 情境 H：想看別人改了什麼

```powershell
git log --oneline -20                       # 看最近 20 個 commit
git log --oneline --all --graph -20         # 看所有分支的圖形化歷史
git show <commit-hash>                      # 看某個 commit 改了什麼
git diff main..feature/bob-player           # 比較兩個分支
```

### 情境 I：commit 了不該 commit 的檔案（例如 `library/` 跑進去了）

```powershell
git rm --cached -r library/      # 從 git 移除但保留本機
git commit -m "chore: 移除誤 commit 的 library/"
git push
```

然後檢查 [.gitignore](.gitignore) 是不是缺了規則。

---

## 3. 黃金守則（違反這些會被退 PR）

1. ❌ **不要直接 push 到 main** —— 永遠用 PR。
2. ❌ **不要 `git push --force`** —— 會覆蓋別人的工作。如果真的需要，用 `--force-with-lease` 並先在群組說。
3. ❌ **不要 `git commit -a` 一把梭** —— 用 `git add <檔案>` 明確指定，避免誤 commit。
4. ❌ **不要 commit `.fire` 或 `.prefab` 衝突的「手動 merge 結果」** —— 一定會壞，按[情境 E](#情境-efire-或-prefab-衝突--最棘手) 處理。
5. ❌ **不要 commit 沒有對應 `.meta` 的資源**，也不要單獨 commit `.meta` 而忘了資源本體。
6. ❌ **不要在 main 分支上開發**。任何修改都先開 feature 分支。
7. ✅ **commit 前一定 `git status` + `git diff`**。
8. ✅ **每天上工先 pull rebase**。
9. ✅ **分支生命週期 ≤ 3 天**，越短越好。

---

## 4. 一張速查表

```powershell
# === 每日例行 ===
git checkout main; git pull --rebase origin main      # 上工
git checkout -b feature/myname-task                   # 開分支
git status; git diff                                  # 看改了什麼
git add <files>                                       # 加檔案
git commit -m "feat: ..."                             # 提交
git push -u origin feature/myname-task                # 第一次推
git push                                              # 之後推

# 推完送 PR
# step 8

# === 同步 main ===
git checkout main; git pull --rebase origin main
git checkout feature/myname-task
git rebase main

# === 暫存修改 ===
git stash               # 暫存
git stash pop           # 還原

# === 看狀態 ===
git log --oneline -10
git log --oneline --all --graph
git branch -a           # 看所有分支

# === 救援 ===
git reset --soft HEAD~1     # 撤 commit 留檔案
git checkout -- <file>      # 丟掉某檔案的本機修改
git restore --staged <file> # 把 add 過的檔案退出暫存
```

---

## 5. 不確定怎麼辦？

**規則**：對 git 有任何不確定，**不要瞎搞**。

- 你的修改還在嗎？→ `git status` + `git stash list` 確認
- 怕做錯？→ 先 `git branch backup-<日期>` 備份當前狀態，再操作
- 完全卡住？→ 去群組問 owner，**不要用 `git reset --hard` 或 `--force` 救火**

> 記住：git 的大部分操作都是可逆的（commit、branch、checkout），**只有 `--hard reset` 和 `push --force` 是真的會丟東西**。看到這兩個指令時請多想一秒。

// GameStore — 全域玩家狀態（金幣 + 永久強化加成）
//
// 為什麼用 module-level singleton 而不是 cc.Component？
//   Cocos 場景切換時，舊場景所有節點 / 元件都 destroy；新場景重建。
//   要在「Tutorial → Store → World → final」之間維持狀態，要嘛：
//     (a) 用 cc.game.addPersistRootNode 把節點標永久 — 但會被掛在 cc.director 的 _persistRootNodes，
//         debug 麻煩、跨場景參考容易出 bug
//     (b) 直接寫 export const GameStore — TS module 只 import 一次，整個 JS runtime 共用同一份
//   選 (b)，最直接、跨場景一致、不依賴 Cocos lifecycle。
//
// localStorage 用途：
//   重新整理 / 關掉瀏覽器再開 → 金幣 + 加成不會歸零。
//   存檔結構簡單 JSON（一個 key），不用 SQLite / IndexedDB。
//   測試清空：開 DevTools console → `cc.sys.localStorage.removeItem('farmer_baby_save_v1')` → 重整。
//
// 強化採「累乘」設計（每次購買加上固定 %）：
//   速度強化 +15% / 攻擊力 +20% / 跳躍 +10%
//   買 N 次 → 倍率 = 1 + N × 比例（線性，避免指數爆炸）
//   想改成 buy-once 鎖死 → 在 _applyEffect 加 `if (this._owned[name]) return;` 即可。

const STORAGE_KEY = 'farmer_baby_save_v1';
const INITIAL_MONEY = 300;

// 每次購買累加的倍率（不是「設為這個值」，是「加到目前倍率上」）
const SPEED_PER_BUY = 0.15;   // +15% 走路速度
const JUMP_PER_BUY = 0.10;    // +10% 跳躍初速
const DAMAGE_PER_BUY = 0.20;  // +20% 子彈傷害

interface SaveData {
    money: number;
    speedMul: number;
    jumpMul: number;
    damageMul: number;
    owned: { [name: string]: boolean };
}

class _GameStore {
    money: number = INITIAL_MONEY;
    speedMul: number = 1;
    jumpMul: number = 1;
    damageMul: number = 1;

    // 「擁有制」商品：購買後永久標記 true，給跨場景元件查詢用。
    // e.g. 復古收音機-1 / 奇怪寶藏 — 不是改 stat，而是「擁有 → 解鎖按鍵」。
    // 用 plain object 不用 Set —— JSON.stringify 直接吃，省序列化邏輯。
    private _owned: { [name: string]: boolean } = {};

    // 狀態變化監聽（observer pattern）— 任何寫入（buy / addMoney / resetMoney）後都會通知。
    // 用途：ShopController 顯示 $XX Label 要跟 RadioController 加錢同步刷新。
    // 用陣列不用 cc.EventTarget 因為 GameStore 不是 cc.Node，沒這個基底；自己 push/splice 最直接。
    private _listeners: Array<() => void> = [];

    constructor() {
        this._load();
    }

    /** 查某商品是否已購買（RadioController / 其他跨場景元件用） */
    hasItem(name: string): boolean {
        return !!this._owned[name];
    }

    /** 監聽任何狀態變化（money / mul / owned 改變後都會 callback）。在 onLoad / start 註冊。 */
    onChange(cb: () => void): void {
        this._listeners.push(cb);
    }

    /** 取消監聽。一定要在 onDestroy 配對呼叫，不然場景切換後舊元件還在 callback list 裡 → 觸發已死 component 報錯 */
    offChange(cb: () => void): void {
        const i = this._listeners.indexOf(cb);
        if (i >= 0) this._listeners.splice(i, 1);
    }

    /**
     * 嘗試購買：金幣夠 → 扣錢 + 套用效果 + 存檔 → 回 true
     * 金幣不夠 → 不扣錢 → 回 false
     *
     * itemName 用商品中文名當 key（跟 ShopController.itemDatas 的 name 同步），
     * 之後加新商品只要在 _applyEffect switch 加 case。
     */
    tryBuy(price: number, itemName: string): boolean {
        if (this.money < price) return false;
        this.money -= price;
        this._applyEffect(itemName);
        this._save();
        return true;
    }

    /** 測試 / debug 用：把金幣 + 加成 + 已購清單歸零，存檔同步清掉 */
    reset(): void {
        this.money = INITIAL_MONEY;
        this.speedMul = 1;
        this.jumpMul = 1;
        this.damageMul = 1;
        this._owned = {};
        cc.sys.localStorage.removeItem(STORAGE_KEY);
    }

    /** 開發測試用：直接加錢 */
    addMoney(amount: number): void {
        this.money += amount;
        this._save();
    }

    /**
     * 只重置金幣為初始值（強化倍率 / 已購清單保留）。
     * 進入 start scene 時呼叫 — 每場新遊戲金幣歸 100、上次買的強化還在。
     */
    resetMoney(): void {
        this.money = INITIAL_MONEY;
        this._save();
    }

    private _applyEffect(name: string): void {
        switch (name) {
            case '速度強化':
                this.speedMul += SPEED_PER_BUY;
                break;
            case '攻擊力提升':
                this.damageMul += DAMAGE_PER_BUY;
                break;
            case '跳躍高度增加':
                this.jumpMul += JUMP_PER_BUY;
                break;

            // 「擁有制」商品 — 不改 stat，只標記擁有。
            // 實際行為（播音效 / 加錢）由 ShopController 自己 / RadioController 跨場景元件處理。
            case '破房的聲音':
                // 播音效在 ShopController 那邊處理（購買瞬間響一次）。
                // 這裡照樣標 owned，未來想做「擁有後在某處再播一次」也方便。
                this._owned[name] = true;
                break;
            case '復古收音機-1':
                // 標記後，RadioController 看到 hasItem('復古收音機-1')=true
                // → 任何場景按 9 都會播 radio1Clip
                this._owned[name] = true;
                break;
            case '奇怪寶藏':
                // 標記後，RadioController 看到 hasItem('奇怪寶藏')=true
                // → 任何場景按 0 都會 addMoney(10)
                this._owned[name] = true;
                break;

            default:
                cc.warn('[GameStore] 未實作的商品效果:', name);
        }
    }

    private _save(): void {
        const data: SaveData = {
            money: this.money,
            speedMul: this.speedMul,
            jumpMul: this.jumpMul,
            damageMul: this.damageMul,
            owned: this._owned,
        };
        cc.sys.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));

        // 所有寫入都會走 _save → 在這裡通知 listener 最不會漏。
        // try/catch 包起來：某個 listener 噴錯不該影響其他 listener / 存檔流程。
        for (let i = 0; i < this._listeners.length; i++) {
            try { this._listeners[i](); } catch (e) { cc.warn('[GameStore] listener error', e); }
        }
    }

    private _load(): void {
        const raw = cc.sys.localStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        try {
            const data = JSON.parse(raw) as SaveData;
            if (typeof data.money === 'number') this.money = data.money;
            if (typeof data.speedMul === 'number') this.speedMul = data.speedMul;
            if (typeof data.jumpMul === 'number') this.jumpMul = data.jumpMul;
            if (typeof data.damageMul === 'number') this.damageMul = data.damageMul;
            if (data.owned && typeof data.owned === 'object') this._owned = data.owned;
        } catch (e) {
            cc.warn('[GameStore] 存檔解析失敗，重置為初始值', e);
            this.reset();
        }
    }
}

// 整個 runtime 共用同一份。第一次有任何檔案 import GameStore，constructor 跑一次 _load()，
// 之後每個場景的 ShopController / Player / Bullet 都讀寫這份。
export const GameStore = new _GameStore();

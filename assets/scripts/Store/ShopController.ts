// 金幣 / 強化加成統一存在 GameStore（module 單例 + localStorage），
// 場景切換 / 重整瀏覽器都不會丟。
import { GameStore } from './GameStore';

const {ccclass, property} = cc._decorator;

@ccclass
export default class ShopController extends cc.Component {

    @property(cc.Label)
    nameLabel: cc.Label = null;

    @property(cc.Label)
    priceLabel: cc.Label = null;

    @property(cc.Label)
    descLabel: cc.Label = null;

    // 用來顯示玩家目前擁有多少錢的 Label
    @property(cc.Label)
    moneyLabel: cc.Label = null;

    @property(cc.Node)
    itemsContainer: cc.Node = null;

    // ESC 回到的場景名 — 預設 World，跟 StoreEnterArea.storeSceneName 對稱。
    // 場景名要改的話直接在 Inspector 改，不用動 ts。
    @property({ displayName: 'ESC 返回場景', tooltip: '按 ESC 離開商店時切換到的場景；預設 World' })
    backSceneName: string = 'World';

    // 「破房的聲音」商品成功購買瞬間播一次，僅此而已 — 完全沒用 (joke item)。
    // 不需要跨場景，所以掛在 ShopController 而不是 RadioController。
    @property({ type: cc.AudioClip, displayName: '破房的聲音 SFX', tooltip: '購買「破房的聲音」商品時播一次' })
    brokenHouseSfx: cc.AudioClip = null!;

    @property({ displayName: '破房 SFX 音量 (0–1)', range: [0, 1, 0.05] })
    brokenHouseVolume: number = 1.0;

    // === 已經替換為你的 6 個新商品 ===
    private itemDatas = [
        { name: "速度強化", price: 30, desc: "注射後能讓雙腿變得輕盈，永久提升移動速度。" },
        { name: "攻擊力提升", price: 50, desc: "經過特殊打磨的武器強化組件，能造成更大傷害。" },
        { name: "跳躍高度增加", price: 40, desc: "神秘的彈簧靴配件，讓你能夠跳過更高的障礙物。" },
        { name: "破房的聲音", price: 10, desc: "完全沒用，會發出讓你破房的聲音。" },
        { name: "復古收音機-1", price: 100, desc: "買下後，任何場景按下「9」可播放神秘音樂。" },
        { name: "奇怪寶藏", price: 150, desc: "買下後，任何場景按下「0」會掉出 10 元。" },
    ];

    private currentIndex: number = 0; 
    
    // 用來記住每個物品「排版時設定的初始大小」
    private originalScales: number[] = [];

    // GameStore 通知 callback — 用 arrow function 自綁 this，
    // 也方便 onChange / offChange 拿同一個 reference 配對。
    private _onStoreChanged = () => {
        this.updateMoneyDisplay();
        this.updateBoard(this.currentIndex); // 同時刷新「錢不夠 → 標價變紅」狀態
    };

    start () {
        // 遊戲一開始，先把大家原本的 Scale 存進陣列裡記起來
        for (let i = 0; i < this.itemsContainer.children.length; i++) {
            this.originalScales.push(this.itemsContainer.children[i].scale);
        }

        cc.systemEvent.on(cc.SystemEvent.EventType.KEY_DOWN, this.onKeyDown, this);

        // 訂閱 GameStore 變化：在商店裡按 0（奇怪寶藏加錢）也會即時刷新 Label
        GameStore.onChange(this._onStoreChanged);

        // 遊戲開始時，先更新一次金幣顯示
        this.updateMoneyDisplay();
        this.updateBoard(this.currentIndex);
    }

    onDestroy () {
        cc.systemEvent.off(cc.SystemEvent.EventType.KEY_DOWN, this.onKeyDown, this);
        GameStore.offChange(this._onStoreChanged);
    }

    // 更新畫面上玩家金幣數量的顯示（讀的是 GameStore 的全域值）
    updateMoneyDisplay () {
        if (this.moneyLabel) {
            this.moneyLabel.string = `$ ${GameStore.money}`;
        }
    }

    onKeyDown (event: cc.Event.EventKeyboard) {
        if (event.keyCode === cc.macro.KEY.left || event.keyCode === cc.macro.KEY.a) {
            this.currentIndex--;
            if (this.currentIndex < 0) this.currentIndex = this.itemDatas.length - 1; 
            this.updateBoard(this.currentIndex);
        }
        else if (event.keyCode === cc.macro.KEY.right || event.keyCode === cc.macro.KEY.d) {
            this.currentIndex++;
            if (this.currentIndex >= this.itemDatas.length) this.currentIndex = 0; 
            this.updateBoard(this.currentIndex);
        }
        // 按下 Enter 鍵或空白鍵購買商品
        else if (event.keyCode === cc.macro.KEY.enter || event.keyCode === cc.macro.KEY.space) {
            this.buyCurrentItem();
        }
        // 按 ESC 離開商店回 World — 金幣 / 加成都在 GameStore，跨場景不會掉
        else if (event.keyCode === cc.macro.KEY.escape) {
            cc.log(`[ShopController] ESC 離開商店 → ${this.backSceneName}`);
            cc.director.loadScene(this.backSceneName);
        }
    }

    onItemClicked (event: cc.Event.EventCustom, customEventData: string) {
        const index = parseInt(customEventData);
        this.currentIndex = index;
        this.updateBoard(this.currentIndex);
    }

    // 如果你想在畫面上做一顆「購買按鈕」給滑鼠點，可以綁定這個 function
    onBuyButtonClicked () {
        this.buyCurrentItem();
    }

    // 核心購買扣錢邏輯 — 扣錢 + 套用效果都交給 GameStore.tryBuy 一次處理
    buyCurrentItem () {
        const currentItem = this.itemDatas[this.currentIndex];

        const ok = GameStore.tryBuy(currentItem.price, currentItem.name);
        if (ok) {
            // 扣完錢、加成已套用、localStorage 已存 → 只要刷新 UI
            this.updateMoneyDisplay();
            this.updateBoard(this.currentIndex);
            cc.log(`成功購買：${currentItem.name}（剩 $${GameStore.money}）`);

            // 「破房的聲音」joke 商品 — 購買瞬間播一次就結束
            // （描述寫「完全沒用」，所以不存 owned 也行；但 GameStore._applyEffect 那邊已順手標 owned 保留彈性）
            if (currentItem.name === '破房的聲音' && this.brokenHouseSfx) {
                cc.audioEngine.play(this.brokenHouseSfx, false, this.brokenHouseVolume);
            }
        } else {
            // 錢不夠：可以在這裡加入音效或畫面震動提示
            cc.log("金幣不足，無法購買！");
        }
    }

    updateBoard (index: number) {
        const data = this.itemDatas[index];
        this.nameLabel.string = data.name;
        this.priceLabel.string = `$ ${data.price}`;
        this.descLabel.string = data.desc;

        // === 判斷錢不夠時標價變紅色 ===
        if (GameStore.money < data.price) {
            this.priceLabel.node.color = cc.Color.RED; // 錢不夠變紅字
        } else {
            this.priceLabel.node.color = cc.Color.WHITE; // 錢夠恢復白字
        }

        for (let i = 0; i < this.itemsContainer.children.length; i++) {
            let itemNode = this.itemsContainer.children[i];
            let baseScale = this.originalScales[i]; // 拿出這件物品原本的大小

            if (i === index) {
                itemNode.scale = baseScale * 1.2; // 基於原本的大小放大 20%
            } else {
                itemNode.scale = baseScale;       // 恢復原本的大小
            }
        }
    }
}
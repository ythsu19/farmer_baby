const {ccclass, property} = cc._decorator;

@ccclass
export default class ShopController extends cc.Component {

    @property(cc.Label)
    nameLabel: cc.Label = null;

    @property(cc.Label)
    priceLabel: cc.Label = null;

    @property(cc.Label)
    descLabel: cc.Label = null;
    
    // 新增：用來顯示玩家目前擁有多少錢的 Label
    @property(cc.Label)
    moneyLabel: cc.Label = null; 
    
    @property(cc.Node)
    itemsContainer: cc.Node = null; 

    // 新增：模擬玩家身上的初始金幣數量 (這裡先設定 100 元測試)
    private playerMoney: number = 100; 

    private itemDatas = [
        { name: "魔力藥劑", price: 30, desc: "散發著奇異光芒的藥劑，可恢復少許魔力。" },
        { name: "生命藥水", price: 20, desc: "甘甜的紅色藥水，飲用後可恢復 50 點生命值。" },
        { name: "加速靴", price: 120, desc: "裝備後增加 15% 移動速度，讓你靈活穿梭於戰場。" },
        { name: "勇者之盾", price: 150, desc: "堅固的盾牌，舉起時可格擋前方的飛行物與近戰傷害。" },
        { name: "爆裂炸彈", price: 50, desc: "威力強大的炸彈，能造成範圍傷害。" },
        { name: "力量長劍", price: 200, desc: "鍛造精良的長劍，能大幅提升你的基礎攻擊力。" },
    ];

    private currentIndex: number = 0; 
    
    // 用來記住每個物品「排版時設定的初始大小」
    private originalScales: number[] = []; 

    start () {
        // 遊戲一開始，先把大家原本的 Scale 存進陣列裡記起來
        for (let i = 0; i < this.itemsContainer.children.length; i++) {
            this.originalScales.push(this.itemsContainer.children[i].scale);
        }

        cc.systemEvent.on(cc.SystemEvent.EventType.KEY_DOWN, this.onKeyDown, this);
        
        // 遊戲開始時，先更新一次金幣顯示
        this.updateMoneyDisplay();
        this.updateBoard(this.currentIndex);
    }

    onDestroy () {
        cc.systemEvent.off(cc.SystemEvent.EventType.KEY_DOWN, this.onKeyDown, this);
    }

    // 新增：更新畫面上玩家金幣數量的顯示
    updateMoneyDisplay () {
        if (this.moneyLabel) {
            this.moneyLabel.string = `$ ${this.playerMoney}`;
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
        // 新增：按下 Enter 鍵或空白鍵購買商品
        else if (event.keyCode === cc.macro.KEY.enter || event.keyCode === cc.macro.KEY.space) {
            this.buyCurrentItem();
        }
    }

    onItemClicked (event: cc.Event.EventCustom, customEventData: string) {
        const index = parseInt(customEventData);
        this.currentIndex = index;
        this.updateBoard(this.currentIndex);
    }

    // 新增：如果你想在畫面上做一顆「購買按鈕」給滑鼠點，可以綁定這個 function
    onBuyButtonClicked () {
        this.buyCurrentItem();
    }

    // 新增：核心購買扣錢邏輯
    buyCurrentItem () {
        const currentItem = this.itemDatas[this.currentIndex];

        // 判斷錢夠不夠
        if (this.playerMoney >= currentItem.price) {
            // 錢夠：扣錢、更新金幣文字、更新面板(為了刷新紅字狀態)
            this.playerMoney -= currentItem.price;
            this.updateMoneyDisplay();
            this.updateBoard(this.currentIndex); 
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

        // === 新增：判斷錢不夠時標價變紅色 ===
        if (this.playerMoney < data.price) {
            this.priceLabel.node.color = cc.Color.RED; // 錢不夠變紅字
        } else {
            this.priceLabel.node.color = cc.Color.WHITE; // 錢夠恢復白字 (如果是其他顏色可改成 new cc.Color(R, G, B))
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
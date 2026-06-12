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

    // 模擬玩家身上的初始金幣數量 (這裡先設定 100 元測試)
    private playerMoney: number = 100; 

    // === 已經替換為你的 6 個新商品 ===
    private itemDatas = [
        { name: "速度強化", price: 30, desc: "注射後能讓雙腿變得輕盈，永久提升移動速度。" },
        { name: "攻擊力提升", price: 50, desc: "經過特殊打磨的武器強化組件，能造成更大傷害。" },
        { name: "跳躍高度增加", price: 40, desc: "神秘的彈簧靴配件，讓你能夠跳過更高的障礙物。" },
        { name: "語音包 A", price: 100, desc: "解鎖專屬的嘲諷與戰鬥語音包 A 組合。" },
        { name: "語音包 B", price: 100, desc: "解鎖充滿魔性的搞笑互動語音包 B 組合。" },
        { name: "語音包 C", price: 150, desc: "解鎖史詩級的隱藏劇情配音與特效語音包 C 組合。" },
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

    // 更新畫面上玩家金幣數量的顯示
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
        // 按下 Enter 鍵或空白鍵購買商品
        else if (event.keyCode === cc.macro.KEY.enter || event.keyCode === cc.macro.KEY.space) {
            this.buyCurrentItem();
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

    // 核心購買扣錢邏輯
    buyCurrentItem () {
        const currentItem = this.itemDatas[this.currentIndex];

        // 判斷錢夠不夠
        if (this.playerMoney >= currentItem.price) {
            // 錢夠：扣錢、更新金幣文字、更新面板(為了刷新紅字狀態)
            this.playerMoney -= currentItem.price;
            this.updateMoneyDisplay();
            this.updateBoard(this.currentIndex); 
            cc.log(`成功購買：${currentItem.name}`);
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
        if (this.playerMoney < data.price) {
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
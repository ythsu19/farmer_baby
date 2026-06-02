// TutorialHint — 教學提示 UI 元件（掛在 TutorialHint.prefab 上）
//
// 用途：
//   顯示一段提示文字 + 一支指向目標節點的箭頭，淡入淡出。
//
// 預期 prefab 結構：
//   TutorialHint (本元件)
//   ├── Background  (cc.Sprite，半透明面板)
//   ├── Label       (cc.Label，提示文字)
//   └── Arrow       (cc.Sprite，箭頭素材畫朝右；每幀算角度指向 target)
//
// 對外 API：
//   show(text, anchorTarget?)    — 顯示提示；anchorTarget 給才會出現箭頭
//   markCompleted()              — 文字前加 ✓ 並停掉箭頭追蹤（給 manager 在切下一步前秀完成感）
//   hide()                       — 淡出
//
// 設計取捨：
//   - 不在這支處理「顯示什麼步驟」的邏輯 — 純被動 view，由 TutorialManager 推內容
//   - 箭頭每幀算角度而不是 emit/listener — 玩家在動、target 也可能在動，update 最穩
//   - 沒拉 arrowNode → 純文字提示也能用（箭頭只是錦上添花）

const { ccclass, property } = cc._decorator;

@ccclass
export default class TutorialHint extends cc.Component {

    @property({ type: cc.Label, displayName: '提示文字 Label' })
    label: cc.Label = null;

    @property({ type: cc.Node, displayName: '箭頭節點 (可空)', tooltip: '留空 → 不顯示箭頭；給節點 → 會旋轉指向 show() 傳入的 anchorTarget' })
    arrowNode: cc.Node = null;

    @property({ displayName: '淡入時間 (s)' })
    fadeInDuration: number = 0.2;

    @property({ displayName: '淡出時間 (s)' })
    fadeOutDuration: number = 0.2;

    @property({ displayName: '箭頭距 target 半徑 (px)', tooltip: '箭頭出現在 target 周圍這個距離；0 = 蓋在 target 上' })
    arrowRadius: number = 60;

    private _anchorTarget: cc.Node = null;
    private _trackingArrow: boolean = false;

    onLoad() {
        this.node.opacity = 0;
        this.node.active = false;
        if (this.arrowNode) this.arrowNode.active = false;
    }

    /**
     * 顯示提示。anchorTarget 給才會出現箭頭。
     */
    show(text: string, anchorTarget?: cc.Node) {
        if (this.label) this.label.string = text;
        this._anchorTarget = anchorTarget || null;
        this._trackingArrow = !!(this.arrowNode && this._anchorTarget);
        if (this.arrowNode) this.arrowNode.active = this._trackingArrow;

        this.node.active = true;
        this.node.stopAllActions();
        cc.tween(this.node)
            .to(this.fadeInDuration, { opacity: 255 })
            .start();
    }

    /**
     * 步驟達成 → 文字前打 ✓，停止箭頭追蹤但保留顯示（給 manager 等 nextDelay 切下一步）。
     */
    markCompleted() {
        if (this.label && this.label.string && this.label.string.indexOf('✓') !== 0) {
            this.label.string = '✓ ' + this.label.string;
        }
        this._trackingArrow = false;
        if (this.arrowNode) this.arrowNode.active = false;
    }

    /**
     * 淡出後 disable 節點（之後 show() 會再啟用）。
     */
    hide() {
        this._trackingArrow = false;
        if (this.arrowNode) this.arrowNode.active = false;
        this.node.stopAllActions();
        cc.tween(this.node)
            .to(this.fadeOutDuration, { opacity: 0 })
            .call(() => { this.node.active = false; })
            .start();
    }

    update(_dt: number) {
        if (!this._trackingArrow) return;
        if (!this.arrowNode || !this._anchorTarget || !this._anchorTarget.isValid) {
            this._trackingArrow = false;
            if (this.arrowNode) this.arrowNode.active = false;
            return;
        }

        // 把 target 的世界座標換到 hint 自己的本地座標
        const targetWorld = this._anchorTarget.parent
            ? this._anchorTarget.parent.convertToWorldSpaceAR(this._anchorTarget.position)
            : cc.v2(this._anchorTarget.x, this._anchorTarget.y);

        const hintParent = this.node.parent;
        const targetLocal = hintParent
            ? hintParent.convertToNodeSpaceAR(cc.v3(targetWorld.x, targetWorld.y, 0))
            : cc.v3(targetWorld.x, targetWorld.y, 0);

        const dx = targetLocal.x - this.node.x;
        const dy = targetLocal.y - this.node.y;
        const len = Math.sqrt(dx * dx + dy * dy);

        // 箭頭擺在 hint 中心 → target 方向的 arrowRadius 距離
        if (len > 0.0001) {
            const ux = dx / len, uy = dy / len;
            this.arrowNode.x = ux * this.arrowRadius;
            this.arrowNode.y = uy * this.arrowRadius;
            // 素材畫朝右，0 度朝右
            this.arrowNode.angle = Math.atan2(uy, ux) * 180 / Math.PI;
        }
    }
}

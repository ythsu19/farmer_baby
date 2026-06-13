// CameraFollow — 鏡頭跟隨角色（橫向卷軸 / side-scroller 風）
//
// 用途：
//   每幀把鏡頭 x 平滑追到 target.x；y 預設鎖住不跟（跳躍時鏡頭不會晃）。
//
// 預期擺放：
//   掛在 **Main Camera** 節點上（Canvas 下預設那顆）。Inspector 拉 target = Player。
//   不要掛在 Player 自己 → 鏡頭應該獨立於跟隨目標。
//
// 為什麼 lateUpdate 而不是 update？
//   Player 的物理移動發生在 update / fixedUpdate；如果鏡頭也在 update 追，
//   有機率比 Player 早一幀算 → 鏡頭看到 Player 前一幀的位置 → 視覺抖動。
//   lateUpdate 保證所有 update 都跑完才算鏡頭 → 永遠看到當幀位置。
//
// 為什麼 1 - exp(-dt/t) 而不是固定 lerp factor？
//   固定 factor 在不同 fps 下感覺會不一樣（60fps 跟 30fps 平滑速度差兩倍）。
//   指數衰減的 ratio 跟 dt 掛勾，幀率變動感覺一致 — 仿 Unity SmoothDamp 簡化版。

const { ccclass, property } = cc._decorator;

@ccclass
export default class CameraFollow extends cc.Component {

    @property({ type: cc.Node, displayName: '跟隨目標', tooltip: '通常拉 Player 節點' })
    target: cc.Node = null;

    @property({ displayName: '平滑時間 (s)', tooltip: '越小越貼角色（0 = 瞬間貼齊）；越大鏡頭追得越慢' })
    smoothTime: number = 0.15;

    @property({ displayName: '跟隨 Y', tooltip: '不勾 → 鎖 y 在初始值，跳躍時鏡頭不晃（橫向卷軸常用）；勾起 → y 也跟（Metroidvania 用）' })
    followY: boolean = false;

    @property({ displayName: 'X 偏移', tooltip: '正值 → 鏡頭中心比角色偏右（給玩家更多前方視野）；先設 0，之後可微調' })
    offsetX: number = 0;

    @property({ displayName: '左邊界 X', tooltip: '鏡頭中心最左能到的「世界 x」；leftBound === rightBound 表示不限制' })
    leftBound: number = 0;

    @property({ displayName: '右邊界 X', tooltip: '鏡頭中心最右能到的「世界 x」' })
    rightBound: number = 0;

    /** Camera 節點的初始世界 y（followY=false 時鎖在這個 y） */
    private _initialWorldY: number = 0;

    onLoad() {
        const wp = this.node.parent
            ? this.node.parent.convertToWorldSpaceAR(this.node.position)
            : cc.v2(this.node.x, this.node.y);
        this._initialWorldY = wp.y;

        // Sanity check：CameraFollow 必須掛在「有 cc.Camera 元件的節點」上才有用。
        // 掛在空節點 → 節點會移動但畫面不會跟著動（沒人 render），子彈瞄準計算會跟畫面脫鉤。
        if (!this.getComponent(cc.Camera)) {
            cc.warn(
                '[CameraFollow] 這個元件掛的節點「' + this.node.name + '」沒有 cc.Camera 元件！' +
                ' 節點會移動但畫面不會跟著動。' +
                ' 請改掛到 Canvas 下的 Main Camera 節點（或別的有 cc.Camera 元件的節點）。'
            );
        }
    }

    lateUpdate(dt: number) {
        if (!this.target || !this.target.isValid) return;

        // ── 用「世界座標」算，不依賴 Player / Camera 是否同 parent ──
        //
        // 為什麼？之前用 local x（this.target.x → this.node.x）會在 Player 跟 Camera
        // 的父節點不同時失準。例如 Player 在 Canvas/World/Player（World 有偏移）、
        // Camera 在 Canvas/Main Camera → 兩者 local x 不在同一個座標系，
        // 設 camera.x = player.x 不會讓兩個 node 的 world x 對齊。
        // 改用 world coords：永遠正確。

        const targetWorld = this.target.parent
            ? this.target.parent.convertToWorldSpaceAR(this.target.position)
            : cc.v2(this.target.x, this.target.y);

        const myWorld = this.node.parent
            ? this.node.parent.convertToWorldSpaceAR(this.node.position)
            : cc.v2(this.node.x, this.node.y);

        // 算目標世界 x（加 offsetX、套世界座標的左右邊界）
        let nextWorldX = targetWorld.x + this.offsetX;
        if (this.leftBound !== this.rightBound) {
            if (nextWorldX < this.leftBound) nextWorldX = this.leftBound;
            if (nextWorldX > this.rightBound) nextWorldX = this.rightBound;
        }

        const newWorldX = this._approach(myWorld.x, nextWorldX, dt);
        const newWorldY = this.followY
            ? this._approach(myWorld.y, targetWorld.y, dt)
            : this._initialWorldY;

        // 把 world 轉回 camera 自己的 local 設定
        const targetLocal = this.node.parent
            ? this.node.parent.convertToNodeSpaceAR(cc.v3(newWorldX, newWorldY, 0))
            : cc.v3(newWorldX, newWorldY, 0);
        this.node.setPosition(targetLocal.x, targetLocal.y);
    }

    /** 指數衰減逼近：smoothTime 越小越貼，==0 直接貼 */
    private _approach(current: number, target: number, dt: number): number {
        if (this.smoothTime <= 0) return target;
        const ratio = 1 - Math.exp(-dt / this.smoothTime);
        return current + (target - current) * ratio;
    }
}

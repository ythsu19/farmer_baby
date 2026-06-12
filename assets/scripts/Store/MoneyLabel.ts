// MoneyLabel — 通用「顯示 GameStore.money 並自動同步」的 Label 元件
//
// 用法：
//   把這個元件掛到任何 cc.Label 節點上（@requireComponent 保證同節點有 Label）。
//   onLoad 立刻顯示當下金額 + 訂閱 GameStore.onChange → 之後 buy / 按 0 加錢 / resetMoney
//   都會自動刷新文字，不需要外部呼叫任何 update。
//
// 為什麼不在 ShopController / 其他 controller 直接 setString？
//   會耦合：每個顯示金錢的 Label 都要找到自己的 controller、然後 controller 又要記哪些 Label 要刷。
//   做成一個元件「自己看顧自己」，掛到 Tutorial / World / store 哪個 Label 上都是同一支 ts、零設定。
//
// 為什麼 callback 用 arrow function field？
//   `() => this._refresh()` 自動綁 this，
//   而且 onLoad / onDestroy 拿到的是同一個 reference，offChange 才配對得到。
//   寫成 method + bind 也行，但每次 bind 都產生新 function，offChange 會失敗 → 場景切換 leak listener。

import { GameStore } from './GameStore';

const { ccclass, property, requireComponent } = cc._decorator;

@ccclass
@requireComponent(cc.Label)
export default class MoneyLabel extends cc.Component {

    @property({ displayName: '金幣前綴', tooltip: '顯示在數字前的字串，預設 "$ "。要 "金幣: " / "💰 " 都自己改' })
    prefix: string = '$ ';

    @property({ displayName: '金幣後綴', tooltip: '顯示在數字後的字串，預設空。要 " 元" 就填這格' })
    suffix: string = '';

    private _label: cc.Label = null;
    private _onStoreChanged = () => { this._refresh(); };

    onLoad() {
        this._label = this.getComponent(cc.Label);
        this._refresh();
        GameStore.onChange(this._onStoreChanged);
    }

    onDestroy() {
        GameStore.offChange(this._onStoreChanged);
    }

    private _refresh() {
        if (!this._label) return;
        this._label.string = this.prefix + GameStore.money + this.suffix;
    }
}

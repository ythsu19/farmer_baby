// LeaderboardUI — 排行榜畫面（讀 LeaderboardManager 顯示前 N 名）
//
// 顯示做法（不用 ScrollView 也行，先做簡單的「複製列」版）：
//   準備一個「列範本」節點 rowTemplate（裡面放名次/暱稱/時間三個 Label），
//   程式抓前 N 名，每名複製一份範本、填資料、排進 content 容器。
//
// 在編輯器拖好：
//   - content：放列的容器節點（建議掛 cc.Layout 設 Vertical → 自動排版）
//   - rowTemplate：一個列範本節點（裡面有 rankLabel/nameLabel/timeLabel 三個 Label 子節點）
//                  範本本身會被隱藏，只當複製來源
//   - rowTemplate 的三個 Label 子節點名稱要叫：rankLabel / nameLabel / timeLabel
//   - statusLabel：載入中/錯誤訊息（選填）
//   - topCount：要顯示前幾名
//
// 用法：
//   開啟排行榜畫面時呼叫 refresh()（或綁按鈕 onRefreshClick）。

import LeaderboardManager from './LeaderboardManager';

const { ccclass, property } = cc._decorator;

@ccclass
export default class LeaderboardUI extends cc.Component {

    @property({ type: cc.Node, tooltip: '列的容器（建議掛 cc.Layout Vertical 自動排版）' })
    content: cc.Node = null;

    @property({ type: cc.Node, tooltip: '列範本：含 rankLabel/nameLabel/timeLabel 三個 Label 子節點。會被隱藏當複製來源' })
    rowTemplate: cc.Node = null;

    @property({ type: cc.Label, tooltip: '狀態/錯誤訊息（選填）' })
    statusLabel: cc.Label = null;

    @property({ tooltip: '顯示前幾名' })
    topCount: number = 10;

    @property({ tooltip: '一開始（onLoad）就自動載入排行榜' })
    autoLoad: boolean = true;

    @property({ type: cc.Node, tooltip: '開啟/關閉鈕要顯示隱藏的 panel（拖整個排行榜 panel 容器）。留空 → 控制自己這個節點' })
    panelNode: cc.Node = null;

    @property({ type: cc.Node, tooltip: '「開啟排行榜」按鈕節點。開啟 panel 時藏它、關閉時顯示回來。留空 → 不控制' })
    openButtonNode: cc.Node = null;

    @property({ tooltip: '勾 → 一開始隱藏 panel，要按開啟鈕才出現' })
    hidePanelAtStart: boolean = true;

    onLoad() {
        // 範本先藏起來（只當複製來源，不直接顯示）
        if (this.rowTemplate) this.rowTemplate.active = false;
        // 一開始隱藏 panel（要按開啟鈕才顯示）
        if (this.panelNode && this.hidePanelAtStart) {
            this.panelNode.active = false;
        }
        // autoLoad 只在「一開始就顯示」時才載入；隱藏時改成開啟才載入
        if (this.autoLoad && !(this.panelNode && this.hidePanelAtStart)) {
            this.refresh();
        }
    }

    /** 開啟鈕：顯示排行榜 panel + 載入資料，並把開啟鈕藏起來 */
    public onOpenClick() {
        const target = this.panelNode || this.node;
        target.active = true;
        if (this.openButtonNode) this.openButtonNode.active = false;
        this.refresh();   // 每次開啟都重新抓最新榜
    }

    /** 關閉鈕：隱藏排行榜 panel，並把開啟鈕顯示回來 */
    public onCloseClick() {
        const target = this.panelNode || this.node;
        target.active = false;
        if (this.openButtonNode) this.openButtonNode.active = true;
    }

    /** 重新整理排行榜（綁按鈕用 onRefreshClick 也可） */
    public onRefreshClick() {
        this.refresh();
    }

    public async refresh() {
        if (!this.content || !this.rowTemplate) {
            cc.warn('[LeaderboardUI] 沒設定 content 或 rowTemplate');
            return;
        }
        this._setStatus('載入中…');
        this._clearRows();

        try {
            const list = await LeaderboardManager.getTop(this.topCount);
            if (list.length === 0) {
                this._setStatus('還沒有任何紀錄');
                return;
            }
            for (let i = 0; i < list.length; i++) {
                this._addRow(i + 1, list[i].name, LeaderboardManager.formatTime(list[i].timeMs));
            }
            this._setStatus('');   // 成功清掉訊息
        } catch (e) {
            this._setStatus('載入失敗：' + (e && (e as any).message ? (e as any).message : '未知'));
        }
    }

    /** 複製一列範本、填資料、排進 content */
    private _addRow(rank: number, name: string, timeStr: string) {
        const row = cc.instantiate(this.rowTemplate);
        row.active = true;
        row.parent = this.content;

        this._setChildLabel(row, 'rankLabel', String(rank));
        this._setChildLabel(row, 'nameLabel', name);
        this._setChildLabel(row, 'timeLabel', timeStr);
    }

    /** 找 row 底下名為 childName 的子節點，設它的 Label 文字 */
    private _setChildLabel(row: cc.Node, childName: string, text: string) {
        const child = row.getChildByName(childName);
        if (!child) return;
        const label = child.getComponent(cc.Label);
        if (label) label.string = text;
    }

    /** 清掉現有的列（範本除外） */
    private _clearRows() {
        const kids = this.content.children.slice();
        for (const k of kids) {
            if (k === this.rowTemplate) continue;   // 別刪範本
            k.destroy();
        }
    }

    private _setStatus(msg: string) {
        if (this.statusLabel) {
            this.statusLabel.node.active = !!msg;
            this.statusLabel.string = msg;
        }
    }
}

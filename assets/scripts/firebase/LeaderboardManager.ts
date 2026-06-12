// LeaderboardManager — 通關時間排行榜（存 Firebase Firestore）
//
// 排名規則：通關時間越短越前面（timeMs 由小到大）。
//
// 資料結構（Firestore collection 'leaderboard'，每個玩家一筆，doc id = uid）：
//   { name: string, timeMs: number, uid: string, updatedAt: <server timestamp> }
//   用 uid 當 doc id → 同一玩家只留一筆，提交新成績時只在「更快」才覆蓋。
//
// 用法：
//   // 通關時提交成績（毫秒）
//   await LeaderboardManager.submitTime(85300, '阿寶');
//   // 讀前 10 名
//   const list = await LeaderboardManager.getTop(10);
//   // list = [{ name, timeMs, uid }, ...] 已照時間排好
//
// ⚠️ 只在 Web 平台有效（依賴 FirebaseLoader）。需先在 Firebase Console 開 Firestore。

import FirebaseLoader from './FirebaseLoader';
import AuthManager from './AuthManager';

export interface LeaderboardEntry {
    name: string;
    timeMs: number;
    uid: string;
}

export interface LbResult {
    ok: boolean;
    message?: string;
}

const COLLECTION = 'leaderboard';

export default class LeaderboardManager {

    private static async _db(): Promise<any> {
        await FirebaseLoader.ensureReady();
        const fb = (window as any).firebase;
        if (!fb || !fb.firestore) throw new Error('[Leaderboard] Firestore 未載入');
        return fb.firestore();
    }

    /**
     * 提交通關時間（毫秒）。只有比自己舊紀錄更快才會更新。
     * 需要先登入（用登入的 uid 當 doc id）；沒登入會用 name 當匿名 id。
     * @param timeMs 通關花費毫秒（越小越好）
     * @param name   顯示在榜上的暱稱
     */
    public static async submitTime(timeMs: number, name: string): Promise<LbResult> {
        if (!(timeMs > 0)) return { ok: false, message: '時間不正確' };
        if (!name || !name.trim()) return { ok: false, message: '請輸入暱稱' };

        try {
            const db = await this._db();
            const fb = (window as any).firebase;

            // 用登入 uid 當 doc id；沒登入 → 用暱稱當 id（匿名）
            const user = AuthManager.getCurrentUser();
            const docId = user ? user.uid : ('anon_' + name.trim());
            const uid = user ? user.uid : docId;

            const ref = db.collection(COLLECTION).doc(docId);
            const snap = await ref.get();

            // 已有紀錄且舊的更快或相同 → 不覆蓋（保留最佳）
            if (snap.exists) {
                const old = snap.data();
                if (old && typeof old.timeMs === 'number' && old.timeMs <= timeMs) {
                    return { ok: true, message: '沒有刷新紀錄（保留更快的成績）' };
                }
            }

            await ref.set({
                name: name.trim(),
                timeMs: Math.round(timeMs),
                uid: uid,
                updatedAt: fb.firestore.FieldValue.serverTimestamp(),
            });
            return { ok: true };
        } catch (e) {
            return { ok: false, message: this._err(e) };
        }
    }

    /**
     * 讀取前 N 名（時間由小到大）。
     * @param limit 取幾名（預設 10）
     */
    public static async getTop(limit: number = 10): Promise<LeaderboardEntry[]> {
        const db = await this._db();
        const query = db.collection(COLLECTION)
            .orderBy('timeMs', 'asc')
            .limit(limit);
        const snap = await query.get();

        const list: LeaderboardEntry[] = [];
        snap.forEach((doc: any) => {
            const d = doc.data();
            if (d && typeof d.timeMs === 'number') {
                list.push({ name: d.name || '???', timeMs: d.timeMs, uid: d.uid || doc.id });
            }
        });
        return list;
    }

    /** 把毫秒格式化成 mm:ss.SS（給 UI 顯示用） */
    public static formatTime(timeMs: number): string {
        const totalSec = timeMs / 1000;
        const m = Math.floor(totalSec / 60);
        const s = Math.floor(totalSec % 60);
        const cs = Math.floor((timeMs % 1000) / 10);   // 百分秒
        const pad = (n: number, w: number = 2) => n.toString().padStart(w, '0');
        return `${pad(m)}:${pad(s)}.${pad(cs)}`;
    }

    private static _err(e: any): string {
        const code = (e && e.code) ? e.code : '';
        if (code === 'permission-denied') return '沒有權限（請檢查 Firestore 安全規則）';
        if (code === 'unavailable') return '連線失敗，請檢查網路';
        return '排行榜錯誤：' + (e && e.message ? e.message : code || '未知');
    }
}

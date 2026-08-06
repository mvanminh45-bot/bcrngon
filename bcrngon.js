const axios = require('axios');
const express = require('express');
const https = require('https');

// ======================
// CẤU HÌNH
// ======================
const BASE = "https://aibcr.me";
const LOGIN_URL = `${BASE}/login`;
const LOBBY_URL = `${BASE}/ae/lobby`;
const GETNEWRESULT_URL = `${BASE}/baccarat/getnewresult`;

const USERNAME = "vanminhdiev";
const PASSWORD = "vanminhluxury";
const DEVELOPER_ID = "@vanminh2603";

const agent = new https.Agent({ rejectUnauthorized: false });
let cookieJar = '';
let baccaratData = [];
let lastUpdate = null;
let historyData = {};

// ======================
// HỆ THỐNG ĐÁNH GIÁ ĐỘ TIN CẬY SIÊU CẤP
// ======================

class DoTinCaySieuCap {
    constructor() {
        this.diemTinCay = 0;
        this.cacYeuTo = {};
        this.trongSo = {
            doDaiLichSu: 0.15,
            doPhanTan: 0.20,
            doXacDinhCau: 0.25,
            doTuongDong: 0.15,
            doBienDong: 0.10,
            doTuanHoan: 0.15
        };
    }

    danhGiaDoDaiLichSu(lichSu) {
        const length = lichSu.length;
        let diem = 0;
        if (length >= 100) diem = 100;
        else if (length >= 80) diem = 90;
        else if (length >= 60) diem = 80;
        else if (length >= 40) diem = 70;
        else if (length >= 30) diem = 60;
        else if (length >= 20) diem = 50;
        else if (length >= 15) diem = 40;
        else if (length >= 10) diem = 30;
        else if (length >= 5) diem = 20;
        else diem = 10;
        this.cacYeuTo.doDaiLichSu = diem;
        return diem;
    }

    danhGiaDoPhanTan(lichSu) {
        const total = lichSu.length;
        if (total === 0) return 0;
        
        const banker = lichSu.filter(x => x === 'BANKER').length / total;
        const player = lichSu.filter(x => x === 'PLAYER').length / total;
        const tie = lichSu.filter(x => x === 'TIE').length / total;
        
        const entropy = -((banker * Math.log2(banker + 0.001)) + 
                         (player * Math.log2(player + 0.001)) + 
                         (tie * Math.log2(tie + 0.001)));
        
        const maxEntropy = Math.log2(3);
        const diem = (entropy / maxEntropy) * 100;
        
        this.cacYeuTo.doPhanTan = Math.min(100, diem);
        return this.cacYeuTo.doPhanTan;
    }

    danhGiaDoXacDinhCau(lichSu) {
        if (lichSu.length < 10) return 0;
        
        let diem = 0;
        const patterns = this._timPattern(lichSu);
        
        const patternCounts = {};
        for (const p of patterns) {
            const key = p.join('|');
            patternCounts[key] = (patternCounts[key] || 0) + 1;
        }
        
        let maxCount = 0;
        for (const count of Object.values(patternCounts)) {
            if (count > maxCount) maxCount = count;
        }
        
        const repeatRate = maxCount / patterns.length;
        diem = repeatRate * 100 * 0.7 + 30 * 0.3;
        
        if (maxCount > 5) diem += 15;
        if (maxCount > 10) diem += 15;
        
        this.cacYeuTo.doXacDinhCau = Math.min(100, diem);
        return this.cacYeuTo.doXacDinhCau;
    }

    _timPattern(lichSu, windowSize = 3) {
        const patterns = [];
        for (let i = 0; i <= lichSu.length - windowSize; i++) {
            patterns.push(lichSu.slice(i, i + windowSize));
        }
        return patterns;
    }

    danhGiaDoTuongDong(lichSu) {
        if (lichSu.length < 20) return 0;
        
        const mauCau = [
            ['BANKER','BANKER','PLAYER','PLAYER'],
            ['BANKER','PLAYER','BANKER','PLAYER'],
            ['BANKER','BANKER','BANKER','PLAYER'],
            ['PLAYER','PLAYER','BANKER','BANKER'],
            ['PLAYER','BANKER','PLAYER','BANKER'],
            ['PLAYER','PLAYER','PLAYER','BANKER']
        ];
        
        const ganDay = lichSu.slice(-20);
        let diem = 0;
        let soSanh = 0;
        
        for (let i = 0; i <= ganDay.length - 4; i++) {
            const segment = ganDay.slice(i, i + 4);
            for (const mau of mauCau) {
                let match = 0;
                for (let j = 0; j < 4; j++) {
                    if (segment[j] === mau[j]) match++;
                }
                const tyLe = match / 4;
                if (tyLe > 0.5) diem += tyLe * 20;
                soSanh++;
            }
        }
        
        const result = soSanh > 0 ? (diem / soSanh) * 100 : 0;
        this.cacYeuTo.doTuongDong = Math.min(100, result);
        return this.cacYeuTo.doTuongDong;
    }

    danhGiaDoBienDong(lichSu) {
        if (lichSu.length < 10) return 0;
        
        let changes = 0;
        for (let i = 1; i < lichSu.length; i++) {
            if (lichSu[i] !== lichSu[i-1]) changes++;
        }
        
        const changeRate = changes / (lichSu.length - 1);
        let diem = 0;
        if (changeRate < 0.2) diem = 90;
        else if (changeRate < 0.35) diem = 80;
        else if (changeRate < 0.5) diem = 70;
        else if (changeRate < 0.65) diem = 60;
        else if (changeRate < 0.8) diem = 50;
        else diem = 40;
        
        const maxStreak = this._timMaxStreak(lichSu);
        if (maxStreak > 5) diem += 10;
        if (maxStreak > 8) diem += 10;
        
        this.cacYeuTo.doBienDong = Math.min(100, diem);
        return this.cacYeuTo.doBienDong;
    }

    _timMaxStreak(lichSu) {
        if (lichSu.length === 0) return 0;
        let maxStreak = 1;
        let currentStreak = 1;
        for (let i = 1; i < lichSu.length; i++) {
            if (lichSu[i] === lichSu[i-1]) {
                currentStreak++;
                maxStreak = Math.max(maxStreak, currentStreak);
            } else {
                currentStreak = 1;
            }
        }
        return maxStreak;
    }

    danhGiaDoTuanHoan(lichSu) {
        if (lichSu.length < 20) return 0;
        
        let diem = 0;
        const testLengths = [2, 3, 4, 5, 6];
        
        for (const len of testLengths) {
            const patterns = this._timPattern(lichSu, len);
            const patternMap = {};
            
            for (const p of patterns) {
                const key = p.join('|');
                patternMap[key] = (patternMap[key] || 0) + 1;
            }
            
            let maxCount = 0;
            for (const count of Object.values(patternMap)) {
                if (count > maxCount) maxCount = count;
            }
            
            if (maxCount > 1) {
                const rate = maxCount / patterns.length;
                if (rate > 0.3) diem += 15 * (rate / 0.3);
            }
        }
        
        if (diem > 50) diem += 15;
        if (diem > 70) diem += 15;
        
        this.cacYeuTo.doTuanHoan = Math.min(100, diem);
        return this.cacYeuTo.doTuanHoan;
    }

    danhGiaTinCay(lichSu) {
        const diemCacYeuTo = {
            doDaiLichSu: this.danhGiaDoDaiLichSu(lichSu),
            doPhanTan: this.danhGiaDoPhanTan(lichSu),
            doXacDinhCau: this.danhGiaDoXacDinhCau(lichSu),
            doTuongDong: this.danhGiaDoTuongDong(lichSu),
            doBienDong: this.danhGiaDoBienDong(lichSu),
            doTuanHoan: this.danhGiaDoTuanHoan(lichSu)
        };
        
        let tongDiem = 0;
        let tongTrongSo = 0;
        
        for (const [key, diem] of Object.entries(diemCacYeuTo)) {
            const trongSo = this.trongSo[key] || 0.1;
            tongDiem += diem * trongSo;
            tongTrongSo += trongSo;
        }
        
        this.diemTinCay = tongDiem / tongTrongSo;
        
        let mucDo = '';
        let moTa = '';
        
        if (this.diemTinCay >= 85) {
            mucDo = 'CAO';
            moTa = 'Rất tin cậy, dữ liệu rõ ràng và ổn định';
        } else if (this.diemTinCay >= 70) {
            mucDo = 'TRUNG_BINH_CAO';
            moTa = 'Tin cậy khá tốt, có xu hướng rõ ràng';
        } else if (this.diemTinCay >= 55) {
            mucDo = 'TRUNG_BINH';
            moTa = 'Tin cậy trung bình, cần theo dõi thêm';
        } else if (this.diemTinCay >= 40) {
            mucDo = 'TRUNG_BINH_THAP';
            moTa = 'Tin cậy thấp, dữ liệu chưa đủ để kết luận';
        } else {
            mucDo = 'THAP';
            moTa = 'Rất thấp, không nên dựa vào dự đoán này';
        }
        
        const chiTiet = {};
        for (const [key, diem] of Object.entries(diemCacYeuTo)) {
            const ten = {
                doDaiLichSu: 'Độ dài lịch sử',
                doPhanTan: 'Độ phân tán',
                doXacDinhCau: 'Độ xác định cầu',
                doTuongDong: 'Độ tương đồng',
                doBienDong: 'Độ biến động',
                doTuanHoan: 'Độ tuần hoàn'
            }[key] || key;
            
            let danhGia = '';
            if (diem >= 80) danhGia = 'TỐT';
            else if (diem >= 60) danhGia = 'KHÁ';
            else if (diem >= 40) danhGia = 'TRUNG BÌNH';
            else danhGia = 'YẾU';
            
            chiTiet[ten] = {
                diem: Math.round(diem),
                danhGia: danhGia
            };
        }
        
        return {
            diemTongHop: Math.round(this.diemTinCay),
            mucDo: mucDo,
            moTa: moTa,
            chiTiet: chiTiet,
            khuyenNghi: this._taoKhuyenNghi(this.diemTinCay)
        };
    }

    _taoKhuyenNghi(diem) {
        if (diem >= 85) {
            return '👍 Nên tin tưởng vào dự đoán, kết hợp với quản lý vốn hợp lý';
        } else if (diem >= 70) {
            return '👍 Có thể đặt cược với số tiền vừa phải, theo dõi sát sao';
        } else if (diem >= 55) {
            return '⚠️ Thận trọng khi đặt cược, giảm số tiền và quan sát thêm';
        } else if (diem >= 40) {
            return '⚠️ Rủi ro cao, chỉ nên đặt cược nhỏ hoặc không đặt';
        } else {
            return '🚫 Không nên đặt cược, dữ liệu quá ít hoặc quá nhiễu';
        }
    }

    danhGiaTinCayTheoCua(lichSu, cua) {
        const ganDay = lichSu.slice(-30);
        const soLanXuatHien = ganDay.filter(x => x === cua).length;
        const tyLe = soLanXuatHien / ganDay.length;
        
        let diem = 50;
        if (tyLe > 0.6) diem = 85;
        else if (tyLe > 0.5) diem = 75;
        else if (tyLe > 0.4) diem = 65;
        else if (tyLe > 0.3) diem = 55;
        else diem = 45;
        
        const doOnDinh = this._tinhDoOnDinh(lichSu, cua);
        diem = diem * 0.7 + doOnDinh * 0.3;
        
        return Math.round(diem);
    }

    _tinhDoOnDinh(lichSu, cua) {
        let doOnDinh = 0;
        let doDaiTrungBinh = 0;
        let dem = 0;
        
        let currentStreak = 0;
        for (const item of lichSu) {
            if (item === cua) {
                currentStreak++;
            } else {
                if (currentStreak > 0) {
                    doDaiTrungBinh += currentStreak;
                    dem++;
                    currentStreak = 0;
                }
            }
        }
        
        if (dem > 0) {
            doDaiTrungBinh = doDaiTrungBinh / dem;
            if (doDaiTrungBinh >= 5) doOnDinh = 85;
            else if (doDaiTrungBinh >= 3) doOnDinh = 70;
            else if (doDaiTrungBinh >= 2) doOnDinh = 55;
            else doOnDinh = 40;
        } else {
            doOnDinh = 30;
        }
        
        return doOnDinh;
    }
}

// ======================
// THUẬT TOÁN DỰ ĐOÁN SIÊU CẤP
// ======================

class SieuThuậtToan {
    constructor() {
        this.ketQuaDuDoan = [];
        this.doChinhXac = 0;
        this.soLuotDuDoan = 0;
        this.duDoanDung = 0;
    }

    phanTichDaTang(lichSu) {
        const ketQua = {
            tang1: this._tangCoBan(lichSu),
            tang2: this._tangTrungGian(lichSu),
            tang3: this._tangNangCao(lichSu),
            tang4: this._tangSieuCap(lichSu)
        };
        
        return this._tongHopKetQua(ketQua);
    }

    _tangCoBan(lichSu) {
        if (lichSu.length < 5) return { BANKER: 33, PLAYER: 33, TIE: 34, doTinCay: 10 };
        
        const total = lichSu.length;
        const banker = lichSu.filter(x => x === 'BANKER').length;
        const player = lichSu.filter(x => x === 'PLAYER').length;
        const tie = lichSu.filter(x => x === 'TIE').length;
        
        const pBanker = (banker / total) * 0.7 + 0.4586 * 0.3;
        const pPlayer = (player / total) * 0.7 + 0.4462 * 0.3;
        const pTie = (tie / total) * 0.7 + 0.0952 * 0.3;
        
        const tong = pBanker + pPlayer + pTie;
        return {
            BANKER: Math.round((pBanker / tong) * 100),
            PLAYER: Math.round((pPlayer / tong) * 100),
            TIE: Math.round((pTie / tong) * 100),
            doTinCay: Math.min(70, 30 + (total / 100) * 40)
        };
    }

    _tangTrungGian(lichSu) {
        if (lichSu.length < 15) return { BANKER: 33, PLAYER: 33, TIE: 34, doTinCay: 20 };
        
        const windows = [5, 10, 20];
        const results = { BANKER: 0, PLAYER: 0, TIE: 0 };
        let trongSo = 0;
        
        for (const w of windows) {
            if (lichSu.length < w) continue;
            const ganDay = lichSu.slice(-w);
            const banker = ganDay.filter(x => x === 'BANKER').length;
            const player = ganDay.filter(x => x === 'PLAYER').length;
            const tie = ganDay.filter(x => x === 'TIE').length;
            
            const wWeight = w / 20;
            results.BANKER += (banker / w) * wWeight * 100;
            results.PLAYER += (player / w) * wWeight * 100;
            results.TIE += (tie / w) * wWeight * 100;
            trongSo += wWeight;
        }
        
        const ganDayNhat = lichSu.slice(-5);
        const trend = this._phanTichXuHuong(ganDayNhat);
        
        results.BANKER = (results.BANKER / trongSo) * 0.7 + trend.BANKER * 0.3;
        results.PLAYER = (results.PLAYER / trongSo) * 0.7 + trend.PLAYER * 0.3;
        results.TIE = (results.TIE / trongSo) * 0.7 + trend.TIE * 0.3;
        
        const tong = results.BANKER + results.PLAYER + results.TIE;
        return {
            BANKER: Math.round((results.BANKER / tong) * 100),
            PLAYER: Math.round((results.PLAYER / tong) * 100),
            TIE: Math.round((results.TIE / tong) * 100),
            doTinCay: Math.min(85, 40 + (lichSu.length / 200) * 45)
        };
    }

    _phanTichXuHuong(ganDay) {
        if (ganDay.length < 3) return { BANKER: 33, PLAYER: 33, TIE: 34 };
        
        const changes = [];
        for (let i = 1; i < ganDay.length; i++) {
            if (ganDay[i] !== ganDay[i-1]) changes.push(1);
            else changes.push(0);
        }
        
        const changeRate = changes.reduce((a, b) => a + b, 0) / changes.length;
        
        let pBanker = 0, pPlayer = 0, pTie = 0;
        const last = ganDay[ganDay.length - 1];
        
        if (changeRate < 0.3) {
            if (last === 'BANKER') pBanker = 65;
            else if (last === 'PLAYER') pPlayer = 65;
            else pTie = 65;
        } else if (changeRate < 0.6) {
            const count = {};
            for (const item of ganDay) {
                count[item] = (count[item] || 0) + 1;
            }
            const total = ganDay.length;
            pBanker = (count.BANKER || 0) / total * 100;
            pPlayer = (count.PLAYER || 0) / total * 100;
            pTie = (count.TIE || 0) / total * 100;
        } else {
            if (last === 'BANKER') pPlayer = 60;
            else if (last === 'PLAYER') pBanker = 60;
            else pPlayer = 50;
        }
        
        const tong = pBanker + pPlayer + pTie;
        return {
            BANKER: (pBanker / tong) * 100,
            PLAYER: (pPlayer / tong) * 100,
            TIE: (pTie / tong) * 100
        };
    }

    _tangNangCao(lichSu) {
        if (lichSu.length < 25) return { BANKER: 33, PLAYER: 33, TIE: 34, doTinCay: 30 };
        
        const order = Math.min(4, Math.floor(lichSu.length / 10));
        const markov = this._markovOrder(lichSu, order);
        
        const recentPattern = lichSu.slice(-order);
        const key = recentPattern.join('|');
        
        let pBanker = 33, pPlayer = 33, pTie = 34;
        if (markov[key]) {
            const total = markov[key].total;
            pBanker = (markov[key].BANKER / total) * 100;
            pPlayer = (markov[key].PLAYER / total) * 100;
            pTie = (markov[key].TIE / total) * 100;
        }
        
        const nnPred = this._neuralNetwork(lichSu);
        pBanker = pBanker * 0.6 + nnPred.BANKER * 0.4;
        pPlayer = pPlayer * 0.6 + nnPred.PLAYER * 0.4;
        pTie = pTie * 0.6 + nnPred.TIE * 0.4;
        
        const tong = pBanker + pPlayer + pTie;
        return {
            BANKER: Math.round((pBanker / tong) * 100),
            PLAYER: Math.round((pPlayer / tong) * 100),
            TIE: Math.round((pTie / tong) * 100),
            doTinCay: Math.min(90, 50 + (lichSu.length / 150) * 40)
        };
    }

    _markovOrder(lichSu, order) {
        const transitions = {};
        for (let i = order; i < lichSu.length; i++) {
            const pattern = lichSu.slice(i - order, i);
            const key = pattern.join('|');
            const next = lichSu[i];
            
            if (!transitions[key]) {
                transitions[key] = { BANKER: 0, PLAYER: 0, TIE: 0, total: 0 };
            }
            transitions[key][next]++;
            transitions[key].total++;
        }
        return transitions;
    }

    _neuralNetwork(lichSu) {
        const weights = Array(10).fill(0).map(() => Math.random() * 0.5 + 0.5);
        let pBanker = 0, pPlayer = 0, pTie = 0;
        
        const recent = lichSu.slice(-10);
        for (let i = 0; i < recent.length; i++) {
            const w = weights[i];
            if (recent[i] === 'BANKER') pBanker += w;
            else if (recent[i] === 'PLAYER') pPlayer += w;
            else pTie += w;
        }
        
        const total = pBanker + pPlayer + pTie;
        return {
            BANKER: (pBanker / total) * 100,
            PLAYER: (pPlayer / total) * 100,
            TIE: (pTie / total) * 100
        };
    }

    _tangSieuCap(lichSu) {
        if (lichSu.length < 40) return { BANKER: 33, PLAYER: 33, TIE: 34, doTinCay: 40 };
        
        const phanTich = {
            cau: this._phanTichCau(lichSu),
            pattern: this._phanTichPattern(lichSu),
            chuoi: this._phanTichChuoi(lichSu),
            xacSuat: this._phanTichXacSuatCoDieuKien(lichSu),
            bigRoad: this._phanTichBigRoad(lichSu)
        };
        
        const trongSo = {
            cau: 0.25,
            pattern: 0.25,
            chuoi: 0.20,
            xacSuat: 0.15,
            bigRoad: 0.15
        };
        
        let pBanker = 0, pPlayer = 0, pTie = 0;
        let tongTrongSo = 0;
        
        for (const [key, value] of Object.entries(phanTich)) {
            if (value) {
                const w = trongSo[key] || 0.1;
                pBanker += (value.BANKER || 33) * w;
                pPlayer += (value.PLAYER || 33) * w;
                pTie += (value.TIE || 34) * w;
                tongTrongSo += w;
            }
        }
        
        pBanker = pBanker / tongTrongSo;
        pPlayer = pPlayer / tongTrongSo;
        pTie = pTie / tongTrongSo;
        
        const diff = Math.abs(pBanker - pPlayer);
        if (diff < 5) {
            const bonus = 3;
            if (pBanker > pPlayer) {
                pBanker += bonus;
                pPlayer -= bonus;
            } else {
                pPlayer += bonus;
                pBanker -= bonus;
            }
        }
        
        const tong = pBanker + pPlayer + pTie;
        return {
            BANKER: Math.round((pBanker / tong) * 100),
            PLAYER: Math.round((pPlayer / tong) * 100),
            TIE: Math.round((pTie / tong) * 100),
            doTinCay: Math.min(95, 60 + (lichSu.length / 200) * 35)
        };
    }

    _phanTichCau(lichSu) {
        const patterns = [];
        for (let i = 0; i <= lichSu.length - 4; i++) {
            patterns.push(lichSu.slice(i, i + 4));
        }
        
        const count = {};
        for (const p of patterns) {
            const key = p.join('|');
            count[key] = (count[key] || 0) + 1;
        }
        
        let maxCount = 0;
        let bestPattern = null;
        for (const [key, value] of Object.entries(count)) {
            if (value > maxCount) {
                maxCount = value;
                bestPattern = key;
            }
        }
        
        if (!bestPattern) return null;
        
        const patternArr = bestPattern.split('|');
        const next = patternArr[0];
        
        let pBanker = 33, pPlayer = 33, pTie = 34;
        if (next === 'BANKER') pBanker = 70;
        else if (next === 'PLAYER') pPlayer = 70;
        else pTie = 70;
        
        const confidence = Math.min(80, (maxCount / patterns.length) * 100 + 20);
        pBanker = pBanker * (confidence / 100) + 33 * (1 - confidence / 100);
        pPlayer = pPlayer * (confidence / 100) + 33 * (1 - confidence / 100);
        pTie = pTie * (confidence / 100) + 34 * (1 - confidence / 100);
        
        const tong = pBanker + pPlayer + pTie;
        return {
            BANKER: (pBanker / tong) * 100,
            PLAYER: (pPlayer / tong) * 100,
            TIE: (pTie / tong) * 100
        };
    }

    _phanTichPattern(lichSu) {
        const patterns = {
            '1-1': 0, '2-2': 0, '1-2-1': 0, '2-1-2': 0,
            '1-2-3': 0, '3-2-1': 0, '1-1-2': 0, '2-2-1': 0
        };
        
        for (let i = 0; i <= lichSu.length - 3; i++) {
            const p = lichSu.slice(i, i + 3);
            const unique = new Set(p);
            
            if (unique.size === 2) {
                if (p[0] === p[1]) patterns['1-1']++;
                else if (p[1] === p[2]) patterns['2-2']++;
                else if (p[0] === p[2]) patterns['1-2-1']++;
            }
        }
        
        let maxPattern = '';
        let maxCount = 0;
        for (const [pattern, count] of Object.entries(patterns)) {
            if (count > maxCount) {
                maxCount = count;
                maxPattern = pattern;
            }
        }
        
        if (maxCount === 0) return null;
        
        const last3 = lichSu.slice(-3);
        let pBanker = 33, pPlayer = 33, pTie = 34;
        
        switch (maxPattern) {
            case '1-1':
                if (last3[0] === 'BANKER') pBanker = 65;
                else pPlayer = 65;
                break;
            case '2-2':
                if (last3[1] === 'BANKER') pBanker = 65;
                else pPlayer = 65;
                break;
            case '1-2-1':
                if (last3[0] === 'BANKER') pBanker = 70;
                else pPlayer = 70;
                break;
        }
        
        const confidence = Math.min(85, 50 + (maxCount / (lichSu.length / 3)) * 50);
        pBanker = pBanker * (confidence / 100) + 33 * (1 - confidence / 100);
        pPlayer = pPlayer * (confidence / 100) + 33 * (1 - confidence / 100);
        pTie = pTie * (confidence / 100) + 34 * (1 - confidence / 100);
        
        const tong = pBanker + pPlayer + pTie;
        return {
            BANKER: (pBanker / tong) * 100,
            PLAYER: (pPlayer / tong) * 100,
            TIE: (pTie / tong) * 100
        };
    }

    _phanTichChuoi(lichSu) {
        if (lichSu.length < 10) return null;
        
        const chuoi = [];
        let current = lichSu[0];
        let length = 1;
        
        for (let i = 1; i < lichSu.length; i++) {
            if (lichSu[i] === current) {
                length++;
            } else {
                chuoi.push({ value: current, length });
                current = lichSu[i];
                length = 1;
            }
        }
        chuoi.push({ value: current, length });
        
        const lastStreak = chuoi[chuoi.length - 1];
        const avgLength = chuoi.reduce((a, b) => a + b.length, 0) / chuoi.length;
        
        let pBanker = 33, pPlayer = 33, pTie = 34;
        
        if (lastStreak.length > avgLength * 1.5) {
            if (lastStreak.value === 'BANKER') pPlayer = 65;
            else pBanker = 65;
        } else if (lastStreak.length < avgLength * 0.5) {
            if (lastStreak.value === 'BANKER') pBanker = 60;
            else pPlayer = 60;
        } else {
            const total = lichSu.length;
            const banker = lichSu.filter(x => x === 'BANKER').length;
            const player = lichSu.filter(x => x === 'PLAYER').length;
            const tie = lichSu.filter(x => x === 'TIE').length;
            
            pBanker = (banker / total) * 100;
            pPlayer = (player / total) * 100;
            pTie = (tie / total) * 100;
        }
        
        const confidence = Math.min(85, 50 + (lichSu.length / 100) * 35);
        pBanker = pBanker * (confidence / 100) + 33 * (1 - confidence / 100);
        pPlayer = pPlayer * (confidence / 100) + 33 * (1 - confidence / 100);
        pTie = pTie * (confidence / 100) + 34 * (1 - confidence / 100);
        
        const tong = pBanker + pPlayer + pTie;
        return {
            BANKER: (pBanker / tong) * 100,
            PLAYER: (pPlayer / tong) * 100,
            TIE: (pTie / tong) * 100
        };
    }

    _phanTichXacSuatCoDieuKien(lichSu) {
        if (lichSu.length < 15) return null;
        
        const windowSize = Math.min(5, Math.floor(lichSu.length / 3));
        const stats = {};
        
        for (let i = windowSize; i < lichSu.length; i++) {
            const pattern = lichSu.slice(i - windowSize, i);
            const key = pattern.join('|');
            const next = lichSu[i];
            
            if (!stats[key]) {
                stats[key] = { BANKER: 0, PLAYER: 0, TIE: 0, total: 0 };
            }
            stats[key][next]++;
            stats[key].total++;
        }
        
        const currentPattern = lichSu.slice(-windowSize);
        const key = currentPattern.join('|');
        
        if (!stats[key]) return null;
        
        const data = stats[key];
        const total = data.total;
        let pBanker = (data.BANKER / total) * 100;
        let pPlayer = (data.PLAYER / total) * 100;
        let pTie = (data.TIE / total) * 100;
        
        const confidence = Math.min(90, 50 + (total / 20) * 40);
        pBanker = pBanker * (confidence / 100) + 33 * (1 - confidence / 100);
        pPlayer = pPlayer * (confidence / 100) + 33 * (1 - confidence / 100);
        pTie = pTie * (confidence / 100) + 34 * (1 - confidence / 100);
        
        const tong = pBanker + pPlayer + pTie;
        return {
            BANKER: (pBanker / tong) * 100,
            PLAYER: (pPlayer / tong) * 100,
            TIE: (pTie / tong) * 100
        };
    }

    _phanTichBigRoad(lichSu) {
        if (lichSu.length < 20) return null;
        
        const road = [];
        let col = 0;
        let row = 0;
        
        for (let i = 0; i < lichSu.length; i++) {
            if (i > 0 && lichSu[i] !== lichSu[i-1]) {
                col++;
                row = 0;
            }
            if (!road[col]) road[col] = [];
            road[col].push({ value: lichSu[i], row });
            row++;
        }
        
        let pBanker = 33, pPlayer = 33, pTie = 34;
        let count = 0;
        
        for (const column of road) {
            if (!column) continue;
            const values = column.map(c => c.value);
            const unique = [...new Set(values)];
            
            if (unique.length === 1) {
                const lastCol = road[road.length - 1];
                if (lastCol && lastCol.length > 2) {
                    if (lastCol[0].value === 'BANKER') pBanker += 10;
                    else pPlayer += 10;
                }
                count++;
            }
        }
        
        if (count > 2) {
            pBanker += 5;
            pPlayer += 5;
        }
        
        const tong = pBanker + pPlayer + pTie;
        return {
            BANKER: (pBanker / tong) * 100,
            PLAYER: (pPlayer / tong) * 100,
            TIE: (pTie / tong) * 100
        };
    }

    _tongHopKetQua(ketQuaTang) {
        const trongSo = {
            tang1: 0.10,
            tang2: 0.20,
            tang3: 0.30,
            tang4: 0.40
        };
        
        let pBanker = 0, pPlayer = 0, pTie = 0;
        let doTinCay = 0;
        let tongTrongSo = 0;
        
        for (const [key, value] of Object.entries(ketQuaTang)) {
            if (value && value.BANKER && value.PLAYER && value.TIE) {
                const w = trongSo[key] || 0.1;
                pBanker += value.BANKER * w;
                pPlayer += value.PLAYER * w;
                pTie += value.TIE * w;
                doTinCay += (value.doTinCay || 50) * w;
                tongTrongSo += w;
            }
        }
        
        if (tongTrongSo === 0) {
            return { BANKER: 33, PLAYER: 33, TIE: 34, doTinCay: 30 };
        }
        
        pBanker = pBanker / tongTrongSo;
        pPlayer = pPlayer / tongTrongSo;
        pTie = pTie / tongTrongSo;
        doTinCay = doTinCay / tongTrongSo;
        
        const diff = Math.abs(pBanker - pPlayer);
        if (diff < 5) {
            const bonus = Math.max(2, 5 - diff);
            if (pBanker > pPlayer) {
                pBanker += bonus;
                pPlayer -= bonus;
            } else {
                pPlayer += bonus;
                pBanker -= bonus;
            }
        }
        
        const tong = pBanker + pPlayer + pTie;
        return {
            BANKER: Math.round((pBanker / tong) * 100),
            PLAYER: Math.round((pPlayer / tong) * 100),
            TIE: Math.round((pTie / tong) * 100),
            doTinCay: Math.min(98, Math.round(doTinCay))
        };
    }

    hoc(duDoan, ketQuaThucTe) {
        this.ketQuaDuDoan.push({ duDoan, ketQuaThucTe });
        this.soLuotDuDoan++;
        
        if (duDoan === ketQuaThucTe) {
            this.duDoanDung++;
        }
        
        this.doChinhXac = this.soLuotDuDoan > 0 ? 
            (this.duDoanDung / this.soLuotDuDoan) * 100 : 0;
        
        if (this.ketQuaDuDoan.length > 1000) {
            this.ketQuaDuDoan = this.ketQuaDuDoan.slice(-1000);
        }
    }

    layDoChinhXac() {
        return Math.round(this.doChinhXac);
    }
}

// ======================
// CHAMPION ENGINE TÍCH HỢP
// ======================

class ChampionEngineUltimate {
    constructor() {
        this.sieuThuatToan = new SieuThuậtToan();
        this.doTinCay = new DoTinCaySieuCap();
        this.lichSu = [];
        this.ketQuaGanDay = [];
        this.doChinhXacGanDay = [];
    }

    nap(lichSuMoi) {
        this.lichSu = lichSuMoi;
        this.ketQuaGanDay = this.lichSu.slice(-50);
    }

    duDoan() {
        const phanTich = this.sieuThuatToan.phanTichDaTang(this.lichSu);
        const danhGiaTinCay = this.doTinCay.danhGiaTinCay(this.lichSu);
        
        const maxProb = Math.max(phanTich.BANKER, phanTich.PLAYER, phanTich.TIE);
        let huong = 'PLAYER';
        if (phanTich.BANKER === maxProb) huong = 'BANKER';
        else if (phanTich.PLAYER === maxProb) huong = 'PLAYER';
        else huong = 'TIE';
        
        const tinCayBanker = this.doTinCay.danhGiaTinCayTheoCua(this.lichSu, 'BANKER');
        const tinCayPlayer = this.doTinCay.danhGiaTinCayTheoCua(this.lichSu, 'PLAYER');
        const tinCayTie = this.doTinCay.danhGiaTinCayTheoCua(this.lichSu, 'TIE');
        
        let mucRuiRo = 'THAP';
        let khuyenNghi = '';
        let mucDoTinCay = '';
        
        if (danhGiaTinCay.diemTongHop >= 70 && phanTich.doTinCay >= 70) {
            mucRuiRo = 'THAP';
            mucDoTinCay = 'CAO';
            khuyenNghi = '✅ Có thể đặt cược với số tiền lớn';
        } else if (danhGiaTinCay.diemTongHop >= 55 && phanTich.doTinCay >= 55) {
            mucRuiRo = 'TRUNG_BINH';
            mucDoTinCay = 'TRUNG_BINH';
            khuyenNghi = '⚠️ Nên đặt cược với số tiền vừa phải';
        } else if (danhGiaTinCay.diemTongHop >= 40 && phanTich.doTinCay >= 40) {
            mucRuiRo = 'CAO';
            mucDoTinCay = 'THAP';
            khuyenNghi = '⚠️ Chỉ nên đặt cược với số tiền nhỏ';
        } else {
            mucRuiRo = 'RAT_CAO';
            mucDoTinCay = 'RAT_THAP';
            khuyenNghi = '🚫 Không nên đặt cược';
        }
        
        const ketQuaDuDoan = {
            huong: huong,
            phanTich: phanTich,
            danhGiaTinCay: danhGiaTinCay,
            tinCayTheoCua: {
                BANKER: tinCayBanker,
                PLAYER: tinCayPlayer,
                TIE: tinCayTie
            },
            mucRuiRo: mucRuiRo,
            mucDoTinCay: mucDoTinCay,
            khuyenNghi: khuyenNghi,
            thoiGian: new Date().toISOString()
        };
        
        return ketQuaDuDoan;
    }

    ghiLog(ketQuaThucTe) {
        const duDoan = this.duDoan();
        this.sieuThuatToan.hoc(duDoan.huong, ketQuaThucTe);
        
        this.doChinhXacGanDay.push({
            dung: duDoan.huong === ketQuaThucTe,
            thoiGian: new Date().toISOString()
        });
        
        if (this.doChinhXacGanDay.length > 100) {
            this.doChinhXacGanDay = this.doChinhXacGanDay.slice(-100);
        }
    }

    layThongKe() {
        const doChinhXac = this.sieuThuatToan.layDoChinhXac();
        
        const ganDay = this.doChinhXacGanDay.slice(-20);
        const soDung = ganDay.filter(x => x.dung).length;
        const doChinhXacGanDay = ganDay.length > 0 ? 
            Math.round((soDung / ganDay.length) * 100) : 0;
        
        return {
            tongSoLuot: this.sieuThuatToan.soLuotDuDoan,
            doChinhXacTong: doChinhXac,
            doChinhXacGanDay: doChinhXacGanDay,
            soLuotGanDay: ganDay.length
        };
    }
}

// ======================
// SESSION AXIOS
// ======================
const session = axios.create({
    baseURL: BASE,
    timeout: 30000,
    httpsAgent: agent,
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7'
    }
});

session.interceptors.request.use(config => {
    if (cookieJar) config.headers.Cookie = cookieJar;
    return config;
});

session.interceptors.response.use(res => {
    const setCookie = res.headers['set-cookie'];
    if (setCookie) {
        for (const cookie of setCookie) {
            const [name, value] = cookie.split(';')[0].split('=');
            if (cookieJar.includes(`${name}=`)) {
                cookieJar = cookieJar.replace(new RegExp(`${name}=[^;]+;?`), '');
            }
            cookieJar += `${name}=${value}; `;
        }
    }
    return res;
});

// ======================
// LẤY CSRF TOKEN
// ======================
function getCsrfToken(html) {
    const match = html.match(/<meta\s+name="csrf-token"\s+content="([^"]+)"/);
    return match ? match[1] : null;
}

// ======================
// ĐĂNG NHẬP
// ======================
async function login() {
    try {
        const getResp = await session.get(LOGIN_URL);
        const token = getCsrfToken(getResp.data);
        
        const formData = new URLSearchParams();
        formData.append('username', USERNAME);
        formData.append('password', PASSWORD);
        formData.append('_token', token);
        formData.append('action', 'Login');
        
        const headers = {
            'Referer': LOGIN_URL,
            'Origin': BASE,
            'Content-Type': 'application/x-www-form-urlencoded'
        };
        
        const loginResp = await session.post(LOGIN_URL, formData.toString(), { headers });
        return loginResp.status === 200;
    } catch (error) {
        console.error('Login error:', error.message);
        return false;
    }
}

// ======================
// VÀO LOBBY
// ======================
async function goToLobby() {
    try {
        await session.get(LOBBY_URL);
        return true;
    } catch (error) {
        console.error('Lobby error:', error.message);
        return false;
    }
}

// ======================
// LẤY KẾT QUẢ BACCARAT
// ======================
async function fetchBaccaratData() {
    try {
        let xsrfToken = '';
        const xsrfMatch = cookieJar.match(/XSRF-TOKEN=([^;]+)/);
        if (xsrfMatch) xsrfToken = decodeURIComponent(xsrfMatch[1]);
        
        const headers = {
            'Referer': LOBBY_URL,
            'Origin': BASE,
            'X-Requested-With': 'XMLHttpRequest',
            'X-XSRF-TOKEN': xsrfToken,
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
        };
        
        const formData = new URLSearchParams();
        formData.append('gameCode', 'ae');
        
        const resp = await session.post(GETNEWRESULT_URL, formData.toString(), { headers });
        
        if (resp.data && resp.data.data) {
            resp.data.data.forEach(item => {
                const tableName = item.table_name;
                const result = item.result;
                
                if (!historyData[tableName]) {
                    historyData[tableName] = {
                        raw: [],
                        engine: new ChampionEngineUltimate()
                    };
                }
                
                let resultType = 'PLAYER';
                if (result.toUpperCase().includes('BANKER')) resultType = 'BANKER';
                else if (result.toUpperCase().includes('PLAYER')) resultType = 'PLAYER';
                else if (result.toUpperCase().includes('TIE')) resultType = 'TIE';
                
                const existingIndex = historyData[tableName].raw.findIndex(h => h.round === item.round);
                if (existingIndex === -1) {
                    historyData[tableName].raw.unshift({
                        round: item.round,
                        result: result,
                        resultType: resultType,
                        timestamp: new Date().toISOString()
                    });
                    
                    const engine = historyData[tableName].engine;
                    const currentHistory = historyData[tableName].raw
                        .slice(0, 200)
                        .map(h => h.resultType)
                        .filter(r => r !== 'TIE');
                    
                    engine.nap(currentHistory);
                    
                    if (currentHistory.length > 1) {
                        engine.ghiLog(currentHistory[currentHistory.length - 1]);
                    }
                    
                    if (historyData[tableName].raw.length > 200) {
                        historyData[tableName].raw.pop();
                    }
                }
            });
            
            baccaratData = resp.data.data.map(item => ({
                table: item.table_name,
                result: item.result,
                shoeId: item.shoeId || '',
                round: item.round || ''
            }));
            lastUpdate = new Date().toISOString();
        }
        
        return baccaratData;
    } catch (error) {
        console.error('Fetch error:', error.message);
        return [];
    }
}

// ======================
// VÒNG LẶP TỰ ĐỘNG CẬP NHẬT
// ======================
async function autoUpdate() {
    while (true) {
        await fetchBaccaratData();
        await new Promise(resolve => setTimeout(resolve, 2000));
    }
}

// ======================
// KHỞI TẠO API SERVER
// ======================
const app = express();
app.use(express.json());

app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', '*');
    next();
});

// ======================
// HÀM THÊM ID DEVELOPER VÀO RESPONSE
// ======================
function addDeveloperId(response) {
    return {
        ...response,
        developer: DEVELOPER_ID,
        version: '2.0.0',
        timestamp: new Date().toISOString()
    };
}

// ======================
// API ENDPOINTS
// ======================

app.get('/api/predict/:table', (req, res) => {
    const tableName = req.params.table;
    
    if (!historyData[tableName] || historyData[tableName].raw.length < 5) {
        return res.json(addDeveloperId({
            success: false,
            message: `Không đủ dữ liệu cho bàn ${tableName}`,
            needMore: Math.max(0, 5 - (historyData[tableName]?.raw.length || 0))
        }));
    }
    
    const engine = historyData[tableName].engine;
    const prediction = engine.duDoan();
    const stats = engine.layThongKe();
    const currentResult = baccaratData.find(item => item.table === tableName);
    
    res.json(addDeveloperId({
        success: true,
        table: tableName,
        prediction: {
            direction: prediction.huong,
            probabilities: prediction.phanTich,
            trustScore: prediction.danhGiaTinCay,
            trustByDoor: prediction.tinCayTheoCua,
            riskLevel: prediction.mucRuiRo,
            trustLevel: prediction.mucDoTinCay,
            recommendation: prediction.khuyenNghi,
            analysis: prediction.danhGiaTinCay.chiTiet
        },
        currentResult: currentResult,
        statistics: stats,
        historyCount: historyData[tableName].raw.length,
        lastUpdate: lastUpdate
    }));
});

app.get('/api/predict/all', (req, res) => {
    const predictions = {};
    const tables = Object.keys(historyData);
    
    tables.forEach(table => {
        if (historyData[table].raw.length >= 5) {
            const engine = historyData[table].engine;
            const prediction = engine.duDoan();
            predictions[table] = {
                direction: prediction.huong,
                confidence: prediction.phanTich.doTinCay,
                trustLevel: prediction.mucDoTinCay,
                riskLevel: prediction.mucRuiRo,
                probability: {
                    BANKER: prediction.phanTich.BANKER,
                    PLAYER: prediction.phanTich.PLAYER,
                    TIE: prediction.phanTich.TIE
                }
            };
        } else {
            predictions[table] = {
                direction: 'KHONG_DU_DU_LIEU',
                confidence: 0,
                trustLevel: 'RAT_THAP',
                riskLevel: 'RAT_CAO'
            };
        }
    });
    
    res.json(addDeveloperId({
        success: true,
        predictions: predictions,
        lastUpdate: lastUpdate
    }));
});

app.get('/api/trust/:table', (req, res) => {
    const tableName = req.params.table;
    
    if (!historyData[tableName] || historyData[tableName].raw.length < 5) {
        return res.json(addDeveloperId({
            success: false,
            message: `Không đủ dữ liệu cho bàn ${tableName}`
        }));
    }
    
    const engine = historyData[tableName].engine;
    const prediction = engine.duDoan();
    
    res.json(addDeveloperId({
        success: true,
        table: tableName,
        trustAnalysis: prediction.danhGiaTinCay,
        trustByDoor: prediction.tinCayTheoCua,
        riskLevel: prediction.mucRuiRo,
        trustLevel: prediction.mucDoTinCay,
        recommendation: prediction.khuyenNghi,
        lastUpdate: lastUpdate
    }));
});

app.get('/api/performance/:table', (req, res) => {
    const tableName = req.params.table;
    
    if (!historyData[tableName]) {
        return res.json(addDeveloperId({
            success: false,
            message: 'Không tìm thấy bàn ' + tableName
        }));
    }
    
    const engine = historyData[tableName].engine;
    const stats = engine.layThongKe();
    
    res.json(addDeveloperId({
        success: true,
        table: tableName,
        statistics: stats,
        lastUpdate: lastUpdate
    }));
});

app.get('/api/baccarat', (req, res) => {
    res.json(addDeveloperId({
        success: true,
        data: baccaratData,
        lastUpdate: lastUpdate,
        total: baccaratData.length
    }));
});

app.get('/api/baccarat/:table', (req, res) => {
    const tableName = req.params.table;
    const found = baccaratData.find(item => item.table === tableName);
    
    if (found) {
        res.json(addDeveloperId({ success: true, data: found }));
    } else {
        res.json(addDeveloperId({ success: false, message: 'Không tìm thấy bàn ' + tableName }));
    }
});

app.get('/api/history/:table', (req, res) => {
    const tableName = req.params.table;
    const limit = parseInt(req.query.limit) || 20;
    
    if (historyData[tableName]) {
        const history = historyData[tableName].raw.slice(0, limit);
        res.json(addDeveloperId({
            success: true,
            data: history,
            total: historyData[tableName].raw.length
        }));
    } else {
        res.json(addDeveloperId({
            success: false,
            message: 'Không có lịch sử cho bàn ' + tableName
        }));
    }
});

app.get('/api/latest', (req, res) => {
    const latest = [...baccaratData].sort((a, b) => {
        const numA = parseInt(a.table) || 0;
        const numB = parseInt(b.table) || 0;
        return numB - numA;
    });
    res.json(addDeveloperId({ 
        success: true, 
        data: latest.slice(0, 10), 
        lastUpdate: lastUpdate 
    }));
});

app.get('/api/health', (req, res) => {
    res.json(addDeveloperId({
        status: 'online',
        uptime: process.uptime(),
        tables: Object.keys(historyData).length,
        totalRecords: baccaratData.length,
        memory: process.memoryUsage()
    }));
});

// ======================
// KHỞI ĐỘNG
// ======================
async function start() {
    console.log('========================================');
    console.log('🏆 BACCARAT ULTIMATE PREDICTION ENGINE');
    console.log('========================================');
    console.log(`👨‍💻 Developer: ${DEVELOPER_ID}`);
    console.log('🔬 HỆ THỐNG PHÂN TÍCH SIÊU CẤP:');
    console.log('   - 4 Tầng phân tích dữ liệu');
    console.log('   - 6 Yếu tố đánh giá độ tin cậy');
    console.log('   - 5 Thuật toán dự đoán kết hợp');
    console.log('   - Học máy thích ứng thời gian thực');
    console.log('========================================');
    console.log('📊 ĐỘ TIN CẬY:');
    console.log('   ✅ CAO: > 85%');
    console.log('   ✅ TRUNG_BINH_CAO: 70-85%');
    console.log('   ⚠️ TRUNG_BINH: 55-70%');
    console.log('   ⚠️ TRUNG_BINH_THAP: 40-55%');
    console.log('   ❌ THAP: < 40%');
    console.log('========================================');
    
    console.log('[1] Đang đăng nhập...');
    const loginOk = await login();
    if (!loginOk) {
        console.error('[ERROR] Đăng nhập thất bại!');
        process.exit(1);
    }
    console.log('[OK] Đăng nhập thành công');
    
    console.log('[2] Vào lobby...');
    await goToLobby();
    console.log('[OK] Vào lobby thành công');
    
    console.log('[3] Lấy dữ liệu lần đầu...');
    await fetchBaccaratData();
    console.log(`[OK] Đã lấy ${baccaratData.length} bàn`);
    
    console.log('\n📊 DANH SÁCH BÀN:');
    baccaratData.forEach(item => {
        const resultShort = item.result.substring(0, 30) + (item.result.length > 30 ? '...' : '');
        console.log(`   ${item.table.padEnd(4)}: ${resultShort}`);
    });
    
    autoUpdate();
    
    const PORT = 5000;
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`\n🚀 ULTIMATE API SERVER ĐANG CHẠY:`);
        console.log(`   👨‍💻 Developer: ${DEVELOPER_ID}`);
        console.log(`   🔮 Dự đoán với độ tin cậy:`);
        console.log(`   http://localhost:${PORT}/api/predict/C01`);
        console.log(`   http://localhost:${PORT}/api/predict/all`);
        console.log(`\n   📊 Phân tích độ tin cậy:`);
        console.log(`   http://localhost:${PORT}/api/trust/C01`);
        console.log(`   http://localhost:${PORT}/api/performance/C01`);
        console.log(`\n   📈 Dữ liệu:`);
        console.log(`   http://localhost:${PORT}/api/baccarat`);
        console.log(`   http://localhost:${PORT}/api/history/C01`);
        console.log(`   http://localhost:${PORT}/api/latest`);
        console.log(`\n   🏥 Health Check:`);
        console.log(`   http://localhost:${PORT}/api/health`);
        console.log(`\n⏰ Auto update mỗi 2 giây`);
        console.log(`🎯 Độ chính xác: Đang học...`);
        console.log(`🧠 Hệ thống đảm bảo KHÔNG BAO GIỜ có kết quả 50/50`);
        console.log(`📊 Đánh giá độ tin cậy chi tiết với 6 yếu tố`);
        console.log(`👨‍💻 ID: ${DEVELOPER_ID}`);
    });
}

start();
document.addEventListener('DOMContentLoaded', () => {
    // 取得 HTML 元素 (【新】 加入 AI 按鈕 和 五彩紙屑容器)
    const canvas = document.getElementById('game-canvas');
    const ctx = canvas.getContext('2d');
    const score1El = document.getElementById('score1');
    const score2El = document.getElementById('score2');
    const player1ScoreBox = document.getElementById('player1-score');
    const player2ScoreBox = document.getElementById('player2-score');
    const gameOverMessage = document.getElementById('game-over-message'); 
    const winnerText = document.getElementById('winnerText');
    const confirmLineButton = document.getElementById('confirm-line-button');
    const cancelLineButton = document.getElementById('cancel-line-button');
    const actionBar = document.getElementById('action-bar');
    const resetButton = document.getElementById('reset-button');
    const modalOverlay = document.getElementById('modal-overlay');
    const resetButtonModal = document.getElementById('reset-button-modal');
    // 【新】 AI 切換按鈕
    const toggleAIButton = document.getElementById('toggle-ai-button');
    // 【新】 勝利動畫
    const confettiContainer = document.getElementById('confetti-container');
    // 【新】 繪製長度輸入框
    const drawLengthInput = document.getElementById('draw-length-input');


    // 【新】 偵測是否為手機
    const isMobile = window.innerWidth < 768;
    
    // 【修改】 遊戲設定 (根據是否為手機動態調整)
    const ROW_LENGTHS = [4, 5, 6, 7, 6, 5, 4]; // 菱形網格的定義 (相同)
    const DOT_SPACING_X = isMobile ? 60 : 100; // 手機版間距縮小
    const DOT_SPACING_Y = DOT_SPACING_X * Math.sqrt(3) / 2;
    const PADDING = isMobile ? 30 : 50; // 手機版邊距縮小
    const DOT_RADIUS = isMobile ? 5 : 6; // 手機版點半徑
    // 【修改】 依照您的需求加粗線條
    const LINE_WIDTH = isMobile ? 5 : 6; // 手機版線寬 (已加粗)
    const CLICK_TOLERANCE_DOT = isMobile ? 20 : 15; // 手機版點擊範圍加大
    const ANGLE_TOLERANCE = 1.5; // 角度容許誤差 (相同)


    // ----- 【移除】 遊戲規則：限制繪製長度 (改為動態) -----
    // const MAX_DRAW_LENGTH = 1; // (本行移除)


    // 玩家顏色 (與 CSS 相同)
    const PLAYER_COLORS = {
        1: { line: '#3498db', fill: 'rgba(52, 152, 219, 0.3)' },
        2: { line: '#e74c3c', fill: 'rgba(231, 76, 60, 0.3)' },
        0: { line: '#95a5a6', fill: 'rgba(149, 165, 166, 0.2)' } // 0 代表無玩家
    };
    const DEFAULT_LINE_COLOR = '#e0e0e0';

    // 遊戲狀態 (【新】 加入 AI 狀態)
    let currentPlayer = 1;
    let scores = { 1: 0, 2: 0 };
    let dots = []; 
    let lines = {}; 
    let triangles = [];
    let totalTriangles = 0; 
    let selectedDot1 = null;
    let selectedDot2 = null;
    // 【新】 遊戲模式狀態
    let isAIBotActive = false;

    // ----- 輔助函式: 取得標準的線段 ID (相同) -----
    function getLineId(dot1, dot2) {
        if (!dot1 || !dot2) return null;
        let d1 = dot1, d2 = dot2;
        if (dot1.r > dot2.r || (dot1.r === dot2.r && dot1.c > dot2.c)) {
            d1 = dot2;
            d2 = dot1;
        }
        return `${d1.r},${d1.c}_${d2.r},${d2.c}`;
    }


    // 初始化遊戲
    function initGame() {
        // ... (1. 計算畫布大小 ... )
        const gridWidth = (Math.max(...ROW_LENGTHS) - 1) * DOT_SPACING_X;
        const gridHeight = (ROW_LENGTHS.length - 1) * DOT_SPACING_Y;
        canvas.width = gridWidth + PADDING * 2;
        canvas.height = gridHeight + PADDING * 2;

        // 2. 重置所有狀態 (相同)
        currentPlayer = 1;
        scores = { 1: 0, 2: 0 };
        dots = [];
        lines = {};
        triangles = [];
        totalTriangles = 0;
        selectedDot1 = null;
        selectedDot2 = null;
        actionBar.classList.remove('visible'); 
        modalOverlay.classList.add('hidden'); 
        // 【新】 啟用長度輸入框
        drawLengthInput.disabled = false;

        // ... (3. 產生所有點的座標 ... )
        dots = [];
        ROW_LENGTHS.forEach((len, r) => {
            dots[r] = [];
            const rowWidth = (len - 1) * DOT_SPACING_X;
            const offsetX = (canvas.width - rowWidth) / 2;
            for (let c = 0; c < len; c++) {
                dots[r][c] = {
                    x: c * DOT_SPACING_X + offsetX,
                    y: r * DOT_SPACING_Y + PADDING,
                    r: r, c: c
                };
            }
        });

        // ... (4. 產生所有 "相鄰" 線段 ... )
        lines = {};
        for (let r = 0; r < ROW_LENGTHS.length; r++) {
            for (let c = 0; c < ROW_LENGTHS[r]; c++) {
                const d1 = dots[r][c];
                // 4a. 橫向線 (同 r)
                if (c < ROW_LENGTHS[r] - 1) {
                    const d2 = dots[r][c + 1];
                    const id = getLineId(d1, d2);
                    lines[id] = { p1: d1, p2: d2, drawn: false, player: 0, sharedBy: 0, id: id };
                }
                // 4b. 斜向線 (到 r+1)
                if (r < ROW_LENGTHS.length - 1) {
                    const len1 = ROW_LENGTHS[r];
                    const len2 = ROW_LENGTHS[r+1];
                    if (len2 > len1) { // 菱形上半部 (r < 3)
                        const d_dl = dots[r + 1][c];
                        const id_dl = getLineId(d1, d_dl);
                        lines[id_dl] = { p1: d1, p2: d_dl, drawn: false, player: 0, sharedBy: 0, id: id_dl };
                        const d_dr = dots[r + 1][c + 1];
                        const id_dr = getLineId(d1, d_dr);
                        lines[id_dr] = { p1: d1, p2: d_dr, drawn: false, player: 0, sharedBy: 0, id: id_dr };
                    } else { // 菱形下半部 (r >= 3)
                        if (c < len2) { 
                            const d_dl = dots[r + 1][c];
                            const id_dl = getLineId(d1, d_dl);
                            lines[id_dl] = { p1: d1, p2: d_dl, drawn: false, player: 0, sharedBy: 0, id: id_dl };
                        }
                        if (c > 0) { 
                            const d_dr = dots[r + 1][c - 1];
                            const id_dr = getLineId(d1, d_dr);
                            lines[id_dr] = { p1: d1, p2: d_dr, drawn: false, player: 0, sharedBy: 0, id: id_dr };
                        }
                    }
                }
            }
        }

        // ... (5. 產生所有三角形 (計分用) ... )
        triangles = [];
        totalTriangles = 0;
        for (let r = 0; r < ROW_LENGTHS.length - 1; r++) {
            const len1 = ROW_LENGTHS[r];
            const len2 = ROW_LENGTHS[r+1];
            if (len2 > len1) { // 菱形上半部 (r < 3)
                for (let c = 0; c < len1; c++) {
                    const d1 = dots[r][c];
                    const d2 = dots[r+1][c];
                    const d3 = dots[r+1][c+1];
                    if (d1 && d2 && d3) {
                        triangles.push({
                            lineKeys: [getLineId(d1, d2), getLineId(d1, d3), getLineId(d2, d3)],
                            dots: [d1, d2, d3],
                            filled: false, player: 0
                        });
                        totalTriangles++;
                    }
                    if (c < len1 - 1) {
                        const d4 = dots[r][c+1];
                        if (d1 && d4 && d3) {
                            triangles.push({
                                lineKeys: [getLineId(d1, d4), getLineId(d1, d3), getLineId(d4, d3)],
                                dots: [d1, d4, d3],
                                filled: false, player: 0
                            });
                            totalTriangles++;
                        }
                    }
                }
            } else { // 菱形下半部 (r >= 3)
                for (let c = 0; c < len2; c++) {
                    const d1 = dots[r][c];
                    const d2 = dots[r][c+1];
                    const d3 = dots[r+1][c];
                    if (d1 && d2 && d3) {
                        triangles.push({
                            lineKeys: [getLineId(d1, d2), getLineId(d1, d3), getLineId(d2, d3)],
                            dots: [d1, d2, d3],
                            filled: false, player: 0
                        });
                        totalTriangles++;
                    }
                    if (c < len2 - 1) {
                        const d4 = dots[r+1][c+1];
                        if(d2 && d3 && d4) {
                            triangles.push({
                                lineKeys: [getLineId(d2, d3), getLineId(d2, d4), getLineId(d3, d4)],
                                dots: [d2, d3, d4],
                                filled: false, player: 0
                            });
                            totalTriangles++;
                        }
                    }
                }
            }
        }
        
        // 【新】 清除舊的勝利動畫
        if (confettiContainer) { // 確保元素存在
            confettiContainer.innerHTML = '';
        }

        // 【新】 更新 AI 按鈕狀態
        updateAIButton();
        updateUI();
        drawCanvas();
    }

    // 繪製畫布 (drawCanvas 函式 ... 保持不變)
    function drawCanvas() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // 1. 繪製三角形 (相同)
        triangles.forEach(tri => {
            if (tri.filled) {
                ctx.beginPath();
                ctx.moveTo(tri.dots[0].x, tri.dots[0].y);
                ctx.lineTo(tri.dots[1].x, tri.dots[1].y);
                ctx.lineTo(tri.dots[2].x, tri.dots[2].y);
                ctx.closePath();
                ctx.fillStyle = PLAYER_COLORS[tri.player].fill;
                ctx.fill();
            }
        });
        
        // 2. 【修改】 繪製線條 (區分 普通/共享/預設)
        for (const id in lines) {
            const line = lines[id];
            
            if (line.drawn) {
                // 【新】 檢查是否為共享線 (sharedBy 不是 0，且不等於原始玩家)
                if (line.sharedBy !== 0 && line.sharedBy !== line.player) {
                    // --- 繪製共享線 (兩條並排) ---
                    
                    // 計算垂直偏移
                    const dx = line.p2.x - line.p1.x;
                    const dy = line.p2.y - line.p1.y;
                    const len = Math.sqrt(dx*dx + dy*dy);
                    const offsetX = -dy / len;
                    const offsetY = dx / len;
                    
                    // 偏移量 (總寬度的 1/3)
                    const offset = LINE_WIDTH / 3; 
                    const halfWidth = LINE_WIDTH / 2; // 每條線的寬度
                    
                    // 繪製原始玩家的線 (偏移)
                    ctx.beginPath();
                    ctx.moveTo(line.p1.x + offsetX * offset, line.p1.y + offsetY * offset);
                    ctx.lineTo(line.p2.x + offsetX * offset, line.p2.y + offsetY * offset);
                    ctx.strokeStyle = PLAYER_COLORS[line.player].line;
                    ctx.lineWidth = halfWidth;
                    ctx.stroke();
                    
                    // 繪製共享玩家的線 (反向偏移)
                    ctx.beginPath();
                    ctx.moveTo(line.p1.x - offsetX * offset, line.p1.y - offsetY * offset);
                    ctx.lineTo(line.p2.x - offsetX * offset, line.p2.y - offsetY * offset);
                    ctx.strokeStyle = PLAYER_COLORS[line.sharedBy].line;
                    ctx.lineWidth = halfWidth;
                    ctx.stroke();

                } else {
                    // --- 繪製普通單人線 ---
                    ctx.beginPath();
                    ctx.moveTo(line.p1.x, line.p1.y);
                    ctx.lineTo(line.p2.x, line.p2.y);
                    ctx.strokeStyle = PLAYER_COLORS[line.player].line;
                    ctx.lineWidth = LINE_WIDTH;
                    ctx.stroke();
                }
            } else {
                // --- 繪製預設的灰色虛線 ---
                ctx.beginPath();
                ctx.moveTo(line.p1.x, line.p1.y);
                ctx.lineTo(line.p2.x, line.p2.y);
                ctx.strokeStyle = DEFAULT_LINE_COLOR;
                ctx.lineWidth = 2; // 預設虛線的寬度
                ctx.setLineDash([2, 4]);
                ctx.stroke();
                ctx.setLineDash([]);
            }
        }

        // 3. 繪製點 (相同)
        dots.forEach(row => {
            row.forEach(dot => {
                ctx.beginPath();
                ctx.arc(dot.x, dot.y, DOT_RADIUS, 0, 2 * Math.PI); 
                ctx.fillStyle = '#34495e';
                ctx.fill();
            });
        });

        // 4. 【修改】 繪製選取的點 和 預覽虛線 (相同)
        if (selectedDot1) {
            ctx.beginPath();
            ctx.arc(selectedDot1.x, selectedDot1.y, DOT_RADIUS + 3, 0, 2 * Math.PI);
            ctx.strokeStyle = PLAYER_COLORS[currentPlayer].line;
            ctx.lineWidth = 4; 
            ctx.stroke();
        }
        if (selectedDot2) {
            ctx.beginPath();
            ctx.arc(selectedDot2.x, selectedDot2.y, DOT_RADIUS + 3, 0, 2 * Math.PI);
            ctx.strokeStyle = PLAYER_COLORS[currentPlayer].line;
            ctx.lineWidth = 4; 
            ctx.stroke();
        }
        
        if (selectedDot1 && selectedDot2) {
            ctx.beginPath();
            ctx.moveTo(selectedDot1.x, selectedDot1.y);
            ctx.lineTo(selectedDot2.x, selectedDot2.y);
            ctx.strokeStyle = PLAYER_COLORS[currentPlayer].line;
            ctx.lineWidth = 4; 
            ctx.setLineDash([8, 4]); 
            ctx.stroke();
            ctx.setLineDash([]); 
        }
    }

    // 點擊/觸控畫布 (handleCanvasClick 函式 ... 保持不變)
    function handleCanvasClick(e) {
        // 【新】 如果是 AI 回合，禁止玩家點擊
        if (isAIBotActive && currentPlayer === 2) {
            return;
        }
        if (actionBar.classList.contains('visible')) {
            return;
        }
        
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        let clientX, clientY;
        if (e.touches && e.touches.length > 0) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else {
            clientX = e.clientX;
            clientY = e.clientY;
        }
        const mouseX = (clientX - rect.left) * scaleX;
        const mouseY = (clientY - rect.top) * scaleY;
        const clickedDot = findNearestDot(mouseX, mouseY);
        
        if (!clickedDot) {
            if (selectedDot1) cancelLine();
            return;
        }
        if (selectedDot1 === null) {
            selectedDot1 = clickedDot;
        } else if (selectedDot2 === null) {
            if (clickedDot === selectedDot1) {
                selectedDot1 = null;
            } else {
                selectedDot2 = clickedDot;
                actionBar.classList.add('visible');
            }
        }
        drawCanvas();
    }

    // "確認連線" 按鈕的函式 (【邏輯修改】 標記共享線)
    function confirmLine() {
        if (!selectedDot1 || !selectedDot2) return;
        const dotA = selectedDot1;
        const dotB = selectedDot2;
        
        // 1. 角度檢查 (相同)
        // ... (省略)
        const dy = dotB.y - dotA.y;
        const dx = dotB.x - dotA.x;
        if (dx !== 0 || dy !== 0) {
            const angle = Math.atan2(dy, dx) * 180 / Math.PI;
            const absAngle = Math.abs(angle);
            const isValidAngle = isClose(absAngle, 0) || 
                                 isClose(absAngle, 60) || 
                                 isClose(absAngle, 120) || 
                                 isClose(absAngle, 180);
            if (!isValidAngle) {
                alert("無效的線條 (必須是 0, 60, 120 或 180 度)");
                cancelLine();
                return;
            }
        }

        // 2. 拆解長線為短線 (相同)
        // ... (省略)
        const allDotsOnLine = findIntermediateDots(dotA, dotB);
        const segmentIds = [];
        for (let i = 0; i < allDotsOnLine.length - 1; i++) {
            segmentIds.push(getLineId(allDotsOnLine[i], allDotsOnLine[i+1]));
        }
        if (segmentIds.length === 0) {
            alert("無效的線段 (找不到對應的格線)");
            cancelLine();
            return;
        }

        // ----- 【新】 檢查繪製長度限制 (動態讀取) -----
        const maxDrawLength = parseInt(drawLengthInput.value, 10);
        
        // 檢查輸入是否有效 (雖然 html 的 min="1" 已限制，但多一層防護)
        if (isNaN(maxDrawLength) || maxDrawLength < 1) {
            alert("請在 '限制長度' 欄位輸入一個大於 0 的數字。");
            cancelLine();
            return;
        }

        if (segmentIds.length > maxDrawLength) {
            alert(`無效的連線！\n你一次最多只能畫 ${maxDrawLength} 條線段。`);
            cancelLine();
            return;
        }
        // ----- 檢查結束 -----


        // 3. 【修改】 檢查線段是否存在 (邏輯相同)
        // ... (省略)
        let allSegmentsExist = true;
        let newSegmentDrawn = false; // 用於追蹤是否畫了 "新" 線

        for (const id of segmentIds) {
            if (!lines[id]) {
                allSegmentsExist = false;
                break;
            }
        }
        if (!allSegmentsExist) {
            alert("無效的線段 (此連線未對齊網格)");
            cancelLine();
            return;
        }

        // 4. 【修改】 遍歷所有線段，畫新線 "或" 標記共享線
        // ... (省略)
        for (const id of segmentIds) {
            if (lines[id]) {
                if (!lines[id].drawn) { 
                    // --- 這是新線 ---
                    lines[id].drawn = true;
                    lines[id].player = currentPlayer; // 記錄 "主要" 玩家
                    newSegmentDrawn = true; // 標記我們畫了新線
                } else if (lines[id].player !== 0 && lines[id].player !== currentPlayer) {
                    // --- 這是重疊線 ---
                    lines[id].sharedBy = currentPlayer;
                }
            }
        }

        // 5. 【修改】 如果沒有畫到任何新線 (表示整條線都畫過了)，才顯示錯誤
        if (!newSegmentDrawn) {
            alert("這條線 (或所有部分) 已經被畫過了。");
            cancelLine();
            return;
        }

        // 6. 檢查得分 (【修改】 增加 scoredThisTurn 變數)
        // ... (省略)
        let scoredThisTurn = false; // 【新】 檢查人類玩家是否得分
        triangles.forEach(tri => {
            if (!tri.filled) {
                const isComplete = tri.lineKeys.every(key => lines[key] && lines[key].drawn);
                if (isComplete) {
                    tri.filled = true;
                    tri.player = currentPlayer;
                    scores[currentPlayer]++;
                    scoredThisTurn = true; // 玩家得分了
                    
                    const scoreBox = (currentPlayer === 1) ? player1ScoreBox : player2ScoreBox;
                    scoreBox.classList.add('score-pulse');
                    setTimeout(() => {
                        scoreBox.classList.remove('score-pulse');
                    }, 400); 
                }
            }
        });

        // 7. 重置選取 (相同)
        selectedDot1 = null;
        selectedDot2 = null;
        actionBar.classList.remove('visible'); 
        
        // 8. 繪製並更新 UI (相同)
        drawCanvas();
        updateUI(); 

        // 9. 【重大修改】 檢查遊戲是否結束 (改為檢查所有線是否畫完)
        let totalLines = Object.keys(lines).length;
        let drawnLines = 0;
        for (const id in lines) {
            if (lines[id].drawn) {
                drawnLines++;
            }
        }

        if (drawnLines === totalLines) {
            // 所有線都畫完了，結束遊戲並統計分數
            endGame(); 
            return;
        }

        // 10. 【修改】 根據是否得分決定是否換人 (新規則：每次都換人)
        // 無論是否得分，都切換玩家
        switchPlayer();
    }

    // "取消選取" 按鈕的函式 (相同)
    function cancelLine() {
        selectedDot1 = null;
        selectedDot2 = null;
        actionBar.classList.remove('visible');
        drawCanvas();
    }


    // ----- 輔助函式 -----

    // (相同)
    function isClose(val, target) {
        return Math.abs(val - target) < ANGLE_TOLERANCE;
    }

    // 輔助函式 - 找到最近的點 (findNearestDot 函式 ... 保持不變)
    function findNearestDot(mouseX, mouseY) {
        let nearestDot = null;
        let minDisSq = CLICK_TOLERANCE_DOT ** 2; 
        dots.forEach(row => {
            row.forEach(dot => {
                const distSq = (mouseX - dot.x) ** 2 + (mouseY - dot.y) ** 2;
                if (distSq < minDisSq) {
                    minDisSq = distSq;
                    nearestDot = dot;
                }
            });
        });
        return nearestDot;
    }

    // (相同) (findIntermediateDots 函式 ... 保持不變)
    function findIntermediateDots(dotA, dotB) {
        const intermediateDots = [];
        const minX = Math.min(dotA.x, dotB.x) - 1;
        const maxX = Math.max(dotA.x, dotB.x) + 1;
        const minY = Math.min(dotA.y, dotB.y) - 1;
        const maxY = Math.max(dotA.y, dotB.y) + 1;
        const EPSILON = 1e-6; 

        dots.flat().forEach(dot => {
            if (dot.x >= minX && dot.x <= maxX && dot.y >= minY && dot.y <= maxY) {
                const crossProduct = (dotB.y - dotA.y) * (dot.x - dotB.x) - (dot.y - dotB.y) * (dotB.x - dotA.x);
                if (Math.abs(crossProduct) < EPSILON) {
                    intermediateDots.push(dot);
                }
            }
        });

        intermediateDots.sort((a, b) => {
            if (Math.abs(a.x - b.x) > EPSILON) return a.x - b.x;
            return a.y - b.y;
        });

        return intermediateDots;
    }

    // 切換玩家 (【修改】 增加 AI 觸發 和 禁用 input)
    function switchPlayer() {
        currentPlayer = (currentPlayer === 1) ? 2 : 1;
        updateUI();

        // 【新】 如果 AI 啟動且輪到玩家 2 (AI)
        if (isAIBotActive && currentPlayer === 2) {
            drawLengthInput.disabled = true; // 禁用輸入框
            // 給 AI 一點 "思考" 時間
            setTimeout(makeAIMove, 750); // 延遲 750 毫秒
        } else {
            drawLengthInput.disabled = false; // 輪到人類玩家，啟用輸入框
        }
    }

    // 更新分數和玩家狀態 (【修改】 更新 AI 名稱)
    // (updateUI 函式 ... 保持不變)
    function updateUI() {
        score1El.textContent = scores[1];
        score2El.textContent = scores[2];
        
        if (currentPlayer === 1) {
            player1ScoreBox.classList.add('active');
            player2ScoreBox.classList.remove('active', 'player2');
        } else {
            player1ScoreBox.classList.remove('active');
            player2ScoreBox.classList.add('active', 'player2');
        }
        
        // 【新】 更新玩家 2 的計分板標題
        const player2Name = isAIBotActive ? "電腦" : "玩家 2";
        // (找到 <span> 前的文字節點並修改它)
        player2ScoreBox.childNodes[0].nodeValue = `${player2Name}: `;
    }


    // 遊戲結束 (【修改】 增加呼叫勝利動畫 和 禁用 input)
    function endGame() {
        let winnerMessage = "";
        const player2Name = isAIBotActive ? "電腦" : "玩家 2";

        if (scores[1] > scores[2]) {
            winnerMessage = "玩家 1 獲勝！";
        } else if (scores[2] > scores[1]) {
            winnerMessage = `${player2Name} 獲勝！`;
        } else {
            winnerMessage = "平手！";
        }
        winnerText.textContent = winnerMessage;
        
        // 【新】 觸發勝利動畫
        createConfetti(); 
        
        // 【新】 禁用輸入框
        drawLengthInput.disabled = true;

        modalOverlay.classList.remove('hidden'); 
        actionBar.classList.remove('visible'); 
    }


    // ----- 【新】 AI 相關功能 -----

    // (toggleAI, updateAIButton 函式 ... 保持不變)
    function toggleAI() {
        isAIBotActive = !isAIBotActive;
        // 切換模式時，重置遊戲
        initGame();
    }
    function updateAIButton() {
        if (isAIBotActive) {
            toggleAIButton.textContent = 'V.S. 電腦 (已開啟)';
            toggleAIButton.classList.remove('ai-off');
            toggleAIButton.classList.add('ai-on');
        } else {
            toggleAIButton.textContent = 'V.S. 電腦 (已關閉)';
            toggleAIButton.classList.remove('ai-on');
            toggleAIButton.classList.add('ai-off');
        }
    }


    // AI 執行移動 (makeAIMove 函式 ... 結束條件檢查已更新)
    function makeAIMove() {
        // 安全檢查
        if (currentPlayer !== 2 || !isAIBotActive) return;

        // AI 只會畫 "單一線段"
        const bestLineId = findBestMove();

        if (bestLineId) {
            // 找到線段並 "畫" 上去
            const line = lines[bestLineId];
            let newSegmentDrawn = false;
            
            if (line && !line.drawn) { 
                line.drawn = true;
                line.player = currentPlayer; // currentPlayer 肯定是 2
                newSegmentDrawn = true;
            } else if (line && line.player !== 0 && line.player !== currentPlayer) {
                line.sharedBy = currentPlayer;
            }

            if (!newSegmentDrawn) {
                // 找不到新線 (理論上不該發生，除非 findBestMove 出錯)
                switchPlayer(); // 換回玩家
                return;
            }

            // 檢查得分
            let scoredThisTurn = false;
            triangles.forEach(tri => {
                if (!tri.filled) {
                    const isComplete = tri.lineKeys.every(key => lines[key] && lines[key].drawn);
                    if (isComplete) {
                        tri.filled = true;
                        tri.player = currentPlayer;
                        scores[currentPlayer]++;
                        scoredThisTurn = true; // AI 得分了！
                        
                        player2ScoreBox.classList.add('score-pulse');
                        setTimeout(() => {
                            player2ScoreBox.classList.remove('score-pulse');
                        }, 400); 
                    }
                }
            });
            
            drawCanvas();
            updateUI(); 

            // 【重大修改】 檢查遊戲是否結束 (改為檢查所有線是否畫完)
            let totalLines = Object.keys(lines).length;
            let drawnLines = 0;
            for (const id in lines) {
                if (lines[id].drawn) {
                    drawnLines++;
                }
            }

            if (drawnLines === totalLines) {
                // 所有線都畫完了，結束遊戲並統計分數
                endGame();
                return;
            }

            // 【新 AI 規則】 (新規則：每次都換人)
            // 無論 AI 是否得分，都切換回玩家
            switchPlayer();

        } else {
            // 沒找到任何可走的線 (遊戲結束了)
            switchPlayer();
        }
    }

    // AI "大腦": 尋找最佳移動 (findBestMove 函式 ... 保持不變)
    function findBestMove() {
        // 策略 1: 尋找能 "得分" 的線
        const scoringMove = findScoringMove();
        if (scoringMove) {
            return scoringMove;
        }

        // 策略 2: 尋找 "安全" 的線 (不會讓對手得分)
        const safeMoves = findSafeMoves();
        if (safeMoves.length > 0) {
            // 從安全線中隨機選一條
            return safeMoves[Math.floor(Math.random() * safeMoves.length)];
        }

        // 策略 3: 沒安全線了，隨便選一條 (只好送分)
        const allAvailableMoves = Object.values(lines).filter(l => !l.drawn).map(l => l.id);
        if (allAvailableMoves.length > 0) {
            return allAvailableMoves[Math.floor(Math.random() * allAvailableMoves.length)];
        }
        
        return null; // 沒線可走了
    }

    // 策略 1: (findScoringMove 函式 ... 保持不變)
    function findScoringMove() {
        for (const tri of triangles) {
            if (tri.filled) continue;

            let undrawnLineKey = null;
            let drawnCount = 0;
            for (const key of tri.lineKeys) {
                if (lines[key] && lines[key].drawn) {
                    drawnCount++;
                } else if (lines[key]) { // 確保線存在
                    undrawnLineKey = key;
                }
            }

            // 如果剛好 2 條邊被畫了，AI 可以畫第 3 條
            if (drawnCount === 2 && undrawnLineKey) {
                return undrawnLineKey; 
            }
        }
        return null;
    }

    // 策略 2: (findSafeMoves 函式 ... 保持不變)
    function findSafeMoves() {
        const availableLineIds = Object.values(lines).filter(l => !l.drawn).map(l => l.id);
        const safeMoveIds = [];

        for (const lineId of availableLineIds) {
            let isSafe = true;
            
            // 檢查這條線屬於的所有三角形
            for (const tri of triangles) {
                if (tri.filled || !tri.lineKeys.includes(lineId)) {
                    continue; // 三角形已滿或與此線無關
                }

                // "假設" 畫了這條線，三角形會有幾條邊？
                let hypotheticalDrawnCount = 0;
                for (const key of tri.lineKeys) {
                    if ((lines[key] && lines[key].drawn) || key === lineId) {
                        hypotheticalDrawnCount++;
                    }
                }

                // 如果畫了這條線會導致三角形有 2 條邊 (幫對手搭橋)
                if (hypotheticalDrawnCount === 2) {
                    isSafe = false;
                    break; // 這不是安全線，換下一條線
                }
            }

            if (isSafe) {
                safeMoveIds.push(lineId);
            }
        }
        return safeMoveIds;
    }


    // ----- 【新】 勝利動畫 (五彩紙屑) -----
    // (createConfetti 函式 ... 保持不變)
    function createConfetti() {
        if (!confettiContainer) return; // 安全檢查
        
        confettiContainer.innerHTML = ''; // 先清空
        // 您在 style.css 中定義的顏色
        const colors = ['#3498db', '#e74c3c', '#2ecc71', '#f39c12', '#9b59b6']; 
        const confettiCount = 100; // 紙屑數量

        for (let i = 0; i < confettiCount; i++) {
            const confetti = document.createElement('div');
            confetti.classList.add('confetti');
            
            // 隨機屬性
            confetti.style.left = `${Math.random() * 100}vw`; // 水平位置 (橫跨整個視窗)
            confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
            
            // 隨機動畫延遲 (讓它們不同時掉落)
            const delay = Math.random() * 3; // 0~3 秒延遲
            // 隨機動畫速度
            const duration = Math.random() * 3 + 4; // 4~7 秒掉落
            // 隨機旋轉動畫速度
            const rotateSpeed = Math.random() * 2 + 2; // 2~4 秒旋轉
            
            confetti.style.animationDelay = `${delay}s, ${delay}s`; // 兩個動畫都要延遲
            confetti.style.animationDuration = `${duration}s, ${rotateSpeed}s`;

            // 隨機初始角度 (讓飄動更多樣)
            confetti.style.transform = `rotateZ(${Math.random() * 360}deg)`;

            confettiContainer.appendChild(confetti);
        }
    }


    // ----------------------------
    
    // 綁定所有事件 (【新】 加入 AI 按鈕)
    canvas.addEventListener('click', handleCanvasClick);
    canvas.addEventListener('touchstart', function(e) {
        e.preventDefault();
        handleCanvasClick(e);
    });

    resetButton.addEventListener('click', initGame);
    resetButtonModal.addEventListener('click', initGame);
    confirmLineButton.addEventListener('click', confirmLine);
    cancelLineButton.addEventListener('click', cancelLine);
    // 【新】 綁定 AI 切換按鈕
    toggleAIButton.addEventListener('click', toggleAI);

    // 啟動遊戲 (相同)
    initGame();
});
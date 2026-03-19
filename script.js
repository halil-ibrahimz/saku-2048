// Mascot elementi
const mascot = document.getElementById('mascot');

// --- GÖRSEL ÖN YÜKLEME (PRELOADING) ---
function preloadImages() {
    const imagesToPreload = [
        'assets/2.png', 'assets/4.png', 'assets/8.png', 'assets/16.png',
        'assets/32.png', 'assets/64.png', 'assets/128.png', 'assets/256.png',
        'assets/512.png', 'assets/1024.png', 'assets/2048.jpg', 'assets/4096.jpg',
        'assets/mascot/tek.png',
        'assets/mascot/tek%20mutlu.png',
        'assets/mascot/tek%20%C3%BCzg%C3%BCn.png',
        'assets/mascot/platform.png'
    ];

    imagesToPreload.forEach(src => {
        const img = new Image();
        img.src = src;
    });
}
preloadImages(); // Oyun başlarken yükle

// --- BAĞIŞ SİSTEMİ AYARLARI (Burayı Manuel Güncelleyebilirsin) ---
const donationConfig = {
    current: 800,   // Şuan toplanan bağış
    target: 2000,   // Hedef bağış
    label: "Fidan"  // Birim (Fidan, TL vb.)
};

function updateDonationBar() {
    const fill = document.getElementById('donation-fill');
    const text = document.getElementById('donation-text');
    if (!fill || !text) return;

    const percentage = Math.min((donationConfig.current / donationConfig.target) * 100, 100);
    fill.style.width = `${percentage}%`;
    text.innerText = `${donationConfig.current} / ${donationConfig.target} ${donationConfig.label}`;
}
// ----------------------------------------------------------------

const gridElement = document.getElementById('grid');
const tileContainer = document.getElementById('tile-container');
const scoreElement = document.getElementById('score');
const bestScoreElement = document.getElementById('best-score');

let grid = [
    [null, null, null, null],
    [null, null, null, null],
    [null, null, null, null],
    [null, null, null, null]
];
let tiles = [];
let pastTiles = [];
let gameHistory = [];
let score = 0;
let highestTile = 0; // Seviyeyi (animasyonları) takip etmek için
let bestScore = localStorage.getItem('bestScore') || 0;
let tilesCount = 0;
let isAnimating = false; // Prevent multiple keypresses during animation
let isGameOver = false;
let isGameWon = false;
let isEasterEggFound = false;
let is1024Reached = false;
let isPruningMode = false;
let pruningCharges = 2;
let isSwapMode = false;
let swapCharges = 2;
let firstSwapTile = null;

const newGameBtn = document.getElementById('new-game-btn');
const undoBtn = document.getElementById('undo-btn');
const pruneBtn = document.getElementById('prune-btn');
const pruneChargesElement = document.getElementById('prune-charges');
const swapBtn = document.getElementById('swap-btn');
const swapChargesElement = document.getElementById('swap-charges');

class Tile {
    constructor(r, c, value) {
        this.r = r;
        this.c = c;
        this.value = value;
        this.id = 'tile-' + (++tilesCount);
        this.isNew = true;
        this.isMerged = false;
        this.element = null;
    }
}

function saveState() {
    const state = {
        grid: grid.map(row => row.map(tile => tile ? { value: tile.value } : null)),
        score: score,
        isGameOver: isGameOver,
        isGameWon: isGameWon,
        isEasterEggFound: isEasterEggFound,
        is1024Reached: is1024Reached,
        pruningCharges: pruningCharges,
        swapCharges: swapCharges
    };
    localStorage.setItem('gameState', JSON.stringify(state));
}

function pushToHistory() {
    const state = {
        grid: grid.map(row => row.map(tile => tile ? { value: tile.value } : null)),
        score: score,
        isGameOver: isGameOver,
        isGameWon: isGameWon,
        is1024Reached: is1024Reached,
        pruningCharges: pruningCharges,
        swapCharges: swapCharges
    };
    gameHistory.push(JSON.stringify(state));
    if (gameHistory.length > 20) gameHistory.shift(); // Son 20 hamleyi sakla
}

function undoMove() {
    if (gameHistory.length === 0 || isAnimating) return;

    const lastState = JSON.parse(gameHistory.pop());

    // Mevcut durumu temizle
    score = lastState.score;
    isGameOver = lastState.isGameOver;
    isGameWon = lastState.isGameWon;
    is1024Reached = lastState.is1024Reached || false;
    
    // Jokerleri geri yükle ve arayüzü güncelle
    pruningCharges = (lastState.pruningCharges !== undefined) ? lastState.pruningCharges : pruningCharges;
    swapCharges = (lastState.swapCharges !== undefined) ? lastState.swapCharges : swapCharges;
    if (pruneChargesElement) pruneChargesElement.innerText = pruningCharges;
    if (swapChargesElement) swapChargesElement.innerText = swapCharges;

    // Karoları temizle ve yeniden oluştur
    tileContainer.innerHTML = '';
    tiles = [];
    tilesCount = 0;
    grid = [
        [null, null, null, null],
        [null, null, null, null],
        [null, null, null, null],
        [null, null, null, null]
    ];

    for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 4; c++) {
            if (lastState.grid[r][c]) {
                let tile = new Tile(r, c, lastState.grid[r][c].value);
                tile.isNew = false;
                grid[r][c] = tile;
                tiles.push(tile);
            }
        }
    }

    updateScore(0);
    renderBoard();
    saveState();
    checkLevelProgress();

    // Maskotu normale döndür eğer oyun bitmemişse
    if (!isGameOver) {
        setMascotState('idle');
        hideGameOverOverlay();
    }
}

function loadState() {
    const savedState = localStorage.getItem('gameState');
    if (savedState) {
        const state = JSON.parse(savedState);
        score = Math.max(0, state.score || 0); // Ensure non-negative
        isGameOver = state.isGameOver || false;
        isGameWon = state.isGameWon || false;
        isEasterEggFound = state.isEasterEggFound || false;
        is1024Reached = state.is1024Reached || false;
        pruningCharges = (state.pruningCharges !== undefined) ? state.pruningCharges : 2;
        swapCharges = (state.swapCharges !== undefined) ? state.swapCharges : 2;
        grid = [
            [null, null, null, null],
            [null, null, null, null],
            [null, null, null, null],
            [null, null, null, null]
        ];
        tilesCount = 0;
        for (let r = 0; r < 4; r++) {
            for (let c = 0; c < 4; c++) {
                if (state.grid[r][c]) {
                    let tile = new Tile(r, c, state.grid[r][c].value);
                    tile.isNew = false;
                    grid[r][c] = tile;
                    tiles.push(tile);
                }
            }
        }
        return true;
    }
    return false;
}

function checkLevelProgress() {
    let currentHigh = 0;
    for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 4; c++) {
            if (grid[r][c] && grid[r][c].value > currentHigh) {
                currentHigh = grid[r][c].value;
            }
        }
    }

    if (currentHigh > highestTile) {
        highestTile = currentHigh;

        // CSS animasyonları için body etiketine seviye damgası (data attribute)
        if (highestTile >= 64) document.body.setAttribute('data-level', '1-5'); // Yeni eklendi
        if (highestTile >= 128) document.body.setAttribute('data-level', '2');
        if (highestTile >= 256) document.body.setAttribute('data-level', '2-5'); // Yeni eklendi
        if (highestTile >= 512) document.body.setAttribute('data-level', '3');
        if (highestTile >= 2048 && !isGameWon) document.body.setAttribute('data-level', '4');
    }
}

function initGame(forceNew = false) {
    gridElement.innerHTML = '';
    tileContainer.innerHTML = '';
    grid = [
        [null, null, null, null],
        [null, null, null, null],
        [null, null, null, null],
        [null, null, null, null]
    ];
    tiles = [];
    pastTiles = [];
    gameHistory = []; // Yeni oyunda geçmişi temizle (undo exploit önlemi)
    isGameOver = false;
    isGameWon = false;
    isEasterEggFound = false;
    is1024Reached = false;
    isAnimating = false;
    highestTile = 0;
    document.body.setAttribute('data-level', '1');
    isPruningMode = false;
    pruningCharges = 2;
    if (pruneChargesElement) pruneChargesElement.innerText = pruningCharges;
    document.body.classList.remove('pruning-mode');
    if (pruneBtn) pruneBtn.classList.remove('active');

    isSwapMode = false;
    swapCharges = 2;
    firstSwapTile = null;
    if (swapChargesElement) swapChargesElement.innerText = swapCharges;
    document.body.classList.remove('swap-mode');
    if (swapBtn) swapBtn.classList.remove('active');

    setMascotState('idle'); // Maskot uslu uslu oturur
    hideGameOverOverlay(); // Varsa eski oyun bitti uyarısını kaldır

    // Arka plan ızgarasını oluştur (16 hücre)
    for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 4; c++) {
            const cell = document.createElement('div');
            cell.classList.add('cell');
            cell.id = `cell-${r}-${c}`;
            gridElement.appendChild(cell);
        }
    }

    if (!forceNew && loadState()) {
        if (pruneChargesElement) pruneChargesElement.innerText = pruningCharges;
        if (swapChargesElement) swapChargesElement.innerText = swapCharges;
        updateScore(0);
        bestScoreElement.innerText = bestScore;
        setTimeout(() => {
            renderBoard();
            checkLevelProgress();
            updateDonationBar(); // Yüklenen oyun için de güncelle
        }, 50);
    } else {
        score = 0;
        updateScore(0);
        bestScoreElement.innerText = bestScore;
        setTimeout(() => {
            addRandomTile();
            addRandomTile();
            renderBoard();
            saveState();
            checkLevelProgress();
            updateDonationBar(); // Yeni oyun için güncelle
        }, 50);
    }
}

function addRandomTile() {
    let emptyCells = [];
    for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 4; c++) {
            if (grid[r][c] === null) {
                emptyCells.push({ r, c });
            }
        }
    }
    if (emptyCells.length > 0) {
        let randomCell = emptyCells[Math.floor(Math.random() * emptyCells.length)];
        let value = Math.random() < 0.9 ? 2 : 4;
        let tile = new Tile(randomCell.r, randomCell.c, value);
        grid[randomCell.r][randomCell.c] = tile;
        tiles.push(tile);
    }
}

function getCellPosition(r, c) {
    const cell = document.getElementById(`cell-${r}-${c}`);
    if (!cell) return { top: 0, left: 0, width: 0, height: 0 };
    return {
        top: cell.offsetTop,
        left: cell.offsetLeft,
        width: cell.offsetWidth,
        height: cell.offsetHeight
    };
}

function renderBoard() {
    let allTiles = [...tiles, ...pastTiles];

    allTiles.forEach(tile => {
        let el = document.getElementById(tile.id);
        let pos = getCellPosition(tile.r, tile.c);

        if (!el) {
            el = document.createElement('div');
            el.id = tile.id;
            el.className = `tile tile-${tile.value}`;

            // Boyut ve konumu ayarla
            el.style.width = pos.width + 'px';
            el.style.height = pos.height + 'px';

            // ÇOK ÖNEMLİ: CSS transform animasyonundaki o meşhur donanım ivmelendirme
            // bug'ını eziyoruz. Transform yerine direkt left/top kullanacağız.
            el.style.left = pos.left + 'px';
            el.style.top = pos.top + 'px';

            if (tile.value > 1000) el.style.fontSize = '1.8rem';
            else if (tile.value > 100) el.style.fontSize = '2.2rem';
            else el.style.fontSize = '2.5rem';

            // İç div pop animasyonu için
            let inner = document.createElement('div');
            inner.className = 'tile-inner';
            inner.innerText = tile.value;
            inner.style.width = '100%';
            inner.style.height = '100%';
            inner.style.display = 'flex';
            inner.style.justifyContent = 'center';
            inner.style.alignItems = 'center';
            inner.style.borderRadius = '8px';

            if (tile.isNew) {
                el.classList.add('new');
            }
            if (tile.isMerged) {
                inner.classList.add('inner-merged');
            }

            if (tile.value > 2048) el.classList.add('tile-super');

            el.appendChild(inner);
            tileContainer.appendChild(el);

            tile.element = el;

            // Budama veya Değiştirme modu için tıklama olayı
            el.addEventListener('click', () => {
                if (isPruningMode) {
                    pruneTiles(tile.value);
                } else if (isSwapMode) {
                    selectSwapTile(tile);
                }
            });

            tile.isNew = false;
            tile.isMerged = false;
            tile.element = el;
        } else {
            // Var olan elemansa sadece pozisyonu ve boyutunu yeni yerine doğru anime et
            el.style.width = pos.width + 'px';
            el.style.height = pos.height + 'px';

            el.style.left = pos.left + 'px';
            el.style.top = pos.top + 'px';

            if (tile.value > 1000) el.style.fontSize = '1.8rem';
            else if (tile.value > 100) el.style.fontSize = '2.2rem';
            else el.style.fontSize = '2.5rem';
        }
    });

    // Silinmesi gereken eski kareleri DOM'dan kaldır
    if (pastTiles.length > 0) {
        let toRemove = [...pastTiles];
        pastTiles = [];
        setTimeout(() => {
            toRemove.forEach(t => {
                let el = document.getElementById(t.id);
                if (el) el.remove();
            });
            isAnimating = false;
        }, 120); // CSS transition süresi
    } else {
        setTimeout(() => {
            isAnimating = false;
        }, 120);
    }
}

function updateScore(add = 0) {
    if (add > 0) score += add;
    scoreElement.innerText = score;
    if (score > bestScore) {
        bestScore = score;
        localStorage.setItem('bestScore', bestScore);
        bestScoreElement.innerText = bestScore;
    }
}

// ---- MASKOT METOTLARI ----
function setMascotState(state, duration = 0) {
    if (!mascot) return;

    // Tüm classları temizle
    mascot.className = '';

    // Yeni classı ekle
    mascot.classList.add(`mascot-${state}`);

    // Eğer geçici bir durumsa (örn. zıplama) süre bitince idle'a dön
    if (duration > 0 && state !== 'idle') {
        setTimeout(() => {
            // Eğer o arada oyun bitmediyse idle a dön
            if (!isGameOver) {
                mascot.className = 'mascot-idle';
            }
        }, duration);
    }
}

// ---- YÖN METOTLARI ----
function moveLeft() {
    let moved = false;
    for (let r = 0; r < 4; r++) {
        let row = grid[r].filter(t => t !== null);
        let targetC = 0;
        let newRow = [null, null, null, null];
        for (let i = 0; i < row.length; i++) {
            let curr = row[i];
            let next = row[i + 1];
            if (next && curr.value === next.value) {
                let mergedTile = new Tile(r, targetC, curr.value * 2);
                mergedTile.isMerged = true;

                curr.r = r; curr.c = targetC;
                next.r = r; next.c = targetC;

                // Eğer büyük bir birleşme olduysa maskotu sevindir
                if (curr.value * 2 >= 64) {
                    setMascotState('happy', 1500); // 1.5 saniye sevinir
                }

                pastTiles.push(curr, next); // Eski tile'lar kayma animasyonu için bekleyecek
                tiles = tiles.filter(t => t.id !== curr.id && t.id !== next.id);
                tiles.push(mergedTile);

                newRow[targetC] = mergedTile;
                updateScore(curr.value * 2);
                i++;
                targetC++;
                moved = true;
            } else {
                newRow[targetC] = curr;
                if (curr.c !== targetC || curr.r !== r) {
                    curr.r = r; curr.c = targetC;
                    moved = true;
                }
                targetC++;
            }
        }
        grid[r] = newRow;
    }
    return moved;
}

function moveRight() {
    let moved = false;
    for (let r = 0; r < 4; r++) {
        let row = grid[r].filter(t => t !== null).reverse();
        let targetC = 3;
        let newRow = [null, null, null, null];
        for (let i = 0; i < row.length; i++) {
            let curr = row[i];
            let next = row[i + 1];
            if (next && curr.value === next.value) {
                let mergedTile = new Tile(r, targetC, curr.value * 2);
                mergedTile.isMerged = true;

                curr.r = r; curr.c = targetC;
                next.r = r; next.c = targetC;

                // Eğer büyük bir birleşme olduysa maskotu sevindir
                if (curr.value * 2 >= 64) {
                    setMascotState('happy', 1500); // 1.5 saniye sevinir
                }

                pastTiles.push(curr, next);
                tiles = tiles.filter(t => t.id !== curr.id && t.id !== next.id);
                tiles.push(mergedTile);

                newRow[targetC] = mergedTile;
                updateScore(curr.value * 2);
                i++;
                targetC--;
                moved = true;
            } else {
                newRow[targetC] = curr;
                if (curr.c !== targetC || curr.r !== r) {
                    curr.r = r; curr.c = targetC;
                    moved = true;
                }
                targetC--;
            }
        }
        grid[r] = newRow;
    }
    return moved;
}

function moveUp() {
    let moved = false;
    for (let c = 0; c < 4; c++) {
        let col = [grid[0][c], grid[1][c], grid[2][c], grid[3][c]].filter(t => t !== null);
        let targetR = 0;
        let newCol = [null, null, null, null];
        for (let i = 0; i < col.length; i++) {
            let curr = col[i];
            let next = col[i + 1];
            if (next && curr.value === next.value) {
                let mergedTile = new Tile(targetR, c, curr.value * 2);
                mergedTile.isMerged = true;

                curr.r = targetR; curr.c = c;
                next.r = targetR; next.c = c;

                // Eğer büyük bir birleşme olduysa maskotu sevindir
                if (curr.value * 2 >= 64) {
                    setMascotState('happy', 1500); // 1.5 saniye sevinir
                }

                pastTiles.push(curr, next);
                tiles = tiles.filter(t => t.id !== curr.id && t.id !== next.id);
                tiles.push(mergedTile);

                newCol[targetR] = mergedTile;
                updateScore(curr.value * 2);
                i++;
                targetR++;
                moved = true;
            } else {
                newCol[targetR] = curr;
                if (curr.r !== targetR || curr.c !== c) {
                    curr.r = targetR; curr.c = c;
                    moved = true;
                }
                targetR++;
            }
        }
        for (let r = 0; r < 4; r++) grid[r][c] = newCol[r];
    }
    return moved;
}

function moveDown() {
    let moved = false;
    for (let c = 0; c < 4; c++) {
        let col = [grid[0][c], grid[1][c], grid[2][c], grid[3][c]].filter(t => t !== null).reverse();
        let targetR = 3;
        let newCol = [null, null, null, null];
        for (let i = 0; i < col.length; i++) {
            let curr = col[i];
            let next = col[i + 1];
            if (next && curr.value === next.value) {
                let mergedTile = new Tile(targetR, c, curr.value * 2);
                mergedTile.isMerged = true;

                curr.r = targetR; curr.c = c;
                next.r = targetR; next.c = c;

                // Eğer büyük bir birleşme olduysa maskotu sevindir
                if (curr.value * 2 >= 64) {
                    setMascotState('happy', 1500); // 1.5 saniye sevinir
                }

                pastTiles.push(curr, next);
                tiles = tiles.filter(t => t.id !== curr.id && t.id !== next.id);
                tiles.push(mergedTile);

                newCol[targetR] = mergedTile;
                updateScore(curr.value * 2);
                i++;
                targetR--;
                moved = true;
            } else {
                newCol[targetR] = curr;
                if (curr.r !== targetR || curr.c !== c) {
                    curr.r = targetR; curr.c = c;
                    moved = true;
                }
                targetR--;
            }
        }
        for (let r = 0; r < 4; r++) grid[r][c] = newCol[r];
    }
    return moved;
}

// ---- BUDAMA (PRUNING) METOTLARI ----
function togglePruningMode() {
    if (isGameOver || isAnimating || pruningCharges <= 0) return;

    isPruningMode = !isPruningMode;

    if (isPruningMode) {
        document.body.classList.add('pruning-mode');
        pruneBtn.classList.add('active');
    } else {
        exitPruningMode();
    }
}

function exitPruningMode() {
    isPruningMode = false;
    document.body.classList.remove('pruning-mode');
    if (pruneBtn) pruneBtn.classList.remove('active');
}

function pruneTiles(value) {
    if (!isPruningMode || pruningCharges <= 0) return;

    pushToHistory(); // Budamadan önce durumu sakla ki geri alınabilsin

    let pruneCount = 0;
    for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 4; c++) {
            if (grid[r][c] && grid[r][c].value === value) {
                let tile = grid[r][c];
                pastTiles.push(tile);
                tiles = tiles.filter(t => t.id !== tile.id);
                grid[r][c] = null;
                pruneCount++;
            }
        }
    }

    if (pruneCount > 0) {
        pruningCharges--;
        if (pruneChargesElement) pruneChargesElement.innerText = pruningCharges;

        // Görsel güncelleme
        renderBoard();
        saveState();
        checkGameOver();

        // Maskot tepkisi
        setMascotState('happy', 1000);
    }

    exitPruningMode();
}

// ---- DEĞİŞTİRME (SWAP) METOTLARI ----
function toggleSwapMode() {
    if (isGameOver || isAnimating || swapCharges <= 0) return;

    isSwapMode = !isSwapMode;

    if (isSwapMode) {
        // Varsa diğer modları kapat
        exitPruningMode();
        document.body.classList.add('swap-mode');
        swapBtn.classList.add('active');
    } else {
        exitSwapMode();
    }
}

function exitSwapMode() {
    isSwapMode = false;
    if (firstSwapTile && firstSwapTile.element) {
        firstSwapTile.element.classList.remove('selected');
    }
    firstSwapTile = null;
    document.body.classList.remove('swap-mode');
    if (swapBtn) swapBtn.classList.remove('active');
}

function selectSwapTile(tile) {
    if (!isSwapMode || swapCharges <= 0) return;

    if (!firstSwapTile) {
        // İlk taşı seçtik
        firstSwapTile = tile;
        tile.element.classList.add('selected');
    } else if (firstSwapTile.id === tile.id) {
        // Aynı taşa tıkladı, seçimi iptal et
        tile.element.classList.remove('selected');
        firstSwapTile = null;
    } else {
        // İkinci taşı seçtik, takası yap
        swapTiles(firstSwapTile, tile);
    }
}

function swapTiles(t1, t2) {
    pushToHistory(); // Takastan önce durumu sakla

    // Grid'deki yerlerini değiştir
    const r1 = t1.r, c1 = t1.c;
    const r2 = t2.r, c2 = t2.c;

    grid[r1][c1] = t2;
    grid[r2][c2] = t1;

    // Tile objelerinin içindeki r ve c değerlerini güncelle
    t1.r = r2; t1.c = c2;
    t2.r = r1; t2.c = c1;

    swapCharges--;
    if (swapChargesElement) swapChargesElement.innerText = swapCharges;

    // Görsel güncelleme
    renderBoard();
    saveState();

    // Maskot sevinir
    setMascotState('happy', 1000);

    // Moddan çık
    exitSwapMode();
}

function handleInput(e) {
    if (isAnimating || isGameOver || isPruningMode || isSwapMode) return;

    pushToHistory(); // Hamle yapmadan önce durumu sakla

    let moved = false;
    if (e.key === 'ArrowLeft') moved = moveLeft();
    else if (e.key === 'ArrowRight') moved = moveRight();
    else if (e.key === 'ArrowUp') moved = moveUp();
    else if (e.key === 'ArrowDown') moved = moveDown();

    if (moved) {
        isAnimating = true;
        renderBoard(); // Move tiles visually first

        setTimeout(() => {
            addRandomTile(); // Spawn after move completes
            renderBoard();
            saveState();
            checkLevelProgress();
            checkGameOver();
        }, 120);
    }
}

function checkGameOver() {
    if (isGameOver) return;

    for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 4; c++) {
            const val = grid[r][c] ? grid[r][c].value : 0;
            if (val === 1024 && !is1024Reached) {
                is1024Reached = true;
                pruningCharges += 1;
                swapCharges += 1;
                if (pruneChargesElement) pruneChargesElement.innerText = pruningCharges;
                if (swapChargesElement) swapChargesElement.innerText = swapCharges;
                saveState();
            }
            if (val === 2048 && !isGameWon) {
                isGameWon = true;
                pruningCharges += 3;
                swapCharges += 3;
                if (pruneChargesElement) pruneChargesElement.innerText = pruningCharges;
                if (swapChargesElement) swapChargesElement.innerText = swapCharges;
                // Oyun DEVAM EDER, sadece tebrik
                saveState();
                setMascotState('happy');
                createVictoryLeaves();
                setTimeout(() => showGameModal('🎉 Tebrikler!', "Tebrikler buraya kadar geldin! Bu dijital ormanı gerçek bir ormana çevirmek için sana da ihtiyacımız var, bağış yaparak bize destek olabilirsin. Devam etmek istersen Saku'nun sana joker hediyesi var 🌸", 'win'), 800);
            }
            if (val === 4096 && !isEasterEggFound) {
                isEasterEggFound = true;
                isGameOver = true; // 4096'da oyun KESİNLİKLE biter
                saveState();
                setMascotState('happy');
                createVictoryLeaves();
                setTimeout(() => showGameModal('😱 İNANILMAZ!', "Vay be! Sona kadar geldin 🫡 Saku sana şimdilik veda ediyor ama oluşturacağımız ormana olan desteğinde sana güveniyor!", 'easter'), 800);
                return; // 4096'da artık başka kontrol yapma
            }
        }
    }

    // Tahta dolu mu kontrolü
    for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 4; c++) {
            if (grid[r][c] === null) return;
        }
    }
    // Birleştirilebilecek komşu var mı?
    for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 4; c++) {
            let val = grid[r][c].value;
            if (c !== 3 && grid[r][c + 1] && val === grid[r][c + 1].value) return;
            if (r !== 3 && grid[r + 1][c] && val === grid[r + 1][c].value) return;
        }
    }

    // Tahta doldu ve hamle kalmadı — ama modal GÖSTERME!
    // Kullanıcı geri al (undo) ile kurtulabilsin.
    isGameOver = true;
    saveState();
    setMascotState('sad');
    showGameOverOverlay(); // Tahtanın üzerine ufak bir uyarı göster
}

// --- OYUN BİTTİ OVERLAY ---
function showGameOverOverlay() {
    // Zaten varsa tekrar ekleme
    if (document.getElementById('game-over-overlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'game-over-overlay';
    overlay.innerHTML = `
        <div class="game-over-text">
            <span>🍂</span>
            <p>Hamle kalmadı!</p>
            <small>↩ Geri al ile kurtulabilirsin</small>
        </div>
    `;
    document.getElementById('game-container').appendChild(overlay);
}

function hideGameOverOverlay() {
    const overlay = document.getElementById('game-over-overlay');
    if (overlay) overlay.remove();
}

// Kontroller
window.addEventListener('keydown', function (e) {
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].indexOf(e.key) > -1) {
        e.preventDefault();
        handleInput(e);
    }
});

let touchStartX = 0, touchStartY = 0;
document.addEventListener('touchstart', e => {
    touchStartX = e.changedTouches[0].screenX;
    touchStartY = e.changedTouches[0].screenY;
}, { passive: false });

document.addEventListener('touchmove', e => {
    if (document.body.classList.contains('modal-open')) return;
    e.preventDefault();
}, { passive: false });

document.addEventListener('touchend', e => {
    if (isAnimating || isGameOver || isPruningMode || isSwapMode) return;
    let touchEndX = e.changedTouches[0].screenX;
    let touchEndY = e.changedTouches[0].screenY;

    let diffX = touchEndX - touchStartX;
    let diffY = touchEndY - touchStartY;

    if (Math.abs(diffX) < 30 && Math.abs(diffY) < 30) return;

    pushToHistory(); // Hamleden ÖNCE durumu sakla (undo için kritik)

    let moved = false;
    if (Math.abs(diffX) > Math.abs(diffY)) {
        if (diffX > 0) moved = moveRight();
        else moved = moveLeft();
    } else {
        if (diffY > 0) moved = moveDown();
        else moved = moveUp();
    }

    if (moved) {
        isAnimating = true;
        renderBoard(); // Move tiles visually first

        setTimeout(() => {
            addRandomTile(); // Spawn after move completes
            renderBoard();
            saveState();
            checkLevelProgress();
            checkGameOver();
        }, 120);
    }
}, { passive: false });

// Ekran boyutlandırma
window.addEventListener('resize', () => {
    if (!isAnimating) renderBoard();
});

// Yeni oyun butonu
if (newGameBtn) {
    newGameBtn.addEventListener('click', () => {
        initGame(true);
    });
}

if (undoBtn) {
    undoBtn.addEventListener('click', () => {
        undoMove();
    });
}

if (pruneBtn) {
    pruneBtn.addEventListener('click', () => {
        togglePruningMode();
    });
}

if (swapBtn) {
    swapBtn.addEventListener('click', () => {
        toggleSwapMode();
    });
}

// --- YAPRAK DÖKÜMÜ EFEKTİ (2048 / KAZANMA DURUMU) ---
function createVictoryLeaves() {
    for (let i = 0; i < 40; i++) {
        let leaf = document.createElement('div');
        leaf.className = 'victory-leaf';
        leaf.innerHTML = '🍃';

        // Rastgele özellikler (hız, yön, boyut)
        let left = Math.random() * 100; // Ekranın % kaçlık kısmından düşecek
        let duration = Math.random() * 3 + 2; // 2 ile 5 saniye arası
        let delay = Math.random() * 2; // Gecikme
        let size = Math.random() * 1.5 + 0.8; // 0.8em - 2.3em arası

        leaf.style.left = `${left}%`;
        leaf.style.animationDuration = `${duration}s`;
        leaf.style.animationDelay = `${delay}s`;
        leaf.style.fontSize = `${size}rem`;

        document.body.appendChild(leaf);

        // Düşen yaprağı sil
        setTimeout(() => {
            leaf.remove();
        }, (duration + delay) * 1000);
    }
}

// --- DOĞA GÜNLÜĞÜ MODAL KONTROLÜ ---
const infoBtn = document.getElementById('info-btn');
const infoModal = document.getElementById('info-modal');
const closeModal = document.querySelector('.close-modal');

if (infoBtn) {
    infoBtn.addEventListener('click', () => {
        infoModal.style.display = 'block';
        document.body.classList.add('modal-open');
    });
}

if (closeModal) {
    closeModal.addEventListener('click', () => {
        infoModal.style.display = 'none';
        document.body.classList.remove('modal-open');
    });
}

window.addEventListener('click', (event) => {
    if (event.target == infoModal) {
        infoModal.style.display = 'none';
        document.body.classList.remove('modal-open');
    }
});

// --- OYUN SONU MODAL FONKSİYONU ---
function showGameModal(title, message, type) {
    const modal = document.getElementById('game-modal');
    const modalTitle = document.getElementById('game-modal-title');
    const modalMessage = document.getElementById('game-modal-message');
    const modalIcon = document.getElementById('game-modal-icon');
    const continueBtn = document.getElementById('game-modal-continue');
    const newGameModalBtn = document.getElementById('game-modal-newgame');
    const donateBtnWrapper = document.getElementById('game-modal-donate-wrapper');

    if (!modal) return;

    modalTitle.innerText = title;
    // Satır sonlarını (newline) korumak için innerHTML kullanıyorum veya manuel <br> ekleyebiliriz ama CSS yeterli olabilir. Metinler uzun olduğu için innerText yeterli.
    modalMessage.innerText = message;

    // Tip bazlı ikon ve stiller
    if (type === 'win') {
        modalIcon.innerText = '🌸';
        modal.className = 'modal game-modal-win';
        continueBtn.style.display = 'inline-block'; // 2048'de devam edebilir
        newGameModalBtn.style.display = 'none'; // Kullanıcı talebi: 2048 ekranında 'Yeni Oyun' butonunu gizle
        if (donateBtnWrapper) donateBtnWrapper.style.display = 'block';
    } else if (type === 'easter') {
        modalIcon.innerText = '👋';
        modal.className = 'modal game-modal-easter';
        continueBtn.style.display = 'none'; // 4096'da oyun bitti, devam yok
        newGameModalBtn.style.display = 'inline-block';
        if (donateBtnWrapper) donateBtnWrapper.style.display = 'block';
    } else {
        modalIcon.innerText = '🍂';
        modal.className = 'modal game-modal-lose';
        continueBtn.style.display = 'none';
        newGameModalBtn.style.display = 'inline-block';
        if (donateBtnWrapper) donateBtnWrapper.style.display = 'none';
    }

    modal.style.display = 'block';
    document.body.classList.add('modal-open');
}

function closeGameModal() {
    const modal = document.getElementById('game-modal');
    if (modal) {
        modal.style.display = 'none';
        document.body.classList.remove('modal-open');
    }
}

// Game modal event listeners
const gameModalContinue = document.getElementById('game-modal-continue');
const gameModalNewGame = document.getElementById('game-modal-newgame');

if (gameModalContinue) {
    gameModalContinue.addEventListener('click', () => {
        closeGameModal();
    });
}

if (gameModalNewGame) {
    gameModalNewGame.addEventListener('click', () => {
        closeGameModal();
        initGame(true);
    });
}

// Başlat 
initGame();

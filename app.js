//const RENDER_API_URL = "https://othero-server.onrender.com";
// ==========================================
// 1. グローバル設定と状態管理
// ==========================================
const RENDER_API_URL = "https://othero-server.onrender.com";

let board = [];
const BOARD_SIZE = 8;
const EMPTY = 0;
const BLACK = 1; // プレイヤー
const WHITE = 2; // CPU

let currentPlayer = BLACK;
let isPiUser = false;
let piUsername = "";
let accessToken = "";

// DOM要素の取得
const authContainer = document.getElementById("auth-container");
const gameContainer = document.getElementById("game-container");
const authStatus = document.getElementById("auth-status");
const displayUsername = document.getElementById("display-username");
const boardElement = document.getElementById("board");
const scoreBlackElement = document.getElementById("score-black");
const scoreWhiteElement = document.getElementById("score-white");
const gameMessageElement = document.getElementById("game-message");
const btnRestart = document.getElementById("btn-restart");
const leaderboardBody = document.getElementById("leaderboard-body");

// ==========================================
// 2. Pi Network 認証・ジャンプ機能（今回の主要アップデート）
// ==========================================


// ボタンの要素を取得
const piLoginBtn = document.getElementById("piLoginBtn");

// ボタンがクリックされた時の処理
if (piLoginBtn) {
  piLoginBtn.addEventListener("click", async () => {
    // 1. Piブラウザ環境（Piオブジェクトが存在するか）をチェック
    if (typeof Pi !== 'undefined') {
      authStatus.innerText = "Pi Network環境を検出しました。認証中...";
      try {
        // クリックされてから初期化を実行する
        await Pi.init({ version: "2.0" });
        
        // 認証に必要なスコープ
        const scopes = ["username"];
        
        // 認証を実行
        const auth = await Pi.authenticate(scopes, onIncompletePaymentFound);
        
        // 認証成功：取得したユーザー名をオセロのログイン処理に渡す
        if (auth && auth.user && auth.user.username) {
          completeLogin(auth.user.username);
        } else {
          authStatus.innerText = "ユーザー名の取得に失敗しました。";
        }
      } catch (e) {
        console.error("認証中にエラーが発生しました:", e);
        authStatus.innerText = "認証エラーが発生しました。再試行してください。";
      }
    } else {
      // 2. Chromeなどの一般ブラウザの場合：エラーを起こすpi://は使わず、案内文を出す
      authStatus.innerHTML = "<div style='color:#e74c3c; font-weight:bold; margin-top:10px;'>【重要】このボタンはPiブラウザ専用です。<br>『Pi Browser』アプリ内のApp Studio（Use External AI）からこのアプリを開いてください。</div>";
    }
  });
}

// 決済用のダミー関数（Piの仕様上必須）
function onIncompletePaymentFound(payment) {
  console.log("未完了の決済:", payment);
}







                  

// ダミー関数（支払い登録の要件を満たすために必須）
function onIncompletePaymentFound(payment) {
    console.log("Incomplete payment found:", payment);
}

// ==========================================
// 3. ランキング通信機能（Render API連携）
// ==========================================
async function fetchLeaderboard() {
    try {
        const response = await fetch(`${RENDER_API_URL}/api/leaderboard`);
        if (!response.ok) throw new Error("Network response was not ok");
        const data = await response.json();

        leaderboardBody.innerHTML = "";
        if (data.length === 0) {
            leaderboardBody.innerHTML = `<tr><td colspan="3" style="text-align:center;">No data available</td></tr>`;
            return;
        }

        data.forEach((row, index) => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>${index + 1}</td>
                <td>${row.username}</td>
                <td>${row.match_count}回</td>
            `;
            leaderboardBody.appendChild(tr);
        });
    } catch (error) {
        console.error("Error fetching leaderboard:", error);
        leaderboardBody.innerHTML = `<tr><td colspan="3" style="text-align:center; color:red;">Failed to load leaderboard</td></tr>`;
    }
}

async function sendMatchComplete(username) {
    try {
        const response = await fetch(`${RENDER_API_URL}/api/match-complete`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                username: username,
                accessToken: accessToken // Piユーザーの場合はトークンを送信（ゲストは空）
            })
        });
        if (response.ok) {
            console.log("Match data saved successfully");
            fetchLeaderboard(); // ランキングを即座に更新
        } else {
            console.error("Failed to save match data");
        }
    } catch (error) {
        console.error("Error sending match complete:", error);
    }
}

// ==========================================
// 4. オセロゲーム コアロジック
// ==========================================
function initGame() {
    board = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(EMPTY));
    board[3][3] = WHITE;
    board[3][4] = BLACK;
    board[4][3] = BLACK;
    board[4][4] = WHITE;
    currentPlayer = BLACK;
    updateUI();
}

function updateUI() {
    boardElement.innerHTML = "";
    let blackCount = 0;
    let whiteCount = 0;

    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            const cellValue = board[r][c];
            if (cellValue === BLACK) blackCount++;
            if (cellValue === WHITE) whiteCount++;

            const cell = document.createElement("div");
            cell.classList.add("cell");
            cell.dataset.row = r;
            cell.dataset.col = c;

            if (cellValue !== EMPTY) {
                const piece = document.createElement("div");
                piece.classList.add("piece", cellValue === BLACK ? "black" : "white");
                cell.appendChild(piece);
            } else if (currentPlayer === BLACK && isValidMove(r, c, BLACK)) {
                // プレイヤーが置ける場所にガイド（ドット）を表示
                cell.classList.add("valid-move");
                cell.addEventListener("click", handleCellClick);
            }

            boardElement.appendChild(cell);
        }
    }

    scoreBlackElement.innerText = blackCount;
    scoreWhiteElement.innerText = whiteCount;

    // 進行フリーズバグ修正用のパス・終了チェック
    checkGameStatus(blackCount, whiteCount);
}

function handleCellClick(e) {
    if (currentPlayer !== BLACK) return;
    const r = parseInt(e.currentTarget.dataset.row);
    const c = parseInt(e.currentTarget.dataset.col);

    makeMove(r, c, BLACK);
    currentPlayer = WHITE;
    gameMessageElement.innerText = "CPU is thinking...";
    
    // CPUの着手（1秒後に実行）
    setTimeout(cpuMove, 1000);
}

function cpuMove() {
    if (!canPlayerMove(WHITE)) {
        currentPlayer = BLACK;
        updateUI();
        return;
    }

    // 置けるマスを全列挙
    let moves = [];
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            if (isValidMove(r, c, WHITE)) {
                moves.push({ r, c });
            }
        }
    }

    if (moves.length > 0) {
        // ランダムに選んで着手
        const choice = moves[Math.floor(Math.random() * moves.length)];
        makeMove(choice.r, choice.c, WHITE);
    }

    currentPlayer = BLACK;
    updateUI();
}

function makeMove(row, col, player) {
    const directions = [
        [-1,-1], [-1,0], [-1,1],
        [ 0,-1],         [ 0,1],
        [ 1,-1], [ 1,0], [ 1,1]
    ];
    board[row][col] = player;

    directions.forEach(([dr, dc]) => {
        if (wouldFlip(row, col, dr, dc, player)) {
            let r = row + dr;
            let c = col + dc;
            while (board[r][c] !== player) {
                board[r][c] = player;
                r += dr;
                c += dc;
            }
        }
    });
}

function isValidMove(row, col, player) {
    if (board[row][col] !== EMPTY) return false;
    const directions = [
        [-1,-1], [-1,0], [-1,1],
        [ 0,-1],         [ 0,1],
        [ 1,-1], [ 1,0], [ 1,1]
    ];
    return directions.some(([dr, dc]) => wouldFlip(row, col, dr, dc, player));
}

function wouldFlip(row, col, dr, dc, player) {
    const opponent = player === BLACK ? WHITE : BLACK;
    let r = row + dr;
    let c = col + dc;

    if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE || board[r][c] !== opponent) {
        return false;
    }

    r += dr;
    c += dc;
    while (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE) {
        if (board[r][c] === EMPTY) return false;
        if (board[r][c] === player) return true;
        r += dr;
        c += dc;
    }
    return false;
}

function canPlayerMove(player) {
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            if (isValidMove(r, c, player)) return true;
        }
    }
    return false;
}

function checkGameStatus(blackCount, whiteCount) {
    const blackCanMove = canPlayerMove(BLACK);
    const whiteCanMove = canPlayerMove(WHITE);
    if (! blackCanMove && ! whiteCanMove) {// 両者打てなくなったらゲーム終了
        let msg = "Game Over! Black: ${blackCount}, White: ${whiteCount}.";
    //if (!blackCanMove && !whiteCanMove) {// 両者打てなくなったらゲーム終了
        //let msg = Game Over! Black: ${blackCount}, White: ${whiteCount}. ;
        if (blackCount > whiteCount) {
            msg += "You Win! 🎉";
        } else if (whiteCount > blackCount) {
            msg += "CPU Wins! 🤖";
        } else {
            msg += "It's a Tie! 🤝";
        }
        gameMessageElement.innerText = msg;// 対戦結果をサーバーへ自動送信
        sendMatchComplete(displayUsername.innerText);
        alert(msg + "\nYour match data has been saved!");
    } else if (currentPlayer === BLACK && !blackCanMove) {// プレイヤーがパスの場合
        gameMessageElement.innerText = "You have no moves. Pass to CPU...";
        currentPlayer = WHITE;
        setTimeout(cpuMove, 1500);
    } else if (currentPlayer === WHITE && !whiteCanMove) {// CPUがパスの場合
        gameMessageElement.innerText = "CPU has no moves. It's your turn!";
        currentPlayer = BLACK;// 有効着手ガイドを出すために再描画
        setTimeout(updateUI, 500);} else {// 通常の進行メッセージ
        if (currentPlayer === BLACK) {
            gameMessageElement.innerText = "Your turn (Black)";
        }
    }
}
btnRestart.addEventListener("click", initGame);

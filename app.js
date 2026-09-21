// Part 1: Pi Network Authentication and Initial Setup
//const RENDER_API_URL = "https://onrender.com";
const RENDER_API_URL = "https://othero-server.onrender.com";

let currentUsername = "";
let piAuthToken = "";
const boardElement = document.getElementById('board');
const statusElement = document.getElementById('status');
let board = [];
let turn = 1; // 1: Black (Player), -1: White (CPU)

// Automatically trigger Pi authentication when the app loads
window.onload = async function() {
    fetchLeaderboard();
    await initPiAuthentication();
};

// Initialize Pi SDK as a Promise and Authenticate
async function initPiAuthentication() {
    if (typeof Pi !== 'undefined') {
        try {
            statusElement.textContent = "Initializing Pi Network SDK...";
            // Treat Pi.init as a Promise
            await new Promise((resolve) => {
                Pi.init({ version: "2.0", sandbox: true });
                resolve();
            });

            statusElement.textContent = "Authenticating with Pi Network...";
            // Request username scope
            const auth = await Pi.authenticate(["username"], onIncompletePaymentFound);
            
            // Send token to backend for validation
            const isVerified = await verifyPiSessionOnBackend(auth.accessToken);
            if (isVerified) {
                currentUsername = auth.user.username;
                piAuthToken = auth.accessToken;
                document.getElementById('setup-area').style.display = 'none';
                document.getElementById('game-area').style.display = 'block';
                initGame();
            } else {
                statusElement.textContent = "Pi Authentication failed on server.";
            }
        } catch (error) {
            console.error("Pi Network Auth Error:", error);
            statusElement.textContent = "Pi Auth failed. Please sign in manually or use Guest mode.";
        }
    } else {
        statusElement.textContent = "Pi SDK not found. Running in Guest / Web mode.";
    }
}

function onIncompletePaymentFound(payment) {
    console.log("Incomplete payment found:", payment);
}

// Manual sign-in trigger button function
async function handleManualSignIn() {
    await initPiAuthentication();
}

// Send access token to backend for verification
async function verifyPiSessionOnBackend(accessToken) {
    try {
        const response = await fetch(`${RENDER_API_URL}/api/verify-session`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ accessToken: accessToken })
        });
        const result = await response.json();
        return result.success;
    } catch (error) {
        console.error("Session verification failed:", error);
        return false;
    }
}

// Guest Play Function
function startGuestGame() {
    const input = document.getElementById('username-input').value.trim();
    if (!input) {
        alert("Please enter a username!");
        return;
    }
    currentUsername = input + " (Guest)";
    document.getElementById('setup-area').style.display = 'none';
    document.getElementById('game-area').style.display = 'block';
    initGame();
}
// Part 2: Othello Game Core Logic and Pass Handling (English UI)
function initGame() {
    boardElement.innerHTML = "";
    board = Array(8).fill(null).map(() => Array(8).fill(0));
    turn = 1;
    statusElement.textContent = "Your turn (Black)";

    // Initial 4 discs layout
    board[3][3] = -1; board[3][4] = 1;
    board[4][3] = 1;  board[4][4] = -1;

    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const cell = document.createElement('div');
            cell.className = 'cell';
            cell.dataset.row = r;
            cell.dataset.col = c;
            
            const disc = document.createElement('div');
            disc.className = 'disc';
            cell.appendChild(disc);
            
            cell.addEventListener('click', () => handleCellClick(r, c));
            boardElement.appendChild(cell);
        }
    }
    updateBoardDOM();
}

function updateBoardDOM() {
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const cell = boardElement.children[r * 8 + c];
            const disc = cell.firstChild;
            disc.className = 'disc';
            if (board[r][c] === 1) disc.classList.add('black');
            if (board[r][c] === -1) disc.classList.add('white');
        }
    }
}

// Check if a specific player (1 or -1) has any valid moves left
function canPlayerMove(color) {
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            if (board[r][c] === 0 && flipDiscs(r, c, color, false)) {
                return true;
            }
        }
    }
    return false;
}

function handleCellClick(r, c) {
    if (turn !== 1 || board[r][c] !== 0) return;
    
    // Player's move (Black)
    if (flipDiscs(r, c, 1, true)) {
        board[r][c] = 1;
        updateBoardDOM();
        
        if (isGameOver()) {
            endGame();
            return;
        }

        // Switch turn to CPU (White)
        turn = -1;
        
        if (canPlayerMove(-1)) {
            statusElement.textContent = "CPU is thinking...";
            setTimeout(cpuTurn, 800);
        } else {
            // If CPU cannot move, CPU passes and turn returns to Player
            alert("CPU has no valid moves and passes.");
            turn = 1;
            statusElement.textContent = "Your turn (Black)";
        }
    }
}

function cpuTurn() {
    let moves = [];
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            if (board[r][c] === 0 && flipDiscs(r, c, -1, false)) {
                moves.push({r, c});
            }
        }
    }
    
    if (moves.length > 0) {
        const move = moves[Math.floor(Math.random() * moves.length)];
        flipDiscs(move.r, move.c, -1, true);
        board[move.r][move.c] = -1;
        updateBoardDOM();
    }

    if (isGameOver()) {
        endGame();
        return;
    }

    // Switch turn back to Player (Black)
    turn = 1;

    // Check if Player can move, if not, Player passes back to CPU automatically
    if (!canPlayerMove(1)) {
        alert("You have no valid moves and must pass.");
        turn = -1;
        statusElement.textContent = "CPU is thinking...";
        setTimeout(cpuTurn, 800);
    } else {
        statusElement.textContent = "Your turn (Black)";
    }
}
// Part 3: Flip Logic, Server Communication and HTML Structure Integration

function flipDiscs(row, col, color, doFlip) {

    const dirs = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
    let flippedAny = false;
    for (let [dr, dc] of dirs) {
        let r = row + dr, c = col + dc;
        let cellsToFlip = [];
        while (r >= 0 && r < 8 && c >= 0 && c < 8 && board[r][c] === -color) {
            cellsToFlip.push({r, c});
            r += dr; c += dc;
        }
        if (r >= 0 && r < 8 && c >= 0 && c < 8 && board[r][c] === color && cellsToFlip.length > 0) {
            flippedAny = true;
            if (doFlip) {
                cellsToFlip.forEach(cell => board[cell.r][cell.c] = color);
            }
        }
    }
    return flippedAny;
}

function isGameOver() {
    // Game over if neither player nor CPU can make a move
    return !canPlayerMove(1) && !canPlayerMove(-1);
}

function endGame() {
    let black = 0, white = 0;
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            if (board[r][c] === 1) black++;
            if (board[r][c] === -1) white++;
        }
    }
    let resText = `Game Over! Black:${black} vs White:${white} - `;
    if (black > white) resText += "You Win!";
    else if (white > black) resText += "CPU Wins!";
    else resText += "Draw!";
    
    statusElement.textContent = resText;
    sendMatchComplete();
}

async function sendMatchComplete() {
    if (!currentUsername) return;
    try {
        const originalResultText = statusElement.textContent;
        statusElement.textContent = originalResultText + " (Saving match data...)";
        
        //const response = await fetch(`${RENDER_API_URL}/api/match-complete`, {
        //const response = await fetch(`https://onrender.com`, {
        const response = await fetch(`https://othero-server.onrender.com/api/match-complete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            //body: JSON.stringify({ username: currentUsername })
            body: JSON.stringify({ username: currentUsername })
        });
        const result = await response.json();
        console.log("Save match result:", result);
        
        // Dynamic UI improvement: show confirmation and clean up after 2 seconds
        statusElement.textContent = originalResultText + " 【Saved!】";
        setTimeout(() => {
            statusElement.textContent = originalResultText;
        }, 2000);

        fetchLeaderboard();
    } catch (error) {
        console.error("Failed to send match complete:", error);
        statusElement.textContent = "Failed to save match data.";
    }
}

async function fetchLeaderboard() {
    try {
        //const response = await fetch(`${RENDER_API_URL}/api/leaderboard`);
        //const response = await fetch(`https://onrender.com`);
        const response = await fetch(`https://othero-server.onrender.com/api/leaderboard`);
        
        const data = await response.json();
        const tbody = document.getElementById('leaderboard-body');
        tbody.innerHTML = "";

        if (data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="3" style="text-align:center;">No data available</td></tr>`;
            return;
        }

        data.forEach((row, index) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${index + 1}</td>
                <td>${escapeHtml(row.username)}</td>
                <td>${row.match_count}</td>
            `;
            tbody.appendChild(tr);
        });
    } catch (error) {
        console.error("Leaderboard fetch error:", error);
        document.getElementById('leaderboard-body').innerHTML = `<tr><td colspan="3" style="text-align:center; color:red;">Failed to load leaderboard</td></tr>`;
    }
}

function resetGame() {
    initGame();
}

function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
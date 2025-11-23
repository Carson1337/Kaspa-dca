const START_DATE = '2025-09-01';
let HOLDINGS_KAS = 21.20; 
const KAS_GOAL = 100000;
const KASPA_WALLET_ADDRESS = 'kaspa:qypqn40xz56apfhc3rf26u8gg0r36n2jzjs0gezyz9ujsnxxc9au8sgd78njpg7';

// --- 設定：只顯示這個日期之後的紀錄 (2025-11-01) ---
const SHOW_HISTORY_FROM = new Date('2025-11-24T00:00:00').getTime();

function getTaipeiDate() {
  const now = new Date();
  const utc8 = new Date(now.getTime() + (8 * 60 * 60 * 1000));
  return new Date(utc8.getUTCFullYear(), utc8.getUTCMonth(), utc8.getUTCDate());
}

function getDaysSince(startDateStr) {
  const start = new Date(startDateStr + "T00:00:00+08:00");
  const today = getTaipeiDate();
  const diff = today - start;
  return Math.floor(diff / (1000 * 60 * 60 * 24)) + 1;
}

// 格式化時間 (月/日 時:分)
function formatTime(timestamp) {
  const date = new Date(timestamp);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${month}/${day} ${hours}:${minutes}`;
}

// 查詢餘額
async function fetchKaspaBalance() {
  try {
    console.log('Fetching Kaspa balance...');
    const apiUrl = `https://api.kaspa.org/addresses/${KASPA_WALLET_ADDRESS}/balance`;
    
    const response = await fetch(apiUrl);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    
    const data = await response.json();
    const balanceInKas = data.balance / 100000000;
    
    console.log('Balance updated:', balanceInKas);
    HOLDINGS_KAS = balanceInKas;
    return balanceInKas;
    
  } catch (error) {
    console.error('Error fetching balance:', error);
    return HOLDINGS_KAS; 
  }
}

// 查詢並顯示歷史紀錄 (包含存入和提走)
async function fetchKaspaHistory() {
  const listElement = document.getElementById('historyList');
  if (!listElement) return;

  try {
    console.log('Fetching history...');
    // 使用 limit=50 確保抓取足夠的交易紀錄
    const apiUrl = `https://api.kaspa.org/addresses/${KASPA_WALLET_ADDRESS}/full-transactions?limit=50`;
    const response = await fetch(apiUrl);
    
    if (!response.ok) throw new Error('API Error');
    const data = await response.json();

    const transactions = []; 

    for (const tx of data) {
      // 1. 時間過濾
      if (tx.block_time < SHOW_HISTORY_FROM) {
        continue;
      }

      let inputAmount = 0; // 從錢包地址付出的 Sompi
      let outputAmount = 0; // 存入錢包地址的 Sompi

      // 計算這筆交易中，我付出的金額
      if (tx.inputs) {
        for (const input of tx.inputs) {
          if (input.previous_outpoint_address === KASPA_WALLET_ADDRESS) {
            inputAmount += input.previous_outpoint_amount;
          }
        }
      }

      // 計算這筆交易中，我收到的金額
      if (tx.outputs) {
        for (const output of tx.outputs) {
          if (output.script_public_key_address === KASPA_WALLET_ADDRESS) {
            outputAmount += output.amount;
          }
        }
      }

      // 計算淨變化量 (收到 - 付出)。這包含了交易費的影響。
      const netChangeSompi = outputAmount - inputAmount;
      const netKas = netChangeSompi / 100000000;

      const absNetKas = Math.abs(netKas);

      // 2. 只紀錄淨變化量超過 0.01 KAS 的交易
      if (absNetKas > 0.01) {
         // netKas > 0: 收到 > 付出 (存入/挖礦收入)
         // netKas < 0: 收到 < 付出 (提走/發送)
         const type = (netKas > 0) ? 'deposit' : 'withdrawal';
         
         // 如果是提走，我們取付出的總額 (inputAmount) 來顯示提走多少，
         // 但因為 Kaspa 的交易複雜性，用 netKas 的絕對值來呈現淨支出是最準確且容易理解的。
         transactions.push({
           time: tx.block_time,
           amount: absNetKas, 
           type: type
         });
      }
    }

    if (transactions.length === 0) {
      listElement.innerHTML = '<div class="history-loading">11月後尚無交易紀錄</div>';
      return;
    }

    // 3. 生成 HTML
    let historyHtml = '';
    transactions.forEach(record => {
      const sign = record.type === 'deposit' ? '+' : '-';
      const cssClass = record.type === 'deposit' ? 'history-amount' : 'history-withdrawal'; 
      
      historyHtml += `
        <div class="history-item">
          <span class="history-date">${formatTime(record.time)}</span>
          <span class="${cssClass}">${sign} ${record.amount.toFixed(2)} KAS</span>
        </div>
      `;
    });

    listElement.innerHTML = historyHtml;

  } catch (error) {
    console.error('Error fetching history:', error);
    listElement.innerHTML = '<div class="history-loading">讀取失敗</div>';
  }
}

function updatePage() {
  document.getElementById('dayText').textContent = "DAY " + getDaysSince(START_DATE);

  let progress = HOLDINGS_KAS / KAS_GOAL * 100;
  if (progress > 100) progress = 100;
  
  document.getElementById('progressPercent').textContent = progress.toFixed(4) + "%";
  document.getElementById('progressBar').style.width = progress + "%";

  document.getElementById('KASTotal').textContent = HOLDINGS_KAS.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 8
  });
}

async function init() {
  // 由於你的 index.html 缺少歷史紀錄容器，這裡先確認是否已載入新版 HTML/CSS
  if (!document.getElementById('historyList')) {
     console.warn("historyList element not found. Please ensure you are using the latest index.html file.");
  }
  
  await fetchKaspaBalance();
  updatePage();
  fetchKaspaHistory(); // 載入交易紀錄
}

init();

// 每 10 分鐘更新餘額和紀錄
setInterval(async () => {
  await fetchKaspaBalance();
  fetchKaspaHistory();
  updatePage();
}, 10 * 60 * 1000);

// 每小時更新天數
setInterval(() => {
  document.getElementById('dayText').textContent = "DAY " + getDaysSince(START_DATE);
}, 60 * 60 * 1000);
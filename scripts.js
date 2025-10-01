
const START_DATE = '2025-09-01';
let HOLDINGS_KAS = 21.20; // This will be updated from API
const KAS_GOAL = 100000;

// Extract wallet address from the HTML link
const KASPA_WALLET_ADDRESS = 'kaspa:qypedjygj5gv0d7rt6rh8svlevgpnf9x90z44nmcuwxx06asgpv4qeg60qntqv5';

function getTaipeiDate() {
  // 確保現在是台北時區的今天
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

async function fetchKaspaBalance() {
  try {
    console.log('Fetching Kaspa balance...');
    
    // Use the full kaspa: address as required by the API
    const apiUrl = `https://api.kaspa.org/addresses/${KASPA_WALLET_ADDRESS}/balance`;
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Convert from sompi to KAS (1 KAS = 100,000,000 sompi)
    const balanceInKas = data.balance / 100000000;
    
    console.log('Balance updated:', balanceInKas, 'KAS');
    HOLDINGS_KAS = balanceInKas;
    
    return balanceInKas;
    
  } catch (error) {
    console.error('Error fetching balance:', error);
    
    // Fallback: try alternative endpoints
    const fallbackApis = [
      // Try with different API patterns
      `https://explorer.kaspa.org/api/addresses/${KASPA_WALLET_ADDRESS}/balance`,
      `https://api.kaspa.org/info/balance?address=${KASPA_WALLET_ADDRESS}`,
      `https://api.kaspa.org/balance/${KASPA_WALLET_ADDRESS}`,
    ];
    
    for (let i = 0; i < fallbackApis.length; i++) {
      try {
        console.log(`Trying fallback API ${i + 1}: ${fallbackApis[i]}`);
        const fallbackResponse = await fetch(fallbackApis[i]);
        if (fallbackResponse.ok) {
          const fallbackData = await fallbackResponse.json();
          console.log('Fallback response:', fallbackData);
          
          // Try different response formats
          let balanceInSompi = fallbackData.balance || fallbackData.confirmed_balance || fallbackData.total_balance;
          
          if (balanceInSompi !== undefined) {
            const balanceInKas = balanceInSompi / 100000000;
            console.log(`Balance updated via fallback ${i + 1}:`, balanceInKas, 'KAS');
            HOLDINGS_KAS = balanceInKas;
            return balanceInKas;
          }
        }
      } catch (fallbackError) {
        console.error(`Fallback API ${i + 1} failed:`, fallbackError);
      }
    }
    
    // If all APIs fail, keep the current balance and show a warning
    console.warn('All API attempts failed, using cached balance:', HOLDINGS_KAS, 'KAS');
    console.warn('Consider manually updating the balance or checking API endpoints');
    return HOLDINGS_KAS;
  }
}

function updatePage() {
  document.getElementById('dayText').textContent = "DAY " + getDaysSince(START_DATE);

  let progress = HOLDINGS_KAS / KAS_GOAL * 100;
  if (progress > 100) progress = 100;
  progress = progress.toFixed(6);
  document.getElementById('progressPercent').textContent = progress + "%";
  document.getElementById('progressBar').style.width = progress + "%";

  document.getElementById('KASTotal').textContent = HOLDINGS_KAS.toFixed(8);
}

async function updateBalanceAndPage() {
  await fetchKaspaBalance();
  updatePage();
}

// Initial update
updateBalanceAndPage();

// Update every 30 minutes (30 * 60 * 1000 milliseconds)
setInterval(updateBalanceAndPage, 30 * 60 * 1000);

// Also update the display every hour for day counter
setInterval(updatePage, 1000 * 60 * 60);
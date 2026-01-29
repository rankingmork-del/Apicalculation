// BLAZIX S4 Live API Service
// This file serves live JSON data
const API_URL = "https://draw.ar-lottery01.com/WinGo/WinGo_1M/GetHistoryIssuePage.json";

// Handle API requests
addEventListener('fetch', event => {
    event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
    const url = new URL(request.url);
    const endpoint = url.searchParams.get('endpoint');
    const numbers = url.searchParams.get('numbers');
    
    // Set CORS headers
    const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
    };
    
    try {
        let data;
        
        switch(endpoint) {
            case 'current':
                data = await getCurrentPrediction();
                break;
            case 'all':
                data = await getAllData();
                break;
            case 'previous':
                data = await getPreviousResults();
                break;
            case 'calculate':
                if (numbers) {
                    const numArray = numbers.split(',').map(n => parseInt(n.trim()));
                    data = calculateCustom(numArray);
                } else {
                    throw new Error('Numbers parameter required');
                }
                break;
            default:
                data = {
                    error: 'Invalid endpoint',
                    available_endpoints: ['current', 'all', 'previous', 'calculate'],
                    usage: 'Add ?endpoint=current to URL'
                };
        }
        
        return new Response(JSON.stringify(data, null, 2), {
            status: 200,
            headers: headers
        });
        
    } catch (error) {
        return new Response(JSON.stringify({
            error: error.message,
            timestamp: new Date().toISOString()
        }, null, 2), {
            status: 500,
            headers: headers
        });
    }
}

// Fetch live lottery data
async function fetchLiveLotteryData() {
    try {
        console.log('Fetching live data from:', API_URL);
        const response = await fetch(API_URL + '?t=' + Date.now());
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (!data.data || !data.data.list) {
            throw new Error('Invalid data format from API');
        }
        
        return data.data.list;
        
    } catch (error) {
        console.error('Error fetching live data:', error);
        throw new Error(`Failed to fetch live data: ${error.message}`);
    }
}

// Get current prediction
async function getCurrentPrediction() {
    const liveData = await fetchLiveLotteryData();
    const numbers = liveData.map(x => parseInt(x.number));
    
    // Apply your custom logic
    const prediction = calculatePrediction(numbers);
    
    return {
        period: liveData[0].issueNumber,
        next_period: (parseInt(liveData[0].issueNumber) + 1).toString(),
        prediction: prediction.prediction,
        derived_number: prediction.derivedNumber,
        confidence: prediction.confidence,
        status: "live",
        timestamp: new Date().toISOString(),
        calculation: prediction.calculation,
        data_source: "Live lottery API",
        last_10_numbers: numbers.slice(0, 10)
    };
}

// Get all data
async function getAllData() {
    const liveData = await fetchLiveLotteryData();
    const numbers = liveData.map(x => parseInt(x.number));
    const prediction = calculatePrediction(numbers);
    
    return {
        current_prediction: {
            period: liveData[0].issueNumber,
            next_period: (parseInt(liveData[0].issueNumber) + 1).toString(),
            prediction: prediction.prediction,
            derived_number: prediction.derivedNumber,
            confidence: prediction.confidence,
            timestamp: new Date().toISOString()
        },
        previous_results: liveData.slice(0, 8).map(item => ({
            period: item.issueNumber,
            number: item.number,
            result: parseInt(item.number) >= 5 ? "BIG" : "SMALL",
            draw_time: item.drawTime || item.createdAt
        })),
        statistics: {
            total_results_fetched: liveData.length,
            last_updated: new Date().toISOString(),
            data_source: API_URL
        },
        calculation_info: {
            formula: "(first + fifth) - last = result",
            example: "numbers[5,8,4,5,4,6,4,8,5,2] → 5+4=9 → 9-2=7 → BIG",
            logic: "BIG if result ≥5, SMALL if <5"
        }
    };
}

// Get previous results
async function getPreviousResults() {
    const liveData = await fetchLiveLotteryData();
    
    return {
        results: liveData.slice(0, 20).map(item => ({
            period: item.issueNumber,
            number: item.number,
            result: parseInt(item.number) >= 5 ? "BIG" : "SMALL",
            draw_time: item.drawTime || item.createdAt,
            is_big: parseInt(item.number) >= 5
        })),
        count: liveData.length,
        last_updated: new Date().toISOString(),
        summary: {
            big_count: liveData.filter(item => parseInt(item.number) >= 5).length,
            small_count: liveData.filter(item => parseInt(item.number) < 5).length,
            big_percentage: ((liveData.filter(item => parseInt(item.number) >= 5).length / liveData.length) * 100).toFixed(1) + '%'
        }
    };
}

// Your custom calculation logic
function calculatePrediction(numbers) {
    if (numbers.length < 10) {
        return {
            prediction: "BIG",
            derivedNumber: 7,
            confidence: 70,
            calculation: { error: "Need at least 10 numbers" }
        };
    }
    
    const last10 = numbers.slice(0, 10);
    const first = last10[0];
    const fifth = last10[4];
    let sum = first + fifth;
    
    // Reduce 2-digit numbers
    if (sum >= 10) {
        sum = Math.floor(sum / 10) + (sum % 10);
    }
    
    const last = last10[9];
    let result = sum - last;
    
    // Make positive if negative
    if (result < 0) {
        result = -result;
    }
    
    // Reduce again if 2 digits
    if (result >= 10) {
        result = Math.floor(result / 10) + (result % 10);
    }
    
    const prediction = result >= 5 ? "BIG" : "SMALL";
    let confidence = 70;
    
    // Adjust confidence
    if (result === 0 || result === 9) {
        confidence = 85;
    } else if (result <= 2 || result >= 7) {
        confidence = 75;
    }
    
    return {
        prediction,
        derivedNumber: result,
        confidence: Math.min(95, Math.max(55, confidence)),
        calculation: {
            first_number: first,
            fifth_number: fifth,
            sum_before_reduction: first + fifth,
            sum_after_reduction: sum,
            last_number: last,
            subtraction: sum - last,
            final_result: result,
            formula_used: `(${first} + ${fifth}) - ${last} = ${result}`
        }
    };
}

// Calculate with custom numbers
function calculateCustom(numbers) {
    if (!numbers || numbers.length < 10) {
        throw new Error('Please provide at least 10 numbers separated by commas');
    }
    
    const prediction = calculatePrediction(numbers);
    
    return {
        input: {
            numbers: numbers.slice(0, 10),
            count: numbers.length
        },
        calculation: prediction.calculation,
        result: {
            prediction: prediction.prediction,
            derived_number: prediction.derivedNumber,
            confidence: prediction.confidence,
            interpretation: prediction.derivedNumber >= 5 ? 
                `BIG (${prediction.derivedNumber} ≥ 5)` : 
                `SMALL (${prediction.derivedNumber} < 5)`
        },
        timestamp: new Date().toISOString()
    };
}

// Export functions for direct use
if (typeof window !== 'undefined') {
    window.BlazixAPI = {
        getCurrentPrediction,
        getAllData,
        getPreviousResults,
        calculateCustom,
        calculatePrediction
    };
    
    console.log('BLAZIX S4 Live API Service loaded');
}

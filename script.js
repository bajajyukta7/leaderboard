// Configuration
const HOST_PASSWORD = 'admin123';
const NUM_SAMPLES = 30;

// Firebase REST API Config
const FIREBASE_DB_URL = 'https://eval-hands-on-leaderboard-default-rtdb.firebaseio.com';
const LEADERBOARD_PATH = '/leaderboard.json';

// State
let leaderboardData = [];
let isHost = false;
let sortColumn = 'regular_kappa';
let sortAscending = true;  // true = descending (highest scores first)
let currentParticipant = null;

// Load data from Firebase REST API
async function loadFromFirebase() {
    try {
        const response = await fetch(FIREBASE_DB_URL + LEADERBOARD_PATH);
        if (!response.ok) throw new Error('Failed to fetch data');
        
        const data = await response.json();
        leaderboardData = [];
        
        if (data) {
            Object.values(data).forEach(entry => {
                leaderboardData.push(entry);
            });
        }
        
        console.log('Loaded from Firebase:', leaderboardData.length, 'entries');
        sortAndRender();
    } catch (error) {
        console.error('Error loading from Firebase:', error);
    }
}

// Save entry to Firebase REST API
async function saveToFirebase(entry) {
    try {
        const response = await fetch(FIREBASE_DB_URL + LEADERBOARD_PATH, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ [entry.id]: entry })
        });
        
        if (!response.ok) {
            const error = await response.text();
            throw new Error(error);
        }
        
        console.log('Entry saved to Firebase');
        return true;
    } catch (error) {
        console.error('Error saving to Firebase:', error);
        throw error;
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    const savedParticipant = localStorage.getItem('currentParticipant');
    if (savedParticipant) {
        currentParticipant = savedParticipant;
        document.getElementById('participantMessage').textContent = `Welcome back, ${savedParticipant}!`;
        document.getElementById('participantMessage').className = 'message success';
    }
    
    // Load initial data
    loadFromFirebase();
    
    // Refresh data every 2 seconds
    setInterval(loadFromFirebase, 2000);
    
    setupEventListeners();
});

// Event Listeners
function setupEventListeners() {
    // Host button
    document.getElementById('hostBtn').addEventListener('click', openHostModal);
    
    // Modal
    document.querySelector('.close').addEventListener('click', closeHostModal);
    window.addEventListener('click', (e) => {
        const modal = document.getElementById('hostModal');
        if (e.target === modal) closeHostModal();
    });
    
    // Login
    document.getElementById('loginBtn').addEventListener('click', handleLogin);
    document.getElementById('hostPassword').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleLogin();
    });
    
    // Participant registration
    document.getElementById('submitScoreBtn').addEventListener('click', handleParticipantSubmission);
    document.getElementById('participantNameInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleParticipantSubmission();
    });
    
    // Host panel
    document.getElementById('addEntryBtn').addEventListener('click', handleAddEntry);
    document.getElementById('downloadCsvBtn').addEventListener('click', downloadCSV);
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);
    
    // Sortable headers
    document.querySelectorAll('th.sortable').forEach(th => {
        th.addEventListener('click', handleSort);
    });
}

// Host Login
function openHostModal() {
    document.getElementById('hostModal').classList.add('active');
    document.getElementById('hostPassword').focus();
}

function closeHostModal() {
    document.getElementById('hostModal').classList.remove('active');
    document.getElementById('hostPassword').value = '';
    document.getElementById('modalMessage').textContent = '';
}

function handleLogin() {
    const password = document.getElementById('hostPassword').value;
    if (password === HOST_PASSWORD) {
        isHost = true;
        closeHostModal();
        showHostPanel();
    } else {
        document.getElementById('modalMessage').textContent = 'Invalid password';
    }
}

function handleLogout() {
    isHost = false;
    document.getElementById('hostPanel').classList.add('hidden');
    document.getElementById('promptHeader').classList.add('hidden');
    renderTable();
}

// Participant Submission
function handleParticipantSubmission() {
    console.log('Submit button clicked');
    
    const name = document.getElementById('participantNameInput').value.trim();
    const regularKappa = parseFloat(document.getElementById('participantRegularKappaInput').value);
    const weightedKappa = parseFloat(document.getElementById('participantWeightedKappaInput').value);
    const prompt = document.getElementById('participantPromptInput').value.trim();
    
    console.log('Form values:', { name, regularKappa, weightedKappa, prompt });
    
    // Validation
    if (!name) {
        showMessage('participantMessage', 'Please enter your name', 'error');
        return;
    }
    
    if (isNaN(regularKappa) || regularKappa < 0 || regularKappa > 1) {
        showMessage('participantMessage', 'Regular Kappa must be between 0 and 1', 'error');
        return;
    }
    
    if (isNaN(weightedKappa) || weightedKappa < 0 || weightedKappa > 1) {
        showMessage('participantMessage', 'Weighted Kappa must be between 0 and 1', 'error');
        return;
    }
    
    // Check if name already exists
    if (leaderboardData.some(entry => entry.name.toLowerCase() === name.toLowerCase())) {
        showMessage('participantMessage', 'This name is already registered', 'error');
        return;
    }
    
    // Create entry
    const entry = {
        id: Date.now(),
        name,
        regular_kappa: regularKappa,
        weighted_kappa: weightedKappa,
        prompt: prompt || '-',
        num_samples: NUM_SAMPLES,
        timestamp: new Date().toISOString()
    };
    
    console.log('Submitting entry:', entry);
    
    // Save to Firebase
    saveToFirebase(entry)
        .then(() => {
            console.log('Entry saved successfully');
            // Clear form and show success
            document.getElementById('participantNameInput').value = '';
            document.getElementById('participantRegularKappaInput').value = '';
            document.getElementById('participantWeightedKappaInput').value = '';
            document.getElementById('participantPromptInput').value = '';
            showMessage('participantMessage', 'Score submitted successfully!', 'success');
            
            // Reload data
            setTimeout(loadFromFirebase, 500);
        })
        .catch((error) => {
            console.error('Error:', error);
            showMessage('participantMessage', 'Error submitting score: ' + error.message, 'error');
        });
}

function showMessage(elementId, message, type) {
    const element = document.getElementById(elementId);
    element.textContent = message;
    element.className = `message ${type}`;
    if (type === 'success') {
        setTimeout(() => {
            element.textContent = '';
            element.className = 'message';
        }, 3000);
    }
}

// Host Panel
function showHostPanel() {
    document.getElementById('hostPanel').classList.remove('hidden');
    document.getElementById('promptHeader').classList.remove('hidden');
    renderTable();
}

// Add Entry
function handleAddEntry() {
    const name = document.getElementById('nameInput').value.trim();
    const regularKappa = parseFloat(document.getElementById('regularKappaInput').value);
    const weightedKappa = parseFloat(document.getElementById('weightedKappaInput').value);
    const prompt = document.getElementById('promptInput').value.trim();

    if (!name || isNaN(regularKappa) || isNaN(weightedKappa)) {
        alert('Please fill in all fields with valid values');
        return;
    }

    const entry = {
        id: Date.now(),
        name,
        regular_kappa: regularKappa,
        weighted_kappa: weightedKappa,
        prompt,
        num_samples: NUM_SAMPLES,
        timestamp: new Date().toISOString()
    };

    // Save to Firebase
    saveToFirebase(entry)
        .then(() => {
            // Clear form
            document.getElementById('nameInput').value = '';
            document.getElementById('regularKappaInput').value = '';
            document.getElementById('weightedKappaInput').value = '';
            document.getElementById('promptInput').value = '';
            alert('Entry added successfully');
            
            // Reload data
            setTimeout(loadFromFirebase, 500);
        })
        .catch((error) => {
            alert('Error adding entry: ' + error.message);
        });
}

// CSV Export
function downloadCSV() {
    if (leaderboardData.length === 0) {
        alert('No data to export');
        return;
    }
    
    // Create CSV header
    const headers = ['Name', 'Regular Kappa Score (Dataset B, num_samples=30)', 'Weighted Kappa Score (Dataset A, num_samples=30)', 'Prompt', 'Timestamp'];
    
    // Sort by regular_kappa descending
    const sorted = [...leaderboardData].sort((a, b) => b.regular_kappa - a.regular_kappa);
    
    // Create CSV rows
    const rows = sorted.map(entry => [
        entry.name,
        entry.regular_kappa.toFixed(4),
        entry.weighted_kappa.toFixed(4),
        `"${(entry.prompt || '-').replace(/"/g, '""')}"`,  // Escape quotes
        entry.timestamp
    ]);
    
    // Combine header and rows
    const csvContent = [
        headers.join(','),
        ...rows.map(row => row.join(','))
    ].join('\n');
    
    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `leaderboard_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
}

// Sorting
function handleSort(e) {
    const column = e.target.dataset.column;
    if (sortColumn === column) {
        sortAscending = !sortAscending;
    } else {
        sortColumn = column;
        sortAscending = column === 'regular_kappa' ? true : false;  // Default descending for regular_kappa
    }
    sortAndRender();
}

function sortAndRender() {
    const sorted = [...leaderboardData].sort((a, b) => {
        let aVal = a[sortColumn];
        let bVal = b[sortColumn];

        if (typeof aVal === 'string') {
            aVal = aVal.toLowerCase();
            bVal = bVal.toLowerCase();
        }

        // For numeric columns, reverse the logic since sortAscending=true means descending (highest first)
        if (typeof aVal === 'number') {
            if (aVal < bVal) return sortAscending ? -1 : 1;
            if (aVal > bVal) return sortAscending ? 1 : -1;
        } else {
            if (aVal < bVal) return sortAscending ? 1 : -1;
            if (aVal > bVal) return sortAscending ? -1 : 1;
        }
        return 0;
    });

    renderTable(sorted);
}

// Rendering
function renderTable(data = null) {
    const tbody = document.getElementById('leaderboardBody');
    tbody.innerHTML = '';

    if (data === null) {
        data = [...leaderboardData].sort((a, b) => b.regular_kappa - a.regular_kappa);
    }

    data.forEach((entry, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${entry.name}</td>
            <td>${entry.regular_kappa.toFixed(4)}</td>
            <td>${entry.weighted_kappa.toFixed(4)}</td>
            ${isHost ? `<td>${entry.prompt || '-'}</td>` : ''}
        `;
        tbody.appendChild(row);
    });

    if (data.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = '<td colspan="3" style="text-align: center; color: #999;">No entries yet</td>';
        tbody.appendChild(row);
    }
}

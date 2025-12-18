// Configuration
const HOST_PASSWORD = 'admin123';
const NUM_SAMPLES = 30;

// Firebase Config
const firebaseConfig = {
    apiKey: "AIzaSyDfRJmL0pVLZCJrOu8dVBxFXHWGH8G6t0o",
    authDomain: "eval-hands-on-leaderboard.firebaseapp.com",
    databaseURL: "https://eval-hands-on-leaderboard-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "eval-hands-on-leaderboard",
    storageBucket: "eval-hands-on-leaderboard.appspot.com",
    messagingSenderId: "913033373883",
    appId: "1:913033373883:web:5d8e4f8c9b2a1e7d6f9c8b"
};

// Initialize Firebase
let db, ref;

console.log('script.js loaded, checking for firebase...');

// Wait for Firebase to be available
function initFirebase() {
    console.log('Attempting Firebase init, firebase available:', typeof firebase !== 'undefined');
    
    if (typeof firebase === 'undefined') {
        setTimeout(initFirebase, 100);
        return;
    }
    
    try {
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
            console.log('Firebase app initialized');
        }
        db = firebase.database();
        ref = db.ref('leaderboard');
        firebaseReady = true;
        console.log('Firebase database connected');
    } catch (error) {
        console.error('Firebase initialization error:', error);
        setTimeout(initFirebase, 100);
    }
}

let firebaseReady = false;
initFirebase();

// State
let leaderboardData = [];
let isHost = false;
let sortColumn = 'regular_kappa';
let sortAscending = false;
let currentParticipant = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    const savedParticipant = localStorage.getItem('currentParticipant');
    if (savedParticipant) {
        currentParticipant = savedParticipant;
        document.getElementById('participantMessage').textContent = `Welcome back, ${savedParticipant}!`;
        document.getElementById('participantMessage').className = 'message success';
    }
    
    // Wait for Firebase to initialize
    const checkFirebase = setInterval(() => {
        if (ref) {
            clearInterval(checkFirebase);
            // Load from Firebase
            ref.on('value', (snapshot) => {
                leaderboardData = [];
                snapshot.forEach((childSnapshot) => {
                    leaderboardData.push(childSnapshot.val());
                });
                sortAndRender();
            });
        }
    }, 100);
    
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
    console.log('Submit button clicked, Firebase ready:', firebaseReady);
    
    if (!firebaseReady || !ref) {
        console.log('Retrying Firebase initialization...');
        initFirebase();
        if (!firebaseReady) {
            showMessage('participantMessage', 'Connecting to database... please try again in a moment', 'error');
            return;
        }
    }
    
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
    ref.child(entry.id).set(entry)
        .then(() => {
            console.log('Entry saved successfully');
            // Clear form and show success
            document.getElementById('participantNameInput').value = '';
            document.getElementById('participantRegularKappaInput').value = '';
            document.getElementById('participantWeightedKappaInput').value = '';
            document.getElementById('participantPromptInput').value = '';
            showMessage('participantMessage', 'Score submitted successfully!', 'success');
        })
        .catch((error) => {
            console.error('Firebase error:', error);
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
    ref.child(entry.id).set(entry)
        .then(() => {
            // Clear form
            document.getElementById('nameInput').value = '';
            document.getElementById('regularKappaInput').value = '';
            document.getElementById('weightedKappaInput').value = '';
            document.getElementById('promptInput').value = '';
            alert('Entry added successfully');
        })
        .catch((error) => {
            alert('Error adding entry: ' + error.message);
        });
}

// Sorting
function handleSort(e) {
    const column = e.target.dataset.column;
    if (sortColumn === column) {
        sortAscending = !sortAscending;
    } else {
        sortColumn = column;
        sortAscending = false;
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

        if (aVal < bVal) return sortAscending ? 1 : -1;
        if (aVal > bVal) return sortAscending ? -1 : 1;
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

// Local Storage
function saveToLocalStorage() {
    localStorage.setItem('leaderboardData', JSON.stringify(leaderboardData));
}

function loadFromLocalStorage() {
    const data = localStorage.getItem('leaderboardData');
    if (data) {
        leaderboardData = JSON.parse(data);
    } else {
        // Sample data
        leaderboardData = [
            {
                id: 1,
                name: 'Alice Johnson',
                regular_kappa: 0.8542,
                weighted_kappa: 0.8321,
                prompt: 'Temperature 0.7, top_p 0.9',
                num_samples: NUM_SAMPLES,
                timestamp: new Date().toISOString()
            },
            {
                id: 2,
                name: 'Bob Smith',
                regular_kappa: 0.7893,
                weighted_kappa: 0.7654,
                prompt: 'Temperature 0.5, top_p 0.95',
                num_samples: NUM_SAMPLES,
                timestamp: new Date().toISOString()
            },
            {
                id: 3,
                name: 'Carol Davis',
                regular_kappa: 0.8234,
                weighted_kappa: 0.8123,
                prompt: 'Temperature 0.8, top_p 0.85',
                num_samples: NUM_SAMPLES,
                timestamp: new Date().toISOString()
            }
        ];
        saveToLocalStorage();
    }
}

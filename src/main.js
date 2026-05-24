import './style.css'

const texts = [
  {
    id: 1,
    title: "The Invention of Railway Time",
    content: "Before the invention of the railway, local time was a highly fluid concept, dictated entirely by the position of the sun in a specific town. Every city operated on its own distinct time zone; when it was exactly noon in London, it might have been 12:04 in Bristol and 11:50 in Cambridge. However, as train travel became more accessible in the 19th century, this patchwork of local times created logistical nightmares and dangerous scheduling conflicts for railway companies. To solve this, British railways instituted \"Railway Time\" in 1840, forcing all stations to synchronize their clocs to Greenwich Mean Time.",
    words: [
      { text: "fluid", inText: true },
      { text: "Locomotive", inText: false },
      { text: "engine", inText: false },
      { text: "railway", inText: true },
      { text: "sun", inText: true },
      { text: "passenger", inText: false },
      { text: "accessible", inText: true },
      { text: "ticket", inText: false }
    ]
  },
  {
    id: 2,
    title: "The Introduction of Adhesive Stamps",
    content: "Prior to the introduction of adhesive stamps, sending a letter was an expensive luxury, usually paid for by the recipient upon delivery. Each local post office calculated fees based on the distance traveled and the number of sheets used; a single missive sent from Edinburgh to London could cost a worker's daily wage. However, as commerce expanded during the Victorian era, this confusing system caused widespread delivery delays and massive revenue losses for the government. To remedy this, Britain launched the \"Penny Black\" in 1840, requiring senders to purchase a standardized stamp for uniform nationwide postage.",
    words: [
      { text: "adhesive", inText: true },
      { text: "envelope", inText: false },
      { text: "parcel", inText: false },
      { text: "luxury", inText: true },
      { text: "wage", inText: true },
      { text: "postman", inText: false },
      { text: "uniform", inText: true },
      { text: "mail", inText: false }
    ]
  }
];

// Set your Google Apps Script Web App URL here to automate data collection
const GOOGLE_SHEET_URL = 'https://script.google.com/macros/s/AKfycbxaUFk5URNWzHl9RsqxHwb8KE1RatcWER_4WNEVjLdVWfq-8CIkMo9ToWQ11R8VI7HzqQ/exec'; 

let state = {
  participantId: '',
  tasks: [],
  currentStep: 'intro', // intro, instructions, reading, test, finish
  currentTaskIndex: 0,
  results: [],
  selectedWords: new Set(),
  startTime: 0,
  timerInterval: null,
  timeLeft: 30,
  uploadStatus: 'idle' // idle, uploading, success, error
};

function render() {
  const app = document.querySelector('#app');
  app.innerHTML = '';

  const container = document.createElement('div');
  container.className = 'experiment-container';

  if (state.currentStep === 'intro') {
    container.innerHTML = `
      <h1>AB Experiment – Project 2</h1>
      <p>Click the button below to start the experiment.</p>
      <button id="start-btn">Start Experiment</button>
    `;
    app.appendChild(container);
    document.querySelector('#start-btn').onclick = startExperiment;
  } else if (state.currentStep === 'instructions') {
    const isSecond = state.currentTaskIndex === 1;
    container.innerHTML = `
      <h1>Instructions ${isSecond ? '(Task 2 of 2)' : '(Task 1 of 2)'}</h1>
      ${isSecond ? '<p><strong>This is the second text.</strong></p>' : ''}
      <p>You have 30 seconds to read the following text.</p>
      <p>After that the text would disappear and you would be given a list of words.</p>
      <p>The task is to tell which words appeared in the given text.</p>
      <button id="next-btn">I'm Ready</button>
    `;
    app.appendChild(container);
    document.querySelector('#next-btn').onclick = startReading;
  } else if (state.currentStep === 'reading') {
    const task = state.tasks[state.currentTaskIndex];
    container.innerHTML = `
      <div class="timer">Time left: ${state.timeLeft}s</div>
      <div class="text-display ${task.fontClass}">${task.text.content}</div>
    `;
    app.appendChild(container);
  } else if (state.currentStep === 'test') {
    const task = state.tasks[state.currentTaskIndex];
    container.innerHTML = `
      <h2>Did these words appear in the text?</h2>
      <p>Select the words you remember seeing.</p>
      <div class="word-grid ${task.fontClass}">
        ${task.shuffledWords.map(w => `
          <div class="word-option ${state.selectedWords.has(w.text) ? 'selected' : ''}" data-word="${w.text}">
            ${w.text}
          </div>
        `).join('')}
      </div>
      <button id="submit-test-btn">Submit</button>
    `;
    app.appendChild(container);
    document.querySelectorAll('.word-option').forEach(el => {
      el.onclick = () => {
        const word = el.dataset.word;
        if (state.selectedWords.has(word)) state.selectedWords.delete(word);
        else state.selectedWords.add(word);
        render();
      };
    });
    document.querySelector('#submit-test-btn').onclick = submitTest;
  } else if (state.currentStep === 'finish') {
    let statusMsg = '';
    if (state.uploadStatus === 'uploading') statusMsg = 'Saving results...';
    else if (state.uploadStatus === 'success') statusMsg = 'Results saved automatically.';
    else if (state.uploadStatus === 'error') statusMsg = 'Auto-save failed. Use the manual download below.';

    container.innerHTML = `
      <h1>Experiment Completed</h1>
      <p>Thank you for your participation!</p>
      <p style="color: #888; font-size: 0.9rem;">${statusMsg}</p>
      <br>
      <button id="download-btn">Manual Download (CSV)</button>
      <button id="restart-btn" style="margin-left: 1rem;">Restart</button>
    `;
    app.appendChild(container);
    document.querySelector('#download-btn').onclick = downloadResultsCSV;
    document.querySelector('#restart-btn').onclick = () => {
      resetState();
      render();
    };
  }
}

async function sendToGoogleSheet() {
  if (!GOOGLE_SHEET_URL) return;

  state.uploadStatus = 'uploading';
  render();

  try {
    for (const r of state.results) {
      const data = {
        ParticipantID: state.participantId,
        Timestamp: new Date().toISOString(),
        TextID: r.textId,
        Title: r.textTitle,
        Font: r.font,
        ReadTime_s: r.readTime,
        Score: r.score,
        TotalPossible: r.totalPossible,
        SelectedWords: r.selected
      };

      await fetch(GOOGLE_SHEET_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
    }
    state.uploadStatus = 'success';
  } catch (err) {
    console.error('Upload failed:', err);
    state.uploadStatus = 'error';
  }
  render();
}

function resetState() {
  state = {
    participantId: 'P' + Math.floor(Math.random() * 1000000),
    tasks: [],
    currentStep: 'intro',
    currentTaskIndex: 0,
    results: [],
    selectedWords: new Set(),
    startTime: 0,
    timerInterval: null,
    timeLeft: 30,
    uploadStatus: 'idle'
  };
}

function startExperiment() {
  const textOrder = Math.random() < 0.5 ? [0, 1] : [1, 0];
  const fontOrder = Math.random() < 0.5 ? ['Times New Roman', 'Aptos'] : ['Aptos', 'Times New Roman'];
  
  state.tasks = textOrder.map((textIdx, i) => {
    const text = texts[textIdx];
    const font = fontOrder[i];
    return {
      text,
      font,
      fontClass: font === 'Aptos' ? 'font-aptos' : 'font-times',
      shuffledWords: [...text.words].sort(() => Math.random() - 0.5)
    };
  });

  state.currentStep = 'instructions';
  render();
}

function startReading() {
  state.currentStep = 'reading';
  state.timeLeft = 30;
  state.startTime = Date.now();
  render();

  state.timerInterval = setInterval(() => {
    state.timeLeft--;
    if (state.timeLeft <= 0) {
      clearInterval(state.timerInterval);
      startTest();
    } else {
      const timerEl = document.querySelector('.timer');
      if (timerEl) timerEl.innerText = `Time left: ${state.timeLeft}s`;
    }
  }, 1000);
}

function startTest() {
  if (state.timerInterval) clearInterval(state.timerInterval);
  state.readTime = Math.round((Date.now() - state.startTime) / 1000);
  state.currentStep = 'test';
  state.selectedWords = new Set();
  render();
}

function submitTest() {
  const task = state.tasks[state.currentTaskIndex];
  const selected = Array.from(state.selectedWords);
  
  let score = 0;
  task.text.words.forEach(w => {
    const isSelected = state.selectedWords.has(w.text);
    if (isSelected === w.inText) {
      score++;
    }
  });

  state.results.push({
    textId: task.text.id,
    textTitle: task.text.title,
    font: task.font,
    readTime: state.readTime,
    score: score,
    totalPossible: task.text.words.length,
    selected: selected.join(';')
  });

  if (state.currentTaskIndex < state.tasks.length - 1) {
    state.currentTaskIndex++;
    state.currentStep = 'instructions';
    render();
  } else {
    state.currentStep = 'finish';
    render();
    sendToGoogleSheet();
  }
}

function downloadResultsCSV() {
  const headers = ['ParticipantID', 'Timestamp', 'TextID', 'Title', 'Font', 'ReadTime_s', 'Score', 'TotalPossible', 'SelectedWords'];
  const rows = state.results.map(r => [
    state.participantId,
    new Date().toISOString(),
    r.textId,
    `"${r.textTitle}"`,
    r.font,
    r.readTime,
    r.score,
    r.totalPossible,
    `"${r.selected}"`
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `results_${state.participantId}.csv`;
  a.click();
}

resetState();
render();

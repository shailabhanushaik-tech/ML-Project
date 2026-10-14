const csvUrl = 'kidney_disease_test.csv';

const resultBox = document.getElementById('predictionResult');
const reportDetails = document.getElementById('reportDetails');
const riskSignals = document.getElementById('riskSignals');
const riskForm = document.getElementById('riskForm');
const meterFill = document.getElementById('meterFill');
const meterLabel = document.getElementById('meterLabel');
const modelStatus = document.getElementById('modelStatus');
const modelStatusText = document.getElementById('modelStatusText');
const formSteps = Array.from(document.querySelectorAll('.form-step'));
const stepLabel = document.getElementById('stepLabel');
const progressPercent = document.getElementById('progressPercent');
const progressFill = document.getElementById('progressFill');
const formProgress = document.getElementById('formProgress');
const previousStepButton = document.getElementById('previousStep');
const nextStepButton = document.getElementById('nextStep');
const reviewProfileButton = document.getElementById('reviewProfile');
const ageInput = document.getElementById('age');
const bpInput = document.getElementById('bp');
const ageSlider = document.getElementById('ageSlider');
const bpSlider = document.getElementById('bpSlider');
let datasetRows = [];
let modelAvailable = false;
let currentStep = 0;
let quizIndex = 0;
let quizScore = 0;
let quizAnswered = false;
let quizWasCorrect = false;

const presetProfiles = {
  healthy: {
    age: 32,
    bp: 72,
    sg: 1.025,
    al: 0,
    su: 0,
    rbc: 'normal',
    pc: 'normal',
    pcc: 'notpresent',
    ba: 'notpresent',
    htn: 'no',
    dm: 'no',
    appet: 'good'
  },
  moderate: {
    age: 52,
    bp: 92,
    sg: 1.015,
    al: 1,
    su: 1,
    rbc: 'abnormal',
    pc: 'normal',
    pcc: 'notpresent',
    ba: 'notpresent',
    htn: 'no',
    dm: 'yes',
    appet: 'good'
  },
  high: {
    age: 68,
    bp: 104,
    sg: 1.01,
    al: 3,
    su: 2,
    rbc: 'abnormal',
    pc: 'abnormal',
    pcc: 'present',
    ba: 'present',
    htn: 'yes',
    dm: 'yes',
    appet: 'poor'
  },
  custom: {
    age: 45,
    bp: 85,
    sg: 1.02,
    al: 0,
    su: 0,
    rbc: 'normal',
    pc: 'normal',
    pcc: 'notpresent',
    ba: 'notpresent',
    htn: 'no',
    dm: 'no',
    appet: 'good'
  }
};

const stepNames = ['Personal & history', 'Urine test markers', 'Additional markers'];

const quizQuestions = [
  {
    question: 'Can one urine test marker by itself confirm chronic kidney disease?',
    options: ['Yes, any abnormal result confirms it', 'No, results need clinical context and often follow-up'],
    answer: 1,
    explanation: 'A clinician interprets test results in context and may arrange repeat or additional tests.'
  },
  {
    question: 'What does urine specific gravity broadly describe?',
    options: ['How concentrated the urine sample is', 'The amount of blood pressure in the sample'],
    answer: 0,
    explanation: 'Specific gravity is one measure related to urine concentration and can vary for several reasons.'
  },
  {
    question: 'What should you do with a concerning health result?',
    options: ['Use this page to make a diagnosis', 'Discuss it with a qualified healthcare professional'],
    answer: 1,
    explanation: 'This dashboard is educational only. A qualified professional can interpret results and advise you.'
  }
];

function setWizardStep(step) {
  currentStep = Math.max(0, Math.min(formSteps.length - 1, step));
  formSteps.forEach((section, index) => {
    const isActive = index === currentStep;
    section.hidden = !isActive;
    section.classList.toggle('active', isActive);
    section.querySelectorAll('[data-required]').forEach((input) => {
      input.required = isActive;
    });
  });

  const percent = Math.round(((currentStep + 1) / formSteps.length) * 100);
  stepLabel.textContent = `Step ${currentStep + 1} of ${formSteps.length} · ${stepNames[currentStep]}`;
  progressPercent.textContent = `${percent}%`;
  progressFill.style.width = `${percent}%`;
  formProgress.setAttribute('aria-valuenow', String(currentStep + 1));
  previousStepButton.disabled = currentStep === 0;
  nextStepButton.hidden = currentStep === formSteps.length - 1;
  reviewProfileButton.hidden = currentStep !== formSteps.length - 1;
}

function syncWhatIfControls() {
  ageSlider.value = ageInput.value || ageSlider.min;
  bpSlider.value = bpInput.value || bpSlider.min;
  document.getElementById('ageSliderValue').textContent = ageSlider.value;
  document.getElementById('bpSliderValue').textContent = `${bpSlider.value} mmHg`;
}

function getMarkerSignals(data) {
  const signals = [];
  if (data.age >= 55) signals.push({ text: 'Age above 55', type: 'warning' });
  if (data.bp >= 90) signals.push({ text: 'Blood pressure marker', type: 'warning' });
  if (data.sg <= 1.015) signals.push({ text: 'Specific gravity marker', type: 'warning' });
  if (data.al >= 2) signals.push({ text: 'Albumin marker', type: 'warning' });
  if (data.su > 0) signals.push({ text: 'Urine sugar marker', type: 'warning' });
  if (data.rbc === 'abnormal') signals.push({ text: 'Red blood cell marker', type: 'danger' });
  if (data.pc === 'abnormal') signals.push({ text: 'Pus cell marker', type: 'danger' });
  if (data.pcc === 'present') signals.push({ text: 'Pus cell clumps marker', type: 'danger' });
  if (data.ba === 'present') signals.push({ text: 'Bacteria marker', type: 'danger' });
  if (data.htn === 'yes') signals.push({ text: 'Hypertension history', type: 'warning' });
  if (data.dm === 'yes') signals.push({ text: 'Diabetes history', type: 'warning' });
  if (data.appet === 'poor') signals.push({ text: 'Appetite marker', type: 'warning' });
  return signals;
}

function renderProfileComparison() {
  const selectedProfile = document.getElementById('compareProfile').value;
  const example = presetProfiles[selectedProfile];
  const currentData = getFormData();
  const currentRisk = calculateRisk(currentData);
  const exampleRisk = calculateRisk(example);
  const profiles = [
    { title: 'Your current profile', risk: currentRisk },
    { title: `${selectedProfile[0].toUpperCase()}${selectedProfile.slice(1)} example`, risk: exampleRisk }
  ];

  document.getElementById('profileComparison').innerHTML = profiles.map(({ title, risk }) => `
    <article class="comparison-card ${risk.level}">
      <h4>${escapeHTML(title)}</h4>
      <strong>${escapeHTML(risk.label)}</strong>
      <span>${risk.score}/100 educational marker score</span>
    </article>
  `).join('');
}

function renderQuiz() {
  const quizContent = document.getElementById('quizContent');
  const progress = document.getElementById('quizProgress');
  const restartButton = document.getElementById('restartQuiz');
  if (quizIndex >= quizQuestions.length) {
    quizContent.innerHTML = `
      <div class="quiz-complete">
        <h3>Knowledge check complete</h3>
        <p>You answered ${quizScore} of ${quizQuestions.length} questions correctly.</p>
        <p>Remember: this dashboard is for education, not diagnosis.</p>
      </div>
    `;
    progress.textContent = 'Complete';
    restartButton.hidden = false;
    return;
  }

  const currentQuestion = quizQuestions[quizIndex];
  const answerMarkup = quizAnswered
    ? `<div class="quiz-feedback" role="status"><strong>${quizWasCorrect ? 'Correct.' : 'Not quite.'}</strong> ${escapeHTML(currentQuestion.explanation)}</div>
       <button type="button" id="quizNext">${quizIndex === quizQuestions.length - 1 ? 'See result' : 'Next question'}</button>`
    : `<fieldset class="quiz-options">
         <legend>${escapeHTML(currentQuestion.question)}</legend>
         ${currentQuestion.options.map((option, index) => `
           <label><input type="radio" name="quizAnswer" value="${index}" /> <span>${escapeHTML(option)}</span></label>
         `).join('')}
       </fieldset>
       <button type="button" id="checkQuizAnswer">Check answer</button>
       <p id="quizError" class="quiz-error" role="alert"></p>`;
  quizContent.innerHTML = `
    <div class="quiz-question">
      <p class="section-kicker">Question ${quizIndex + 1}</p>
      ${answerMarkup}
    </div>
  `;
  progress.textContent = `${quizIndex + 1} of ${quizQuestions.length}`;
  restartButton.hidden = true;

  const checkButton = document.getElementById('checkQuizAnswer');
  if (checkButton) {
    checkButton.addEventListener('click', () => {
      const chosen = quizContent.querySelector('input[name="quizAnswer"]:checked');
      if (!chosen) {
        document.getElementById('quizError').textContent = 'Choose an answer to continue.';
        return;
      }
      quizAnswered = true;
      quizWasCorrect = Number(chosen.value) === currentQuestion.answer;
      if (quizWasCorrect) quizScore += 1;
      renderQuiz();
      document.getElementById('quizNext').focus();
    });
  }

  const nextButton = document.getElementById('quizNext');
  if (nextButton) {
    nextButton.addEventListener('click', () => {
      quizIndex += 1;
      quizAnswered = false;
      renderQuiz();
      const firstOption = quizContent.querySelector('input[name="quizAnswer"]');
      if (firstOption) firstOption.focus();
    });
  }
}

function parseCSV(text) {
  const rows = [];
  const lines = text.trim().split(/\r?\n/).filter(Boolean);

  if (!lines.length) return rows;

  const headers = splitCSVLine(lines[0]);

  lines.slice(1).forEach((line) => {
    const values = splitCSVLine(line);
    const row = {};
    headers.forEach((header, index) => {
      row[header.trim()] = (values[index] || '').trim();
    });
    rows.push(row);
  });

  return rows;
}

function splitCSVLine(line) {
  return line.match(/(".*?"|[^,]+)(?=,|$)/g) || [];
}

function toNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

async function loadDataset() {
  try {
    const response = await fetch(csvUrl);
    if (!response.ok) {
      throw new Error(`CSV failed to load: ${response.status}`);
    }

    const csvText = await response.text();
    datasetRows = parseCSV(csvText);
    renderCohortBars(datasetRows);
  } catch (error) {
    console.error(error);
    document.getElementById('cohortBars').innerHTML =
      '<p class="dataset-error">Unable to load the cohort data. Check that the project CSV is available.</p>';
  }
}

function renderCohortBars(rows) {
  const validRows = rows.filter((row) => Object.keys(row).length > 0);
  const markers = [
    { label: 'Hypertension', match: (row) => row.htn === 'yes' },
    { label: 'Diabetes', match: (row) => row.dm === 'yes' },
    { label: 'Abnormal RBC', match: (row) => row.rbc === 'abnormal' },
    { label: 'Albumin present', match: (row) => toNumber(row.al) > 0 }
  ];

  document.getElementById('cohortBars').innerHTML = markers.map((marker) => {
    const count = validRows.filter(marker.match).length;
    const percentage = validRows.length ? Math.round((count / validRows.length) * 100) : 0;
    return `<div class="cohort-row"><div class="cohort-label"><span>${marker.label}</span><strong>${count} <small>(${percentage}%)</small></strong></div><div class="cohort-track" role="img" aria-label="${marker.label}: ${percentage}% of records"><span style="width:${percentage}%"></span></div></div>`;
  }).join('');
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

function calculateRisk(data) {
  let score = 0;

  if (data.age >= 55) score += 18;
  if (data.bp >= 90) score += 18;
  if (data.sg <= 1.015) score += 18;
  if (data.al >= 2) score += 22;
  if (data.su > 0) score += 12;
  if (data.rbc === 'abnormal') score += 15;
  if (data.pc === 'abnormal') score += 15;
  if (data.pcc === 'present') score += 12;
  if (data.ba === 'present') score += 14;
  if (data.htn === 'yes') score += 18;
  if (data.dm === 'yes') score += 16;
  if (data.appet === 'poor') score += 10;
  score = Math.min(score, 100);

  if (score >= 70) {
    return {
      level: 'high',
      label: 'High Risk',
      message: 'This profile shows several CKD-related indicators that should be reviewed by a clinician.',
      score
    };
  }

  if (score >= 38) {
    return {
      level: 'medium',
      label: 'Moderate Risk',
      message: 'Some warning signs are present. Follow-up testing and monitoring would be recommended.',
      score
    };
  }

  return {
    level: 'low',
    label: 'Low Risk',
    message: 'The entered values do not strongly indicate chronic kidney disease risk based on the current markers.',
    score
  };
}

function getFormData() {
  return {
    age: toNumber(document.getElementById('age').value),
    bp: toNumber(document.getElementById('bp').value),
    sg: toNumber(document.getElementById('sg').value),
    al: toNumber(document.getElementById('al').value),
    su: toNumber(document.getElementById('su').value),
    rbc: document.getElementById('rbc').value,
    pc: document.getElementById('pc').value,
    pcc: document.getElementById('pcc').value,
    ba: document.getElementById('ba').value,
    htn: document.getElementById('htn').value,
    dm: document.getElementById('dm').value,
    appet: document.getElementById('appet').value
  };
}

function updateRiskMeter(risk) {
  const percentage = Math.min(risk.score, 100);
  meterFill.style.width = `${percentage}%`;
  meterFill.className = `meter-fill ${risk.level}`;
  meterLabel.textContent = risk.label;
}

function updateRiskSignals(data) {
  const signals = getMarkerSignals(data);
  if (!signals.length) {
    signals.push({ text: 'No major red flags detected', type: 'normal' });
  }

  riskSignals.innerHTML = signals
    .slice(0, 5)
    .map(
      (signal) => `
        <span class="signal-pill ${signal.type === 'normal' ? '' : signal.type === 'warning' ? 'warning' : 'danger'}">
          ${signal.text}
        </span>
      `
    )
    .join('');
}

function applyProfile(profileKey) {
  const profile = presetProfiles[profileKey] || presetProfiles.healthy;

  Object.entries(profile).forEach(([key, value]) => {
    const element = document.getElementById(key);
    if (!element) return;

    if (element.tagName === 'SELECT') {
      element.value = value;
    } else {
      element.value = value;
    }
  });

  const risk = calculateRisk(profile);
  updateRiskMeter(risk);
  updateRiskSignals(profile);
  showResult(risk);
  setWizardStep(0);
  syncWhatIfControls();
  renderProfileComparison();

  document.querySelectorAll('.preset-btn').forEach((button) => {
    button.classList.toggle('active', button.dataset.profile === profileKey);
  });
}

function showResult(risk) {
  resultBox.className = `result-box ${risk.level}`;
  resultBox.classList.remove('hidden');
  resultBox.innerHTML = `
    <p class="result-kicker">Educational indicator · not an ML prediction</p>
    <h3>${escapeHTML(risk.label)}</h3>
    <p><strong>Marker score:</strong> ${risk.score}/100</p>
    <p>${escapeHTML(risk.message)}</p>
  `;
  renderReportDetails(getFormData());
}

function renderReportDetails(data) {
  const values = [
    ['Age', `${data.age} years`], ['Blood pressure', `${data.bp} mmHg`], ['Specific gravity', data.sg],
    ['Albumin', data.al], ['Urine sugar', data.su], ['Red blood cells', data.rbc], ['Pus cells', data.pc],
    ['Pus cell clumps', data.pcc], ['Bacteria', data.ba], ['Hypertension', data.htn],
    ['Diabetes', data.dm], ['Appetite', data.appet]
  ];
  const markers = getMarkerSignals(data);
  const markerSummary = markers.length
    ? `<ul>${markers.map(({ text }) => `<li>${escapeHTML(text)}</li>`).join('')}</ul>`
    : '<p>No markers crossed this page’s simple educational thresholds.</p>';
  reportDetails.innerHTML = `<h3>Personalized educational summary</h3>
    <p>This summary reflects the values entered and the simple indicator on this page. It is not a medical assessment.</p>
    <h4>Markers included in the indicator</h4>${markerSummary}
    <h4>Entered profile</h4><dl>${values.map(([label, value]) =>
    `<div><dt>${escapeHTML(label)}</dt><dd>${escapeHTML(value)}</dd></div>`
  ).join('')}</dl>`;
}

async function checkModelStatus() {
  try {
    const response = await fetch('/api/model-status');
    const status = await response.json();
    modelAvailable = response.ok && status.available === true;
    modelStatus.classList.toggle('available', modelAvailable);
    modelStatus.classList.toggle('unavailable', !modelAvailable);
    modelStatusText.textContent = modelAvailable
      ? 'Trained pipeline connected'
      : status.message || 'No trained pipeline installed';
  } catch (error) {
    modelAvailable = false;
    modelStatus.classList.add('unavailable');
    modelStatusText.textContent = 'Start the local app server to check';
  }
}

async function requestModelPrediction(data) {
  const response = await fetch('/api/predict', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.message || 'Model prediction is unavailable.');
  resultBox.className = `result-box ${result.level}`;
  resultBox.classList.remove('hidden');
  resultBox.innerHTML = `
    <p class="result-kicker">Model output · screening support only</p>
    <h3>${escapeHTML(result.label)}</h3>
    <p>${escapeHTML(result.message)}</p>
  `;
  renderReportDetails(data);
}

function handleFormUpdate() {
  const formData = getFormData();
  const risk = calculateRisk(formData);
  updateRiskMeter(risk);
  updateRiskSignals(formData);
  syncWhatIfControls();
  renderProfileComparison();
  document.querySelectorAll('.preset-btn').forEach((button) => button.classList.remove('active'));
  if (resultBox && !resultBox.classList.contains('hidden')) {
    showResult(risk);
  }
}

riskForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (currentStep < formSteps.length - 1) {
    setWizardStep(currentStep + 1);
    formSteps[currentStep].querySelector('input, select')?.focus();
    return;
  }
  const formData = getFormData();
  const risk = calculateRisk(formData);
  if (modelAvailable) {
    try {
      await requestModelPrediction(formData);
    } catch (error) {
      showResult(risk);
      modelStatusText.textContent = 'Model request failed; showing educational indicator';
    }
  } else {
    showResult(risk);
  }
});

riskForm.addEventListener('input', handleFormUpdate);
riskForm.addEventListener('change', handleFormUpdate);

riskForm.addEventListener('reset', () => {
  setTimeout(() => {
    setWizardStep(0);
    const risk = calculateRisk(getFormData());
    updateRiskMeter(risk);
    updateRiskSignals(getFormData());
    syncWhatIfControls();
    renderProfileComparison();
    document.querySelectorAll('.preset-btn').forEach((button) => button.classList.remove('active'));
    showResult(risk);
  }, 0);
});

nextStepButton.addEventListener('click', () => {
  const activeStep = formSteps[currentStep];
  const requiredFields = activeStep.querySelectorAll('[data-required]');
  for (const field of requiredFields) {
    field.required = true;
    if (!field.reportValidity()) return;
  }
  setWizardStep(currentStep + 1);
  formSteps[currentStep].querySelector('input, select')?.focus();
});

previousStepButton.addEventListener('click', () => {
  setWizardStep(currentStep - 1);
  formSteps[currentStep].querySelector('input, select')?.focus();
});

ageSlider.addEventListener('input', () => {
  ageInput.value = ageSlider.value;
  handleFormUpdate();
});

bpSlider.addEventListener('input', () => {
  bpInput.value = bpSlider.value;
  handleFormUpdate();
});

document.getElementById('compareProfile').addEventListener('change', renderProfileComparison);

document.querySelectorAll('.preset-btn').forEach((button) => {
  button.addEventListener('click', () => applyProfile(button.dataset.profile));
});

document.getElementById('restartQuiz').addEventListener('click', () => {
  quizIndex = 0;
  quizScore = 0;
  quizAnswered = false;
  quizWasCorrect = false;
  renderQuiz();
});

[
  ['largeTextToggle', 'large-text'],
  ['contrastToggle', 'high-contrast'],
  ['motionToggle', 'reduce-motion']
].forEach(([buttonId, className]) => {
  const button = document.getElementById(buttonId);
  button.addEventListener('click', () => {
    const enabled = document.body.classList.toggle(className);
    button.setAttribute('aria-pressed', String(enabled));
  });
});

document.getElementById('printReport').addEventListener('click', () => window.print());

setWizardStep(0);
renderQuiz();
loadDataset();
checkModelStatus();
applyProfile('healthy');

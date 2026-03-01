document.addEventListener('DOMContentLoaded', () => {

    const fileUploadContainer = document.getElementById('file-upload-container');
    const addFileBtn = document.getElementById('add-file-btn');
    const analyzeBtn = document.getElementById('analyze-btn');
    const uploadStatus = document.getElementById('upload-status');
    const resultsContainer = document.getElementById('results-container');
    const loaderContainer = document.getElementById('loader-container');
    const analysisResults = document.getElementById('analysis-results');
    const errorContainer = document.getElementById('error-container');
    const errorMessage = document.getElementById('error-message');
    const contradictionsList = document.getElementById('contradictions-list');
    const overlapsList = document.getElementById('overlaps-list');
    const noIssuesSection = document.getElementById('no-issues-section');
    const generateReportBtn = document.getElementById('generate-report-btn');
    const reportSection = document.getElementById('report-section');
    const reportOutput = document.getElementById('report-output');
    const internalDocDisplay = document.getElementById('internal-doc-display');
    const simulateUpdateBtn = document.getElementById('simulate-update-btn');
    const pathwayStatus = document.getElementById('pathway-status');
    const externalPolicyInput = document.getElementById('external-policy-input');

    let fileCounter = 2;
    const maxFiles = 3;
    let documents = [];
    let lastAnalysisResult = null;

    // Attach listeners to first 2 static inputs
    initializeExistingInputs();

    function initializeExistingInputs() {
        for (let i = 1; i <= 2; i++) {
            const input = document.getElementById(`file-input-${i}`);
            const label = document.querySelector(`label[for="file-input-${i}"]`);
            if (input && label) {
                attachEventListenersToInput(input, label, i - 1);
            }
        }
    }

    function createFileInput() {
        if (fileCounter >= maxFiles) return;

        fileCounter++;

        const fileInputId = `file-input-${fileCounter}`;

        const fileDiv = document.createElement('div');
        fileDiv.innerHTML = `
            <label for="${fileInputId}" class="file-input-label flex flex-col items-center justify-center">
                <span class="mt-2 text-sm font-medium text-gray-600">
                    Choose Document ${fileCounter} (.txt, .md)
                </span>
            </label>
            <input type="file" id="${fileInputId}" class="hidden" accept=".txt,.md">
        `;

        fileUploadContainer.appendChild(fileDiv);

        const input = document.getElementById(fileInputId);
        const label = fileDiv.querySelector('label');

        attachEventListenersToInput(input, label, fileCounter - 1);
    }

    function attachEventListenersToInput(fileInput, label, index) {
        if (!fileInput || !label) return;

        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();

            reader.onload = (event) => {
                documents[index] = {
                    name: file.name,
                    content: event.target.result
                };

                const span = label.querySelector('span');

                if (span) {
                    span.textContent = `✔️ ${file.name}`;
                    span.classList.remove('text-gray-600');
                    span.classList.add('text-green-600');
                }

                if (uploadStatus) {
                    uploadStatus.textContent = `Loaded: ${file.name}`;
                }

                if (index === 0 && internalDocDisplay) {
                    internalDocDisplay.value =
                        `Document: ${file.name}\n\n---\n\n${event.target.result}`;
                }
            };

            reader.readAsText(file);
        });

        // Drag & Drop
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            label.addEventListener(eventName, preventDefaults, false);
        });

        label.addEventListener('drop', (e) => {
            label.classList.remove('dragover');
            fileInput.files = e.dataTransfer.files;
            fileInput.dispatchEvent(new Event('change'));
        });
    }

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    async function callGeminiAPI(docs) {
        const response = await fetch('/api/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ docs })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Server error');
        }

        return data;
    }

    async function handleAnalysis(docsToCheck = documents) {

        const validDocs = docsToCheck.filter(d => d && d.content);

        if (validDocs.length < 2) {
            if (uploadStatus) {
                uploadStatus.textContent = "Please upload at least two documents.";
            }
            return;
        }

        resultsContainer?.classList.remove('hidden');
        loaderContainer?.classList.remove('hidden');
        errorContainer?.classList.add('hidden');
        analysisResults?.classList.add('hidden');
        reportSection?.classList.add('hidden');

        try {
            const result = await callGeminiAPI(validDocs);

            loaderContainer?.classList.add('hidden');
            analysisResults?.classList.remove('hidden');

            displayResults(result);

        } catch (err) {
            loaderContainer?.classList.add('hidden');
            if (errorMessage) errorMessage.textContent = err.message;
            errorContainer?.classList.remove('hidden');
        }
    }

    function displayResults(result) {
        lastAnalysisResult = result;
        contradictionsList.innerHTML = '';
        overlapsList.innerHTML = '';
        noIssuesSection?.classList.add('hidden');

        if (!result.contradictions?.length && !result.overlaps?.length) {
            noIssuesSection?.classList.remove('hidden');
            return;
        }

        result.contradictions?.forEach(c => {
            const item = document.createElement('div');
            item.innerHTML = `<strong>${c.topic}</strong><p>${c.explanation}</p>`;
            contradictionsList.appendChild(item);
        });

        result.overlaps?.forEach(o => {
            const item = document.createElement('div');
            item.innerHTML = `<strong>${o.topic}</strong><p>${o.explanation}</p>`;
            overlapsList.appendChild(item);
        });
    }

    generateReportBtn?.addEventListener('click', () => {
        if (!lastAnalysisResult) return;

        reportOutput.textContent =
            `SMART DOC CHECKER REPORT\n\n` +
            JSON.stringify(lastAnalysisResult, null, 2);

        reportSection?.classList.remove('hidden');
    });

    simulateUpdateBtn?.addEventListener('click', () => {
        const firstDoc = documents[0];
        const externalText = externalPolicyInput?.value.trim();

        if (!firstDoc || !externalText) {
            pathwayStatus.textContent =
                "Upload first document and paste external text.";
            return;
        }

        handleAnalysis([
            firstDoc,
            { name: "External Document", content: externalText }
        ]);
    });

    analyzeBtn?.addEventListener('click', () => handleAnalysis());
    addFileBtn?.addEventListener('click', createFileInput);

});

// --- CLIENT NOW CALLS BACKEND; NO API KEY ON THE FRONTEND ---

document.addEventListener('DOMContentLoaded', () => {
    const fileUploadContainer = document.getElementById('file-upload-container');
    const addFileBtn = document.getElementById('add-file-btn');
    const analyzeBtn = document.getElementById('analyze-btn');
    const uploadStatus = document.getElementById('upload-status');
    const docsAnalyzedCount = document.getElementById('docs-analyzed-count');
    const reportsGeneratedCount = document.getElementById('reports-generated-count');

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
    
    // Get reference to the new user input textarea
    const externalPolicyInput = document.getElementById('external-policy-input');

    let fileCounter = 2; // Start with 2 static file inputs
    const maxFiles = 3;
    let documents = [];
    let lastAnalysisResult = null;
    let usage = { docsAnalyzed: 0, reportsGenerated: 0 };

    function createFileInput() {
        if (fileCounter >= maxFiles) {
            addFileBtn.disabled = true;
            addFileBtn.textContent = 'Limit Reached';
            return;
        }
        fileCounter++;
        const fileInputId = `file-input-${fileCounter}`;
        const labelId = `label-file-input-${fileCounter}`;
        const textId = `text-file-input-${fileCounter}`;
        const fileDiv = document.createElement('div');
        fileDiv.innerHTML = `
            <label for="${fileInputId}" id="${labelId}" class="file-input-label flex flex-col items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-10 w-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                <span id="${textId}" class="mt-2 text-sm font-medium text-gray-600">Choose Document ${fileCounter} (.txt, .md)</span>
            </label>
            <input type="file" id="${fileInputId}" class="hidden" accept=".txt,.md">
        `;
        fileUploadContainer.appendChild(fileDiv);

        const fileInput = document.getElementById(fileInputId);
        const label = document.getElementById(labelId);
        const textElement = document.getElementById(textId);
        
        attachEventListenersToInput(fileInput, label, textElement, fileCounter - 1);
    }
    
    function attachEventListenersToInput(fileInput, label, textElement, index) {
        if (!fileInput || !label || !textElement) return;

        fileInput.addEventListener('change', (e) => handleFileSelect(e, index, textElement));
        
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            label.addEventListener(eventName, preventDefaults, false);
        });
        
        label.addEventListener('dragenter', () => label.classList.add('dragover'));
        label.addEventListener('dragleave', () => label.classList.remove('dragover'));
        label.addEventListener('drop', (e) => {
            label.classList.remove('dragover');
            fileInput.files = e.dataTransfer.files;
            handleFileSelect({ target: fileInput }, index, textElement);
        });
    }

    function initializeExistingFileInputs() {
        for (let i = 0; i < fileCounter; i++) {
            const index = i + 1;
            const fileInput = document.getElementById(`file-input-${index}`);
            const label = document.getElementById(`label-file-input-${index}`);
            const textElement = document.getElementById(`text-file-input-${index}`);
            attachEventListenersToInput(fileInput, label, textElement, i);
        }
    }

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    function handleFileSelect(event, index, textElement) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();

        reader.onerror = () => {
            console.error("FileReader error: Could not read the file.");
            uploadStatus.textContent = `❌ Error reading file "${file.name}". Please use valid .txt or .md files.`;
            uploadStatus.classList.add('text-red-600');
            textElement.textContent = `Could not read file`;
            textElement.classList.remove('text-green-600');
            textElement.classList.add('text-red-600');
        };

        reader.onload = (e) => {
            documents[index] = {
                name: file.name,
                content: e.target.result
            };
            textElement.textContent = `✔️ ${file.name}`;
            textElement.classList.remove('text-red-600');
            textElement.classList.add('text-green-600');
            
            const uploadedCount = documents.filter(d => d).length;
            uploadStatus.textContent = `Successfully loaded "${file.name}". Total documents ready: ${uploadedCount}.`;
            uploadStatus.classList.remove('text-red-600');

            if (index === 0) {
                internalDocDisplay.value = `Document: ${file.name}\n\n---\n\n${e.target.result}`;
            }
        };
        reader.readAsText(file);
    }

    // --- This function now calls backend instead of Google directly ---
    async function callGeminiAPI(docs) {
        try {
            const response = await fetch('/api/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ docs })
            });

            if (!response.ok) {
                const errorBody = await response.json().catch(() => ({}));
                const detail = errorBody?.error || `The server responded with status ${response.status}. Please try again later.`;
                throw new Error(detail);
            }

            const data = await response.json();
            return { data };
        } catch (error) {
            console.error("Error calling backend /api/analyze:", error);
            return { error: error.message || 'Network error calling analysis service.' };
        }
    }

    function displayResults(result) {
        lastAnalysisResult = result;
        contradictionsList.innerHTML = '';
        overlapsList.innerHTML = '';
        noIssuesSection.classList.add('hidden');
        contradictionsList.parentElement.classList.add('hidden');
        overlapsList.parentElement.classList.add('hidden');
        
        if (!result || (!result.contradictions?.length && !result.overlaps?.length)) {
            noIssuesSection.classList.remove('hidden');
            generateReportBtn.classList.add('hidden');
            return;
        }

        generateReportBtn.classList.remove('hidden');

        if (result.contradictions?.length) {
            contradictionsList.parentElement.classList.remove('hidden');
            result.contradictions.forEach(c => {
                const item = document.createElement('div');
                item.className = 'p-4 border border-red-200 bg-red-50 rounded-lg';
                item.innerHTML = `
                    <p class="font-bold text-red-800">${c.topic}</p>
                    <p class="mt-2 text-sm text-gray-700">${c.explanation}</p>
                    <div class="mt-3 space-y-2 text-sm">
                        ${c.details.map(d => `<div class="p-2 bg-white rounded border"><strong>${d.docName}:</strong> "${d.statement}"</div>`).join('')}
                    </div>
                    <p class="mt-3 text-sm p-2 bg-green-100 border border-green-200 rounded text-green-800"><strong>Suggestion:</strong> ${c.suggestion}</p>
                `;
                contradictionsList.appendChild(item);
            });
        }

        if (result.overlaps?.length) {
            overlapsList.parentElement.classList.remove('hidden');
            result.overlaps.forEach(o => {
                const item = document.createElement('div');
                item.className = 'p-4 border border-blue-200 bg-blue-50 rounded-lg';
                item.innerHTML = `
                    <p class="font-bold text-blue-800">${o.topic}</p>
                     <p class="mt-2 text-sm text-gray-700">${o.explanation}</p>
                    <div class="mt-3 space-y-2 text-sm">
                        ${o.details.map(d => `<div class="p-2 bg-white rounded border"><strong>${d.docName}:</strong> "${d.statement}"</div>`).join('')}
                    </div>
                `;
                overlapsList.appendChild(item);
            });
        }
    }

    function updateCounters() {
        docsAnalyzedCount.textContent = usage.docsAnalyzed;
        reportsGeneratedCount.textContent = usage.reportsGenerated;
    }

    async function handleAnalysis(docsToCheck, fromPathway = false) {
        const validDocs = docsToCheck.filter(d => d && d.content);
        
        if (validDocs.length < 2) {
            const msg = "Please provide at least two documents to compare.";
            
            // Show error in the main results panel for clear, consistent feedback
            resultsContainer.classList.remove('hidden');
            loaderContainer.classList.add('hidden');
            analysisResults.classList.add('hidden');
            reportSection.classList.add('hidden');
            errorMessage.textContent = msg;
            errorContainer.classList.remove('hidden');

            if(fromPathway) {
                pathwayStatus.textContent = `❌ ${msg}`;
                pathwayStatus.classList.add('text-red-600');
            } else {
                uploadStatus.textContent = `❌ ${msg}`;
                uploadStatus.classList.add('text-red-600');
            }
            return;
        }
        
        resultsContainer.classList.remove('hidden');
        loaderContainer.classList.remove('hidden');
        analysisResults.classList.add('hidden');
        reportSection.classList.add('hidden');
        errorContainer.classList.add('hidden');
        
        if (fromPathway) {
            pathwayStatus.textContent = "Checking for new conflicts...";
        } else {
            uploadStatus.textContent = '';
            uploadStatus.classList.remove('text-red-600');
        }

        const response = await callGeminiAPI(validDocs);
        
        loaderContainer.classList.add('hidden');
        if (response.data) {
            analysisResults.classList.remove('hidden');
            displayResults(response.data);
            usage.docsAnalyzed++;
            updateCounters();
            if (fromPathway) {
                pathwayStatus.textContent = "✅ Check complete. See results on the right.";
            }
        } else {
            errorMessage.textContent = response.error;
            errorContainer.classList.remove('hidden');
            if (fromPathway) {
                pathwayStatus.textContent = "❌ Analysis failed.";
            }
        }
    }

    analyzeBtn.addEventListener('click', () => handleAnalysis(documents));
    addFileBtn.addEventListener('click', createFileInput);

    generateReportBtn.addEventListener('click', () => {
        if (!lastAnalysisResult) {
            return;
        }

        let reportText = `SMART DOC CHECKER - ANALYSIS REPORT\n`;
        reportText += `=====================================\n\n`;
        reportText += `Date: ${new Date().toLocaleString()}\n`;
        const docNames = documents.filter(d => d).map(d => d.name).join(', ');
        reportText += `Documents Analyzed: ${docNames}\n\n`;
        
        if (lastAnalysisResult.contradictions && lastAnalysisResult.contradictions.length > 0) {
            reportText += `--- CONTRADICTIONS ---\n`;
            lastAnalysisResult.contradictions.forEach((c, i) => {
                reportText += `\n${i + 1}. Topic: ${c.topic}\n`;
                reportText += `   Explanation: ${c.explanation}\n`;
                c.details.forEach(d => {
                    reportText += `   - In "${d.docName}": "${d.statement}"\n`;
                });
                reportText += `   Suggestion: ${c.suggestion}\n`;
            });
        } else {
            reportText += `--- No contradictions found. ---\n`;
        }
        
        if (lastAnalysisResult.overlaps && lastAnalysisResult.overlaps.length > 0) {
            reportText += `\n\n--- OVERLAPS ---\n`;
            lastAnalysisResult.overlaps.forEach((o, i) => {
                reportText += `\n${i + 1}. Topic: ${o.topic}\n`;
                reportText += `   Explanation: ${o.explanation}\n`;
                o.details.forEach(d => {
                    reportText += `   - In "${d.docName}": "${d.statement}"\n`;
                });
            });
        } else {
            reportText += `\n--- No significant overlaps found. ---\n`;
        }

        reportOutput.textContent = reportText;
        reportSection.classList.remove('hidden');

        usage.reportsGenerated++;
        updateCounters();
    });

    // --- MODIFIED: Pathway monitor now uses user-provided text ---
    simulateUpdateBtn.addEventListener('click', () => {
        const firstDoc = documents[0];
        
        // Check if the first document has been uploaded
        if (!firstDoc) {
            const msg = "Please upload the first document to use the Pathway Live Monitor.";
            handleAnalysis([], true); // Call handleAnalysis with empty array to show error correctly
            return;
        }

        const externalPolicyText = externalPolicyInput.value.trim();

        // Check if the user has pasted text into the new textarea
        if (!externalPolicyText) {
            const msg = "Please paste the external policy text into the text area below to run a comparison.";
             // Show error in the main results panel for clear, consistent feedback
            resultsContainer.classList.remove('hidden');
            loaderContainer.classList.add('hidden');
            analysisResults.classList.add('hidden');
            reportSection.classList.add('hidden');
            errorMessage.textContent = msg;
            errorContainer.classList.remove('hidden');
            pathwayStatus.textContent = `❌ ${msg}`;
            pathwayStatus.classList.add('text-red-600');
            return;
        }

        pathwayStatus.textContent = '';
        pathwayStatus.classList.remove('text-red-600');
        
        const externalDoc = {
            name: "Pasted External Document",
            content: externalPolicyText
        };

        // Call analysis with the first document and the user-pasted text
        handleAnalysis([firstDoc, externalDoc], true);
    });

    // Initial setup
    initializeExistingFileInputs();
});


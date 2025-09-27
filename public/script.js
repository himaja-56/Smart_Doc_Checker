// --- CLIENT NOW CALLS BACKEND; NO API KEY ON THE FRONTEND ---

document.addEventListener('DOMContentLoaded', () => {
    // --- Pricing & Plan Configuration ---
    const PLANS = {
        free: {
            name: 'Free Tier',
            analysesPerDay: 2,
            reportsPerMonth: 1,
            cost: 0
        },
        pro: {
            name: 'Pro Monthly',
            analysesPerMonth: 50,
            reportsPerMonth: 25,
            cost: 299
        },
        enterprise: {
            name: 'Enterprise',
            analysesPerMonth: 'Unlimited',
            reportsPerMonth: 'Unlimited',
            cost: 599
        }
    };

    // --- Element References ---
    const analysesUsageText = document.getElementById('analyses-usage-text');
    const reportsUsageText = document.getElementById('reports-usage-text');
    const analysesUsageTitle = document.getElementById('analyses-usage-title');
    const reportsUsageTitle = document.getElementById('reports-usage-title');
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
    
    // Modal elements
    const upgradeModal = document.getElementById('upgrade-modal');
    const modalMessage = document.getElementById('modal-message');
    const modalUpgradeBtn = document.getElementById('modal-upgrade-btn');
    const modalUpgradeEnterpriseBtn = document.getElementById('modal-upgrade-enterprise-btn');
    const modalCloseBtn = document.getElementById('modal-close-btn');
    
    // Payment Modal elements
    const paymentModal = document.getElementById('payment-modal');
    const paymentTitle = document.getElementById('payment-title');
    const paymentCost = document.getElementById('payment-cost');
    const paymentPayBtn = document.getElementById('payment-pay-btn');
    const paymentButtonText = document.getElementById('payment-button-text');
    const paymentCloseBtn = document.getElementById('payment-close-btn');
    const paymentLoader = document.getElementById('payment-loader');
    const toastNotification = document.getElementById('toast-notification');
    const toastMessage = document.getElementById('toast-message');

    // --- State Variables ---
    let fileCounter = 2;
    const maxFiles = 3;
    let documents = [];
    let lastAnalysisResult = null;
    let currentPlanKey = 'free';
    let unlockedPlans = ['free'];
    let usage = { analyses: 0, reports: 0 };
    let lastResetDate = new Date().toLocaleDateString();
    let planToUpgradeTo = null;

    // --- Core Functions ---
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
            uploadStatus.textContent = `❌ Error reading file "${file.name}".`;
            uploadStatus.classList.add('text-red-600');
            textElement.textContent = `Could not read file`;
            textElement.classList.remove('text-green-600');
            textElement.classList.add('text-red-600');
        };
        reader.onload = (e) => {
            documents[index] = { name: file.name, content: e.target.result };
            textElement.textContent = `✔️ ${file.name}`;
            textElement.classList.remove('text-red-600');
            textElement.classList.add('text-green-600');
            const uploadedCount = documents.filter(d => d).length;
            uploadStatus.textContent = `Successfully loaded "${file.name}". Total ready: ${uploadedCount}.`;
            uploadStatus.classList.remove('text-red-600');
            if (index === 0) {
                internalDocDisplay.value = `Document: ${file.name}\n\n---\n\n${e.target.result}`;
            }
        };
        reader.readAsText(file);
    }

    async function callGeminiAPI(docs) {
        try {
            const response = await fetch('/api/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ docs })
            });
            if (!response.ok) {
                const errorBody = await response.json().catch(() => ({}));
                const detail = errorBody?.error || `The server responded with status ${response.status}.`;
                throw new Error(detail);
            }
            return { data: await response.json() };
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
                    <div class="mt-3 space-y-2 text-sm">${c.details.map(d => `<div class="p-2 bg-white rounded border"><strong>${d.docName}:</strong> "${d.statement}"</div>`).join('')}</div>
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
                    <div class="mt-3 space-y-2 text-sm">${o.details.map(d => `<div class="p-2 bg-white rounded border"><strong>${d.docName}:</strong> "${d.statement}"</div>`).join('')}</div>
                `;
                overlapsList.appendChild(item);
            });
        }
    }
    
    function checkAndResetUsage() {
        const today = new Date().toLocaleDateString();
        const savedDate = localStorage.getItem('lastResetDate');
        const currentPlan = PLANS[currentPlanKey];
        
        if (currentPlan.name === 'Free Tier' && today !== savedDate) {
            usage.analyses = 0;
            localStorage.setItem('usage', JSON.stringify(usage));
            localStorage.setItem('lastResetDate', today);
            lastResetDate = today;
        }
    }

    function updateDashboard() {
        const currentPlan = PLANS[currentPlanKey];
        const isFreePlan = currentPlan.name === 'Free Tier';
        const analysesLimit = isFreePlan ? currentPlan.analysesPerDay : currentPlan.analysesPerMonth;
        const reportsLimit = currentPlan.reportsPerMonth;
        
        analysesUsageText.textContent = `${usage.analyses} / ${analysesLimit}`;
        reportsUsageText.textContent = `${usage.reports} / ${reportsLimit}`;

        analysesUsageTitle.textContent = isFreePlan ? 'Analyses Used Today' : 'Analyses Used This Month';
        reportsUsageTitle.textContent = 'Reports Used This Month';
    }

    function showUpgradeModal(type = 'analyses') {
        modalMessage.textContent = `You've used all the ${type} available on the ${PLANS[currentPlanKey].name}.`;
        upgradeModal.classList.remove('hidden');
    }

    function showPaymentModal(planKey) {
        const plan = PLANS[planKey];
        if (!plan) return;
        
        planToUpgradeTo = planKey;
        paymentTitle.textContent = `Upgrade to ${plan.name}`;
        paymentCost.textContent = `You will be charged ₹${plan.cost} per month.`;
        paymentButtonText.textContent = `Pay ₹${plan.cost} and Upgrade`;
        paymentModal.classList.remove('hidden');
    }

    async function handleAnalysis(docsToCheck, fromPathway = false) {
        checkAndResetUsage();
        const currentPlan = PLANS[currentPlanKey];

        const analysesLimit = currentPlan.name === 'Free Tier' ? currentPlan.analysesPerDay : currentPlan.analysesPerMonth;
        if (analysesLimit !== 'Unlimited' && usage.analyses >= analysesLimit) {
            showUpgradeModal('analyses');
            return;
        }

        const validDocs = docsToCheck.filter(d => d && d.content);
        if (validDocs.length < 2) {
            const msg = "Please provide at least two documents to compare.";
            resultsContainer.classList.remove('hidden');
            loaderContainer.classList.add('hidden');
            analysisResults.classList.add('hidden');
            reportSection.classList.add('hidden');
            errorMessage.textContent = msg;
            errorContainer.classList.remove('hidden');
            const statusTarget = fromPathway ? pathwayStatus : uploadStatus;
            statusTarget.textContent = `❌ ${msg}`;
            statusTarget.classList.add('text-red-600');
            return;
        }
        
        resultsContainer.classList.remove('hidden');
        loaderContainer.classList.remove('hidden');
        analysisResults.classList.add('hidden');
        reportSection.classList.add('hidden');
        errorContainer.classList.add('hidden');
        
        const statusTarget = fromPathway ? pathwayStatus : uploadStatus;
        statusTarget.textContent = fromPathway ? "Checking for new conflicts..." : '';
        statusTarget.classList.remove('text-red-600');

        const response = await callGeminiAPI(validDocs);
        
        loaderContainer.classList.add('hidden');
        if (response.data) {
            analysisResults.classList.remove('hidden');
            displayResults(response.data);
            usage.analyses++;
            localStorage.setItem('usage', JSON.stringify(usage));
            updateDashboard();
            if (fromPathway) pathwayStatus.textContent = "✅ Check complete. See results on the right.";
        } else {
            errorMessage.textContent = response.error;
            errorContainer.classList.remove('hidden');
            if (fromPathway) pathwayStatus.textContent = "❌ Analysis failed.";
        }
    }

    function handlePlanSelect(planKey, fromStorage = false) {
        if (!PLANS[planKey] || (currentPlanKey === planKey && !fromStorage)) {
            return;
        }
        
        currentPlanKey = planKey;

        if (!fromStorage) {
            usage = { analyses: 0, reports: 0 };
            localStorage.setItem('usage', JSON.stringify(usage));
            localStorage.setItem('currentPlan', planKey);
        }
        
        lastResetDate = localStorage.getItem('lastResetDate') || new Date().toLocaleDateString();
        
        document.querySelectorAll('.plan-card').forEach(card => card.classList.remove('selected'));
        document.getElementById(`plan-${planKey}`).classList.add('selected');

        document.querySelectorAll('.plan-select-btn').forEach(btn => {
             const key = btn.dataset.plan;
             if (PLANS[key]) {
                 btn.disabled = false;
                 if (unlockedPlans.includes(key)) {
                     btn.textContent = 'Select Plan';
                 } else {
                     btn.textContent = `Upgrade to ${PLANS[key].name.split(' ')[0]}`;
                 }
             }
        });
        
        const selectedBtn = document.querySelector(`#plan-${planKey} .plan-select-btn`);
        if (selectedBtn) {
            selectedBtn.textContent = 'Current Plan';
            selectedBtn.disabled = true;
        }

        updateDashboard();
    }
    
    document.querySelectorAll('.plan-select-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
             if (e.target.disabled) return;
             const planKey = e.target.dataset.plan;

             if (unlockedPlans.includes(planKey)) {
                 handlePlanSelect(planKey);
             } else {
                 showPaymentModal(planKey);
             }
        });
    });

    analyzeBtn.addEventListener('click', () => handleAnalysis(documents));
    addFileBtn.addEventListener('click', createFileInput);

    generateReportBtn.addEventListener('click', () => {
        const currentPlan = PLANS[currentPlanKey];
        const reportsLimit = currentPlan.reportsPerMonth;
        if (reportsLimit !== 'Unlimited' && usage.reports >= reportsLimit) {
            showUpgradeModal('reports');
            return;
        }
        if (!lastAnalysisResult) return;
        let reportText = `SMART DOC CHECKER - ANALYSIS REPORT\n\n=====================================\n\nDate: ${new Date().toLocaleString()}\n`;
        const docNames = documents.filter(d => d).map(d => d.name).join(', ');
        reportText += `Documents Analyzed: ${docNames}\n\n`;
        if (lastAnalysisResult.contradictions?.length) {
            reportText += `--- CONTRADICTIONS ---\n`;
            lastAnalysisResult.contradictions.forEach((c, i) => {
                reportText += `\n${i + 1}. Topic: ${c.topic}\n   Explanation: ${c.explanation}\n`;
                c.details.forEach(d => { reportText += `   - In "${d.docName}": "${d.statement}"\n`; });
                reportText += `   Suggestion: ${c.suggestion}\n`;
            });
        } else {
            reportText += `--- No contradictions found. ---\n`;
        }
        if (lastAnalysisResult.overlaps?.length) {
            reportText += `\n\n--- OVERLAPS ---\n`;
            lastAnalysisResult.overlaps.forEach((o, i) => {
                reportText += `\n${i + 1}. Topic: ${o.topic}\n   Explanation: ${o.explanation}\n`;
                o.details.forEach(d => { reportText += `   - In "${d.docName}": "${d.statement}"\n`; });
            });
        } else {
            reportText += `\n--- No significant overlaps found. ---\n`;
        }
        reportOutput.textContent = reportText;
        reportSection.classList.remove('hidden');
        usage.reports++;
        localStorage.setItem('usage', JSON.stringify(usage));
        updateDashboard();
    });

    simulateUpdateBtn.addEventListener('click', () => {
        const firstDoc = documents[0];
        if (!firstDoc) {
            handleAnalysis([], true);
            return;
        }
        const externalPolicyText = externalPolicyInput.value.trim();
        if (!externalPolicyText) {
            const msg = "Please paste the external policy text into the text area below to run a comparison.";
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
        handleAnalysis([firstDoc, externalDoc], true);
    });
    
    modalCloseBtn.addEventListener('click', () => upgradeModal.classList.add('hidden'));
    
    [modalUpgradeBtn, modalUpgradeEnterpriseBtn].forEach(btn => {
        btn.addEventListener('click', (e) => {
            upgradeModal.classList.add('hidden');
            showPaymentModal(e.target.dataset.plan);
        });
    });

    paymentCloseBtn.addEventListener('click', () => paymentModal.classList.add('hidden'));

    paymentPayBtn.addEventListener('click', () => {
        if (!planToUpgradeTo) return;
        
        const plan = PLANS[planToUpgradeTo];
        paymentPayBtn.disabled = true;
        paymentLoader.classList.remove('hidden');
        paymentButtonText.textContent = 'Processing...';

        setTimeout(() => {
            paymentModal.classList.add('hidden');
            paymentPayBtn.disabled = false;
            paymentLoader.classList.add('hidden');
            
            if (!unlockedPlans.includes(planToUpgradeTo)) {
                unlockedPlans.push(planToUpgradeTo);
                localStorage.setItem('unlockedPlans', JSON.stringify(unlockedPlans));
            }

            handlePlanSelect(planToUpgradeTo);
            
            toastMessage.textContent = `Payment Successful! You are now on the ${plan.name}.`;
            toastNotification.classList.remove('hidden');
            setTimeout(() => {
                toastNotification.classList.add('hidden');
            }, 3000);
            
            planToUpgradeTo = null;

        }, 2000);
    });

    function initializeApp() {
        localStorage.clear(); // Ensure clean slate for demo

        handlePlanSelect('free');
        
        initializeExistingFileInputs();
        updateDashboard();
    }

    initializeApp();
});


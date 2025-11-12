// ==================== Global State ====================
let selectedTool = 'summarize';
const toolData = {
    summarize: {
        icon: 'fas fa-file-lines',
        name: 'Summarize'
    },
    mcq: {
        icon: 'fas fa-circle-question',
        name: 'MCQ Quiz'
    },
    notes: {
        icon: 'fas fa-clipboard',
        name: 'Study Notes'
    },
    flashcards: {
        icon: 'fas fa-layer-group',
        name: 'Flash Cards'
    },
    mindmap: {
        icon: 'fas fa-diagram-project',
        name: 'Mind Map'
    }
};

// ==================== DOM Ready ====================
document.addEventListener('DOMContentLoaded', function() {
    initSidebar();
    initFileUpload();
    initToolSelection();
    initFormSubmission();
    initFlashMessages();
    initDownloadButtons();
});

// ==================== Sidebar Functionality ====================
function initSidebar() {
    const sidebar = document.getElementById('sidebar');
    const sidebarToggle = document.getElementById('sidebarToggle');
    
    if (!sidebar || !sidebarToggle) return;
    
    // Toggle sidebar
    sidebarToggle.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
        localStorage.setItem('sidebarCollapsed', sidebar.classList.contains('collapsed'));
    });
    
    // Restore sidebar state
    const isCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
    if (isCollapsed) {
        sidebar.classList.add('collapsed');
    }
    
    // Auto-expand on hover when collapsed
    let hoverTimer;
    sidebar.addEventListener('mouseenter', () => {
        if (sidebar.classList.contains('collapsed')) {
            hoverTimer = setTimeout(() => {
                sidebar.classList.add('hover-expanded');
            }, 300);
        }
    });
    
    sidebar.addEventListener('mouseleave', () => {
        clearTimeout(hoverTimer);
        sidebar.classList.remove('hover-expanded');
    });
    
    // Mobile menu toggle
    const createMobileToggle = () => {
        if (window.innerWidth <= 768) {
            let mobileToggle = document.querySelector('.mobile-menu-toggle');
            if (!mobileToggle) {
                mobileToggle = document.createElement('button');
                mobileToggle.className = 'mobile-menu-toggle';
                mobileToggle.innerHTML = '<i class="fas fa-bars"></i>';
                document.querySelector('.main-wrapper').prepend(mobileToggle);
                
                mobileToggle.addEventListener('click', () => {
                    sidebar.classList.toggle('mobile-open');
                });
                
                // Close sidebar when clicking outside
                document.addEventListener('click', (e) => {
                    if (!sidebar.contains(e.target) && !mobileToggle.contains(e.target)) {
                        sidebar.classList.remove('mobile-open');
                    }
                });
            }
        }
    };
    
    createMobileToggle();
    window.addEventListener('resize', createMobileToggle);
}

// ==================== Tool Selection ====================
function initToolSelection() {
    const toolItems = document.querySelectorAll('.nav-item[data-tool]');
    const toolKindInput = document.getElementById('toolKind');
    const selectedToolDisplay = document.getElementById('selectedToolDisplay');
    
    if (!toolItems.length) return;
    
    toolItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const tool = item.dataset.tool;
            
            // Update active state
            document.querySelectorAll('.nav-item[data-tool]').forEach(t => {
                t.classList.remove('active');
            });
            item.classList.add('active');
            
            // Update selected tool
            selectedTool = tool;
            if (toolKindInput) {
                toolKindInput.value = tool;
            }
            
            // Update display
            updateToolDisplay(tool);
            
            // Visual feedback
            showNotification(`${toolData[tool].name} selected`, 'info');
        });
    });
}

function updateToolDisplay(tool) {
    const selectedToolDisplay = document.getElementById('selectedToolDisplay');
    if (!selectedToolDisplay) return;
    
    const data = toolData[tool];
    selectedToolDisplay.innerHTML = `
        <div class="tool-badge">
            <i class="${data.icon}"></i>
            <span>${data.name}</span>
        </div>
        <span class="change-tool">Click a tool in the sidebar to change</span>
    `;
    
    // Animate
    selectedToolDisplay.style.animation = 'none';
    setTimeout(() => {
        selectedToolDisplay.style.animation = 'fadeInUp 0.3s ease-out';
    }, 10);
}

// ==================== File Upload ====================
function initFileUpload() {
    const fileUploadArea = document.getElementById('fileUploadArea');
    const fileInput = document.getElementById('fileInput');
    const fileInfo = document.getElementById('fileInfo');
    const fileRemove = document.getElementById('fileRemove');
    
    if (!fileUploadArea || !fileInput) return;
    
    // Prevent defaults
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        fileUploadArea.addEventListener(eventName, preventDefaults, false);
        document.body.addEventListener(eventName, preventDefaults, false);
    });
    
    // Highlight on drag
    ['dragenter', 'dragover'].forEach(eventName => {
        fileUploadArea.addEventListener(eventName, () => {
            fileUploadArea.classList.add('dragover');
        });
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
        fileUploadArea.addEventListener(eventName, () => {
            fileUploadArea.classList.remove('dragover');
        });
    });
    
    // Handle drop
    fileUploadArea.addEventListener('drop', handleDrop);
    
    // Handle file select
    fileInput.addEventListener('change', (e) => {
        handleFileSelect(e.target.files);
    });
    
    // Click to browse
    fileUploadArea.addEventListener('click', () => {
        fileInput.click();
    });
    
    // Remove file
    if (fileRemove) {
        fileRemove.addEventListener('click', (e) => {
            e.stopPropagation();
            clearFileSelection();
        });
    }
    
    function handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;
        fileInput.files = files;
        handleFileSelect(files);
    }
    
    function handleFileSelect(files) {
        if (files.length === 0) return;
        
        const file = files[0];
        
        // Validate file size (50MB max)
        const maxSize = 50 * 1024 * 1024;
        if (file.size > maxSize) {
            showNotification('File size exceeds 50MB limit', 'error');
            clearFileSelection();
            return;
        }
        
        // Validate file type
        const validExtensions = ['pdf', 'pptx', 'docx', 'txt'];
        const extension = file.name.split('.').pop().toLowerCase();
        
        if (!validExtensions.includes(extension)) {
            showNotification('Invalid file type. Please upload PDF, PPTX, DOCX, or TXT files.', 'error');
            clearFileSelection();
            return;
        }
        
        displayFileInfo(file);
    }
    
    function displayFileInfo(file) {
        if (!fileInfo) return;
        
        const extension = file.name.split('.').pop().toLowerCase();
        const fileIcon = document.getElementById('fileIcon');
        const fileName = document.getElementById('fileName');
        const fileSize = document.getElementById('fileSize');
        
        // Update icon
        let iconClass = 'fas fa-file';
        if (extension === 'pdf') iconClass = 'fas fa-file-pdf';
        else if (['ppt', 'pptx'].includes(extension)) iconClass = 'fas fa-file-powerpoint';
        else if (['doc', 'docx'].includes(extension)) iconClass = 'fas fa-file-word';
        else if (extension === 'txt') iconClass = 'fas fa-file-lines';
        
        fileIcon.innerHTML = `<i class="${iconClass}"></i>`;
        fileName.textContent = file.name;
        fileSize.textContent = formatFileSize(file.size);
        
        // Show file info, hide upload area
        fileUploadArea.style.display = 'none';
        fileInfo.style.display = 'block';
    }
    
    function clearFileSelection() {
        if (fileInput) fileInput.value = '';
        if (fileUploadArea) fileUploadArea.style.display = 'block';
        if (fileInfo) fileInfo.style.display = 'none';
    }
}

function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// ==================== Form Submission ====================
function initFormSubmission() {
    const uploadForm = document.getElementById('uploadForm');
    const btnGenerate = document.getElementById('btnGenerate');
    
    if (!uploadForm) return;
    
    uploadForm.addEventListener('submit', (e) => {
        const fileInput = document.getElementById('fileInput');
        
        // Validate file is selected
        if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
            e.preventDefault();
            showNotification('Please select a file to upload', 'error');
            return;
        }
        
        // Show loading state
        if (btnGenerate) {
            btnGenerate.disabled = true;
            btnGenerate.classList.add('loading');
            btnGenerate.innerHTML = `
                <span class="btn-content">
                    <i class="fas fa-spinner"></i>
                    <span>Processing with AI...</span>
                </span>
            `;
        }
    });
}

// ==================== Flash Messages ====================
function initFlashMessages() {
    const flashMessages = document.querySelectorAll('.flash-message');
    
    flashMessages.forEach(message => {
        // Auto-hide after 5 seconds
        setTimeout(() => {
            hideFlashMessage(message);
        }, 5000);
        
        // Close button
        const closeBtn = message.querySelector('.flash-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                hideFlashMessage(message);
            });
        }
    });
}

function hideFlashMessage(message) {
    message.style.animation = 'slideOutRight 0.3s ease-out forwards';
    setTimeout(() => {
        message.remove();
    }, 300);
}

// ==================== Download Buttons ====================
function initDownloadButtons() {
    const downloadLinks = document.querySelectorAll('.btn-download');
    
    downloadLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            const icon = this.querySelector('i');
            const originalIcon = icon.className;
            
            // Animate
            icon.className = 'fas fa-spinner fa-spin';
            this.style.opacity = '0.8';
            
            setTimeout(() => {
                icon.className = originalIcon;
                this.style.opacity = '1';
            }, 1500);
        });
    });
}

// ==================== Utility Functions ====================
function showNotification(message, type = 'success') {
    const flashContainer = document.querySelector('.flash-container') || createFlashContainer();
    
    const icons = {
        success: 'fas fa-circle-check',
        error: 'fas fa-circle-xmark',
        info: 'fas fa-circle-info',
        warning: 'fas fa-triangle-exclamation'
    };
    
    const colors = {
        success: '#10b981',
        error: '#ef4444',
        info: '#3b82f6',
        warning: '#f59e0b'
    };
    
    const notification = document.createElement('div');
    notification.className = 'flash-message';
    notification.style.borderLeftColor = colors[type];
    notification.innerHTML = `
        <div class="flash-content">
            <i class="${icons[type]}" style="color: ${colors[type]}"></i>
            <span>${message}</span>
        </div>
        <button class="flash-close">
            <i class="fas fa-xmark"></i>
        </button>
    `;
    
    flashContainer.appendChild(notification);
    
    // Close button
    notification.querySelector('.flash-close').addEventListener('click', () => {
        hideFlashMessage(notification);
    });
    
    // Auto-hide
    setTimeout(() => {
        hideFlashMessage(notification);
    }, 5000);
}

function createFlashContainer() {
    const container = document.createElement('div');
    container.className = 'flash-container';
    document.body.appendChild(container);
    return container;
}

// ==================== Smooth Scrolling ====================
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

// ==================== Animation Styles ====================
const animationStyles = document.createElement('style');
animationStyles.textContent = `
    @keyframes slideOutRight {
        from {
            opacity: 1;
            transform: translateX(0);
        }
        to {
            opacity: 0;
            transform: translateX(100px);
        }
    }
    
    .sidebar.hover-expanded {
        width: var(--sidebar-width) !important;
    }
    
    .mobile-menu-toggle {
        position: fixed;
        top: 1rem;
        left: 1rem;
        width: 48px;
        height: 48px;
        background: var(--white);
        border: 1px solid var(--border-color);
        border-radius: var(--radius-lg);
        display: none;
        align-items: center;
        justify-content: center;
        font-size: 1.25rem;
        color: var(--primary-color);
        cursor: pointer;
        z-index: 999;
        box-shadow: var(--shadow-lg);
        transition: all var(--transition-fast);
    }
    
    .mobile-menu-toggle:hover {
        background: var(--primary-color);
        color: var(--white);
        transform: scale(1.05);
    }
    
    @media (max-width: 768px) {
        .mobile-menu-toggle {
            display: flex;
        }
        
        .sidebar {
            position: fixed;
            z-index: 1001;
            box-shadow: var(--shadow-2xl);
        }
    }
`;
document.head.appendChild(animationStyles);

// ==================== Page Visibility Change ====================
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        console.log('Page hidden');
    } else {
        console.log('Page visible');
    }
});

// ==================== Console Styling ====================
console.log('%cStudyMate AI', 'font-size: 24px; font-weight: bold; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent;');
console.log('%cPowered by Google Gemini', 'font-size: 12px; color: #64748b;');
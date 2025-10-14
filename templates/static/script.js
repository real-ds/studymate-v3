// static/script.js

document.addEventListener('DOMContentLoaded', function() {
    // File upload drag and drop functionality
    const fileUploadArea = document.getElementById('fileUploadArea');
    const fileInput = document.getElementById('fileInput');
    const browseBtn = document.querySelector('.browse-btn');

    if (fileUploadArea && fileInput) {
        // Prevent default drag behaviors
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            fileUploadArea.addEventListener(eventName, preventDefaults, false);
            document.body.addEventListener(eventName, preventDefaults, false);
        });

        // Highlight drop area when item is dragged over it
        ['dragenter', 'dragover'].forEach(eventName => {
            fileUploadArea.addEventListener(eventName, highlight, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            fileUploadArea.addEventListener(eventName, unhighlight, false);
        });

        // Handle dropped files
        fileUploadArea.addEventListener('drop', handleDrop, false);

        // Browse button click
        if (browseBtn) {
            browseBtn.addEventListener('click', () => fileInput.click());
        }

        // File input change
        fileInput.addEventListener('change', handleFileSelect);

        function preventDefaults(e) {
            e.preventDefault();
            e.stopPropagation();
        }

        function highlight(e) {
            fileUploadArea.classList.add('dragover');
        }

        function unhighlight(e) {
            fileUploadArea.classList.remove('dragover');
        }

        function handleDrop(e) {
            const dt = e.dataTransfer;
            const files = dt.files;
            fileInput.files = files;
            handleFileSelect({ target: { files: files } });
        }

        function handleFileSelect(e) {
            const files = e.target.files;
            if (files.length > 0) {
                const file = files[0];
                updateUploadArea(file);
            }
        }

        function updateUploadArea(file) {
            const uploadText = fileUploadArea.querySelector('.upload-text');
            const uploadIcon = fileUploadArea.querySelector('.upload-icon');
            
            // Update icon based on file type
            const extension = file.name.split('.').pop().toLowerCase();
            let icon = '📁';
            
            if (extension === 'pdf') icon = '📕';
            else if (['ppt', 'pptx'].includes(extension)) icon = '📊';
            else if (['doc', 'docx'].includes(extension)) icon = '📝';
            else if (extension === 'txt') icon = '📄';
            
            uploadIcon.textContent = icon;
            uploadText.innerHTML = `
                <h3>File selected: ${file.name}</h3>
                <p>Size: ${formatFileSize(file.size)} | Ready to upload</p>
            `;
            
            fileUploadArea.style.borderColor = 'var(--accent-color)';
            fileUploadArea.style.background = 'rgba(16, 185, 129, 0.05)';
        }

        function formatFileSize(bytes) {
            if (bytes === 0) return '0 Bytes';
            const k = 1024;
            const sizes = ['Bytes', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
        }
    }

    // Form submission loading state
    const forms = document.querySelectorAll('form');
    forms.forEach(form => {
        form.addEventListener('submit', function(e) {
            const submitBtn = form.querySelector('button[type="submit"]');
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.classList.add('loading');
                
                // For upload form, show special loading text
                if (form.action.includes('/upload')) {
                    const originalText = submitBtn.innerHTML;
                    submitBtn.innerHTML = '<span>🤖 AI is processing...</span>';
                    
                    // Re-enable after 30 seconds (in case of long processing)
                    setTimeout(() => {
                        submitBtn.disabled = false;
                        submitBtn.classList.remove('loading');
                        submitBtn.innerHTML = originalText;
                    }, 30000);
                }
            }
        });
    });

    // Auto-hide flash messages after 5 seconds
    const flashMessages = document.querySelectorAll('.flash-message');
    flashMessages.forEach(message => {
        setTimeout(() => {
            message.style.animation = 'slideOut 0.3s ease-out forwards';
            setTimeout(() => {
                message.remove();
            }, 300);
        }, 5000);
    });

    // Add slideOut animation
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideOut {
            from {
                opacity: 1;
                transform: translateY(0);
                max-height: 100px;
            }
            to {
                opacity: 0;
                transform: translateY(-20px);
                max-height: 0;
                margin: 0;
                padding: 0;
            }
        }
    `;
    document.head.appendChild(style);

    // Smooth scrolling for anchor links
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

    // Add loading animation to download links
    const downloadLinks = document.querySelectorAll('.btn-download');
    downloadLinks.forEach(link => {
        link.addEventListener('click', function() {
            const originalText = this.innerHTML;
            this.innerHTML = '<span>⬇️ Downloading...</span>';
            this.style.opacity = '0.8';
            
            setTimeout(() => {
                this.innerHTML = originalText;
                this.style.opacity = '1';
            }, 2000);
        });
    });
});

// Utility function for showing custom notifications
function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `flash-message flash-${type}`;
    notification.innerHTML = `
        <span>${message}</span>
        <button onclick="this.parentElement.remove()" class="flash-close">&times;</button>
    `;
    
    const container = document.querySelector('.main-content');
    if (container) {
        container.insertBefore(notification, container.firstChild);
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.animation = 'slideOut 0.3s ease-out forwards';
                setTimeout(() => notification.remove(), 300);
            }
        }, 5000);
    }
}

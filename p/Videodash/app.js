
        // Konfigurasi
        const API_URL = 'https://script.google.com/macros/s/AKfycbyf9miQt1nePyWuwCF12NW1XbrRFB_sKy8nfJRcbMkM59KKiDXP9FGI0omwCD5cDX-g/exec';
        const AUTH_TOKEN = 'cmVwbHkuYmxvZ21v';
        const DEFAULT_SHEET = 'data_movie';
        const ITEMS_PER_PAGE = 15;
        const API_CACHE_KEY = 'videoDataCache';
        const CACHE_EXPIRY_HOURS = 1;
        
        let currentData = [];
        let filteredData = [];
        let currentPage = 1;
        let currentVideo = null;
        let totalPages = 1;
        let scrollPosition = 0;
        
        const tableContainer = document.getElementById('tableContainer');
        const loadingState = document.getElementById('loadingState');
        const refreshBtn = document.getElementById('refreshBtn');
        const refreshIcon = document.getElementById('refreshIcon');
        const lastUpdated = document.getElementById('lastUpdated');
        const searchInput = document.getElementById('searchInput');
        const searchIcon = document.getElementById('searchIcon');
        const paginationContainer = document.getElementById('paginationContainer');
        const videoModal = document.getElementById('videoModal');
        const closeModal = document.getElementById('closeModal');
        const videoFrame = document.getElementById('videoFrame');
        const videoOverlay = document.getElementById('videoOverlay');
        const overlayIcon = document.getElementById('overlayIcon');
        const overlayText = document.getElementById('overlayText');
        const keyInputContainer = document.getElementById('keyInputContainer');
        const keyInput = document.getElementById('keyInput');
        const submitKey = document.getElementById('submitKey');
        const modalTitle = document.getElementById('modalTitle');
        const detailsContainer = document.getElementById('detailsContainer');
        const notification = document.getElementById('notification');
        const notificationMessage = document.getElementById('notificationMessage');
        const discussionBtn = document.getElementById('discussionBtn');
        const discussionModal = document.getElementById('discussionModal');
        const closeDiscussionModal = document.getElementById('closeDiscussionModal');
        const goToDiscussion = document.getElementById('goToDiscussion');
        const actionButtons = document.getElementById('actionButtons');

        function formatDateTime() {
            const now = new Date();
            return now.toLocaleString('id-ID', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        }

        function getCachedData() {
            const cache = localStorage.getItem(API_CACHE_KEY);
            if (!cache) return null;
            
            const { timestamp, data } = JSON.parse(cache);
            const isExpired = (Date.now() - timestamp) > (CACHE_EXPIRY_HOURS * 60 * 60 * 1000);
            
            return isExpired ? null : data;
        }

        function cacheData(data) {
            const cache = {
                timestamp: Date.now(),
                data: data
            };
            localStorage.setItem(API_CACHE_KEY, JSON.stringify(cache));
        }

        function showNotification(message, type = 'info') {
            notificationMessage.textContent = message;
            notification.style.backgroundColor = type === 'error' ? 'var(--error-color)' : 'var(--accent-color)';
            notification.classList.add('show');
            
            setTimeout(() => {
                notification.classList.remove('show');
            }, 3000);
        }

        function createVideoSlug(title) {
            return title.toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-+|-+$/g, '');
        }

        function formatIframeUrl(url) {
            if (url.includes('youtube.com') || url.includes('youtu.be')) {
                const videoId = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/)[1];
                return `https://www.youtube.com/embed/${videoId}?autoplay=0&rel=0`;
            } else if (url.includes('drive.google.com')) {
                const fileId = url.match(/\/file\/d\/([^\/]+)/)[1];
                return `https://drive.google.com/file/d/${fileId}/preview`;
            }
            return url;
        }

        async function loadData() {
            try {
                showLoading();
                
                const cachedData = getCachedData();
                if (cachedData) {
                    currentData = cachedData;
                    filteredData = [...currentData];
                    renderTable();
                    lastUpdated.textContent = `Terakhir diperbarui: ${formatDateTime()} (Cached)`;
                    hideLoading();
                    checkUrlForVideo();
                    return;
                }

                const response = await fetch(`${API_URL}?token=${AUTH_TOKEN}&sheet=${encodeURIComponent(DEFAULT_SHEET)}`);
                if (!response.ok) throw new Error('Gagal memuat data');
                
                const data = await response.json();
                currentData = data.data || [];
                cacheData(currentData);
                
                filteredData = [...currentData];
                totalPages = Math.ceil(filteredData.length / ITEMS_PER_PAGE);
                
                renderTable();
                renderPagination();
                lastUpdated.textContent = `Terakhir diperbarui: ${formatDateTime()}`;
                checkUrlForVideo();
            } catch (error) {
                showError(error.message);
            } finally {
                hideLoading();
            }
        }

        function checkUrlForVideo() {
            const params = new URLSearchParams(window.location.search);
            const videoSlug = params.get('video');
            
            if (videoSlug && currentData.length > 0) {
                const matchedVideo = currentData.find(item => 
                    createVideoSlug(item.title) === videoSlug
                );
                
                if (matchedVideo) {
                    openVideoModal(matchedVideo.id);
                } else {
                    window.history.replaceState({}, '', window.location.pathname);
                    showNotification('Video tidak ditemukan', 'error');
                }
            }
        }

        function filterData() {
            const searchTerm = searchInput.value.toLowerCase();
            filteredData = searchTerm === '' 
                ? [...currentData] 
                : currentData.filter(item => item.title.toLowerCase().includes(searchTerm));
            
            totalPages = Math.ceil(filteredData.length / ITEMS_PER_PAGE);
            currentPage = 1;
            renderTable();
            renderPagination();
            
            if (window.innerWidth <= 576) {
                searchInput.classList.remove('active');
            }
        }

        function renderTable() {
            if (filteredData.length === 0) {
                tableContainer.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-video-slash" style="font-size: 2rem; margin-bottom: 1rem; opacity: 0.5;"></i>
                        <h3 style="font-weight: 500; margin-bottom: 0.5rem;">Tidak ada data</h3>
                        <p>Tidak ditemukan video yang sesuai dengan pencarian Anda</p>
                    </div>
                `;
                tableContainer.style.display = 'block';
                paginationContainer.style.display = 'none';
                return;
            }
            
            const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
            const endIndex = startIndex + ITEMS_PER_PAGE;
            const currentItems = filteredData.slice(startIndex, endIndex);
            
            let html = `
                <table>
                    <thead>
                        <tr>
                            <th>Judul</th>
                            <th>Aksi</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${currentItems.map(item => `
                            <tr>
                                <td style="color: var(--text-primary); font-weight: 500;">
                                    ${item.title}
                                </td>
                                <td>
                                    <button class="btn btn-play btn-sm" onclick="openVideoModal(${item.id})">
                                        <i class="fas fa-play"></i> Play
                                    </button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                <div style="padding: 1rem; color: var(--text-secondary); font-size: 0.875rem;">
                    Menampilkan ${startIndex + 1}-${Math.min(endIndex, filteredData.length)} dari ${filteredData.length} video
                </div>
            `;
            
            tableContainer.innerHTML = html;
            tableContainer.style.display = 'block';
            paginationContainer.style.display = 'flex';
        }

        function renderPagination() {
            if (totalPages <= 1) {
                paginationContainer.style.display = 'none';
                return;
            }
            
            const maxVisiblePages = 5;
            let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
            let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
            
            if (endPage - startPage + 1 < maxVisiblePages) {
                if (currentPage < totalPages / 2) {
                    endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
                } else {
                    startPage = Math.max(1, endPage - maxVisiblePages + 1);
                }
            }
            
            let html = `
                <li class="page-item">
                    <a href="#" class="page-link ${currentPage === 1 ? 'disabled' : ''}" 
                       onclick="changePage(${currentPage - 1}); return false;">
                        &laquo;
                    </a>
                </li>
            `;
            
            if (startPage > 1) {
                html += `
                    <li class="page-item">
                        <a href="#" class="page-link" onclick="changePage(1); return false;">
                            1
                        </a>
                    </li>
                    ${startPage > 2 ? '<li class="page-item"><span class="page-link ellipsis">...</span></li>' : ''}
                `;
            }
            
            for (let i = startPage; i <= endPage; i++) {
                html += `
                    <li class="page-item">
                        <a href="#" class="page-link ${i === currentPage ? 'active' : ''}" 
                           onclick="changePage(${i}); return false;">
                            ${i}
                        </a>
                    </li>
                `;
            }
            
            if (endPage < totalPages) {
                html += `
                    ${endPage < totalPages - 1 ? '<li class="page-item"><span class="page-link ellipsis">...</span></li>' : ''}
                    <li class="page-item">
                        <a href="#" class="page-link" onclick="changePage(${totalPages}); return false;">
                            ${totalPages}
                        </a>
                    </li>
                `;
            }
            
            html += `
                <li class="page-item">
                    <a href="#" class="page-link ${currentPage === totalPages ? 'disabled' : ''}" 
                       onclick="changePage(${currentPage + 1}); return false;">
                        &raquo;
                    </a>
                </li>
            `;
            
            paginationContainer.innerHTML = html;
        }

        function changePage(page) {
            if (page < 1 || page > totalPages) return;
            
            currentPage = page;
            renderTable();
            renderPagination();
            tableContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }

        function openVideoModal(videoId) {
            // Simpan posisi scroll sebelum membuka modal
            scrollPosition = window.scrollY || document.documentElement.scrollTop;
            
            currentVideo = filteredData.find(item => item.id === videoId);
            if (!currentVideo) return;

            const videoSlug = createVideoSlug(currentVideo.title);
            window.history.pushState({}, '', `?video=${videoSlug}`);

            modalTitle.textContent = currentVideo.title;
            videoFrame.src = formatIframeUrl(currentVideo.video_url);
            setupVideoAccess();
            renderVideoDetails();
            renderActionButtons();
            videoModal.style.display = 'block';
            document.body.classList.add('modal-open');
        }

        function renderActionButtons() {
            actionButtons.innerHTML = '';
            
            if (!currentVideo) return;
            
            if (currentVideo.get_key_url) {
                actionButtons.innerHTML += `
                    <button onclick="window.open('${currentVideo.get_key_url}', '_blank')" class="action-btn key-btn">
                        <i class="fas fa-key"></i>
                        Get Access Key
                    </button>
                `;
            }
            
            if (currentVideo.download_url) {
                actionButtons.innerHTML += `
                    <button onclick="window.open('${currentVideo.download_url}', '_blank')" class="action-btn download-btn">
                        <i class="fas fa-cloud-download-alt"></i>
                        Download HD
                    </button>
                `;
            }
        }

        function setupVideoAccess() {
            if (!currentVideo) return;
            
            if (currentVideo.access === 'public') {
                videoOverlay.style.display = 'none';
                keyInputContainer.style.display = 'none';
            } 
            else if (currentVideo.access === 'private') {
                videoOverlay.style.display = 'flex';
                videoOverlay.classList.add('blurred');
                overlayIcon.className = 'fas fa-lock';
                overlayText.textContent = 'Video ini membutuhkan akses key';
                keyInputContainer.style.display = 'flex';
                keyInput.value = '';
            } 
            else if (currentVideo.access === 'blacklist') {
                videoOverlay.style.display = 'flex';
                videoOverlay.classList.add('blurred');
                overlayIcon.className = 'fas fa-ban';
                overlayText.textContent = 'Video ini tidak tersedia';
                keyInputContainer.style.display = 'none';
            }
        }

        function renderVideoDetails() {
            if (!currentVideo) return;
            
            const excludedKeys = ['id', 'video_url', 'key', 'access', 'title', 'get_key_url', 'download_url'];
            const details = Object.entries(currentVideo)
                .filter(([key]) => !excludedKeys.includes(key))
                .map(([key, value]) => {
                    const formattedKey = key.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
                    const formattedValue = value || '-';
                    return `
                        <div class="detail-item">
                            <div class="detail-label">${formattedKey}</div>
                            <div class="detail-value">${formattedValue}</div>
                        </div>
                    `;
                }).join('');
            
            detailsContainer.innerHTML = details;
        }

        function checkAccessKey() {
            if (!currentVideo) return;
            
            const enteredKey = keyInput.value.trim();
            
            if (!enteredKey) {
                showNotification('Silakan masukkan access key', 'error');
                return;
            }
            
            if (enteredKey === currentVideo.key) {
                videoOverlay.style.display = 'none';
                videoOverlay.classList.remove('blurred');
            } else {
                showNotification('Access key tidak valid. Silakan coba lagi.', 'error');
                keyInput.value = '';
            }
        }

        function closeVideoModal() {
            window.history.pushState({}, '', window.location.pathname);
            videoModal.style.display = 'none';
            document.body.classList.remove('modal-open');
            videoFrame.src = '';
            currentVideo = null;
            
            window.scrollTo(0, scrollPosition);
        }

        function toggleDiscussionModal() {
            discussionModal.classList.toggle('show');
        }

        function showLoading() {
            loadingState.style.display = 'flex';
            tableContainer.style.display = 'none';
            paginationContainer.style.display = 'none';
            refreshIcon.classList.add('fa-spin');
        }

        function hideLoading() {
            loadingState.style.display = 'none';
            refreshIcon.classList.remove('fa-spin');
        }

        function showError(message) {
            tableContainer.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-exclamation-triangle" style="font-size: 2rem; margin-bottom: 1rem; color: var(--error-color);"></i>
                    <h3 style="font-weight: 500; margin-bottom: 0.5rem;">Gagal memuat data</h3>
                    <p>${message}</p>
                    <button onclick="loadData()" class="btn btn-outline" style="margin-top: 1rem;">
                        <span class="fas fa-sync-alt"></span>
                        Coba Lagi
                    </button>
                </div>
            `;
            tableContainer.style.display = 'block';
            paginationContainer.style.display = 'none';
        }

        document.addEventListener('DOMContentLoaded', () => {
            loadData();
            
            refreshBtn.addEventListener('click', () => {
                localStorage.removeItem(API_CACHE_KEY);
                loadData();
            });
            
            searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') filterData();
            });
            
            searchIcon.addEventListener('click', () => {
                searchInput.classList.toggle('active');
                if (searchInput.classList.contains('active')) searchInput.focus();
            });
            
            closeModal.addEventListener('click', closeVideoModal);
            submitKey.addEventListener('click', checkAccessKey);
            keyInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') checkAccessKey();
            });
            
            discussionBtn.addEventListener('click', toggleDiscussionModal);
            closeDiscussionModal.addEventListener('click', toggleDiscussionModal);
            goToDiscussion.addEventListener('click', () => {
                showNotification('Halaman diskusi sedang dalam pengembangan!');
            });
            
            window.addEventListener('click', (e) => {
                if (e.target === videoModal) closeVideoModal();
                if (e.target === discussionModal) toggleDiscussionModal();
                if (!e.target.closest('.search-container') && window.innerWidth <= 576) {
                    searchInput.classList.remove('active');
                }
            });
            
            window.addEventListener('popstate', () => {
                if (!window.location.search.includes('video')) {
                    closeVideoModal();
                } else {
                    checkUrlForVideo();
                }
            });
        });

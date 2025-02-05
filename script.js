// Add smooth page transitions
document.addEventListener('DOMContentLoaded', () => {
    // Fade in the page content
    const main = document.querySelector('main');
    main.style.opacity = '0';
    setTimeout(() => {
        main.style.opacity = '1';
    }, 100);

    // Add smooth scrolling to all links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            document.querySelector(this.getAttribute('href')).scrollIntoView({
                behavior: 'smooth'
            });
        });
    });

    // Add lazy loading for images and videos
    if ('loading' in HTMLImageElement.prototype) {
        const images = document.querySelectorAll('img[loading="lazy"]');
        images.forEach(img => {
            img.src = img.dataset.src;
        });
    }

    // Add touch support for mobile devices
    let touchStartX = 0;
    let touchEndX = 0;

    document.addEventListener('touchstart', e => {
        touchStartX = e.changedTouches[0].screenX;
    }, false);

    document.addEventListener('touchend', e => {
        touchEndX = e.changedTouches[0].screenX;
        handleSwipe();
    }, false);

    function handleSwipe() {
        const swipeThreshold = 50;
        if (touchEndX < touchStartX - swipeThreshold) {
            // Swipe left - go to next page
            const nextPage = document.querySelector('.nav-links .active').nextElementSibling;
            if (nextPage) nextPage.click();
        }
        if (touchEndX > touchStartX + swipeThreshold) {
            // Swipe right - go to previous page
            const prevPage = document.querySelector('.nav-links .active').previousElementSibling;
            if (prevPage) prevPage.click();
        }
    }

    function addVideoToStorage(video) {
        let videos = JSON.parse(localStorage.getItem('videos') || '[]');
        videos.unshift({
            title: video.title,
            channel: video.channel,
            views: video.views,
            embedCode: video.embedCode,
            timestamp: new Date().toISOString()
        });
        localStorage.setItem('videos', JSON.stringify(videos));
    }

    function createVideoElement(video) {
        return `
            <div class="video-item">
                <div class="thumbnail">
                    ${video.embedCode}
                </div>
                <div class="video-info">
                    <h3>${video.title}</h3>
                    <div class="meta">
                        <span class="channel">${video.channel}</span>
                        <span class="views">${video.views} views</span>
                        <span class="timestamp">${formatTimestamp(video.timestamp)}</span>
                    </div>
                </div>
            </div>
        `;
    }
});

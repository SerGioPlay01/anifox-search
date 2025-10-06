const url = `https://kodikapi.com/list?token=a036c8a4c59b43e72e212e4d0388ef7d&year=2024&updated_at=updated_at&types=anime,anime-serial`;
fetch(url)
    .then(response => response.json())
    .then(data => {
        const container = document.getElementById('data');
        container.innerHTML = '';
        let resultsCount = 0;
        let uniqueTitles = new Set(); // Создаем множество для хранения уникальных названий
        if (data.results && Array.isArray(data.results)) {
            data.results.forEach(item => {
                const title = item.title;
                if (!uniqueTitles.has(title) && resultsCount < 5) {
                    const videoLink = item.link;
                    const heading = document.createElement('h2');
                    heading.className = 'h2_name';
                    heading.textContent = title;
                    const iframe = document.createElement('iframe');
                    iframe.className = 'iframe_video'
                    iframe.src = videoLink;
                    iframe.allowFullscreen = 'True';
                    container.appendChild(heading);
                    container.appendChild(iframe);
                    uniqueTitles.add(title); // Добавляем название в множество уникальных названий
                    resultsCount++;
                }
            });
        }
    })
    .catch(error => {
        console.error('Error:', error);
    });
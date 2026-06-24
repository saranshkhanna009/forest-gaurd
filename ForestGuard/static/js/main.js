document.addEventListener('DOMContentLoaded', () => {
    
    // --- 1. Leaflet Map Initialization ---
    const map = L.map('map').setView([36.7783, -119.4179], 6); // Default California
    const darkLayer=L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap &copy; CARTO',
        subdomains: 'abcd',
        maxZoom: 20
    });
    const satLayer=L.tileLayer('https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',{subdomains:['mt0','mt1','mt2','mt3'],maxZoom:20});
    darkLayer.addTo(map);
    let usingSat=false;

    let activeMarker = null;
    let activeCircle = null;
    let activePolygons = [];

    // Custom Icons
    const icons = {
        safe: L.icon({ iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png', iconSize: [25, 41], iconAnchor: [12, 41]}),
        watch: L.icon({ iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-yellow.png', iconSize: [25, 41], iconAnchor: [12, 41]}),
        danger: L.icon({ iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png', iconSize: [25, 41], iconAnchor: [12, 41]})
    };

    // --- 2. Location Scanner & API Hook ---
    const btnScan = document.getElementById('btn-scan');
    const btnGeolocate = document.getElementById('btn-geolocate');
    const locInput = document.getElementById('location-input');
    const toggleLayer=document.getElementById('toggle-layer');
    let riskChart=null;
    toggleLayer.addEventListener('click',()=>{ if(usingSat){map.removeLayer(satLayer);darkLayer.addTo(map);toggleLayer.innerText='Satellite View';}else{map.removeLayer(darkLayer);satLayer.addTo(map);toggleLayer.innerText='Dark View';} usingSat=!usingSat;});

    btnScan.addEventListener('click', () => {
        const query = locInput.value.trim();
        if(!query) {
            alert("Please enter a location to scan.");
            return;
        }
        runAnalysis({ city: query });
    });

    // Also support Enter key
    locInput.addEventListener('keypress', (e) => {
        if(e.key === 'Enter') btnScan.click();
    });

    btnGeolocate.addEventListener('click', () => {
        if (navigator.geolocation) {
            btnGeolocate.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
            navigator.geolocation.getCurrentPosition((pos) => {
                btnGeolocate.innerHTML = '<i class="fa-solid fa-crosshairs"></i>';
                runAnalysis({ lat: pos.coords.latitude, lon: pos.coords.longitude });
            }, (err) => {
                btnGeolocate.innerHTML = '<i class="fa-solid fa-crosshairs"></i>';
                alert("Geolocation failed or denied.");
            });
        } else {
            alert("Geolocation is not supported by this browser.");
        }
    });

    function runAnalysis(payload) {
        // UI Loading State
        btnScan.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Scanning AI Pipeline...';
        btnScan.disabled = true;
        
        fetch('/api/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        })
        .then(res => res.json())
        .then(data => {
            btnScan.innerHTML = '<i class="fa-solid fa-satellite-dish"></i> Scan';
            btnScan.disabled = false;
            
            if(data.error) {
                alert("Analysis failed: " + data.error);
                return;
            }

            updateDashboardUI(data);
            updateMapElements(data);
        })
        .catch(err => {
            console.error("API Error:", err);
            btnScan.innerHTML = '<i class="fa-solid fa-satellite-dish"></i> Scan';
            btnScan.disabled = false;
            alert("An error occurred connecting to the 11-feature intelligence engine.");
        });
    }

    function updateDashboardUI(data) {
        // Intelligence Data - Top Hero
        document.getElementById('weather-location').innerText = data.data.location;
        document.getElementById('weather-temp').innerText = `${data.data.temperature}°C`;
        document.getElementById('weather-desc').innerText = `11-Feature Scan Complete`;
        
        // 11 Feature Real-time Tiles
        document.getElementById('env-temp').innerText = `${data.data.temperature}°C`;
        document.getElementById('env-humid').innerText = `${data.data.humidity}%`;
        document.getElementById('env-elevation').innerText = `${data.data.elevation}`;
        document.getElementById('env-rain').innerText = `${data.data.rain_7d}mm`;
        document.getElementById('env-soil').innerText = `${data.data.soil_moisture}%`;
        document.getElementById('env-forest').innerText = `${data.data.forest_density}%`;
        document.getElementById('env-roads').innerText = `${data.data.road_distance}`;
        document.getElementById('env-ndvi').innerText = `${data.data.ndvi}`;
        document.getElementById('env-litter').innerText = `${data.data.leaf_litter}`;
        document.getElementById('env-history').innerText = `${data.data.fire_history}`;

        // Results Card
        document.getElementById('empty-state').style.display = 'none';
        document.getElementById('results-card').style.display = 'block';

        const riskLevel = document.getElementById('risk-level');
        riskLevel.innerText = data.risk_level;
        riskLevel.className = "fw-bold mb-1"; 
        
        let iconType = 'safe';
        if(data.color === 'green') {
            riskLevel.classList.add('status-green');
        } else if (data.color === 'yellow') {
            riskLevel.classList.add('status-yellow'); iconType = 'watch';
        } else {
            riskLevel.classList.add('status-red'); iconType = 'danger';
        }

        document.getElementById('confidence-score').innerText = data.confidence;
        document.getElementById('ai-explanation').innerText = data.explanation;

                renderChart(data);
        if(data.color==='red'){try{const ctx=new (window.AudioContext||window.webkitAudioContext)();const o=ctx.createOscillator();const g=ctx.createGain();o.type='sawtooth';o.frequency.value=880;o.connect(g);g.connect(ctx.destination);g.gain.value=0.02;o.start();o.stop(ctx.currentTime+0.7);}catch(e){}}

        // Recommendations
        const recList = document.getElementById('recommendation-list');
        recList.innerHTML = '';
        data.recommendations.forEach(rec => {
            const li = document.createElement('li');
            li.className = 'list-group-item';
            li.innerHTML = `<i class="fa-solid fa-check text-muted me-2"></i> ${rec}`;
            recList.appendChild(li);
        });

        // Alerts System
        const alertPopup = document.getElementById('emergency-alert');
        if(data.color === 'red') {
            alertPopup.style.display = 'block';
            setTimeout(() => { alertPopup.style.display = 'none'; }, 8000);
        } else {
            alertPopup.style.display = 'none';
        }

        // Update Impact Estimations
        let forestVal = parseFloat(data.data.forest_density) || 0;
        let windSpd = parseFloat(data.data.wind_speed) || 0;
        let villageDist = parseFloat(data.data.village_distance) || 0;
        
        document.getElementById('est-wind').innerText = `${windSpd} km/h`;
        
        let villageClass = "text-success";
        if(villageDist < 2000) villageClass = "text-danger";
        else if (villageDist < 10000) villageClass = "text-warning";
        document.getElementById('est-village').innerHTML = `<span class="${villageClass} fw-bold">${Math.round(villageDist / 100)/10} km</span>`;

        if(data.color === 'red' && forestVal > 0) {
            document.getElementById('est-trees').innerHTML = `<span class="text-danger fw-bold">${Math.round(forestVal * 50)}k+</span>`;
        } else if(data.color === 'yellow' && forestVal > 0) {
            document.getElementById('est-trees').innerHTML = `<span class="text-warning fw-bold">${Math.round(forestVal * 15)}k+</span>`;
        } else {
            document.getElementById('est-trees').innerHTML = `<span class="text-success fw-bold">Minimal</span>`;
        }
    }


    function renderChart(data){
      const ctx=document.getElementById('riskChart'); if(!ctx) return;
      const risk=data.color==='green'?25:data.color==='yellow'?60:90;
      if(riskChart) riskChart.destroy();
      riskChart=new Chart(ctx,{type:'doughnut',data:{labels:['Risk %','Humidity','Wind'],datasets:[{data:[risk,data.data.humidity,data.data.wind_speed]}]},options:{plugins:{legend:{display:false}},scales:{y:{beginAtZero:true,max:100}}}});
    }

    function updateMapElements(data) {
        if(!data.data.lat || !data.data.lon) return;
        
        map.flyTo([data.data.lat, data.data.lon], 12);

        // Clear old overlays
        if(activeMarker) map.removeLayer(activeMarker);
        if(activeCircle) map.removeLayer(activeCircle);
        activePolygons.forEach(p => map.removeLayer(p));
        activePolygons = [];

        let iconType = 'safe';
        let circleColor = '#2ea043';
        if(data.color === 'yellow') { iconType = 'watch'; circleColor = '#d29922'; }
        if(data.color === 'red') { iconType = 'danger'; circleColor = '#f85149'; }

        activeMarker = L.marker([data.data.lat, data.data.lon], {icon: icons[iconType]})
            .addTo(map)
            .bindPopup(`<b>${data.data.location}</b><br>Risk: ${data.risk_level}`)
            .openPopup();

        // Draw 5km Area of Interest
        activeCircle = L.circle([data.data.lat, data.data.lon], {
            className:'pulse-fire',
            color: circleColor,
            fillColor: circleColor,
            fillOpacity: 0.1,
            radius: 5000 // 5km scan radius
        });
    const satLayer=L.tileLayer('https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',{subdomains:['mt0','mt1','mt2','mt3'],maxZoom:20});
    darkLayer.addTo(map);
    let usingSat=false;

        // Draw Synthetic Wind Spread Forecast if High Risk
        if(data.color === 'red' && data.data.wind_speed > 5) {
            const wSpd = data.data.wind_speed;
            
            const spread1h = [
                [data.data.lat, data.data.lon],
                [data.data.lat + (wSpd*0.0005), data.data.lon + (wSpd*0.001)],
                [data.data.lat - (wSpd*0.0005), data.data.lon + (wSpd*0.001)]
            ];
            
            const spread3h = [
                [data.data.lat, data.data.lon],
                [data.data.lat + (wSpd*0.0015), data.data.lon + (wSpd*0.003)],
                [data.data.lat - (wSpd*0.0015), data.data.lon + (wSpd*0.003)]
            ];

            const p3h = L.polygon(spread3h, {color: '#f85149', fillColor: '#f85149', fillOpacity: 0.2, dashArray: '5, 10'})
                         .bindPopup('Estimated 3-hour spread boundary')
                         .addTo(map);
            const p1h = L.polygon(spread1h, {color: '#ff4757', fillColor: '#ff4757', fillOpacity: 0.4})
                         .bindPopup('Estimated 1-hour spread boundary')
                         .addTo(map);
                         
            activePolygons.push(p3h, p1h);
        }
    }

});


document.addEventListener("DOMContentLoaded",()=>{const news=document.getElementById('newsFeed'); if(news){news.innerHTML='<li>Canada wildfire monitoring intensified</li><li>California agencies issue dry-season warning</li><li>Satellite heat anomaly tracking expanded</li>';} const send=document.getElementById('chatSend'); if(send){send.onclick=()=>{const i=document.getElementById('chatInput'); const box=document.getElementById('chatbox'); const q=i.value.trim(); if(!q) return; box.innerHTML += `<div><b>You:</b> ${q}</div>`; let a='Stay alert, avoid dry ignition sources, monitor wind and call emergency services if smoke appears.'; if(q.toLowerCase().includes('prevent')) a='Clear dry leaves, maintain fire lines, restrict campfires, patrol high-risk zones.'; box.innerHTML += `<div><b>AI:</b> ${a}</div>`; box.scrollTop=box.scrollHeight; i.value='';};}});
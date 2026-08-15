const API_BASE = "https://api.open-meteo.com/v1/forecast";
const GEOCODING_API = "https://geocoding-api.open-meteo.com/v1/search";

let temperatureChart = null;


// -------------------------------------
// WEATHER CODE → DESCRIPTION / ICON
// -------------------------------------

function weatherInfo(code) {

    const weather = {

        0: ["Clear sky", "☀️"],

        1: ["Mainly clear", "🌤️"],
        2: ["Partly cloudy", "⛅"],
        3: ["Overcast", "☁️"],

        45: ["Fog", "🌫️"],
        48: ["Depositing rime fog", "🌫️"],

        51: ["Light drizzle", "🌦️"],
        53: ["Moderate drizzle", "🌦️"],
        55: ["Dense drizzle", "🌧️"],

        61: ["Slight rain", "🌦️"],
        63: ["Moderate rain", "🌧️"],
        65: ["Heavy rain", "🌧️"],

        71: ["Slight snow", "🌨️"],
        73: ["Moderate snow", "🌨️"],
        75: ["Heavy snow", "❄️"],

        80: ["Rain showers", "🌦️"],
        81: ["Moderate showers", "🌧️"],
        82: ["Violent showers", "⛈️"],

        95: ["Thunderstorm", "⛈️"],
        96: ["Thunderstorm with hail", "⛈️"],
        99: ["Thunderstorm with hail", "⛈️"]

    };

    return weather[code] || ["Unknown", "🌡️"];
}


// -------------------------------------
// DOM
// -------------------------------------

const cityInput = document.getElementById("cityInput");
const searchBtn = document.getElementById("searchBtn");
const locationBtn = document.getElementById("locationBtn");

const loading = document.getElementById("loading");
const errorBox = document.getElementById("errorBox");
const errorMessage = document.getElementById("errorMessage");


// -------------------------------------
// LOADING
// -------------------------------------

function showLoading() {
    loading.classList.remove("hidden");
}

function hideLoading() {
    loading.classList.add("hidden");
}


// -------------------------------------
// ERROR
// -------------------------------------

function showError(message) {

    errorMessage.textContent = message;

    errorBox.classList.remove("hidden");
}

function hideError() {
    errorBox.classList.add("hidden");
}


// -------------------------------------
// SEARCH CITY
// -------------------------------------

async function searchCity(city) {

    if (!city.trim()) return;

    showLoading();
    hideError();

    try {

        const url =
            `${GEOCODING_API}?name=${encodeURIComponent(city)}&count=1&language=en&format=json`;

        const response = await fetch(url);

        if (!response.ok) {
            throw new Error("Could not search for that city.");
        }

        const data = await response.json();

        if (!data.results || data.results.length === 0) {
            throw new Error("City not found.");
        }

        const location = data.results[0];

        await loadWeather(
            location.latitude,
            location.longitude,
            location.name,
            location.country
        );

    } catch (error) {

        showError(error.message);

    } finally {

        hideLoading();

    }
}


// -------------------------------------
// GET USER LOCATION
// -------------------------------------

function getUserLocation() {

    if (!navigator.geolocation) {

        showError("Your browser does not support location services.");

        return;
    }

    showLoading();
    hideError();

    navigator.geolocation.getCurrentPosition(

        async position => {

            try {

                const latitude = position.coords.latitude;
                const longitude = position.coords.longitude;

                await loadWeather(
                    latitude,
                    longitude,
                    "Your Location",
                    ""
                );

            } catch (error) {

                showError("Could not load weather for your location.");

            } finally {

                hideLoading();

            }
        },

        () => {

            hideLoading();

            showError(
                "Location permission was denied. Search for a city instead."
            );

        }

    );
}


// -------------------------------------
// LOAD WEATHER
// -------------------------------------

async function loadWeather(
    latitude,
    longitude,
    city,
    country
) {

    const params = new URLSearchParams({

        latitude,
        longitude,

        current:
            "temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,surface_pressure,wind_speed_10m",

        hourly:
            "temperature_2m,weather_code,relative_humidity_2m,wind_speed_10m",

        daily:
            "weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset",

        timezone: "auto",

        forecast_days: "7"

    });

    const response = await fetch(`${API_BASE}?${params}`);

    if (!response.ok) {
        throw new Error("Weather service unavailable.");
    }

    const data = await response.json();

    updateCurrentWeather(data, city, country);

    updateHourly(data);

    updateDaily(data);

    updateChart(data);

}


// -------------------------------------
// CURRENT WEATHER
// -------------------------------------

function updateCurrentWeather(data, city, country) {

    const current = data.current;
    const daily = data.daily;

    const info = weatherInfo(current.weather_code);

    document.getElementById("cityName").textContent = city;

    document.getElementById("countryName").textContent = country;

    document.getElementById("temperature").textContent =
        Math.round(current.temperature_2m);

    document.getElementById("condition").textContent =
        info[0];

    document.getElementById("weatherIcon").textContent =
        info[1];

    document.getElementById("feelsLike").textContent =
        Math.round(current.apparent_temperature);

    document.getElementById("humidity").textContent =
        `${current.relative_humidity_2m}%`;

    document.getElementById("wind").textContent =
        `${Math.round(current.wind_speed_10m)} km/h`;

    document.getElementById("pressure").textContent =
        `${Math.round(current.surface_pressure)} hPa`;

    document.getElementById("visibility").textContent =
        "N/A";

    document.getElementById("sunrise").textContent =
        formatTime(daily.sunrise[0]);

    document.getElementById("sunset").textContent =
        formatTime(daily.sunset[0]);

    document.getElementById("currentDate").textContent =
        formatDate(current.time);
}


// -------------------------------------
// HOURLY FORECAST
// -------------------------------------

function updateHourly(data) {

    const container =
        document.getElementById("hourlyForecast");

    container.innerHTML = "";

    const currentTime = new Date(data.current.time);

    let startIndex =
        data.hourly.time.findIndex(
            time => new Date(time) >= currentTime
        );

    if (startIndex === -1) startIndex = 0;

    for (
        let i = startIndex;
        i < startIndex + 24 && i < data.hourly.time.length;
        i++
    ) {

        const info =
            weatherInfo(data.hourly.weather_code[i]);

        const card =
            document.createElement("div");

        card.className =
            `hour-card ${i === startIndex ? "active" : ""}`;

        card.innerHTML = `

            <div class="time">
                ${formatHour(data.hourly.time[i])}
            </div>

            <div class="icon">
                ${info[1]}
            </div>

            <div class="temp">
                ${Math.round(data.hourly.temperature_2m[i])}°
            </div>

        `;

        container.appendChild(card);
    }
}


// -------------------------------------
// DAILY FORECAST
// -------------------------------------

function updateDaily(data) {

    const container =
        document.getElementById("dailyForecast");

    container.innerHTML = "";

    for (let i = 0; i < 7; i++) {

        const info =
            weatherInfo(data.daily.weather_code[i]);

        const date =
            new Date(data.daily.time[i]);

        const card =
            document.createElement("div");

        card.className = "day-card";

        card.innerHTML = `

            <div class="day">
                ${formatDay(date, i)}
            </div>

            <div class="icon">
                ${info[1]}
            </div>

            <div class="description">
                ${info[0]}
            </div>

            <div class="temps">

                <span class="high">
                    ${Math.round(data.daily.temperature_2m_max[i])}°
                </span>

                <span class="low">
                    ${Math.round(data.daily.temperature_2m_min[i])}°
                </span>

            </div>
        `;

        container.appendChild(card);
    }
}


// -------------------------------------
// TEMPERATURE CHART
// -------------------------------------

function updateChart(data) {

    const ctx =
        document
            .getElementById("temperatureChart")
            .getContext("2d");

    const currentTime =
        new Date(data.current.time);

    let startIndex =
        data.hourly.time.findIndex(
            time => new Date(time) >= currentTime
        );

    if (startIndex === -1) startIndex = 0;

    const times =
        data.hourly.time.slice(
            startIndex,
            startIndex + 24
        );

    const temperatures =
        data.hourly.temperature_2m.slice(
            startIndex,
            startIndex + 24
        );

    if (temperatureChart) {
        temperatureChart.destroy();
    }

    temperatureChart = new Chart(ctx, {

        type: "line",

        data: {

            labels: times.map(formatHour),

            datasets: [{

                label: "Temperature °C",

                data: temperatures,

                tension: 0.4,

                fill: true,

                pointRadius: 4

            }]

        },

        options: {

            responsive: true,

            maintainAspectRatio: false,

            plugins: {

                legend: {
                    display: false
                }

            },

            scales: {

                y: {

                    ticks: {
                        callback: value => `${value}°`
                    }

                }

            }

        }

    });
}


// -------------------------------------
// DATE HELPERS
// -------------------------------------

function formatTime(dateString) {

    return new Date(dateString)
        .toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit"
        });
}


function formatHour(dateString) {

    return new Date(dateString)
        .toLocaleTimeString([], {
            hour: "numeric"
        });
}


function formatDate(dateString) {

    return new Date(dateString)
        .toLocaleDateString([], {
            weekday: "long",
            month: "long",
            day: "numeric"
        });
}


function formatDay(date, index) {

    if (index === 0) return "Today";

    return date.toLocaleDateString([], {
        weekday: "short"
    });
}


// -------------------------------------
// EVENTS
// -------------------------------------

searchBtn.addEventListener(
    "click",
    () => searchCity(cityInput.value)
);


cityInput.addEventListener(
    "keydown",
    event => {

        if (event.key === "Enter") {
            searchCity(cityInput.value);
        }

    }
);


locationBtn.addEventListener(
    "click",
    getUserLocation
);


// -------------------------------------
// DEFAULT LOCATION
// -------------------------------------

searchCity("Mumbai");